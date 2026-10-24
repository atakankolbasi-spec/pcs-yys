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
// msgExisting: kayıtlı mesaj kimlikleri · msgRecent: bu numaradan son saatteki mesaj sayısı · noMsgTable: tablo kurulu değil
async function setup({ env = {}, existing = [], old = [], mediaFails = false, read = [], noAiCol = false, msgExisting = [], msgRecent = 0, noMsgTable = false } = {}) {
  globalThis.Deno = { env: { get: k => ({ ...ENV, ...env })[k] } };
  const log = [];
  const rows = [];
  const errors = [];
  const patches = [];
  const msgRows = [], msgPatches = [], msgDeletes = [];
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
    if (url.startsWith(ENV.SUPABASE_URL + '/rest/v1/incoming_messages')) {
      if (noMsgTable) return json({ code: 'PGRST205', message: "Could not find the table 'public.incoming_messages' in the schema cache" }, 404);
      if (url.includes('?select=id&wa_message_id=')) return json(msgExisting.filter(id => url.endsWith(encodeURIComponent(id))).map(id => ({ id })));
      if (url.includes('?select=id&from_number=')) return json(Array.from({ length: Math.min(msgRecent, 20) }, (_, i) => ({ id: 'r' + i })));
      if (url.includes('?on_conflict=') && method === 'POST') { msgRows.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); }
      if (method === 'PATCH') { msgPatches.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); }
      if (method === 'DELETE') { msgDeletes.push(url); return new Response(null, { status: 204 }); }
    }
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
  return { mod, log, rows, errors, patches, msgRows, msgPatches, msgDeletes, post };
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

  test('ruhsat çıkmayan fotoğraf araç listesi olarak okunur: onay bekleyen mesaj olur, fotoğraf satırı kapanır, ⚠️ gitmez', async () => {
    const items = [{ action: 'add', tractor: 'PB7831KT', trailer: 'PB7569EB', date: '', time: '', note: '', parties: ['GALATA PETROL'], fee: '90 EURO' }];
    const noCard = { body: { vehicles: [], problem: 'Fotoğrafta ruhsat yok.', model: 'm' } };
    const list = { body: { items, customer: 'ETL LOJ', problem: '', model: 'gemini-test' } };
    const { mod, log, rows, patches, msgRows, post } = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [noCard, list] });
    expect((await post(notify(image('wamid.L', { image: { id: 'MEDIA1', mime_type: 'image/jpeg', caption: 'yarın gelecekler' } })))).status).toBe(200);
    await mod.idle();
    // önce ruhsat okunur, ruhsat çıkmayınca aynı fotoğraf "liste" modunda okunur (Türkiye saatiyle bugün başlıkta)
    const reads = log.filter(l => l.url.endsWith('/functions/v1/ruhsat-oku'));
    expect(reads.length).toBe(2);
    expect(reads[0].headers['x-pcs-mode']).toBeUndefined();
    expect(reads[1].headers['x-pcs-mode']).toBe('liste');
    expect(reads[1].headers['x-pcs-today']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([...reads[1].body]).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    // liste onay bekleyen mesaj olarak kaydedilir; gönderen ve açıklama korunur
    expect(msgRows.length).toBe(1);
    expect(msgRows[0]).toMatchObject({ wa_message_id: 'wamid.L', from_number: '905321112233', sender_name: 'Ali Şoför', status: 'bekliyor', body: 'yarın gelecekler\n(Fotoğraftaki liste)' });
    expect(msgRows[0].ai).toEqual({ items, customer: 'ETL LOJ', problem: '', model: 'gemini-test', image: true });
    expect(msgRows[0].created_at).toBe(rows[0].created_at);
    // fotoğraf satırı ruhsat olarak onaya düşmez: kapanır
    expect(patches).toEqual([{
      url: ENV.SUPABASE_URL + '/rest/v1/incoming_ruhsat?wa_message_id=eq.wamid.L&status=eq.okunuyor&claimed_by=is.null',
      body: { status: 'yoksayildi', claimed_at: null, note: 'Araç listesi olarak okundu' }
    }]);
    // gönderene yalnızca ✅ gider
    expect(log.filter(l => l.url.endsWith('/PHONE1/messages')).map(l => JSON.parse(l.body).type)).toEqual(['reaction']);
  });

  test('ruhsat da liste de çıkmazsa ya da mesaj tablosu yoksa eski yol: satır ruhsat olarak kalır, ⚠️ gider', async () => {
    const noCard = { body: { vehicles: [], problem: 'Fotoğraf çok bulanık.', model: 'm' } };
    const a = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [noCard, { body: { items: [], customer: '', problem: 'Liste yok.', model: 'm' } }] });
    await a.post(notify(image('wamid.M')));
    await a.mod.idle();
    expect(a.msgRows.length).toBe(0);
    expect(a.patches.length).toBe(1);
    expect(a.patches[0].body).toMatchObject({ status: 'bekliyor', note: 'Yapay zekâ ruhsatı okuyamadı · Fotoğraf çok bulanık.' });
    expect(a.log.filter(l => l.url.endsWith('/PHONE1/messages')).map(l => { const m = JSON.parse(l.body); return m.type === 'reaction' ? m.reaction.emoji : 'yazı'; })).toEqual(['✅', '⚠️', 'yazı']);
    // liste çıktı ama mesaj tablosu kurulu değil: fotoğraf satırı ruhsat olarak kalır
    const items = [{ action: 'add', tractor: 'PB7831KT', trailer: '', date: '', time: '', note: '', parties: [], fee: '' }];
    const b = await setup({ env: { GEMINI_API_KEY: 'g' }, noMsgTable: true, read: [noCard, { body: { items, customer: '', problem: '', model: 'm' } }] });
    await b.post(notify(image('wamid.N')));
    await b.mod.idle();
    expect(b.patches.length).toBe(1);
    expect(b.patches[0].body.status).toBe('bekliyor');
    expect(b.errors.join('\n')).toContain('mesaj-kurulumu.sql');
    // ruhsat okunduysa liste modu hiç denenmez (Gemini çağrısı artmaz)
    const c = await setup({ env: { GEMINI_API_KEY: 'g' }, read: [{ body: { vehicles: [{ plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8000 }], problem: '', model: 'm' } }] });
    await c.post(notify(image('wamid.O')));
    await c.mod.idle();
    expect(c.log.filter(l => l.url.endsWith('/functions/v1/ruhsat-oku')).length).toBe(1);
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

  // ---- Yazı mesajları (müşterinin "bu araçlar gelecek" yazısı) ----
  const GEMINI = { GEMINI_API_KEY: 'gemini-anahtari' };
  const text = (id, body, extra = {}) => ({ from: '905321112233', id, timestamp: '1790058600', type: 'text', text: { body }, ...extra });
  const sentToWa = log => log.filter(l => l.url.endsWith('/PHONE1/messages')).map(l => JSON.parse(l.body));
  const LIST = 'Yarın şu araçlar gelecek: 34 ABC 123 / PB 5678 CD ve CB 1234 AB';
  const READ_OK = { body: { items: [{ action: 'add', tractor: '34ABC123', trailer: 'PB5678CD', date: '2026-10-23', time: '', note: '' }, { action: 'add', tractor: 'CB1234AB', trailer: '', date: '2026-10-23', time: '', note: '' }], customer: 'ETL LOJ', problem: '', model: 'gemini-test' } };

  test('yazı mesajı kaydedilir, Gemini’ye okutulur, sonuç satıra yazılır ve gönderene ✅ ile tepki verilir', async () => {
    const { mod, log, msgRows, msgPatches, post } = await setup({ env: GEMINI, read: [READ_OK] });
    expect((await post(notify(text('wamid.M1', LIST)))).status).toBe(200);
    await mod.idle();
    // satır "okunuyor" olarak açılır; mesajın yazısı, gönderen ve zaman kaydedilir
    expect(msgRows).toEqual([{ wa_message_id: 'wamid.M1', from_number: '905321112233', sender_name: 'Ali Şoför', body: LIST, status: 'okunuyor', created_at: '2026-09-22T06:30:00.000Z' }]);
    // ruhsat-oku'ya mesaj modunda (JSON) gider; fotoğraf indirilmez
    const call = log.find(l => l.url.endsWith('/functions/v1/ruhsat-oku'));
    expect(call.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(call.body)).toEqual({ text: LIST });
    expect(log.some(l => l.url.includes('lookaside') || l.url.includes('storage'))).toBe(false);
    // okunan araçlar satıra yazılır: onay bekler
    expect(msgPatches.length).toBe(1);
    expect(msgPatches[0].url).toContain('incoming_messages?wa_message_id=eq.wamid.M1&status=eq.okunuyor');
    expect(msgPatches[0].body.status).toBe('bekliyor');
    expect(msgPatches[0].body.ai.items.map(v => [v.tractor, v.trailer, v.date])).toEqual([['34ABC123', 'PB5678CD', '2026-10-23'], ['CB1234AB', '', '2026-10-23']]);
    expect(msgPatches[0].body.ai.customer).toBe('ETL LOJ');
    // gönderene ✅ ile tepki; yazılı cevap gitmez
    expect(sentToWa(log)).toEqual([{ messaging_product: 'whatsapp', recipient_type: 'individual', to: '905321112233', type: 'reaction', reaction: { message_id: 'wamid.M1', emoji: '✅' } }]);
  });

  test('mesajda araç yoksa satır yoksayılır ve gönderene ne gönderebileceği yazılır; rakamsız yazı Gemini’ye gitmez', async () => {
    const a = await setup({ env: GEMINI, read: [{ body: { items: [], customer: '', problem: 'Mesajda plaka yok.', model: 'gemini-test' } }] });
    await a.post(notify(text('wamid.M2', 'Merhaba, yarın görüşelim saat 10'))); await a.mod.idle();
    expect(a.msgPatches[0].body).toMatchObject({ status: 'yoksayildi', note: 'Araç bulunamadı · Mesajda plaka yok.' });
    const reply = sentToWa(a.log)[0];
    expect(reply.type).toBe('text');
    expect(reply.context).toEqual({ message_id: 'wamid.M2' });
    expect(reply.text.body).toContain('gelecek araçların plakalarını');
    // rakam içermeyen yazı: kaydedilmez, Gemini'ye gitmez, yalnızca yönlendirme gider
    const b = await setup({ env: GEMINI, read: [READ_OK] });
    await b.post(notify(text('wamid.M3', 'Teşekkürler, iyi çalışmalar'))); await b.mod.idle();
    expect(b.msgRows).toEqual([]);
    expect(b.log.some(l => l.url.endsWith('/functions/v1/ruhsat-oku'))).toBe(false);
    expect(sentToWa(b.log)[0].text.body).toContain('gelecek araçların plakalarını');
  });

  test('Gemini mesajı okuyamazsa satır "hata" olur (siteden yeniden okutulur); tekrarlanan bildirim ikinci kez işlenmez', async () => {
    const a = await setup({ env: GEMINI, read: [{ status: 502, body: { error: 'Gemini 502', fatal: true } }] });
    expect((await a.post(notify(text('wamid.M4', LIST)))).status).toBe(200);
    await a.mod.idle();
    expect(a.msgPatches[0].body).toEqual({ status: 'hata', note: 'Yapay zekâ mesajı okuyamadı' });
    expect(sentToWa(a.log)).toEqual([]); // okunamayan mesaja tepki verilmez
    const b = await setup({ env: GEMINI, read: [READ_OK], msgExisting: ['wamid.M4'] });
    await b.post(notify(text('wamid.M4', LIST))); await b.mod.idle();
    expect(b.msgRows).toEqual([]);
    expect(b.log.some(l => l.url.endsWith('/functions/v1/ruhsat-oku'))).toBe(false);
  });

  test('aynı numaradan saatte 20’den fazla mesaj okunmaz; tablo kurulu değilse ya da Gemini yoksa eski cevap gider', async () => {
    const a = await setup({ env: GEMINI, read: [READ_OK], msgRecent: 20 });
    await a.post(notify(text('wamid.M5', LIST))); await a.mod.idle();
    expect(a.msgRows).toEqual([]);
    expect(a.log.some(l => l.url.endsWith('/functions/v1/ruhsat-oku'))).toBe(false);
    expect(sentToWa(a.log)).toEqual([]);
    // tablo kurulu değil: mesaj kaydedilemez, gönderen eski yönlendirmeyi alır (sessiz kalmaz)
    const b = await setup({ env: GEMINI, read: [READ_OK], noMsgTable: true });
    expect((await b.post(notify(text('wamid.M6', LIST)))).status).toBe(200);
    expect(sentToWa(b.log)[0].text.body).toContain('ruhsatının fotoğrafını gönderin');
    expect(b.errors.join('\n')).toContain('mesaj-kurulumu.sql');
    // Gemini kurulu değil: yazı hiç kaydedilmez
    const c = await setup({ read: [READ_OK] });
    await c.post(notify(text('wamid.M7', LIST))); await c.mod.idle();
    expect(c.log.some(l => l.url.includes('incoming_messages'))).toBe(false);
    expect(sentToWa(c.log)[0].text.body).toContain('ruhsatının fotoğrafını gönderin');
  });

  test('uzun yazı 4000 karaktere kırpılır; kapanmış 60 günden eski mesajlar silinir', async () => {
    const { mod, log, msgRows, msgDeletes, post } = await setup({ env: GEMINI, read: [READ_OK] });
    await post(notify(text('wamid.M8', '34 ABC 123 ' + 'x'.repeat(5000)))); await mod.idle();
    expect(msgRows[0].body.length).toBe(4000);
    expect(msgDeletes.length).toBe(1);
    expect(msgDeletes[0]).toMatch(/incoming_messages\?status=in\.\(eklendi,yoksayildi,hata\)&created_at=lt\./);
    expect(log.find(l => l.url.includes('incoming_messages') && l.method === 'DELETE').headers.Prefer).toBe('return=minimal');
  });
});
