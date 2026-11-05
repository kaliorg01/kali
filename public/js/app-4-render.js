// KALI — cliente (4/7): Render geral (lateral, painel principal, membros) e mensagens.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

  // ---------- render geral ----------
  function render() { $('#app').classList.toggle('modo-painel', E.modo === 'painel'); renderRail(); renderSide(); renderMain(); renderMembros(); }

  function renderRail() {
    const rail = $('#rail');
    const nDm = E.dms.reduce((t, d) => t + (E.naoLidos[d.canalId] || 0), 0);
    const bDm = h('button', { class: 'srv logo-btn' + (E.modo === 'dm' ? ' ativo' : ''), title: 'Mensagens diretas', onclick: abrirDms }, logo());
    const nAvisos = nDm + E.amigos.recebidos.length;
    if (nAvisos) bDm.append(h('span', { class: 'bad' }, nAvisos > 99 ? '99+' : nAvisos));
    const bPainel = h('button', { class: 'srv painel-btn' + (E.modo === 'painel' ? ' ativo' : ''), title: 'Painel', onclick: abrirPainel }, '▦');
    const itens = [bPainel, bDm, h('div', { class: 'sep' })];
    for (const s of E.servidores) {
      const b = h('button', { class: 'srv' + (E.modo === 'servidor' && s.id === E.servidorId ? ' ativo' : ''), title: s.nome, onclick: () => selecionarServidor(s.id) }, s.icone ? h('img', { class: 'icone-srv', src: s.icone, alt: '' }) : s.sigla || inicial(s.nome));
      const n = naoLidosServidor(s);
      if (n) b.append(h('span', { class: 'bad' }, n > 99 ? '99+' : n));
      aoSegurar(b, (x, y) => menuServidorEm(s, x, y));
      itens.push(b);
    }
    itens.push(h('button', { class: 'srv add', title: 'Criar ou entrar em servidor', onclick: modalServidor }, '+'));
    rail.replaceChildren(...itens);
    const navVelho = document.querySelector('.nav-lateral'); if (navVelho) navVelho.replaceWith(navLateral()); // badges da lateral acompanham o trilho
    atualizarTitulo();
  }

  function linhaCanal(c, s) {
    const icn = c.tipo === 'voz' ? (c.espacial ? '🌌' : c.palco ? ic('mic', 18) : ic('voz', 18)) : c.tipo === 'assistir' ? ic('tv', 18) : c.ticket ? '🎫' : c.comSenha ? ic('cadeado', 18) : c.soStaff ? ic('megafone', 18) : c.forum ? ic('balao', 18) : ic('hash', 18);
    const n = E.naoLidos[c.id] || 0, men = E.mencoes[c.id] || 0;
    const b = h('button', { class: 'canal' + (c.id === E.canalId ? ' ativo' : '') + (n ? ' nao-lido' : ''), onclick: () => abrirCanal(c.id) },
      h('span', { class: 'ic' }, icn), h('span', { class: 'nm' }, c.nome),
      men ? h('span', { class: 'n mencao' }, '@' + men) : n ? h('span', { class: 'n' }, n > 99 ? '99+' : n) : null);
    const linha = h('div', { class: 'canal-linha', 'data-cid': c.id }, b);
    if (souStaffEm(s.id) && c.servidorId && !c.paiCanal) arrastavel(linha, c, s);
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

  // Arrastar e soltar canais pra mudar a ordem/categoria (staff). Salva no servidor e aparece ao vivo pra todo mundo.
  let canalArrastado = null;
  function arrastavel(linha, c, s) {
    linha.draggable = true;
    linha.ondragstart = (e) => { canalArrastado = c; linha.classList.add('arrastando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'canal'); } catch (er) {} };
    linha.ondragend = () => { canalArrastado = null; linha.classList.remove('arrastando'); document.querySelectorAll('.alvo-cima,.alvo-baixo').forEach((x) => x.classList.remove('alvo-cima', 'alvo-baixo')); };
    const lado = (e) => { const r = linha.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 ? 'cima' : 'baixo'; };
    linha.ondragover = (e) => {
      if (!canalArrastado || canalArrastado.id === c.id) return;
      e.preventDefault();
      const l = lado(e);
      linha.classList.toggle('alvo-cima', l === 'cima'); linha.classList.toggle('alvo-baixo', l === 'baixo');
    };
    linha.ondragleave = () => linha.classList.remove('alvo-cima', 'alvo-baixo');
    linha.ondrop = async (e) => {
      if (!canalArrastado || canalArrastado.id === c.id) return;
      e.preventDefault();
      const movido = canalArrastado, depois = lado(e) === 'baixo';
      const lista = s.canais.filter((x) => !x.paiCanal && x.id !== movido.id).sort((a, b) => a.posicao - b.posicao || a.id - b.id);
      lista.splice(lista.indexOf(c) + (depois ? 1 : 0), 0, movido);
      const ordem = lista.map((x) => ({ id: x.id, categoria: x === movido ? c.categoria || null : x.categoria || null }));
      aplicarOrdem(s.id, ordem.map((o, i) => ({ ...o, posicao: i })));
      try { await api('PATCH', `/servidores/${s.id}/canais/ordem`, { ordem }); } catch (err) { toast(err.message, 'erro'); }
    };
  }
  function aplicarOrdem(servidorId, ordem) {
    const s = E.servidores.find((x) => x.id === servidorId);
    if (!s) return;
    for (const o of ordem) { const c = s.canais.find((x) => x.id === o.id); if (c) { c.posicao = o.posicao; c.categoria = o.categoria; } }
    s.canais.sort((a, b) => a.posicao - b.posicao || a.id - b.id);
    if (s.id === E.servidorId) renderSide();
  }
  function renderSide() {
    const side = $('#side');
    const partes = [];
    const topoNav = navLateral();
    if (E.modo === 'painel') partes.push(...sidePainel());
    else if (E.modo === 'dm') {
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
        h('button', { class: 'icbtn', title: 'Atividades (jogo da velha, bolha flutuante)', onclick: (e) => menuAtividades(e.currentTarget) }, '🎮'),
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
    const sv = servidorAtual();
    let primeiraVez = true;
    try { if (!ler('kali-destaque-visto')) salvar('kali-destaque-visto', '1'), sessionStorage.setItem('kali-destaque-sessao', '1'); primeiraVez = sessionStorage.getItem('kali-destaque-sessao') === '1'; } catch (e) {}
    const destaque = ler('kali-destaque-fechado') === '1' || !primeiraVez ? null : h('div', { class: 'card-destaque' },
      h('button', { class: 'fechar', title: 'Esconder', onclick: () => { salvar('kali-destaque-fechado', '1'); renderSide(); } }, '✕'),
      h('b', {}, sv ? '🚀 Chama a galera' : '📱 KALI no celular'),
      h('small', {}, sv ? 'Manda o convite de ' + sv.nome + ' pros amigos.' : 'Baixa o app e transmite a tela do celular.'),
      sv ? h('button', { class: 'bt', onclick: modalConvite }, 'Convidar') : h('a', { class: 'bt', href: LINK_APK }, 'Baixar app'));
    partes.push(h('div', { class: 'painel-pe' }, destaque, vozPainel, h('div', { class: 'side-pe' }, eu,
      h('button', { class: 'icbtn' + (ev.mudo ? ' desligado' : ''), title: ev.mudo ? 'Ativar microfone' : 'Silenciar microfone', 'aria-pressed': String(!!ev.mudo), onclick: () => Voz.alternarMudo() }, ic(ev.mudo ? 'micOff' : 'mic')),
      h('button', { class: 'icbtn' + (ev.surdo ? ' desligado' : ''), title: ev.surdo ? 'Ativar áudio' : 'Desativar áudio', 'aria-pressed': String(!!ev.surdo), onclick: () => Voz.alternarSurdo() }, ic(ev.surdo ? 'foneOff' : 'fone')),
      h('button', { class: 'icbtn', title: 'Configurações', onclick: () => configUsuario() }, ic('engrenagem')))));
    side.replaceChildren(topoNav, ...partes);
  }

  function renderMain() {
    const main = $('#main');
    if (E.modo === 'painel') return renderPainel(main);
    if (E.modo === 'servidor' && E.verVisao) return renderVisao(main);
    if (E.modo === 'servidor' && E.verApostas) return renderApostas(main);
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
    msgs.addEventListener('scroll', () => {
      if (msgs.scrollTop < 80) carregarAntigas();
      if (E.foraDoFim === c.id && msgs.scrollTop + msgs.clientHeight > msgs.scrollHeight - 120) carregarNovas(c.id);
    }, { passive: true });

    const ta = h('textarea', { rows: 1, maxlength: 2000, placeholder: (c.dm ? 'Conversar com @' + c.dm.outro.usuario : 'Conversar em #' + c.nome) + (c.modoLento ? ` · 🐢 modo lento: ${RLENTO.find((x) => x[0] === c.modoLento)?.[1] || c.modoLento + 's'}` : '') });
    ta.value = E.rascunho.get(c.id) || '';
    const travado = c.soStaff && c.servidorId && !souStaffEm(c.servidorId);
    if (travado) { ta.disabled = true; ta.placeholder = '📢 Canal de anúncios: só a staff posta aqui'; }
    else if (c.forum) ta.placeholder = '💬 Novo post: escreve o título e o texto (cada post ganha uma discussão)';
    let ultimoDigitando = 0;
    const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; };
    ta.oninput = () => {
      E.rascunho.set(c.id, ta.value);
      ajustar();
      if (ta.value && Date.now() - ultimoDigitando > 2000) { ultimoDigitando = Date.now(); sock && sock.emit('digitando', { canalId: c.id }); }
    };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(c.id, ta); } };
    const emoji = h('button', { class: 'icbtn', type: 'button', title: 'Emoji' }, ic('sorriso'));
    const bGif = h('button', { class: 'icbtn bt-gif', type: 'button', title: 'GIFs favoritos' }, 'GIF');
    const bEnviar = h('button', { class: 'enviar', title: 'Enviar (botão direito ou segurar: agendar)', onclick: () => enviar(c.id, ta) }, ic('enviar', 17));
    aoSegurar(bEnviar, (x, y) => menuAgendar(c, ta, x, y));
    bGif.onclick = () => menuGifs(bGif, c.id, ta);
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
      item('🧸 Figurinha', () => abrirMenu(bAnexo, [h('div', { class: 'sec-menu' }, 'Figurinhas'), h('div', { class: 'grade-fig' }, FIGURINHAS.map((f) => h('button', { type: 'button', class: 'anim-' + (FIGURINHAS.indexOf(f) % 4), onclick: () => { fecharMenu(); ta.value = '/fig ' + f; enviar(c.id, ta); } }, f)))])),
      item('🔊 Mensagem falada (/tts)', () => { ta.value = '/tts '; ta.oninput(); ta.focus(); }),
    ]);
    ta.addEventListener('paste', (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); enviarVarios(fs); } });
    const compositor = h('div', { class: 'compositor' }, h('div', { class: 'col' },
      h('div', { class: 'digitando', id: 'digitando' }),
      h('div', { class: 'respondendo', id: 'respondendo', hidden: true }),
      h('div', { class: 'caixa' }, bAnexo, arq, ta, info, bGif, emoji, bGrav, bEnviar),
      h('div', { class: 'dica' }, '@usuario menciona · /time 5 Valorant · /confete /fogo /explosao /terremoto /neon /arcoiris')));
    main.replaceChildren(topo, c.tipo === 'assistir' ? h('section', { class: 'palco', id: 'palco' }) : '', painelFilaCanal(c), msgs, compositor);
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
      else if (t[0] === '@') frag.append(h('span', { class: 'men' + (t.toLowerCase() === eu ? ' eu' : /^@(todos|aqui)$/i.test(t) ? ' todos' : '') }, t));
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
  // GIFs/imagens favoritos (neste aparelho): reenviados como arquivo novo, então funcionam em qualquer canal.
  const gifsFav = () => { try { return JSON.parse(ler('kali-gifs') || '[]'); } catch (e) { return []; } };
  function alternarFav(a) {
    let l = gifsFav();
    if (l.some((g) => g.url === a.url)) { l = l.filter((g) => g.url !== a.url); toast('Tirado dos favoritos', 'ok'); }
    else { l.unshift({ url: a.url, nome: a.nome, tipo: a.tipo }); l = l.slice(0, 60); toast('⭐ Salvo nos favoritos (botão GIF na caixa de mensagem)', 'ok'); }
    salvar('kali-gifs', JSON.stringify(l));
  }
  function menuGifs(botao, canalId, ta) {
    const l = gifsFav();
    abrirMenu(botao, [h('div', { class: 'sec-menu' }, 'GIFs e imagens favoritos'),
      l.length ? h('div', { class: 'grade-gifs' }, l.map((g) => {
        const b = h('button', { type: 'button', class: 'gif-fav', title: 'Enviar · clique direito tira dos favoritos' }, h('img', { src: g.url, alt: g.nome || 'gif', loading: 'lazy' }));
        b.onclick = async () => {
          fecharMenu();
          try {
            const blob = await fetch(g.url).then((x) => { if (!x.ok) throw new Error('Esse favorito não está mais disponível.'); return x.blob(); });
            await enviarArquivo(canalId, new File([blob], g.nome || 'gif.gif', { type: g.tipo || blob.type }), ta);
          } catch (err) { toast(err.message, 'erro'); }
        };
        b.oncontextmenu = (e) => { e.preventDefault(); alternarFav(g); fecharMenu(); };
        return b;
      })) : h('p', { class: 'vazio-gifs' }, 'Nenhum favorito ainda. Em qualquer GIF ou imagem do chat: botão direito (ou segurar) → ⭐ Salvar nos favoritos.')], 'menu-gifs');
  }
  // Bloqueados e canais silenciados ficam só neste navegador.
  const listaLocal = (k) => { try { return JSON.parse(ler(k) || '[]'); } catch (e) { return []; } };
  // Bloqueios ficam no servidor (valem em qualquer aparelho).
  const bloqueado = (uid) => E.bloqueados.has(uid);
  async function carregarBloqueios() {
    try {
      // migração única: o que estava bloqueado só neste navegador vai pro servidor
      for (const id of listaLocal('kali-bloqueados')) await api('POST', '/bloqueios', { usuarioId: id }).catch(() => {});
      try { localStorage.removeItem('kali-bloqueados'); } catch (e) {}
      E.bloqueados = new Map((await api('GET', '/bloqueios')).map((u) => [u.id, u]));
    } catch (e) {}
  }
  async function alternarBloqueio(u) {
    try {
      if (E.bloqueados.has(u.id)) { await api('DELETE', '/bloqueios/' + u.id); E.bloqueados.delete(u.id); toast(u.nome + ' desbloqueado', 'ok'); }
      else { await api('POST', '/bloqueios', { usuarioId: u.id }); E.bloqueados.set(u.id, u); toast(`🚫 ${u.nome} bloqueado: some das suas DMs e as mensagens ficam escondidas`, 'ok'); carregarAmigos(); }
      renderLista(); if (E.telaAmigos) renderMain();
    } catch (err) { toast(err.message, 'erro'); }
  }
  const silenciado = (canalId) => {
    if (listaLocal('kali-silenciados').includes(canalId)) return true;
    const c = acharCanal(canalId);
    if (c && c.servidorId && nivelNotif(c.servidorId) === 'nada') return true;
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
    const ehMinha = !!(m.autor && E.eu && m.autor.id === E.eu.id && !m.webhook && !m.sistema);
    const div = h('div', { class: 'msg' + (agrupada ? ' agrupada' : '') + (mencionaEu(m) ? ' mencao' : '') + (ehMinha ? ' minha' : ' dele'), 'data-id': m.id });
    if (agrupada) div.append(h('span', { class: 'lado' }, hora(m.criadoEm)));
    else if (m.sistema || !m.autor) div.append(h('div', { class: 'av ia' }, logo()));
    else div.append(avatar(m.autor));
    const corpo = h('div', { class: 'corpo' });
    if (!agrupada) {
      if (m.webhook) corpo.append(h('b', { class: 'autor' }, m.webhook), h('span', { class: 'tag' }, 'BOT'));
      else if (m.sistema || !m.autor) corpo.append(h('b', { class: 'nome-ia' }, 'KALI'), h('span', { class: 'tag' }, 'IA'));
      else {
        const dono = s && s.donoId === m.autor.id, cor = s && !dono ? corCargo(s.id, m.autor.id) : null;
        const anim = s && !dono && !m.autor.corNome && cor && cargoAnimado(s.id, m.autor.id);
        const ouro = s && E.top1 && E.top1.get(s.id) === m.autor.id, glitch = m.autor.efeito === 'glitch';
        corpo.append(h('b', { class: 'autor' + (dono && !m.autor.corNome ? ' nome-dono' : '') + (anim ? ' nome-cargo-anim' : '') + (ouro ? ' nome-ouro' : '') + (glitch ? ' nome-glitch' : ''), 'data-nome': m.autor.nome, title: ouro ? '🏆 Top 1 do ranking' : null, style: anim ? `--c:${cor}` : estiloNome(m.autor.corNome) || (cor ? `color:${cor}` : null) }, m.autor.nome), seloVerif(m.autor) || '');
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
    } else if (m.texto && RE_FIG.test(m.texto)) {
      const f = RE_FIG.exec(m.texto)[1];
      corpo.append(h('div', { class: 'figurinha anim-' + (FIGURINHAS.indexOf(f) % 4), title: 'Figurinha' }, f));
    } else if (m.texto && RE_TTS.test(m.texto)) {
      const t = m.texto.replace(RE_TTS, '');
      corpo.append(h('div', { class: 'texto' }, h('button', { class: 'tag-tts', title: 'Ouvir de novo', onclick: () => falarTexto(t) }, '🔊 '), formatarRico(t)));
    } else if (m.texto) {
      const ef = efeitoDe(m.texto);
      const tx = h('div', { class: 'texto' + (ef === 'neon' ? ' tx-neon' : ef === 'arcoiris' ? ' tx-arcoiris' : ef === 'terremoto' ? ' tx-terremoto' : '') }, ef ? h('span', { class: 'tag-efeito' }, EFEITOS[ef][0] + ' ') : null, formatarRico(ef ? m.texto.replace(RE_EFEITO, '') : m.texto));
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
    else if (c && c.forum && m.texto && !m.sistema) corpo.append(h('button', { class: 'selo-topico', onclick: async () => {
      try { const t = await api('POST', `/mensagens/${m.id}/topico`, { nome: corta(m.texto.split('\n')[0], 40) }); aoCanalNovo(t); abrirCanal(t.id); } catch (err) { toast(err.message, 'erro'); }
    } }, '💬 Abrir discussão'));
    if (c && c.forum && !m.sistema) div.classList.add('post-forum');
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
        m.texto && !/\b(que|não|nao|pra|você|voce|com|uma|tá|ta|eu|de|é)\b/i.test(m.texto) ? item('🌐 Traduzir', () => traduzir(m, document.querySelector(`.msg[data-id="${m.id}"] .texto`) || document.querySelector(`.msg[data-id="${m.id}"]`))) : null,
        m.anexo && /^image\//.test(m.anexo.tipo || '') ? item(gifsFav().some((g) => g.url === m.anexo.url) ? '⭐ Tirar dos favoritos' : '⭐ Salvar nos favoritos (GIF/imagem)', () => alternarFav(m.anexo)) : null,
        m.texto ? item('Copiar texto', () => { navigator.clipboard?.writeText(m.texto).then(() => toast('Texto copiado ✓', 'ok')).catch(() => {}); }) : null,
        !minha && s ? item('Denunciar mensagem', () => modalDenuncia(m)) : null,
        minha || (s && (souDono(s) || (souStaffEm(s.id) && nivelDe(s.id, m.autor?.id) < 2))) ? item('Apagar mensagem', () => apagarMsg(m), 'perigo') : null,
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
  async function reagir(id, emoji) { const r = await pedir('msg:reagir', { id, emoji }); if (r.erro) return toast(r.erro, 'erro'); explodirEmoji(emoji, document.querySelector(`.msg[data-id="${id}"]`)); }
  async function apagarMsg(m) {
    if (!confirm('Apagar esta mensagem?')) return;
    const r = await pedir('msg:apagar', { id: m.id });
    if (r.erro) toast(r.erro, 'erro');
  }
