// Rotas REST /api da KALI.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import * as db from './db.js';
import { erro } from './db.js';
import {
  conferirSenha, conferirSenhaOuFingir, criarLimitador, definirCookieSessao, exigirLogin, gerarHash, ipDaRequisicao,
  limparCookieSessao, limparFalhasLogin, loginBloqueado, registrarFalhaLogin, tokenDaRequisicao,
} from './auth.js';
import { publicarMensagem, caminhoAnexo, pareceGolpe, respostaValida, quantosOnline, exigirModoLento,
  sairSala, apagarArquivosAnexo,
  BONUS_MISSAO, MISSOES, anunciarMensagem, aoApagarCanal, aoApagarServidor, aoAtualizarPerfil, aoSairDoServidor,
  apagarArquivosAudio, caminhoAudio, checarLimiteMensagens, desconectarSessao, emitir, entrarSala,
  membroPublico, nivelDe, origemPermitida, salaDoCanal, semanaAtual, usuarioPublico, xpParaNivel,
  emitirLfg, ganharXpLfg, lfgPublico,
} from './tempo-real.js';
import { gerarResumo } from './resumo.js';
import { buscarSeguro, previaDe } from './previa.js';

const RE_USUARIO = /^[a-z0-9_.]{3,20}$/;
const RE_CANAL_TEXTO = /^[a-z0-9-]{1,30}$/;
const RE_COR = /^#[0-9a-fA-F]{6}$/;
const RE_CONVITE = /^[A-Za-z0-9]{8}$/;
const FOCO_PERMITIDO = [0, 15, 30, 60, 120];

const corpoDe = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
function idDe(v) {
  if (typeof v !== 'string' || !/^[1-9]\d{0,14}$/.test(v)) throw erro(404, 'Não encontrado.');
  return Number(v);
}
function textoOpcional(v, rotulo) {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw erro(400, `${rotulo} inválido.`);
  return v.trim();
}

