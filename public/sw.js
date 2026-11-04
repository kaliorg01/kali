// KALI — service worker: guarda só a "casca" do app (html, css, js, imagens) e atualiza em segundo plano.
// Nunca guarda /api nem /socket.io. Troque VERSAO pra forçar todo mundo a baixar de novo.
const VERSAO = 'kali-v3';
const CASCA = ['/index.html', '/entrar.html', '/css/app.css', '/js/app.js', '/js/voz.js', '/img/icone.png', '/img/logo-dragao.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Push: mostra a notificação; clicar abre (ou foca) a KALI.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'KALI', { body: d.corpo || '', icon: '/img/icone-180.png', badge: '/img/icone-180.png', tag: d.tag, renotify: !!d.tag, data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { const c = cs.find((x) => new URL(x.url).origin === location.origin); return c ? c.focus() : self.clients.openWindow(e.notification.data.url || '/'); }));
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
  // Resto da casca: rede primeiro (atualização chega na hora) e guarda cópia; offline usa a cópia.
  e.respondWith(caches.open(VERSAO).then((c) => fetch(req)
    .then((r) => { if (r.ok && r.type === 'basic') c.put(req, r.clone()); return r; })
    .catch(() => c.match(req))));
});
