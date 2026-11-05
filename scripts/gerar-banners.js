// Gera banners GIF animados ORIGINAIS da KALI (tudo desenhado por código, sem imagem de terceiros).
// Saem como rascunho em dados/rascunhos/: o dono vê no /painel e escolhe nome/preço pra mandar pra loja.
//   node scripts/gerar-banners.js            → gera todos
//   node scripts/gerar-banners.js aurora fogo → gera só esses
import fs from 'node:fs';
import path from 'node:path';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 600, H = 200, QUADROS = 30, ATRASO = 60; // 30 quadros × 60 ms ≈ 1,8 s em loop perfeito
const PASTA = path.join(path.dirname(process.env.KALI_DB || path.join(process.cwd(), 'dados', 'kali.db')), 'rascunhos');
const TAU = Math.PI * 2;

// ---------- utilidades ----------
const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const fr = (x) => x - Math.floor(x);
const hash = (n) => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const grad = (paradas, k) => { // paradas: [[pos, '#rrggbb'], ...]
  k = Math.max(0, Math.min(1, k));
  for (let i = 1; i < paradas.length; i++) if (k <= paradas[i][0]) { const [p0, c0] = paradas[i - 1], [p1, c1] = paradas[i]; return mix(hex(c0), hex(c1), (k - p0) / (p1 - p0 || 1)); }
  return hex(paradas[paradas.length - 1][1]);
};
const brilho = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const somar = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// fonte 5×7 pra escrever palavras grandes
const FONTE = {
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
function mascaraTexto(txt, escala) { // devolve (x,y) → 0/1, centralizado
  const lw = 6 * escala, tw = txt.length * lw - escala, th = 7 * escala, x0 = (W - tw) / 2, y0 = (H - th) / 2;
  return (x, y) => {
    const i = Math.floor((x - x0) / lw), col = Math.floor(((x - x0) % lw) / escala), lin = Math.floor((y - y0) / escala);
    if (i < 0 || i >= txt.length || lin < 0 || lin > 6 || col > 4 || x < x0) return 0;
    return FONTE[txt[i]][lin][col] === '1' ? 1 : 0;
  };
}

// ---------- os banners ----------
const BANNERS = {
  synthwave: { nome: 'Synthwave Sunset', preco: 990, f(x, y, t) {
    const hor = 118;
    if (y < hor) {
      let c = grad([[0, '#12002b'], [0.6, '#5b0a6e'], [1, '#ff2d8a']], y / hor);
      if (hash(Math.floor(x / 3) * 7 + Math.floor(y / 3)) > 0.995 && y < 70) c = brilho([255, 255, 255], 0.55 + 0.45 * Math.sin(TAU * (t + hash(x * 3 + y))));
      const dx = x - W / 2, dy = y - 92, r = Math.hypot(dx, dy * 1.05);
      if (r < 62) { const faixa = y > 80 && ((y + t * 16) % 10) < 3.2; if (!faixa) c = grad([[0, '#ffe36e'], [1, '#ff3d9a']], (y - 30) / 62); }
      else if (r < 90) c = somar(c, brilho(hex('#ff4fb8'), (1 - (r - 62) / 28) * 0.35));
      return c;
    }
    const d = (y - hor) / (H - hor), z = 1 / (d + 0.05);
    const gx = Math.abs(fr((x - W / 2) / W * z * 3) - 0.5) < 0.04 * (1 + d);
    const gz = Math.abs(fr(z * 0.6 + t) - 0.5) < 0.06;
    let c = grad([[0, '#2a0040'], [1, '#08000f']], d);
    if (gx || gz) c = mix(hex('#ff2df0'), hex('#29e6ff'), d);
    return c;
  } },
  aurora: { nome: 'Aurora Boreal', preco: 990, f(x, y, t) {
    let c = grad([[0, '#020611'], [1, '#071a2c']], y / H);
    const s = hash(Math.floor(x / 2) * 13 + Math.floor(y / 2) * 7);
    if (s > 0.993) c = brilho([255, 255, 255], 0.5 + 0.5 * Math.sin(TAU * (t + s * 9)));
    for (let k = 0; k < 3; k++) {
      const yc = 70 + k * 18 + 18 * Math.sin(x / (90 + k * 30) + TAU * t + k * 2) + 10 * Math.sin(x / 37 - TAU * t);
      const dist = (y - yc) / (26 + k * 8);
      if (dist < 1.5 && dist > -3) {
        const a = Math.exp(-dist * dist * 1.6) * (0.55 + 0.45 * Math.sin(x / 23 + TAU * t * 2 + k));
        c = somar(c, brilho(k === 1 ? hex('#ff4fd8') : k === 2 ? hex('#7c5cff') : hex('#2dffa6'), a * 0.85));
      }
    }
    if (y > H - 26 + 6 * Math.sin(x / 60) + 4 * Math.sin(x / 17)) c = hex('#01040a');
    return c;
  } },
  matrix: { nome: 'Chuva Hacker', preco: 790, f(x, y, t) {
    const col = Math.floor(x / 10), lin = Math.floor(y / 12);
    const vel = 1 + Math.floor(hash(col) * 3), fase = hash(col + 99);
    const cab = fr(fase - t * vel) * 1.6; // cabeça da gota (0..1.6 da altura)
    const pos = y / H, rabo = cab - pos;
    let c = [0, 6, 2];
    if (rabo >= 0 && rabo < 0.55) {
      const liga = hash(col * 31 + lin * 17 + Math.floor(t * QUADROS / 3)) > 0.35;
      const gx = x % 10, gy = y % 12;
      if (liga && gx > 1 && gx < 8 && gy > 1 && gy < 10 && hash(col * 7 + lin * 3 + gx + gy * 9) > 0.45) c = rabo < 0.04 ? [200, 255, 210] : brilho([30, 255, 90], 1 - rabo / 0.55);
    }
    return c;
  } },
  galaxia: { nome: 'Galáxia Espiral', preco: 1290, f(x, y, t) {
    const dx = (x - W / 2) / 120, dy = (y - H / 2) / 60, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const braco = Math.sin(a * 2 - Math.log(r + 0.05) * 4 + TAU * t);
    let c = brilho(grad([[0, '#ffffff'], [0.15, '#ffd1f5'], [0.4, '#9a4dff'], [1, '#05010d']], r / 2.2), Math.max(0.08, 1 - r / 2.4));
    c = somar(c, brilho(hex('#ff5fd2'), Math.max(0, braco) * Math.max(0, 1 - r / 2) * 0.6));
    const s = hash(Math.floor(x) * 3 + Math.floor(y) * 1031);
    if (s > 0.996) c = brilho([255, 255, 255], 0.4 + 0.6 * fr(s * 50 + t));
    return c;
  } },
  plasma: { nome: 'Plasma Neon', preco: 790, f(x, y, t) {
    const p = TAU * t;
    const v = Math.sin(x / 31 + p) + Math.sin(y / 23 - p) + Math.sin((x + y) / 41 + p) + Math.sin(Math.hypot(x - 300, y - 100) / 27 - p);
    return grad([[0, '#14002e'], [0.3, '#ff2d95'], [0.55, '#7a3cff'], [0.8, '#19e3ff'], [1, '#14002e']], fr(v / 8 + 0.5 + t));
  } },
  fogo: { nome: 'Chamas', preco: 990, f(x, y, t) {
    const p = TAU * t, k = 1 - y / H;
    const n = Math.sin(x / 13 + p * 2) * 0.5 + Math.sin(x / 7 - p * 3 + y / 9) * 0.3 + Math.sin(x / 29 + y / 17 + p) * 0.4;
    const alt = 0.45 + 0.18 * n + 0.08 * Math.sin(x / 50 - p);
    const q = (alt - k) / alt;
    if (q < -0.15) return grad([[0, '#0a0000'], [1, '#1a0300']], k);
    return grad([[0, '#1a0300'], [0.15, '#a30d00'], [0.45, '#ff5a00'], [0.75, '#ffc23a'], [1, '#fff6d2']], Math.max(0, q));
  } },
  oceano: { nome: 'Ondas Profundas', preco: 690, f(x, y, t) {
    let c = grad([[0, '#06203d'], [1, '#00070f']], y / H);
    for (let k = 0; k < 5; k++) {
      const yw = 40 + k * 32 + 10 * Math.sin(x / (40 + k * 12) + TAU * t * (k % 2 ? 1 : -1)) + 6 * Math.sin(x / 19 + TAU * t + k);
      if (y > yw) c = mix(c, grad([[0, '#19d3ff'], [1, '#0a3cff']], k / 5), 0.18);
      if (Math.abs(y - yw) < 1.6) c = somar(c, brilho(hex('#bff6ff'), 0.5));
    }
    return c;
  } },
  glitch: { nome: 'KALI Glitch', preco: 1490, f(x, y, t) {
    const q = Math.floor(t * QUADROS);
    const corte = hash(Math.floor(y / 9) + q * 13) > 0.8 && (q % 10 === 3 || q % 10 === 4) ? (hash(y + q) - 0.5) * 34 : 0;
    const m = mascaraTexto('KALI', 14);
    const xs = x + corte;
    const rr = m(xs - 4, y), gg = m(xs, y), bb = m(xs + 4, y);
    let c = grad([[0, '#05010a'], [1, '#12021f']], y / H);
    if (rr || gg || bb) c = [rr ? 255 : 30, gg ? 255 : 20, bb ? 255 : 60];
    if (gg && rr && bb) c = mix([255, 255, 255], hex('#ff4fb8'), 0.25 + 0.25 * Math.sin(TAU * t * 2));
    if (y % 4 === 0) c = brilho(c, 0.7);
    if (hash(x * 7 + y * 13 + q * 91) > 0.997) c = [180, 180, 200];
    return c;
  } },
  raios: { nome: 'Tempestade', preco: 990, f(x, y, t) {
    const q = Math.floor(t * QUADROS);
    const flash = q === 6 || q === 8 || q === 21 ? 1 : 0;
    let c = grad([[0, '#0b0c1a'], [1, '#1b1f3a']], y / H);
    const nuvem = Math.sin(x / 40 + TAU * t) * 0.5 + Math.sin(x / 17 - TAU * t) * 0.3 + Math.sin(x / 73) * 0.6;
    if (y < 60 + nuvem * 18) c = mix(c, hex('#2b2f52'), 0.6);
    const raio = (cx) => { let xx = cx; for (let yy = 0; yy < y; yy += 8) xx += (hash(yy * 3 + cx) - 0.5) * 14; return Math.abs(x - xx) < 1.8; };
    if ((q >= 6 && q <= 8) && y > 40 && raio(210)) c = [230, 230, 255];
    if ((q >= 21 && q <= 22) && y > 40 && raio(430)) c = [255, 210, 255];
    if (flash) c = mix(c, [200, 200, 255], 0.35);
    return c;
  } },
  hexagonos: { nome: 'Colmeia Pulsante', preco: 790, f(x, y, t) {
    const s = 18, hx = x / (s * 1.5), r = Math.round(hx), yy = y / (s * 1.732) - (r % 2 ? 0.5 : 0), q = Math.round(yy);
    const cx = r * s * 1.5, cy = (q + (r % 2 ? 0.5 : 0)) * s * 1.732;
    const d = Math.max(Math.abs(x - cx) * 1.15, Math.abs(y - cy));
    const onda = 0.5 + 0.5 * Math.sin(Math.hypot(cx - 300, cy - 100) / 40 - TAU * t);
    let c = brilho(grad([[0, '#ff2d95'], [0.5, '#9b3cff'], [1, '#19e3ff']], fr(cx / 600 + t)), 0.15 + onda * 0.85);
    if (d > s * 0.78) c = brilho(c, 0.15);
    return d > s * 0.92 ? [6, 4, 14] : c;
  } },
  cidade: { nome: 'Cidade Neon na Chuva', preco: 1290, f(x, y, t) {
    let c = grad([[0, '#140024'], [0.7, '#3a0a4f'], [1, '#ff2d8a']], y / H);
    const b = Math.floor(x / 34), alt = 60 + hash(b) * 110, b2 = Math.floor((x + 17) / 22), alt2 = 30 + hash(b2 + 50) * 70;
    if (y > H - alt2) c = hex('#1a0b2e');
    if (y > H - alt) {
      c = hex('#0b0614');
      const jx = x % 34, jy = Math.floor(y / 7);
      if (jx > 5 && jx < 29 && (jx % 6) < 3 && y % 7 < 4 && hash(b * 17 + jy + Math.floor(jx / 6)) > 0.55) c = hash(b + jy) > 0.5 ? hex('#ff4fd8') : hex('#29e6ff');
    }
    const gota = fr((x * 0.37 + y * 0.9) / 30 - t * 3);
    if (hash(Math.floor(x / 3) * 11) > 0.7 && gota < 0.06) c = mix(c, [190, 210, 255], 0.55);
    return c;
  } },
  bokeh: { nome: 'Bokeh Rosa', preco: 690, f(x, y, t) {
    let c = grad([[0, '#1a0012'], [1, '#05000a']], y / H);
    for (let i = 0; i < 22; i++) {
      const bx = hash(i) * W, vel = 1 + Math.floor(hash(i + 7) * 2), by = H + 30 - fr(hash(i + 3) + t * vel) * (H + 60), r = 10 + hash(i + 11) * 26;
      const d = Math.hypot(x - bx, y - by) / r;
      if (d < 1) c = somar(c, brilho(hash(i + 5) > 0.5 ? hex('#ff4fb8') : hex('#b06bff'), (d > 0.85 ? 0.5 : 0.22)));
    }
    return c;
  } },
  tunel: { nome: 'Túnel Hipnótico', preco: 990, f(x, y, t) {
    const dx = (x - W / 2), dy = (y - H / 2) * 1.6, r = Math.hypot(dx, dy) + 1, a = Math.atan2(dy, dx);
    const u = 60 / r * 6 + t * 2, v = a / TAU * 8 + t;
    const xadrez = (Math.floor(u) + Math.floor(v)) % 2;
    const k = Math.min(1, r / 160);
    return brilho(xadrez ? grad([[0, '#ff2d95'], [1, '#7a3cff']], fr(u * 0.25)) : hex('#0a0516'), k);
  } },
  lava: { nome: 'Lava Lâmpada', preco: 790, f(x, y, t) {
    let s = 0;
    for (let i = 0; i < 6; i++) {
      const p = TAU * t * (i % 2 ? 1 : -1) + i;
      const bx = 300 + Math.cos(p + i * 1.3) * (150 + i * 25), by = 100 + Math.sin(p * (i % 3 ? 1 : 2) + i) * 60;
      s += 900 / ((x - bx) ** 2 / 4 + (y - by) ** 2 + 1);
    }
    if (s > 1) return grad([[0, '#ff2d95'], [0.5, '#ff9a3c'], [1, '#fff2a8']], Math.min(1, (s - 1) / 2));
    return grad([[0, '#1a0010'], [1, '#3a0030']], Math.min(1, s));
  } },
};

// ---------- gerar ----------
function gerar(chave) {
  const b = BANNERS[chave];
  const gif = GIFEncoder();
  const rgba = new Uint8Array(W * H * 4);
  for (let q = 0; q < QUADROS; q++) {
    const t = q / QUADROS;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = b.f(x, y, t), i = (y * W + x) * 4;
      rgba[i] = cl(c[0]); rgba[i + 1] = cl(c[1]); rgba[i + 2] = cl(c[2]); rgba[i + 3] = 255;
    }
    const pal = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, pal), W, H, { palette: pal, delay: ATRASO, repeat: 0 });
  }
  gif.finish();
  fs.mkdirSync(PASTA, { recursive: true });
  const buf = Buffer.from(gif.bytes());
  fs.writeFileSync(path.join(PASTA, chave + '.gif'), buf);
  fs.writeFileSync(path.join(PASTA, chave + '.json'), JSON.stringify({ nome: b.nome, preco: b.preco, criadoEm: Date.now() }));
  console.log(`✅ ${b.nome.padEnd(24)} ${(buf.length / 1048576).toFixed(2)} MB`);
}

const pedidos = process.argv.slice(2);
for (const k of (pedidos.length ? pedidos : Object.keys(BANNERS))) {
  if (!BANNERS[k]) { console.error('Não existe banner "' + k + '". Opções: ' + Object.keys(BANNERS).join(', ')); continue; }
  gerar(k);
}
console.log('Rascunhos em ' + PASTA + ' → abre o /painel pra escolher o que vai pra loja.');
