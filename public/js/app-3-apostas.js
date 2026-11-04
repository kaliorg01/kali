// KALI — cliente (3/7): Apostas 1x1, org de apostas (fila no canal), resultados, ranking, blacklist e torneios.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

  // ---------- apostas 1x1 (fila por valor; Pix direto pro adm chamado) ----------
  async function abrirApostas(sid) {
    const s = E.servidores.find((x) => x.id === sid) || servidorAtual();
    if (!s) return;
    if (E.modo !== 'servidor' || E.servidorId !== s.id) await selecionarServidor(s.id);
    E.verApostas = true; E.verVisao = false; E.verCall = false;
    $('#app').classList.add('chat');
    renderMain(); renderSide();
  }
  const abrirSalaAposta = async (canalId) => { E.verApostas = false; E.modo = 'dm'; E.servidorId = null; await abrirCanal(canalId); render(); };
  const confirmou18 = () => ler('kali-18') === '1' || (confirm('🔞 Apostas valendo dinheiro são só pra maiores de 18 anos e por sua conta e risco. A KALI não guarda nem devolve dinheiro: o Pix vai direto pro adm da sala. Você tem 18 anos ou mais?') && (salvar('kali-18', '1'), true));
  async function renderApostas(main) {
    const s = servidorAtual();
    if (!s) { E.verApostas = false; return renderMain(); }
    let d;
    try { d = await api('GET', `/servidores/${s.id}/apostas`); } catch (err) { main.replaceChildren(h('div', { class: 'painel' }, h('p', {}, err.message))); return; }
    if (!E.verApostas || servidorAtual()?.id !== s.id) return;
    const re = () => renderApostas(main);
    const valor = h('select', { class: 'busca-painel', style: 'flex:0 0 130px' }, [5, 10, 20, 30, 50, 100, 200].map((v) => h('option', { value: v }, 'R$ ' + v)));
    valor.value = ler('kali-aposta-valor') || '10';
    // Jogo → modos → formato. Vira um texto tipo "Free Fire · X1 · MD3", que é o que casa a fila.
    const JOGOS_APOSTA = {
      'Free Fire': { ic: '🔥', modos: ['1x1', '2x2', '3x3', '4x4', 'Contra Squad (CS)', 'X1 dos Crias'], formatos: ['Mobile', 'Mobilador', 'Emulador', 'Misto'] },
      'Valorant': { ic: '🎯', modos: ['1v1 (Mata-mata até 13)', '1v1 (primeiro a 20 kills)', '2v2', '5v5 personalizada'], formatos: ['MD1', 'MD3'] },
      'GTA RP': { ic: '🚗', modos: ['Racha de carro', 'PvP X1 (arma)', 'PvP X1 (soco)', 'Fuga / perseguição', 'PvP em grupo'], formatos: ['1 rodada', 'MD3', 'MD5'] },
      'Outro': { ic: '🎮', modos: ['X1', 'X2', '5v5'], formatos: ['MD1', 'MD3'] },
    };
    const selJogo = h('select', { class: 'busca-painel', style: 'flex:0 0 150px' }, Object.entries(JOGOS_APOSTA).map(([k, j]) => h('option', { value: k }, j.ic + ' ' + k)));
    const selModo = h('select', { class: 'busca-painel', style: 'flex:1 1 170px' }), selFmt = h('select', { class: 'busca-painel', style: 'flex:0 0 110px' });
    const encherModos = () => { const j = JOGOS_APOSTA[selJogo.value]; selModo.replaceChildren(...j.modos.map((m) => h('option', { value: m }, m))); selFmt.replaceChildren(...j.formatos.map((m) => h('option', { value: m }, m))); };
    const [gS, mS, fS] = (ler('kali-aposta-jogo') || '').split(' · ');
    selJogo.value = JOGOS_APOSTA[gS] ? gS : 'Free Fire'; encherModos(); if (mS) selModo.value = mS; if (fS) selFmt.value = fS;
    selJogo.onchange = encherModos;
    const jogo = { get value() { return [selJogo.value, selModo.value, selFmt.value].join(' · '); } };
    const fila = async () => {
      if (!confirmou18()) return;
      salvar('kali-aposta-valor', valor.value); salvar('kali-aposta-jogo', jogo.value);
      const v = Number(valor.value);
      const livre = d.salas.find((x) => x.status === 'aberta' && x.valor === v && x.p1.id !== E.eu.id && (x.jogo || '') === jogo.value);
      try {
        if (livre) { const r = await api('POST', `/apostas/${livre.id}/entrar`); toast('⚔️ Achou adversário! Abrindo a sala…', 'ok'); if (r.canalId) abrirSalaAposta(r.canalId); }
        else { await api('POST', `/servidores/${s.id}/apostas`, { valor: v, jogo: jogo.value }); toast('⏳ Você tá na fila de R$ ' + v + '. Quando alguém entrar, o adm é chamado.', 'ok'); re(); }
      } catch (err) { toast(err.message, 'erro'); }
    };
    const pil = (t, c) => h('span', { class: 'pilula' + (c ? ' ' + c : '') }, t);
    const STATUS_A = { aberta: ['Na fila', 'ok'], andamento: ['Em andamento', 'vivo'], finalizada: ['Finalizada', 'contorno'], cancelada: ['Cancelada', ''] };
    const card = (a) => {
      const souAdm = a.adm && a.adm.id === E.eu.id, souJog = [a.p1?.id, a.p2?.id].includes(E.eu.id);
      const acoes = [];
      if (a.status === 'aberta' && a.p1.id !== E.eu.id) acoes.push(h('button', { class: 'bt prim', onclick: async () => { if (!confirmou18()) return; try { const r = await api('POST', `/apostas/${a.id}/entrar`); if (r.canalId) abrirSalaAposta(r.canalId); } catch (err) { toast(err.message, 'erro'); } } }, '⚔️ Entrar R$ ' + a.valor));
      if (a.status === 'aberta' && a.p1.id === E.eu.id) acoes.push(h('button', { class: 'bt', onclick: async () => { await api('POST', `/apostas/${a.id}/cancelar`).catch((e) => toast(e.message, 'erro')); re(); } }, 'Sair da fila'));
      if (a.canalId && a.status !== 'aberta') acoes.push(h('button', { class: 'bt prim', onclick: () => abrirSalaAposta(a.canalId) }, '💬 Abrir sala'));
      const pagoEu = a.p1?.id === E.eu.id ? a.pago1 : a.p2?.id === E.eu.id ? a.pago2 : null;
      if (souJog && a.status !== 'aberta') acoes.push(h('button', { class: 'bt', onclick: () => modalDenunciaAposta(a) }, '🚩 Denunciar'));
      if (a.status === 'andamento' && souJog && !pagoEu) acoes.push(h('button', { class: 'bt', onclick: async () => { await api('POST', `/apostas/${a.id}/paguei`).catch((e) => toast(e.message, 'erro')); re(); } }, '✅ Paguei'));
      if (a.status === 'andamento' && (souAdm || d.staff)) {
        acoes.push(h('button', { class: 'bt', onclick: async () => { if (!confirm(`${a.p1.nome} venceu?`)) return; await api('POST', `/apostas/${a.id}/vencedor`, { usuarioId: a.p1.id }).catch((e) => toast(e.message, 'erro')); re(); } }, '🏆 ' + a.p1.nome),
          h('button', { class: 'bt', onclick: async () => { if (!confirm(`${a.p2.nome} venceu?`)) return; await api('POST', `/apostas/${a.id}/vencedor`, { usuarioId: a.p2.id }).catch((e) => toast(e.message, 'erro')); re(); } }, '🏆 ' + a.p2.nome),
          h('button', { class: 'bt', onclick: async () => { if (!confirm('Cancelar a sala? Devolva o Pix pros dois.')) return; await api('POST', `/apostas/${a.id}/cancelar`).catch((e) => toast(e.message, 'erro')); re(); } }, '❌ Cancelar'));
      }
      const [st1, st2] = STATUS_A[a.status] || ['', ''];
      return h('div', { class: 'card-srv card-aposta' + (souAdm ? ' sou-adm' : souJog ? ' sou-jog' : '') },
        h('div', { class: 'capa capa-aposta' }, h('small', {}, 'R$'), h('b', {}, String(a.valor))),
        h('div', { class: 'info' },
          h('div', { class: 'linha-topo' }, h('b', {}, `SALA #${a.id}${a.jogo ? ' · ' + a.jogo : ''}`), h('span', { class: 'selos' }, souAdm ? pil('Você é o adm', 'destaque') : null, pil(st1, st2))),
          h('div', { class: 'versus' }, h('span', {}, a.p1.nome), h('i', {}, 'VS'), h('span', { class: a.p2 ? '' : 'esperando' }, a.p2 ? a.p2.nome : 'esperando…')),
          h('div', { class: 'stats' }, h('span', {}, '🛡️ ', h('b', {}, a.adm ? a.adm.nome : 'adm é chamado quando fechar')), h('span', {}, '💰 pote ', h('b', {}, 'R$ ' + a.valor * 2)),
            a.vencedor ? h('span', {}, '🏆 ', h('b', {}, [a.p1, a.p2].find((p) => p && p.id === a.vencedor)?.nome || '')) : null,
            a.status === 'andamento' ? h('span', { class: 'pagos' }, (a.pago1 ? '✅' : '⏳') + ' ' + a.p1.nome.split(' ')[0] + '  ' + (a.pago2 ? '✅' : '⏳') + ' ' + a.p2.nome.split(' ')[0]) : null,
            a.taxa ? h('span', {}, `💼 ${a.taxa}% · prêmio `, h('b', {}, 'R$ ' + Math.round(a.valor * 2 * (100 - a.taxa)) / 100)) : null),
          acoes.length ? h('div', { class: 'acoes-aposta' }, acoes) : null));
    };
    const abertas = d.salas.filter((a) => a.status === 'aberta'), minhas = d.salas.filter((a) => a.status !== 'aberta');
    const chave = h('input', { class: 'busca-painel', placeholder: 'Sua chave Pix (CPF, e-mail, celular ou aleatória)', maxlength: 120, value: d.minhaChave || '' });
    main.replaceChildren(h('div', { class: 'painel apostas' },
      h('h1', {}, 'Apostas ', h('span', {}, '1x1')),
      h('div', { class: 'ao-vivo-apostas' }, h('span', {}, '🔥 ', h('b', {}, String(d.aoVivo.salas)), ' salas rolando agora'), h('span', {}, '💰 ', h('b', {}, 'R$ ' + d.aoVivo.emJogo), ' em jogo'), h('span', {}, '🛡️ ', h('b', {}, String(d.admsDisponiveis)), ' adm(s) disponível(is)'),
        h('button', { class: 'bt', onclick: () => modalRankingApostas(s) }, '👑 Ranking'), h('button', { class: 'bt', onclick: () => modalBlacklist(s, d.staff) }, '⛔ Blacklist')),
      h('p', { class: 'sub' }, 'Entra na fila do valor, quando aparecer adversário a sala fecha e um adm livre é chamado. O Pix vai direto pra chave do adm, que confirma, apita e paga o vencedor.'),
      d.dono ? h('div', { class: 'aviso-aposta' }, h('div', {}, h('b', {}, d.ligado ? '🟢 Apostas ligadas neste servidor' : '🔴 Apostas desligadas'), h('small', {}, 'Dinheiro de verdade: confira as leis da sua região. O app não guarda nem processa pagamento.')),
        h('button', { class: 'bt' + (d.ligado ? '' : ' prim'), onclick: async () => { if (!d.ligado && !confirm('Ligar apostas valendo dinheiro neste servidor? Você e seus adms se responsabilizam pelos pagamentos.')) return; await api('PUT', `/servidores/${s.id}/apostas/config`, { ligado: !d.ligado }).catch((e) => toast(e.message, 'erro')); re(); } }, d.ligado ? 'Desligar' : 'Ligar apostas')) : null,
      d.staff ? h('div', { class: 'aviso-aposta' }, h('div', { style: 'flex:1' }, h('b', {}, '🔑 Sua chave Pix de adm'), h('small', {}, d.minhaChave ? 'Cadastrada: quando você for chamado pra uma sala, os jogadores pagam nela.' : 'Cadastre pra entrar na escala de adms das apostas.'), chave),
        h('button', { class: 'bt prim', onclick: async () => { try { await api('PUT', `/servidores/${s.id}/apostas/pix`, { chave: chave.value }); toast(chave.value.trim() ? '🔑 Chave salva: você já pode ser chamado' : 'Chave removida', 'ok'); re(); } catch (e) { toast(e.message, 'erro'); } } }, 'Salvar')) : null,
      d.staff && d.minhaChave ? h('div', { class: 'aviso-aposta' }, h('div', {}, h('b', {}, '🛡️ Sua escala'), h('small', {}, `Você apitou ${d.admStats.apitadas} sala(s) · R$ ${d.admStats.volume} passaram pela sua chave.`)),
        h('div', { class: 'abas-painel' }, [['disponivel', '🟢 Disponível'], ['ocupado', '🟡 Ocupado'], ['off', '⚫ Off']].map(([v, t]) => h('button', { class: 'aba-painel' + (d.minhaEscala === v ? ' ativo' : ''), onclick: async () => { await api('PUT', `/servidores/${s.id}/apostas/escala`, { escala: v }).catch((e) => toast(e.message, 'erro')); re(); } }, t)))) : null,
      d.dono && d.ligado ? h('div', { class: 'aviso-aposta' }, h('div', {}, h('b', {}, '💼 Taxa da org'), h('small', {}, 'Porcentagem do pote que fica com a org/adm. Aparece na conta da sala.')),
        (() => { const t = h('input', { type: 'number', min: 0, max: 30, step: 1, class: 'busca-painel', style: 'flex:0 0 90px', value: d.taxa, 'aria-label': 'Taxa da org em %' }); const bt = h('button', { class: 'bt prim', onclick: async () => { const v = Math.round(Number(t.value)); if (!(v >= 0 && v <= 30)) return toast('Taxa de 0% a 30%.', 'erro'); try { await api('PUT', `/servidores/${s.id}/apostas/taxa`, { taxa: v }); toast('💼 Taxa da org: ' + v + '%', 'ok'); } catch (e) { toast(e.message, 'erro'); } } }, 'Salvar'); return h('div', { style: 'display:flex;gap:6px;align-items:center' }, t, h('b', {}, '%'), bt); })()) : null,
      !d.ligado ? h('p', { class: 'vazio-painel' }, 'As apostas estão desligadas aqui. Só o dono do servidor liga.') : [
        h('div', { class: 'barra-painel' }, selJogo, selModo, selFmt, valor, h('button', { class: 'bt prim', style: 'padding:9px 18px', onclick: fila }, '🎲 Entrar na fila')),
        h('small', { class: 'conta' }, '🔥 Free Fire · 🎯 Valorant · 🚗 GTA RP — as regras do jogo aparecem na sala quando ela fecha. Modos em time (X4, 5v5): o capitão entra na fila e paga pelo time.'),
        h('small', { class: 'conta' }, `${d.admsComPix} adm(s) com Pix cadastrado`),
        h('div', { class: 'sec-painel' }, h('b', {}, 'Filas abertas'), h('small', {}, '· clica pra enfrentar')),
        abertas.length ? h('div', { class: 'grade-painel' }, abertas.map(card)) : h('p', { class: 'vazio-painel' }, 'Ninguém na fila agora. Entra você!'),
        minhas.length ? [h('div', { class: 'sec-painel' }, h('b', {}, 'Minhas salas'), h('small', {}, '· últimas 24h')), h('div', { class: 'grade-painel' }, minhas.map(card))] : null]));
    const pg = main.querySelector('.painel.apostas');
    blocoTorneios(s, d.staff).then((b) => pg && pg.isConnected && pg.append(b));
    if (s.convite) pg.querySelector('.ao-vivo-apostas')?.append(h('button', { class: 'bt', onclick: () => { const url = location.origin + '/org?c=' + s.convite; navigator.clipboard?.writeText(url).then(() => toast('🔗 Link da página pública copiado', 'ok')).catch(() => window.open(url, '_blank')); } }, '🔗 Página pública'));
  }
  function aoChamadoAposta(d) {
    tocarSom('zap');
    const card = h('div', { class: 'chamada pedido-voz' }, h('b', {}, `🎲 Você foi chamado como adm! Sala #${d.id}`), h('small', {}, `${d.p1} x ${d.p2} · R$ ${d.valor} cada`),
      h('div', { class: 'acoes' }, h('button', { class: 'bt prim', onclick: () => { card.remove(); abrirSalaAposta(d.canalId); } }, 'Abrir sala'), h('button', { class: 'bt', onclick: () => card.remove() }, 'Depois')));
    document.body.append(card);
    setTimeout(() => card.remove(), 45000);
  }

  // ---------- efeitos extras: entrada épica, chuva de emoji, emote gigante, rastro do mouse, nome dourado ----------
  function entradaEpica(nome) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const faixa = h('div', { class: 'entrada-epica', 'aria-hidden': 'true' }, h('span', {}, '⚡ ' + nome + ' entrou na call'));
    document.body.append(faixa);
    setTimeout(() => faixa.remove(), 2300);
  }
  const RE_SO_EMOJI = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*\s*){1,3}$/u;
  function chuvaEmoji(texto) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-leve')) return;
    const lista = [...texto.matchAll(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu)].map((m) => m[0]);
    if (!lista.length) return;
    const camada = h('div', { class: 'camada-efeito', 'aria-hidden': 'true' });
    for (let i = 0; i < 28; i++) {
      const p = h('span', {}, lista[i % lista.length]);
      p.style.left = (i * 37 % 100) + '%'; p.style.animationDelay = (i % 9) * 0.09 + 's'; p.style.fontSize = 22 + (i * 7 % 22) + 'px';
      camada.append(p);
    }
    document.body.append(camada);
    setTimeout(() => camada.remove(), 3200);
  }
  function emoteGigante(emoji, nome) {
    const el = h('div', { class: 'emote-gigante', 'aria-hidden': 'true' }, h('span', {}, emoji), nome ? h('small', {}, nome) : null);
    document.body.append(el);
    setTimeout(() => el.remove(), 2200);
  }
  function menuEmote(ancora) {
    abrirMenu(ancora, [h('div', { class: 'sec-menu' }, 'Emote gigante pra call toda'),
      h('div', { class: 'grade-emote' }, ['😂', '🔥', '💀', '😱', '👏', '🫡', '😭', '🤡', '💯', '🎉', 'GG', '👀'].map((e) => h('button', { type: 'button', onclick: () => {
        fecharMenu(); emoteGigante(e, E.eu.nome);
        pedir('voz:atividade', { estado: { jogo: 'emote', emoji: e, nome: E.eu.nome } }).then((r) => r.erro && toast(r.erro, 'erro'));
      } }, e)))]);
  }
  // rastro de faíscas atrás do mouse (opcional, em Aparência)
  let ultimoRastro = 0;
  addEventListener('mousemove', (e) => {
    if (ler('kali-rastro') !== '1' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = performance.now(); if (t - ultimoRastro < 28) return; ultimoRastro = t;
    const f = h('i', { class: 'rastro' }); f.style.left = e.clientX + 'px'; f.style.top = e.clientY + 'px';
    document.body.append(f); setTimeout(() => f.remove(), 650);
  }, { passive: true });
  // top 1 do ranking de cada servidor (nome dourado no chat)
  async function carregarTop1(sid) {
    try { const l = await api('GET', `/servidores/${sid}/ranking`); E.top1 = E.top1 || new Map(); const id = l[0] && l[0].usuario && l[0].usuario.id; if (E.top1.get(sid) !== id) { E.top1.set(sid, id); if (E.servidorId === sid) renderLista(); } } catch (e) {}
  }
  // parallax do banner no cartão de perfil
  function parallaxBanner(menu) {
    const ban = menu && menu.querySelector('.banner-perfil');
    if (!ban || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    menu.addEventListener('mousemove', (e) => {
      const r = menu.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      ban.style.transform = `scale(1.12) translate(${-x * 14}px, ${-y * 10}px)`;
    });
    menu.addEventListener('mouseleave', () => { ban.style.transform = ''; });
  }

  // ---------- org de apostas: painel de fila dentro do canal (ex.: 3x3-mobilador) ----------
  const RE_CANAL_FILA = /^([1-4])x\1-(mobile|mobilador|emulador|misto)$/;
  function painelFilaCanal(c) {
    const m = c && !c.dm && RE_CANAL_FILA.exec(c.nome || '');
    const s = servidorAtual();
    if (!m || !s) return '';
    const plat = m[2][0].toUpperCase() + m[2].slice(1);
    const jogo = `Free Fire · ${m[1]}x${m[1]} · ${plat}`;
    const box = h('div', { class: 'fila-canal' }, h('small', {}, 'Carregando fila…'));
    const desenhar = async () => {
      let d;
      try { d = await api('GET', `/servidores/${s.id}/apostas`); } catch (e) { box.remove(); return; }
      if (!d.ligado) { box.replaceChildren(h('small', {}, '🎲 Apostas desligadas neste servidor.')); return; }
      const minhas = d.salas.filter((a) => a.jogo === jogo && a.status === 'aberta');
      const naFila = minhas.find((a) => a.p1.id === E.eu.id);
      box.replaceChildren(
        h('div', { class: 'fc-topo' }, h('b', {}, `🔥 FILA ${m[1]}X${m[1]} · ${plat.toUpperCase()}`), h('span', { class: 'pilula vivo' }, `● ${d.aoVivo.salas} rolando · R$ ${d.aoVivo.emJogo} em jogo`)),
        h('div', { class: 'fc-valores' }, [5, 10, 20, 30, 50, 100].map((v) => {
          const esperando = minhas.filter((a) => a.valor === v && a.p1.id !== E.eu.id).length;
          const minha = naFila && naFila.valor === v;
          return h('button', { class: 'fc-valor' + (minha ? ' minha' : esperando ? ' tem' : ''), onclick: async () => {
            if (minha) { await api('POST', `/apostas/${naFila.id}/cancelar`).catch((e) => toast(e.message, 'erro')); return desenhar(); }
            if (!confirmou18()) return;
            const livre = minhas.find((a) => a.valor === v && a.p1.id !== E.eu.id);
            try {
              if (livre) { const r = await api('POST', `/apostas/${livre.id}/entrar`); if (r.canalId) abrirSalaAposta(r.canalId); }
              else { await api('POST', `/servidores/${s.id}/apostas`, { valor: v, jogo }); toast(`⏳ Na fila ${m[1]}x${m[1]} de R$ ${v}. Te aviso quando aparecer adversário!`, 'ok'); desenhar(); }
            } catch (e) { toast(e.message, 'erro'); }
          } }, h('b', {}, 'R$ ' + v), h('small', {}, minha ? 'você na fila · sair' : esperando ? `${esperando} esperando` : 'vazia'));
        })),
        h('small', { class: 'fc-dica' }, d.bloqueado ? '⛔ Você está na blacklist deste servidor.' : `🛡️ ${d.admsDisponiveis} adm(s) disponível(is)${d.taxa ? ` · taxa ${d.taxa}%` : ''} · capitão paga pelo time`));
    };
    desenhar();
    box._redesenhar = desenhar;
    return box;
  }

  // ---------- telas de resultado ----------
  function telaVitoria(d) {
    if (d.euVenci && window.KaliCinema) return KaliCinema.vitoria('Você venceu!', `Sala #${d.id} · levou R$ ${d.premio}`); // versão cinema
    const t = h('div', { class: 'tela-vitoria' + (d.euVenci ? '' : ' derrota') },
      h('div', { class: 'tv-caixa' }, h('div', { class: 'tv-trofeu' }, d.euVenci ? '🏆' : '💀'),
        h('h2', {}, d.euVenci ? 'VITÓRIA!' : 'Não foi dessa vez'), h('p', {}, d.euVenci ? `Você levou R$ ${d.premio}` : `${d.vencedor} venceu a sala #${d.id}`),
        h('button', { class: 'bt prim', onclick: () => t.remove() }, d.euVenci ? 'Bora de novo' : 'Revanche')),
      d.euVenci ? Array.from({ length: 40 }, (_, i) => h('i', { class: 'tv-confete', style: `--x:${(i * 53) % 100}vw;--d:${(i % 10) * 0.12}s;--c:${['#ff4fb8', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'][i % 5]}` })) : null);
    document.body.append(t);
    tocarSom(d.euVenci ? 'vinheta' : 'saiu');
    setTimeout(() => t.remove(), 7000);
  }
  function aoFechouAposta(d) {
    tocarSom('zap');
    const card = h('div', { class: 'chamada pedido-voz' }, h('b', {}, `⚔️ Achou adversário: ${d.adversario}!`), h('small', {}, `Sala #${d.id} · R$ ${d.valor}. Paga o adm e aperta ✅ Paguei.`),
      h('div', { class: 'acoes' }, h('button', { class: 'bt prim', onclick: () => { card.remove(); abrirSalaAposta(d.canalId); } }, 'Ir pra sala')));
    document.body.append(card);
    setTimeout(() => card.remove(), 30000);
  }

  // ---------- ranking de apostadores e blacklist ----------
  async function modalRankingApostas(s, periodo) {
    let l = [];
    try { l = await api('GET', `/servidores/${s.id}/apostas/ranking${periodo === 'semana' ? '?periodo=semana' : ''}`); } catch (e) { return toast(e.message, 'erro'); }
    const abas = h('div', { class: 'abas-painel' }, [['geral', 'Geral'], ['semana', 'Semana']].map(([v, t]) => h('button', { type: 'button', class: 'aba-painel' + ((periodo || 'geral') === v ? ' ativo' : ''), onclick: () => modalRankingApostas(s, v) }, t)));
    abrirModal({ titulo: '👑 Ranking de apostadores', sub: 'Quem mais amassou nas salas do servidor.', corpo: [abas, l.length ? h('ol', { class: 'ranking rank-apostas' }, l.map((x, i) =>
      h('li', { class: i === 0 ? 'rei' : '' }, h('span', { class: 'pos' }, ['👑', '🥈', '🥉'][i] || i + 1 + 'º'), h('b', {}, x.usuario ? x.usuario.nome : '?'), i === 0 ? h('span', { class: 'pilula destaque' }, 'Rei do X1') : null,
        h('small', { style: 'margin-left:auto' }, `${x.v}V ${x.d}D · ${x.pct}% · 🔥${x.melhor} seguidas`)))) : h('p', { class: 'vazio-painel' }, 'Ninguém finalizou aposta ainda.')] });
  }
  async function modalBlacklist(s, staff) {
    let l = [];
    try { l = await api('GET', `/servidores/${s.id}/apostas/blacklist`); } catch (e) { return toast(e.message, 'erro'); }
    const quem = h('input', { placeholder: '@usuario', maxlength: 21 }), motivo = h('input', { placeholder: 'Motivo (ex.: não pagou a sala #12)', maxlength: 200 });
    abrirModal({ titulo: '⛔ Blacklist de apostas', sub: 'Quem está aqui não entra em fila neste servidor.', corpo: [
      h('div', { class: 'lista-busca' }, l.length ? l.map((b) => h('div', { class: 'res-busca' }, h('div', { class: 'rb-topo' }, h('b', {}, b.nome + ' (@' + b.usuario + ')'), h('small', {}, new Date(b.criado_em).toLocaleDateString('pt-BR')),
        staff ? h('button', { type: 'button', class: 'bt', style: 'margin-left:auto;padding:3px 10px', onclick: async () => { await api('PUT', `/servidores/${s.id}/apostas/blacklist`, { usuario: b.usuario, tirar: true }).catch((e) => toast(e.message, 'erro')); modalBlacklist(s, staff); } }, 'Tirar') : null), h('div', { class: 'rb-txt' }, b.motivo || ''))) : h('p', { class: 'vazio-painel' }, 'Ninguém na blacklist. 🙏')),
      staff ? [h('div', { class: 'sec-menu' }, 'Adicionar'), campo('Usuário', quem), campo('Motivo', motivo)] : null].flat().filter(Boolean),
      botao: staff ? 'Colocar na blacklist' : null, acao: staff ? async () => { await api('PUT', `/servidores/${s.id}/apostas/blacklist`, { usuario: quem.value.trim(), motivo: motivo.value }); toast('⛔ Adicionado na blacklist', 'ok'); } : null });
  }

  // ---------- torneios por chave ----------
  async function blocoTorneios(s, staff) {
    const box = h('div', {});
    let l = [];
    try { l = await api('GET', `/servidores/${s.id}/torneios`); } catch (e) { return box; }
    const novo = staff ? h('button', { class: 'bt', onclick: () => modalNovoTorneio(s) }, '＋ Criar torneio') : null;
    box.append(h('div', { class: 'sec-painel' }, h('b', {}, 'Torneios'), h('small', {}, '· chaveamento automático'), novo ? h('span', { style: 'margin-left:auto' }, novo) : null),
      l.length ? h('div', { class: 'grade-painel' }, l.map((t) => {
        const dentro = t.inscritos.some((i) => i.id === E.eu.id);
        const st = { inscricoes: ['Inscrições abertas', 'ok'], rolando: ['Rolando', 'vivo'], finalizado: ['Finalizado', 'contorno'] }[t.status];
        return h('div', { class: 'card-srv card-aposta' + (dentro ? ' sou-jog' : '') },
          h('div', { class: 'capa capa-torneio' }, h('span', {}, '🏆'), h('small', {}, t.vagas + ' vagas')),
          h('div', { class: 'info' },
            h('div', { class: 'linha-topo' }, h('b', {}, t.nome), h('span', { class: 'selos' }, h('span', { class: 'pilula ' + st[1] }, st[0]))),
            h('p', {}, (t.jogo || 'Torneio') + (t.valor ? ` · inscrição R$ ${t.valor}` : ' · grátis')),
            h('div', { class: 'conq-barra' }, h('i', { style: `width:${Math.round((t.inscritos.length / t.vagas) * 100)}%` }), h('small', {}, `${t.inscritos.length}/${t.vagas} inscritos`)),
            t.campeao ? h('div', { class: 'stats' }, h('span', {}, '👑 Campeão: ', h('b', {}, t.campeao.nome))) : null,
            h('div', { class: 'acoes-aposta' },
              t.status === 'inscricoes' ? h('button', { class: 'bt' + (dentro ? '' : ' prim'), onclick: async () => { if (!dentro && t.valor && !confirmou18()) return; try { const r = await api('POST', `/torneios/${t.id}/inscrever`); toast(r.entrou ? `🏆 Inscrito no ${t.nome}!${t.valor ? ' Paga a inscrição pro adm.' : ''}` : 'Inscrição cancelada', 'ok'); } catch (e) { toast(e.message, 'erro'); } } }, dentro ? 'Sair' : 'Me inscrever') : null,
              h('button', { class: 'bt', onclick: () => modalChave(s, t, staff) }, t.status === 'inscricoes' ? '👥 Inscritos' : '🗂️ Ver chave'),
              staff && t.status === 'inscricoes' ? h('button', { class: 'bt', onclick: async () => { if (!confirm('Fechar inscrições e sortear a chave?')) return; try { const r = await api('POST', `/torneios/${t.id}/iniciar`); modalChave(s, r, staff); } catch (e) { toast(e.message, 'erro'); } } }, '🎲 Sortear chave') : null)));
      })) : h('p', { class: 'vazio-painel' }, staff ? 'Nenhum torneio ainda. Cria um!' : 'Nenhum torneio aberto agora.'));
    return box;
  }
  function modalNovoTorneio(s) {
    const nome = h('input', { maxlength: 50, placeholder: 'Ex: Copa Mobilador 3x3' }), jogo = h('input', { maxlength: 60, placeholder: 'Ex: Free Fire · 1x1 · Mobile' });
    const vagas = h('select', {}, [4, 8, 16].map((v) => h('option', { value: v }, v + ' jogadores/times'))); vagas.value = '8';
    const valor = h('input', { type: 'number', min: 0, max: 10000, value: 0 });
    abrirModal({ titulo: '🏆 Novo torneio', sub: 'Quando lotar (ou quando você quiser), sorteia a chave e vai apitando as partidas.', corpo: [campo('Nome', nome), campo('Jogo / modo', jogo), campo('Vagas', vagas), campo('Inscrição (R$, 0 = grátis)', valor)], botao: 'Criar',
      acao: async () => { await api('POST', `/servidores/${s.id}/torneios`, { nome: nome.value, jogo: jogo.value, vagas: Number(vagas.value), valor: Number(valor.value) || 0 }); toast('🏆 Torneio criado!', 'ok'); if (E.verApostas) renderMain(); } });
  }
  function modalChave(s, t, staff) {
    const rodadas = Math.log2(t.vagas);
    const nomeRodada = (r) => (r === rodadas ? 'Final' : r === rodadas - 1 ? 'Semifinal' : r === rodadas - 2 ? 'Quartas' : 'Oitavas');
    let corpo;
    if (t.status === 'inscricoes') {
      corpo = h('div', { class: 'lista-busca' }, t.inscritos.length ? t.inscritos.map((i) => h('div', { class: 'res-busca' }, h('div', { class: 'rb-topo' }, h('b', {}, i.nome), h('small', {}, t.valor ? (i.pago ? '✅ pago' : '⏳ não pagou') : ''),
        staff && t.valor ? h('button', { type: 'button', class: 'bt', style: 'margin-left:auto;padding:3px 10px', onclick: async () => { await api('POST', `/torneios/${t.id}/pago`, { usuarioId: i.id, pago: !i.pago }).catch((e) => toast(e.message, 'erro')); fecharModal(); } }, i.pago ? 'Desmarcar' : 'Confirmar pago') : null))) : h('p', { class: 'vazio-painel' }, 'Ninguém inscrito ainda.'));
    } else {
      const porRodada = Array.from({ length: rodadas }, (_, r) => t.partidas.filter((p) => p.rodada === r + 1));
      corpo = h('div', { class: 'chave-torneio' }, porRodada.map((ps, r) => h('div', { class: 'chave-col' }, h('small', { class: 'chave-tit' }, nomeRodada(r + 1)),
        Array.from({ length: t.vagas / 2 ** (r + 1) }, (_, i) => {
          const p = ps.find((x) => x.idx === i) || { a: null, b: null };
          const lado = (j) => {
            const ok = p.vencedor && j && p.vencedor === j.id;
            return h('button', { type: 'button', class: 'chave-jog' + (ok ? ' venceu' : p.vencedor ? ' perdeu' : ''), disabled: !staff || !!p.vencedor || !p.a || !p.b || !j || null,
              onclick: async () => { if (!confirm(`${j.nome} venceu essa partida?`)) return; try { const nt = await api('POST', `/torneios/${t.id}/partida`, { rodada: r + 1, idx: i, vencedor: j.id }); modalChave(s, nt, staff); } catch (e) { toast(e.message, 'erro'); } } }, j ? j.nome : '—');
          };
          return h('div', { class: 'chave-partida' }, lado(p.a), lado(p.b));
        }))),
        t.campeao ? h('div', { class: 'chave-col' }, h('small', { class: 'chave-tit' }, 'Campeão'), h('div', { class: 'chave-campeao' }, '👑 ', t.campeao.nome)) : null);
    }
    const f = abrirModal({ titulo: '🏆 ' + t.nome, sub: t.status === 'rolando' && staff ? 'Clica no nome de quem venceu cada partida pra avançar a chave.' : (t.jogo || ''), corpo });
    f.classList.add('modal-chave');
  }
  function modalDenunciaAposta(a) {
    const motivo = h('textarea', { rows: 4, maxlength: 400, placeholder: 'O que aconteceu? Ex.: não pagou, saiu no meio, usou hack, adm sumiu…', style: 'width:100%' });
    abrirModal({ titulo: '🚩 Denunciar sala #' + a.id, sub: 'Vai direto pro canal #mediadores e pra staff, com os dados da sala.', corpo: motivo, botao: 'Enviar denúncia', perigo: true,
      acao: async () => { const r = await api('POST', `/apostas/${a.id}/denunciar`, { motivo: motivo.value }); toast('🚩 Denúncia enviada pra ' + r.foiPara, 'ok'); } });
  }
