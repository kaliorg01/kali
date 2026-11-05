// KALI — cliente (2/7): Painel inicial, boas-vindas, visão geral, push, perfil, stories, eventos, atividades e extras.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

  // ---------- Painel (tela inicial em grade, estilo dashboard) ----------
  function abrirPainel() {
    sairAssistir();
    aplicarTemaServidor(null);
    E.modo = 'painel'; E.servidorId = null; E.canalId = null; E.telaAmigos = false; E.verDescobrir = false;
    salvar('kali-servidor', 'painel');
    $('#app').classList.add('chat');
    render();
  }
  function sidePainel() {
    const nDm = E.dms.reduce((t, d) => t + (E.naoLidos[d.canalId] || 0), 0);
    const nav = (ic, rot, fn, ativo, n) => h('button', { class: 'nav-painel' + (ativo ? ' ativo' : ''), onclick: fn },
      h('span', { class: 'ic' }, ic), h('span', { class: 'nm' }, rot), n ? h('span', { class: 'n' }, n > 99 ? '99+' : n) : null);
    void nDm;
    void nav; // Atalhos e Configurações ficam no "Mais" da lateral
    return [h('div', { class: 'side-corpo' })];
  }
  // Menu fixo do topo da lateral (substitui o trilho de bolinhas do Discord): ícone + nome, item ativo com barrinha.
  function aplicarMini() { $('#app').classList.toggle('lateral-mini', ler('kali-lateral-mini') === '1' && innerWidth > 760); renderSide(); }
  function navLateral() {
    const mini = ler('kali-lateral-mini') === '1' && innerWidth > 760, fechado = !mini && ler('kali-srv-recolhido') === '1';
    const nDm = E.dms.reduce((t, d) => t + (E.naoLidos[d.canalId] || 0), 0);
    const nav = (ic, rot, fn, ativo, n, cls) => h('button', { class: 'nav-painel' + (ativo ? ' ativo' : '') + (cls ? ' ' + cls : ''), onclick: fn, title: rot },
      ic, h('span', { class: 'nm' }, rot), n ? h('span', { class: 'n' }, n > 99 ? '99+' : n) : null);
    const icn = (n) => h('span', { class: 'ic' }, ic(n, 18));
    const srvs = servidoresOrdenados().map((sv) => {
      const b = nav(h('span', { class: 'ic ic-srv' }, sv.icone ? h('img', { src: sv.icone, alt: '' }) : (sv.sigla || inicial(sv.nome)).slice(0, 2)), sv.nome,
        () => selecionarServidor(sv.id), E.modo === 'servidor' && sv.id === E.servidorId, naoLidosServidor(sv));
      aoSegurar(b, (x, y) => menuServidorEm(sv, x, y));
      arrastarSrv(b, sv);
      return b;
    });
    return h('nav', { class: 'nav-lateral', 'aria-label': 'Navegação' },
      h('div', { class: 'marca' }, logo(), h('b', {}, 'KALI'),
        h('button', { class: 'recolher', title: mini ? 'Abrir menu' : 'Recolher menu', 'aria-label': mini ? 'Abrir menu' : 'Recolher menu', onclick: () => { salvar('kali-lateral-mini', mini ? '' : '1'); aplicarMini(); } }, mini ? '»' : '«')),
      nav(icn('painel'), 'Painel', abrirPainel, E.modo === 'painel' && !E.verDescobrir),
      nav(icn('balao'), 'Mensagens', abrirDms, E.modo === 'dm' && !E.telaAmigos, nDm),
      nav(icn('pessoas'), 'Amigos', abrirAmigos, E.modo === 'dm' && E.telaAmigos, E.amigos.recebidos.length),
      nav(h('span', { class: 'ic' }, '🧭'), 'Descobrir', abrirDescobrir, E.modo === 'painel' && E.verDescobrir),
      E.servidores.length ? nav(icn('dado'), 'Apostas 1x1', () => abrirApostas(E.servidorId || servidoresOrdenados()[0].id), E.modo === 'servidor' && E.verApostas) : null,
      nav(icn('pontos'), 'Mais', (e) => menuMais(e.currentTarget), E.modo === 'servidor' && E.verVisao),
      h('button', { class: 'rot rot-btn', 'aria-expanded': String(!fechado), onclick: () => { salvar('kali-srv-recolhido', fechado ? '' : '1'); renderSide(); } }, h('span', {}, (fechado ? '▸ ' : '▾ ') + 'Servidores'), h('small', {}, String(E.servidores.length))),
      fechado ? null : h('div', { class: 'lista-srv' }, srvs),
      nav(icn('mais'), 'Criar ou entrar', modalServidor, false, 0, 'nav-add'));
  }
  // Menu "Mais": o que é usado de vez em quando sai da lateral.
  // Progresso num lugar só: nível/missão do servidor, conquistas e apostas.
  async function modalProgresso() {
    const s = servidorAtual() || servidoresOrdenados()[0];
    const [conq, mis, rk] = await Promise.all([
      api('GET', `/usuarios/${E.eu.id}/conquistas`).catch(() => null),
      s ? api('GET', `/servidores/${s.id}/missoes`).catch(() => null) : null,
      s ? api('GET', `/servidores/${s.id}/apostas/ranking`).catch(() => []) : []]);
    const eu = (rk || []).find((x) => x.id === E.eu.id);
    const pos = eu ? rk.indexOf(eu) + 1 : null;
    const bloco = (ic, tit, valor, sub, bt) => h('div', { class: 'prog-bloco' }, h('span', { class: 'prog-ic' }, ic), h('div', {}, h('small', {}, tit), h('b', {}, valor), sub ? h('small', {}, sub) : null), bt);
    abrirModal({ titulo: '🏅 Meu progresso', sub: s ? 'No servidor ' + s.nome : null, corpo: h('div', { class: 'prog' },
      mis ? bloco('⭐', 'Nível no servidor', 'Nível ' + mis.nivel, `${mis.xp}/${mis.proximoNivelXp} XP`, s ? h('button', { type: 'button', class: 'bt', onclick: () => modalRanking(s.id) }, 'Ranking') : null) : null,
      conq ? bloco('🏆', 'Conquistas', `${conq.conquistas.filter((c) => c.ok).length}/${conq.conquistas.length}`, `⚡ ${conq.pontos} pontos`, h('button', { type: 'button', class: 'bt', onclick: () => perfilCompleto(E.eu) }, 'Ver todas')) : null,
      s ? bloco('🎲', 'Apostas', eu ? `${eu.v}V ${eu.d}D` : 'Sem apostas', eu ? `${eu.pct}% · ${pos}º no ranking · 🔥${eu.melhor} seguidas` : 'Entra numa fila pra aparecer aqui', h('button', { type: 'button', class: 'bt', onclick: () => modalRankingApostas(s) }, 'Ranking')) : null) });
  }
  function menuMais(ancora) {
    const temSrv = E.servidores.length > 0;
    abrirMenu(ancora, [h('div', { class: 'sec-menu' }, 'Mais'),
      item([ic('trofeu', 16), ' Meu progresso'], modalProgresso),
      temSrv ? item([ic('trofeu', 16), ' Visão geral do servidor'], () => abrirVisao(E.servidorId || servidoresOrdenados()[0].id)) : null,
      item([ic('relogio', 16), ' Meus lembretes'], () => modalLembretes()),
      item([ic('teclado', 16), ' Atalhos do teclado'], modalAtalhos),
      item([ic('engrenagem', 16), ' Configurações'], () => configUsuario()),
      item([ic('lupa', 16), ' Rever o tour'], () => { salvar('kali-tour', ''); tourInicial(); })].filter(Boolean));
  }
  function abrirDescobrir() { abrirPainel(); E.verDescobrir = true; render(); }
  async function renderDescobrir(main) {
    const busca = h('input', { class: 'busca-painel', placeholder: 'Buscar comunidades…', value: E.buscaDesc || '', 'aria-label': 'Buscar servidores públicos' });
    const grade = h('div', { class: 'grade-painel grade-descobrir' }, h('small', {}, 'Carregando…'));
    main.replaceChildren(h('div', { class: 'painel' },
      h('div', { class: 'hero-descobrir' }, h('h1', {}, 'Encontre sua ', h('span', {}, 'comunidade')), h('p', { class: 'sub' }, 'Servidores públicos da KALI: jogos, estudo, amigos, streamers. Entra com um clique.'), busca),
      h('div', { class: 'sec-painel' }, h('b', {}, 'Comunidades em destaque'), h('small', {}, '· mais membros primeiro')), grade));
    let t = null;
    const carregar = async () => {
      let l = [];
      try { l = await api('GET', '/descobrir?q=' + encodeURIComponent(busca.value.trim())); } catch (e) { return grade.replaceChildren(h('small', {}, e.message)); }
      grade.replaceChildren(...(l.length ? l.map((s) => h('div', { class: 'card-desc' },
        h('div', { class: 'cd-banner', style: s.banner ? `background-image:url("${s.banner}")` : '' }),
        h('div', { class: 'cd-ic' }, s.icone ? h('img', { src: s.icone, alt: '' }) : inicial(s.nome)),
        h('div', { class: 'cd-info' }, h('b', {}, s.nome), h('p', {}, s.descricao || 'Sem descrição.'), h('small', {}, '👥 ' + s.membros + ' membro' + (s.membros === 1 ? '' : 's')),
          s.souMembro ? h('button', { class: 'bt', onclick: () => selecionarServidor(s.id) }, 'Abrir') : h('button', { class: 'bt prim', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try { const sv = await api('POST', '/convites/' + encodeURIComponent(s.convite)); adicionarServidor(sv); E.membros.delete(sv.id); await selecionarServidor(sv.id); toast('Você entrou em ' + sv.nome + ' 🎉', 'ok'); } catch (err) { toast(err.message, 'erro'); e.currentTarget.disabled = false; }
          } }, 'Entrar')))) : [h('p', { class: 'vazio-painel' }, busca.value.trim() ? 'Nada encontrado.' : 'Ainda não tem servidor público. Dono de servidor: menu do servidor → 🌍 Servidor público.')]));
    };
    busca.oninput = () => { E.buscaDesc = busca.value; clearTimeout(t); t = setTimeout(carregar, 300); };
    carregar();
  }
  async function modalPublico(s) {
    let st = { publico: false, descricao: '' };
    try { st = await api('GET', `/servidores/${s.id}/publico`); } catch (e) { return toast(e.message, 'erro'); }
    const ck = h('input', { type: 'checkbox', class: 'chave-input', checked: st.publico || null });
    const desc = h('textarea', { rows: 3, maxlength: 160, placeholder: 'Ex: Servidor de Free Fire, X1 todo dia e campeonato no fim de semana 🔥', style: 'width:100%' }); desc.value = st.descricao;
    abrirModal({ titulo: '🌍 Servidor público', sub: 'Aparece em Descobrir e qualquer um pode entrar sem convite.', corpo: [h('label', { class: 'linha-privado' }, h('span', { class: 'lp-ic' }, '🌍'), h('span', { class: 'lp-txt' }, h('b', {}, 'Mostrar em Descobrir'), h('small', {}, 'Dá pra desligar quando quiser.')), ck), h('div', { class: 'sec-menu' }, 'Descrição'), desc],
      botao: 'Salvar', acao: async () => { await api('PUT', `/servidores/${s.id}/publico`, { publico: ck.checked, descricao: desc.value }); toast(ck.checked ? '🌍 ' + s.nome + ' agora aparece em Descobrir' : 'Servidor saiu de Descobrir', 'ok'); } });
  }
  function renderPainel(main) {
    if (E.verDescobrir) return renderDescobrir(main);
    const filtro = E.filtroPainel || 'todos', termo = (E.buscaPainel || '').toLowerCase();
    const naCall = (s) => s.canais.filter((c) => c.tipo === 'voz').flatMap((c) => (E.voz.get(c.id) || []).map((m) => ({ ...m, canal: c })));
    const todos = E.servidores.filter((s) => s.nome.toLowerCase().includes(termo));
    const lista = todos.filter((s) => filtro === 'todos' || (filtro === 'call' ? naCall(s).length : naoLidosServidor(s)));
    const pilula = (t, cls) => h('span', { class: 'pilula' + (cls ? ' ' + cls : '') }, t);
    const card = (s) => {
      const call = naCall(s), nl = naoLidosServidor(s);
      const texto = s.canais.filter((c) => c.tipo !== 'voz' && !c.paiCanal).length, voz = s.canais.filter((c) => c.tipo === 'voz').length;
      const cargo = souDono(s) ? 'dono' : souStaffEm(s.id) ? 'staff' : 'membro';
      return h('button', { class: 'card-srv', onclick: () => selecionarServidor(s.id) },
        h('div', { class: 'capa' }, s.icone ? h('img', { src: s.icone, alt: '' }) : h('span', {}, s.sigla || inicial(s.nome))),
        h('div', { class: 'info' },
          h('div', { class: 'linha-topo' }, h('b', {}, s.nome),
            h('span', { class: 'selos' }, pilula(cargo, 'contorno'), call.length ? pilula('● ao vivo', 'vivo') : pilula('ativo', 'ok'))),
          h('p', {}, (s.canais.find((c) => c.tipo === 'texto') ? '# ' + s.canais.filter((c) => c.tipo === 'texto').slice(0, 4).map((c) => c.nome).join('  # ') : 'Sem canais de texto ainda.')),
          h('div', { class: 'tags' }, pilula(texto + ' texto'), pilula(voz + ' voz'), nl ? pilula(nl + ' não lidas', 'destaque') : null),
          h('div', { class: 'stats' },
            h('span', {}, h('b', {}, String(call.length)), ' na call'),
            h('span', {}, h('b', {}, String(texto + voz)), ' canais'),
            h('span', { class: 'conv' }, '🔗 ' + (s.convite || '')))));
    };
    const vivos = todos.filter((s) => naCall(s).length);
    const busca = h('input', { class: 'busca-painel', placeholder: 'Buscar servidores…', value: E.buscaPainel || '', 'aria-label': 'Buscar servidores' });
    busca.oninput = () => { E.buscaPainel = busca.value; const pos = busca.selectionStart; renderPainel(main); const b = main.querySelector('.busca-painel'); b.focus(); b.setSelectionRange(pos, pos); };
    const aba = (v, t) => h('button', { class: 'aba-painel' + (filtro === v ? ' ativo' : ''), onclick: () => { E.filtroPainel = v; renderPainel(main); } }, t);
    main.replaceChildren(h('div', { class: 'painel' },
      h('h1', {}, 'Servidores ', h('span', {}, 'disponíveis')),
      h('p', { class: 'sub' }, 'Seus servidores num lugar só: quem tá na call, o que tem de novo e atalho pra entrar.'),
      h('small', { class: 'conta' }, E.servidores.length + (E.servidores.length === 1 ? ' servidor' : ' servidores')),
      h('div', { class: 'barra-painel' }, busca, h('div', { class: 'abas-painel' }, aba('todos', 'Todos'), aba('call', 'Ao vivo'), aba('novos', 'Não lidos'))),
      h('div', { class: 'sec-painel' }, h('b', {}, 'Meus servidores'), h('small', {}, '· clica pra abrir')),
      lista.length ? h('div', { class: 'grade-painel' }, lista.map(card))
        : h('p', { class: 'vazio-painel' }, E.servidores.length ? 'Nada com esse filtro.' : 'Você ainda não tem servidor.', ' ', h('button', { class: 'bt prim', onclick: modalServidor }, 'Criar ou entrar')),
      vivos.length ? [h('div', { class: 'sec-painel' }, h('b', {}, 'Ao vivo agora'), h('small', {}, '· gente conversando')),
        h('div', { class: 'grade-painel' }, vivos.flatMap((s) => s.canais.filter((c) => (E.voz.get(c.id) || []).length).map((c) => {
          const ms = E.voz.get(c.id);
          return h('div', { class: 'card-srv card-vivo' },
            h('div', { class: 'info' },
              h('div', { class: 'linha-topo' }, h('b', {}, '🔊 ' + c.nome), h('span', { class: 'selos' }, pilula(s.nome, 'contorno'), pilula('● ao vivo', 'vivo'))),
              h('div', { class: 'rostos' }, ms.slice(0, 8).map((m) => h('span', { class: 'rosto' + (m.falando ? ' falando' : ''), title: m.nome }, inicial(m.nome))), ms.length > 8 ? h('small', {}, '+' + (ms.length - 8)) : null),
              h('div', { class: 'stats' }, h('span', {}, h('b', {}, String(ms.length)), ' na call'),
                h('button', { class: 'bt prim', onclick: async () => { await selecionarServidor(s.id); abrirCanal(c.id); } }, 'Entrar'))));
        })))] : null));
    const pn = main.querySelector('.painel');
    barraStories().then((b) => { if (pn.isConnected) pn.insertBefore(b, pn.children[0]); });
    blocoEventos().then((b) => { if (b && pn.isConnected) pn.append(b); }).catch(() => {});
  }

  // ---------- boas-vindas (regras + cargos por escolha) ----------
  async function modalBoasVindas(s, auto) {
    let bv;
    try { bv = await api('GET', `/servidores/${s.id}/boas-vindas`); } catch (err) { if (!auto) toast(err.message, 'erro'); return; }
    if (auto && !bv.texto && !bv.regras && !bv.cargos.length) return;
    salvar('kali-bv-' + s.id, '1');
    const botoes = h('div', { class: 'cargos-escolha' }, bv.cargos.map((c) => {
      const b = h('button', { type: 'button', class: 'cargo-escolha' + (c.tenho ? ' tenho' : ''), style: '--c:' + c.cor }, h('i', {}), c.nome);
      b.onclick = async () => {
        try { const r = await api('POST', `/servidores/${s.id}/boas-vindas/cargo/${c.id}`); b.classList.toggle('tenho', r.tem); toast(r.tem ? `Cargo ${c.nome} pego ✓` : `Cargo ${c.nome} removido`, 'ok'); } catch (err) { toast(err.message, 'erro'); }
      };
      return b;
    }));
    abrirModal({ titulo: '👋 Bem-vindo a ' + s.nome, sub: bv.texto || null, corpo: [
      bv.regras ? [h('div', { class: 'sec-menu' }, '📜 Regras'), h('div', { class: 'regras-bv' }, bv.regras.split('\n').filter(Boolean).map((l) => h('p', {}, l)))] : null,
      bv.cargos.length ? [h('div', { class: 'sec-menu' }, '🎭 Escolhe seus cargos'), botoes] : null].flat().filter(Boolean),
      botao: 'Bora!', acao: async () => {} });
  }
  async function configBoasVindas(s) {
    let bv, cargos;
    try { [bv, cargos] = await Promise.all([api('GET', `/servidores/${s.id}/boas-vindas`), api('GET', `/servidores/${s.id}/cargos`)]); } catch (err) { return toast(err.message, 'erro'); }
    const marcados = new Set(bv.cargos.map((c) => c.id));
    const texto = h('textarea', { rows: 2, placeholder: 'Mensagem de boas-vindas (ex.: Chega mais, aqui é a resenha!)', style: 'width:100%' }); texto.value = bv.texto;
    const regras = h('textarea', { rows: 5, placeholder: 'Uma regra por linha', style: 'width:100%' }); regras.value = bv.regras;
    const lista = h('div', { class: 'lista-check' }, cargos.length ? cargos.map((c) => {
      const cb = h('input', { type: 'checkbox', checked: marcados.has(c.id) || null });
      cb.onchange = () => { if (cb.checked) marcados.add(c.id); else marcados.delete(c.id); };
      return h('label', { class: 'check-amigo' }, cb, h('span', { style: 'color:' + c.cor }, '● '), c.nome);
    }) : h('small', {}, 'Crie cargos em Configurações do servidor → Cargos pra liberar aqui.'));
    abrirModal({ titulo: '👋 Boas-vindas', sub: 'Aparece pra quem abre o servidor pela primeira vez. Os cargos marcados qualquer membro pode pegar sozinho.',
      corpo: [h('div', { class: 'sec-menu' }, 'Mensagem'), texto, h('div', { class: 'sec-menu' }, 'Regras'), regras, h('div', { class: 'sec-menu' }, 'Cargos por escolha'), lista],
      botao: 'Salvar', acao: async () => { await api('PUT', `/servidores/${s.id}/boas-vindas`, { texto: texto.value, regras: regras.value, cargos: [...marcados] }); toast('👋 Boas-vindas salvas', 'ok'); } });
  }

  // ---------- visão geral do servidor (banner, números, ranking, calls) ----------
  async function abrirVisao(sid) {
    const s = E.servidores.find((x) => x.id === sid) || servidorAtual() || E.servidores[0];
    if (!s) return modalServidor();
    if (E.modo !== 'servidor' || E.servidorId !== s.id) await selecionarServidor(s.id);
    E.verVisao = true; E.verCall = false;
    $('#app').classList.add('chat');
    renderMain(); renderSide();
  }
  async function renderVisao(main) {
    const s = servidorAtual();
    if (!s) { E.verVisao = false; return renderMain(); }
    const membros = E.membros.get(s.id) || [];
    const online = membros.filter((m) => st(m.id)[0] !== 'off').length;
    const naCall = s.canais.filter((c) => c.tipo === 'voz').reduce((t, c) => t + (E.voz.get(c.id) || []).length, 0);
    const num = (n, rot, ic) => h('div', { class: 'num-visao' }, h('span', {}, ic), h('b', {}, String(n)), h('small', {}, rot));
    const rank = h('ol', { class: 'ranking rank-visao' }, h('li', {}, h('small', {}, 'Carregando ranking…')));
    main.replaceChildren(h('div', { class: 'painel visao' },
      h('div', { class: 'capa-visao', style: s.bannerImg ? `background-image:url("${s.bannerImg}")` : '' },
        h('div', { class: 'capa-info' }, h('div', { class: 'ic-visao' }, s.icone ? h('img', { src: s.icone, alt: '' }) : s.sigla || inicial(s.nome)),
          h('div', {}, h('h1', {}, s.nome), h('small', {}, (souDono(s) ? 'Você é o dono' : souStaffEm(s.id) ? 'Você é da staff' : 'Membro') + ' · convite ' + (s.convite || ''))),
          h('button', { class: 'bt', style: 'margin-left:auto', onclick: () => { E.verVisao = false; renderMain(); renderSide(); } }, 'Abrir chat'))),
      h('div', { class: 'nums-visao' }, num(membros.length, 'membros', '👥'), num(online, 'online agora', '🟢'), num(naCall, 'na call', '🔊'), num(s.canais.length, 'canais', '#')),
      h('div', { class: 'mascote-visao', id: 'mascote-visao' }, h('small', {}, 'Carregando mascote…')),
      h('div', { class: 'grade-visao' },
        h('div', { class: 'card-srv bloco-visao bloco-missao' }, h('div', { class: 'info' }, cartaoMissao(s.id) || h('small', {}, 'Carregando missão da semana…'))),
        h('div', { class: 'card-srv bloco-visao' }, h('div', { class: 'info' }, h('div', { class: 'linha-topo' }, h('b', {}, '🏆 Ranking'), h('span', { class: 'selos' }, h('span', { class: 'pilula' }, 'XP'))), rank)),
        h('div', { class: 'card-srv bloco-visao' }, h('div', { class: 'info' }, h('div', { class: 'linha-topo' }, h('b', {}, '⚡ Atalhos')),
          h('div', { class: 'atalhos-visao' },
            h('button', { class: 'bt', onclick: modalConvite }, '🔗 Convidar'),
            h('button', { class: 'bt', onclick: () => modalBoasVindas(s) }, '👋 Regras e cargos'),
            souStaffEm(s.id) ? h('button', { class: 'bt', onclick: () => configBoasVindas(s) }, '⚙️ Editar boas-vindas') : null,
            souStaffEm(s.id) ? h('button', { class: 'bt', onclick: () => modalAutomod(s) }, '🛡️ AutoMod') : null))))));
    try {
      const lista = await api('GET', `/servidores/${s.id}/ranking`);
      const tot = lista.reduce((t, x) => t + (x.xp || 0) + ((x.nivel || 1) - 1) * 100, 0), mc = mascoteDe(tot), mbox = $('#mascote-visao');
      if (mbox) mbox.replaceChildren(h('div', { class: 'mascote-ic' }, mc.emoji), h('div', { class: 'mascote-txt' }, h('b', {}, 'Mascote: ' + mc.nome), h('small', {}, mc.prox ? `${tot} XP da galera · evolui pra ${mc.prox[1]} ${mc.prox[2]} em ${mc.prox[0]} XP` : `${tot} XP da galera · forma máxima!`), h('div', { class: 'barra-mascote' }, h('i', { style: `width:${mc.pct}%` }))));
      rank.replaceChildren(...(lista.length ? lista.slice(0, 8).map((x, i) => h('li', {}, h('span', {}, ['🥇', '🥈', '🥉'][i] || i + 1 + 'º'), avatar(x.usuario), h('b', {}, x.usuario.nome), h('small', { style: 'margin-left:auto' }, `nv ${x.nivel} · ${x.xp} XP`)))
        : [h('li', {}, h('small', {}, 'Ninguém pontuou ainda. Manda mensagem pra ganhar XP!'))]));
    } catch (err) { rank.replaceChildren(h('li', {}, h('small', {}, 'Ranking indisponível.'))); }
  }

  // Ordem dos servidores na lateral (arrastar e soltar), salva neste navegador.
  function servidoresOrdenados() {
    let ordem = [];
    try { ordem = JSON.parse(ler('kali-ordem-srv') || '[]'); } catch (e) {}
    const pos = (id) => { const i = ordem.indexOf(id); return i < 0 ? 1e9 + id : i; };
    return [...E.servidores].sort((a, b) => pos(a.id) - pos(b.id));
  }
  let srvArrastado = null;
  function arrastarSrv(b, sv) {
    b.draggable = true;
    b.ondragstart = (e) => { srvArrastado = sv.id; b.classList.add('arrastando'); try { e.dataTransfer.setData('text/plain', 'srv'); } catch (er) {} };
    b.ondragend = () => { srvArrastado = null; b.classList.remove('arrastando'); };
    b.ondragover = (e) => { if (srvArrastado && srvArrastado !== sv.id) { e.preventDefault(); b.classList.add('alvo-cima'); } };
    b.ondragleave = () => b.classList.remove('alvo-cima');
    b.ondrop = (e) => {
      e.preventDefault(); b.classList.remove('alvo-cima');
      if (!srvArrastado || srvArrastado === sv.id) return;
      const ids = servidoresOrdenados().map((x) => x.id).filter((id) => id !== srvArrastado);
      ids.splice(ids.indexOf(sv.id), 0, srvArrastado);
      salvar('kali-ordem-srv', JSON.stringify(ids));
      renderSide();
    };
  }

  // ---------- push (notificação com o app fechado) ----------
  const b64ParaBytes = (b) => { const p = '='.repeat((4 - (b.length % 4)) % 4); const s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function ativarPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error(/iPhone|iPad/i.test(navigator.userAgent) ? 'No iPhone: adiciona a KALI na tela de início (Compartilhar → Adicionar à Tela de Início) e abre por lá.' : 'Seu navegador não suporta notificação push.');
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Você bloqueou as notificações. Libera nas configurações do navegador.');
    const reg = await navigator.serviceWorker.ready;
    const { chave } = await api('GET', '/push/chave');
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaBytes(chave) });
    await api('POST', '/push/inscrever', { inscricao: sub.toJSON() });
    salvar('kali-push', '1');
    await api('POST', '/push/teste');
  }
  async function desativarPush() {
    try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) { await api('POST', '/push/sair', { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) {}
    salvar('kali-push', '');
  }

  // ---------- sala de espera da call ----------
  function cardPedidoVoz(d) {
    if (!souStaffEm(d.servidorId) || $('#pedido-' + d.canalId + '-' + d.usuario.id)) return;
    const c = acharCanal(d.canalId);
    const responder = async (aceitar) => { const r = await pedir('voz:aceitar', { canalId: d.canalId, usuarioId: d.usuario.id, aceitar }); if (r.erro) toast(r.erro, 'erro'); card.remove(); };
    const card = h('div', { class: 'chamada pedido-voz', id: 'pedido-' + d.canalId + '-' + d.usuario.id },
      h('b', {}, '🚪 ' + (d.usuario.nome || 'Alguém') + ' quer entrar'), h('small', {}, 'Sala de espera · 🔊 ' + (c ? c.nome : 'call')),
      h('div', { class: 'acoes' }, h('button', { class: 'bt prim', onclick: () => responder(true) }, 'Aceitar'), h('button', { class: 'bt', onclick: () => responder(false) }, 'Recusar')));
    document.body.append(card);
    tocarSom('plim');
    setTimeout(() => card.remove(), 60000);
  }

  // ---------- status de jogo ----------
  const jogoDe = (statusTexto) => { const m = /^🎮\s*(?:jogando\s+)?(.+)$/i.exec(statusTexto || ''); return m ? m[1].trim() : null; };
  async function definirJogo() {
    const atual = jogoDe(E.eu.statusTexto) || '';
    const jogo = prompt('🎮 Tá jogando o quê? (vazio = parar)', atual);
    if (jogo === null) return;
    try {
      E.eu = Object.assign(E.eu, await api('PATCH', '/eu', { statusTexto: jogo.trim() ? '🎮 Jogando ' + jogo.trim().slice(0, 60) : '' }));
      toast(jogo.trim() ? '🎮 Agora todo mundo vê que você tá jogando ' + jogo.trim() : 'Status de jogo removido', 'ok'); renderSide(); renderMembros();
    } catch (err) { toast(err.message, 'erro'); }
  }
  async function chamarPraJogar(u, jogo) {
    try {
      await abrirDmCom(u.usuario);
      const ta = document.querySelector('.caixa textarea');
      if (ta) { ta.value = `🎮 Bora jogar ${jogo}? Me chama!`; ta.focus(); }
    } catch (err) { toast(err.message, 'erro'); }
  }

  // ---------- tela cheia girando no celular ----------
  function telaCheia(el) {
    if (!el || !el.requestFullscreen) return;
    el.requestFullscreen().then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {} } });

  // ---------- tour de boas-vindas (primeira vez) ----------
  function tourInicial() {
    if (ler('kali-tour') === '1') return;
    const passos = [
      ['👋', 'Bem-vindo à KALI!', 'Aqui é tipo o Discord, só que da galera. Bora num tour de 20 segundos.'],
      ['▦', 'Painel', 'Na lateral, o Painel mostra todos os seus servidores em cards e quem tá na call agora.'],
      ['＋', 'Crie ou entre num servidor', 'Use "Criar ou entrar" — dá pra começar com um modelo pronto (FPS, RP, estudo, amigos…).'],
      ['🎮', 'Status de jogo', 'Clica no seu nome lá embaixo → "Jogando…" e os amigos podem te chamar pra jogar.'],
      ['⌨️', 'Ctrl + K', 'Pula pra qualquer canal, pessoa ou comando. Digita > pra ver só comandos.'],
      ['🔔', 'Notificações', 'Em Configurações → Notificações, liga o push pra receber DM e @menção com o app fechado.'],
    ];
    let i = 0;
    const corpo = h('div', { class: 'tour' });
    const desenhar = () => {
      const [ic, t, d] = passos[i];
      corpo.replaceChildren(h('div', { class: 'tour-ic' }, ic), h('h3', {}, t), h('p', {}, d),
        h('div', { class: 'tour-pontos' }, passos.map((_, j) => h('i', { class: j === i ? 'ativo' : '' }))),
        h('div', { class: 'acoes' },
          h('button', { type: 'button', class: 'bt', onclick: () => { salvar('kali-tour', '1'); fecharModal(); } }, 'Pular'),
          h('button', { type: 'button', class: 'bt prim', onclick: () => { if (++i >= passos.length) { salvar('kali-tour', '1'); fecharModal(); } else desenhar(); } }, i === passos.length - 1 ? 'Começar!' : 'Próximo')));
    };
    desenhar();
    abrirModal({ titulo: 'Tour rápido', corpo });
  }

  // ---------- efeitos de perfil (partículas em volta do avatar) ----------
  const EFEITOS_PERFIL = { '': 'Nenhum', neve: '❄️ Neve', fogo: '🔥 Fogo', estrelas: '✨ Estrelas', coracoes: '💖 Corações', raios: '⚡ Raios', confete: '🎉 Confete', aura: '🌀 Aura de energia', holo: '🌈 Holográfico', glitch: '👾 Glitch hacker' };
  const PARTICULA = { neve: '❄', fogo: '🔥', estrelas: '✦', coracoes: '♥', raios: '⚡', confete: '●' };
  function efeitoPerfil(u) {
    const ef = u && u.vitrine && u.vitrine.efeito;
    if (ef === 'aura') return h('div', { class: 'aura-anel', 'aria-hidden': 'true' }, h('i'), h('i'));
    if (ef === 'holo' || ef === 'glitch') return h('div', { class: 'marca-efeito efeito-' + ef, 'aria-hidden': 'true' });
    if (!ef || !PARTICULA[ef] || document.documentElement.hasAttribute('data-leve')) return null;
    return h('div', { class: 'efeito-perfil efeito-' + ef, 'aria-hidden': 'true' }, Array.from({ length: 12 }, (_, i) => h('i', { style: `--i:${i};--x:${(i * 37) % 100}%` }, PARTICULA[ef])));
  }

  // ---------- perfil completo (tela grande) com conquistas ----------
  async function perfilCompleto(u) {
    fecharMenu();
    const [banner, ...extras] = vitrine(u);
    const conq = h('div', { class: 'grade-conquistas' }, h('small', {}, 'Carregando conquistas…'));
    const nums = h('div', { class: 'nums-perfil' });
    const comum = h('div', { class: 'em-comum' });
    const av = h('div', { class: 'av-linha' }, avatar(u, 'av-vitrine', true), efeitoPerfil(u), h('span', { class: 'bolinha-perfil ' + st(u.id)[0] }));
    const f = abrirModal({ titulo: u.nome, corpo: [banner, av,
      h('div', { class: 'caixa-perfil' }, h('h3', {}, u.nome), h('small', { class: 'arroba' }, '@' + u.usuario + ' · ' + st(u.id)[1]),
        u.statusTexto ? h('div', { class: 'recado-perfil' }, '💬 ' + u.statusTexto) : null, nums, h('hr'), ...extras,
        h('div', { class: 'sec-perfil' }, 'Conquistas'), conq, u.id !== E.eu.id ? [h('div', { class: 'sec-perfil' }, 'Em comum'), comum] : null)].flat().filter(Boolean) });
    f.classList.add('perfil-grande');
    f.style.setProperty('--perfil', u.cor || 'var(--roxo)');
    try {
      const d = await api('GET', `/usuarios/${u.id}/conquistas`);
      // números que sobem contando
      const contar = (el, alvo) => { const t0 = performance.now(); const passo = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(alvo * (1 - Math.pow(1 - k, 3))).toLocaleString('pt-BR'); if (k < 1) requestAnimationFrame(passo); }; requestAnimationFrame(passo); };
      nums.replaceChildren(...[[d.mensagens, 'mensagens', '💬'], [d.servidores, 'servidores', '🏠'], [d.amigos || 0, 'amigos', '🤝'], [d.dias, 'dias de KALI', '📅']].map(([n, r, ic]) => { const b = h('b', {}, '0'); contar(b, n); return h('div', {}, h('span', { class: 'ic-num' }, ic), b, h('small', {}, r)); }));
      const RAR = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };
      const ORDEM = ['comum', 'raro', 'epico', 'lendario'];
      const feitas = d.conquistas.filter((c) => c.ok).length, pct = Math.round((d.pontos / d.pontosMax) * 100);
      if (feitas === d.conquistas.length) av.classList.add('moldura-lendaria');
      const maior = d.conquistas.filter((c) => c.ok).sort((a, b) => ORDEM.indexOf(b.raridade) - ORDEM.indexOf(a.raridade))[0];
      const topo = h('div', { class: 'conq-topo' },
        h('div', { class: 'anel-conq', style: `--p:${pct}` }, h('div', {}, h('b', {}, pct + '%'), h('small', {}, 'completo'))),
        h('div', { class: 'conq-resumo' }, h('b', {}, `${feitas}/${d.conquistas.length} conquistas`), h('small', {}, `⚡ ${d.pontos} / ${d.pontosMax} pontos de conquista`),
          maior ? h('div', { class: 'conq-destaque r-' + maior.raridade }, h('span', {}, maior.emoji), h('div', {}, h('small', {}, 'Maior conquista'), h('b', {}, maior.nome))) : null));
      conq.before(topo);
      conq.replaceChildren(...d.conquistas.map((c, i) => h('div', { class: `conquista r-${c.raridade}` + (c.ok ? ' ok' : ''), title: c.desc, style: `--d:${i * 45}ms` },
        h('span', { class: 'conq-rar' }, RAR[c.raridade]),
        h('span', { class: 'conq-ic' }, c.ok ? c.emoji : '🔒'),
        h('b', {}, c.ok || c.raridade !== 'lendario' ? c.nome : '???'),
        h('small', {}, c.desc),
        c.ok ? h('span', { class: 'conq-ok' }, '✓ Desbloqueada') : h('div', { class: 'conq-barra' }, h('i', { style: `width:${Math.round((c.valor / c.meta) * 100)}%` }), h('small', {}, `${c.valor.toLocaleString('pt-BR')} / ${c.meta.toLocaleString('pt-BR')}`)))));
    } catch (e) { conq.replaceChildren(h('small', {}, 'Não consegui carregar.')); }
    if (u.id !== E.eu.id) api('GET', `/usuarios/${u.id}/comum`).then((d) => comum.replaceChildren(h('small', {}, `🏠 ${d.servidores.length} servidor(es) · 👥 ${d.amigos.length} amigo(s) em comum`))).catch(() => {});
  }

  // ---------- stories de 24h ----------
  const FUNDOS_STORY = { rosa: 'linear-gradient(135deg,#ff4fb8,#8b2fd6)', azul: 'linear-gradient(135deg,#1fa2ff,#1d4ed8)', roxo: 'linear-gradient(135deg,#7c3aed,#c026d3)', verde: 'linear-gradient(135deg,#10b981,#0e7490)', fogo: 'linear-gradient(135deg,#f97316,#dc2626)', noite: 'linear-gradient(135deg,#0f172a,#334155)' };
  let cacheStories = null;
  async function barraStories() {
    const barra = h('div', { class: 'stories' }, h('button', { class: 'story-bola story-novo', onclick: modalNovoStory, title: 'Postar story' }, h('span', { class: 'sb-av' }, '＋'), h('small', {}, 'Seu story')));
    if (!cacheStories || Date.now() - cacheStories.t > 30000) cacheStories = { t: Date.now(), p: api('GET', '/stories') };
    cacheStories.p.then((lista) => {
      for (const a of lista) barra.append(h('button', { class: 'story-bola' + (lerVistos().includes(a.stories[a.stories.length - 1].id) ? ' visto' : ''), onclick: () => verStories(lista, lista.indexOf(a)) },
        h('span', { class: 'sb-av' }, avatar(a, '', false)), h('small', {}, a.id === E.eu.id ? 'Você' : a.nome)));
    }).catch(() => {});
    return barra;
  }
  const lerVistos = () => { try { return JSON.parse(ler('kali-stories-vistos') || '[]'); } catch (e) { return []; } };
  function modalNovoStory() {
    let fundo = 'rosa';
    const txt = h('textarea', { rows: 4, maxlength: 200, placeholder: 'O que tá rolando? (some em 24h)', class: 'story-txt' });
    const prev = h('div', { class: 'story-prev', style: 'background:' + FUNDOS_STORY.rosa }, txt);
    const cores = h('div', { class: 'cores' }, Object.entries(FUNDOS_STORY).map(([k, g]) => { const b = h('button', { type: 'button', class: k === fundo ? 'ativa' : '', title: k, style: 'background:' + g }); b.onclick = () => { fundo = k; prev.style.background = g; cores.querySelectorAll('button').forEach((x) => x.classList.toggle('ativa', x === b)); }; return b; }));
    abrirModal({ titulo: '📸 Novo story', sub: 'Aparece pros seus amigos e pra galera dos seus servidores por 24h.', corpo: [prev, cores], botao: 'Postar',
      acao: async () => { await api('POST', '/stories', { texto: txt.value, fundo }); cacheStories = null; toast('📸 Story postado!', 'ok'); if (E.modo === 'painel') renderMain(); } });
  }
  function verStories(lista, ia) {
    let a = ia, i = 0, timer = null;
    const tela = h('div', { class: 'story-tela', role: 'dialog' });
    const fechar = () => { clearTimeout(timer); tela.remove(); document.removeEventListener('keydown', tecla); if (E.modo === 'painel') renderMain(); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowRight') prox(); if (e.key === 'ArrowLeft') ant(); };
    const prox = () => { const au = lista[a]; if (++i >= au.stories.length) { i = 0; if (++a >= lista.length) return fechar(); } mostrar(); };
    const ant = () => { if (--i < 0) { if (--a < 0) { a = 0; i = 0; } else i = lista[a].stories.length - 1; } mostrar(); };
    const mostrar = () => {
      clearTimeout(timer);
      const au = lista[a], sto = au.stories[i];
      salvar('kali-stories-vistos', JSON.stringify([...new Set([...lerVistos(), sto.id])].slice(-300)));
      const min = Math.max(1, Math.round((Date.now() - sto.criadoEm) / 60000));
      tela.replaceChildren(h('div', { class: 'story-caixa', style: 'background:' + (FUNDOS_STORY[sto.fundo] || FUNDOS_STORY.rosa) },
        h('div', { class: 'story-barras' }, au.stories.map((_, j) => h('i', { class: j < i ? 'cheia' : j === i ? 'andando' : '' }))),
        h('div', { class: 'story-topo' }, avatar(au, '', false), h('b', {}, au.nome), h('small', {}, min < 60 ? min + ' min' : Math.round(min / 60) + ' h'),
          au.id === E.eu.id ? h('button', { class: 'icbtn', title: 'Apagar story', onclick: async (e) => { e.stopPropagation(); await api('DELETE', '/stories/' + sto.id).catch(() => {}); cacheStories = null; fechar(); } }, '🗑') : null,
          h('button', { class: 'icbtn', title: 'Fechar', onclick: (e) => { e.stopPropagation(); fechar(); } }, '✕')),
        h('p', { class: 'story-texto' }, sto.texto),
        h('button', { class: 'story-lado esq', 'aria-label': 'Anterior', onclick: ant }), h('button', { class: 'story-lado dir', 'aria-label': 'Próximo', onclick: prox })));
      timer = setTimeout(prox, 5000);
    };
    document.body.append(tela);
    document.addEventListener('keydown', tecla);
    mostrar();
  }

  // ---------- eventos com contagem regressiva (Painel) ----------
  let cacheEventos = null;
  async function blocoEventos() {
    const box = h('div', { class: 'eventos-painel' });
    if (!cacheEventos || Date.now() - cacheEventos.t > 60000) cacheEventos = { t: Date.now(), p: Promise.all(E.servidores.map((s) => api('GET', `/servidores/${s.id}/eventos`).then((l) => l.map((e) => ({ ...e, srv: s }))).catch(() => []))) };
    const todos = (await cacheEventos.p).flat()
      .filter((e) => e.inicio > Date.now()).sort((x, y) => x.inicio - y.inicio).slice(0, 6);
    if (!todos.length) return null;
    const relogio = (alvo) => { const el = h('div', { class: 'contagem' }); const tick = () => { const s = Math.max(0, Math.floor((alvo - Date.now()) / 1000)); const p = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]; el.replaceChildren(...p.map((n, k) => h('span', {}, h('b', {}, String(n).padStart(2, '0')), h('small', {}, ['dias', 'horas', 'min', 'seg'][k])))); if (!el.isConnected && el.dataset.on) return; el.dataset.on = 1; setTimeout(tick, 1000); }; tick(); return el; };
    box.append(h('div', { class: 'sec-painel' }, h('b', {}, 'Em breve'), h('small', {}, '· eventos dos seus servidores')),
      h('div', { class: 'grade-painel' }, todos.map((e) => h('div', { class: 'card-srv card-evento' }, h('div', { class: 'info' },
        h('div', { class: 'linha-topo' }, h('b', {}, '📅 ' + e.titulo), h('span', { class: 'selos' }, h('span', { class: 'pilula contorno' }, e.srv.nome), h('span', { class: 'pilula destaque' }, 'Em breve'))),
        e.descricao ? h('p', {}, e.descricao) : null, relogio(e.inicio),
        h('div', { class: 'stats' }, h('span', {}, h('b', {}, String(e.interessados)), ' vão'), h('span', {}, new Date(e.inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })),
          h('button', { class: 'bt' + (e.euVou ? '' : ' prim'), onclick: async (ev) => { ev.stopPropagation(); try { await api('POST', `/eventos/${e.id}/interesse`); cacheEventos = null; renderMain(); } catch (err) { toast(err.message, 'erro'); } } }, e.euVou ? '✓ Vou' : 'Tenho interesse')))))));
    return box;
  }

  // ---------- atividade na call: jogo da velha ----------
  let velha = null;
  const linhasVelha = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function novoVelha() { velha = { jogo: 'velha', tab: Array(9).fill(''), vez: 'X', jog: { X: E.eu.id, O: null }, nomes: { X: E.eu.nome, O: '' } }; enviarVelha(); abrirVelha(); }
  function enviarVelha() { pedir('voz:atividade', { estado: velha }).then((r) => r.erro && toast(r.erro, 'erro')); }
  function vencedorVelha(t) { for (const [a, b, c] of linhasVelha) if (t[a] && t[a] === t[b] && t[a] === t[c]) return t[a]; return t.every(Boolean) ? 'empate' : null; }
  function abrirVelha() {
    if (!velha) return;
    const v = vencedorVelha(velha.tab);
    const meu = velha.jog.X === E.eu.id ? 'X' : velha.jog.O === E.eu.id ? 'O' : null;
    const grade = h('div', { class: 'velha' }, velha.tab.map((c, i) => h('button', { type: 'button', class: 'casa ' + (c ? 'c-' + c : ''), disabled: !!c || !!v || null, onclick: () => {
      let eu = meu;
      if (!eu && !velha.jog.O && velha.jog.X !== E.eu.id) { velha.jog.O = E.eu.id; velha.nomes.O = E.eu.nome; eu = 'O'; }
      if (eu !== velha.vez) return toast(eu ? 'Espera sua vez!' : 'Só os dois jogadores jogam.', 'erro');
      velha.tab[i] = eu; velha.vez = eu === 'X' ? 'O' : 'X'; enviarVelha(); abrirVelha();
    } }, c)));
    const status = v === 'empate' ? '🤝 Deu velha!' : v ? `🏆 ${velha.nomes[v] || v} venceu!` : `Vez do ${velha.vez} (${velha.nomes[velha.vez] || 'quem clicar primeiro'})`;
    const atual = document.querySelector('.modal.modal-velha');
    const corpo = [h('p', { class: 'status-velha' }, status), grade, h('button', { type: 'button', class: 'bt', style: 'margin-top:10px', onclick: novoVelha }, '🔄 Nova partida')];
    if (atual) { atual.querySelector('.corpo-velha').replaceChildren(...corpo); return; }
    const f = abrirModal({ titulo: '❌⭕ Jogo da velha', sub: 'Todo mundo na call vê. O primeiro que clicar vira o O.', corpo: h('div', { class: 'corpo-velha' }, corpo) });
    f.classList.add('modal-velha');
  }
  function aoAtividade(d) {
    if (d && d.estado && d.estado.jogo === 'emote') { const e = d.estado; if (typeof e.emoji === 'string' && e.emoji.length <= 8) emoteGigante(e.emoji, typeof e.nome === 'string' ? e.nome.slice(0, 32) : ''); return; }
    if (d && d.estado && d.estado.jogo === 'duelo') {
      const e = d.estado;
      if (!duelo || duelo.id !== e.id) { duelo = e; toast('⚡ ' + (e.porNome || 'Alguém') + ' chamou um duelo de reflexo!', 'ok'); abrirDuelo(); }
      else { Object.assign(duelo.tempos, e.tempos); duelo._pintar && duelo._pintar(); }
      return;
    }
    if (!d || !d.estado || d.estado.jogo !== 'velha') return;
    const novo = !velha || velha.tab.every((c) => !c);
    velha = d.estado;
    if (document.querySelector('.modal.modal-velha')) abrirVelha();
    else if (novo) toast('❌⭕ Começou um jogo da velha na call! Clica no 🎮 pra jogar.', 'ok');
  }
  function menuAtividades(ancora) {
    abrirMenu(ancora, [h('div', { class: 'sec-menu' }, 'Atividades na call'),
      item('❌⭕ Jogo da velha', () => (velha ? abrirVelha() : novoVelha())),
      item('⚡ Duelo de reflexo', novoDuelo),
      item('😂 Emote gigante', () => menuEmote(ancora))]);
  }

  // ---------- traduzir mensagem ----------
  async function traduzir(m, alvoEl) {
    const texto = m.texto || '';
    if (!texto) return;
    try {
      if (window.Translator && window.LanguageDetector) {
        const det = await (await LanguageDetector.create()).detect(texto);
        const de = det && det[0] ? det[0].detectedLanguage : 'en';
        if (de === 'pt') return toast('Essa mensagem já está em português.', 'ok');
        const tr = await Translator.create({ sourceLanguage: de, targetLanguage: 'pt' });
        const saida = await tr.translate(texto);
        const box = h('div', { class: 'traducao' }, h('small', {}, '🌐 Tradução (' + de + ' → pt)'), h('p', {}, saida));
        alvoEl && alvoEl.append(box);
        return;
      }
    } catch (e) { /* cai pro tradutor do Google */ }
    window.open('https://translate.google.com/?sl=auto&tl=pt&op=translate&text=' + encodeURIComponent(texto.slice(0, 1500)), '_blank', 'noopener');
  }

  // ---------- selo de verificado ----------
  const seloVerif = (u) => (u && u.verificado ? h('span', { class: 'verificado', title: 'Conta verificada' }, '✔') : null);
  async function alternarVerificado(u) {
    try { await api('POST', `/usuarios/${u.id}/verificado`, { verificado: !u.verificado }); u.verificado = !u.verificado; toast(u.verificado ? `✔ ${u.nome} verificado` : `Selo de ${u.nome} removido`, 'ok'); } catch (err) { toast(err.message, 'erro'); }
  }
  // nome com cargo animado (degradê brilhando na cor do cargo)
  const cargoAnimado = (sid, uid) => !!(E.cargos.get(sid) || []).find((c) => c.animado && c.membros.includes(uid));

  // ---------- reação que explode na tela ----------
  function explodirEmoji(emoji, origem) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = origem ? origem.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const grande = h('div', { class: 'emoji-boom' }, emoji);
    grande.style.left = x + 'px'; grande.style.top = y + 'px';
    document.body.append(grande);
    setTimeout(() => grande.remove(), 900);
    for (let i = 0; i < 12; i++) {
      const p = h('div', { class: 'emoji-faisca' }, emoji);
      const ang = (i / 12) * Math.PI * 2, dist = 70 + (i % 3) * 30;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      document.body.append(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  // ---------- cinema: cadeirinhas com quem está assistindo ----------
  function cadeirasCinema(espectadores) {
    const lista = espectadores || [];
    const lugares = Math.max(8, Math.ceil(lista.length / 8) * 8);
    return h('div', { class: 'cinema-fileiras', title: lista.length + ' assistindo' },
      Array.from({ length: lugares }, (_, i) => {
        const p = lista[i];
        return h('div', { class: 'cadeira' + (p ? ' ocupada' : '') }, p ? h('span', { class: 'cad-av', style: 'background:' + (p.cor || 'var(--roxo)'), title: p.nome }, inicial(p.nome)) : null, h('i'));
      }));
  }

  // ---------- duelo de reflexo (na call) ----------
  let duelo = null;
  function enviarDuelo() { pedir('voz:atividade', { estado: duelo }).then((r) => r.erro && toast(r.erro, 'erro')); }
  function novoDuelo() {
    if (!window.Voz || !Voz.estado.canalId) return toast('Entra numa call pra duelar.', 'erro');
    duelo = { jogo: 'duelo', id: Date.now(), por: E.eu.id, porNome: E.eu.nome, atraso: 1500 + Math.floor(Math.random() * 3500), tempos: {} };
    enviarDuelo(); abrirDuelo();
  }
  function abrirDuelo() {
    if (!duelo) return;
    const alvo = h('button', { type: 'button', class: 'alvo-duelo espera' }, 'Espera…');
    const placar = h('div', { class: 'placar-duelo' });
    const pintarPlacar = () => {
      const ts = Object.entries(duelo.tempos).sort((a, b) => a[1].ms - b[1].ms);
      placar.replaceChildren(...ts.map(([, t], i) => h('div', {}, (i === 0 ? '🏆 ' : '') + t.nome + ' — ' + (t.ms < 0 ? 'queimou a largada 😬' : t.ms + ' ms'))));
    };
    let liberado = false, t0 = 0;
    const tm = setTimeout(() => { liberado = true; t0 = performance.now(); alvo.classList.remove('espera'); alvo.textContent = 'CLICA!'; }, duelo.atraso);
    alvo.onclick = () => {
      if (duelo.tempos[E.eu.id]) return;
      const ms = liberado ? Math.round(performance.now() - t0) : -1;
      duelo.tempos[E.eu.id] = { nome: E.eu.nome, ms };
      alvo.textContent = ms < 0 ? 'Cedo demais!' : ms + ' ms';
      alvo.disabled = true; pintarPlacar(); enviarDuelo();
    };
    pintarPlacar();
    abrirModal({ titulo: '⚡ Duelo de reflexo', sub: 'Quando ficar verde, clica o mais rápido que der. Clicar antes queima a largada.', corpo: [alvo, placar] });
    document.querySelector('.modal')?.classList.add('modal-duelo');
    duelo._pintar = pintarPlacar; duelo._tm = tm;
  }

  // ---------- mascote do servidor (evolui com o XP da galera) ----------
  const MASCOTES = [[0, '🥚', 'Ovo'], [200, '🐣', 'Filhote'], [1000, '🐥', 'Pintinho'], [3000, '🦅', 'Águia'], [8000, '🐉', 'Dragão'], [20000, '🐲', 'Dragão Lendário']];
  function mascoteDe(xpTotal) {
    let atual = MASCOTES[0], prox = null;
    for (let i = 0; i < MASCOTES.length; i++) if (xpTotal >= MASCOTES[i][0]) { atual = MASCOTES[i]; prox = MASCOTES[i + 1] || null; }
    return { emoji: atual[1], nome: atual[2], prox, pct: prox ? Math.min(100, ((xpTotal - atual[0]) / (prox[0] - atual[0])) * 100) : 100 };
  }

  // ---------- cartão de jogador (imagem pra postar) ----------
  async function cartaoJogador(u) {
    const W = 1080, H = 1350, cv = h('canvas', { width: W, height: H }), g = cv.getContext('2d');
    const cor = u.cor || '#ff4fb8';
    const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, cor); grad.addColorStop(1, '#0b0b0d');
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, W, H);
    g.fillStyle = grad; g.fillRect(0, 0, W, 520);
    const carregar = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
    const [ban, av] = await Promise.all([carregar(u.bannerImg), carregar(u.avatar)]);
    if (ban) { g.globalAlpha = 0.85; g.drawImage(ban, 0, 0, W, 520); g.globalAlpha = 1; }
    g.save(); g.beginPath(); g.arc(W / 2, 520, 170, 0, Math.PI * 2); g.fillStyle = '#0b0b0d'; g.fill(); g.beginPath(); g.arc(W / 2, 520, 150, 0, Math.PI * 2); g.clip();
    if (av) g.drawImage(av, W / 2 - 150, 370, 300, 300); else { g.fillStyle = cor; g.fillRect(W / 2 - 150, 370, 300, 300); g.fillStyle = '#fff'; g.font = 'bold 140px Segoe UI, sans-serif'; g.textAlign = 'center'; g.fillText(inicial(u.nome), W / 2, 570); }
    g.restore();
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 84px Segoe UI, sans-serif';
    g.fillText(u.nome + (u.verificado ? ' ✔' : ''), W / 2, 790);
    g.fillStyle = '#a3a9b5'; g.font = '44px Segoe UI, sans-serif'; g.fillText('@' + u.usuario, W / 2, 850);
    let y = 950;
    const jogo = jogoDe(u.statusTexto);
    if (jogo) { g.fillStyle = cor; g.font = 'bold 46px Segoe UI, sans-serif'; g.fillText('🎮 Jogando ' + jogo, W / 2, y); y += 80; }
    const v = u.vitrine || {};
    if (v.bio) { g.fillStyle = '#f2f4f8'; g.font = '40px Segoe UI, sans-serif'; g.fillText(v.bio.slice(0, 60), W / 2, y); y += 70; }
    if (v.jogos && v.jogos.length) { g.fillStyle = '#a3a9b5'; g.font = '38px Segoe UI, sans-serif'; g.fillText(v.jogos.slice(0, 4).join(' · '), W / 2, y); }
    g.fillStyle = cor; g.font = 'bold 54px Segoe UI, sans-serif'; g.fillText('KALI', W / 2, H - 110);
    g.fillStyle = '#8b93a3'; g.font = '34px Segoe UI, sans-serif'; g.fillText('me chama lá ✨', W / 2, H - 60);
    let url;
    try { url = cv.toDataURL('image/png'); } catch (e) { return toast('Não deu pra gerar a imagem com essa foto.', 'erro'); }
    abrirModal({ titulo: '🪪 Cartão de jogador', sub: 'Salva e posta no Instagram/TikTok.', corpo: [h('img', { src: url, alt: 'Cartão de ' + u.nome, class: 'cartao-img' }),
      h('a', { class: 'bt prim', href: url, download: 'kali-' + u.usuario + '.png', style: 'display:block;text-align:center;margin-top:8px' }, 'Baixar imagem')] });
  }

  // ---------- status "Ouvindo" ----------
  const ouvindoDe = (t) => { const m = /^🎧\s*(?:ouvindo\s+)?(.+)$/i.exec(t || ''); return m ? m[1].trim() : null; };
  async function definirOuvindo() {
    const musica = prompt('🎧 Ouvindo o quê? (música - artista; vazio = parar)', ouvindoDe(E.eu.statusTexto) || '');
    if (musica === null) return;
    try {
      E.eu = Object.assign(E.eu, await api('PATCH', '/eu', { statusTexto: musica.trim() ? '🎧 Ouvindo ' + musica.trim().slice(0, 60) : '' }));
      toast(musica.trim() ? '🎧 Status atualizado' : 'Status removido', 'ok'); renderSide(); renderMembros();
    } catch (err) { toast(err.message, 'erro'); }
  }
