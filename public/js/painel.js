// KALI — painel do dono (página separada do chat, mesma conta e mesmo banco).
// Só funciona pra quem está em dados/admins.txt; o servidor recusa o resto mesmo se a página for alterada.
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
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
  async function api(metodo, rota, corpo) {
    const r = await fetch('/api' + rota, { method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.erro || 'Algo deu errado.'); e.status = r.status; throw e; }
    return d;
  }
  function toast(msg, tipo) {
    const t = h('div', { class: 'toast ' + (tipo || '') }, msg);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 3500);
  }
  const TIPOS = { banner: 'Banner', moldura: 'Moldura de foto', cor: 'Cor do nome' };
  const reais = (c) => c ? (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis';
  const estiloNome = (c) => !c ? '' : c.includes(',')
    ? `background:linear-gradient(90deg,${c});-webkit-background-clip:text;background-clip:text;color:transparent` : `color:${c}`;
  const data = (ms) => new Date(ms).toLocaleDateString('pt-BR');
  let eu = null, itens = [];

  // ---------- resumo ----------
  const numeros = h('div', { class: 'numeros' });
  async function atualizarResumo() {
    try {
      const r = await api('GET', '/admin/resumo');
      const campos = [['online', 'online agora'], ['usuarios', 'contas'], ['servidores', 'servidores'], ['mensagens', 'mensagens'], ['itensEntregues', 'itens entregues']];
      if (!numeros.children.length) numeros.replaceChildren(...campos.map(([k, rot], i) => h('div', { class: 'numero' + (k === 'online' ? ' online' : ''), style: '--i:' + i, 'data-k': k }, h('b', {}, '0'), h('small', {}, rot))));
      for (const [k] of campos) contar(numeros.querySelector('[data-k="' + k + '"] b'), r[k]);
    } catch (e) { /* tenta de novo no próximo ciclo */ }
  }

  // Número sobe contando até o valor novo (e pisca quando muda).
  function contar(el, alvo) {
    const de = Number(el.dataset.v || 0);
    if (de === alvo) return;
    el.dataset.v = alvo;
    const ini = performance.now(), dur = 900;
    const passo = (t) => { const p = Math.min(1, (t - ini) / dur), e = 1 - (1 - p) ** 3; el.textContent = Math.round(de + (alvo - de) * e).toLocaleString('pt-BR'); if (p < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
    if (de) { el.classList.remove('subiu'); void el.offsetWidth; el.classList.add('subiu'); }
  }
  // Partículas subindo no fundo.
  function particulas() {
    const fundo = $('#fundo');
    for (let i = 0; i < 28; i++) fundo.append(h('i', { class: 'pt', style: `left:${Math.random() * 100}%;animation-duration:${8 + Math.random() * 12}s;animation-delay:-${Math.random() * 20}s;opacity:${0.3 + Math.random() * 0.7}` }));
  }

  // ---------- loja ----------
  const grade = h('div', { class: 'loja-grade' });
  const qual = h('select', {});
  async function carregarItens() {
    itens = (await api('GET', '/loja')).itens;
    grade.replaceChildren(...(itens.length ? itens.map((i, n) => h('div', { class: 'item-loja', style: '--i:' + n },
      i.tipo === 'banner' ? h('img', { class: 'previa-banner', src: i.imagem, alt: '' })
        : i.tipo === 'moldura' ? h('img', { src: i.imagem, alt: '', style: 'width:64px;height:64px;object-fit:contain' })
          : h('b', { class: 'previa-cor', style: estiloNome(i.cor) }, eu.nome),
      h('b', {}, i.nome), h('small', { class: 'sub' }, TIPOS[i.tipo] + ' · ' + reais(i.preco)),
      h('button', { type: 'button', class: 'remover-item', title: 'Tirar da loja', onclick: async () => {
        if (!confirm(`Tirar "${i.nome}" da loja? Quem já tem continua tendo.`)) return;
        try { await api('DELETE', `/loja/itens/${i.id}`); toast('Item tirado da loja', 'ok'); carregarItens(); } catch (e) { toast(e.message, 'erro'); }
      } }, '✕'))) : [h('p', { class: 'sub', style: 'grid-column:1/-1' }, 'A loja está vazia. Crie o primeiro item aqui em cima.')]));
    qual.replaceChildren(...itens.map((i) => h('option', { value: i.id }, `${i.nome} (${TIPOS[i.tipo]})`)));
  }
  function formCriar() {
    const tipo = h('select', {}, Object.entries(TIPOS).map(([v, r]) => h('option', { value: v }, r)));
    const nome = h('input', { maxlength: 40, placeholder: 'Nome do item' });
    const preco = h('input', { inputmode: 'decimal', placeholder: 'Preço em R$ (ex: 4,90)' });
    const arq = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp' });
    const c1 = h('input', { type: 'color', value: '#2fd0ff', class: 'cor-cargo' }), c2 = h('input', { type: 'color', value: '#1f5fd6', class: 'cor-cargo' });
    const degrade = h('input', { type: 'checkbox' });
    const linhaImg = h('div', { class: 'linha-form' }, h('small', { class: 'sub' }, 'Imagem (banner largo tipo 1500×500 · moldura PNG com o meio transparente):'), arq);
    const linhaCor = h('div', { class: 'linha-form', hidden: true }, h('small', { class: 'sub' }, 'Cor:'), c1, h('label', { class: 'check-amigo' }, degrade, ' degradê com'), c2);
    tipo.onchange = () => { linhaImg.hidden = tipo.value === 'cor'; linhaCor.hidden = tipo.value !== 'cor'; };
    const criar = async () => {
      const centavos = Math.round(Number(String(preco.value || '0').replace(',', '.')) * 100);
      if (!Number.isFinite(centavos) || centavos < 0) return toast('Preço inválido.', 'erro');
      const qs = new URLSearchParams({ tipo: tipo.value, nome: nome.value.trim(), preco: String(centavos) });
      let body;
      if (tipo.value === 'cor') qs.set('cor', degrade.checked ? `${c1.value},${c2.value}` : c1.value);
      else { body = arq.files[0]; if (!body) return toast('Escolha a imagem do item.', 'erro'); }
      const r = await fetch('/api/loja/itens?' + qs, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast(d.erro || 'Não deu pra criar o item.', 'erro');
      toast('Item criado na loja ✓', 'ok'); nome.value = ''; preco.value = ''; arq.value = '';
      carregarItens(); atualizarResumo();
    };
    return [h('div', { class: 'linha-form' }, tipo, nome, preco), linhaImg, linhaCor,
      h('button', { type: 'button', class: 'bt prim', onclick: criar }, 'Criar item')];
  }

  // ---------- rascunhos de banner (gerados pelo Claude) ----------
  const gradeRasc = h('div', { class: 'rasc-grade' });
  async function carregarRascunhos() {
    let l = [];
    try { l = await api('GET', '/loja/rascunhos'); } catch (e) { return gradeRasc.replaceChildren(h('p', { class: 'sub' }, e.message)); }
    gradeRasc.replaceChildren(...(l.length ? l.map((r, n) => {
      const nome = h('input', { maxlength: 40, value: r.nome, 'aria-label': 'Nome do banner' });
      const preco = h('input', { inputmode: 'decimal', value: (r.preco / 100).toFixed(2).replace('.', ','), 'aria-label': 'Preço em reais' });
      const card = h('div', { class: 'rasc-card', style: '--i:' + n },
        h('img', { src: r.url, alt: r.nome, loading: 'lazy' }),
        h('div', { class: 'rasc-info' }, nome, h('div', { class: 'rasc-linha' }, h('span', { class: 'sub' }, 'R$'), preco, h('small', { class: 'sub' }, (r.tamanho / 1048576).toFixed(2) + ' MB'))),
        h('div', { class: 'rasc-acoes' },
          h('button', { type: 'button', class: 'bt prim', onclick: async (e) => {
            const centavos = Math.round(Number(String(preco.value || '0').replace(',', '.')) * 100);
            if (!Number.isFinite(centavos) || centavos < 0) return toast('Preço inválido.', 'erro');
            e.currentTarget.disabled = true;
            try { await api('POST', `/loja/rascunhos/${r.id}/publicar`, { nome: nome.value.trim(), preco: centavos }); toast('🛒 "' + nome.value.trim() + '" foi pra loja!', 'ok'); card.classList.add('saindo'); setTimeout(() => { carregarRascunhos(); carregarItens(); }, 350); }
            catch (err) { toast(err.message, 'erro'); e.currentTarget.disabled = false; }
          } }, '🛒 Mandar pra loja'),
          h('button', { type: 'button', class: 'bt', title: 'Descartar', onclick: async () => {
            if (!confirm('Descartar "' + r.nome + '"?')) return;
            try { await api('DELETE', `/loja/rascunhos/${r.id}`); card.classList.add('saindo'); setTimeout(carregarRascunhos, 350); } catch (err) { toast(err.message, 'erro'); }
          } }, '🗑')));
      return card;
    }) : [h('p', { class: 'sub' }, 'Nenhum rascunho agora. Pra gerar mais: node scripts/gerar-banners.js')]));
  }

  // ---------- entregar ----------
  function formEntregar() {
    const lista = h('datalist', { id: 'lista-usuarios' });
    const quem = h('input', { maxlength: 20, placeholder: '@usuario de quem pagou', list: 'lista-usuarios' });
    let t = 0;
    quem.oninput = () => { clearTimeout(t); t = setTimeout(async () => {
      const r = await api('GET', '/admin/usuarios?busca=' + encodeURIComponent(quem.value.replace(/^@/, ''))).catch(() => []);
      lista.replaceChildren(...r.map((u) => h('option', { value: u.usuario }, u.nome)));
    }, 250); };
    const dar = async () => {
      try { await api('POST', '/loja/presentear', { usuario: quem.value.trim(), itemId: Number(qual.value) }); toast('Item entregue ✓', 'ok'); quem.value = ''; atualizarResumo(); }
      catch (e) { toast(e.message, 'erro'); }
    };
    return [h('div', { class: 'linha-form' }, quem, lista, qual, h('button', { type: 'button', class: 'bt prim', onclick: dar }, 'Entregar')),
      h('small', { class: 'sub' }, 'A pessoa recebe um aviso na hora e já pode usar pela Loja.')];
  }

  // ---------- usuários ----------
  function blocoUsuarios() {
    const busca = h('input', { placeholder: 'Buscar por nome ou @' });
    const caixa = h('div', {});
    const carregar = async () => {
      const r = await api('GET', '/admin/usuarios?busca=' + encodeURIComponent(busca.value.replace(/^@/, ''))).catch(() => []);
      caixa.replaceChildren(...(r.length ? r.map((u, n) => {
        const linha = h('div', { class: 'usuario-linha', style: '--i:' + n }, h('div', { class: 'nome' }, h('b', {}, u.nome), ' ', h('small', {}, '@' + u.usuario)),
          h('small', {}, 'desde ' + data(u.criadoEm)), h('small', {}, u.itens + ' item(s)'));
        const ver = h('button', { type: 'button', class: 'bt', onclick: async () => {
          const its = await api('GET', `/admin/usuarios/${u.id}/itens`).catch(() => []);
          linha.querySelector('.itens-usuario')?.remove();
          linha.append(h('div', { class: 'itens-usuario' }, its.length ? its.map((i) => h('span', { class: 'chip' }, i.nome,
            h('button', { type: 'button', title: 'Tirar esse item da pessoa', onclick: async () => {
              if (!confirm(`Tirar "${i.nome}" de ${u.nome}?`)) return;
              try { await api('DELETE', `/admin/usuarios/${u.id}/itens/${i.id}`); toast('Item retirado', 'ok'); ver.click(); } catch (e) { toast(e.message, 'erro'); }
            } }, '✕'))) : h('small', { class: 'sub' }, 'Nenhum item.')));
        } }, 'Ver itens');
        linha.append(ver);
        return linha;
      }) : [h('p', { class: 'sub' }, 'Ninguém encontrado.')]));
    };
    let t = 0;
    busca.oninput = () => { clearTimeout(t); t = setTimeout(carregar, 250); };
    carregar();
    return [h('div', { class: 'linha-form' }, busca), caixa];
  }

  // ---------- início ----------
  (async function iniciar() {
    const raiz = $('#painel');
    try { eu = await api('GET', '/eu'); }
    catch (e) { location.replace('/entrar.html'); return; }
    if (!eu.admin) {
      raiz.replaceChildren(h('div', { class: 'aviso-painel' }, h('h2', {}, 'Acesso só pro dono do KALI'), h('p', {}, h('a', { href: '/' }, 'Voltar pro KALI'))));
      return;
    }
    particulas();
    raiz.replaceChildren(
      h('header', { class: 'painel-topo', style: '--i:0' }, h('img', { src: '/img/icone.png', alt: '' }), h('h1', {}, 'KALI · PAINEL DO DONO'),
        h('span', { class: 'sub' }, '@' + eu.usuario), h('a', { href: '/' }, 'Abrir o KALI →')),
      h('section', { class: 'bloco', style: '--i:1' }, h('h2', {}, 'Agora'), numeros),
      h('section', { class: 'bloco', style: '--i:2' }, h('h2', {}, '✨ Banners novos (rascunhos)'), h('p', { class: 'sub' }, 'Banners animados originais da KALI. Ajusta nome e preço e manda pra loja os que você curtir.'), gradeRasc),
      h('section', { class: 'bloco', style: '--i:2' }, h('h2', {}, 'Criar item da loja'), formCriar()),
      h('section', { class: 'bloco', style: '--i:3' }, h('h2', {}, 'Itens à venda'), grade),
      h('section', { class: 'bloco', style: '--i:4' }, h('h2', {}, 'Entregar item (depois do pagamento)'), formEntregar()),
      h('section', { class: 'bloco', style: '--i:5' }, h('h2', {}, 'Usuários'), blocoUsuarios()));
    await Promise.all([atualizarResumo(), carregarItens(), carregarRascunhos()]);
    setInterval(atualizarResumo, 15000);
  })();
})();
