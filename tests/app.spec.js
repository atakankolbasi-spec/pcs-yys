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
  // eski testler karşılama bandını açık varsayar (varsayılan artık ince çubuk); kısa hal ayrı testte
  if (!cfg.heroMini) await page.addInitScript(() => { try { if (localStorage.getItem('pcs-transit-yys.v1.heroMini') === null) localStorage.setItem('pcs-transit-yys.v1.heroMini', '0'); } catch (e) {} });
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

test('Kontrol Kulesi tasarımı: karşılama bandı, genel bakış kartları, menü sabitleme', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  expect(await page.evaluate(() => document.documentElement.classList.contains('kule'))).toBe(true);
  // karşılama bandı: selamlama, bugünün tarihi, bugünün sayıları ve işlemler
  const hero = page.locator('.heading.k-hero');
  await expect(hero).toContainText('Günaydın');
  await expect(hero).toContainText('23 Eylül 2026 Çarşamba');
  // bugün 3 araç: 2'si tesiste (v5, v7), 1'i gelecek (v6), tamamlanan yok
  expect(await hero.locator('.k-stat span').allTextContents()).toEqual(['Toplam araç', 'Tesiste', 'Gelecek', 'Tamamlanan']);
  expect(await hero.locator('.k-stat b').allTextContents()).toEqual(['3', '2', '1', '0']);
  await expect(hero.locator('.k-stats-label')).toHaveText('Bugün');
  await expect(hero.locator('[data-action="add-visit"]')).toBeVisible();
  // genel bakış: bugünün kontrol kartı, bekleyenler, son 14 iş günü
  await expect(page.locator('.k-card.k-ctl')).toContainText('Bugün');
  await expect(page.locator('.k-waits li')).toHaveCount(3);
  await expect(page.locator('.k-bar')).toHaveCount(14);
  // grafikte bir güne tıklayınca o gün açılır
  await page.locator('.k-bar[data-date="2026-09-22"]').click();
  await expect(page.locator('.day-tab.active')).toContainText('Salı');
  // bekleyen araca tıklayınca panoda seçilir
  await page.locator('.k-waits button', { hasText: 'CB 1234 AB' }).click();
  await expect(page.locator('.day-tab.active')).toContainText('Çarşamba');
  await expect(page.locator('.side-panel')).toContainText('CB 1234 AB');
  // genel bakış gizlenir; tercih hatırlanır
  await page.locator('[data-action="k-panel"]').click();
  await expect(page.locator('.k-cards')).toHaveCount(0);
  // menü açık tutulabilir; tercih hatırlanır
  await page.locator('[data-action="k-navwide"]').click();
  await expect(page.locator('body')).toHaveClass(/k-wide/);
  await page.reload();
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await expect(page.locator('.k-cards')).toHaveCount(0);
  await expect(page.locator('body')).toHaveClass(/k-wide/);
  await page.locator('[data-action="k-panel"]').click();
  await expect(page.locator('.k-cards')).toHaveCount(1);
  // tasarımın yazı tipleri siteyle birlikte gelir
  const fonts = await page.evaluate(async () => {
    const f = [...await document.fonts.load('400 16px "PCS Inter"'), ...await document.fonts.load('800 16px "PCS Jakarta"')];
    return f.length > 0 && f.every(x => x.status === 'loaded');
  });
  expect(fonts).toBe(true);
  // diğer sayfalarda sade başlık kartı
  await page.locator('.nav-item[data-page="registry"]').click();
  await expect(page.locator('.heading.k-pagehead')).toContainText('Plaka kayıtları');
  expect(problems).toEqual([]);
});

test('pano: aşağı inince bandın kısa hali üstte sabit kalır, hızlı arama çubuğu kayıp gider', async ({ page }) => {
  const data = sampleData();
  for (let i = 0; i < 30; i++) data.visits.push({ ...data.visits[5], id: 'z' + String(i).padStart(2, '0'), plate: `34 ZZ ${100 + i}` });
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  // bandın düğmeleri ve sayıları hiçbir ekran genişliğinde dışarı taşmaz (geniş menüde de)
  const fits = () => page.locator('.k-hero').evaluate(h => { const r = h.getBoundingClientRect(); return Math.max(...[...h.querySelectorAll('.btn,.k-stat')].map(x => x.getBoundingClientRect().right)) <= r.right; });
  for (const wide of [false, true]) {
    if (wide) await page.locator('[data-action="k-navwide"]').click();
    for (const w of [1280, 1366, 1440, 1536, 1600]) { await page.setViewportSize({ width: w, height: 720 }); expect(await fits(), `${w}px${wide ? ', geniş menü' : ''}`).toBe(true); }
  }
  await page.locator('[data-action="k-navwide"]').click();
  await page.setViewportSize({ width: 1280, height: 720 });
  const bar = page.locator('.k-pinbar');
  await expect(bar).toBeHidden(); // en üstte bandın kendisi görünür
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.clock.runFor(100);
  await expect(bar).toBeVisible();
  await expect.poll(() => bar.evaluate(e => Math.round(e.getBoundingClientRect().top))).toBe(12); // ekranın 12 px altında sabit
  expect(await page.locator('.topbar').evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThan(0);
  // bugün: 3 + 30 araç; 2'si tesiste, 31'i gelecek
  await expect(bar.locator('.k-pstat')).toHaveCount(4);
  expect(await bar.locator('.k-pstat b').allTextContents()).toEqual(['33', '2', '31', '0']);
  // sıra: başlık solda, düğmeler ortada, sayılar sağda
  const x = sel => bar.locator(sel).first().evaluate(e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; });
  const [xt, xa, xs] = [await x('.k-pin-t'), await x('.actions'), await x('.k-pin-stats')];
  expect(xt).toBeLessThan(xa);
  expect(xa).toBeLessThan(xs);
  // çubuktaki düğmeler çalışır
  await bar.locator('[data-action="add-visit"]').click();
  await expect(page.locator('#visit-form')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden();
  // yukarı çıkınca çubuk kaybolur
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.clock.runFor(100);
  await expect(bar).toBeHidden();
  // diğer sayfalarda çubuk yok; üst çubuk (hızlı arama) eskisi gibi sabit
  await page.locator('.nav-item[data-page="registry"]').click();
  await expect(page.locator('.k-pinbar')).toHaveCount(0);
  expect(await page.locator('.topbar').evaluate(e => getComputedStyle(e).position)).toBe('sticky');
  expect(problems).toEqual([]);
});

test('hızlı arama (Ctrl+K): geliş, plaka kaydı ve sayfa bulunur', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const qs = page.locator('#k-qs'), input = page.locator('#k-qs-input');
  // üst çubuktaki düğme ya da Ctrl+K ile açılır
  await page.locator('[data-action="k-search"]').click();
  await expect(qs).toBeVisible();
  await expect(qs).toContainText('Araç ekle');
  await page.keyboard.press('Escape');
  await expect(qs).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  // plaka: önce gelişler (yeniden eskiye), sonra plaka kaydı; Enter ilkini açar
  await input.fill('06 kl');
  await expect(qs.locator('.k-qs-item').first()).toContainText('22 Eylül 2026');
  await expect(qs.locator('.k-qs-g')).toHaveText(['Gelişler', 'Plaka kayıtları']);
  await page.keyboard.press('Enter');
  await expect(qs).toBeHidden();
  await expect(page.locator('.day-tab.active')).toContainText('Salı');
  await expect(page.locator('.side-panel')).toContainText('06 KL 4567');
  // başka bir haftadaki geliş de bulunur: hafta değişir
  await page.locator('[data-action="next-week"]').click();
  await page.keyboard.press('Control+k');
  await input.fill('lin loj');
  await expect(qs.locator('.k-qs-item').first()).toContainText('23 Eylül 2026');
  await page.keyboard.press('Enter');
  await expect(page.locator('.range-label')).toContainText('21 Eyl');
  await expect(page.locator('.day-tab.active')).toContainText('Çarşamba');
  // müşteri adıyla plaka kaydı: oklarla seçilir, kayıtlar sayfasında aranır
  await page.keyboard.press('Control+k');
  await input.fill('tornado');
  const items = qs.locator('.k-qs-item');
  const n = await items.count();
  for (let i = 1; i < n; i++) await page.keyboard.press('ArrowDown');
  await expect(items.last()).toHaveClass(/on/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.nav-item.active')).toContainText('Plaka Kayıtları');
  await expect(page.locator('#registry-search')).toHaveValue('CB 1234 AB');
  // sayfa adı
  await page.keyboard.press('Control+k');
  await input.fill('ayar');
  await qs.locator('.k-qs-item', { hasText: 'Ayarlar' }).click();
  await expect(page.locator('.nav-item.active')).toContainText('Ayarlar');
  expect(problems).toEqual([]);
});

test('ayarlardan Klasik tasarıma dönülür, seçim herkes için kaydedilir; güvenlik ekranı etkilenmez', async ({ page, context }) => {
  const problems = await openApp(page);
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('[data-sk="design"] [data-v="kule"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-sk="design"] [data-v="klasik"]').click();
  expect(await page.evaluate(() => document.documentElement.classList.contains('kule'))).toBe(false);
  await expect(page.locator('.sidebar .brand-mark img')).toHaveCount(1);
  await expect(page.locator('[data-action="k-search"]')).toHaveCount(0);
  await page.locator('[data-action="app-save"]').click();
  await expect(page.locator('#toast')).toContainText('Görünüm ayarları kaydedildi');
  expect(await page.evaluate(() => window.__db.app_settings.find(r => r.key === 'appearance').value.design)).toBe('klasik');
  // kayıttan sonra ayarlar sunucudan yeniden okunduğunda da Klasik kalır
  await page.evaluate(() => window.__rtEmit('app_settings'));
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('.heading .eyebrow')).toContainText('TESİS OPERASYON YÖNETİMİ');
  await expect(page.locator('.k-hero')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('kule'))).toBe(false);
  expect(problems).toEqual([]);
  // güvenlik ekranına yeni tasarım uygulanmaz
  const guard = await context.newPage();
  await openApp(guard, { session: false, guardToken: 'g1' }, '/?guvenlik=g1');
  await expect(guard.locator('.guard')).toBeVisible();
  expect(await guard.evaluate(() => document.documentElement.classList.contains('kule'))).toBe(false);
});

test('ayarlar sayfası: bölümler, tema, vurgu rengi, köşe, animasyon, karşılama bandı ve arama', async ({ page }) => {
  const problems = await openApp(page);
  await page.locator('.nav-item[data-page="settings"]').click();
  // sol listede bölümler; ilk açılan Görünüm
  await expect(page.locator('.k-stab')).toHaveCount(12);
  await expect(page.locator('.k-stab.on')).toContainText('Görünüm');
  const html = () => page.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'light', radius: document.documentElement.dataset.radius, nomotion: document.documentElement.classList.contains('k-nomotion'), accent: document.documentElement.style.getPropertyValue('--c-accent') }));
  // bu cihaz ayarları hemen geçerli, kaydet çubuğu çıkmaz
  await page.locator('[data-sk="theme"] [data-v="dark"]').click();
  expect((await html()).theme).toBe('dark');
  expect(await page.evaluate(() => localStorage.getItem('pcs-transit-yys.v1.theme'))).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('[data-sk="theme"] [data-v="auto"]').click();
  expect((await html()).theme).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await html()).theme).toBe('dark');
  await page.locator('[data-sk="theme"] [data-v="light"]').click();
  await page.locator('.k-swt:has([data-sw="motion"])').click();
  expect((await html()).nomotion).toBe(true);
  await expect(page.locator('#save-bar')).not.toHaveClass(/show/);
  // herkes için ayarlar: görünür, Kaydet ile kalıcı olur
  await page.locator('[data-acc="#0f9d8a"]').click();
  expect((await html()).accent).toBe('#0f9d8a');
  await expect(page.locator('[data-acc="#0f9d8a"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-sk="radius"] [data-v="yuvarlak"]').click();
  expect((await html()).radius).toBe('yuvarlak');
  await expect(page.locator('#save-bar')).toHaveClass(/show/);
  await page.locator('[data-action="app-save"]').click();
  await expect(page.locator('#toast')).toContainText('Görünüm ayarları kaydedildi');
  const saved = await page.evaluate(() => window.__db.app_settings.find(r => r.key === 'appearance').value);
  expect([saved.colors.accent, saved.radius]).toEqual(['#0f9d8a', 'yuvarlak']);
  // bölümü sıfırla
  await page.locator('[data-sreset="look"]').click();
  expect((await html()).radius).toBe('yumusak');
  expect((await html()).nomotion).toBe(false);
  // yerleşim: karşılama bandı kapanınca haftanın sayıları kart olarak görünür
  await page.locator('[data-stab="layout"]').click();
  await page.locator('.k-swt:has([data-sw="hero"])').click();
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('.k-hero')).toHaveCount(0);
  await expect(page.locator('.kpi-grid')).toBeVisible();
  await expect(page.locator('.heading.k-pagehead [data-action="ruhsat-open"]')).toBeVisible();
  // arama: ayar adına göre, bölüm etiketiyle
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('#set-q').fill('plaka');
  await expect(page.locator('.k-hit').first()).toBeVisible();
  await expect(page.locator('.k-sbody')).toContainText('Plaka yazı boyutu');
  await expect(page.locator('#set-q')).toBeFocused();
  // bölüm içindeki eski düzenleyiciler çalışır (müşteri sıralaması)
  await page.locator('#set-q').fill('');
  await page.locator('[data-stab="customers"]').click();
  await expect(page.locator('.k-scard')).toContainText('Öncelikli müşteri sıralaması');
  expect(problems).toEqual([]);
});

