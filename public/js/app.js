// KALI — cliente. Texto de usuário só entra no DOM via textContent/append (nunca innerHTML).
(function () {
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
    porta: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', calendario: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
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
    novaDesde: new Map(), busca: '', editando: null,
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
  const mencionaEu = (m) => !!m.texto && m.autor?.id !== E.eu.id && regexMencao().test(m.texto);
  const naoLidosServidor = (s) => s.canais.reduce((t, c) => t + (E.naoLidos[c.id] || 0), 0);

  // ---------- carregar ----------
  async function carregarTudo() {
    const [servidores, dms] = await Promise.all([api('GET', '/servidores'), api('GET', '/dms')]);
    E.servidores = servidores;
    E.dms = dms;
    E.naoLidos = {};
    for (const s of servidores) { Object.assign(E.naoLidos, s.naoLidos || {}); Object.assign(E.mencoes, s.mencoes || {}); }
    for (const d of dms) { E.naoLidos[d.canalId] = d.naoLidos || 0; E.presenca.set(d.outro.id, d.outro.status); }
    await carregarAmigos();
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
    if (!id) { st.removeProperty('--grad'); st.removeProperty('--roxo'); return; }
    const [a, b, c] = TEMAS[(id - 1) % TEMAS.length];
    st.setProperty('--grad', `linear-gradient(135deg,${a} 0%,${b} 55%,${c} 100%)`);
  }
  async function selecionarServidor(id) {
    sairAssistir();
    aplicarTemaServidor(id);
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

  // ---------- render geral ----------
  function render() { renderRail(); renderSide(); renderMain(); renderMembros(); }

  function renderRail() {
    const rail = $('#rail');
    const nDm = E.dms.reduce((t, d) => t + (E.naoLidos[d.canalId] || 0), 0);
    const bDm = h('button', { class: 'srv logo-btn' + (E.modo === 'dm' ? ' ativo' : ''), title: 'Mensagens diretas', onclick: abrirDms }, logo());
    const nAvisos = nDm + E.amigos.recebidos.length;
    if (nAvisos) bDm.append(h('span', { class: 'bad' }, nAvisos > 99 ? '99+' : nAvisos));
    const itens = [bDm, h('div', { class: 'sep' })];
    for (const s of E.servidores) {
      const b = h('button', { class: 'srv' + (E.modo === 'servidor' && s.id === E.servidorId ? ' ativo' : ''), title: s.nome, onclick: () => selecionarServidor(s.id) }, s.icone ? h('img', { class: 'icone-srv', src: s.icone, alt: '' }) : s.sigla || inicial(s.nome));
      const n = naoLidosServidor(s);
      if (n) b.append(h('span', { class: 'bad' }, n > 99 ? '99+' : n));
      aoSegurar(b, (x, y) => menuServidorEm(s, x, y));
      itens.push(b);
    }
    itens.push(h('button', { class: 'srv add', title: 'Criar ou entrar em servidor', onclick: modalServidor }, '+'));
    rail.replaceChildren(...itens);
    atualizarTitulo();
  }

  function linhaCanal(c, s) {
    const icn = c.tipo === 'voz' ? (c.espacial ? '🌌' : ic('voz', 18)) : c.tipo === 'assistir' ? ic('tv', 18) : c.ticket ? '🎫' : c.comSenha ? ic('cadeado', 18) : ic('hash', 18);
    const n = E.naoLidos[c.id] || 0, men = E.mencoes[c.id] || 0;
    const b = h('button', { class: 'canal' + (c.id === E.canalId ? ' ativo' : '') + (n ? ' nao-lido' : ''), onclick: () => abrirCanal(c.id) },
      h('span', { class: 'ic' }, icn), h('span', { class: 'nm' }, c.nome),
      men ? h('span', { class: 'n mencao' }, '@' + men) : n ? h('span', { class: 'n' }, n > 99 ? '99+' : n) : null);
    const linha = h('div', { class: 'canal-linha' }, b);
    aoSegurar(b, (x, y) => menuCanal(c, s, x, y));
    const extras = h('span', { class: 'canal-extras' }, c.tipo === 'texto' ? h('button', { title: 'Convidar pra cá', onclick: modalConvite }, ic('convidar', 15)) : null);
    if (souStaffEm(s.id) && c.servidorId) extras.append(h('button', { title: 'Editar canal (categoria, modo lento)', onclick: () => modalEditarCanal(c, s) }, ic('engrenagem', 15)));
    if (souDono(s)) extras.append(h('button', { class: 'perigo', title: 'Apagar canal', onclick: () => apagarCanal(c) }, ic('x', 15)));
    linha.append(extras);
    const frag = [linha];
    // tópicos desse canal aparecem logo embaixo dele
    for (const t of s.canais.filter((x) => x.paiCanal === c.id)) {
      const nt = E.naoLidos[t.id] || 0;
      frag.push(h('button', { class: 'canal topico-linha' + (t.id === E.canalId ? ' ativo' : '') + (nt ? ' nao-lido' : ''), onclick: () => abrirCanal(t.id) },
        h('span', { class: 'ic' }, '└'), h('span', { class: 'nm' }, '🧵 ' + t.nome), nt ? h('span', { class: 'n' }, nt) : null));
    }
    if (c.tipo !== 'texto') {
      const membros = E.voz.get(c.id) || [];
      if (membros.length) frag.push(h('div', { class: 'voz-users' }, membros.map((m) => h('span', { class: 'voz-user' },
        (() => {
          // usa a foto de perfil se a pessoa tiver (igual ao resto do app)
          const u = m.usuarioId === E.eu.id ? E.eu : [...E.membros.values()].flat().find((x) => x.id === m.usuarioId);
          const i = h('i', { class: 'mini' + (m.falando ? ' falando' : '') }, u && u.avatar ? '' : inicial(m.nome));
          i.style.background = u && u.avatar ? `center/cover no-repeat url("${u.avatar}")` : (CORES.includes(m.cor) ? m.cor : '#6b7280');
          return i;
        })(),
        h('span', { class: 'nm' }, m.nome),
        window.Voz && c.id === Voz.estado.canalId && streamDe(m.usuarioId) ? h('span', { class: 'ao-vivo', title: 'Transmitindo — clica pra assistir', onclick: () => { abrirCall(); E.focoTela = m.usuarioId; atualizarCall(); } }, 'AO VIVO') : null,
        h('span', { class: 'icones' }, m.surdo ? '🔇' : m.mudo ? '🎙̸' : '')))));
    }
    return frag;
  }

  function renderSide() {
    const side = $('#side');
    const partes = [];
    if (E.modo === 'dm') {
      partes.push(h('div', { class: 'side-topo topo-busca' }, h('button', { class: 'achar-conversa', onclick: modalNovaDm }, 'Encontre ou comece uma conversa')));
      // Igual ao Discord: Amigos e Loja no topo, depois "Mensagens diretas ＋".
      const pend = E.amigos.recebidos.length;
      const corpo = h('div', { class: 'side-corpo' },
        h('button', { class: 'nav-dm' + (E.telaAmigos ? ' ativo' : ''), onclick: abrirAmigos }, h('span', { class: 'ic' }, '👋'), 'Amigos', pend ? h('span', { class: 'n mencao' }, pend) : null),
        h('button', { class: 'nav-dm', onclick: modalLoja }, h('span', { class: 'ic' }, '🛍'), 'Loja'));
      const bNova = h('button', { title: 'Nova conversa ou grupo' }, '＋');
      bNova.onclick = () => abrirMenu(bNova, [item('Nova conversa', modalNovaDm), item('Novo grupo', modalNovoGrupo)]);
      corpo.append(h('div', { class: 'rot' }, 'Mensagens diretas', bNova));
      const A = { recebidos: [], amigos: [], enviados: [] }; // amigos agora ficam na tela "Amigos"
      if (A.recebidos.length) {
        corpo.append(h('div', { class: 'rot' }, `Pedidos de amizade (${A.recebidos.length})`));
        for (const u of A.recebidos) corpo.append(h('div', { class: 'dm-item amigo' }, avatar(u, '', true),
          h('span', { class: 'txt' }, h('b', {}, u.nome), h('small', {}, '@' + u.usuario)),
          h('button', { class: 'icbtn', title: 'Aceitar', onclick: () => acaoAmigo('POST', `/amigos/${u.id}/aceitar`, `Agora você e ${u.nome} são amigos!`) }, '✓'),
          h('button', { class: 'icbtn', title: 'Recusar', onclick: () => acaoAmigo('DELETE', `/amigos/${u.id}`) }, '✕')));
      }
      const ordem = { on: 0, aus: 1, ocup: 1, off: 2 };
      for (const u of [...A.amigos].sort((a, b) => ordem[st(a.id)[0]] - ordem[st(b.id)[0]])) {
        corpo.append(h('div', { class: 'dm-item amigo' }, avatar(u, '', true),
          h('button', { class: 'txt', title: 'Mandar mensagem', onclick: () => abrirDmCom(u.usuario).catch((err) => toast(err.message, 'erro')) },
            h('b', {}, u.nome), h('small', {}, st(u.id)[1])),
          h('button', { class: 'icbtn', title: 'Desfazer amizade', onclick: () => { if (confirm(`Desfazer amizade com ${u.nome}?`)) acaoAmigo('DELETE', `/amigos/${u.id}`); } }, '✕')));
      }
      for (const u of A.enviados) corpo.append(h('div', { class: 'dm-item amigo' }, avatar(u, '', false),
        h('span', { class: 'txt' }, h('b', {}, u.nome), h('small', {}, 'Pedido enviado…')),
        h('button', { class: 'icbtn', title: 'Cancelar pedido', onclick: () => acaoAmigo('DELETE', `/amigos/${u.id}`) }, '✕')));
      if (!E.dms.length) corpo.append(h('p', { class: 'vazio-lateral' }, 'Nenhuma conversa ainda. Clica no ＋ ou chama um amigo.'));
      for (const d of E.dms) {
        const n = E.naoLidos[d.canalId] || 0;
        const bDm = h('button', { class: 'dm-item' + (!E.telaAmigos && d.canalId === E.canalId ? ' ativo' : ''), onclick: () => { E.telaAmigos = false; abrirCanal(d.canalId); } },
          avatar(d.outro, '', !d.grupo),
          h('span', { class: 'txt' }, h('b', {}, d.outro.nome), h('small', {}, d.ultima ? corta(d.ultima.texto || '🎙 áudio', 40) : '@' + d.outro.usuario)),
          n ? h('span', { class: 'n' }, n) : null);
        aoSegurar(bDm, (x, y) => menuDm(d, x, y));
        corpo.append(bDm);
      }
      partes.push(corpo);
    } else {
      const s = servidorAtual();
      if (s) {
        if (s.bannerImg) partes.push(h('img', { class: 'banner-srv', src: s.bannerImg, alt: '' }));
        partes.push(h('button', { class: 'side-topo', onclick: (e) => menuServidor(e.currentTarget) }, h('span', {}, s.nome), h('span', { class: 'seta' }, '▾')));
        const nEv = (E.eventos.get(s.id) || []).length;
        const corpo = h('div', { class: 'side-corpo' },
          h('button', { class: 'nav-dm', onclick: () => modalEventos(s) }, h('span', { class: 'ic' }, ic('calendario', 18)), nEv ? `${nEv} evento${nEv > 1 ? 's' : ''}` : 'Eventos'),
          h('button', { class: 'btn-novo', onclick: modalConvite }, h('span', { style: 'font-size:18px' }, '＋'), 'Convidar amigos'));
        const dono = souDono(s);
        // Canais sem categoria em cima (Texto/Voz); depois cada categoria, que dá pra recolher (igual ao Discord).
        const semCat = s.canais.filter((c) => !c.categoria && !c.paiCanal);
        const texto = semCat.filter((c) => c.tipo === 'texto');
        const voz = semCat.filter((c) => c.tipo !== 'texto');
        if (texto.length || !s.canais.some((c) => c.categoria)) {
          corpo.append(h('div', { class: 'rot' }, 'Canais de texto', dono ? h('button', { title: 'Criar canal de texto', onclick: () => modalCanal('texto') }, ic('mais', 15)) : null));
          texto.forEach((c) => corpo.append(...linhaCanal(c, s)));
        }
        if (voz.length || !s.canais.some((c) => c.categoria)) {
          corpo.append(h('div', { class: 'rot' }, 'Canais de voz', dono ? h('button', { title: 'Criar canal de voz', onclick: () => modalCanal('voz') }, ic('mais', 15)) : null));
          voz.forEach((c) => corpo.append(...linhaCanal(c, s)));
        }
        for (const cat of [...new Set(s.canais.map((c) => c.categoria).filter(Boolean))]) {
          const chaveCat = `kali-cat-${s.id}-${cat}`, fechada = ler(chaveCat) === '1';
          const cab = h('div', { class: 'rot categoria' + (fechada ? ' fechada' : '') },
            h('button', { class: 'nome-cat', title: fechada ? 'Mostrar canais' : 'Esconder canais', onclick: () => { salvar(chaveCat, fechada ? '' : '1'); renderSide(); } }, h('span', { class: 'seta-cat' }, '⌄'), cat),
            dono ? h('button', { title: 'Criar canal em ' + cat, onclick: () => modalCanal('texto', cat) }, '＋') : null);
          corpo.append(cab);
          if (!fechada) s.canais.filter((c) => c.categoria === cat).forEach((c) => corpo.append(...linhaCanal(c, s)));
        }
        partes.push(corpo);
      } else {
        partes.push(h('div', { class: 'side-topo' }, h('span', {}, 'KALI')));
        partes.push(h('div', { class: 'side-corpo' }, h('p', { class: 'vazio-lateral' }, 'Você ainda não está em nenhum servidor. Clica no + pra criar ou entrar num.')));
      }
    }
    // barra de voz conectada
    const ev = window.Voz ? Voz.estado : {};
    let vozPainel = null;
    if (ev.canalId) {
      const c = acharCanal(ev.canalId);
      const srv = c && E.servidores.find((x) => x.id === c.servidorId);
      vozPainel = h('div', { class: 'painel-voz' },
        h('div', { class: 'pv-topo' }, h('span', { class: 'pv-sinal' }, ic('sinal', 18)),
          h('div', { class: 'info' }, h('b', {}, 'Voz conectada'), h('small', {}, (c ? c.nome : '') + (srv ? ' / ' + srv.nome : ''))),
          h('button', { class: 'icbtn sair-voz', title: 'Desconectar', onclick: () => { Voz.sair(); } }, ic('desligar', 18))),
        h('div', { class: 'pv-acoes' },
        h('button', { class: 'icbtn' + (ev.camera ? ' ativo-tela' : ''), title: ev.camera ? 'Desligar câmera' : 'Ligar câmera',
          onclick: () => Voz.alternarCamera().catch((err) => toast(err.message, 'erro')) }, ic('camera', 18)),
        h('button', { class: 'icbtn' + (ev.compartilhando ? ' ativo-tela' : ''), title: ev.compartilhando ? 'Parar de compartilhar' : 'Compartilhar tela (1080p/60fps)',
          onclick: () => Voz.alternarTela().catch((err) => toast(err.message, 'erro')) }, ic('tela', 18)),
        h('button', { class: 'icbtn' + (E.verCall ? ' ativo-tela' : ''), title: 'Abrir a call (ver todo mundo e as telas)', onclick: abrirCall }, ic('grade', 18))));
    }
    // rodapé do usuário
    const eu = h('button', { class: 'eu', title: 'Status e perfil', onclick: (e) => menuPerfil(e.currentTarget) },
      avatar(E.eu, '', true), h('span', { class: 'txt' }, h('b', {}, E.eu.nome), h('small', {}, rotStatus(E.eu))));
    eu.querySelector('.av').style.cssText += ';width:34px;height:34px';
    partes.push(h('div', { class: 'painel-pe' }, vozPainel, h('div', { class: 'side-pe' }, eu,
      h('button', { class: 'icbtn' + (ev.mudo ? ' desligado' : ''), title: ev.mudo ? 'Ativar microfone' : 'Silenciar microfone', 'aria-pressed': String(!!ev.mudo), onclick: () => Voz.alternarMudo() }, ic(ev.mudo ? 'micOff' : 'mic')),
      h('button', { class: 'icbtn' + (ev.surdo ? ' desligado' : ''), title: ev.surdo ? 'Ativar áudio' : 'Desativar áudio', 'aria-pressed': String(!!ev.surdo), onclick: () => Voz.alternarSurdo() }, ic(ev.surdo ? 'foneOff' : 'fone')),
      h('button', { class: 'icbtn', title: 'Configurações', onclick: () => configUsuario() }, ic('engrenagem')))));
    side.replaceChildren(...partes);
  }

  function renderMain() {
    const main = $('#main');
    if (E.modo === 'dm' && E.telaAmigos) return renderAmigos(main);
    if (E.verCall && window.Voz && Voz.estado.canalId) return renderCall(main);
    const c = canalAtual();
    if (!c || c.tipo === 'voz') {
      const semServidor = !E.servidores.length && E.modo === 'servidor';
      main.replaceChildren(h('div', { class: 'vazio' }, logo('logo-grande'),
        h('h2', {}, semServidor ? 'Bem-vindo à KALI ✨' : E.modo === 'dm' ? 'Suas conversas' : 'Escolhe um canal'),
        h('p', {}, semServidor ? 'Cria um servidor pra sua galera ou entra num com o código de convite.'
          : E.modo === 'dm' ? 'Manda mensagem direta pra qualquer pessoa pelo nome de usuário.' : 'Seleciona um canal de texto na barra lateral.'),
        h('div', { class: 'acoes' },
          semServidor ? h('button', { class: 'bt prim', onclick: modalServidor }, 'Criar ou entrar') : null,
          E.modo === 'dm' ? h('button', { class: 'bt prim', onclick: modalNovaDm }, 'Nova conversa') : null,
          h('button', { class: 'bt', onclick: () => $('#app').classList.remove('chat') }, 'Ver canais'))));
      return;
    }
    const titulo = c.dm ? (c.dm.grupo ? '👥 ' : '@ ') + c.dm.outro.nome : c.paiCanal ? '🧵 ' + c.nome : (c.tipo === 'assistir' ? '🍿 ' : '# ') + c.nome;
    const desc = c.dm ? '@' + c.dm.outro.usuario + (c.dm.outro.statusTexto ? ' · ' + c.dm.outro.statusTexto : '') : (servidorAtual() || {}).nome || '';
    const busca = h('input', { placeholder: 'Buscar ' + (c.dm ? c.dm.outro.nome : (servidorAtual() || {}).nome || ''), 'aria-label': 'Buscar mensagens' });
    busca.oninput = () => { if (c.dm) { E.busca = busca.value.trim().toLowerCase(); renderLista({ fim: true }); } };
    busca.onkeydown = (e) => { if (e.key === 'Enter' && !c.dm) { e.preventDefault(); buscarNoServidor(busca.value); } };
    if (!c.dm) busca.title = 'Enter pra buscar no servidor todo · use de:usuario pra filtrar quem mandou';
    const topo = h('header', { class: 'topo' },
      h('button', { class: 'icbtn voltar', title: 'Voltar', onclick: () => $('#app').classList.remove('chat') }, ic('voltar')),
      h('h1', {}, titulo), h('span', { class: 'desc' }, desc),
      h('button', { class: 'pill ia', onclick: verResumo }, '✦', h('span', { class: 'rotulo' }, ' O que eu perdi?')),
      // Mesma ordem do Discord: notificações, fixadas, membros, busca.
      h('button', { class: 'ic-topo', title: silenciado(c.id) ? 'Reativar avisos deste canal' : 'Silenciar este canal', onclick: (e) => {
        const on = alternarLocal('kali-silenciados', c.id); e.currentTarget.replaceChildren(ic(on ? 'sinoOff' : 'sino'));
        toast(on ? '🔕 Canal silenciado: sem som nem aviso' : '🔔 Avisos do canal reativados', 'ok');
      } }, ic(silenciado(c.id) ? 'sinoOff' : 'sino')),
      h('button', { class: 'ic-topo', title: 'Mensagens fixadas', onclick: () => modalFixadas(c.id) }, ic('pino')),
      c.dm && c.dm.grupo ? h('button', { class: 'ic-topo', title: 'Sair do grupo', onclick: () => sairDoGrupo(c) }, ic('porta')) : null,
      h('button', { class: 'ic-topo', title: 'Membros', onclick: alternarMembros }, ic('pessoas')),
      h('label', { class: 'pill busca' }, busca, ic('lupa', 16)));
    const lista = h('div', { class: 'col', id: 'lista' });
    const msgs = h('section', { class: 'msgs', id: 'msgs', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Mensagens' }, lista);
    msgs.addEventListener('scroll', () => { if (msgs.scrollTop < 80) carregarAntigas(); }, { passive: true });

    const ta = h('textarea', { rows: 1, maxlength: 2000, placeholder: (c.dm ? 'Conversar com @' + c.dm.outro.usuario : 'Conversar em #' + c.nome) + (c.modoLento ? ` · 🐢 modo lento: ${RLENTO.find((x) => x[0] === c.modoLento)?.[1] || c.modoLento + 's'}` : '') });
    ta.value = E.rascunho.get(c.id) || '';
    let ultimoDigitando = 0;
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; };
    ta.oninput = () => {
      E.rascunho.set(c.id, ta.value);
      ajustar();
      if (ta.value && Date.now() - ultimoDigitando > 2000) { ultimoDigitando = Date.now(); sock && sock.emit('digitando', { canalId: c.id }); }
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(c.id, ta); } };
    const emoji = h('button', { class: 'icbtn', type: 'button', title: 'Emoji' }, ic('sorriso'));
    emoji.onclick = () => abrirMenu(emoji, [h('div', { class: 'emojis' }, EMOJIS.map((em) => item(em, () => { ta.value += em; ta.oninput(); ta.focus(); }))),
      E.emojis.size ? [h('div', { class: 'sec-menu' }, 'Emojis dos seus servidores'), h('div', { class: 'emojis emojis-srv' },
        [...E.emojis].map(([nome, url]) => item(h('img', { class: 'emoji-srv', src: url, alt: ':' + nome + ':', title: ':' + nome + ':' }), () => { ta.value += `:${nome}: `; ta.oninput(); ta.focus(); })))] : null]);
    const info = h('span', { class: 'gravando', hidden: true });
    const bGrav = h('button', { class: 'icbtn', type: 'button', title: 'Mensagem de voz (até 60s, com transcrição)' }, ic('mic'));
    bGrav.onclick = () => alternarGravacao(c.id, bGrav, info);
    const curto = () => TEMPOS.find((t) => t[0] === E.temp)[2];
    const bTemp = h('button', { class: 'icbtn' + (E.temp ? ' temp-on' : ''), type: 'button', title: 'Mensagem temporária' }, curto());
    bTemp.onclick = () => abrirMenu(bTemp, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, 'A mensagem some depois de…'),
      TEMPOS.map(([s, r]) => item((E.temp === s ? '✓ ' : '') + r, () => { E.temp = s; bTemp.textContent = curto(); bTemp.classList.toggle('temp-on', !!s); }))]);
    const arq = h('input', { type: 'file', hidden: true, multiple: true });
    const enviarVarios = async (fs) => { for (const f of [...fs].slice(0, 10)) await enviarArquivo(c.id, f, ta); };
    arq.onchange = () => { enviarVarios(arq.files); arq.value = ''; };
    // Igual ao Discord: um ＋ à esquerda com arquivo e extras.
    const bAnexo = h('button', { class: 'icbtn mais-caixa' + (E.temp ? ' temp-on' : ''), type: 'button', title: 'Enviar arquivo e mais' }, ic('mais', 22));
    bAnexo.onclick = () => abrirMenu(bAnexo, [
      item('Enviar foto, GIF ou arquivo', () => arq.click()),
      item('Mensagem temporária: ' + TEMPOS.find((t) => t[0] === E.temp)[1], () => abrirMenu(bAnexo, [h('div', { class: 'sec-menu' }, 'A mensagem some depois de'),
        TEMPOS.map(([s, r]) => item((E.temp === s ? '✓ ' : '') + r, () => { E.temp = s; bAnexo.classList.toggle('temp-on', !!s); }))])),
      item('Enquete', () => { ta.value = '/enquete Pergunta? | Opção 1 | Opção 2'; ta.oninput(); ta.focus(); }),
    ]);
    ta.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); enviarVarios(fs); } });
    const compositor = h('div', { class: 'compositor' }, h('div', { class: 'col' },
      h('div', { class: 'digitando', id: 'digitando' }),
      h('div', { class: 'respondendo', id: 'respondendo', hidden: true }),
      h('div', { class: 'caixa' }, bAnexo, arq, ta, info, emoji, bGrav, h('button', { class: 'enviar', title: 'Enviar', onclick: () => enviar(c.id, ta) }, ic('enviar', 17))),
      h('div', { class: 'dica' }, '@usuario menciona · /time 5 Valorant · /pomodoro 25 · /confete /fogo /explosao')));
    main.replaceChildren(topo, c.tipo === 'assistir' ? h('section', { class: 'palco', id: 'palco' }) : '', msgs, compositor);
    // Arrastar e soltar arquivos em qualquer lugar do chat.
    const soltar = h('div', { class: 'soltar-aqui' }, h('div', {}, ic('mais', 34), h('b', {}, 'Solta pra enviar'), h('small', {}, (c.dm ? '@' + c.dm.outro.usuario : '#' + c.nome) + ' · até 10 arquivos')));
    let arrastando = 0;
    const temArq = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    main.ondragenter = (e) => { if (!temArq(e)) return; e.preventDefault(); if (++arrastando === 1) main.append(soltar); };
    main.ondragover = (e) => { if (temArq(e)) e.preventDefault(); };
    main.ondragleave = () => { if (--arrastando <= 0) { arrastando = 0; soltar.remove(); } };
    main.ondrop = (e) => { if (!temArq(e)) return; e.preventDefault(); arrastando = 0; soltar.remove(); enviarVarios(e.dataTransfer.files); };
    requestAnimationFrame(ajustar);
    renderResposta();
    renderLista({ fim: true });
    renderDigitando();
    if (matchMedia('(min-width: 761px)').matches) ta.focus();
  }

  // ---------- mensagens ----------
  // Formatação estilo Discord: `código`, ||spoiler||, **negrito**, *itálico*, links e @menções (sempre via textContent).
  function formatarTexto(texto) {
    const frag = document.createDocumentFragment();
    const re = /(`[^`\n]{1,500}`|\|\|[^|\n]{1,500}\|\||\*\*[^*\n]{1,500}\*\*|\*[^*\s][^*\n]{0,500}\*|~~[^~\n]{1,500}~~|__[^_\n]{1,500}__|\[[^\]\n]{1,200}\]\(https?:\/\/[^\s)<>"]+\)|https?:\/\/[^\s<>"]+|:[a-z0-9_]{2,32}:|@[a-z0-9_.]{3,20})/gi;
    let i = 0, m;
    const eu = '@' + E.eu.usuario;
    while ((m = re.exec(texto))) {
      if (m.index > i) frag.append(texto.slice(i, m.index));
      const t = m[0];
      if (t[0] === '`') frag.append(h('code', { class: 'cod' }, t.slice(1, -1)));
      else if (t.startsWith('||')) { const sp = h('span', { class: 'spoiler', title: 'Spoiler: clica pra ver' }, formatarTexto(t.slice(2, -2))); sp.onclick = () => sp.classList.add('visto'); frag.append(sp); }
      else if (t.startsWith('**')) frag.append(h('b', {}, formatarTexto(t.slice(2, -2))));
      else if (t[0] === '*') frag.append(h('i', {}, formatarTexto(t.slice(1, -1))));
      else if (t.startsWith('~~')) frag.append(h('s', {}, formatarTexto(t.slice(2, -2))));
      else if (t.startsWith('__')) frag.append(h('u', {}, formatarTexto(t.slice(2, -2))));
      else if (t[0] === '[') {
        const k = t.indexOf(']('), url = t.slice(k + 2, -1);
        const a = h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', title: url }, t.slice(1, k));
        a.onclick = (e) => { if (!confirm('Esse link leva pra:\n' + url + '\n\nAbrir?')) e.preventDefault(); };
        frag.append(a);
      }
      else if (t[0] === ':' && t.length > 2 && t.endsWith(':')) {
        const url = E.emojis.get(t.slice(1, -1).toLowerCase());
        frag.append(url ? h('img', { class: 'emoji-srv' + (texto.trim() === t ? ' grande' : ''), src: url, alt: t, title: t }) : t);
      }
      else if (t[0] === '@') frag.append(h('span', { class: 'men' + (t.toLowerCase() === eu ? ' eu' : '') }, t));
      else frag.append(h('a', { href: t, target: '_blank', rel: 'noopener noreferrer' }, t));
      i = m.index + t.length;
    }
    if (i < texto.length) frag.append(texto.slice(i));
    return frag;
  }
  // Markdown em bloco: ```código```, > citação, # títulos, - listas e 1. listas numeradas. Tudo via DOM (sem innerHTML).
  const RE_BLOCO = /^(```|> ?|#{1,3} |[-*] |\d{1,3}\. )/m;
  function formatarRico(texto) {
    if (!RE_BLOCO.test(texto)) return formatarTexto(texto);
    const frag = document.createDocumentFragment(), L = texto.split('\n');
    let buf = [];
    const solta = () => { if (buf.length) { frag.append(formatarTexto(buf.join('\n'))); buf = []; } };
    const junta = (re) => { const out = []; while (i < L.length && re.test(L[i])) out.push(L[i++]); return out; };
    let i = 0;
    while (i < L.length) {
      const l = L[i];
      if (l.startsWith('```')) {
        const fim = L.indexOf('```', i + 1);
        if (fim < 0) { buf.push(l); i++; continue; }
        solta();
        const cod = L.slice(i + 1, fim).join('\n'), lang = l.slice(3).trim().slice(0, 20);
        const copiar = h('button', { class: 'copiar-cod', type: 'button', title: 'Copiar código' }, 'Copiar');
        copiar.onclick = () => navigator.clipboard?.writeText(cod).then(() => { copiar.textContent = 'Copiado ✓'; setTimeout(() => { copiar.textContent = 'Copiar'; }, 1400); }).catch(() => {});
        frag.append(h('div', { class: 'bloco-cod' }, h('div', { class: 'bc-topo' }, h('span', {}, lang || 'código'), copiar), h('pre', {}, h('code', {}, cod))));
        i = fim + 1; continue;
      }
      if (/^> ?/.test(l)) { solta(); frag.append(h('blockquote', { class: 'cit' }, formatarTexto(junta(/^> ?/).map((x) => x.replace(/^> ?/, '')).join('\n')))); continue; }
      const t = /^(#{1,3}) (.+)/.exec(l);
      if (t) { solta(); frag.append(h('div', { class: 'md-h md-h' + t[1].length }, formatarTexto(t[2]))); i++; continue; }
      if (/^[-*] /.test(l)) { solta(); frag.append(h('ul', { class: 'md-lista' }, junta(/^[-*] /).map((x) => h('li', {}, formatarTexto(x.slice(2)))))); continue; }
      if (/^\d{1,3}\. /.test(l)) { solta(); frag.append(h('ol', { class: 'md-lista' }, junta(/^\d{1,3}\. /).map((x) => h('li', {}, formatarTexto(x.replace(/^\d{1,3}\. /, '')))))); continue; }
      buf.push(l); i++;
    }
    solta();
    return frag;
  }
  // Bloqueados e canais silenciados ficam só neste navegador.
  const listaLocal = (k) => { try { return JSON.parse(ler(k) || '[]'); } catch (e) { return []; } };
  const bloqueado = (uid) => listaLocal('kali-bloqueados').includes(uid);
  const silenciado = (canalId) => {
    if (listaLocal('kali-silenciados').includes(canalId)) return true;
    const c = acharCanal(canalId);
    return !!(c && c.servidorId && listaLocal('kali-srv-silenciados').includes(c.servidorId));
  };
  const alternarLocal = (k, id) => { const l = listaLocal(k); salvar(k, JSON.stringify(l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); return !l.includes(id); };

  function nodoMensagem(m, anterior) {
    const c = acharCanal(m.canalId);
    const s = c && E.servidores.find((x) => x.id === c.servidorId);
    const minha = m.autor && m.autor.id === E.eu.id;
    const agrupada = anterior && !m.sistema && !anterior.sistema && anterior.autor && m.autor &&
      anterior.autor.id === m.autor.id && m.criadoEm - anterior.criadoEm < 5 * 60e3 && dia(m.criadoEm) === dia(anterior.criadoEm);
    if (m.autor && bloqueado(m.autor.id)) {
      const aviso = h('div', { class: 'msg bloqueada', 'data-id': m.id }, h('span', { class: 'lado' }), h('button', { class: 'resposta-a' }, '🚫 Mensagem de usuário bloqueado — clica pra ver'));
      aviso.lastChild.onclick = () => aviso.replaceWith(nodoMensagem({ ...m, autor: { ...m.autor, _ver: true } }, null));
      if (!m.autor._ver) return aviso;
    }
    const div = h('div', { class: 'msg' + (agrupada ? ' agrupada' : '') + (mencionaEu(m) ? ' mencao' : ''), 'data-id': m.id });
    if (agrupada) div.append(h('span', { class: 'lado' }, hora(m.criadoEm)));
    else if (m.sistema || !m.autor) div.append(h('div', { class: 'av ia' }, logo()));
    else div.append(avatar(m.autor));
    const corpo = h('div', { class: 'corpo' });
    if (!agrupada) {
      if (m.sistema || !m.autor) corpo.append(h('b', { class: 'nome-ia' }, 'KALI'), h('span', { class: 'tag' }, 'IA'));
      else {
        const dono = s && s.donoId === m.autor.id, cor = s && !dono ? corCargo(s.id, m.autor.id) : null;
        corpo.append(h('b', { class: 'autor' + (dono && !m.autor.corNome ? ' nome-dono' : ''), style: estiloNome(m.autor.corNome) || (cor ? `color:${cor}` : null) }, m.autor.nome));
      }
      corpo.append(h('time', { title: new Date(m.criadoEm).toLocaleString('pt-BR') }, hora(m.criadoEm)));
    }
    if (m.fixada) corpo.append(h('span', { class: 'fixada', title: 'Mensagem fixada' }, '📌'));
    if (m.respostaA) {
      const r = m.respostaA;
      corpo.append(h('button', { class: 'resposta-a', onclick: () => irPara(r.id) },
        '↩ ', r.apagada ? h('i', {}, 'mensagem apagada') : [h('b', {}, r.autor), ' ', corta(r.texto, 90)]));
    }
    if (E.editando === m.id) {
      const ta = h('textarea', { rows: 2, maxlength: 2000 });
      ta.value = m.texto;
      const salvarEd = async () => {
        const t = ta.value.trim();
        if (!t || t === m.texto) { E.editando = null; return renderLista(); }
        const r = await pedir('msg:editar', { id: m.id, texto: t });
        if (r.erro) return toast(r.erro, 'erro');
        E.editando = null; renderLista();
      };
      ta.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); salvarEd(); }
        if (e.key === 'Escape') { e.stopPropagation(); E.editando = null; renderLista(); }
      };
      corpo.append(h('div', { class: 'edicao' }, ta, h('small', {}, 'Esc ', h('b', { onclick: () => { E.editando = null; renderLista(); } }, 'cancelar'), ' · Enter ', h('b', { onclick: salvarEd }, 'salvar'))));
      setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
    } else if (m.texto && alertaDe(m)) {
      corpo.append(h('div', { class: 'card alerta' }, h('h3', {}, '🚨 Alerta da staff'), h('div', { class: 'texto' }, formatarTexto(alertaDe(m)))));
    } else if (m.texto && RE_TRIBUNAL.test(m.texto)) {
      corpo.append(cartaoTribunal(m, RE_TRIBUNAL.exec(m.texto)));
    } else if (m.texto && enqueteDe(m.texto)) {
      const q = enqueteDe(m.texto);
      const votos = q.opcoes.map((_, i) => naReacao(m, NUMS[i]));
      const total = votos.reduce((t, v) => t + v.length, 0) || 1;
      corpo.append(h('div', { class: 'card' }, h('h3', {}, '📊 ' + q.pergunta),
        q.opcoes.map((op, i) => {
          const meu = votos[i].includes(E.eu.id);
          return h('button', { class: 'opcao' + (meu ? ' minha' : ''), onclick: () => reagir(m.id, NUMS[i]) },
            h('span', {}, `${NUMS[i]} ${op}`), h('small', {}, `${votos[i].length} voto(s)`), barra(votos[i].length / total * 100));
        }),
        h('div', { class: 'sub', style: 'margin-top:6px' }, 'Clica pra votar · clica de novo pra tirar')));
    } else if (m.texto && RE_DADO.test(m.texto)) {
      corpo.append(h('div', { class: 'card dado' }, rolar(m)));
    } else if (m.texto && RE_PENEIRA.test(m.texto)) {
      const quer = naReacao(m, '🙋'), autor = m.autor && m.autor.id === E.eu.id;
      corpo.append(h('div', { class: 'card' }, h('h3', {}, '🔎 Peneira'), h('div', { class: 'texto' }, formatarTexto(m.texto.replace(RE_PENEIRA, ''))),
        h('div', { class: 'sub', style: 'margin-top:6px' }, quer.length ? `🙋 ${quer.length} interessado(s): ` + quer.map(nomeDe).join(', ') : 'Ninguém se candidatou ainda.'),
        h('div', { class: 'acoes' }, autor
          ? quer.filter((id) => id !== E.eu.id).slice(0, 6).map((id) => {
            const u = [...E.membros.values()].flat().find((x) => x.id === id);
            return u ? h('button', { class: 'bt', onclick: () => abrirDmCom(u.usuario) }, '💬 Chamar ' + u.nome) : null;
          })
          : h('button', { class: 'bt' + (quer.includes(E.eu.id) ? '' : ' prim'), onclick: () => reagir(m.id, '🙋') }, quer.includes(E.eu.id) ? 'Desistir' : '🙋 Quero participar'))));
    } else if (m.texto && comandoDe(m.texto)) {
      corpo.append(cartaoComando(m, comandoDe(m.texto)));
    } else if (m.texto) {
      const ef = efeitoDe(m.texto);
      const tx = h('div', { class: 'texto' }, ef ? h('span', { class: 'tag-efeito' }, EFEITOS[ef][0] + ' ') : null, formatarRico(ef ? m.texto.replace(RE_EFEITO, '') : m.texto));
      if (m.editadoEm) {
        const podeVer = minha || (s && souStaffEm(s.id));
        tx.append(h(podeVer ? 'button' : 'span', { class: 'editado', type: podeVer ? 'button' : null, title: new Date(m.editadoEm).toLocaleString('pt-BR') + (podeVer ? ' · clica pra ver as versões' : ''),
          onclick: podeVer ? async () => {
            let v; try { v = await api('GET', `/mensagens/${m.id}/edicoes`); } catch (err) { return toast(err.message, 'erro'); }
            abrirModal({ titulo: 'Histórico de edições', sub: v.length ? 'Da mais nova pra mais antiga.' : 'Sem versões antigas guardadas.',
              corpo: [h('div', { class: 'lista-busca' }, h('div', { class: 'res-busca atual' }, h('div', { class: 'rb-topo' }, h('b', {}, 'Agora')), h('div', { class: 'rb-txt' }, m.texto)),
                v.map((x) => h('div', { class: 'res-busca' }, h('div', { class: 'rb-topo' }, h('small', {}, new Date(x.em).toLocaleString('pt-BR'))), h('div', { class: 'rb-txt' }, x.texto))))] });
          } : null }, '(editado)'));
      }
      if (m.expiraEm) tx.append(h('span', { class: 'expira', 'data-ate': m.expiraEm, title: 'Mensagem temporária' }, '⏱ ' + restante(m.expiraEm)));
      corpo.append(tx);
    }
    if (m.audio && m.audio.url) {
      const au = h('audio', { controls: true, preload: 'none' });
      au.src = m.audio.url;
      const vel = h('button', { class: 'pill vel', title: 'Velocidade' }, '1x');
      vel.onclick = () => { const v = { 1: 1.5, 1.5: 2, 2: 1 }[au.playbackRate] || 1; au.playbackRate = v; vel.textContent = String(v).replace('.', ',') + 'x'; };
      corpo.append(h('div', { style: 'margin-top:6px;display:flex;gap:8px;align-items:center' }, au, vel));
    }
    if (m.transcricao) corpo.append(h('div', { class: 'texto', style: 'color:var(--fraco);font-size:13px' }, '🎙 transcrito pela IA: ', m.transcricao));
    if (m.texto && !m.sistema && !m.anexo) {
      const link = m.texto.replace(/\|\|[^|]*\|\|/g, '').match(/https?:\/\/[^\s<>"]+/)?.[0];
      if (link) corpo.append(cartaoPrevia(link));
    }
    if (m.topico) corpo.append(h('button', { class: 'selo-topico', onclick: () => abrirCanal(m.topico.id) }, '🧵 ', h('b', {}, m.topico.nome), ' · abrir tópico'));
    if (m.anexo) {
      const a = m.anexo;
      if (a.tipo && a.tipo.startsWith('image/')) {
        corpo.append(h('a', { class: 'anexo-img', href: a.url, target: '_blank', rel: 'noopener' }, h('img', { src: a.url, alt: a.nome, loading: 'lazy' })));
      } else {
        const kb = a.tamanho > 1048576 ? (a.tamanho / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(a.tamanho / 1024)) + ' KB';
        corpo.append(h('a', { class: 'anexo-arq', href: a.url, download: a.nome }, h('span', { class: 'ic' }, '📄'),
          h('span', { class: 'txt' }, h('b', {}, a.nome), h('small', {}, kb + ' · clica pra baixar'))));
      }
    }
    if (m.reacoes && m.reacoes.length) {
      corpo.append(h('div', { class: 'reacoes' }, m.reacoes.map((r) => h('button', {
        class: 'reacao' + (r.usuarios.includes(E.eu.id) ? ' minha' : ''), title: r.usuarios.length + ' reação(ões)',
        onclick: () => reagir(m.id, r.emoji),
      }, r.emoji, ' ', r.usuarios.length))));
    }
    div.append(corpo);
    if (!m.sistema) {
      const acoes = h('div', { class: 'acoes-msg' });
      const bEmoji = h('button', { title: 'Reagir' }, '😀');
      bEmoji.onclick = () => abrirMenu(bEmoji, h('div', { class: 'emojis' }, EMOJIS.map((em) => item(em, () => reagir(m.id, em)))));
      const bLembrar = h('button', { title: 'Me lembra disso' }, '⏰');
      bLembrar.onclick = () => abrirMenu(bMais, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, 'Me lembra disso em…'),
        [[10, '10 minutos'], [60, '1 hora'], [180, '3 horas'], [1440, 'Amanhã']].map(([min, r]) => item(r, () => lembrar(m, min, r)))]);
      const bEnc = h('button', { title: 'Encaminhar' }, '↪');
      bEnc.onclick = () => {
        const destinos = [];
        for (const sv of E.servidores) for (const k of sv.canais) if (k.tipo === 'texto' && k.id !== m.canalId) destinos.push([k.id, `# ${k.nome} · ${sv.nome}`]);
        for (const d of E.dms) if (d.canalId !== m.canalId) destinos.push([d.canalId, '@ ' + d.outro.nome]);
        abrirMenu(bMais, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, 'Encaminhar para…'),
          destinos.length ? destinos.slice(0, 15).map(([id, r]) => item(r, async () => {
            const res = await pedir('msg:enviar', { canalId: id, texto: corta(`↪ Encaminhado de ${m.autor ? m.autor.nome : 'KALI'}: ${m.texto || '🎙 áudio'}`, 2000) });
            toast(res.erro || 'Mensagem encaminhada ↪', res.erro ? 'erro' : 'ok');
          })) : h('div', { style: 'padding:6px 10px' }, 'Nenhum outro canal.')]);
      };
      const bResp = h('button', { title: 'Responder' }, '↩️');
      bResp.onclick = () => { E.respondendo = m; renderResposta(); $('.caixa textarea')?.focus(); };
      // Igual ao Discord: reagir e responder à mostra; o resto no "⋯ Mais".
      const bMais = h('button', { title: 'Mais' }, '⋯');
      bMais.onclick = () => abrirMenu(bMais, [
        ehCelular() ? h('div', { class: 'emojis rapido' }, EMOJIS.map((em) => item(em, () => reagir(m.id, em)))) : null,
        minha && m.texto ? item('Editar mensagem', () => { E.editando = m.id; renderLista(); }) : null,
        item('Responder', () => bResp.click()),
        s && c && c.tipo === 'texto' && !c.paiCanal && !m.topico ? item('Criar tópico', () => {
          const nome = h('input', { maxlength: 40, placeholder: 'Nome do tópico', value: corta(m.texto || 'Tópico', 40) });
          abrirModal({ titulo: 'Criar tópico', sub: 'Uma conversa separada a partir desta mensagem.', corpo: [campo('Nome', nome)], botao: 'Criar',
            acao: async () => { const t = await api('POST', `/mensagens/${m.id}/topico`, { nome: nome.value.trim() }); aoCanalNovo(t); abrirCanal(t.id); } });
        }) : null,
        !s || souStaffEm(s.id) ? item(m.fixada ? 'Desafixar mensagem' : 'Fixar mensagem', async () => {
          const r = await pedir('msg:fixar', { id: m.id, fixar: !m.fixada });
          toast(r.erro || (m.fixada ? 'Mensagem desafixada' : 'Mensagem fixada 📌'), r.erro ? 'erro' : 'ok');
        }) : null,
        item('Encaminhar', () => bEnc.click()),
        item('Me lembra disso', () => bLembrar.click()),
        m.texto ? item('Copiar texto', () => { navigator.clipboard?.writeText(m.texto).then(() => toast('Texto copiado ✓', 'ok')).catch(() => {}); }) : null,
        !minha && s ? item('Denunciar mensagem', () => modalDenuncia(m)) : null,
        minha || souDono(s) ? item('Apagar mensagem', () => apagarMsg(m), 'perigo') : null,
      ].filter(Boolean));
      bLembrar.hidden = true; bEnc.hidden = true;
      acoes.append(bEmoji, bResp, bMais, bLembrar, bEnc);
      div.append(acoes);
      aoSegurar(div, (x, y) => { if (E.editando === m.id) return; ehCelular() ? bMais.click() : abrirMenuEm(x, y, bMais); });
    }
    return div;
  }

  function renderLista(opc) {
    opc = opc || {};
    const lista = $('#lista'), box = $('#msgs'), c = canalAtual();
    if (!lista || !box || !c) return;
    const perto = box.scrollHeight - box.scrollTop - box.clientHeight < 150;
    const alturaAntes = box.scrollHeight, topoAntes = box.scrollTop;
    const todas = E.msgs.get(c.id) || [];
    const itens = [];
    if (E.busca) {
      const achadas = todas.filter((m) => (m.texto || '').toLowerCase().includes(E.busca) || (m.autor && m.autor.nome.toLowerCase().includes(E.busca)));
      itens.push(h('div', { class: 'busca-info' }, h('span', {}, `${achadas.length} resultado(s) para “${E.busca}” nas mensagens carregadas`),
        h('button', { onclick: () => { E.busca = ''; $('.busca input').value = ''; renderLista({ fim: true }); } }, 'Limpar')));
      let ant = null;
      for (const m of achadas) { itens.push(nodoMensagem(m, ant)); ant = m; }
    } else {
      if (E.fim.has(c.id)) {
        itens.push(c.dm
          ? h('div', { class: 'boas' }, avatar(c.dm.outro, '', false), h('h2', { style: 'margin-top:10px' }, c.dm.outro.nome), h('p', {}, `Esse é o começo da sua conversa com @${c.dm.outro.usuario}.`))
          : h('div', { class: 'boas' }, h('h2', {}, `Bem-vindo ao #${c.nome} 👋`), h('p', {}, 'O começo de tudo. Chama a galera e puxa assunto.'),
            h('div', { class: 'chips' },
              h('button', { class: 'chip', onclick: () => { const t = $('.caixa textarea'); t.value = 'Salve, galera! 👋'; t.oninput(); t.focus(); } }, '👋 dar um oi'),
              h('button', { class: 'chip', onclick: modalConvite }, '📨 convidar amigos'),
              h('button', { class: 'chip', onclick: verResumo }, '✦ o que eu perdi?'))));
      } else if (todas.length) {
        itens.push(h('div', { class: 'carregando' }, 'Carregando mensagens antigas…'));
      } else {
        itens.push(h('div', { 'aria-busy': 'true', 'aria-label': 'Carregando mensagens' }, [0, 1, 2, 3].map(() => h('div', { class: 'esqueleto' }, h('i'), h('div', {}, h('b'), h('b'), h('b'))))));
      }
      let ant = null, diaAnt = '';
      const nova = E.novaDesde.get(c.id);
      for (const m of todas) {
        const d = dia(m.criadoEm);
        if (d !== diaAnt) { itens.push(h('div', { class: 'div-dia' }, d)); diaAnt = d; ant = null; }
        if (m.id === nova) { itens.push(h('div', { class: 'div-novas' }, 'Novas mensagens')); ant = null; }
        itens.push(nodoMensagem(m, ant));
        ant = m;
      }
      const r = E.resumo.get(c.id);
      if (r) itens.push(cartaoResumo(c.id, r));
    }
    if (E.foraDoFim === c.id) itens.push(h('button', { class: 'ir-presente', onclick: () => { E.foraDoFim = null; E.msgs.delete(c.id); abrirCanal(c.id); } }, 'Vendo mensagens antigas · Ir para o presente ↓'));
    lista.replaceChildren(...itens);
    // Só a mensagem que acabou de chegar entra animada (o histórico aparece parado).
    const msgsCanal = E.msgs.get(c.id) || [], ultimaVista = E.animado.get(c.id), agora = Date.now();
    lista.querySelectorAll('.msg[data-id]').forEach((el) => {
      const id = Number(el.dataset.id);
      if (ultimaVista != null && id > ultimaVista && !E.novaAte.has(id)) E.novaAte.set(id, agora + 700);
      if ((E.novaAte.get(id) || 0) > agora) el.classList.add('nova'); // continua animando se a tela redesenhar logo em seguida
    });
    if (msgsCanal.length) E.animado.set(c.id, msgsCanal[msgsCanal.length - 1].id);
    if (opc.preservar) box.scrollTop = box.scrollHeight - alturaAntes + topoAntes;
    else if (opc.fim || perto) box.scrollTop = box.scrollHeight;
  }

  async function carregarAntigas() {
    const c = canalAtual();
    if (!c || E.carregandoAntigas || E.fim.has(c.id) || E.busca) return;
    const arr = E.msgs.get(c.id);
    if (!arr || !arr.length) return;
    E.carregandoAntigas = true;
    try { await carregarMensagens(c.id, arr[0].id); if (E.canalId === c.id) renderLista({ preservar: true }); }
    catch (err) { toast(err.message, 'erro'); }
    finally { E.carregandoAntigas = false; }
  }

  async function enviar(canalId, ta) {
    const texto = ta.value.trim();
    if (!texto) return;
    ta.value = '';
    E.rascunho.delete(canalId);
    ta.style.height = 'auto';
    const dados = { canalId, texto };
    if (E.temp) dados.expiraEm = E.temp;
    if (E.respondendo && E.respondendo.canalId === canalId) dados.respostaA = E.respondendo.id;
    const r = await pedir('msg:enviar', dados);
    if (r.erro) { toast(r.erro, 'erro'); if (!ta.value) { ta.value = texto; E.rascunho.set(canalId, texto); } return; }
    E.respondendo = null; renderResposta();
    if (r.msg) aoMensagem(r.msg);
  }
  // Barra "Respondendo a fulano" em cima da caixa de texto.
  function renderResposta() {
    const el = $('#respondendo');
    if (!el) return;
    const m = E.respondendo && E.respondendo.canalId === E.canalId ? E.respondendo : null;
    el.hidden = !m;
    el.replaceChildren(...(m ? [h('span', {}, '↩ Respondendo a ', h('b', {}, m.autor ? m.autor.nome : 'KALI'), ': ', corta(m.texto || (m.anexo ? '📎 ' + m.anexo.nome : '🎙 áudio'), 60)),
      h('button', { title: 'Cancelar resposta', onclick: () => { E.respondendo = null; renderResposta(); } }, '✕')] : []));
  }
  async function enviarArquivo(canalId, arquivo, ta) {
    if (arquivo.size > 8 * 1048576) return toast('Arquivo grande demais (máximo 8 MB).', 'erro');
    const imagem = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(arquivo.type);
    const qs = new URLSearchParams({ nome: arquivo.name || 'imagem.png' });
    const legenda = ta && ta.value.trim();
    if (legenda) qs.set('legenda', legenda);
    if (E.respondendo && E.respondendo.canalId === canalId) qs.set('respostaA', E.respondendo.id);
    toast('Enviando ' + (imagem ? 'imagem' : 'arquivo') + '…');
    try {
      const r = await fetch(`/api/canais/${canalId}/anexo?${qs}`, { method: 'POST', headers: { 'Content-Type': imagem ? arquivo.type : 'application/octet-stream' }, body: arquivo });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || 'Não deu pra enviar o arquivo.');
      if (legenda) { ta.value = ''; E.rascunho.delete(canalId); ta.style.height = 'auto'; }
      E.respondendo = null; renderResposta();
      aoMensagem(d);
    } catch (err) { toast(err.message, 'erro'); }
  }
  async function modalFixadas(canalId) {
    let lista;
    try { lista = await api('GET', `/canais/${canalId}/fixadas`); } catch (err) { return toast(err.message, 'erro'); }
    abrirModal({ titulo: '📌 Mensagens fixadas', sub: lista.length ? 'Clica numa pra ir até ela.' : 'Nenhuma mensagem fixada neste canal ainda.',
      corpo: h('ul', { class: 'novidades' }, lista.map((m) => h('li', { style: 'cursor:pointer', onclick: () => { fecharModal(); irPara(m.id); } },
        h('div', {}, h('b', {}, m.autor ? m.autor.nome : 'KALI'), h('small', {}, corta(m.texto || (m.anexo ? '📎 ' + m.anexo.nome : '🎙 áudio'), 140)))))) });
  }
  async function reagir(id, emoji) { const r = await pedir('msg:reagir', { id, emoji }); if (r.erro) toast(r.erro, 'erro'); }
  async function apagarMsg(m) {
    if (!confirm('Apagar esta mensagem?')) return;
    const r = await pedir('msg:apagar', { id: m.id });
    if (r.erro) toast(r.erro, 'erro');
  }

  // ---------- resumo ----------
  async function verResumo() {
    const c = canalAtual();
    if (!c) return;
    try {
      const r = await api('GET', `/canais/${c.id}/resumo`);
      E.resumo.set(c.id, r);
      if (E.canalId === c.id) renderLista({ fim: true });
    } catch (err) { toast(err.message, 'erro'); }
  }
  function cartaoResumo(canalId, r) {
    const lista = (titulo, msgs) => msgs && msgs.length ? [h('h4', {}, titulo), h('ul', {}, msgs.map((m) =>
      h('li', { onclick: () => irPara(m.id) }, h('b', {}, m.autor ? m.autor.nome : 'KALI'), ': ', corta(m.texto || '🎙 áudio', 140))))] : [];
    return h('div', { class: 'msg' }, h('div', { class: 'av ia' }, logo()),
      h('div', { class: 'corpo' }, h('b', { class: 'nome-ia' }, 'KALI'), h('span', { class: 'tag' }, 'IA'), h('time', {}, 'agora'),
        h('div', { class: 'card' },
          h('h3', {}, '✦ Resumo enquanto você estava fora'),
          h('div', { class: 'sub' }, 'Só você vê isso · ', r.frase || `${r.total || 0} mensagens`),
          r.total ? [lista('Destaques', r.destaques), lista('Perguntas', r.perguntas), lista('Mencionaram você', r.mencoes)]
            : h('p', { class: 'sub' }, 'Nada novo por aqui. Você está em dia! ✨'),
          h('div', { class: 'acoes' }, h('button', { class: 'bt', onclick: () => { E.resumo.delete(canalId); renderLista(); } }, 'Fechar')))));
  }
  async function buscarNoServidor(texto, pagina = 0) {
    const s = servidorAtual();
    let q = (texto || '').trim(), de = '';
    const md = /(?:^|\s)de:@?([a-z0-9_.]{3,20})/i.exec(q);
    if (md) { de = md[1].toLowerCase(); q = q.replace(md[0], '').trim(); }
    if (!s || q.length < 2) return toast('Digita pelo menos 2 letras pra buscar.', 'erro');
    let d;
    try { d = await api('GET', `/servidores/${s.id}/busca?q=${encodeURIComponent(q)}${de ? '&de=' + de : ''}&pagina=${pagina}`); } catch (err) { return toast(err.message, 'erro'); }
    const res = d.resultados.map((m) => h('button', { type: 'button', class: 'res-busca', onclick: () => { fecharModal(); irPara(m.id, m.canalId); } },
      h('div', { class: 'rb-topo' }, h('b', {}, m.autor ? m.autor.nome : 'KALI'), h('small', {}, '#' + m.canalNome + ' · ' + new Date(m.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))),
      h('div', { class: 'rb-txt' }, corta(m.texto || '', 220))));
    abrirModal({ titulo: `Busca: “${q}”${de ? ' de @' + de : ''}`, sub: d.resultados.length ? `${d.resultados.length}${d.mais ? '+' : ''} resultado(s) em ${s.nome}. Clica pra ir até a mensagem.` : 'Nada encontrado.',
      corpo: [h('div', { class: 'lista-busca' }, res), d.mais || pagina ? h('div', { class: 'acoes', style: 'justify-content:space-between' },
        pagina ? h('button', { class: 'bt', type: 'button', onclick: () => buscarNoServidor(texto, pagina - 1) }, '← Anteriores') : h('span'),
        d.mais ? h('button', { class: 'bt', type: 'button', onclick: () => buscarNoServidor(texto, pagina + 1) }, 'Mais →') : null) : null] });
  }
  async function irPara(id, canalId) {
    canalId = canalId || E.canalId;
    if (canalId !== E.canalId) {
      const c = acharCanal(canalId);
      if (c && c.servidorId && c.servidorId !== E.servidorId) await selecionarServidor(c.servidorId);
      await abrirCanal(canalId);
    }
    let el = document.querySelector(`.msg[data-id="${Number(id)}"]`);
    if (!el) {
      try { E.msgs.set(canalId, await api('GET', `/canais/${canalId}/mensagens?ao_redor=${Number(id)}`)); } catch (err) { return toast(err.message, 'erro'); }
      E.foraDoFim = canalId; E.fim.delete(canalId);
      renderLista();
      el = document.querySelector(`.msg[data-id="${Number(id)}"]`);
      if (!el) return toast('Essa mensagem foi apagada.');
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('destaque'); void el.offsetWidth; el.classList.add('destaque');
  }

  // ---------- digitando ----------
  function renderDigitando() {
    const el = $('#digitando');
    if (!el) return;
    const mapa = E.digitando.get(E.canalId);
    const agora = Date.now();
    const nomes = mapa ? [...mapa.values()].filter((x) => x.ate > agora).map((x) => x.nome) : [];
    el.textContent = !nomes.length ? '' : nomes.length === 1 ? `${nomes[0]} está digitando…`
      : nomes.length <= 3 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} estão digitando…` : 'Várias pessoas estão digitando…';
  }
  setInterval(renderDigitando, 1000);

  // ---------- membros ----------
  function renderMembros() {
    const box = $('#membros');
    const fechar = h('div', { class: 'topo-membros' }, h('span', {}, 'Membros'), h('button', { class: 'icbtn', onclick: alternarMembros }, '✕'));
    const c = canalAtual();
    if (E.modo === 'dm') {
      if (!c || !c.dm) return box.replaceChildren(fechar);
      const o = c.dm.outro;
      const av = avatar(o, '', true);
      const [banner, ...extras] = vitrine(o);
      return box.replaceChildren(fechar, h('div', { class: 'perfil-dm' }, banner, av, h('h3', {}, o.nome, fazAniver(o) ? ' 🎂' : ''), h('small', {}, '@' + o.usuario + ' · ' + st(o.id)[1]),
        o.statusTexto ? h('p', {}, o.statusTexto) : null, ...extras));
    }
    const s = servidorAtual();
    const lista = s ? E.membros.get(s.id) : null;
    if (!lista) return box.replaceChildren(fechar, h('p', { class: 'vazio-lateral' }, s ? 'Carregando membros…' : ''));
    // Igual ao Discord: quem está online aparece agrupado pelo cargo (com cor); offline fica no fim.
    const cargosSrv = E.cargos.get(s.id) || [];
    const grupos = {};
    for (const c of cargosSrv) grupos[c.nome] = [];
    Object.assign(grupos, { Online: [], Ausente: [], Offline: [] });
    for (const m of lista) {
      const x = statusDe(m.id), cg = cargosSrv.find((c) => c.membros.includes(m.id));
      if (x === 'offline') grupos.Offline.push(m);
      else if (cg) grupos[cg.nome].push(m);
      else (x === 'ausente' ? grupos.Ausente : grupos.Online).push(m);
    }
    const partes = [fechar, cartaoMissao(s.id)].filter(Boolean);
    for (const [nome, membros] of Object.entries(grupos)) {
      if (!membros.length) continue;
      membros.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      partes.push(h('div', { class: 'rot' }, `${nome} — ${membros.length}`));
      for (const m of membros) {
        const b = h('button', { class: 'membro' + (nome === 'Offline' ? ' offline' : ''), 'data-uid': m.id, onclick: (e) => cartaoMembro(e.currentTarget, m) },
          avatar(m, '', true), h('span', { class: 'txt' }, h('b', { style: estiloNome(m.corNome) || (corCargo(s.id, m.id) ? `color:${corCargo(s.id, m.id)}` : null) }, m.nome, fazAniver(m) ? ' 🎂' : '', SELO_CARGO[m.cargo] ? h('span', { class: 'coroa', title: m.cargo }, SELO_CARGO[m.cargo]) : null),
            h('small', {}, rotStatus(m))));
        aoSegurar(b, (x, y) => menuUsuario(m, x, y));
        partes.push(b);
      }
    }
    box.replaceChildren(...partes);
  }
  // ---------- perfil vitrine ----------
  const BANNERS = {
    nebulosa: 'linear-gradient(135deg,#367bf0,#1fa2ff 55%,#2fd0ff)', oceano: 'linear-gradient(135deg,#0ea5e9,#2563eb,#312e81)',
    floresta: 'linear-gradient(135deg,#16a34a,#0d9488,#064e3b)', 'por-do-sol': 'linear-gradient(135deg,#f97316,#ef4444,#9d174d)',
    neon: 'linear-gradient(135deg,#22d3ee,#a855f7,#ec4899)', aurora: 'linear-gradient(135deg,#34d399,#60a5fa,#c084fc)',
  };
  const hojeMMDD = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fazAniver = (u) => !!(u && u.vitrine && u.vitrine.aniversario && u.vitrine.aniversario === hojeMMDD());
  function vitrine(u) {
    const v = (u && u.vitrine) || {};
    const banner = h('div', { class: 'banner-perfil' });
    banner.style.background = u && u.bannerImg ? `center/cover no-repeat url("${u.bannerImg}")` : BANNERS[v.banner] || BANNERS.nebulosa;
    const partes = [banner];
    if (v.bio) partes.push(h('p', { class: 'bio' }, v.bio));
    if (v.jogos && v.jogos.length) partes.push(h('div', { class: 'jogos' }, v.jogos.map((j) => h('span', { class: 'chip' }, '🎮 ' + j))));
    if (v.links && v.links.length) partes.push(h('div', { class: 'links-bio' }, v.links.map((l) => {
      let host = l; try { host = new URL(l).hostname.replace(/^www\./, ''); } catch (e) {}
      return h('a', { href: l, target: '_blank', rel: 'noopener noreferrer' }, '🔗 ' + host);
    })));
    if (v.aniversario) {
      const [mm, dd] = v.aniversario.split('-');
      partes.push(h('small', { class: 'aniver' }, (fazAniver(u) ? '🎉 Aniversário HOJE! ' : '🎂 ') + `${dd}/${mm}`));
    }
    return partes;
  }

  function cartaoMembro(ancora, m) {
    const [banner, ...extras] = vitrine(m); // banner → avatar → nome → @ → recado → bio/jogos/links/aniver
    const conteudo = [banner, avatar(m, 'av-vitrine', true), h('h3', {}, m.nome, fazAniver(m) ? ' 🎂' : ''),
      h('small', {}, '@' + m.usuario + (m.apelido ? ` (${m.nomeConta})` : '') + ' · ' + st(m.id)[1] + (m.nivel ? ` · ⭐ nível ${m.nivel}` : '')), m.statusTexto ? h('p', {}, m.statusTexto) : null, ...extras];
    const srv = servidorAtual();
    if (srv && E.modo === 'servidor' && (m.id === E.eu.id || souStaffEm(srv.id))) {
      conteudo.push(h('button', { class: 'bt', onclick: () => {
        fecharMenu();
        const ap = h('input', { maxlength: 32, value: m.apelido || '', placeholder: m.nomeConta || m.nome });
        abrirModal({ titulo: m.id === E.eu.id ? 'Mudar meu apelido' : 'Mudar apelido de ' + m.nome, sub: 'Só vale neste servidor. Vazio = nome normal.', corpo: [campo('Apelido', ap)], botao: 'Salvar',
          acao: async () => { await api('PUT', `/servidores/${srv.id}/apelido`, { apelido: ap.value.trim(), usuarioId: m.id === E.eu.id ? undefined : m.id }); toast('Apelido salvo ✓', 'ok'); } });
      } }, m.id === E.eu.id ? 'Mudar meu apelido' : 'Mudar apelido'));
    }
    if (m.id !== E.eu.id) {
      const vigia = vigiados().includes(m.id);
      conteudo.push(h('button', { class: 'bt', onclick: () => { fecharMenu(); toast(alternarLocal('kali-bloqueados', m.id) ? `🚫 ${m.nome} bloqueado: as mensagens dele ficam escondidas` : `${m.nome} desbloqueado`, 'ok'); renderLista(); } },
        bloqueado(m.id) ? 'Desbloquear' : '🚫 Bloquear'));
      const ehAmigo = E.amigos.amigos.some((x) => x.id === m.id), pediu = E.amigos.enviados.some((x) => x.id === m.id);
      conteudo.push(h('button', { class: 'bt prim', onclick: () => { fecharMenu(); abrirDmCom(m.usuario); } }, 'Mandar mensagem'),
        ehAmigo ? null : h('button', { class: 'bt', disabled: pediu, onclick: () => { fecharMenu(); adicionarAmigo(m.usuario).catch((err) => toast(err.message, 'erro')); } },
          pediu ? 'Pedido enviado' : '👋 Adicionar amigo'),
        h('button', { class: 'bt', onclick: () => {
          fecharMenu();
          salvar('kali-vigiados', JSON.stringify(vigia ? vigiados().filter((x) => x !== m.id) : [...vigiados(), m.id]));
          toast(vigia ? `Não vou mais avisar sobre ${m.nome}.` : `🔔 Te aviso quando ${m.nome} ficar online.`, 'ok');
        } }, vigia ? '🔕 Parar de avisar' : '🔔 Avisar quando ficar online'));
      const s = servidorAtual();
      if (s && E.modo === 'servidor') {
        const meu = nivelDe(s.id, E.eu.id), dele = nivelDe(s.id, m.id);
        if (meu === 4) conteudo.push(h('hr'), ['adm', 'mod', 'membro'].filter((c) => c !== m.cargo).map((c) =>
          h('button', { class: 'bt', onclick: () => { fecharMenu(); moderar(c, m); } }, c === 'membro' ? '⬇️ Tirar cargo' : `${SELO_CARGO[c]} Tornar ${c}`)));
        if (meu >= 2 && meu > dele) conteudo.push(
          h('button', { class: 'bt', onclick: (e) => abrirMenu(e.currentTarget, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, `Castigo pra ${m.nome} (não manda mensagem)`),
            [[1, '1 minuto'], [5, '5 minutos'], [10, '10 minutos'], [60, '1 hora'], [1440, '1 dia'], [10080, '1 semana'], [0, 'Tirar castigo']].map(([min, rot]) => item(rot, async () => {
              try { await api('POST', `/servidores/${servidorAtual().id}/membros/${m.id}/castigo`, { minutos: min }); toast(min ? `⏳ ${m.nome} de castigo por ${rot}` : `Castigo de ${m.nome} retirado`, 'ok'); } catch (err) { toast(err.message, 'erro'); }
            }))]) }, '⏳ Castigo'),
          h('button', { class: 'bt', onclick: () => { fecharMenu(); moderar('expulsar', m); } }, '👢 Expulsar'),
          h('button', { class: 'bt perigo', onclick: () => { fecharMenu(); moderar('banir', m); } }, '⛔ Banir'),
          h('button', { class: 'bt', onclick: () => { fecharMenu(); const t = $('.caixa textarea'); if (t) { t.value = `/tribunal @${m.usuario} `; t.oninput(); t.focus(); } } }, '⚖️ Levar ao tribunal'));
      }
    }
    abrirMenu(ancora, conteudo, 'menu-perfil');
  }
  // ---------- missões, XP e ranking ----------
  async function carregarMissoes(sid) {
    try { E.missoes.set(sid, await api('GET', `/servidores/${sid}/missoes`)); if (sid === E.servidorId) renderMembros(); } catch (e) {}
  }
  const barra = (p) => { const i = h('i'); i.style.width = Math.max(0, Math.min(100, p)) + '%'; return h('div', { class: 'barra' }, i); };
  function cartaoMissao(sid) {
    const m = E.missoes.get(sid);
    if (!m) return null;
    const pend = m.missoes.find((x) => !x.completa) || m.missoes[0];
    return h('div', { class: 'missao' },
      h('div', { class: 'missao-topo' }, h('b', {}, '🏆 Missão da semana'), h('button', { class: 'pill', onclick: () => modalRanking(sid) }, 'Ranking')),
      pend ? [h('small', {}, pend.titulo), barra(pend.valor / pend.meta * 100), h('small', {}, `${pend.valor}/${pend.meta}${pend.completa ? ' · completa ✅' : ' · +250 XP e selo'}`)] : null,
      h('small', { class: 'nivel' }, `⭐ Nível ${m.nivel} · ${m.xp}/${m.proximoNivelXp} XP`),
      m.selos.length ? h('div', { class: 'selos' }, m.selos.map((x) => h('span', { title: x.titulo }, x.emoji))) : null);
  }
  async function modalRanking(sid) {
    try {
      const lista = await api('GET', `/servidores/${sid}/ranking`);
      abrirModal({ titulo: '🏆 Ranking do servidor', sub: 'Quem mais movimentou a galera.', corpo: lista.length
        ? h('ol', { class: 'ranking' }, lista.map((x, i) => h('li', {}, h('span', {}, ['🥇', '🥈', '🥉'][i] || i + 1 + 'º'), avatar(x.usuario), h('b', {}, x.usuario.nome), h('small', {}, `Nível ${x.nivel} · ${x.xp} XP`))))
        : h('p', { class: 'sub' }, 'Ninguém pontuou ainda. Manda mensagem e entra na call!') });
    } catch (err) { toast(err.message, 'erro'); }
  }

  // ---------- mensagem de voz com transcrição ----------
  let gravacao = null;
  async function alternarGravacao(canalId, botao, info) {
    if (gravacao) return gravacao.parar(true);
    if (!window.MediaRecorder) return toast('Seu navegador não grava áudio.', 'erro');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Não consegui acessar seu microfone.', 'erro'); }
    const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
    const pedacos = [], inicio = Date.now();
    let texto = '', fala = null;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      try {
        fala = new SR(); fala.lang = 'pt-BR'; fala.continuous = true;
        fala.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) texto += e.results[i][0].transcript + ' '; };
        fala.start();
      } catch (e) { fala = null; }
    }
    rec.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
    const relogio = setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      info.textContent = `● Gravando ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} — ⏹ envia`;
      if (s >= 60 && gravacao) gravacao.parar(true);
    }, 250);
    info.textContent = '● Gravando 0:00 — ⏹ envia';
    info.hidden = false; botao.textContent = '⏹'; botao.classList.add('gravando-on');
    gravacao = {
      parar(mandar) {
        clearInterval(relogio); gravacao = null;
        info.hidden = true; botao.replaceChildren(ic('mic')); botao.classList.remove('gravando-on');
        const dur = Math.min(60, Math.max(0.5, (Date.now() - inicio) / 1000));
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (!mandar) return;
          if (fala) await new Promise((r) => setTimeout(r, 500)); // espera o último trecho transcrito
          const q = new URLSearchParams({ duracao: dur.toFixed(1) });
          if (texto.trim()) q.set('transcricao', texto.trim().slice(0, 1500));
          try {
            const r = await fetch(`/api/canais/${canalId}/audio?${q}`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: new Blob(pedacos, { type: 'audio/webm' }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.erro || 'Não consegui enviar o áudio.');
            aoMensagem(d);
          } catch (err) { toast(err.message, 'erro'); }
        };
        try { if (fala) fala.stop(); } catch (e) {}
        rec.stop();
      },
    };
    rec.start(250);
  }

  // ---------- assistir junto ----------
  let yt = null, video = null, aplicando = 0, estadoA = null, ytPromessa = null;
  async function entrarAssistir(id) {
    if (E.assistindo === id) return montarPalco();
    E.assistindo = id;
    const r = await pedir('assistir:entrar', { canalId: id });
    if (r.erro) { E.assistindo = null; return toast(r.erro, 'erro'); }
    estadoA = r.estado || null;
    montarPalco();
  }
  function sairAssistir() {
    if (!E.assistindo) return;
    if (sock) sock.emit('assistir:sair', { canalId: E.assistindo });
    E.assistindo = null; estadoA = null;
    destruirPlayer();
  }
  function destruirPlayer() { try { if (yt) yt.destroy(); } catch (e) {} yt = null; video = null; }
  function montarPalco() {
    const palco = $('#palco');
    if (!palco) return;
    destruirPlayer();
    const url = h('input', { placeholder: 'Cola um link do YouTube ou de vídeo .mp4/.webm', 'aria-label': 'Link do vídeo' });
    const form = h('form', { class: 'palco-barra' }, url, h('button', { class: 'bt prim' }, 'Tocar pra todo mundo'));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const r = await pedir('assistir:definir', { canalId: E.assistindo, url: url.value.trim() });
      if (r.erro) toast(r.erro, 'erro'); else url.value = '';
    };
    palco.replaceChildren(h('div', { class: 'palco-tela' }), form, h('small', { class: 'palco-quem' }));
    aplicarEstado();
  }
  const tempoEsperado = (e) => (e.tempo || 0) + (e.tocando ? (Date.now() - e.atualizadoEm) / 1000 : 0);
  function carregarYT() {
    if (window.YT && YT.Player) return Promise.resolve();
    if (!ytPromessa) ytPromessa = new Promise((res, rej) => {
      window.onYouTubeIframeAPIReady = res;
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytPromessa = null; rej(); };
      document.head.append(s);
    });
    return ytPromessa;
  }
  function aplicarEstado() {
    const tela = $('.palco-tela'), e = estadoA;
    if (!tela) return;
    const quem = $('.palco-quem');
    if (quem) quem.textContent = e && e.espectadores && e.espectadores.length ? '👀 Assistindo: ' + e.espectadores.map((x) => x.nome).join(', ') : '';
    if (!e || !e.url) {
      destruirPlayer(); delete tela.dataset.url;
      tela.replaceChildren(h('div', { class: 'palco-vazio' }, '🍿 Ninguém escolheu o vídeo ainda. Cola um link aí embaixo.'));
      return;
    }
    if (tela.dataset.url !== e.url) {
      destruirPlayer();
      tela.dataset.url = e.url;
      aplicando = Date.now();
      if (e.tipo === 'youtube') {
        const alvo = h('div');
        tela.replaceChildren(alvo);
        carregarYT().then(() => {
          if (tela.dataset.url !== e.url) return;
          yt = new YT.Player(alvo, { videoId: e.videoId, playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
            events: { onReady: sincronizar, onStateChange: (ev) => { if (ev.data === 1) controle('play', yt.getCurrentTime()); else if (ev.data === 2) controle('pause', yt.getCurrentTime()); } } });
        }).catch(() => toast('Não consegui carregar o YouTube.', 'erro'));
      } else {
        video = h('video', { controls: true, playsinline: true });
        video.src = e.url;
        video.addEventListener('play', () => controle('play', video.currentTime));
        video.addEventListener('pause', () => controle('pause', video.currentTime));
        video.addEventListener('seeked', () => controle('seek', video.currentTime));
        video.addEventListener('loadedmetadata', sincronizar, { once: true });
        tela.replaceChildren(video);
      }
      return;
    }
    sincronizar();
  }
  function sincronizar() {
    const e = estadoA;
    if (!e) return;
    aplicando = Date.now();
    const alvo = tempoEsperado(e);
    if (yt && yt.getCurrentTime) {
      if (Math.abs(yt.getCurrentTime() - alvo) > 1.5) yt.seekTo(alvo, true);
      if (e.tocando) yt.playVideo(); else yt.pauseVideo();
    } else if (video) {
      if (Math.abs(video.currentTime - alvo) > 1.5) video.currentTime = alvo;
      if (e.tocando) video.play().catch(() => {}); else video.pause();
    }
  }
  function controle(acao, tempo) {
    const e = estadoA;
    if (!E.assistindo || !e || Date.now() - aplicando < 1000) return;
    // ignora eventos que só repetem o estado atual (evita eco entre clientes)
    if (acao !== 'seek' && (acao === 'play') === !!e.tocando && Math.abs(tempo - tempoEsperado(e)) < 2) return;
    sock.emit('assistir:controle', { canalId: E.assistindo, acao, tempo }, (r) => { if (r && r.erro) toast(r.erro, 'erro'); });
  }

  // ---------- staff: cargos, moderação, senha, tickets, denúncias, tribunal ----------
  const NIVEL = { dono: 4, adm: 3, mod: 2, membro: 1 };
  const SELO_CARGO = { dono: '👑', adm: '🛡️', mod: '🔧' };
  const membroDe = (sid, uid) => (E.membros.get(sid) || []).find((m) => m.id === uid);
  const nivelDe = (sid, uid) => NIVEL[(membroDe(sid, uid) || {}).cargo] || (uid === (E.servidores.find((s) => s.id === sid) || {}).donoId ? 4 : 1);
  const souStaffEm = (sid) => nivelDe(sid, E.eu.id) >= 2;
  async function moderar(acao, m) {
    const s = servidorAtual();
    try {
      if (acao === 'expulsar') {
        if (!confirm(`Expulsar ${m.nome} do servidor?`)) return;
        await api('DELETE', `/servidores/${s.id}/membros/${m.id}`);
        toast(`👢 ${m.nome} foi expulso.`, 'ok');
      } else if (acao === 'banir') {
        const motivo = prompt(`Banir ${m.nome}? Motivo (opcional):`);
        if (motivo === null) return;
        await api('POST', `/servidores/${s.id}/banir`, { usuarioId: m.id, motivo });
        toast(`⛔ ${m.nome} foi banido.`, 'ok');
      } else {
        const r = await api('PATCH', `/servidores/${s.id}/membros/${m.id}`, { cargo: acao });
        aoMembroAtualizado({ servidorId: s.id, membro: r });
        toast(`Cargo de ${m.nome}: ${acao}`, 'ok');
      }
    } catch (err) { toast(err.message, 'erro'); }
  }
  function aoMembroAtualizado({ servidorId, membro }) {
    const lista = E.membros.get(servidorId);
    if (lista) { const i = lista.findIndex((x) => x.id === membro.id); if (i >= 0) lista[i] = Object.assign(lista[i], membro); }
    if (servidorId === E.servidorId) { renderMembros(); renderLista(); }
  }
  function modalSenhaCanal(c) {
    const senha = h('input', { type: 'password', maxlength: 64, placeholder: 'Senha do canal' });
    abrirModal({ titulo: '🔒 ' + c.nome, sub: 'Esse canal tem senha. Pede pra staff se não souber.', corpo: [campo('Senha', senha)], botao: 'Entrar',
      acao: async () => {
        await api('POST', `/canais/${c.id}/desbloquear`, { senha: senha.value });
        E.msgs.delete(c.id); E.fim.delete(c.id);
        await abrirCanal(c.id);
      } });
  }
  function modalTicket() {
    const s = servidorAtual();
    const assunto = h('input', { maxlength: 200, placeholder: 'Ex: fui xingado na call, preciso de ajuda' });
    abrirModal({ titulo: '🎫 Abrir ticket', sub: 'Abre um canal privado só entre você e a staff.', corpo: [campo('Assunto', assunto)], botao: 'Abrir ticket',
      acao: async () => { const c = await api('POST', `/servidores/${s.id}/tickets`, { assunto: assunto.value.trim() }); aoCanalNovo(c); await abrirCanal(c.id); } });
  }
  function modalDenuncia(m) {
    const s = E.servidores.find((x) => x.canais.some((k) => k.id === m.canalId));
    if (!s) return toast('Denúncia só funciona em servidor.', 'erro');
    const motivo = h('input', { maxlength: 500, placeholder: 'Ex: ofensa, golpe, spam…' });
    abrirModal({ titulo: '🚩 Denunciar mensagem', sub: `A mensagem de ${m.autor ? m.autor.nome : 'KALI'} vai como prova pra fila da staff.`, corpo: [campo('Motivo', motivo)], botao: 'Enviar denúncia', perigo: true,
      acao: async () => { await api('POST', `/servidores/${s.id}/denuncias`, { mensagemId: m.id, motivo: motivo.value.trim() }); toast('🚩 Denúncia enviada pra staff. Valeu!', 'ok'); } });
  }
  async function painelStaff() {
    const s = servidorAtual();
    try {
      const lista = await api('GET', `/servidores/${s.id}/denuncias`);
      const marcar = async (d, estado) => { try { await api('PATCH', `/denuncias/${d.id}`, { estado }); painelStaff(); } catch (err) { toast(err.message, 'erro'); } };
      abrirModal({ titulo: '🛡️ Painel da staff', sub: `${lista.filter((d) => d.estado === 'aberta').length} denúncia(s) aberta(s) em ${s.nome}`,
        corpo: lista.length ? h('ul', { class: 'denuncias' }, lista.map((d) => h('li', { class: d.estado },
          h('b', {}, `🚩 ${d.motivo}`), h('small', {}, `por ${d.autor.nome}${d.alvo ? ' · contra ' + d.alvo.nome : ''} · ${dia(d.criadoEm)} ${hora(d.criadoEm)} · ${d.estado}`),
          d.texto ? h('blockquote', {}, d.texto) : null,
          d.estado === 'aberta' ? h('div', { class: 'acoes' },
            h('button', { class: 'bt', type: 'button', onclick: () => marcar(d, 'resolvida') }, '✅ Resolver'),
            h('button', { class: 'bt', type: 'button', onclick: () => marcar(d, 'descartada') }, '🗑 Descartar'),
            d.alvo ? h('button', { class: 'bt perigo', type: 'button', onclick: async () => { fecharModal(); await moderar('banir', d.alvo); marcar(d, 'resolvida'); } }, '⛔ Banir') : null) : null)))
          : h('p', { class: 'sub' }, 'Nenhuma denúncia. Servidor em paz ✨') });
    } catch (err) { toast(err.message, 'erro'); }
  }
  // /tribunal @usuario motivo: staff vota com ✅/❌; maioria da staff libera o banimento
  const RE_TRIBUNAL = /^\/tribunal\s+@([a-z0-9_.]{3,20})\s*([\s\S]*)$/i;
  function cartaoTribunal(m, r) {
    const s = E.servidores.find((x) => x.canais.some((k) => k.id === m.canalId));
    const lista = s ? E.membros.get(s.id) || [] : [];
    const staff = lista.filter((x) => NIVEL[x.cargo] >= 2);
    const alvo = lista.find((x) => x.usuario === r[1].toLowerCase());
    const sim = naReacao(m, '✅').filter((id) => staff.some((x) => x.id === id));
    const nao = naReacao(m, '❌').filter((id) => staff.some((x) => x.id === id));
    const aprovado = staff.length && sim.length > staff.length / 2;
    const souStaff = s && souStaffEm(s.id);
    return h('div', { class: 'card tribunal' }, h('h3', {}, `⚖️ Tribunal da staff — @${r[1]}`),
      r[2] ? h('div', { class: 'texto' }, 'Motivo: ', r[2]) : null,
      h('div', { class: 'sub', style: 'margin-top:6px' }, `✅ ${sim.length} a favor · ❌ ${nao.length} contra · ${staff.length} na staff · ${aprovado ? 'APROVADO pela maioria' : 'precisa de maioria da staff'}`),
      souStaff ? h('div', { class: 'acoes' },
        h('button', { class: 'bt', onclick: () => reagir(m.id, '✅') }, '✅ Banir'),
        h('button', { class: 'bt', onclick: () => reagir(m.id, '❌') }, '❌ Não banir'),
        aprovado && alvo ? h('button', { class: 'bt perigo', onclick: () => moderar('banir', alvo) }, '⚖️ Executar banimento') : null)
        : h('div', { class: 'sub' }, 'Só a staff vota.'));
  }

  function alternarMembros() {
    const app = $('#app');
    if (matchMedia('(max-width: 1100px)').matches) app.classList.toggle('ver-membros');
    else app.classList.toggle('sem-membros');
  }

  // ---------- servidores, canais, convites ----------
  function adicionarServidor(s) {
    const i = E.servidores.findIndex((x) => x.id === s.id);
    if (i >= 0) E.servidores[i] = Object.assign(E.servidores[i], s); else E.servidores.push(s);
    Object.assign(E.naoLidos, s.naoLidos || {}); Object.assign(E.mencoes, s.mencoes || {});
  }
  const MODELOS = {
    amigos: { nome: '👋 Amigos (básico)', canais: [['memes', 'texto'], ['Cinema', 'assistir']] },
    fps: { nome: '🎯 FPS / competitivo', canais: [['partidas', 'texto'], ['clipes', 'texto'], ['Squad 1', 'voz'], ['Squad 2', 'voz']] },
    rp: { nome: '🎭 RP', canais: [['regras', 'texto'], ['personagens', 'texto'], ['off-rp', 'texto'], ['Cidade', 'voz']] },
    estudo: { nome: '📚 Estudo', canais: [['tarefas', 'texto'], ['duvidas', 'texto'], ['Sala de estudo', 'voz']] },
  };
  const NOVIDADES = [
    ['🌌', 'Sala 3D', 'Voz com áudio espacial: arrasta seu avatar no mapa.'],
    ['🍿', 'Assistir Junto', 'YouTube ou vídeo sincronizado com a galera.'],
    ['🏆', 'Missões e XP', 'Missão da semana, nível, selos e ranking.'],
    ['🎙', 'Áudio com transcrição', 'Grava até 60s e a IA escreve o que você falou.'],
    ['⏱', 'Mensagem temporária', 'Some sozinha depois do tempo escolhido.'],
    ['⛔', 'Modo foco', 'Sem avisos por 15 min até 2 h.'],
    ['⏰', 'Me lembra disso', 'Lembrete a partir de qualquer mensagem.'],
    ['🎥', 'Modo streamer', 'Esconde convites e DMs enquanto você está ao vivo.'],
    ['🎉', 'Mensagem com efeito', '/confete, /fogo e /explosao.'],
    ['🔔', 'Sons BR + vinheta', 'Escolha o som de aviso; toca vinheta quando alguém entra na call.'],
    ['🧩', 'Modelos prontos', 'Crie servidor de FPS, RP ou estudo já montado.'],
    ['🎮', 'Fecha o time', '/time 5 Valorant — avisa todo mundo quando completa.'],
    ['🍅', 'Pomodoro em grupo', '/pomodoro 25 — timer compartilhado pra estudar junto.'],
    ['🚨', 'Alerta geral', '/alerta texto — aviso urgente do dono que chega pra todo mundo.'],
    ['🪪', 'Perfil vitrine', 'Banner, bio, jogos favoritos, links e aniversário com parabéns automático.'],
    ['🖥️', 'Compartilhar tela grátis', '1080p/60fps na call, sem assinatura; várias telas em grade.'],
    ['🛡️', 'Staff completa', 'Cargos adm/mod, expulsar, banir, painel de denúncias com prova.'],
    ['🔒', 'Canal com senha', 'Área secreta: só entra quem tem a senha (a staff entra direto).'],
    ['🎫', 'Tickets de suporte', 'Canal privado entre você e a staff, pelo menu do servidor.'],
    ['⚖️', 'Tribunal da staff', '/tribunal @usuario motivo — a staff vota e a maioria libera o ban.'],
    ['🎨', 'Tema por servidor', 'Cada servidor com seu degradê próprio.'],
    ['🎧', 'Áudio HD grátis', 'Call em estéreo com bitrate alto, tira-ruído e eco cancelado.'],
    ['🏅', 'Selos lendários', 'Seus selos brilham no cartão da missão.'],
    ['📊', 'Enquete', '/enquete Qual jogo hoje? | Valorant | CS2 | LoL — votação ao vivo.'],
    ['👋', 'Boas-vindas automáticas', 'Quem entra por convite é anunciado no canal de avisos.'],
    ['🎲', 'Dados e moeda', '/dado 2d20, /dado 6, /moeda — resultado igual pra todo mundo (bom pra RP).'],
    ['🛡️', 'Anti-golpe', 'Bloqueia link de nitro/skin grátis e site falso de Discord/Steam.'],
    ['🔎', 'Peneira', '/peneira procuro duo ouro — a galera se candidata e você chama no privado.'],
    ['📐', 'Modo compacto', 'Mensagens mais juntinhas, cabe mais na tela.'],
    ['⌨️', 'Atalhos', 'Ctrl+Shift+M muta, D ensurdece, L sai da call.'],
    ['⏩', 'Áudio em 1,5x e 2x', 'Botão de velocidade em toda mensagem de voz.'],
    ['↪', 'Encaminhar mensagem', 'Manda pra outro canal ou DM com um clique.'],
    ['♿', 'Acessibilidade', 'Alto contraste e fonte grande no menu do perfil.'],
    ['💤', 'AFK inteligente', '10 min parado: fica ausente e muta o mic sozinho.'],
    ['🟢', 'Avisa quando ficar online', 'Clica num membro → 🔔 e a KALI te avisa quando ele entrar.'],
  ];
  const modalNovidades = () => abrirModal({ titulo: '✨ Novidades da KALI', sub: 'O que chegou no app. Logo: ideias da comunidade com votação.',
    corpo: h('ul', { class: 'novidades' }, NOVIDADES.map(([i, t, d]) => h('li', {}, h('span', {}, i), h('div', {}, h('b', {}, t), h('small', {}, d))))) });

  function modalServidor() {
    let aba = 'criar';
    const nome = h('input', { maxlength: 40, placeholder: 'Ex: Galera Gamer' });
    const codigo = h('input', { maxlength: 120, placeholder: 'Ex: aB3dE9xZ' });
    const modelo = h('select', {}, Object.entries(MODELOS).map(([k, m]) => h('option', { value: k }, m.nome)));
    const cModelo = campo('Modelo pronto', modelo);
    const cNome = campo('Nome do servidor', nome), cCod = campo('Código do convite', codigo);
    cCod.hidden = true;
    const bCriar = h('button', { type: 'button', class: 'ativa' }, 'Criar'), bEntrar = h('button', { type: 'button' }, 'Entrar com convite');
    const form = abrirModal({
      titulo: 'Seu novo canto', sub: 'Cria um servidor pra sua galera ou entra num que já existe.',
      corpo: [h('div', { class: 'abas' }, bCriar, bEntrar), cNome, cModelo, cCod], botao: 'Criar servidor',
      acao: async () => {
        let s;
        if (aba === 'criar') {
          s = await api('POST', '/servidores', { nome: nome.value.trim() });
          for (const [n, tipo] of MODELOS[modelo.value].canais) {
            try { s.canais.push(await api('POST', `/servidores/${s.id}/canais`, { nome: n, tipo })); } catch (e) {}
          }
        } else {
          const cod = codigoDoConvite(codigo.value);
          if (!cod) throw new Error('Cola o código do convite.');
          s = await api('POST', '/convites/' + encodeURIComponent(cod));
        }
        adicionarServidor(s);
        E.membros.delete(s.id);
        await selecionarServidor(s.id);
        toast(aba === 'criar' ? 'Servidor criado! 🎉' : 'Você entrou em ' + s.nome, 'ok');
      },
    });
    const trocar = (a) => {
      aba = a;
      bCriar.classList.toggle('ativa', a === 'criar'); bEntrar.classList.toggle('ativa', a === 'entrar');
      cNome.hidden = cModelo.hidden = a !== 'criar'; cCod.hidden = a !== 'entrar';
      form.querySelector('.bt.prim').textContent = a === 'criar' ? 'Criar servidor' : 'Entrar';
      (a === 'criar' ? nome : codigo).focus();
    };
    bCriar.onclick = () => trocar('criar');
    bEntrar.onclick = () => trocar('entrar');
  }
  // Link fixo (GitHub Pages) que leva pro servidor ligado e já entra no servidor convidado.
  const LINK_CONVITE = 'https://kaliorg01.github.io/kali/?c=';
  const codigoDoConvite = (t) => ((t || '').match(/[?&#]c(?:onvite)?=([A-Za-z0-9]+)/) || [])[1] || (t || '').trim().split('/').pop();
  // Amigos que ainda não estão no servidor, com botão que manda o link na DM.
  function listaConvidarAmigos(s, link) {
    const dentro = new Set((E.membros.get(s.id) || []).map((m) => m.id));
    const fora = E.amigos.amigos.filter((u) => !dentro.has(u.id));
    if (!E.amigos.amigos.length) return h('p', { class: 'sub' }, 'Adiciona amigos (pelo @ ou #ID) pra convidar eles com um clique.');
    if (!fora.length) return h('p', { class: 'sub' }, 'Todos os seus amigos já estão aqui. 🎉');
    return [h('div', { class: 'sub', style: 'margin:2px 0 6px' }, 'Convidar amigos:'), h('div', { class: 'lista-convidar' }, fora.map((u) => {
      const b = h('button', { class: 'bt prim', type: 'button' }, 'Convidar');
      b.onclick = async () => {
        b.disabled = true; b.textContent = 'Enviando…';
        try {
          const d = await api('POST', '/dms', { usuario: u.usuario });
          if (!E.dms.some((x) => x.canalId === d.canalId)) E.dms.unshift(d);
          const res = await pedir('msg:enviar', { canalId: d.canalId, texto: `Bora pro **${s.nome}** no KALI? 🐉 ${link}` });
          if (res.erro) throw new Error(res.erro);
          b.textContent = 'Enviado ✓';
        } catch (err) { b.disabled = false; b.textContent = 'Convidar'; toast(err.message, 'erro'); }
      };
      return h('div', { class: 'linha-convidar' }, avatar(u, '', true), h('span', { class: 'txt' }, h('b', {}, u.nome), h('small', {}, '@' + u.usuario)), b);
    }))];
  }
  function modalConvite() {
    const s = servidorAtual();
    if (!s) return;
    const link = LINK_CONVITE + s.convite;
    const botaoCopiar = (texto, rot) => {
      const b = h('button', { class: 'bt prim', type: 'button' }, rot);
      b.onclick = async () => {
        try { await navigator.clipboard.writeText(texto); b.textContent = 'Copiado ✓'; setTimeout(() => { b.textContent = rot; }, 1600); }
        catch (e) { toast('Não consegui copiar. Seleciona e copia na mão.', 'erro'); }
      };
      return b;
    };
    abrirModal({ titulo: 'Convidar pra ' + s.nome, sub: 'Manda o link pra galera: quem abrir já cai dentro do servidor (cria a conta se precisar).',
      corpo: [h('div', { class: 'convite convite-link' }, h('code', {}, link), botaoCopiar(link, 'Copiar link')),
        navigator.share ? h('button', { class: 'bt', type: 'button', style: 'width:100%;margin-bottom:12px', onclick: () => navigator.share({ title: 'KALI', text: 'Cola no ' + s.nome + ' no KALI 🐉', url: link }).catch(() => {}) }, 'Compartilhar…') : null,
        listaConvidarAmigos(s, link),
        h('div', { class: 'sub', style: 'margin:4px 0 6px' }, 'Ou o código, pra colar em + → Entrar com convite:'),
        h('div', { class: 'convite' }, h('code', {}, s.convite), botaoCopiar(s.convite, 'Copiar'))] });
  }
  // Campo de categoria com sugestão das que já existem no servidor.
  function campoCategoria(s, valor) {
    const id = 'cats-' + s.id;
    const input = h('input', { maxlength: 30, placeholder: 'Ex: JOGOS (vazio = sem categoria)', list: id, value: valor || '' });
    const lista = h('datalist', { id }, [...new Set(s.canais.map((c) => c.categoria).filter(Boolean))].map((c) => h('option', { value: c })));
    return { input, campo: [campo('Categoria', input), lista] };
  }
  const RLENTO = [[0, 'Desligado'], [5, '5 segundos'], [10, '10 segundos'], [30, '30 segundos'], [60, '1 minuto'], [300, '5 minutos'], [900, '15 minutos']];
  function modalEditarCanal(c, s) {
    const cat = campoCategoria(s, c.categoria);
    const lento = h('select', {}, RLENTO.map(([v, r]) => h('option', { value: v }, r)));
    lento.value = String(c.modoLento || 0);
    abrirModal({ titulo: 'Editar canal', sub: (c.tipo === 'texto' ? '# ' : '') + c.nome, corpo: [cat.campo, campo('🐢 Modo lento (cada pessoa espera entre mensagens)', lento)], botao: 'Salvar',
      acao: async () => {
        await api('PATCH', `/canais/${c.id}/config`, { categoria: cat.input.value.trim(), modoLento: Number(lento.value) });
        toast('Canal atualizado ✓', 'ok');
      } });
  }
  function modalCanal(tipoInicial, categoriaInicial) {
    const s = servidorAtual();
    if (!s) return;
    let tipo = tipoInicial || 'texto';
    const nome = h('input', { maxlength: 30, placeholder: 'novo-canal' });
    const bT = h('button', { type: 'button' }, h('b', {}, '# Texto'), 'Mensagens, memes, links');
    const bV = h('button', { type: 'button' }, h('b', {}, '🔊 Voz'), 'Call com a galera');
    const bA = h('button', { type: 'button' }, h('b', {}, '🍿 Assistir'), 'Vídeo junto');
    const senhaCanal = h('input', { type: 'password', maxlength: 64, placeholder: 'Deixe vazio pra canal aberto' });
    const marcar = () => {
      bT.classList.toggle('ativa', tipo === 'texto'); bV.classList.toggle('ativa', tipo === 'voz'); bA.classList.toggle('ativa', tipo === 'assistir');
      nome.placeholder = tipo === 'texto' ? 'novo-canal' : tipo === 'voz' ? 'Sala da galera' : 'Cinema';
    };
    bT.onclick = () => { tipo = 'texto'; marcar(); nome.focus(); };
    bV.onclick = () => { tipo = 'voz'; marcar(); nome.focus(); };
    bA.onclick = () => { tipo = 'assistir'; marcar(); nome.focus(); };
    const cx3d = h('input', { type: 'checkbox' });
    const linha3d = h('label', { class: 'campo', style: 'display:flex;gap:8px;align-items:center' }, cx3d, h('span', { style: 'margin:0' }, '🌌 Sala 3D — áudio espacial (só voz)'));
    nome.oninput = () => { if (tipo === 'texto') nome.value = nome.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); };
    marcar();
    const cat = campoCategoria(s, categoriaInicial || '');
    abrirModal({ titulo: 'Criar canal', sub: 'em ' + s.nome, corpo: [h('div', { class: 'tipos' }, bT, bV, bA), campo('Nome do canal', nome), cat.campo, linha3d, campo('🔒 Senha (opcional, só texto)', senhaCanal)], botao: 'Criar canal',
      acao: async () => {
        const corpo = { nome: nome.value.trim(), tipo };
        if (cat.input.value.trim()) corpo.categoria = cat.input.value.trim();
        if (tipo === 'voz' && cx3d.checked) corpo.espacial = true;
        if (tipo === 'texto' && senhaCanal.value) corpo.senha = senhaCanal.value;
        const c = await api('POST', `/servidores/${s.id}/canais`, corpo);
        aoCanalNovo(c);
        if (c.tipo !== 'voz') abrirCanal(c.id);
      } });
  }
  async function apagarCanal(c) {
    if (!confirm(`Apagar o canal "${c.nome}"? Todas as mensagens somem.`)) return;
    try { await api('DELETE', '/canais/' + c.id); aoCanalApagado({ id: c.id, servidorId: c.servidorId }); } catch (err) { toast(err.message, 'erro'); }
  }
  function menuServidor(ancora) {
    const s = servidorAtual();
    if (!s) return;
    // Mesma ordem do menu do servidor no Discord.
    const srvMudo = listaLocal('kali-srv-silenciados').includes(s.id);
    const extras = arguments[1] ? [item('Marcar tudo como lido', () => { s.canais.forEach((c) => { if (E.naoLidos[c.id]) marcarLido(c.id); }); renderSide(); renderRail(); })] : [];
    const itens = [item('Convidar pessoas', modalConvite),
      item(srvMudo ? '🔔 Reativar avisos do servidor' : '🔕 Silenciar servidor', () => { const on = alternarLocal('kali-srv-silenciados', s.id); toast(on ? 'Servidor silenciado: sem som nem aviso (menções também)' : 'Avisos do servidor reativados', 'ok'); }), ...extras];
    if (souStaffEm(s.id)) itens.push(item('Configurações do servidor', () => configServidor(s)));
    if (souDono(s)) itens.push(item('Criar canal', () => modalCanal('texto')));
    if (souStaffEm(s.id)) itens.push(item('Criar evento', () => modalCriarEvento(s)));
    itens.push(item('Abrir ticket com a staff', modalTicket));
    const atual = canalAtual();
    if (atual && atual.ticket && (atual.ticket === E.eu.id || souStaffEm(s.id))) itens.push(item('Fechar este ticket', () => apagarCanal(atual)));
    if (!souDono(s)) {
      itens.push(h('hr'), item('Sair do servidor', async () => {
        if (!confirm('Sair de ' + s.nome + '?')) return;
        try { await api('POST', `/servidores/${s.id}/sair`); aoServidorApagado({ id: s.id }); } catch (err) { toast(err.message, 'erro'); }
      }, 'perigo'));
    }
    if (arguments[1]) itens.push(item('Copiar ID do servidor', () => copiar(s.id, 'ID copiado ✓')));
    abrirMenu(ancora, itens);
  }

  // ---------- clique direito (ou segurar no celular): menus do jeito do Discord ----------
  const pontoEm = (x, y) => ({ getBoundingClientRect: () => ({ left: x, top: y, bottom: y, right: x, width: 0, height: 0 }) });
  const copiar = (t, ok) => navigator.clipboard?.writeText(String(t)).then(() => toast(ok || 'Copiado ✓', 'ok')).catch(() => toast('Não consegui copiar.', 'erro'));
  function menuUsuario(m, x, y) {
    const s = E.modo === 'servidor' ? servidorAtual() : null;
    const eu = m.id === E.eu.id, amigo = E.amigos.amigos.some((u) => u.id === m.id);
    const staff = s && souStaffEm(s.id) && !eu && s.donoId !== m.id;
    abrirMenu(pontoEm(x, y), [
      h('div', { class: 'sec-menu' }, m.nome + (m.usuario ? ' · @' + m.usuario : '')),
      item('Perfil', () => { const a = $(`.membro[data-uid="${m.id}"]`); cartaoMembro(a || pontoEm(x, y), m); }),
      !eu && m.usuario ? item('Mandar mensagem', () => abrirDmCom(m.usuario).catch((err) => toast(err.message, 'erro'))) : null,
      !eu && m.usuario ? item('Mencionar', () => { const t = $('.caixa textarea'); if (t) { t.value += (t.value && !t.value.endsWith(' ') ? ' ' : '') + '@' + m.usuario + ' '; t.oninput(); t.focus(); } }) : null,
      !eu && !amigo && m.usuario ? item('Adicionar amigo', () => adicionarAmigo(m.usuario).catch((err) => toast(err.message, 'erro'))) : null,
      staff ? [h('hr'), item('⏳ Castigar 10 min', async () => { try { await api('POST', `/servidores/${s.id}/membros/${m.id}/castigo`, { minutos: 10 }); toast(m.nome + ' de castigo por 10 min', 'ok'); } catch (err) { toast(err.message, 'erro'); } }),
        item('👢 Expulsar', () => moderar('expulsar', m)), item('⛔ Banir', () => moderar('banir', m), 'perigo')] : null,
      h('hr'),
      m.usuario ? item('Copiar @' + m.usuario, () => copiar('@' + m.usuario)) : null,
      item('Copiar ID #' + m.id, () => copiar('#' + m.id, 'ID copiado ✓')),
      !eu ? item(bloqueado(m.id) ? 'Desbloquear' : 'Bloquear', () => { toast(alternarLocal('kali-bloqueados', m.id) ? `🚫 ${m.nome} bloqueado` : `${m.nome} desbloqueado`, 'ok'); renderLista(); }, bloqueado(m.id) ? '' : 'perigo') : null,
    ].flat().filter(Boolean));
  }
  function menuCanal(c, s, x, y) {
    const n = E.naoLidos[c.id] || 0;
    abrirMenu(pontoEm(x, y), [
      h('div', { class: 'sec-menu' }, (c.tipo === 'voz' ? '🔊 ' : '# ') + c.nome),
      c.tipo !== 'voz' ? item('Marcar como lido', () => { marcarLido(c.id); renderSide(); renderRail(); }, n ? '' : 'apagado') : item('Entrar na call', () => abrirCanal(c.id)),
      item(silenciado(c.id) ? '🔔 Reativar avisos' : '🔕 Silenciar canal', () => { const on = alternarLocal('kali-silenciados', c.id); toast(on ? 'Canal silenciado' : 'Avisos do canal reativados', 'ok'); renderSide(); }),
      item('Convidar pessoas', modalConvite),
      souStaffEm(s.id) ? item('Editar canal', () => modalEditarCanal(c, s)) : null,
      h('hr'),
      item('Copiar ID do canal', () => copiar(c.id, 'ID copiado ✓')),
      souDono(s) ? item('Apagar canal', () => apagarCanal(c), 'perigo') : null,
    ].filter(Boolean));
  }
  async function menuServidorEm(sv, x, y) {
    if (E.modo !== 'servidor' || E.servidorId !== sv.id) await selecionarServidor(sv.id);
    menuServidor(pontoEm(x, y), true);
  }
  function menuDm(d, x, y) {
    abrirMenu(pontoEm(x, y), [
      h('div', { class: 'sec-menu' }, d.outro.nome),
      item('Marcar como lido', () => { marcarLido(d.canalId); renderSide(); renderRail(); }),
      item(silenciado(d.canalId) ? '🔔 Reativar avisos' : '🔕 Silenciar conversa', () => toast(alternarLocal('kali-silenciados', d.canalId) ? 'Conversa silenciada' : 'Avisos reativados', 'ok')),
      !d.grupo ? item('Copiar @' + d.outro.usuario, () => copiar('@' + d.outro.usuario)) : null,
      !d.grupo ? item('Copiar ID #' + d.outro.id, () => copiar('#' + d.outro.id, 'ID copiado ✓')) : null,
      d.grupo ? [h('hr'), item('Sair do grupo', () => sairDoGrupo({ id: d.canalId, dm: d }), 'perigo')] : null,
    ].flat().filter(Boolean));
  }
  // ---------- DMs e perfil ----------
  async function abrirDmCom(usuario) {
    const d = await api('POST', '/dms', { usuario });
    if (!E.dms.some((x) => x.canalId === d.canalId)) E.dms.unshift(d);
    E.presenca.set(d.outro.id, d.outro.status);
    E.modo = 'dm'; E.servidorId = null;
    await abrirCanal(d.canalId);
  }
  // ---------- emojis próprios ----------
  async function carregarEmojis() {
    try {
      const lista = await api('GET', '/eu/emojis');
      E.emojis = new Map();
      for (const e of lista) if (!E.emojis.has(e.nome)) E.emojis.set(e.nome, e.url);
      E.emojisLista = lista;
    } catch (e) { return; }
    if (E.canalId) renderLista();
  }
  function abaEmojis(s) {
    return (re) => {
      const meus = (E.emojisLista || []).filter((e) => e.servidorId === s.id);
      const nome = h('input', { maxlength: 32, placeholder: 'nome_do_emoji' });
      nome.oninput = () => { nome.value = nome.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); };
      const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp' });
      const enviar = async () => {
        const f = arq.files[0];
        if (!f) return toast('Escolha a imagem do emoji.', 'erro');
        const r = await fetch(`/api/servidores/${s.id}/emojis?nome=${encodeURIComponent(nome.value)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return toast(d.erro || 'Não deu pra enviar.', 'erro');
        toast(`Emoji :${d.nome}: criado ✓`, 'ok'); await carregarEmojis(); re();
      };
      return [
        h('p', { class: 'sub' }, `Use digitando :nome: em qualquer conversa. ${meus.length}/50 emojis.`),
        linhaCfg('Novo emoji', 'Quadrado, até 512 KB. GIF animado funciona.', nome, arq, h('button', { type: 'button', class: 'bt prim', onclick: enviar }, 'Enviar')),
        h('div', { class: 'grade-emojis' }, meus.map((e) => h('div', { class: 'emoji-item' }, h('img', { src: e.url, alt: e.nome }), h('small', {}, ':' + e.nome + ':'),
          h('button', { type: 'button', class: 'remover-item', title: 'Apagar', onclick: async () => {
            if (!confirm(`Apagar :${e.nome}:?`)) return;
            try { await api('DELETE', `/emojis/${e.id}`); await carregarEmojis(); re(); } catch (err) { toast(err.message, 'erro'); }
          } }, '✕')))),
      ];
    };
  }
  // ---------- prévia de link (o servidor busca e protege; imagem vem pelo servidor) ----------
  const previas = new Map(); // url → Promise
  function cartaoPrevia(url) {
    const el = h('div', { class: 'previa-link carregando' });
    if (!previas.has(url)) previas.set(url, api('GET', '/previa?url=' + encodeURIComponent(url)).catch(() => ({ vazio: true })));
    previas.get(url).then((d) => {
      if (!d || d.vazio) return el.remove();
      el.classList.remove('carregando');
      el.replaceChildren(...[h('div', { class: 'previa-txt' }, h('small', {}, d.site),
        h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, d.titulo), d.descricao ? h('p', {}, d.descricao) : null),
        d.imagem ? h('img', { src: d.imagem, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : null].filter(Boolean));
    });
    return el;
  }
  // ---------- eventos do servidor ----------
  async function carregarEventos(sid) {
    try { E.eventos.set(sid, await api('GET', `/servidores/${sid}/eventos`)); } catch (e) { return; }
    if (sid === E.servidorId) renderSide();
  }
  const quandoEvento = (ms) => new Date(ms).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  function modalEventos(s) {
    const lista = E.eventos.get(s.id) || [];
    const staff = souStaffEm(s.id);
    abrirModal({ titulo: '📅 Eventos de ' + s.nome, sub: lista.length ? 'Marque presença pra galera saber quem vai.' : 'Nenhum evento marcado.',
      corpo: [h('ul', { class: 'novidades eventos' }, lista.map((e) => h('li', {},
        h('div', { class: 'data-ev' }, h('b', {}, new Date(e.inicio).getDate()), h('small', {}, new Date(e.inicio).toLocaleString('pt-BR', { month: 'short' }))),
        h('div', { style: 'flex:1;min-width:0' }, h('b', {}, e.titulo), h('small', {}, quandoEvento(e.inicio) + (e.inicio < Date.now() ? ' · 🔴 acontecendo' : '') + ` · ${e.interessados} vai(ão)`),
          e.descricao ? h('small', { style: 'display:block' }, e.descricao) : null),
        h('div', { class: 'acoes-cargo' },
          h('button', { type: 'button', class: 'bt' + (e.euVou ? '' : ' prim'), onclick: async () => { await api('POST', `/eventos/${e.id}/interesse`).catch((err) => toast(err.message, 'erro')); await carregarEventos(s.id); modalEventos(s); } }, e.euVou ? 'Vou ✓' : 'Eu vou'),
          staff ? h('button', { type: 'button', class: 'bt', title: 'Cancelar evento', onclick: async () => { if (!confirm('Cancelar ' + e.titulo + '?')) return; await api('DELETE', `/eventos/${e.id}`).catch((err) => toast(err.message, 'erro')); await carregarEventos(s.id); modalEventos(s); } }, '🗑') : null)))),
        staff ? h('button', { type: 'button', class: 'bt prim', style: 'margin-top:8px', onclick: () => modalCriarEvento(s) }, 'Criar evento') : null] });
  }
  function modalCriarEvento(s) {
    const titulo = h('input', { maxlength: 80, placeholder: 'Ex: Campeonato de Valorant' });
    const desc = h('input', { maxlength: 500, placeholder: 'Detalhes (opcional)' });
    const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    const quando = h('input', { type: 'datetime-local', value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00` });
    abrirModal({ titulo: 'Criar evento', sub: 'em ' + s.nome, corpo: [campo('Nome do evento', titulo), campo('Quando', quando), campo('Descrição', desc)], botao: 'Criar evento',
      acao: async () => {
        await api('POST', `/servidores/${s.id}/eventos`, { titulo: titulo.value.trim(), descricao: desc.value.trim(), inicio: new Date(quando.value).getTime() });
        await carregarEventos(s.id); toast('Evento criado 📅', 'ok');
      } });
  }
  // ---------- tela Amigos (abas Online / Todos / Pendentes / Bloqueados / Adicionar amigo) ----------
  function abrirAmigos() {
    E.modo = 'dm'; E.servidorId = null; E.telaAmigos = true;
    $('#app').classList.add('chat');
    render();
  }
  function renderAmigos(main) {
    const A = E.amigos, aba = E.abaAmigos || 'online';
    const abas = [['online', 'Online'], ['todos', 'Todos'], ['pendentes', 'Pendentes' + (A.recebidos.length ? ` (${A.recebidos.length})` : '')], ['bloqueados', 'Bloqueados']];
    const trocar = (a) => { E.abaAmigos = a; renderAmigos(main); };
    const topo = h('header', { class: 'topo topo-amigos' },
      h('button', { class: 'icbtn voltar', title: 'Voltar', onclick: () => $('#app').classList.remove('chat') }, ic('voltar')),
      h('h1', {}, '👋 Amigos'),
      h('div', { class: 'abas-amigos' }, abas.map(([k, r]) => h('button', { class: aba === k ? 'ativa' : '', onclick: () => trocar(k) }, r)),
        h('button', { class: 'add' + (aba === 'adicionar' ? ' ativa' : ''), onclick: () => trocar('adicionar') }, 'Adicionar amigo')));
    const linha = (u, sub, ...acoes) => h('div', { class: 'linha-amigo' }, avatar(u, '', true),
      h('div', { class: 'txt' }, h('b', {}, u.nome, ' ', h('small', {}, '@' + u.usuario)), h('small', {}, sub)), h('div', { class: 'acoes' }, acoes));
    const bt = (rot, titulo, fn, cls) => h('button', { class: 'icbtn ' + (cls || ''), title: titulo, onclick: fn }, rot);
    const abrirDm = (u) => { E.telaAmigos = false; abrirDmCom(u.usuario).catch((err) => toast(err.message, 'erro')); };
    const conversar = (u) => bt(ic('balao', 18), 'Mandar mensagem', () => abrirDm(u));
    let itens = [], titulo = '';
    if (aba === 'online' || aba === 'todos') {
      const lista = A.amigos.filter((u) => aba === 'todos' || st(u.id)[0] !== 'off');
      titulo = `${aba === 'online' ? 'Online' : 'Todos os amigos'} — ${lista.length}`;
      itens = lista.map((u) => linha(u, st(u.id)[1], conversar(u),
        bt(ic('x', 18), 'Desfazer amizade', () => { if (confirm(`Desfazer amizade com ${u.nome}?`)) acaoAmigo('DELETE', `/amigos/${u.id}`); }, 'perigo')));
    } else if (aba === 'pendentes') {
      titulo = `Pendentes — ${A.recebidos.length + A.enviados.length}`;
      itens = [...A.recebidos.map((u) => linha(u, 'Pedido de amizade recebido',
        bt(ic('check', 18), 'Aceitar', () => acaoAmigo('POST', `/amigos/${u.id}/aceitar`, `Agora você e ${u.nome} são amigos!`), 'ok'),
        bt(ic('x', 18), 'Recusar', () => acaoAmigo('DELETE', `/amigos/${u.id}`), 'perigo'))),
      ...A.enviados.map((u) => linha(u, 'Pedido enviado', bt(ic('x', 18), 'Cancelar pedido', () => acaoAmigo('DELETE', `/amigos/${u.id}`), 'perigo')))];
    } else if (aba === 'bloqueados') {
      const ids = listaLocal('kali-bloqueados');
      titulo = `Bloqueados — ${ids.length}`;
      itens = ids.map((id) => linha({ id, nome: nomeDe(id), usuario: String(id) }, 'Bloqueado neste aparelho',
        h('button', { class: 'bt', onclick: () => { alternarLocal('kali-bloqueados', id); renderAmigos(main); renderLista(); } }, 'Desbloquear')));
    } else {
      const u = h('input', { maxlength: 20, placeholder: '@usuario ou #ID da pessoa' });
      u.autocapitalize = 'none';
      const enviar = async () => { try { await adicionarAmigo(u.value.trim()); u.value = ''; } catch (err) { toast(err.message, 'erro'); } };
      u.onkeydown = (e) => { if (e.key === 'Enter') enviar(); };
      main.replaceChildren(topo, h('section', { class: 'col amigos-corpo' }, h('h3', {}, 'ADICIONAR AMIGO'),
        h('p', { class: 'sub' }, 'Adiciona pelo @ da pessoa ou pelo ID dela (ex: #12).'),
        h('div', { class: 'add-amigo' }, u, h('button', { class: 'bt prim', onclick: enviar }, 'Enviar pedido de amizade')),
        meuId()));
      return;
    }
    // Início: saudação + atalhos em cima, lista de amigos, e "Ativo agora" à direita.
    const online = A.amigos.filter((u) => st(u.id)[0] !== 'off');
    const hr = new Date().getHours();
    const saud = hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
    const stat = (n, rot) => h('div', { class: 'hh-stat' }, h('b', {}, n), h('small', {}, rot));
    const card = (icone, tit, sub, fn) => h('button', { class: 'home-card', onclick: fn }, h('span', { class: 'hc-ic' }, icone), h('span', { class: 'hc-txt' }, h('b', {}, tit), h('small', {}, sub)));
    const inicio = aba === 'online' || aba === 'todos';
    const vazio = h('div', { class: 'vazio-home' }, h('div', { class: 'vh-logo' }, logo('logo-grande')),
      h('b', {}, aba === 'online' ? (A.amigos.length ? 'Ninguém online agora' : 'Sua lista tá vazia') : aba === 'pendentes' ? 'Nenhum pedido pendente' : 'Nada por aqui'),
      h('p', {}, aba === 'online' && A.amigos.length ? 'Quando a galera entrar, ela aparece aqui.' : 'Adiciona alguém pelo @ e começa a resenha.'),
      aba !== 'bloqueados' ? h('button', { class: 'bt prim', onclick: () => trocar('adicionar') }, 'Adicionar amigo') : null);
    const corpo = h('section', { class: 'col amigos-corpo' },
      inicio ? h('div', { class: 'home-hero' },
        h('div', { class: 'hh-txt' }, h('small', { class: 'hh-prompt' }, 'root@kali:~$ ./inicio'),
          h('h2', {}, saud + ', ', h('span', { class: 'grad-txt' }, E.eu.nome)),
          h('p', {}, online.length ? `${online.length} amigo${online.length > 1 ? 's' : ''} online agora. Bora?` : 'Tudo calmo por aqui. Chama alguém pra resenha.')),
        h('div', { class: 'hh-stats' }, stat('#' + E.eu.id, 'seu id'), stat(online.length, 'online'), stat(A.amigos.length, 'amigos'))) : null,
      inicio ? h('div', { class: 'home-acoes' },
        card(ic('convidar', 22), 'Adicionar amigo', 'Pelo @ da pessoa', () => trocar('adicionar')),
        card(ic('mais', 22), 'Criar servidor', 'Sua galera, suas regras', modalServidor),
        card(ic('hash', 22), 'Entrar com convite', 'Tem um código? Cola aqui', modalServidor),
        card(ic('loja', 22), 'Loja', 'Banner, moldura e cor do nome', modalLoja)) : null,
      h('div', { class: 'rot' }, titulo),
      itens.length ? h('div', { class: 'lista-amigos' }, itens) : vazio);
    const ativo = h('aside', { class: 'ativo-agora' }, h('h3', {}, 'Ativo agora'),
      online.length ? online.slice(0, 10).map((u) => h('button', { class: 'ativo-item', onclick: () => abrirDm(u) }, avatar(u, '', true),
        h('span', { class: 'txt' }, h('b', {}, u.nome), h('small', {}, u.statusTexto || st(u.id)[1]))))
        : h('div', { class: 'ativo-vazio' }, h('b', {}, 'Tá tranquilo por enquanto…'), h('small', {}, 'Quando seus amigos ficarem online, eles aparecem aqui.')));
    main.replaceChildren(topo, h('div', { class: 'home' }, corpo, ativo));
  }
  // Cartão "Seu ID" pra passar pros amigos te acharem.
  function meuId() {
    const cod = '#' + E.eu.id;
    const b = h('button', { class: 'bt', type: 'button' }, 'Copiar');
    b.onclick = () => navigator.clipboard?.writeText(cod).then(() => { b.textContent = 'Copiado ✓'; setTimeout(() => { b.textContent = 'Copiar'; }, 1500); }).catch(() => {});
    return h('div', { class: 'meu-id' }, h('div', {}, h('small', {}, 'SEU ID'), h('b', {}, cod), h('small', {}, 'ou @' + E.eu.usuario + ' · manda pros amigos te adicionarem')), b);
  }
  // ---------- amigos ----------
  async function carregarAmigos() {
    try { E.amigos = await api('GET', '/amigos'); } catch (e) { return; }
    for (const u of [...E.amigos.amigos, ...E.amigos.recebidos, ...E.amigos.enviados]) E.presenca.set(u.id, u.status);
    if (E.modo === 'dm' && E.telaAmigos && E.eu) renderMain();
  }
  async function acaoAmigo(metodo, rota, ok) {
    try { await api(metodo, rota); if (ok) toast(ok, 'ok'); } catch (e) { return toast(e.message, 'erro'); }
    await carregarAmigos(); renderRail(); if (E.modo === 'dm') renderSide();
  }
  async function adicionarAmigo(usuario) {
    usuario = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
    const r = await api('POST', '/amigos', { usuario });
    toast(r.amigos ? 'Vocês agora são amigos! 🎉' : 'Pedido de amizade enviado ✓', 'ok');
    await carregarAmigos(); if (E.modo === 'dm') renderSide();
  }
  function modalAdicionarAmigo() {
    const u = h('input', { maxlength: 20, placeholder: 'nome_de_usuario' });
    u.autocapitalize = 'none';
    abrirModal({ titulo: 'Adicionar amigo', sub: 'Digita o nome de usuário do seu amigo (o @ dele).', corpo: [campo('Usuário', u)], botao: 'Enviar pedido',
      acao: () => adicionarAmigo(u.value.trim()) });
  }
  // ---------- foto, banner e ícone ----------
  async function recarregarEu() { E.eu = await api('GET', '/eu'); render(); }
  function escolherImagem(rota) {
    const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp' });
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      if (f.size > 4 * 1048576) return toast('Imagem grande demais (máximo 4 MB).', 'erro');
      toast('Enviando imagem…');
      try {
        const r = await fetch('/api' + rota, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: f });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.erro || 'Não deu pra enviar a imagem.');
        if (rota.startsWith('/eu/')) await recarregarEu(); else { adicionarServidor(d); render(); }
        toast('Imagem atualizada ✓', 'ok');
      } catch (err) { toast(err.message, 'erro'); }
    };
    inp.click();
  }
  // ---------- loja ----------
  const TIPOS_LOJA = { banner: 'Banners', moldura: 'Molduras de foto', cor: 'Cor do nome' };
  const reais = (c) => c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis';
  async function modalLoja() {
    let L;
    try { L = await api('GET', '/loja'); } catch (err) { return toast(err.message, 'erro'); }
    const recarregar = async () => { await recarregarEu(); modalLoja(); };
    const cartao = (i) => {
      const meu = L.meus.includes(i.id), usando = L.equipados[i.tipo] === i.id;
      const previa = i.tipo === 'banner' ? h('img', { class: 'previa-banner', src: i.imagem, alt: '' })
        : i.tipo === 'moldura' ? avatar({ ...E.eu, moldura: i.imagem }, 'previa-av')
          : h('b', { class: 'previa-cor', style: estiloNome(i.cor) }, E.eu.nome);
      const acao = meu
        ? h('button', { type: 'button', class: 'bt' + (usando ? '' : ' prim'), onclick: async () => {
          try { await api('POST', '/loja/equipar', { tipo: i.tipo, itemId: usando ? null : i.id }); await recarregar(); } catch (err) { toast(err.message, 'erro'); }
        } }, usando ? 'Em uso (tirar)' : 'Usar')
        : h('small', { class: 'sub' }, reais(i.preco) + ' · fale com o dono pra comprar');
      return h('div', { class: 'item-loja' + (usando ? ' usando' : '') }, previa, h('b', {}, i.nome), acao);
    };
    const secoes = Object.entries(TIPOS_LOJA).map(([t, rot]) => {
      const itens = L.itens.filter((i) => i.tipo === t);
      return [h('div', { class: 'sec-menu' }, rot), itens.length ? h('div', { class: 'loja-grade' }, itens.map(cartao)) : h('p', { class: 'sub' }, 'Nada aqui ainda.')];
    });
    const corpo = [secoes];
    if (E.eu.admin) corpo.push(h('a', { class: 'bt', href: '/painel', target: '_blank', rel: 'noopener', style: 'display:block;text-align:center;margin-top:6px' }, 'Abrir painel do dono'));
    abrirModal({ titulo: 'Loja', sub: 'Itens exclusivos pro seu perfil.', corpo });
  }
  // ---------- cargos personalizados ----------
  async function carregarCargos(sid) { E.cargos.set(sid, await api('GET', `/servidores/${sid}/cargos`)); }
  function modalCargos(s) {
    const lista = E.cargos.get(s.id) || [];
    const nome = h('input', { maxlength: 30, placeholder: 'ex: VIP, Moderador de RP, Squad' });
    const cor = h('input', { type: 'color', value: '#2fd0ff', class: 'cor-cargo' });
    const linhas = lista.map((c) => h('li', {},
      h('span', { class: 'bolinha-cargo', style: `background:${c.cor}` }),
      h('div', {}, h('b', { style: `color:${c.cor}` }, c.nome), h('small', {}, `${c.membros.length} membro(s)` + (c.canais.length ? ` · 🔒 ${c.canais.length} canal(is)` : ''))),
      h('div', { class: 'acoes-cargo' },
        h('button', { class: 'bt', title: 'Quem tem esse cargo', onclick: () => modalEscolher(s, c, 'membros') }, '👥'),
        h('button', { class: 'bt', title: 'Canais só pra esse cargo', onclick: () => modalEscolher(s, c, 'canais') }, '🔒'),
        h('button', { class: 'bt', title: 'Apagar cargo', onclick: async () => {
          if (!confirm(`Apagar o cargo ${c.nome}?`)) return;
          try { await api('DELETE', `/cargos/${c.id}`); await carregarCargos(s.id); modalCargos(s); } catch (err) { toast(err.message, 'erro'); }
        } }, '🗑'))));
    abrirModal({ titulo: '🎭 Cargos de ' + s.nome, sub: 'Cargo dá cor ao nome. Com 🔒, só quem tem o cargo (e a staff) vê o canal.',
      corpo: [lista.length ? h('ul', { class: 'novidades cargos' }, linhas) : h('p', { class: 'sub' }, 'Nenhum cargo ainda. Crie o primeiro aqui embaixo.'),
        h('div', { class: 'novo-cargo' }, campo('Novo cargo', nome), cor)],
      botao: 'Criar cargo',
      acao: async () => {
        await api('POST', `/servidores/${s.id}/cargos`, { nome: nome.value.trim(), cor: cor.value });
        await carregarCargos(s.id); setTimeout(() => modalCargos(s));
      } });
  }
  function modalEscolher(s, c, tipo) {
    const opcoes = tipo === 'membros'
      ? (E.membros.get(s.id) || []).map((m) => [m.id, m.nome + ' @' + m.usuario])
      : s.canais.filter((k) => k.tipo !== 'dm').map((k) => [k.id, (k.tipo === 'texto' ? '# ' : '🔊 ') + k.nome]);
    const marcados = new Set(c[tipo]);
    const caixas = opcoes.map(([id, rot]) => { const cb = h('input', { type: 'checkbox' }); cb.checked = marcados.has(id); return [id, cb, h('label', { class: 'check-amigo' }, cb, ' ', rot)]; });
    abrirModal({ titulo: (tipo === 'membros' ? '👥 Quem é ' : '🔒 Canais só pra ') + c.nome,
      sub: tipo === 'membros' ? 'Marque quem tem esse cargo.' : 'Canal marcado fica escondido pra quem não tem o cargo.',
      corpo: h('div', { class: 'lista-check' }, caixas.map((x) => x[2])), botao: 'Salvar',
      acao: async () => {
        const ids = caixas.filter((x) => x[1].checked).map((x) => x[0]);
        await api('PUT', `/cargos/${c.id}/${tipo}`, tipo === 'membros' ? { usuarioIds: ids } : { canalIds: ids });
        await carregarCargos(s.id); toast('Cargo atualizado ✓', 'ok'); setTimeout(() => modalCargos(s));
      } });
  }
  function modalNovoGrupo() {
    const nome = h('input', { maxlength: 40, placeholder: 'Nome do grupo' });
    const marcados = E.amigos.amigos.map((u) => { const cb = h('input', { type: 'checkbox', value: u.usuario }); return [cb, h('label', { class: 'check-amigo' }, cb, ' ', u.nome, h('small', {}, ' @' + u.usuario))]; });
    const extra = h('input', { placeholder: 'outros @ separados por vírgula' });
    abrirModal({ titulo: '👥 Novo grupo', sub: 'Escolha pelo menos 2 pessoas (máximo 9).',
      corpo: [campo('Nome', nome), marcados.length ? h('div', { class: 'lista-check' }, marcados.map((x) => x[1])) : null, campo('Adicionar por usuário', extra)],
      botao: 'Criar grupo',
      acao: async () => {
        const usuarios = [...marcados.filter((x) => x[0].checked).map((x) => x[0].value), ...extra.value.split(',').map((s) => s.trim()).filter(Boolean)];
        const d = await api('POST', '/dms/grupo', { usuarios, nome: nome.value.trim() });
        E.dms.unshift(d); E.modo = 'dm'; E.servidorId = null;
        await abrirCanal(d.canalId);
      } });
  }
  async function sairDoGrupo(c) {
    if (!confirm(`Sair do grupo "${c.dm.outro.nome}"?`)) return;
    try { await api('DELETE', `/dms/${c.id}`); } catch (err) { return toast(err.message, 'erro'); }
    E.dms = E.dms.filter((d) => d.canalId !== c.id);
    abrirDms();
  }
  function modalNovaDm() {
    const u = h('input', { maxlength: 20, placeholder: 'nome_de_usuario' });
    u.autocapitalize = 'none';
    abrirModal({ titulo: 'Nova conversa', sub: 'Digita o nome de usuário da pessoa.', corpo: [campo('Usuário', u)], botao: 'Conversar',
      acao: () => abrirDmCom(u.value.trim().replace(/^@/, '').toLowerCase()) });
  }
  // ---------- telas cheias (estilo Discord): abas à esquerda, conteúdo à direita, Esc fecha ----------
  let telaAberta = null;
  function fecharTela() { if (telaAberta) { telaAberta.remove(); telaAberta = null; document.removeEventListener('keydown', escTela); } }
  function escTela(e) { if (e.key === 'Escape' && !modalAberto) fecharTela(); }
  function abrirTela(titulo, abas, inicial) {
    fecharTela();
    const nav = h('nav', { class: 'tela-abas' }, h('div', { class: 'sec-menu' }, titulo));
    const conteudo = h('div', { class: 'tela-conteudo' });
    const mostrar = (i) => {
      [...nav.querySelectorAll('button')].forEach((b, j) => b.classList.toggle('ativa', j === i));
      const [rot, fn] = abas[i];
      conteudo.replaceChildren(h('h2', {}, rot), ...[fn(() => mostrar(i))].flat(Infinity).filter(Boolean));
    };
    abas.forEach(([rot, , extra], i) => nav.append(h('button', { type: 'button', class: extra === 'perigo' ? 'perigo' : '', onclick: () => mostrar(i) }, rot)));
    telaAberta = h('div', { class: 'tela-cheia' }, nav, conteudo, h('button', { type: 'button', class: 'tela-fechar', title: 'Fechar (Esc)', onclick: fecharTela }, '✕', h('small', {}, 'ESC')));
    document.body.append(telaAberta);
    document.addEventListener('keydown', escTela);
    mostrar(inicial || 0);
  }
  const linhaCfg = (titulo, desc, ...controles) => h('div', { class: 'linha-cfg' }, h('div', {}, h('b', {}, titulo), desc ? h('small', {}, desc) : null), h('div', { class: 'ctl' }, controles));
  const chave = (on, fn) => h('button', { type: 'button', class: 'chave' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', onclick: fn }, h('i'));
  function configUsuario(inicial) {
    const cls = (c) => document.documentElement.classList.contains(c);
    abrirTela('Configurações de usuário', [
      ['Minha conta', () => [
        h('div', { class: 'cartao-conta' }, avatar(E.eu, 'av-conta'), h('div', {}, h('b', {}, E.eu.nome), h('small', {}, '@' + E.eu.usuario))),
        linhaCfg('Nome de exibição e bio', 'Como a galera te vê.', h('button', { type: 'button', class: 'bt', onclick: modalPerfil }, 'Editar perfil')),
        linhaCfg('Senha', 'Trocar a senha desconecta os outros aparelhos.', h('button', { type: 'button', class: 'bt', onclick: () => {
          const atual = h('input', { type: 'password', autocomplete: 'current-password', maxlength: 200 }), nova = h('input', { type: 'password', autocomplete: 'new-password', maxlength: 200, placeholder: 'Mínimo 6 caracteres' });
          abrirModal({ titulo: 'Trocar senha', corpo: [campo('Senha atual', atual), campo('Senha nova', nova)], botao: 'Trocar senha',
            acao: async () => { const d = await api('POST', '/eu/senha', { atual: atual.value, nova: nova.value }); toast('Senha trocada ✓' + (d.sessoesEncerradas ? ` · ${d.sessoesEncerradas} outro(s) aparelho(s) desconectado(s)` : ''), 'ok'); } });
        } }, 'Trocar senha')),
      ]],
      ['Perfil', (re) => [
        linhaCfg('Foto de perfil', 'PNG, JPG, GIF ou WEBP até 4 MB.', h('button', { type: 'button', class: 'bt prim', onclick: () => escolherImagem('/eu/imagem/avatar') }, 'Trocar foto'),
          E.eu.avatar ? h('button', { type: 'button', class: 'bt', onclick: async () => { await api('DELETE', '/eu/imagem/avatar').catch(() => {}); await recarregarEu(); re(); } }, 'Remover') : null),
        linhaCfg('Banner, moldura e cor do nome', 'Itens exclusivos da Loja.', h('button', { type: 'button', class: 'bt', onclick: modalLoja }, 'Abrir Loja')),
      ]],
      ['Aparência', (re) => [
        linhaCfg('Tema', null, ...['dark', 'light'].map((t) => h('button', { type: 'button', class: 'bt' + (document.documentElement.dataset.theme === t ? ' prim' : ''),
          onclick: () => { if (document.documentElement.dataset.theme !== t) alternarTema(); re(); } }, t === 'dark' ? 'Escuro' : 'Claro'))),
        linhaCfg('Modo compacto', 'Mensagens mais juntinhas.', chave(cls('compacto'), () => { alternarAcess('compacto', 'Modo compacto'); re(); })),
      ]],
      ['Acessibilidade', (re) => [
        linhaCfg('Alto contraste', null, chave(cls('contraste'), () => { alternarAcess('contraste', 'Alto contraste'); re(); })),
        linhaCfg('Fonte grande', null, chave(cls('fonte-grande'), () => { alternarAcess('fonte-grande', 'Fonte grande'); re(); })),
      ]],
      ['Notificações', (re) => {
        const som = h('select', {}, Object.entries(SONS).map(([k, r]) => h('option', { value: k }, r)));
        som.value = ler('kali-som') || 'plim';
        som.onchange = () => { salvar('kali-som', som.value); tocarSom(som.value); };
        return [
          linhaCfg('Som de aviso', 'Toca quando te mencionam ou chega DM.', som),
          linhaCfg('Modo foco', E.eu.status === 'foco' ? 'Ligado agora.' : 'Sem avisos por um tempo.', ...[[30, '30 min'], [60, '1 h'], [120, '2 h'], [0, 'Desligar']].map(([m, r]) =>
            h('button', { type: 'button', class: 'bt', onclick: async () => { try { E.eu = Object.assign(E.eu, await api('PATCH', '/eu', { focoMinutos: m })); renderSide(); re(); } catch (err) { toast(err.message, 'erro'); } } }, r))),
          linhaCfg('Modo streamer', 'Esconde convites e DMs enquanto você está ao vivo.', chave(cls('streamer'), () => { aplicarStreamer(!cls('streamer')); re(); })),
        ];
      }],
      ['Voz', (re) => {
        const tecla = h('button', { type: 'button', class: 'bt' }, teclaPTT().replace(/^Key|^Digit/, '').replace('Backquote', "' (aspas)"));
        tecla.onclick = () => {
          tecla.textContent = 'Aperta uma tecla…';
          const pega = (e) => { e.preventDefault(); e.stopPropagation(); removeEventListener('keydown', pega, true); if (e.key !== 'Escape') salvar('kali-ptt-tecla', e.code); re(); };
          addEventListener('keydown', pega, true);
        };
        return [
          linhaCfg('Apertar para falar', Voz.ptt ? 'Ligado: o microfone só abre segurando a tecla.' : 'Desligado: detecta a voz sozinho.', chave(Voz.ptt, () => { Voz.definirPTT(!Voz.ptt); re(); })),
          linhaCfg('Tecla de falar', 'Clica e aperta a tecla que você quer usar.', tecla),
          linhaCfg('Volume de cada pessoa', 'Na call, passa o mouse (ou toca) no quadro da pessoa e ajusta o volume dela só pra você.'),
        ];
      }],
      ['Atalhos e novidades', () => [
        linhaCfg('Atalhos do teclado', null, h('button', { type: 'button', class: 'bt', onclick: modalAtalhos }, 'Ver atalhos')),
        linhaCfg('Novidades do app', null, h('button', { type: 'button', class: 'bt', onclick: modalNovidades }, 'Ver novidades')),
      ]],
      ['Sair da conta', () => [linhaCfg('Sair da conta', 'Você precisa entrar de novo depois.',
        h('button', { type: 'button', class: 'bt perigo', onclick: async () => { await api('POST', '/sair').catch(() => {}); location.href = '/entrar.html'; } }, 'Sair'))], 'perigo'],
    ], inicial);
  }
  function configServidor(s) {
    const dono = souDono(s);
    const abas = [
      ['Visão geral', () => {
        const nome = h('input', { maxlength: 40, value: s.nome });
        return [
          linhaCfg('Nome do servidor', null, nome, dono ? h('button', { type: 'button', class: 'bt prim', onclick: async () => {
            try { aoServidorAtualizado(await api('PATCH', '/servidores/' + s.id, { nome: nome.value.trim() })); toast('Nome salvo ✓', 'ok'); } catch (err) { toast(err.message, 'erro'); }
          } }, 'Salvar') : null),
          dono ? linhaCfg('Ícone do servidor', 'Aparece na barra da esquerda.', h('button', { type: 'button', class: 'bt', onclick: () => escolherImagem(`/servidores/${s.id}/imagem/icone`) }, 'Trocar ícone')) : null,
          dono ? linhaCfg('Banner do servidor', 'Aparece em cima da lista de canais.', h('button', { type: 'button', class: 'bt', onclick: () => escolherImagem(`/servidores/${s.id}/imagem/banner`) }, 'Trocar banner')) : null,
        ];
      }],
      ['Cargos', () => [linhaCfg('Cargos', 'Cor no nome e canais só pra quem tem o cargo.', h('button', { type: 'button', class: 'bt prim', onclick: () => modalCargos(s) }, 'Gerenciar cargos'))]],
      ['Emojis', abaEmojis(s)],
      ['Moderação', () => [linhaCfg('Painel da staff', 'Denúncias, banidos e cargos de adm/mod.', h('button', { type: 'button', class: 'bt prim', onclick: () => { fecharTela(); painelStaff(); } }, 'Abrir painel'))]],
      ['Convites', () => [linhaCfg('Convidar pessoas', null, h('button', { type: 'button', class: 'bt prim', onclick: modalConvite }, 'Pegar link')),
        linhaCfg('Gerar link novo', 'O link e o código antigos param de funcionar na hora (use se vazou).', h('button', { type: 'button', class: 'bt perigo', onclick: async () => {
          if (!confirm('Gerar um link novo? O antigo para de funcionar.')) return;
          try { const d = await api('POST', `/servidores/${s.id}/convite/novo`); s.convite = d.convite; toast('Link novo gerado ✓', 'ok'); modalConvite(); } catch (err) { toast(err.message, 'erro'); }
        } }, 'Gerar link novo'))]],
      ['Banidos', () => {
        const box = h('div', { class: 'lista-busca' }, h('p', { class: 'sub' }, 'Carregando…'));
        api('GET', `/servidores/${s.id}/banidos`).then((l) => box.replaceChildren(...(l.length ? l.map((b) => h('div', { class: 'linha-amigo' }, avatar(b.usuario),
          h('div', { class: 'txt' }, h('b', {}, b.usuario.nome, ' ', h('small', {}, '@' + b.usuario.usuario)), h('small', {}, (b.motivo ? 'Motivo: ' + b.motivo + ' · ' : '') + (b.por ? 'por ' + b.por + ' · ' : '') + new Date(b.criadoEm).toLocaleDateString('pt-BR'))),
          h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'bt', onclick: async (e) => {
            try { await api('DELETE', `/servidores/${s.id}/banidos/${b.usuario.id}`); e.currentTarget.closest('.linha-amigo').remove(); toast(b.usuario.nome + ' foi desbanido ✓', 'ok'); } catch (err) { toast(err.message, 'erro'); }
          } }, 'Desbanir')))) : [h('p', { class: 'sub' }, 'Ninguém banido. 🕊')]))).catch((err) => box.replaceChildren(h('p', { class: 'sub' }, err.message)));
        return [h('h3', {}, 'Banidos'), box];
      }],
      ['Registro', () => {
        const ACOES = { banir: '🔨 baniu', desbanir: '🕊 desbaniu', expulsar: '👢 expulsou', convite: '🔗', castigo: '⏳ castigou', 'apagar-canal': '🗑 apagou o canal', 'apagar-msg': '🗑 apagou mensagem de' };
        const box = h('div', { class: 'lista-busca' }, h('p', { class: 'sub' }, 'Carregando…'));
        api('GET', `/servidores/${s.id}/auditoria`).then((l) => box.replaceChildren(...(l.length ? l.map((a) => h('div', { class: 'res-busca' },
          h('div', { class: 'rb-topo' }, h('b', {}, (a.ator || 'Alguém') + ' ' + (ACOES[a.acao] || a.acao) + (a.alvo ? ' ' + a.alvo : '')), h('small', {}, new Date(a.criadoEm).toLocaleString('pt-BR'))),
          a.detalhe ? h('div', { class: 'rb-txt' }, a.detalhe) : null)) : [h('p', { class: 'sub' }, 'Nenhuma ação da staff registrada ainda.')]))).catch((err) => box.replaceChildren(h('p', { class: 'sub' }, err.message)));
        return [h('h3', {}, 'Registro da staff'), h('p', { class: 'sub' }, 'Quem baniu, expulsou, castigou ou mexeu no servidor.'), box];
      }],
    ];
    if (dono) abas.push(['Apagar servidor', () => [linhaCfg('Apagar ' + s.nome, 'Apaga todos os canais e mensagens pra sempre.', h('button', { type: 'button', class: 'bt perigo', onclick: () => {
      abrirModal({ titulo: 'Apagar ' + s.nome + '?', sub: 'Isso apaga todos os canais e mensagens pra sempre.', botao: 'Apagar', perigo: true,
        acao: async () => { await api('DELETE', '/servidores/' + s.id); fecharTela(); aoServidorApagado({ id: s.id }); } });
    } }, 'Apagar servidor'))], 'perigo']);
    abrirTela(s.nome, abas);
  }
  // Configurações em seções, só texto (estilo Discord).
  function menuConfig(ancora) {
    const sec = (t) => h('div', { class: 'sec-menu' }, t);
    const ligado = (on) => (on ? ' — ligado' : '');
    const streamer = document.documentElement.classList.contains('streamer');
    const cls = (c) => document.documentElement.classList.contains(c);
    abrirMenu(ancora, [
      sec('Perfil'),
      item('Trocar foto de perfil', () => escolherImagem('/eu/imagem/avatar')),
      item('Loja (banners, molduras, cor do nome)', modalLoja),
      ...(E.eu.avatar ? [item('Remover foto', async () => { await api('DELETE', '/eu/imagem/avatar').catch(() => {}); await recarregarEu(); })] : []),
      sec('Notificações'),
      item('Modo foco' + ligado(E.eu.status === 'foco'), () => abrirMenu(ancora, [sec('Sem avisos por'),
        [[15, '15 minutos'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [0, 'Desligar']].map(([m, r]) => item(r, async () => {
          try {
            E.eu = Object.assign(E.eu, await api('PATCH', '/eu', { focoMinutos: m }));
            renderSide(); renderMembros();
            toast(m ? `Modo foco por ${r}` : 'Modo foco desligado', 'ok');
          } catch (err) { toast(err.message, 'erro'); }
        }))])),
      item('Som de aviso: ' + SONS[ler('kali-som') || 'plim'], () => abrirMenu(ancora, [sec('Toca quando te mencionam ou chega DM'),
        Object.entries(SONS).map(([k, r]) => item(((ler('kali-som') || 'plim') === k ? '✓ ' : '') + r, () => { salvar('kali-som', k); tocarSom(k); }))])),
      item('Modo streamer' + ligado(streamer), () => {
        aplicarStreamer(!streamer);
        toast(!streamer ? 'Modo streamer ligado: convites e DMs escondidos' : 'Modo streamer desligado', 'ok');
      }),
      sec('Aparência'),
      item('Alto contraste' + ligado(cls('contraste')), () => alternarAcess('contraste', 'Alto contraste')),
      item('Fonte grande' + ligado(cls('fonte-grande')), () => alternarAcess('fonte-grande', 'Fonte grande')),
      item('Modo compacto' + ligado(cls('compacto')), () => alternarAcess('compacto', 'Modo compacto')),
      sec('Ajuda'),
      item('Atalhos do teclado', modalAtalhos),
      item('Novidades do app', modalNovidades),
    ]);
  }
  function menuPerfil(ancora) {
    const definir = async (status) => {
      const r = await pedir('presenca', { status });
      if (r.erro) return toast(r.erro, 'erro');
      E.eu.status = status; renderSide(); renderMembros();
    };
    abrirMenu(ancora, [
      h('div', { style: 'padding:8px 10px 4px' }, h('b', {}, E.eu.nome), h('div', { style: 'color:var(--fraco);font-size:12px' }, '@' + E.eu.usuario)),
      h('hr'),
      ['online', 'ausente', 'ocupado'].map((x) => item([h('span', { class: 'bolinha ' + STATUS[x][0] }), STATUS[x][1]], () => definir(x))),
      h('hr'),
      item('Editar perfil', modalPerfil),
    ]);
  }
  function modalPerfil() {
    const nome = h('input', { maxlength: 32 }); nome.value = E.eu.nome;
    const status = h('input', { maxlength: 80, placeholder: 'Ex: jogando Valorant 🎮' }); status.value = E.eu.statusTexto || '';
    let cor = E.eu.cor;
    const cores = h('div', { class: 'cores' }, CORES.map((c) => {
      const b = h('button', { type: 'button', class: c === cor ? 'ativa' : '', title: c });
      b.style.background = c;
      b.onclick = () => { cor = c; cores.querySelectorAll('button').forEach((x) => x.classList.toggle('ativa', x === b)); };
      return b;
    }));
    const v = E.eu.vitrine || {};
    const bio = h('input', { maxlength: 190, placeholder: 'Ex: main suporte, jogo de noite 🎧' }); bio.value = v.bio || '';
    let banner = v.banner || 'nebulosa';
    const banners = h('div', { class: 'cores' }, Object.entries(BANNERS).map(([k, g]) => {
      const b = h('button', { type: 'button', class: 'banner-op' + (k === banner ? ' ativa' : ''), title: k });
      b.style.background = g;
      b.onclick = () => { banner = k; banners.querySelectorAll('button').forEach((x) => x.classList.toggle('ativa', x === b)); };
      return b;
    }));
    const jogos = h('input', { maxlength: 160, placeholder: 'Valorant, LoL, Minecraft (até 5)' }); jogos.value = (v.jogos || []).join(', ');
    const links = h('textarea', { rows: 2, maxlength: 1100, placeholder: 'https://twitch.tv/voce (um por linha, até 5)', class: 'campo-area' }); links.value = (v.links || []).join('\n');
    const aniver = h('input', { maxlength: 5, placeholder: 'DD/MM' });
    if (v.aniversario) { const [mm, dd] = v.aniversario.split('-'); aniver.value = `${dd}/${mm}`; }
    abrirModal({ titulo: 'Seu perfil vitrine', corpo: [campo('Nome de exibição', nome), campo('Recado', status), h('div', { class: 'campo' }, h('span', {}, 'Cor do avatar'), cores),
      h('div', { class: 'campo' }, h('span', {}, 'Banner'), banners), campo('Bio', bio), campo('Jogos favoritos', jogos), campo('Links na bio', links), campo('Aniversário', aniver)], botao: 'Salvar',
      acao: async () => {
        const a = aniver.value.trim();
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(a);
        if (a && !m) throw new Error('Aniversário no formato DD/MM.');
        E.eu = Object.assign(E.eu, await api('PATCH', '/eu', {
          nome: nome.value.trim(), statusTexto: status.value.trim(), cor, bio: bio.value.trim(), banner,
          jogos: jogos.value.split(',').map((x) => x.trim()).filter(Boolean),
          links: links.value.split('\n').map((x) => x.trim()).filter(Boolean),
          aniversario: m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '',
        }));
        renderSide(); renderMembros(); toast('Perfil atualizado ✨', 'ok');
      } });
  }

  // ---------- voz ----------
  async function entrarVoz(c) {
    try { await Voz.entrar(c.id, !!c.espacial); Voz.posicoes(E.voz.get(c.id), E.eu.id); renderMapa(); abrirCall(); } catch (err) { toast(err.message, 'erro'); }
  }

  // ---------- tela da call (estilo Discord): grade de quem está na voz, tela/câmera ao vivo, foco e barra de controles ----------
  function abrirCall() {
    E.verCall = true; E.focoTela = null;
    $('#app').classList.add('chat');
    renderMain(); renderTelas();
  }
  function menuSoundboard(el) {
    abrirMenu(el, [h('div', { class: 'sec-menu' }, 'Soundboard (todo mundo da call ouve)'),
      h('div', { class: 'soundboard' }, Object.entries(SONS_BOARD).map(([k, [icn, rot]]) => h('button', { type: 'button', onclick: async () => { const r = await pedir('voz:som', { som: k }); if (r.erro) toast(r.erro, 'erro'); } }, h('span', {}, icn), rot)))]);
  }
  const streamDe = (uid) => (uid === E.eu.id ? Voz.minhaTela : Voz.telas.get(uid)) || null;
  function renderCall(main) {
    const ev = Voz.estado, c = acharCanal(ev.canalId), srv = c && E.servidores.find((x) => x.id === c.servidorId);
    const topo = h('header', { class: 'topo' },
      h('button', { class: 'icbtn voltar', title: 'Voltar', onclick: () => $('#app').classList.remove('chat') }, ic('voltar')),
      h('h1', { class: 'titulo-call' }, ic('voz', 18), c ? c.nome : 'Call'), h('span', { class: 'desc' }, srv ? srv.nome : ''),
      h('button', { class: 'pill', style: 'margin-left:auto', title: 'Voltar pro chat', onclick: () => { E.verCall = false; renderMain(); renderTelas(); } }, ic('hash', 16), h('span', { class: 'rotulo' }, ' Abrir chat')));
    main.replaceChildren(topo, h('section', { class: 'palco-call', id: 'palco-call' }), h('div', { class: 'barra-call', id: 'barra-call' }));
    atualizarCall();
  }
  function tileCall(m) {
    const uid = m.usuarioId, eu = uid === E.eu.id, stm = streamDe(uid), foco = E.focoTela === uid;
    const u = [...E.membros.values()].flat().find((x) => x.id === uid) || (eu ? E.eu : { id: uid, nome: m.nome, cor: m.cor });
    const t = h('div', { class: 'tile' + (m.falando ? ' falando' : '') + (stm ? ' com-video' : ''), tabindex: stm ? 0 : null, 'data-uid': uid });
    if (stm) {
      let v = videosTela.get(uid);
      if (!v) { v = h('video', { autoplay: true, playsinline: true }); v.muted = true; videosTela.set(uid, v); }
      if (v.srcObject !== stm) v.srcObject = stm;
      t.append(v, h('button', { class: 'cheia', title: 'Tela cheia', onclick: (e) => { e.stopPropagation(); t.requestFullscreen && t.requestFullscreen().catch(() => {}); } }, '⛶'));
      t.title = foco ? 'Clica pra voltar pra grade' : 'Clica pra assistir em destaque';
      t.onclick = () => { E.focoTela = foco ? null : uid; atualizarCall(); };
      t.ondblclick = () => t.requestFullscreen && t.requestFullscreen().catch(() => {});
      t.onkeydown = (e) => { if (e.key === 'Enter') t.onclick(); };
    } else {
      t.append(avatar(u, 'av-call'));
    }
    if (!eu) {
      const vol = h('input', { type: 'range', min: 0, max: 200, step: 5, value: Math.round(Voz.volumeDe(uid) * 100), 'aria-label': 'Volume de ' + (m.nome || u.nome) });
      const rot = h('small', {}, vol.value + '%');
      vol.oninput = () => { Voz.volume(uid, vol.value / 100); rot.textContent = vol.value + '%'; };
      t.append(h('div', { class: 'vol-tile', onclick: (e) => e.stopPropagation(), ondblclick: (e) => e.stopPropagation() }, ic('voz', 14), vol, rot));
    }
    t.append(h('span', { class: 'rotulo' }, stm ? h('span', { class: 'ao-vivo' }, 'AO VIVO') : null, eu ? 'Você' : (m.nome || u.nome),
      m.surdo ? ic('foneOff', 14) : m.mudo ? ic('micOff', 14) : null));
    return t;
  }
  function atualizarCall() {
    const palco = $('#palco-call');
    if (!palco) return;
    const ev = Voz.estado;
    if (!ev.canalId) { E.verCall = false; renderMain(); return; }
    let membros = (E.voz.get(ev.canalId) || []).slice();
    if (!membros.some((m) => m.usuarioId === E.eu.id)) membros.unshift({ usuarioId: E.eu.id, nome: E.eu.nome, cor: E.eu.cor, mudo: ev.mudo, surdo: ev.surdo, falando: ev.falando });
    // quem está ao vivo vai pra frente
    membros.sort((a, b) => !!streamDe(b.usuarioId) - !!streamDe(a.usuarioId));
    if (E.focoTela && !streamDe(E.focoTela)) E.focoTela = null;
    const chave = [E.focoTela, ev.mudo, ev.surdo, ev.camera, ev.compartilhando, Voz.ptt, ...membros.map((m) => [m.usuarioId, m.nome, !!m.mudo, !!m.surdo, streamDe(m.usuarioId) ? streamDe(m.usuarioId).id : ''].join(':'))].join('|');
    if (palco.dataset.chave === chave) {
      for (const m of membros) palco.querySelector(`.tile[data-uid="${m.usuarioId}"]`)?.classList.toggle('falando', !!m.falando);
      return;
    }
    palco.dataset.chave = chave;
    const vivos = new Set(membros.filter((m) => streamDe(m.usuarioId)).map((m) => m.usuarioId));
    for (const k of [...videosTela.keys()]) if (!vivos.has(k)) videosTela.delete(k);
    if (E.focoTela) {
      const f = membros.find((m) => m.usuarioId === E.focoTela);
      palco.className = 'palco-call foco';
      palco.replaceChildren(h('div', { class: 'foco-principal' }, tileCall(f)), h('div', { class: 'faixa' }, membros.filter((m) => m !== f).map(tileCall)));
    } else {
      palco.className = 'palco-call grade' + (membros.length === 1 ? ' um' : membros.length === 2 ? ' dois' : '');
      palco.replaceChildren(...membros.map(tileCall));
    }
    videosTela.forEach((v) => { if (v.paused) v.play().catch(() => {}); });
    const erro = (err) => toast(err.message, 'erro');
    $('#barra-call').replaceChildren(
      h('button', { class: ev.camera ? 'ligado' : '', title: ev.camera ? 'Desligar câmera' : 'Ligar câmera', 'aria-pressed': String(ev.camera), onclick: () => Voz.alternarCamera().catch(erro) }, ic('camera', 22)),
      h('button', { class: ev.compartilhando ? 'ligado' : '', title: ev.compartilhando ? 'Parar de transmitir' : 'Compartilhar tela', 'aria-pressed': String(ev.compartilhando), onclick: () => Voz.alternarTela().catch(erro) }, ic('tela', 22)),
      h('button', { class: ev.mudo ? 'desligado' : '', title: ev.mudo ? 'Ativar microfone' : 'Silenciar microfone', 'aria-pressed': String(ev.mudo), onclick: () => Voz.alternarMudo() }, ic(ev.mudo ? 'micOff' : 'mic', 22)),
      h('button', { class: ev.surdo ? 'desligado' : '', title: ev.surdo ? 'Ativar áudio' : 'Desativar áudio', 'aria-pressed': String(ev.surdo), onclick: () => Voz.alternarSurdo() }, ic(ev.surdo ? 'foneOff' : 'fone', 22)),
      h('button', { class: 'encerrar', title: 'Desconectar', onclick: () => Voz.sair() }, ic('desligar', 22)));
  }

  // Telas compartilhadas na call: grade flutuante (1 tela grande, 2+ em grade). Os <video> são reaproveitados pra não piscar.
  const videosTela = new Map();
  function renderTelas() {
    let painel = $('#telas');
    if (E.verCall) {
      if (painel) painel.remove();
      if (!Voz.estado.canalId) { E.verCall = false; renderMain(); return; }
      return atualizarCall();
    }
    const lista = [];
    if (Voz.minhaTela) lista.push([E.eu.id, Voz.minhaTela, 'Você']);
    Voz.telas.forEach((st, uid) => lista.push([uid, st, nomeDe(uid)]));
    if (!lista.length) { if (painel) painel.remove(); videosTela.clear(); return; }
    if (!painel) { painel = h('div', { class: 'telas', id: 'telas' }); document.body.append(painel); }
    painel.classList.toggle('varias', lista.length > 1);
    const vivos = new Set();
    const cards = lista.map(([uid, st, nome]) => {
      vivos.add(uid);
      let v = videosTela.get(uid);
      if (!v) { v = h('video', { autoplay: true, playsinline: true }); v.muted = true; videosTela.set(uid, v); }
      if (v.srcObject !== st) v.srcObject = st;
      return h('div', { class: 'tela' }, v, h('span', {}, '🖥️ ' + nome),
        h('button', { class: 'icbtn', title: 'Tela cheia', onclick: () => (v.requestFullscreen ? v.requestFullscreen() : null) }, '⛶'));
    });
    for (const k of [...videosTela.keys()]) if (!vivos.has(k)) videosTela.delete(k);
    painel.replaceChildren(
      h('div', { class: 'telas-topo' }, h('b', {}, `🖥️ Telas na call (${lista.length})`),
        h('span', { style: 'display:flex;gap:6px' },
          Voz.estado.canalId ? h('button', { class: 'pill', onclick: abrirCall }, 'Abrir na call') : null,
          h('button', { class: 'icbtn', title: 'Minimizar', onclick: () => painel.classList.toggle('mini') }, '–'))),
      h('div', { class: 'telas-grade' }, cards));
    videosTela.forEach((v) => { if (v.paused) v.play().catch(() => {}); });
  }

  // Sala 3D: mapa flutuante; arraste seu avatar e o som dos outros muda de lado/distância.
  let ultimoMover = 0, arrastando = false;
  function renderMapa() {
    if (arrastando) return; // não redesenha no meio do arraste
    let mapa = $('#mapa3d');
    const ev = Voz.estado;
    if (!ev.canalId || !ev.espacial) { if (mapa) mapa.remove(); return; }
    if (!mapa) { mapa = h('div', { class: 'mapa3d', id: 'mapa3d' }); document.body.append(mapa); }
    const area = h('div', { class: 'mapa-area' });
    for (const m of E.voz.get(ev.canalId) || []) {
      const eu = m.usuarioId === E.eu.id;
      const p = h('i', { class: 'mapa-av' + (m.falando ? ' falando' : '') + (eu ? ' eu' : ''), title: m.nome }, inicial(m.nome));
      p.style.background = CORES.includes(m.cor) ? m.cor : '#6b7280';
      p.style.left = (typeof m.x === 'number' ? m.x : 0.5) * 100 + '%';
      p.style.top = (typeof m.y === 'number' ? m.y : 0.5) * 100 + '%';
      if (eu) p.onpointerdown = (e) => {
        p.setPointerCapture(e.pointerId); arrastando = true;
        p.onpointermove = (ev2) => {
          const r = area.getBoundingClientRect();
          const x = Math.min(1, Math.max(0, (ev2.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (ev2.clientY - r.top) / r.height));
          p.style.left = x * 100 + '%'; p.style.top = y * 100 + '%';
          if (Date.now() - ultimoMover > 80) { ultimoMover = Date.now(); Voz.mover(x, y); }
        };
        p.onpointerup = () => { p.onpointermove = null; arrastando = false; };
      };
      area.append(p);
    }
    mapa.replaceChildren(h('b', {}, '🌌 Sala 3D'), h('small', {}, 'Arraste você pelo mapa'), area);
  }

  // ---------- "Me lembra disso" (guardado neste navegador) ----------
  const lerLembretes = () => { try { return JSON.parse(ler('kali-lembretes') || '[]'); } catch (e) { return []; } };
  function lembrar(m, min, rotulo) {
    const lista = lerLembretes();
    lista.push({ msgId: m.id, canalId: m.canalId, autor: m.autor ? m.autor.nome : 'KALI', texto: corta(m.texto || '🎙 áudio', 120), quando: Date.now() + min * 60e3 });
    salvar('kali-lembretes', JSON.stringify(lista));
    if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
    toast(`⏰ Combinado! Te lembro em ${rotulo.toLowerCase()}.`, 'ok');
  }
  setInterval(() => {
    const lista = lerLembretes(), agora = Date.now();
    const vencidos = lista.filter((l) => l.quando <= agora);
    if (!vencidos.length) return;
    salvar('kali-lembretes', JSON.stringify(lista.filter((l) => l.quando > agora)));
    for (const l of vencidos) {
      toast(`⏰ Lembrete — ${l.autor}: ${l.texto}`, 'ok');
      try { if (window.Notification && Notification.permission === 'granted') new Notification('⏰ Lembrete da KALI', { body: `${l.autor}: ${l.texto}` }); } catch (e) {}
    }
  }, 15000);

  // ---------- mensagem com efeito: /confete, /fogo, /explosao no começo da mensagem ----------
  const EFEITOS = { confete: ['🎉', ['🎉', '🎊', '✨', '🥳']], fogo: ['🔥', ['🔥', '🔥', '💥']], explosao: ['💥', ['💥', '✨', '💫']] };
  const RE_EFEITO = /^\/(confete|fogo|explosao)\s*/i;
  const efeitoDe = (t) => { const r = RE_EFEITO.exec(t || ''); return r ? r[1].toLowerCase() : null; };
  function dispararEfeito(ef) {
    const camada = h('div', { class: 'camada-efeito', 'aria-hidden': 'true' });
    const lista = EFEITOS[ef][1];
    for (let i = 0; i < 36; i++) {
      const p = h('span', {}, lista[i % lista.length]);
      p.style.left = (i * 37 % 100) + '%';
      p.style.animationDelay = (i % 9) * 0.08 + 's';
      p.style.fontSize = 18 + (i * 7 % 18) + 'px';
      camada.append(p);
    }
    document.body.append(camada);
    setTimeout(() => camada.remove(), 3200);
  }

  // ---------- /time N jogo (fecha o time) e /pomodoro N (estudo em grupo): cartões feitos de mensagem + reações ----------
  const RE_CMD = /^\/(time|pomodoro)\s+(\d{1,3})\s*([\s\S]*)$/i;
  function comandoDe(t) {
    const r = RE_CMD.exec(t || '');
    if (!r) return null;
    const tipo = r[1].toLowerCase(), n = Number(r[2]);
    if (tipo === 'time' ? n < 2 || n > 20 : n < 5 || n > 120) return null;
    return { tipo, n, extra: corta(r[3].trim(), 60) };
  }
  const vigiados = () => { try { return JSON.parse(ler('kali-vigiados') || '[]'); } catch (e) { return []; } };
  // /alerta texto: só vale do dono do servidor; vira faixa vermelha + som pra todo mundo
  const RE_ALERTA = /^\/alerta\s+([\s\S]+)$/i;
  function alertaDe(m) {
    const r = RE_ALERTA.exec(m.texto || '');
    if (!r || !m.autor) return null;
    const s = E.servidores.find((x) => x.canais.some((k) => k.id === m.canalId));
    return s && s.donoId === m.autor.id ? r[1].trim() : null;
  }
  const RE_PENEIRA = /^\/peneira\s+/i;
  // /enquete Pergunta | opção 1 | opção 2 … (até 6): votos = reações coloridas (o servidor só aceita emoji pictográfico)
  const NUMS = ['🟣', '🟠', '🟢', '🔵', '🟡', '🔴'];
  function enqueteDe(t) {
    const r = /^\/enquete\s+([\s\S]+)$/i.exec(t || '');
    if (!r) return null;
    const partes = r[1].split('|').map((x) => x.trim()).filter(Boolean);
    return partes.length >= 3 ? { pergunta: corta(partes[0], 140), opcoes: partes.slice(1, 7).map((o) => corta(o, 60)) } : null;
  }
  // /dado 2d20, /dado 6, /moeda: resultado vem do id da mensagem (dado pelo servidor), igual pra todo mundo
  const RE_DADO = /^\/(dado(\s+(\d{1,2})?d?(\d{1,3}))?|moeda)\s*$/i;
  function rolar(m) {
    let x = (m.id * 2654435761) >>> 0;
    const prox = () => { x = (x + 0x6d2b79f5) >>> 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r = RE_DADO.exec(m.texto);
    if (r[1].toLowerCase() === 'moeda') return [h('h3', {}, '💰 Cara ou coroa'), h('div', { class: 'resultado' }, prox() < 0.5 ? 'Cara' : 'Coroa')];
    const qtd = Math.min(10, Math.max(1, Number(r[3]) || 1)), lados = Math.min(100, Math.max(2, Number(r[4]) || 6));
    const vals = Array.from({ length: qtd }, () => 1 + Math.floor(prox() * lados));
    return [h('h3', {}, `🎲 ${qtd}d${lados}`), h('div', { class: 'resultado' }, vals.join(' + ') + (qtd > 1 ? ` = ${vals.reduce((a, b) => a + b, 0)}` : ''))];
  }
  const naReacao = (m, em) => ((m.reacoes || []).find((r) => r.emoji === em) || { usuarios: [] }).usuarios;
  function nomeDe(uid) {
    if (uid === E.eu.id) return E.eu.nome;
    for (const l of E.membros.values()) { const x = l.find((u) => u.id === uid); if (x) return x.nome; }
    return 'alguém';
  }
  const textoPomo = (fim) => {
    const s = Math.ceil((fim - Date.now()) / 1000);
    return s > 0 ? `⏳ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} restantes` : '✅ Acabou! Pausa de 5 min ☕';
  };
  function cartaoComando(m, c) {
    if (c.tipo === 'time') {
      const dentro = naReacao(m, '✋'), falta = c.n - dentro.length, eu = dentro.includes(E.eu.id);
      const s = E.servidores.find((x) => x.canais.some((k) => k.id === m.canalId));
      const voz = s && s.canais.find((x) => x.tipo === 'voz');
      return h('div', { class: 'card' }, h('h3', {}, `🎮 Fecha o time${c.extra ? ' — ' + c.extra : ''}`),
        h('div', { class: 'sub' }, falta > 0 ? `Falta ${falta} pro ${c.n}!` : '✅ Time fechado! Bora pra call', dentro.length ? ' · ' + dentro.map(nomeDe).join(', ') : ''),
        barra(dentro.length / c.n * 100),
        h('div', { class: 'acoes' },
          h('button', { class: 'bt' + (eu ? '' : ' prim'), onclick: () => reagir(m.id, '✋') }, eu ? 'Sair do time' : '✋ Tô dentro'),
          falta <= 0 && voz ? h('button', { class: 'bt prim', onclick: () => entrarVoz(voz) }, '🔊 Entrar na call') : null));
    }
    const fim = m.criadoEm + c.n * 60e3, foco = naReacao(m, '🍅');
    const b = barra(0);
    Object.assign(b.firstChild.dataset, { fim, total: c.n * 60e3 });
    b.firstChild.className = 'pomo-i';
    b.firstChild.style.width = Math.min(100, (1 - (fim - Date.now()) / (c.n * 60e3)) * 100) + '%';
    return h('div', { class: 'card' }, h('h3', {}, `🍅 Pomodoro em grupo — ${c.n} min${c.extra ? ' · ' + c.extra : ''}`),
      h('div', { class: 'sub pomo', 'data-fim': fim }, textoPomo(fim)), b,
      h('div', { class: 'sub', style: 'margin-top:6px' }, foco.length ? '🍅 Focando: ' + foco.map(nomeDe).join(', ') : 'Ninguém entrou ainda.'),
      h('div', { class: 'acoes' }, h('button', { class: 'bt' + (foco.includes(E.eu.id) ? '' : ' prim'), onclick: () => reagir(m.id, '🍅') }, foco.includes(E.eu.id) ? 'Sair do foco' : '🍅 Focar junto')));
  }
  setInterval(() => {
    document.querySelectorAll('.pomo').forEach((el) => { el.textContent = textoPomo(Number(el.dataset.fim)); });
    document.querySelectorAll('.pomo-i').forEach((el) => { el.style.width = Math.min(100, (1 - (Number(el.dataset.fim) - Date.now()) / Number(el.dataset.total)) * 100) + '%'; });
  }, 1000);
  function avisarTime(antes, depois) {
    const c = comandoDe(depois.texto);
    if (!c || c.tipo !== 'time') return;
    const a = naReacao(antes, '✋').length, d = naReacao(depois, '✋');
    if (a < c.n && d.length >= c.n && d.includes(E.eu.id)) { toast('🎮 Time fechado! Bora pra call', 'ok'); tocarSom('vinheta'); }
  }

  // ---------- sons de aviso (sintetizados, sem arquivo) ----------
  const SONS = { plim: 'Plim', zap: 'Zap zap', tambor: 'Tambor', desligado: 'Sem som' };
  let ctxSom = null;
  // Soundboard: sons sintetizados na hora (sem arquivo de áudio).
  const SONS_BOARD = { buzina: ['📯', 'Buzina'], tambor: ['🥁', 'Ba dum tss'], vitoria: ['🏆', 'Vitória'], erro: ['❌', 'Errou'],
    grilo: ['🦗', 'Grilo'], palmas: ['👏', 'Palmas'], sirene: ['🚨', 'Sirene'], uau: ['😮', 'Uau'] };
  function tocarBoard(nome) {
    try {
      ctxSom = ctxSom || new (window.AudioContext || window.webkitAudioContext)();
      const t = ctxSom.currentTime;
      const tom = (f, ini, dur, tipo = 'sine', vol = 0.18, fFim) => {
        const o = ctxSom.createOscillator(), g = ctxSom.createGain();
        o.type = tipo; o.frequency.setValueAtTime(f, t + ini);
        if (fFim) o.frequency.exponentialRampToValueAtTime(fFim, t + ini + dur);
        g.gain.setValueAtTime(vol, t + ini); g.gain.exponentialRampToValueAtTime(0.001, t + ini + dur);
        o.connect(g).connect(ctxSom.destination); o.start(t + ini); o.stop(t + ini + dur + 0.02);
      };
      const ruido = (ini, dur, vol = 0.25, corte = 4000) => {
        const b = ctxSom.createBuffer(1, Math.ceil(ctxSom.sampleRate * dur), ctxSom.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = ctxSom.createBufferSource(), f = ctxSom.createBiquadFilter(), g = ctxSom.createGain();
        s.buffer = b; f.type = 'highpass'; f.frequency.value = corte; g.gain.value = vol;
        s.connect(f).connect(g).connect(ctxSom.destination); s.start(t + ini);
      };
      ({
        buzina: () => { tom(392, 0, 0.35, 'sawtooth', 0.12); tom(392, 0.45, 0.6, 'sawtooth', 0.12); },
        tambor: () => { tom(150, 0, 0.15, 'triangle', 0.4, 60); tom(120, 0.22, 0.15, 'triangle', 0.4, 50); ruido(0.45, 0.6, 0.3, 6000); },
        vitoria: () => [523, 659, 784, 1047].forEach((f, i) => tom(f, i * 0.12, i === 3 ? 0.6 : 0.15, 'square', 0.08)),
        erro: () => { tom(300, 0, 0.25, 'square', 0.1); tom(200, 0.28, 0.45, 'square', 0.1); },
        grilo: () => { for (let i = 0; i < 6; i++) tom(4500, i * 0.09 + (i > 2 ? 0.3 : 0), 0.05, 'sine', 0.06); },
        palmas: () => { for (let i = 0; i < 10; i++) ruido(i * 0.07 + Math.random() * 0.03, 0.06, 0.35, 1500); },
        sirene: () => { for (let i = 0; i < 3; i++) tom(600, i * 0.5, 0.25, 'sawtooth', 0.08, 1100), tom(1100, i * 0.5 + 0.25, 0.25, 'sawtooth', 0.08, 600); },
        uau: () => tom(300, 0, 0.7, 'sine', 0.2, 700),
      })[nome]?.();
    } catch (e) {}
  }
  function tocarSom(nome) {
    if (nome === 'desligado') return;
    try {
      ctxSom = ctxSom || new (window.AudioContext || window.webkitAudioContext)();
      const notas = { plim: [[880, 0], [1320, 0.12]], zap: [[660, 0], [990, 0.09], [660, 0.18], [990, 0.27]], tambor: [[110, 0], [90, 0.15], [140, 0.3]], vinheta: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]] }[nome] || [];
      for (const [f, t] of notas) {
        const o = ctxSom.createOscillator(), g = ctxSom.createGain(), t0 = ctxSom.currentTime + t;
        o.type = nome === 'tambor' ? 'triangle' : 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
        o.connect(g).connect(ctxSom.destination);
        o.start(t0); o.stop(t0 + 0.26);
      }
    } catch (e) {}
  }

  // ---------- modo streamer: esconde convites e prévias de DM ----------
  function aplicarStreamer(ligado) {
    document.documentElement.classList.toggle('streamer', ligado);
    salvar('kali-streamer', ligado ? '1' : '');
  }
  aplicarStreamer(ler('kali-streamer') === '1');

  // ---------- acessibilidade: alto contraste e fonte grande ----------
  for (const c of ['contraste', 'fonte-grande']) document.documentElement.classList.toggle(c, ler('kali-' + c) === '1');
  function alternarAcess(c, rotulo) {
    const ligar = !document.documentElement.classList.contains(c);
    document.documentElement.classList.toggle(c, ligar);
    salvar('kali-' + c, ligar ? '1' : '');
    toast(`${rotulo} ${ligar ? 'ligado' : 'desligado'}`, 'ok');
  }

  // ---------- modo compacto e atalhos de teclado ----------
  document.documentElement.classList.toggle('compacto', ler('kali-compacto') === '1');
  // Ctrl+K: troca rápida (canais, DMs e amigos). Alt+↑/↓: canal anterior/próximo.
  function trocaRapida() {
    if ($('#troca-rapida')) return;
    const itens = [];
    for (const s of E.servidores) for (const c of s.canais) if (c.tipo !== 'voz' || true) itens.push({ tipo: c.tipo === 'voz' ? 'voz' : 'canal', nome: c.nome, sub: s.nome, ir: async () => { if (E.modo !== 'servidor' || E.servidorId !== s.id) await selecionarServidor(s.id); abrirCanal(c.id); } });
    for (const d of E.dms) itens.push({ tipo: 'dm', nome: d.outro.nome, sub: d.grupo ? 'Grupo' : '@' + d.outro.usuario, ir: async () => { if (E.modo !== 'dm') await abrirDms(); E.telaAmigos = false; abrirCanal(d.canalId); } });
    for (const u of E.amigos.amigos) if (!E.dms.some((d) => !d.grupo && d.outro.id === u.id)) itens.push({ tipo: 'amigo', nome: u.nome, sub: '@' + u.usuario, ir: () => abrirDmCom(u.usuario).catch((err) => toast(err.message, 'erro')) });
    for (const s of E.servidores) itens.push({ tipo: 'servidor', nome: s.nome, sub: 'Servidor', ir: () => selecionarServidor(s.id) });
    const ICS = { canal: '#', voz: '🔊', dm: '@', amigo: '@', servidor: '★' };
    const inp = h('input', { placeholder: 'Pra onde? (# canal, @ pessoa, * servidor)', 'aria-label': 'Troca rápida' });
    const lista = h('div', { class: 'tr-lista', role: 'listbox' });
    let sel = 0, achados = [];
    const pont = (alvo, q) => { alvo = alvo.toLowerCase(); if (alvo.startsWith(q)) return 3; if (alvo.includes(q)) return 2; let j = 0; for (const ch of alvo) if (ch === q[j]) j++; return j === q.length ? 1 : 0; };
    const desenhar = () => {
      let q = inp.value.trim().toLowerCase(), filtro = null;
      if (/^[#@*]/.test(q)) { filtro = q[0]; q = q.slice(1).trim(); }
      achados = itens.filter((it) => !filtro || (filtro === '#' ? ['canal', 'voz'].includes(it.tipo) : filtro === '@' ? ['dm', 'amigo'].includes(it.tipo) : it.tipo === 'servidor'))
        .map((it) => [it, q ? pont(it.nome, q) : 1]).filter(([, p]) => p).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([it]) => it);
      sel = Math.min(sel, Math.max(0, achados.length - 1));
      lista.replaceChildren(...(achados.length ? achados.map((it, k) => h('button', { class: 'tr-item' + (k === sel ? ' sel' : ''), role: 'option', type: 'button', onmousemove: () => { if (sel !== k) { sel = k; desenhar(); } }, onclick: () => escolher(k) },
        h('span', { class: 'tr-ic' }, ICS[it.tipo]), h('b', {}, it.nome), h('small', {}, it.sub))) : [h('p', { class: 'tr-vazio' }, 'Nada encontrado.')]));
    };
    const fundo = h('div', { class: 'fundo-modal', id: 'troca-rapida' }, h('div', { class: 'modal troca-rapida', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Troca rápida' },
      h('h2', {}, 'Ir para…'), inp, lista, h('small', { class: 'tr-dica' }, '↑↓ escolher · Enter abrir · Esc fechar')));
    const fechar = () => sair(fundo);
    const escolher = (k) => { const it = achados[k]; fechar(); if (it) it.ir(); };
    inp.oninput = () => { sel = 0; desenhar(); };
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, achados.length); desenhar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + achados.length) % Math.max(1, achados.length); desenhar(); }
      else if (e.key === 'Enter') { e.preventDefault(); escolher(sel); }
      else if (e.key === 'Escape') { e.stopPropagation(); fechar(); }
    };
    fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
    document.body.append(fundo);
    desenhar(); inp.focus();
  }
  const emCampo = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const teclaPTT = () => ler('kali-ptt-tecla') || 'Backquote';
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); trocaRapida(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && E.modo === 'servidor') {
      const s = servidorAtual(); if (!s) return;
      const cs = s.canais.filter((c) => c.tipo !== 'voz' && !c.paiCanal);
      const i = cs.findIndex((c) => c.id === E.canalId), prox = cs[(i + (e.key === 'ArrowDown' ? 1 : -1) + cs.length) % cs.length];
      if (prox) { e.preventDefault(); abrirCanal(prox.id); }
      return;
    }
    if (window.Voz && Voz.ptt && e.code === teclaPTT() && !e.repeat && !(emCampo(e) && e.key.length === 1)) Voz.apertar(true);
  });
  addEventListener('keyup', (e) => { if (window.Voz && Voz.ptt && e.code === teclaPTT()) setTimeout(() => Voz.apertar(false), 200); });
  addEventListener('blur', () => { if (window.Voz && Voz.ptt) Voz.apertar(false); });
  addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.shiftKey || !window.Voz) return;
    const k = e.key.toLowerCase();
    if (k === 'm') Voz.alternarMudo();
    else if (k === 'd') Voz.alternarSurdo();
    else if (k === 'l') Voz.sair();
    else return;
    e.preventDefault();
  });
  const modalAtalhos = () => abrirModal({ titulo: '⌨️ Atalhos', sub: 'Funcionam com a KALI aberta e em foco.', corpo: h('ul', { class: 'novidades' },
    [['Ctrl + Shift + M', 'Mutar / desmutar microfone'], ['Ctrl + Shift + D', 'Ensurdecer'], ['Ctrl + Shift + L', 'Sair da call'], ['Enter', 'Enviar mensagem'], ['Esc', 'Fechar janelas e menus']]
      .map(([t, d]) => h('li', {}, h('div', {}, h('b', {}, t), h('small', {}, d))))) });

  // ---------- AFK inteligente: 10 min sem mexer → ausente + mic mudo; voltou → online ----------
  let ultimaAtividade = Date.now(), afk = false;
  for (const ev of ['mousemove', 'keydown', 'pointerdown', 'wheel']) addEventListener(ev, () => {
    ultimaAtividade = Date.now();
    if (afk) {
      afk = false;
      pedir('presenca', { status: 'online' }).then((r) => { if (!r.erro) { E.eu.status = 'online'; renderSide(); renderMembros(); toast('👋 Bem-vindo de volta!', 'ok'); } });
    }
  }, { passive: true });
  setInterval(() => {
    if (afk || !E.eu || E.eu.status !== 'online' || Date.now() - ultimaAtividade < 10 * 60e3) return;
    afk = true;
    pedir('presenca', { status: 'ausente' }).then((r) => { if (!r.erro) { E.eu.status = 'ausente'; renderSide(); renderMembros(); } });
    if (window.Voz && Voz.estado.canalId && !Voz.estado.mudo) Voz.alternarMudo();
  }, 30000);

  // ---------- tema ----------
  function alternarTema() {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    salvar('kali-tema', t);
    renderSide();
  }

  // ---------- eventos do servidor ----------
  function aoMensagem(m) {
    const arr = E.msgs.get(m.canalId);
    const nova = !arr || !arr.some((x) => x.id === m.id);
    if (nova && m.texto && efeitoDe(m.texto) && (m.canalId === E.canalId)) dispararEfeito(efeitoDe(m.texto));
    if (nova && m.autor && m.autor.id !== E.eu.id && alertaDe(m)) {
      toast('🚨 Alerta da staff: ' + corta(alertaDe(m), 90), 'erro');
      tocarSom('zap');
      try { if (window.Notification && Notification.permission === 'granted') new Notification('🚨 Alerta da staff', { body: corta(alertaDe(m), 140) }); } catch (e) {}
    }
    if (nova && m.autor && m.autor.id !== E.eu.id && E.eu.status !== 'foco' && !silenciado(m.canalId) && !bloqueado(m.autor.id) && (mencionaEu(m) || E.dms.some((x) => x.canalId === m.canalId))) tocarSom(ler('kali-som') || 'plim');
    if (nova && m.autor && m.autor.id !== E.eu.id) notificarMsg(m, c);
    if (arr && !arr.some((x) => x.id === m.id)) { arr.push(m); arr.sort((a, b) => a.id - b.id); }
    const d = E.dms.find((x) => x.canalId === m.canalId);
    if (d) { d.ultima = m; E.dms = [d, ...E.dms.filter((x) => x !== d)]; }
    const mapa = E.digitando.get(m.canalId);
    if (mapa && m.autor) mapa.delete(m.autor.id);
    if (m.canalId === E.canalId) { renderLista(); renderDigitando(); marcarLido(m.canalId); if (d) renderSide(); return; }
    if (m.autor && m.autor.id !== E.eu.id) {
      E.naoLidos[m.canalId] = (E.naoLidos[m.canalId] || 0) + 1;
      if (mencionaEu(m) || d) E.mencoes[m.canalId] = (E.mencoes[m.canalId] || 0) + 1;
      if (mencionaEu(m) && E.eu.status !== 'ocupado' && !silenciado(m.canalId) && !bloqueado(m.autor.id)) toast(`${m.autor.nome} mencionou você: ${corta(m.texto, 60)}`);
      renderRail(); renderSide();
    }
  }
  // Notificação do sistema pra menção/DM quando a aba não está em foco. Clicar abre o canal.
  function notificarMsg(m, c) {
    const dm = E.dms.find((x) => x.canalId === m.canalId);
    if (!(mencionaEu(m) || dm) || !window.Notification || Notification.permission !== 'granted') return;
    if (!document.hidden && document.hasFocus() && m.canalId === E.canalId) return;
    if (['foco', 'ocupado'].includes(E.eu.status) || silenciado(m.canalId) || bloqueado(m.autor.id)) return;
    try {
      const s = c && E.servidores.find((x) => x.id === c.servidorId);
      const n = new Notification(dm ? m.autor.nome : `${m.autor.nome} (#${c ? c.nome : ''}${s ? ', ' + s.nome : ''})`,
        { body: corta(m.texto || (m.audio ? '🎙 Mensagem de voz' : m.anexo ? '📎 ' + m.anexo.nome : ''), 140), icon: '/img/icone.png', tag: 'c' + m.canalId });
      n.onclick = async () => {
        window.focus(); n.close();
        if (dm) { if (E.modo !== 'dm') await abrirDms(); }
        else if (c && c.servidorId !== E.servidorId) await selecionarServidor(c.servidorId);
        E.telaAmigos = false; abrirCanal(m.canalId);
      };
    } catch (e) {}
  }
  // Visualizador: clicar numa imagem abre em tela cheia, com ←/→ entre as imagens do canal.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a.anexo-img');
    if (!a || e.ctrlKey || e.metaKey || e.button) return;
    e.preventDefault();
    const todas = [...document.querySelectorAll('#lista a.anexo-img')];
    let k = Math.max(0, todas.indexOf(a));
    const img = h('img', { alt: '' }), info = h('small', {}), orig = h('a', { class: 'bt', target: '_blank', rel: 'noopener' }, 'Abrir original');
    const mostrar = () => { const x = todas[k]; img.src = x.href; img.alt = x.querySelector('img')?.alt || ''; orig.href = x.href; info.textContent = todas.length > 1 ? `${k + 1} de ${todas.length}` : ''; img.classList.remove('zoom'); };
    const ir = (d) => { if (todas.length > 1) { k = (k + d + todas.length) % todas.length; mostrar(); } };
    const fundo = h('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Imagem' },
      todas.length > 1 ? h('button', { class: 'visor-nav esq', title: 'Anterior', onclick: (ev) => { ev.stopPropagation(); ir(-1); } }, '‹') : null,
      img,
      todas.length > 1 ? h('button', { class: 'visor-nav dir', title: 'Próxima', onclick: (ev) => { ev.stopPropagation(); ir(1); } }, '›') : null,
      h('div', { class: 'visor-pe', onclick: (ev) => ev.stopPropagation() }, info, orig, h('button', { class: 'bt', onclick: () => fechar() }, 'Fechar')));
    img.onclick = (ev) => { ev.stopPropagation(); img.classList.toggle('zoom'); };
    const tecla = (ev) => { if (ev.key === 'Escape') fechar(); else if (ev.key === 'ArrowLeft') ir(-1); else if (ev.key === 'ArrowRight') ir(1); };
    const fechar = () => { removeEventListener('keydown', tecla, true); sair(fundo); };
    fundo.onclick = fechar;
    let x0 = null;
    fundo.addEventListener('touchstart', (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
    fundo.addEventListener('touchend', (ev) => { if (x0 != null) { const d = ev.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) ir(d < 0 ? 1 : -1); x0 = null; } });
    addEventListener('keydown', tecla, true);
    document.body.append(fundo); mostrar();
  });
  // Pede permissão de notificação no primeiro clique (navegador exige um gesto).
  if (window.Notification && Notification.permission === 'default') document.addEventListener('click', () => { Notification.requestPermission().catch(() => {}); }, { once: true });
  function atualizarTitulo() {
    const n = Object.values(E.mencoes).reduce((t, x) => t + (x || 0), 0);
    document.title = n ? `(${n > 99 ? '99+' : n}) KALI` : 'KALI';
  }
  function trocarMsg(canalId, id, fn) {
    const arr = E.msgs.get(canalId);
    if (!arr) return;
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return;
    fn(arr, i);
    if (canalId === E.canalId) renderLista();
  }
  function aoCanalNovo(c) {
    const s = E.servidores.find((x) => x.id === c.servidorId);
    if (!s || s.canais.some((x) => x.id === c.id)) return;
    s.canais.push(c);
    s.canais.sort((a, b) => a.posicao - b.posicao || a.id - b.id);
    if (s.id === E.servidorId) renderSide();
  }
  function aoCanalApagado({ id, servidorId }) {
    const s = E.servidores.find((x) => x.id === servidorId);
    if (s) s.canais = s.canais.filter((c) => c.id !== id);
    E.msgs.delete(id); E.fim.delete(id); delete E.naoLidos[id];
    if (E.assistindo === id) sairAssistir();
    if (window.Voz && Voz.estado.canalId === id) Voz.sair();
    if (E.canalId === id) { toast('Esse canal foi apagado.'); selecionarServidor(servidorId); }
    else { renderRail(); renderSide(); }
  }
  function aoServidorAtualizado(s) {
    const atual = E.servidores.find((x) => x.id === s.id);
    if (!atual) return;
    Object.assign(atual, s);
    render();
  }
  function aoServidorApagado({ id }) {
    const s = E.servidores.find((x) => x.id === id);
    if (!s) return;
    if (window.Voz && s.canais.some((c) => c.id === Voz.estado.canalId)) Voz.sair();
    E.servidores = E.servidores.filter((x) => x.id !== id);
    E.membros.delete(id);
    if (E.servidorId === id) {
      const prox = E.servidores[0];
      if (prox) selecionarServidor(prox.id); else { E.servidorId = null; E.canalId = null; render(); }
    } else renderRail();
  }

  function conectar() {
    sock = io({ transports: ['websocket', 'polling'] });
    let jaConectou = false;
    Voz.init(sock, () => { renderSide(); renderMapa(); renderTelas(); });
    sock.on('connect', async () => {
      $('#conexao').hidden = true;
      if (jaConectou) {
        try {
          E.msgs.clear(); E.fim.clear();
          E.eu = await api('GET', '/eu');
          await carregarTudo();
          if (E.modo === 'servidor' && E.servidorId && !servidorAtual()) E.servidorId = E.servidores[0] ? E.servidores[0].id : null;
          if (E.servidorId) await carregarMembros(E.servidorId).catch(() => {});
          const id = E.canalId;
          E.canalId = null;
          if (id && acharCanal(id)) await abrirCanal(id, true); else render();
        } catch (e) {}
      }
      jaConectou = true;
      renderSide(); renderMembros();
    });
    sock.on('disconnect', () => { $('#conexao').hidden = false; E.assistindo = null; renderSide(); });
    sock.on('assistir:estado', (e) => { if (!e || e.canalId !== E.assistindo) return; estadoA = e; aplicarEstado(); });
    sock.on('connect_error', (e) => { if (e && e.message === 'nao-autorizado') location.href = '/entrar.html'; else $('#conexao').hidden = false; });

    sock.on('msg:nova', aoMensagem);
    sock.on('msg:editada', (m) => trocarMsg(m.canalId, m.id, (arr, i) => { arr[i] = m; }));
    sock.on('msg:apagada', ({ id, canalId }) => trocarMsg(canalId, id, (arr, i) => { arr.splice(i, 1); }));
    sock.on('msg:reacoes', ({ id, canalId, reacoes }) => trocarMsg(canalId, id, (arr, i) => { const antes = arr[i]; arr[i] = Object.assign({}, antes, { reacoes }); avisarTime(antes, arr[i]); }));
    sock.on('digitando', ({ canalId, usuario }) => {
      if (!usuario || usuario.id === E.eu.id) return;
      if (!E.digitando.has(canalId)) E.digitando.set(canalId, new Map());
      E.digitando.get(canalId).set(usuario.id, { nome: usuario.nome, ate: Date.now() + 4000 });
      if (canalId === E.canalId) renderDigitando();
    });
    sock.on('presenca', ({ usuarioId, status }) => {
      if (usuarioId === E.eu.id) { if (status !== 'offline') E.eu.status = status; }
      else {
        if ((E.presenca.get(usuarioId) || 'offline') === 'offline' && status !== 'offline' && vigiados().includes(usuarioId)) {
          toast(`🟢 ${nomeDe(usuarioId)} ficou online!`, 'ok');
          tocarSom(ler('kali-som') || 'plim');
        }
        E.presenca.set(usuarioId, status);
      }
      renderMembros();
      if (E.modo === 'dm') renderSide();
    });
    sock.on('membro:entrou', ({ servidorId, membro }) => {
      const lista = E.membros.get(servidorId);
      if (lista && !lista.some((m) => m.id === membro.id)) lista.push(membro);
      if (membro.id !== E.eu.id) E.presenca.set(membro.id, membro.status);
      if (servidorId === E.servidorId) renderMembros();
    });
    sock.on('membro:saiu', ({ servidorId, usuarioId }) => {
      if (usuarioId === E.eu.id) return aoServidorApagado({ id: servidorId });
      const lista = E.membros.get(servidorId);
      if (lista) E.membros.set(servidorId, lista.filter((m) => m.id !== usuarioId));
      if (servidorId === E.servidorId) renderMembros();
    });
    sock.on('canal:novo', aoCanalNovo);
    sock.on('membro:atualizado', aoMembroAtualizado);
    sock.on('denuncia:nova', ({ servidorId }) => {
      const s = E.servidores.find((x) => x.id === servidorId);
      toast(`🚩 Nova denúncia em ${s ? s.nome : 'um servidor'} — abre o Painel da staff`, 'ok');
    });
    sock.on('canal:apagado', aoCanalApagado);
    sock.on('servidor:atualizado', aoServidorAtualizado);
    sock.on('servidor:apagado', aoServidorApagado);
    sock.on('eventos:atualizado', ({ servidorId }) => carregarEventos(servidorId));
    sock.on('emojis:atualizado', () => carregarEmojis());
    sock.on('voz:som', ({ som, de }) => {
      if (window.Voz && Voz.estado.surdo) return; // ensurdecido não ouve o soundboard
      tocarBoard(som);
      if (SONS_BOARD[som]) toast(`${SONS_BOARD[som][0]} ${de}: ${SONS_BOARD[som][1]}`);
    });
    sock.on('loja:ganhou', ({ nome }) => toast(`Você ganhou "${nome}"! Abra a Loja pra usar.`, 'ok'));
    sock.on('castigo', ({ servidor, ate }) => toast(ate ? `⏳ Você levou castigo em ${servidor} até ${hora(ate)}.` : `✅ Seu castigo em ${servidor} acabou.`, ate ? 'erro' : 'ok'));
    sock.on('cargos:atualizado', async ({ servidorId }) => {
      try {
        await carregarCargos(servidorId);
        if (servidorId === E.servidorId) await carregarMembros(servidorId); // apelidos podem ter mudado
        (await api('GET', '/servidores')).forEach(adicionarServidor); // canais podem ter aparecido/sumido
      } catch (e) { return; }
      render();
    });
    sock.on('amigos:atualizado', async ({ pedidoDe, aceitoPor } = {}) => {
      if (pedidoDe) { toast(`👋 ${pedidoDe} quer ser seu amigo — veja em Mensagens diretas`, 'ok'); tocarSom(ler('kali-som') || 'plim'); }
      if (aceitoPor) toast(`🎉 ${aceitoPor} aceitou sua amizade!`, 'ok');
      await carregarAmigos();
      renderRail(); if (E.modo === 'dm') renderSide();
    });
    sock.on('dm:nova', (d) => {
      if (E.dms.some((x) => x.canalId === d.canalId)) return;
      E.dms.unshift(d);
      E.presenca.set(d.outro.id, d.outro.status);
      renderRail(); if (E.modo === 'dm') renderSide();
    });
    sock.on('voz:membros', ({ canalId, membros }) => {
      const antes = new Set((E.voz.get(canalId) || []).map((m) => m.usuarioId));
      if (canalId === Voz.estado.canalId && antes.size && (membros || []).some((m) => !antes.has(m.usuarioId) && m.usuarioId !== E.eu.id)) tocarSom('vinheta');
      if (membros && membros.length) E.voz.set(canalId, membros); else E.voz.delete(canalId);
      if (canalId === Voz.estado.canalId) { Voz.posicoes(membros, E.eu.id); renderMapa(); if (E.verCall) atualizarCall(); }
      renderSide();
    });
    sock.on('xp:ganho', (d) => {
      if (!d) return;
      if (d.subiuNivel) toast(`⭐ Subiu pro nível ${d.nivel}!`, 'ok');
      if (d.missaoCompleta) toast(`🏆 Missão completa: ${d.missaoCompleta.titulo}${d.missaoCompleta.selo ? ' — selo ' + d.missaoCompleta.selo.emoji : ''}`, 'ok');
      if (d.servidorId === E.servidorId) {
        clearTimeout(E.missaoTimer);
        E.missaoTimer = setTimeout(() => carregarMissoes(d.servidorId), 800);
      }
    });
  }

  // ---------- início ----------
  // Convite que veio no link (?convite=CODIGO): guarda antes do login, usa depois.
  try {
    const cv = new URLSearchParams(location.search).get('convite');
    if (cv && /^[A-Za-z0-9]{4,16}$/.test(cv)) salvar('kali-convite', cv);
    if (cv) history.replaceState(null, '', location.pathname);
  } catch (e) {}
  async function usarConvitePendente() {
    const cv = ler('kali-convite');
    if (!cv) return false;
    try { localStorage.removeItem('kali-convite'); } catch (e) {}
    try {
      const s = await api('POST', '/convites/' + encodeURIComponent(cv));
      adicionarServidor(s); E.membros.delete(s.id);
      await selecionarServidor(s.id);
      toast('Você entrou em ' + s.nome + ' 🎉', 'ok');
      return true;
    } catch (err) {
      const ja = E.servidores.find((x) => x.convite === cv);
      if (ja) { await selecionarServidor(ja.id); return true; }
      toast('Convite: ' + err.message, 'erro');
      return false;
    }
  }
  async function iniciar() {
    try {
      E.eu = await api('GET', '/eu');
      await carregarTudo();
    } catch (err) {
      if (err.message !== 'Sessão expirada.') toast('Não consegui carregar: ' + err.message, 'erro');
      return;
    }
    conectar();
    if (await usarConvitePendente()) return;
    const salvo = ler('kali-servidor');
    if (salvo === 'dm') return abrirDms();
    const s = E.servidores.find((x) => x.id === Number(salvo)) || E.servidores[0];
    if (s) await selecionarServidor(s.id); else render();
  }
  iniciar();
})();
