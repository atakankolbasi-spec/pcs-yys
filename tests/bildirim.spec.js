// Nakliye bildirim fonksiyonunun (supabase/functions/nakliye-bildirim/index.ts) testleri.
// Tarayıcı açılmaz: fonksiyon Node'da çalıştırılır; WhatsApp ve Supabase yerine sahte fetch cevap verir.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'nakliye-bildirim', 'index.ts');
const ENV = { SUPABASE_URL: 'https://proje.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servis-anahtari', WA_TOKEN: 'meta-anahtari', WA_PHONE_ID: 'PHONE1', WA_BEKLE: '0' };
const importFresh = new Function('u', 'return import(u)'); // derleyici dokunmasın diye
const realConsole = { log: console.log, error: console.error };
const ago = ms => new Date(Date.now() - ms).toISOString();
const row = (id, customer_id, event, phone, body, extra = {}) => ({ id, customer_id, event, phone, body, status: 'bekliyor', error: '', created_at: ago(120000), sent_at: null, ...extra });

// rows: kuyruk · graph: telefon numarasına göre Meta cevabı · steal: "başka bir çağrı" bu kimlikleri önceden almış gibi davranır
async function setup({ env = {}, rows = [], graph = {}, steal = [] } = {}) {
  globalThis.Deno = { env: { get: k => ({ ...ENV, ...env })[k] } };
  const table = rows.map(r => ({ ...r }));
  const calls = [], wa = [], logs = [], errors = [];
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  const staleLimit = u => { const m = /sent_at\.lt\.([^)]+)\)/.exec(decodeURIComponent(u)); return m ? m[1] : '9999'; };
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET';
    calls.push({ url, method });
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('https://graph.facebook.com/v23.0/PHONE1/messages')) {
      const b = JSON.parse(init.body); wa.push(b);
      const g = graph[b.to];
      return g ? json(g.body, g.status) : json({ messages: [{ id: 'wamid.1' }] });
    }
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/shp_outbox')) {
      const q = decodeURIComponent(url.split('?')[1] || '');
      const open = r => r.status === 'bekliyor' || (r.status === 'gonderiliyor' && r.sent_at && r.sent_at < staleLimit(url));
      if (method === 'GET') return json(table.filter(open).sort((a, b) => a.id - b.id).slice(0, 100).map(r => ({ id: r.id })));
      if (method === 'PATCH' && q.includes('or=')) {            // haberleri al
        const ids = /id=in\.\(([^)]*)\)/.exec(q)[1].split(',').map(Number), body = JSON.parse(init.body), got = [];
        for (const r of table) if (ids.includes(r.id) && open(r) && !steal.includes(r.id)) { Object.assign(r, body); got.push({ ...r }); }
        return json(got);
      }
      if (method === 'PATCH') {                                  // sonucu yaz
        const ids = /id=in\.\(([^)]*)\)/.exec(q)[1].split(',').map(Number), body = JSON.parse(init.body);
        for (const r of table) if (ids.includes(r.id)) Object.assign(r, body);
        return new Response(null, { status: 204 });
      }
    }
    return json({ error: 'beklenmeyen istek ' + method + ' ' + url }, 500);
  };
  const file = path.join(os.tmpdir(), `nakliye-bildirim-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, fs.readFileSync(SRC, 'utf8'));
  let mod;
  try { mod = await importFresh(pathToFileURL(file).href); } finally { fs.unlinkSync(file); }
  return { mod, table, calls, wa, logs, errors };
}
test.afterEach(() => { console.log = realConsole.log; console.error = realConsole.error; delete globalThis.Deno; });

test('telefon yazısı WhatsApp numarasına çevrilir', async () => {
  const { mod } = await setup();
  expect(mod.numara('+90 532 000 00 00')).toBe('905320000000');
  expect(mod.numara('0532 000 00 00')).toBe('905320000000');
  expect(mod.numara('532-000-00-00')).toBe('905320000000');
  expect(mod.numara('00 40 770 984 922')).toBe('40770984922');
  expect(mod.numara('123')).toBe('');
  expect(mod.numara('')).toBe('');
});

test('aynı müşteri ve haber türü tek mesajda birleşir; metin ofisteki ve müşteri sayfasındakiyle aynıdır', async () => {
  const { mod } = await setup();
  const g = mod.grupla([row(1, 'a', 'geldi', '0532 000 00 00', 'X → Y · 4 kap · 100 kg'), row(2, 'a', 'geldi', '0532 000 00 00', 'Z → W · 2 kap · 50 kg'),
    row(3, 'a', 'sorun', '0532 000 00 00', 'X → Y: eksik var'), row(4, 'b', 'geldi', '0533 000 00 00', 'Q → R')]);
  expect(g).toHaveLength(3);
  expect(mod.metin(g[0])).toBe('📦 Yükünüz depoya geldi\nX → Y · 4 kap · 100 kg\nZ → W · 2 kap · 50 kg');
  expect(mod.metin({ event: 'yola', items: [{ body: '34 ABC 123 · PCS-26-0001' }] })).toBe('🚚 Aracınız yola çıktı\n34 ABC 123 · PCS-26-0001\nLade Liste ve CMR belgeleriniz hazır.');
  expect(mod.metin({ event: 'teslim', items: [{ body: 'x' }] })).toContain('✅ Yükünüz teslim edildi');
  expect(mod.metin({ event: 'mesaj', items: [{ body: 'x' }] })).toContain('💬 Yeni mesaj');
});

test('şablon adı verilirse şablon, verilmezse düz yazı gönderilir; şablon değişkeninde satır sonu olmaz', async () => {
  const g = { phone: '0532 000 00 00', event: 'geldi', items: [{ body: 'X → Y' }, { body: 'Z → W' }] };
  let { mod } = await setup();
  expect(mod.govde(g).type).toBe('text');
  expect(mod.govde(g).to).toBe('905320000000');
  ({ mod } = await setup({ env: { WA_SABLON: 'nakliye_haber', WA_SABLON_DIL: 'tr' } }));
  const t = mod.govde(g);
  expect(t.type).toBe('template'); expect(t.template.name).toBe('nakliye_haber'); expect(t.template.language.code).toBe('tr');
  expect(t.template.components[0].parameters[0].text).toBe('📦 Yükünüz depoya geldi | X → Y | Z → W');
  expect(mod.sablonMetni('a\nb\n\nc  d')).toBe('a | b | c d');
});

test('Meta hata cevabı ofisin anlayacağı cümleye çevrilir', async () => {
  const { mod } = await setup();
  expect(mod.hataMetni(400, JSON.stringify({ error: { code: 131047, message: 'Re-engagement message' } }))).toContain('onaylı şablon gerekir');
  expect(mod.hataMetni(400, JSON.stringify({ error: { code: 132001, message: 'Template name does not exist' } }))).toContain('Şablon bulunamadı');
  expect(mod.hataMetni(401, JSON.stringify({ error: { code: 190, message: 'Invalid OAuth access token' } }))).toContain('WA_TOKEN');
  expect(mod.hataMetni(500, 'çöktü')).toContain('WhatsApp 500');
});

test('bekleyen haberler gönderilir; birleşir, geçersiz numara ve Meta hatası işaretlenir, başkasının aldığı ve gönderilmiş haberlere dokunulmaz', async () => {
  const rows = [
    row(1, 'a', 'geldi', '+90 532 000 00 00', 'X → Y · 4 kap · 100 kg'), row(2, 'a', 'geldi', '+90 532 000 00 00', 'Z → W · 2 kap · 50 kg'),
    row(3, 'b', 'teslim', '+90 533 000 00 00', '34 ABC 123 · PCS-26-0001'),
    row(4, 'c', 'geldi', '12', 'bozuk numara'),
    row(5, 'd', 'geldi', '+90 534 000 00 00', 'zaten gönderilmiş', { status: 'gonderildi', sent_at: ago(3600000) }),
    row(6, 'e', 'geldi', '+90 535 000 00 00', 'başka çağrı gönderiyor', { status: 'gonderiliyor', sent_at: ago(20000) }),
    row(7, 'f', 'yola', '+90 536 000 00 00', '06 ZZ 999 · PCS-26-0002', { status: 'gonderiliyor', sent_at: ago(15 * 60000) })   // yarıda kalmış: yeniden denenir
  ];
  const { mod, table, wa, errors } = await setup({ rows, graph: { 905330000000: { status: 400, body: { error: { code: 131047, message: 'Re-engagement message' } } } } });
  const r = await mod.flush();
  expect(r).toEqual({ sent: 2, failed: 2 });
  expect(wa).toHaveLength(3);                                                       // a (birleşik), b, f; bozuk numara gönderilmez
  const to = n => wa.find(w => w.to === n);
  expect(to('905320000000').text.body).toBe('📦 Yükünüz depoya geldi\nX → Y · 4 kap · 100 kg\nZ → W · 2 kap · 50 kg');
  expect(to('905360000000').text.body).toContain('Lade Liste ve CMR belgeleriniz hazır.');
  const by = id => table.find(t => t.id === id);
  expect([by(1).status, by(2).status, by(7).status]).toEqual(['gonderildi', 'gonderildi', 'gonderildi']);
  expect(by(1).sent_at).toBeTruthy(); expect(by(1).error).toBe('');
  expect(by(3).status).toBe('hata'); expect(by(3).error).toContain('onaylı şablon gerekir');
  expect(by(4).status).toBe('hata'); expect(by(4).error).toBe('Telefon numarası geçersiz');
  expect(by(5).status).toBe('gonderildi'); expect(by(5).body).toBe('zaten gönderilmiş');
  expect(by(6).status).toBe('gonderiliyor');                                        // başka çağrı üzerinde; dokunulmadı
  expect(errors.length).toBe(2);
  // ikinci çalışma: gönderilecek bir şey kalmadı
  const again = await mod.flush();
  expect(again).toEqual({ sent: 0, failed: 0 }); expect(wa).toHaveLength(3);
});

test('aynı anda çalışan iki çağrı aynı haberi iki kez göndermez', async () => {
  const rows = [row(1, 'a', 'geldi', '+90 532 000 00 00', 'bir'), row(2, 'a', 'geldi', '+90 532 000 00 00', 'iki')];
  const { mod, wa, table } = await setup({ rows, steal: [2] });                      // 2 numaralı haberi başka çağrı almış
  const r = await mod.flush();
  expect(r).toEqual({ sent: 1, failed: 0 });
  expect(wa).toHaveLength(1); expect(wa[0].text.body).toContain('bir'); expect(wa[0].text.body).not.toContain('iki');
  expect(table.find(t => t.id === 2).status).toBe('bekliyor');
});

test('gizli ayarlar eksikse hiçbir şey yapılmaz, haberler bekler', async () => {
  const { mod, calls, table } = await setup({ env: { WA_PHONE_ID: '' }, rows: [row(1, 'a', 'geldi', '+90 532 000 00 00', 'x')] });
  const r = await mod.flush();
  expect(r).toMatchObject({ sent: 0, failed: 0, ayar: 'eksik' });
  expect(calls).toHaveLength(0); expect(table[0].status).toBe('bekliyor');
});

test('şablon ayarlıysa şablon gönderilir; ağ hatası "hata" olarak yazılır, fonksiyon çökmez', async () => {
  const rows = [row(1, 'a', 'geldi', '+90 532 000 00 00', 'X → Y')];
  let s = await setup({ env: { WA_SABLON: 'nakliye_haber' }, rows });
  await s.mod.flush();
  expect(s.wa[0].type).toBe('template'); expect(s.table[0].status).toBe('gonderildi');
  s = await setup({ rows });
  const ok = globalThis.fetch;
  globalThis.fetch = async (u, i) => String(u).startsWith('https://graph.facebook.com') ? Promise.reject(new Error('ağ yok')) : ok(u, i);
  const r = await s.mod.flush();
  expect(r).toEqual({ sent: 0, failed: 1 });
  expect(s.table[0].status).toBe('hata'); expect(s.table[0].error).toContain('ağ yok');
});

test('adres: normal çağrı hemen 202 döner, gönderim arka planda biter; ?bekle=0 beklemeden sonucu yazar', async () => {
  const rows = [row(1, 'a', 'geldi', '+90 532 000 00 00', 'x')];
  const s = await setup({ rows });
  const res = await s.mod.handle(new Request('https://proje.supabase.co/functions/v1/nakliye-bildirim', { method: 'POST', body: '{}' }));
  expect(res.status).toBe(202); expect(await res.json()).toEqual({ ok: true });
  await s.mod.idle();
  expect(s.table[0].status).toBe('gonderildi'); expect(s.wa).toHaveLength(1);
  const s2 = await setup({ rows: [row(1, 'a', 'geldi', '+90 532 000 00 00', 'x')] });
  const res2 = await s2.mod.handle(new Request('https://proje.supabase.co/functions/v1/nakliye-bildirim?bekle=0'));
  expect(res2.status).toBe(200); expect(await res2.json()).toEqual({ sent: 1, failed: 0 });
  const s3 = await setup({ env: { WA_TOKEN: '' } });
  expect(await (await s3.mod.handle(new Request('https://x/functions/v1/nakliye-bildirim?bekle=0'))).json()).toMatchObject({ ayar: 'eksik' });
  expect((await s3.mod.handle(new Request('https://x/', { method: 'OPTIONS' }))).status).toBe(204);
});
