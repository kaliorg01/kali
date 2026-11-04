// KALI — cliente (1/7): Base: utilidades, estado, rede, menus/modais, consultas, carregar e navegação.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';


  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  function h(tag, props, ...filhos) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    if (props && props.title && !props['aria-label'] && tag === 'button') e.setAttribute('aria-label', props.title);
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
    return e;
  }
  // Ícones SVG (traço 2px, currentColor) no lugar de emoji nos controles.
  const ICONES = {
    hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18', voz: 'M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
    cadeado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', tv: 'M2 7h20v13H2zM7 2l5 5 5-5',
    sino: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0', sinoOff: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20',
    pino: 'M12 17v5M5 17h14l-2-4V6H7v7l-2 4zM6 2h12', pessoas: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    lupa: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.35-4.35', mais: 'M12 5v14M5 12h14', x: 'M18 6 6 18M6 6l12 12', voltar: 'M19 12H5M12 19l-7-7 7-7',
    sorriso: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M19 10v2a7 7 0 0 1-14 0v-2M12 19v3', micOff: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M2 2l20 20',
    fone: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
    foneOff: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3zM2 2l20 20',
    engrenagem: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    enviar: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z', tela: 'M2 3h20v14H2zM8 21h8M12 17v4', camera: 'M23 7l-7 5 7 5V7zM1 5h15v14H1z',
    som: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    desligar: 'M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91M23 1 1 23',
    sinal: 'M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16', grade: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', convidar: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6',
    balao: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', check: 'M20 6 9 17l-5-5', loja: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
    megafone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 8a5 5 0 0 1 0 8M18 5a9 9 0 0 1 0 14', relogio: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
    cc: 'M3 5h18v14H3zM10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3', mao: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0',
    porta: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', calendario: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
    trofeu: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
    dado: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
    pontos: 'M5 12h.01M12 12h.01M19 12h.01', teclado: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
    painel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  };
  function ic(nome, tam = 20) {
    const NS = 'http://www.w3.org/2000/svg', sv = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: tam, height: tam, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ico' })) sv.setAttribute(k, v);
    p.setAttribute('d', ICONES[nome] || ''); sv.append(p); return sv;
  }
  // Remove com animação de saída (classe .saindo); fallback se o animationend não vier.
  function sair(el, ms = 260) {
    if (!el || el.classList.contains('saindo')) return;
    el.classList.add('saindo');
    const fim = () => el.remove();
    el.addEventListener('animationend', (e) => { if (e.target === el) fim(); }, { once: true });
    setTimeout(fim, ms);
  }
  const ehCelular = () => matchMedia('(max-width: 760px)').matches;
  // Segurar (toque) ou clique direito (mouse) → fn(x, y).
  function aoSegurar(el, fn) {
    let t = null, x = 0, y = 0, ultimo = 0;
    const disparar = (px, py) => { if (Date.now() - ultimo < 700) return; ultimo = Date.now(); el.classList.remove('segurando'); fn(px, py); };
    const cancela = () => { if (t) { clearTimeout(t); t = null; } el.classList.remove('segurando'); };
    el.addEventListener('click', (e) => { if (Date.now() - ultimo < 700) { e.preventDefault(); e.stopPropagation(); } }, true);
    el.addEventListener('pointerdown', (e) => {
      const alvo = e.target.closest('a,button,textarea,input,audio,video');
      if (e.pointerType === 'mouse' || (alvo && alvo !== el)) return;
      x = e.clientX; y = e.clientY; el.classList.add('segurando');
      t = setTimeout(() => { t = null; try { navigator.vibrate && navigator.vibrate(10); } catch (er) {} disparar(x, y); }, 420);
    });
    el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - x, e.clientY - y) > 8) cancela(); });
    el.addEventListener('pointerup', cancela);
    el.addEventListener('pointercancel', cancela);
    el.addEventListener('contextmenu', (e) => {
      if (e.target.closest('textarea,input,audio,video') || (e.target.closest('a') && e.target.closest('a') !== el)) return;
      e.preventDefault(); cancela(); disparar(e.clientX, e.clientY);
    });
  }
  if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  // Logo: public/img/icone.png (recorte quadrado do dragão); se faltar, kali.svg.
  function logo(cls) {
    const i = document.createElement('img');
    i.className = cls || 'logo';
    i.alt = '';
    i.onerror = () => { i.onerror = null; i.src = '/img/kali.svg'; };
    i.src = '/img/icone.png';
    return i;
  }
  const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const salvar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  // Preferências do tempo da AURA (aura-*) passam para kali-* uma única vez.
  try {
    const antigas = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('aura-')) antigas.push(k); }
    for (const k of antigas) {
      const nova = 'kali-' + k.slice(5);
      if (localStorage.getItem(nova) === null) localStorage.setItem(nova, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  } catch (e) {}
  const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function dia(ms) {
    const d = new Date(ms), hoje = new Date();
    const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  const inicial = (t) => (Array.from((t || '?').trim())[0] || '?').toUpperCase();
  const corta = (t, n) => (t && t.length > n ? t.slice(0, n - 1) + '…' : t || '');

  const CORES = ['#367bf0', '#1fa2ff', '#2fd0ff', '#3ee6a8', '#1d4ed8', '#c2410c', '#0e7490', '#db2777'];
  const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🎉', '👀'];
  const STATUS = {
    online: ['on', 'Online'], ausente: ['aus', 'Ausente'], ocupado: ['ocup', 'Não perturbe'],
    foco: ['ocup', 'Modo foco'], offline: ['off', 'Offline'],
  };

  // ---------- estado ----------
  const E = {
    eu: null, servidores: [], dms: [], modo: 'servidor', servidorId: null, canalId: null,
    msgs: new Map(), fim: new Set(), carregandoAntigas: false,
    membros: new Map(), presenca: new Map(), voz: new Map(),
    naoLidos: {}, mencoes: {}, digitando: new Map(), resumo: new Map(), rascunho: new Map(),
    novaDesde: new Map(), busca: '', editando: null, bloqueados: new Map(),
    missoes: new Map(), temp: 0, assistindo: null,
    amigos: { amigos: [], recebidos: [], enviados: [] },
    cargos: new Map(), eventos: new Map(), emojis: new Map(), animado: new Map(), novaAte: new Map(),
  };
  // Cor de nome comprada na loja: '#hex' ou '#hex,#hex' (degradê).
  const estiloNome = (c) => !c ? null : c.includes(',')
    ? `background:linear-gradient(90deg,${c});-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${c}`;
  // Cor do primeiro cargo personalizado da pessoa no servidor (ou null).
  const corCargo = (sid, uid) => (E.cargos.get(sid) || []).find((c) => c.membros.includes(uid))?.cor || null;
  const TEMPOS = [[0, 'Desligado', '⏱'], [60, '1 minuto', '1m'], [600, '10 minutos', '10m'], [3600, '1 hora', '1h'], [86400, '24 horas', '24h']];
  const restante = (ate) => {
    const s = Math.max(0, Math.round((ate - Date.now()) / 1000));
    return s >= 3600 ? Math.ceil(s / 3600) + 'h' : s >= 60 ? Math.ceil(s / 60) + 'min' : s + 's';
  };
  setInterval(() => document.querySelectorAll('.expira').forEach((el) => { el.textContent = '⏱ ' + restante(Number(el.dataset.ate)); }), 1000);
  let sock = null;

  // ---------- rede ----------
  async function api(metodo, url, corpo) {
    const r = await fetch('/api' + url, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 401 && url !== '/sair') { location.href = '/entrar.html'; throw new Error('Sessão expirada.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || 'Algo deu errado.');
    return d;
  }
  const pedir = (ev, dados) => new Promise((res) => {
    if (!sock || !sock.connected) return res({ erro: 'Sem conexão. Tentando reconectar…' });
    sock.timeout(8000).emit(ev, dados, (err, r) => res(err ? { erro: 'Sem resposta do servidor.' } : r || {}));
  });

  // ---------- toasts, menus, modais ----------
  function toast(texto, tipo) {
    if (!tipo && E.eu && E.eu.status === 'foco') return; // modo foco: sem avisos
    const t = h('div', { class: 'toast ' + (tipo || '') }, h('span', {}, texto), h('button', { class: 'x', type: 'button', title: 'Fechar', onclick: () => sair(t) }, '✕'));
    $('#toasts').append(t);
    let resta = 3800, desde = Date.now(), tm = setTimeout(() => sair(t), resta);
    t.onmouseenter = () => { clearTimeout(tm); resta -= Date.now() - desde; };
    t.onmouseleave = () => { desde = Date.now(); tm = setTimeout(() => sair(t), Math.max(800, resta)); };
  }

  let menuAberto = null, fundoMenu = null;
  function fecharMenu() {
    if (menuAberto) { sair(menuAberto); menuAberto = null; }
    if (fundoMenu) { sair(fundoMenu); fundoMenu = null; }
  }
  function abrirMenu(ancora, conteudo, cls) {
    fecharMenu();
    const sheet = ehCelular();
    const m = h('div', { class: 'menu ' + (cls || '') + (sheet ? ' sheet' : ''), role: 'menu' }, conteudo);
    m.querySelectorAll('button').forEach((b) => b.setAttribute('role', 'menuitem'));
    m.addEventListener('keydown', (e) => {
      const bs = [...m.querySelectorAll('button:not([disabled])')], i = bs.indexOf(document.activeElement);
      const ir = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: bs.length - 1 }[e.key];
      if (ir != null && bs.length) { e.preventDefault(); bs[(ir + bs.length) % bs.length].focus(); }
    });
    if (sheet) {
      fundoMenu = h('div', { class: 'fundo-sheet' });
      document.body.append(fundoMenu);
      document.body.append(m);
      menuAberto = m;
      // arrastar a alça pra baixo fecha
      let y0 = null;
      m.addEventListener('touchstart', (e) => { y0 = m.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
      m.addEventListener('touchmove', (e) => { if (y0 != null) { const d = e.touches[0].clientY - y0; if (d > 0) m.style.transform = `translateY(${d}px)`; } }, { passive: true });
      m.addEventListener('touchend', (e) => {
        if (y0 == null) return;
        const d = e.changedTouches[0].clientY - y0; y0 = null;
        if (d > 90) fecharMenu(); else m.style.transform = '';
      });
      return;
    }
    document.body.append(m);
    const r = ancora.getBoundingClientRect();
    let x = r.left, y = r.bottom + 6;
    if (x + m.offsetWidth > innerWidth - 8) x = innerWidth - m.offsetWidth - 8;
    if (y + m.offsetHeight > innerHeight - 8) y = r.top - m.offsetHeight - 6;
    m.style.left = Math.max(8, x) + 'px';
    m.style.top = Math.max(8, y) + 'px';
    menuAberto = m;
    if (matchMedia('(hover: hover)').matches) setTimeout(() => { if (menuAberto === m) m.querySelector('button')?.focus({ preventScroll: true }); });
  }
  // Abre o mesmo menu de um botão, mas na posição do clique direito.
  function abrirMenuEm(x, y, botao) {
    const r0 = botao.getBoundingClientRect;
    botao.getBoundingClientRect = () => ({ left: x, top: y, bottom: y, right: x, width: 0, height: 0 });
    try { botao.click(); } finally { botao.getBoundingClientRect = r0; }
  }
  const item = (texto, acao, cls) => h('button', { class: cls || '', type: 'button', onclick: () => { fecharMenu(); acao(); } }, texto);
  document.addEventListener('mousedown', (e) => { if (menuAberto && !menuAberto.contains(e.target)) fecharMenu(); });

  let modalAberto = null, focoAntes = null;
  function fecharModal() {
    if (!modalAberto) return;
    sair(modalAberto); modalAberto = null;
    if (focoAntes && document.contains(focoAntes)) focoAntes.focus({ preventScroll: true });
    focoAntes = null;
  }
  // Tab fica preso dentro do diálogo.
  function prenderFoco(el) {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const fs = [...el.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
      if (!fs.length) return;
      const a = fs[0], z = fs[fs.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }
  let idModal = 0;
  function abrirModal({ titulo, sub, corpo, botao, acao, perigo }) {
    const antes = modalAberto ? focoAntes : document.activeElement;
    fecharModal();
    focoAntes = antes;
    const erro = h('p', { class: 'erro-form', hidden: true, role: 'alert' });
    const ok = botao ? h('button', { class: 'bt ' + (perigo ? 'perigo' : 'prim'), type: 'submit' }, botao) : null;
    const idT = 'modal-t' + (++idModal);
    const form = h('form', { class: 'modal', novalidate: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idT },
      h('h2', { id: idT }, titulo), sub ? h('p', { class: 'sub' }, sub) : null, corpo || [], erro,
      h('div', { class: 'acoes' }, h('button', { class: 'bt', type: 'button', onclick: fecharModal }, botao ? 'Cancelar' : 'Fechar'), ok));
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!acao) return fecharModal();
      ok.disabled = true; erro.hidden = true;
      try { await acao(); fecharModal(); } catch (err) { erro.textContent = err.message; erro.hidden = false; } finally { ok.disabled = false; }
    };
    const fundo = h('div', { class: 'fundo-modal' }, form);
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fecharModal(); });
    document.body.append(fundo);
    modalAberto = fundo;
    prenderFoco(form);
    const primeiro = form.querySelector('input,select,textarea') || ok || form.querySelector('button');
    if (primeiro && !(ehCelular() && primeiro.tagName !== 'BUTTON')) primeiro.focus();
    return form;
  }
  const campo = (rotulo, input) => h('label', { class: 'campo' }, h('span', {}, rotulo), input);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fecharMenu(); fecharModal(); } });

  // ---------- consultas ao estado ----------
  const servidorAtual = () => E.servidores.find((s) => s.id === E.servidorId) || null;
  const souDono = (s) => !!s && s.donoId === E.eu.id;
  function acharCanal(id) {
    for (const s of E.servidores) { const c = s.canais.find((x) => x.id === id); if (c) return c; }
    const dm = E.dms.find((d) => d.canalId === id);
    return dm ? { id: dm.canalId, servidorId: null, nome: dm.outro.nome, tipo: 'texto', dm } : null;
  }
  const canalAtual = () => (E.canalId ? acharCanal(E.canalId) : null);
  function statusDe(uid) {
    if (uid === E.eu.id) return sock && sock.connected ? (E.eu.status || 'online') : 'offline';
    return E.presenca.get(uid) || 'offline';
  }
  const st = (uid) => STATUS[statusDe(uid)] || STATUS.offline;
  const rotStatus = (u) => u.statusTexto || (statusDe(u.id) === 'foco' && u.focoAte ? '⛔ foco até ' + hora(u.focoAte) : st(u.id)[1]);
  function avatar(u, cls, comStatus) {
    const a = h('div', { class: 'av ' + (cls || '') }, inicial(u && (u.nome || u.usuario)));
    a.style.background = (u && u.cor) || '#6b7280';
    if (u && u.avatar) { a.textContent = ''; a.style.background = `center/cover no-repeat url("${u.avatar}")`; }
    if (u && u.moldura) a.append(h('img', { class: 'moldura', src: u.moldura, alt: '' }));
    if (comStatus && u) a.append(h('i', { class: 'st ' + st(u.id)[0] }));
    return a;
  }
  const regexMencao = () => new RegExp('@' + E.eu.usuario.replace(/[.]/g, '\\.') + '(?![a-z0-9_.])', 'i');
  // @usuario, @todos/@aqui (só valem se quem mandou é da staff) e @NomeDoCargo (se eu tenho o cargo).
  function mencionaEu(m) {
    if (!m.texto || !m.autor || m.autor.id === E.eu.id) return false;
    if (regexMencao().test(m.texto)) return true;
    const c = acharCanal(m.canalId);
    if (!c || !c.servidorId) return false;
    if (/@(todos|aqui)(?![a-z0-9_.])/i.test(m.texto) && (nivelDe(c.servidorId, m.autor.id) >= 2 || (E.cargos.get(c.servidorId) || []).some((cg) => (cg.perm & 4) && cg.membros.includes(m.autor.id)))) return true;
    const t = m.texto.toLowerCase();
    return (E.cargos.get(c.servidorId) || []).some((cg) => cg.membros.includes(E.eu.id) && t.includes('@' + cg.nome.toLowerCase()));
  }
  // Notificações por servidor: 'todas' (padrão), 'mencoes' (só @) ou 'nada'. Fica neste aparelho.
  const nivelNotif = (sid) => { try { return JSON.parse(ler('kali-notif-srv') || '{}')[sid] || 'todas'; } catch (e) { return 'todas'; } };
  const definirNivelNotif = (sid, v) => { let o = {}; try { o = JSON.parse(ler('kali-notif-srv') || '{}'); } catch (e) {} o[sid] = v; salvar('kali-notif-srv', JSON.stringify(o)); };
  const naoLidosServidor = (s) => {
    const nv = nivelNotif(s.id);
    if (nv === 'nada') return 0;
    return s.canais.reduce((t, c) => t + (nv === 'mencoes' ? (E.mencoes[c.id] || 0) : (E.naoLidos[c.id] || 0)), 0);
  };

  // ---------- carregar ----------
  async function carregarTudo() {
    const [servidores, dms] = await Promise.all([api('GET', '/servidores'), api('GET', '/dms')]);
    E.servidores = servidores;
    E.dms = dms;
    E.naoLidos = {};
    for (const s of servidores) { Object.assign(E.naoLidos, s.naoLidos || {}); Object.assign(E.mencoes, s.mencoes || {}); }
    for (const d of dms) { E.naoLidos[d.canalId] = d.naoLidos || 0; E.presenca.set(d.outro.id, d.outro.status); }
    await carregarAmigos();
    await carregarBloqueios();
    carregarEmojis();
    E.membros.clear();
  }
  async function carregarMembros(sid) {
    const lista = await api('GET', `/servidores/${sid}/membros`);
    E.membros.set(sid, lista);
    for (const m of lista) if (m.id !== E.eu.id) E.presenca.set(m.id, m.status);
  }
  async function carregarMensagens(id, antes) {
    const lista = await api('GET', `/canais/${id}/mensagens?limite=50${antes ? '&antes=' + antes : ''}`);
    if (lista.length < 50) E.fim.add(id);
    const atual = E.msgs.get(id) || [];
    const ids = new Set(atual.map((m) => m.id));
    const todas = atual.concat(lista.filter((m) => !ids.has(m.id)));
    todas.sort((a, b) => a.id - b.id);
    E.msgs.set(id, todas);
  }
  const lidoTimers = new Map();
  function marcarLido(id) {
    clearTimeout(lidoTimers.get(id));
    lidoTimers.set(id, setTimeout(() => api('POST', `/canais/${id}/lido`).catch(() => {}), 400));
  }

  // ---------- navegação ----------
  // Tema por servidor: cada servidor ganha um degradê azul/ciano (escuro o bastante pra texto branco).
  const TEMAS = [['#1f5fd6', '#2563eb', '#0e7490'], ['#1e40af', '#2563eb', '#0369a1'], ['#0e7490', '#0284c7', '#1d4ed8'], ['#1d4ed8', '#0369a1', '#0f766e'], ['#0b5fb8', '#1d4ed8', '#155e75']];
  function aplicarTemaServidor(id) {
    const st = document.documentElement.style;
    if (!id || document.documentElement.dataset.acento) { st.removeProperty('--grad'); st.removeProperty('--roxo'); return; } // cor de destaque escolhida vence o degradê do servidor
    const [a, b, c] = TEMAS[(id - 1) % TEMAS.length];
    st.setProperty('--grad', `linear-gradient(135deg,${a} 0%,${b} 55%,${c} 100%)`);
  }
  async function selecionarServidor(id) {
    sairAssistir();
    E.verVisao = false; E.verApostas = false;
    aplicarTemaServidor(id);
    carregarTop1(id);
    E.modo = 'servidor';
    E.servidorId = id;
    salvar('kali-servidor', id);
    const s = servidorAtual();
    if (!s) return render();
    if (!E.membros.has(id)) carregarMembros(id).then(renderMembros).catch(() => {});
    if (!E.cargos.has(id)) carregarCargos(id).then(() => { renderMembros(); if (E.servidorId === id) renderLista(); }).catch(() => {});
    if (!E.eventos.has(id)) carregarEventos(id);
    carregarMissoes(id);
    const salvo = Number(ler('kali-canal-' + id));
    const alvo = s.canais.find((c) => c.id === salvo && c.tipo === 'texto') || s.canais.find((c) => c.tipo === 'texto');
    E.canalId = null;
    $('#app').classList.remove('chat');
    if (alvo) await abrirCanal(alvo.id, true); else render();
    if (ler('kali-bv-' + id) !== '1' && !souDono(s)) modalBoasVindas(s, true);
  }
  async function abrirDms() {
    sairAssistir();
    aplicarTemaServidor(null);
    E.modo = 'dm';
    E.servidorId = null;
    salvar('kali-servidor', 'dm');
    const salvo = Number(ler('kali-canal-dm'));
    // Igual ao Discord: o início das DMs abre a tela de Amigos.
    void salvo;
    E.canalId = null;
    E.telaAmigos = true;
    $('#app').classList.remove('chat');
    render();
  }
  async function abrirCanal(id, semMobile) {
    E.verVisao = false; E.verApostas = false;
    const c = acharCanal(id);
    if (!c) return;
    if (c.tipo === 'voz') {
      if (window.Voz && Voz.estado.canalId === c.id) { abrirCall(); return; }
      return entrarVoz(c);
    }
    E.verCall = false;
    if (gravacao) gravacao.parar(false);
    if (E.assistindo && E.assistindo !== id) sairAssistir();
    E.canalId = id;
    E.busca = '';
    E.editando = null;
    salvar('kali-canal-' + (c.servidorId == null ? 'dm' : c.servidorId), id);
    if (!semMobile) $('#app').classList.add('chat');
    const n = E.naoLidos[id] || 0;
    E.naoLidos[id] = 0;
    E.mencoes[id] = 0;
    render();
    if (c.tipo === 'assistir') entrarAssistir(id);
    if (!E.msgs.has(id) || !E.fim.has(id) && E.msgs.get(id).length < 20) {
      try { await carregarMensagens(id); } catch (err) {
        if (c.comSenha && /senha/i.test(err.message)) { E.msgs.delete(id); return modalSenhaCanal(c); }
        toast(err.message, 'erro');
      }
    }
    const arr = E.msgs.get(id) || [];
    if (n > 0 && arr.length) E.novaDesde.set(id, arr[Math.max(0, arr.length - n)].id); else E.novaDesde.delete(id);
    if (E.canalId === id) renderLista({ fim: true });
    marcarLido(id);
  }