test('ayarlar: görüntüleyici ortak görünüm ayarlarını değiştiremez, kendi temasını seçebilir', async ({ page }) => {
  const problems = await openApp(page, { role: 'viewer' });
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('[data-sk="radius"] [data-v="keskin"]')).toBeDisabled();
  await expect(page.locator('[data-acc="#0f9d8a"]')).toBeDisabled();
  await expect(page.locator('[data-sk="theme"] [data-v="dark"]')).toBeEnabled();
  await page.locator('[data-sk="theme"] [data-v="dark"]').click();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
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

test('aylık Excel: seçilen ayın araçları tesis giriş, işlem bitti, tesis çıkış ve kalma süresiyle aktarılır', async ({ page }) => {
  const data = sampleData();
  const v1 = data.visits.find(v => v.id === 'v1');
  v1.exit_at = '2026-09-21T10:30:00Z'; // giriş 05:10Z (08:10), çıkış 10:30Z (13:30) -> kalma 5 sa 20 dk
  Object.assign(data.visits.find(v => v.id === 'v3'), { onsite_at: '2026-09-22T07:00:00Z', done_at: '2026-09-22T09:15:00Z' }); // çıkış yok -> * ile bitiş saati
  data.visits.push({ ...data.visits[5], id: 'v-agu', plate: '35 AGU 35', visit_date: '2026-08-28' });
  data.visits.push({ ...data.visits[5], id: 'v-eki', plate: '35 EKI 35', visit_date: '2026-10-02' });
  const problems = await openApp(page, { data });
  await page.locator('.nav-item[data-page="reports"]').click();
  await page.locator('.heading [data-action="export"]').click();
  const sel = page.locator('#export-month');
  await expect(sel).toHaveValue('2026-09');
  await expect(sel.locator('option[value="2026-09"]')).toHaveText(/Eylül 2026 · 7 araç/);
  await expect(sel.locator('option[value="2026-08"]')).toHaveText(/Ağustos 2026 · 1 araç/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#modal [data-action="export-month"]').click()]);
  expect(download.suggestedFilename()).toBe('PCS_2026_09_AY.xlsx');
  const xml = fs.readFileSync(await download.path()).toString('utf8'); // dosya sıkıştırmasız: sayfa XML'i düz metin
  for (const t of ['TESİS GİRİŞ', 'İŞLEM BİTTİ', 'TESİS ÇIKIŞ', 'KALMA (sa:dk)', 'EYLÜL 2026', 'ay toplamı', '34 ABC 123', '06 KL 4567'])
    expect(xml).toContain(t);
  expect(xml).not.toContain('35 AGU 35');
  expect(xml).not.toContain('35 EKI 35');
  const serial = (y, mo, d, h, mi) => (Date.UTC(y, mo - 1, d, h, mi, 0) - Date.UTC(1899, 11, 30)) / 86400000;
  expect(xml).toContain(`<v>${serial(2026, 9, 21, 8, 10)}</v>`);          // tesis giriş, İstanbul saati
  expect(xml).toContain(`<v>${serial(2026, 9, 21, 13, 30)}</v>`);         // tesis çıkış
  expect(xml).toContain(`<v>${320 / 1440}</v>`);                          // kalma 5:20
  expect(xml).toMatch(new RegExp(`<c r="M\\d+" s="25"><v>${serial(2026, 9, 22, 12, 15)}</v>`)); // çıkış yok: bitiş saati * biçimiyle
  expect(xml).toContain('formatCode="[h]:mm"');
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

// visits tablosundan yapılan indirmeler: tam (tüm tablo) ve artımlı (yalnızca son değişenler)
const visitFetches = page => page.evaluate(() => {
  const v = window.__calls.filter(c => c.table === 'visits' && c.op === 'select' && c.cols === '*');
  return { full: v.filter(c => !c.gte).length, part: v.filter(c => c.gte).length };
});

test('hafif senkron: değişiklik yokken hiçbir şey indirilmez, değişince yalnızca değişen satırlar gelir', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.clock.runFor(2000);
  const before = await visitFetches(page);
  await page.clock.runFor(31000); // iki yoklama turu
  expect(await visitFetches(page)).toEqual(before);
  // Başka bir kullanıcı bir aracı değiştirsin -> bir sonraki yoklamada yalnızca son değişenler indirilir.
  await page.evaluate(() => { const v = window.__db.visits.find(x => x.id === 'v6'); v.plate = 'CB 5555 AB'; v.updated_at = '2026-09-23T07:30:00Z'; });
  await page.clock.runFor(15500);
  expect(await visitFetches(page)).toEqual({ full: before.full, part: before.part + 1 });
  await expect(page.locator('#app')).toContainText('CB 5555 AB');
  expect(problems).toEqual([]);
});

test('artımlı senkron: silinen kayıt düşer, 10 dakikada bir tüm tablo baştan indirilir, liste tam senkronla aynı kalır', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('B 123 XYZ');
  await page.clock.runFor(2000);
  const before = await visitFetches(page);
  // başka kullanıcı v7'yi siler, v6'yı değiştirir, yeni bir araç ekler
  await page.evaluate(() => {
    const db = window.__db, t = new Date().toISOString();
    db.visits = db.visits.filter(v => v.id !== 'v7');
    Object.assign(db.visits.find(v => v.id === 'v6'), { onsite: true, onsite_at: t, updated_at: t });
    db.visits.push({ ...db.visits.find(v => v.id === 'v6'), id: 'v0', plate: '06 YENI 06', onsite: false, onsite_at: null, created_at: t, updated_at: t });
  });
  await page.clock.runFor(15500);
  await expect(page.locator('#app')).toContainText('06 YENI 06');
  const ids = () => page.evaluate(() => window.PCS_TEST.getState().visits.map(v => v.id));
  const dbIds = () => page.evaluate(() => window.__db.visits.map(v => v.id).sort());
  expect(await ids()).toEqual(await dbIds()); // silinen düştü, sıra tam senkronla aynı (id sırası)
  expect((await page.evaluate(() => window.PCS_TEST.getState().visits.find(v => v.id === 'v6'))).onsite).toBe(true);
  expect((await visitFetches(page)).full).toBe(before.full);
  // anlık bildirim: parmak izi değişmese de (ör. sırası karışmış eş zamanlı kayıt) son değişenler çekilir
  const p0 = (await visitFetches(page)).part;
  await page.evaluate(() => window.__rtEmit('visits'));
  await page.clock.runFor(1000);
  expect((await visitFetches(page)).part).toBe(p0 + 1);
  // en geç 10 dakikada bir tam senkron
  await page.clock.runFor(10 * 60000);
  expect((await visitFetches(page)).full).toBeGreaterThan(before.full);
  expect(await ids()).toEqual(await dbIds());
  expect(problems).toEqual([]);
});

test('çok kayıt: 1000’lik sayfalar birlikte istenir, liste eksiksiz ve tekrarsız gelir', async ({ page }) => {
  const data = sampleData();
  for (let i = 0; i < 2500; i++) data.registry.push({ id: 'x' + String(i).padStart(5, '0'), plate: `34 TT ${1000 + i}`, customer: 'TOPLU LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const ids = await page.evaluate(() => window.PCS_TEST.getState().registry.map(r => r.id));
  expect(ids.length).toBe(2504);
  expect(new Set(ids).size).toBe(2504);
  // üç sayfa art arda istenir (biri bitmeden diğeri başlar), sırayla beklenmez
  const pages = await page.evaluate(() => window.__calls.map((c, i) => [i, c]).filter(([, c]) => c.table === 'registry' && c.op === 'select' && c.cols === '*').map(([i, c]) => [i, c.from]));
  expect(pages.slice(0, 3).map(p => p[1])).toEqual([0, 1000, 2000]);
  expect(pages[2][0] - pages[0][0]).toBe(2);
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

test('pano: araç çubuğu ve gün başlığı yok; arama, tablo/kart, giriş-çıkış, ertesi güne alma ve eksik bilgiler genel bakıştaki kontrol kartında', async ({ page, browser }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const ctl = page.locator('.k-card.k-ctl');
  await expect(ctl).toContainText('Çarşamba · 23 Eylül');
  await expect(ctl.locator('#board-search')).toBeVisible();
  await expect(ctl.locator('[data-action="view-mode"]')).toHaveCount(2);
  await expect(ctl.locator('[data-action="missing-only"]')).toBeVisible();
  await expect(ctl.locator('[data-action="gate-day"]')).toBeVisible();
  await expect(ctl.locator('[data-action="carry-next"]')).toContainText('Bitmeyenleri ertesi güne al');
  // tek gün seçiliyken araç çubuğu ve gün başlığı gösterilmez; tablo hemen başlar
  await expect(page.locator('.board-main .board-toolbar, .board-main .quick-add, .day-header')).toHaveCount(0);
  await expect(page.locator('.day-block .operations')).toBeVisible();
  // kartlardaki düğmeler çalışır
  await ctl.locator('[data-v="cards"]').click();
  await expect(page.locator('.day-block .vcard').first()).toBeVisible();
  await ctl.locator('[data-v="table"]').click();
  await expect(page.locator('.day-block .operations')).toBeVisible();
  const missing = ctl.locator('[data-action="missing-only"]');
  await missing.click();
  await expect(page.locator('.k-card.k-ctl [data-action="missing-only"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.k-card.k-ctl [data-action="missing-only"]').click();
  await ctl.locator('[data-action="gate-day"]').click();
  await expect(page.locator('#modal')).toContainText('Günlük giriş – çıkış');
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeHidden();
  // arama kartın içinden yapılır
  await ctl.locator('#board-search').fill('b 123');
  await expect(page.locator('#app')).toContainText('B 123 XYZ');
  await page.locator('#board-search').fill('');
  await expect(page.locator('.k-card.k-ctl')).toBeVisible();
  // haftanın tamamı: günler ayırt edilsin diye gün başlıkları kalır, günün düğmeleri kartta yoktur
  await page.locator('.day-tab', { hasText: 'Haftanın tamamı' }).click();
  await expect(page.locator('.day-header').first()).toBeVisible();
  await expect(page.locator('.k-card.k-ctl')).toContainText('39. hafta · tüm günler');
  await expect(page.locator('.k-card.k-ctl [data-action="carry-next"]')).toHaveCount(0);
  await page.locator('.day-tab', { hasText: 'Çarşamba' }).click();
  // N: hızlı ekleme yoksa yeni araç formu açılır
  await page.locator('body').press('n');
  await expect(page.locator('#visit-form')).toBeVisible();
  await page.keyboard.press('Escape');
  // genel bakış gizlenirse tek satırlık araç çubuğu (hızlı ekleme dahil) ve gün başlığı geri gelir
  await page.locator('[data-action="k-panel"]').click();
  const bar = page.locator('.board-main .board-toolbar');
  await expect(bar.locator('#quick-add')).toBeVisible();
  await expect(page.locator('.day-header')).toHaveCount(1);
  const rows = await bar.locator(':scope > *').evaluateAll(xs => new Set(xs.map(x => { const r = x.getBoundingClientRect(); return Math.round(r.top + r.height / 2); })).size);
  expect(rows).toBe(1);
  await page.locator('#quick-plate').fill('06 KL 4567');
  await expect(page.locator('#quick-hint')).toContainText('ABC NAKLİYAT');
  await page.locator('#quick-plate').press('Enter');
  await expect(page.locator('#toast')).toContainText('06 KL 4567 · ABC NAKLİYAT, 23 Eylül gününe eklendi');
  // görüntüleyicide yazma düğmeleri görünmez
  const viewer = await browser.newPage();
  await openApp(viewer, { role: 'viewer' });
  await expect(viewer.locator('.k-card.k-ctl #board-search')).toBeVisible();
  await expect(viewer.locator('.k-card.k-ctl [data-action="carry-next"]')).toBeHidden();
  await expect(viewer.locator('#quick-add')).toHaveCount(0);
  await viewer.close();
  expect(problems).toEqual([]);
});

test('müşteri başlıkları: ışıltılı koyu şerit ve müşteri renginde çerçeve; ayarlardan önceki stile dönülür', async ({ page }) => {
  const data = sampleData();
  data.app_settings.push({ key: 'customer_priority', value: [{ match: 'BULTRANS', color: '#ef4444' }, { match: 'TORNADO', color: '#22c55e' }], updated_at: '2026-09-01T08:00:00Z' });
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  expect(await page.evaluate(() => document.documentElement.dataset.headLook)).toBe('isiltili');
  const style = loc => loc.evaluate(e => { const s = getComputedStyle(e); return { bw: s.borderTopWidth, bc: s.borderTopColor, bg: s.backgroundImage, fg: s.color }; });
  // başlık: koyu zemin (gradyan), müşteri renginde 3 px çerçeve
  const head = page.locator('.day-block .block-head-bar').first();
  const h = await style(head);
  expect(h.bw).toBe('3px');
  expect(h.bg).toContain('gradient');
  expect(h.fg).toBe('rgb(255, 255, 255)');
  // BULTRANS (kırmızı): başlığın çerçevesi ve satırların sol/sağ/alt kenarı aynı renkte
  const bul = page.locator('.day-block tr.block-head-row', { has: page.locator('.block-head-name', { hasText: 'BULTRANS' }) });
  expect((await style(bul.locator('.block-head-bar'))).bc).toBe('rgb(239, 68, 68)');
  const rows = page.locator('.day-block tr[data-row-id]', { hasText: '34 ABC 123' });
  const cell = i => rows.locator('td').nth(i).evaluate((e, i) => { const s = getComputedStyle(e); return [s.borderLeftColor, s.borderRightColor, s.borderBottomColor, s.borderBottomWidth]; }, i);
  expect((await cell(0))[0]).toBe('rgb(239, 68, 68)'); // sol
  expect((await cell(8))[1]).toBe('rgb(239, 68, 68)'); // sağ
  expect(await cell(3)).toEqual([expect.anything(), expect.anything(), 'rgb(239, 68, 68)', '3px']); // grubun son satırı: alt çerçeve
  // kart görünümünde de aynı çerçeve
  await page.locator('[data-action="view-mode"][data-v="cards"]').first().click();
  const grp = page.locator('.card-group', { has: page.locator('.block-head-name', { hasText: 'BULTRANS' }) });
  const g = await style(grp);
  expect([g.bw, g.bc]).toEqual(['3px', 'rgb(239, 68, 68)']);
  await page.locator('[data-action="view-mode"][data-v="table"]').first().click();
  // ayarlar > yerleşim: yeni seçenek; eski üç ayar yalnızca "Önceki stil"de görünür
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="layout"]').click();
  const look = page.locator('[data-sk="headLook"]');
  await expect(look.locator('[data-v="isiltili"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-sk="headAlign"]')).toHaveCount(0);
  await expect(page.locator('.set-preview .block-head-bar')).toBeVisible();
  await look.locator('[data-v="eski"]').click();
  await expect(page.locator('[data-sk="headAlign"]')).toBeVisible();
  await expect(page.locator('[data-sk="headStyle"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.headLook)).toBe('eski');
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  // önceki stilde koyu şerit ve 3 px çerçeve yoktur
  const old = await style(page.locator('.day-block .block-head-bar').first());
  expect(old.bg).not.toContain('gradient');
  expect(old.bw).not.toBe('3px');
  expect(problems).toEqual([]);
});

test('form açılırken başka alana geçilirse odak plakaya geri çekilmez', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.clock.pauseAt(new Date('2026-09-23T07:05:00Z')); // ekran kareleri elle ilerletilir
  await page.locator('[data-action="add-visit"]').first().click();
  const form = page.locator('#visit-form');
  await form.locator('[name="customer"]').focus(); // kullanıcı hemen müşteri alanına geçti
  await page.clock.runFor(100); // bir sonraki ekran karesi
  expect(await page.evaluate(() => document.activeElement?.name)).toBe('customer');
  await page.keyboard.type('YENİ LOJ');
  await expect(form.locator('[name="customer"]')).toHaveValue('YENİ LOJ');
  await expect(form.locator('[name="plate"]')).toHaveValue('');
  expect(problems).toEqual([]);
});

test('kaydet beklemez: kayıt yazılınca form hemen kapanır, liste arkada yenilenir', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.clock.runFor(2000);
  // Sunucudan okuma (yenileme) çok yavaş: hiç cevap gelmiyor. Yazma çalışıyor.
  await page.evaluate(() => { window.__hangReads = true; });
  const visitsOf = plate => page.evaluate(p => window.PCS_TEST.getState().visits.filter(v => v.plate === p), plate);
  const form = page.locator('#visit-form');

  // 1) Kayıtlı plaka
  await page.locator('[data-action="add-visit"]').first().click();
  await form.locator('[name="plate"]').fill('06 KL 4567');
  await form.locator('[name="customer"]').fill('ABC NAKLİYAT');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Araç gelişi kaydedildi');
  await expect(page.locator('#modal')).toBeHidden();
  const added = await visitsOf('06 KL 4567');
  expect(added.map(v => v.date).sort()).toEqual(['2026-09-22', '2026-09-23']);
  expect(added.find(v => v.date === '2026-09-23').updated_at).toBeTruthy(); // sunucunun verdiği sürüm: hemen yeniden düzenlenebilir

  // 2) Yeni plaka: önce plaka kaydı, sonra geliş yazılır; ikisi de beklemeden listeye girer
  await page.locator('[data-action="add-visit"]').first().click();
  await form.locator('[name="plate"]').fill('16 ZZ 1600');
  await form.locator('[name="customer"]').fill('YENİ MÜŞTERİ');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('plaka kayıtlarına eklendi');
  await expect(page.locator('#modal')).toBeHidden();
  expect((await visitsOf('16 ZZ 1600')).length).toBe(1);
  expect(await page.evaluate(() => window.PCS_TEST.getState().registry.some(r => r.plate === '16 ZZ 1600'))).toBe(true);

  // 3) Durum kutusu: işaret hemen kaydedilir
  await page.locator('input[data-check="onsite"][data-id="v6"]').first().evaluate(el => el.click());
  await expect.poll(async () => (await page.evaluate(() => window.PCS_TEST.getState().visits.find(v => v.id === 'v6'))).onsite).toBe(true);
  expect((await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'))).onsite).toBe(true);
  // banttaki bugünün sayıları da hemen güncellenir: 5 araç, 3 tesiste, 2 gelecek
  expect(await page.locator('.k-hero .k-stat b').allTextContents()).toEqual(['5', '3', '2', '0']);

  // Okuma düzelince arkadaki yenileme tamamlanır; liste sunucuyla aynı kalır.
  await page.evaluate(() => { window.__hangReads = false; });
  await page.clock.runFor(35000);
  const ids = t => page.evaluate(t => window.PCS_TEST.getState()[t].map(r => r.id), t);
  const dbIds = t => page.evaluate(t => window.__db[t].map(r => r.id).sort(), t);
  expect(await ids('visits')).toEqual(await dbIds('visits'));
  expect(await ids('registry')).toEqual(await dbIds('registry'));
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

test('Kiril harfle yazılmış plaka BG tanınır, Latin harfle aranınca bulunur', async ({ page }) => {
  const data = sampleData();
  // "Х 8123 КТ - Х 3382 ЕМ": X, K, T, E, M harfleri Kiril (Bulgar belgesinden kopyalanmış gibi)
  const cyr = '\u0425 8123 \u041a\u0422 - \u0425 3382 \u0415\u041c';
  data.visits.push({ ...data.visits[5], id: 'v8', plate: cyr, customer: 'KİRİL LOJ', visit_time: '11:00' });
  const problems = await openApp(page, { data });
  const lp = page.locator('.lp', { hasText: '8123' }).first();
  await expect(lp.locator('.lp-band b')).toHaveText('BG');
  await expect(lp.locator('.lp-cc2')).toHaveCount(0); // dorse de BG: ayrı ülke etiketi yok
  await page.locator('#board-search').fill('x 8123 kt');
  await expect(page.locator('#app')).toContainText('KİRİL LOJ');
  expect(problems).toEqual([]);
});

test('Macar plakası tanınır: yeni biçim her zaman, eski biçim Macar nakliyecide ya da Macar plakasıyla çiftte', async ({ page }) => {
  const data = sampleData();
  const add = (id, plate, carrier) => data.visits.push({ ...data.visits[5], id, plate, carrier, customer: 'BBL LOJİSTİK', visit_time: '11:00' });
  add('v8', 'AAKX 760', 'BBL LOGISTICS HUNGARY KFT');
  add('v9', 'KLM-123 - XAA-456', 'SZABÓ TRANS Kft.');
  add('v10', 'AE BC-321 - XZZ 654', '');
  add('v11', 'CHA 123', 'MOLDTRANS SRL');
  const problems = await openApp(page, { data });
  const band = t => page.locator('.lp', { hasText: t }).first();
  await expect(band('AAKX 760').locator('.lp-band b')).toHaveText('HU');
  await expect(band('AAKX 760')).toHaveAttribute('title', /Macaristan/);
  await expect(band('KLM-123').locator('.lp-band b')).toHaveText('HU');
  await expect(band('KLM-123').locator('.lp-cc2')).toHaveCount(0); // dorse de Macar
  await expect(band('AE BC-321').locator('.lp-band b')).toHaveText('HU');
  await expect(band('AE BC-321').locator('.lp-cc2')).toHaveCount(0);
  await expect(band('CHA 123').locator('.lp-band b')).toHaveText('MD');
  expect(problems).toEqual([]);
});

test('Çek plakası tanınır: CZ şeridi ve AB yıldızları, çift plakada dorse de Çek', async ({ page }) => {
  const data = sampleData();
  const add = (id, plate) => data.visits.push({ ...data.visits[5], id, plate, carrier: 'ANKA EUROPE LOGISTICS S.R.O', customer: 'ANKA LOJİSTİK', visit_time: '12:00' });
  add('v8', '3 BT 6494');
  add('v9', '1A2 3456 - 2B1 9999');
  const problems = await openApp(page, { data });
  const band = t => page.locator('.lp', { hasText: t }).first();
  await expect(band('3 BT 6494').locator('.lp-band b')).toHaveText('CZ');
  await expect(band('3 BT 6494')).toHaveAttribute('title', /Çekya/);
  await expect(band('3 BT 6494').locator('.lp-band svg')).toHaveCount(1); // AB şeridi (yıldızlar)
  await expect(band('1A2 3456').locator('.lp-band b')).toHaveText('CZ');
  await expect(band('1A2 3456').locator('.lp-cc2')).toHaveCount(0);     // dorse de Çek
  // diğer ülkelerin biçimleri etkilenmez
  const cc = await page.evaluate(() => ['34 ABC 123', '3BT6494', 'B 123 XYZ', 'CB 1234 AB', 'AG 08 PLS', 'PB 1234 AB'].map(p => window.PCS_TEST.plateCountry(p)));
  expect(cc).toEqual(['TR', 'CZ', 'RO', 'BG', 'RO', 'BG']);
  expect(await page.evaluate(() => window.PCS_TEST.fmtCompactPlate('3BT6494'))).toBe('3BT 6494');
  expect(problems).toEqual([]);
});

test('son hareketler: işlemi kimin yaptığı görünür', async ({ page }) => {
  const data = sampleData();
  data.visits.find(v => v.id === 'v7').updated_at = '2026-09-23T06:55:00Z';
  data.app_settings.push({ key: 'display_names', value: { 'atakan@pcs.com': 'Atakan Kolbaşı' }, updated_at: '2026-09-01T08:00:00Z' });
  const history = {
    v7: [
      { action: 'onsite_on', at: '2026-09-23T06:10:00Z', actor_email: 'mehmet@pcs.com' },
      { action: 't1_on', at: '2026-09-23T06:55:00Z', actor_email: 'atakan@pcs.com' }
    ],
    v5: [{ action: 'onsite_on', at: '2026-09-23T05:05:00Z', actor_email: 'Güvenlik' }]
  };
  const problems = await openApp(page, { data, history });
  const acts = page.locator('#side-activity .activity');
  await expect(acts.first()).toContainText('T1 yazıldı');
  await expect(acts.first().locator('.activity-who')).toHaveText('Atakan Kolbaşı');
  await expect(acts.first()).toContainText('5 dk önce');
  const v5 = page.locator('#side-activity .activity[data-id="v5"]');
  await expect(v5).toContainText('Tesiste');
  await expect(v5.locator('.activity-who')).toHaveText('Güvenlik');
  // geçmişi olmayan araçta kişi satırı yok; aracın durumu gösterilir
  await expect(page.locator('#side-activity .activity[data-id="v6"] .activity-who')).toHaveCount(0);
  // geçmiş araç değişmedikçe yeniden sorulmaz
  const asked = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'visit_history').length);
  expect(asked).toBeGreaterThan(0);
  await page.locator('#board-search').fill('34');
  await page.locator('#board-search').fill('');
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'visit_history').length)).toBe(asked);
  expect(problems).toEqual([]);
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
  expect(r.stroke).toBe(0);                                  // yazıya kalınlaştırıcı çizgi eklenmez (bulanık / kalın görünüyordu)
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

// Görüntüyü saat yönünde döndürür (yan çekilmiş fotoğraf gibi).
async function rotateImage(browser, buf, deg) {
  const p = await browser.newPage();
  const b64 = await p.evaluate(async ({ src, deg }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); const side = deg % 180 !== 0;
    c.width = side ? img.height : img.width; c.height = side ? img.width : img.height;
    const x = c.getContext('2d'); x.translate(c.width / 2, c.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(img, -img.width / 2, -img.height / 2);
    return c.toDataURL('image/png').split(',')[1];
  }, { src: 'data:image/png;base64,' + buf.toString('base64'), deg });
  await p.close();
  return Buffer.from(b64, 'base64');
}

test('araç o gün panodaysa ruhsattan yeni kayıt açılmaz, ruhsat kilosu mevcut kayda işlenir', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r6', plate: 'PB 4321 AB - PB 8765 CD', customer: 'İKİNCİ LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  // Bugün (Çarşamba) iki araç panoda: birinin ruhsatı boş, diğerinde farklı bir değer yazılı.
  data.visits.push({ ...data.visits[5], id: 'v8', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', registration: '' });
  data.visits.push({ ...data.visits[5], id: 'v9', plate: 'PB 4321 AB - PB 8765 CD', customer: 'İKİNCİ LOJ', registration: '15000 KG' });
  const bos = await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]);
  const dolu = await fakeRuhsat(browser, ['PB4321AB', 7900], ['PB8765CD', 6100]);
  const problems = await openApp(page, { data });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await page.locator('#ruhsat-file').setInputFiles([{ name: 'bos.png', mimeType: 'image/png', buffer: bos }, { name: 'dolu.png', mimeType: 'image/png', buffer: dolu }]);
  await expect(page.locator('.rs-status.tamam')).toHaveCount(2, { timeout: 120000 });
  const [c1, c2] = [page.locator('.rs-item').nth(0), page.locator('.rs-item').nth(1)];

  // 1) Ruhsatı boş olan kayıt: "Hemen ekle" yok, ruhsat tek tıkla işlenir; plaka kaydındaki boş ruhsat da dolar.
  await expect(c1).toContainText('zaten panoda');
  await expect(c1.locator('[data-action="ruhsat-add"]')).toHaveCount(0);
  await c1.locator('[data-action="ruhsat-kg"]').click();
  await expect(page.locator('#toast')).toContainText('14850 KG olarak panodaki kayda işlendi');
  await expect(c1.locator('.rs-status')).toContainText('Ruhsat panodaki kayda işlendi');

  // 2) Farklı değer yazılı kayıt: önce sorulur, onaylanınca değişir.
  await expect(c2).toContainText('Panodaki ruhsat: 15000 KG');
  page.once('dialog', d => d.accept());
  await c2.locator('[data-action="ruhsat-kg"]').click();
  await expect(c2.locator('.rs-status')).toContainText('14000 KG');

  const calls = await page.evaluate(() => window.__calls.filter(c => c.op === 'insert' || c.op === 'update').map(c => c.table + ':' + c.op));
  expect(calls.filter(c => c.endsWith('insert'))).toEqual([]);
  const db = await page.evaluate(() => ({ v8: window.__db.visits.find(v => v.id === 'v8').registration, v9: window.__db.visits.find(v => v.id === 'v9').registration, r5: window.__db.registry.find(r => r.id === 'r5').registration }));
  expect(db).toEqual({ v8: '14850 KG', v9: '14000 KG', r5: '14850 KG' });
  expect(problems).toEqual([]);
});

test('WhatsApp: araç o gün panodaysa ruhsat kilosu kendiliğinden yazılmaz, tek tıkla işlenir', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  // Araç bugün (Çarşamba) panoda, ruhsatı boş; fotoğraf da bugün geldi. Panodaki araç plaka kayıtlarında da var.
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.visits.push({ ...data.visits[5], id: 'v8', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', registration: '' });
  data.incoming_ruhsat = [waRow('w1', { created_at: '2026-09-23T06:30:00Z' })];
  const files = { '2026-09-22/w1.png': (await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700])).toString('base64') };
  const problems = await openApp(page, { data, files });
  const row = () => page.evaluate(() => window.__db.incoming_ruhsat[0]);
  // Okunur ama panodaki kayda dokunulmaz: onay bekler.
  await expect.poll(async () => (await row()).status, { timeout: 120000 }).toBe('bekliyor');
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v8').registration)).toBe('');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && (c.op === 'insert' || c.op === 'update')).length)).toBe(0);
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const card = page.locator('#wa-w1');
  await expect(card).toContainText('zaten panoda');
  await expect(card.locator('[data-action="ruhsat-add"]')).toHaveCount(0);
  await card.locator('[data-action="ruhsat-kg"]').click();
  await expect(page.locator('#toast')).toContainText('14850 KG olarak panodaki kayda işlendi');
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v8').registration)).toBe('14850 KG');
  expect((await row()).status).toBe('mevcut');
  expect(problems).toEqual([]);
});

test('yan çekilmiş ruhsat fotoğrafı döndürülüp okunur', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: 'KARGO SRL', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  const yan = await rotateImage(browser, await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]), 90);
  await openApp(page, { data });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await page.locator('#ruhsat-file').setInputFiles([{ name: 'yan.png', mimeType: 'image/png', buffer: yan }]);
  await expect(page.locator('.rs-status.tamam')).toHaveCount(1, { timeout: 120000 });
  const card = page.locator('.rs-item');
  await expect(card).toContainText('RUHSAT LOJ');
  await expect(card).toContainText('8150 kg + 6700 kg = 14850 kg');
  await expect(card.locator('.rs-thumb')).toHaveAttribute('style', /rotate\(270deg\)/);
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

test('ruhsat okuma: alan harfi plakaya yapışmaz, katar ağırlığı alınmaz, model satırı plaka sanılmaz', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const r = await page.evaluate(() => {
    const T = window.PCS_TEST;
    // Gerçek fotoğraflardan okunmuş metin parçaları (Bulgar ve Türk ruhsatı).
    const bg = ['(A) X1580EM', '(E) WKESD000000371611', '(D) NONYPEMAPKE', 'SEMI-TRAILER', '(D.1) SCHMITZ SCS 24 L 13.62 EB',
      '(G) 6650', '', '{A) X2104MB', '(D) BAEKAY', 'TRACTOR', '(G) 7489'].join('\n');
    const bg2 = ['X1580EM', 'SCHMITZ SCS 24 L 13.62 EB', 'X2104MB', 'AAS200'].join('\n');
    const ranked = T.ruhsatRank([bg, bg2]);
    const kinds = [bg, bg2].reduce((k, t) => T.ruhsatKinds(t, k), {});
    const pick = ({ tractor, trailer }) => ({ tractor, trailer });
    return {
      label: T.ruhsatPlates('(A) X1580EM\nA B-939-PLS\n(A) T 2076 EB'),
      ranked: ranked.slice(0, ranked.strong),
      resolved: pick(T.ruhsatResolve(ranked, kinds, ranked.strong)),
      bgKg: T.ruhsatWeights(bg),
      // Türk kamyonet ruhsatı: G.1 net ağırlık, (G) katar ağırlığı, F.1 azami yüklü ağırlık
      trKg: T.ruhsatWeights('(G.1) NET AĞIRLIĞI kg.\n2165\n(G) KATAR AĞIRLIĞI kg.\n6500\n(F.1) AZAMİ YÜKLÜ AĞIRLIĞI 3500'),
      trOcr: T.ruhsatWeights('(G1) NET AGIRLICI\nkg\n7180'),
      // bir okumada 6520 "8520" çıkmış: iki okumanın desteklediği çift seçilir
      vote: T.ruhsatPickWeights(['(G) 8520\n(G) 7358', '(G) 6520\n(G) 7358', '(G) 6520'])
    };
  });
  expect(r.label).toEqual(['X1580EM', 'B939PLS', 'T2076EB']);
  expect(r.ranked).toEqual(['X1580EM', 'X2104MB']);
  expect(r.resolved).toEqual({ tractor: 'X2104MB', trailer: 'X1580EM' });
  expect(r.bgKg).toEqual([6650, 7489]);
  expect(r.trKg).toEqual([2165]);
  expect(r.trOcr).toEqual([7180]);
  expect(r.vote).toEqual([6520, 7358]);
});

test('ruhsat okuma: ruhsattaki cins yazısı, dorsenin kayıtta önde yazılmasından önce gelir', async ({ page }) => {
  const data = sampleData();
  // Dorse (AG 08 PLS) kayıtlarda başka bir satırda yanlışlıkla önde yazılmış.
  data.registry.push({ id: 'r7', plate: 'AG 08 PLS - AG 05 PLS', customer: 'PLASTNAK LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const r = await page.evaluate(() => {
    const T = window.PCS_TEST, pick = ({ tractor, trailer, reg, tractorReg, trailerReg }) => ({ tractor, trailer, reg: !!reg, tractorReg: tractorReg?.customer || '', trailerReg: trailerReg?.customer || '' });
    // Romen ruhsatı: dorse kartı üstte (SEMIREMORCA), çekici altta (AUTOUTILITARA)
    const ro = ['A AG-08-PLS', 'J SEMIREMORCA O4', 'D.1 KOGEL', '', 'A B-939-PLS', 'J AUTOUTILITARA N3', 'D.1 SCANIA'].join('\n');
    const cands = T.ruhsatRank([ro, ro]);
    const both = pick(T.ruhsatResolve(cands, T.ruhsatKinds(ro, {}), cands.strong));
    // dorse kartının cins satırı okunamamış: çekici belli, kayıtlı öbür plaka dorse sayılır
    const partial = ro.replace('J SEMIREMORCA O4', 'J 5EM1');
    const c2 = T.ruhsatRank([partial]);
    return { both, partial: pick(T.ruhsatResolve(c2, T.ruhsatKinds(partial, {}), c2.strong)) };
  });
  expect(r.both).toEqual({ tractor: 'B939PLS', trailer: 'AG08PLS', reg: false, tractorReg: '', trailerReg: 'PLASTNAK LOJ' });
  expect(r.partial).toEqual({ tractor: 'B939PLS', trailer: 'AG08PLS', reg: false, tractorReg: '', trailerReg: 'PLASTNAK LOJ' });
});

test('ruhsat okuma: dorse okunamadıysa çekicinin kayıttaki tek dorsesi önerilir, kesin sayılmaz', async ({ page }) => {
  const data = sampleData();
  data.registry.push({ id: 'r8', plate: 'TR 35 WLF - TR 47 WLF', customer: 'ETL LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r9', plate: 'PB 1111 AA - PB 2222 BB', customer: 'İKİ DORSE', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r10', plate: 'PB 1111 AA - PB 3333 CC', customer: 'İKİ DORSE', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const r = await page.evaluate(() => {
    const T = window.PCS_TEST, pick = ({ tractor, trailer, guess, fuzzy, reg }) => ({ tractor, trailer, guess, fuzzy, reg: reg?.customer || '' });
    // Dorse kartı parlamada kalmış: yalnızca çekici okunmuş.
    const one = 'A TR-35-WLF\nJ AUTOUTILITARA N3\nG 7860';
    const two = 'A PB1111AA\n(D) TRACTOR\n(G) 8000';
    const c1 = T.ruhsatRank([one]), c2 = T.ruhsatRank([two]);
    return { one: pick(T.ruhsatResolve(c1, T.ruhsatKinds(one, {}), c1.strong)), two: pick(T.ruhsatResolve(c2, T.ruhsatKinds(two, {}), c2.strong)) };
  });
  expect(r.one).toEqual({ tractor: 'TR35WLF', trailer: 'TR47WLF', guess: true, fuzzy: true, reg: 'ETL LOJ' });
  // Çekicinin iki dorsesi kayıtlıysa tahmin yapılmaz.
  expect(r.two).toEqual({ tractor: 'PB1111AA', trailer: '', guess: false, fuzzy: false, reg: '' });
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

// WhatsApp numarasına gelmiş gibi kutuya düşen satır (sunucu fonksiyonunun eklediği biçimde).
const waRow = (id, extra = {}) => ({
  id, wa_message_id: 'wamid.' + id, from_number: '905321112233', sender_name: 'Ali Şoför', caption: '', media_path: `2026-09-22/${id}.png`, mime: 'image/png',
  status: 'yeni', claimed_at: null, claimed_by: null, tractor: '', trailer: '', weights: [], fuzzy: false, note: '', ai: null, plate: '', visit_id: null,
  created_at: '2026-09-22T06:30:00Z', updated_at: '2026-09-22T06:30:00Z', ...extra
});

test('WhatsApp: hiçbir araç sorulmadan panoya eklenmez; kayıtlı olanlar tek onayla, yeni araç formla eklenir', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: 'KARGO SRL', registration: '14850 KG', updated_at: '2026-09-01T08:00:00Z' });
  data.app_settings.push({ key: 'customer_contacts', value: { numbers: { 'YENİ LOJ': '0532 111 22 33' } }, updated_at: '2026-09-01T08:00:00Z' });
  // w1 ve w3 aynı kayıtlı aracın iki fotoğrafı (şoför iki kez göndermiş)
  data.incoming_ruhsat = [waRow('w1'), waRow('w2', { created_at: '2026-09-22T06:31:00Z' }), waRow('w3', { created_at: '2026-09-22T06:32:00Z' })];
  const kayitli = (await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700])).toString('base64');
  const files = { '2026-09-22/w1.png': kayitli, '2026-09-22/w3.png': kayitli, '2026-09-22/w2.png': (await fakeRuhsat(browser, ['PB4321AB', 7900], ['PB8765CD', 6100])).toString('base64') };
  const problems = await openApp(page, { data, files });
  const row = id => page.evaluate(i => window.__db.incoming_ruhsat.find(r => r.id === i), id);

  // 1) Üçü de okunur ve onay bekler; panoya hiçbir şey eklenmez.
  for (const id of ['w1', 'w2', 'w3']) await expect.poll(async () => (await row(id)).status, { timeout: 120000 }).toBe('bekliyor');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').length)).toBe(0);
  const w2 = await row('w2');
  expect([w2.tractor, w2.trailer, w2.weights]).toEqual(['PB4321AB', 'PB8765CD', [7900, 6100]]);
  const open = page.locator('.heading [data-action="ruhsat-open"]');
  await expect(open.locator('.rs-badge')).toHaveText('3');
  await expect(page.locator('#toast')).toContainText('onayınızı bekliyor');

  // 2) Pencerede: kayıtlı araç için "Panoya ekle", hepsi için tek onay. Aynı araç bir kez eklenir.
  await open.click();
  await expect(page.locator('.rs-wa-head')).toContainText('siz onaylamadan panoya eklenmez');
  await expect(page.locator('#wa-w1 [data-action="ruhsat-add"]')).toHaveText('Panoya ekle');
  const bulk = page.locator('[data-action="ruhsat-add-all"]');
  await expect(bulk).toHaveText('Hepsini panoya ekle (2)');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await bulk.click();
  await expect(page.locator('#toast')).toContainText('1 araç panoya eklendi');
  expect(asked).toContain('Şu 1 araç panoya eklensin mi?');
  expect(asked).toContain('PB 1234 AB - PB 5678 CD · RUHSAT LOJ');
  expect(asked).toContain('aynı aracın tekrarı');
  const inserted = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));
  // gün ve saat fotoğrafın geldiği an (Salı 09:30)
  expect(inserted.map(v => [v.plate, v.customer, v.registration, v.visit_date, v.visit_time])).toEqual([
    ['PB 1234 AB - PB 5678 CD', 'RUHSAT LOJ', '14850 KG', '2026-09-22', '09:30']
  ]);
  expect([(await row('w1')).status, (await row('w3')).status]).toEqual(['eklendi', 'mevcut']);
  expect((await row('w1')).visit_id).toBe(inserted[0].id);
  await expect(page.locator('#wa-w1')).toContainText('Panoya eklendi');
  await expect(bulk).toHaveCount(0);

  // 3) Yeni araç: müşteri gönderenin numarasından gelir, gün Salı olur.
  const card = page.locator('#wa-w2');
  await expect(card).toContainText('Ali Şoför');
  await expect(card).toContainText('YENİ LOJ');
  await expect(card).toContainText('7900 kg + 6100 kg = 14000 kg');
  await card.locator('[data-action="ruhsat-form"]').click();
  const form = page.locator('#visit-form');
  await expect(form.locator('[name="plate"]')).toHaveValue('PB 4321 AB - PB 8765 CD');
  await expect(form.locator('[name="customer"]')).toHaveValue('YENİ LOJ');
  await expect(form.locator('[name="date"]')).toHaveValue('2026-09-22');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('kaydedildi');
  await expect.poll(async () => (await row('w2')).status).toBe('eklendi');
  await expect(open.locator('.rs-badge')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('WhatsApp: başka ekranın okuduğu fotoğrafa dokunulmaz, bekleyen listeden çıkarılabilir', async ({ page, context }) => {
  const data = sampleData();
  data.incoming_ruhsat = [
    waRow('w3', { status: 'okunuyor', claimed_at: '2026-09-23T06:59:30Z', claimed_by: 'u2' }),
    waRow('w4', { status: 'bekliyor', tractor: 'PB9999AA', trailer: 'PB8888BB', weights: [8000, 6500] })
  ];
  const problems = await openApp(page, { data, files: {} });
  const open = page.locator('.heading [data-action="ruhsat-open"]');
  await expect(open.locator('.rs-badge')).toHaveText('1');
  await open.click();
  await expect(page.locator('#wa-w3')).toContainText('Başka bir ekranda okunuyor');
  await expect(page.locator('#wa-w4')).toContainText('8000 kg + 6500 kg = 14500 kg');
  // Başka ekran bitirdi: satır "bekliyor" olunca bu ekranda da okunan bilgiler görünür.
  await page.evaluate(() => { Object.assign(window.__db.incoming_ruhsat.find(r => r.id === 'w3'), { status: 'bekliyor', tractor: 'PB7777CC', trailer: 'PB6666DD' }); window.__rtEmit('incoming_ruhsat'); });
  await expect(page.locator('#wa-w3 input').first()).toHaveValue('PB 7777 CC');
  await expect(open.locator('.rs-badge')).toHaveText('2');
  await page.locator('#wa-w4 [data-action="ruhsat-dismiss"]').click();
  await expect(page.locator('#wa-w4')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.incoming_ruhsat.find(r => r.id === 'w4').status)).toBe('yoksayildi');
  // Kimse bu ekranda fotoğraf okumaya kalkmadı (w3 başkasındaydı).
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'incoming_ruhsat' && c.op === 'update').length)).toBe(1);
  expect(problems).toEqual([]);

  // Görüntüleyici kutuya hiç bakmaz.
  const viewer = await context.newPage();
  await openApp(viewer, { role: 'viewer', data });
  await expect(viewer.locator('#app')).toContainText('34 ABC 123');
  expect(await viewer.evaluate(() => window.__calls.filter(c => c.table === 'incoming_ruhsat').length)).toBe(0);
});

