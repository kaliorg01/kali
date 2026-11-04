// Banco de dados da KALI: schema + funções de consulta (node:sqlite, só consultas parametrizadas).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class ErroKali extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}
export const erro = (status, mensagem) => new ErroKali(status, mensagem);

const RAIZ = path.resolve(import.meta.dirname, '..');
const DB_ENV = process.env.KALI_DB || process.env.AURA_DB;
export const CAMINHO_DB = DB_ENV
  ? path.resolve(DB_ENV)
  : path.join(RAIZ, 'dados', 'kali.db');
fs.mkdirSync(path.dirname(CAMINHO_DB), { recursive: true });
// Instalações do tempo da AURA: renomeia dados/aura.db (+ -wal/-shm) para kali.db na primeira subida.
if (!DB_ENV && !fs.existsSync(CAMINHO_DB)) {
  const antigo = path.join(RAIZ, 'dados', 'aura.db');
  for (const suf of ['', '-wal', '-shm']) if (fs.existsSync(antigo + suf)) fs.renameSync(antigo + suf, CAMINHO_DB + suf);
}

const AUDIOS_ENV = process.env.KALI_AUDIOS || process.env.AURA_AUDIOS;
export const PASTA_AUDIOS = AUDIOS_ENV
  ? path.resolve(AUDIOS_ENV)
  : path.join(path.dirname(CAMINHO_DB), 'audios');
fs.mkdirSync(PASTA_AUDIOS, { recursive: true });
export const PASTA_ANEXOS = path.join(path.dirname(CAMINHO_DB), 'anexos');
fs.mkdirSync(PASTA_ANEXOS, { recursive: true });

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
  ['canais', 'so_staff', 'INTEGER NOT NULL DEFAULT 0'],
  ['canais', 'palco', 'INTEGER NOT NULL DEFAULT 0'],
  ['canais', 'forum', 'INTEGER NOT NULL DEFAULT 0'],
  ['mensagens', 'webhook_nome', 'TEXT'],
  ['sessoes', 'ua', 'TEXT'],
  ['sessoes', 'ultimo', 'INTEGER'],
  ['membros', 'cargo', "TEXT NOT NULL DEFAULT 'membro'"],
  ['canais', 'privado', 'INTEGER NOT NULL DEFAULT 0'],
  ['mensagens', 'resposta_a', 'INTEGER'],
  ['usuarios', 'avatar_v', 'INTEGER'],
  ['membros', 'castigo_ate', 'INTEGER'],
  ['usuarios', 'equip_banner', 'INTEGER'],
  ['canais', 'categoria', 'TEXT'],
  ['canais', 'pai_canal', 'INTEGER'],
  ['canais', 'pai_msg', 'INTEGER'],
  ['canais', 'modo_lento', 'INTEGER NOT NULL DEFAULT 0'],
  ['membros', 'apelido', 'TEXT'],
  ['usuarios', 'equip_moldura', 'INTEGER'],
  ['usuarios', 'equip_cor', 'INTEGER'],
  ['usuarios', 'banner_v', 'INTEGER'],
  ['servidores', 'icone_v', 'INTEGER'],
  ['servidores', 'banner_v', 'INTEGER'],
  ['mensagens', 'fixada', 'INTEGER NOT NULL DEFAULT 0'],
  ['mensagens', 'anexo_nome', 'TEXT'],
  ['mensagens', 'anexo_tipo', 'TEXT'],
  ['mensagens', 'anexo_tamanho', 'INTEGER'],
  ['canais', 'senha_hash', 'TEXT'],
  ['canais', 'senha_salt', 'TEXT'],
  ['canais', 'ticket_de', 'INTEGER'],
  ['usuarios', 'bio', 'TEXT'],
  ['usuarios', 'banner', 'TEXT'],
  ['usuarios', 'links', 'TEXT'],
  ['usuarios', 'aniversario', 'TEXT'],
  ['usuarios', 'jogos', 'TEXT'],
  ['usuarios', 'aniv_ano', 'INTEGER'],
  ['servidores', 'automod', 'TEXT'],
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

// Cores de avatar antigas (roxo/laranja da AURA) viram as azuis equivalentes.
db.exec(`UPDATE usuarios SET cor = CASE cor WHEN '#7c5cff' THEN '#367bf0' WHEN '#c056f5' THEN '#1fa2ff' ELSE '#2fd0ff' END WHERE cor IN ('#7c5cff', '#c056f5', '#ff9a3c')`);
export const PALETA = ['#367bf0', '#1fa2ff', '#2fd0ff', '#3ee6a8', '#1d4ed8', '#c2410c', '#0e7490', '#db2777'];
export const corAleatoria = () => PALETA[crypto.randomInt(PALETA.length)];

// ---------------------------------------------------------------- loja de cosméticos
// tipo banner/moldura: `valor` = versão da imagem (dados/imagens/i<id>-item); tipo cor: `valor` = '#hex' ou '#hex,#hex'.
db.exec(`
CREATE TABLE IF NOT EXISTS loja_itens (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo      TEXT NOT NULL CHECK (tipo IN ('banner','moldura','cor')),
  nome      TEXT NOT NULL,
  preco     INTEGER NOT NULL DEFAULT 0,
  valor     TEXT NOT NULL,
  ativo     INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS inventario (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES loja_itens(id) ON DELETE CASCADE,
  ganho_em   INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, item_id)
);
`);
export function itemPorId(id) { return id ? q('SELECT * FROM loja_itens WHERE id = ?').get(id) ?? null : null; }
export function urlItem(id) { const i = itemPorId(id); return i && i.tipo !== 'cor' ? `/api/imagens/i${i.id}-item?v=${i.valor}` : null; }
export function corDoItem(id) { const i = itemPorId(id); return i && i.tipo === 'cor' ? i.valor : null; }
export const itensDaLoja = () => q('SELECT * FROM loja_itens WHERE ativo = 1 ORDER BY tipo, id DESC').all();
export const criarItem = (tipo, nome, preco, valor) =>
  Number(q('INSERT INTO loja_itens (tipo, nome, preco, valor, criado_em) VALUES (?, ?, ?, ?, ?)').run(tipo, nome, preco, valor, Date.now()).lastInsertRowid);
