// Banco de dados da AURA: schema + funções de consulta (node:sqlite, só consultas parametrizadas).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class ErroAura extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}
export const erro = (status, mensagem) => new ErroAura(status, mensagem);

const RAIZ = path.resolve(import.meta.dirname, '..');
export const CAMINHO_DB = process.env.AURA_DB
  ? path.resolve(process.env.AURA_DB)
  : path.join(RAIZ, 'dados', 'aura.db');
fs.mkdirSync(path.dirname(CAMINHO_DB), { recursive: true });

export const PASTA_AUDIOS = process.env.AURA_AUDIOS
  ? path.resolve(process.env.AURA_AUDIOS)
  : path.join(path.dirname(CAMINHO_DB), 'audios');
fs.mkdirSync(PASTA_AUDIOS, { recursive: true });

const db = new DatabaseSync(CAMINHO_DB);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario      TEXT NOT NULL UNIQUE,
  nome         TEXT NOT NULL,
  senha_hash   TEXT NOT NULL,
  senha_salt   TEXT NOT NULL,
  cor          TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online','ausente','ocupado')),
  status_texto TEXT NOT NULL DEFAULT '',
  foco_ate     INTEGER,
  criado_em    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessoes (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em  INTEGER NOT NULL,
  expira_em  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
CREATE TABLE IF NOT EXISTS servidores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT NOT NULL,
  dono_id   INTEGER NOT NULL REFERENCES usuarios(id),
  convite   TEXT NOT NULL UNIQUE,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS membros (
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  entrou_em   INTEGER NOT NULL,
  PRIMARY KEY (servidor_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_membros_usuario ON membros(usuario_id);
CREATE TABLE IF NOT EXISTS canais (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER REFERENCES servidores(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('texto','voz','assistir','dm')),
  posicao     INTEGER NOT NULL DEFAULT 0,
  espacial    INTEGER NOT NULL DEFAULT 0,
  criado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canais_servidor ON canais(servidor_id);
CREATE TABLE IF NOT EXISTS dm_participantes (
  canal_id   INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (canal_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_usuario ON dm_participantes(usuario_id);
CREATE TABLE IF NOT EXISTS mensagens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  canal_id      INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  autor_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  texto         TEXT NOT NULL,
  criado_em     INTEGER NOT NULL,
  editado_em    INTEGER,
  sistema       INTEGER NOT NULL DEFAULT 0,
  ref_canal_id  INTEGER,
  audio_duracao REAL,
  transcricao   TEXT,
  expira_em     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mensagens_canal ON mensagens(canal_id, id);
CREATE INDEX IF NOT EXISTS idx_mensagens_expira ON mensagens(expira_em) WHERE expira_em IS NOT NULL;
CREATE TABLE IF NOT EXISTS reacoes (
  mensagem_id INTEGER NOT NULL REFERENCES mensagens(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  PRIMARY KEY (mensagem_id, usuario_id, emoji)
);
CREATE TABLE IF NOT EXISTS lidos (
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal_id      INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  ultima_msg_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, canal_id)
);
CREATE TABLE IF NOT EXISTS xp (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  xp          INTEGER NOT NULL DEFAULT 0,
  nivel       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, servidor_id)
);
CREATE TABLE IF NOT EXISTS progresso_missao (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  semana      TEXT NOT NULL,
  chave       TEXT NOT NULL,
  valor       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, servidor_id, semana, chave)
);
CREATE TABLE IF NOT EXISTS selos (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  chave       TEXT NOT NULL,
  ganho_em    INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, servidor_id, chave)
);
`);

// Staff e moderação: colunas novas em bancos antigos + tabelas próprias.
for (const [tabela, coluna, def] of [
  ['membros', 'cargo', "TEXT NOT NULL DEFAULT 'membro'"],
  ['canais', 'privado', 'INTEGER NOT NULL DEFAULT 0'],
  ['canais', 'senha_hash', 'TEXT'],
  ['canais', 'senha_salt', 'TEXT'],
  ['canais', 'ticket_de', 'INTEGER'],
  ['usuarios', 'bio', 'TEXT'],
  ['usuarios', 'banner', 'TEXT'],
  ['usuarios', 'links', 'TEXT'],
  ['usuarios', 'aniversario', 'TEXT'],
  ['usuarios', 'jogos', 'TEXT'],
  ['usuarios', 'aniv_ano', 'INTEGER'],
]) {
  if (!db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${def}`);
  }
}
db.exec(`
CREATE TABLE IF NOT EXISTS canal_acesso (
  canal_id   INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (canal_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS banidos (
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  por_id      INTEGER,
  motivo      TEXT,
  criado_em   INTEGER NOT NULL,
  PRIMARY KEY (servidor_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS denuncias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  autor_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alvo_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  mensagem_id INTEGER,
  canal_id    INTEGER,
  texto       TEXT,
  motivo      TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'aberta',
  criado_em   INTEGER NOT NULL
);
`);

