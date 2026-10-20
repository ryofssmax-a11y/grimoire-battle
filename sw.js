const V = 'gb-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.json', 'icon.svg', 'js/statgen.js', 'js/rules.js', 'js/ai.js', 'js/starters.js', 'js/db.js', 'js/capture.js', 'js/cardview.js', 'js/summon.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) { const cl = res.clone(); caches.open(V).then(c => c.put(e.request, cl)); } return res; })));
});
