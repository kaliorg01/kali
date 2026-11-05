// Senhas (scrypt), sessões por cookie e autenticação do socket.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { usuarioDaSessao } from './db.js';

const scrypt = promisify(crypto.scrypt);
const TAMANHO_HASH = 64;
export const COOKIE = 'kali_sid';
const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

export async function gerarHash(senha) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(senha, salt, TAMANHO_HASH);
  return { hash: hash.toString('hex'), salt: salt.toString('hex') };
}

export async function conferirSenha(senha, hashHex, saltHex) {
  const calculado = await scrypt(senha, Buffer.from(saltHex, 'hex'), TAMANHO_HASH);
  const esperado = Buffer.from(hashHex, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(calculado, esperado);
}

// Hash fixo usado quando o usuário não existe, para o tempo de resposta não revelar isso.
const HASH_FALSO = { hash: '00'.repeat(TAMANHO_HASH), salt: '00'.repeat(16) };
export async function conferirSenhaOuFingir(senha, usuarioRow) {
  if (!usuarioRow) {
    await conferirSenha(senha, HASH_FALSO.hash, HASH_FALSO.salt);
    return false;
  }
  return conferirSenha(senha, usuarioRow.senha_hash, usuarioRow.senha_salt);
}

export function lerCookies(cabecalho) {
  const cookies = {};
  if (typeof cabecalho !== 'string') return cookies;
  for (const parte of cabecalho.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    let valor = parte.slice(i + 1).trim();
    if (valor.startsWith('"') && valor.endsWith('"')) valor = valor.slice(1, -1);
    try {
      cookies[nome] = decodeURIComponent(valor);
    } catch {
      cookies[nome] = valor;
    }
  }
  return cookies;
}

export function definirCookieSessao(req, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRINTA_DIAS,
    secure: req.secure,
  });
}

export function limparCookieSessao(req, res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/', secure: req.secure });
}

export function tokenDaRequisicao(req) {
  const a = req.headers.authorization;
  if (typeof a === 'string' && /^Bot [0-9a-f]{64}$/.test(a)) return a.slice(4); // bots: Authorization: Bot <token>
  return lerCookies(req.headers.cookie)[COOKIE] || null;
}

export function exigirLogin(req, res, next) {
  const token = tokenDaRequisicao(req);
  const usuario = token ? usuarioDaSessao(token) : null;
  if (!usuario) {
    res.status(401).json({ erro: 'Você precisa entrar na sua conta.' });
    return;
  }
  req.usuario = usuario;
  req.token = token;
  next();
}

/** Middleware do socket.io: autentica pelo cookie kali_sid do handshake. */
export function autenticarSocket(socket, next) {
  try {
    const tb = socket.handshake && socket.handshake.auth && socket.handshake.auth.botToken;
    const token = typeof tb === 'string' && /^[0-9a-f]{64}$/.test(tb) ? tb : lerCookies(socket.request.headers.cookie)[COOKIE];
    const usuario = token ? usuarioDaSessao(token) : null;
    if (!usuario) return next(new Error('nao-autorizado'));
    socket.data.usuarioId = usuario.id;
    socket.data.token = token;
    next();
  } catch {
    next(new Error('nao-autorizado'));
  }
}

/**
 * Limitador genérico por chave (janela fixa a partir da 1ª ocorrência).
 * Guarda no máximo `maxChaves` entradas: quando passa disso, tira primeiro as vencidas,
 * depois as que ainda não bloquearam (mais antigas primeiro) e só por último as bloqueadas.
 * Assim, encher o Map com chaves novas não "solta" quem já está bloqueado.
 */
export function criarLimitador({ janela, max, maxChaves = 10_000 }) {
  const mapa = new Map(); // chave → {n, desde}
  const vencida = (t, agora) => agora - t.desde > janela;
  function podar(agora) {
    if (mapa.size <= maxChaves) return;
    for (const [k, t] of mapa) if (vencida(t, agora)) mapa.delete(k);
    if (mapa.size <= maxChaves) return;
    for (const [k, t] of mapa) {
      if (mapa.size <= maxChaves) return;
      if (t.n < max) mapa.delete(k);
    }
    for (const k of mapa.keys()) {
      if (mapa.size <= maxChaves) return;
      mapa.delete(k);
    }
  }
  const lim = {
    /** true se a chave estourou o limite dentro da janela. */
    bloqueado(chave) {
      const t = mapa.get(chave);
      if (!t) return false;
      if (vencida(t, Date.now())) {
        mapa.delete(chave);
        return false;
      }
      return t.n >= max;
    },
    /** Conta uma ocorrência (falha, envio…) para a chave. */
    registrar(chave) {
      const agora = Date.now();
      const t = mapa.get(chave);
      if (!t || vencida(t, agora)) {
        mapa.delete(chave); // reinsere no fim (ordem de inserção = idade)
        mapa.set(chave, { n: 1, desde: agora });
        podar(agora);
      } else {
        t.n++;
      }
    },
    /** Checa e conta de uma vez: false se já estava no limite (não conta). */
    tentar(chave) {
      if (lim.bloqueado(chave)) return false;
      lim.registrar(chave);
      return true;
    },
    limpar: (chave) => mapa.delete(chave),
    get tamanho() { return mapa.size; },
  };
  return lim;
}

// Login: limite por nome de usuário (10 falhas / 15 min) e por IP (30 falhas / 15 min).
const QUINZE_MIN = 15 * 60 * 1000;
const MAX_CHAVES_LOGIN = Number(process.env.KALI_LOGIN_MAX_CHAVES) || 10_000;
const falhasPorUsuario = criarLimitador({ janela: QUINZE_MIN, max: 10, maxChaves: MAX_CHAVES_LOGIN });
const falhasPorIp = criarLimitador({ janela: QUINZE_MIN, max: 30, maxChaves: MAX_CHAVES_LOGIN });
const RE_LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;
/**
 * IP de quem fez a requisição. Só confia em CF-Connecting-IP / X-Forwarded-For quando a conexão
 * vem da própria máquina (túnel/proxy local); de fora, vale o endereço do socket.
 */
export function ipDaRequisicao(req) {
  const direto = req.socket?.remoteAddress || req.ip || 'desconhecido';
  if (RE_LOOPBACK.test(direto)) {
    const cab = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
    if (typeof cab === 'string' && cab.trim()) return cab.split(',')[0].trim().slice(0, 64);
  }
  return direto;
}
export const loginBloqueado = (usuario, ip) => falhasPorUsuario.bloqueado(usuario) || (ip != null && falhasPorIp.bloqueado(ip));
export function registrarFalhaLogin(usuario, ip) {
  if (usuario != null) falhasPorUsuario.registrar(usuario);
  if (ip != null) falhasPorIp.registrar(ip);
}
export const limparFalhasLogin = (usuario) => falhasPorUsuario.limpar(usuario);
