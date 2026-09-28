// PCS TRANSIT YYS tarayıcı testleri. Gerçek Supabase yerine tests/stub-vendor.js kullanılır.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'stub-vendor.js'), 'utf8');
// Sabit saat: 23 Eylül 2026 Çarşamba 10:00 (İstanbul). Hafta: 21–26 Eylül.
const NOW = new Date('2026-09-23T07:00:00Z');

function sampleData() {
  const reg = (id, plate, customer, extra = {}) => ({ id, plate, customer, declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z', ...extra });
  const registry = [
    reg('r1', '34 ABC 123', 'BULTRANS', { declaration: '26341200EX0001', carrier: 'KAAN LOJ.', registration: '15400 KG' }),
    reg('r2', 'CB 1234 AB', 'TORNADO'),
    reg('r3', 'B 123 XYZ', 'LİN LOJ'),
    reg('r4', '06 KL 4567', 'ABC NAKLİYAT')
  ];
  const visit = (id, r, date, time, st = {}) => ({
    id, plate: r.plate, customer: r.customer, declaration: r.declaration, carrier: r.carrier, registration: r.registration,
    visit_date: date, visit_time: time, note: '', onsite: false, t1: false, done: false,
    created_at: `${date}T05:00:00Z`, updated_at: `${date}T06:00:00Z`, onsite_at: null, done_at: null, sort_order: null, ...st
  });
  const [a, b, c, d] = registry;
  const visits = [
    visit('v1', a, '2026-09-21', '08:10', { onsite: true, t1: true, done: true, onsite_at: '2026-09-21T05:10:00Z', done_at: '2026-09-21T09:00:00Z' }),
    visit('v2', b, '2026-09-21', '09:00', { onsite: true, t1: true, done: true }),
    visit('v3', c, '2026-09-22', '10:30', { onsite: true, t1: true, done: true }),
    visit('v4', d, '2026-09-22', '11:00', { onsite: true, t1: true, done: true }),
    visit('v5', a, '2026-09-23', '08:05', { onsite: true, onsite_at: '2026-09-23T05:05:00Z' }),
    visit('v6', b, '2026-09-23', '08:40'),
    visit('v7', c, '2026-09-23', '09:15', { onsite: true, t1: true })
  ];
  return { registry, visits, app_settings: [] };
}

async function openApp(page, cfg = {}, url = '/') {
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: true, role: 'editor', data: sampleData(), ...cfg });
  await page.clock.install({ time: NOW });
  await page.goto(url);
  return problems;
}

test.use({ serviceWorkers: 'block' });

test('giriş ekranı: hesap oluşturma düğmesi yok', async ({ page }) => {
  const problems = await openApp(page, { session: false });
  await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Hesap oluştur/ })).toHaveCount(0);
  await expect(page.getByText('Hesaplar yönetici tarafından açılır')).toBeVisible();
  expect(problems).toEqual([]);
});

test('pano yüklenir; fontlar ve dosyalar eksiksiz gelir', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('.nav-item.active')).toContainText('Pano');
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 16px "PCS Roboto"');
    return faces.length > 0 && faces.every(f => f.status === 'loaded');
  });
  expect(loaded).toBe(true);
  expect(problems).toEqual([]);
});

test('tüm sayfalar hatasız açılır', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  for (const p of ['pending', 'registry', 'reports', 'data', 'settings', 'pano']) {
    await page.locator(`.nav-item[data-page="${p}"]`).click();
    await expect(page.locator(`.nav-item[data-page="${p}"]`)).toHaveClass(/active/);
  }
  expect(problems).toEqual([]);
});

test('haftalık Excel dosyası indirilir', async ({ page }) => {
  const problems = await openApp(page);
  await page.locator('.nav-item[data-page="reports"]').click();
  await page.locator('.heading [data-action="export"]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#modal [data-action="export-week"]').click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^PCS_2026_39_HAFTA\.xlsx$/);
  const buf = fs.readFileSync(await download.path());
  expect(buf.subarray(0, 2).toString()).toBe('PK');
  expect(problems).toEqual([]);
});