// Procurando Grupo (LFG): posts de quem procura dupla/equipe pra jogar.
db.exec(`
CREATE TABLE IF NOT EXISTS lfg (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id   INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  canal_voz_id  INTEGER REFERENCES canais(id) ON DELETE SET NULL,
  autor_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  jogo          TEXT NOT NULL,
  rank          TEXT NOT NULL DEFAULT '',
  tipo          TEXT NOT NULL DEFAULT 'duo' CHECK (tipo IN ('duo','squad')),
  vagas         INTEGER NOT NULL DEFAULT 2,
  texto         TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','cheio','cancelado')),
  criado_em     INTEGER NOT NULL,
  expira_em     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lfg_servidor ON lfg(servidor_id, id);
CREATE INDEX IF NOT EXISTS idx_lfg_expira ON lfg(expira_em) WHERE expira_em IS NOT NULL;
CREATE TABLE IF NOT EXISTS lfg_participantes (
  lfg_id     INTEGER NOT NULL REFERENCES lfg(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  entrou_em  INTEGER NOT NULL,
  PRIMARY KEY (lfg_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_lfg_part_usuario ON lfg_participantes(usuario_id);
`);

const cache = new Map();
function q(sql) {
  let st = cache.get(sql);
  if (!st) {
    st = db.prepare(sql);
    cache.set(sql, st);
  }
  return st;
}

export function transacao(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* já revertida */ }
    throw e;
  }
}

export function fecharBanco() {
  try { db.close(); } catch { /* já fechado */ }
}

export const PALETA = ['#7c5cff', '#c056f5', '#ff9a3c', '#3ee6a8', '#1d4ed8', '#c2410c', '#0e7490', '#db2777'];
export const corAleatoria = () => PALETA[crypto.randomInt(PALETA.length)];

// ---------------------------------------------------------------- usuários
export function criarUsuario({ usuario, nome, hash, salt, cor }) {
  const r = q(`INSERT INTO usuarios (usuario, nome, senha_hash, senha_salt, cor, criado_em)
               VALUES (?, ?, ?, ?, ?, ?)`).run(usuario, nome, hash, salt, cor, Date.now());
  return Number(r.lastInsertRowid);
}
export const usuarioPorId = (id) => q('SELECT * FROM usuarios WHERE id = ?').get(id) || null;
export const usuarioPorNome = (usuario) => q('SELECT * FROM usuarios WHERE usuario = ?').get(usuario) || null;

export function atualizarPerfil(id, { nome, cor, statusTexto }) {
  if (nome !== undefined) q('UPDATE usuarios SET nome = ? WHERE id = ?').run(nome, id);
  if (cor !== undefined) q('UPDATE usuarios SET cor = ? WHERE id = ?').run(cor, id);
  if (statusTexto !== undefined) q('UPDATE usuarios SET status_texto = ? WHERE id = ?').run(statusTexto, id);
}
/** Perfil vitrine: listas guardadas como JSON. */
export function atualizarVitrine(id, { bio, banner, links, aniversario, jogos }) {
  if (bio !== undefined) q('UPDATE usuarios SET bio = ? WHERE id = ?').run(bio || null, id);
  if (banner !== undefined) q('UPDATE usuarios SET banner = ? WHERE id = ?').run(banner || null, id);
  if (links !== undefined) q('UPDATE usuarios SET links = ? WHERE id = ?').run(links.length ? JSON.stringify(links) : null, id);
  if (aniversario !== undefined) q('UPDATE usuarios SET aniversario = ? WHERE id = ?').run(aniversario || null, id);
  if (jogos !== undefined) q('UPDATE usuarios SET jogos = ? WHERE id = ?').run(jogos.length ? JSON.stringify(jogos) : null, id);
}
export const marcarAniversario = (id, ano) => q('UPDATE usuarios SET aniv_ano = ? WHERE id = ?').run(ano, id);
export const definirStatus = (id, status) => q('UPDATE usuarios SET status = ? WHERE id = ?').run(status, id);
export const definirFoco = (id, ate) => q('UPDATE usuarios SET foco_ate = ? WHERE id = ?').run(ate, id);
export function limparFocoExpirado(id, agora) {
  return q('UPDATE usuarios SET foco_ate = NULL WHERE id = ? AND foco_ate IS NOT NULL AND foco_ate <= ?')
    .run(id, agora).changes > 0;
}
export const usuariosComFocoExpirado = (agora) =>
  q('SELECT id FROM usuarios WHERE foco_ate IS NOT NULL AND foco_ate <= ?').all(agora).map((r) => r.id);