test('WhatsApp: eski sürümün yanlış okuduğu fotoğraf "Yeniden oku" ile baştan okunur', async ({ page, browser }) => {
  test.setTimeout(150000);
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  // Eski okuma: alan harfi plakaya yapışmış, çift kayıtlarda bulunamamış.
  data.incoming_ruhsat = [waRow('w5', { status: 'bekliyor', tractor: 'APB1234AB', trailer: '', weights: [] })];
  const files = { '2026-09-22/w5.png': (await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700])).toString('base64') };
  const problems = await openApp(page, { data, files });
  const row = () => page.evaluate(() => window.__db.incoming_ruhsat.find(r => r.id === 'w5'));
  const open = page.locator('.heading [data-action="ruhsat-open"]');
  await expect(open.locator('.rs-badge')).toHaveText('1');
  await open.click();
  const card = page.locator('#wa-w5');
  await expect(card.locator('input').first()).toHaveValue('APB 1234 AB');
  await card.locator('[data-action="ruhsat-reread"]').click();
  // Bu ekran üstlenip baştan okur; sonuç yine onay bekler.
  await expect.poll(async () => (await row()).claimed_by, { timeout: 30000 }).toBe('u1');
  await expect.poll(async () => (await row()).tractor, { timeout: 120000 }).toBe('PB1234AB');
  expect((await row()).status).toBe('bekliyor');
  await expect(card.locator('input').first()).toHaveValue('PB 1234 AB');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').length)).toBe(0);
  await card.locator('[data-action="ruhsat-add"]').click();
  await expect(card).toContainText('Panoya eklendi');
  expect((await row()).status).toBe('eklendi');
  const inserted = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));
  expect(inserted.map(v => [v.plate, v.customer, v.registration])).toEqual([['PB 1234 AB - PB 5678 CD', 'RUHSAT LOJ', '14850 KG']]);
  expect(problems).toEqual([]);
});

test('yapay zekâ (Gemini) kuruluysa WhatsApp fotoğrafı onunla okunur; okuyamadığı dorse kayıttan önerilir', async ({ page, browser }) => {
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r6', plate: 'TR 35 WLF - TR 47 WLF', customer: 'ETL LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.incoming_ruhsat = [waRow('w6')];
  // Fotoğrafın kendisi önemsiz: okumayı sahte Gemini cevabı verir (bu bilgisayardaki okuma hiç çalışmamalı).
  const files = { '2026-09-22/w6.png': (await fakeRuhsat(browser, ['XX0000XX', 1], ['YY0000YY', 1])).toString('base64') };
  const ai = { vehicles: [{ plate: 'PB5678CD', kind: 'trailer', empty_weight_kg: 6700, country: 'BG' }, { plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8150, country: 'BG' }], problem: '' };
  const problems = await openApp(page, { data, files, ai });
  const row = id => page.evaluate(i => window.__db.incoming_ruhsat.find(r => r.id === i), id);
  await expect.poll(async () => (await row('w6')).status, { timeout: 30000 }).toBe('bekliyor');
  expect([(await row('w6')).tractor, (await row('w6')).trailer, (await row('w6')).weights]).toEqual(['PB1234AB', 'PB5678CD', [8150, 6700]]);
  // Gemini'nin ham cevabı da saklanır: başka ekranlar plaka kayıtlarıyla kendileri eşleştirir
  expect((await row('w6')).ai).toEqual(ai);
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').length)).toBe(0);
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').map(c => c.type))).toEqual(['image/png']);
  expect(await page.evaluate(() => typeof window.Tesseract)).toBe('undefined');

  // Elle eklenen fotoğraf: dorse kartı parlamada kalmış, Gemini yalnızca çekiciyi okuyup nedenini yazmış.
  await page.evaluate(() => { window.__PCS_STUB.ai = { vehicles: [{ plate: 'TR35WLF', kind: 'tractor', empty_weight_kg: 7860, country: 'RO' }], problem: 'Üstteki dorse kartı parlama yüzünden okunamıyor.' }; });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await expect(page.locator('.modal-header')).toContainText('yapay zekâyla (Google Gemini)');
  await expect(page.locator('.modal-header')).toContainText('siz onaylayınca eklenir');
  await page.locator('#ruhsat-file').setInputFiles([{ name: 'wlf.png', mimeType: 'image/png', buffer: Buffer.from(files['2026-09-22/w6.png'], 'base64') }]);
  const card = page.locator('.rs-item').last();
  await expect(card.locator('.rs-status')).toHaveText('Okundu · yapay zekâ');
  await expect(card.locator('input').nth(1)).toHaveValue('TR 47 WLF');
  await expect(card).toContainText('kayıttaki dorsesi');
  await expect(card).toContainText('Yapay zekâ: Üstteki dorse kartı parlama yüzünden okunamıyor.');
  // dorsesi tahmin edilen araç topluca eklenmez (tek tek bakılmalı); WhatsApp'taki kayıtlı araç eklenir
  await expect(page.locator('[data-action="ruhsat-add-all"]')).toHaveText('Hepsini panoya ekle (1)');

  // Gemini fotoğrafta ruhsat bulamadıysa bu bilgisayarda okumaya geçilmez, nedeni yazar.
  await page.evaluate(() => { window.__PCS_STUB.ai = { vehicles: [], problem: 'Fotoğrafta ruhsat görünmüyor.' }; });
  await page.locator('#ruhsat-file').setInputFiles([{ name: 'bos.png', mimeType: 'image/png', buffer: Buffer.from(files['2026-09-22/w6.png'], 'base64') }]);
  await expect(page.locator('.rs-item').last().locator('.rs-status')).toHaveText('Okunamadı: Yapay zekâ ruhsatı okuyamadı · Fotoğrafta ruhsat görünmüyor.');
  expect(await page.evaluate(() => typeof window.Tesseract)).toBe('undefined');
  expect(problems).toEqual([]);
});

test('Gemini hata verince beklenip yeniden denenir; hiç olmazsa bu bilgisayarda okunmaz, istenirse okunur', async ({ page, browser }) => {
  test.setTimeout(150000);
  const img = await fakeRuhsat(browser, ['PB1234AB', 8150], ['PB5678CD', 6700]);
  const ok = { vehicles: [{ plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8150 }, { plate: 'PB5678CD', kind: 'trailer', empty_weight_kg: 6700 }], problem: '' };
  const problems = await openApp(page, { ai: [{ status: 429, body: { error: 'Gemini 429', retry_after: 20 } }, { status: 503 }, ok] });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const add = name => page.locator('#ruhsat-file').setInputFiles([{ name, mimeType: 'image/png', buffer: img }]);
  const status = page.locator('.rs-item .rs-status');
  const calls = () => page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length);

  // 1) Sınır doldu: Gemini'nin söylediği süre (+2 sn) beklenir; sonra Google yoğun: giderek uzayan aralıkla
  //    (ikinci beklemede 15 sn) beklenir; sonra okur.
  await add('a.png');
  await expect(status.first()).toContainText('Gemini ücretsiz kullanım sınırı doldu; 22 sn sonra yeniden denenecek (deneme 2/6)');
  await page.clock.fastForward(23000);
  await expect(status.first()).toContainText(/Gemini şu an çok yoğun; 1[45] sn sonra yeniden denenecek \(deneme 3\/6\)/);
  await page.clock.fastForward(16000);
  await expect(status.first()).toHaveText('Okundu · yapay zekâ', { timeout: 20000 });
  await expect(page.locator('.rs-item').first()).toContainText('8150 kg + 6700 kg = 14850 kg');
  expect(await calls()).toBe(3);

  // 2) Sınır hep dolu: altı deneme (beş bekleme) yapılır; bu bilgisayarda okumaya geçilmez.
  await page.evaluate(() => { window.__PCS_STUB.ai = { status: 429 }; });
  await add('b.png');
  for (const sec of [15, 30, 45, 60, 90]) { await expect(status.nth(1)).toContainText(`${sec} sn sonra yeniden denenecek`, { timeout: 20000 }); await page.clock.fastForward(sec * 1000 + 1000); }
  await expect(status.nth(1)).toHaveText('Okunamadı: Gemini şu an okuyamadı (Gemini ücretsiz kullanım sınırı doldu)', { timeout: 20000 });
  expect(await calls()).toBe(3 + 6);
  expect(await page.evaluate(() => typeof window.Tesseract)).toBe('undefined');
  const card = page.locator('.rs-item').nth(1);
  await expect(card).toContainText('Gemini birkaç kez denendi');

  // 3) Hemen ardından gelen fotoğraf (Google hâlâ cevap vermiyor) üç denemeyle yetinir; iki kart okunamayınca
  //    hepsini yeniden okuma düğmesi çıkar.
  await add('c.png');
  for (const sec of [15, 30]) { await expect(status.nth(2)).toContainText(`${sec} sn sonra yeniden denenecek (deneme`, { timeout: 20000 }); await page.clock.fastForward(sec * 1000 + 1000); }
  await expect(status.nth(2)).toContainText('Okunamadı: Gemini şu an okuyamadı', { timeout: 20000 });
  expect(await calls()).toBe(3 + 6 + 3);
  await expect(page.locator('[data-action="ruhsat-reread-all"]')).toBeVisible();

  // 4) "Bu bilgisayarda oku": Gemini beklenmeden eski yoldan okunur ve kontrol edilmesi istenir.
  await card.locator('[data-action="ruhsat-ocr"]').click();
  await expect(status.nth(1)).toHaveText('Okundu', { timeout: 120000 });
  await expect(card).toContainText('yapay zekâ yerine bu bilgisayarda okundu');
  await expect(card).toContainText('8150 kg + 6700 kg = 14850 kg');
  expect(await calls()).toBe(3 + 6 + 3);
  expect(problems).toEqual([]);
});

test('WhatsApp: Gemini’nin okuyamadığı fotoğraf 10 dakika sonra kendiliğinden yeniden okunur', async ({ page, browser }) => {
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  // 1 saat önce gelmiş, 5 dakika önce Gemini'ye son kez denenmiş ve olmamış
  data.incoming_ruhsat = [waRow('w7', { status: 'bekliyor', note: 'Gemini şu an okuyamadı (Gemini şu an çok yoğun)', created_at: '2026-09-23T06:00:00Z', updated_at: '2026-09-23T06:55:00Z' })];
  const files = { '2026-09-22/w7.png': (await fakeRuhsat(browser, ['XX0000XX', 1], ['YY0000YY', 1])).toString('base64') };
  const ai = { vehicles: [{ plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8150 }, { plate: 'PB5678CD', kind: 'trailer', empty_weight_kg: 6700 }], problem: '' };
  const problems = await openApp(page, { data, files, ai });
  const row = () => page.evaluate(() => window.__db.incoming_ruhsat.find(r => r.id === 'w7'));
  const calls = () => page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length);
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const card = page.locator('#wa-w7');
  await expect(card.locator('.rs-status')).toHaveText('Okunamadı: Gemini şu an okuyamadı (Gemini şu an çok yoğun)');
  await expect(card).toContainText('Gemini birkaç kez denendi');
  await expect(card.locator('[data-action="ruhsat-ocr"]')).toBeVisible();
  expect(await calls()).toBe(0);
  // 10 dakika dolunca kendiliğinden yeniden okunur; sonuç yine onay bekler
  await page.clock.fastForward(6 * 60000);
  await expect.poll(async () => (await row()).tractor, { timeout: 30000 }).toBe('PB1234AB');
  expect(await calls()).toBe(1);
  expect((await row()).status).toBe('bekliyor');
  expect((await row()).note).toBe('');
  await expect(card.locator('.rs-status')).toHaveText('Okundu · yapay zekâ');
  await expect(card.locator('[data-action="ruhsat-add"]')).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').length)).toBe(0);
  expect(problems).toEqual([]);
});

test('WhatsApp: sunucuda Gemini’yle okunan fotoğraf ekrana gelir; plaka kayıtlarıyla burada eşleştirilir', async ({ page }) => {
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r6', plate: 'TR 35 WLF - TR 47 WLF', customer: 'ETL LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r7', plate: 'PB 4321 AB - PB 8765 CD', customer: 'İKİNCİ LOJ', declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  // Bugün panoda olan araç (ruhsatı 14000 KG yazılı)
  data.visits.push({ ...data.visits[5], id: 'v9', plate: 'PB 4321 AB - PB 8765 CD', customer: 'İKİNCİ LOJ', registration: '14000 KG' });
  const v = (plate, kind, kg) => ({ plate, kind, empty_weight_kg: kg, country: '' });
  data.incoming_ruhsat = [
    // sunucu şu an okuyor
    waRow('w8', { status: 'okunuyor', claimed_at: '2026-09-23T06:59:40Z', claimed_by: null, created_at: '2026-09-23T06:59:30Z' }),
    // sunucu okumuş: dorse kartı okunamamış, çekicinin kayıttaki dorsesi önerilmeli
    waRow('w9', { status: 'bekliyor', tractor: 'TR35WLF', weights: [7860], ai: { vehicles: [v('TR35WLF', 'tractor', 7860)], problem: 'Dorse kartı parlıyor.', model: 'gemini-test' } }),
    // sunucu okumuş: araç bugün zaten panoda ve ruhsatı aynı, yapılacak bir şey yok
    waRow('w10', { status: 'bekliyor', created_at: '2026-09-23T06:40:00Z', tractor: 'PB4321AB', trailer: 'PB8765CD', weights: [7900, 6100], ai: { vehicles: [v('PB4321AB', 'tractor', 7900), v('PB8765CD', 'trailer', 6100)], problem: '' } })
  ];
  const problems = await openApp(page, { data, files: {} });
  const row = id => page.evaluate(i => window.__db.incoming_ruhsat.find(r => r.id === i), id);
  await expect.poll(async () => (await row('w10')).status).toBe('mevcut');
  expect((await row('w10')).visit_id).toBe('v9');
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await expect(page.locator('#wa-w8 .rs-status')).toHaveText('Sunucuda yapay zekâyla okunuyor');
  const w9 = page.locator('#wa-w9');
  await expect(w9.locator('.rs-status')).toHaveText('Okundu · yapay zekâ');
  await expect(w9.locator('input').nth(1)).toHaveValue('TR 47 WLF');
  await expect(w9).toContainText('kayıttaki dorsesi');
  await expect(w9).toContainText('Yapay zekâ: Dorse kartı parlıyor.');

  // Sunucu okumayı bitirdi: sonuç anlık bildirimle bu ekrana gelir
  await page.evaluate(ai => { Object.assign(window.__db.incoming_ruhsat.find(r => r.id === 'w8'), { status: 'bekliyor', claimed_at: null, tractor: 'PB1234AB', trailer: 'PB5678CD', weights: [8150, 6700], ai }); window.__rtEmit('incoming_ruhsat'); },
    { vehicles: [v('PB5678CD', 'trailer', 6700), v('PB1234AB', 'tractor', 8150)], problem: '' });
  const w8 = page.locator('#wa-w8');
  await expect(w8.locator('.rs-status')).toHaveText('Okundu · yapay zekâ');
  await expect(w8).toContainText('RUHSAT LOJ');
  await expect(w8).toContainText('8150 kg + 6700 kg = 14850 kg');
  await expect(w8.locator('[data-action="ruhsat-add"]')).toBeVisible();
  // bu ekran hiçbir fotoğrafı kendisi okumadı, panoya da bir şey eklemedi
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length)).toBe(0);
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'incoming_ruhsat' && c.op === 'update').length)).toBe(1);
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').length)).toBe(0);
  expect(problems).toEqual([]);
});

test('WhatsApp: "Hepsini panoya ekle" birden fazla farklı aracı tek onayla ekler', async ({ page }) => {
  const data = sampleData();
  data.registry.push({ id: 'r5', plate: 'PB 1234 AB - PB 5678 CD', customer: 'RUHSAT LOJ', declaration: '', carrier: '', registration: '14850 KG', updated_at: '2026-09-01T08:00:00Z' });
  data.registry.push({ id: 'r7', plate: 'PB 4321 AB - PB 8765 CD', customer: 'İKİNCİ LOJ', declaration: '', carrier: '', registration: '14000 KG', updated_at: '2026-09-01T08:00:00Z' });
  const v = (plate, kind, kg) => ({ plate, kind, empty_weight_kg: kg, country: '' });
  data.incoming_ruhsat = [
    waRow('w1', { status: 'bekliyor', tractor: 'PB1234AB', trailer: 'PB5678CD', weights: [8150, 6700], ai: { vehicles: [v('PB1234AB', 'tractor', 8150), v('PB5678CD', 'trailer', 6700)], problem: '' } }),
    waRow('w2', { status: 'bekliyor', created_at: '2026-09-22T06:31:00Z', tractor: 'PB4321AB', trailer: 'PB8765CD', weights: [7900, 6100], ai: { vehicles: [v('PB4321AB', 'tractor', 7900), v('PB8765CD', 'trailer', 6100)], problem: '' } })
  ];
  const problems = await openApp(page, { data, files: {} });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const bulk = page.locator('[data-action="ruhsat-add-all"]');
  await expect(bulk).toHaveText('Hepsini panoya ekle (2)');
  page.once('dialog', d => d.accept());
  await bulk.click();
  await expect(page.locator('#toast')).toContainText('2 araç panoya eklendi');
  const inserted = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));
  expect(inserted.map(x => [x.plate, x.customer, x.visit_date])).toEqual([
    ['PB 1234 AB - PB 5678 CD', 'RUHSAT LOJ', '2026-09-22'],
    ['PB 4321 AB - PB 8765 CD', 'İKİNCİ LOJ', '2026-09-22']
  ]);
  const rows = await page.evaluate(() => window.__db.incoming_ruhsat.map(r => [r.id, r.status, r.visit_id]));
  expect(rows).toEqual([['w1', 'eklendi', inserted[0].id], ['w2', 'eklendi', inserted[1].id]]);
  await expect(bulk).toHaveCount(0);
  expect(problems).toEqual([]);
});

// Müşterinin WhatsApp'tan yazdığı mesaj (sunucu fonksiyonunun Gemini ile okuyup yazdığı biçimde).
const msgRow = (id, items, extra = {}) => ({
  id, wa_message_id: 'wamid.' + id, from_number: '905321112233', sender_name: 'Ali Şoför', body: 'Yarın şu araçlar gelecek ...', status: 'bekliyor',
  ai: { items, customer: '', problem: '', model: 'gemini-test' }, applied: {}, note: '', handled_by: null, handled_at: null,
  created_at: '2026-09-23T06:30:00Z', updated_at: '2026-09-23T06:30:00Z', ...extra
});
const mi = (action, tractor, trailer, date, extra = {}) => ({ action, tractor, trailer, date, time: '', note: '', ...extra });

