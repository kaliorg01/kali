// Eventos socket.io: mensagens, presença, digitando, voz (sinalização), Assistir Junto, XP e expirações.
import fs from 'node:fs';
import path from 'node:path';
import * as db from './db.js';
import { erro, ErroKali } from './db.js';
import { autenticarSocket } from './auth.js';

let io = null;

/** usuarioId → Set de socket ids conectados */
const presenca = new Map();
/** canalId → Map usuarioId → {mudo, surdo, falando, x, y, socketId} */
const voz = new Map();
/** usuarioId → canalId de voz atual */
const vozDoUsuario = new Map();
/** canalId → estado do Assistir Junto */
const assistir = new Map();

const envios = new Map(); // limite de mensagens: usuarioId → [timestamps]
const ultimoXpMensagem = new Map(); // `${uid}:${sid}` → timestamp
const reacoesPremiadas = new Set(); // `${msgId}:${quemReagiu}`
const timersExpiracao = new Map(); // msgId → timeout
const timersFoco = new Map(); // usuarioId → timeout

// ------------------------------------------------------------------ utilidades
export function origemPermitida(origem, host) {
  if (!origem) return true;
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

export function exigirObjeto(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw erro(400, 'Dados inválidos.');
  return d;
}
export function exigirId(v, rotulo = 'Identificador') {
  if (!Number.isSafeInteger(v) || v <= 0) throw erro(400, `${rotulo} inválido.`);
  return v;
}

export const salaDoCanal = (canal) => {
  if (canal.servidor_id == null) return `c:${canal.id}`;
  if (!canal.privado) return `s:${canal.servidor_id}`;
  // Canal privado/ticket: só quem tem acesso recebe os eventos (lista nunca vazia: io.to([]) mandaria pra todos).
  const salas = db.idsComAcesso(canal).map((u) => `u:${u}`);
  return salas.length ? salas : 'ninguem';
};
export function emitir(sala, evento, dados) {
  io?.to(sala).emit(evento, dados);
}
export function entrarSala(usuarioId, sala) {
  io?.in(`u:${usuarioId}`).socketsJoin(sala);
}
export function sairSala(usuarioId, sala) {
  io?.in(`u:${usuarioId}`).socketsLeave(sala);
}
export const estaOnline = (uid) => (presenca.get(uid)?.size || 0) > 0;

// ------------------------------------------------------------------ usuários e presença
function verificarFoco(row) {
  if (row.foco_ate != null && row.foco_ate <= Date.now()) {
    const limpou = db.limparFocoExpirado(row.id, Date.now());
    row.foco_ate = null;
    if (limpou) setImmediate(() => emitirPresenca(row.id));
  }
}

/** Usuario público; `proprio` = o próprio usuário pedindo (nunca aparece offline para si). */
export function usuarioPublico(row, { proprio = false } = {}) {
  verificarFoco(row);
  const foco = row.foco_ate != null && row.foco_ate > Date.now();
  const online = proprio || estaOnline(row.id);
  const u = {
    id: row.id,
    usuario: row.usuario,
    nome: row.nome,
    cor: row.cor,
    status: !online ? 'offline' : foco ? 'foco' : row.status,
    statusTexto: row.status_texto,
    avatar: db.urlImagem('u', row.id, 'avatar', row.avatar_v),
    bannerImg: db.urlItem(row.equip_banner),
    moldura: db.urlItem(row.equip_moldura),
    corNome: db.corDoItem(row.equip_cor),
  };
  if (foco) u.focoAte = row.foco_ate;
  const lista = (j) => { try { const v = JSON.parse(j || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  u.vitrine = { bio: row.bio || '', banner: row.banner || '', links: lista(row.links), aniversario: row.aniversario || '', jogos: lista(row.jogos) };
  return u;
}
export function membroPublico(row, donoId) {
  return { ...usuarioPublico(row), dono: row.id === donoId, nivel: row.nivel ?? 1, cargo: row.id === donoId ? 'dono' : row.cargo || 'membro' };
}

function salasDeInteresse(uid) {
  return [
    `u:${uid}`,
    ...db.servidoresDoUsuario(uid).map((s) => `s:${s.id}`),
    ...db.dmsDoUsuario(uid).map((d) => `c:${d.canal_id}`),
    ...db.amigosDe(uid).map((id) => `u:${id}`),
  ];
}

export function emitirPresenca(uid) {
  if (!io) return;
  const row = db.usuarioPorId(uid);
  if (!row) return;
  const u = usuarioPublico(row);
  io.to(salasDeInteresse(uid)).emit('presenca', {
    usuarioId: u.id,
    status: u.status,
    focoAte: u.focoAte ?? null,
    nome: u.nome,
    cor: u.cor,
    statusTexto: u.statusTexto,
  });
}

/** Chamado pela rota PATCH /eu depois de salvar o perfil. */
export function aoAtualizarPerfil(uid) {
  const row = db.usuarioPorId(uid);
  clearTimeout(timersFoco.get(uid));
  timersFoco.delete(uid);
  if (row?.foco_ate) {
    const t = setTimeout(() => {
      timersFoco.delete(uid);
      const atual = db.usuarioPorId(uid);
      if (atual) verificarFoco(atual);
    }, Math.max(0, row.foco_ate - Date.now()) + 50);
    t.unref?.();
    timersFoco.set(uid, t);
  }
  emitirPresenca(uid);
}

/** Desconecta os sockets abertos com essa sessão (logout). */
export async function desconectarSessao(uid, token) {
  if (!io) return;
  const sockets = await io.in(`u:${uid}`).fetchSockets();
  for (const s of sockets) if (s.data.token === token) s.disconnect(true);
}

// ------------------------------------------------------------------ mensagens
const LIMITE_JANELA = 3000;
const LIMITE_QTD = 5;
export function checarLimiteMensagens(uid) {
  const agora = Date.now();
  const lista = (envios.get(uid) || []).filter((t) => agora - t < LIMITE_JANELA);
  if (lista.length >= LIMITE_QTD) {
    envios.set(uid, lista);
    throw erro(429, 'Calma! Muitas mensagens.');
  }
  lista.push(agora);
  envios.set(uid, lista);
}

export const caminhoAudio = (id) => path.join(db.PASTA_AUDIOS, `${id}.webm`);
export const caminhoAnexo = (id) => path.join(db.PASTA_ANEXOS, String(id));
/** Id de mensagem respondida: precisa existir e ser do mesmo canal. */
export function respostaValida(v, canalId) {
  if (v === undefined || v === null) return null;
  if (!Number.isInteger(v) || v < 1) throw erro(400, 'Resposta inválida.');
  const alvo = db.mensagemPorId(v);
  if (!alvo || alvo.canal_id !== canalId) throw erro(400, 'A mensagem respondida não existe mais.');
  return v;
}
function apagarArquivoAudio(id) {
  fs.rm(caminhoAudio(id), { force: true }, () => {});
}

function agendarExpiracao(id, expiraEm) {
  const atraso = expiraEm - Date.now();
  if (atraso > 2 ** 31 - 1) return; // a varredura cuida
  const t = setTimeout(() => {
    timersExpiracao.delete(id);
    const row = db.mensagemPorId(id);
    if (row && row.expira_em != null && row.expira_em <= Date.now()) removerMensagem(row);
  }, Math.max(0, atraso) + 20);
  t.unref?.();
  timersExpiracao.set(id, t);
}

/** Insere a mensagem, emite msg:nova para a sala certa e agenda expiração. */
export function publicarMensagem(canal, dados) {
  const id = db.inserirMensagem({ canalId: canal.id, ...dados });
  return anunciarMensagem(canal, id);
}

/** Emite msg:nova de uma mensagem já gravada, agenda a expiração e dá XP ao autor. */
export function anunciarMensagem(canal, id) {
  const msg = db.mensagemCompleta(id);
  emitir(salaDoCanal(canal), 'msg:nova', msg);
  if (msg.expiraEm) agendarExpiracao(id, msg.expiraEm);
  if (canal.servidor_id != null && msg.autor) xpPorMensagem(msg.autor.id, canal.servidor_id);
  return msg;
}

export function removerMensagem(row) {
  if (!db.apagarMensagem(row.id)) return false;
  const t = timersExpiracao.get(row.id);
  if (t) {
    clearTimeout(t);
    timersExpiracao.delete(row.id);
  }
  if (row.audio_duracao != null) apagarArquivoAudio(row.id);
  if (row.anexo_nome != null) fs.rm(caminhoAnexo(row.id), { force: true }, () => {});
  const canal = db.canalPorId(row.canal_id);
  if (canal) emitir(salaDoCanal(canal), 'msg:apagada', { id: row.id, canalId: row.canal_id });
  return true;
}

export function apagarArquivosAudio(ids) {
  for (const id of ids) apagarArquivoAudio(id);
}

function varrer() {
  try {
    const agora = Date.now();
    for (const row of db.mensagensExpiradas(agora)) removerMensagem(row);
    for (const id of db.lfgExpiradas(agora)) {
      const row = db.lfgPorId(id);
      if (row) removerLfg(row);
    }
    for (const uid of db.usuariosComFocoExpirado(agora)) {
      const row = db.usuarioPorId(uid);
      if (row) verificarFoco(row);
    }
  } catch (e) {
    console.error('[varredura] erro:', e);
  }
}

const RE_EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
function validarEmoji(e) {
  if (typeof e !== 'string') throw erro(400, 'Emoji inválido.');
  const s = e.trim();
  if (!s || s.length > 16 || !RE_EMOJI.test(s) || /[\sA-Za-z<>]/.test(s)) throw erro(400, 'Emoji inválido.');
  return s;
}

function validarTexto(v) {
  if (typeof v !== 'string') throw erro(400, 'Mensagem inválida.');
  const texto = v.trim();
  if (!texto) throw erro(400, 'A mensagem não pode ficar vazia.');
  if (texto.length > 2000) throw erro(400, 'A mensagem passa de 2000 caracteres.');
  if (pareceGolpe(texto)) throw erro(400, '🛡️ Bloqueado: esse link parece golpe (nitro/skin grátis, site falso).');
  return texto;
}

// Anti-golpe: links clássicos de "nitro grátis", skins e sites que imitam Discord/Steam.
const RE_GOLPE = [
  /https?:\/\/\S*(d[il1]sc[o0]rd|d[il1]scord-?app)[^\s/]*\.(?!com\b|gg\b|media\b)[a-z]{2,}/i,
  /https?:\/\/\S*st[e3]am-?c[o0]m+un[il1]t[yi]\S*\.(?!com\b)[a-z]{2,}/i,
  /https?:\/\/\S*(free|gr[aá]tis|gift)[-.]?(nitro|skins?|robux|vbucks)/i,
  /(nitro|robux|skins?)\s+(gr[aá]tis|free)\b[\s\S]{0,80}https?:\/\//i,
];
export const pareceGolpe = (t) => RE_GOLPE.some((re) => re.test(t));

const podeTerMensagens = (canal) => canal.tipo === 'texto' || canal.tipo === 'assistir' || canal.tipo === 'dm';

// ------------------------------------------------------------------ XP, missões e selos
export const MISSOES = [
  { chave: 'mensagens', titulo: 'Enviar 30 mensagens', meta: 30, selo: { titulo: 'Tagarela', emoji: '💬' } },
  { chave: 'voz', titulo: 'Passar 30 min em voz', meta: 30, selo: { titulo: 'Bonde', emoji: '🎙️' } },
  { chave: 'reacoes', titulo: 'Receber 10 reações', meta: 10, selo: { titulo: 'Querido da galera', emoji: '💜' } },
  { chave: 'assistir', titulo: 'Entrar em 2 sessões de Assistir Junto', meta: 2, selo: { titulo: 'Pipoqueiro', emoji: '🍿' } },
];
export const BONUS_MISSAO = 250;
export const nivelDe = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const xpParaNivel = (nivel) => 50 * (nivel - 1) ** 2;

export function semanaAtual(data = new Date()) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-S${String(semana).padStart(2, '0')}`;
}

export function ganharXp(uid, sid, qtd, missaoChave = null, incremento = 1) {
  if (!db.ehMembro(sid, uid)) return null;
  const r = db.transacao(() => {
    const antes = db.obterXp(uid, sid);
    let total = antes.xp + qtd;
    let missaoCompleta = null;
    const missao = missaoChave && MISSOES.find((m) => m.chave === missaoChave);
    if (missao) {
      const semana = semanaAtual();
      const valor = db.obterProgresso(uid, sid, semana, missao.chave);
      const novo = valor + incremento;
      db.salvarProgresso(uid, sid, semana, missao.chave, novo);
      if (valor < missao.meta && novo >= missao.meta) {
        db.darSelo(uid, sid, missao.chave);
        total += BONUS_MISSAO;
        missaoCompleta = { chave: missao.chave, titulo: missao.titulo, selo: missao.selo };
      }
    }
    const nivel = nivelDe(total);
    db.salvarXp(uid, sid, total, nivel);
    const payload = { servidorId: sid, xp: total, nivel, subiuNivel: nivel > antes.nivel, ganho: total - antes.xp };
    if (missaoCompleta) payload.missaoCompleta = missaoCompleta;
    return payload;
  });
  emitir(`u:${uid}`, 'xp:ganho', r);
  return r;
}

function xpPorMensagem(uid, sid) {
  const chave = `${uid}:${sid}`;
  const agora = Date.now();
  const darXp = agora - (ultimoXpMensagem.get(chave) || 0) >= 10_000;
  if (darXp) ultimoXpMensagem.set(chave, agora);
  if (ultimoXpMensagem.size > 50_000) ultimoXpMensagem.clear();
  ganharXp(uid, sid, darXp ? 5 : 0, 'mensagens');
}

// ------------------------------------------------------------------ procurando grupo (LFG)
const ultimoXpLfg = new Map(); // chaveUnico → timestamp
export function lfgPublico(row) {
  if (!row) return null;
  const autor = row.autor_id != null ? db.usuarioPorId(row.autor_id) : null;
  const participantes = db.lfgParticipantes(row.id).map((u) => usuarioPublico(u));
  const canal = row.canal_voz_id ? db.canalPorId(row.canal_voz_id) : null;
  return {
    id: row.id,
    servidorId: row.servidor_id,
    canalVozId: row.canal_voz_id ?? null,
    canalVozNome: canal ? canal.nome : null,
    autor: autor ? usuarioPublico(autor) : null,
    jogo: row.jogo,
    rank: row.rank || null,
    tipo: row.tipo,
    vagas: row.vagas,
    ocupados: participantes.length,
    texto: row.texto,
    status: row.status,
    criadoEm: row.criado_em,
    expiraEm: row.expira_em ?? null,
  };
}
/** XP por atividade no Procurando Grupo, com cooldown pra evitar farming. */
export function ganharXpLfg(uid, sid, chaveUnico, pontos) {
  const agora = Date.now();
  if (agora - (ultimoXpLfg.get(chaveUnico) || 0) < 5 * 60 * 1000) return null;
  ultimoXpLfg.set(chaveUnico, agora);
  if (ultimoXpLfg.size > 100_000) ultimoXpLfg.clear();
  return ganharXp(uid, sid, pontos);
}
export function emitirLfg(row, evento) {
  const post = lfgPublico(row);
  if (post) emitir(`s:${row.servidor_id}`, evento, post);
}
function removerLfg(row) {
  if (!db.apagarLfg(row.id)) return;
  emitir(`s:${row.servidor_id}`, 'lfg:removida', { id: row.id, servidorId: row.servidor_id });
}

function tickVoz() {
  try {
    for (const [canalId, mapa] of voz) {
      const canal = db.canalPorId(canalId);
      if (!canal) continue;
      for (const uid of mapa.keys()) ganharXp(uid, canal.servidor_id, 3, 'voz', 1);
    }
  } catch (e) {
    console.error('[voz] erro ao dar XP:', e);
  }
}

// ------------------------------------------------------------------ voz
const LIMITE_SALA_VOZ = 16;
function payloadVoz(canalId) {
  const mapa = voz.get(canalId);
  const membros = [];
  if (mapa) {
    for (const [uid, e] of mapa) {
      const u = db.usuarioPorId(uid);
      if (!u) continue;
      membros.push({ usuarioId: uid, nome: u.nome, cor: u.cor, mudo: e.mudo, surdo: e.surdo, falando: e.falando, x: e.x, y: e.y });
    }
  }
  return { canalId, membros };
}
function emitirVozMembros(canalId, servidorId) {
  emitir(`s:${servidorId}`, 'voz:membros', payloadVoz(canalId));
}

function sairDaVoz(uid) {
  const canalId = vozDoUsuario.get(uid);
  if (!canalId) return;
  vozDoUsuario.delete(uid);
  const mapa = voz.get(canalId);
  if (!mapa) return;
  mapa.delete(uid);
  for (const e of mapa.values()) io?.to(e.socketId).emit('voz:par-saiu', { usuarioId: uid });
  if (mapa.size === 0) voz.delete(canalId);
  const canal = db.canalPorId(canalId);
  if (canal) emitirVozMembros(canalId, canal.servidor_id);
}

// ------------------------------------------------------------------ Assistir Junto
const RE_ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
export function validarUrlVideo(bruta) {
  if (typeof bruta !== 'string') throw erro(400, 'Link inválido.');
  const s = bruta.trim();
  if (!s || s.length > 500) throw erro(400, 'Link inválido.');
  let u;
  try {
    u = new URL(s);
  } catch {
    throw erro(400, 'Link inválido.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw erro(400, 'Use um link http(s).');
  if (u.username || u.password) throw erro(400, 'Link inválido.');
  const host = u.hostname.toLowerCase();
  if (HOSTS_YOUTUBE.has(host)) {
    const v = u.searchParams.get('v');
    if (u.pathname !== '/watch' || !v || !RE_ID_YOUTUBE.test(v)) {
      throw erro(400, 'Use um link do YouTube no formato youtube.com/watch?v=…');
    }
    return { url: `https://www.youtube.com/watch?v=${v}`, tipo: 'youtube', videoId: v };
  }
  if (host === 'youtu.be') {
    const v = u.pathname.slice(1);
    if (!RE_ID_YOUTUBE.test(v)) throw erro(400, 'Link do YouTube inválido.');
    return { url: `https://www.youtube.com/watch?v=${v}`, tipo: 'youtube', videoId: v };
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { url: u.href, tipo: 'video', videoId: null };
  throw erro(400, 'Só aceitamos links do YouTube ou vídeos diretos .mp4/.webm.');
}

function estadoAssistir(canal) {
  let e = assistir.get(canal.id);
  if (!e) {
    e = {
      servidorId: canal.servidor_id,
      url: null, tipo: null, videoId: null,
      tocando: false, tempo: 0, atualizadoEm: Date.now(), hostId: null,
      sockets: new Map(), sessao: 1, premiados: new Set(), ultimoAviso: 0,
    };
    assistir.set(canal.id, e);
  }
  return e;
}
const posicaoAtual = (e) => (e.tocando ? e.tempo + (Date.now() - e.atualizadoEm) / 1000 : e.tempo);
function publicoAssistir(canalId, e) {
  const vistos = new Map();
  for (const uid of e.sockets.values()) {
    if (vistos.has(uid)) continue;
    const u = db.usuarioPorId(uid);
    if (u) vistos.set(uid, { id: uid, nome: u.nome, cor: u.cor });
  }
  return {
    canalId,
    url: e.url,
    tipo: e.tipo,
    videoId: e.videoId,
    tocando: e.tocando,
    tempo: e.tempo,
    atualizadoEm: e.atualizadoEm,
    hostId: e.hostId,
    espectadores: [...vistos.values()],
    agora: Date.now(),
  };
}
function emitirAssistir(canalId) {
  const e = assistir.get(canalId);
  if (e) emitir(`a:${canalId}`, 'assistir:estado', publicoAssistir(canalId, e));
}
/** Remove sockets do Assistir (de um usuário ou um socket específico). */
function sairDoAssistir(canalId, { socketId = null, usuarioId = null } = {}) {
  const e = assistir.get(canalId);
  if (!e) return;
  let mudou = false;
  for (const [sid, uid] of e.sockets) {
    if ((socketId && sid === socketId) || (usuarioId && uid === usuarioId)) {
      e.sockets.delete(sid);
      io?.sockets.sockets.get(sid)?.leave(`a:${canalId}`);
      mudou = true;
    }
  }
  if (!mudou) return;
  const restantes = new Set(e.sockets.values());
  if (e.hostId && !restantes.has(e.hostId)) e.hostId = restantes.values().next().value ?? null;
  if (restantes.size === 0 && e.tocando) {
    e.tempo = posicaoAtual(e);
    e.tocando = false;
    e.atualizadoEm = Date.now();
  }
  emitirAssistir(canalId);
}

// ------------------------------------------------------------------ limpeza (chamada pelas rotas)
export function aoApagarCanal(canal) {
  const mapa = voz.get(canal.id);
  if (mapa) {
    for (const uid of mapa.keys()) vozDoUsuario.delete(uid);
    voz.delete(canal.id);
  }
  if (assistir.has(canal.id)) {
    assistir.delete(canal.id);
    io?.in(`a:${canal.id}`).socketsLeave(`a:${canal.id}`);
  }
  emitir(`s:${canal.servidor_id}`, 'canal:apagado', { id: canal.id, servidorId: canal.servidor_id });
}

export function aoApagarServidor(sid, canais) {
  for (const c of canais) {
    const mapa = voz.get(c.id);
    if (mapa) {
      for (const uid of mapa.keys()) vozDoUsuario.delete(uid);
      voz.delete(c.id);
    }
    if (assistir.has(c.id)) {
      assistir.delete(c.id);
      io?.in(`a:${c.id}`).socketsLeave(`a:${c.id}`);
    }
  }
  emitir(`s:${sid}`, 'servidor:apagado', { id: sid });
  io?.in(`s:${sid}`).socketsLeave(`s:${sid}`);
}

export function aoSairDoServidor(uid, sid) {
  const canalVoz = vozDoUsuario.get(uid);
  if (canalVoz) {
    const c = db.canalPorId(canalVoz);
    if (c && c.servidor_id === sid) sairDaVoz(uid);
  }
  for (const [canalId, e] of assistir) {
    if (e.servidorId === sid) sairDoAssistir(canalId, { usuarioId: uid });
  }
  emitir(`s:${sid}`, 'membro:saiu', { servidorId: sid, usuarioId: uid });
  sairSala(uid, `s:${sid}`);
}

// ------------------------------------------------------------------ conexão
function ouvir(socket, evento, fn) {
  socket.on(evento, async (...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    let resposta;
    try {
      resposta = (await fn(args[0])) ?? { ok: true };
    } catch (e) {
      if (!(e instanceof ErroKali)) console.error(`[socket] erro em ${evento}:`, e);
      resposta = { erro: e instanceof ErroKali ? e.message : 'Erro interno do servidor.' };
    }
    if (ack) {
      try { ack(resposta); } catch { /* cliente sumiu */ }
    }
  });
}

function aoConectar(socket) {
  const uid = socket.data.usuarioId;
  socket.join(`u:${uid}`);
  const servidores = db.servidoresDoUsuario(uid);
  for (const s of servidores) socket.join(`s:${s.id}`);
  for (const d of db.dmsDoUsuario(uid)) socket.join(`c:${d.canal_id}`);

  let meus = presenca.get(uid);
  const primeiro = !meus || meus.size === 0;
  if (!meus) presenca.set(uid, (meus = new Set()));
  meus.add(socket.id);
  if (primeiro) emitirPresenca(uid);

  const meusServidores = new Set(servidores.map((s) => s.id));
  for (const canalId of voz.keys()) {
    const canal = db.canalPorId(canalId);
    if (canal && meusServidores.has(canal.servidor_id)) socket.emit('voz:membros', payloadVoz(canalId));
  }

  let ultimoDigitando = 0;

  // ---------------- mensagens
  ouvir(socket, 'msg:enviar', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    const texto = validarTexto(d.texto);
    let expiraEm = null;
    if (d.expiraEm !== undefined && d.expiraEm !== null) {
      if (!Number.isInteger(d.expiraEm) || d.expiraEm < 1 || d.expiraEm > 86400) {
        throw erro(400, 'Tempo de expiração inválido.');
      }
      expiraEm = Date.now() + d.expiraEm * 1000;
    }
    const canal = db.acessarCanal(uid, canalId);
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não aceita mensagens de texto.');
    db.exigirSemCastigo(canal, uid);
    const respostaA = respostaValida(d.respostaA, canal.id);
    checarLimiteMensagens(uid);
    const msg = publicarMensagem(canal, { autorId: uid, texto, expiraEm, respostaA });
    return { ok: true, msg };
  });

  ouvir(socket, 'msg:fixar', (d) => {
    exigirObjeto(d);
    const row = db.mensagemPorId(exigirId(d.id, 'Mensagem'));
    if (!row || row.sistema) throw erro(404, 'Mensagem não encontrada.');
    const canal = db.acessarCanal(uid, row.canal_id);
    if (canal.servidor_id != null && !db.ehStaff(canal.servidor_id, uid)) throw erro(403, 'Só a staff pode fixar mensagens.');
    db.fixarMensagem(row.id, d.fixar !== false);
    emitir(salaDoCanal(canal), 'msg:editada', db.mensagemCompleta(row.id));
    return { ok: true };
  });

  ouvir(socket, 'msg:editar', (d) => {
    exigirObjeto(d);
    const id = exigirId(d.id, 'Mensagem');
    const texto = validarTexto(d.texto);
    const row = db.mensagemPorId(id);
    if (!row) throw erro(404, 'Mensagem não encontrada.');
    const canal = db.acessarCanal(uid, row.canal_id);
    if (row.autor_id !== uid) throw erro(403, 'Só o autor pode editar a mensagem.');
    if (row.sistema || row.audio_duracao != null) throw erro(400, 'Essa mensagem não pode ser editada.');
    db.editarMensagem(id, texto);
    emitir(salaDoCanal(canal), 'msg:editada', db.mensagemCompleta(id));
    return { ok: true };
  });

  ouvir(socket, 'msg:apagar', (d) => {
    exigirObjeto(d);
    const id = exigirId(d.id, 'Mensagem');
    const row = db.mensagemPorId(id);
    if (!row) throw erro(404, 'Mensagem não encontrada.');
    const canal = db.acessarCanal(uid, row.canal_id);
    const ehDono = canal.servidor_id != null && canal.dono_id === uid;
    if (row.autor_id !== uid && !ehDono) throw erro(403, 'Você não pode apagar essa mensagem.');
    removerMensagem(row);
    return { ok: true };
  });

  ouvir(socket, 'msg:reagir', (d) => {
    exigirObjeto(d);
    const id = exigirId(d.id, 'Mensagem');
    const emoji = validarEmoji(d.emoji);
    const row = db.mensagemPorId(id);
    if (!row) throw erro(404, 'Mensagem não encontrada.');
    const canal = db.acessarCanal(uid, row.canal_id);
    const adicionou = db.alternarReacao(id, uid, emoji);
    const reacoes = db.reacoesDe([id]).get(id) || [];
    emitir(salaDoCanal(canal), 'msg:reacoes', { id, canalId: canal.id, reacoes });
    if (adicionou && canal.servidor_id != null && row.autor_id && row.autor_id !== uid) {
      const chave = `${id}:${uid}`;
      if (!reacoesPremiadas.has(chave)) {
        if (reacoesPremiadas.size > 100_000) reacoesPremiadas.clear();
        reacoesPremiadas.add(chave);
        ganharXp(row.autor_id, canal.servidor_id, 2, 'reacoes');
      }
    }
    return { ok: true };
  });

  ouvir(socket, 'digitando', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    const canal = db.acessarCanal(uid, canalId);
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não aceita mensagens de texto.');
    const agora = Date.now();
    if (agora - ultimoDigitando < 1000) return { ok: true };
    ultimoDigitando = agora;
    const u = db.usuarioPorId(uid);
    socket.to(salaDoCanal(canal)).emit('digitando', { canalId, usuario: { id: uid, nome: u.nome } });
    return { ok: true };
  });

  ouvir(socket, 'presenca', (d) => {
    exigirObjeto(d);
    if (!['online', 'ausente', 'ocupado'].includes(d.status)) throw erro(400, 'Status inválido.');
    db.definirStatus(uid, d.status);
    emitirPresenca(uid);
    return { ok: true };
  });

  // ---------------- voz
  ouvir(socket, 'voz:entrar', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    const canal = db.canalPorId(canalId);
    if (!canal || canal.tipo !== 'voz') throw erro(404, 'Canal de voz não encontrado.');
    if (!db.ehMembro(canal.servidor_id, uid)) throw erro(403, 'Você não tem acesso a este canal.');
    const atual = vozDoUsuario.get(uid);
    if (atual) {
      const anterior = voz.get(atual)?.get(uid);
      if (anterior && anterior.socketId !== socket.id) {
        io.to(anterior.socketId).emit('voz:par-saiu', { usuarioId: uid });
      }
      sairDaVoz(uid);
    }
    let mapa = voz.get(canalId);
    if (mapa && mapa.size >= LIMITE_SALA_VOZ) throw erro(400, 'Essa sala de voz está cheia.');
    if (!mapa) voz.set(canalId, (mapa = new Map()));
    const pares = [...mapa.keys()];
    mapa.set(uid, {
      mudo: false, surdo: false, falando: false,
      x: Math.round((0.3 + Math.random() * 0.4) * 1000) / 1000,
      y: Math.round((0.3 + Math.random() * 0.4) * 1000) / 1000,
      socketId: socket.id,
    });
    vozDoUsuario.set(uid, canalId);
    emitirVozMembros(canalId, canal.servidor_id);
    return { ok: true, pares };
  });

  ouvir(socket, 'voz:sair', () => {
    const canalId = vozDoUsuario.get(uid);
    const e = canalId && voz.get(canalId)?.get(uid);
    if (e && e.socketId === socket.id) sairDaVoz(uid);
    return { ok: true };
  });

  const minhaVoz = () => {
    const canalId = vozDoUsuario.get(uid);
    const e = canalId ? voz.get(canalId)?.get(uid) : null;
    if (!e || e.socketId !== socket.id) throw erro(403, 'Você não está em um canal de voz.');
    return { canalId, e };
  };

  ouvir(socket, 'voz:sinal', (d) => {
    exigirObjeto(d);
    const para = exigirId(d.para, 'Destino');
    const dados = exigirObjeto(d.dados);
    const { canalId } = minhaVoz();
    const destino = para !== uid ? voz.get(canalId)?.get(para) : null;
    if (!destino) throw erro(403, 'Esse usuário não está no seu canal de voz.');
    let limpo;
    if (dados.sdp !== undefined) {
      const sdp = exigirObjeto(dados.sdp);
      if (!['offer', 'answer'].includes(sdp.type) || typeof sdp.sdp !== 'string' || sdp.sdp.length > 20000) {
        throw erro(400, 'Sinal inválido.');
      }
      limpo = { sdp: { type: sdp.type, sdp: sdp.sdp } };
    } else if (dados.candidato !== undefined) {
      const c = dados.candidato;
      if (c === null) limpo = { candidato: null };
      else {
        exigirObjeto(c);
        if (typeof c.candidate !== 'string' || c.candidate.length > 2000) throw erro(400, 'Sinal inválido.');
        limpo = {
          candidato: {
            candidate: c.candidate,
            sdpMid: typeof c.sdpMid === 'string' ? c.sdpMid.slice(0, 64) : null,
            sdpMLineIndex: Number.isInteger(c.sdpMLineIndex) ? c.sdpMLineIndex : null,
            usernameFragment: typeof c.usernameFragment === 'string' ? c.usernameFragment.slice(0, 256) : null,
          },
        };
      }
    } else {
      throw erro(400, 'Sinal inválido.');
    }
    io.to(destino.socketId).emit('voz:sinal', { de: uid, dados: limpo });
    return { ok: true };
  });

  ouvir(socket, 'voz:estado', (d) => {
    exigirObjeto(d);
    for (const k of ['mudo', 'surdo', 'falando']) {
      if (d[k] !== undefined && typeof d[k] !== 'boolean') throw erro(400, 'Estado de voz inválido.');
    }
    const { canalId, e } = minhaVoz();
    let mudou = false;
    for (const k of ['mudo', 'surdo', 'falando']) {
      if (d[k] !== undefined && e[k] !== d[k]) {
        e[k] = d[k];
        mudou = true;
      }
    }
    if (mudou) emitirVozMembros(canalId, db.canalPorId(canalId)?.servidor_id);
    return { ok: true };
  });

  ouvir(socket, 'voz:posicao', (d) => {
    exigirObjeto(d);
    const ok = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
    if (!ok(d.x) || !ok(d.y)) throw erro(400, 'Posição inválida.');
    const { canalId, e } = minhaVoz();
    const canal = db.canalPorId(canalId);
    if (!canal?.espacial) throw erro(400, 'Esse canal não é uma Sala 3D.');
    e.x = Math.round(d.x * 1000) / 1000;
    e.y = Math.round(d.y * 1000) / 1000;
    emitirVozMembros(canalId, canal.servidor_id);
    return { ok: true };
  });

  // ---------------- Assistir Junto
  const canalAssistir = (canalId) => {
    const canal = db.canalPorId(canalId);
    if (!canal || canal.tipo !== 'assistir') throw erro(404, 'Canal de Assistir Junto não encontrado.');
    if (!db.ehMembro(canal.servidor_id, uid)) throw erro(403, 'Você não tem acesso a este canal.');
    return canal;
  };
  const exigirEspectador = (canalId) => {
    const canal = canalAssistir(canalId);
    const e = assistir.get(canalId);
    if (!e || !e.sockets.has(socket.id)) throw erro(403, 'Entre no Assistir Junto primeiro.');
    return { canal, e };
  };

  ouvir(socket, 'assistir:entrar', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    const canal = canalAssistir(canalId);
    const e = estadoAssistir(canal);
    socket.join(`a:${canalId}`);
    e.sockets.set(socket.id, uid);
    if (!e.hostId) e.hostId = uid;
    const chave = `${uid}:${e.sessao}`;
    if (!e.premiados.has(chave)) {
      e.premiados.add(chave);
      ganharXp(uid, canal.servidor_id, 10, 'assistir');
    }
    emitirAssistir(canalId);
    return { ok: true, estado: publicoAssistir(canalId, e) };
  });

  ouvir(socket, 'assistir:sair', (d) => {
    const canalId = d && typeof d === 'object' && d.canalId !== undefined ? exigirId(d.canalId, 'Canal') : null;
    for (const id of canalId ? [canalId] : [...assistir.keys()]) sairDoAssistir(id, { socketId: socket.id });
    return { ok: true };
  });

  ouvir(socket, 'assistir:definir', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    const video = validarUrlVideo(d.url);
    const { canal, e } = exigirEspectador(canalId);
    Object.assign(e, { ...video, tocando: false, tempo: 0, atualizadoEm: Date.now(), hostId: uid });
    e.sessao++;
    emitirAssistir(canalId);
    const agora = Date.now();
    if (agora - e.ultimoAviso > 60_000) {
      const avisos = db.canalDeAvisos(canal.servidor_id);
      if (avisos) {
        e.ultimoAviso = agora;
        const u = db.usuarioPorId(uid);
        publicarMensagem(avisos, {
          autorId: null,
          texto: `${u.nome} começou Assistir Junto em ${canal.nome}`,
          sistema: true,
          refCanalId: canal.id,
        });
      }
    }
    return { ok: true, estado: publicoAssistir(canalId, e) };
  });

  ouvir(socket, 'assistir:controle', (d) => {
    exigirObjeto(d);
    const canalId = exigirId(d.canalId, 'Canal');
    if (!['play', 'pause', 'seek'].includes(d.acao)) throw erro(400, 'Ação inválida.');
    const tempoOk = typeof d.tempo === 'number' && Number.isFinite(d.tempo) && d.tempo >= 0 && d.tempo <= 86400;
    if (d.tempo !== undefined && !tempoOk) throw erro(400, 'Tempo inválido.');
    if (d.acao === 'seek' && !tempoOk) throw erro(400, 'Tempo inválido.');
    const { e } = exigirEspectador(canalId);
    if (!e.url) throw erro(400, 'Nenhum vídeo definido ainda.');
    const tempo = tempoOk ? d.tempo : posicaoAtual(e);
    if (d.acao === 'play') e.tocando = true;
    if (d.acao === 'pause') e.tocando = false;
    e.tempo = tempo;
    e.atualizadoEm = Date.now();
    emitirAssistir(canalId);
    return { ok: true };
  });

  // ---------------- desconexão
  socket.on('disconnect', () => {
    try {
      meus.delete(socket.id);
      const canalVoz = vozDoUsuario.get(uid);
      const e = canalVoz ? voz.get(canalVoz)?.get(uid) : null;
      if (e && e.socketId === socket.id) sairDaVoz(uid);
      for (const canalId of [...assistir.keys()]) sairDoAssistir(canalId, { socketId: socket.id });
      if (meus.size === 0) {
        presenca.delete(uid);
        sairDaVoz(uid);
        emitirPresenca(uid);
      }
    } catch (err) {
      console.error('[socket] erro ao desconectar:', err);
    }
  });
}

export function configurarTempoReal(servidorIo) {
  io = servidorIo;
  io.use(autenticarSocket);
  io.on('connection', (socket) => {
    try {
      aoConectar(socket);
    } catch (e) {
      console.error('[socket] erro ao conectar:', e);
      socket.disconnect(true);
    }
  });
  varrer();
  const intervalo = Number(process.env.KALI_VARREDURA_MS) || 30_000;
  setInterval(varrer, intervalo).unref();
  setInterval(tickVoz, 60_000).unref();
}
