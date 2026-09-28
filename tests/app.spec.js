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

test('anlık güncelleme: başka kullanıcının değişikliği 15 sn beklemeden görünür', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  // Başka bir kullanıcı yeni bir araç eklesin ve Realtime bildirimi gelsin.
  await page.evaluate(() => {
    const r = window.__db.registry.find(x => x.id === 'r4');
    window.__db.visits.push({ id: 'v99', plate: '41 ZZ 900', customer: r.customer, declaration: '', carrier: '', registration: '',
      visit_date: '2026-09-23', visit_time: '10:05', note: '', onsite: false, t1: false, done: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), onsite_at: null, done_at: null, sort_order: null });
    window.__rtEmit('visits');
  });
  await page.clock.runFor(1000); // 15 sn'lik yoklamadan çok önce
  await expect(page.locator('#app')).toContainText('41 ZZ 900');
  expect(problems).toEqual([]);
});

test('takılan bir istek güncellemeleri kalıcı olarak durdurmaz', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.clock.runFor(2000);
  await page.evaluate(() => { window.__hang = true; });
  await page.clock.runFor(15000); // yoklama başlar ve cevapsız kalır
  await page.evaluate(() => {
    window.__hang = false;
    const v = window.__db.visits.find(x => x.id === 'v6'); v.plate = '99 YENI 99'; v.updated_at = new Date().toISOString();
  });
  await page.clock.runFor(35000); // 30 sn sonra takılan senkron bırakılır, yenisi çalışır
  await expect(page.locator('#app')).toContainText('99 YENI 99');
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

// Sahte ruhsat görüntüsü üretir. Gerçek ruhsat fotoğrafları kişisel veri içerdiği için depoda tutulmaz.
async function fakeRuhsat(browser, [tractor, gT], [trailer, gR]) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  const card = (plate, kind, g, f1) => `<div class="c"><p>(A) ${plate}</p><p>(D) ${kind}</p><p>(J) N3 &nbsp; (G) ${g} &nbsp; (F.1) ${f1}</p></div>`;
  await p.setContent(`<style>body{margin:0;background:#e9e6dc;font:bold 30px Arial}.c{background:#f7f5ee;margin:30px;padding:20px 40px;border:1px solid #bbb}p{margin:10px 0}</style>${card(tractor, 'TRACTOR', gT, 18000)}${card(trailer, 'SEMI-TRAILER', gR, 39000)}`);
  const buf = await p.screenshot();
  await p.close();
  return buf;
}

test('ruhsattan ekle: kayıtlı araç tek tıkla, yeni araç formla eklenir', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: 'KARGO SRL', registration: '14850 KG', updated_at: '2026-09-01T08:00:00Z' });
  const kayitli = await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]);
  const yeni = await fakeRuhsat(browser, ['PB4321AB', 7900], ['PB8765CD', 6100]);
  const problems = await openApp(page, { data });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await page.locator('#ruhsat-file').setInputFiles([
    { name: 'kayitli.png', mimeType: 'image/png', buffer: kayitli },
    { name: 'yeni.png', mimeType: 'image/png', buffer: yeni }
  ]);
  const cards = page.locator('.rs-item');
  await expect(cards).toHaveCount(2);
  await expect(page.locator('.rs-status.tamam')).toHaveCount(2, { timeout: 120000 });

  // 1) Kayıtlı çift: kayıttaki bilgilerle tek tıkla eklenir.
  await expect(cards.nth(0)).toContainText('RUHSAT LOJ');
  await expect(cards.nth(0)).toContainText('8150 kg + 6700 kg = 14850 kg');
  await cards.nth(0).locator('[data-action="ruhsat-add"]').click();
  await expect(page.locator('#toast')).toContainText('gününe eklendi');
  await expect(cards.nth(0).locator('.rs-status')).toContainText('Panoya eklendi');

  // 2) Yeni araç: plaka ve boş ağırlık toplamı forma doldurulur, müşteri elle seçilir.
  await expect(cards.nth(1)).toContainText('Yeni araç');
  expect(await cards.nth(1).locator('input').evaluateAll(xs => xs.map(x => x.value))).toEqual(['PB 4321 AB', 'PB 8765 CD']);
  await expect(cards.nth(1)).toContainText('7900 kg + 6100 kg = 14000 kg');
  await cards.nth(1).locator('[data-action="ruhsat-form"]').click();
  const form = page.locator('#visit-form');
  await expect(form.locator('[name="plate"]')).toHaveValue('PB 4321 AB - PB 8765 CD');
  await expect(form.locator('[name="registration"]')).toHaveValue('14000');
  await form.locator('[name="customer"]').fill('YENİ LOJ');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('kaydedildi');

  const inserted = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));
  expect(inserted.map(v => [v.plate, v.customer, v.registration])).toEqual([
    ['PB 1234 AB - PB 5678 CD', 'RUHSAT LOJ', '14850 KG'],
    ['PB 4321 AB - PB 8765 CD', 'YENİ LOJ', '14000 KG']
  ]);
  expect(problems).toEqual([]);
});

