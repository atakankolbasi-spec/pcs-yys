/* PCS TRANSIT YYS - service worker.
 * Uygulama dosyalarını önbellekte tutar; internet yokken site yine açılır.
 * Önce ağ denenir (güncel sürüm her zaman ağdan gelir), ağ yoksa önbellekteki kopya kullanılır.
 * Supabase istekleri (başka alan adı) önbelleğe alınmaz. */
const CACHE = 'pcs-shell-v1';
const SHELL = [
  './', 'app.css', 'app.js', 'xlsx.js', 'xlsx-templates.js', 'vendor.js',
  'manifest.webmanifest', 'logo.svg', 'favicon-48.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png',
  'fonts/Roboto-Light.woff2', 'fonts/Roboto-Regular.woff2', 'fonts/Roboto-Medium.woff2', 'fonts/Roboto-Bold.woff2'
];
const NETWORK_TIMEOUT = 5000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pcs-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  /* Sayfa istekleri (?izle=... dahil) tek kopya olarak './' anahtarıyla saklanır */
  const nav = req.mode === 'navigate', key = nav ? './' : req;
  let saved;
  const network = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      saved = caches.open(CACHE).then(cache => cache.put(key, copy)).catch(() => {});
    }
    return res;
  });
  event.waitUntil(network.then(() => saved).catch(() => {}));
  event.respondWith(networkFirst(key, nav, network));
});

async function networkFirst(key, nav, network) {
  const timeout = new Promise(resolve => setTimeout(resolve, NETWORK_TIMEOUT, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch (_) { /* ağ yok: önbelleğe düş */ }
  const cached = await caches.match(key, { ignoreSearch: nav });
  /* yönlendirilmiş yanıt sayfa isteğine verilemez; gövdesini yeni yanıta kopyala */
  if (cached && cached.redirected) return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
  return cached || network;
}
