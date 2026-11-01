// Teste de integração do AURA: sobe o servidor num banco temporário e exercita REST + socket.io.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as ioc } from 'socket.io-client';

const PORTA = 3401;
const BASE = `http://localhost:${PORTA}`;
const RAIZ = path.resolve(import.meta.dirname, '..');
const PASTA_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-teste-'));
const BANCO = path.join(PASTA_TEMP, 'aura-teste.db');
const PALETA = ['#7c5cff', '#c056f5', '#ff9a3c', '#3ee6a8', '#1d4ed8', '#c2410c', '#0e7490', '#db2777'];

let passou = 0;
let falhou = 0;
const falhas = [];

function check(nome, condicao, detalhe) {
  if (condicao) {
    passou++;
    console.log(`  ✓ ${nome}`);
  } else {
    falhou++;
    falhas.push(nome);
    let extra = '';
    if (detalhe !== undefined) {
      try { extra = ` — ${JSON.stringify(detalhe).slice(0, 400)}`; } catch { extra = ` — ${String(detalhe)}`; }
    }
    console.log(`  ✗ ${nome}${extra}`);
  }
}
const secao = (t) => console.log(`\n${t}`);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- servidor ----------------
let logServidor = '';
let servidorSaiu = false;
const servidor = spawn(process.execPath, ['server.js'], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), AURA_DB: BANCO },
  stdio: ['ignore', 'pipe', 'pipe'],
});
servidor.stdout.on('data', (d) => { logServidor += d; });
servidor.stderr.on('data', (d) => { logServidor += d; });
servidor.on('exit', () => { servidorSaiu = true; });

async function esperarServidor() {
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    if (servidorSaiu) throw new Error('o servidor encerrou ao iniciar:\n' + logServidor);
    if (logServidor.includes('rodando')) {
      try {
        const r = await fetch(BASE + '/');
        if (r.status === 200) return;
      } catch { /* ainda subindo */ }
    }
    await pausa(100);
  }
  throw new Error('o servidor não respondeu a tempo:\n' + logServidor);
}

// ---------------- clientes ----------------
const todosSockets = [];

class Cliente {
  constructor() {
    this.cookie = '';
    this.setCookie = [];
  }

  async req(metodo, caminho, corpo, opcoes = {}) {
    const headers = { ...(opcoes.headers || {}) };
    if (this.cookie) headers.Cookie = this.cookie;
    let body;
    if (opcoes.cru !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = opcoes.cru;
    } else if (corpo !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(corpo);
    }
    const res = await fetch(BASE + '/api' + caminho, { method: metodo, headers, body, redirect: 'manual' });
    const sc = res.headers.getSetCookie();
    if (sc.length) this.setCookie = sc;
    for (const c of sc) {
      const par = c.split(';')[0];
      const i = par.indexOf('=');
      if (par.slice(0, i).trim() === 'aura_sid') {
        const v = par.slice(i + 1).trim();
        this.cookie = v ? `aura_sid=${v}` : '';
      }
    }
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* não é JSON */ }
    return { status: res.status, json, headers: res.headers };
  }

  conectar(extra) {
    return conectarSocket(this.cookie, extra);
  }
}

function conectarSocket(cookie, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...extraHeaders };
    if (cookie) headers.Cookie = cookie;
    const s = ioc(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: headers, timeout: 4000 });
    s.recebidos = [];
    s.onAny((ev, dados) => s.recebidos.push({ ev, dados }));
    const t = setTimeout(() => { s.close(); reject(new Error('timeout ao conectar')); }, 5000);
    s.on('connect', () => { clearTimeout(t); todosSockets.push(s); resolve(s); });
    s.on('connect_error', (e) => { clearTimeout(t); s.close(); reject(e); });
  });
}

/** Espera um evento (que satisfaça o filtro). Resolve com o payload ou null no timeout. */
function esperar(s, ev, filtro = () => true, ms = 2500) {
  return new Promise((resolve) => {
    const fn = (d) => {
      let ok = false;
      try { ok = filtro(d); } catch { ok = false; }
      if (ok) { clearTimeout(t); s.off(ev, fn); resolve(d ?? true); }
    };
    const t = setTimeout(() => { s.off(ev, fn); resolve(null); }, ms);
    s.on(ev, fn);
  });
}

/** Resolve true se o evento NÃO chegar em `ms`. */
function nunca(s, ev, filtro = () => true, ms = 500) {
  return new Promise((resolve) => {
    let recebeu = false;
    const fn = (d) => {
      try { if (filtro(d)) recebeu = true; } catch { /* ignora */ }
    };
    s.on(ev, fn);
    setTimeout(() => { s.off(ev, fn); resolve(!recebeu); }, ms);
  });
}

function emitir(s, ev, dados, ms = 2500) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ timeout: true }), ms);
    s.emit(ev, dados, (r) => { clearTimeout(t); resolve(r); });
  });
}

// Ritmo de envio de um cliente bem-comportado (não estoura o limite 5/3s fora do teste de limite).
const historicoEnvio = new Map();
async function enviarMsg(s, chave, canalId, texto) {
  const lista = historicoEnvio.get(chave) || [];
  const agora = Date.now();
  const recentes = lista.filter((t) => agora - t < 3150);
  if (recentes.length >= 5) await pausa(3150 - (agora - recentes[0]) + 20);
  const r = await emitir(s, 'msg:enviar', { canalId, texto });
  historicoEnvio.set(chave, [...recentes.filter((t) => Date.now() - t < 3150), Date.now()]);
  return r;
}

function desconectar(s) {
  return new Promise((resolve) => {
    if (!s.connected) return resolve();
    s.once('disconnect', () => resolve());
    s.disconnect();
  });
}

const temErro = (r) => !!(r && typeof r.erro === 'string' && r.erro.length > 0);
const semSegredos = (u) => u && !Object.keys(u).some((k) => /senha|hash|salt/i.test(k));