test("Excel'den plaka al: yalnızca yeni plakalar eklenir", async ({ page }) => {
  const problems = await openApp(page);
  await page.locator('.nav-item[data-page="registry"]').click();
  await expect(page.locator('.heading [data-action="import-reg"]')).toBeVisible();
  const csv = 'PLAKA;MÜŞTERİ;BEYANNAME;NAKLİYECİ;RUHSAT\n'
    + '41 ZZ 900;YENİ FİRMA;26341200EX9;KAAN;15400\n'   // yeni
    + '34 abc 123;BULTRANS;;;\n'                        // zaten kayıtlı
    + '16 FF 332;;;;\n';                                // müşteri boş -> hatalı
  await page.locator('#registry-file').setInputFiles({ name: 'plakalar.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  const modal = page.locator('#modal');
  await expect(modal).toContainText('yeni plaka eklenecek');
  await expect(modal.locator('.import-stat strong')).toHaveText(['1', '1', '1']);
  await modal.locator('[data-action="import-confirm"]').click();
  await expect(page.locator('#toast')).toContainText('1 plaka eklendi');
  const inserted = await page.evaluate(() => window.__calls.filter(c => c.table === 'registry' && c.op === 'insert').flatMap(c => c.rows));
  expect(inserted.map(r => [r.plate, r.customer, r.registration])).toEqual([['41 ZZ 900', 'YENİ FİRMA', '15400 KG']]);
  await expect(page.locator('#app')).toContainText('41 ZZ 900');
  expect(problems).toEqual([]);
});

test('hafif senkron: değişiklik yokken tablolar yeniden indirilmez', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const fullFetches = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'select' && c.cols === '*').length);
  await page.clock.runFor(2000);
  const before = await fullFetches();
  await page.clock.runFor(31000); // iki yoklama turu
  expect(await fullFetches()).toBe(before);
  // Başka bir kullanıcı bir aracı değiştirsin -> bir sonraki yoklamada tam senkron yapılmalı.
  await page.evaluate(() => { const v = window.__db.visits.find(x => x.id === 'v6'); v.onsite = true; v.updated_at = '2026-09-23T07:30:00Z'; });
  await page.clock.runFor(15500);
  expect(await fullFetches()).toBe(before + 1);
  expect(problems).toEqual([]);
});

test('çevrimdışı açılış: son kayıtlar cihazdaki kopyadan gösterilir', async ({ page, context }) => {
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const other = await context.newPage();
  await openApp(other, { offline: true });
  await expect(other.locator('#app')).toContainText('bu cihazda saklanan kayıtlar gösteriliyor');
  await expect(other.locator('#app')).toContainText('34 ABC 123');
});

test('çıkış yapınca cihazdaki kopya silinir', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  expect(await page.evaluate(() => localStorage.getItem('pcs-transit-yys.v1.cache'))).not.toBeNull();
  await page.evaluate(() => window.createPCSClient().auth.signOut());
  await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pcs-transit-yys.v1.cache'))).toBeNull();
});

test('tarih yardımcıları', async ({ page }) => {
  await openApp(page, { session: false });
  const r = await page.evaluate(() => {
    const T = window.PCS_TEST;
    return { wk: T.weekInfo('2026-09-23'), mon: T.monday(2026, 39), bad: T.validDate('2026-02-30'), ok: T.validDate('2026-02-28'), today: T.today };
  });
  expect(r.wk).toEqual({ year: 2026, week: 39 });
  expect(r.mon).toBe('2026-09-21');
  expect(r.bad).toBe(false);
  expect(r.ok).toBe(true);
  expect(r.today).toBe('2026-09-23');
});

test('koyu temada yazılar okunaklı (yeterli kontrast)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pcs-transit-yys.v1.theme', 'dark'));
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const r = await page.evaluate(() => {
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const k = c.startsWith('color(') ? 1 : 255;
      const [x, y, z] = m.slice(0, 3).map(Number).map(v => { v /= k; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * x + 0.7152 * y + 0.0722 * z; };
    const transparent = c => /rgba\(0, 0, 0, 0\)|transparent/.test(c) || /, 0\)$| \/ 0\)$/.test(c);
    const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!transparent(c)) return c; } return 'rgb(14, 18, 24)'; };
    let total = 0, low = 0;
    for (const el of document.querySelectorAll('#app *')) {
      if (el.offsetParent === null || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); if (a == null || b == null) continue;
      total++; if ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 4.5) low++;
    }
    return { total, low, stroke: parseFloat(getComputedStyle(document.body).webkitTextStrokeWidth) };
  });
  // Düzeltmeden önce yazıların ~%13'ü 4.5:1'in altındaydı; şimdi yalnızca renkli düğme üstü birkaç yazı kalıyor.
  expect(r.total).toBeGreaterThan(50);
  expect(r.low / r.total).toBeLessThan(0.05);
  expect(r.stroke).toBeGreaterThan(0);
});

test('başka bir sitenin içine (iframe) gömülünce uygulama açılmaz', async ({ page }) => {
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: true, role: 'editor', data: sampleData() });
  // 127.0.0.1 ile localhost farklı sitelerdir: saldırgan sayfa uygulamayı iframe içinde açar.
  await page.goto('http://127.0.0.1:4173/__frame');
  const framed = () => page.frames().find(f => f.url().startsWith('http://localhost:4173'));
  await expect.poll(() => framed() && framed().evaluate(() => document.readyState)).toBe('complete');
  const state = await framed().evaluate(() => [getComputedStyle(document.documentElement).display, document.getElementById('app').innerHTML]);
  expect(state).toEqual(['none', '']);
  expect(page.url()).toBe('http://127.0.0.1:4173/__frame');
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });
  test('internet yokken site yine açılır', async ({ page, context }) => {
    await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
    await page.addInitScript(() => { window.__PCS_STUB = { session: false }; });
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible();
    await context.setOffline(false);
  });

  test('dosyalar tarayıcı önbelleğine takılmadan sunucudan güncel alınır', async ({ page, request }) => {
    // Test sunucusu, GitHub Pages gibi dosyaları 10 dakika önbelleğe aldırır (max-age=600).
    // page.route tarayıcı önbelleğini kapattığı için bu testte sahte istemci kullanılmaz (oturum yok -> giriş ekranı).
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const hits = async () => ((await (await request.get('/__hits')).json())['/app.css'] || 0);
    // app.css ilk açılışta indirildi ve tarayıcı önbelleğinde 10 dakika geçerli. Normal bir istek bile
    // service worker üzerinden sunucuya "değişti mi?" diye sormalı.
    const before = await hits();
    await page.evaluate(() => fetch('app.css').then(r => r.text()));
    expect(await hits()).toBeGreaterThan(before);
  });
});