test('WhatsApp mesajı: gelecek, tarihi değişen, iptal ve yeni araç madde madde onaya düşer; hiçbiri sorulmadan değişmez', async ({ page }) => {
  test.setTimeout(90000);
  const data = sampleData();
  data.incoming_messages = [msgRow('m1', [
    mi('add', '06KL4567', '', '2026-09-24', { time: '09:30', note: 'Şoför Ali' }),   // 0: kayıtlı araç, o gün panoda yok
    mi('move', 'CB1234AB', '', '2026-09-25'),                                         // 1: panoda 23'ünde; 25'ine alınacak
    mi('add', 'XX9999YY', '', '2026-09-24'),                                          // 2: yeni araç
    mi('cancel', 'B123XYZ', '', ''),                                                  // 3: panodaki geliş silinecek
    mi('add', '34ABC123', '', '2026-09-23')                                           // 4: zaten panoda
  ], { body: 'Yarın 06 KL 4567 gelecek, CB 1234 AB cuma günü gelecek, XX 9999 YY de yarın. B 123 XYZ iptal. 34 ABC 123 bugün.' })];
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const calls = fn => page.evaluate(fn);
  // hiçbir şey kendiliğinden değişmez; "Ruhsattan ekle" düğmesinde bekleyen mesaj sayısı görünür
  await expect(page.locator('.heading .rs-badge').first()).toHaveText('1');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const card = page.locator('#msg-m1');
  await expect(page.locator('.rs-wa-head', { hasText: 'WhatsApp mesajları' })).toContainText('siz onaylamadan');
  await expect(card).toContainText('Ali Şoför');
  await expect(card.locator('.msg-item')).toHaveCount(5);
  const item = n => card.locator('.msg-item').nth(n);
  await expect(item(0)).toContainText('Kayıtlı araç: ABC NAKLİYAT');
  await expect(item(0)).toContainText('Saat: 09:30');
  await expect(item(0).locator('input[type="date"]')).toHaveValue('2026-09-24');
  await expect(item(1)).toContainText('Panoda şu an 23 Eylül Çarşamba gününde');
  await expect(item(1)).toContainText('25 Eylül Cuma gününe taşınır');
  await expect(item(2)).toContainText('Yeni araç: plaka kayıtlarında yok');
  await expect(item(2).locator('[data-action="msg-apply"]')).toHaveCount(0);   // müşteri bilinmiyor: yalnızca formda eklenir
  await expect(item(3)).toContainText('silinir');
  await expect(item(4)).toContainText('zaten panoda');

  // toplu: yalnızca hazır olanlar (ekleme + taşıma); silme ve yeni araç dışarıda
  const all = card.locator('[data-action="msg-all"]');
  await expect(all).toHaveText('Hepsini uygula (2)');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await all.click();
  await expect(page.locator('#toast')).toContainText('2 araç işlendi');
  expect(asked).toContain('06 KL 4567 · ABC NAKLİYAT');
  expect(asked).toContain('CB 1234 AB: 23 Eylül → 25 Eylül gününe taşınsın');
  expect(asked).not.toContain('B 123 XYZ');
  const writes = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).map(c => ({ op: c.op, rows: c.rows })));
  expect(writes.map(w => w.op)).toEqual(['insert', 'update']);
  expect(writes[0].rows[0]).toMatchObject({ plate: '06 KL 4567', customer: 'ABC NAKLİYAT', visit_date: '2026-09-24', visit_time: '09:30', note: 'Şoför Ali' });
  const v6 = await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'));
  expect(v6.visit_date).toBe('2026-09-25');
  // satırda araç araç ne yapıldığı yazılır
  const applied = () => page.evaluate(() => window.__db.incoming_messages[0].applied);
  expect(Object.keys(await applied()).sort()).toEqual(['0', '1']);
  expect((await applied())['1']).toMatchObject({ r: 'tasindi', visit_id: 'v6' });

  // iptal: onay sorulur; silinen geliş geri alınabilir olarak panodan gider
  page.once('dialog', d => { expect(d.message()).toContain('B 123 XYZ için panodaki 23 Eylül gelişi silinsin mi?'); d.accept(); });
  await item(3).locator('[data-action="msg-apply"]').click();
  await expect(page.locator('#toast')).toContainText('panodan silindi');
  expect(await page.evaluate(() => window.__db.visits.some(v => v.id === 'v7'))).toBe(false);
  // zaten panoda olan madde kapatılır; yeni araç formda açılır
  await item(4).locator('[data-action="msg-apply"]').click();
  await item(2).locator('[data-action="msg-form"]').click();
  const form = page.locator('#visit-form');
  await expect(form.locator('[name="plate"]')).toHaveValue('XX 9999 YY');
  await expect(form.locator('[name="date"]')).toHaveValue('2026-09-24');
  await form.locator('[name="customer"]').fill('YENİ LOJ');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('kaydedildi');
  // hepsi bitince mesaj kapanır (satır "eklendi" olur) ve düğmedeki sayı kalkar
  await expect.poll(async () => (await page.evaluate(() => window.__db.incoming_messages[0])).status).toBe('eklendi');
  expect((await applied())['2']).toMatchObject({ r: 'eklendi' });
  expect(await page.evaluate(() => window.__db.visits.filter(v => v.plate === 'XX 9999 YY').length)).toBe(1);
  await expect(page.locator('.heading .rs-badge')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('WhatsApp mesajı: elle yapıştırılan mesaj yapay zekâyla okunur, onaylanınca eklenir; veritabanına yazılmaz', async ({ page }) => {
  const aiText = { items: [mi('add', '06KL4567', '', '2026-09-24', { time: '09:30', note: 'Şoför Ali' }), mi('add', 'CB1234AB', '', '')], customer: 'ABC', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  await page.locator('.msg-paste summary').click();
  await page.locator('#msg-text').fill('Yarın 06 KL 4567 geliyor (09:30), CB 1234 AB de bugün.');
  await page.locator('[data-action="msg-read"]').click();
  const card = page.locator('.msg-card');
  await expect(card).toContainText('Yapıştırılan mesaj');
  const asked = await page.evaluate(() => window.__calls.find(c => c.fn === 'ruhsat-oku').text);
  expect(asked).toEqual({ text: 'Yarın 06 KL 4567 geliyor (09:30), CB 1234 AB de bugün.', today: '2026-09-23' });
  // tarih yazmayan madde: mesajın geldiği gün (bugün) yazılır; araç o gün zaten panodaysa tekrar eklenmez
  await expect(card.locator('.msg-item').nth(1)).toContainText('Mesajda tarih yok; 23 Eylül Çarşamba');
  await expect(card.locator('.msg-item').nth(1)).toContainText('zaten panoda');
  // gün seçilebilir; seçilen güne göre durum yeniden hesaplanır: araç panoda 23'ünde açık, o gün kaydı yok → yeni geliş değil, mevcut kayıt taşınır
  await card.locator('.msg-item').nth(1).locator('input[type="date"]').fill('2026-09-26');
  await expect(card.locator('.msg-item').nth(1)).toContainText('26 Eylül Cumartesi gününe taşınır');
  page.once('dialog', d => d.accept());
  await expect(card.locator('[data-action="msg-all"]')).toHaveText('Hepsini uygula (2)');
  await card.locator('[data-action="msg-all"]').click();
  await expect(page.locator('#toast')).toContainText('2 araç işlendi');
  const ins = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));
  expect(ins.map(v => [v.plate, v.visit_date])).toEqual([['06 KL 4567', '2026-09-24']]);   // CB 1234 AB için yeni kayıt açılmadı
  expect((await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'))).visit_date).toBe('2026-09-26'); // mevcut kayıt taşındı
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'incoming_messages' && c.op !== 'select').length)).toBe(0);
  await expect(card).toHaveCount(0);
  // mesajda araç yoksa kart açılmaz
  await page.evaluate(() => { window.__PCS_STUB.aiText = { items: [], customer: '', problem: 'Mesajda plaka yok.', model: 'x' }; });
  expect(problems).toEqual([]);
});

