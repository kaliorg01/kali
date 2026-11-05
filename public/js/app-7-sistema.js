// KALI — cliente (7/7): Sons, modos (streamer, acessibilidade, compacto), atalhos, AFK, tema, eventos do servidor e início.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

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
      const notas = { plim: [[880, 0], [1320, 0.12]], zap: [[660, 0], [990, 0.09], [660, 0.18], [990, 0.27]], tambor: [[110, 0], [90, 0.15], [140, 0.3]], vinheta: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]], entrou: [[523, 0], [784, 0.09]], saiu: [[784, 0], [494, 0.09]] }[nome] || [];
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
    const jaTem = new Set(itens.filter((i) => i.tipo === 'dm' || i.tipo === 'amigo').map((i) => i.nome));
    for (const s of E.servidores) for (const m of E.membros.get(s.id) || []) if (m.id !== E.eu.id && !jaTem.has(m.nome)) { jaTem.add(m.nome); itens.push({ tipo: 'pessoa', nome: m.nome, sub: '@' + m.usuario + ' · ' + s.nome, ir: () => abrirDmCom(m.usuario).catch((e) => toast(e.message, 'erro')) }); }
    for (const [nome, sub, ir] of [['Painel', 'Ir pro painel', abrirPainel], ['Mutar / desmutar', 'Microfone na call', () => Voz.alternarMudo()], ['Ensurdecer', 'Áudio da call', () => Voz.alternarSurdo()], ['Sair da call', 'Desconectar', () => Voz.sair()],
      ['Configurações', 'Abrir configurações', () => configUsuario()], ['Criar ou entrar em servidor', 'Novo servidor', modalServidor], ['Trocar tema claro/escuro', 'Aparência', alternarTema], ['Status de jogo', 'Jogando…', definirJogo], ['Atalhos', 'Ver atalhos do teclado', modalAtalhos], ['Ativar notificações', 'Push no celular/PC', () => ativarPush().then(() => toast('🔔 Notificações ligadas', 'ok')).catch((e) => toast(e.message, 'erro'))], ['Apostas 1x1', 'Fila de apostas do servidor', () => abrirApostas(E.servidorId)], ['Novo story', 'Postar story de 24h', modalNovoStory], ['Meu perfil completo', 'Conquistas e números', () => perfilCompleto(E.eu)], ['Tour rápido', 'Rever o tour', () => { salvar('kali-tour', ''); tourInicial(); }]])
      itens.push({ tipo: 'cmd', nome, sub, ir });
    const ICS = { canal: '#', voz: '🔊', dm: '@', amigo: '@', pessoa: '@', servidor: '★', cmd: '>' };
    const inp = h('input', { placeholder: 'Pra onde? (# canal, @ pessoa, * servidor, > comando)', 'aria-label': 'Troca rápida' });
    const lista = h('div', { class: 'tr-lista', role: 'listbox' });
    let sel = 0, achados = [];
    const pont = (alvo, q) => { alvo = alvo.toLowerCase(); if (alvo.startsWith(q)) return 3; if (alvo.includes(q)) return 2; let j = 0; for (const ch of alvo) if (ch === q[j]) j++; return j === q.length ? 1 : 0; };
    const desenhar = () => {
      let q = inp.value.trim().toLowerCase(), filtro = null;
      if (/^[#@*>]/.test(q)) { filtro = q[0]; q = q.slice(1).trim(); }
      achados = itens.filter((it) => !filtro || (filtro === '#' ? ['canal', 'voz'].includes(it.tipo) : filtro === '@' ? ['dm', 'amigo', 'pessoa'].includes(it.tipo) : filtro === '>' ? it.tipo === 'cmd' : it.tipo === 'servidor'))
        .map((it) => [it, q ? pont(it.nome, q) : 1]).filter(([, p]) => p).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([it]) => it);
      sel = Math.min(sel, Math.max(0, achados.length - 1));
      lista.replaceChildren(...(achados.length ? achados.map((it, k) => h('button', { class: 'tr-item' + (k === sel ? ' sel' : ''), role: 'option', type: 'button', onmousemove: () => { if (sel !== k) { sel = k; desenhar(); } }, onclick: () => escolher(k) },
        h('span', { class: 'tr-ic' }, ICS[it.tipo]), h('b', {}, it.nome), h('small', {}, it.sub))) : [h('p', { class: 'tr-vazio' }, 'Nada encontrado.')]));
    };
    const fundo = h('div', { class: 'fundo-modal', id: 'troca-rapida' }, h('div', { class: 'modal troca-rapida', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Troca rápida' },
      h('h2', {}, 'Ir para…'), inp, lista, h('small', { class: 'tr-dica' }, '↑↓ escolher · Enter abrir · Esc fechar')));
    const fechar = () => sair(fundo);
    const escolher = (k) => { const it = achados[k]; fechar(); if (it) setTimeout(() => it.ir(), 60); }; // espera o Enter terminar pra não fechar a janela que o comando abre
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
    [['Ctrl + K', 'Pular pra qualquer canal ou conversa'], ['Alt + ↑ / ↓', 'Canal anterior / próximo'], ['Ctrl + Shift + M', 'Mutar / desmutar microfone'], ['Ctrl + Shift + D', 'Ensurdecer'], ['Ctrl + Shift + L', 'Sair da call'], ['Enter', 'Enviar mensagem'], ['Esc', 'Fechar janelas e menus']]
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
    else if (nova && m.texto && m.canalId === E.canalId && RE_TTS.test(m.texto) && m.autor && m.autor.id !== E.eu.id) falarTexto((m.autor.nome || '') + ' disse: ' + m.texto.replace(RE_TTS, ''));
    else if (nova && m.texto && m.canalId === E.canalId && RE_SO_EMOJI.test(m.texto.trim())) chuvaEmoji(m.texto);
    if (nova && m.autor && m.autor.id !== E.eu.id && alertaDe(m)) {
      toast('🚨 Alerta da staff: ' + corta(alertaDe(m), 90), 'erro');
      tocarSom('zap');
      try { if (window.Notification && Notification.permission === 'granted') new Notification('🚨 Alerta da staff', { body: corta(alertaDe(m), 140) }); } catch (e) {}
    }
    if (nova && m.autor && m.autor.id !== E.eu.id && E.eu.status !== 'foco' && !silenciado(m.canalId) && !bloqueado(m.autor.id) && (mencionaEu(m) || E.dms.some((x) => x.canalId === m.canalId))) tocarSom(ler('kali-som') || 'plim');
    if (nova && m.autor && m.autor.id !== E.eu.id) notificarMsg(m, acharCanal(m.canalId));
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
  // Celular: arrastar da borda esquerda pra direita volta pra lista de canais.
  (() => {
    let x0 = null, y0 = null;
    addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX < 28 && $('#app').classList.contains('chat') ? t.clientX : null; y0 = t.clientY; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const t = e.changedTouches[0];
      if (t.clientX - x0 > 70 && Math.abs(t.clientY - y0) < 60) $('#app').classList.remove('chat');
      x0 = null;
    }, { passive: true });
  })();
  // Pede permissão de notificação no primeiro clique (navegador exige um gesto).
  if (window.Notification && Notification.permission === 'default') document.addEventListener('click', () => { Notification.requestPermission().catch(() => {}); }, { once: true });
  // Título e ícone da aba mostram o que está ligado: tela, câmera, call. Minimizado, o título pisca pra lembrar que ainda está transmitindo.
  let piscaTitulo = false, iconeAtual = '';
  function iconeAba(tipo) {
    if (iconeAtual === tipo) return;
    iconeAtual = tipo;
    const link = document.querySelector('link[rel="icon"]');
    if (!link) return;
    if (!tipo) { link.href = '/img/icone.png'; return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
      g.beginPath(); g.arc(48, 48, 15, 0, Math.PI * 2); g.fillStyle = tipo === 'tela' ? '#ff2d55' : tipo === 'camera' ? '#ff9f0a' : '#30d158'; g.fill();
      g.lineWidth = 4; g.strokeStyle = '#000'; g.stroke();
      try { link.href = c.toDataURL('image/png'); } catch (e) {}
    };
    img.src = '/img/icone.png';
  }
  function atualizarTitulo() {
    const n = Object.values(E.mencoes).reduce((t, x) => t + (x || 0), 0);
    const ev = window.Voz ? Voz.estado : {};
    const base = n ? `(${n > 99 ? '99+' : n}) KALI` : 'KALI';
    const ativo = ev.compartilhando ? '🔴 Transmitindo tela' : ev.camera ? '📷 Câmera ligada' : ev.canalId ? (ev.mudo ? '🔇 Na call (mudo)' : '🔊 Na call') : '';
    iconeAba(ev.compartilhando ? 'tela' : ev.camera ? 'camera' : ev.canalId ? 'call' : '');
    if (!ativo) { document.title = base; return; }
    if (document.hidden && (ev.compartilhando || ev.camera)) { piscaTitulo = !piscaTitulo; document.title = piscaTitulo ? (ev.compartilhando ? '🔴 AO VIVO — sua tela tá sendo vista' : '📷 AO VIVO — câmera ligada') : ativo + ' · ' + base; return; }
    document.title = ativo + ' · ' + base;
  }
  setInterval(atualizarTitulo, 1200);
  document.addEventListener('visibilitychange', atualizarTitulo);
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
    Voz.init(sock, () => {
      try { if (Voz.estado.canalId) sessionStorage.setItem('kali-voz', String(Voz.estado.canalId)); } catch (e) {}
      aplicarPalco(); // plateia do palco não abre o microfone
      renderSide(); renderMapa(); renderTelas();
    });
    sock.on('connect', () => { // F5 ou servidor reiniciado: volta sozinho pra call
      let id = null;
      try { id = Number(sessionStorage.getItem('kali-voz')) || null; } catch (e) {}
      const c = id && acharCanal(id);
      if (c && c.tipo === 'voz' && !Voz.estado.canalId) setTimeout(() => entrarVoz(c), 400);
    });
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
    sock.on('canais:ordem', ({ servidorId, ordem }) => aplicarOrdem(servidorId, ordem));
    sock.on('voz:chamada', aoSerChamado);
    sock.on('voz:legenda', ({ de, texto, final }) => mostrarLegenda(de, texto, final));
    sock.on('voz:palco', (d) => { if (d.canalId === Voz.estado.canalId) { E.palco = d; aplicarPalco(); if (E.verCall) atualizarCall(true); } });
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
    await carregarBloqueios();
      renderRail(); if (E.modo === 'dm') renderSide();
    });
    sock.on('dm:nova', (d) => {
      if (E.dms.some((x) => x.canalId === d.canalId)) return;
      E.dms.unshift(d);
      E.presenca.set(d.outro.id, d.outro.status);
      renderRail(); if (E.modo === 'dm') renderSide();
    });
    Voz.aoFalarMudo = () => toast('🎙️ Você está mudo! Aperta Ctrl+Shift+M ou o microfone pra falar.', 'erro');
    sock.on('voz:pedido', cardPedidoVoz);
    sock.on('aposta:chamado', aoChamadoAposta);
    sock.on('aposta:fechou', aoFechouAposta);
    sock.on('aposta:fim', telaVitoria);
    sock.on('torneios:atualizado', (d) => { if (d && d.servidorId === E.servidorId && E.verApostas && !document.querySelector('.modal')) renderMain(); });
    sock.on('aposta:denuncia', (d) => { if (d && souStaffEm(d.servidorId)) toast(`🚩 ${d.de} denunciou a sala #${d.id} — confere em #mediadores`, 'erro'); });
    sock.on('apostas:atualizado', (d) => { if (!d || d.servidorId !== E.servidorId) return; if (E.verApostas) renderMain(); else document.querySelector('.fila-canal')?._redesenhar?.(); });
    sock.on('voz:atividade', aoAtividade);
    sock.on('voz:pedido-fim', (d) => $('#pedido-' + d.canalId + '-' + d.usuarioId)?.remove());
    sock.on('voz:resposta', (d) => {
      const c = acharCanal(d.canalId);
      if (!d.aceito) return toast('🚪 A staff recusou sua entrada em ' + (c ? c.nome : 'call') + '.', 'erro');
      toast('✅ Entrada liberada! Entrando…', 'ok');
      if (c) abrirCanal(c.id);
    });
    sock.on('voz:membros', ({ canalId, membros }) => {
      const antes = new Set((E.voz.get(canalId) || []).map((m) => m.usuarioId));
      if (canalId === Voz.estado.canalId) {
        const agora = new Set((membros || []).map((m) => m.usuarioId));
        if (!antes.has(E.eu.id) && agora.has(E.eu.id)) tocarSom('entrou');
        else if (antes.size && [...agora].some((id) => !antes.has(id) && id !== E.eu.id)) { tocarSom('entrou'); const nv = (membros || []).find((m) => !antes.has(m.usuarioId) && m.usuarioId !== E.eu.id); if (nv) entradaEpica(nv.nome); }
        else if ([...antes].some((id) => !agora.has(id) && id !== E.eu.id)) tocarSom('saiu');
      }
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
    setTimeout(tourInicial, 900);
    if (await usarConvitePendente()) return;
    const salvo = ler('kali-servidor');
    $('#app').classList.toggle('lateral-mini', ler('kali-lateral-mini') === '1' && innerWidth > 760);
    if (salvo === 'dm') return abrirDms();
    if (salvo === 'painel' || (!salvo && E.servidores.length)) return abrirPainel();
    const s = E.servidores.find((x) => x.id === Number(salvo)) || E.servidores[0];
    if (s) await selecionarServidor(s.id); else render();
  }
  iniciar();