/* Asistan: Supabase fonksiyonu (Claude) yerine sahte cevaplar verilir; araçlar tarayıcıda gerçekten çalışır. */
async function mockAssistant(page, replies) {
  const requests = [];
  await page.route('**/functions/v1/asistan', async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const next = replies[requests.length - 1] || { content: [{ type: 'text', text: 'Tamam.' }], stop_reason: 'end_turn' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(next) });
  });
  return requests;
}

test('asistan: soruyu panodaki verilerle cevaplar', async ({ page }) => {
  const requests = await mockAssistant(page, [
    { content: [{ type: 'tool_use', id: 't1', name: 'gelisleri_ara', input: { metin: '34 ABC 123', baslangic: '', bitis: '', durum: 'hepsi' } }], stop_reason: 'tool_use' },
    { content: [{ type: 'text', text: '34 ABC 123 bu hafta **2 kez** geldi.' }], stop_reason: 'end_turn' }
  ]);
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.ast-fab').click();
  await page.getByLabel('Asistana mesaj').fill('34 ABC 123 kaç kez geldi?');
  await page.locator('.ast-send').click();
  await expect(page.locator('.ast-msg.bot').last()).toContainText('2 kez');
  expect(requests).toHaveLength(2);
  expect(requests[0].messages).toEqual([{ role: 'user', content: '34 ABC 123 kaç kez geldi?' }]);
  const result = requests[1].messages[2].content[0];
  expect(result.tool_use_id).toBe('t1');
  expect(JSON.parse(result.content).toplam).toBe(2);
  expect(problems).toEqual([]);
});

test('asistan: durum değişikliği yalnızca onaydan sonra kaydedilir', async ({ page }) => {
  const change = { type: 'tool_use', id: 't9', name: 'durum_guncelle', input: { id: 'v6', tesiste: null, t1: null, bitti: true } };
  await mockAssistant(page, [
    { content: [change], stop_reason: 'tool_use' },
    { content: [{ type: 'text', text: 'İşaretlemedim.' }], stop_reason: 'end_turn' },
    { content: [change], stop_reason: 'tool_use' },
    { content: [{ type: 'text', text: 'CB 1234 AB bitti olarak işaretlendi.' }], stop_reason: 'end_turn' }
  ]);
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.ast-fab').click();
  const ask = async q => { await page.getByLabel('Asistana mesaj').fill(q); await page.locator('.ast-send').click(); };
  const done = () => page.evaluate(() => window.__db.visits.find(v => v.id === 'v6').done);

  await ask('CB 1234 AB bitti yap');
  await page.locator('#ast-panel').getByRole('button', { name: 'Vazgeç' }).click();
  await expect(page.locator('.ast-msg.bot').last()).toContainText('İşaretlemedim');
  expect(await done()).toBe(false);

  await ask('CB 1234 AB bitti yap');
  await expect(page.locator('.ast-msg.confirm').last()).toContainText('İŞLEMLER BİTTİ');
  await page.locator('#ast-panel').getByRole('button', { name: 'Onayla' }).click();
  await expect(page.locator('.ast-msg.bot').last()).toContainText('işaretlendi');
  expect(await done()).toBe(true);
  expect(problems).toEqual([]);
});

test('asistan: görüntüleyici değişiklik yapamaz ama soru sorabilir', async ({ page }) => {
  const requests = await mockAssistant(page, [
    { content: [{ type: 'tool_use', id: 't2', name: 'durum_guncelle', input: { id: 'v6', tesiste: true, t1: null, bitti: null } }], stop_reason: 'tool_use' },
    { content: [{ type: 'text', text: 'Düzenleme yetkiniz yok.' }], stop_reason: 'end_turn' }
  ]);
  const problems = await openApp(page, { role: 'viewer' });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.ast-fab').click();
  await page.getByLabel('Asistana mesaj').fill('CB 1234 AB tesiste yap');
  await page.locator('.ast-send').click();
  await expect(page.locator('.ast-msg.bot').last()).toContainText('yetkiniz yok');
  await expect(page.locator('.ast-msg.confirm')).toHaveCount(0);
  const result = requests[1].messages[2].content[0];
  expect(result.is_error).toBe(true);
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6').onsite)).toBe(false);
  expect(problems).toEqual([]);
});
