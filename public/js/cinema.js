// KALI — camada "cinema": intro de abertura, transição mecânica entre servidores, tela de vitória e cards com 3D.
// Fica separada do app.js de propósito: só observa a tela e decora, não mexe no estado do app.
(() => {
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const desligado = () => ler('kali-cinema') === '0';
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---------- som sintetizado (sem arquivo): impacto metálico, servo, whoosh ----------
  let ctx = null;
  const audio = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (e) { return null; } };
  function ruido(dur, freq, vol, tipo = 'bandpass') {
    const c = audio(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start();
  }
  function tom(f0, f1, dur, vol, forma = 'sawtooth', atraso = 0) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + atraso;
    o.type = forma; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const SOM = {
    servo() { tom(180, 620, 0.22, 0.05, 'square'); tom(620, 240, 0.18, 0.04, 'square', 0.2); ruido(0.25, 2400, 0.08); },
    impacto() { tom(90, 35, 0.6, 0.22, 'sine'); ruido(0.5, 900, 0.35, 'lowpass'); ruido(0.15, 5000, 0.12); },
    whoosh() { ruido(0.45, 1200, 0.18); },
    vitoria() { [523, 659, 784, 1047].forEach((f, i) => tom(f, f * 1.01, 0.5, 0.06, 'triangle', i * 0.11)); tom(55, 40, 1.2, 0.18, 'sine'); },
  };
  const somLigado = () => ler('kali-som') !== 'desligado';
  // Animações são mudas (pedido do dono). Pra religar: localStorage 'kali-cinema-som' = '1'.
  const tocar = (n) => { if (ler('kali-cinema-som') === '1' && somLigado() && !desligado()) try { SOM[n](); } catch (e) {} };

  // ---------- 1) intro de abertura (1x por sessão) ----------
  function intro() {
    if (calmo || desligado()) return;
    // uma vez por dia (não cansa)
    const hoje = new Date().toDateString();
    try { if (localStorage.getItem('kali-intro-dia') === hoje) return; localStorage.setItem('kali-intro-dia', hoje); } catch (e) {}
    const tela = el('div', 'cine-intro');
    const cacos = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i};--a:${(i * 360) / 14}deg"></i>`).join('');
    tela.innerHTML = `<div class="cine-barra cima"></div><div class="cine-barra baixo"></div>
      <div class="cine-hud"><span>SISTEMA KALI</span><span class="cine-carga"><b></b></span><span class="cine-cod">INICIALIZANDO NÚCLEO…</span></div>
      <div class="cine-nucleo"><div class="cine-cacos">${cacos}</div><img src="/img/logo-dragao.png" alt=""><div class="cine-onda"></div></div>
      <h1 class="cine-titulo" data-t="KALI">KALI</h1><p class="cine-sub">feito pra galera · melhor que o resto</p>
      <button class="cine-pular" type="button">Pular ›</button>`;
    document.body.append(tela);
    const fim = () => { if (!tela.isConnected) return; tela.classList.add('saindo'); setTimeout(() => tela.remove(), 700); };
    tela.querySelector('.cine-pular').onclick = fim;
    tela.addEventListener('click', (e) => { if (e.target === tela) fim(); });
    // o som só toca se o navegador deixar (precisa de gesto); tenta e segue mudo se não der
    setTimeout(() => tocar('servo'), 250);
    setTimeout(() => tocar('impacto'), 1150);
    setTimeout(() => tela.classList.add('montado'), 1150);
    setTimeout(fim, 3100);
  }

  // ---------- 2) transição mecânica ao trocar de servidor/tela ----------
  let ultimoTitulo = null, transicionando = false;
  function transicao(texto) {
    if (calmo || desligado() || transicionando) return;
    transicionando = true;
    const t = el('div', 'cine-trans');
    t.innerHTML = `<div class="ct-placa e"></div><div class="ct-placa d"></div><div class="ct-faixa"><span>${texto.replace(/[<>&]/g, '')}</span></div>`;
    document.body.append(t);
    tocar('servo');
    setTimeout(() => { t.classList.add('abre'); }, 380);
    setTimeout(() => { t.remove(); transicionando = false; }, 900);
  }
  function vigiarTitulo() {
    const side = document.getElementById('side');
    if (!side) return;
    new MutationObserver(() => {
      const sp = side.querySelector('.side-topo span');
      const txt = sp ? sp.textContent.trim() : '';
      if (txt && ultimoTitulo !== null && txt !== ultimoTitulo && txt !== 'KALI') transicao(txt);
      if (txt) ultimoTitulo = txt;
    }).observe(side, { childList: true, subtree: true });
  }

  // ---------- 3) tela de vitória (aposta encerrada, duelo, etc.) ----------
  const jaComemorou = new Set();
  function vitoria(nome, detalhe) {
    if (desligado()) return;
    const v = el('div', 'cine-vitoria');
    const raios = Array.from({ length: 16 }, (_, i) => `<i style="--r:${i * 22.5}deg"></i>`).join('');
    const faisca = Array.from({ length: 40 }, (_, i) => `<b style="--x:${(i * 53) % 100}%;--d:${(i % 10) * 0.12}s;--h:${(i * 47) % 360}"></b>`).join('');
    v.innerHTML = `<div class="cine-barra cima"></div><div class="cine-barra baixo"></div>
      <div class="cv-raios">${raios}</div><div class="cv-faiscas">${faisca}</div>
      <div class="cv-centro"><div class="cv-trofeu">🏆</div><h2 class="cv-titulo" data-t="VITÓRIA">VITÓRIA</h2>
      <p class="cv-nome"></p><p class="cv-det"></p><button type="button" class="cine-pular">Fechar</button></div>`;
    v.querySelector('.cv-nome').textContent = nome;
    v.querySelector('.cv-det').textContent = detalhe || '';
    document.body.append(v);
    tocar('impacto'); setTimeout(() => tocar('vitoria'), 300);
    const fechar = () => { v.classList.add('saindo'); setTimeout(() => v.remove(), 600); };
    v.querySelector('button').onclick = fechar;
    setTimeout(fechar, calmo ? 3000 : 6500);
  }
  function vigiarVitorias() {
    const main = document.getElementById('main');
    if (!main) return;
    const ver = () => {
      main.querySelectorAll('.msg[data-id]').forEach((m) => {
        const id = m.dataset.id;
        if (jaComemorou.has(id)) return;
        jaComemorou.add(id);
        const txt = m.textContent || '';
        const r = /🏆\s*(.+?) venceu a aposta #(\d+) \(R\$ ([\d.,]+) no pote\)/.exec(txt);
        // só comemora mensagem que acabou de chegar (o app marca com .nova), não as antigas do histórico
        if (r && m.classList.contains('nova')) vitoria(r[1], `Aposta #${r[2]} · R$ ${r[3]} no pote`);
      });
    };
    new MutationObserver(() => { clearTimeout(ver.t); ver.t = setTimeout(ver, 120); }).observe(main, { childList: true, subtree: true });
  }

  // ---------- 4) cards com inclinação 3D e brilho seguindo o mouse ----------
  function tilt() {
    if (calmo || !matchMedia('(hover: hover)').matches) return;
    let alvo = null;
    document.addEventListener('pointermove', (e) => {
      const c = e.target.closest && e.target.closest('.card-srv, .num-visao, .conquista, .story-bola .sb-av');
      if (alvo && alvo !== c) { alvo.style.removeProperty('--rx'); alvo.style.removeProperty('--ry'); alvo.classList.remove('cine-tilt'); }
      alvo = c;
      if (!c || desligado()) return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.classList.add('cine-tilt');
      c.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
      c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  // ---------- 5) "whoosh" ao abrir janelas e menus ----------
  function vigiarModais() {
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.classList.contains('fundo-modal') || n.classList.contains('story-tela'))) { tocar('whoosh'); return; }
    }).observe(document.body, { childList: true });
  }

  window.KaliCinema = { vitoria, transicao, tocar, intro: () => { try { localStorage.removeItem('kali-intro-dia'); } catch (e) {} intro(); } };
  intro();
  let iniciado = false;
  // a vitória das apostas vem pelo evento 'aposta:fim' do app (telaVitoria chama KaliCinema.vitoria); não lê mais o chat
  const iniciar = () => { if (iniciado) return; iniciado = true; vigiarTitulo(); tilt(); vigiarModais(); void vigiarVitorias; };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