export const desativarItem = (id) => q('UPDATE loja_itens SET ativo = 0 WHERE id = ?').run(id).changes > 0;
export const meusItens = (uid) => q('SELECT item_id FROM inventario WHERE usuario_id = ?').all(uid).map((r) => r.item_id);
export const temItem = (uid, id) => !!q('SELECT 1 FROM inventario WHERE usuario_id = ? AND item_id = ?').get(uid, id);
export const darItem = (uid, id) => q('INSERT OR IGNORE INTO inventario (usuario_id, item_id, ganho_em) VALUES (?, ?, ?)').run(uid, id, Date.now()).changes > 0;
export function equipar(uid, tipo, itemId) {
  const coluna = { banner: 'equip_banner', moldura: 'equip_moldura', cor: 'equip_cor' }[tipo];
  q(`UPDATE usuarios SET ${coluna} = ? WHERE id = ?`).run(itemId, uid);
}

// ---------------------------------------------------------------- emojis próprios do servidor (imagem em dados/imagens/e<id>-emoji)
db.exec(`
CREATE TABLE IF NOT EXISTS emojis (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  versao      INTEGER NOT NULL,
  criado_em   INTEGER NOT NULL,
  UNIQUE (servidor_id, nome)
);
`);
export const emojisDoServidor = (sid) => q('SELECT * FROM emojis WHERE servidor_id = ? ORDER BY nome').all(sid);
export const emojisDoUsuario = (uid) =>
  q('SELECT e.* FROM emojis e JOIN membros m ON m.servidor_id = e.servidor_id AND m.usuario_id = ? ORDER BY e.id').all(uid);
export const emojiPorId = (id) => q('SELECT * FROM emojis WHERE id = ?').get(id) ?? null;
export const criarEmoji = (sid, nome) =>
  Number(q('INSERT INTO emojis (servidor_id, nome, versao, criado_em) VALUES (?, ?, ?, ?)').run(sid, nome, Date.now(), Date.now()).lastInsertRowid);
export const apagarEmoji = (id) => q('DELETE FROM emojis WHERE id = ?').run(id);

// ---------------------------------------------------------------- eventos do servidor
db.exec(`
CREATE TABLE IF NOT EXISTS eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  descricao   TEXT NOT NULL DEFAULT '',
  inicio      INTEGER NOT NULL,
  criado_por  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS evento_interessados (
  evento_id  INTEGER NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (evento_id, usuario_id)
);
`);
// Mostra os que ainda vão acontecer e os que começaram há menos de 6 h.
export const eventosDoServidor = (sid) => q('SELECT * FROM eventos WHERE servidor_id = ? AND inicio > ? ORDER BY inicio').all(sid, Date.now() - 6 * 3600e3);
export const eventoPorId = (id) => q('SELECT * FROM eventos WHERE id = ?').get(id) ?? null;
export const criarEvento = (sid, titulo, descricao, inicio, uid) =>
  Number(q('INSERT INTO eventos (servidor_id, titulo, descricao, inicio, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)').run(sid, titulo, descricao, inicio, uid, Date.now()).lastInsertRowid);
export const apagarEvento = (id) => q('DELETE FROM eventos WHERE id = ?').run(id);
export const interessadosEvento = (id) => q('SELECT usuario_id FROM evento_interessados WHERE evento_id = ?').all(id).map((r) => r.usuario_id);
export function alternarInteresse(id, uid) {
  if (q('DELETE FROM evento_interessados WHERE evento_id = ? AND usuario_id = ?').run(id, uid).changes) return false;
  q('INSERT INTO evento_interessados (evento_id, usuario_id) VALUES (?, ?)').run(id, uid);
  return true;
}

// ---------------------------------------------------------------- painel do dono
export const contagens = () => ({
  usuarios: q('SELECT COUNT(*) AS n FROM usuarios').get().n,
  servidores: q('SELECT COUNT(*) AS n FROM servidores').get().n,
  mensagens: q('SELECT COUNT(*) AS n FROM mensagens').get().n,
  itensEntregues: q('SELECT COUNT(*) AS n FROM inventario').get().n,
});
export const buscarUsuarios = (t) =>
  q(`SELECT u.id, u.usuario, u.nome, u.criado_em, (SELECT COUNT(*) FROM inventario i WHERE i.usuario_id = u.id) AS itens
     FROM usuarios u WHERE u.usuario LIKE ? OR u.nome LIKE ? ORDER BY u.id DESC LIMIT 50`).all(`%${t}%`, `%${t}%`);
export const itensDoUsuario = (uid) =>
  q('SELECT l.id, l.nome, l.tipo FROM inventario i JOIN loja_itens l ON l.id = i.item_id WHERE i.usuario_id = ? ORDER BY i.ganho_em DESC').all(uid);
export const tirarItem = (uid, itemId) => q('DELETE FROM inventario WHERE usuario_id = ? AND item_id = ?').run(uid, itemId).changes > 0;

