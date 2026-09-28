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

async function setup({ env = {}, existing = [], old = [], mediaFails = false } = {}) {
  globalThis.Deno = { env: { get: k => ({ ...ENV, ...env })[k] } };
  const log = [];
  const rows = [];
  const errors = [];
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
  return { mod, log, rows, errors, post };
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
});