function servidorComoMembro(uid, sid) {
  const s = db.servidorPorId(sid);
  if (!s) throw erro(404, 'Servidor não encontrado.');
  if (!db.ehMembro(sid, uid)) throw erro(403, 'Você não é membro deste servidor.');
  return s;
}
function servidorComoDono(uid, sid) {
  const s = servidorComoMembro(uid, sid);
  if (s.dono_id !== uid) throw erro(403, 'Só o dono do servidor pode fazer isso.');
  return s;
}
const servidorCompleto = (row, uid) => {
  const s = db.serServidor(row);
  // tickets só aparecem pra staff e pra quem abriu
  s.canais = s.canais.filter((c) => (!c.ticket && !db.cargosDoCanal(c.id).length) || db.ehStaff(row.id, uid) || db.temAcessoCanal(c.id, uid));
  // tópico só aparece se a pessoa enxerga o canal-pai (inclui canal com senha que ela ainda não destravou)
  const visiveis = new Set(s.canais.filter((c) => !c.comSenha || db.ehStaff(row.id, uid) || db.temAcessoCanal(c.id, uid)).map((c) => c.id));
  s.canais = s.canais.filter((c) => !c.paiCanal || visiveis.has(c.paiCanal));
  const eu = db.usuarioPorId(uid);
  return { ...s, naoLidos: db.naoLidosDoServidor(uid, row.id), mencoes: eu ? db.mencoesDoServidor(uid, eu.usuario, row.id) : {},
    icone: db.urlImagem('s', row.id, 'icone', row.icone_v), bannerImg: db.urlImagem('s', row.id, 'banner', row.banner_v) };
};
// Dono do app (gerencia a loja): KALI_ADMINS (vírgula) e/ou dados/admins.txt (um usuário por linha), lidos ao subir.
const ADMINS = new Set([
  ...(process.env.KALI_ADMINS || '').split(','),
  ...(() => { try { return fs.readFileSync(path.join(path.dirname(db.CAMINHO_DB), 'admins.txt'), 'utf8').split(/[\s,]+/); } catch { return []; } })(),
].map((s) => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean));
const ehDonoDoApp = (u) => ADMINS.has(u.usuario);
// Formato real da imagem pelos primeiros bytes (não confia no que o navegador diz).
function tipoDaImagem(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
const BANNERS = ['nebulosa', 'oceano', 'floresta', 'por-do-sol', 'neon', 'aurora'];
function validarVitrine(c) {
  const v = {};
  if (c.bio !== undefined) {
    if (typeof c.bio !== 'string' || c.bio.trim().length > 190) throw erro(400, 'A bio pode ter no máximo 190 caracteres.');
    v.bio = c.bio.trim();
  }
  if (c.banner !== undefined) {
    if (c.banner !== '' && !BANNERS.includes(c.banner)) throw erro(400, 'Banner inválido.');
    v.banner = c.banner;
  }
  if (c.links !== undefined) {
    if (!Array.isArray(c.links) || c.links.length > 5) throw erro(400, 'Até 5 links na bio.');
    v.links = c.links.map((l) => {
      let url;
      try { url = new URL(String(l).trim()); } catch { throw erro(400, 'Link inválido: use o endereço completo (https://…).'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 200) throw erro(400, 'Link inválido: use o endereço completo (https://…).');
      return url.href;
    });
  }
  if (c.aniversario !== undefined) {
    if (c.aniversario !== '' && !/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(c.aniversario)) throw erro(400, 'Aniversário inválido (dia e mês).');
    v.aniversario = c.aniversario;
  }
  if (c.jogos !== undefined) {
    if (!Array.isArray(c.jogos) || c.jogos.length > 5 || c.jogos.some((j) => typeof j !== 'string' || !j.trim() || j.trim().length > 30)) {
      throw erro(400, 'Até 5 jogos favoritos, com até 30 caracteres cada.');
    }
    v.jogos = c.jogos.map((j) => j.trim());
  }
  return v;
}
function servidorComoStaff(uid, sid) {
  const s = servidorComoMembro(uid, sid);
  if (!db.ehStaff(sid, uid)) throw erro(403, 'Só a staff (dono, adm ou mod) pode fazer isso.');
  return s;
}
/** Alvo da moderação: precisa ser membro e ter cargo menor que o de quem age. */
function alvoModeravel(uid, sid, alvoId) {
  if (alvoId === uid) throw erro(400, 'Você não pode fazer isso com você mesmo.');
  const meu = db.nivelCargo(sid, uid), dele = db.nivelCargo(sid, alvoId);
  if (dele >= meu) throw erro(403, 'Você só pode moderar quem tem cargo menor que o seu.');
  return dele;
}

function dmPublica(canalId, uid) {
  const canal = db.canalPorId(canalId);
  if (canal && canal.nome !== 'dm') { // grupo no privado
    const membros = db.participantesDm(canalId).map((id) => db.usuarioPorId(id)).filter(Boolean).map((u) => usuarioPublico(u));
    const ultimaRow = db.ultimaMensagem(canalId);
    return {
      canalId, grupo: true, membros,
      outro: { id: -canalId, usuario: membros.filter((m) => m.id !== uid).map((m) => m.usuario).join(', '), nome: canal.nome, cor: '#2563eb', status: 'offline', statusTexto: `${membros.length} membros` },
      ultima: ultimaRow ? db.serMensagens([ultimaRow])[0] : null,
      naoLidos: db.naoLidosDoCanal(uid, canalId),
    };
  }
  const outroId = db.outroDaDm(canalId, uid);
  const outro = outroId ? db.usuarioPorId(outroId) : null;
  if (!outro) return null;
  const ultimaRow = db.ultimaMensagem(canalId);
  return {
    canalId,
    outro: usuarioPublico(outro),
    ultima: ultimaRow ? db.serMensagens([ultimaRow])[0] : null,
    naoLidos: db.naoLidosDoCanal(uid, canalId),
  };
}

const podeTerMensagens = (canal) => canal.tipo === 'texto' || canal.tipo === 'assistir' || canal.tipo === 'dm';

export function criarRotas() {
  const r = express.Router();

  // Proteção extra contra CSRF: requisições que mudam estado vindas de outra origem são recusadas.
  r.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && !origemPermitida(req.headers.origin, req.headers.host)) {
      res.status(403).json({ erro: 'Origem não permitida.' });
      return;
    }
    next();
  });

  r.param('id', (req, res, next, v) => (/^[1-9][0-9]{0,15}$/.test(v) ? next() : res.status(400).json({ erro: 'Identificador inválido.' })));

  // ------------------------------------------------------------ conta
  r.post('/registrar', async (req, res) => {
    const c = corpoDe(req);
    if (typeof c.usuario !== 'string' || typeof c.senha !== 'string') throw erro(400, 'Informe usuário e senha.');
    const usuario = c.usuario.trim().toLowerCase();
    if (!RE_USUARIO.test(usuario)) {
      throw erro(400, 'O usuário deve ter de 3 a 20 caracteres: letras minúsculas, números, "_" ou ".".');
    }
    if (c.senha.length < 6) throw erro(400, 'A senha precisa ter pelo menos 6 caracteres.');
    if (c.senha.length > 200) throw erro(400, 'A senha é longa demais.');
    let nome = textoOpcional(c.nome, 'Nome');
    if (nome !== undefined && nome.length > 32) throw erro(400, 'O nome pode ter no máximo 32 caracteres.');
    if (!nome) nome = usuario;
    if (db.usuarioPorNome(usuario)) throw erro(409, 'Esse nome de usuário já está em uso.');
    const { hash, salt } = await gerarHash(c.senha);
    let id;
    try {
      id = db.criarUsuario({ usuario, nome, hash, salt, cor: db.corAleatoria() });
    } catch (e) {
      if (String(e?.message).includes('UNIQUE')) throw erro(409, 'Esse nome de usuário já está em uso.');
      throw e;
    }
    definirCookieSessao(req, res, db.criarSessao(id));
    res.status(201).json(usuarioPublico(db.usuarioPorId(id), { proprio: true }));
  });

  r.post('/entrar', async (req, res) => {
    const c = corpoDe(req);
    if (typeof c.usuario !== 'string' || typeof c.senha !== 'string' || c.senha.length > 200) {
      throw erro(400, 'Informe usuário e senha.');
    }
    const usuario = c.usuario.trim().toLowerCase();
    // Nome fora do formato nunca existe: responde direto, sem ocupar o limitador.
    if (!RE_USUARIO.test(usuario)) throw erro(401, 'Usuário ou senha incorretos.');
    const ip = ipDaRequisicao(req);
    if (loginBloqueado(usuario, ip)) throw erro(429, 'Muitas tentativas. Espere alguns minutos e tente de novo.');
    const row = db.usuarioPorNome(usuario);
    const ok = await conferirSenhaOuFingir(c.senha, row);
    if (!ok || !row) {
      registrarFalhaLogin(usuario, ip);
      throw erro(401, 'Usuário ou senha incorretos.');
    }
    limparFalhasLogin(usuario);
    definirCookieSessao(req, res, db.criarSessao(row.id));
    res.json(usuarioPublico(row, { proprio: true }));
  });

  r.post('/sair', (req, res) => {
    const token = tokenDaRequisicao(req);
    if (token) {
      const u = db.usuarioDaSessao(token);
      db.apagarSessao(token);
      if (u) desconectarSessao(u.id, token).catch(() => {});
    }
    limparCookieSessao(req, res);
    res.json({ ok: true });
  });

  r.get('/eu', exigirLogin, (req, res) => {
    // Aniversário: parabéns automático uma vez por ano em todos os servidores da pessoa.
    const u = req.usuario, hoje = new Date();
    const mmdd = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    if (u.aniversario === mmdd && u.aniv_ano !== hoje.getFullYear()) {
      db.marcarAniversario(u.id, hoje.getFullYear());
      for (const s of db.servidoresDoUsuario(u.id)) {
        const avisos = db.canalDeAvisos(s.id);
        if (avisos) publicarMensagem(avisos, { autorId: null, texto: `🎂 Hoje é aniversário de ${u.nome}! Manda os parabéns 🎉`, sistema: true });
      }
    }
    res.json({ ...usuarioPublico(req.usuario, { proprio: true }), admin: ehDonoDoApp(req.usuario) });
  });

  r.patch('/eu', exigirLogin, (req, res) => {
    const c = corpoDe(req);
    const uid = req.usuario.id;
    const nome = textoOpcional(c.nome, 'Nome');
    if (nome !== undefined && (nome.length < 1 || nome.length > 32)) {
      throw erro(400, 'O nome precisa ter de 1 a 32 caracteres.');
    }
    if (c.cor !== undefined && (typeof c.cor !== 'string' || !RE_COR.test(c.cor))) throw erro(400, 'Cor inválida.');
    const statusTexto = textoOpcional(c.statusTexto, 'Status');
    if (statusTexto !== undefined && statusTexto.length > 80) {
      throw erro(400, 'O recado pode ter no máximo 80 caracteres.');
    }
    if (c.focoMinutos !== undefined && !FOCO_PERMITIDO.includes(c.focoMinutos)) {
      throw erro(400, 'Duração do modo foco inválida (use 15, 30, 60, 120 ou 0).');
    }
    const vitrine = validarVitrine(c);
    if (nome === undefined && c.cor === undefined && statusTexto === undefined && c.focoMinutos === undefined && !Object.keys(vitrine).length) {
      throw erro(400, 'Nada para atualizar.');
    }
    db.atualizarPerfil(uid, { nome, cor: c.cor?.toLowerCase(), statusTexto });
    db.atualizarVitrine(uid, vitrine);
    if (c.focoMinutos !== undefined) {
      db.definirFoco(uid, c.focoMinutos === 0 ? null : Date.now() + c.focoMinutos * 60_000);
    }
    aoAtualizarPerfil(uid);
    res.json(usuarioPublico(db.usuarioPorId(uid), { proprio: true }));
  });

  // ------------------------------------------------------------ servidores
  r.get('/servidores', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    res.json(db.servidoresDoUsuario(uid).map((s) => servidorCompleto(s, uid)));
  });

  r.post('/servidores', exigirLogin, (req, res) => {
    const nome = textoOpcional(corpoDe(req).nome, 'Nome');
    if (!nome || nome.length < 2 || nome.length > 40) throw erro(400, 'O nome do servidor precisa ter de 2 a 40 caracteres.');
    const uid = req.usuario.id;
    const id = db.criarServidor(nome, uid);
    entrarSala(uid, `s:${id}`);
    res.status(201).json(servidorCompleto(db.servidorPorId(id), uid));
  });

  r.patch('/servidores/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoDono(uid, idDe(req.params.id));
    const nome = textoOpcional(corpoDe(req).nome, 'Nome');
    if (!nome || nome.length < 2 || nome.length > 40) throw erro(400, 'O nome do servidor precisa ter de 2 a 40 caracteres.');
    db.renomearServidor(s.id, nome);
    // Pra sala inteira vai só o que todos podem ver (sem canais: privados e tickets não vazam).
    emitir(`s:${s.id}`, 'servidor:atualizado', { id: s.id, nome, sigla: db.sigla(nome) });
    res.json(servidorCompleto(db.servidorPorId(s.id), uid));
  });

  r.delete('/servidores/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoDono(uid, idDe(req.params.id));
    const canais = db.canaisDoServidor(s.id);
    const audios = db.idsAudiosDoServidor(s.id);
    const anexos = db.idsAnexosDoServidor(s.id);
    db.apagarServidor(s.id);
    apagarArquivosAudio(audios);
    apagarArquivosAnexo(anexos);
    aoApagarServidor(s.id, canais);
    res.json({ ok: true });
  });

  r.post('/convites/:codigo', exigirLogin, (req, res) => {
    const codigo = String(req.params.codigo || '');
    const s = RE_CONVITE.test(codigo) ? db.servidorPorConvite(codigo) : null;
    if (!s) throw erro(404, 'Convite inválido ou expirado.');
    const uid = req.usuario.id;
    if (db.ehBanido(s.id, uid)) throw erro(403, 'Você foi banido deste servidor.');
    if (!db.ehMembro(s.id, uid)) {
      db.adicionarMembro(s.id, uid);
      entrarSala(uid, `s:${s.id}`);
      const row = db.membrosDoServidor(s.id).find((m) => m.id === uid);
      emitir(`s:${s.id}`, 'membro:entrou', { servidorId: s.id, membro: membroPublico(row, s.dono_id) });
      // Boas-vindas automáticas no canal de avisos (primeiro canal de texto).
      const avisos = db.canalDeAvisos(s.id);
      if (avisos) publicarMensagem(avisos, { autorId: null, texto: `👋 ${row.nome} chegou em ${s.nome}! Dá as boas-vindas pra galera e lê as regras.`, sistema: true });
    }
    res.json(servidorCompleto(db.servidorPorId(s.id), uid));
  });

  r.post('/servidores/:id/sair', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    if (s.dono_id === uid) throw erro(400, 'O dono não pode sair do próprio servidor. Você pode apagá-lo.');
    db.removerMembro(s.id, uid);
    aoSairDoServidor(uid, s.id);
    res.json({ ok: true });
  });

  r.get('/servidores/:id/membros', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    res.json(db.membrosDoServidor(s.id).map((m) => membroPublico(m, s.dono_id)));
  });

  r.post('/servidores/:id/canais', exigirLogin, async (req, res) => {
    const s = servidorComoDono(req.usuario.id, idDe(req.params.id));
    const c = corpoDe(req);
    if (!['texto', 'voz', 'assistir'].includes(c.tipo)) throw erro(400, 'Tipo de canal inválido.');
    if (typeof c.nome !== 'string') throw erro(400, 'Nome do canal inválido.');
    let nome = c.nome.trim();
    if (c.tipo === 'voz') {
      if (nome.length < 1 || nome.length > 30) throw erro(400, 'O nome do canal de voz precisa ter de 1 a 30 caracteres.');
    } else {
      nome = nome.toLowerCase();
      if (!RE_CANAL_TEXTO.test(nome)) {
        throw erro(400, 'O nome do canal deve ter de 1 a 30 caracteres: letras minúsculas, números ou "-".');
      }
    }
    if (c.espacial !== undefined && typeof c.espacial !== 'boolean') throw erro(400, 'Opção "espacial" inválida.');
    if (c.senha !== undefined && (c.tipo !== 'texto' || typeof c.senha !== 'string' || c.senha.length < 4 || c.senha.length > 64)) {
      throw erro(400, 'A senha do canal precisa ter de 4 a 64 caracteres (só canal de texto).');
    }
    if (db.contarCanais(s.id) >= 100) throw erro(400, 'Esse servidor já tem canais demais.');
    // Hash antes do INSERT: o canal já nasce privado (nunca existe um instante aberto sem senha).
    const senha = c.senha !== undefined ? await gerarHash(c.senha) : null;
    const id = db.criarCanal(s.id, nome, c.tipo, c.tipo === 'voz' && c.espacial === true, {
      categoria: typeof c.categoria === 'string' && c.categoria.trim() ? c.categoria.trim().slice(0, 30) : null,
      senhaHash: senha?.hash ?? null,
      senhaSalt: senha?.salt ?? null,
    });
    const canal = db.serCanal(db.canalPorId(id));
    emitir(`s:${s.id}`, 'canal:novo', canal);
    res.status(201).json(canal);
  });

  // ------------------------------------------------------------ staff e moderação
  r.patch('/servidores/:id/membros/:uid', exigirLogin, (req, res) => {
    const s = servidorComoDono(req.usuario.id, idDe(req.params.id));
    const alvo = idDe(req.params.uid);
    const cargo = corpoDe(req).cargo;
    if (!db.CARGOS.includes(cargo)) throw erro(400, 'Cargo inválido (adm, mod ou membro).');
    if (!db.ehMembro(s.id, alvo) || alvo === s.dono_id) throw erro(400, 'Esse membro não pode receber cargo.');
    db.definirCargo(s.id, alvo, cargo);
    const row = db.membrosDoServidor(s.id).find((m) => m.id === alvo);
    const membro = membroPublico(row, s.dono_id);
    emitir(`s:${s.id}`, 'membro:atualizado', { servidorId: s.id, membro });
    res.json(membro);
  });

  const expulsar = (s, alvo) => {
    db.removerMembro(s.id, alvo);
    aoSairDoServidor(alvo, s.id);
    emitir(`u:${alvo}`, 'servidor:apagado', { id: s.id });
  };
  r.delete('/servidores/:id/membros/:uid', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const alvo = idDe(req.params.uid);
    if (alvoModeravel(uid, s.id, alvo) === 0) throw erro(404, 'Essa pessoa não está no servidor.');
    db.registrarAuditoria(s.id, uid, 'expulsar', db.usuarioPorId(alvo)?.nome);
    expulsar(s, alvo);
    res.json({ ok: true });
  });
  r.post('/servidores/:id/banir', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const c = corpoDe(req);
    const alvo = idDe(String(c.usuarioId));
    const motivo = typeof c.motivo === 'string' ? c.motivo.trim().slice(0, 300) : '';
    const nivel = alvoModeravel(uid, s.id, alvo);
    if (!db.usuarioPorId(alvo)) throw erro(404, 'Usuário não encontrado.');
    db.banir(s.id, alvo, uid, motivo || null);
    db.registrarAuditoria(s.id, uid, 'banir', db.usuarioPorId(alvo)?.nome, motivo || null);
    if (nivel > 0) expulsar(s, alvo);
    res.json({ ok: true });
  });

  // Senha de canal: 5 tentativas erradas a cada 15 min por pessoa e canal.
  const tentativasSenhaCanal = criarLimitador({ janela: 15 * 60 * 1000, max: 5 });
  r.post('/canais/:id/desbloquear', exigirLogin, async (req, res) => {
    const uid = req.usuario.id;
    const canal = db.canalPorId(idDe(req.params.id));
    if (!canal || canal.servidor_id == null) throw erro(404, 'Canal não encontrado.');
    servidorComoMembro(uid, canal.servidor_id);
    if (!canal.senha_hash) throw erro(400, 'Esse canal não tem senha.');
    const chave = `${uid}:${canal.id}`;
    if (tentativasSenhaCanal.bloqueado(chave)) throw erro(429, 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.');
    const senha = corpoDe(req).senha;
    if (typeof senha !== 'string' || senha.length > 200 || !(await conferirSenha(senha, canal.senha_hash, canal.senha_salt))) {
      tentativasSenhaCanal.registrar(chave);
      throw erro(403, 'Senha errada.');
    }
    tentativasSenhaCanal.limpar(chave);
    db.darAcessoCanal(canal.id, uid);
    res.json(db.serCanal(canal));
  });

  r.post('/servidores/:id/tickets', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    const assunto = typeof corpoDe(req).assunto === 'string' ? corpoDe(req).assunto.trim().slice(0, 200) : '';
    if (!assunto) throw erro(400, 'Conta rapidinho o assunto do ticket.');
    if (db.contarCanais(s.id) >= 100) throw erro(400, 'Esse servidor já tem canais demais.');
    const id = db.transacao(() => {
      const novo = db.criarCanal(s.id, `ticket-${db.contarTickets(s.id) + 1}`, 'texto', false, { ticketDe: uid });
      db.darAcessoCanal(novo, uid);
      return novo;
    });
    const row = db.canalPorId(id);
    const canal = db.serCanal(row);
    emitir(salaDoCanal(row), 'canal:novo', canal);
    const u = db.usuarioPorId(uid);
    publicarMensagem(row, { autorId: null, texto: `🎫 Ticket aberto por ${u.nome}: ${assunto}\nA staff já foi avisada e responde por aqui.`, sistema: true });
    res.status(201).json(canal);
  });

  r.post('/servidores/:id/denuncias', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    const c = corpoDe(req);
    const motivo = typeof c.motivo === 'string' ? c.motivo.trim().slice(0, 500) : '';
    if (motivo.length < 3) throw erro(400, 'Escreve o motivo da denúncia.');
    let d = { servidorId: s.id, autorId: uid, motivo };
    if (c.mensagemId !== undefined) {
      const m = db.mensagemCompleta(idDe(String(c.mensagemId)));
      const canal = m && db.acessarCanal(uid, m.canalId);
      if (!m || canal.servidor_id !== s.id) throw erro(404, 'Mensagem não encontrada.');
      d = { ...d, mensagemId: m.id, canalId: m.canalId, alvoId: m.autor?.id ?? null, texto: (m.texto || '🎙 áudio').slice(0, 2000) };
    } else if (c.usuarioId !== undefined) {
      d.alvoId = idDe(String(c.usuarioId));
    }
    const id = db.criarDenuncia(d);
    for (const staff of db.idsMembros(s.id).filter((x) => db.ehStaff(s.id, x))) {
      emitir(`u:${staff}`, 'denuncia:nova', { servidorId: s.id, id });
    }
    res.status(201).json({ ok: true, id });
  });
  r.get('/servidores/:id/denuncias', exigirLogin, (req, res) => {
    const s = servidorComoStaff(req.usuario.id, idDe(req.params.id));
    res.json(db.denunciasDoServidor(s.id).map((d) => ({
      id: d.id, estado: d.estado, motivo: d.motivo, texto: d.texto, mensagemId: d.mensagem_id, canalId: d.canal_id,
      autor: { id: d.autor_id, nome: d.autor_nome }, alvo: d.alvo_id ? { id: d.alvo_id, nome: d.alvo_nome } : null, criadoEm: d.criado_em,
    })));
  });
  r.patch('/denuncias/:id', exigirLogin, (req, res) => {
    const d = db.denunciaPorId(idDe(req.params.id));
    if (!d) throw erro(404, 'Denúncia não encontrada.');
    servidorComoStaff(req.usuario.id, d.servidor_id);
    const estado = corpoDe(req).estado;
    if (!['aberta', 'resolvida', 'descartada'].includes(estado)) throw erro(400, 'Estado inválido.');
    db.marcarDenuncia(d.id, estado);
    res.json({ ok: true });
  });

  r.delete('/canais/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const canal = db.canalPorId(idDe(req.params.id));
    if (!canal) throw erro(404, 'Canal não encontrado.');
    if (canal.servidor_id == null) throw erro(400, 'Conversas diretas não podem ser apagadas.');
    // ticket pode ser fechado pela staff ou por quem abriu; o resto só o dono apaga
    if (canal.ticket_de != null && (canal.ticket_de === uid || db.ehStaff(canal.servidor_id, uid))) servidorComoMembro(uid, canal.servidor_id);
    else servidorComoDono(uid, canal.servidor_id);
    // Tópicos vão junto: pega tudo antes de apagar pra limpar a tela e os arquivos.
    const topicos = db.topicosDoCanal(canal.id);
    const audios = db.idsAudiosDoCanal(canal.id);
    const anexos = db.idsAnexosDoCanal(canal.id);
    if (canal.servidor_id) db.registrarAuditoria(canal.servidor_id, uid, "apagar-canal", "#" + canal.nome);
    db.apagarCanal(canal.id);
    apagarArquivosAudio(audios);
    apagarArquivosAnexo(anexos);
    for (const t of topicos) aoApagarCanal(t);
    aoApagarCanal(canal);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ mensagens
  r.get('/canais/:id/mensagens', exigirLogin, (req, res) => {
    const canal = db.acessarCanal(req.usuario.id, idDe(req.params.id));
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não tem mensagens.');
    let antes = null;
    if (req.query.antes !== undefined && req.query.antes !== '') {
      if (typeof req.query.antes !== 'string' || !/^\d{1,15}$/.test(req.query.antes)) throw erro(400, 'Parâmetro "antes" inválido.');
      antes = Number(req.query.antes);
    }
    let limite = 50;
    if (req.query.limite !== undefined && req.query.limite !== '') {
      if (typeof req.query.limite !== 'string' || !/^\d{1,4}$/.test(req.query.limite)) throw erro(400, 'Parâmetro "limite" inválido.');
      limite = Math.min(100, Math.max(1, Number(req.query.limite)));
    }
    if (typeof req.query.ao_redor === 'string' && /^\d{1,15}$/.test(req.query.ao_redor)) {
      return res.json(db.serMensagens(db.mensagensAoRedor(canal.id, Number(req.query.ao_redor))));
    }
    res.json(db.serMensagens(db.listarMensagens(canal.id, antes, limite)));
  });

  // Busca no servidor: só nos canais que a pessoa enxerga (privados/senha/cargo respeitados).
  r.get('/servidores/:id/busca', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    const termo = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (termo.length < 2) throw erro(400, 'Digita pelo menos 2 letras pra buscar.');
    const de = typeof req.query.de === 'string' && /^[a-z0-9_.]{3,20}$/.test(req.query.de) ? req.query.de : null;
    const pagina = typeof req.query.pagina === 'string' && /^\d{1,3}$/.test(req.query.pagina) ? Number(req.query.pagina) : 0;
    const visiveis = servidorCompleto(s, uid).canais.filter((c) => c.tipo !== 'voz').map((c) => c.id)
      .filter((cid) => { try { db.acessarCanal(uid, cid); return true; } catch { return false; } });
    const nomes = new Map(servidorCompleto(s, uid).canais.map((c) => [c.id, c.nome]));
    const linhas = db.buscarMensagens(visiveis, { termo, de, limite: 26, offset: pagina * 25 });
    res.json({ mais: linhas.length > 25, resultados: db.serMensagens(linhas.slice(0, 25)).map((m) => ({ ...m, canalNome: nomes.get(m.canalId) || '' })) });
  });

  // Histórico de edições: autor ou staff do servidor.
  r.get('/mensagens/:id/edicoes', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const m = db.mensagemPorId(idDe(req.params.id));
    if (!m) throw erro(404, 'Mensagem não encontrada.');
    const canal = db.acessarCanal(uid, m.canal_id);
    if (m.autor_id !== uid && !(canal.servidor_id && db.ehStaff(canal.servidor_id, uid))) throw erro(403, 'Só o autor ou a staff vê o histórico.');
    res.json(db.edicoesDe(m.id));
  });

  // Banidos (ver e desfazer), registro da staff e trocar o link de convite.
  r.get('/servidores/:id/banidos', exigirLogin, (req, res) => {
    const s = servidorComoStaff(req.usuario.id, idDe(req.params.id));
    res.json(db.listarBanidos(s.id).map((b) => ({ usuario: { id: b.usuario_id, usuario: b.usuario, nome: b.nome, cor: b.cor }, motivo: b.motivo, por: b.por_nome, criadoEm: b.criado_em })));
  });
  r.delete('/servidores/:id/banidos/:uid', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const alvo = idDe(req.params.uid);
    if (!db.desbanir(s.id, alvo)) throw erro(404, 'Essa pessoa não está banida.');
    db.registrarAuditoria(s.id, uid, 'desbanir', db.usuarioPorId(alvo)?.nome);
    res.json({ ok: true });
  });
  r.get('/servidores/:id/auditoria', exigirLogin, (req, res) => {
    const s = servidorComoStaff(req.usuario.id, idDe(req.params.id));
    const antes = typeof req.query.antes === 'string' && /^\d{1,15}$/.test(req.query.antes) ? Number(req.query.antes) : null;
    res.json(db.listarAuditoria(s.id, antes).map((a) => ({ id: a.id, acao: a.acao, alvo: a.alvo, detalhe: a.detalhe, criadoEm: a.criado_em, ator: a.ator_nome })));
  });
  r.post('/servidores/:id/convite/novo', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const convite = db.trocarConvite(s.id);
    db.registrarAuditoria(s.id, uid, 'convite', null, 'gerou um link de convite novo (o antigo parou de funcionar)');
    res.json({ convite });
  });

  // Trocar senha: confere a atual e derruba as outras sessões.
  const limiteSenha = criarLimitador({ janela: 15 * 60 * 1000, max: 5 });
  r.post('/eu/senha', exigirLogin, async (req, res) => {
    const c = corpoDe(req), uid = req.usuario.id;
    if (typeof c.atual !== 'string' || typeof c.nova !== 'string') throw erro(400, 'Preenche a senha atual e a nova.');
    if (c.nova.length < 6 || c.nova.length > 200) throw erro(400, 'A senha nova precisa ter pelo menos 6 caracteres.');
    if (!limiteSenha.tentar(String(uid))) throw erro(429, 'Muitas tentativas. Espera uns minutos.');
    const u = db.usuarioPorId(uid);
    if (!(await conferirSenha(c.atual, u.senha_hash, u.senha_salt))) throw erro(400, 'A senha atual está errada.');
    const { hash, salt } = await gerarHash(c.nova);
    db.trocarSenha(uid, hash, salt);
    const n = db.apagarOutrasSessoes(uid, tokenDaRequisicao(req));
    limiteSenha.limpar(String(uid));
    res.json({ ok: true, sessoesEncerradas: n });
  });

  r.post('/canais/:id/lido', exigirLogin, (req, res) => {
    const canal = db.acessarCanal(req.usuario.id, idDe(req.params.id));
    db.marcarLido(req.usuario.id, canal.id);
    res.json({ ok: true });
  });

  r.get('/canais/:id/resumo', exigirLogin, (req, res) => {
    const eu = req.usuario;
    const canal = db.acessarCanal(eu.id, idDe(req.params.id));
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não tem mensagens.');
    let rows = db.mensagensNaoLidas(canal.id, db.ultimoLido(eu.id, canal.id), eu.id, 500);
    let recentes = false;
    if (!rows.length) {
      rows = db.listarMensagens(canal.id, null, 30);
      recentes = true;
    }
    res.json(gerarResumo(db.serMensagens(rows), { id: eu.id, usuario: eu.usuario }, { recentes }));
  });

  // Mensagem de voz: corpo binário audio/webm (máx. 2 MB).
  const exigirCanalDeAudio = (req, res, next) => {
    const canal = db.acessarCanal(req.usuario.id, idDe(req.params.id));
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não aceita mensagens.');
    db.exigirSemCastigo(canal, req.usuario.id);
    exigirModoLento(canal, req.usuario.id);
    if (!req.is('audio/webm')) throw erro(415, 'Envie o áudio no formato audio/webm.');
    req.canal = canal;
    next();
  };
  r.post('/canais/:id/audio', exigirLogin, exigirCanalDeAudio, express.raw({ type: 'audio/webm', limit: '2mb' }), (req, res) => {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 4) throw erro(400, 'Áudio vazio.');
    if (buf[0] !== 0x1a || buf[1] !== 0x45 || buf[2] !== 0xdf || buf[3] !== 0xa3) throw erro(415, 'O arquivo não é um áudio WebM válido.');
    const duracaoBruta = req.query.duracao;
    const duracao = typeof duracaoBruta === 'string' ? Number(duracaoBruta) : NaN;
    if (!Number.isFinite(duracao) || duracao <= 0 || duracao > 61) throw erro(400, 'Duração inválida (máximo 60 segundos).');
    let transcricao = null;
    if (req.query.transcricao !== undefined) {
      if (typeof req.query.transcricao !== 'string') throw erro(400, 'Transcrição inválida.');
      transcricao = req.query.transcricao.trim().slice(0, 2000) || null;
      if (transcricao && pareceGolpe(transcricao)) throw erro(400, '🛡️ Bloqueado: esse link parece golpe (nitro/skin grátis, site falso).');
    }
    const uid = req.usuario.id;
    checarLimiteMensagens(uid);
    // Reserva o id primeiro (sem emitir), grava o arquivo e só então publica.
    const msg = publicarMensagemDeAudio(req.canal, uid, buf, Math.round(duracao * 10) / 10, transcricao);
    res.status(201).json(msg);
  });

  // Anexo (foto, GIF ou arquivo): corpo binário cru, máx. 8 MB; ?nome=&legenda=&respostaA=
  const IMAGENS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  r.post('/canais/:id/anexo', exigirLogin, express.raw({ type: () => true, limit: '8mb' }), (req, res) => {
    const canal = db.acessarCanal(req.usuario.id, idDe(req.params.id));
    if (!podeTerMensagens(canal)) throw erro(400, 'Esse canal não aceita mensagens.');
    db.exigirSemCastigo(canal, req.usuario.id);
    exigirModoLento(canal, req.usuario.id);
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) throw erro(400, 'Arquivo vazio.');
    const nome = typeof req.query.nome === 'string' ? req.query.nome.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120) : '';
    if (!nome) throw erro(400, 'Nome do arquivo inválido.');
    const tipoInformado = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const tipo = IMAGENS.includes(tipoInformado) ? tipoInformado : 'application/octet-stream';
    const legenda = typeof req.query.legenda === 'string' ? req.query.legenda.trim().slice(0, 2000) : '';
    if (legenda && pareceGolpe(legenda)) throw erro(400, '🛡️ Bloqueado: esse link parece golpe.');
    const respostaA = req.query.respostaA ? respostaValida(Number(req.query.respostaA), canal.id) : null;
    const uid = req.usuario.id;
    checarLimiteMensagens(uid);
    const id = db.inserirMensagem({ canalId: canal.id, autorId: uid, texto: legenda, respostaA, anexo: { nome, tipo, tamanho: buf.length } });
    fs.writeFileSync(caminhoAnexo(id), buf);
    res.status(201).json(anunciarMensagem(canal, id));
  });

  r.get('/anexos/:id', exigirLogin, (req, res) => {
    const row = db.mensagemPorId(idDe(req.params.id));
    if (!row || row.anexo_nome == null) throw erro(404, 'Arquivo não encontrado.');
    db.acessarCanal(req.usuario.id, row.canal_id);
    const arquivo = caminhoAnexo(row.id);
    if (!fs.existsSync(arquivo)) throw erro(404, 'Arquivo não encontrado.');
    res.set('Cache-Control', 'private, max-age=86400');
    if (IMAGENS.includes(row.anexo_tipo)) { res.set('Content-Disposition', 'inline'); res.type(row.anexo_tipo); }
    else { res.attachment(row.anexo_nome); res.type('application/octet-stream'); }
    res.sendFile(arquivo);
  });

  r.get('/canais/:id/fixadas', exigirLogin, (req, res) => {
    const canal = db.acessarCanal(req.usuario.id, idDe(req.params.id));
    res.json(db.serMensagens(db.fixadasDoCanal(canal.id)));
  });

  r.get('/audios/:id', exigirLogin, (req, res) => {
    const row = db.mensagemPorId(idDe(req.params.id));
    if (!row || row.audio_duracao == null) throw erro(404, 'Áudio não encontrado.');
    db.acessarCanal(req.usuario.id, row.canal_id);
    if (row.expira_em != null && row.expira_em <= Date.now()) throw erro(404, 'Áudio não encontrado.');
    const arquivo = caminhoAudio(row.id);
    if (!fs.existsSync(arquivo)) throw erro(404, 'Áudio não encontrado.');
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('Content-Disposition', 'inline');
    res.type('audio/webm');
    res.sendFile(arquivo);
  });

  // ------------------------------------------------------------ DMs
  r.get('/dms', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const lista = db.dmsDoUsuario(uid).map((d) => dmPublica(d.canal_id, uid)).filter(Boolean);
    lista.sort((a, b) => (b.ultima?.criadoEm ?? 0) - (a.ultima?.criadoEm ?? 0) || b.canalId - a.canalId);
    res.json(lista);
  });

  r.post('/dms', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const c = corpoDe(req);
    if (typeof c.usuario !== 'string') throw erro(400, 'Informe o nome de usuário.');
    const alvo = db.usuarioPorNome(c.usuario.trim().toLowerCase().replace(/^@/, ''));
    if (!alvo) throw erro(404, 'Usuário não encontrado.');
    if (alvo.id === uid) throw erro(400, 'Você não pode abrir uma conversa com você mesmo.');
    if (db.bloqueioEntre(uid, alvo.id)) throw erro(403, '🚫 Não dá pra conversar com essa pessoa (bloqueio).');
    const { id, nova } = db.criarDm(uid, alvo.id);
    entrarSala(uid, `c:${id}`);
    entrarSala(alvo.id, `c:${id}`);
    if (nova) emitir(`u:${alvo.id}`, 'dm:nova', dmPublica(id, alvo.id));
    res.status(nova ? 201 : 200).json(dmPublica(id, uid));
  });

  r.post('/dms/grupo', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const c = corpoDe(req);
    if (!Array.isArray(c.usuarios)) throw erro(400, 'Escolha quem vai no grupo.');
    const ids = new Set([uid]);
    for (const n of c.usuarios.slice(0, 20)) {
      const u = typeof n === 'string' ? db.usuarioPorNome(n.trim().toLowerCase().replace(/^@/, '')) : null;
      if (!u) throw erro(404, `Usuário "${n}" não encontrado.`);
      if (u.id !== uid && db.bloqueioEntre(uid, u.id)) throw erro(403, `🚫 Não dá pra pôr ${u.nome} no grupo (bloqueio).`);
      ids.add(u.id);
    }
    if (ids.size < 3) throw erro(400, 'Um grupo precisa de pelo menos 2 pessoas além de você.');
    if (ids.size > 10) throw erro(400, 'Máximo de 10 pessoas no grupo.');
    const nome = (typeof c.nome === 'string' && c.nome.trim()) ? c.nome.trim().slice(0, 40) : 'Grupo';
    if (nome === 'dm') throw erro(400, 'Nome inválido.');
    const id = db.criarGrupoDm([...ids], nome);
    for (const p of ids) {
      entrarSala(p, `c:${id}`);
      if (p !== uid) emitir(`u:${p}`, 'dm:nova', dmPublica(id, p));
    }
    res.status(201).json(dmPublica(id, uid));
  });

  r.delete('/dms/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const canal = db.acessarCanal(uid, idDe(req.params.id));
    if (canal.tipo !== 'dm' || canal.nome === 'dm') throw erro(400, 'Só dá pra sair de grupos.');
    db.sairDoGrupoDm(canal.id, uid);
    sairSala(uid, `c:${canal.id}`); // não recebe mais nada do grupo
    const participantes = db.participantesDm(canal.id);
    const dados = { canalId: canal.id, participantes, saiu: uid };
    emitir(`c:${canal.id}`, 'dm:atualizada', dados);
    emitir(`u:${uid}`, 'dm:atualizada', dados); // outras abas de quem saiu tiram o grupo da lista
    if (participantes.length) {
      publicarMensagem(canal, { autorId: null, texto: `👋 ${req.usuario.nome} saiu do grupo.`, sistema: true });
    }
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ foto, banner, ícone (até 4 MB)
  const corpoImagem = express.raw({ type: () => true, limit: '4mb' });
  function salvarImagem(req, dono, id, tipo) {
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !tipoDaImagem(buf)) throw erro(415, 'Envie uma imagem PNG, JPG, GIF ou WEBP.');
    fs.writeFileSync(path.join(db.PASTA_IMAGENS, `${dono}${id}-${tipo}`), buf);
    db.marcarImagem(dono, id, tipo, Date.now());
  }
  r.put('/eu/imagem/:tipo', exigirLogin, corpoImagem, (req, res) => {
    const tipo = req.params.tipo;
    if (tipo !== 'avatar') throw erro(404, 'Banner agora só pela loja.');
    salvarImagem(req, 'u', req.usuario.id, tipo);
    aoAtualizarPerfil(req.usuario.id);
    res.json(usuarioPublico(db.usuarioPorId(req.usuario.id), { proprio: true }));
  });
  r.delete('/eu/imagem/:tipo', exigirLogin, (req, res) => {
    const tipo = req.params.tipo;
    if (tipo !== 'avatar' && tipo !== 'banner') throw erro(404, 'Não encontrado.');
    db.marcarImagem('u', req.usuario.id, tipo, null);
    aoAtualizarPerfil(req.usuario.id);
    res.json({ ok: true });
  });
  r.put('/servidores/:id/imagem/:tipo', exigirLogin, corpoImagem, (req, res) => {
    const tipo = req.params.tipo;
    if (tipo !== 'icone' && tipo !== 'banner') throw erro(404, 'Não encontrado.');
    const s = servidorComoDono(req.usuario.id, idDe(req.params.id));
    salvarImagem(req, 's', s.id, tipo);
    const atualizado = servidorCompleto(db.servidorPorId(s.id), req.usuario.id);
    emitir(`s:${s.id}`, 'cargos:atualizado', { servidorId: s.id });
    res.json(atualizado);
  });
  r.get('/imagens/:arquivo', exigirLogin, (req, res) => {
    if (!/^([us][1-9]\d{0,14}-(avatar|banner|icone)|i[1-9]\d{0,14}-item|e[1-9]\d{0,14}-emoji)$/.test(req.params.arquivo)) throw erro(404, 'Não encontrado.');
    const arquivo = path.join(db.PASTA_IMAGENS, req.params.arquivo);
    if (!fs.existsSync(arquivo)) throw erro(404, 'Não encontrado.');
    const fd = fs.openSync(arquivo, 'r'); const cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0); fs.closeSync(fd);
    res.set('Cache-Control', 'private, max-age=31536000, immutable');
    res.type(tipoDaImagem(cab) || 'application/octet-stream');
    res.sendFile(arquivo);
  });

  // ------------------------------------------------------------ loja de cosméticos
  const itemPublico = (i) => ({ id: i.id, tipo: i.tipo, nome: i.nome, preco: i.preco,
    imagem: i.tipo === 'cor' ? null : `/api/imagens/i${i.id}-item?v=${i.valor}`, cor: i.tipo === 'cor' ? i.valor : null });
  const exigirDonoDoApp = (req) => { if (!ehDonoDoApp(req.usuario)) throw erro(403, 'Só o dono do KALI mexe na loja.'); };
  r.get('/loja', exigirLogin, (req, res) => {
    const u = db.usuarioPorId(req.usuario.id);
    res.json({ itens: db.itensDaLoja().map(itemPublico), meus: db.meusItens(u.id),
      equipados: { banner: u.equip_banner ?? null, moldura: u.equip_moldura ?? null, cor: u.equip_cor ?? null } });
  });
  r.post('/loja/equipar', exigirLogin, (req, res) => {
    const c = corpoDe(req);
    if (!['banner', 'moldura', 'cor'].includes(c.tipo)) throw erro(400, 'Tipo inválido.');
    if (c.itemId != null) {
      const item = db.itemPorId(Number(c.itemId));
      if (!item || item.tipo !== c.tipo || !db.temItem(req.usuario.id, item.id)) throw erro(403, 'Você não tem esse item.');
    }
    db.equipar(req.usuario.id, c.tipo, c.itemId ?? null);
    aoAtualizarPerfil(req.usuario.id);
    res.json({ ok: true });
  });
  // Criar item: corpo cru = imagem (banner/moldura); ?tipo=&nome=&preco=(centavos)&cor=#hex ou #hex,#hex
  r.post('/loja/itens', exigirLogin, corpoImagem, (req, res) => {
    exigirDonoDoApp(req);
    const tipo = String(req.query.tipo || '');
    const nome = typeof req.query.nome === 'string' ? req.query.nome.trim().slice(0, 40) : '';
    const preco = Number(req.query.preco);
    if (!['banner', 'moldura', 'cor'].includes(tipo)) throw erro(400, 'Tipo inválido.');
    if (!nome) throw erro(400, 'Dê um nome pro item.');
    if (!Number.isInteger(preco) || preco < 0 || preco > 100000000) throw erro(400, 'Preço inválido.');
    let id;
    if (tipo === 'cor') {
      const cor = String(req.query.cor || '').toLowerCase();
      if (!/^#[0-9a-f]{6}(,#[0-9a-f]{6})?$/.test(cor)) throw erro(400, 'Cor inválida.');
      id = db.criarItem(tipo, nome, preco, cor);
    } else {
      if (!Buffer.isBuffer(req.body) || !tipoDaImagem(req.body)) throw erro(415, 'Envie uma imagem PNG, JPG, GIF ou WEBP.');
      const v = String(Date.now());
      id = db.criarItem(tipo, nome, preco, v);
      fs.writeFileSync(path.join(db.PASTA_IMAGENS, `i${id}-item`), req.body);
    }
    res.status(201).json(itemPublico(db.itemPorId(id)));
  });
  r.delete('/loja/itens/:id', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    if (!db.desativarItem(idDe(req.params.id))) throw erro(404, 'Item não encontrado.');
    res.json({ ok: true });
  });
  // Painel do dono (página /painel): resumo, usuários e itens de cada um.
  r.get('/admin/resumo', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    res.json({ ...db.contagens(), online: quantosOnline() });
  });
  r.get('/admin/usuarios', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    const t = typeof req.query.busca === 'string' ? req.query.busca.trim().toLowerCase().slice(0, 30) : '';
    res.json(db.buscarUsuarios(t).map((u) => ({ id: u.id, usuario: u.usuario, nome: u.nome, criadoEm: u.criado_em, itens: u.itens })));
  });
  r.get('/admin/usuarios/:id/itens', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    res.json(db.itensDoUsuario(idDe(req.params.id)));
  });
  r.delete('/admin/usuarios/:id/itens/:item', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    const uid = idDe(req.params.id), item = idDe(req.params.item);
    if (!db.tirarItem(uid, item)) throw erro(404, 'Essa pessoa não tem esse item.');
    const u = db.usuarioPorId(uid);
    for (const t of ['banner', 'moldura', 'cor']) if (u[`equip_${t}`] === item) db.equipar(uid, t, null);
    aoAtualizarPerfil(uid);
    res.json({ ok: true });
  });
  r.post('/loja/presentear', exigirLogin, (req, res) => {
    exigirDonoDoApp(req);
    const c = corpoDe(req);
    const alvo = typeof c.usuario === 'string' ? db.usuarioPorNome(c.usuario.trim().toLowerCase().replace(/^@/, '')) : null;
    if (!alvo) throw erro(404, 'Usuário não encontrado.');
    const item = db.itemPorId(Number(c.itemId));
    if (!item || !item.ativo) throw erro(404, 'Item não encontrado.');
    if (!db.darItem(alvo.id, item.id)) throw erro(400, `${alvo.nome} já tem esse item.`);
    emitir(`u:${alvo.id}`, 'loja:ganhou', { nome: item.nome });
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ prévia de link (com proteção contra rede interna)
  const usoPrevia = new Map(); // uid → timestamps do último minuto
  const limitarPrevia = (uid) => {
    const agora = Date.now(), l = (usoPrevia.get(uid) || []).filter((t) => agora - t < 60e3);
    if (l.length >= 60) throw erro(429, 'Calma: prévias demais.');
    l.push(agora); usoPrevia.set(uid, l);
  };
  r.get('/previa', exigirLogin, async (req, res) => {
    limitarPrevia(req.usuario.id);
    const url = typeof req.query.url === 'string' ? req.query.url.slice(0, 1000) : '';
    if (!/^https?:\/\//i.test(url)) throw erro(400, 'Link inválido.');
    const d = await previaDe(url);
    res.set('Cache-Control', 'private, max-age=3600');
    res.json(d ? { ...d, imagem: d.imagem ? '/api/previa/imagem?url=' + encodeURIComponent(d.imagem) : null } : { vazio: true });
  });
  r.get('/previa/imagem', exigirLogin, async (req, res) => {
    limitarPrevia(req.usuario.id);
    const url = typeof req.query.url === 'string' ? req.query.url.slice(0, 1500) : '';
    let r2;
    try { r2 = await buscarSeguro(url, { max: 2_500_000 }); } catch { throw erro(404, 'Imagem indisponível.'); }
    const tipo = tipoDaImagem(r2.corpo);
    if (!tipo) throw erro(415, 'Não é imagem.');
    res.set('Cache-Control', 'private, max-age=86400');
    res.type(tipo).send(r2.corpo);
  });

  // ------------------------------------------------------------ tópicos (thread a partir de uma mensagem)
  r.post('/mensagens/:id/topico', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const msg = db.mensagemPorId(idDe(req.params.id));
    if (!msg || msg.sistema) throw erro(404, 'Mensagem não encontrada.');
    const pai = db.acessarCanal(uid, msg.canal_id);
    if (pai.servidor_id == null || pai.tipo !== 'texto' || pai.pai_canal) throw erro(400, 'Tópico só em canal de texto de servidor.');
    db.exigirSemCastigo(pai, uid);
    if (db.topicoDaMensagem(msg.id)) throw erro(400, 'Essa mensagem já tem um tópico.');
    const nome = typeof corpoDe(req).nome === 'string' ? corpoDe(req).nome.trim().slice(0, 40) : '';
    if (!nome) throw erro(400, 'Dê um nome pro tópico.');
    if (db.contarCanais(pai.servidor_id) >= 100) throw erro(400, 'Esse servidor já tem canais demais.');
    const id = db.criarTopico(pai.servidor_id, pai.id, msg.id, nome);
    const row = db.canalPorId(id);
    const canal = db.serCanal(row);
    emitir(salaDoCanal(row), 'canal:novo', canal);
    emitir(salaDoCanal(pai), 'msg:editada', db.mensagemCompleta(msg.id)); // mensagem ganha o selo do tópico
    res.status(201).json(canal);
  });

  // ------------------------------------------------------------ emojis próprios (usáveis em qualquer lugar por quem é membro)
  const emojiPublico = (e) => ({ id: e.id, nome: e.nome, servidorId: e.servidor_id, url: `/api/imagens/e${e.id}-emoji?v=${e.versao}` });
  r.get('/eu/emojis', exigirLogin, (req, res) => res.json(db.emojisDoUsuario(req.usuario.id).map(emojiPublico)));
  r.post('/servidores/:id/emojis', exigirLogin, express.raw({ type: () => true, limit: '512kb' }), (req, res) => {
    const s = servidorComoStaff(req.usuario.id, idDe(req.params.id));
    const nome = String(req.query.nome || '').toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(nome)) throw erro(400, 'Nome do emoji: 2 a 32 letras minúsculas, números ou "_".');
    if (!Buffer.isBuffer(req.body) || !tipoDaImagem(req.body)) throw erro(415, 'Envie uma imagem PNG, JPG, GIF ou WEBP (até 512 KB).');
    if (db.emojisDoServidor(s.id).length >= 50) throw erro(400, 'Máximo de 50 emojis por servidor.');
    if (db.emojisDoServidor(s.id).some((e) => e.nome === nome)) throw erro(400, 'Já existe um emoji com esse nome.');
    const id = db.criarEmoji(s.id, nome);
    fs.writeFileSync(path.join(db.PASTA_IMAGENS, `e${id}-emoji`), req.body);
    emitir(`s:${s.id}`, 'emojis:atualizado', {});
    res.status(201).json(emojiPublico(db.emojiPorId(id)));
  });
  r.delete('/emojis/:id', exigirLogin, (req, res) => {
    const e = db.emojiPorId(idDe(req.params.id));
    if (!e) throw erro(404, 'Emoji não encontrado.');
    servidorComoStaff(req.usuario.id, e.servidor_id);
    db.apagarEmoji(e.id);
    fs.rm(path.join(db.PASTA_IMAGENS, `e${e.id}-emoji`), { force: true }, () => {});
    emitir(`s:${e.servidor_id}`, 'emojis:atualizado', {});
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ eventos do servidor
  const eventoPublico = (e, uid) => ({ id: e.id, titulo: e.titulo, descricao: e.descricao, inicio: e.inicio, criadoPor: e.criado_por,
    interessados: db.interessadosEvento(e.id).length, euVou: db.interessadosEvento(e.id).includes(uid) });
  r.get('/servidores/:id/eventos', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    res.json(db.eventosDoServidor(s.id).map((e) => eventoPublico(e, req.usuario.id)));
  });
  r.post('/servidores/:id/eventos', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const c = corpoDe(req);
    const titulo = typeof c.titulo === 'string' ? c.titulo.trim().slice(0, 80) : '';
    const descricao = typeof c.descricao === 'string' ? c.descricao.trim().slice(0, 500) : '';
    if (!titulo) throw erro(400, 'Dê um nome pro evento.');
    if (!Number.isSafeInteger(c.inicio) || c.inicio < Date.now() - 60e3 || c.inicio > Date.now() + 365 * 86400e3) throw erro(400, 'Data do evento inválida.');
    if (db.eventosDoServidor(s.id).length >= 30) throw erro(400, 'Eventos demais marcados.');
    const id = db.criarEvento(s.id, titulo, descricao, c.inicio, uid);
    const avisos = db.canalDeAvisos(s.id);
    const quando = new Date(c.inicio).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    if (avisos) publicarMensagem(avisos, { autorId: null, texto: `📅 Novo evento: **${titulo}** — ${quando}. Abre "Eventos" no topo dos canais pra marcar presença!`, sistema: true });
    emitir(`s:${s.id}`, 'eventos:atualizado', { servidorId: s.id });
    res.status(201).json(eventoPublico(db.eventoPorId(id), uid));
  });
  r.post('/eventos/:id/interesse', exigirLogin, (req, res) => {
    const e = db.eventoPorId(idDe(req.params.id));
    if (!e) throw erro(404, 'Evento não encontrado.');
    servidorComoMembro(req.usuario.id, e.servidor_id);
    db.alternarInteresse(e.id, req.usuario.id);
    emitir(`s:${e.servidor_id}`, 'eventos:atualizado', { servidorId: e.servidor_id });
    res.json(eventoPublico(e, req.usuario.id));
  });
  r.delete('/eventos/:id', exigirLogin, (req, res) => {
    const e = db.eventoPorId(idDe(req.params.id));
    if (!e) throw erro(404, 'Evento não encontrado.');
    servidorComoStaff(req.usuario.id, e.servidor_id);
    db.apagarEvento(e.id);
    emitir(`s:${e.servidor_id}`, 'eventos:atualizado', { servidorId: e.servidor_id });
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ canal: categoria e modo lento (staff)
  const MODO_LENTO = [0, 5, 10, 30, 60, 300, 900];
  r.patch('/canais/:id/config', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const canal = db.canalPorId(idDe(req.params.id));
    if (!canal || canal.servidor_id == null) throw erro(404, 'Canal não encontrado.');
    servidorComoStaff(uid, canal.servidor_id);
    const c = corpoDe(req);
    const categoria = c.categoria === undefined ? canal.categoria : (typeof c.categoria === 'string' && c.categoria.trim() ? c.categoria.trim().slice(0, 30) : null);
    const modoLento = c.modoLento === undefined ? canal.modo_lento : c.modoLento;
    if (!MODO_LENTO.includes(modoLento)) throw erro(400, 'Tempo de modo lento inválido.');
    db.configurarCanal(canal.id, categoria, modoLento);
    emitir(`s:${canal.servidor_id}`, 'cargos:atualizado', { servidorId: canal.servidor_id });
    res.json(db.serCanal(db.canalPorId(canal.id)));
  });

  // ------------------------------------------------------------ apelido por servidor (o próprio, ou staff em quem tem cargo menor)
  r.put('/servidores/:id/apelido', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    const c = corpoDe(req);
    const alvo = c.usuarioId == null ? uid : Number(c.usuarioId);
    if (alvo !== uid) { servidorComoStaff(uid, s.id); alvoModeravel(uid, s.id, alvo); }
    if (!db.ehMembro(s.id, alvo)) throw erro(404, 'Membro não encontrado.');
    const apelido = typeof c.apelido === 'string' ? c.apelido.trim().slice(0, 32) : '';
    db.definirApelido(s.id, alvo, apelido || null);
    emitir(`s:${s.id}`, 'cargos:atualizado', { servidorId: s.id });
    res.json({ ok: true, apelido: apelido || null });
  });

  // ------------------------------------------------------------ castigo (timeout): 0 tira
  r.post('/servidores/:id/membros/:uid/castigo', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoStaff(uid, idDe(req.params.id));
    const alvo = idDe(req.params.uid);
    if (!db.ehMembro(s.id, alvo)) throw erro(404, 'Membro não encontrado.');
    alvoModeravel(uid, s.id, alvo);
    const min = corpoDe(req).minutos;
    if (![0, 1, 5, 10, 60, 1440, 10080].includes(min)) throw erro(400, 'Tempo de castigo inválido.');
    const ate = min ? Date.now() + min * 60e3 : null;
    db.castigar(s.id, alvo, ate);
    db.registrarAuditoria(s.id, uid, 'castigo', db.usuarioPorId(alvo)?.nome, ate ? 'até ' + new Date(ate).toLocaleString('pt-BR') : 'tirou o castigo');
    emitir(`u:${alvo}`, 'castigo', { servidor: s.nome, ate });
    res.json({ ok: true, ate });
  });

  // ------------------------------------------------------------ cargos personalizados
  const cargoComoStaff = (uid, id) => {
    const cargo = db.cargoPorId(idDe(id));
    if (!cargo) throw erro(404, 'Cargo não encontrado.');
    servidorComoMembro(uid, cargo.servidor_id);
    if (!db.ehStaff(cargo.servidor_id, uid)) throw erro(403, 'Só a staff mexe nos cargos.');
    return cargo;
  };
  const avisarCargos = (sid) => emitir(`s:${sid}`, 'cargos:atualizado', { servidorId: sid });
  const listaDeIds = (v) => {
    if (!Array.isArray(v) || v.length > 500 || !v.every((x) => Number.isSafeInteger(x) && x > 0)) throw erro(400, 'Lista inválida.');
    return [...new Set(v)];
  };
  r.get('/servidores/:id/cargos', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    res.json(db.cargosDoServidor(s.id));
  });
  r.post('/servidores/:id/cargos', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    if (!db.ehStaff(s.id, uid)) throw erro(403, 'Só a staff cria cargos.');
    const c = corpoDe(req);
    const nome = typeof c.nome === 'string' ? c.nome.trim() : '';
    if (nome.length < 1 || nome.length > 30) throw erro(400, 'O nome do cargo precisa ter de 1 a 30 caracteres.');
    if (typeof c.cor !== 'string' || !RE_COR.test(c.cor)) throw erro(400, 'Cor inválida.');
    if (db.cargosDoServidor(s.id).length >= 25) throw erro(400, 'Máximo de 25 cargos por servidor.');
    const id = db.criarCargo(s.id, nome, c.cor.toLowerCase());
    avisarCargos(s.id);
    res.status(201).json({ id });
  });
  r.delete('/cargos/:id', exigirLogin, (req, res) => {
    const cargo = cargoComoStaff(req.usuario.id, req.params.id);
    db.apagarCargo(cargo.id);
    avisarCargos(cargo.servidor_id);
    res.json({ ok: true });
  });
  r.put('/cargos/:id/membros', exigirLogin, (req, res) => {
    const cargo = cargoComoStaff(req.usuario.id, req.params.id);
    const ids = listaDeIds(corpoDe(req).usuarioIds);
    if (ids.some((u) => !db.ehMembro(cargo.servidor_id, u))) throw erro(400, 'Alguém da lista não é membro do servidor.');
    db.definirMembrosDoCargo(cargo.id, ids);
    avisarCargos(cargo.servidor_id);
    res.json({ ok: true });
  });
  r.put('/cargos/:id/canais', exigirLogin, (req, res) => {
    const cargo = cargoComoStaff(req.usuario.id, req.params.id);
    const ids = listaDeIds(corpoDe(req).canalIds);
    if (ids.some((c) => db.canalPorId(c)?.servidor_id !== cargo.servidor_id)) throw erro(400, 'Canal inválido.');
    db.definirCanaisDoCargo(cargo.id, ids);
    avisarCargos(cargo.servidor_id);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ amigos
  const avisarAmigos = (...ids) => ids.forEach((id) => emitir(`u:${id}`, 'amigos:atualizado', {}));
  r.get('/amigos', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const out = { amigos: [], recebidos: [], enviados: [] };
    for (const row of db.amizadesDoUsuario(uid)) {
      const u = usuarioPublico(row);
      if (row.amizade === 'aceita') out.amigos.push(u);
      else (row.para === uid ? out.recebidos : out.enviados).push(u);
    }
    res.json(out);
  });

  r.post('/amigos', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const c = corpoDe(req);
    if (typeof c.usuario !== 'string') throw erro(400, 'Informe o nome de usuário.');
    const alvo = db.usuarioPorNome(c.usuario.trim().toLowerCase().replace(/^@/, ''));
    if (!alvo) throw erro(404, 'Usuário não encontrado.');
    if (alvo.id === uid) throw erro(400, 'Você não pode se adicionar.');
    if (db.bloqueioEntre(uid, alvo.id)) throw erro(403, '🚫 Não dá pra adicionar essa pessoa (bloqueio).');
    const a = db.amizadeEntre(uid, alvo.id);
    if (a?.status === 'aceita') throw erro(400, 'Vocês já são amigos.');
    if (a && a.de === uid) throw erro(400, 'Pedido já enviado. Agora é com a outra pessoa.');
    if (a) db.aceitarAmizade(alvo.id, uid); // a pessoa já tinha me pedido: vira amizade
    else db.pedirAmizade(uid, alvo.id);
    emitir(`u:${alvo.id}`, 'amigos:atualizado', a ? { aceitoPor: req.usuario.nome } : { pedidoDe: req.usuario.nome });
    avisarAmigos(uid);
    res.status(201).json({ amigos: !!a });
  });

  r.post('/amigos/:id/aceitar', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const outro = idDe(req.params.id);
    if (!db.aceitarAmizade(outro, uid)) throw erro(404, 'Pedido não encontrado.');
    emitir(`u:${outro}`, 'amigos:atualizado', { aceitoPor: req.usuario.nome });
    avisarAmigos(uid);
    res.json({ ok: true });
  });

  r.delete('/amigos/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const outro = idDe(req.params.id);
    if (!db.removerAmizade(uid, outro)) throw erro(404, 'Amizade não encontrada.');
    avisarAmigos(uid, outro);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ bloqueios (valem em qualquer aparelho)
  r.get('/bloqueios', exigirLogin, (req, res) => {
    res.json(db.bloqueadosPor(req.usuario.id).map((u) => usuarioPublico(u)));
  });
  r.post('/bloqueios', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const c = corpoDe(req);
    if (!Number.isSafeInteger(c.usuarioId) || c.usuarioId <= 0) throw erro(400, 'Usuário inválido.');
    if (c.usuarioId === uid) throw erro(400, 'Você não pode se bloquear.');
    const alvo = db.usuarioPorId(c.usuarioId);
    if (!alvo) throw erro(404, 'Usuário não encontrado.');
    db.bloquear(uid, alvo.id); // também desfaz amizade e recusa pedidos pendentes
    avisarAmigos(uid, alvo.id);
    res.status(201).json(usuarioPublico(alvo));
  });
  r.delete('/bloqueios/:id', exigirLogin, (req, res) => {
    if (!db.desbloquear(req.usuario.id, idDe(req.params.id))) throw erro(404, 'Esse usuário não está bloqueado.');
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ missões e ranking
  r.get('/servidores/:id/missoes', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const s = servidorComoMembro(uid, idDe(req.params.id));
    const { xp } = db.obterXp(uid, s.id);
    const nivel = nivelDe(xp);
    const progresso = new Map(db.progressoDaSemana(uid, s.id, semanaAtual()).map((p) => [p.chave, p.valor]));
    const selos = db.selosDe(uid, s.id).map((x) => {
      const m = MISSOES.find((mm) => mm.chave === x.chave);
      return m ? { chave: x.chave, titulo: m.selo.titulo, emoji: m.selo.emoji, ganhoEm: x.ganho_em } : null;
    }).filter(Boolean);
    res.json({
      xp,
      nivel,
      nivelXp: xpParaNivel(nivel),
      proximoNivelXp: xpParaNivel(nivel + 1),
      semana: semanaAtual(),
      bonus: BONUS_MISSAO,
      missoes: MISSOES.map((m) => {
        const valor = progresso.get(m.chave) || 0;
        return { chave: m.chave, titulo: m.titulo, meta: m.meta, valor: Math.min(valor, m.meta), completa: valor >= m.meta, selo: m.selo };
      }),
      selos,
    });
  });

  r.get('/servidores/:id/ranking', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    res.json(db.ranking(s.id).map((row) => ({ usuario: usuarioPublico(row), xp: row.xp_total, nivel: row.nivel })));
  });

  // ------------------------------------------------------------ procurando grupo (LFG)
  const LFG_TIPOS_VAGAS = { duo: 2, squad: 5 };
  r.post('/servidores/:id/lfg', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    const uid = req.usuario.id;
    const c = corpoDe(req);
    if (typeof c.jogo !== 'string' || c.jogo.trim().length < 1 || c.jogo.trim().length > 30) {
      throw erro(400, 'Informe o jogo.');
    }
    const jogo = c.jogo.trim();
    let rank = '';
    if (c.rank !== undefined && c.rank !== null) {
      if (typeof c.rank !== 'string' || c.rank.trim().length > 30) throw erro(400, 'Rank inválido.');
      rank = c.rank.trim();
    }
    const tipo = c.tipo === 'squad' ? 'squad' : 'duo';
    let vagas = LFG_TIPOS_VAGAS[tipo];
    if (c.vagas !== undefined) {
      if (!Number.isInteger(c.vagas) || c.vagas < 2 || c.vagas > 5) throw erro(400, 'Número de vagas inválido (2 a 5).');
      vagas = c.vagas;
    }
    let texto = '';
    if (c.texto !== undefined) {
      if (typeof c.texto !== 'string' || c.texto.trim().length > 300) throw erro(400, 'A mensagem pode ter no máximo 300 caracteres.');
      texto = c.texto.trim();
    }
    let canalVozId = null;
    if (c.canalVozId !== undefined && c.canalVozId !== null) {
      canalVozId = idDe(String(c.canalVozId));
      const canal = db.canalPorId(canalVozId);
      if (!canal || canal.servidor_id !== s.id || canal.tipo !== 'voz') throw erro(400, 'Canal de voz inválido.');
      db.acessarCanal(uid, canalVozId); // lança ErroKali 403 se não tiver acesso
    }
    let expiraEm = null;
    if (c.duracao !== undefined && c.duracao !== null) {
      if (!Number.isInteger(c.duracao) || c.duracao < 1 || c.duracao > 86400) throw erro(400, 'Duração inválida (1s a 24h).');
      expiraEm = Date.now() + c.duracao * 1000;
    }
    const id = db.criarLfg({ servidorId: s.id, canalVozId, autorId: uid, jogo, rank, tipo, vagas, texto, expiraEm });
    const row = db.lfgPorId(id);
    emitirLfg(row, 'lfg:nova');
    ganharXpLfg(uid, s.id, `lfg:criar:${uid}:${s.id}`, 10);
    res.status(201).json(lfgPublico(row));
  });

  r.get('/servidores/:id/lfg', exigirLogin, (req, res) => {
    const s = servidorComoMembro(req.usuario.id, idDe(req.params.id));
    const jogo = typeof req.query.jogo === 'string' && req.query.jogo ? req.query.jogo : null;
    const rank = typeof req.query.rank === 'string' && req.query.rank ? req.query.rank : null;
    res.json(db.lfgAbertasServidor(s.id, { jogo, rank }).map((row) => lfgPublico(row)));
  });

  r.post('/lfg/:id/entrar', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const id = idDe(req.params.id);
    const row = db.lfgPorId(id);
    if (!row) throw erro(404, 'Post não encontrado.');
    servidorComoMembro(uid, row.servidor_id);
    // Já é participante: entrar de novo é idempotente, independentemente do status.
    if (db.ehParticipanteLfg(id, uid)) return res.json(lfgPublico(db.lfgPorId(id)));
    if (row.status !== 'aberto') throw erro(400, 'Esse post já está fechado ou cancelado.');
    if (row.canal_voz_id) db.acessarCanal(uid, row.canal_voz_id);
    if (db.lfgParticipantes(id).length >= row.vagas) throw erro(400, 'Esse grupo já está completo.');
    const updated = db.entrarLfg(id, uid);
    emitirLfg(updated, 'lfg:atualizada');
    ganharXpLfg(uid, row.servidor_id, `lfg:entrar:${uid}:${id}`, 5);
    res.json(lfgPublico(updated));
  });

  r.post('/lfg/:id/sair', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const id = idDe(req.params.id);
    const row = db.lfgPorId(id);
    if (!row) throw erro(404, 'Post não encontrado.');
    servidorComoMembro(uid, row.servidor_id);
    const updated = db.sairLfg(id, uid);
    if (updated) emitirLfg(updated, 'lfg:atualizada');
    res.json(updated ? lfgPublico(updated) : { ok: true });
  });

  r.delete('/lfg/:id', exigirLogin, (req, res) => {
    const uid = req.usuario.id;
    const id = idDe(req.params.id);
    const row = db.lfgPorId(id);
    if (!row) throw erro(404, 'Post não encontrado.');
    servidorComoMembro(uid, row.servidor_id);
    if (row.autor_id !== uid && !db.ehStaff(row.servidor_id, uid)) {
      throw erro(403, 'Só o autor ou a staff pode cancelar este post.');
    }
    db.cancelarLfg(id);
    emitirLfg(db.lfgPorId(id), 'lfg:atualizada');
    res.json({ ok: true });
  });

  return r;
}

function publicarMensagemDeAudio(canal, uid, buf, duracao, transcricao) {
  // Anuncia (msg:nova) só depois que o arquivo existe no disco.
  const id = db.inserirMensagem({ canalId: canal.id, autorId: uid, texto: '', audioDuracao: duracao, transcricao });
  try {
    fs.writeFileSync(caminhoAudio(id), buf);
  } catch (e) {
    db.apagarMensagem(id);
    throw e;
  }
  return anunciarMensagem(canal, id);
}
