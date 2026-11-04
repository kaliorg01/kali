// KALI — convite pra instalar no celular: Android baixa o APK (ou instala como app), iPhone adiciona à tela de início.
// Aparece no navegador do celular, nunca dentro do app nem quando já está instalado; some por 7 dias ao fechar.
(() => {
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua), iphone = /iPhone|iPad|iPod/i.test(ua);
  const noApp = /KaliApp\//.test(ua) || matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const LINK_APK = 'https://github.com/kaliorg01/kali/releases/latest/download/KALI.apk';
  let promptPwa = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptPwa = e; });
  const ler = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const salvar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function folha() {
    if (document.querySelector('.instalar-folha')) return;
    const f = document.createElement('div');
    f.className = 'instalar-folha';
    f.setAttribute('role', 'dialog');
    f.innerHTML = `<div class="if-caixa">
      <button class="if-fechar" type="button" aria-label="Fechar">✕</button>
      <img src="/img/icone-180.png" alt="" class="if-ic">
      <h3>Baixa o app da KALI</h3>
      <p>${android ? 'Abre direto, recebe notificação e ainda transmite a tela do celular na call.' : 'Fica na tela de início igual app, em tela cheia e com notificação.'}</p>
      <div class="if-acoes"></div>
      ${iphone ? `<ol class="if-passos"><li>Toca em <b>Compartilhar</b> <span class="if-ico">⬆️</span> lá embaixo no Safari</li><li>Escolhe <b>Adicionar à Tela de Início</b></li><li>Pronto: abre a KALI pelo ícone</li></ol>` : ''}
    </div>`;
    const acoes = f.querySelector('.if-acoes');
    if (android) {
      const a = document.createElement('a'); a.className = 'bt prim'; a.href = LINK_APK; a.textContent = '⬇️ Baixar KALI.apk'; acoes.append(a);
      const dica = document.createElement('small'); dica.textContent = 'Depois de baixar, abre o arquivo e toca em "Instalar" (se pedir, permite instalar de fonte desconhecida).'; acoes.append(dica);
    }
    if (promptPwa && !iphone) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bt'; b.textContent = '📲 Instalar sem baixar (versão leve)';
      b.onclick = async () => { promptPwa.prompt(); await promptPwa.userChoice.catch(() => {}); promptPwa = null; fechar(); };
      acoes.append(b);
    }
    const fechar = () => { salvar('kali-instalar-ate', String(Date.now() + 7 * 86400000)); f.classList.add('saindo'); setTimeout(() => f.remove(), 300); };
    f.querySelector('.if-fechar').onclick = fechar;
    f.addEventListener('click', (e) => { if (e.target === f) fechar(); });
    document.body.append(f);
  }
  window.KaliInstalar = folha;
  if (noApp || !(android || iphone)) return;
  if (Number(ler('kali-instalar-ate') || 0) > Date.now()) return;
  setTimeout(folha, 6000); // deixa a pessoa ver o app primeiro
})();