test('ruhsat okuma: harf sanılan rakam düzelir, çekici/dorse cins yazısından ayrılır', async ({ page }) => {
  const data = sampleData();
  data.registry.push({ id: 'r6', plate: 'PB 9876 TT - PB 1111 AA', customer: 'ÖRNEK LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  // Küçük fotoğraftan okunmuş gibi metin: dorse kartı üstte, "8" harf "B" sanılmış, Kiril yazılar bozuk.
  const text = ['(A)', 'CA1B34KX', 'w= 012345678', 'iB) 16.04.2014', 'fe) NONYPEMAPKE', '(D.2)SCB"S3T 06 VL', '', 'PB9876TT', 'io) 188', '2', 'WMAO0BXZZ8CME01', 'BAEKAY', 'TRAC'].join('\n');
  const r = await page.evaluate(t => {
    const T = window.PCS_TEST, cands = T.ruhsatPlates(t), kinds = T.ruhsatKinds(t, {});
    const pick = ({ tractor, trailer, reg, tractorReg }) => ({ tractor, trailer, reg: !!reg, tractorCustomer: tractorReg?.customer || '' });
    return {
      cands, kinds,
      known: pick(T.ruhsatResolve(cands, kinds)),
      // kayıtta olmayan çekici: sıra yalnızca cins yazısından belirlenir
      unknown: pick(T.ruhsatResolve(T.ruhsatPlates(t.replace('PB9876TT', 'PB5555TT')), T.ruhsatKinds(t.replace('PB9876TT', 'PB5555TT'), {}))),
      tr: T.ruhsatPlates('(A) 34 ABC 123\n34 SB 1234')
    };
  }, text);
  expect(r.cands).toEqual(['CA1834KX', 'PB9876TT']);
  expect(r.kinds).toEqual({ CA1834KX: 'trailer', PB9876TT: 'tractor' });
  expect(r.known).toEqual({ tractor: 'PB9876TT', trailer: 'CA1834KX', reg: false, tractorCustomer: 'ÖRNEK LOJ' });
  expect(r.unknown).toEqual({ tractor: 'PB5555TT', trailer: 'CA1834KX', reg: false, tractorCustomer: '' });
  // Türk plakasında harfler rakamların arasındadır; düzeltme bunlara dokunmaz.
  expect(r.tr).toEqual(expect.arrayContaining(['34ABC123', '34SB1234']));
});

test('ruhsat fotoğrafı Ctrl+V ile yapıştırılabilir; görüntüleyici ekleyemez', async ({ page, browser, context }) => {
  const img = await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]);
  const paste = p => p.evaluate(b64 => {
    const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'ruhsat.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(f);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, img.toString('base64'));
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await paste(page);
  await expect(page.locator('#ruhsat-box')).toBeVisible();
  await expect(page.locator('.rs-item')).toHaveCount(1);

  const viewer = await context.newPage();
  await openApp(viewer, { role: 'viewer' });
  await expect(viewer.locator('#app')).toContainText('34 ABC 123');
  await expect(viewer.locator('.heading [data-action="ruhsat-open"]')).toBeHidden();
  await paste(viewer);
  await expect(viewer.locator('#ruhsat-box')).toHaveCount(0);
});

test('WhatsApp\'tan kopyalanan resim kutuya, düğmeyle ya da dosya olarak yapıştırılır', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const img = await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]);
  const problems = await openApp(page);
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const box = page.locator('#ruhsat-paste');
  await expect(box).toBeFocused();
  const items = page.locator('.rs-item');

  // Tarayıcıda "Resmi kopyala": panoda image/png olur.
  await page.evaluate(async b64 => {
    const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }, img.toString('base64'));
  await box.click();
  await page.keyboard.press('Control+V');
  await expect(items).toHaveCount(1);
  await page.locator('[data-action="ruhsat-clip"]').click();
  await expect(items).toHaveCount(2);

  // Kutuya yazı yazılamaz; resim olmayan bir şey yapıştırılırsa ne yapılacağı söylenir.
  await box.click();
  await page.keyboard.type('abc');
  await page.evaluate(() => navigator.clipboard.writeText('merhaba'));
  await page.keyboard.press('Control+V');
  await expect(page.locator('#toast')).toContainText('resim değil');
  await expect(box).toHaveText('');
  await expect(items).toHaveCount(2);

  // WhatsApp masaüstü uygulaması resmi dosya olarak kopyalar; türü boş gelebilir.
  await page.evaluate(b64 => {
    const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'WhatsApp Image 2026-09-28.jpeg', { type: '' });
    const dt = new DataTransfer(); dt.items.add(f);
    document.getElementById('ruhsat-paste').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, img.toString('base64'));
  await expect(items).toHaveCount(3);
  expect(problems).toEqual([]);
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