// ---------------------------------------------------------------- castigo (timeout)
// Tabela própria (não depende de ser membro): sair e voltar pelo convite não limpa o castigo.
db.exec(`
CREATE TABLE IF NOT EXISTS castigos (
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ate         INTEGER NOT NULL,
  PRIMARY KEY (servidor_id, usuario_id)
);
`);
// Migração única e idempotente: o castigo antigo (membros.castigo_ate) que ainda vale passa pra tabela nova.
transacao(() => {
  db.prepare(`INSERT OR IGNORE INTO castigos (servidor_id, usuario_id, ate)
              SELECT servidor_id, usuario_id, castigo_ate FROM membros WHERE castigo_ate IS NOT NULL AND castigo_ate > ?`).run(Date.now());
  db.exec('UPDATE membros SET castigo_ate = NULL WHERE castigo_ate IS NOT NULL');
});
export function castigar(sid, uid, ate) {
  if (ate) q('INSERT OR REPLACE INTO castigos (servidor_id, usuario_id, ate) VALUES (?, ?, ?)').run(sid, uid, ate);
  else q('DELETE FROM castigos WHERE servidor_id = ? AND usuario_id = ?').run(sid, uid);
}
// AutoMod: lista de palavras proibidas por servidor (uma por linha). Staff não é filtrada.
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function automodDe(sid) {
  const t = q('SELECT automod FROM servidores WHERE id = ?').get(sid)?.automod;
  return t ? t.split('\n').map((x) => x.trim()).filter(Boolean) : [];
}
export function definirAutomod(sid, palavras) {
  q('UPDATE servidores SET automod = ? WHERE id = ?').run(palavras.length ? palavras.join('\n') : null, sid);
}
export function exigirAutomod(canal, uid, texto) {
  if (canal.servidor_id == null || !texto || nivelCargo(canal.servidor_id, uid) >= 2) return;
  const n = normal(texto);
  const achou = automodDe(canal.servidor_id).find((p) => {
    const w = normal(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return w && new RegExp('(^|[^a-z0-9])' + w + '($|[^a-z0-9])').test(n);
  });
  if (achou) throw erro(400, '🛡️ AutoMod: essa mensagem tem uma palavra bloqueada neste servidor.');
}
export function exigirSemCastigo(canal, uid) {
  if (canal.servidor_id == null) return;
  const ate = q('SELECT ate FROM castigos WHERE servidor_id = ? AND usuario_id = ?').get(canal.servidor_id, uid)?.ate;
  if (ate && ate > Date.now()) {
    const h = new Date(ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    throw erro(403, `⏳ Você está de castigo neste servidor até ${h}.`);
  }
}

// ---------------------------------------------------------------- cargos personalizados
// Canal ligado a cargos vira privado e o acesso (canal_acesso) espelha quem tem esses cargos.
db.exec(`
CREATE TABLE IF NOT EXISTS cargos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cor         TEXT NOT NULL,
  criado_em   INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS membro_cargos (
  cargo_id   INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (cargo_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS canal_cargos (
  canal_id INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  PRIMARY KEY (canal_id, cargo_id)
);
`);
export const cargoPorId = (id) => q('SELECT * FROM cargos WHERE id = ?').get(id) ?? null;
export const cargosDoCanal = (canalId) => q('SELECT cargo_id FROM canal_cargos WHERE canal_id = ?').all(canalId).map((r) => r.cargo_id);
export const cargosDoServidor = (sid) => q('SELECT id, nome, cor, perm FROM cargos WHERE servidor_id = ? ORDER BY id').all(sid).map((c) => ({
  ...c,
  membros: q('SELECT usuario_id FROM membro_cargos WHERE cargo_id = ?').all(c.id).map((r) => r.usuario_id),
  canais: q('SELECT canal_id FROM canal_cargos WHERE cargo_id = ?').all(c.id).map((r) => r.canal_id),
}));
export const criarCargo = (sid, nome, cor) =>
  Number(q('INSERT INTO cargos (servidor_id, nome, cor, criado_em) VALUES (?, ?, ?, ?)').run(sid, nome, cor, Date.now()).lastInsertRowid);
function sincronizarCanalPorCargo(canalId) {
  const tem = cargosDoCanal(canalId).length > 0;
  q(`UPDATE canais SET privado = CASE WHEN senha_hash IS NOT NULL OR ticket_de IS NOT NULL THEN 1 ELSE ? END WHERE id = ?`).run(tem ? 1 : 0, canalId);
  if (!tem) return;
  const quem = 'SELECT usuario_id FROM membro_cargos WHERE cargo_id IN (SELECT cargo_id FROM canal_cargos WHERE canal_id = ?)';
  q(`DELETE FROM canal_acesso WHERE canal_id = ? AND usuario_id NOT IN (${quem})`).run(canalId, canalId);
  q(`INSERT OR IGNORE INTO canal_acesso (canal_id, usuario_id) ${quem.replace('SELECT usuario_id', 'SELECT ?, usuario_id')}`).run(canalId, canalId);
}
const canaisDoCargo = (cargoId) => q('SELECT canal_id FROM canal_cargos WHERE cargo_id = ?').all(cargoId).map((r) => r.canal_id);
export function definirMembrosDoCargo(cargoId, ids) {
  transacao(() => {
    q('DELETE FROM membro_cargos WHERE cargo_id = ?').run(cargoId);
    for (const u of ids) q('INSERT INTO membro_cargos (cargo_id, usuario_id) VALUES (?, ?)').run(cargoId, u);
    for (const c of canaisDoCargo(cargoId)) sincronizarCanalPorCargo(c);
  });
}
export function definirCanaisDoCargo(cargoId, ids) {
  transacao(() => {
    const afetados = new Set([...canaisDoCargo(cargoId), ...ids]);
    q('DELETE FROM canal_cargos WHERE cargo_id = ?').run(cargoId);
    for (const c of ids) q('INSERT INTO canal_cargos (canal_id, cargo_id) VALUES (?, ?)').run(c, cargoId);
    for (const c of afetados) sincronizarCanalPorCargo(c);
  });
}
export function apagarCargo(cargoId) {
  transacao(() => {
    const afetados = canaisDoCargo(cargoId);
    q('DELETE FROM cargos WHERE id = ?').run(cargoId);
    for (const c of afetados) sincronizarCanalPorCargo(c);
  });
}

// ---------------------------------------------------------------- amizades
// Uma linha por par: `de` pediu, `para` recebeu; status 'aceita' = amigos.
db.exec(`
CREATE TABLE IF NOT EXISTS amizades (
  de        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  para      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  status    TEXT NOT NULL CHECK (status IN ('pendente','aceita')),
  criado_em INTEGER NOT NULL,
  PRIMARY KEY (de, para)
);
CREATE INDEX IF NOT EXISTS idx_amizades_para ON amizades(para);
`);
export const amizadeEntre = (a, b) =>
  q('SELECT * FROM amizades WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)').get(a, b, b, a) ?? null;
export const pedirAmizade = (de, para) =>
  q(`INSERT INTO amizades (de, para, status, criado_em) VALUES (?, ?, 'pendente', ?)`).run(de, para, Date.now());
export const aceitarAmizade = (de, para) =>
  q(`UPDATE amizades SET status = 'aceita' WHERE de = ? AND para = ? AND status = 'pendente'`).run(de, para).changes > 0;
export const removerAmizade = (a, b) =>
  q('DELETE FROM amizades WHERE (de = ? AND para = ?) OR (de = ? AND para = ?)').run(a, b, b, a).changes > 0;
export const amigosDe = (uid) =>
  q(`SELECT CASE WHEN de = ? THEN para ELSE de END AS id FROM amizades WHERE status = 'aceita' AND (de = ? OR para = ?)`)
    .all(uid, uid, uid).map((r) => r.id);
export const amizadesDoUsuario = (uid) =>
  q(`SELECT a.de, a.para, a.status AS amizade, u.* FROM amizades a
     JOIN usuarios u ON u.id = CASE WHEN a.de = ? THEN a.para ELSE a.de END
     WHERE a.de = ? OR a.para = ? ORDER BY u.nome COLLATE NOCASE`).all(uid, uid, uid);

// ---------------------------------------------------------------- bloqueios (usuario_id bloqueou alvo_id)
db.exec(`
CREATE TABLE IF NOT EXISTS bloqueios (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alvo_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em  INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, alvo_id)
);
CREATE INDEX IF NOT EXISTS idx_bloqueios_alvo ON bloqueios(alvo_id);
`);
/** Bloqueia e, junto, desfaz a amizade e recusa pedidos pendentes nos dois sentidos. */
export function bloquear(uid, alvo) {
  transacao(() => {
    q('INSERT OR IGNORE INTO bloqueios (usuario_id, alvo_id, criado_em) VALUES (?, ?, ?)').run(uid, alvo, Date.now());
    removerAmizade(uid, alvo);
  });
}
export const desbloquear = (uid, alvo) =>
  q('DELETE FROM bloqueios WHERE usuario_id = ? AND alvo_id = ?').run(uid, alvo).changes > 0;
/** true se um dos dois bloqueou o outro. */
export const bloqueioEntre = (a, b) =>
  !!q('SELECT 1 FROM bloqueios WHERE (usuario_id = ? AND alvo_id = ?) OR (usuario_id = ? AND alvo_id = ?)').get(a, b, b, a);
export const bloqueadosPor = (uid) =>
  q(`SELECT u.* FROM bloqueios b JOIN usuarios u ON u.id = b.alvo_id
     WHERE b.usuario_id = ? ORDER BY b.criado_em DESC`).all(uid);

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
export function criarSessao(usuarioId, ua) {
  const token = crypto.randomBytes(32).toString('hex');
  const agora = Date.now();
  q('INSERT INTO sessoes (token, usuario_id, criado_em, expira_em, ua, ultimo) VALUES (?, ?, ?, ?, ?, ?)')
    .run(token, usuarioId, agora, agora + DURACAO_SESSAO, typeof ua === 'string' ? ua.slice(0, 300) : null, agora);
  return token;
}
export function usuarioDaSessao(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
  const agora = Date.now();
  const u = q(`SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token = ? AND s.expira_em > ?`).get(token, agora) || null;
  // "visto por último" do aparelho, no máximo 1 escrita a cada 5 min
  if (u) q('UPDATE sessoes SET ultimo = ? WHERE token = ? AND (ultimo IS NULL OR ultimo < ?)').run(agora, token, agora - 300000);
  return u;
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
/** Tira do servidor e limpa cargos e acessos a canais (quem volta pelo convite começa do zero; castigo continua). */
export function removerMembro(sid, uid) {
  transacao(() => {
    q('DELETE FROM membros WHERE servidor_id = ? AND usuario_id = ?').run(sid, uid);
    q('DELETE FROM membro_cargos WHERE usuario_id = ? AND cargo_id IN (SELECT id FROM cargos WHERE servidor_id = ?)').run(uid, sid);
    q('DELETE FROM canal_acesso WHERE usuario_id = ? AND canal_id IN (SELECT id FROM canais WHERE servidor_id = ?)').run(uid, sid);
  });
}
export const membrosDoServidor = (sid) =>
  q(`SELECT u.*, m.cargo AS cargo, m.apelido AS apelido, COALESCE(x.nivel, 1) AS nivel, COALESCE(x.xp, 0) AS xp_total
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
/** Cria o canal num INSERT só (senha/ticket já gravados: o canal nunca existe aberto por um instante). */
export function criarCanal(sid, nome, tipo, espacial, { categoria = null, senhaHash = null, senhaSalt = null, ticketDe = null } = {}) {
  const pos = q('SELECT COALESCE(MAX(posicao), -1) + 1 AS p FROM canais WHERE servidor_id = ?').get(sid).p;
  const privado = senhaHash != null || ticketDe != null ? 1 : 0;
  const r = q(`INSERT INTO canais (servidor_id, nome, tipo, posicao, espacial, categoria, privado, senha_hash, senha_salt, ticket_de, criado_em)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(sid, nome, tipo, pos, espacial ? 1 : 0, categoria, privado, senhaHash, senhaSalt, ticketDe, Date.now());
  return Number(r.lastInsertRowid);
}
export const apagarCanal = (id) => q('DELETE FROM canais WHERE id = ? OR pai_canal = ?').run(id, id); // leva os tópicos junto
export const topicosDoCanal = (id) =>
  q('SELECT c.*, s.dono_id AS dono_id FROM canais c LEFT JOIN servidores s ON s.id = c.servidor_id WHERE c.pai_canal = ?').all(id);
export const topicoDaMensagem = (msgId) => q('SELECT id, nome FROM canais WHERE pai_msg = ?').get(msgId) ?? null;
export function criarTopico(sid, paiCanal, paiMsg, nome) {
  const id = criarCanal(sid, nome, 'texto', false); // tópico = canal de texto com canal-pai
  q('UPDATE canais SET pai_canal = ?, pai_msg = ? WHERE id = ?').run(paiCanal, paiMsg, id);
  return id;
}
export const canalDeAvisos = (sid) =>
  q(`SELECT * FROM canais WHERE servidor_id = ? AND tipo = 'texto'
     ORDER BY (nome = 'geral') DESC, posicao, id LIMIT 1`).get(sid) || null;

export function ehParticipanteDm(canalId, uid) {
  return !!q('SELECT 1 FROM dm_participantes WHERE canal_id = ? AND usuario_id = ?').get(canalId, uid);
}

/** Canal acessível ao usuário (membro do servidor ou participante da DM); lança ErroKali. */
export function acessarCanal(uid, canalId) {
  const canal = canalPorId(canalId);
  if (!canal) throw erro(404, 'Canal não encontrado.');
  const ok = canal.servidor_id != null ? ehMembro(canal.servidor_id, uid) : ehParticipanteDm(canal.id, uid);
  if (!ok) throw erro(403, 'Você não tem acesso a este canal.');
  if (canal.pai_canal) acessarCanal(uid, canal.pai_canal); // tópico herda o acesso do canal-pai
  if (canal.privado && canal.servidor_id != null && !ehStaff(canal.servidor_id, uid) && !temAcessoCanal(canal.id, uid)) {
    throw erro(403, canal.senha_hash ? '🔒 Canal com senha. Digite a senha pra entrar.' : '🔒 Canal privado.');
  }
  return canal;
}

// ---------------------------------------------------------------- DMs
export const dmsDoUsuario = (uid) =>
  q(`SELECT c.id AS canal_id, MIN(o.usuario_id) AS outro_id, c.criado_em AS criado_em
     FROM dm_participantes p
     JOIN canais c ON c.id = p.canal_id AND c.tipo = 'dm'
     JOIN dm_participantes o ON o.canal_id = c.id AND o.usuario_id != p.usuario_id
     WHERE p.usuario_id = ? GROUP BY c.id`).all(uid);
export const dmEntre = (a, b) =>
  q(`SELECT c.id FROM canais c
     JOIN dm_participantes x ON x.canal_id = c.id AND x.usuario_id = ?
     JOIN dm_participantes y ON y.canal_id = c.id AND y.usuario_id = ?
     WHERE c.tipo = 'dm' AND c.nome = 'dm' LIMIT 1`).get(a, b)?.id ?? null;
export const participantesDm = (canalId) =>
  q('SELECT usuario_id FROM dm_participantes WHERE canal_id = ? ORDER BY usuario_id').all(canalId).map((r) => r.usuario_id);
export function criarGrupoDm(ids, nome) {
  return transacao(() => {
    const r = q(`INSERT INTO canais (servidor_id, nome, tipo, posicao, criado_em) VALUES (NULL, ?, 'dm', 0, ?)`).run(nome, Date.now());
    const id = Number(r.lastInsertRowid);
    for (const u of ids) q('INSERT INTO dm_participantes (canal_id, usuario_id) VALUES (?, ?)').run(id, u);
    return id;
  });
}
export const sairDoGrupoDm = (canalId, uid) =>
  q('DELETE FROM dm_participantes WHERE canal_id = ? AND usuario_id = ?').run(canalId, uid).changes > 0;
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
// Imagens enviadas (foto/banner de perfil, ícone/banner de servidor): dados/imagens/<u|s><id>-<tipo>
export const PASTA_IMAGENS = path.join(path.dirname(CAMINHO_DB), 'imagens');
fs.mkdirSync(PASTA_IMAGENS, { recursive: true });
export const urlImagem = (dono, id, tipo, v) => (v ? `/api/imagens/${dono}${id}-${tipo}?v=${v}` : null);
export function marcarImagem(dono, id, tipo, v) {
  const [tabela, coluna] = { 'u-avatar': ['usuarios', 'avatar_v'], 'u-banner': ['usuarios', 'banner_v'], 's-icone': ['servidores', 'icone_v'], 's-banner': ['servidores', 'banner_v'] }[`${dono}-${tipo}`];
  q(`UPDATE ${tabela} SET ${coluna} = ? WHERE id = ?`).run(v, id);
}
const SELECT_MSG = `SELECT m.*, u.usuario AS a_usuario, u.nome AS a_nome, u.cor AS a_cor, u.avatar_v AS a_avatar,
                    u.equip_moldura AS a_moldura, u.equip_cor AS a_cor_item, mb.apelido AS a_apelido
                    FROM mensagens m LEFT JOIN usuarios u ON u.id = m.autor_id
                    LEFT JOIN canais cx ON cx.id = m.canal_id
                    LEFT JOIN membros mb ON mb.servidor_id = cx.servidor_id AND mb.usuario_id = m.autor_id`;

export function inserirMensagem({ canalId, autorId, texto, sistema = false, refCanalId = null,
  audioDuracao = null, transcricao = null, expiraEm = null, respostaA = null, anexo = null, webhookNome = null }) {
  const r = q(`INSERT INTO mensagens (canal_id, autor_id, texto, criado_em, sistema, ref_canal_id,
               audio_duracao, transcricao, expira_em, resposta_a, anexo_nome, anexo_tipo, anexo_tamanho, webhook_nome)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(canalId, autorId, texto, Date.now(), sistema ? 1 : 0, refCanalId, audioDuracao, transcricao, expiraEm,
      respostaA, anexo?.nome ?? null, anexo?.tipo ?? null, anexo?.tamanho ?? null, webhookNome);
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
export function editarMensagem(id, texto) {
  // guarda a versão antiga (histórico de edições)
  const antes = q('SELECT texto FROM mensagens WHERE id = ?').get(id);
  if (antes && antes.texto != null && antes.texto !== texto) q('INSERT INTO mensagem_edicoes (mensagem_id, texto_antigo, editado_em) VALUES (?, ?, ?)').run(id, antes.texto, Date.now());
  return q('UPDATE mensagens SET texto = ?, editado_em = ? WHERE id = ?').run(texto, Date.now(), id);
}
export const apagarMensagem = (id) => q('DELETE FROM mensagens WHERE id = ?').run(id).changes > 0;
export const mensagensExpiradas = (agora) =>
  q(`${SELECT_MSG} WHERE m.expira_em IS NOT NULL AND m.expira_em <= ?`).all(agora);
// Arquivos (áudio/anexo) de um canal e dos tópicos dele, ou de um servidor inteiro: pra apagar do disco junto.
const DO_CANAL_E_TOPICOS = 'canal_id IN (SELECT id FROM canais WHERE id = ? OR pai_canal = ?)';
export const idsAudiosDoCanal = (canalId) =>
  q(`SELECT id FROM mensagens WHERE ${DO_CANAL_E_TOPICOS} AND audio_duracao IS NOT NULL`).all(canalId, canalId).map((r) => r.id);
export const idsAnexosDoCanal = (canalId) =>
  q(`SELECT id FROM mensagens WHERE ${DO_CANAL_E_TOPICOS} AND anexo_nome IS NOT NULL`).all(canalId, canalId).map((r) => r.id);
export const idsAudiosDoServidor = (sid) =>
  q(`SELECT m.id FROM mensagens m JOIN canais c ON c.id = m.canal_id
     WHERE c.servidor_id = ? AND m.audio_duracao IS NOT NULL`).all(sid).map((r) => r.id);
export const idsAnexosDoServidor = (sid) =>
  q(`SELECT m.id FROM mensagens m JOIN canais c ON c.id = m.canal_id
     WHERE c.servidor_id = ? AND m.anexo_nome IS NOT NULL`).all(sid).map((r) => r.id);

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
      ? { id: row.autor_id, usuario: row.a_usuario, nome: row.a_apelido || row.a_nome, cor: row.a_cor, avatar: urlImagem('u', row.autor_id, 'avatar', row.a_avatar),
        moldura: urlItem(row.a_moldura), corNome: corDoItem(row.a_cor_item) }
      : null,
    texto: row.texto,
    criadoEm: row.criado_em,
    editadoEm: row.editado_em ?? null,
    reacoes,
  };
  if (row.webhook_nome) m.webhook = row.webhook_nome;
  if (row.sistema) {
    m.sistema = true;
    if (row.ref_canal_id) m.refCanalId = row.ref_canal_id;
  }
  if (row.audio_duracao != null) {
    m.audio = { url: `/api/audios/${row.id}`, duracao: row.audio_duracao };
    if (row.transcricao) m.transcricao = row.transcricao;
  }
  if (row.expira_em != null) m.expiraEm = row.expira_em;
  if (row.fixada) m.fixada = true;
  const tp = topicoDaMensagem(row.id);
  if (tp) m.topico = tp;
  if (row.anexo_nome != null) {
    m.anexo = { url: `/api/anexos/${row.id}`, nome: row.anexo_nome, tipo: row.anexo_tipo, tamanho: row.anexo_tamanho };
  }
  if (row.resposta_a != null) {
    const o = q(`${SELECT_MSG} WHERE m.id = ?`).get(row.resposta_a);
    m.respostaA = o
      ? { id: o.id, autor: o.a_nome ?? 'KALI', texto: (o.texto || (o.anexo_nome ? '📎 ' + o.anexo_nome : '🎙 áudio')).slice(0, 120) }
      : { id: row.resposta_a, apagada: true };
  }
  return m;
}
export const fixarMensagem = (id, fixar) => q('UPDATE mensagens SET fixada = ? WHERE id = ?').run(fixar ? 1 : 0, id);
export const fixadasDoCanal = (canalId) =>
  q(`${SELECT_MSG} WHERE m.canal_id = ? AND m.fixada = 1 ORDER BY m.id DESC LIMIT 50`).all(canalId);
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
    categoria: row.categoria || null,
    modoLento: row.modo_lento || 0,
    paiCanal: row.pai_canal ?? null,
    paiMsg: row.pai_msg ?? null,
    soStaff: !!row.so_staff,
    palco: !!row.palco,
    forum: !!row.forum,
  };
}
export const configurarCanal = (id, categoria, modoLento) =>
  q('UPDATE canais SET categoria = ?, modo_lento = ? WHERE id = ?').run(categoria, modoLento, id);
export const definirApelido = (sid, uid, apelido) => q('UPDATE membros SET apelido = ? WHERE servidor_id = ? AND usuario_id = ?').run(apelido, sid, uid);
export const ultimaMsgDe = (canalId, uid) =>
  q('SELECT MAX(criado_em) AS t FROM mensagens WHERE canal_id = ? AND autor_id = ?').get(canalId, uid)?.t ?? 0;
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
  const base = { adm: 3, mod: 2 }[r.cargo] || 1;
  if (base >= 3) return base;
  const p = q(`SELECT COALESCE(MAX(c.perm & 2), 0) AS adm, COALESCE(MAX(c.perm & 1), 0) AS mod FROM membro_cargos mc
               JOIN cargos c ON c.id = mc.cargo_id WHERE c.servidor_id = ? AND mc.usuario_id = ?`).get(sid, uid);
  return Math.max(base, p.adm ? 3 : p.mod ? 2 : 1);
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

// ---------------------------------------------------------------- busca, menções, edições, auditoria, banidos, senha, convite novo
db.exec(`
CREATE TABLE IF NOT EXISTS mensagem_edicoes (
  mensagem_id  INTEGER NOT NULL REFERENCES mensagens(id) ON DELETE CASCADE,
  texto_antigo TEXT NOT NULL,
  editado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edicoes_msg ON mensagem_edicoes(mensagem_id);
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  ator_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  acao        TEXT NOT NULL,
  alvo        TEXT,
  detalhe     TEXT,
  criado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auditoria_srv ON auditoria(servidor_id, id);
`);
const escLike = (t) => String(t).replace(/[\\%_]/g, (c) => '\\' + c);
export const edicoesDe = (id) =>
  q('SELECT texto_antigo AS texto, editado_em AS em FROM mensagem_edicoes WHERE mensagem_id = ? ORDER BY editado_em DESC LIMIT 50').all(id);
export const registrarAuditoria = (sid, ator, acao, alvo, detalhe) =>
  q('INSERT INTO auditoria (servidor_id, ator_id, acao, alvo, detalhe, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sid, ator ?? null, acao, alvo == null ? null : String(alvo).slice(0, 120), detalhe == null ? null : String(detalhe).slice(0, 300), Date.now());
export const listarAuditoria = (sid, antes) =>
  q(`SELECT a.id, a.acao, a.alvo, a.detalhe, a.criado_em, u.nome AS ator_nome, u.usuario AS ator_usuario
     FROM auditoria a LEFT JOIN usuarios u ON u.id = a.ator_id
     WHERE a.servidor_id = ? AND a.id < ? ORDER BY a.id DESC LIMIT 60`).all(sid, antes || Number.MAX_SAFE_INTEGER);
export const listarBanidos = (sid) =>
  q(`SELECT b.usuario_id, b.motivo, b.criado_em, u.usuario, u.nome, u.cor, p.nome AS por_nome
     FROM banidos b JOIN usuarios u ON u.id = b.usuario_id LEFT JOIN usuarios p ON p.id = b.por_id
     WHERE b.servidor_id = ? ORDER BY b.criado_em DESC`).all(sid);
export const desbanir = (sid, uid) => q('DELETE FROM banidos WHERE servidor_id = ? AND usuario_id = ?').run(sid, uid).changes > 0;
export const trocarSenha = (uid, hash, salt) => q('UPDATE usuarios SET senha_hash = ?, senha_salt = ? WHERE id = ?').run(hash, salt, uid);
export const apagarOutrasSessoes = (uid, token) => q('DELETE FROM sessoes WHERE usuario_id = ? AND token != ?').run(uid, String(token || '')).changes;
export function trocarConvite(sid) { const c = novoConvite(); q('UPDATE servidores SET convite = ? WHERE id = ?').run(c, sid); return c; }
/** Busca em texto nos canais informados (o chamador já filtrou os que a pessoa enxerga). */
export function buscarMensagens(canalIds, { termo, de, limite = 25, offset = 0 }) {
  if (!canalIds.length) return [];
  const marcas = canalIds.map(() => '?').join(',');
  const args = [...canalIds, '%' + escLike(termo) + '%', Date.now()];
  let extra = '';
  if (de) { extra = ' AND u.usuario = ?'; args.push(de); }
  args.push(limite, offset);
  return q(`${SELECT_MSG} WHERE m.canal_id IN (${marcas}) AND m.texto LIKE ? ESCAPE '\\' AND (m.expira_em IS NULL OR m.expira_em > ?)${extra}
            ORDER BY m.id DESC LIMIT ? OFFSET ?`).all(...args);
}
/** 25 antes (incluindo a própria) e 25 depois de uma mensagem: pra pular até ela. */
export function mensagensAoRedor(canalId, id) {
  const agora = Date.now();
  const antes = q(`${SELECT_MSG} WHERE m.canal_id = ? AND m.id <= ? AND (m.expira_em IS NULL OR m.expira_em > ?) ORDER BY m.id DESC LIMIT 25`).all(canalId, id, agora).reverse();
  const depois = q(`${SELECT_MSG} WHERE m.canal_id = ? AND m.id > ? AND (m.expira_em IS NULL OR m.expira_em > ?) ORDER BY m.id ASC LIMIT 25`).all(canalId, id, agora);
  return [...antes, ...depois];
}
/** Menções a @usuario não lidas, por canal do servidor (sobrevive ao F5). */
export function mencoesDoServidor(uid, usuario, sid) {
  const rows = q(`SELECT c.id AS canal_id, COUNT(m.id) AS n
                  FROM canais c
                  LEFT JOIN lidos l ON l.canal_id = c.id AND l.usuario_id = ?
                  JOIN mensagens m ON m.canal_id = c.id AND m.id > COALESCE(l.ultima_msg_id, 0)
                       AND (m.autor_id IS NULL OR m.autor_id != ?) AND (m.expira_em IS NULL OR m.expira_em > ?)
                       AND m.texto LIKE ? ESCAPE '\\'
                  WHERE c.servidor_id = ? AND c.tipo IN ('texto', 'assistir')
                  GROUP BY c.id`).all(uid, uid, Date.now(), '%@' + escLike(usuario) + '%', sid);
  const r = {};
  for (const x of rows) if (x.n) r[x.canal_id] = x.n;
  return r;
}

/** Nova ordem/categoria dos canais (só canais do próprio servidor, sem tópicos). */
export function reordenarCanais(sid, ordem) {
  transacao(() => {
    for (const it of ordem) q('UPDATE canais SET posicao = ?, categoria = ? WHERE id = ? AND servidor_id = ? AND pai_canal IS NULL').run(it.posicao, it.categoria, it.id, sid);
  });
}

// ---------------------------------------------------------------- convites com validade/usos, aparelhos, em comum
db.exec(`
CREATE TABLE IF NOT EXISTS convites (
  codigo      TEXT PRIMARY KEY,
  servidor_id INTEGER NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
  criador_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  expira_em   INTEGER,
  max_usos    INTEGER,
  usos        INTEGER NOT NULL DEFAULT 0,
  criado_em   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_convites_srv ON convites(servidor_id);
`);
export function criarConviteTemporario(sid, criador, expiraEm, maxUsos) {
  let c;
  do { c = novoConvite(); } while (q('SELECT 1 FROM convites WHERE codigo = ?').get(c));
  q('INSERT INTO convites (codigo, servidor_id, criador_id, expira_em, max_usos, criado_em) VALUES (?, ?, ?, ?, ?, ?)').run(c, sid, criador, expiraEm, maxUsos, Date.now());
  return c;
}
/** Convite temporário válido → servidor (e conta 1 uso). null se não existe, venceu ou acabou. */
export function usarConviteTemporario(codigo) {
  const cv = q('SELECT * FROM convites WHERE codigo = ?').get(codigo);
  if (!cv) return null;
  if ((cv.expira_em && cv.expira_em <= Date.now()) || (cv.max_usos && cv.usos >= cv.max_usos)) return null;
  q('UPDATE convites SET usos = usos + 1 WHERE codigo = ?').run(codigo);
  return servidorPorId(cv.servidor_id);
}
export const convitesDoServidor = (sid) =>
  q(`SELECT c.*, u.nome AS criador_nome FROM convites c LEFT JOIN usuarios u ON u.id = c.criador_id
     WHERE c.servidor_id = ? AND (c.expira_em IS NULL OR c.expira_em > ?) AND (c.max_usos IS NULL OR c.usos < c.max_usos)
     ORDER BY c.criado_em DESC`).all(sid, Date.now());
export const apagarConvite = (sid, codigo) => q('DELETE FROM convites WHERE servidor_id = ? AND codigo = ?').run(sid, codigo).changes > 0;
export const sessoesDe = (uid) =>
  q('SELECT token, ua, criado_em, ultimo FROM sessoes WHERE usuario_id = ? AND expira_em > ? ORDER BY COALESCE(ultimo, criado_em) DESC').all(uid, Date.now());
export const servidoresEmComum = (a, b) =>
  q(`SELECT s.id, s.nome FROM membros x JOIN membros y ON y.servidor_id = x.servidor_id AND y.usuario_id = ?
     JOIN servidores s ON s.id = x.servidor_id WHERE x.usuario_id = ? ORDER BY s.nome COLLATE NOCASE`).all(b, a);
export function amigosEmComum(a, b) {
  const meus = new Set(amigosDe(a));
  return amigosDe(b).filter((id) => meus.has(id)).map((id) => usuarioPorId(id)).filter(Boolean).map((u) => ({ id: u.id, nome: u.nome, usuario: u.usuario }));
}

// ---------------------------------------------------------------- canais especiais, permissões, webhooks, agendadas, atividade
// cargos.perm (a tabela cargos é criada depois da lista de migrações lá de cima)
if (!db.prepare('PRAGMA table_info(cargos)').all().some((c) => c.name === 'perm')) db.exec('ALTER TABLE cargos ADD COLUMN perm INTEGER NOT NULL DEFAULT 0');
export const configurarCanalExtra = (id, soStaff, palco, forum) =>
  q('UPDATE canais SET so_staff = ?, palco = ?, forum = ? WHERE id = ?').run(soStaff ? 1 : 0, palco ? 1 : 0, forum ? 1 : 0, id);
export const definirPermCargo = (id, perm) => q('UPDATE cargos SET perm = ? WHERE id = ?').run(perm, id);
/** Pode usar @todos/@aqui: staff ou cargo com a permissão 4. */
export function podeMencionarTodos(sid, uid) {
  if (nivelCargo(sid, uid) >= 2) return true;
  return !!q(`SELECT 1 FROM membro_cargos mc JOIN cargos c ON c.id = mc.cargo_id WHERE c.servidor_id = ? AND mc.usuario_id = ? AND (c.perm & 4) != 0`).get(sid, uid);
}
db.exec(`
CREATE TABLE IF NOT EXISTS webhooks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  canal_id   INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  nome       TEXT NOT NULL,
  criador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agendadas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  canal_id  INTEGER NOT NULL REFERENCES canais(id) ON DELETE CASCADE,
  autor_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto     TEXT NOT NULL,
  enviar_em INTEGER NOT NULL,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agendadas_quando ON agendadas(enviar_em);
`);
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
export function criarWebhook(canalId, nome, criador) {
  const token = crypto.randomBytes(24).toString('hex');
  const r = q('INSERT INTO webhooks (canal_id, token_hash, nome, criador_id, criado_em) VALUES (?, ?, ?, ?, ?)').run(canalId, hashToken(token), nome, criador, Date.now());
  return { id: Number(r.lastInsertRowid), token };
}
export const webhooksDoCanal = (canalId) => q('SELECT id, nome, criado_em FROM webhooks WHERE canal_id = ? ORDER BY id').all(canalId);
export const webhookPorId = (id) => q('SELECT * FROM webhooks WHERE id = ?').get(id) || null;
export const apagarWebhook = (id) => q('DELETE FROM webhooks WHERE id = ?').run(id).changes > 0;
export function conferirTokenWebhook(wh, token) {
  const a = Buffer.from(wh.token_hash, 'hex'), b = Buffer.from(hashToken(token), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const criarAgendada = (canalId, autor, texto, quando) =>
  Number(q('INSERT INTO agendadas (canal_id, autor_id, texto, enviar_em, criado_em) VALUES (?, ?, ?, ?, ?)').run(canalId, autor, texto, quando, Date.now()).lastInsertRowid);
export const agendadasDe = (uid) =>
  q(`SELECT a.id, a.canal_id, a.texto, a.enviar_em, c.nome AS canal_nome, s.nome AS servidor_nome FROM agendadas a
     JOIN canais c ON c.id = a.canal_id LEFT JOIN servidores s ON s.id = c.servidor_id WHERE a.autor_id = ? ORDER BY a.enviar_em`).all(uid);
export const contarAgendadas = (uid) => q('SELECT COUNT(*) AS n FROM agendadas WHERE autor_id = ?').get(uid).n;
export const apagarAgendada = (id, uid) => q('DELETE FROM agendadas WHERE id = ? AND autor_id = ?').run(id, uid).changes > 0;
export const agendadasVencidas = (agora) => q('SELECT * FROM agendadas WHERE enviar_em <= ? ORDER BY enviar_em LIMIT 50').all(agora);
export const tirarAgendada = (id) => q('DELETE FROM agendadas WHERE id = ?').run(id);
/** Mapa de calor: mensagens por dia da semana (0=dom) e hora, últimos 30 dias. */
export const atividadeServidor = (sid) =>
  q(`SELECT CAST(strftime('%w', m.criado_em / 1000, 'unixepoch', 'localtime') AS INTEGER) AS d,
            CAST(strftime('%H', m.criado_em / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, COUNT(*) AS n
     FROM mensagens m JOIN canais c ON c.id = m.canal_id
     WHERE c.servidor_id = ? AND m.criado_em > ? AND m.autor_id IS NOT NULL GROUP BY d, h`).all(sid, Date.now() - 30 * 86400000);
