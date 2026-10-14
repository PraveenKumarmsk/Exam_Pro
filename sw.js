/* ExamPro service worker — precache app shell, network-first for content.json,
   stale-while-revalidate for the rest. Bump VERSION to force an update. */
const VERSION = 'exampro-v4.1.0';
const CORE = ['./','index.html','exams.html','exam-detail.html','tests.html','test-attempt.html','test-result.html','practice.html','materials.html','current-affairs.html','papers.html','dashboard.html','results.html','leaderboard.html','profile.html','login.html','register.html','pricing.html','about.html','contact.html','privacy.html','terms.html','refund.html','404.html','admin.html','offline.html','shared.css','shared.js','manifest.json','content.json','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(CORE.map(u => c.add(new Request(u, {cache:'reload'}))))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('content.json')) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req)));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); return r; })
      .catch(() => caches.match(req, {ignoreSearch:true}).then(m => m || caches.match('offline.html'))));
    return;
  }
  /* code and pages: network first (always fresh), cache only as the offline fallback; images/icons: cache first */
  if (/\.(css|js|json|html)$/.test(url.pathname) || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req, {ignoreSearch:true})));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch:true}).then(m => {
    const net = fetch(req).then(r => { if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); } return r; }).catch(() => m);
    return m || net;
  }));
});
