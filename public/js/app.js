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
    for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
    return e;
  }
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
    cargos: new Map(),
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
    const t = h('div', { class: 'toast ' + (tipo || '') }, texto);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 3800);
  }

  let menuAberto = null;
  function fecharMenu() { if (menuAberto) { menuAberto.remove(); menuAberto = null; } }
  function abrirMenu(ancora, conteudo, cls) {
    fecharMenu();
    const m = h('div', { class: 'menu ' + (cls || '') }, conteudo);
    document.body.append(m);
    const r = ancora.getBoundingClientRect();
    let x = r.left, y = r.bottom + 6;
    if (x + m.offsetWidth > innerWidth - 8) x = innerWidth - m.offsetWidth - 8;
    if (y + m.offsetHeight > innerHeight - 8) y = r.top - m.offsetHeight - 6;
    m.style.left = Math.max(8, x) + 'px';
    m.style.top = Math.max(8, y) + 'px';
    menuAberto = m;
  }
  const item = (texto, acao, cls) => h('button', { class: cls || '', type: 'button', onclick: () => { fecharMenu(); acao(); } }, texto);
  document.addEventListener('mousedown', (e) => { if (menuAberto && !menuAberto.contains(e.target)) fecharMenu(); });

  let modalAberto = null;
  function fecharModal() { if (modalAberto) { modalAberto.remove(); modalAberto = null; } }
  function abrirModal({ titulo, sub, corpo, botao, acao, perigo }) {
    fecharModal();
    const erro = h('p', { class: 'erro-form', hidden: true });
    const ok = botao ? h('button', { class: 'bt ' + (perigo ? 'perigo' : 'prim'), type: 'submit' }, botao) : null;
    const form = h('form', { class: 'modal', novalidate: true },
      h('h2', {}, titulo), sub ? h('p', { class: 'sub' }, sub) : null, corpo || [], erro,
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
    const primeiro = form.querySelector('input'); if (primeiro) primeiro.focus();
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
    for (const s of servidores) Object.assign(E.naoLidos, s.naoLidos || {});
    for (const d of dms) { E.naoLidos[d.canalId] = d.naoLidos || 0; E.presenca.set(d.outro.id, d.outro.status); }
    await carregarAmigos();
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
    if (c.tipo === 'voz') return entrarVoz(c);
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
      itens.push(b);
    }
    itens.push(h('button', { class: 'srv add', title: 'Criar ou entrar em servidor', onclick: modalServidor }, '+'));
    rail.replaceChildren(...itens);
  }

  function linhaCanal(c, s) {
    const ic = c.tipo === 'voz' ? (c.espacial ? '🌌' : '🔊') : c.tipo === 'assistir' ? '🍿' : c.ticket ? '🎫' : c.comSenha ? '🔒' : '#';
    const n = E.naoLidos[c.id] || 0, men = E.mencoes[c.id] || 0;
    const b = h('button', { class: 'canal' + (c.id === E.canalId ? ' ativo' : '') + (n ? ' nao-lido' : ''), onclick: () => abrirCanal(c.id) },
      h('span', { class: 'ic' }, ic), h('span', { class: 'nm' }, c.nome),
      men ? h('span', { class: 'n mencao' }, '@' + men) : n ? h('span', { class: 'n' }, n > 99 ? '99+' : n) : null);
    const linha = h('div', { class: 'canal-linha' }, b);
    if (souDono(s)) linha.append(h('button', { class: 'apagar-canal', title: 'Apagar canal', onclick: () => apagarCanal(c) }, '✕'));
    const frag = [linha];
    if (c.tipo !== 'texto') {
      const membros = E.voz.get(c.id) || [];
      if (membros.length) frag.push(h('div', { class: 'voz-users' }, membros.map((m) => h('span', { class: 'voz-user' },
        Object.assign(h('i', { class: 'mini' + (m.falando ? ' falando' : '') }, inicial(m.nome)), { style: `background:${CORES.includes(m.cor) ? m.cor : '#6b7280'}` }),
        h('span', { class: 'nm' }, m.nome),
        h('span', { class: 'icones' }, m.surdo ? '🔇' : m.mudo ? '🎙̸' : '')))));
    }
    return frag;
  }

  function renderSide() {
    const side = $('#side');
    const partes = [];
    if (E.modo === 'dm') {
      partes.push(h('div', { class: 'side-topo' }, h('span', {}, 'Mensagens diretas')));
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
        corpo.append(h('button', { class: 'dm-item' + (!E.telaAmigos && d.canalId === E.canalId ? ' ativo' : ''), onclick: () => { E.telaAmigos = false; abrirCanal(d.canalId); } },
          avatar(d.outro, '', !d.grupo),
          h('span', { class: 'txt' }, h('b', {}, d.outro.nome), h('small', {}, d.ultima ? corta(d.ultima.texto || '🎙 áudio', 40) : '@' + d.outro.usuario)),
          n ? h('span', { class: 'n' }, n) : null));
      }
      partes.push(corpo);
    } else {
      const s = servidorAtual();
      if (s) {
        if (s.bannerImg) partes.push(h('img', { class: 'banner-srv', src: s.bannerImg, alt: '' }));
        partes.push(h('button', { class: 'side-topo', onclick: (e) => menuServidor(e.currentTarget) }, h('span', {}, s.nome), h('span', { class: 'seta' }, '▾')));
        const corpo = h('div', { class: 'side-corpo' }, h('button', { class: 'btn-novo', onclick: modalConvite }, h('span', { style: 'font-size:18px' }, '＋'), 'Convidar amigos'));
        const dono = souDono(s);
        const texto = s.canais.filter((c) => c.tipo === 'texto');
        const voz = s.canais.filter((c) => c.tipo !== 'texto');
        corpo.append(h('div', { class: 'rot' }, 'Texto', dono ? h('button', { title: 'Criar canal de texto', onclick: () => modalCanal('texto') }, '＋') : null));
        texto.forEach((c) => corpo.append(...linhaCanal(c, s)));
        if (!texto.length) corpo.append(h('p', { class: 'vazio-lateral' }, 'Nenhum canal de texto.'));
        corpo.append(h('div', { class: 'rot' }, 'Voz', dono ? h('button', { title: 'Criar canal de voz', onclick: () => modalCanal('voz') }, '＋') : null));
        voz.forEach((c) => corpo.append(...linhaCanal(c, s)));
        if (!voz.length) corpo.append(h('p', { class: 'vazio-lateral' }, 'Nenhum canal de voz.'));
        partes.push(corpo);
      } else {
        partes.push(h('div', { class: 'side-topo' }, h('span', {}, 'KALI')));
        partes.push(h('div', { class: 'side-corpo' }, h('p', { class: 'vazio-lateral' }, 'Você ainda não está em nenhum servidor. Clica no + pra criar ou entrar num.')));
      }
    }
    // barra de voz conectada
    const ev = window.Voz ? Voz.estado : {};
    if (ev.canalId) {
      const c = acharCanal(ev.canalId);
      const srv = c && E.servidores.find((x) => x.id === c.servidorId);
      partes.push(h('div', { class: 'voz-barra' },
        h('div', { class: 'info' }, h('b', {}, '● Conectado à voz'), h('small', {}, (c ? c.nome : '') + (srv ? ' / ' + srv.nome : ''))),
        h('button', { class: 'icbtn' + (ev.compartilhando ? ' ativo-tela' : ''), title: ev.compartilhando ? 'Parar de compartilhar' : 'Compartilhar tela (1080p/60fps)',
          onclick: () => Voz.alternarTela().catch((err) => toast(err.message, 'erro')) }, '🖥️'),
        h('button', { class: 'icbtn sair-voz', title: 'Sair da voz', onclick: () => { Voz.sair(); } }, '📞')));
    }
    // rodapé do usuário
    const eu = h('button', { class: 'eu', title: 'Status e perfil', onclick: (e) => menuPerfil(e.currentTarget) },
      avatar(E.eu, '', true), h('span', { class: 'txt' }, h('b', {}, E.eu.nome), h('small', {}, rotStatus(E.eu))));
    eu.querySelector('.av').style.cssText += ';width:34px;height:34px';
    partes.push(h('div', { class: 'side-pe' }, eu,
      h('button', { class: 'icbtn' + (ev.mudo ? ' desligado' : ''), title: ev.mudo ? 'Ativar microfone' : 'Silenciar microfone', onclick: () => Voz.alternarMudo() }, '🎤'),
      h('button', { class: 'icbtn' + (ev.surdo ? ' desligado' : ''), title: ev.surdo ? 'Ativar áudio' : 'Desativar áudio', onclick: () => Voz.alternarSurdo() }, '🎧'),
      h('button', { class: 'icbtn', title: 'Configurações', onclick: () => configUsuario() }, '⚙')));
    side.replaceChildren(...partes);
  }

  function renderMain() {
    const main = $('#main');
    if (E.modo === 'dm' && E.telaAmigos) return renderAmigos(main);
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
    const titulo = c.dm ? (c.dm.grupo ? '👥 ' : '@ ') + c.dm.outro.nome : (c.tipo === 'assistir' ? '🍿 ' : '# ') + c.nome;
    const desc = c.dm ? '@' + c.dm.outro.usuario + (c.dm.outro.statusTexto ? ' · ' + c.dm.outro.statusTexto : '') : (servidorAtual() || {}).nome || '';
    const busca = h('input', { placeholder: 'Buscar', 'aria-label': 'Buscar mensagens' });
    busca.oninput = () => { E.busca = busca.value.trim().toLowerCase(); renderLista({ fim: true }); };
    const topo = h('header', { class: 'topo' },
      h('button', { class: 'icbtn voltar', title: 'Voltar', onclick: () => $('#app').classList.remove('chat') }, '←'),
      h('h1', {}, titulo), h('span', { class: 'desc' }, desc),
      h('button', { class: 'pill ia', onclick: verResumo }, '✦', h('span', { class: 'rotulo' }, ' O que eu perdi?')),
      // Mesma ordem do Discord: notificações, fixadas, membros, busca.
      h('button', { class: 'pill', title: silenciado(c.id) ? 'Reativar avisos deste canal' : 'Silenciar este canal', onclick: (e) => {
        const on = alternarLocal('kali-silenciados', c.id); e.currentTarget.textContent = on ? '🔕' : '🔔';
        toast(on ? '🔕 Canal silenciado: sem som nem aviso' : '🔔 Avisos do canal reativados', 'ok');
      } }, silenciado(c.id) ? '🔕' : '🔔'),
      h('button', { class: 'pill', title: 'Mensagens fixadas', onclick: () => modalFixadas(c.id) }, '📌'),
      c.dm && c.dm.grupo ? h('button', { class: 'pill', title: 'Sair do grupo', onclick: () => sairDoGrupo(c) }, '🚪') : null,
      h('button', { class: 'pill', title: 'Membros', onclick: alternarMembros }, '👥'),
      h('label', { class: 'pill busca' }, '⌕ ', busca));
    const lista = h('div', { class: 'col', id: 'lista' });
    const msgs = h('section', { class: 'msgs', id: 'msgs' }, lista);
    msgs.addEventListener('scroll', () => { if (msgs.scrollTop < 80) carregarAntigas(); }, { passive: true });

    const ta = h('textarea', { rows: 1, maxlength: 2000, placeholder: c.dm ? 'Conversar com @' + c.dm.outro.usuario : 'Conversar em #' + c.nome });
    ta.value = E.rascunho.get(c.id) || '';
    let ultimoDigitando = 0;
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; };
    ta.oninput = () => {
      E.rascunho.set(c.id, ta.value);
      ajustar();
      if (ta.value && Date.now() - ultimoDigitando > 2000) { ultimoDigitando = Date.now(); sock && sock.emit('digitando', { canalId: c.id }); }
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(c.id, ta); } };
    const emoji = h('button', { class: 'icbtn', type: 'button', title: 'Emoji' }, '☺');
    emoji.onclick = () => abrirMenu(emoji, h('div', { class: 'emojis' }, EMOJIS.map((em) => item(em, () => { ta.value += em; ta.oninput(); ta.focus(); }))));
    const info = h('span', { class: 'gravando', hidden: true });
    const bGrav = h('button', { class: 'icbtn', type: 'button', title: 'Mensagem de voz (até 60s, com transcrição)' }, '🎙');
    bGrav.onclick = () => alternarGravacao(c.id, bGrav, info);
    const curto = () => TEMPOS.find((t) => t[0] === E.temp)[2];
    const bTemp = h('button', { class: 'icbtn' + (E.temp ? ' temp-on' : ''), type: 'button', title: 'Mensagem temporária' }, curto());
    bTemp.onclick = () => abrirMenu(bTemp, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, 'A mensagem some depois de…'),
      TEMPOS.map(([s, r]) => item((E.temp === s ? '✓ ' : '') + r, () => { E.temp = s; bTemp.textContent = curto(); bTemp.classList.toggle('temp-on', !!s); }))]);
    const arq = h('input', { type: 'file', hidden: true });
    arq.onchange = () => { if (arq.files[0]) enviarArquivo(c.id, arq.files[0], ta); arq.value = ''; };
    // Igual ao Discord: um ＋ à esquerda com arquivo e extras.
    const bAnexo = h('button', { class: 'icbtn mais-caixa' + (E.temp ? ' temp-on' : ''), type: 'button', title: 'Enviar arquivo e mais' }, '＋');
    bAnexo.onclick = () => abrirMenu(bAnexo, [
      item('Enviar foto, GIF ou arquivo', () => arq.click()),
      item('Mensagem temporária: ' + TEMPOS.find((t) => t[0] === E.temp)[1], () => abrirMenu(bAnexo, [h('div', { class: 'sec-menu' }, 'A mensagem some depois de'),
        TEMPOS.map(([s, r]) => item((E.temp === s ? '✓ ' : '') + r, () => { E.temp = s; bAnexo.classList.toggle('temp-on', !!s); }))])),
      item('Enquete', () => { ta.value = '/enquete Pergunta? | Opção 1 | Opção 2'; ta.oninput(); ta.focus(); }),
    ]);
    ta.addEventListener('paste', (e) => { const f = [...(e.clipboardData?.files || [])][0]; if (f) { e.preventDefault(); enviarArquivo(c.id, f, ta); } });
    const compositor = h('div', { class: 'compositor' }, h('div', { class: 'col' },
      h('div', { class: 'digitando', id: 'digitando' }),
      h('div', { class: 'respondendo', id: 'respondendo', hidden: true }),
      h('div', { class: 'caixa' }, bAnexo, arq, ta, info, emoji, bGrav, h('button', { class: 'enviar', title: 'Enviar', onclick: () => enviar(c.id, ta) }, '↑')),
      h('div', { class: 'dica' }, '@usuario menciona · /time 5 Valorant · /pomodoro 25 · /confete /fogo /explosao')));
    main.replaceChildren(topo, c.tipo === 'assistir' ? h('section', { class: 'palco', id: 'palco' }) : '', msgs, compositor);
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
    const re = /(`[^`\n]{1,500}`|\|\|[^|\n]{1,500}\|\||\*\*[^*\n]{1,500}\*\*|\*[^*\s][^*\n]{0,500}\*|https?:\/\/[^\s<>"]+|@[a-z0-9_.]{3,20})/gi;
    let i = 0, m;
    const eu = '@' + E.eu.usuario;
    while ((m = re.exec(texto))) {
      if (m.index > i) frag.append(texto.slice(i, m.index));
      const t = m[0];
      if (t[0] === '`') frag.append(h('code', { class: 'cod' }, t.slice(1, -1)));
      else if (t.startsWith('||')) { const sp = h('span', { class: 'spoiler', title: 'Spoiler: clica pra ver' }, formatarTexto(t.slice(2, -2))); sp.onclick = () => sp.classList.add('visto'); frag.append(sp); }
      else if (t.startsWith('**')) frag.append(h('b', {}, formatarTexto(t.slice(2, -2))));
      else if (t[0] === '*') frag.append(h('i', {}, formatarTexto(t.slice(1, -1))));
      else if (t[0] === '@') frag.append(h('span', { class: 'men' + (t.toLowerCase() === eu ? ' eu' : '') }, t));
      else frag.append(h('a', { href: t, target: '_blank', rel: 'noopener noreferrer' }, t));
      i = m.index + t.length;
    }
    if (i < texto.length) frag.append(texto.slice(i));
    return frag;
  }
  // Bloqueados e canais silenciados ficam só neste navegador.
  const listaLocal = (k) => { try { return JSON.parse(ler(k) || '[]'); } catch (e) { return []; } };
  const bloqueado = (uid) => listaLocal('kali-bloqueados').includes(uid);
  const silenciado = (canalId) => listaLocal('kali-silenciados').includes(canalId);
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
      const tx = h('div', { class: 'texto' }, ef ? h('span', { class: 'tag-efeito' }, EFEITOS[ef][0] + ' ') : null, formatarTexto(ef ? m.texto.replace(RE_EFEITO, '') : m.texto));
      if (m.editadoEm) tx.append(h('span', { class: 'editado', title: new Date(m.editadoEm).toLocaleString('pt-BR') }, '(editado)'));
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
        minha && m.texto ? item('Editar mensagem', () => { E.editando = m.id; renderLista(); }) : null,
        item('Responder', () => bResp.click()),
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
        itens.push(h('div', { class: 'carregando' }, 'Carregando…'));
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
    lista.replaceChildren(...itens);
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
  function irPara(id) {
    const el = document.querySelector(`.msg[data-id="${Number(id)}"]`);
    if (!el) return toast('Essa mensagem não está carregada.');
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
        const b = h('button', { class: 'membro' + (nome === 'Offline' ? ' offline' : ''), onclick: (e) => cartaoMembro(e.currentTarget, m) },
          avatar(m, '', true), h('span', { class: 'txt' }, h('b', { style: estiloNome(m.corNome) || (corCargo(s.id, m.id) ? `color:${corCargo(s.id, m.id)}` : null) }, m.nome, fazAniver(m) ? ' 🎂' : '', SELO_CARGO[m.cargo] ? h('span', { class: 'coroa', title: m.cargo }, SELO_CARGO[m.cargo]) : null),
            h('small', {}, rotStatus(m))));
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
      h('small', {}, '@' + m.usuario + ' · ' + st(m.id)[1] + (m.nivel ? ` · ⭐ nível ${m.nivel}` : '')), m.statusTexto ? h('p', {}, m.statusTexto) : null, ...extras];
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
        info.hidden = true; botao.textContent = '🎙'; botao.classList.remove('gravando-on');
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
    Object.assign(E.naoLidos, s.naoLidos || {});
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
          const cod = codigo.value.trim().split('/').pop();
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
  function modalConvite() {
    const s = servidorAtual();
    if (!s) return;
    const copiar = h('button', { class: 'bt prim', type: 'button' }, 'Copiar');
    copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(s.convite); copiar.textContent = 'Copiado!'; }
      catch (e) { toast('Não consegui copiar. Seleciona o código manualmente.', 'erro'); }
    };
    abrirModal({ titulo: 'Convidar pra ' + s.nome, sub: 'Manda esse código pra galera. Eles entram pelo + → Entrar com convite.',
      corpo: [h('div', { class: 'convite' }, h('code', {}, s.convite), copiar)] });
  }
  function modalCanal(tipoInicial) {
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
    abrirModal({ titulo: 'Criar canal', sub: 'em ' + s.nome, corpo: [h('div', { class: 'tipos' }, bT, bV, bA), campo('Nome do canal', nome), linha3d, campo('🔒 Senha (opcional, só texto)', senhaCanal)], botao: 'Criar canal',
      acao: async () => {
        const corpo = { nome: nome.value.trim(), tipo };
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
    const itens = [item('Convidar pessoas', modalConvite)];
    if (souStaffEm(s.id)) itens.push(item('Configurações do servidor', () => configServidor(s)));
    if (souDono(s)) itens.push(item('Criar canal', () => modalCanal('texto')));
    itens.push(item('Abrir ticket com a staff', modalTicket));
    const atual = canalAtual();
    if (atual && atual.ticket && (atual.ticket === E.eu.id || souStaffEm(s.id))) itens.push(item('Fechar este ticket', () => apagarCanal(atual)));
    if (!souDono(s)) {
      itens.push(h('hr'), item('Sair do servidor', async () => {
        if (!confirm('Sair de ' + s.nome + '?')) return;
        try { await api('POST', `/servidores/${s.id}/sair`); aoServidorApagado({ id: s.id }); } catch (err) { toast(err.message, 'erro'); }
      }, 'perigo'));
    }
    abrirMenu(ancora, itens);
  }

  // ---------- DMs e perfil ----------
  async function abrirDmCom(usuario) {
    const d = await api('POST', '/dms', { usuario });
    if (!E.dms.some((x) => x.canalId === d.canalId)) E.dms.unshift(d);
    E.presenca.set(d.outro.id, d.outro.status);
    E.modo = 'dm'; E.servidorId = null;
    await abrirCanal(d.canalId);
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
      h('button', { class: 'icbtn voltar', title: 'Voltar', onclick: () => $('#app').classList.remove('chat') }, '←'),
      h('h1', {}, '👋 Amigos'),
      h('div', { class: 'abas-amigos' }, abas.map(([k, r]) => h('button', { class: aba === k ? 'ativa' : '', onclick: () => trocar(k) }, r)),
        h('button', { class: 'add' + (aba === 'adicionar' ? ' ativa' : ''), onclick: () => trocar('adicionar') }, 'Adicionar amigo')));
    const linha = (u, sub, ...acoes) => h('div', { class: 'linha-amigo' }, avatar(u, '', true),
      h('div', { class: 'txt' }, h('b', {}, u.nome, ' ', h('small', {}, '@' + u.usuario)), h('small', {}, sub)), h('div', { class: 'acoes' }, acoes));
    const bt = (rot, titulo, fn, cls) => h('button', { class: 'icbtn ' + (cls || ''), title: titulo, onclick: fn }, rot);
    const conversar = (u) => bt('💬', 'Mandar mensagem', () => { E.telaAmigos = false; abrirDmCom(u.usuario).catch((err) => toast(err.message, 'erro')); });
    let itens = [], titulo = '';
    if (aba === 'online' || aba === 'todos') {
      const lista = A.amigos.filter((u) => aba === 'todos' || st(u.id)[0] !== 'off');
      titulo = `${aba === 'online' ? 'Online' : 'Todos os amigos'} — ${lista.length}`;
      itens = lista.map((u) => linha(u, st(u.id)[1], conversar(u),
        bt('✕', 'Desfazer amizade', () => { if (confirm(`Desfazer amizade com ${u.nome}?`)) acaoAmigo('DELETE', `/amigos/${u.id}`); }, 'perigo')));
    } else if (aba === 'pendentes') {
      titulo = `Pendentes — ${A.recebidos.length + A.enviados.length}`;
      itens = [...A.recebidos.map((u) => linha(u, 'Pedido de amizade recebido',
        bt('✓', 'Aceitar', () => acaoAmigo('POST', `/amigos/${u.id}/aceitar`, `Agora você e ${u.nome} são amigos!`), 'ok'),
        bt('✕', 'Recusar', () => acaoAmigo('DELETE', `/amigos/${u.id}`), 'perigo'))),
      ...A.enviados.map((u) => linha(u, 'Pedido enviado', bt('✕', 'Cancelar pedido', () => acaoAmigo('DELETE', `/amigos/${u.id}`), 'perigo')))];
    } else if (aba === 'bloqueados') {
      const ids = listaLocal('kali-bloqueados');
      titulo = `Bloqueados — ${ids.length}`;
      itens = ids.map((id) => linha({ id, nome: nomeDe(id), usuario: String(id) }, 'Bloqueado neste aparelho',
        h('button', { class: 'bt', onclick: () => { alternarLocal('kali-bloqueados', id); renderAmigos(main); renderLista(); } }, 'Desbloquear')));
    } else {
      const u = h('input', { maxlength: 20, placeholder: 'Digite o nome de usuário (o @ da pessoa)' });
      u.oninput = () => { u.value = u.value.toLowerCase().replace(/^@/, ''); };
      const enviar = async () => { try { await adicionarAmigo(u.value.trim()); u.value = ''; } catch (err) { toast(err.message, 'erro'); } };
      u.onkeydown = (e) => { if (e.key === 'Enter') enviar(); };
      main.replaceChildren(topo, h('section', { class: 'col amigos-corpo' }, h('h3', {}, 'ADICIONAR AMIGO'),
        h('p', { class: 'sub' }, 'Você pode adicionar amigos com o nome de usuário deles.'),
        h('div', { class: 'add-amigo' }, u, h('button', { class: 'bt prim', onclick: enviar }, 'Enviar pedido de amizade'))));
      return;
    }
    main.replaceChildren(topo, h('section', { class: 'col amigos-corpo' }, h('div', { class: 'rot' }, titulo),
      itens.length ? itens : h('p', { class: 'sub vazio-amigos' }, aba === 'online' ? 'Nenhum amigo online agora.' : 'Nada por aqui.')));
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
    const r = await api('POST', '/amigos', { usuario });
    toast(r.amigos ? 'Vocês agora são amigos! 🎉' : 'Pedido de amizade enviado ✓', 'ok');
    await carregarAmigos(); if (E.modo === 'dm') renderSide();
  }
  function modalAdicionarAmigo() {
    const u = h('input', { maxlength: 20, placeholder: 'nome_de_usuario' });
    u.oninput = () => { u.value = u.value.toLowerCase().replace(/^@/, ''); };
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
    u.oninput = () => { u.value = u.value.toLowerCase().replace(/^@/, ''); };
    abrirModal({ titulo: 'Nova conversa', sub: 'Digita o nome de usuário da pessoa.', corpo: [campo('Usuário', u)], botao: 'Conversar',
      acao: () => abrirDmCom(u.value.trim()) });
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
      ['Moderação', () => [linhaCfg('Painel da staff', 'Denúncias, banidos e cargos de adm/mod.', h('button', { type: 'button', class: 'bt prim', onclick: () => { fecharTela(); painelStaff(); } }, 'Abrir painel'))]],
      ['Convites', () => [linhaCfg('Convidar pessoas', null, h('button', { type: 'button', class: 'bt prim', onclick: modalConvite }, 'Pegar convite'))]],
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
    try { await Voz.entrar(c.id, !!c.espacial); Voz.posicoes(E.voz.get(c.id), E.eu.id); renderMapa(); toast('Você entrou em ' + c.nome, 'ok'); } catch (err) { toast(err.message, 'erro'); }
  }

  // Telas compartilhadas na call: grade flutuante (1 tela grande, 2+ em grade). Os <video> são reaproveitados pra não piscar.
  const videosTela = new Map();
  function renderTelas() {
    let painel = $('#telas');
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
        h('button', { class: 'icbtn', title: 'Minimizar', onclick: () => painel.classList.toggle('mini') }, '–')),
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
    sock.on('loja:ganhou', ({ nome }) => toast(`Você ganhou "${nome}"! Abra a Loja pra usar.`, 'ok'));
    sock.on('castigo', ({ servidor, ate }) => toast(ate ? `⏳ Você levou castigo em ${servidor} até ${hora(ate)}.` : `✅ Seu castigo em ${servidor} acabou.`, ate ? 'erro' : 'ok'));
    sock.on('cargos:atualizado', async ({ servidorId }) => {
      try {
        await carregarCargos(servidorId);
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
      if (canalId === Voz.estado.canalId) { Voz.posicoes(membros, E.eu.id); renderMapa(); }
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
  async function iniciar() {
    try {
      E.eu = await api('GET', '/eu');
      await carregarTudo();
    } catch (err) {
      if (err.message !== 'Sessão expirada.') toast('Não consegui carregar: ' + err.message, 'erro');
      return;
    }
    conectar();
    const salvo = ler('kali-servidor');
    if (salvo === 'dm') return abrirDms();
    const s = E.servidores.find((x) => x.id === Number(salvo)) || E.servidores[0];
    if (s) await selecionarServidor(s.id); else render();
  }
  iniciar();
})();
