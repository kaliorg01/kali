// Verificação em duas etapas (TOTP, RFC 6238): o mesmo código de 6 dígitos do Google Authenticator / Authy.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function gerarSegredo() {
  const bytes = crypto.randomBytes(20);
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function base32(s) {
  let bits = '';
  for (const ch of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(ch); if (v < 0) continue; bits += v.toString(2).padStart(5, '0'); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function codigoEm(segredo, passo) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(passo));
  const hm = crypto.createHmac('sha1', base32(segredo)).update(buf).digest();
  const o = hm[hm.length - 1] & 0xf;
  const n = ((hm[o] & 0x7f) << 24) | (hm[o + 1] << 16) | (hm[o + 2] << 8) | hm[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
/** Aceita o código atual e um passo pra trás/frente (relógio do celular um pouco errado). */
export function conferirCodigo(segredo, codigo) {
  if (!segredo || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) return false;
  const passo = Math.floor(Date.now() / 30000);
  const alvo = Buffer.from(codigo.trim());
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(codigoEm(segredo, passo + d)), alvo));
}
export const urlApp = (usuario, segredo) => `otpauth://totp/KALI:${encodeURIComponent(usuario)}?secret=${segredo}&issuer=KALI&digits=6&period=30`;
/** 8 códigos de recuperação (uso único). Guarda só o hash. */
export function gerarRecuperacao() {
  const codigos = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-'));
  return { codigos, hashes: codigos.map(hashRec) };
}
export const hashRec = (c) => crypto.createHash('sha256').update(String(c).toUpperCase().replace(/[^A-F0-9]/g, '')).digest('hex');
