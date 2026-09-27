/* Testler için basit statik sunucu: repo kökündeki site dosyalarını localhost'tan sunar.
 * GitHub Pages gibi dosyaları 10 dakika önbelleğe aldırır; /__hits her dosyanın kaç kez istendiğini verir. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

const hits = {};
http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/__hits') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(hits)); }
  /* iframe testi için "başka site" sayfası: 127.0.0.1 üzerinden açılıp localhost'taki uygulamayı gömer */
  if (rel === '/__frame') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(`<iframe src="http://localhost:${PORT}/" width="900" height="600"></iframe>`); }
  hits[rel] = (hits[rel] || 0) + 1;
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}tests${path.sep}`)) {
    res.writeHead(404); return res.end();
  }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(body);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
