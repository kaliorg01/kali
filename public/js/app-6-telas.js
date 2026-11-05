// KALI — cliente (6/7): Telas cheias (configurações), voz e tela da call, lembretes, efeitos de mensagem e /time.
// Os arquivos app-*.js dividem o mesmo escopo e carregam em ordem (ver index.html). Texto de usuário só entra no DOM via textContent/append.
'use strict';

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
        (() => {
          const box = h('div', { class: 'lista-busca' }, h('p', { class: 'sub' }, 'Carregando aparelhos…'));
          const nomeUa = (ua) => {
            const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
            const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
            return (/Android|iPhone|iPad/.test(ua) ? '📱 ' : '💻 ') + nav + (so ? ' · ' + so : '');
          };
          const carregar = () => api('GET', '/eu/sessoes').then((l) => box.replaceChildren(...l.map((x) => h('div', { class: 'res-busca' },
            h('div', { class: 'rb-topo' }, h('b', {}, nomeUa(x.ua) + (x.atual ? ' (este aparelho)' : '')), h('small', {}, 'visto ' + new Date(x.ultimo).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))),
            x.atual ? null : h('div', {}, h('button', { class: 'bt perigo', type: 'button', onclick: async () => { try { await api('DELETE', '/eu/sessoes/' + x.id); toast('Aparelho desconectado ✓', 'ok'); carregar(); } catch (err) { toast(err.message, 'erro'); } } }, 'Desconectar')))))).catch((err) => box.replaceChildren(h('p', { class: 'sub' }, err.message)));
          carregar();
          return h('div', { class: 'linha-cfg', style: 'display:block' }, h('b', {}, 'Aparelhos conectados'), h('small', {}, 'Onde sua conta está logada. Desconecta o que você não reconhece.'), box);
        })(),
        linhaCfg('Senha', 'Trocar a senha desconecta os outros aparelhos.', h('button', { type: 'button', class: 'bt', onclick: () => {
          const atual = h('input', { type: 'password', autocomplete: 'current-password', maxlength: 200 }), nova = h('input', { type: 'password', autocomplete: 'new-password', maxlength: 200, placeholder: 'Mínimo 6 caracteres' });
          abrirModal({ titulo: 'Trocar senha', corpo: [campo('Senha atual', atual), campo('Senha nova', nova)], botao: 'Trocar senha',
            acao: async () => { const d = await api('POST', '/eu/senha', { atual: atual.value, nova: nova.value }); toast('Senha trocada ✓' + (d.sessoesEncerradas ? ` · ${d.sessoesEncerradas} outro(s) aparelho(s) desconectado(s)` : ''), 'ok'); } });
        } }, 'Trocar senha')),
      ]],
      ['Perfil', (re) => [
        linhaCfg('Foto de perfil', 'PNG, JPG, GIF (animado) ou WEBP até 12 MB.', h('button', { type: 'button', class: 'bt prim', onclick: () => escolherImagem('/eu/imagem/avatar') }, 'Trocar foto'),
          E.eu.avatar ? h('button', { type: 'button', class: 'bt', onclick: async () => { await api('DELETE', '/eu/imagem/avatar').catch(() => {}); await recarregarEu(); re(); } }, 'Remover') : null),
        linhaCfg('Banner, moldura e cor do nome', 'Itens exclusivos da Loja.', h('button', { type: 'button', class: 'bt', onclick: modalLoja }, 'Abrir Loja')),
      ]],
      ['Aparência', (re) => [
        linhaCfg('Tema', null, ...['dark', 'light'].map((t) => h('button', { type: 'button', class: 'bt' + (document.documentElement.dataset.theme === t ? ' prim' : ''),
          onclick: () => { if (document.documentElement.dataset.theme !== t) alternarTema(); re(); } }, t === 'dark' ? 'Escuro' : 'Claro'))),
        linhaCfg('Cor de destaque', 'Muda botões, seleção e brilhos do app inteiro.', ...[['', 'Azul'], ['rosa', 'Rosa'], ['roxo', 'Roxo'], ['verde', 'Verde']].map(([v, t]) => h('button', { type: 'button', class: 'bt' + ((document.documentElement.dataset.acento || '') === v ? ' prim' : ''),
          onclick: () => { if (v) document.documentElement.dataset.acento = v; else delete document.documentElement.dataset.acento; salvar('kali-acento', v); aplicarTemaServidor(E.modo === 'servidor' ? E.servidorId : null); re(); } }, t))),
        linhaCfg('Fonte', null, ...[['', 'Padrão'], ['redonda', 'Arredondada'], ['mono', 'Hacker (mono)']].map(([v, t]) => h('button', { type: 'button', class: 'bt' + ((document.documentElement.dataset.fonte || '') === v ? ' prim' : ''),
          onclick: () => { if (v) document.documentElement.dataset.fonte = v; else delete document.documentElement.dataset.fonte; salvar('kali-fonte', v); re(); } }, t))),
        linhaCfg('Fundo', 'Só no tema escuro.', ...[['', 'Liso'], ['grade', 'Grade'], ['estrelas', 'Estrelas'], ['aurora', 'Aurora']].map(([v, t]) => h('button', { type: 'button', class: 'bt' + ((document.documentElement.dataset.fundo || '') === v ? ' prim' : ''),
          onclick: () => { if (v) document.documentElement.dataset.fundo = v; else delete document.documentElement.dataset.fundo; salvar('kali-fundo', v); re(); } }, t))),
        linhaCfg('Rastro do mouse', 'Faíscas na cor de destaque seguindo o mouse.', chave(ler('kali-rastro') === '1', () => { salvar('kali-rastro', ler('kali-rastro') === '1' ? '' : '1'); re(); })),
        linhaCfg('✨ Efeitos completos', document.documentElement.hasAttribute('data-leve') ? 'Desligado (modo leve): sem partículas, brilhos, glitch e 3D. Melhor pra celular e PC fraco.' : 'Ligado: todas as animações e efeitos.', chave(!document.documentElement.hasAttribute('data-leve'), () => {
          const on = document.documentElement.hasAttribute('data-leve');
          if (on) document.documentElement.removeAttribute('data-leve'); else document.documentElement.setAttribute('data-leve', '');
          salvar('kali-efeitos', on ? '1' : ''); re(); toast(on ? '✨ Efeitos completos ligados (recarrega pra ligar o 3D)' : '🍃 Modo leve ligado', 'ok');
        })),
        linhaCfg('Modo compacto', 'Mensagens mais juntinhas.', chave(cls('compacto'), () => { alternarAcess('compacto', 'Modo compacto'); re(); })),
      ]],
      ['Acessibilidade', (re) => [
        linhaCfg('Alto contraste', null, chave(cls('contraste'), () => { alternarAcess('contraste', 'Alto contraste'); re(); })),
        linhaCfg('Fonte grande', null, chave(cls('fonte-grande'), () => { alternarAcess('fonte-grande', 'Fonte grande'); re(); })),
      ]],
      ['Segurança', (re) => {
        const box = h('div', {}, h('small', {}, 'Carregando…'));
        const mostrarCodigos = (codigos) => abrirModal({ titulo: '🧾 Códigos de recuperação', sub: 'Guarda num lugar seguro! Cada código entra UMA vez se você perder o celular. Eles não aparecem de novo.',
          corpo: [h('div', { class: 'codigos-rec' }, codigos.map((c) => h('code', {}, c))), h('button', { type: 'button', class: 'bt', onclick: () => navigator.clipboard?.writeText(codigos.join('\n')).then(() => toast('Códigos copiados ✓', 'ok')) }, 'Copiar todos')] });
        api('GET', '/eu/2fa').then((st) => {
          if (!st.ativo) {
            box.replaceChildren(linhaCfg('🔐 Verificação em 2 etapas', 'Desligada. Liga pra pedir um código do celular (Google Authenticator, Authy…) toda vez que alguém entrar na sua conta.',
              h('button', { type: 'button', class: 'bt prim', onclick: async () => {
                let d; try { d = await api('POST', '/eu/2fa/iniciar'); } catch (e) { return toast(e.message, 'erro'); }
                const cod = h('input', { inputmode: 'numeric', maxlength: 6, placeholder: '123456', autocomplete: 'one-time-code' });
                abrirModal({ titulo: '🔐 Ligar verificação em 2 etapas', sub: '1) Abre o Google Authenticator ou Authy → "+" → "Inserir chave". 2) Cola a chave abaixo (tipo: baseada em tempo). 3) Digita o código de 6 dígitos que aparecer.',
                  corpo: [h('div', { class: 'chave-2fa' }, h('code', {}, d.segredo.replace(/(.{4})/g, '$1 ').trim()), h('button', { type: 'button', class: 'bt', onclick: () => navigator.clipboard?.writeText(d.segredo).then(() => toast('Chave copiada ✓', 'ok')) }, 'Copiar')),
                    ehCelular() ? h('a', { class: 'bt', href: d.url, style: 'display:block;text-align:center;margin:6px 0' }, 'Abrir no app autenticador') : null, campo('Código do app', cod)].filter(Boolean),
                  botao: 'Ativar', acao: async () => { const r = await api('POST', '/eu/2fa/ativar', { codigo: cod.value.trim() }); toast('🔐 Verificação em 2 etapas ligada!', 'ok'); setTimeout(() => mostrarCodigos(r.codigos), 200); re(); } });
              } }, 'Ligar')));
          } else {
            const pedirCodigo = (titulo, fn) => { const cod = h('input', { maxlength: 11, placeholder: 'código do app ou de recuperação' }); abrirModal({ titulo, corpo: [campo('Código', cod)], botao: 'Confirmar', acao: () => fn(cod.value.trim()) }); };
            box.replaceChildren(linhaCfg('🔐 Verificação em 2 etapas', `Ligada ✅ · ${st.codigosRestantes} código(s) de recuperação sobrando.`,
              h('button', { type: 'button', class: 'bt', onclick: () => pedirCodigo('Novos códigos de recuperação', async (c) => { const r = await api('POST', '/eu/2fa/novos-codigos', { codigo: c }); setTimeout(() => mostrarCodigos(r.codigos), 200); re(); }) }, 'Novos códigos'),
              h('button', { type: 'button', class: 'bt perigo', onclick: () => pedirCodigo('Desligar verificação em 2 etapas', async (c) => { await api('POST', '/eu/2fa/desativar', { codigo: c }); toast('Verificação em 2 etapas desligada', 'ok'); re(); }) }, 'Desligar')));
          }
        }).catch((e) => box.replaceChildren(h('small', {}, e.message)));
        return [box];
      }],
      ['Notificações', (re) => {
        const pushOn = ler('kali-push') === '1';
        const linhaPush = linhaCfg('🔔 Notificação com o app fechado', pushOn ? 'Ligada neste aparelho: DM e @menção chegam mesmo com a KALI fechada.' : 'Receba DM e @menção no celular/PC mesmo com a KALI fechada.',
          h('button', { type: 'button', class: 'bt' + (pushOn ? '' : ' prim'), onclick: async () => { try { if (pushOn) { await desativarPush(); toast('Notificações desligadas', 'ok'); } else { await ativarPush(); toast('🔔 Notificações ligadas! Mandei um teste.', 'ok'); } } catch (e) { toast(e.message, 'erro'); } re(); } }, pushOn ? 'Desligar' : 'Ativar'));
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
          (() => {
            const sel = h('select', { class: 'campo-sel', 'aria-label': 'Microfone' }, h('option', { value: '' }, 'Padrão do sistema'));
            Voz.microfones().then((ms) => { ms.forEach((m, i) => sel.append(h('option', { value: m.deviceId }, m.label || 'Microfone ' + (i + 1)))); sel.value = Voz.micId; });
            sel.onchange = async () => { try { await Voz.trocarMic(sel.value); toast('🎙️ Microfone trocado', 'ok'); } catch (err) { toast('Não consegui usar esse microfone.', 'erro'); } };
            return linhaCfg('Microfone', 'Troca na hora, até no meio da call. (Os nomes aparecem depois de liberar o mic uma vez.)', sel);
          })(),
          linhaCfg('Redução de ruído forte', Voz.ruidoForte ? 'Ligada: corta teclado, ventilador e barulho de fundo (voz em mono).' : 'Desligada: redução normal do navegador.', chave(Voz.ruidoForte, async () => { try { await Voz.definirRuidoForte(!Voz.ruidoForte); } catch (e) { toast('Seu navegador não deixou mudar o microfone.', 'erro'); } re(); })),
          linhaCfg('Tecla de falar', 'Clica e aperta a tecla que você quer usar.', tecla),
          linhaCfg('Volume de cada pessoa', 'Na call, passa o mouse (ou toca) no quadro da pessoa e ajusta o volume dela só pra você.'),
        ];
      }],
      ['Baixar app', () => [linhaCfg('App KALI pra Android', 'Igual ao site, mas deixa transmitir a tela do celular na call. Depois de baixar, abre o arquivo e permite instalar.',
        h('a', { class: 'bt prim', href: LINK_APK }, 'Baixar KALI.apk'))]],
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
      ['Atividade', () => {
        const box = h('div', { class: 'calor' }, h('p', { class: 'sub' }, 'Carregando…'));
        const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        api('GET', `/servidores/${s.id}/atividade`).then((l) => {
          const g = {}; let max = 1, pico = null;
          for (const x of l) { g[x.d + ':' + x.h] = x.n; if (x.n > max) { max = x.n; pico = x; } }
          box.replaceChildren(h('div', { class: 'calor-grade' }, h('span'), Array.from({ length: 24 }, (_, hh) => h('small', { class: 'calor-h' }, hh % 3 ? '' : hh + 'h')),
            DIAS.map((dn, d) => [h('small', { class: 'calor-d' }, dn), Array.from({ length: 24 }, (_, hh) => { const n = g[d + ':' + hh] || 0; return h('i', { title: `${dn} ${hh}h: ${n} mensagem(ns)`, style: `opacity:${n ? 0.15 + 0.85 * n / max : 0.05}` }); })])),
            h('p', { class: 'sub', style: 'margin-top:10px' }, pico ? `🔥 Horário mais movimentado: ${DIAS[pico.d]} às ${pico.h}h. Bom horário pra marcar evento!` : 'Ainda sem mensagens nos últimos 30 dias.'));
        }).catch((err) => box.replaceChildren(h('p', { class: 'sub' }, err.message)));
        return [h('h3', {}, 'Quando a galera conversa'), h('p', { class: 'sub' }, 'Mensagens por dia e hora nos últimos 30 dias.'), box];
      }],
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
      item(jogoDe(E.eu.statusTexto) ? '🎮 Jogando ' + jogoDe(E.eu.statusTexto) + ' (trocar)' : '🎮 Jogando…', definirJogo),
      item(ouvindoDe(E.eu.statusTexto) ? '🎧 Ouvindo ' + ouvindoDe(E.eu.statusTexto) + ' (trocar)' : '🎧 Ouvindo…', definirOuvindo),
      item('🪪 Meu cartão de jogador', () => cartaoJogador(E.eu)),
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
    const efeito = h('select', {}, Object.entries(EFEITOS_PERFIL).map(([k, r]) => h('option', { value: k }, r))); efeito.value = v.efeito || '';
    const links = h('textarea', { rows: 2, maxlength: 1100, placeholder: 'https://twitch.tv/voce (um por linha, até 5)', class: 'campo-area' }); links.value = (v.links || []).join('\n');
    const aniver = h('input', { maxlength: 5, placeholder: 'DD/MM' });
    if (v.aniversario) { const [mm, dd] = v.aniversario.split('-'); aniver.value = `${dd}/${mm}`; }
    abrirModal({ titulo: 'Seu perfil vitrine', corpo: [campo('Nome de exibição', nome), campo('Recado', status), h('div', { class: 'campo' }, h('span', {}, 'Cor do avatar'), cores),
      h('div', { class: 'campo' }, h('span', {}, 'Banner'), banners), campo('Bio', bio), campo('✨ Efeito no avatar', efeito), campo('Jogos favoritos', jogos), campo('Links na bio', links), campo('Aniversário', aniver)], botao: 'Salvar',
      acao: async () => {
        const a = aniver.value.trim();
        const m = /^(\d{1,2})\/(\d{1,2})$/.exec(a);
        if (a && !m) throw new Error('Aniversário no formato DD/MM.');
        E.eu = Object.assign(E.eu, await api('PATCH', '/eu', {
          nome: nome.value.trim(), statusTexto: status.value.trim(), cor, bio: bio.value.trim(), banner, efeito: efeito.value,
          jogos: jogos.value.split(',').map((x) => x.trim()).filter(Boolean),
          links: links.value.split('\n').map((x) => x.trim()).filter(Boolean),
          aniversario: m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '',
        }));
        renderSide(); renderMembros(); toast('Perfil atualizado ✨', 'ok');
      } });
  }

  // ---------- voz ----------
  async function entrarVoz(c) {
    try { await Voz.entrar(c.id, !!c.espacial); try { sessionStorage.setItem('kali-voz', String(c.id)); } catch (e) {} Voz.posicoes(E.voz.get(c.id), E.eu.id); renderMapa(); abrirCall(); } catch (err) { toast(err.message, 'erro'); }
  }

  // ---------- tela da call (estilo Discord): grade de quem está na voz, tela/câmera ao vivo, foco e barra de controles ----------
  function abrirCall() {
    E.verCall = true; E.focoTela = null; E.palco = null;
    if (palcoAtual()) pedir('voz:palco-estado', {}).then((d) => { if (!d.erro) { E.palco = { canalId: Voz.estado.canalId, maos: d.maos, falantes: d.falantes }; aplicarPalco(); atualizarCall(true); } });
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
    if (stm && eu && Voz.estado.compartilhando && !E.verMinhaPrevia) {
      // Igual ao Discord: quem transmite não vê a própria tela (evita o "espelho infinito"), só um aviso.
      t.classList.add('minha-transmissao');
      t.append(h('div', { class: 'mt-caixa' }, h('div', { class: 'mt-ic' }, ic('tela', 30)), h('b', {}, 'Você está transmitindo sua tela'),
        h('small', {}, 'A galera da call está vendo agora.'),
        h('div', { class: 'mt-acoes' },
          h('button', { class: 'bt', onclick: (e) => { e.stopPropagation(); E.verMinhaPrevia = true; atualizarCall(true); } }, 'Ver prévia'),
          h('button', { class: 'bt perigo', onclick: (e) => { e.stopPropagation(); Voz.alternarTela().catch((err) => toast(err.message, 'erro')); } }, 'Parar de transmitir'))));
    } else if (stm) {
      let v = videosTela.get(uid);
      if (!v) { v = h('video', { autoplay: true, playsinline: true }); v.muted = true; videosTela.set(uid, v); }
      if (v.srcObject !== stm) v.srcObject = stm;
      // tela de celular (em pé) ganha quadro em pé, sem tarja preta dos lados
      const orientar = () => t.classList.toggle('retrato', v.videoHeight > v.videoWidth * 1.1);
      v.onloadedmetadata = orientar; v.onresize = orientar; if (v.videoWidth) orientar();
      t.append(v, h('button', { class: 'cheia', title: 'Tela cheia', onclick: (e) => { e.stopPropagation(); telaCheia(t); } }, '⛶'));
      if (eu) t.append(h('button', { class: 'bt esconder-previa', onclick: (e) => { e.stopPropagation(); E.verMinhaPrevia = false; atualizarCall(true); } }, 'Esconder prévia'));
      t.title = foco ? 'Clica pra voltar pra grade' : 'Clica pra assistir em destaque';
      t.onclick = () => { E.focoTela = foco ? null : uid; atualizarCall(); };
      t.ondblclick = () => telaCheia(t);
      t.onkeydown = (e) => { if (e.key === 'Enter') t.onclick(); };
    } else {
      // Igual ao Discord: o banner da pessoa (GIF anima) cobre o quadro quando ela não está com vídeo.
      if (u.bannerImg) { t.classList.add('com-banner'); t.style.setProperty('--banner', `url("${u.bannerImg}")`); }
      else if (u.vitrine && BANNERS[u.vitrine.banner]) { t.classList.add('com-banner'); t.style.setProperty('--banner', BANNERS[u.vitrine.banner]); }
      if (u.cor) t.style.setProperty('--cor-tile', u.cor);
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
    const chave = [E.focoTela, legendaLigada, JSON.stringify(E.palco || {}), ev.mudo, ev.surdo, ev.camera, ev.compartilhando, Voz.ptt, ...membros.map((m) => [m.usuarioId, m.nome, !!m.mudo, !!m.surdo, streamDe(m.usuarioId) ? streamDe(m.usuarioId).id : ''].join(':'))].join('|');
    if (palco.dataset.chave === chave && !arguments[0]) {
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
    $('#barra-call').replaceChildren(...[
      h('button', { class: ev.camera ? 'ligado' : '', title: ev.camera ? 'Desligar câmera' : 'Ligar câmera', 'aria-pressed': String(ev.camera), onclick: () => Voz.alternarCamera().catch(erro) }, ic('camera', 22)),
      h('button', { class: ev.compartilhando ? 'ligado' : '', title: ev.compartilhando ? 'Parar de transmitir' : 'Compartilhar tela', 'aria-pressed': String(ev.compartilhando), onclick: () => Voz.alternarTela().catch(erro) }, ic('tela', 22)),
      h('button', { class: ev.mudo ? 'desligado' : '', title: ev.mudo ? 'Ativar microfone' : 'Silenciar microfone', 'aria-pressed': String(ev.mudo), onclick: () => Voz.alternarMudo() }, ic(ev.mudo ? 'micOff' : 'mic', 22)),
      h('button', { class: ev.surdo ? 'desligado' : '', title: ev.surdo ? 'Ativar áudio' : 'Desativar áudio', 'aria-pressed': String(ev.surdo), onclick: () => Voz.alternarSurdo() }, ic(ev.surdo ? 'foneOff' : 'fone', 22)),
      h('button', { class: legendaLigada ? 'ligado' : '', title: legendaLigada ? 'Desligar legenda' : 'Legenda ao vivo (o que você fala vira texto pra galera)', onclick: alternarLegenda }, ic('cc', 22)),
      palcoAtual() && !souStaffEm(palcoAtual().servidorId) ? h('button', { class: maoLevantada() ? 'ligado' : '', title: maoLevantada() ? 'Baixar a mão' : 'Levantar a mão pra falar', onclick: () => pedir('voz:mao', { levantar: !maoLevantada() }) }, ic('mao', 22)) : null,
      h('button', { class: 'encerrar', title: 'Desconectar', onclick: () => Voz.sair() }, ic('desligar', 22))].filter(Boolean)); // sem filtro, o null virava o texto "null"
    desenharPalco();
  }
  // Palco: só fala quem a staff deu a vez. Plateia fica muda e levanta a mão.
  const palcoAtual = () => { const c = window.Voz && Voz.estado.canalId ? acharCanal(Voz.estado.canalId) : null; return c && c.palco ? c : null; };
  const maoLevantada = () => (E.palco?.maos || []).includes(E.eu.id);
  const possoFalarNoPalco = () => { const c = palcoAtual(); return !c || souStaffEm(c.servidorId) || (E.palco?.falantes || []).includes(E.eu.id); };
  function aplicarPalco() { if (palcoAtual() && !possoFalarNoPalco() && !Voz.estado.mudo) Voz.alternarMudo(); }
  function desenharPalco() {
    const palco = $('#palco-call'), c = palcoAtual();
    $('#painel-palco')?.remove();
    if (!palco || !c) return;
    const nome = (id) => ((E.voz.get(c.id) || []).find((x) => x.usuarioId === id) || {}).nome || nomeDe(id);
    const staff = souStaffEm(c.servidorId), P = E.palco || { maos: [], falantes: [] };
    palco.parentNode.insertBefore(h('div', { class: 'painel-palco', id: 'painel-palco' },
      h('b', {}, '🎤 Palco'), h('small', {}, possoFalarNoPalco() ? 'Você pode falar.' : 'Você está na plateia (mudo). Levanta a mão ✋ pra pedir a vez.'),
      P.falantes.length ? h('div', { class: 'pp-linha' }, '🎙 No palco: ', P.falantes.map((id) => h('span', { class: 'pp-chip' }, nome(id), staff ? h('button', { title: 'Tirar a vez', onclick: () => pedir('voz:vez', { usuarioId: id, pode: false }) }, '✕') : null))) : null,
      P.maos.length ? h('div', { class: 'pp-linha' }, '✋ Mãos levantadas: ', P.maos.map((id) => h('span', { class: 'pp-chip' }, nome(id), staff ? h('button', { title: 'Dar a vez', onclick: () => pedir('voz:vez', { usuarioId: id, pode: true }) }, '✓ dar a vez') : null))) : null), palco);
  }
  // Legenda ao vivo (reconhecimento de voz do navegador, pt-BR).
  let legendaLigada = false, reconhecedor = null;
  function alternarLegenda() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('Seu navegador não tem reconhecimento de voz (usa o Chrome ou o Edge).', 'erro');
    legendaLigada = !legendaLigada;
    if (!legendaLigada) { try { reconhecedor && reconhecedor.stop(); } catch (e) {} reconhecedor = null; atualizarCall(true); return; }
    reconhecedor = new SR(); reconhecedor.lang = 'pt-BR'; reconhecedor.continuous = true; reconhecedor.interimResults = true;
    reconhecedor.onresult = (e) => {
      const res = e.results[e.results.length - 1], texto = res[0].transcript.trim();
      if (!texto || Voz.estado.mudo) return;
      mostrarLegenda('Você', texto, res.isFinal);
      pedir('voz:legenda', { texto, final: res.isFinal });
    };
    reconhecedor.onend = () => { if (legendaLigada && Voz.estado.canalId) try { reconhecedor.start(); } catch (e) {} };
    try { reconhecedor.start(); } catch (e) {}
    toast('🔤 Legenda ligada: o que você fala aparece pra galera da call', 'ok');
    atualizarCall(true);
  }
  const linhasLegenda = new Map();
  function mostrarLegenda(de, texto, final) {
    const palco = $('#palco-call'); if (!palco) return;
    let box = $('#legendas'); if (!box) { box = h('div', { class: 'legendas', id: 'legendas', 'aria-live': 'polite' }); palco.parentNode.insertBefore(box, palco.nextSibling); }
    let l = linhasLegenda.get(de);
    if (!l || !document.contains(l)) { l = h('div', { class: 'legenda' }); linhasLegenda.set(de, l); box.append(l); }
    l.replaceChildren(h('b', {}, de + ': '), texto);
    clearTimeout(l._t); l._t = setTimeout(() => { l.remove(); linhasLegenda.delete(de); }, final ? 6000 : 9000);
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
    if (Voz.minhaTela && (!Voz.estado.compartilhando || E.verMinhaPrevia)) lista.push([E.eu.id, Voz.minhaTela, 'Você']); // sem espelho da própria tela
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
        h('button', { class: 'icbtn', title: 'Tela cheia', onclick: () => telaCheia(v) }, '⛶'));
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
  function modalLembretes() {
    const l = lerLembretes().sort((a, b) => a.quando - b.quando);
    abrirModal({ titulo: '⏰ Meus lembretes', sub: l.length ? 'Clica pra ir até a mensagem. O ✕ cancela.' : 'Nenhum lembrete. Passa o mouse numa mensagem → ⏰ pra criar.', corpo: h('div', { class: 'lista-busca' }, l.map((x) =>
      h('div', { class: 'res-busca', style: 'display:flex;gap:8px;align-items:center' },
        h('button', { type: 'button', style: 'flex:1;text-align:left', onclick: () => { fecharModal(); irPara(x.msgId, x.canalId); } },
          h('div', { class: 'rb-topo' }, h('b', {}, x.autor), h('small', {}, new Date(x.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))), h('div', { class: 'rb-txt' }, x.texto)),
        h('button', { type: 'button', class: 'icbtn', title: 'Cancelar lembrete', onclick: () => { salvar('kali-lembretes', JSON.stringify(lerLembretes().filter((y) => !(y.msgId === x.msgId && y.quando === x.quando)))); modalLembretes(); } }, '✕')))) });
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
  const EFEITOS = { confete: ['🎉', ['🎉', '🎊', '✨', '🥳']], fogo: ['🔥', ['🔥', '🔥', '💥']], explosao: ['💥', ['💥', '✨', '💫']], terremoto: ['🌋', null], neon: ['💡', null], arcoiris: ['🌈', null] };
  const RE_EFEITO = /^\/(confete|fogo|explosao|terremoto|neon|arcoiris)\s*/i;
  const efeitoDe = (t) => { const r = RE_EFEITO.exec(t || ''); return r ? r[1].toLowerCase() : null; };
  function dispararEfeito(ef) {
    if (ef === 'neon' || ef === 'arcoiris') return;
    if (ef === 'terremoto') { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { document.body.classList.remove('terremoto'); void document.body.offsetWidth; document.body.classList.add('terremoto'); setTimeout(() => document.body.classList.remove('terremoto'), 900); } return; }
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
