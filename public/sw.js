// KALI — service worker: guarda só a "casca" do app (html, css, js, imagens) e atualiza em segundo plano.
// Nunca guarda /api nem /socket.io. Troque VERSAO pra forçar todo mundo a baixar de novo.
const VERSAO = 'kali-v1';
const CASCA = ['/index.html', '/entrar.html', '/css/app.css', '/js/app.js', '/js/voz.js', '/img/icone.png', '/img/logo-dragao.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  // Navegação: rede primeiro (login/redirect sempre corretos), cache só se estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(url.pathname === '/entrar.html' ? '/entrar.html' : '/index.html')));
    return;
  }
  // Resto da casca: responde do cache na hora e atualiza por trás (stale-while-revalidate).
  e.respondWith(caches.open(VERSAO).then(async (c) => {
    const salvo = await c.match(req);
    const rede = fetch(req).then((r) => { if (r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => salvo);
    return salvo || rede;
  }));
});
