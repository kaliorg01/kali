// Senhas (scrypt), sessões por cookie e autenticação do socket.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { usuarioDaSessao } from './db.js';

const scrypt = promisify(crypto.scrypt);
const TAMANHO_HASH = 64;
export const COOKIE = 'aura_sid';
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

/** Middleware do socket.io: autentica pelo cookie aura_sid do handshake. */
export function autenticarSocket(socket, next) {
  try {
    const token = lerCookies(socket.request.headers.cookie)[COOKIE];
    const usuario = token ? usuarioDaSessao(token) : null;
    if (!usuario) return next(new Error('nao-autorizado'));
    socket.data.usuarioId = usuario.id;
    socket.data.token = token;
    next();
  } catch {
    next(new Error('nao-autorizado'));
  }
}

// Limite simples de tentativas de login erradas por nome de usuário.
const tentativas = new Map();
const JANELA_TENTATIVAS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;
export function loginBloqueado(usuario) {
  const t = tentativas.get(usuario);
  if (!t) return false;
  if (Date.now() - t.desde > JANELA_TENTATIVAS) {
    tentativas.delete(usuario);
    return false;
  }
  return t.falhas >= MAX_TENTATIVAS;
}
export function registrarFalhaLogin(usuario) {
  const agora = Date.now();
  const t = tentativas.get(usuario);
  if (!t || agora - t.desde > JANELA_TENTATIVAS) tentativas.set(usuario, { falhas: 1, desde: agora });
  else t.falhas++;
  if (tentativas.size > 10_000) tentativas.clear();
}
export const limparFalhasLogin = (usuario) => tentativas.delete(usuario);
