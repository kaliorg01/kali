// Prévia de link (título, descrição, imagem) com proteção contra SSRF:
// o IP é conferido no momento da conexão (lookup próprio), então nem DNS que muda nem redirecionamento
// conseguem levar o servidor pra rede interna (PC do host, roteador, 127.0.0.1, 10.x, 192.168.x...).
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return ipPrivado(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') ||
    v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff') || v.startsWith('64:ff9b');
}
// lookup que só deixa conectar em IP público
function lookupSeguro(host, opts, cb) {
  // O Node pode pedir todos os endereços (autoSelectFamily) ou só um: tratamos os dois casos.
  dns.lookup(host, { ...opts, all: true }, (err, lista) => {
    if (err) return cb(err);
    if (!lista.length || lista.some((x) => ipPrivado(x.address))) return cb(new Error('Endereço interno bloqueado.'));
    if (opts && opts.all) return cb(null, lista);
    cb(null, lista[0].address, lista[0].family);
  });
}

/** Baixa até `max` bytes de uma URL pública. Segue até 3 redirecionamentos (cada um conferido de novo). */
export function buscarSeguro(url, { max = 600_000, tempo = 5000, redirs = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(new Error('Link inválido.')); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error('Link inválido.'));
    if (u.username || u.password) return reject(new Error('Link inválido.'));
    if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) return reject(new Error('Porta não permitida.'));
    // IP escrito direto no link não passa pelo lookup: confere aqui.
    const hostIp = u.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(hostIp) && ipPrivado(hostIp)) return reject(new Error('Endereço interno bloqueado.'));
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) return reject(new Error('Endereço interno bloqueado.'));
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { lookup: lookupSeguro, timeout: tempo, headers: { 'User-Agent': 'KALI-previa/1.0 (+link preview)', Accept: 'text/html,image/*;q=0.9,*/*;q=0.5' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirs <= 0) return reject(new Error('Redirecionamentos demais.'));
        return buscarSeguro(new URL(res.headers.location, u).href, { max, tempo, redirs: redirs - 1 }).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('O site respondeu ' + res.statusCode + '.')); }
      const partes = []; let total = 0;
      res.on('data', (c) => { total += c.length; if (total > max) { partes.push(c.subarray(0, c.length - (total - max))); res.destroy(); } else partes.push(c); });
      res.on('close', () => resolve({ corpo: Buffer.concat(partes), tipo: String(res.headers['content-type'] || '').toLowerCase(), url: u.href }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('O site demorou demais.')));
    req.on('error', reject);
  });
}

const ent = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
function meta(html, nomes) {
  for (const n of nomes) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const v = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (v && v.trim()) return ent(v.trim());
  }
  return null;
}

const cache = new Map(); // url → { quando, dados }
export async function previaDe(url) {
  const c = cache.get(url);
  if (c && Date.now() - c.quando < 3600e3) return c.dados;
  let dados = null;
  try {
    const r = await buscarSeguro(url);
    if (r.tipo.includes('text/html')) {
      const html = r.corpo.toString('utf8');
      const titulo = meta(html, ['og:title', 'twitter:title']) || ent(html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() || '');
      if (titulo) {
        let imagem = meta(html, ['og:image', 'og:image:url', 'twitter:image']);
        try { imagem = imagem ? new URL(imagem, r.url).href : null; } catch { imagem = null; }
        dados = {
          url, titulo: titulo.slice(0, 200),
          descricao: (meta(html, ['og:description', 'description', 'twitter:description']) || '').slice(0, 300),
          site: (meta(html, ['og:site_name']) || new URL(r.url).hostname).slice(0, 60),
          imagem: imagem && /^https?:/.test(imagem) ? imagem : null,
        };
      }
    }
  } catch { dados = null; }
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(url, { quando: Date.now(), dados });
  return dados;
}