// ---------------- testes ----------------
async function testes() {
  await esperarServidor();

  secao('Arquivos estáticos e rotas desconhecidas');
  {
    const raiz = await fetch(BASE + '/');
    const html = await raiz.text();
    check('GET / → 200 com HTML', raiz.status === 200 && (raiz.headers.get('content-type') || '').includes('text/html') && html.includes('<'));
    check('GET / envia Content-Security-Policy', (raiz.headers.get('content-security-policy') || '').includes("script-src 'self'"));
    const entrar = await fetch(BASE + '/entrar.html');
    check('GET /entrar.html → 200', entrar.status === 200);
    const cli = await fetch(BASE + '/socket.io/socket.io.js');
    check('GET /socket.io/socket.io.js → 200', cli.status === 200);
    for (const arq of ['/css/app.css', '/js/app.js', '/js/voz.js']) {
      const r = await fetch(BASE + arq);
      check(`GET ${arq} → 200`, r.status === 200);
    }
    const anon = new Cliente();
    const r404 = await anon.req('GET', '/nao-existe');
    check('rota /api desconhecida → 404 JSON', r404.status === 404 && temErro(r404.json), r404);
    const r404b = await anon.req('POST', '/servidores/1/coisa');
    check('POST /api desconhecido → 404 JSON', r404b.status === 404 && temErro(r404b.json), r404b);
    const eu = await anon.req('GET', '/eu');
    check('GET /eu sem cookie → 401', eu.status === 401 && temErro(eu.json), eu);
    const lixo = await anon.req('GET', '/eu', undefined, { headers: { Cookie: 'aura_sid=' + 'f'.repeat(64) } });
    check('GET /eu com cookie inventado → 401', lixo.status === 401);
  }

  secao('Cadastro e login');
  const lia = new Cliente();
  const rafa = new Cliente();
  const theo = new Cliente();
  const kenji = new Cliente();
  const mari = new Cliente();
  let r = await lia.req('POST', '/registrar', { usuario: 'lia', senha: 'segredo1', nome: 'Lia' });
  const U = {};
  U.lia = r.json;
  check('registrar válido → 201 + Usuario', r.status === 201 && r.json?.usuario === 'lia' && r.json?.nome === 'Lia' &&
    typeof r.json?.id === 'number' && r.json?.statusTexto === '' && r.json?.status === 'online', r);
  check('cor sorteada da paleta', PALETA.includes(r.json?.cor), r.json?.cor);
  check('resposta não expõe senha/hash', semSegredos(r.json));
  const sc = lia.setCookie.join(' | ');
  check('cookie aura_sid definido', /^aura_sid=[0-9a-f]{64}$/.test(lia.cookie), lia.cookie);
  check('cookie HttpOnly; SameSite=Lax; Path=/; 30 dias', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Path=\//.test(sc) && /Max-Age=2592000/.test(sc), sc);

  const invalidos = ['ab', 'a b c', 'lia!', 'x'.repeat(21), '', 'ação', 123, null];
  let todos400 = true;
  for (const u of invalidos) {
    const x = await new Cliente().req('POST', '/registrar', { usuario: u, senha: 'segredo1' });
    if (x.status !== 400 || !temErro(x.json)) todos400 = false;
  }
  check('usuário inválido → 400 (8 variações)', todos400);
  r = await new Cliente().req('POST', '/registrar', { usuario: 'curta', senha: '12345' });
  check('senha curta → 400', r.status === 400 && temErro(r.json), r);
  r = await new Cliente().req('POST', '/registrar', { usuario: 'nomelongo', senha: 'segredo1', nome: 'x'.repeat(33) });
  check('nome de exibição > 32 → 400', r.status === 400, r);
  r = await new Cliente().req('POST', '/registrar', { usuario: 'lia', senha: 'outrasenha' });
  check('usuário duplicado → 409', r.status === 409 && temErro(r.json), r);
  r = await new Cliente().req('POST', '/registrar', { usuario: 'LIA', senha: 'outrasenha' });
  check('duplicado com maiúsculas → 409', r.status === 409, r);

  U.rafa = (await rafa.req('POST', '/registrar', { usuario: 'rafa', senha: 'segredo2', nome: 'Rafa' })).json;
  U.theo = (await theo.req('POST', '/registrar', { usuario: 'theo', senha: 'segredo3', nome: 'Theo' })).json;
  U.kenji = (await kenji.req('POST', '/registrar', { usuario: 'kenji', senha: 'segredo4', nome: 'Kenji' })).json;
  U.mari = (await mari.req('POST', '/registrar', { usuario: 'mari', senha: 'segredo5' })).json;
  check('nome padrão = usuário quando omitido', U.mari?.nome === 'mari', U.mari);

  r = await new Cliente().req('POST', '/entrar', { usuario: 'lia', senha: 'errada!!' });
  check('login com senha errada → 401', r.status === 401 && temErro(r.json), r);
  r = await new Cliente().req('POST', '/entrar', { usuario: 'ninguem', senha: 'segredo1' });
  check('login de usuário inexistente → 401', r.status === 401, r);
  r = await new Cliente().req('POST', '/entrar', { usuario: 'lia' });
  check('login sem senha → 400', r.status === 400, r);
  const lia2 = new Cliente();
  r = await lia2.req('POST', '/entrar', { usuario: 'lia', senha: 'segredo1' });
  check('login correto → 200 + cookie novo', r.status === 200 && r.json?.id === U.lia.id && lia2.cookie && lia2.cookie !== lia.cookie, r);
  r = await lia.req('GET', '/eu');
  check('GET /eu com cookie → Usuario', r.status === 200 && r.json?.id === U.lia.id && semSegredos(r.json), r);

  r = await lia.req('PATCH', '/eu', { nome: 'Lia ✨', statusTexto: 'jogando Valorant', cor: '#3ee6a8' });
  check('PATCH /eu atualiza nome, statusTexto e cor', r.status === 200 && r.json?.nome === 'Lia ✨' &&
    r.json?.statusTexto === 'jogando Valorant' && r.json?.cor === '#3ee6a8', r);
  U.lia = r.json;
  r = await lia.req('PATCH', '/eu', { cor: 'vermelho' });
  check('PATCH /eu cor inválida → 400', r.status === 400, r);
  r = await lia.req('PATCH', '/eu', { nome: '   ' });
  check('PATCH /eu nome vazio → 400', r.status === 400, r);
  r = await lia.req('PATCH', '/eu', { statusTexto: 'x'.repeat(81) });
  check('PATCH /eu statusTexto > 80 → 400', r.status === 400, r);
  r = await new Cliente().req('PATCH', '/eu', { nome: 'X' });
  check('PATCH /eu sem login → 401', r.status === 401, r);
  r = await lia.req('POST', '/servidores', undefined, { cru: '{"nome": ' });
  check('JSON malformado → 400', r.status === 400 && temErro(r.json), r);
  r = await lia.req('POST', '/servidores', undefined, { cru: JSON.stringify({ nome: 'x'.repeat(40 * 1024) }) });
  check('corpo > 32kb → 413', r.status === 413 && temErro(r.json), r);

  r = await lia2.req('POST', '/sair');
  check('POST /sair → {ok:true}', r.status === 200 && r.json?.ok === true, r);
  r = await lia2.req('GET', '/eu');
  check('sessão encerrada não vale mais', r.status === 401, r);
  r = await lia.req('GET', '/eu');
  check('outra sessão do mesmo usuário continua válida', r.status === 200, r);

  secao('Socket: autenticação');
  let erroConexao = null;
  try { await conectarSocket(''); } catch (e) { erroConexao = e; }
  check('socket sem cookie é recusado (nao-autorizado)', erroConexao?.message === 'nao-autorizado', erroConexao?.message);
  erroConexao = null;
  try { await conectarSocket('aura_sid=' + 'a'.repeat(64)); } catch (e) { erroConexao = e; }
  check('socket com cookie inválido é recusado', erroConexao?.message === 'nao-autorizado', erroConexao?.message);
  erroConexao = null;
  try { await conectarSocket(lia.cookie, { Origin: 'http://site-malicioso.example' }); } catch (e) { erroConexao = e; }
  check('socket de outra origem é recusado', !!erroConexao, erroConexao?.message);

  const sL = await lia.conectar();
  const sR = await rafa.conectar();
  const sT = await theo.conectar();
  const sK = await kenji.conectar();
  const sM = await mari.conectar();
  check('sockets autenticados conectam', [sL, sR, sT, sK, sM].every((s) => s.connected));

  secao('Servidores e convites');
  r = await lia.req('POST', '/servidores', { nome: '  Galera Gamer  ' });
  const srv = r.json;
  check('criar servidor → 201', r.status === 201 && srv?.nome === 'Galera Gamer' && srv?.donoId === U.lia.id, r);
  check('sigla = iniciais', srv?.sigla === 'GG', srv?.sigla);
  check('convite com 8 caracteres alfanuméricos', /^[A-Za-z0-9]{8}$/.test(srv?.convite || ''), srv?.convite);
  const geral = srv?.canais?.find((c) => c.nome === 'geral');
  const resenha = srv?.canais?.find((c) => c.nome === 'Resenha');
  check('canais padrão: #geral (texto) e Resenha (voz)', srv?.canais?.length === 2 && geral?.tipo === 'texto' &&
    resenha?.tipo === 'voz' && geral?.servidorId === srv.id && typeof geral?.posicao === 'number', srv?.canais);
  r = await lia.req('POST', '/servidores', { nome: 'a' });
  check('nome de servidor curto → 400', r.status === 400, r);
  r = await lia.req('POST', '/servidores', { nome: 'x'.repeat(41) });
  check('nome de servidor longo → 400', r.status === 400, r);
  r = await lia.req('POST', '/servidores', {});
  check('servidor sem nome → 400', r.status === 400, r);
  r = await lia.req('GET', '/servidores');
  const meu = r.json?.find?.((s) => s.id === srv.id);
  check('GET /servidores inclui o servidor com naoLidos', r.status === 200 && meu && meu.naoLidos && meu.naoLidos[geral.id] === 0, r.json);

  let ev = esperar(sL, 'membro:entrou', (d) => d.membro?.id === U.rafa.id);
  r = await rafa.req('POST', `/convites/${srv.convite}`);
  check('entrar por convite → Servidor', r.status === 200 && r.json?.id === srv.id && Array.isArray(r.json?.canais), r);
  let evr = await ev;
  check('membro:entrou chega aos membros', evr && evr.servidorId === srv.id && evr.membro.dono === false && evr.membro.status === 'online', evr);
  r = await rafa.req('POST', `/convites/${srv.convite}`);
  check('convite repetido é idempotente', r.status === 200 && r.json?.id === srv.id, r);
  r = await rafa.req('POST', '/convites/XXXXXXXX');
  check('convite inexistente → 404', r.status === 404 && temErro(r.json), r);
  r = await rafa.req('POST', '/convites/abc');
  check('convite malformado → 404', r.status === 404, r);
  await theo.req('POST', `/convites/${srv.convite}`);
  await mari.req('POST', `/convites/${srv.convite}`);

  r = await rafa.req('GET', `/servidores/${srv.id}/membros`);
  const donoLista = r.json?.find?.((m) => m.id === U.lia.id);
  check('membros: lista com dono marcado', r.status === 200 && r.json.length === 4 && donoLista?.dono === true &&
    r.json.filter((m) => m.dono).length === 1 && r.json.every(semSegredos), r.json);
  check('membros: campos de Usuario + status de presença', r.json?.every?.((m) => 'usuario' in m && 'cor' in m && 'statusTexto' in m && m.status === 'online'), r.json);

  r = await kenji.req('GET', `/servidores/${srv.id}/membros`);
  check('não membro: GET membros → 403', r.status === 403 && temErro(r.json), r);
  r = await kenji.req('GET', `/canais/${geral.id}/mensagens`);
  check('não membro: GET mensagens → 403', r.status === 403, r);
  r = await kenji.req('POST', `/canais/${geral.id}/lido`);
  check('não membro: POST lido → 403', r.status === 403, r);
  r = await kenji.req('GET', `/canais/${geral.id}/resumo`);
  check('não membro: GET resumo → 403', r.status === 403, r);
  r = await kenji.req('GET', '/servidores/999999/membros');
  check('servidor inexistente → 404', r.status === 404, r);
  r = await kenji.req('GET', '/servidores/abc/membros');
  check('id não numérico → 400', r.status === 400, r);
  let a = await emitir(sK, 'msg:enviar', { canalId: geral.id, texto: 'invasão' });
  check('não membro: msg:enviar via socket → erro', temErro(a), a);

  secao('Canais (só o dono)');
  r = await rafa.req('POST', `/servidores/${srv.id}/canais`, { nome: 'memes', tipo: 'texto' });
  check('membro comum não cria canal → 403', r.status === 403, r);
  r = await lia.req('POST', `/servidores/${srv.id}/canais`, { nome: 'Memes Top', tipo: 'texto' });
  check('nome de canal de texto inválido → 400', r.status === 400, r);
  r = await lia.req('POST', `/servidores/${srv.id}/canais`, { nome: 'memes', tipo: 'palco' });
  check('tipo de canal inválido → 400', r.status === 400, r);
  ev = esperar(sR, 'canal:novo', (d) => d.nome === 'memes');
  let naoK = nunca(sK, 'canal:novo');
  r = await lia.req('POST', `/servidores/${srv.id}/canais`, { nome: 'memes', tipo: 'texto' });
  const memes = r.json;
  check('dono cria canal de texto → 201', r.status === 201 && memes?.tipo === 'texto' && memes?.servidorId === srv.id, r);
  evr = await ev;
  check('canal:novo chega aos membros', evr && evr.id === memes.id, evr);
  check('canal:novo não chega a quem não é membro', await naoK);
  r = await lia.req('POST', `/servidores/${srv.id}/canais`, { nome: 'Sala 3D', tipo: 'voz' });
  const sala3d = r.json;
  check('dono cria canal de voz com nome livre → 201', r.status === 201 && sala3d?.tipo === 'voz' && sala3d?.nome === 'Sala 3D', r);
  r = await lia.req('POST', `/servidores/${srv.id}/canais`, { nome: 'temporario', tipo: 'texto' });
  const tmp = r.json;
  r = await rafa.req('DELETE', `/canais/${tmp.id}`);
  check('membro comum não apaga canal → 403', r.status === 403, r);
  ev = esperar(sR, 'canal:apagado', (d) => d.id === tmp.id);
  r = await lia.req('DELETE', `/canais/${tmp.id}`);
  check('dono apaga canal → {ok}', r.status === 200 && r.json?.ok === true, r);
  evr = await ev;
  check('canal:apagado chega aos membros', evr && evr.servidorId === srv.id, evr);
  r = await lia.req('DELETE', '/canais/999999');
  check('apagar canal inexistente → 404', r.status === 404, r);

  secao('Mensagens');
  ev = esperar(sR, 'msg:nova', (d) => d.texto === 'Bora rankeada hoje?');
  naoK = nunca(sK, 'msg:nova');
  a = await enviarMsg(sL, 'lia', geral.id, '   Bora rankeada hoje?   ');
  const m1 = a?.msg;
  check('msg:enviar → {ok, msg} com texto aparado', a?.ok === true && m1?.texto === 'Bora rankeada hoje?' && m1?.canalId === geral.id, a);
  check('Mensagem tem o formato do contrato', m1 && typeof m1.id === 'number' && typeof m1.criadoEm === 'number' &&
    m1.editadoEm === null && Array.isArray(m1.reacoes) && m1.autor?.id === U.lia.id && m1.autor?.nome === 'Lia ✨' &&
    m1.autor?.usuario === 'lia' && m1.autor?.cor === '#3ee6a8' && !('status' in m1.autor), m1);
  evr = await ev;
  check('msg:nova entregue aos membros', evr && evr.id === m1.id, evr);
  check('msg:nova NÃO entregue a quem não é membro', await naoK);

  const html = '<img src=x onerror="alert(1)"><b>oi</b> & "aspas"';
  a = await enviarMsg(sL, 'lia', geral.id, html);
  r = await lia.req('GET', `/canais/${geral.id}/mensagens`);
  check('HTML na mensagem volta literal (ack e GET)', a?.msg?.texto === html && r.json?.some?.((m) => m.texto === html), a);

  a = await emitir(sL, 'msg:enviar', { canalId: geral.id, texto: '    ' });
  check('mensagem vazia → erro', temErro(a), a);
  a = await emitir(sL, 'msg:enviar', { canalId: geral.id, texto: 'x'.repeat(2001) });
  check('mensagem com 2001 caracteres → erro', temErro(a), a);
  a = await enviarMsg(sR, 'rafa', geral.id, 'y'.repeat(2000));
  check('mensagem com 2000 caracteres → ok', a?.ok === true, a);
  a = await emitir(sL, 'msg:enviar', { canalId: resenha.id, texto: 'oi' });
  check('mensagem em canal de voz → erro', temErro(a), a);
  a = await emitir(sL, 'msg:enviar', { canalId: 999999, texto: 'oi' });
  check('mensagem em canal inexistente → erro', temErro(a), a);

  a = await emitir(sR, 'msg:editar', { id: m1.id, texto: 'hackeado' });
  check('só o autor edita (outro → erro)', temErro(a), a);
  ev = esperar(sR, 'msg:editada', (d) => d.id === m1.id && d.texto === 'Bora rankeada hoje à noite?');
  a = await emitir(sL, 'msg:editar', { id: m1.id, texto: 'hackeado pelo dono?' });
  a = await emitir(sL, 'msg:editar', { id: m1.id, texto: 'Bora rankeada hoje à noite?' });
  check('autor edita → {ok}', a?.ok === true, a);
  evr = await ev;
  check('msg:editada chega com texto novo e editadoEm', evr && evr.texto === 'Bora rankeada hoje à noite?' && typeof evr.editadoEm === 'number', evr);
  a = await emitir(sL, 'msg:editar', { id: m1.id, texto: '  ' });
  check('editar para vazio → erro', temErro(a), a);

  ev = esperar(sL, 'msg:reacoes', (d) => d.id === m1.id);
  a = await emitir(sR, 'msg:reagir', { id: m1.id, emoji: '🔥' });
  evr = await ev;
  check('msg:reagir → {ok} e msg:reacoes', a?.ok === true && evr && evr.canalId === geral.id &&
    evr.reacoes?.length === 1 && evr.reacoes[0].emoji === '🔥' && evr.reacoes[0].usuarios[0] === U.rafa.id, { a, evr });
  ev = esperar(sL, 'msg:reacoes', (d) => d.id === m1.id);
  a = await emitir(sR, 'msg:reagir', { id: m1.id, emoji: '🔥' });
  evr = await ev;
  check('reagir de novo alterna (remove)', a?.ok === true && evr && evr.reacoes.length === 0, evr);
  await emitir(sL, 'msg:reagir', { id: m1.id, emoji: '👀' });
  await emitir(sT, 'msg:reagir', { id: m1.id, emoji: '👀' });
  r = await lia.req('GET', `/canais/${geral.id}/mensagens`);
  const m1b = r.json?.find?.((m) => m.id === m1.id);
  check('GET mensagens traz reacoes agrupadas', m1b?.reacoes?.length === 1 && m1b.reacoes[0].usuarios.length === 2, m1b);
  a = await emitir(sR, 'msg:reagir', { id: m1.id, emoji: 'abc' });
  check('emoji inválido → erro', temErro(a), a);
  a = await emitir(sK, 'msg:reagir', { id: m1.id, emoji: '👍' });
  check('não membro não reage', temErro(a), a);

  const x1 = (await enviarMsg(sR, 'rafa', geral.id, 'mensagem do rafa para apagar')).msg;
  a = await emitir(sT, 'msg:apagar', { id: x1.id });
  check('quem não é autor nem dono não apaga', temErro(a), a);
  a = await emitir(sR, 'msg:apagar', { id: m1.id });
  check('membro não apaga mensagem alheia', temErro(a), a);
  ev = esperar(sR, 'msg:apagada', (d) => d.id === x1.id);
  a = await emitir(sL, 'msg:apagar', { id: x1.id });
  evr = await ev;
  check('dono do servidor apaga mensagem alheia', a?.ok === true && evr && evr.canalId === geral.id, { a, evr });
  const x2 = (await enviarMsg(sL, 'lia', geral.id, 'vou apagar essa')).msg;
  ev = esperar(sT, 'msg:apagada', (d) => d.id === x2.id);
  a = await emitir(sL, 'msg:apagar', { id: x2.id });
  check('autor apaga a própria mensagem', a?.ok === true && !!(await ev), a);
  r = await lia.req('GET', `/canais/${geral.id}/mensagens`);
  check('mensagens apagadas somem do histórico', r.json?.every?.((m) => m.id !== x1.id && m.id !== x2.id));
  a = await emitir(sL, 'msg:apagar', { id: x2.id });
  check('apagar de novo → erro (não encontrada)', temErro(a), a);

  r = await lia.req('GET', `/canais/${geral.id}/mensagens?limite=2`);
  const pag1 = r.json;
  r = await lia.req('GET', `/canais/${geral.id}/mensagens?limite=2&antes=${pag1?.[0]?.id}`);
  const pag2 = r.json;
  check('paginação: limite, ordem crescente e "antes" sem duplicar', pag1?.length === 2 && pag1[0].id < pag1[1].id &&
    pag2?.length >= 1 && pag2.every((m) => m.id < pag1[0].id), { pag1: pag1?.map((m) => m.id), pag2: pag2?.map?.((m) => m.id) });
  r = await lia.req('GET', `/canais/${geral.id}/mensagens?limite=abc`);
  check('limite inválido → 400', r.status === 400, r);
  r = await lia.req('GET', `/canais/${geral.id}/mensagens?limite=999`);
  check('limite acima de 100 é limitado', r.status === 200 && r.json.length <= 100, r.status);

  secao('Limite de envio');
  {
    const res = [];
    for (let i = 0; i < 6; i++) res.push(await emitir(sM, 'msg:enviar', { canalId: memes.id, texto: `spam ${i}` }));
    check('5 mensagens seguidas passam', res.slice(0, 5).every((x) => x?.ok === true), res);
    check('6ª mensagem em 3s → "Calma! Muitas mensagens."', res[5]?.erro === 'Calma! Muitas mensagens.', res[5]);
  }

  secao('Digitando');
  ev = esperar(sL, 'digitando', (d) => d.usuario?.id === U.rafa.id);
  naoK = nunca(sK, 'digitando');
  const naoProprio = nunca(sR, 'digitando');
  a = await emitir(sR, 'digitando', { canalId: geral.id });
  evr = await ev;
  check('digitando repassado aos membros', a?.ok === true && evr && evr.canalId === geral.id && evr.usuario.nome === 'Rafa', { a, evr });
  check('digitando não chega a quem não é membro', await naoK);
  check('digitando não volta para o próprio socket', await naoProprio);
  a = await emitir(sK, 'digitando', { canalId: geral.id });
  check('não membro: digitando → erro', temErro(a), a);

  secao('Presença');
  ev = esperar(sL, 'presenca', (d) => d.usuarioId === U.rafa.id);
  naoK = nunca(sK, 'presenca', (d) => d.usuarioId === U.rafa.id);
  a = await emitir(sR, 'presenca', { status: 'ausente' });
  evr = await ev;
  check('presenca repassada a quem compartilha servidor', a?.ok === true && evr?.status === 'ausente', { a, evr });
  check('presenca não vaza para quem não compartilha nada', await naoK);
  a = await emitir(sR, 'presenca', { status: 'invisivel' });
  check('status inválido → erro', temErro(a), a);
  a = await emitir(sR, 'presenca', { status: 'offline' });
  check('status "offline" não pode ser escolhido', temErro(a), a);
  r = await lia.req('GET', `/servidores/${srv.id}/membros`);
  check('membros refletem o status escolhido', r.json?.find?.((m) => m.id === U.rafa.id)?.status === 'ausente');
  r = await rafa.req('GET', '/eu');
  check('status escolhido persiste no usuário', r.json?.status === 'ausente', r.json);

  const sT2 = await theo.conectar();
  let naoOffline = nunca(sL, 'presenca', (d) => d.usuarioId === U.theo.id && d.status === 'offline', 500);
  await desconectar(sT2);
  check('fechar uma de duas abas não fica offline', await naoOffline);
  ev = esperar(sL, 'presenca', (d) => d.usuarioId === U.theo.id && d.status === 'offline');
  await desconectar(sT);
  evr = await ev;
  check('desconectar o último socket → presenca offline', !!evr, evr);
  r = await lia.req('GET', `/servidores/${srv.id}/membros`);
  check('membro desconectado aparece offline', r.json?.find?.((m) => m.id === U.theo.id)?.status === 'offline');
  ev = esperar(sL, 'presenca', (d) => d.usuarioId === U.theo.id && d.status === 'online');
  let sT3 = await theo.conectar();
  check('reconectar → presenca com o status escolhido', !!(await ev));

  secao('Não lidos e resumo');
  r = await rafa.req('POST', `/canais/${geral.id}/lido`);
  check('POST lido → {ok}', r.status === 200 && r.json?.ok === true, r);
  r = await rafa.req('GET', '/servidores');
  check('após lido, naoLidos = 0', r.json?.[0]?.naoLidos?.[geral.id] === 0, r.json?.[0]?.naoLidos);
  await enviarMsg(sL, 'lia', geral.id, 'Alguém topa jogar às 20h?');
  await enviarMsg(sL, 'lia', geral.id, 'Ei @rafa, você vem? Precisamos de você no time hoje à noite');
  await enviarMsg(sL, 'lia', geral.id, 'cadê a @rafaela?');
  await enviarMsg(sT3, 'theo', geral.id, 'Eu vou! levo o lanche 🍕');
  await enviarMsg(sR, 'rafa', geral.id, 'tô chegando');
  r = await rafa.req('GET', '/servidores');
  check('naoLidos conta só mensagens de outros depois do lido', r.json?.[0]?.naoLidos?.[geral.id] === 4, r.json?.[0]?.naoLidos);
  r = await lia.req('GET', '/servidores');
  check('naoLidos de outro canal independente (6ª barrada pelo limite)', typeof r.json?.[0]?.naoLidos?.[memes.id] === 'number' && r.json[0].naoLidos[memes.id] === 5, r.json?.[0]?.naoLidos);
  r = await rafa.req('GET', `/canais/${geral.id}/resumo`);
  const res1 = r.json;
  check('resumo tem o formato do contrato', r.status === 200 && typeof res1?.total === 'number' && Array.isArray(res1?.participantes) &&
    Array.isArray(res1?.destaques) && Array.isArray(res1?.perguntas) && Array.isArray(res1?.mencoes) && typeof res1?.frase === 'string', res1);
  check('resumo: total = não lidas (4) e participantes', res1?.total === 4 && res1.participantes[0] === 'Lia ✨' && res1.participantes.includes('Theo') && !res1.participantes.includes('Rafa'), res1);
  check('resumo: perguntas detectadas (com "?")', res1?.perguntas?.length === 3 && res1.perguntas.every((m) => m.texto.includes('?')), res1?.perguntas);
  check('resumo: menção a @rafa detectada (e @rafaela não)', res1?.mencoes?.length === 1 && res1.mencoes[0].texto.includes('@rafa,'), res1?.mencoes);
  check('resumo: destaques até 3 mensagens completas', res1?.destaques?.length === 3 && res1.destaques.every((m) => m.autor && m.texto), res1?.destaques);
  check('resumo: frase em pt-BR', res1?.frase === '4 mensagens de Lia ✨ e Theo — 3 perguntas e 1 menção a você', res1?.frase);
  r = await rafa.req('POST', `/canais/${geral.id}/lido`);
  r = await rafa.req('GET', '/servidores');
  check('POST lido zera de novo', r.json?.[0]?.naoLidos?.[geral.id] === 0, r.json?.[0]?.naoLidos);
  r = await rafa.req('GET', `/canais/${geral.id}/resumo`);
  check('resumo sem não lidas usa as últimas 30', r.status === 200 && r.json.total > 0 && r.json.total <= 30 && r.json.modo === 'recentes', r.json);

  secao('Mensagens diretas');
  ev = esperar(sR, 'dm:nova');
  r = await lia.req('POST', '/dms', { usuario: 'rafa' });
  const dm = r.json;
  check('criar DM → 201 com DM', r.status === 201 && typeof dm?.canalId === 'number' && dm?.outro?.id === U.rafa.id &&
    dm?.ultima === null && dm?.naoLidos === 0 && semSegredos(dm?.outro), r);
  evr = await ev;
  check('dm:nova chega ao outro participante (outro = quem criou)', evr && evr.canalId === dm.canalId && evr.outro?.id === U.lia.id, evr);
  r = await lia.req('POST', '/dms', { usuario: 'rafa' });
  check('DM repetida reaproveita o canal', r.status === 200 && r.json?.canalId === dm.canalId, r);
  r = await rafa.req('POST', '/dms', { usuario: '@lia' });
  check('DM pelo outro lado reaproveita o canal', r.json?.canalId === dm.canalId, r);
  r = await lia.req('POST', '/dms', { usuario: 'lia' });
  check('DM consigo mesmo → 400', r.status === 400 && temErro(r.json), r);
  r = await lia.req('POST', '/dms', { usuario: 'fantasma' });
  check('DM com usuário inexistente → 404', r.status === 404, r);
  r = await lia.req('POST', '/dms', { usuario: 42 });
  check('DM com usuário de tipo errado → 400', r.status === 400, r);

  ev = esperar(sR, 'msg:nova', (d) => d.canalId === dm.canalId);
  let naoT = nunca(sT3, 'msg:nova', (d) => d.canalId === dm.canalId);
  a = await enviarMsg(sL, 'lia', dm.canalId, 'segredo só nosso');
  const dmMsg = a?.msg;
  evr = await ev;
  check('mensagem na DM entregue ao participante', a?.ok === true && evr?.texto === 'segredo só nosso', { a, evr });
  check('mensagem na DM NÃO entregue a terceiros', await naoT);
  r = await rafa.req('GET', '/dms');
  const dmR = r.json?.find?.((d) => d.canalId === dm.canalId);
  check('GET /dms traz última mensagem e não lidos', dmR?.ultima?.texto === 'segredo só nosso' && dmR?.naoLidos === 1 && dmR?.outro?.id === U.lia.id, dmR);
  await rafa.req('POST', `/canais/${dm.canalId}/lido`);
  r = await rafa.req('GET', '/dms');
  check('POST lido na DM zera não lidos', r.json?.find?.((d) => d.canalId === dm.canalId)?.naoLidos === 0);
  r = await theo.req('GET', `/canais/${dm.canalId}/mensagens`);
  check('terceiro não lê a DM → 403', r.status === 403, r);
  a = await emitir(sT3, 'msg:enviar', { canalId: dm.canalId, texto: 'intruso' });
  check('terceiro não escreve na DM', temErro(a), a);
  a = await emitir(sT3, 'msg:reagir', { id: dmMsg.id, emoji: '👍' });
  check('terceiro não reage na DM', temErro(a), a);
  a = await emitir(sT3, 'msg:apagar', { id: dmMsg.id });
  check('terceiro não apaga na DM', temErro(a), a);
  a = await emitir(sR, 'msg:apagar', { id: dmMsg.id });
  check('participante não apaga mensagem do outro na DM', temErro(a), a);
  a = await emitir(sT3, 'digitando', { canalId: dm.canalId });
  check('terceiro não manda digitando na DM', temErro(a), a);
  r = await lia.req('DELETE', `/canais/${dm.canalId}`);
  check('DM não pode ser apagada como canal', r.status === 400, r);
  const sR2 = await rafa.conectar();
  ev = esperar(sR2, 'msg:nova', (d) => d.canalId === dm.canalId);
  await enviarMsg(sL, 'lia', dm.canalId, 'chegou na aba nova?');
  check('socket novo entra na sala da DM ao conectar', !!(await ev));
  await desconectar(sR2);

  secao('Voz (sinalização)');
  ev = esperar(sR, 'voz:membros', (d) => d.canalId === resenha.id && d.membros.length === 1);
  a = await emitir(sL, 'voz:entrar', { canalId: resenha.id });
  check('voz:entrar → {ok, pares: []}', a?.ok === true && Array.isArray(a.pares) && a.pares.length === 0, a);
  evr = await ev;
  const mv = evr?.membros?.[0];
  check('voz:membros transmitido ao servidor', mv && mv.usuarioId === U.lia.id && mv.nome === 'Lia ✨' && mv.cor === '#3ee6a8' &&
    mv.mudo === false && mv.surdo === false && mv.falando === false, evr);
  a = await emitir(sR, 'voz:entrar', { canalId: geral.id });
  check('voz:entrar em canal de texto → erro', temErro(a), a);
  a = await emitir(sK, 'voz:entrar', { canalId: resenha.id });
  check('não membro não entra na voz', temErro(a), a);
  ev = esperar(sL, 'voz:membros', (d) => d.canalId === resenha.id && d.membros.length === 2);
  a = await emitir(sR, 'voz:entrar', { canalId: resenha.id });
  check('segundo a entrar recebe pares', a?.ok === true && a.pares.length === 1 && a.pares[0] === U.lia.id, a);
  check('voz:membros atualizado com 2', !!(await ev));

  ev = esperar(sL, 'voz:sinal');
  a = await emitir(sR, 'voz:sinal', { para: U.lia.id, dados: { sdp: { type: 'offer', sdp: 'v=0\r\n' } } });
  evr = await ev;
  check('voz:sinal (sdp) repassado dentro do canal', a?.ok === true && evr?.de === U.rafa.id && evr?.dados?.sdp?.type === 'offer' && evr.dados.sdp.sdp === 'v=0\r\n', { a, evr });
  ev = esperar(sR, 'voz:sinal');
  a = await emitir(sL, 'voz:sinal', { para: U.rafa.id, dados: { candidato: { candidate: 'candidate:1 1 udp 2122260223 10.0.0.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 } } });
  evr = await ev;
  check('voz:sinal (candidato) repassado', a?.ok === true && evr?.de === U.lia.id && evr?.dados?.candidato?.sdpMid === '0', { a, evr });
  let naoL = nunca(sL, 'voz:sinal', (d) => d.de === U.theo.id);
  a = await emitir(sT3, 'voz:sinal', { para: U.lia.id, dados: { sdp: { type: 'offer', sdp: 'x' } } });
  check('quem não está na voz não sinaliza', temErro(a), a);
  a = await emitir(sT3, 'voz:entrar', { canalId: sala3d.id });
  a = await emitir(sT3, 'voz:sinal', { para: U.lia.id, dados: { sdp: { type: 'offer', sdp: 'x' } } });
  check('sinal para outro canal de voz → erro', temErro(a), a);
  check('sinal de fora do canal nunca chega', await naoL);
  a = await emitir(sR, 'voz:sinal', { para: U.lia.id, dados: { foo: 1 } });
  check('sinal com dados inválidos → erro', temErro(a), a);
  a = await emitir(sR, 'voz:sinal', { para: U.rafa.id, dados: { sdp: { type: 'offer', sdp: 'x' } } });
  check('sinal para si mesmo → erro', temErro(a), a);

  ev = esperar(sL, 'voz:membros', (d) => d.canalId === resenha.id && d.membros.some((m) => m.usuarioId === U.rafa.id && m.falando));
  a = await emitir(sR, 'voz:estado', { mudo: false, surdo: false, falando: true });
  check('voz:estado → {ok} e voz:membros com falando', a?.ok === true && !!(await ev), a);
  a = await emitir(sR, 'voz:estado', { mudo: 'sim' });
  check('voz:estado com tipo errado → erro', temErro(a), a);
  a = await emitir(sK, 'voz:estado', { mudo: true });
  check('voz:estado fora da voz → erro', temErro(a), a);

  // conexão nova recebe voz:membros dos canais ativos
  const sR3 = await rafa.conectar();
  await pausa(300);
  const recebidoAoConectar = sR3.recebidos.find((e) => e.ev === 'voz:membros' && e.dados.canalId === resenha.id);
  check('ao conectar recebe voz:membros dos canais ativos', recebidoAoConectar?.dados?.membros?.length === 2, sR3.recebidos.map((e) => e.ev));
  const k2 = await kenji.conectar();
  await pausa(300);
  check('quem não é membro não recebe voz:membros ao conectar', !k2.recebidos.some((e) => e.ev === 'voz:membros'));
  await desconectar(k2);
  a = await emitir(sR3, 'voz:sinal', { para: U.lia.id, dados: { sdp: { type: 'offer', sdp: 'x' } } });
  check('outra aba do mesmo usuário (fora da voz) não sinaliza', temErro(a), a);
  await desconectar(sR3);

  ev = esperar(sL, 'voz:par-saiu', (d) => d.usuarioId === U.rafa.id);
  const evM = esperar(sL, 'voz:membros', (d) => d.canalId === resenha.id && d.membros.length === 1);
  a = await emitir(sR, 'voz:sair', {});
  check('voz:sair → voz:par-saiu para quem ficou', a?.ok === true && !!(await ev), a);
  check('voz:sair → voz:membros atualizado', !!(await evM));

  const sL2 = await lia.conectar();
  ev = esperar(sL, 'voz:par-saiu', (d) => d.usuarioId === U.lia.id);
  a = await emitir(sL2, 'voz:entrar', { canalId: resenha.id });
  check('entrar na voz por outra aba avisa a aba antiga', a?.ok === true && !!(await ev), a);
  ev = esperar(sR, 'voz:membros', (d) => d.canalId === resenha.id && d.membros.length === 0);
  await desconectar(sL2);
  check('desconectar a aba que estava na voz → sai da voz', !!(await ev));

  ev = esperar(sL, 'voz:membros', (d) => d.canalId === sala3d.id && d.membros.length === 0);
  const evOff = esperar(sL, 'presenca', (d) => d.usuarioId === U.theo.id && d.status === 'offline');
  await desconectar(sT3);
  check('último socket desconecta → sai da voz', !!(await ev));
  check('último socket desconecta → presenca offline', !!(await evOff));
  const sT4 = await theo.conectar();

  secao('Sair do servidor');
  a = await emitir(sT4, 'voz:entrar', { canalId: resenha.id });
  ev = esperar(sL, 'membro:saiu', (d) => d.usuarioId === U.theo.id);
  let evT = esperar(sT4, 'membro:saiu', (d) => d.usuarioId === U.theo.id);
  const evVoz = esperar(sL, 'voz:membros', (d) => d.canalId === resenha.id && !d.membros.some((m) => m.usuarioId === U.theo.id));
  r = await theo.req('POST', `/servidores/${srv.id}/sair`);
  check('sair do servidor → {ok}', r.status === 200 && r.json?.ok === true, r);
  check('membro:saiu para os membros e para o próprio usuário', !!(await ev) && !!(await evT));
  check('sair do servidor tira da voz', !!(await evVoz));
  naoT = nunca(sT4, 'msg:nova', (d) => d.canalId === geral.id);
  await enviarMsg(sL, 'lia', geral.id, 'theo saiu?');
  check('quem saiu não recebe mais eventos da sala', await naoT);
  r = await theo.req('GET', `/canais/${geral.id}/mensagens`);
  check('quem saiu perde acesso às mensagens', r.status === 403, r);
  a = await emitir(sT4, 'msg:enviar', { canalId: geral.id, texto: 'ainda estou aqui?' });
  check('quem saiu não envia mais', temErro(a), a);
  r = await theo.req('GET', '/servidores');
  check('servidor some da lista de quem saiu', Array.isArray(r.json) && !r.json.some((s) => s.id === srv.id), r.json);
  r = await theo.req('POST', `/servidores/${srv.id}/sair`);
  check('sair de novo → 403', r.status === 403, r);
  r = await lia.req('POST', `/servidores/${srv.id}/sair`);
  check('dono não pode sair → 400', r.status === 400 && temErro(r.json), r);

  secao('Renomear e apagar servidor');
  r = await rafa.req('PATCH', `/servidores/${srv.id}`, { nome: 'Tomado' });
  check('membro comum não renomeia → 403', r.status === 403, r);
  r = await lia.req('PATCH', `/servidores/${srv.id}`, { nome: 'x' });
  check('renomear com nome inválido → 400', r.status === 400, r);
  ev = esperar(sR, 'servidor:atualizado', (d) => d.id === srv.id);
  r = await lia.req('PATCH', `/servidores/${srv.id}`, { nome: 'Galera Gamer Brasil' });
  evr = await ev;
  check('dono renomeia → Servidor', r.status === 200 && r.json?.nome === 'Galera Gamer Brasil', r);
  check('servidor:atualizado chega com o Servidor', evr?.nome === 'Galera Gamer Brasil' && evr?.sigla === 'GG' && Array.isArray(evr?.canais), evr);

  const srv2 = (await lia.req('POST', '/servidores', { nome: 'Estúdio Dev' })).json;
  check('sigla com acento', srv2?.sigla === 'ED', srv2?.sigla);
  await rafa.req('POST', `/convites/${srv2.convite}`);
  const voz2 = srv2.canais.find((c) => c.tipo === 'voz');
  const texto2 = srv2.canais.find((c) => c.tipo === 'texto');
  a = await emitir(sR, 'voz:entrar', { canalId: voz2.id });
  check('entra na voz do segundo servidor', a?.ok === true, a);
  r = await rafa.req('DELETE', `/servidores/${srv2.id}`);
  check('membro comum não apaga servidor → 403', r.status === 403, r);
  ev = esperar(sR, 'servidor:apagado', (d) => d.id === srv2.id);
  r = await lia.req('DELETE', `/servidores/${srv2.id}`);
  evr = await ev;
  check('dono apaga servidor → {ok} + servidor:apagado', r.status === 200 && r.json?.ok === true && !!evr, r);
  r = await rafa.req('GET', '/servidores');
  check('servidor apagado some da lista', !r.json.some((s) => s.id === srv2.id));
  r = await rafa.req('GET', `/canais/${texto2.id}/mensagens`);
  check('canais do servidor apagado → 404', r.status === 404, r);
  a = await emitir(sR, 'voz:estado', { mudo: true });
  check('servidor apagado tira da voz', temErro(a), a);
  naoT = nunca(sR, 'canal:novo', () => true, 300);
  check('salas do servidor apagado foram esvaziadas', await naoT);

  secao('Payloads malformados no socket');
  {
    const eventos = ['msg:enviar', 'msg:editar', 'msg:apagar', 'msg:reagir', 'digitando', 'presenca',
      'voz:entrar', 'voz:sair', 'voz:sinal', 'voz:estado'];
    const payloads = [null, undefined, 0, 42, 'texto', true, [], [1, 2], {}, { canalId: '1', texto: 5 },
      { canalId: 1.5, texto: 'x' }, { id: -1, texto: 'x' }, { id: {}, emoji: [] }, { canalId: Number.MAX_SAFE_INTEGER + 2 },
      { para: U.lia.id, dados: null }, { para: U.lia.id, dados: { sdp: 'x' } }, { para: 'lia', dados: { candidato: 5 } },
      { status: { toString: 1 } }, { mudo: null }, { texto: { length: 5 } }, { __proto__: { canalId: 1 } }];
    let acks = 0;
    let semAck = 0;
    let erros = 0;
    for (const ev2 of eventos) {
      for (const p of payloads) {
        const x = await emitir(sK, ev2, p, 1500);
        if (x?.timeout) semAck++;
        else { acks++; if (temErro(x) || ev2 === 'voz:sair') erros++; }
      }
      sK.emit(ev2, null);
      sK.emit(ev2);
      sK.emit(ev2, { canalId: 1 }, 'nao-e-funcao');
    }
    check('todo payload malformado recebe ack', semAck === 0, { semAck, acks });
    check('payload malformado → {erro} (nunca ok)', erros === acks, { erros, acks });
    sK.emit('evento-que-nao-existe', { a: 1 }, () => {});
    await pausa(300);
    check('socket continua conectado após lixo', sK.connected);
    r = await kenji.req('GET', '/eu');
    check('servidor continua de pé após payloads malformados', !servidorSaiu && r.status === 200, r.status);
    const gigante = await kenji.conectar();
    const caiu = new Promise((res) => gigante.once('disconnect', () => res(true)));
    gigante.emit('msg:enviar', { canalId: 1, texto: 'z'.repeat(300000) });
    const resultado = await Promise.race([caiu, pausa(2000).then(() => false)]);
    check('payload gigante derruba só aquele socket', resultado === true || !gigante.connected);
    r = await kenji.req('GET', '/eu');
    check('servidor de pé após payload gigante', !servidorSaiu && r.status === 200);
    a = await enviarMsg(sL, 'lia', geral.id, 'ainda funcionando');
    check('mensagem válida funciona depois do lixo', a?.ok === true, a);
  }

  secao('Staff: cargos, canal com senha, tickets, denúncias, expulsar e banir');
  {
    const [dono, mod, zé] = [new Cliente(), new Cliente(), new Cliente()];
    const uDono = (await dono.req('POST', '/registrar', { usuario: 'staff_dono', senha: 'segredo1' })).json;
    const uMod = (await mod.req('POST', '/registrar', { usuario: 'staff_mod', senha: 'segredo1' })).json;
    const uZe = (await zé.req('POST', '/registrar', { usuario: 'staff_ze', senha: 'segredo1' })).json;
    const sv = (await dono.req('POST', '/servidores', { nome: 'Staff Teste' })).json;
    await mod.req('POST', `/convites/${sv.convite}`);
    await zé.req('POST', `/convites/${sv.convite}`);
    let r = await zé.req('PATCH', `/servidores/${sv.id}/membros/${uMod.id}`, { cargo: 'mod' });
    check('membro não dá cargo → 403', r.status === 403, r);
    r = await dono.req('PATCH', `/servidores/${sv.id}/membros/${uMod.id}`, { cargo: 'chefe' });
    check('cargo inválido → 400', r.status === 400, r);
    r = await dono.req('PATCH', `/servidores/${sv.id}/membros/${uMod.id}`, { cargo: 'mod' });
    check('dono promove a mod', r.status === 200 && r.json?.cargo === 'mod', r);
    r = await dono.req('GET', `/servidores/${sv.id}/membros`);
    check('lista de membros mostra cargos', r.json?.find((m) => m.id === uDono.id)?.cargo === 'dono' && r.json?.find((m) => m.id === uMod.id)?.cargo === 'mod', r.json);

    r = await dono.req('POST', `/servidores/${sv.id}/canais`, { nome: 'secreto', tipo: 'texto', senha: '12' });
    check('senha curta → 400', r.status === 400, r);
    r = await dono.req('POST', `/servidores/${sv.id}/canais`, { nome: 'secreto', tipo: 'texto', senha: 'abacaxi' });
    const secreto = r.json;
    check('canal com senha criado', r.status === 201 && secreto?.privado === true && secreto?.comSenha === true, r);
    const sZe = await zé.conectar();
    const vazou = nunca(sZe, 'msg:nova', (m) => m.canalId === secreto.id);
    const sDono = await dono.conectar();
    await enviarMsg(sDono, 'dono', secreto.id, 'segredo da staff');
    check('quem não destravou não recebe msg do canal com senha', await vazou);
    r = await zé.req('GET', `/canais/${secreto.id}/mensagens`);
    check('sem senha → 403 nas mensagens', r.status === 403, r);
    r = await mod.req('GET', `/canais/${secreto.id}/mensagens`);
    check('staff lê canal com senha sem digitar', r.status === 200, r);
    r = await zé.req('POST', `/canais/${secreto.id}/desbloquear`, { senha: 'errada' });
    check('senha errada → 403', r.status === 403, r);
    r = await zé.req('POST', `/canais/${secreto.id}/desbloquear`, { senha: 'abacaxi' });
    check('senha certa destrava', r.status === 200, r);
    r = await zé.req('GET', `/canais/${secreto.id}/mensagens`);
    check('depois de destravar lê as mensagens', r.status === 200 && r.json?.length === 1, r);

    r = await zé.req('POST', `/servidores/${sv.id}/tickets`, { assunto: 'Fui xingado na call' });
    const ticket = r.json;
    check('membro abre ticket privado', r.status === 201 && ticket?.ticket === uZe.id && ticket?.privado === true, r);
    const outro = new Cliente();
    await outro.req('POST', '/registrar', { usuario: 'staff_outro', senha: 'segredo1' });
    await outro.req('POST', `/convites/${sv.convite}`);
    r = await outro.req('GET', '/servidores');
    check('ticket não aparece pra quem não é staff nem dono do ticket', !r.json?.find((x) => x.id === sv.id)?.canais.some((c) => c.id === ticket.id), r.json);
    r = await mod.req('GET', '/servidores');
    check('ticket aparece pra staff', r.json?.find((x) => x.id === sv.id)?.canais.some((c) => c.id === ticket.id), r.json);
    r = await outro.req('GET', `/canais/${ticket.id}/mensagens`);
    check('outro membro não lê o ticket → 403', r.status === 403, r);

    const msgZe = (await enviarMsg(sZe, 'zé', secreto.id, 'mensagem ofensiva')).msg;
    r = await outro.req('POST', `/servidores/${sv.id}/denuncias`, { mensagemId: msgZe.id, motivo: 'ofensa' });
    check('denunciar msg de canal sem acesso → 403', r.status === 403, r);
    const avisoStaff = esperar(sDono, 'denuncia:nova');
    r = await mod.req('POST', `/servidores/${sv.id}/denuncias`, { mensagemId: msgZe.id, motivo: 'ofensa pesada' });
    check('denúncia criada com prova (texto da msg)', r.status === 201, r);
    check('staff recebe denuncia:nova', !!(await avisoStaff));
    r = await zé.req('GET', `/servidores/${sv.id}/denuncias`);
    check('membro não vê fila de denúncias → 403', r.status === 403, r);
    r = await dono.req('GET', `/servidores/${sv.id}/denuncias`);
    const den = r.json?.[0];
    check('staff vê denúncia com texto e alvo', den?.texto === 'mensagem ofensiva' && den?.alvo?.id === uZe.id && den?.estado === 'aberta', r.json);
    r = await mod.req('PATCH', `/denuncias/${den.id}`, { estado: 'resolvida' });
    check('staff resolve denúncia', r.status === 200, r);

    r = await zé.req('DELETE', `/servidores/${sv.id}/membros/${uMod.id}`);
    check('membro não expulsa → 403', r.status === 403, r);
    r = await mod.req('DELETE', `/servidores/${sv.id}/membros/${uDono.id}`);
    check('mod não expulsa o dono → 403', r.status === 403, r);
    const saiu = esperar(sZe, 'servidor:apagado', (d) => d.id === sv.id);
    r = await mod.req('POST', `/servidores/${sv.id}/banir`, { usuarioId: uZe.id, motivo: 'ofensa' });
    check('mod bane membro', r.status === 200, r);
    check('banido é avisado e sai do servidor', !!(await saiu));
    r = await zé.req('POST', `/convites/${sv.convite}`);
    check('banido não volta pelo convite → 403', r.status === 403, r);
  }

  secao('Perfil vitrine e aniversário');
  {
    const v = new Cliente();
    await v.req('POST', '/registrar', { usuario: 'vitrine_ana', senha: 'segredo1', nome: 'Ana' });
    const sv = (await v.req('POST', '/servidores', { nome: 'Vitrine' })).json;
    let r = await v.req('PATCH', '/eu', { bio: 'x'.repeat(191) });
    check('bio > 190 → 400', r.status === 400, r);
    r = await v.req('PATCH', '/eu', { links: ['javascript:alert(1)'] });
    check('link não-http → 400', r.status === 400, r);
    r = await v.req('PATCH', '/eu', { banner: 'arco-iris' });
    check('banner desconhecido → 400', r.status === 400, r);
    r = await v.req('PATCH', '/eu', { aniversario: '13-40' });
    check('aniversário inválido → 400', r.status === 400, r);
    r = await v.req('PATCH', '/eu', { jogos: ['a', 'b', 'c', 'd', 'e', 'f'] });
    check('mais de 5 jogos → 400', r.status === 400, r);
    const hoje = new Date();
    const mmdd = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    r = await v.req('PATCH', '/eu', { bio: 'Main suporte 🎧', banner: 'neon', links: ['https://twitch.tv/ana'], aniversario: mmdd, jogos: ['Valorant', 'LoL'] });
    check('vitrine salva e volta no perfil', r.status === 200 && r.json?.vitrine?.banner === 'neon' && r.json.vitrine.links[0] === 'https://twitch.tv/ana' && r.json.vitrine.jogos.length === 2, r);
    r = await v.req('GET', `/servidores/${sv.id}/membros`);
    check('vitrine aparece pros outros na lista de membros', r.json?.[0]?.vitrine?.bio === 'Main suporte 🎧', r.json);
    await v.req('GET', '/eu');
    await v.req('GET', '/eu');
    r = await v.req('GET', `/canais/${sv.canais.find((c) => c.tipo === 'texto').id}/mensagens`);
    const parabens = (r.json || []).filter((m) => m.sistema && m.texto.includes('aniversário de Ana'));
    check('parabéns automático no dia, uma vez só', parabens.length === 1, r.json);
  }

  secao('Logout derruba os sockets da sessão');
  {
    const lia3 = new Cliente();
    await lia3.req('POST', '/entrar', { usuario: 'lia', senha: 'segredo1' });
    const s = await lia3.conectar();
    const caiu = new Promise((res) => s.once('disconnect', () => res(true)));
    await lia3.req('POST', '/sair');
    const resultado = await Promise.race([caiu, pausa(2000).then(() => false)]);
    check('POST /sair desconecta o socket daquela sessão', resultado === true);
    check('outras sessões continuam conectadas', sL.connected);
  }

  secao('Procurando Grupo (LFG)');
  {
    // O theo saiu do servidor na seção anterior; re-entra para poder criar/entrar em LFG aqui.
    await theo.req('POST', `/convites/${srv.convite}`);
    const vozId = resenha.id;
    const xpAntes = (await lia.req('GET', `/servidores/${srv.id}/missoes`)).json?.xp ?? 0;
    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'Valorant', rank: 'Prata', tipo: 'duo' });
    const post = r.json;
    const lfgId = post.id;
    check('criar LFG → 201 com shape completo', r.status === 201 && post?.jogo === 'Valorant' && post?.rank === 'Prata' &&
      post?.tipo === 'duo' && post?.vagas === 2 && post?.ocupados === 1 && post?.status === 'aberto' &&
      post?.autor?.id === U.lia.id && post?.servidorId === srv.id && typeof post?.criadoEm === 'number', r);
    check('LFG não expõe segredos', semSegredos(post));
    const xpDepois = (await lia.req('GET', `/servidores/${srv.id}/missoes`)).json?.xp ?? 0;
    check('criar LFG concede XP (+10)', xpDepois - xpAntes >= 10, { xpAntes, xpDepois });

    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { rank: 'Ouro' });
    check('LFG sem jogo → 400', r.status === 400 && temErro(r.json), r);
    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'x'.repeat(31) });
    check('LFG jogo > 30 → 400', r.status === 400, r);
    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'LoL', vagas: 9 });
    check('LFG vagas > 5 → 400', r.status === 400, r);
    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'LoL', duracao: 999999 });
    check('LFG duração > 24h → 400', r.status === 400, r);
    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'LoL', canalVozId: '999999' });
    check('LFG canal de voz inexistente → 400', r.status === 400, r);

    let evNova = esperar(sR, 'lfg:nova');
    r = await theo.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'CS2', canalVozId: vozId, duracao: 3600 });
    const post2 = r.json;
    const nova = await evNova;
    check('lfg:nova é broadcast para os membros', nova && nova.id === post2.id && nova.servidorId === srv.id, nova);
    check('LFG com canal de voz traz canalVozId e nome', post2?.canalVozId === vozId && typeof post2?.canalVozNome === 'string', post2);

    r = await rafa.req('GET', `/servidores/${srv.id}/lfg`);
    check('GET lfg lista posts abertos', r.status === 200 && Array.isArray(r.json) && r.json.some((p) => p.id === lfgId), r);
    r = await rafa.req('GET', `/servidores/${srv.id}/lfg?jogo=CS2`);
    check('filtrar por jogo', r.status === 200 && r.json.length >= 1 && r.json.every((p) => p.jogo === 'CS2'), r.json);
    r = await rafa.req('GET', `/servidores/${srv.id}/lfg?jogo=Inexistente`);
    check('filtrar por jogo sem resultado → []', r.status === 200 && r.json.length === 0, r.json);

    evNova = esperar(sT, 'lfg:atualizada', (d) => d.id === lfgId);
    r = await rafa.req('POST', `/lfg/${lfgId}/entrar`);
    const atualizou = await evNova;
    check('entrar no LFG → ocupados sobe pra 2', r.status === 200 && r.json?.ocupados === 2 && r.json?.status === 'cheio', r);
    check('lfg:atualizada é broadcast', atualizou && atualizou.ocupados === 2, atualizou);
    r = await rafa.req('POST', `/lfg/${lfgId}/entrar`);
    check('entrar duplicado é idempotente', r.status === 200 && r.json?.ocupados === 2, r);

    const non = new Cliente();
    await non.req('POST', '/registrar', { usuario: 'non', senha: 'segredo9', nome: 'Non' });
    r = await non.req('POST', `/lfg/${lfgId}/entrar`);
    check('não membro → 403 pra entrar', r.status === 403, r);

    r = await rafa.req('POST', `/lfg/${lfgId}/sair`);
    check('sair do LFG → ocupados volta pra 1', r.status === 200 && r.json?.ocupados === 1, r);

    r = await lia.req('POST', `/servidores/${srv.id}/lfg`, { jogo: 'Apex', tipo: 'squad', vagas: 3 });
    const squad = r.json;
    await rafa.req('POST', `/lfg/${squad.id}/entrar`);
    r = await theo.req('POST', `/lfg/${squad.id}/entrar`);
    check('LFG cheio → status "cheio"', r.status === 200 && r.json?.status === 'cheio' && r.json?.ocupados === 3, r);
    r = await mari.req('POST', `/lfg/${squad.id}/entrar`);
    check('entrar em LFG cheio → 400', r.status === 400 && temErro(r.json), r);
    r = await rafa.req('POST', `/lfg/${squad.id}/sair`);
    check('sair de LFG cheio → reabre (aberto)', r.status === 200 && r.json?.status === 'aberto' && r.json?.ocupados === 2, r);

    r = await rafa.req('DELETE', `/lfg/${lfgId}`);
    check('não autor/non-staff não cancela → 403', r.status === 403, r);
    r = await lia.req('DELETE', `/lfg/${lfgId}`);
    check('autor cancela → {ok:true}', r.status === 200 && r.json?.ok === true, r);
    r = await rafa.req('GET', `/servidores/${srv.id}/lfg`);
    check('post cancelado some da lista de abertos', !r.json.some((p) => p.id === lfgId), r.json);
    r = await rafa.req('POST', `/lfg/${lfgId}/entrar`);
    check('entrar em post cancelado → 400', r.status === 400, r);
  }
}

