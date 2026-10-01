// WhatsApp sunucu fonksiyonunun (supabase/functions/whatsapp-webhook/index.ts) testleri.
// Tarayıcı açılmaz: fonksiyon Node'da çalıştırılır; Meta ve Supabase yerine sahte fetch cevap verir.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'whatsapp-webhook', 'index.ts');
const ENV = {
  SUPABASE_URL: 'https://proje.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servis-anahtari',
  WA_VERIFY_TOKEN: 'dogrulama-parolasi', WA_APP_SECRET: 'uygulama-gizli', WA_TOKEN: 'meta-anahtari'
};
const importFresh = new Function('u', 'return import(u)'); // derleyici dokunmasın diye
const realConsoleError = console.error;

// read: ruhsat-oku fonksiyonunun cevapları sırayla ({ status, body }); son eleman tekrar eder.
// noAiCol: tabloda "ai" sütunu yokmuş gibi davranır.
async function setup({ env = {}, existing = [], old = [], mediaFails = false, read = [], noAiCol = false } = {}) {
  globalThis.Deno = { env: { get: k => ({ ...ENV, ...env })[k] } };
  const log = [];
  const rows = [];
  const errors = [];
  const patches = [];
  console.error = (...a) => errors.push(a.join(' ')); // fonksiyonun hata kayıtları test çıktısını kirletmesin
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET', headers = init.headers || {};
    log.push({ url, method, headers, body: init.body });
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.startsWith('https://graph.facebook.com/v23.0/MEDIA1')) return mediaFails ? json({ error: 'yok' }, 404) : json({ url: 'https://lookaside.fbsbx.com/whatsapp/?mid=1', mime_type: 'image/jpeg' });
    if (url.startsWith('https://lookaside.fbsbx.com/')) return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]));
    if (url.startsWith('https://graph.facebook.com/v23.0/PHONE1/messages')) return json({ messages: [{ id: 'wamid.cevap' }] });
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?select=id&wa_message_id=')) return json(existing.filter(id => url.endsWith(encodeURIComponent(id))).map(id => ({ id })));
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?select=id,media_path')) return json(old);
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?on_conflict=') && method === 'POST') { rows.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
    if (url.startsWith(ENV.SUPABASE_URL + '/storage/v1/object/ruhsat-gelen')) return json({ Key: 'ok' });
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?id=in.') && method === 'PATCH') return new Response(null, { status: 204 });
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?wa_message_id=eq.') && method === 'PATCH') {
      const body = JSON.parse(init.body);
      if (noAiCol && 'ai' in body) return json({ code: 'PGRST204', message: "Could not find the 'ai' column of 'incoming_ruhsat' in the schema cache" }, 400);
      patches.push({ url, body }); return new Response(null, { status: 204 });
    }
    if (url === ENV.SUPABASE_URL + '/functions/v1/ruhsat-oku' && method === 'POST') {
      const r = read.length > 1 ? read.shift() : read[0];
      return r ? json(r.body, r.status || 200) : json({ error: 'kurulu değil' }, 404);
    }
    return json({ error: 'beklenmeyen istek ' + method + ' ' + url }, 500);
  };
  const file = path.join(os.tmpdir(), `wa-webhook-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, fs.readFileSync(SRC, 'utf8'));
  let mod;
  try { mod = await importFresh(pathToFileURL(file).href); } finally { fs.unlinkSync(file); }
  const post = (payload, secret = ENV.WA_APP_SECRET) => {
    const body = JSON.stringify(payload);
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    return mod.handle(new Request('https://proje.supabase.co/functions/v1/whatsapp-webhook', { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig } }));
  };
  return { mod, log, rows, errors, patches, post };
}

// Meta'nın gönderdiği biçimde bildirim
const notify = (...messages) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA1', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { display_phone_number: '902120000000', phone_number_id: 'PHONE1' },
    contacts: [{ profile: { name: 'Ali Şoför' }, wa_id: '905321112233' }], messages
  } }] }]
});
const image = (id, extra = {}) => ({ from: '905321112233', id, timestamp: '1790058600', type: 'image', image: { id: 'MEDIA1', mime_type: 'image/jpeg', caption: 'PB 1234 AB' }, ...extra });

test.describe('WhatsApp sunucu fonksiyonu', () => {
  test.afterEach(() => { console.error = realConsoleError; });

  test('Meta doğrulaması: parola tutarsa verilen sayı geri döner', async () => {
    const { mod } = await setup();
    const get = q => mod.handle(new Request('https://x/functions/v1/whatsapp-webhook?' + q));
    const ok = await get('hub.mode=subscribe&hub.verify_token=dogrulama-parolasi&hub.challenge=12345');
    expect([ok.status, await ok.text()]).toEqual([200, '12345']);
    expect((await get('hub.mode=subscribe&hub.verify_token=yanlis&hub.challenge=1')).status).toBe(403);
  });

  test('imzası tutmayan istek reddedilir, hiçbir şey kaydedilmez', async () => {
    const { log, post } = await setup();
    expect((await post(notify(image('wamid.A')), 'baska-anahtar')).status).toBe(401);
    expect(log).toEqual([]);
  });

  test('fotoğraf depoya konur, kutuya satır eklenir, gönderene ✅ ile tepki verilir', async () => {
    const { log, rows, post } = await setup();
    const res = await post(notify(image('wamid.ABC=')));
    expect(res.status).toBe(200);
    expect(rows).toEqual([{
      wa_message_id: 'wamid.ABC=', from_number: '905321112233', sender_name: 'Ali Şoför', caption: 'PB 1234 AB',
      media_path: '2026-09-22/wamid_ABC_.jpg', mime: 'image/jpeg', created_at: '2026-09-22T06:30:00.000Z'
    }]);
    const upload = log.find(l => l.url.startsWith(ENV.SUPABASE_URL + '/storage/v1/object/ruhsat-gelen/'));
    expect(upload.url).toBe(ENV.SUPABASE_URL + '/storage/v1/object/ruhsat-gelen/2026-09-22/wamid_ABC_.jpg');
    expect(upload.headers).toMatchObject({ apikey: 'servis-anahtari', Authorization: 'Bearer servis-anahtari', 'Content-Type': 'image/jpeg' });
    expect(log.find(l => l.url.startsWith('https://lookaside')).headers.Authorization).toBe('Bearer meta-anahtari');
    const reply = log.find(l => l.url.endsWith('/PHONE1/messages'));
    expect(JSON.parse(reply.body)).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '905321112233', type: 'reaction', reaction: { message_id: 'wamid.ABC=', emoji: '✅' } });
  });

  test('aynı mesaj tekrar gelirse ikinci kez indirilmez ve eklenmez', async () => {
    const { log, rows, post } = await setup({ existing: ['wamid.ABC'] });
    expect((await post(notify(image('wamid.ABC')))).status).toBe(200);
    expect(rows).toEqual([]);
    expect(log.some(l => l.url.includes('graph.facebook.com'))).toBe(false);
  });

  test('yazı mesajına ne gönderileceği yazılır; cevaplar kapatılabilir', async () => {
    const text = { from: '905321112233', id: 'wamid.T', timestamp: '1790058600', type: 'text', text: { body: 'merhaba' } };
    const a = await setup();
    await a.post(notify(text));
    expect(JSON.parse(a.log.find(l => l.url.endsWith('/PHONE1/messages')).body).text.body).toContain('ruhsatının fotoğrafını gönderin');
    const b = await setup({ env: { WA_REPLY: 'kapali' } });
    await b.post(notify(image('wamid.B'), text));
    expect(b.rows.length).toBe(1);
    expect(b.log.some(l => l.url.endsWith('/PHONE1/messages'))).toBe(false);
  });

  test('fotoğraf indirilemezse 500 döner (Meta tekrar dener), yarım kayıt açılmaz', async () => {
    const { rows, errors, post } = await setup({ mediaFails: true });
    expect((await post(notify(image('wamid.C')))).status).toBe(500);
    expect(rows).toEqual([]);
    expect(errors.join('\n')).toContain('Fotoğraf bilgisi alınamadı: 404');
  });

  test('60 günden eski fotoğraflar depodan silinir, satırdaki bilgiler kalır', async () => {
    const { log, post } = await setup({ old: [{ id: 'u1', media_path: '2026-07-01/a.jpg' }, { id: 'u2', media_path: '2026-07-02/b.jpg' }] });
    expect((await post(notify(image('wamid.D')))).status).toBe(200);
    const del = log.find(l => l.method === 'DELETE');
    expect(del.url).toBe(ENV.SUPABASE_URL + '/storage/v1/object/ruhsat-gelen');
    expect(JSON.parse(del.body)).toEqual({ prefixes: ['2026-07-01/a.jpg', '2026-07-02/b.jpg'] });
    const patch = log.find(l => l.method === 'PATCH');
    expect(patch.url).toBe(ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?id=in.(u1,u2)');
    expect(JSON.parse(patch.body)).toEqual({ media_path: null });
  });

  test('Gemini kuruluysa fotoğraf hemen sunucuda okunur, sonuç satıra yazılır (pano açık olmasa da)', async () => {
    const vehicles = [{ plate: 'PB5678CD', kind: 'trailer', empty_weight_kg: 6700, country: 'BG' }, { plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8150, country: 'BG' }];
    const { mod, log, rows, patches, post } = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [{ body: { vehicles, problem: '', model: 'gemini-test' } }] });
    expect((await post(notify(image('wamid.E')))).status).toBe(200);
    // satır "sunucuda okunuyor" diye açılır: açık ekranlar üstlenmez
    expect(rows[0]).toMatchObject({ wa_message_id: 'wamid.E', status: 'okunuyor' });
    expect(Date.parse(rows[0].claimed_at)).toBeGreaterThan(0);
    await mod.idle();
    const call = log.find(l => l.url.endsWith('/functions/v1/ruhsat-oku'));
    expect(call.headers).toMatchObject({ Authorization: 'Bearer servis-anahtari', 'Content-Type': 'image/jpeg' });
    expect([...call.body]).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    expect(patches).toEqual([{
      url: ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?wa_message_id=eq.wamid.E&status=eq.okunuyor&claimed_by=is.null',
      body: { status: 'bekliyor', claimed_at: null, tractor: 'PB1234AB', trailer: 'PB5678CD', weights: [8150, 6700], fuzzy: false, note: '', ai: { vehicles, problem: '', model: 'gemini-test' } }
    }]);
    // okunduysa gönderene ✅ dışında bir şey gitmez
    expect(log.filter(l => l.url.endsWith('/PHONE1/messages')).map(l => JSON.parse(l.body).type)).toEqual(['reaction']);
  });

  test('ruhsat okunamadıysa gönderene ⚠️ ile tepki verilir, yeniden çekmesi istenir', async () => {
    const { mod, log, patches, post } = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [{ body: { vehicles: [{ plate: '', kind: 'other', empty_weight_kg: null }], problem: 'Fotoğraf çok bulanık.' } }] });
    await post(notify(image('wamid.F')));
    await mod.idle();
    expect(patches[0].body).toMatchObject({ status: 'bekliyor', tractor: '', trailer: '', note: 'Yapay zekâ ruhsatı okuyamadı · Fotoğraf çok bulanık.' });
    const sent = log.filter(l => l.url.endsWith('/PHONE1/messages')).map(l => JSON.parse(l.body));
    expect(sent.map(m => m.type === 'reaction' ? m.reaction.emoji : 'yazı')).toEqual(['✅', '⚠️', 'yazı']);
    expect(sent[2].context).toEqual({ message_id: 'wamid.F' });
    expect(sent[2].text.body).toContain('ruhsat okunamadı (Fotoğraf çok bulanık)');
    expect(sent[2].text.body).toContain('send it again');
    // cevaplar kapalıysa yeniden çekme isteği de gitmez
    const quiet = await setup({ env: { GEMINI_API_KEY: 'g', WA_REPLY: 'kapali' }, read: [{ body: { vehicles: [], problem: '' } }] });
    await quiet.post(notify(image('wamid.G')));
    await quiet.mod.idle();
    expect(quiet.patches.length).toBe(1);
    expect(quiet.log.some(l => l.url.endsWith('/PHONE1/messages'))).toBe(false);
  });

  test('Gemini sınırı doluysa söylediği süre beklenip yeniden sorulur; yine olmazsa fotoğraf açık ekranlara bırakılır', async () => {
    const ok = { body: { vehicles: [{ plate: '34ABC123', kind: 'tractor', empty_weight_kg: 8000 }], problem: '' } };
    const a = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [{ status: 429, body: { error: 'Gemini 429', retry_after: 1 } }, ok] });
    await a.post(notify(image('wamid.H')));
    await a.mod.idle();
    expect(a.log.filter(l => l.url.endsWith('/functions/v1/ruhsat-oku')).length).toBe(2);
    expect(a.patches.map(p => p.body.status)).toEqual(['bekliyor']);
    // anahtar geçersiz (beklemekle düzelmez) ya da ruhsat-oku kurulu değil: tarayıcı okusun
    for (const read of [[{ status: 502, body: { error: 'Gemini 400', fatal: true } }], []]) {
      const b = await setup({ env: { GEMINI_API_KEY: 'g' }, read });
      await b.post(notify(image('wamid.I')));
      await b.mod.idle();
      expect(b.log.filter(l => l.url.endsWith('/functions/v1/ruhsat-oku')).length).toBe(1);
      expect(b.patches.map(p => p.body)).toEqual([{ status: 'yeni', claimed_at: null }]);
      expect(b.log.filter(l => l.url.endsWith('/PHONE1/messages')).length).toBe(1); // yalnızca ✅
    }
  });

  test('"ai" sütunu henüz eklenmemişse okunan bilgiler onsuz yazılır; Gemini yoksa sunucuda okunmaz', async () => {
    const { mod, patches, post } = await setup({ env: { GEMINI_API_KEY: 'g' }, noAiCol: true, read: [{ body: { vehicles: [{ plate: '34ABC123', kind: 'tractor', empty_weight_kg: 8000 }], problem: '' } }] });
    await post(notify(image('wamid.J')));
    await mod.idle();
    expect(patches.map(p => [p.body.tractor, 'ai' in p.body])).toEqual([['34ABC123', false]]);
    const none = await setup();
    await none.post(notify(image('wamid.K')));
    await none.mod.idle();
    expect('status' in none.rows[0]).toBe(false);
    expect(none.log.some(l => l.url.includes('/functions/v1/'))).toBe(false);
  });
});