test('WhatsApp mesajı: okunamayan mesaj "Yeniden oku" ile okunur; tablo kurulu değilse yalnızca yapıştırma kutusu çalışır', async ({ page, browser }) => {
  const data = sampleData();
  data.incoming_messages = [msgRow('m2', [], { status: 'hata', ai: null, note: 'Yapay zekâ mesajı okuyamadı', body: 'Perşembe 06 KL 4567 gelecek' })];
  const aiText = { items: [mi('add', '06KL4567', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { data, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const card = page.locator('#msg-m2');
  await expect(card).toContainText('Yapay zekâ mesajı okuyamadı');
  await card.locator('[data-action="msg-reread"]').click();
  await expect(card.locator('.msg-item')).toHaveCount(1);
  await expect(card.locator('.msg-item')).toContainText('Kayıtlı araç: ABC NAKLİYAT');
  const row = await page.evaluate(() => window.__db.incoming_messages[0]);
  expect(row.status).toBe('bekliyor');
  expect(row.ai.items[0].tractor).toBe('06KL4567');
  // mesajı kapatma: satır "yoksayıldı" olur, pano değişmez
  await card.locator('[data-action="msg-dismiss"]').click();
  await expect(card).toHaveCount(0);
  expect((await page.evaluate(() => window.__db.incoming_messages[0])).status).toBe('yoksayildi');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  expect(problems).toEqual([]);

  // tablo kurulu değil: sessizce devre dışı; yapıştırma kutusu yine çalışır. Yapay zekâ kurulu değilse (404) kutu hata söyler.
  const other = await browser.newPage();
  const p2 = await openApp(other, { missing: ['incoming_messages'] });
  await expect(other.locator('#app')).toContainText('34 ABC 123');
  await expect(other.locator('.heading .rs-badge')).toHaveCount(0);
  await other.locator('.heading [data-action="ruhsat-open"]').click();
  await other.locator('.msg-paste summary').click();
  await other.locator('#msg-text').fill('Yarın 06 KL 4567 gelecek');
  await other.locator('[data-action="msg-read"]').click();
  await expect(other.locator('#toast')).toContainText('Yapay zekâ kurulu değil');
  await expect(other.locator('.msg-card')).toHaveCount(0);
  expect(p2).toEqual([]);
  await other.close();
});

test('sohbet balonu: yazılan cümle okunur, hazır ekleme ve taşıma kendiliğinden işlenir; silme ve yeni araç sorulur', async ({ page }) => {
  test.setTimeout(90000);
  const aiText = { items: [
    mi('add', '06KL4567', '', '2026-09-24', { time: '09:30' }),   // kayıtlı araç: kendiliğinden eklenir
    mi('move', 'CB1234AB', '', '2026-09-25'),                      // panoda var: kendiliğinden taşınır
    mi('add', 'XX9999YY', '', '2026-09-24'),                       // kayıtlı değil: formda eklenir
    mi('cancel', 'B123XYZ', '', ''),                               // silme: onay ister
    mi('add', '34ABC123', '', '2026-09-23')                        // zaten panoda: kapatılır
  ], customer: '', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const fab = page.locator('#chat-fab'), panel = page.locator('#chat-panel');
  await expect(fab).toBeVisible();
  await expect(panel).toBeHidden();
  // sağ alt köşede yuvarlak düğme
  const box = await fab.boundingBox(), vp = page.viewportSize();
  expect(box.x + box.width).toBeGreaterThan(vp.width - 40);
  expect(box.y + box.height).toBeGreaterThan(vp.height - 40);
  await fab.click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Gelecek, ertelenen ya da iptal edilen araçları yazın');
  await expect(page.locator('#chat-input')).toBeFocused();
  // örnek cümleye tıklayınca kutuya yazılır
  await panel.locator('.chat-chip').first().click();
  await expect(page.locator('#chat-input')).toHaveValue(/34 ABC 123/);
  // Shift+Enter satır ekler, Enter gönderir
  await page.locator('#chat-input').fill('');
  await page.locator('#chat-input').pressSequentially('Yarın 06 KL 4567 saat 09:30 gelecek');
  await page.keyboard.press('Shift+Enter');
  await page.locator('#chat-input').pressSequentially('CB 1234 AB cumaya ertelendi, XX 9999 YY gelecek, B 123 XYZ iptal');
  await expect(page.locator('#chat-input')).toHaveValue(/gelecek\nCB 1234 AB/);
  await page.keyboard.press('Enter');
  await expect(panel.locator('.chat-msg.me')).toContainText('Yarın 06 KL 4567 saat 09:30 gelecek');
  await expect(panel).toContainText('5 araç anladım; 2 tanesini panoya işledim. 2 tanesi için onayınız gerekiyor');
  // gönderilen metin Gemini'ye bugünün tarihiyle gider
  const sent = await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').map(c => c.text));
  expect(sent).toEqual([{ text: 'Yarın 06 KL 4567 saat 09:30 gelecek\nCB 1234 AB cumaya ertelendi, XX 9999 YY gelecek, B 123 XYZ iptal', today: '2026-09-23', chat: true, context: expect.stringContaining('BOARD DAY 2026-09-23') }]);
  // kendiliğinden yapılanlar: ekleme + taşıma. Silme ve yeni araç yapılmadı.
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).map(c => ({ op: c.op, rows: c.rows })));
  const w = await writes();
  expect(w.map(x => x.op)).toEqual(['insert', 'update']);
  expect(w[0].rows[0]).toMatchObject({ plate: '06 KL 4567', customer: 'ABC NAKLİYAT', visit_date: '2026-09-24', visit_time: '09:30' });
  expect((await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'))).visit_date).toBe('2026-09-25');
  await expect(panel).toContainText('Panoya eklendi');
  await expect(panel).toContainText('25 Eylül Cuma gününe taşındı');
  await expect(panel).toContainText('Yapılacak bir şey yoktu'); // 34 ABC 123: bugün zaten panoda; kendiliğinden kapatıldı
  expect(await page.evaluate(() => window.__db.incoming_messages.length)).toBe(0); // sohbet veritabanına yazılmaz
  // silme: onay sorulur
  page.once('dialog', d => { expect(d.message()).toContain('B 123 XYZ için panodaki 23 Eylül gelişi silinsin mi?'); d.accept(); });
  await panel.locator('[data-action="msg-apply"]', { hasText: 'Panodan sil' }).click();
  await expect.poll(async () => (await writes()).map(x => x.op).join()).toBe('insert,update,delete');
  await expect(panel).toContainText('Panodan silindi');
  // yeni araç: forma düşer
  await panel.locator('[data-action="msg-form"]').click();
  await expect(page.locator('#visit-form [name="plate"]')).toHaveValue('XX 9999 YY');
  await page.keyboard.press('Escape');
  // kapatma: Esc ya da düğme
  await page.locator('#chat-input').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  expect(problems).toEqual([]);
});

test('sohbet balonu: hata ve boş cevap sohbette yazar, yazılan metin geri gelir; görüntüleyicide ve saha ekranında balon yoktur; bekleyen WhatsApp mesajı bağlantı olur', async ({ page, browser }) => {
  const data = sampleData();
  data.incoming_messages = [msgRow('m9', [mi('add', '06KL4567', '', '2026-09-24')])];
  const problems = await openApp(page, { data, aiText: [{ status: 502, body: { error: 'Gemini 502', fatal: true } }, { items: [], customer: '', problem: 'Mesajda plaka yok.', model: 'x' }] });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  // bekleyen WhatsApp mesajı: balonda rozet, panelde bağlantı
  await expect(page.locator('#chat-fab .chat-dot')).toHaveText('1');
  await expect(panel.locator('.chat-pend')).toContainText("WhatsApp'tan gelen 1 mesaj onayınızı bekliyor");
  // Gemini hatası
  await page.locator('#chat-input').fill('yarın 06 KL 4567 gelecek');
  await page.locator('#chat-input').press('Enter');
  await expect(panel).toContainText('Okuyamadım');
  await expect(page.locator('#chat-input')).toHaveValue('yarın 06 KL 4567 gelecek'); // yazılan geri gelir
  // araç yok
  await page.locator('#chat-input').fill('merhaba nasılsınız 123');
  await page.locator('#chat-input').press('Enter');
  await expect(panel).toContainText('Bunu anlayamadım (Mesajda plaka yok)');
  await expect(panel).toContainText('kayıt düzeltme');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  // bağlantı: WhatsApp mesajlarının onay penceresini açar
  await panel.locator('.chat-pend').click();
  await expect(page.locator('#modal .msg-card')).toBeVisible();
  await page.keyboard.press('Escape');
  // saha ekranında balon yok
  await page.locator('[data-action="saha-open"]').first().click();
  await expect(page.locator('#chat-fab')).toBeHidden();
  expect(problems).toEqual([]);
  // görüntüleyici (yalnız okuyabilen hesap) sohbetle değişiklik yapamaz: balon görünmez
  const viewer = await browser.newPage();
  await openApp(viewer, { role: 'viewer' });
  await expect(viewer.locator('#app')).toContainText('34 ABC 123');
  await expect(viewer.locator('#chat-fab')).toHaveCount(0);
  await viewer.close();
});

test('sohbet: panoda açık araç "yarına al" denince yeni geliş açılmaz, mevcut kayıt taşınır; WhatsApp kartında "Yeni geliş olarak ekle" seçilebilir', async ({ page }) => {
  // Gemini "Aracı yarına al"ı "gelecek" (add) sayar; CB 1234 AB bugün (23 Eylül) panoda açık (v6)
  const data = sampleData();
  data.incoming_messages = [msgRow('m7', [mi('add', 'CB1234AB', '', '2026-09-24')])];
  const aiText = { items: [mi('add', 'CB1234AB', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { data, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).map(c => c.op));
  await page.locator('#chat-fab').click();
  await page.locator('#chat-input').fill('CB 1234 AB yarına al');
  await page.locator('#chat-input').press('Enter');
  await expect(page.locator('#chat-panel')).toContainText('24 Eylül Perşembe gününe taşındı');
  expect(await writes()).toEqual(['update']);                                  // yeni kayıt açılmadı
  expect((await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'))).visit_date).toBe('2026-09-24');
  expect(await page.evaluate(() => window.__db.visits.filter(v => v.plate === 'CB 1234 AB' && v.visit_date >= '2026-09-23').length)).toBe(1);
  await page.locator('#chat-fab').click();
  // WhatsApp kartı (aynı araç, bu kez 23'ünde açık değil: v6 taşındı) — kartta taşıma gösterilir, ayrı geliş seçilebilir
  await page.evaluate(() => { const v = window.__db.visits.find(x => x.id === 'v6'); v.visit_date = '2026-09-23'; v.updated_at = new Date().toISOString(); window.__rtEmit('visits'); });
  await page.clock.runFor(1500);
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const item = page.locator('#msg-m7 .msg-item');
  await expect(item).toContainText('yeni geliş açmak yerine mevcut kayıt taşınır');
  await expect(item.locator('[data-action="msg-apply"]')).toHaveText('Tarihi değiştir');
  await item.locator('[data-action="msg-addnew"]').click();
  await expect(item.locator('[data-action="msg-apply"]')).toHaveText('Panoya ekle');
  await expect(item).not.toContainText('yeni geliş açmak yerine');
  await item.locator('[data-action="msg-apply"]').click();
  await expect.poll(async () => (await writes()).join()).toBe('update,insert'); // bu kez ayrı geliş açıldı
  expect(problems).toEqual([]);
});

test('sohbet: müşterinin firmalı araç listesi yapıştırılır; tarih sorulur, beyanname/not firmalardan çıkar, kayıtsız araç plaka kaydıyla eklenir', async ({ page }) => {
  test.setTimeout(90000);
  const data = sampleData();
  data.registry.push({ id: 'r9', plate: 'PB 7831 KT - PB 7569 EB', customer: 'ETL LOJ - ERVİN MUTLU', declaration: '', carrier: 'RE TRANS PRIM EOOD', registration: '15830 KG', updated_at: '2026-09-01T08:00:00Z' });
  const parties = (...n) => n;
  const aiText = { customer: '', problem: '', model: 'gemini-test', items: [
    mi('add', 'PB7831KT', 'PB7569EB', '', { fee: '90 EURO', parties: parties('GALATA PETROL OTOMOTİV', 'PLASTEK PLASTİK', 'FURKAN SARIM-FORMPLAS', 'MARS TR DIŞ TİC.') }),
    mi('add', 'CT04LLA', 'CT05LLA', '', { fee: '90 EURO', parties: parties('TALIA') }),
    mi('add', 'CT40BWT', 'CT41BWT', '', { fee: '90 EURO', parties: parties('UPLASS') }),
    mi('add', 'CT6913PB', 'CT2803EH', '', { fee: '90 EURO', parties: parties('UĞURLAR PLS.', 'DEMİR PLASTİK') })
  ] };
  const problems = await openApp(page, { data, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const writes = () => page.evaluate(() => window.__calls.filter(c => ['visits', 'registry'].includes(c.table) && ['insert', 'update', 'delete'].includes(c.op)).map(c => c.table + ':' + c.op));
  await page.locator('#chat-fab').click();
  const list = 'PB 7831 KT - PB 7569 EB (90 EURO)\n1.GALATA PETROL OTOMOTİV\n2.PLASTEK PLASTİK\n\nCT 04 LLA - CT 05 LLA (90 EURO)\n1.TALIA';
  await page.locator('#chat-input').fill(list);
  await page.locator('#chat-input').press('Enter');
  const panel = page.locator('#chat-panel');
  // tarih yok: toplu kayıt açmadan önce gün sorulur
  await expect(panel).toContainText('Mesajda tarih yok. Bu 4 aracı hangi güne yazayım?');
  expect(await writes()).toEqual([]);
  await panel.locator('[data-action="chat-day"]', { hasText: 'Yarın' }).click();
  // kayıtlı araç kendiliğinden eklenir: tek firma değil, 4 firma → PARSİYEL; firmalar nota, ücret ayrı alana yazılır
  await expect.poll(writes).toEqual(['visits:insert']);
  const v1 = await page.evaluate(() => window.__db.visits.find(v => v.plate === 'PB 7831 KT - PB 7569 EB'));
  expect(v1).toMatchObject({ customer: 'ETL LOJ - ERVİN MUTLU', declaration: 'PARSİYEL', carrier: 'RE TRANS PRIM EOOD', registration: '15830 KG', visit_date: '2026-09-24' });
  expect(v1.note).toBe('1.GALATA PETROL OTOMOTİV · 2.PLASTEK PLASTİK · 3.FURKAN SARIM-FORMPLAS · 4.MARS TR DIŞ TİC.');
  expect([v1.fee_amount, v1.fee_currency]).toEqual([90, 'EUR']);                    // ücret notta değil, ayrı alanda
  // kayıtsız araçlar: müşteri listedeki kayıtlı araçtan çıkarılır, kendiliğinden eklenmez; onaylanınca plaka kaydıyla eklenir
  await expect(panel).toContainText('listedeki diğer kayıtlı araçlardan');
  await expect(panel).toContainText('ETL LOJ - ERVİN MUTLU olarak alındı');
  await expect(panel.locator('[data-action="msg-apply"]', { hasText: 'Plaka kaydıyla ekle' })).toHaveCount(3);
  const all = panel.locator('[data-action="msg-all"]');
  await expect(all).toHaveText('Hepsini uygula (3)');
  let asked = '';
  page.once('dialog', d => { asked = d.message(); d.accept(); });
  await all.click();
  await expect.poll(async () => (await writes()).length).toBe(7); // 1 + 3 × (plaka kaydı + geliş)
  expect(asked).toContain('CT 04 LLA - CT 05 LLA · ETL LOJ - ERVİN MUTLU');
  expect(asked).toContain('(yeni plaka kaydıyla)');
  const reg = await page.evaluate(() => window.__db.registry.filter(r => r.plate.startsWith('CT ')).map(r => [r.plate, r.customer]));
  expect(reg.sort()).toEqual([['CT 04 LLA - CT 05 LLA', 'ETL LOJ - ERVİN MUTLU'], ['CT 40 BWT - CT 41 BWT', 'ETL LOJ - ERVİN MUTLU'], ['CT 6913 PB - CT 2803 EH', 'ETL LOJ - ERVİN MUTLU']]);
  const vis = await page.evaluate(() => window.__db.visits.filter(v => v.plate.startsWith('CT ')).map(v => [v.plate, v.declaration, v.note, v.visit_date, v.fee_amount + ' ' + v.fee_currency]));
  expect(vis.sort()).toEqual([
    ['CT 04 LLA - CT 05 LLA', 'TALIA', '', '2026-09-24', '90 EUR'],             // tek firma: firma adı beyannameye
    ['CT 40 BWT - CT 41 BWT', 'UPLASS', '', '2026-09-24', '90 EUR'],
    ['CT 6913 PB - CT 2803 EH', 'PARSİYEL', '1.UĞURLAR PLS. · 2.DEMİR PLASTİK', '2026-09-24', '90 EUR']
  ]);
  await expect(panel).toContainText('plaka kayıtlarına işlendi');
  expect(problems).toEqual([]);
});

const ed = (field, value, target) => ({ plate: '', position: 0, selected: false, customer: '', date: '', field, value, ...target });
const chatAi = (extra, page) => ({ items: [], customer: '', problem: '', model: 'gemini-test', edits: [], queries: [], ...extra });

test('sohbet: kayıt düzeltme sıra / plaka / seçili araçla yapılır; araç başına tek kayıt işlemi, değişmeyen ve bulunamayan satır açıkça yazılır', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const aiText = chatAi({ edits: [
    ed('customer', 'etl loj', { position: 3 }),                  // sıra: bugünün 3. aracı
    ed('t1', 'true', { plate: '34ABC123' }),                      // plaka: iki alan, tek işlem
    ed('note_add', 'acil', { plate: '34ABC123' }),
    ed('onsite', 'true', { plate: 'B123XYZ' }),                   // zaten tesiste: değişiklik yok
    ed('time', '12:00', { position: 9 })                          // 9. sıra yok
  ] });
  const problems = await openApp(page, { aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).map(c => ({ op: c.op, rows: c.rows })));
  await page.locator('#chat-fab').click();
  await page.locator('#chat-input').fill('3. sıradaki aracın müşterisini ETL LOJ yap, 34 ABC 123 T1 yazıldı, not acil');
  await page.locator('#chat-input').press('Enter');
  const panel = page.locator('#chat-panel');
  await expect(panel).toContainText('Kısmen yaptım:');
  await expect(panel).toContainText('CB 1234 AB · Müşteri: TORNADO → ETL LOJ');     // 3. sıra; büyük harfe çevrildi
  await expect(panel).toContainText('34 ABC 123 · T1 yazıldı: hayır → evet; Not: boş → acil');
  await expect(panel).toContainText('B 123 XYZ: zaten böyle, değişiklik yok.');
  await expect(panel).toContainText('23 Eylül gününde 9. sırada araç yok (o gün 3 araç var).');
  // araç başına tek yazma: 2 güncelleme (sıra 3 + 34 ABC 123); T1 ve not aynı işlemde
  const w = await writes();
  expect(w.map(x => x.op)).toEqual(['update', 'update']);
  const v5 = await page.evaluate(() => window.__db.visits.find(v => v.id === 'v5'));
  expect(v5).toMatchObject({ t1: true, note: 'acil' });
  expect((await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'))).customer).toBe('ETL LOJ');
  // sohbet sorusu veritabanına yazılmaz, pano açıkken kayıt panoda da güncellenir
  expect(await page.evaluate(() => window.__db.incoming_messages.length)).toBe(0);
  await expect(page.locator('#app')).toContainText('ETL LOJ');
  expect(problems).toEqual([]);
});

test('sohbet: seçili aracı düzeltme; müşteri adıyla birden fazla araç değişiyorsa önce onay sorulur ve Vazgeç hiçbir şey yazmaz', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  const v6 = data.visits.find(v => v.id === 'v6');
  v6.customer = 'BULTRANS';                                        // bugün BULTRANS: v5 ve v6
  const aiText = [
    chatAi({ edits: [ed('declaration', 'PARSİYEL', { customer: 'BULTRANS' })] }),
    chatAi({ edits: [ed('declaration', 'PARSİYEL', { customer: 'BULTRANS' })] }),
    chatAi({ edits: [ed('carrier', 'YENİ LOJ', { selected: true })] })
  ];
  const problems = await openApp(page, { data, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length);
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  await say('BULTRANS araçlarının beyannamesini PARSİYEL yap');
  await expect(panel).toContainText('2 araç değişecek (Beyanname: PARSİYEL)');
  await expect(panel.locator('[data-action="chat-plan"]')).toHaveText(/Uygula \(2 araç\)/);
  expect(await writes()).toBe(0);                                      // onaydan önce hiçbir şey yazılmaz
  await panel.locator('[data-action="chat-plan-no"]').click();
  await expect(panel).toContainText('Vazgeçtim, bir şey değiştirmedim.');
  expect(await writes()).toBe(0);
  // aynı istek, bu kez onay
  await say('BULTRANS araçlarının beyannamesini PARSİYEL yap');
  await expect(panel.locator('[data-action="chat-plan"]')).toHaveCount(1);
  await panel.locator('[data-action="chat-plan"]').click();
  await expect(panel).toContainText('Düzelttim:');
  expect(await writes()).toBe(2);
  expect(await page.evaluate(() => window.__db.visits.filter(v => v.declaration === 'PARSİYEL').map(v => v.id).sort())).toEqual(['v5', 'v6']);
  // seçili araç: panoda bir satıra tıklanır, "bu araç" denir
  await page.locator('#app tbody tr', { hasText: '34 ABC 123' }).first().click();
  await say('bu aracın nakliyecisi YENİ LOJ olsun');
  await expect(panel).toContainText('34 ABC 123 · Nakliyeci: KAAN LOJ. → YENİ LOJ');
  expect(await writes()).toBe(3);
  expect(problems).toEqual([]);
});

test('sohbet: sorular panodan cevaplanır (sayı, liste, özet); listedeki araca tıklayınca panoda açılır; hiçbir şey yazılmaz', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const q = (kind, extra = {}) => ({ kind, status: '', customer: '', plate: '', date: '', week: false, ...extra });
  const aiText = [
    chatAi({ queries: [q('count', { status: 'onsite' })] }),
    chatAi({ queries: [q('summary')] }),
    chatAi({ queries: [q('list', { status: 'waiting' })] }),
    chatAi({ queries: [q('list', { plate: 'CB1234AB' })] })
  ];
  const problems = await openApp(page, { aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  await say('Bugün kaç araç tesiste?');
  await expect(panel).toContainText('23 Eylül · tesiste: 2 araç');
  await say('Bugünün özeti');
  const sum = panel.locator('.chat-sum').last();
  expect(await sum.locator('b').allTextContents()).toEqual(['3', '2', '1', '1', '0']);   // toplam, tesiste, gelecek, T1, tamamlanan
  await say('Gelecek araçları listele');
  const row = panel.locator('.chat-row').last();
  await expect(row).toContainText('CB 1234 AB');
  await expect(row).toContainText('Gelecek');
  await say('CB 1234 AB son kayıtları');
  await expect(panel).toContainText('Son kayıtlar · CB 1234 AB: 2 araç');
  await panel.locator('.chat-row', { hasText: '21 Eyl' }).click();
  await expect(page.locator('[data-row-id="v2"]')).toHaveClass(/is-selected/);   // 21 Eylül gününe gidip satırı seçer
  await expect(page.locator('.day-tab.active')).toContainText('21 Eyl');
  expect(await page.evaluate(() => window.__calls.filter(c => ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  expect(problems).toEqual([]);
});

const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const NO_CARD = { vehicles: [], problem: 'Fotoğrafta ruhsat görünmüyor.' };   // ruhsat okuması: fotoğrafta ruhsat yok

test('sohbete liste fotoğrafı: önce ruhsat mı diye bakılır, değilse liste okunur; fotoğraftan okunanlar kendiliğinden işlenmez, tek tek onaylanır', async ({ page }) => {
  test.setTimeout(90000);
  const aiText = { items: [mi('add', '06KL4567', '', '2026-09-24', { fee: '90 EURO', parties: ['GALATA PETROL'] }), mi('add', 'XX9999YY', '', '2026-09-24')], customer: 'ETL LOJ', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { ai: NO_CARD, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length);
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  await expect(panel).toContainText('ekran görüntüsünü de');
  await expect(panel.locator('[data-action="chat-attach"]')).toBeVisible();
  await page.locator('#chat-file').setInputFiles({ name: 'liste.png', mimeType: 'image/png', buffer: PNG1 });
  await expect(panel.locator('.chat-msg.me .chat-img')).toBeVisible();
  await expect(panel).toContainText('Fotoğraftan 2 araç okudum. Fotoğraftan okuduğum için hiçbirini kendiliğinden işlemedim');
  expect(await writes()).toBe(0);                                                       // kayıtlı araç bile kendiliğinden eklenmedi
  // iki istek: önce ruhsat okuması (başlıksız), sonra liste okuması (bugün başlıkta)
  const calls = await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').map(c => ({ type: c.type, list: c.list })));
  expect(calls).toEqual([{ type: 'image/png' }, { type: 'image/png', list: { today: '2026-09-23' } }]);
  // onaylayınca eklenir: ücret ayrı alana, tek firma beyannameye
  const item = panel.locator('.msg-item').first();
  await item.locator('[data-action="msg-apply"]').click();
  await expect.poll(writes).toBe(1);
  expect(await page.evaluate(() => window.__db.visits.find(v => v.plate === '06 KL 4567' && v.visit_date === '2026-09-24'))).toMatchObject({ customer: 'ABC NAKLİYAT', declaration: 'GALATA PETROL', note: '', fee_amount: 90, fee_currency: 'EUR' });
  expect(await page.evaluate(() => window.__db.incoming_messages.length)).toBe(0);      // sohbet veritabanına yazılmaz
  expect(problems).toEqual([]);
});

test('sohbete ruhsat fotoğrafı: liste aranmaz, "Ruhsattan ekle" penceresinde açılır ve aynı fotoğraf ikinci kez okutulmaz; ruhsat da liste de değilse nedeni yazılır', async ({ page }) => {
  test.setTimeout(90000);
  const ruhsat = { vehicles: [{ plate: 'PB1234AB', kind: 'tractor', empty_weight_kg: 8150, country: 'BG' }, { plate: 'PB5678CD', kind: 'trailer', empty_weight_kg: 6700, country: 'BG' }], problem: '' };
  const problems = await openApp(page, { ai: ruhsat, aiText: { items: [], customer: '', problem: 'Mesaj yok.', model: 'x' } });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  await page.locator('#chat-file').setInputFiles({ name: 'ruhsat.png', mimeType: 'image/png', buffer: PNG1 });
  await expect(panel).toContainText('Bu bir ruhsat fotoğrafı. “Ruhsattan ekle” penceresinde açtım');
  await expect(page.locator('#ruhsat-box')).toBeVisible();
  await expect(page.locator('.rs-item .rs-status').first()).toHaveText('Okundu · yapay zekâ');
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length)).toBe(1);   // ikinci okuma yok
  await page.keyboard.press('Escape');
  // ne ruhsat ne liste
  await page.evaluate(() => { window.__PCS_STUB.ai = { vehicles: [], problem: 'Fotoğraf bulanık.' }; });
  await page.locator('#chat-file').setInputFiles({ name: 'bos.png', mimeType: 'image/png', buffer: PNG1 });
  await expect(panel).toContainText('Fotoğrafta ruhsat ya da araç listesi bulamadım (Mesaj yok)');
  expect(await page.evaluate(() => window.__calls.filter(c => ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  expect(problems).toEqual([]);
});

test('sohbet kutusuna yapıştırılan resim sohbete gider (Ruhsattan ekle açılmaz); büyük dosya ve eski sunucu fonksiyonu anlaşılır hata verir', async ({ page }) => {
  test.setTimeout(90000);
  const aiText = { items: [mi('add', '06KL4567', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { ai: NO_CARD, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  await page.locator('#chat-input').focus();
  await page.evaluate(() => {
    const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'ekran.png', { type: 'image/png' }));
    document.getElementById('chat-input').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('#chat-panel')).toContainText('Fotoğraftan 1 araç okudum');
  await expect(page.locator('#ruhsat-box')).toHaveCount(0);
  // yazı yapıştırmak sohbeti bozmaz
  await page.locator('#chat-input').fill('merhaba');
  // 10 MB'tan büyük dosya sunucuya gönderilmez
  const before = await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length);
  await page.locator('#chat-file').setInputFiles({ name: 'dev.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.locator('#chat-panel')).toContainText('Fotoğraf çok büyük (en fazla 10 MB)');
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length)).toBe(before);
  // liste modunu bilmeyen eski sürüm fotoğrafı ruhsat gibi okur ("vehicles" döner): güncelleme istenir, tekrar tekrar denenmez
  await page.evaluate(() => { window.__PCS_STUB.aiText = { vehicles: [], problem: '' }; });
  await page.locator('#chat-file').setInputFiles({ name: 'liste2.png', mimeType: 'image/png', buffer: PNG1 });
  await expect(page.locator('#chat-panel')).toContainText('ruhsat-oku fonksiyonunun güncel hali Supabase’e yüklenmemiş');
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku' && c.list).length)).toBe(2);   // 1. liste + 1. deneme (üç değil)
  expect(problems).toEqual([]);
});

test('"Ruhsattan ekle"ye atılan liste fotoğrafı ruhsat sayılmaz: liste mesaj kartı olur; WhatsApp fotoğrafı bu bilgisayarda liste çıkarsa satır kapanır', async ({ page }) => {
  test.setTimeout(90000);
  const data = sampleData();
  data.incoming_ruhsat = [waRow('w7', { caption: 'yarınki liste' })];
  data.incoming_messages = [msgRow('m6', [mi('add', '06KL4567', '', '2026-09-24')], { ai: { items: [mi('add', '06KL4567', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test', image: true }, body: '(Fotoğraftaki liste)' })];
  const files = { '2026-09-22/w7.png': PNG1.toString('base64') };
  const aiText = { items: [mi('add', 'CB1234AB', '', '2026-09-24'), mi('add', 'B123XYZ', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test' };
  const problems = await openApp(page, { data, files, ai: NO_CARD, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  // WhatsApp fotoğrafı bu ekranda okunur (sunucu okumamış): ruhsat çıkmaz, liste çıkar → satır kapanır, liste mesaj olarak onaya düşer
  await expect.poll(async () => (await page.evaluate(() => window.__db.incoming_ruhsat.find(r => r.id === 'w7'))).status, { timeout: 30000 }).toBe('yoksayildi');
  expect((await page.evaluate(() => window.__db.incoming_ruhsat.find(r => r.id === 'w7'))).note).toBe('Araç listesi olarak okundu');
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  const cards = page.locator('.msg-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: 'WhatsApp · fotoğraftaki liste' })).toHaveCount(2);        // sunucudan gelen satır ve bu ekranda okunan
  await expect(page.locator('.rs-item')).toHaveCount(0);                                            // ruhsat kartı yok
  await expect(page.locator('.msg-thumb img')).toHaveCount(1);                                      // bu ekranda okunanın küçük resmi
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  // elle atılan liste fotoğrafı: yapıştırılan liste kartı
  await page.locator('#ruhsat-file').setInputFiles([{ name: 'liste.png', mimeType: 'image/png', buffer: PNG1 }]);
  await expect(page.locator('.msg-card', { hasText: 'Yapıştırılan liste (resim)' })).toBeVisible();
  await expect(page.locator('.rs-item')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('uzun bekleyen araç: tesise girip işlemi bitmeyen ve eşiği aşan araç tabloda ve kartta kırmızı görünür, bildirimde listelenir; eşik Ayarlar > Uyarılar\'dan değişir', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  const mk = (id, plate, customer, extra) => ({ id, plate, customer, declaration: '', carrier: '', registration: '', visit_date: '2026-09-23', visit_time: '08:00', note: '', onsite: false, t1: false, done: false,
    created_at: '2026-09-21T05:00:00Z', updated_at: '2026-09-21T06:00:00Z', onsite_at: null, done_at: null, sort_order: null, ...extra });
  // şimdi 23 Eylül 10:00 (İstanbul) = 07:00Z
  data.visits.push(
    mk('v8', 'CB 1234 AB', 'TORNADO', { onsite: true, t1: true, onsite_at: '2026-09-21T06:00:00Z' }),   // girişinden beri 49 saat
    mk('v9', 'B 123 XYZ', 'LİN LOJ', { onsite: true, onsite_at: '2026-09-21T03:00:00Z' }),             // 52 saat
    mk('v10', '06 KL 4567', 'ABC NAKLİYAT', { onsite: true, onsite_at: '2026-09-22T05:00:00Z' }),      // 26 saat: 48'in altında
    mk('v11', 'X 4455 KB', 'BULTRANS', { created_at: '2026-09-15T05:00:00Z' })                         // günlerdir "gelecek" ama tesiste değil: uyarılmaz
  );
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const row = id => page.locator(`tr[data-row-id="${id}"]`);
  await expect(row('v8')).toHaveClass(/row-long/);
  await expect(row('v8').locator('.wait-badge')).toHaveText('2 gün 1 sa');
  await expect(row('v9')).toHaveClass(/row-long/);
  await expect(row('v9').locator('.wait-badge')).toHaveText('2 gün 4 sa');
  await expect(row('v10')).not.toHaveClass(/row-long/);                                     // 26 saat < 48
  await expect(row('v11')).not.toHaveClass(/row-long/);                                     // tesiste değil
  await expect(row('v5')).not.toHaveClass(/row-long/);                                      // bugün girdi
  await expect(page.locator('.wait-badge')).toHaveCount(2);
  const red = await row('v9').locator('td').nth(2).evaluate(e => getComputedStyle(e).backgroundColor);
  expect(red).toBe('rgb(255, 240, 240)');
  // kartlar görünümü
  await page.locator('[data-action="view-mode"][data-v="cards"]').click();
  await expect(page.locator('.vcard.long')).toHaveCount(2);
  await expect(page.locator('.vcard.long[data-card-id="v9"] .wait-badge')).toHaveText('2 gün 4 sa');
  await page.locator('[data-action="view-mode"][data-v="table"]').click();
  // bildirim zili
  await page.locator('.notif-btn').click();
  await expect(page.locator('.notif-panel')).toContainText('Uzun bekleyen');
  await expect(page.locator('.notif-panel')).toContainText('2 araç 2 gün süreyi aştı: tesise girdi, işlemleri bitmedi.');
  await page.keyboard.press('Escape');
  // Ayarlar > Uyarılar: eşik 24 saate inince 26 saatlik araç da kırmızı olur
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="alerts"]').click();
  await expect(page.locator('[data-sk="waitHours"] .on')).toHaveText('48 saat');
  await page.locator('[data-sk="waitHours"] [data-v="24"]').click();
  await expect(page.locator('#save-bar')).toHaveClass(/show/);
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(row('v10')).toHaveClass(/row-long/);
  await expect(row('v10').locator('.wait-badge')).toHaveText('26 sa');
  // kaydedilince herkes için geçerli (günlük rapor da bu değeri okur)
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="alerts"]').click();
  await page.locator('[data-action="app-save"]').click();
  await expect(page.locator('#toast')).toContainText('Görünüm ayarları kaydedildi');
  expect((await page.evaluate(() => window.__db.app_settings.find(r => r.key === 'appearance').value)).waitHours).toBe('24');
  // kapalı: hiçbir uyarı yok
  await page.locator('[data-sk="waitHours"] [data-v="0"]').click();
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('.wait-badge')).toHaveCount(0);
  await expect(page.locator('tr.row-long')).toHaveCount(0);
  await page.locator('.notif-btn').click();
  await expect(page.locator('.notif-panel')).not.toContainText('Uzun bekleyen');
  // işlemleri biten araç uyarıdan çıkar
  await page.keyboard.press('Escape');
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="alerts"]').click();
  await page.locator('[data-sk="waitHours"] [data-v="48"]').click();
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(row('v8')).toHaveClass(/row-long/);
  await row('v8').locator('label[for="chk-v8-done"]').click();
  await expect(row('v8')).not.toHaveClass(/row-long/);
  await expect(row('v9')).toHaveClass(/row-long/);
  expect(problems).toEqual([]);
});

test('aylık müşteri raporu: müşteri başına araç sayısı ve ücret toplamı (para birimi ayrı; eski notlardaki tutar da sayılır), ay seçilir, Excel\'e aktarılır', async ({ page }) => {
  test.setTimeout(90000);
  const data = sampleData();
  const fee = (id, amount, cur, extra = {}) => { Object.assign(data.visits.find(v => v.id === id), { fee_amount: amount, fee_currency: cur, ...extra }); };
  fee('v1', 90, 'EUR'); fee('v2', 120.5, 'EUR'); fee('v5', 90, 'EUR'); fee('v6', 80, 'TRY'); fee('v7', 250, 'EUR');
  data.visits.find(v => v.id === 'v3').note = '100 USD · 1.GALATA PETROL';       // eski kayıt: ücret notun başında
  // v4 (ABC NAKLİYAT) ücretsiz; Ağustos'ta tek araç
  data.visits.push({ id: 'v90', plate: '35 AGU 35', customer: 'ESKİ MÜŞTERİ', declaration: '', carrier: '', registration: '', visit_date: '2026-08-12', visit_time: '09:00', note: '', onsite: false, t1: false, done: true,
    created_at: '2026-08-12T05:00:00Z', updated_at: '2026-08-12T06:00:00Z', onsite_at: null, done_at: null, sort_order: null, fee_amount: 45, fee_currency: 'USD' });
  const problems = await openApp(page, { data });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.nav-item[data-page="reports"]').click();
  const card = page.locator('#cust-report');
  await expect(card).toBeVisible();
  await expect(card.locator('#cr-month option:checked')).toHaveText(/Eylül 2026 · 7 araç/);
  const rows = () => card.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim())));
  expect(await rows()).toEqual([
    ['BULTRANS', '2', '2', '0', '180 EUR'],
    ['LİN LOJ', '2', '2', '0', '250 EUR · 100 USD'],           // v3'ün 100 USD'si notun başından okundu
    ['TORNADO', '2', '2', '0', '120,5 EUR · 80 TRY'],
    ['ABC NAKLİYAT', '1', '0', '1', '—']
  ]);
  expect(await card.locator('tfoot td').allTextContents()).toEqual(['TOPLAM', '7', '6', '1', '550,5 EUR · 100 USD · 80 TRY']);
  await expect(card).toContainText('1 araçta ücret yazılmamış');
  await expect(card).toContainText('1 araçta ücret, notun başındaki tutardan okundu');
  await expect(card.locator('.rs-note.warn')).toHaveCount(0);                                 // ücret alanı kurulu: uyarı yok
  // müşteri adına tıklayınca profil açılır
  await card.locator('[data-action="customer-profile"]', { hasText: 'BULTRANS' }).click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.keyboard.press('Escape');
  // ay seçimi
  await card.locator('#cr-month').selectOption('2026-08');
  expect(await rows()).toEqual([['ESKİ MÜŞTERİ', '1', '1', '0', '45 USD']]);
  expect(await card.locator('tfoot td').allTextContents()).toEqual(['TOPLAM', '1', '1', '0', '45 USD']);
  await expect(card).not.toContainText('ücret yazılmamış');
  await card.locator('#cr-month').selectOption('2026-09');
  // Excel: özet + araç detayı; para birimi ayrı sütun, toplamlar formül
  const [download] = await Promise.all([page.waitForEvent('download'), card.locator('[data-action="export-customers"]').click()]);
  expect(download.suggestedFilename()).toBe('PCS_2026-09_MUSTERI_RAPORU.xlsx');
  const buf = fs.readFileSync(await download.path());
  expect(buf.subarray(0, 2).toString()).toBe('PK');
  const xml = buf.toString('utf8');
  for (const t of ['MÜŞTERİ RAPORU', 'AYLIK MÜŞTERİ RAPORU', 'Eylül 2026', 'TOPLAM ÜCRET (EUR)', 'TOPLAM ÜCRET (USD)', 'TOPLAM ÜCRET (TRY)', 'ARAÇ DETAYI', 'BULTRANS', 'TORNADO', '34 ABC 123', 'SUM(B5:B8)', 'SUM(E5:E8)', 'GELİŞ TARİHİ'])
    expect(xml).toContain(t);
  expect(xml).not.toContain('ESKİ MÜŞTERİ');                                               // başka ayın müşterisi yok
  expect(xml).toContain('<v>550.5</v>');                                                    // EUR toplamı (önbellekteki değer)
  expect(xml).toContain('<v>120.5</v>');
  expect(problems).toEqual([]);
});

test('ücret alanı: araç formunda tutar ve para birimi girilir, kaydedilir, geri alınır; sayı olmayan ücret reddedilir; sütun yoksa kutular çıkmaz ve hiçbir yazmaya eklenmez', async ({ page }) => {
  test.setTimeout(90000);
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('.heading [data-action="add-visit"]').first().click();
  await expect(page.locator('#f-fee_amount')).toBeVisible();
  await expect(page.locator('#f-fee_currency')).toHaveValue('EUR');
  await page.locator('#f-plate').fill('06 KL 4567');
  await page.locator('#f-fee_amount').fill('90x');
  await page.locator('#visit-form button[type="submit"]').click();
  await expect(page.locator('#form-error')).toContainText('Ücret yalnızca sayı olmalı');
  await page.locator('#f-fee_amount').fill('1.250,50');
  await page.locator('#f-fee_currency').selectOption('USD');
  await page.locator('#visit-form button[type="submit"]').click();
  await expect(page.locator('#modal')).toBeHidden();
  const added = () => page.evaluate(() => window.__db.visits.find(v => v.plate === '06 KL 4567' && v.visit_date === '2026-09-23'));
  expect(await added()).toMatchObject({ fee_amount: 1250.5, fee_currency: 'USD' });
  // düzenlerken kayıtlı ücret kutuda görünür; boşaltınca ücret silinir
  await page.locator('tr[data-row-id]', { hasText: '06 KL 4567' }).first().locator('[data-action="select-visit"]').click();   // dar ekranda doğrudan düzenleme formu açılır
  await expect(page.locator('#f-fee_amount')).toHaveValue('1250,5');
  await expect(page.locator('#f-fee_currency')).toHaveValue('USD');
  await page.locator('#f-fee_amount').fill('');
  await page.locator('#visit-form button[type="submit"]').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect(await added()).toMatchObject({ fee_amount: null, fee_currency: '' });
  expect(problems).toEqual([]);

  // sütunlar yok (ucret-kurulumu.sql çalıştırılmamış): kutular çıkmaz, yazma istekleri sütunsuz gider, rapor uyarır
  const page2 = await page.context().newPage();
  const problems2 = await openApp(page2, { noFee: true });
  await expect(page2.locator('#app')).toContainText('34 ABC 123');
  await page2.locator('.heading [data-action="add-visit"]').first().click();
  await expect(page2.locator('#f-plate')).toBeVisible();
  await expect(page2.locator('#f-fee_amount')).toHaveCount(0);
  await page2.locator('#f-plate').fill('06 KL 4567');
  await page2.locator('#visit-form button[type="submit"]').click();
  await expect(page2.locator('#modal')).toBeHidden();
  const w = await page2.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').map(c => Object.keys(c.rows[0])));
  expect(w.length).toBe(1);
  expect(w[0]).not.toContain('fee_amount');
  expect(w[0]).not.toContain('fee_currency');
  await page2.locator('.nav-item[data-page="reports"]').click();
  await expect(page2.locator('#cust-report .rs-note.warn')).toContainText('ucret-kurulumu.sql');
  expect(problems2).toEqual([]);                                                                       // sütun kayıtlı satırlardan anlaşılır: 400 veren yoklama isteği yok
  expect(await page2.evaluate(() => window.__calls.filter(c => c.table === 'visits' && /fee_amount/.test(c.cols || '')).length)).toBe(0);
  await page2.close();
});

test('ücret ayrıştırma: "90 EURO", "1.250,50 TL", "$100" okunur; tanınmayan para birimi ya da belirsiz yazı okunmaz', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const r = await page.evaluate(() => {
    const { parseFee, parseAmount, feeOf, validateData } = window.PCS_TEST;
    const bk = fee => validateData({ schemaVersion: 1, registry: [{ id: 'r1', plate: '34 ABC 123', customer: 'X' }], visits: [{ id: 'v1', plate: '34 ABC 123', customer: 'X', date: '2026-09-23', time: '', note: '', onsite: false, t1: false, done: false, ...fee }] }).visits[0];
    return {
      backup: [bk({ fee_amount: 90.456, fee_currency: 'USD' }), bk({ fee_amount: -5 }), bk({ fee_amount: 10, fee_currency: 'XYZ' }), bk({})].map(v => [v.fee_amount ?? null, v.fee_currency ?? null]),
      fees: ['90 EURO', '90 EUR (KDV hariç)', '1.250,50 TL', '$100', '€ 75', '1,250.50 USD', '90,5 euro', '1.GALATA 90 EURO', '15 ARAÇ', '90', '12 RON', '', '99999999 EUR'].map(t => parseFee(t)),
      amounts: ['90', '90,5', '90.5', '1.250', '1.250,50', '1,250.50', '0', 'abc', '12abc', ''].map(t => parseAmount(t)),
      of: [
        feeOf({ fee_amount: 90, fee_currency: 'USD', note: '50 EURO' }),     // alan notun önüne geçer
        feeOf({ fee_amount: null, note: '90 EURO · 1.GALATA' }),               // eski kayıt: notun başından
        feeOf({ note: 'acil · 90 EURO' }),                                      // not başında değilse ücret sayılmaz
        feeOf({ fee_amount: '', note: '' })
      ]
    };
  });
  expect(r.fees).toEqual([
    { amount: 90, cur: 'EUR' }, { amount: 90, cur: 'EUR' }, { amount: 1250.5, cur: 'TRY' }, { amount: 100, cur: 'USD' }, { amount: 75, cur: 'EUR' },
    { amount: 1250.5, cur: 'USD' }, { amount: 90.5, cur: 'EUR' }, { amount: 90, cur: 'EUR' }, null, null, null, null, null
  ]);
  expect(r.amounts).toEqual([90, 90.5, 90.5, 1250, 1250.5, 1250.5, 0, NaN, NaN, NaN]);   // okunamayanlar NaN
  expect(r.backup).toEqual([[90.46, 'USD'], [null, null], [10, 'EUR'], [null, null]]);   // JSON yedeğinden dönerken ücret korunur, bozuk değer atılır
  expect(r.of).toEqual([{ amount: 90, cur: 'USD', legacy: false }, { amount: 90, cur: 'EUR', legacy: true }, null, null]);
});

test('sohbet hızlı yol: sık sorular ve plakalı durum komutları yerelde anında cevaplanır (Gemini\'ye gitmez); tanınmayan ya da belirsiz cümle Gemini\'ye gider', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const aiText = chatAi({ problem: 'Anlaşılmadı.' });
  const problems = await openApp(page, { aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  const ai = () => page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length);
  const writes = () => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length);
  // sorular
  await say('Bugün kaç araç tesiste?');
  await expect(panel).toContainText('23 Eylül · tesiste: 2 araç');
  await say('bugünün özeti');
  await expect(panel.locator('.chat-sum')).toHaveCount(1);
  expect(await panel.locator('.chat-sum').last().locator('b').allTextContents()).toEqual(['3', '2', '1', '1', '0']);
  await say('gelecek araçları listele');
  await expect(panel.locator('.chat-row').last()).toContainText('CB 1234 AB');
  await say('BULTRANS bekleyen araçlar');
  await expect(panel).toContainText('23 Eylül · BULTRANS · gelecek: 0 araç');
  await say('yarın kaç araç var');
  await expect(panel).toContainText('24 Eylül: 0 araç');
  await say('bu hafta kaç araç tesiste');
  await expect(panel).toContainText('39. hafta · tesiste: 2 araç');
  await say('CB 1234 AB ne durumda');
  await expect(panel).toContainText('Son kayıtlar · CB 1234 AB: 2 araç');
  expect(await ai()).toBe(0);                                                       // hiçbiri yapay zekâya gitmedi
  expect(await writes()).toBe(0);
  // plakalı durum komutları: tek araç, hemen uygulanır
  await say('CB 1234 AB tesiste');
  await expect(panel).toContainText('CB 1234 AB · Tesiste: hayır → evet');
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6').onsite)).toBe(true);
  await say('cb 1234 ab t1 yazıldı');
  await expect(panel).toContainText('T1 yazıldı: hayır → evet');
  await say('CB-1234-AB işlemleri bitti');
  await expect(panel).toContainText('İşlemler bitti: hayır → evet');
  await say('CB 1234 AB tesiste değil');                                           // olumsuz: kutu kapatılır
  await expect(panel).toContainText('Tesiste: evet → hayır');
  expect(await writes()).toBe(4);
  expect(await ai()).toBe(0);
  // belirsiz / tanınmayan cümleler yapay zekâya gider (yanlış anlama yerine)
  for (const t of ['yarın 34 ABC 123 gelecek', 'tesiste olmayan araçlar', 'bugün kaç araç ertelendi', 'BULTRANS ve LİN LOJ araçları', 'XX 9999 YY tesiste']) {
    const before = await ai();
    await say(t);
    await expect.poll(ai).toBe(before + 1);
    await expect(panel).toContainText('Bunu anlayamadım');
  }
  expect(await writes()).toBe(4);                                                   // yapay zekâya giden cümleler hiçbir şeyi değiştirmedi
  expect(problems).toEqual([]);
});

test('sohbet: yapay zekâ cevabı beklenirken geçen süre görünür', async ({ page }) => {
  test.setTimeout(60000);
  const problems = await openApp(page, { aiText: chatAi({ problem: 'Anlaşılmadı.' }), aiDelay: 10000 });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  await page.locator('#chat-input').fill('yarın 34 ABC 123 gelecek');
  await page.locator('#chat-input').press('Enter');
  const panel = page.locator('#chat-panel');
  await expect(panel.locator('.chat-typing')).toBeVisible();
  await page.clock.runFor(2000);
  await expect(panel).not.toContainText('Yanıt bekleniyor');          // ilk saniyelerde ek yazı yok
  await page.clock.runFor(4000);
  await expect(panel).toContainText('Yanıt bekleniyor… 6 sn');
  await page.clock.runFor(6000);
  await expect(panel).toContainText('Bunu anlayamadım');
  await expect(panel.locator('.chat-typing')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('koyu tema: yazılara kalınlaştırıcı çizgi (text-stroke) eklenmez; yazı kalınlığı açık temadaki gibidir', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const read = () => page.evaluate(() => { const b = getComputedStyle(document.body), t = getComputedStyle(document.querySelector('td.info')); return { stroke: b.webkitTextStrokeWidth, weight: t.fontWeight }; });
  const light = await read();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const dark = await read();
  expect(dark.stroke).toBe('0px');
  expect(dark.weight).toBe(light.weight);
  expect(problems).toEqual([]);
});

test('sohbet: plaka yazım hatası yapay zekâ beklenmeden düzeltme önerilir; "yi" gibi ekler anlaşılır; duyurularda öneri yapılmaz', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const problems = await openApp(page, { aiText: chatAi({ problem: 'Anlaşılmadı.' }) });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  const ai = () => page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length);
  await say('CB 1234 A yi T1 yazıldı yap');                                   // son harf eksik
  await expect(panel).toContainText('“CB 1234 A” plakasını panoda bulamadım. Şunu mu demek istediniz?');
  await expect(panel.locator('[data-action="chat-say"]')).toHaveText('CB 1234 AB yi T1 yazıldı yap');
  expect(await ai()).toBe(0);
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6').t1)).toBe(false);   // öneri hiçbir şeyi değiştirmez
  await panel.locator('[data-action="chat-say"]').click();                    // önerilene tıklayınca gönderilir ve yerelde uygulanır
  await expect(panel).toContainText('CB 1234 AB · T1 yazıldı: hayır → evet');
  expect(await page.evaluate(() => window.__db.visits.find(v => v.id === 'v6').t1)).toBe(true);
  expect(await ai()).toBe(0);
  await say('CB 1234 AB yi tesiste yap');                                     // ek ("yi") anlaşılır
  await expect(panel).toContainText('CB 1234 AB · Tesiste: hayır → evet');
  expect(await ai()).toBe(0);
  // plakaya benzeyen ama bir duyuru olan cümlede öneri yapılmaz, yapay zekâya gider
  await say('yarın CB 1234 A gelecek');
  await expect.poll(ai).toBe(1);
  await expect(panel).toContainText('Bunu anlayamadım');
  expect(problems).toEqual([]);
});

test('sohbet: yapay zekâ beklemesi sınırlıdır (50 sn, en çok 2 deneme); zaman aşımı yazılan cümleyi geri verir', async ({ page }) => {
  test.setTimeout(60000);
  const err504 = { status: 504, body: { error: 'Gemini 504', reason: 'Gemini zamanında cevap vermedi' } };
  const problems = await openApp(page, { aiText: [err504, err504, err504] });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  await page.locator('#chat-input').fill('yarın 34 ABC 123 gelecek');
  await page.locator('#chat-input').press('Enter');
  await expect(panel).toContainText('sn sonra yeniden denenecek');
  await page.clock.runFor(10000);
  await expect(panel).toContainText('Okuyamadım: Gemini zamanında cevap vermedi');
  const calls = await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').map(c => c.timeout));
  expect(calls).toEqual([50000, 50000]);                                       // sohbette 50 sn ve en çok iki deneme (önceden 150 sn ve üç deneme)
  await expect(page.locator('#chat-input')).toHaveValue('yarın 34 ABC 123 gelecek');
  expect(problems.filter(p => !/504/.test(p))).toEqual([]);
});

test('WhatsApp kurulmamışsa (tablo yok) sessizce devre dışı kalır', async ({ page }) => {
  const problems = await openApp(page, { missing: ['incoming_ruhsat'] });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.clock.fastForward(95000);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  expect(await page.evaluate(() => window.__calls.filter(c => c.table === 'incoming_ruhsat').length)).toBe(1);
  expect(problems).toEqual([]);
});

test('güvenlik linki: Bekleyenler üç blok; GİRİŞ aracı "Tesiste"ye geçirir, ÇIKIŞ ayrı saat yazar', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1' }, '/?guvenlik=g1');
  await expect(page.locator('.guard')).toBeVisible();
  await expect(page.locator('#auth-form')).toHaveCount(0);
  const card = () => page.locator('.guard-card', { hasText: 'CB 1234 AB' });
  const v6 = () => page.evaluate(() => window.__db.visits.find(v => v.id === 'v6'));
  const col = k => page.locator(`#guard-col-${k}`);
  // Üç blok: gelecek 1, tesiste 2 (bugün girenler), çıkışa hazır 1 (21 Eylül'de girip işlemleri bitmiş, çıkmamış)
  await expect(col('coming').locator('.guard-col-n')).toHaveText('1');
  await expect(col('inside').locator('.guard-col-n')).toHaveText('2');
  await expect(col('ready').locator('.guard-col-n')).toHaveText('1');
  await expect(col('coming')).toContainText('CB 1234 AB');
  // Ruhsat (kilo) kartta görünür; ruhsatı olmayan araçta etiket yok
  await expect(page.locator('#guard-col-inside .guard-card', { hasText: '34 ABC 123' }).locator('.guard-reg')).toHaveText(/Ruhsat\s*15400 KG/i);
  await expect(page.locator('.guard-card', { hasText: 'B 123 XYZ' }).locator('.guard-reg')).toHaveCount(0);
  // Girişten önce: GİRİŞ basılabilir, ÇIKIŞ basılamaz
  await expect(card().locator('button[data-k="giris"]')).toBeVisible();
  await expect(card().locator('button[data-k="cikis"]')).toHaveCount(0);
  await expect(card().locator('.guard-btn.out.off')).toContainText('önce giriş');

  // GİRİŞ -> TESİSTE + giriş saati; kart "Tesiste · işlemde" bloğuna geçer, aynı kartta ÇIKIŞ açılır
  await card().locator('[data-k="giris"]').click();
  await expect(page.locator('#toast')).toContainText('giriş yaptı, tesiste');
  let v = await v6();
  expect([v.onsite, !!v.onsite_at, v.done, v.exit_at || null]).toEqual([true, true, false, null]);
  await expect(col('inside').locator('.guard-card', { hasText: 'CB 1234 AB' })).toBeVisible();
  await expect(col('coming')).toContainText('Gelecek araç yok');
  await expect(card().locator('.guard-btn.in.done')).toContainText('Giriş');
  await expect(card().locator('[data-k="giris_geri"]')).toBeVisible();

  // ÇIKIŞ -> ayrı çıkış saati; "bitti" değişmez; kart 15 dk "Az önce çıkanlar"da kalır, geri alınabilir
  await card().locator('button[data-k="cikis"]').click();
  await expect(page.locator('#toast')).toContainText('çıkış yaptı');
  v = await v6();
  expect([!!v.exit_at, v.done, v.done_at || null]).toEqual([true, false, null]);
  await expect(card().locator('.guard-btn.out.done')).toContainText('Çıkış');
  await expect(col('ready').locator('.guard-card', { hasText: 'CB 1234 AB' })).toHaveClass(/is-done/);
  await expect(col('ready')).toContainText('Az önce çıkanlar');
  await page.locator('[data-action="guard-tab"][data-k="out"]').click();
  await expect(card()).toBeVisible();
  await card().locator('[data-k="cikis_geri"]').click();
  await expect(page.locator('#toast')).toContainText('çıkışı geri alındı');
  expect((await v6()).exit_at).toBeNull();

  // Güvenlik ekranı yalnızca kendi fonksiyonlarını çağırır; tablolar ve beyanname gibi bilgiler görünmez.
  expect(await page.evaluate(() => window.__calls.filter(c => c.table).length)).toBe(0);
  await expect(page.locator('body')).not.toContainText('26341200EX0001');
  expect(problems).toEqual([]);
});

test('güvenlik: ofisin "işlemleri bitti" dediği araç "Çıkışa hazır"da en üste gelir; çıkan aracın bilgisi WhatsApp’ta paylaşılır', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1' }, '/?guvenlik=g1');
  const ready = page.locator('#guard-col-ready .guard-card');
  await expect(ready).toHaveCount(1);
  await expect(ready.first()).toContainText('21 Eylül');
  // Ofis panodan B 123 XYZ için "işlemleri bitti" der; 10 sn'lik yenilemede kart "Çıkışa hazır"ın başına geçer
  await page.evaluate(() => Object.assign(window.__db.visits.find(v => v.id === 'v7'), { done: true, done_at: new Date().toISOString() }));
  await page.clock.runFor(10500);
  await expect(ready.first()).toContainText('B 123 XYZ');
  await expect(ready.nth(1)).toContainText('21 Eylül');
  await expect(page.locator('#guard-col-ready .guard-col-n')).toHaveText('2');
  await expect(page.locator('#guard-col-inside .guard-col-n')).toHaveText('1');

  // İkisi de çıkar; 15 dk boyunca "Az önce çıkanlar"da WhatsApp düğmesiyle kalırlar
  await ready.first().locator('button[data-k="cikis"]').click();
  await expect(page.locator('#toast')).toContainText('B 123 XYZ çıkış yaptı');
  await page.locator('#guard-col-ready .guard-card', { hasText: '21 Eylül' }).locator('button[data-k="cikis"]').click();
  await expect(page.locator('#toast')).toContainText('34 ABC 123 çıkış yaptı');
  await expect(page.locator('#guard-col-ready .guard-card.is-done')).toHaveCount(2);
  await expect(page.locator('#guard-col-ready .guard-col-n')).toHaveText('0');
  await expect(page.locator('#guard-col-ready .guard-card', { hasText: '21 Eylül' }).locator('[data-action="guard-card-wa"]')).toBeVisible();

  // Çıkanlar yalnızca seçilen günün (bugün) araçlarını gösterir: 21 Eylül'den kalan araç orada yok
  await page.locator('[data-action="guard-tab"][data-k="out"]').click();
  const cards = page.locator('.guard-card');
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(card).toContainText('B 123 XYZ');
  await expect(card).not.toHaveClass(/is-done/);
  const launched = page.waitForEvent('request', r => r.url().startsWith('whatsapp://send'));
  await card.locator('[data-action="guard-card-wa"]').click();
  const text = new URL((await launched).url()).searchParams.get('text');
  expect(text).toContain('B123XYZ');
  expect(text).toContain('TESİS ÇIKIŞ TARİH SAAT : 23.09.2026  10:00');
  expect(text).toContain('MÜŞTERİ : LİN LOJ');
  // Henüz çıkmamış araçta paylaşma düğmesi yok
  await page.locator('[data-action="guard-tab"][data-k="wait"]').click();
  await expect(page.locator('.guard-card', { hasText: 'CB 1234 AB' }).locator('[data-action="guard-card-wa"]')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('güvenlik ekranı 10 sn’de bir kendiliğinden yenilenir; saat saniyeli, yenile düğmesi çalışır', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1' }, '/?guvenlik=g1');
  await expect(page.locator('#guard-col-inside')).toContainText('B 123 XYZ');
  await expect(page.locator('.saha-date small')).toHaveText(/Güncel · \d\d:\d\d:\d\d/);
  const loads = () => page.evaluate(() => window.__calls.filter(c => c.rpc === 'guard_board').length);
  // ofis v7'yi "işlemler bitti" yapar -> 10 sn içinde "Çıkışa hazır"a geçer
  await page.evaluate(() => { const v = window.__db.visits.find(x => x.id === 'v7'); v.done = true; v.done_at = new Date().toISOString(); });
  await page.clock.runFor(10500);
  await expect(page.locator('#guard-col-ready')).toContainText('B 123 XYZ');
  const n = await loads();
  await page.locator('[data-action="guard-refresh"]').click();
  await expect.poll(loads).toBe(n + 1);
  expect(problems).toEqual([]);
});

test('güvenlik ekranı: cevapsız kalan istek ekranı kilitlemez, bağlantı gelince yenilenmeye devam eder', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1' }, '/?guvenlik=g1');
  await expect(page.locator('#guard-col-coming')).toContainText('CB 1234 AB');
  await page.evaluate(() => { window.__hangRpc = true; });
  // GİRİŞ basıldı ama cevap gelmiyor -> 20 sn sonra bırakılır, düğme yeniden basılabilir
  await page.locator('.guard-card', { hasText: 'CB 1234 AB' }).locator('[data-k="giris"]').click();
  await page.clock.runFor(21000);
  await expect(page.locator('#toast')).toContainText('Bağlantı yavaş');
  // ardından başlayan liste isteği de cevapsız: 15 sn sonra bırakılır, ekranda uyarı çıkar
  await page.clock.runFor(16000);
  await expect(page.locator('.guard-alert')).toContainText('Bağlantı yavaş');
  // bağlantı düzelir; ofis bir aracı değiştirir -> sonraki yoklamada görünür, uyarı kalkar
  await page.evaluate(() => { window.__hangRpc = false; const v = window.__db.visits.find(x => x.id === 'v7'); v.done = true; v.done_at = new Date().toISOString(); });
  await page.clock.runFor(10500);
  await expect(page.locator('#guard-col-ready')).toContainText('B 123 XYZ');
  await expect(page.locator('.guard-alert')).toHaveCount(0);
  await expect(page.locator('.guard-card', { hasText: 'CB 1234 AB' }).locator('[data-k="giris"]')).toBeEnabled();
  expect(problems).toEqual([]);
});

test('güvenlik: "Bu hafta" seçilince haftanın çıkanları görünür, "Bugün" yalnızca bugünü gösterir', async ({ page }) => {
  const data = sampleData();
  Object.assign(data.visits[2], { onsite_at: '2026-09-22T07:30:00Z', done_at: '2026-09-22T09:00:00Z', exit_at: '2026-09-22T09:20:00Z' });
  const problems = await openApp(page, { session: false, guardToken: 'g1', data }, '/?guvenlik=g1');
  await expect(page.locator('[data-action="guard-today"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="guard-tab"][data-k="out"]').click();
  await expect(page.locator('.saha-empty')).toContainText('Bu listede araç yok');
  // Hafta: Pazartesi 21 – Cumartesi 26 Eylül
  await page.locator('[data-action="guard-week"]').click();
  await expect(page.locator('.saha-date b')).toHaveText(/21 Eyl.*26 Eyl/i);
  await expect(page.locator('[data-action="guard-week"]')).toHaveAttribute('aria-pressed', 'true');
  const last = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'guard_board').pop().params);
  expect([last.p_from, last.p_to]).toEqual(['2026-09-21', '2026-09-26']);
  await expect(page.locator('.guard-card')).toHaveCount(1);
  await expect(page.locator('.guard-card')).toContainText('B 123 XYZ');
  await expect(page.locator('.guard-card')).toContainText('22 Eylül');
  await page.locator('[data-action="guard-today"]').click();
  await expect(page.locator('.saha-date b')).toHaveText(/23 Eyl/i);
  await expect(page.locator('.guard-card')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('güvenlik: tarih aralığı seçilir, giriş-çıkışlar müşteri bazında kopyalanır', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const data = sampleData();
  Object.assign(data.visits[2], { onsite_at: '2026-09-22T07:30:00Z', done_at: '2026-09-22T09:00:00Z', exit_at: '2026-09-22T09:20:00Z' });
  const problems = await openApp(page, { session: false, guardToken: 'g1', data }, '/?guvenlik=g1');
  await expect(page.locator('.guard-card').first()).toBeVisible();
  await page.locator('#guard-from').fill('2026-09-21');
  await page.locator('#guard-to').fill('2026-09-22');
  await expect(page.locator('.saha-date b')).toHaveText(/21 Eyl.*22 Eyl/i);
  const last = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'guard_board').pop().params);
  expect([last.p_from, last.p_to]).toEqual(['2026-09-21', '2026-09-22']);
  // eski günlerin araçlarında düğme yoktur ama saatler görünür (bu örnekte 21-22 Eylül 7 günlük pencerede)
  await page.locator('[data-action="guard-tab"][data-k="rep"]').click();
  const grp = page.locator('.gd-group', { hasText: 'LİN LOJ' });
  await expect(grp.locator('tbody tr')).toHaveCount(1);
  await expect(grp).toContainText('22.09.2026  12:20');
  await grp.locator('[data-action="guard-rep-copy"]').click();
  await expect(page.locator('#toast')).toContainText('1 aracın giriş-çıkış bilgisi kopyalandı');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('TESİS GİRİŞ TARİH SAAT : 22.09.2026  10:30');
  expect(clip).toContain('TESİS ÇIKIŞ TARİH SAAT : 22.09.2026  12:20');
  expect(clip).toContain('MÜŞTERİ : LİN LOJ');
  // Bugün'e dönüş
  await page.locator('[data-action="guard-today"]').click();
  await expect(page.locator('.saha-date b')).toHaveText(/23 Eyl/i);
  expect(problems).toEqual([]);
});

test('güvenlik: veritabanı eski sürümdeyse tarih seçimi bugüne döner, ekran çalışmaya devam eder', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1', guardOldSql: true }, '/?guvenlik=g1');
  await expect(page.locator('.guard-card').first()).toBeVisible();
  await page.locator('#guard-from').fill('2026-09-21');
  await expect(page.locator('#toast')).toContainText('guvenlik-kurulumu.sql');
  await expect(page.locator('#guard-from')).toHaveValue('2026-09-23');
  await expect(page.locator('.guard-card').first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('güvenlik izleme linki: ekran görünür, GİRİŞ / ÇIKIŞ yapılamaz', async ({ page }) => {
  const data = sampleData();
  Object.assign(data.visits[4], { done: true, done_at: '2026-09-23T06:10:00Z', exit_at: '2026-09-23T06:30:00Z' });
  const problems = await openApp(page, { session: false, guardToken: 'g1', guardViewToken: 'gv1', data }, '/?guvenlik-izle=gv1');
  await expect(page.locator('.guard-view-pill')).toHaveText(/Yalnızca görüntüleme/i);
  await expect(page).toHaveTitle(/Güvenlik izleme/);
  // Üç blok ve kartlar görünür; hiçbir kartta GİRİŞ / ÇIKIŞ düğmesi ya da geri alma yok
  await expect(page.locator('#guard-col-coming')).toContainText('CB 1234 AB');
  await expect(page.locator('#guard-col-ready')).toContainText('21 Eylül');
  await expect(page.locator('[data-action="guard-mark"]')).toHaveCount(0);
  await expect(page.locator('#guard-col-inside .guard-btn.in.done').first()).toContainText('Giriş');
  // Çıkanlar ve rapor açılır; çıkan aracın bilgisi paylaşılabilir
  await page.locator('[data-action="guard-tab"][data-k="out"]').click();
  await expect(page.locator('.guard-card')).toHaveCount(1);
  await expect(page.locator('.guard-card [data-action="guard-card-wa"]')).toBeVisible();
  await expect(page.locator('[data-action="guard-mark"]')).toHaveCount(0);
  await page.locator('[data-action="guard-tab"][data-k="rep"]').click();
  await expect(page.locator('.gd-group').first()).toBeVisible();
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'guard_mark').length)).toBe(0);
  expect(problems).toEqual([]);
});

test('güvenlik linki geçersizse ekran açılmaz', async ({ page }) => {
  const problems = await openApp(page, { session: false, guardToken: 'g1' }, '/?guvenlik=eski-anahtar');
  await expect(page.locator('.guard-fatal')).toContainText('geçersiz');
  await expect(page.locator('.guard-btn')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('ayarlar: güvenlik linki gösterilir ve yenilenir', async ({ page }) => {
  const problems = await openApp(page, { guardToken: 'g1' });
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="guard"]').click();
  await page.locator('[data-action="glink-show"]').click();
  await expect(page.locator('#guard-link')).toHaveValue(/\?guvenlik=g1$/);
  page.once('dialog', d => d.accept());
  await page.locator('[data-action="glink-rotate"]').click();
  await expect(page.locator('#toast')).toContainText('Yeni güvenlik linki');
  await expect(page.locator('#guard-link')).toHaveValue(/\?guvenlik=yeni\d+$/);
  // İzleme linki ayrı: gösterilir, yenilenir; güvenlik linki değişmez
  const guardValue = await page.locator('#guard-link').inputValue();
  await page.locator('[data-action="gvlink-show"]').click();
  await expect(page.locator('#guard-view-link')).toHaveValue(/\?guvenlik-izle=izle\d+$/);
  const firstView = await page.locator('#guard-view-link').inputValue();
  page.once('dialog', d => d.accept());
  await page.locator('[data-action="gvlink-rotate"]').click();
  await expect(page.locator('#toast')).toContainText('Yeni izleme linki');
  await expect(page.locator('#guard-view-link')).not.toHaveValue(firstView);
  await expect(page.locator('#guard-link')).toHaveValue(guardValue);
  expect(problems).toEqual([]);
});

test('güvenlik hesabı: giriş yapınca yalnızca güvenlik ekranı açılır, GİRİŞ yapar, ofis verisi hiç çekilmez', async ({ page }) => {
  const problems = await openApp(page, { guardAccount: { name: 'Tepecik', active: true } });
  await expect(page.locator('.guard')).toBeVisible();
  await expect(page.locator('.saha-brand small')).toHaveText(/Güvenlik · Tepecik/i);
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.locator('.guard-view-pill')).toHaveCount(0);
  const card = () => page.locator('.guard-card', { hasText: 'CB 1234 AB' });
  await card().locator('[data-k="giris"]').click();
  await expect(page.locator('#toast')).toContainText('giriş yaptı, tesiste');
  await expect(page.locator('#guard-col-inside .guard-card', { hasText: 'CB 1234 AB' })).toBeVisible();
  const calls = await page.evaluate(() => window.__calls);
  expect(calls.find(c => c.rpc === 'guard_mark').params.p_token).toBeNull();
  expect(calls.filter(c => c.table).length).toBe(0); // registry / visits / app_settings tablolarına hiç gidilmez
  // 15 sn'lik yoklama da ofis verisini çekmez
  await page.clock.runFor(31000);
  expect(await page.evaluate(() => window.__calls.filter(c => c.table).length)).toBe(0);
  // Çıkış düğmesi oturumu kapatıp sayfayı yeniler
  await Promise.all([page.waitForEvent('framenavigated'), page.locator('[data-action="guard-signout"]').first().click()]);
  expect(problems).toEqual([]);
});

for (const [err, text] of [[{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'E-posta ya da şifre hatalı'],
                           [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'Auto Confirm User']]) {
  test(`giriş hatası Türkçe ve ne yapılacağını söyler (${err.code})`, async ({ page }) => {
    const problems = await openApp(page, { session: false, authError: err });
    await page.locator('#email').fill('guv@ornek.com');
    await page.locator('#password').fill('12345678');
    await page.getByRole('button', { name: 'Giriş yap' }).click();
    await expect(page.locator('#auth-message')).toContainText(text);
    expect(problems).toEqual([]);
  });
}

test('güvenlik hesabı: sunucu reddederse sebep ve ofiste yapılacak yazılır', async ({ page }) => {
  const problems = await openApp(page, { guardAccount: { name: 'Tepecik', active: true } });
  await expect(page.locator('.guard-card').first()).toBeVisible(); // önce hesapla ekran açılsın
  await page.evaluate(() => { window.__PCS_STUB.guardAccount.active = false; }); // ofis erişimi durdurdu
  await page.clock.runFor(11000);
  await expect(page.locator('.guard-fatal')).toContainText('erişimi yok');
  await expect(page.locator('.guard-fatal-help')).toContainText('Güvenlik hesapları');
  await expect(page.locator('.guard-fatal-help small')).toContainText('erişimi durdurulmuş');
  expect(problems).toEqual([]);
});

test('güvenlik hesabı: veritabanında eski güvenlik fonksiyonu duruyorsa SQL dosyasının yeniden çalıştırılması istenir', async ({ page }) => {
  const problems = await openApp(page, { guardAccount: { name: 'Tepecik', active: true }, guardOldBoard: true });
  await expect(page.locator('.guard-fatal')).toContainText('Veritabanı kurulumu tamamlanmamış');
  await expect(page.locator('.guard-fatal-help')).toContainText('guvenlik-kurulumu.sql');
  await expect(page.locator('.guard-fatal-help small')).toContainText('Güvenlik linki geçersiz');
  expect(problems).toEqual([]);
});

test('güvenlik hesabı kapatılmışsa ekran açılmaz, çıkış yapılabilir', async ({ page }) => {
  const problems = await openApp(page, { guardAccount: { name: 'Tepecik', active: false } });
  await expect(page.locator('.guard-fatal')).toContainText('ofis tarafından durdurulmuş');
  await expect(page.locator('.guard-fatal')).toContainText('Erişimi aç');
  await expect(page.locator('.guard-fatal [data-action="guard-signout"]')).toBeVisible();
  await expect(page.locator('.guard-card')).toHaveCount(0);
  expect(await page.evaluate(() => window.__calls.filter(c => c.table).length)).toBe(0);
  expect(problems).toEqual([]);
});

test('ayarlar: güvenlik hesabı eklenir, kapatılır, açılır ve silinir', async ({ page }) => {
  const problems = await openApp(page);
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="guard"]').click();
  const panel = page.locator('[data-panel="guardacct"]');
  await expect(panel).toContainText('Henüz güvenlik hesabı yok');
  // kendi hesabı eklenemez
  await page.locator('#gacc-email').fill('test@ornek.com');
  await page.locator('[data-action="gacc-add"]').click();
  await expect(page.locator('#toast')).toContainText('Kendi hesabınızı');
  // yeni hesap: onay sorulur
  await page.locator('#gacc-email').fill('Guv.Kapi@Ornek.com');
  await page.locator('#gacc-name').fill('Tepecik');
  page.once('dialog', d => { expect(d.message()).toContain('yalnızca güvenlik ekranını'); d.accept(); });
  await page.locator('[data-action="gacc-add"]').click();
  const row = panel.locator('.gacc-row', { hasText: 'guv.kapi@ornek.com' });
  await expect(row).toContainText('Tepecik');
  await expect(row.locator('.gacc-st')).toHaveText(/kullanıcı yok/i);
  const saved = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'save_guard_account').at(-1).params);
  expect(saved).toEqual({ p_email: 'guv.kapi@ornek.com', p_name: 'Tepecik', p_active: true });
  // kapat -> aç
  page.once('dialog', d => d.accept());
  await row.locator('[data-action="gacc-off"]').click();
  await expect(row.locator('.gacc-st')).toHaveText(/erişim durduruldu/i);
  await row.locator('[data-action="gacc-on"]').click();
  await expect(row.locator('.gacc-st')).toHaveText(/kullanıcı yok/i);
  // Supabase'de kullanıcısı olmayan hesap silinebilir
  page.once('dialog', d => d.accept());
  await row.locator('[data-action="gacc-del"]').click();
  await expect(panel).toContainText('Henüz güvenlik hesabı yok');
  expect(problems).toEqual([]);
});

test('ayarlar: Supabase kullanıcısı olan güvenlik hesabı silinemez, yalnızca kapatılır', async ({ page }) => {
  const problems = await openApp(page, { guardAccounts: [{ email: 'guv@ornek.com', name: 'Kapı', active: true, has_user: true, last_sign_in_at: '2026-09-23T06:30:00Z' }] });
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="guard"]').click();
  const row = page.locator('.gacc-row', { hasText: 'guv@ornek.com' });
  await expect(row.locator('.gacc-st')).toHaveText(/açık · son giriş/i);
  await expect(row.locator('[data-action="gacc-del"]')).toHaveCount(0);
  await expect(row.locator('[data-action="gacc-off"]')).toBeVisible();
  expect(problems).toEqual([]);
});

test('ayarlar: güvenlik hesapları görüntüleyiciye görünmez', async ({ page }) => {
  const problems = await openApp(page, { role: 'viewer' });
  await page.locator('.nav-item[data-page="settings"]').click();
  await expect(page.locator('[data-stab="guard"]')).toHaveCount(0);
  await expect(page.locator('[data-panel="guardacct"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'list_guard_accounts').length)).toBe(0);
  expect(problems).toEqual([]);
});

test('ayarlar: otomatik günlük rapor alıcıları kaydedilir, anahtar gösterilir ve yenilenir', async ({ page }) => {
  const problems = await openApp(page, { report: { enabled: false, recipients: [], token: 'rapor1', last_run_at: '2026-09-22T20:59:30Z', last_ok: true, last_note: '22.09.2026: 2 alıcıya gönderildi · 7 araç.' } });
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="report"]').click();
  const panel = page.locator('[data-panel="report"]');
  await expect(panel.locator('.rep-last.ok')).toContainText('2 alıcıya gönderildi');
  await expect(panel).toContainText('23:00');
  // geçersiz adres ve boş liste reddedilir
  await page.locator('#rep-enabled').check();
  await page.locator('[data-action="rep-save"]').click();
  await expect(page.locator('#toast')).toContainText('en az bir alıcı');
  await page.locator('#rep-to').fill('evren@ornek.com\nyanlis-adres');
  await page.locator('[data-action="rep-save"]').click();
  await expect(page.locator('#toast')).toContainText('Geçersiz e-posta: yanlis-adres');
  // kaydet: boşluk/virgülle ayrılmış adresler, küçük harf
  await page.locator('#rep-to').fill('Evren@Ornek.com, ofis@ornek.com\n\n');
  await page.locator('[data-action="rep-save"]').click();
  await expect(page.locator('#toast')).toContainText('2 alıcıya gidecek');
  const saved = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'save_report_settings').at(-1).params);
  expect(saved).toEqual({ p_enabled: true, p_recipients: ['evren@ornek.com', 'ofis@ornek.com'] });
  await expect(page.locator('#rep-to')).toHaveValue('evren@ornek.com\nofis@ornek.com');
  // anahtar: gizli, göster, yenile
  await expect(page.locator('#rep-token')).toHaveAttribute('type', 'password');
  await page.locator('[data-action="rep-show"]').click();
  await expect(page.locator('#rep-token')).toHaveAttribute('type', 'text');
  await expect(page.locator('#rep-token')).toHaveValue('rapor1');
  page.once('dialog', d => d.accept());
  await page.locator('[data-action="rep-rotate"]').click();
  await expect(page.locator('#rep-token')).toHaveValue(/^rapor\d+$/);
  expect(problems).toEqual([]);
});

test('ayarlar: gece yedeği alıcıları kaydedilir; geçersiz adres, boş liste ve 5\'ten fazla adres reddedilir; kurulmamışsa SQL istenir', async ({ page, browser }) => {
  test.setTimeout(90000);
  const problems = await openApp(page, { report: { enabled: false, recipients: [], token: 'rapor1' }, backup: { enabled: false, recipients: [], last_at: '2026-09-23T23:30:20Z', last_ok: true, last_note: '24.09.2026: 1 alıcıya gönderildi · 120 plaka, 1.540 geliş.' } });
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="report"]').click();
  await expect(page.locator('.k-stab.on')).toContainText('Rapor ve yedek');
  const panel = page.locator('[data-panel="backup"]');
  await expect(panel).toContainText('Gece yedeği (e-posta)');
  await expect(panel).toContainText('02:30');
  await expect(panel.locator('.rep-last.ok')).toContainText('120 plaka, 1.540 geliş');
  // alıcısız açılamaz; geçersiz adres ve 6 adres reddedilir
  await page.locator('#bkp-enabled').check();
  await page.locator('[data-action="bkp-save"]').click();
  await expect(page.locator('#toast')).toContainText('en az bir alıcı');
  await page.locator('#bkp-to').fill('ofis@ornek.com\nyanlis');
  await page.locator('[data-action="bkp-save"]').click();
  await expect(page.locator('#toast')).toContainText('Geçersiz e-posta: yanlis');
  await page.locator('#bkp-to').fill('a@ornek.com b@ornek.com c@ornek.com d@ornek.com e@ornek.com f@ornek.com');
  await page.locator('[data-action="bkp-save"]').click();
  await expect(page.locator('#toast')).toContainText('en fazla 5 adrese');
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'save_backup_settings').length)).toBe(0);   // hiçbiri sunucuya gitmedi
  // kaydet
  await page.locator('#bkp-to').fill('Sahip@Ornek.com, ofis@ornek.com\n\n');
  await page.locator('[data-action="bkp-save"]').click();
  await expect(page.locator('#toast')).toContainText('2 alıcıya gidecek');
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'save_backup_settings').at(-1).params)).toEqual({ p_enabled: true, p_recipients: ['sahip@ornek.com', 'ofis@ornek.com'] });
  await expect(page.locator('#bkp-to')).toHaveValue('ofis@ornek.com\nsahip@ornek.com');
  // kapatınca alıcı gerekmez
  await page.locator('#bkp-enabled').uncheck();
  await page.locator('[data-action="bkp-save"]').click();
  await expect(page.locator('#toast')).toContainText('gece yedeği kapalı');
  expect(problems).toEqual([]);
  // kurulmamış: SQL istenir, günlük rapor ayarı etkilenmez
  const page2 = await browser.newPage();
  await openApp(page2, { missing: ['backup'], report: { enabled: false, recipients: [], token: 'rapor1' } });
  await page2.locator('.nav-item[data-page="settings"]').click();
  await page2.locator('[data-stab="report"]').click();
  await expect(page2.locator('[data-panel="backup"]')).toContainText('gece-yedegi-kurulumu.sql');
  await expect(page2.locator('[data-panel="report"] #rep-token')).toHaveCount(1);
  await page2.close();
});

test('ayarlar: günlük rapor kurulmamışsa SQL dosyası istenir; görüntüleyiciye bölüm görünmez', async ({ page, browser }) => {
  const problems = await openApp(page, { missing: ['report'] });
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="report"]').click();
  await expect(page.locator('[data-panel="report"] .notice')).toContainText('gunluk-rapor-kurulumu.sql');
  await expect(page.locator('[data-panel="report"] .rep-setup')).toHaveAttribute('open', '');
  expect(problems).toEqual([]);
  const viewer = await browser.newPage();
  await openApp(viewer, { role: 'viewer' });
  await viewer.locator('.nav-item[data-page="settings"]').click();
  await expect(viewer.locator('[data-stab="report"]')).toHaveCount(0);
  expect(await viewer.evaluate(() => window.__calls.filter(c => c.rpc === 'get_report_settings').length)).toBe(0);
  await viewer.close();
});

test('çıkış saati panoda, raporda ve formda işlemler bitti saatinden ayrı görünür', async ({ page }) => {
  const data = sampleData();
  // v5: 08:05 giriş, 09:10 işlemler bitti, 09:30 güvenlik çıkışı (İstanbul saati)
  Object.assign(data.visits[4], { done: true, done_at: '2026-09-23T06:10:00Z', exit_at: '2026-09-23T06:30:00Z' });
  await page.setViewportSize({ width: 1600, height: 1000 }); // yan panel geniş ekranda görünür
  const problems = await openApp(page, { data });
  await expect(page.locator('tr[data-row-id="v5"] .exit-badge')).toHaveText(/Çıktı 09:30/i);
  await page.locator('tr[data-row-id="v5"] .plate-button').click();
  await page.locator('.side-card [data-action="gate-report"][data-id="v5"]').click();
  await expect(page.locator('.gate-stat.in b')).toHaveText('23.09.2026  08:05');
  await expect(page.locator('.gate-stat.done b')).toHaveText('23.09.2026  09:10');
  await expect(page.locator('.gate-stat.out b')).toHaveText('23.09.2026  09:30');
  await expect(page.locator('.gate-pre')).toContainText('TESİS ÇIKIŞ TARİH SAAT : 23.09.2026  09:30');
  await page.locator('[data-action="close-modal"]').last().click();
  await page.locator('.side-card [data-action="edit-visit"]').click();
  await expect(page.locator('#visit-form [name="exit_at"]')).toHaveValue('2026-09-23T09:30');
  await expect(page.locator('#visit-form [name="done_at"]')).toHaveValue('2026-09-23T09:10');
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

  test('gizlilik sayfası açılır ve panonun çevrimdışı kopyasının yerine geçmez', async ({ page, context }) => {
    await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
    await page.addInitScript(() => { window.__PCS_STUB = { session: false }; });
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto('/gizlilik.html');
    await expect(page.getByRole('heading', { name: 'Gizlilik Politikası', exact: true })).toBeVisible();
    await expect(page.locator('#veri-silme')).toBeVisible();
    await expect(page.locator('#data-deletion')).toContainText('pcstr.atakan@gmail.com');
    // Önbellekteki pano kopyası hâlâ panonun kendisi olmalı (gizlilik sayfası üzerine yazılmamalı)
    await page.waitForTimeout(300);
    const shell = await page.evaluate(() => caches.open('pcs-shell-v1').then(c => c.match('./')).then(r => r ? r.text() : ''));
    expect(shell).toContain('id="app"');
    expect(shell).not.toContain('Gizlilik Politikası');
    await context.setOffline(true);
    await page.goto('/');
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

test('kart çerçeveleri: renkli geçişli varsayılan, Sade ile düz çizgi, gece modunda da geçerli', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  const st = loc => loc.evaluate(el => { const c = getComputedStyle(el); return { bw: c.borderTopWidth, bc: c.borderTopColor, bi: c.backgroundImage }; });
  const look = () => page.evaluate(() => document.documentElement.dataset.frameLook);
  expect(await look()).toBe('gecis');
  const day = page.locator('.day-block').first();
  let d = await st(day);
  expect([d.bw, d.bc]).toEqual(['2px', 'rgba(0, 0, 0, 0)']);
  expect(d.bi).toContain('linear-gradient');
  // kendi renkli zemini olan kontrol kartı da çerçeveli, zemini korunur
  const ctl = await st(page.locator('.k-card.k-ctl'));
  expect(ctl.bc).toBe('rgba(0, 0, 0, 0)');
  expect(ctl.bi).toContain('radial-gradient');
  // ayarlar > görünüm: Sade seçilince düz ince çizgi
  await page.locator('.nav-item[data-page="settings"]').click();
  const seg = page.locator('[data-sk="frameLook"]');
  await expect(seg.locator('[data-v="gecis"]')).toHaveAttribute('aria-pressed', 'true');
  await seg.locator('[data-v="sade"]').click();
  expect(await look()).toBe('sade');
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  d = await st(page.locator('.day-block').first());
  expect(d.bw).toBe('1px');
  expect(d.bi).toBe('none');
  // geri aç, gece modunda da çerçeve geçişli
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-sk="frameLook"] [data-v="gecis"]').click();
  await page.locator('[data-sk="theme"] [data-v="dark"]').click();
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  d = await st(page.locator('.day-block').first());
  expect([d.bw, d.bc]).toEqual(['2px', 'rgba(0, 0, 0, 0)']);
  expect(d.bi).toContain('linear-gradient');
  expect(problems).toEqual([]);
});

test('sohbet: doğal cümleler yerelde anlaşılır (dorse plakası, "işaretle", olumsuz, birden fazla araç, sıra numarası, soru); yapay zekâ çağrılmaz', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  data.visits.find(v => v.id === 'v6').plate = 'CB 1234 AB - CT 29 BWT';          // çekici + dorse
  const problems = await openApp(page, { data, aiText: chatAi({}) });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel'), last = panel.locator('.chat-msg.ai').last();
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  const v = id => page.evaluate(i => window.__db.visits.find(x => x.id === i), id);
  await say('CT 29 BWT dorse plakalı aracı T1 yazıldı işaretle');
  await expect(last).toContainText('CB 1234 AB - CT 29 BWT · T1 yazıldı: hayır → evet');
  expect(await v('v6')).toMatchObject({ t1: true, onsite: false });
  await say('çekici CB 1234 AB tesise girdi lütfen');
  await expect(last).toContainText('Tesiste: hayır → evet');
  await say('CT 29 BWT tesiste değil');
  await expect(last).toContainText('Tesiste: evet → hayır');
  expect(await v('v6')).toMatchObject({ onsite: false, t1: true });
  await say('CT 29 BWT T1 yazılmadı');
  await expect(last).toContainText('T1 yazıldı: evet → hayır');
  await say('34 ABC 123 ve CT 29 BWT bitti');                                       // iki ayrı araç
  await expect(panel.locator('.chat-msg.ai').last().locator('.rs-note')).toHaveCount(2);
  expect(await v('v5')).toMatchObject({ done: true });
  expect(await v('v6')).toMatchObject({ done: true });
  await say('2. sıradaki aracı T1 yazıldı yap');                                    // sıra numarası: panodaki 2. satır (34 ABC 123)
  await expect(last).toContainText('34 ABC 123 · T1 yazıldı: hayır → evet');
  await say('CT 29 BWT tesiste mi');                                                // soru: aracın durumu gösterilir, yazılmaz
  await expect(panel.locator('.chat-row').last()).toContainText('TORNADO');
  await say('raporlara git');                                                       // sayfa gezinme
  await expect(last).toContainText('Raporlar sayfasını açtım.');
  await expect(page.locator('.nav-item.active')).toContainText('Raporlar');
  await say('lütfen ayarları aç');
  await expect(page.locator('.nav-item.active')).toContainText('Ayarlar');
  await say('panoya git');
  await expect(page.locator('.nav-item.active')).toContainText('Pano');
  const writes = await page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && ['insert', 'update', 'delete'].includes(c.op)).length);
  expect(writes).toBe(7);                                                          // 7 değişiklik; soru yazmadı
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length)).toBe(0);
  expect(problems).toEqual([]);
});

test('sohbet: yapay zekâ cevap veremezse metinden anlaşılan komut önerilir, teknik ayrıntı gösterilir; yapay zekâya pano özeti gönderilir', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  data.visits.find(v => v.id === 'v6').plate = 'CB 1234 AB - CT 29 BWT';
  const aiText = { status: 502, body: { fatal: true, reason: 'Gemini bu içeriği kabul etmedi', detail: '{"error":{"code":400,"message":"Invalid JSON payload received. Unknown name enum"}}' } };
  const problems = await openApp(page, { data, aiText });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  await say('hocam acaba CT 29 BWT dorse plakalı aracı T1 yazıldı olarak işaretler misin');   // bilinmeyen sözcükler: yerelde kesin anlaşılmaz
  const chip = panel.locator('.chat-chip[data-action="chat-say"]');
  await expect(chip).toHaveText('CT 29 BWT T1 yazıldı');
  await expect(panel).toContainText('Yapay zekâya ulaşamadım (Gemini bu içeriği kabul etmedi). Şunu mu demek istediniz?');
  await panel.locator('.chat-det summary').click();
  await expect(panel.locator('.chat-det code')).toHaveText('Invalid JSON payload received. Unknown name enum');
  // gönderilen istekte panonun o günkü özeti var
  const sent = await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').map(c => c.text));
  expect(sent).toHaveLength(1);
  expect(sent[0].context).toContain('BOARD DAY 2026-09-23');
  expect(sent[0].context).toContain('1. B 123 XYZ | LİN LOJ | Tesiste · T1');
  expect(sent[0].context).toContain('2. 34 ABC 123 | BULTRANS | Tesiste');
  expect(sent[0].context).toContain('3. CB 1234 AB - CT 29 BWT | TORNADO | Gelecek');
  expect(sent[0].context).toMatch(/CUSTOMERS: .*BULTRANS/);
  // öneriye tıklanınca yerelde uygulanır
  await chip.click();
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('CB 1234 AB - CT 29 BWT · T1 yazıldı: hayır → evet');
  expect((await page.evaluate(() => window.__db.visits.find(x => x.id === 'v6'))).t1).toBe(true);
  expect(problems.filter(x => !/50[0-9]|ruhsat-oku/.test(x))).toEqual([]);
});

test('sohbet: "sıralamayı biten, tesiste, T1 olarak düzenle" durum sıralamasını kaydeder ve elle ayarlı günü otomatiğe döndürür; Geri al düğmesi ve "geri al" eski haline getirir', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  const mk = (id, plate, time, extra, so) => ({ id, plate, customer: 'BULTRANS', declaration: '', carrier: '', registration: '', visit_date: '2026-09-23', visit_time: time, note: '', onsite: false, t1: false, done: false,
    created_at: '2026-09-21T05:00:00Z', updated_at: '2026-09-21T06:00:00Z', onsite_at: null, done_at: null, sort_order: so, ...extra });
  data.visits = [
    mk('a', 'AA 1111 AA', '08:00', { onsite: true, t1: true, done: true }, 3),
    mk('b', 'BB 2222 BB', '08:10', { t1: true }, 0),                    // yalnızca T1
    mk('c', 'CC 3333 CC', '08:20', { onsite: true }, 1),                // yalnızca tesiste
    mk('d', 'DD 4444 DD', '08:30', {}, 2)                               // gelecek
  ];
  const problems = await openApp(page, { data, aiText: chatAi({}) });
  const order = () => page.locator('table.operations tbody tr[data-row-id]').evaluateAll(rows => rows.map(r => r.dataset.rowId));
  await expect.poll(order).toEqual(['b', 'c', 'd', 'a']);              // elle ayarlı sıra (sort_order)
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel'), last = panel.locator('.chat-msg.ai').last();
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  // kullanıcının yazdığı gibi: çok satırlı, numaralı liste
  await page.locator('#chat-input').fill('Sıralamayı düzenleyebilir misin ?\n1. İşlemleri biten\n2. Sıra tesiste olan araçlar\n3. Sıra T1 işaretli olan araçlar');
  await page.locator('#chat-input').press('Enter');
  await expect(last).toContainText('Sıralamayı düzenledim: 1. Biten · 2. Tesiste · 3. T1 işaretli · 4. Gelecek / diğer');
  await expect(last).toContainText('elle ayarlanmış sıra olan gün otomatiğe döndü');
  await expect.poll(order).toEqual(['a', 'c', 'b', 'd']);              // biten, tesiste, T1, diğer
  expect(await page.evaluate(() => window.__db.visits.map(v => v.sort_order))).toEqual([null, null, null, null]);
  expect(await page.evaluate(() => window.__db.app_settings.find(s => s.key === 'appearance').value.statusOrder)).toBe('done,onsite,t1');
  expect(await page.evaluate(() => window.__calls.filter(c => c.fn === 'ruhsat-oku').length)).toBe(0);   // yerelde anlaşıldı
  // ayar Ayarlar > Yerleşim'de görünür
  await page.locator('.nav-item[data-page="settings"]').click();
  await page.locator('[data-stab="layout"]').click();
  await expect(page.locator('[data-sk="statusOrder"] [data-v="done,onsite,t1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.nav-item[data-page="pano"]').click();
  await expect.poll(order).toEqual(['a', 'c', 'b', 'd']);
  // Geri al düğmesi: eski ayar ve elle sıra döner
  await panel.locator('[data-action="chat-undo"]').click();
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('Sıralamayı geri aldım');
  await expect.poll(order).toEqual(['b', 'c', 'd', 'a']);
  expect(await page.evaluate(() => window.__db.app_settings.find(s => s.key === 'appearance').value.statusOrder)).toBe('');
  // başka bir sıra, sonra yazıyla geri al
  await say('sırala: tesiste, T1, biten');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('1. Tesiste · 2. T1 işaretli · 3. Biten · 4. Gelecek / diğer');
  await expect.poll(order).toEqual(['c', 'b', 'a', 'd']);
  await say('geri al');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('Sıralamayı geri aldım');
  await expect.poll(order).toEqual(['b', 'c', 'd', 'a']);
  await say('geri al');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('Geri alınacak bir işlem yok.');
  // sıfırlama
  await say('sıralamayı varsayılana döndür');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('varsayılana döndü');
  expect(problems).toEqual([]);
});

test('sohbet: kayıt düzeltme "Geri al" ile eski değerine döner; araya başkası değiştirmişse dokunulmaz', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const problems = await openApp(page, { aiText: chatAi({}) });
  await expect(page.locator('#app')).toContainText('34 ABC 123');
  await page.locator('#chat-fab').click();
  const panel = page.locator('#chat-panel');
  const say = async t => { await page.locator('#chat-input').fill(t); await page.locator('#chat-input').press('Enter'); };
  const v = () => page.evaluate(() => window.__db.visits.find(x => x.id === 'v6'));
  await say('CB 1234 AB tesiste');
  await expect(panel).toContainText('Tesiste: hayır → evet');
  expect((await v()).onsite).toBe(true);
  await panel.locator('[data-action="chat-undo"]').click();
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('Tesiste: evet → hayır');
  expect((await v()).onsite).toBe(false);
  await expect(panel.locator('[data-action="chat-undo"]')).toHaveCount(0);        // kullanılan düğme kalkar
  // eski bir değişikliği geri alırken araya başka değişiklik girmişse o alana dokunulmaz
  await say('CB 1234 AB t1 yazıldı');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('T1 yazıldı: hayır → evet');
  await say('CB 1234 AB T1 yazılmadı');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('T1 yazıldı: evet → hayır');
  await expect(panel.locator('[data-action="chat-undo"]')).toHaveCount(2);
  await panel.locator('[data-action="chat-undo"]').first().click();
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('bu arada değişmiş, dokunmadım');
  expect((await v()).t1).toBe(false);
  // yazıyla geri al: en son işlem geri alınır
  await say('lütfen son işlemi geri al');
  await expect(panel.locator('.chat-msg.ai').last()).toContainText('T1 yazıldı: hayır → evet');
  expect((await v()).t1).toBe(true);
  expect(problems).toEqual([]);
});

test('pano: elle sıra varken yeni eklenen araç müşterisinin grubuna girer (müşteri başlığı ikinci kez açılmaz); gece modunda satır parlaması koyu zemine uygundur', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const data = sampleData();
  const mk = (id, plate, customer, so, extra = {}) => ({ id, plate, customer, declaration: '', carrier: '', registration: '', visit_date: '2026-09-23', visit_time: '08:00', note: '', onsite: false, t1: false, done: false,
    created_at: '2026-09-21T05:00:00Z', updated_at: '2026-09-21T06:00:00Z', onsite_at: null, done_at: null, sort_order: so, ...extra });
  data.visits = [
    mk('a', 'AA 1111 AA', 'BULTRANS', 0), mk('b', 'BB 2222 BB', 'BULTRANS', 1), mk('c', 'CC 3333 CC', 'BULTRANS', 2),
    mk('t', 'TT 4444 TT', 'TORNADO', 3),
    mk('n', 'NN 5555 NN', 'BULTRANS', null, { created_at: '2026-09-23T06:00:00Z' }),    // yeni eklenen: sırası yok
    mk('z', 'ZZ 6666 ZZ', 'YENİ FİRMA', null, { created_at: '2026-09-23T06:05:00Z' })   // hiç elle sıralı aracı olmayan müşteri: sona
  ];
  const problems = await openApp(page, { data });
  const order = () => page.locator('table.operations tbody tr[data-row-id]').evaluateAll(rows => rows.map(r => r.dataset.rowId));
  await expect.poll(order).toEqual(['a', 'b', 'c', 'n', 't', 'z']);                      // n, BULTRANS grubunun sonunda
  await expect(page.locator('.block-head-name')).toHaveText(['BULTRANS', 'TORNADO', 'YENİ FİRMA']);
  await expect(page.locator('.block-head-count').first()).toHaveText('4 araç');
  // gece modunda parlama animasyonu koyu zemine uygun olanı kullanır
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.querySelector('.operations tbody tr[data-row-id]').classList.add('just-changed'); });
  expect(await page.locator('.operations tbody tr[data-row-id]').first().locator('td').nth(1).evaluate(td => getComputedStyle(td).animationName)).toBe('rowFlashDark');
  expect(problems).toEqual([]);
});

// ---- Mail (gumruk@ kutusundan okuyan betik incoming_messages'a WhatsApp ile aynı şemada yazar) ----
const mailRow = (id, from, extra = {}) => msgRow(id, [mi('add', '06KL4567', '', '2026-09-24')], {
  wa_message_id: 'mail:<' + id + '@bultrans.com.tr>', from_number: from, sender_name: 'Nurhan', body: 'X 7608 MA / X 1443 EM Gelen aracın bilgileri ekteki gibidir.',
  ai: { items: [mi('add', '06KL4567', '', '2026-09-24')], customer: '', problem: '', model: 'gemini-test', declarations: ['26BG05000VIB0IBAT8'] }, ...extra
});
const mailAi = (plate, extra = {}, date = '2026-09-24') => ({ items: [mi('add', plate, '', date)], customer: '', problem: '', model: 'g', ...extra });
const mailUi = async (page, data) => {
  const problems = await openApp(page, { data });
  await page.locator('.heading [data-action="ruhsat-open"]').click();
  return problems;
};
const visitInserts = page => page.evaluate(() => window.__calls.filter(c => c.table === 'visits' && c.op === 'insert').flatMap(c => c.rows));

test('Mail: satır "Mail" etiketiyle çıkar, adres "+" olmadan görünür, başlık karışık kaynağı belirtir; WhatsApp satırı değişmez; onaylamadan araç eklenmez', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [mailRow('ml1', 'nurhan@bultrans.com.tr'), msgRow('m1', [mi('add', 'CB1234AB', '', '2026-09-24')])];
  const problems = await mailUi(page, data);
  const mail = page.locator('.msg-card', { has: page.locator('.msg-mail-tag') });
  await expect(mail).toHaveCount(1);
  await expect(mail.locator('.rs-src')).toContainText('Mail · Nurhan · nurhan@bultrans.com.tr');
  await expect(mail.locator('.rs-src')).not.toContainText('+nurhan');
  await expect(page.locator('.rs-wa-head', { hasText: 'Gelen mesajlar (WhatsApp · Mail)' })).toContainText('siz onaylamadan');
  const wa = page.locator('#msg-m1');   // WhatsApp satırı eskisi gibi: "WhatsApp" etiketi ve +numara
  await expect(wa.locator('.rs-src')).toContainText('WhatsApp · Ali Şoför · +905321112233');
  await expect(wa.locator('.msg-mail-tag')).toHaveCount(0);
  await expect(mail).toContainText('Beyanname: 26BG05000VIB0IBAT8');   // ai.declarations kartta görünür
  expect(await page.evaluate(() => window.__calls.filter(c => ['visits', 'registry', 'incoming_messages'].includes(c.table) && ['insert', 'update', 'delete'].includes(c.op)).length)).toBe(0);
  expect(problems).toEqual([]);
});

test('Mail: yalnızca WhatsApp satırı varken başlık eskisi gibi "WhatsApp mesajları"', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [msgRow('m1', [mi('add', 'CB1234AB', '', '2026-09-24')])];
  const problems = await mailUi(page, data);
  await expect(page.locator('.rs-wa-head', { hasText: 'WhatsApp mesajları' })).toBeVisible();
  await expect(page.locator('.rs-wa-head', { hasText: 'Gelen mesajlar' })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('Mail: müşteri e-posta adresi ya da alan adından eşlenir; tam adres alan adından önceliklidir', async ({ page }) => {
  const data = sampleData();
  data.app_settings.push({ key: 'customer_contacts', value: { numbers: {}, templates: {}, emails: { 'BULTRANS': 'x@y.com, @bultrans.com.tr', 'ÖZEL LOJ': 'nurhan@bultrans.com.tr', 'ALAN LOJ': 'Firma.com' } }, updated_at: '2026-09-01T08:00:00Z' });
  data.incoming_messages = [
    mailRow('ml1', 'nurhan@bultrans.com.tr', { ai: mailAi('XX9999YY') }),
    mailRow('ml2', 'baska@bultrans.com.tr', { ai: mailAi('XX9998YY'), created_at: '2026-09-23T06:31:00Z' }),
    mailRow('ml3', 'biri@FIRMA.com', { ai: mailAi('XX9997YY'), created_at: '2026-09-23T06:32:00Z' }),
    mailRow('ml4', 'kimse@bilinmeyen.org', { ai: mailAi('XX9996YY'), created_at: '2026-09-23T06:33:00Z' })
  ];
  const problems = await mailUi(page, data);
  const cards = page.locator('.msg-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator('.rs-src b').last()).toHaveText('ÖZEL LOJ');   // tam adres
  await expect(cards.nth(1).locator('.rs-src b').last()).toHaveText('BULTRANS');    // @alanadi.com
  await expect(cards.nth(2).locator('.rs-src b').last()).toHaveText('ALAN LOJ');    // alanadi.com, büyük/küçük harf fark etmez
  await expect(cards.nth(3).locator('.rs-src b')).toHaveCount(1);                   // yalnızca "Mail" etiketi; müşteri bulunamadı
  expect((await visitInserts(page)).length).toBe(0);
  expect(problems).toEqual([]);
});

test('Mail: eski customer_contacts (emails yok; düz biçim dahil) sorunsuz çalışır, WhatsApp numara eşlemesi bozulmaz', async ({ page, browser }) => {
  const mk = value => {
    const data = sampleData();
    data.app_settings.push({ key: 'customer_contacts', value, updated_at: '2026-09-01T08:00:00Z' });
    data.incoming_messages = [mailRow('ml1', 'nurhan@bultrans.com.tr', { ai: mailAi('XX9999YY') }), msgRow('m1', [mi('add', 'XX9998YY', '', '2026-09-24')], { created_at: '2026-09-23T06:31:00Z' })];
    return data;
  };
  const problems = await mailUi(page, mk({ numbers: { 'ESKİ LOJ': '0532 111 22 33' } }));
  await expect(page.locator('.msg-card')).toHaveCount(2);
  await expect(page.locator('.msg-card', { has: page.locator('.msg-mail-tag') }).locator('.rs-src b')).toHaveCount(1);
  await expect(page.locator('#msg-m1 .rs-src')).toContainText('ESKİ LOJ');            // WhatsApp numarası hâlâ müşteriye eşlenir
  expect(problems).toEqual([]);
  const flat = await browser.newPage();   // düz (numbers anahtarsız) eski biçim
  const p2 = await mailUi(flat, mk({ 'ESKİ LOJ': '0532 111 22 33' }));
  await expect(flat.locator('.msg-card')).toHaveCount(2);
  await expect(flat.locator('#msg-m1 .rs-src')).toContainText('ESKİ LOJ');
  expect(p2).toEqual([]);
  await flat.close();
});

test('Mail: Ayarlar > WhatsApp bölümünde mail alanı kaydedilir; numaralar ve şablon korunur', async ({ page }) => {
  const data = sampleData();
  data.app_settings.push({ key: 'customer_contacts', value: { numbers: { 'ABC NAKLİYAT': '0532 111 22 33' } }, updated_at: '2026-09-01T08:00:00Z' });
  const problems = await openApp(page, { data });
  await page.locator('.nav-item', { hasText: 'Ayarlar' }).first().click();
  await page.locator('nav[aria-label="Ayar bölümleri"] button', { hasText: 'WhatsApp' }).click();
  await expect(page.locator('main')).toContainText('mail adresleri');
  await page.locator('.wa-mail[data-name="ABC NAKLİYAT"]').fill('a@abc.com, @abc.com.tr');
  await page.locator('[data-action="wa-contacts-save"]').click();
  await expect(page.locator('#toast')).toContainText('mail adresleri');
  const v = await page.evaluate(() => window.__db.app_settings.find(x => x.key === 'customer_contacts').value);
  expect(v.numbers).toEqual({ 'ABC NAKLİYAT': '0532 111 22 33' });
  expect(v.emails).toEqual({ 'ABC NAKLİYAT': 'a@abc.com, @abc.com.tr' });
  expect(typeof v.templates.single).toBe('string');
  expect(problems).toEqual([]);
});

test('Mail: tek beyanname araç kaydına yazılır, birden fazlaysa nota eklenir; mail satırında "Yeniden oku" yok', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [
    mailRow('ml1', 'nurhan@bultrans.com.tr'),
    mailRow('ml2', 'nurhan@bultrans.com.tr', { ai: mailAi('B123XYZ', { declarations: ['26BG0000000000AAA1', '26BG0000000000AAA2'] }, '2026-10-15'), created_at: '2026-09-23T06:31:00Z' }),
    mailRow('ml3', 'nurhan@bultrans.com.tr', { status: 'hata', ai: null, note: 'Yapay zekâ mesajı okuyamadı', created_at: '2026-09-23T06:32:00Z' })
  ];
  const problems = await mailUi(page, data);
  const cards = page.locator('.msg-card');
  await expect(cards.nth(0)).toContainText('Beyanname: 26BG05000VIB0IBAT8');
  await expect(cards.nth(1)).toContainText('26BG0000000000AAA1, 26BG0000000000AAA2');
  await expect(cards.nth(2).locator('[data-action="msg-reread"]')).toHaveCount(0);
  expect((await visitInserts(page)).length).toBe(0);                                  // onaydan önce hiçbir şey eklenmez
  await cards.nth(0).locator('[data-action="msg-apply"]').click();
  await expect.poll(async () => (await visitInserts(page)).map(v => [v.plate, v.declaration])).toEqual([['06 KL 4567', '26BG05000VIB0IBAT8']]);
  const second = page.locator('.msg-card', { hasText: '26BG0000000000AAA1' });
  await second.locator('[data-action="msg-apply"]').first().click();
  await expect.poll(async () => (await visitInserts(page)).length).toBe(2);
  const last = (await visitInserts(page)).pop();
  expect(last.declaration).toBe('');
  expect(last.note).toContain('Beyanname: 26BG0000000000AAA1, 26BG0000000000AAA2');
  expect(problems).toEqual([]);
});

// ---- Mail: tesise gelecek / gelmeyecek (beyanname 30. kutu) ----
const facItem = (tractor, facility, extra = {}) => mi('add', tractor, '', '2026-10-15', { facility, ...extra });
const facRow = (id, items, extra = {}) => mailRow(id, 'nurhan@bultrans.com.tr', { ai: { items, customer: '', problem: '', model: 'g', declarations: [], facility_codes: ['Z34089'] }, ...extra });

test('Mail tesis: "gelmeyecek" araçlar kapalı ayrı bölümde; "belirsiz" uyarılı; tek uygun araç varken toplu düğme çıkmaz', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [facRow('f1', [facItem('06KL4567', 'gelecek'), facItem('B123XYZ', 'belirsiz'), facItem('XX9999YY', 'gelmeyecek', { facility_note: '30. kutu: boş' }), facItem('34ABC123', 'gelmeyecek', { facility_note: '30. kutu: Z99999' })])];
  const problems = await mailUi(page, data);
  const card = page.locator('#msg-f1'), nc = card.locator('details.msg-nocome');
  await expect(nc).toHaveCount(1);
  await expect(nc).toContainText('Tesise gelmeyecek (2)');
  expect(await nc.evaluate(d => d.open)).toBe(false);                       // varsayılan kapalı
  await expect(card.locator('.msg-item')).toHaveCount(4);
  await expect(card.locator('.msg-item').nth(1)).toContainText('Beyanname görülmedi, tesis kodunu kontrol edin');
  await expect(nc.locator('.msg-item').first()).toContainText('30. kutu: boş');
  await expect(card.locator('[data-action="msg-all"]')).toHaveCount(0);
  expect((await visitInserts(page)).length).toBe(0);
  expect(problems).toEqual([]);
});

test('Mail tesis: Hepsini uygula "gelmeyecek" ve "belirsiz" araçları işlemez', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [facRow('f2', [facItem('06KL4567', 'gelecek'), facItem('B123XYZ', 'gelecek'), facItem('34ABC123', 'belirsiz'), facItem('CB1234AB', 'gelmeyecek')])];
  const problems = await mailUi(page, data);
  const card = page.locator('#msg-f2');
  await expect(card.locator('[data-action="msg-all"]')).toHaveText('Hepsini uygula (2)');
  page.on('dialog', d => d.accept());
  await card.locator('[data-action="msg-all"]').click();
  await expect.poll(async () => (await visitInserts(page)).map(v => v.plate).sort()).toEqual(['06 KL 4567', 'B 123 XYZ']);
  expect(problems).toEqual([]);
});

test('Mail tesis: gelmeyecek bölümündeki araç "Panoya ekle" ile tek tek eklenir; WhatsApp satırında facility alanı yok sayılır', async ({ page }) => {
  const data = sampleData();
  data.incoming_messages = [facRow('f3', [facItem('06KL4567', 'gelmeyecek', { facility_note: '30. kutu: boş' })]), msgRow('m1', [facItem('B123XYZ', 'gelmeyecek')], { created_at: '2026-09-23T06:31:00Z' })];
  const problems = await mailUi(page, data);
  await expect(page.locator('#msg-m1 details.msg-nocome')).toHaveCount(0);   // WhatsApp: eskisi gibi normal
  await expect(page.locator('#msg-m1 .msg-item')).toHaveCount(1);
  const nc = page.locator('#msg-f3 details.msg-nocome');
  await nc.locator('summary').click();
  expect((await visitInserts(page)).length).toBe(0);
  await nc.locator('[data-action="msg-apply"]').click();
  await expect.poll(async () => (await visitInserts(page)).map(v => v.plate)).toEqual(['06 KL 4567']);
  expect(problems).toEqual([]);
});

test('Mail tesis: müşteri "genelde tesise gelir" kapalıysa belirsiz araç gelmeyecek bölümüne düşer', async ({ page }) => {
  const data = sampleData();
  data.app_settings.push({ key: 'customer_contacts', value: { numbers: {}, emails: { 'ABC NAKLİYAT': 'nurhan@bultrans.com.tr' }, comes: { 'ABC NAKLİYAT': false } }, updated_at: '2026-09-01T08:00:00Z' });
  data.incoming_messages = [facRow('f4', [facItem('06KL4567', 'belirsiz')])];
  const problems = await mailUi(page, data);
  await expect(page.locator('#msg-f4 details.msg-nocome')).toContainText('Tesise gelmeyecek (1)');
  expect(problems).toEqual([]);
});

test('Mail tesis: Ayarlar\'da tesis kodları ve "genelde tesise gelir" kaydedilir; boş kod varsayılana döner; eski kayıtlar korunur', async ({ page }) => {
  const data = sampleData();
  data.app_settings.push({ key: 'customer_contacts', value: { numbers: { 'ABC NAKLİYAT': '0532 111 22 33' }, emails: { 'ABC NAKLİYAT': 'a@abc.com' } }, updated_at: '2026-09-01T08:00:00Z' });
  const problems = await openApp(page, { data });
  await page.locator('.nav-item', { hasText: 'Ayarlar' }).first().click();
  await page.locator('nav[aria-label="Ayar bölümleri"] button', { hasText: 'WhatsApp' }).click();
  await expect(page.locator('#wa-fac')).toHaveValue('Z34089');                        // eski kayıt: varsayılan
  await expect(page.locator('.wa-comes[data-name="ABC NAKLİYAT"]')).toBeChecked();   // varsayılan açık
  await page.locator('#wa-fac').fill('z34089, Z11111');
  await page.locator('.wa-comes[data-name="ABC NAKLİYAT"]').uncheck();
  await page.locator('[data-action="wa-contacts-save"]').click();
  await expect(page.locator('#toast')).toContainText('kaydedildi');
  const val = () => page.evaluate(() => window.__db.app_settings.find(x => x.key === 'customer_contacts').value);
  const v = await val();
  expect(v.facility_codes).toEqual(['Z34089', 'Z11111']);
  expect(v.comes).toEqual({ 'ABC NAKLİYAT': false });
  expect(v.numbers).toEqual({ 'ABC NAKLİYAT': '0532 111 22 33' });
  expect(v.emails).toEqual({ 'ABC NAKLİYAT': 'a@abc.com' });
  await page.locator('#wa-fac').fill('');
  await page.locator('[data-action="wa-contacts-save"]').click();
  await expect.poll(async () => (await val()).facility_codes).toEqual(['Z34089']);
  expect(problems).toEqual([]);
});

test('canlı saha: bant kısa/açık olur, 3B çerçeve bugünün kayıtlarını alır, tıra tıklayınca araç seçilir', async ({ page }) => {
  const problems = await openApp(page, { heroMini: true });
  // karşılama bandı varsayılan olarak ince çubuk; düğmeyle açılır ve kapanır
  await expect(page.locator('.k-pinwrap.k-mini .k-pinbar')).toBeVisible();
  await expect(page.locator('.heading.k-hero')).toHaveCount(0);
  await page.locator('.k-mini [data-action="k-hero-mini"]').click();
  await expect(page.locator('.heading.k-hero')).toBeVisible();
  await page.locator('.heading.k-hero [data-action="k-hero-mini"]').click();
  await expect(page.locator('.k-pinwrap.k-mini')).toBeVisible();
  // canlı saha bölümü genel bakışın hemen altında; otomasyon tarayıcısında varsayılan kapalı, "Göster" ile açılır
  const order = await page.evaluate(() => [...document.querySelectorAll('.k-panel')].map(s => s.getAttribute('aria-label')));
  expect(order.slice(0, 2)).toEqual(['Genel bakış', 'Canlı saha']);
  await expect(page.locator('iframe.k-saha-frame')).toHaveCount(0);
  await page.locator('[data-action="k-saha"]').click();
  await expect(page.locator('iframe.k-saha-frame')).toHaveAttribute('src', 'saha.html?gomulu');
  let frame;
  await expect.poll(() => { frame = page.frames().find(f => f.url().includes('saha.html')); return !!frame; }).toBe(true);
  await frame.waitForFunction(() => document.documentElement.classList.contains('gomulu'));
  // 3B çizim bu testte gerekmez (yazılımla çizim yavaş): çerçeve duraklatılır, yalnızca mesajlar denetlenir
  await page.evaluate(() => document.querySelector('iframe.k-saha-frame').contentWindow.postMessage({ tip: 'pcs-saha-dur', dur: true }, location.origin));
  const box = await page.locator('#k-saha-yer').boundingBox(), fb = await page.locator('iframe.k-saha-frame').boundingBox();
  expect(Math.abs(box.y - fb.y)).toBeLessThan(2); expect(Math.abs(box.width - fb.width)).toBeLessThan(2);
  // yalnızca bugünün kayıtları gider
  const got = frame.evaluate(() => new Promise(r => addEventListener('message', e => { if (e.data && e.data.tip === 'pcs-saha') r(e.data.ziyaretler.map(v => v.id).sort()); })));
  await page.evaluate(() => document.querySelector('[data-action="k-panel"]').click());
  expect(await got).toEqual(['v5', 'v6', 'v7']);
  // çerçeveden gelen seçim panoda aracı seçer
  await frame.evaluate(() => parent.postMessage({ tip: 'pcs-saha-sec', id: 'v7' }, location.origin));
  await expect(page.locator('.side-panel')).toContainText('B 123 XYZ');
  // bölüm gizlenince çerçeve de gizlenir
  await page.evaluate(() => document.querySelector('[data-action="k-saha"]').click());
  await expect(page.locator('iframe.k-saha-frame')).toBeHidden();
  expect(problems).toEqual([]);
});