// ---------------- execução ----------------
let erroFatal = null;
try {
  await testes();
} catch (e) {
  erroFatal = e;
  falhou++;
  console.log(`\n  ✗ erro inesperado no teste: ${e?.stack || e}`);
}

for (const s of todosSockets) {
  try { s.close(); } catch { /* ignora */ }
}

const morreu = new Promise((resolve) => {
  if (servidorSaiu) return resolve();
  servidor.once('exit', resolve);
});
servidor.kill();
await Promise.race([morreu, pausa(5000)]);
if (!servidorSaiu) {
  try { servidor.kill('SIGKILL'); } catch { /* ignora */ }
  await Promise.race([morreu, pausa(2000)]);
}

let apagou = false;
for (let i = 0; i < 20 && !apagou; i++) {
  try {
    fs.rmSync(PASTA_TEMP, { recursive: true, force: true });
    apagou = !fs.existsSync(PASTA_TEMP);
  } catch {
    await pausa(150);
  }
}

if (falhou > 0 && /erro/i.test(logServidor)) {
  console.log('\nLog do servidor:\n' + logServidor.split('\n').slice(-40).join('\n'));
}
if (!apagou) console.log(`\n(aviso: não consegui apagar ${PASTA_TEMP})`);
console.log(`\n${falhou === 0 ? '✓' : '✗'} ${passou} de ${passou + falhou} verificações passaram${falhou ? ` — ${falhou} falharam` : ''}.`);
if (falhas.length) console.log('Falhas: ' + falhas.join(' | '));
if (erroFatal) console.log('(houve erro inesperado)');
process.exit(falhou === 0 ? 0 : 1);
