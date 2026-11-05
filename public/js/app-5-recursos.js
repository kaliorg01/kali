// KALI — cliente (5/7): Resumo, digitando, membros, perfil vitrine, missões, áudio, assistir junto, staff, servidores, amigos, loja e cargos.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

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
    const filtros = [];
    for (const [re, k] of [[/(?:^|\s)tem:(imagem|link|arquivo)/i, 'tem'], [/(?:^|\s)antes:(\d{4}-\d{2}-\d{2})/i, 'antes'], [/(?:^|\s)depois:(\d{4}-\d{2}-\d{2})/i, 'depois']]) {
      const mm = re.exec(q); if (mm) { filtros.push(k + '=' + mm[1].toLowerCase()); q = q.replace(mm[0], '').trim(); }
    }
    if (!s || (q.length < 2 && !de && !filtros.length)) return toast('Digita 2 letras ou usa um filtro: de:@fulano tem:imagem tem:link antes:2026-11-01', 'erro');
    let d;
    try { d = await api('GET', `/servidores/${s.id}/busca?q=${encodeURIComponent(q)}${de ? '&de=' + de : ''}${filtros.length ? '&' + filtros.join('&') : ''}&pagina=${pagina}`); } catch (err) { return toast(err.message, 'erro'); }
    const res = d.resultados.map((m) => h('button', { type: 'button', class: 'res-busca', onclick: () => { fecharModal(); irPara(m.id, m.canalId); } },
      h('div', { class: 'rb-topo' }, h('b', {}, m.autor ? m.autor.nome : 'KALI'), h('small', {}, '#' + m.canalNome + ' · ' + new Date(m.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))),
      h('div', { class: 'rb-txt' }, corta(m.texto || '', 220))));
    abrirModal({ titulo: `Busca: “${q}”${de ? ' de @' + de : ''}`, sub: d.resultados.length ? `${d.resultados.length}${d.mais ? '+' : ''} resultado(s) em ${s.nome}. Clica pra ir até a mensagem.` : 'Nada encontrado.',
      corpo: [h('div', { class: 'lista-busca' }, res), d.mais || pagina ? h('div', { class: 'acoes', style: 'justify-content:space-between' },
        pagina ? h('button', { class: 'bt', type: 'button', onclick: () => buscarNoServidor(texto, pagina - 1) }, '← Anteriores') : h('span'),
        d.mais ? h('button', { class: 'bt', type: 'button', onclick: () => buscarNoServidor(texto, pagina + 1) }, 'Mais →') : null) : null] });
  }
  let carregandoNovas = false;
  async function carregarNovas(canalId) {
    const arr = E.msgs.get(canalId);
    if (carregandoNovas || !arr || !arr.length) return;
    carregandoNovas = true;
    try {
      const ult = arr[arr.length - 1].id;
      const novas = (await api('GET', `/canais/${canalId}/mensagens?ao_redor=${ult}`)).filter((m) => m.id > ult);
      arr.push(...novas.filter((m) => !arr.some((x) => x.id === m.id)));
      if (novas.length < 25) E.foraDoFim = null; // chegou no presente
      const box = $('#msgs'), topo = box && box.scrollTop;
      renderLista();
      if (box) box.scrollTop = topo;
    } catch (e) {} finally { carregandoNovas = false; }
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
    el.classList.toggle('ativo', nomes.length > 0);
    el.textContent = !nomes.length ? '' : nomes.length === 1 ? `${nomes[0]} está digitando…`
      : nomes.length <= 3 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} estão digitando…` : 'Várias pessoas estão digitando…';
  }
  setInterval(renderDigitando, 1000);

  // ---------- membros ----------
  function renderMembros() {
    const box = $('#membros');
    const fechar = h('div', { class: 'topo-membros' }, h('span', {}, 'Membros'), h('button', { class: 'icbtn', onclick: alternarMembros }, '✕'));
    const c = canalAtual();
    if (E.modo === 'painel') return box.replaceChildren();
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
    const partes = [fechar].filter(Boolean);
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
    if (!(u && u.bannerImg)) banner.classList.add('banner-vivo');
    const partes = [banner];
    const jogo = u && jogoDe(u.statusTexto);
    const ouv = u && ouvindoDe(u.statusTexto);
    if (ouv) partes.push(h('div', { class: 'sec-perfil' }, 'Ouvindo agora'), h('div', { class: 'jogando-card ouvindo' }, h('span', { class: 'jogando-ic' }, h('span', { class: 'ondas' }, h('i'), h('i'), h('i'), h('i'))), h('div', {}, h('b', {}, ouv), h('small', {}, 'tocando agora'))));
    if (jogo) partes.push(h('div', { class: 'sec-perfil' }, 'Jogando agora'), h('div', { class: 'jogando-card' }, h('span', { class: 'jogando-ic' }, '🎮'), h('div', {}, h('b', {}, jogo), h('small', {}, 'em partida'))));
    if (v.bio) partes.push(h('div', { class: 'sec-perfil' }, 'Sobre mim'), h('p', { class: 'bio' }, v.bio));
    if (v.jogos && v.jogos.length) partes.push(h('div', { class: 'sec-perfil' }, 'Jogos'), h('div', { class: 'jogos' }, v.jogos.map((j) => h('span', { class: 'chip' }, '🎮 ' + j))));
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
    const srvC = servidorAtual();
    const selos = [m.nivel ? h('span', { class: 'selo-perfil', title: 'Nível no servidor' }, '⭐ ' + m.nivel) : null,
      srvC && m.id === srvC.donoId ? h('span', { class: 'selo-perfil', title: 'Dono do servidor' }, '👑') : null,
      m.cargo && m.cargo !== 'dono' && SELO_CARGO[m.cargo] ? h('span', { class: 'selo-perfil', title: m.cargo }, SELO_CARGO[m.cargo]) : null,
      fazAniver(m) ? h('span', { class: 'selo-perfil', title: 'Aniversário hoje' }, '🎂') : null].filter(Boolean);
    const recado = m.statusTexto && !jogoDe(m.statusTexto) && !ouvindoDe(m.statusTexto) ? h('div', { class: 'recado-perfil' }, '💬 ' + m.statusTexto) : null;
    const caixa = h('div', { class: 'caixa-perfil' },
      h('div', { class: 'nome-linha' }, h('h3', {}, m.nome, seloVerif(m)), selos.length ? h('div', { class: 'selos-perfil' }, selos) : null),
      h('small', { class: 'arroba' }, '@' + m.usuario + (m.apelido ? ` (${m.nomeConta})` : '') + ' · ' + st(m.id)[1]), recado, h('hr'), ...extras);
    const conteudo = [banner, h('div', { class: 'av-linha' }, avatar(m, 'av-vitrine', true), efeitoPerfil(m), h('span', { class: 'bolinha-perfil ' + st(m.id)[0], title: st(m.id)[1] })), caixa,
      h('button', { class: 'bt', onclick: () => perfilCompleto(m) }, '👤 Perfil completo')];
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
      conteudo.push(h('button', { class: 'bt', onclick: () => { fecharMenu(); alternarBloqueio(m); } },
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
      if (m.id !== E.eu.id && jogoDe(m.statusTexto)) conteudo.push(h('button', { class: 'bt prim', onclick: () => { fecharMenu(); chamarPraJogar(m, jogoDe(m.statusTexto)); } }, '🎮 Chamar pra jogar ' + jogoDe(m.statusTexto)));
      if (s && E.modo === 'servidor') {
        const meu = nivelDe(s.id, E.eu.id), dele = nivelDe(s.id, m.id);
        if (meu === 4) conteudo.push(h('hr'), ['adm', 'mod', 'membro'].filter((c) => c !== m.cargo).map((c) =>
          h('button', { class: 'bt', onclick: () => { fecharMenu(); moderar(c, m); } }, c === 'membro' ? '⬇️ Tirar cargo' : `${SELO_CARGO[c]} Tornar ${c}`)));
        if (meu >= 2 && meu > dele) conteudo.push(
          h('button', { class: 'bt', onclick: (e) => abrirMenu(e.currentTarget, [h('div', { style: 'padding:6px 10px;color:var(--fraco);font-size:12px' }, `Castigo pra ${m.nome} (não manda mensagem)`),
            [[1, '1 minuto'], [5, '5 minutos'], [10, '10 minutos'], [60, '1 hora'], [1440, '1 dia'], [10080, '1 semana'], [0, 'Tirar castigo']].map(([min, rot]) => item(rot, async () => {
              const motivo = min ? prompt('Motivo do castigo (opcional, fica no registro):') : '';
              if (motivo === null) return;
              try { await api('POST', `/servidores/${servidorAtual().id}/membros/${m.id}/castigo`, { minutos: min, motivo: motivo || '' }); toast(min ? `⏳ ${m.nome} de castigo por ${rot}` : `Castigo de ${m.nome} retirado`, 'ok'); } catch (err) { toast(err.message, 'erro'); }
            }))]) }, '⏳ Castigo'),
          h('button', { class: 'bt', onclick: () => { fecharMenu(); moderar('expulsar', m); } }, '👢 Expulsar'),
          h('button', { class: 'bt perigo', onclick: () => { fecharMenu(); moderar('banir', m); } }, '⛔ Banir'),
          h('button', { class: 'bt', onclick: () => { fecharMenu(); const t = $('.caixa textarea'); if (t) { t.value = `/tribunal @${m.usuario} `; t.oninput(); t.focus(); } } }, '⚖️ Levar ao tribunal'));
      }
    }
    if (m.id !== E.eu.id) {
      const comum = h('div', { class: 'em-comum' });
      conteudo.push(comum);
      api('GET', `/usuarios/${m.id}/comum`).then((d) => {
        const partes = [];
        if (d.servidores.length) partes.push(h('small', {}, `🏠 ${d.servidores.length} servidor${d.servidores.length > 1 ? 'es' : ''} em comum: `, d.servidores.slice(0, 4).map((x) => x.nome).join(', ') + (d.servidores.length > 4 ? '…' : '')));
        if (d.amigos.length) partes.push(h('small', {}, `👥 ${d.amigos.length} amigo${d.amigos.length > 1 ? 's' : ''} em comum: `, d.amigos.slice(0, 4).map((x) => x.nome).join(', ') + (d.amigos.length > 4 ? '…' : '')));
        comum.replaceChildren(...partes);
      }).catch(() => {});
    }
    // botões depois da caixa viram uma grade de ações
    conteudo.push(h('button', { class: 'bt', onclick: () => { fecharMenu(); cartaoJogador(m); } }, '🪪 Cartão de jogador'));
    if (E.eu.admin) conteudo.push(h('button', { class: 'bt', onclick: () => { fecharMenu(); alternarVerificado(m); } }, m.verificado ? 'Tirar ✔' : '✔ Verificar'));
    const fixos = conteudo.slice(0, 3), acoes = conteudo.slice(3).flat().filter((x) => x && x.tagName !== 'HR');
    const emComum = acoes.find((x) => x.classList && x.classList.contains('em-comum'));
    if (emComum) { acoes.splice(acoes.indexOf(emComum), 1); caixa.append(h('div', { class: 'sec-perfil' }, 'Em comum'), emComum); }
    abrirMenu(ancora, [...fixos, h('div', { class: 'acoes-perfil' }, acoes)], 'menu-perfil');
    const menu = document.querySelector('.menu.menu-perfil');
    if (menu) { menu.style.setProperty('--perfil', m.cor || 'var(--roxo)'); parallaxBanner(menu); }
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
    if (quem) quem.replaceChildren(...(e && e.espectadores && e.espectadores.length ? [h('small', {}, '🍿 ' + e.espectadores.length + ' na sala: ' + e.espectadores.map((x) => x.nome).join(', ')), cadeirasCinema(e.espectadores)] : []));
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
        const motivo = prompt(`Expulsar ${m.nome}? Motivo (opcional, fica no registro):`);
        if (motivo === null) return;
        await api('DELETE', `/servidores/${s.id}/membros/${m.id}?motivo=${encodeURIComponent(motivo.slice(0, 300))}`);
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
    jogo: { nome: '🎮 Comunidade de jogo', canais: [['anuncios', 'texto'], ['regras', 'texto'], ['procurando-time', 'texto'], ['clipes', 'texto'], ['Lobby', 'voz'], ['Ranked', 'voz'], ['Assistir partida', 'assistir']] },
    streamer: { nome: '📺 Comunidade de streamer', canais: [['avisos-da-live', 'texto'], ['chat-geral', 'texto'], ['clipes-e-cortes', 'texto'], ['sugestoes', 'texto'], ['Sala VIP', 'voz'], ['Watch party', 'assistir']] },
    apostas: { nome: '🎲 Org de Apostas (Free Fire)', canais: [
      ...['mobile', 'mobilador', 'emulador', 'misto'].flatMap((p) => { const cat = { mobile: '📱 MOBILE', mobilador: '🕹️ MOBILADOR', emulador: '💻 EMULADOR', misto: '🔀 MISTO' }[p]; return [['regras-apostas-' + p, 'texto', cat, { forum: true, soStaff: true }], ...['1x1', '2x2', '3x3', '4x4'].map((m) => [m + '-' + p, 'texto', cat])]; }),
      ['mediadores', 'texto', '🛡️ SEGURANÇA', { soStaff: true }], ['feedback', 'texto', '🛡️ SEGURANÇA'], ['blacklist', 'texto', '🛡️ SEGURANÇA', { soStaff: true }], ['pagamentos', 'texto', '🛡️ SEGURANÇA', { soStaff: true }],
      ['resenha', 'texto', '💬 COMUNIDADE'], ['chat-geral', 'texto', '💬 COMUNIDADE'], ['clips', 'texto', '💬 COMUNIDADE'], ['hall-da-gloria', 'texto', '💬 COMUNIDADE', { soStaff: true }], ['ranking-semanal', 'texto', '💬 COMUNIDADE', { soStaff: true }],
      ['ANÁLISES 1', 'voz', '🧠 ANÁLISES'], ['ANÁLISES 2', 'voz', '🧠 ANÁLISES'], ['ANÁLISES 3', 'voz', '🧠 ANÁLISES']] },
    trabalho: { nome: '💼 Equipe / trabalho', canais: [['avisos', 'texto'], ['tarefas', 'texto'], ['ideias', 'texto'], ['Reunião', 'voz']] },
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
          for (const [n, tipo, categoria, extra] of MODELOS[modelo.value].canais) {
            try {
              let c = await api('POST', `/servidores/${s.id}/canais`, { nome: n, tipo });
              if (categoria || extra) c = await api('PATCH', `/canais/${c.id}/config`, { categoria: categoria || '', ...(extra || {}) }).catch(() => c);
              s.canais.push(c);
            } catch (e) {}
          }
        } else {
          const cod = codigoDoConvite(codigo.value);
          if (!cod) throw new Error('Cola o código do convite.');
          s = await api('POST', '/convites/' + encodeURIComponent(cod));
        }
        if (aba === 'criar' && modelo.value === 'apostas') {
          try {
            const ids = [];
            for (const [n, cor] of [['Free Fire', '#f97316'], ['Valorant', '#ef4444'], ['GTA RP', '#22c55e']]) ids.push((await api('POST', `/servidores/${s.id}/cargos`, { nome: n, cor })).id);
            const canaisFF = s.canais.filter((c) => /-(mobile|mobilador|emulador|misto)$/.test(c.nome)).map((c) => c.id);
            await api('PUT', `/cargos/${ids[0]}/canais`, { canalIds: canaisFF });
            await api('PUT', `/servidores/${s.id}/boas-vindas`, { texto: 'Bem-vindo à org! Escolhe seus jogos pra liberar as filas.', regras: 'Sem golpe: não pagou, blacklist\nRespeita o adm da sala\nPrint de tudo no chat da sala\nProibido hack, macro e painel', cargos: ids });
          } catch (e) { /* org criada mesmo assim */ }
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
  const LINK_APK = 'https://github.com/kaliorg01/kali/releases/latest/download/KALI.apk';
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
  function conviteCustom(s) {
    const val = h('select', { 'aria-label': 'Validade' }, [[null, 'Nunca expira'], [30, '30 minutos'], [60, '1 hora'], [360, '6 horas'], [720, '12 horas'], [1440, '1 dia'], [10080, '7 dias']].map(([v, t]) => h('option', { value: v ?? '' }, t)));
    const usos = h('select', { 'aria-label': 'Limite de usos' }, [[null, 'Sem limite de usos'], [1, '1 uso'], [5, '5 usos'], [10, '10 usos'], [25, '25 usos'], [100, '100 usos']].map(([v, t]) => h('option', { value: v ?? '' }, t)));
    const out = h('div', { class: 'convite convite-link', hidden: true });
    const gerar = h('button', { class: 'bt', type: 'button' }, 'Gerar');
    gerar.onclick = async () => {
      try {
        const d = await api('POST', `/servidores/${s.id}/convites`, { expiraMin: val.value ? Number(val.value) : null, maxUsos: usos.value ? Number(usos.value) : null });
        const l = LINK_CONVITE + d.codigo;
        const cp = h('button', { class: 'bt prim', type: 'button', onclick: () => navigator.clipboard?.writeText(l).then(() => { cp.textContent = 'Copiado ✓'; }).catch(() => {}) }, 'Copiar');
        out.replaceChildren(h('code', {}, l), cp); out.hidden = false;
      } catch (err) { toast(err.message, 'erro'); }
    };
    return h('details', { class: 'convite-custom' }, h('summary', {}, 'Link com validade ou limite de usos'), h('div', { class: 'linha-form' }, val, usos, gerar), out);
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
        conviteCustom(s),
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
    const marca = (rot, on) => { const i = h('input', { type: 'checkbox' }); i.checked = !!on; return [i, h('label', { class: 'check-cfg' }, i, ' ', rot)]; };
    const [cAnun, lAnun] = marca('📢 Canal de anúncios (só a staff posta)', c.soStaff);
    const [cForum, lForum] = marca('💬 Fórum (cada mensagem vira um post com discussão própria)', c.forum);
    const [cPalco, lPalco] = marca('🎤 Palco (só fala quem a staff der a vez; plateia levanta a mão)', c.palco);
    const [cEspera, lEspera] = marca('🚪 Sala de espera (a staff aceita quem entra na call)', c.salaEspera);
    const extras = c.tipo === 'voz' ? [lPalco, lEspera] : c.tipo === 'texto' ? [lAnun, lForum] : [];
    abrirModal({ titulo: 'Editar canal', sub: (c.tipo === 'texto' ? '# ' : '') + c.nome, corpo: [cat.campo, campo('🐢 Modo lento (cada pessoa espera entre mensagens)', lento), ...extras,
      c.tipo === 'texto' ? h('button', { type: 'button', class: 'bt', style: 'margin:6px 0 10px', onclick: () => modalWebhooks(c) }, '🤖 Webhooks (bots e alertas)') : null], botao: 'Salvar',
      acao: async () => {
        await api('PATCH', `/canais/${c.id}/config`, { categoria: cat.input.value.trim(), modoLento: Number(lento.value), soStaff: cAnun.checked, forum: cForum.checked, palco: cPalco.checked, ...(c.tipo === 'voz' ? { salaEspera: cEspera.checked } : {}) });
        Object.assign(c, { salaEspera: c.tipo === 'voz' && cEspera.checked, soStaff: c.tipo === 'texto' && cAnun.checked, forum: c.tipo === 'texto' && cForum.checked, palco: c.tipo === 'voz' && cPalco.checked });
        renderSide(); if (c.id === E.canalId) renderMain();
        toast('Canal atualizado ✓', 'ok');
      } });
  }
  // ---------- agendar mensagem ----------
  async function agendar(c, ta, quando) {
    const texto = ta.value.trim();
    if (!texto) return toast('Escreve a mensagem primeiro.', 'erro');
    const r = await pedir('msg:agendar', { canalId: c.id, texto, enviarEm: quando });
    if (r.erro) return toast(r.erro, 'erro');
    ta.value = ''; ta.oninput && ta.oninput();
    toast('⏰ Agendada pra ' + new Date(quando).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), 'ok');
  }
  function menuAgendar(c, ta, x, y) {
    const d = new Date(), as = (hh) => { const t = new Date(); t.setHours(hh, 0, 0, 0); if (t <= d) t.setDate(t.getDate() + 1); return t.getTime(); };
    const amanha9 = new Date(); amanha9.setDate(amanha9.getDate() + 1); amanha9.setHours(9, 0, 0, 0);
    abrirMenu(pontoEm(x, y), [h('div', { class: 'sec-menu' }, '⏰ Enviar depois'),
      item('Daqui 1 hora', () => agendar(c, ta, Date.now() + 3600e3)),
      item('Daqui 3 horas', () => agendar(c, ta, Date.now() + 3 * 3600e3)),
      item('Às 20h', () => agendar(c, ta, as(20))),
      item('Amanhã às 9h', () => agendar(c, ta, amanha9.getTime())),
      item('Escolher dia e hora…', () => {
        const q = h('input', { type: 'datetime-local' });
        abrirModal({ titulo: 'Agendar mensagem', corpo: [campo('Quando', q)], botao: 'Agendar', acao: async () => { const t = new Date(q.value).getTime(); if (!t) throw new Error('Escolhe a data e a hora.'); await agendar(c, ta, t); } });
      }),
      h('hr'), item('Minhas agendadas', modalAgendadas)]);
  }
  async function modalAgendadas() {
    let l = [];
    try { l = await api('GET', '/eu/agendadas'); } catch (err) { return toast(err.message, 'erro'); }
    abrirModal({ titulo: '⏰ Mensagens agendadas', sub: l.length ? 'Saem sozinhas no horário.' : 'Nenhuma agendada. Botão direito (ou segurar) no enviar pra agendar.',
      corpo: [h('div', { class: 'lista-busca' }, l.map((a) => h('div', { class: 'res-busca' },
        h('div', { class: 'rb-topo' }, h('b', {}, '#' + a.canal + (a.servidor ? ' · ' + a.servidor : '')), h('small', {}, new Date(a.enviarEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))),
        h('div', { class: 'rb-txt' }, corta(a.texto, 200)),
        h('div', {}, h('button', { class: 'bt perigo', type: 'button', onclick: async (e) => { const r = await pedir('msg:desagendar', { id: a.id }); if (r.erro) return toast(r.erro, 'erro'); e.currentTarget.closest('.res-busca').remove(); toast('Agendada cancelada', 'ok'); } }, 'Cancelar')))))] });
  }
  async function modalWebhooks(c) {
    let lista = [];
    try { lista = await api('GET', `/canais/${c.id}/webhooks`); } catch (err) { return toast(err.message, 'erro'); }
    const nome = h('input', { maxlength: 32, placeholder: 'ex: Alerta da live' });
    const saida = h('div', {});
    abrirModal({ titulo: '🤖 Webhooks de #' + c.nome, sub: 'Programas e sites mandam mensagem neste canal sem estar no app (ex: aviso de live, bot de jogo).',
      corpo: [h('div', { class: 'lista-busca' }, lista.length ? lista.map((w) => h('div', { class: 'res-busca' }, h('div', { class: 'rb-topo' }, h('b', {}, '🤖 ' + w.nome),
        h('button', { class: 'bt perigo', type: 'button', onclick: async (e) => { try { await api('DELETE', '/webhooks/' + w.id); e.currentTarget.closest('.res-busca').remove(); } catch (err) { toast(err.message, 'erro'); } } }, 'Apagar'))))
        : h('p', { class: 'sub' }, 'Nenhum webhook ainda.')), campo('Nome do novo webhook', nome), saida],
      botao: 'Criar webhook',
      acao: async () => {
        const d = await api('POST', `/canais/${c.id}/webhooks`, { nome: nome.value.trim() });
        const url = location.origin + d.caminho;
        saida.replaceChildren(h('p', { class: 'sub' }, '✅ Criado! Copia o link agora (ele não aparece de novo). Pra postar: POST nesse link com {"texto":"sua mensagem"}.'),
          h('div', { class: 'convite convite-link' }, h('code', {}, url), h('button', { class: 'bt prim', type: 'button', onclick: () => navigator.clipboard?.writeText(url).then(() => toast('Link copiado ✓', 'ok')) }, 'Copiar')));
        throw new Error('Copia o link acima ☝️'); // mantém o modal aberto
      } });
  }
  // Criar canal igual ao Discord: lista de tipos com rádio, nome com o ícone do tipo na frente e "Canal privado" com cargos.
  const TIPOS_CANAL = [
    { id: 'texto', ic: '#', nome: 'Texto', desc: 'Mande mensagens, imagens, GIFs, emojis, opiniões e piadas', base: 'texto' },
    { id: 'voz', ic: '🔊', nome: 'Voz', desc: 'Converse por voz, vídeo e compartilhe a tela', base: 'voz' },
    { id: 'forum', ic: '💬', nome: 'Fórum', desc: 'Crie um espaço organizado pra discussões em posts', base: 'texto', cfg: { forum: true } },
    { id: 'anuncios', ic: '📢', nome: 'Anúncios', desc: 'Avisos importantes: só a staff posta, todo mundo lê', base: 'texto', cfg: { soStaff: true } },
    { id: 'palco', ic: '🎤', nome: 'Palco', desc: 'Eventos com plateia: só fala quem a staff liberar', base: 'voz', cfg: { palco: true } },
    { id: 'assistir', ic: '🍿', nome: 'Assistir junto', desc: 'YouTube ou vídeo sincronizado com a galera', base: 'assistir' },
    { id: 'sala3d', ic: '🌌', nome: 'Sala 3D', desc: 'Voz com áudio espacial: anda no mapa e ouve quem tá perto', base: 'voz', espacial: true },
  ];
  async function modalCanal(tipoInicial, categoriaInicial) {
    const s = servidorAtual();
    if (!s) return;
    let tipo = TIPOS_CANAL.find((t) => t.id === tipoInicial) ? tipoInicial : 'texto';
    const prefixo = h('span', { class: 'prefixo-canal' }, '#');
    const nome = h('input', { maxlength: 30, placeholder: 'novo-canal', 'aria-label': 'Nome do canal' });
    const linhas = TIPOS_CANAL.map((t) => {
      const b = h('button', { type: 'button', class: 'tipo-canal', role: 'radio', 'data-t': t.id },
        h('span', { class: 'tc-ic' }, t.ic), h('span', { class: 'tc-txt' }, h('b', {}, t.nome), h('small', {}, t.desc)), h('span', { class: 'tc-radio' }));
      b.onclick = () => { tipo = t.id; marcar(); nome.focus(); };
      return b;
    });
    const marcar = () => {
      const t = TIPOS_CANAL.find((x) => x.id === tipo);
      linhas.forEach((b) => { const on = b.dataset.t === tipo; b.classList.toggle('ativa', on); b.setAttribute('aria-checked', String(on)); });
      prefixo.textContent = t.ic;
      nome.placeholder = t.base === 'texto' ? 'novo-canal' : t.base === 'voz' ? 'Sala da galera' : 'Cinema';
      if (t.base === 'texto') nome.value = nome.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      senhaLinha.hidden = t.base !== 'texto';
    };
    nome.oninput = () => { if (TIPOS_CANAL.find((x) => x.id === tipo).base === 'texto') nome.value = nome.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); };
    // canal privado (só cargos escolhidos + staff)
    let cargos = [];
    try { cargos = await api('GET', `/servidores/${s.id}/cargos`); } catch (e) {}
    const escolhidos = new Set();
    const listaCargos = h('div', { class: 'lista-check', hidden: true }, cargos.length ? cargos.map((c) => {
      const cb = h('input', { type: 'checkbox' }); cb.onchange = () => { if (cb.checked) escolhidos.add(c.id); else escolhidos.delete(c.id); };
      return h('label', { class: 'check-amigo' }, cb, h('span', { style: 'color:' + c.cor }, '● '), c.nome);
    }) : h('small', {}, 'Sem cargos ainda: o canal fica só pra staff. Crie cargos em Configurações do servidor.'));
    const priv = h('input', { type: 'checkbox', class: 'chave-input' });
    priv.onchange = () => { listaCargos.hidden = !priv.checked; };
    const linhaPriv = h('label', { class: 'linha-privado' }, h('span', { class: 'lp-ic' }, '🔒'), h('span', { class: 'lp-txt' }, h('b', {}, 'Canal privado'), h('small', {}, 'Só os cargos escolhidos (e a staff) vão ver este canal.')), priv);
    const senhaCanal = h('input', { type: 'password', maxlength: 64, placeholder: 'Deixe vazio pra canal aberto' });
    const senhaLinha = campo('🔑 Senha do canal (opcional)', senhaCanal);
    const cat = campoCategoria(s, categoriaInicial || '');
    const f = abrirModal({ titulo: 'Criar canal', sub: categoriaInicial ? 'em ' + categoriaInicial : 'em ' + s.nome, corpo: [
      h('div', { class: 'sec-menu' }, 'Tipo de canal'), h('div', { class: 'tipos-canal', role: 'radiogroup' }, linhas),
      h('div', { class: 'sec-menu' }, 'Nome do canal'), h('div', { class: 'nome-canal-campo' }, prefixo, nome),
      cat.campo, linhaPriv, listaCargos, senhaLinha], botao: 'Criar canal',
      acao: async () => {
        const t = TIPOS_CANAL.find((x) => x.id === tipo);
        const corpo = { nome: nome.value.trim(), tipo: t.base };
        if (cat.input.value.trim()) corpo.categoria = cat.input.value.trim();
        if (t.espacial) corpo.espacial = true;
        if (t.base === 'texto' && senhaCanal.value) corpo.senha = senhaCanal.value;
        const c = await api('POST', `/servidores/${s.id}/canais`, corpo);
        if (t.cfg) { try { Object.assign(c, await api('PATCH', `/canais/${c.id}/config`, t.cfg)); } catch (e) { toast(e.message, 'erro'); } }
        if (priv.checked) {
          for (const cg of cargos.filter((x) => escolhidos.has(x.id))) await api('PUT', `/cargos/${cg.id}/canais`, { canalIds: [...cg.canais, c.id] }).catch(() => {});
          if (!escolhidos.size) await api('PATCH', `/canais/${c.id}/config`, { privado: true }).catch(() => {});
          carregarCargos(s.id).catch(() => {});
        }
        aoCanalNovo(c);
        if (c.tipo !== 'voz') abrirCanal(c.id);
      } });
    f.classList.add('modal-criar-canal');
    marcar();
  }
  function modalCategoria() {
    const s = servidorAtual();
    if (!s) return;
    const nome = h('input', { maxlength: 30, placeholder: 'NOVA CATEGORIA', 'aria-label': 'Nome da categoria' });
    nome.oninput = () => { nome.value = nome.value.toUpperCase(); };
    abrirModal({ titulo: 'Criar categoria', sub: 'Categorias juntam canais (ex.: JOGOS, ESTUDO). Já cria um canal de texto dentro dela.', corpo: [h('div', { class: 'sec-menu' }, 'Nome da categoria'), h('div', { class: 'nome-canal-campo' }, h('span', { class: 'prefixo-canal' }, '📁'), nome)], botao: 'Criar categoria',
      acao: async () => {
        const n = nome.value.trim();
        if (!n) throw new Error('Dá um nome pra categoria.');
        const c = await api('POST', `/servidores/${s.id}/canais`, { nome: 'geral-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'geral', tipo: 'texto', categoria: n });
        aoCanalNovo(c);
        toast('📁 Categoria ' + n + ' criada', 'ok');
      } });
  }
  async function apagarCanal(c) {
    if (!confirm(`Apagar o canal "${c.nome}"? Todas as mensagens somem.`)) return;
    try { await api('DELETE', '/canais/' + c.id); aoCanalApagado({ id: c.id, servidorId: c.servidorId }); } catch (err) { toast(err.message, 'erro'); }
  }
  async function modalAutomod(s) {
    let lista = [];
    try { lista = (await api('GET', `/servidores/${s.id}/automod`)).palavras; } catch (err) { return toast(err.message, 'erro'); }
    const ta = h('textarea', { class: 'campo', rows: 8, placeholder: 'uma palavra ou frase por linha', style: 'width:100%;resize:vertical' });
    ta.value = lista.join('\n');
    const cfg = await api('GET', `/servidores/${s.id}/automod`).catch(() => ({}));
    const ckLinks = h('input', { type: 'checkbox', checked: cfg.links || null }), ckSpam = h('input', { type: 'checkbox', checked: cfg.spam || null });
    abrirModal({ titulo: '🛡️ AutoMod', sub: 'Mensagens com essas palavras são barradas antes de chegar no chat (acento e maiúscula não importam). A staff não é filtrada.',
      corpo: [h('label', { class: 'check-amigo' }, ckLinks, ' 🔗 Bloquear links (staff pode)'), h('label', { class: 'check-amigo' }, ckSpam, ' 🚫 Segurar spam (mensagem repetida ou rajada)'), h('div', { class: 'sec-menu' }, 'Palavras bloqueadas'), ta], botao: 'Salvar', acao: async () => {
        const r = await api('PUT', `/servidores/${s.id}/automod`, { palavras: ta.value.split('\n'), links: ckLinks.checked, spam: ckSpam.checked });
        toast(`🛡️ AutoMod: ${r.palavras.length} bloqueada(s)`, 'ok');
      } });
  }
  function menuServidor(ancora) {
    const s = servidorAtual();
    if (!s) return;
    // Mesma ordem do menu do servidor no Discord.
    const srvMudo = listaLocal('kali-srv-silenciados').includes(s.id);
    const extras = arguments[1] ? [item('Marcar tudo como lido', () => { s.canais.forEach((c) => { if (E.naoLidos[c.id]) marcarLido(c.id); }); renderSide(); renderRail(); })] : [];
    const nv = nivelNotif(s.id);
    const itens = [item('Convidar pessoas', modalConvite),
      item('🔔 Notificações: ' + { todas: 'todas as mensagens', mencoes: 'só @menções', nada: 'nada' }[nv], () => abrirMenu(ancora, [h('div', { class: 'sec-menu' }, 'Notificações de ' + s.nome),
        [['todas', 'Todas as mensagens'], ['mencoes', 'Só @menções'], ['nada', 'Nada']].map(([v, t]) => item((nv === v ? '✓ ' : '') + t, () => { definirNivelNotif(s.id, v); renderRail(); toast('Notificações: ' + t, 'ok'); }))])),
      item(srvMudo ? '🔔 Reativar avisos do servidor' : '🔕 Silenciar servidor', () => { const on = alternarLocal('kali-srv-silenciados', s.id); toast(on ? 'Servidor silenciado: sem som nem aviso (menções também)' : 'Avisos do servidor reativados', 'ok'); }), ...extras];
    if (souStaffEm(s.id)) itens.push(item('Configurações do servidor', () => configServidor(s)));
    if (souDono(s)) itens.push(item('➕ Criar canal', () => modalCanal('texto')), item('📁 Criar categoria', modalCategoria), item('🌍 Servidor público', () => modalPublico(s)));
    if (souStaffEm(s.id)) itens.push(item('🤖 Bots e comandos /', () => modalBots(s)));
    if (souStaffEm(s.id)) itens.push(item('Criar evento', () => modalCriarEvento(s)), item('🛡️ AutoMod', () => modalAutomod(s)), item('👋 Boas-vindas e cargos', () => configBoasVindas(s)));
    itens.push(item('📊 Visão geral', () => abrirVisao(s.id)), item('🎭 Regras e meus cargos', () => modalBoasVindas(s)));
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
      !eu && window.Voz && Voz.estado.canalId ? item('🔔 Chamar pra call', () => chamarPraCall(m)) : null,
      !eu && !amigo && m.usuario ? item('Adicionar amigo', () => adicionarAmigo(m.usuario).catch((err) => toast(err.message, 'erro'))) : null,
      staff ? [h('hr'), item('⏳ Castigar 10 min', async () => { try { await api('POST', `/servidores/${s.id}/membros/${m.id}/castigo`, { minutos: 10 }); toast(m.nome + ' de castigo por 10 min', 'ok'); } catch (err) { toast(err.message, 'erro'); } }),
        item('👢 Expulsar', () => moderar('expulsar', m)), item('⛔ Banir', () => moderar('banir', m), 'perigo')] : null,
      h('hr'),
      m.usuario ? item('Copiar @' + m.usuario, () => copiar('@' + m.usuario)) : null,
      item('Copiar ID #' + m.id, () => copiar('#' + m.id, 'ID copiado ✓')),
      !eu ? item(bloqueado(m.id) ? 'Desbloquear' : 'Bloquear', () => alternarBloqueio(m), bloqueado(m.id) ? '' : 'perigo') : null,
    ].flat().filter(Boolean));
  }
  async function chamarPraCall(m) {
    const r = await pedir('voz:chamar', { usuarioId: m.id });
    toast(r.erro || `🔔 Chamando ${m.nome}…`, r.erro ? 'erro' : 'ok');
  }
  function aoSerChamado(d) {
    if (E.eu.status === 'foco' || bloqueado(d.de.id)) return;
    let n = 0; const tocar = () => { if (n++ < 6 && $('#chamada-' + d.de.id)) { tocarSom('zap'); setTimeout(tocar, 1800); } };
    $('#chamada-' + d.de.id)?.remove();
    const card = h('div', { class: 'chamada', id: 'chamada-' + d.de.id, role: 'alertdialog' },
      h('div', { class: 'ch-ic' }, '🔔'),
      h('div', { class: 'ch-txt' }, h('b', {}, d.de.nome + ' te chamou pra call'), h('small', {}, '🔊 ' + d.canalNome + (d.servidorNome ? ' · ' + d.servidorNome : ''))),
      h('button', { class: 'bt prim', onclick: async () => { card.remove(); if (d.servidorId && E.servidorId !== d.servidorId) await selecionarServidor(d.servidorId); const c = acharCanal(d.canalId); if (c) entrarVoz(c); } }, 'Entrar'),
      h('button', { class: 'bt', onclick: () => card.remove() }, 'Agora não'));
    document.body.append(card);
    setTimeout(() => card.remove(), 30000);
    tocar();
    try { if (window.Notification && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) new Notification('🔔 ' + d.de.nome + ' te chamou pra call', { body: d.canalNome, icon: '/img/icone.png', tag: 'chamada' }); } catch (e) {}
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
      const bl = [...E.bloqueados.values()];
      titulo = `Bloqueados — ${bl.length}`;
      itens = bl.map((u) => linha(u, 'Bloqueado (vale em todos os aparelhos)', h('button', { class: 'bt', onclick: () => alternarBloqueio(u) }, 'Desbloquear')));
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
        card(ic('loja', 22), 'Loja', 'Banner, moldura e cor do nome', modalLoja),
        /Android/i.test(navigator.userAgent) && !window.KaliNativo ? card(ic('tela', 22), 'App KALI pra Android', 'Pra transmitir a tela do celular', () => { location.href = LINK_APK; }) : null) : null,
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
    await carregarAmigos();
    await carregarBloqueios(); renderRail(); if (E.modo === 'dm') renderSide();
  }
  async function adicionarAmigo(usuario) {
    usuario = String(usuario || '').trim().replace(/^@/, '').toLowerCase();
    const r = await api('POST', '/amigos', { usuario });
    toast(r.amigos ? 'Vocês agora são amigos! 🎉' : 'Pedido de amizade enviado ✓', 'ok');
    await carregarAmigos();
    await carregarBloqueios(); if (E.modo === 'dm') renderSide();
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
      if (f.size > 12 * 1048576) return toast('Imagem grande demais (máximo 12 MB).', 'erro');
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
  function modalPermCargo(s, cg) {
    const caixa = (bit, rot, desc) => { const i = h('input', { type: 'checkbox' }); i.checked = !!(cg.perm & bit); i.dataset.bit = bit; return h('label', { class: 'check-cfg' }, i, ' ', h('span', {}, h('b', {}, rot), h('small', {}, desc))); };
    const itens = [caixa(1, '🛡 Moderar', 'Apagar mensagens, castigar, expulsar e banir (igual mod).'), caixa(2, '⭐ Administrar', 'Tudo de moderar + configurar o servidor (igual adm). Só o dono dá.'), caixa(4, '📣 Mencionar @todos', 'Pode usar @todos e @aqui.')];
    abrirModal({ titulo: '⚙ Permissões: ' + cg.nome, sub: 'Quem tiver esse cargo ganha essas permissões.', corpo: itens, botao: 'Salvar',
      acao: async () => {
        const perm = itens.reduce((t, l) => t + (l.querySelector('input').checked ? Number(l.querySelector('input').dataset.bit) : 0), 0);
        await api('PUT', `/cargos/${cg.id}/perm`, { perm }); await carregarCargos(s.id); toast('Permissões salvas ✓', 'ok');
      } });
  }
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
        h('button', { class: 'bt' + (c.animado ? ' prim' : ''), title: c.animado ? 'Tirar brilho do nome' : 'Nome animado (brilho) no chat', onclick: async () => { try { await api('PUT', `/cargos/${c.id}/animado`, { animado: !c.animado }); await carregarCargos(s.id); modalCargos(s); } catch (err) { toast(err.message, 'erro'); } } }, '✨'),
        h('button', { class: 'bt', title: 'Permissões do cargo', onclick: () => modalPermCargo(s, c) }, '⚙'),
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


  // ---------- bots com comandos / ----------
  async function modalBots(s) {
    let bots = [];
    try { bots = await api('GET', `/servidores/${s.id}/bots`); } catch (e) { return toast(e.message, 'erro'); }
    const mostrarToken = (b, token) => abrirModal({ titulo: '🔑 Token do ' + b.nome, sub: 'Copia agora: ele não aparece de novo. Quem tiver esse token controla o bot, não mostra pra ninguém.',
      corpo: [h('div', { class: 'chave-2fa' }, h('code', {}, token), h('button', { type: 'button', class: 'bt', onclick: () => navigator.clipboard?.writeText(token).then(() => toast('Token copiado ✓', 'ok')) }, 'Copiar')),
        h('div', { class: 'sec-menu' }, 'Como ligar o bot'),
        h('pre', { class: 'guia-bot' }, `npm install socket.io-client\nKALI_URL=${location.origin} KALI_TOKEN=<token> node scripts/bot-exemplo.js`),
        h('small', { class: 'sub' }, 'O exemplo já registra /ping, /dado, /moeda, /escolhe e /8ball. Edita o arquivo pra criar os seus comandos.')] });
    const linhas = bots.map((b) => h('li', {},
      h('span', { class: 'av', style: 'background:' + b.cor }, '🤖'),
      h('div', {}, h('b', {}, b.nome, ' ', h('span', { class: 'tag' }, 'BOT')), h('small', {}, '@' + b.usuario + ' · ' + (b.comandos.length ? b.comandos.map((c) => '/' + c.nome).join(' ') : 'nenhum comando registrado ainda'))),
      h('div', { class: 'acoes-cargo' },
        h('button', { class: 'bt', title: 'Gerar token novo (o antigo para de funcionar)', onclick: async () => { if (!confirm('Gerar token novo? O antigo para de funcionar.')) return; try { const r = await api('POST', `/servidores/${s.id}/bots/${b.id}/token`); mostrarToken(b, r.token); } catch (e) { toast(e.message, 'erro'); } } }, '🔑'),
        h('button', { class: 'bt', title: 'Tirar o bot do servidor', onclick: async () => { if (!confirm('Tirar ' + b.nome + ' do servidor?')) return; try { await api('DELETE', `/servidores/${s.id}/bots/${b.id}`); toast('Bot removido', 'ok'); modalBots(s); } catch (e) { toast(e.message, 'erro'); } } }, '🗑'))));
    const nome = h('input', { maxlength: 32, placeholder: 'Ex: KALI Music, Moderador, Sorteios' });
    abrirModal({ titulo: '🤖 Bots de ' + s.nome, sub: 'Bot é uma conta que responde comandos / no chat. Você cria aqui, pega o token e roda o programa do bot (no seu PC ou num servidor).',
      corpo: [bots.length ? h('ul', { class: 'novidades cargos' }, linhas) : h('p', { class: 'sub' }, 'Nenhum bot ainda.'), campo('Novo bot', nome)], botao: 'Criar bot',
      acao: async () => { const b = await api('POST', `/servidores/${s.id}/bots`, { nome: nome.value.trim() }); E.cmdCache && E.cmdCache.delete(s.id); setTimeout(() => mostrarToken(b, b.token), 150); } });
  }

  // ---------- autocomplete do / (comandos da KALI + dos bots do servidor) ----------
  const CMDS_KALI = [
    ['fig', '🧸 Manda uma figurinha (ex: /fig 🐸)'], ['tts', '🔊 Mensagem falada em voz alta'], ['enquete', '📊 Pergunta? | Opção 1 | Opção 2'],
    ['time', '🎮 Fecha um time: /time 5 Valorant'], ['pomodoro', '⏱ Estudo em grupo: /pomodoro 25'], ['confete', '🎉 Mensagem com confete'],
    ['fogo', '🔥 Mensagem pegando fogo'], ['explosao', '💥 Explosão na tela'], ['terremoto', '🌋 Treme a tela'], ['neon', '💡 Texto neon'], ['arcoiris', '🌈 Texto arco-íris'],
  ];
  let sugestao = null, sugSel = 0;
  function fecharSugestao() { if (sugestao) { sugestao.remove(); sugestao = null; } }
  async function sugerirComandos(c, ta) {
    const v = ta.value;
    const m = /^\/([a-z0-9_-]*)$/i.exec(v);
    if (!m) return fecharSugestao();
    const q = m[1].toLowerCase();
    let dosBots = [];
    if (c.servidorId) {
      E.cmdCache = E.cmdCache || new Map();
      const cache = E.cmdCache.get(c.servidorId);
      if (cache && Date.now() - cache.t < 30000) dosBots = cache.l;
      else { try { dosBots = await api('GET', `/servidores/${c.servidorId}/comandos`); E.cmdCache.set(c.servidorId, { t: Date.now(), l: dosBots }); } catch (e) {} }
    }
    if (ta.value !== v) return;
    const itens = [...dosBots.map((x) => ({ nome: x.nome, desc: x.descricao, de: '🤖 ' + x.bot })), ...CMDS_KALI.map(([n, d]) => ({ nome: n, desc: d, de: 'KALI' }))]
      .filter((x) => x.nome.startsWith(q)).slice(0, 8);
    fecharSugestao();
    if (!itens.length) return;
    sugSel = 0;
    const r = ta.closest('.caixa') ? ta.closest('.caixa').getBoundingClientRect() : ta.getBoundingClientRect();
    sugestao = h('div', { class: 'sugestao-cmd', role: 'listbox' }, h('div', { class: 'sec-menu' }, 'Comandos'), itens.map((x, i) => h('button', { type: 'button', class: 'sug-item' + (i === 0 ? ' sel' : ''), 'data-nome': x.nome,
      onmousedown: (e) => { e.preventDefault(); escolher(x.nome); } }, h('b', {}, '/' + x.nome), h('span', {}, x.desc), h('small', {}, x.de))));
    sugestao.style.left = r.left + 'px'; sugestao.style.width = r.width + 'px'; sugestao.style.bottom = (innerHeight - r.top + 6) + 'px';
    document.body.append(sugestao);
    function escolher(nome) { ta.value = '/' + nome + ' '; fecharSugestao(); ta.focus(); ta.dispatchEvent(new Event('input')); }
    sugestao._escolher = escolher;
  }
  function teclaSugestao(e, ta) {
    if (!sugestao) return false;
    const bs = [...sugestao.querySelectorAll('.sug-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sugSel = (sugSel + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, i) => b.classList.toggle('sel', i === sugSel)); return true; }
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); sugestao._escolher(bs[sugSel].dataset.nome); return true; }
    if (e.key === 'Escape') { fecharSugestao(); return true; }
    return false;
  }
  addEventListener('mousedown', (e) => { if (sugestao && !sugestao.contains(e.target)) fecharSugestao(); });