// ---------------------------------------------------------------- sessões
const DURACAO_SESSAO = 30 * 24 * 60 * 60 * 1000;
export function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const agora = Date.now();
  q('INSERT INTO sessoes (token, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)')
    .run(token, usuarioId, agora, agora + DURACAO_SESSAO);
  return token;
}
export function usuarioDaSessao(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  return q(`SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token = ? AND s.expira_em > ?`).get(token, Date.now()) || null;
}
export const apagarSessao = (token) => q('DELETE FROM sessoes WHERE token = ?').run(String(token));
export const apagarSessoesExpiradas = () => q('DELETE FROM sessoes WHERE expira_em <= ?').run(Date.now());

// ---------------------------------------------------------------- servidores
const CARACTERES_CONVITE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function novoConvite() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += CARACTERES_CONVITE[crypto.randomInt(CARACTERES_CONVITE.length)];
    if (!q('SELECT 1 FROM servidores WHERE convite = ?').get(c)) return c;
  }
}

export function criarServidor(nome, donoId) {
  return transacao(() => {
    const agora = Date.now();
    const r = q('INSERT INTO servidores (nome, dono_id, convite, criado_em) VALUES (?, ?, ?, ?)')
      .run(nome, donoId, novoConvite(), agora);
    const id = Number(r.lastInsertRowid);
    q('INSERT INTO membros (servidor_id, usuario_id, entrou_em) VALUES (?, ?, ?)').run(id, donoId, agora);
    q(`INSERT INTO canais (servidor_id, nome, tipo, posicao, criado_em) VALUES (?, 'geral', 'texto', 0, ?)`).run(id, agora);
    q(`INSERT INTO canais (servidor_id, nome, tipo, posicao, criado_em) VALUES (?, 'Resenha', 'voz', 1, ?)`).run(id, agora);
    return id;
  });
}
export const servidorPorId = (id) => q('SELECT * FROM servidores WHERE id = ?').get(id) || null;
export const servidorPorConvite = (c) => q('SELECT * FROM servidores WHERE convite = ?').get(c) || null;
export const servidoresDoUsuario = (uid) =>
  q(`SELECT s.* FROM servidores s JOIN membros m ON m.servidor_id = s.id
     WHERE m.usuario_id = ? ORDER BY m.entrou_em, s.id`).all(uid);
export const ehMembro = (sid, uid) =>
  !!q('SELECT 1 FROM membros WHERE servidor_id = ? AND usuario_id = ?').get(sid, uid);
export const renomearServidor = (id, nome) => q('UPDATE servidores SET nome = ? WHERE id = ?').run(nome, id);
export const apagarServidor = (id) => q('DELETE FROM servidores WHERE id = ?').run(id);

export function adicionarMembro(sid, uid) {
  transacao(() => {
    q('INSERT OR IGNORE INTO membros (servidor_id, usuario_id, entrou_em) VALUES (?, ?, ?)').run(sid, uid, Date.now());
    // Quem chega agora começa com o histórico marcado como lido.
    q(`INSERT INTO lidos (usuario_id, canal_id, ultima_msg_id)
       SELECT ?, c.id, COALESCE((SELECT MAX(id) FROM mensagens WHERE canal_id = c.id), 0)
       FROM canais c WHERE c.servidor_id = ?
       ON CONFLICT (usuario_id, canal_id) DO UPDATE SET ultima_msg_id = MAX(ultima_msg_id, excluded.ultima_msg_id)`)
      .run(uid, sid);
  });
}
export const removerMembro = (sid, uid) =>
  q('DELETE FROM membros WHERE servidor_id = ? AND usuario_id = ?').run(sid, uid);
export const membrosDoServidor = (sid) =>
  q(`SELECT u.*, m.cargo AS cargo, COALESCE(x.nivel, 1) AS nivel, COALESCE(x.xp, 0) AS xp_total
     FROM membros m JOIN usuarios u ON u.id = m.usuario_id
     LEFT JOIN xp x ON x.usuario_id = u.id AND x.servidor_id = m.servidor_id
     WHERE m.servidor_id = ? ORDER BY u.nome COLLATE NOCASE`).all(sid);
