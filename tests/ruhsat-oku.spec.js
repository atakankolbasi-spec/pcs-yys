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

  test('giriş yapmamış ya da görüntüleyici kullanıcıya Gemini açılmaz; süresi dolan oturuma 401 döner', async () => {
    const gemini = () => { throw new Error('Gemini çağrılmamalıydı'); };
    expect((await (await setup({ gemini })).post({ Authorization: 'Bearer baskasi' })).status).toBe(401);
    expect((await (await setup({ gemini })).post({ Authorization: '' })).status).toBe(403);
    expect((await (await setup({ gemini, role: 'viewer' })).post()).status).toBe(403);
    // Supabase'in gizli anahtarı yanlış yazılmışsa sunucu çağrısı sayılmaz
    expect((await (await setup({ gemini, env: { SUPABASE_SERVICE_ROLE_KEY: 'gizli-sunucu-anahtari' } })).post({ Authorization: 'Bearer gizli-sunucu-anahtarX' })).status).toBe(401);
  });

  test('Supabase sunucusunun kendi gizli anahtarıyla gelen çağrıyı kabul eder (WhatsApp fonksiyonu için)', async () => {
    const { post, log } = await setup({ env: { SUPABASE_SERVICE_ROLE_KEY: 'gizli-sunucu-anahtari' }, gemini: () => answer({ vehicles: [{ plate: '34ABC123', kind: 'tractor', empty_weight_kg: 8000 }] }) });
    const res = await post({ Authorization: 'Bearer gizli-sunucu-anahtari', apikey: '' });
    expect(res.status).toBe(200);
    expect(log.some(x => x.url.includes('current_app_role'))).toBe(false);
  });

  test('Supabase yetkiyi soramazsa 503 döner (site bekleyip yeniden dener)', async () => {
    const s = await setup({ gemini: () => answer({ vehicles: [] }) });
    const orig = globalThis.fetch;
    globalThis.fetch = async (u, i) => String(u).includes('current_app_role') ? new Response('{}', { status: 502 }) : orig(u, i);
    expect((await s.post()).status).toBe(503);
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

  test('dakikalık sınır dolunca yedek modelleri dener; hepsi doluysa Gemini’nin bekleme süresini iletir', async () => {
    const quota = (sec, id = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier') => new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [
      { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: id }] },
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: sec + 's' }] } }), { status: 429 });
    // ilk model dolu, yedek model okur
    const urls = [];
    const one = await setup({ gemini: url => { urls.push(url.split('/models/')[1]); return url.includes('gemini-flash-latest') ? quota(31) : answer({ vehicles: [{ plate: 'PB1234AB', kind: 'tractor' }] }); } });
    expect((await one.post()).status).toBe(200);
    expect(urls).toEqual(['gemini-flash-latest:generateContent', 'gemini-2.5-flash:generateContent']);
    // hepsi dolu: 429 ve en kısa bekleme süresi
    const all = await setup({ gemini: url => quota(url.includes('lite') ? 12.4 : 40) });
    const res = await all.post();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ retry_after: 13, daily: false, fatal: false, reason: 'Gemini ücretsiz kullanım sınırı doldu' });
    // günlük sınır hepsinde dolu: bugün beklemenin anlamı yok
    const day = await setup({ gemini: () => quota(50, 'GenerateRequestsPerDayPerProjectPerModel-FreeTier') });
    expect(await (await day.post()).json()).toMatchObject({ daily: true, fatal: true, retry_after: 0 });
  });

  test('anahtar geçersizse beklemeden hata döner (tekrar denemenin anlamı yok)', async () => {
    let n = 0;
    const bad = await setup({ gemini: () => { n++; return new Response('{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}', { status: 400 }); } });
    const res = await bad.post();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ fatal: true, reason: 'Gemini anahtarı (GEMINI_API_KEY) geçersiz ya da yetkisiz' });
    expect(n).toBe(1);
  });

  test('Google yoğunken (503) önce aynı modelle bir kez daha, sonra yedek modelle dener', async () => {
    const urls = [];
    const busy = await setup({ gemini: url => { urls.push(url.split('/models/')[1]); return url.includes('gemini-flash-latest') ? new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 }) : answer({ vehicles: [{ plate: '34ABC123', kind: 'tractor', empty_weight_kg: 8000 }] }); } });
    const res = await busy.post();
    expect(res.status).toBe(200);
    expect((await res.json()).vehicles[0].plate).toBe('34ABC123');
    expect(urls).toEqual(['gemini-flash-latest:generateContent', 'gemini-flash-latest:generateContent', 'gemini-2.5-flash:generateContent']);
    // yedek modeller de yoğunsa (her biri iki kez denenir) hata kodu siteye iletilir
    const tried = [];
    const down = await setup({ gemini: url => { tried.push(url.split('/models/')[1]); return new Response('{"error":{"code":503}}', { status: 503 }); } });
    const bad = await down.post();
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toBe('Gemini 503');
    expect(tried.map(u => u.split(':')[0])).toEqual(['gemini-flash-latest', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-lite-latest']);
  });

  test('tarayıcının ön kontrol isteğine (OPTIONS) izin verir; resim olmayan dosyayı reddeder', async () => {
    const { mod, post } = await setup({ gemini: () => answer({ vehicles: [] }) });
    const pre = await mod.handle(new Request('https://x/functions/v1/ruhsat-oku', { method: 'OPTIONS' }));
    expect(pre.status).toBe(200);
    expect(pre.headers.get('access-control-allow-headers')).toContain('apikey');
    expect((await post({ 'Content-Type': 'application/pdf' })).status).toBe(400);
  });
});
