// Ruhsat okuma sunucu fonksiyonunun (supabase/functions/ruhsat-oku/index.ts) testleri.
// Tarayıcı açılmaz: fonksiyon Node'da çalıştırılır; Supabase ve Gemini yerine sahte fetch cevap verir.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'ruhsat-oku', 'index.ts');
const ENV = { SUPABASE_URL: 'https://proje.supabase.co', GEMINI_API_KEY: 'gemini-anahtari' };
const importFresh = new Function('u', 'return import(u)'); // derleyici dokunmasın diye
const realConsoleError = console.error;

async function setup({ env = {}, role = 'editor', gemini } = {}) {
  globalThis.Deno = { env: { get: k => ({ ...ENV, ...env })[k] } };
  const log = [];
  console.error = () => {};
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input), headers = init.headers || {};
    log.push({ url, headers, body: init.body });
    const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === ENV.SUPABASE_URL + '/rest/v1/rpc/current_app_role') return headers.Authorization === 'Bearer kullanici' ? json(role) : json({ message: 'JWT' }, 401);
    if (url.startsWith('https://generativelanguage.googleapis.com/')) return gemini(url, JSON.parse(init.body), headers);
    return json({ error: 'beklenmeyen istek ' + url }, 500);
  };
  const file = path.join(os.tmpdir(), `ruhsat-oku-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, fs.readFileSync(SRC, 'utf8'));
  let mod;
  try { mod = await importFresh(pathToFileURL(file).href); } finally { fs.unlinkSync(file); }
  const post = (headers = {}, body = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])) => mod.handle(new Request('https://proje.supabase.co/functions/v1/ruhsat-oku', {
    method: 'POST', body, headers: { Authorization: 'Bearer kullanici', apikey: 'sb_publishable_x', 'Content-Type': 'image/jpeg', ...headers }
  }));
  return { mod, log, post };
}
const answer = obj => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], modelVersion: 'gemini-test' }), { status: 200, headers: { 'Content-Type': 'application/json' } });

test.describe('Ruhsat okuma sunucu fonksiyonu (Gemini)', () => {
  test.afterEach(() => { console.error = realConsoleError; });

  test('düzenleyicinin fotoğrafını Gemini’ye okutur, plakayı sadeleştirir, anlamsız ağırlığı atar', async () => {
    let sent;
    const { post, log } = await setup({ gemini: (url, body, headers) => { sent = { url, body, headers }; return answer({
      vehicles: [
        { plate: 'B-939-PLS', kind: 'tractor', empty_weight_kg: 8673, country: 'RO' },
        { plate: 'AG 08 PLS', kind: 'trailer', empty_weight_kg: 39000, country: 'ro' },
        { plate: 'X', kind: 'bus' }
      ], problem: '' }); } });
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({
      vehicles: [
        { plate: 'B939PLS', kind: 'tractor', empty_weight_kg: 8673, country: 'RO' },
        { plate: 'AG08PLS', kind: 'trailer', empty_weight_kg: null, country: 'RO' }, // 39000 boş ağırlık olamaz (F.1)
        { plate: 'X', kind: 'other', empty_weight_kg: null, country: '' }
      ], problem: '', model: 'gemini-test'
    });
    // anahtar başlıkta gider (adreste değil); fotoğraf base64 olarak, JSON şemasıyla
    expect(sent.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(sent.headers['x-goog-api-key']).toBe('gemini-anahtari');
    expect(sent.body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]).toString('base64') });
    expect(sent.body.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.body.contents[0].parts[1].text).toContain('KATAR');
    expect(log[0].headers.apikey).toBe('sb_publishable_x');
  });

  test('giriş yapmamış ya da görüntüleyici kullanıcıya Gemini açılmaz', async () => {
    const gemini = () => { throw new Error('Gemini çağrılmamalıydı'); };
    expect((await (await setup({ gemini })).post({ Authorization: 'Bearer baskasi' })).status).toBe(403);
    expect((await (await setup({ gemini })).post({ Authorization: '' })).status).toBe(403);
    expect((await (await setup({ gemini, role: 'viewer' })).post()).status).toBe(403);
  });

  test('anahtar yoksa 501, kullanım sınırı dolunca 429 döner; model adı bulunamazsa bilinen modelle denenir', async () => {
    const none = await setup({ env: { GEMINI_API_KEY: '' }, gemini: () => { throw new Error('çağrılmamalı'); } });
    expect((await none.post()).status).toBe(501);
    const limit = await setup({ gemini: () => new Response('{"error":{"code":429}}', { status: 429 }) });
    expect((await limit.post()).status).toBe(429);
    const urls = [];
    const renamed = await setup({ env: { GEMINI_MODEL: 'gemini-eski' }, gemini: url => { urls.push(url); return url.includes('gemini-eski') ? new Response('{}', { status: 404 }) : answer({ vehicles: [] }); } });
    const res = await renamed.post();
    expect(res.status).toBe(200);
    expect(urls.map(u => u.split('/models/')[1])).toEqual(['gemini-eski:generateContent', 'gemini-2.5-flash:generateContent']);
  });

  test('tarayıcının ön kontrol isteğine (OPTIONS) izin verir; resim olmayan dosyayı reddeder', async () => {
    const { mod, post } = await setup({ gemini: () => answer({ vehicles: [] }) });
    const pre = await mod.handle(new Request('https://x/functions/v1/ruhsat-oku', { method: 'OPTIONS' }));
    expect(pre.status).toBe(200);
    expect(pre.headers.get('access-control-allow-headers')).toContain('apikey');
    expect((await post({ 'Content-Type': 'application/pdf' })).status).toBe(400);
  });
});