export const idsMembros = (sid) =>
  q('SELECT usuario_id FROM membros WHERE servidor_id = ?').all(sid).map((r) => r.usuario_id);

// ---------------------------------------------------------------- canais
export const canaisDoServidor = (sid) =>
  q('SELECT * FROM canais WHERE servidor_id = ? ORDER BY posicao, id').all(sid);
export const canalPorId = (id) =>
  q(`SELECT c.*, s.dono_id AS dono_id FROM canais c LEFT JOIN servidores s ON s.id = c.servidor_id
     WHERE c.id = ?`).get(id) || null;
export const contarCanais = (sid) => q('SELECT COUNT(*) AS n FROM canais WHERE servidor_id = ?').get(sid).n;
export function criarCanal(sid, nome, tipo, espacial) {
  const pos = q('SELECT COALESCE(MAX(posicao), -1) + 1 AS p FROM canais WHERE servidor_id = ?').get(sid).p;
  const r = q('INSERT INTO canais (servidor_id, nome, tipo, posicao, espacial, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sid, nome, tipo, pos, espacial ? 1 : 0, Date.now());
  return Number(r.lastInsertRowid);
}
export const apagarCanal = (id) => q('DELETE FROM canais WHERE id = ?').run(id);
export const canalDeAvisos = (sid) =>
  q(`SELECT * FROM canais WHERE servidor_id = ? AND tipo = 'texto'
     ORDER BY (nome = 'geral') DESC, posicao, id LIMIT 1`).get(sid) || null;

export function ehParticipanteDm(canalId, uid) {
  return !!q('SELECT 1 FROM dm_participantes WHERE canal_id = ? AND usuario_id = ?').get(canalId, uid);
}

/** Canal acessível ao usuário (membro do servidor ou participante da DM); lança ErroAura. */
export function acessarCanal(uid, canalId) {
  const canal = canalPorId(canalId);
  if (!canal) throw erro(404, 'Canal não encontrado.');
  const ok = canal.servidor_id != null ? ehMembro(canal.servidor_id, uid) : ehParticipanteDm(canal.id, uid);
  if (!ok) throw erro(403, 'Você não tem acesso a este canal.');
  if (canal.privado && canal.servidor_id != null && !ehStaff(canal.servidor_id, uid) && !temAcessoCanal(canal.id, uid)) {
    throw erro(403, canal.senha_hash ? '🔒 Canal com senha. Digite a senha pra entrar.' : '🔒 Canal privado.');
  }
  return canal;
}

// ---------------------------------------------------------------- DMs
export const dmsDoUsuario = (uid) =>
  q(`SELECT c.id AS canal_id, o.usuario_id AS outro_id, c.criado_em AS criado_em
     FROM dm_participantes p
     JOIN canais c ON c.id = p.canal_id AND c.tipo = 'dm'
     JOIN dm_participantes o ON o.canal_id = c.id AND o.usuario_id != p.usuario_id
     WHERE p.usuario_id = ?`).all(uid);
export const dmEntre = (a, b) =>
  q(`SELECT c.id FROM canais c
     JOIN dm_participantes x ON x.canal_id = c.id AND x.usuario_id = ?
     JOIN dm_participantes y ON y.canal_id = c.id AND y.usuario_id = ?
     WHERE c.tipo = 'dm' LIMIT 1`).get(a, b)?.id ?? null;
export function criarDm(a, b) {
  return transacao(() => {
    const existente = dmEntre(a, b);
    if (existente) return { id: existente, nova: false };
    const r = q(`INSERT INTO canais (servidor_id, nome, tipo, posicao, criado_em) VALUES (NULL, 'dm', 'dm', 0, ?)`).run(Date.now());
    const id = Number(r.lastInsertRowid);
    q('INSERT INTO dm_participantes (canal_id, usuario_id) VALUES (?, ?)').run(id, a);
    q('INSERT INTO dm_participantes (canal_id, usuario_id) VALUES (?, ?)').run(id, b);
    return { id, nova: true };
  });
}
export const outroDaDm = (canalId, uid) =>
  q('SELECT usuario_id FROM dm_participantes WHERE canal_id = ? AND usuario_id != ?').get(canalId, uid)?.usuario_id ?? null;

// ---------------------------------------------------------------- mensagens
const SELECT_MSG = `SELECT m.*, u.usuario AS a_usuario, u.nome AS a_nome, u.cor AS a_cor
                    FROM mensagens m LEFT JOIN usuarios u ON u.id = m.autor_id`;

export function inserirMensagem({ canalId, autorId, texto, sistema = false, refCanalId = null,
  audioDuracao = null, transcricao = null, expiraEm = null }) {
  const r = q(`INSERT INTO mensagens (canal_id, autor_id, texto, criado_em, sistema, ref_canal_id,
               audio_duracao, transcricao, expira_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(canalId, autorId, texto, Date.now(), sistema ? 1 : 0, refCanalId, audioDuracao, transcricao, expiraEm);
  return Number(r.lastInsertRowid);
}
export const mensagemPorId = (id) => q(`${SELECT_MSG} WHERE m.id = ?`).get(id) || null;

export function listarMensagens(canalId, antes, limite) {
  const agora = Date.now();
  const rows = antes
    ? q(`${SELECT_MSG} WHERE m.canal_id = ? AND m.id < ? AND (m.expira_em IS NULL OR m.expira_em > ?)
         ORDER BY m.id DESC LIMIT ?`).all(canalId, antes, agora, limite)
    : q(`${SELECT_MSG} WHERE m.canal_id = ? AND (m.expira_em IS NULL OR m.expira_em > ?)
         ORDER BY m.id DESC LIMIT ?`).all(canalId, agora, limite);
  return rows.reverse();
}
export function mensagensNaoLidas(canalId, desdeId, uid, limite) {
  return q(`${SELECT_MSG} WHERE m.canal_id = ? AND m.id > ? AND (m.autor_id IS NULL OR m.autor_id != ?)
            AND (m.expira_em IS NULL OR m.expira_em > ?) ORDER BY m.id DESC LIMIT ?`)
    .all(canalId, desdeId, uid, Date.now(), limite).reverse();
}
export const ultimaMensagem = (canalId) =>
  q(`${SELECT_MSG} WHERE m.canal_id = ? AND (m.expira_em IS NULL OR m.expira_em > ?) ORDER BY m.id DESC LIMIT 1`)
    .get(canalId, Date.now()) || null;
export const editarMensagem = (id, texto) =>
  q('UPDATE mensagens SET texto = ?, editado_em = ? WHERE id = ?').run(texto, Date.now(), id);
export const apagarMensagem = (id) => q('DELETE FROM mensagens WHERE id = ?').run(id).changes > 0;
export const mensagensExpiradas = (agora) =>
  q(`${SELECT_MSG} WHERE m.expira_em IS NOT NULL AND m.expira_em <= ?`).all(agora);
export const idsAudiosDoCanal = (canalId) =>
  q('SELECT id FROM mensagens WHERE canal_id = ? AND audio_duracao IS NOT NULL').all(canalId).map((r) => r.id);
export const idsAudiosDoServidor = (sid) =>
  q(`SELECT m.id FROM mensagens m JOIN canais c ON c.id = m.canal_id
     WHERE c.servidor_id = ? AND m.audio_duracao IS NOT NULL`).all(sid).map((r) => r.id);

export function reacoesDe(ids) {
  const mapa = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return mapa;
  const marcadores = ids.map(() => '?').join(',');
  const rows = q(`SELECT mensagem_id, usuario_id, emoji FROM reacoes WHERE mensagem_id IN (${marcadores}) ORDER BY rowid`)
    .all(...ids);
  for (const r of rows) {
    const lista = mapa.get(r.mensagem_id);
    if (!lista) continue;
    let item = lista.find((x) => x.emoji === r.emoji);
    if (!item) lista.push((item = { emoji: r.emoji, usuarios: [] }));
    item.usuarios.push(r.usuario_id);
  }
  return mapa;
}
export function alternarReacao(msgId, uid, emoji) {
  const existe = q('SELECT 1 FROM reacoes WHERE mensagem_id = ? AND usuario_id = ? AND emoji = ?').get(msgId, uid, emoji);
  if (existe) {
    q('DELETE FROM reacoes WHERE mensagem_id = ? AND usuario_id = ? AND emoji = ?').run(msgId, uid, emoji);
    return false;
  }
  const distintos = q('SELECT COUNT(DISTINCT emoji) AS n FROM reacoes WHERE mensagem_id = ?').get(msgId).n;
  const jaTem = q('SELECT 1 FROM reacoes WHERE mensagem_id = ? AND emoji = ?').get(msgId, emoji);
  if (!jaTem && distintos >= 20) throw erro(400, 'Essa mensagem já tem reações demais.');
  q('INSERT INTO reacoes (mensagem_id, usuario_id, emoji) VALUES (?, ?, ?)').run(msgId, uid, emoji);
  return true;
}

export function serMensagem(row, reacoes = []) {
  const m = {
    id: row.id,
    canalId: row.canal_id,
    autor: row.autor_id != null && row.a_usuario != null
      ? { id: row.autor_id, usuario: row.a_usuario, nome: row.a_nome, cor: row.a_cor }
      : null,
    texto: row.texto,
    criadoEm: row.criado_em,
    editadoEm: row.editado_em ?? null,
    reacoes,
  };
  if (row.sistema) {
    m.sistema = true;
    if (row.ref_canal_id) m.refCanalId = row.ref_canal_id;
  }
  if (row.audio_duracao != null) {
    m.audio = { url: `/api/audios/${row.id}`, duracao: row.audio_duracao };
    if (row.transcricao) m.transcricao = row.transcricao;
  }
  if (row.expira_em != null) m.expiraEm = row.expira_em;
  return m;
}
export function serMensagens(rows) {
  const reacoes = reacoesDe(rows.map((r) => r.id));
  return rows.map((r) => serMensagem(r, reacoes.get(r.id) || []));
}
export const mensagemCompleta = (id) => {
  const row = mensagemPorId(id);
  return row ? serMensagens([row])[0] : null;
};

// ---------------------------------------------------------------- lidos
export const ultimoLido = (uid, canalId) =>
  q('SELECT ultima_msg_id FROM lidos WHERE usuario_id = ? AND canal_id = ?').get(uid, canalId)?.ultima_msg_id ?? 0;
export function marcarLido(uid, canalId) {
  const max = q('SELECT COALESCE(MAX(id), 0) AS m FROM mensagens WHERE canal_id = ?').get(canalId).m;
  q(`INSERT INTO lidos (usuario_id, canal_id, ultima_msg_id) VALUES (?, ?, ?)
     ON CONFLICT (usuario_id, canal_id) DO UPDATE SET ultima_msg_id = MAX(ultima_msg_id, excluded.ultima_msg_id)`)
    .run(uid, canalId, max);
}
export function naoLidosDoServidor(uid, sid) {
  const rows = q(`SELECT c.id AS canal_id, COUNT(m.id) AS n
                  FROM canais c
                  LEFT JOIN lidos l ON l.canal_id = c.id AND l.usuario_id = ?
                  LEFT JOIN mensagens m ON m.canal_id = c.id AND m.id > COALESCE(l.ultima_msg_id, 0)
                       AND (m.autor_id IS NULL OR m.autor_id != ?) AND (m.expira_em IS NULL OR m.expira_em > ?)
                  WHERE c.servidor_id = ? AND c.tipo IN ('texto', 'assistir')
                  GROUP BY c.id`).all(uid, uid, Date.now(), sid);
  const r = {};
  for (const x of rows) r[x.canal_id] = x.n;
  return r;
}
export const naoLidosDoCanal = (uid, canalId) =>
  q(`SELECT COUNT(*) AS n FROM mensagens WHERE canal_id = ? AND id > ? AND (autor_id IS NULL OR autor_id != ?)
     AND (expira_em IS NULL OR expira_em > ?)`).get(canalId, ultimoLido(uid, canalId), uid, Date.now()).n;

// ---------------------------------------------------------------- XP, missões e selos
export const obterXp = (uid, sid) =>
  q('SELECT xp, nivel FROM xp WHERE usuario_id = ? AND servidor_id = ?').get(uid, sid) || { xp: 0, nivel: 1 };
export const salvarXp = (uid, sid, xp, nivel) =>
  q(`INSERT INTO xp (usuario_id, servidor_id, xp, nivel) VALUES (?, ?, ?, ?)
     ON CONFLICT (usuario_id, servidor_id) DO UPDATE SET xp = excluded.xp, nivel = excluded.nivel`).run(uid, sid, xp, nivel);
export const obterProgresso = (uid, sid, semana, chave) =>
  q('SELECT valor FROM progresso_missao WHERE usuario_id = ? AND servidor_id = ? AND semana = ? AND chave = ?')
    .get(uid, sid, semana, chave)?.valor ?? 0;
export const salvarProgresso = (uid, sid, semana, chave, valor) =>
  q(`INSERT INTO progresso_missao (usuario_id, servidor_id, semana, chave, valor) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (usuario_id, servidor_id, semana, chave) DO UPDATE SET valor = excluded.valor`)
    .run(uid, sid, semana, chave, valor);
export const progressoDaSemana = (uid, sid, semana) =>
  q('SELECT chave, valor FROM progresso_missao WHERE usuario_id = ? AND servidor_id = ? AND semana = ?').all(uid, sid, semana);
export const darSelo = (uid, sid, chave) =>
  q(`INSERT INTO selos (usuario_id, servidor_id, chave, ganho_em) VALUES (?, ?, ?, ?)
     ON CONFLICT (usuario_id, servidor_id, chave) DO UPDATE SET ganho_em = excluded.ganho_em`).run(uid, sid, chave, Date.now());
export const selosDe = (uid, sid) =>
  q('SELECT chave, ganho_em FROM selos WHERE usuario_id = ? AND servidor_id = ? ORDER BY ganho_em').all(uid, sid);
export const ranking = (sid) =>
  q(`SELECT u.*, x.xp AS xp_total, x.nivel AS nivel FROM xp x
     JOIN membros m ON m.servidor_id = x.servidor_id AND m.usuario_id = x.usuario_id
     JOIN usuarios u ON u.id = x.usuario_id
     WHERE x.servidor_id = ? AND x.xp > 0 ORDER BY x.xp DESC, u.id ASC LIMIT 10`).all(sid);

// ---------------------------------------------------------------- serialização
export function sigla(nome) {
  const palavras = String(nome).trim().split(/\s+/).filter(Boolean);
  const letras = palavras.slice(0, 2).map((p) => Array.from(p)[0] || '');
  return letras.join('').toUpperCase() || '?';
}
export function serCanal(row) {
  return {
    id: row.id,
    servidorId: row.servidor_id ?? null,
    nome: row.nome,
    tipo: row.tipo,
    posicao: row.posicao,
    espacial: !!row.espacial,
    privado: !!row.privado,
    comSenha: !!row.senha_hash,
    ticket: row.ticket_de ?? null,
  };
}
export function serServidor(row) {
  return {
    id: row.id,
    nome: row.nome,
    sigla: sigla(row.nome),
    donoId: row.dono_id,
    convite: row.convite,
    canais: canaisDoServidor(row.id).map(serCanal),
  };
}

// ---------------------------------------------------------------- staff e moderação
export const CARGOS = ['adm', 'mod', 'membro'];
/** 4 = dono, 3 = adm, 2 = mod, 1 = membro, 0 = não é membro. */
export function nivelCargo(sid, uid) {
  const r = q(`SELECT m.cargo, s.dono_id FROM membros m JOIN servidores s ON s.id = m.servidor_id
               WHERE m.servidor_id = ? AND m.usuario_id = ?`).get(sid, uid);
  if (!r) return 0;
  if (r.dono_id === uid) return 4;
  return { adm: 3, mod: 2 }[r.cargo] || 1;
}
export const ehStaff = (sid, uid) => nivelCargo(sid, uid) >= 2;
export const definirCargo = (sid, uid, cargo) =>
  q('UPDATE membros SET cargo = ? WHERE servidor_id = ? AND usuario_id = ?').run(cargo, sid, uid);
export const temAcessoCanal = (canalId, uid) =>
  !!q('SELECT 1 FROM canal_acesso WHERE canal_id = ? AND usuario_id = ?').get(canalId, uid);
export const darAcessoCanal = (canalId, uid) =>
  q('INSERT OR IGNORE INTO canal_acesso (canal_id, usuario_id) VALUES (?, ?)').run(canalId, uid);
/** Quem enxerga um canal privado: staff + quem destravou/abriu. */
export const idsComAcesso = (canal) =>
  idsMembros(canal.servidor_id).filter((uid) => ehStaff(canal.servidor_id, uid) || temAcessoCanal(canal.id, uid));
export const tornarPrivado = (canalId, hash, salt, ticketDe) =>
  q('UPDATE canais SET privado = 1, senha_hash = ?, senha_salt = ?, ticket_de = ? WHERE id = ?').run(hash, salt, ticketDe, canalId);
export const contarTickets = (sid) =>
  q('SELECT COUNT(*) AS n FROM canais WHERE servidor_id = ? AND ticket_de IS NOT NULL').get(sid).n;
export const banir = (sid, uid, porId, motivo) =>
  q('INSERT OR REPLACE INTO banidos (servidor_id, usuario_id, por_id, motivo, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(sid, uid, porId, motivo, Date.now());
export const ehBanido = (sid, uid) => !!q('SELECT 1 FROM banidos WHERE servidor_id = ? AND usuario_id = ?').get(sid, uid);
export function criarDenuncia(d) {
  const r = q(`INSERT INTO denuncias (servidor_id, autor_id, alvo_id, mensagem_id, canal_id, texto, motivo, criado_em)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.servidorId, d.autorId, d.alvoId ?? null, d.mensagemId ?? null, d.canalId ?? null, d.texto ?? null, d.motivo, Date.now());
  return Number(r.lastInsertRowid);
}
export const denunciasDoServidor = (sid) =>
  q(`SELECT d.*, a.nome AS autor_nome, b.nome AS alvo_nome FROM denuncias d
     JOIN usuarios a ON a.id = d.autor_id LEFT JOIN usuarios b ON b.id = d.alvo_id
     WHERE d.servidor_id = ? ORDER BY (d.estado = 'aberta') DESC, d.id DESC LIMIT 100`).all(sid);
export const denunciaPorId = (id) => q('SELECT * FROM denuncias WHERE id = ?').get(id) || null;
export const marcarDenuncia = (id, estado) => q('UPDATE denuncias SET estado = ? WHERE id = ?').run(estado, id);

// ---------------------------------------------------------------- procurando grupo (LFG)
export function criarLfg({ servidorId, canalVozId, autorId, jogo, rank, tipo, vagas, texto, expiraEm }) {
  const r = q(`INSERT INTO lfg (servidor_id, canal_voz_id, autor_id, jogo, rank, tipo, vagas, texto, criado_em, expira_em)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    servidorId, canalVozId ?? null, autorId, jogo, rank || '', tipo, vagas, texto || '', Date.now(), expiraEm ?? null);
  const id = Number(r.lastInsertRowid);
  q('INSERT INTO lfg_participantes (lfg_id, usuario_id, entrou_em) VALUES (?, ?, ?)').run(id, autorId, Date.now());
  return id;
}
export const lfgPorId = (id) => q('SELECT * FROM lfg WHERE id = ?').get(id) || null;
export function lfgAbertasServidor(sid, { jogo = null, rank = null } = {}) {
  let sql = `SELECT * FROM lfg WHERE servidor_id = ? AND status = 'aberto' AND (expira_em IS NULL OR expira_em > ?)`;
  const params = [sid, Date.now()];
  if (jogo) { sql += ' AND jogo = ?'; params.push(jogo); }
  if (rank) { sql += ' AND rank = ?'; params.push(rank); }
  sql += ' ORDER BY criado_em DESC LIMIT 100';
  return q(sql).all(...params);
}
export const lfgParticipantes = (id) =>
  q(`SELECT u.* FROM lfg_participantes p JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.lfg_id = ? ORDER BY p.entrou_em, u.id`).all(id);
export const ehParticipanteLfg = (id, uid) =>
  !!q('SELECT 1 FROM lfg_participantes WHERE lfg_id = ? AND usuario_id = ?').get(id, uid);
export function entrarLfg(id, uid) {
  q('INSERT OR IGNORE INTO lfg_participantes (lfg_id, usuario_id, entrou_em) VALUES (?, ?, ?)').run(id, uid, Date.now());
  const row = q('SELECT * FROM lfg WHERE id = ?').get(id);
  if (!row) return null;
  const n = q('SELECT COUNT(*) AS c FROM lfg_participantes WHERE lfg_id = ?').get(id).c;
  if (row.status === 'aberto' && n >= row.vagas) q("UPDATE lfg SET status = 'cheio' WHERE id = ?").run(id);
  return q('SELECT * FROM lfg WHERE id = ?').get(id);
}
export function sairLfg(id, uid) {
  if (q('DELETE FROM lfg_participantes WHERE lfg_id = ? AND usuario_id = ?').run(id, uid).changes === 0) return null;
  const row = q('SELECT * FROM lfg WHERE id = ?').get(id);
  if (!row) return null;
  if (row.status === 'cheio') {
    const n = q('SELECT COUNT(*) AS c FROM lfg_participantes WHERE lfg_id = ?').get(id).c;
    if (n < row.vagas) q("UPDATE lfg SET status = 'aberto' WHERE id = ?").run(id);
  }
  // Retorna o estado atualizado após a possível reabertura.
  return q('SELECT * FROM lfg WHERE id = ?').get(id);
}
export const cancelarLfg = (id) => q("UPDATE lfg SET status = 'cancelado' WHERE id = ?").run(id).changes > 0;
export const lfgExpiradas = (agora) =>
  q("SELECT id FROM lfg WHERE status = 'aberto' AND expira_em IS NOT NULL AND expira_em <= ?").all(agora).map((r) => r.id);
export const apagarLfg = (id) => q('DELETE FROM lfg WHERE id = ?').run(id).changes > 0;
