// Nakliye programı (operatör ekranı + Lade Liste / CMR belgeleri). Gerçek Supabase yerine tests/stub-vendor.js kullanılır.
// Tüm isimler, adresler, plakalar uydurmadır.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'stub-vendor.js'), 'utf8');
const NOW = new Date('2026-09-23T07:00:00Z');   // 23 Eylül 2026 Çarşamba 10:00 (İstanbul)

const customers = () => [
  { id: 'c1', name: 'ÖRNEK NAKLİYAT', carrier: 'ÖRNEK NAKLİYAT LTD\nTR: +90 000 000 00 00', cmr_notes: '* Birinci şart\n* İkinci şart', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z' },
  { id: 'c2', name: 'DENEME LOJİSTİK', carrier: 'DENEME LOJİSTİK AŞ', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z' }
];
const load = (id, customer_id, sender, consignee, extra = {}) => ({
  id, customer_id, sender, sender_addr: 'Örnek Mah. No: 1 İSTANBUL', consignee, consignee_addr: 'Str. Ornek nr. 1 Bucuresti', notify: '', pieces: 10, packing: 'KAP', goods: 'ÖRNEK MAL', weight: 1000,
  volume: null, country: 'Romanya', code: 'ROBU1400', dest_customs: 'BUCUREŞTI', broker: '', expected_date: null, status: 'depoda', arrived_at: '2026-09-22T08:00:00Z', arrived_by: 'Depo',
  trip_id: null, note: '', created_by: 'Müşteri', created_at: `2026-09-2${id.slice(-1)}T07:00:00Z`, updated_at: '2026-09-22T08:00:00Z', ...extra
});
const loads = () => [
  load('l1', 'c1', 'ÖRNEK GÖNDERİCİ BİR', 'ALICI BİR SRL', { pieces: 840, weight: 8803, goods: 'BANT' }),
  load('l2', 'c1', 'ÖRNEK GÖNDERİCİ İKİ', 'ALICI İKİ SRL', { pieces: 4, weight: 1891, goods: 'KAĞIT', broker: 'ÖRNEK GÜMRÜKLEME' }),
  load('l3', 'c1', 'ÖRNEK GÖNDERİCİ ÜÇ', 'ALICI ÜÇ SRL', { pieces: 7, weight: 3400, goods: 'KAHVE', dest_customs: 'ARAD', code: 'ROAR0100' }),
  load('l4', 'c2', 'DENEME GÖNDERİCİ', 'DENEME ALICI SRL', { pieces: 5, weight: 500, goods: 'TORBA' }),
  load('l5', 'c1', 'BEKLEYEN GÖNDERİCİ', 'BEKLEYEN ALICI SRL', { status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-25', goods: 'PLASTİK' })
];

async function openApp(page, cfg = {}) {
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: true, role: 'editor', data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: loads(), shp_trips: [] }, ...cfg });
  await page.addInitScript(() => { try { localStorage.setItem('pcs-transit-yys.v1.heroMini', '0'); } catch (e) {} });
  await page.clock.install({ time: NOW });
  await page.goto('/');
  return problems;
}
const openNakliye = async (page, cfg) => {
  const problems = await openApp(page, cfg);
  await page.locator('.nav-item', { hasText: 'Nakliye' }).click();
  await expect(page.locator('#nk-root .nk-kpis')).toBeVisible();
  return problems;
};
const pick = (page, id) => page.locator(`[data-nk="pick"][data-id="${id}"]`);

test.use({ serviceWorkers: 'block' });

test('Nakliye menüsü yalnızca düzenleyicide görünür', async ({ page }) => {
  const problems = await openApp(page);
  await expect(page.locator('.nav-item', { hasText: 'Nakliye' })).toHaveCount(1);
  expect(problems).toEqual([]);
});

test('izleyici hesabında Nakliye menüsü yok', async ({ page }) => {
  await openApp(page, { role: 'viewer' });
  await expect(page.locator('.nav-item', { hasText: 'Pano' })).toBeVisible();
  await expect(page.locator('.nav-item', { hasText: 'Nakliye' })).toHaveCount(0);
});

test('boşta yükler varışa göre gruplanır; yalnızca depoya gelenler listelenir', async ({ page }) => {
  const problems = await openNakliye(page);
  const rows = page.locator('#nk-root .nk-t tbody tr:not(.nk-grp)');
  await expect(rows).toHaveCount(4);                                        // l1..l4 (l5 bekliyor, listede yok)
  await expect(page.locator('.nk-grp')).toHaveCount(2);                     // ARAD, BUCUREŞTI
  await expect(page.locator('.nk-grp').first()).toContainText('ARAD');
  await expect(page.locator('#nk-root')).not.toContainText('BEKLEYEN GÖNDERİCİ');
  await expect(page.locator('.nk-kpi').nth(0)).toContainText('1');          // bekleyen
  await expect(page.locator('.nk-kpi').nth(1)).toContainText('4');          // boşta
  await expect(page.locator('.nk-kpi').nth(2)).toContainText('14.594');     // 8803+1891+3400+500 kg
  expect(problems).toEqual([]);
});

test('bir sefer tek müşterinin yüklerini taşır: başka müşterinin yükleri seçilemez', async ({ page }) => {
  await openNakliye(page);
  await pick(page, 'l1').check();
  await expect(pick(page, 'l4')).toBeDisabled();                            // DENEME LOJİSTİK
  await expect(pick(page, 'l2')).toBeEnabled();                             // aynı müşteri
  await expect(page.locator('#nk-side')).toContainText('ÖRNEK NAKLİYAT');
  await expect(page.locator('#nk-side')).toContainText('8.803 / 24.000 kg');
  await pick(page, 'l1').uncheck();
  await expect(pick(page, 'l4')).toBeEnabled();                             // seçim boşalınca serbest
});

test('araca ata: otomatik Poz No, yükler boşta listesinden çıkar, plakanın altında durur, belgeler hazırlanır', async ({ page }) => {
  const problems = await openNakliye(page);
  await pick(page, 'l1').check();
  await pick(page, 'l2').check();
  await expect(page.locator('#nk-side')).toContainText('10.694 / 24.000 kg');
  await page.locator('#nk-tractor').fill('34 abc 123');
  await page.locator('#nk-trailer').fill('34 def 456');
  await page.locator('[data-nk="assign"]').click();

  const dlg = page.locator('#nkb-dlg');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.nkb-bar h2')).toContainText('PCS-26-0001');
  await expect(dlg.locator('[data-nkb-tab]')).toHaveCount(2);
  const lade = await dlg.locator('iframe').evaluate(f => f.srcdoc);
  expect(lade).toContain('L A D E');
  expect(lade).toContain('34 ABC 123');
  expect(lade).toContain('34 DEF 456');
  expect(lade).toContain('PCS-26-0001');
  expect(lade).toContain('GENEL TOPLAM');
  expect(lade).toContain('10,694.00');
  await dlg.locator('[data-nkb-tab="1"]').click();
  const cmr = await dlg.locator('iframe').evaluate(f => f.srcdoc);
  expect(cmr).toContain('PCS-26-0001/01');
  expect(cmr).toContain('PCS-26-0001/02');
  expect(cmr).toContain('ÖRNEK NAKLİYAT LTD');
  expect(cmr).not.toContain('PCS-26-0001/03');
  await dlg.locator('[data-nkb="close"]').click();

  // atanan yükler boşta listesinden çıktı
  await expect(page.locator('#nk-root .nk-t tbody tr:not(.nk-grp)')).toHaveCount(2);
  await expect(page.locator('#nk-root')).not.toContainText('ÖRNEK GÖNDERİCİ BİR');
  const calls = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_assign'));
  expect(calls).toHaveLength(1);
  expect(calls[0].params).toMatchObject({ p_customer: 'c1', p_tractor: '34 abc 123', p_trailer: '34 def 456' });
  expect(calls[0].params.p_load_ids.sort()).toEqual(['l1', 'l2']);

  // ... ve plakanın altında durur
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  const trip = page.locator('.nk-trip');
  await expect(trip).toHaveCount(1);
  await expect(trip).toContainText('PCS-26-0001');
  await expect(trip).toContainText('34 ABC 123');
  await expect(trip).toContainText('34 DEF 456');
  await trip.locator('[data-nk="toggle-trip"]').click();
  await expect(page.locator('.nk-sub')).toContainText('ÖRNEK GÖNDERİCİ BİR');
  await expect(page.locator('.nk-sub')).toContainText('PCS-26-0001/02');
  expect(problems).toEqual([]);
});

test('her sefere sıradaki Poz No verilir; plaka yazılmadan atanmaz', async ({ page }) => {
  await openNakliye(page);
  await pick(page, 'l3').check();
  await page.locator('[data-nk="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Çekici plakasını yazın');
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_assign').length)).toBe(0);
  await page.locator('#nk-tractor').fill('06 AAA 001');
  await page.locator('[data-nk="assign"]').click();
  await expect(page.locator('#nkb-dlg .nkb-bar h2')).toContainText('PCS-26-0001');
  await page.locator('[data-nkb="close"]').click();
  await pick(page, 'l4').check();
  await page.locator('#nk-tractor').fill('06 BBB 002');
  await page.locator('[data-nk="assign"]').click();
  await expect(page.locator('#nkb-dlg .nkb-bar h2')).toContainText('PCS-26-0002');
});

test('araçtan çıkarılan yük boşta listesine döner; son yük çıkınca sefer kalkar', async ({ page }) => {
  await openNakliye(page);
  await pick(page, 'l3').check();
  await page.locator('#nk-tractor').fill('06 AAA 001');
  await page.locator('[data-nk="assign"]').click();
  await page.locator('[data-nkb="close"]').click();
  await expect(pick(page, 'l3')).toHaveCount(0);
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  await page.locator('[data-nk="toggle-trip"]').click();
  await page.locator('[data-nk="unassign"]').click();
  await expect(page.locator('#toast')).toContainText('boşta listesine döndü');
  await expect(page.locator('.nk-trip')).toHaveCount(0);
  await expect(page.locator('#nk-root')).toContainText('Henüz sefer yok');
  await page.locator('[data-nk="tab"][data-v="idle"]').click();
  await expect(pick(page, 'l3')).toBeVisible();
});

test('seferi sil: iki adımlı onay, yükler boşa döner', async ({ page }) => {
  await openNakliye(page);
  await pick(page, 'l1').check();
  await pick(page, 'l2').check();
  await page.locator('#nk-tractor').fill('06 AAA 001');
  await page.locator('[data-nk="assign"]').click();
  await page.locator('[data-nkb="close"]').click();
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  await page.locator('[data-nk="toggle-trip"]').click();
  await page.locator('[data-nk="del-trip"]').click();
  await expect(page.locator('.nk-trip')).toHaveCount(1);                    // ilk tıklama yalnızca onay ister
  await page.locator('[data-nk="del-trip"]').click();
  await expect(page.locator('.nk-trip')).toHaveCount(0);
  await page.locator('[data-nk="tab"][data-v="idle"]').click();
  await expect(page.locator('#nk-root .nk-t tbody tr:not(.nk-grp)')).toHaveCount(4);
});

test('Lade Liste ve CMR tek tek de açılır (araçlar sekmesi)', async ({ page }) => {
  await openNakliye(page);
  await pick(page, 'l1').check();
  await pick(page, 'l2').check();
  await page.locator('#nk-tractor').fill('06 AAA 001');
  await page.locator('[data-nk="assign"]').click();
  await page.locator('[data-nkb="close"]').click();
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  await page.locator('.nk-trip [data-nk="doc"][data-kind="lade"]').click();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveCount(0);
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('L A D E');
  await page.locator('[data-nkb="close"]').click();
  await page.locator('[data-nk="toggle-trip"]').click();
  await page.locator('.nk-sub [data-nk="doc"][data-load="l2"]').click();
  const cmr = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(cmr).toContain('ALICI İKİ SRL');
  expect(cmr).not.toContain('ALICI BİR SRL');                               // yalnızca o yükün CMR'ı
});

test('bekleyen yük "Geldi" ile boşta listesine alınır', async ({ page }) => {
  await openNakliye(page);
  await page.locator('[data-nk="tab"][data-v="wait"]').click();
  await expect(page.locator('#nk-root .nk-t tbody tr')).toHaveCount(1);
  await page.locator('[data-nk="arrive"]').click();
  await expect(page.locator('#toast')).toContainText('boşta listesine alındı');
  await expect(page.locator('#nk-root')).toContainText('Bekleyen yük yok');
  await page.locator('[data-nk="tab"][data-v="idle"]').click();
  await expect(page.locator('#nk-root')).toContainText('BEKLEYEN GÖNDERİCİ');
});

test('yük ekleme formu: zorunlu alanlar, sayı biçimleri, depoda işareti', async ({ page }) => {
  const problems = await openNakliye(page);
  await page.locator('.heading [data-nk="add-load"]').click();
  const f = page.locator('form[data-nk-form="load"]');
  await f.locator('[name="sender"]').fill('YENİ GÖNDERİCİ');
  await f.locator('[name="consignee"]').fill('   ');               // boşluk zorunlu alanı geçer ama kaydedilmez
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#nk-ferr')).toContainText('Gönderici ve alıcı yazılmalı');
  await f.locator('[name="consignee"]').fill('YENİ ALICI SRL');
  await f.locator('[name="weight"]').fill('1.250,5');
  await f.locator('[name="pieces"]').fill('12');
  await f.locator('[name="dest_customs"]').fill('SIBIU');
  await f.locator('[name="inbound_plate"]').fill('34 klm 521');
  await f.locator('[name="arrived"]').check();
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  await expect(page.locator('#nk-root')).toContainText('YENİ GÖNDERİCİ');
  const saved = await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'YENİ GÖNDERİCİ'));
  expect(saved).toMatchObject({ weight: 1250.5, pieces: 12, status: 'depoda', dest_customs: 'SIBIU', inbound_plate: '34 KLM 521', created_by: 'Operatör' });
  await expect(page.locator('#nk-root')).toContainText('Getirecek araç');
  expect(problems).toEqual([]);
});

test('yük silme iki adımlıdır', async ({ page }) => {
  await openNakliye(page);
  await page.locator('[data-nk="edit-load"][data-id="l4"]').click();
  const del = page.locator('form[data-nk-form="load"] [data-nk="del-load"]');
  await del.click();
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(5);
  await del.click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(4);
});

test('müşteri ekleme ve düzenleme', async ({ page }) => {
  await openNakliye(page);
  await page.locator('.heading [data-nk="customers"]').click();
  await expect(page.locator('.nk-cl')).toContainText('ÖRNEK NAKLİYAT');
  await page.locator('.modal-footer [data-nk="edit-cust"]').click();
  const f = page.locator('form[data-nk-form="customer"]');
  await f.locator('[name="name"]').fill('YENİ MÜŞTERİ');
  await f.locator('[name="carrier"]').fill('YENİ MÜŞTERİ NAKLİYE\nTR: +90 000');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('.nk-cl')).toContainText('YENİ MÜŞTERİ');
  // aynı ad ikinci kez eklenemez
  await page.locator('.modal-footer [data-nk="edit-cust"]').click();
  await page.locator('form[data-nk-form="customer"] [name="name"]').fill('YENİ MÜŞTERİ');
  await page.locator('form[data-nk-form="customer"] button[type="submit"]').click();
  await expect(page.locator('#nk-ferr')).toContainText('zaten var');
  const row = await page.evaluate(() => window.__db.shp_customers.find(c => c.name === 'YENİ MÜŞTERİ'));
  expect(row.carrier).toContain('TR: +90 000');
});

test('kurulum yapılmamışsa açıklayıcı uyarı çıkar', async ({ page }) => {
  await openApp(page, { missing: ['shp_customers', 'shp_trips', 'shp_loads'] });
  await page.locator('.nav-item', { hasText: 'Nakliye' }).click();
  await expect(page.locator('#nk-root')).toContainText('bir kerelik kurulum');
  await expect(page.locator('#nk-root')).toContainText('nakliye-kurulumu.sql');
});

test('belgeler: her müşterinin kendi logosu ve nakliyeci bilgisi; metinler güvenli yazılır', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const trip = { id: 't', poz_no: 'PCS-26-0007', tractor: '34 AAA 111', trailer: '', depart_date: '2026-09-23', subject: '' };
    const mk = (id, o) => ({ id, created_at: '2026-09-2' + id, sender: 'A', sender_addr: '', consignee: 'B', consignee_addr: '', notify: '', pieces: 1, packing: 'KAP', goods: 'X', weight: 10, volume: null, country: 'Romanya', code: '', dest_customs: 'ARAD', broker: '', ...o });
    const ls = [mk('1', { sender: '<script>alert(1)</script>', goods: 'A&B' }), mk('2', { dest_customs: 'BUCUREŞTI' })];
    const a = { name: 'BİRİNCİ', carrier: 'BİRİNCİ NAKLİYE', cmr_notes: '* Şart A', loading_place: 'İSTANBUL - Turkey', logo };
    const b = { name: 'İKİNCİ', carrier: 'İKİNCİ NAKLİYE', cmr_notes: '', loading_place: 'İZMİR - Turkey', logo: 'javascript:alert(1)' };
    return { a: PCSNKB.cmr({ trip, customer: a, loads: ls }), b: PCSNKB.cmr({ trip, customer: b, loads: ls }), la: PCSNKB.lade({ trip, customer: a, loads: ls }) };
  });
  expect(out.a).toContain('<img class="cl" src="data:image/png;base64,');
  expect(out.a).toContain('BİRİNCİ NAKLİYE');
  expect(out.a).toContain('* Şart A');
  expect(out.b).toContain('İKİNCİ NAKLİYE');
  expect(out.b).not.toContain('BİRİNCİ NAKLİYE');
  expect(out.b).not.toContain('<img');                                      // geçersiz logo yazılmaz
  expect(out.b).toContain('İZMİR');
  expect(out.a).not.toContain('<script>');
  expect(out.a).toContain('&lt;script&gt;');
  expect(out.a).toContain('A&amp;B');
  expect(out.la).toContain('ARAD');
  expect(out.la.indexOf('ARAD')).toBeLessThan(out.la.indexOf('BUCUREŞTI')); // varışa göre gruplu
});

// ---------------------------------------------------------------------------------------------- müşteri ve depo sayfaları
const tokens = () => ({ tokC1: { kind: 'musteri', customer: 'c1', active: true }, tokC2: { kind: 'musteri', customer: 'c2', active: true }, tokD: { kind: 'depo', active: true } });

test('operatör: Bağlantılar penceresi; kopyala, yenile (eskisi çalışmaz), kapat', async ({ page, context }) => {
  const problems = await openNakliye(page, { shpTokens: tokens() });
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true }); });
  await page.locator('.heading [data-nk="links"]').click();
  const li = page.locator('.nk-lk li');
  await expect(li).toHaveCount(3);                                                   // depo + 2 müşteri
  await expect(li.nth(0)).toContainText('Depo ekranı');
  await expect(li.nth(0).locator('input')).toHaveValue(/nakliye\.html\?d=tokD$/);
  await li.nth(1).locator('[data-nk="lk-copy"]').click();
  await expect(page.locator('#toast')).toContainText('kopyalandı');
  expect((await page.evaluate(() => window.__copied))[0]).toMatch(/nakliye\.html\?m=tokC/);
  // yenile: iki adım, yeni anahtar
  const old = await li.nth(0).locator('input').inputValue();
  await li.nth(0).locator('[data-nk="lk-rot"]').click();
  await expect(li.nth(0).locator('[data-nk="lk-rot"]')).toContainText('Evet');
  await li.nth(0).locator('[data-nk="lk-rot"]').click();
  await expect(page.locator('#toast')).toContainText('eskisi artık çalışmaz');
  expect(await li.nth(0).locator('input').inputValue()).not.toBe(old);
  // eski depo anahtarı artık geçersiz
  const r = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_rotate_link').length);
  expect(r).toBe(1);
  // müşteri bağlantısını kapat
  await li.nth(1).locator('[data-nk="lk-toggle"]').click();
  await expect(li.nth(1)).toContainText('(kapalı)');
  expect(problems).toEqual([]);
});

test('operatör: müşteriye kullanıcı ekler (kullanıcı adı ve şifreyi kendisi belirler), düzenler, şifreyi yeniler, pasife alır, siler', async ({ page }) => {
  const problems = await openNakliye(page, { shpTokens: tokens() });
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } }, configurable: true }); });
  await page.locator('.heading [data-nk="customers"]').click();
  await page.locator('.nk-cl li', { hasText: 'ÖRNEK NAKLİYAT' }).locator('[data-nk="users"]').click();
  await expect(page.locator('.nk-info')).toContainText('şifresiz açılır');
  await expect(page.locator('.nk-info input')).toHaveValue(/nakliye\.html$/);
  await page.locator('.nk-info [data-nk="user-copy"]').click();
  expect((await page.evaluate(() => window.__copied))[0]).toMatch(/nakliye\.html$/);
  await page.locator('[data-nk="edit-user"][data-id=""]').click();
  const ferr = () => page.locator('#nk-ferr');
  await page.locator('#nkf-username').fill('Ali Y');                                   // boşluk ve büyük harf olmaz
  await page.locator('#nkf-password').fill('abc12345');
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(ferr()).toContainText('Kullanıcı adı');
  await page.locator('#nkf-username').fill('ali.y');
  await page.locator('#nkf-display_name').fill('Ali Yılmaz');
  await page.locator('#nkf-password').fill('123');
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(ferr()).toContainText('en az 6');
  await page.locator('[data-nk="pw-gen"]').click();
  expect((await page.locator('#nkf-password').inputValue()).length).toBe(8);
  await page.locator('#nkf-password').fill('sifre123');
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Kullanıcı eklendi');
  await expect(page.locator('.nk-cl')).toContainText('Ali Yılmaz');
  await expect(page.locator('.nk-cl')).toContainText('ali.y');
  await expect(page.locator('.nk-info')).toContainText('tek başına çalışmaz');
  expect(await page.evaluate(() => window.__db.shp_users.map(u => `${u.customer_id}:${u.username}:${u.pw}`))).toEqual(['c1:ali.y:sifre123']);
  // aynı kullanıcı adı başkasına verilemez
  await page.locator('[data-nk="edit-user"][data-id=""]').click();
  await page.locator('#nkf-username').fill('ali.y');
  await page.locator('#nkf-password').fill('baska123');
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(ferr()).toContainText('başka biri');
  await page.locator('[data-nk="users-back"]').click();
  // düzenle: şifre boşsa değişmez; yazılırsa yenisi geçerli
  await page.locator('.nk-cl li', { hasText: 'ali.y' }).locator('[data-nk="edit-user"]').click();
  await page.locator('#nkf-display_name').fill('Ali Y.');
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Kullanıcı güncellendi');
  expect(await page.evaluate(() => window.__db.shp_users[0])).toMatchObject({ display_name: 'Ali Y.', pw: 'sifre123' });
  await page.locator('.nk-cl li', { hasText: 'ali.y' }).locator('[data-nk="edit-user"]').click();
  await page.locator('#nkf-password').fill('yenisifre9');
  await page.locator('input[name="active"]').uncheck();
  await page.locator('form[data-nk-form="user"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('yeni şifre geçerli');
  await expect(page.locator('.nk-cl')).toContainText('(pasif)');
  expect(await page.evaluate(() => window.__db.shp_users[0])).toMatchObject({ pw: 'yenisifre9', active: false });
  // sil: iki adım
  await page.locator('.nk-cl li', { hasText: 'ali.y' }).locator('[data-nk="del-user"]').click();
  expect(await page.evaluate(() => window.__db.shp_users.length)).toBe(1);
  await page.locator('.nk-cl li', { hasText: 'ali.y' }).locator('[data-nk="del-user"]').click();
  await expect(page.locator('#toast')).toContainText('Kullanıcı silindi');
  expect(await page.evaluate(() => window.__db.shp_users.length)).toBe(0);
  await expect(page.locator('.nk-info')).toContainText('şifresiz açılır');
  expect(problems).toEqual([]);
});

test('operatör: Hareketler sekmesi kim ne yaptığını gösterir; müşteriye ve yazıya göre süzülür', async ({ page }) => {
  const log = [
    { id: 1, at: '2026-09-23T06:00:00Z', customer_id: 'c1', actor: 'Müşteri · Ali Yılmaz', role: 'musteri', action: 'Yük eklendi', summary: 'ÖRNEK GÖNDERİCİ → ALICI · 100 kg' },
    { id: 2, at: '2026-09-23T06:30:00Z', customer_id: 'c1', actor: 'Depo · Ahmet', role: 'depo', action: 'Depoya geldi olarak işaretlendi', summary: 'ÖRNEK GÖNDERİCİ → ALICI · 100 kg' },
    { id: 3, at: '2026-09-23T06:45:00Z', customer_id: 'c2', actor: 'ofis@ornek.com', role: 'operator', action: 'Sefer oluşturuldu', summary: 'PCS-26-0001 · 34 ABC 123' }];
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: loads(), shp_trips: [], shp_log: log } });
  await page.locator('[data-nk="tab"][data-v="log"]').click();
  await expect(page.locator('.nk-t tbody tr')).toHaveCount(3);
  await expect(page.locator('.nk-t')).toContainText('Müşteri · Ali Yılmaz');
  await expect(page.locator('.nk-t')).toContainText('Depo · Ahmet');
  await expect(page.locator('.nk-t tbody tr').first()).toContainText('Sefer oluşturuldu');   // en yeni üstte
  await page.locator('#nk-cust').selectOption('c1');
  await expect(page.locator('.nk-t tbody tr')).toHaveCount(2);
  await page.locator('#nk-q').fill('ahmet');
  await expect(page.locator('.nk-t tbody tr')).toHaveCount(1);
});

test('operatör: hareket kaydı kurulmamışsa Hareketler sekmesi bunu söyler', async ({ page }) => {
  await openNakliye(page, { missing: ['shp-rpc'] });
  await page.locator('[data-nk="tab"][data-v="log"]').click();
  await expect(page.locator('#nk-root')).toContainText('Hareket kaydı kurulmamış');
});

test('operatör: depoya gelmemiş yükle yola çıkarken uyarır; teslim edildi der; müşteri bildirimi kuyruğa girer', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  const cs = customers().map(c => c.id === 'c1' ? { ...c, notify_phone: '+90 532 000 00 00', notify_events: { geldi: true, yola: true, teslim: true, sorun: true, mesaj: true } } : c);
  const problems = await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: cs, shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  await page.locator('[data-nk="toggle-trip"]').click();
  const go = () => page.locator('.nk-subact [data-nk="lock-trip"]').first();
  await go().click();                                                                // l5 depoya gelmedi: önce uyarı
  await expect(go()).toContainText('1 yük depoya gelmedi');
  expect(await page.evaluate(() => window.__db.shp_trips[0].status)).toBe('hazirlaniyor');
  await go().click();                                                                // onay: yola çıkar
  await expect(page.locator('#toast')).toContainText('kilitlendi');
  const trip = await page.evaluate(() => window.__db.shp_trips[0]);
  expect(trip.status).toBe('yolda'); expect(trip.departed_at).toBeTruthy();
  await page.locator('[data-nk="lock-trip"][data-v="teslim"]').click();
  await expect(page.locator('#toast')).toContainText('teslim edildi');
  await expect(page.locator('.nk-trip')).toContainText('Teslim edildi');
  const t2 = await page.evaluate(() => ({ t: window.__db.shp_trips[0], q: window.__db.shp_outbox.map(o => o.event) }));
  expect(t2.t.status).toBe('teslim'); expect(t2.t.delivered_at).toBeTruthy();
  expect(t2.q).toEqual(['yola', 'teslim']);
  await page.locator('[data-nk="tab"][data-v="out"]').click();                      // Bildirimler sekmesi
  await expect(page.locator('.nk-ol li')).toHaveCount(2);
  await expect(page.locator('.nk-ol')).toContainText('34 ABC 123 · PCS-26-0001');
  await expect(page.locator('.nk-ol')).toContainText('Lade Liste ve CMR belgeleriniz hazır');
  expect(problems).toEqual([]);
});

test('operatör: Bildirimler sekmesi haberleri birleştirir, WhatsApp\'ta açar, gönderildi sayar ya da iptal eder', async ({ page }) => {
  const ob = (id, event, body) => ({ id, customer_id: 'c1', event, phone: '+90 532 000 00 00', body, status: 'bekliyor', error: '', created_at: '2026-09-23T06:00:00Z', sent_at: null });
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: loads(), shp_trips: [],
    shp_outbox: [ob(1, 'geldi', 'A → B · 4 kap · 100 kg'), ob(2, 'geldi', 'C → D · 2 kap · 50 kg'), ob(3, 'sorun', 'A → B: eksik var'),
      { ...ob(4, 'teslim', 'gönderilmiş'), status: 'gonderildi' }, { ...ob(5, 'teslim', '34 ABC 123 · PCS-26-0001'), status: 'hata', error: 'WhatsApp 400 (131047): Re-engagement message — onaylı şablon gerekir (WA_SABLON).' }] } });
  await page.evaluate(() => { window.__hrefs = []; });
  await page.locator('[data-nk="tab"][data-v="out"]').click();
  await expect(page.locator('.nk-ol li')).toHaveCount(3);                            // iki "geldi" tek mesaj; gönderilmiş olan yok; hata verenin nedeni yazar
  await expect(page.locator('.nk-ol li', { hasText: '34 ABC 123' })).toContainText('Gönderilemedi');
  await expect(page.locator('.nk-ol li', { hasText: '34 ABC 123' })).toContainText('onaylı şablon gerekir');
  await expect(page.locator('.nk-ol li').first()).toContainText('A → B · 4 kap · 100 kg');
  await expect(page.locator('.nk-ol li').first()).toContainText('C → D · 2 kap · 50 kg');
  await page.locator('.nk-ol li').first().locator('[data-nk="out-done"]').click();
  await expect(page.locator('.nk-ol li')).toHaveCount(2);
  expect(await page.evaluate(() => window.__db.shp_outbox.map(o => `${o.id}:${o.status}`))).toEqual(['1:gonderildi', '2:gonderildi', '3:bekliyor', '4:gonderildi', '5:hata']);
  await page.locator('.nk-ol li', { hasText: 'eksik var' }).locator('[data-nk="out-skip"]').click();
  expect(await page.evaluate(() => window.__db.shp_outbox[2].status)).toBe('iptal');
  await page.locator('.nk-ol li', { hasText: '34 ABC 123' }).locator('[data-nk="out-done"]').click();   // hata veren haber elle gönderilince tamam sayılır
  expect(await page.evaluate(() => window.__db.shp_outbox[4].status)).toBe('gonderildi');
  await expect(page.locator('.nk-empty')).toContainText('Gönderilecek bildirim yok');
});

const msgFx = () => [
  { id: 'm1', customer_id: 'c1', channel: 'musteri', from_role: 'musteri', author: 'Müşteri · Ali Yılmaz', body: 'Yarın çıkabilir mi?', load_id: null, trip_id: null, created_at: '2026-09-23T06:00:00Z', read_at: null },
  { id: 'm2', customer_id: 'c1', channel: 'musteri', from_role: 'depo', author: 'Depo · Ahmet', body: 'Evet, rampa hazır.', load_id: null, trip_id: null, created_at: '2026-09-23T06:10:00Z', read_at: null },
  { id: 'm3', customer_id: 'c2', channel: 'musteri', from_role: 'musteri', author: 'Müşteri (bağlantı)', body: 'Belgeler hazır mı?', load_id: null, trip_id: null, created_at: '2026-09-22T06:00:00Z', read_at: '2026-09-22T07:00:00Z' },
  { id: 'm4', customer_id: null, channel: 'depo', from_role: 'depo', author: 'Depo · Ahmet', body: 'eski depo-ofis yazışması', load_id: null, trip_id: null, created_at: '2026-09-21T06:00:00Z', read_at: null }];

test('operatör: Mesajlar sekmesi müşteri ile depo yazışmalarını gösterir; ofis okundu işaretini bozmaz, isterse yazar', async ({ page }) => {
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: loads(), shp_trips: [], shp_messages: msgFx() } });
  await expect(page.locator('[data-nk="tab"][data-v="msg"] span')).toHaveText('2');   // iki konuşma (müşterisiz eski satır sayılmaz)
  await page.locator('[data-nk="tab"][data-v="msg"]').click();
  await expect(page.locator('.nk-th')).toHaveCount(2);
  await expect(page.locator('.nk-th').first()).toContainText('ÖRNEK NAKLİYAT');
  await expect(page.locator('.nk-th').first().locator('.nk-bdg')).toHaveText('1');     // müşterinin yazdığı, deponun henüz okumadığı
  await expect(page.locator('.nk-mlist')).toContainText('Yarın çıkabilir mi?');
  await expect(page.locator('.nk-mlist')).toContainText('Evet, rampa hazır.');
  await expect(page.locator('.nk-mlist')).toContainText('Depo · Ahmet');
  await expect(page.locator('.nk-mlist')).not.toContainText('eski depo-ofis');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__db.shp_messages.find(m => m.id === 'm1').read_at)).toBeNull();   // ofis açınca okundu olmaz
  await page.locator('#nk-reply').fill('Belgeleri ofiste hazırladık.');
  await page.locator('form[data-nk-form="reply"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Cevabınız gönderildi');
  const sent = await page.evaluate(() => window.__db.shp_messages.filter(m => m.from_role === 'ofis'));
  expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ customer_id: 'c1', body: 'Belgeleri ofiste hazırladık.' });
  await page.locator('.nk-th', { hasText: 'DENEME LOJİSTİK' }).click();
  await expect(page.locator('.nk-mlist')).toContainText('Belgeler hazır mı?');
});

test('operatör: mesaj balonu müşteri ile depo yazışmalarını gösterir; müşteri seçilir, cevap yazılır (Enter), Esc kapatır', async ({ page }) => {
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: loads(), shp_trips: [], shp_messages: msgFx() } });
  await expect(page.locator('#nk-cpanel')).toHaveCount(0);
  await expect(page.locator('#nk-cfab .nk-cdot')).toHaveCount(0);                    // ofis için okunmamış sayacı yok
  await page.locator('#nk-cfab').click();
  await expect(page.locator('#nk-cpanel')).toBeVisible();
  expect(await page.locator('#nk-bmlist .nk-m').first().evaluate(e => getComputedStyle(e).textTransform)).toBe('none');   // mesajlar büyük harfe çevrilmez
  await expect(page.locator('#nk-bmlist')).toContainText('Yarın çıkabilir mi?');       // en son yazışılan müşteri
  await expect(page.locator('#nk-bmlist')).toContainText('Evet, rampa hazır.');
  await expect(page.locator('#nk-cpanel select option[value="c1"]')).toContainText('(1 okunmadı)');
  await page.locator('#nk-cpanel select').selectOption('c2');
  await expect(page.locator('#nk-bmlist')).toContainText('Belgeler hazır mı?');
  await expect(page.locator('#nk-bmlist')).not.toContainText('Yarın çıkabilir mi?');
  await page.locator('#nk-breply').fill('Hazır, ofisten alabilirsiniz.');
  await page.locator('#nk-breply').press('Enter');
  await expect(page.locator('#nk-bmlist')).toContainText('Hazır, ofisten alabilirsiniz.');
  const sent = await page.evaluate(() => window.__db.shp_messages.filter(m => m.from_role === 'ofis'));
  expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ customer_id: 'c2', body: 'Hazır, ofisten alabilirsiniz.' });
  expect(await page.evaluate(() => window.__db.shp_messages.find(m => m.id === 'm1').read_at)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.locator('#nk-cpanel')).toHaveCount(0);
});

test('operatör: müşteri bildirim telefonunu ve yükün depo teslim bilgisini (sorun, konum, fotoğraf) görür', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l1' ? { ...l, condition: 'eksik', counted_pieces: 830, location: 'A-3', receive_note: '2 koli ıslak', arrived_at: '2026-09-22T08:00:00Z' } : l);
  const photos = [{ id: 'ph1', load_id: 'l1', customer_id: 'c1', thumb: 'data:image/jpeg;base64,/9j/AAAA', data: 'data:image/jpeg;base64,/9j/BBBB', by_name: 'Ahmet', created_at: '2026-09-22T08:00:00Z' }];
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: ls, shp_trips: [], shp_photos: photos } });
  await expect(page.locator('.nk-t').first()).toContainText('Eksik var');            // Boşta yükler listesinde sorun etiketi
  await page.locator('[data-nk="edit-load"][data-id="l1"]').first().click();
  await expect(page.locator('.nk-rcbox')).toContainText('sayılan 830');
  await expect(page.locator('.nk-rcbox')).toContainText('konum A-3');
  await expect(page.locator('.nk-pht')).toHaveCount(1);
  await page.locator('.nk-pht').click();
  await expect(page.locator('.nk-phimg')).toHaveAttribute('src', /BBBB/);
  await page.locator('[data-action="close-modal"]').first().click();
  // müşteri bildirim telefonu
  await page.locator('.heading [data-nk="customers"]').click();
  await page.locator('.nk-cl li', { hasText: 'ÖRNEK NAKLİYAT' }).locator('[data-nk="edit-cust"]').click();
  await page.locator('#nkf-notify_phone').fill('+90 532 111 22 33');
  await page.locator('form[data-nk-form="customer"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Müşteri güncellendi');
  expect(await page.evaluate(() => window.__db.shp_customers.find(c => c.id === 'c1').notify_phone)).toBe('+90 532 111 22 33');
});

test('Nakliye müşterileri panodaki müşterilerden kendiliğinden eklenir (tekrar yok, harf farkı yok, kapalı olan yeniden eklenmez)', async ({ page }) => {
  const reg = (id, plate, customer) => ({ id, plate, customer, declaration: '', carrier: '', registration: '', updated_at: '2026-09-01T08:00:00Z' });
  const visit = (id, customer) => ({ id, plate: 'X ' + id, customer, declaration: '', carrier: '', registration: '', visit_date: '2026-09-23', visit_time: '09:00', note: '', onsite: false, t1: false, done: false, created_at: '2026-09-23T05:00:00Z', updated_at: '2026-09-23T06:00:00Z', onsite_at: null, done_at: null, sort_order: null });
  const cs = customers(); cs[1].active = false;                                  // DENEME LOJİSTİK kapalı
  const problems = await openNakliye(page, {
    data: { registry: [reg('r1', '34 ABC 123', 'BULTRANS'), reg('r2', '06 KL 4567', 'örnek nakliyat'), reg('r3', 'B 1 X', '  deneme   lojistik ')],
      visits: [visit('v1', 'TORNADO'), visit('v2', 'Tornado'), visit('v3', ''), visit('v4', 'BULTRANS')], app_settings: [], shp_customers: cs, shp_loads: loads(), shp_trips: [] }
  });
  await expect(page.locator('#toast')).toContainText('2 müşteri panodan eklendi');
  const names = await page.evaluate(() => window.__db.shp_customers.map(c => c.name).sort());
  expect(names).toEqual(['BULTRANS', 'DENEME LOJİSTİK', 'TORNADO', 'ÖRNEK NAKLİYAT'].sort());
  expect(await page.evaluate(() => window.__db.shp_customers.find(c => c.name === 'BULTRANS').cmr_notes)).toContain('sorumlu değildir');
  await page.locator('.heading [data-nk="customers"]').click();
  await expect(page.locator('.nk-cl')).toContainText('BULTRANS');
  await expect(page.locator('.nk-cl')).toContainText('TORNADO');
  // sayfa yeniden çizilince aynı müşteriler tekrar eklenmez
  await page.locator('[data-action="close-modal"]').first().click();
  await page.locator('.heading [data-nk="refresh"]').click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__db.shp_customers.length)).toBe(4);
  expect(problems).toEqual([]);
});

// ---------------------------------------------------------------------------------------------- müşteri yüklerini kendi sayfasında araçlara yerleştirir
const planTrip = (extra = {}) => ({ id: 'tt1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '', depart_date: '2026-09-23', subject: '', status: 'hazirlaniyor', created_by: 'Müşteri', created_at: '2026-09-23T07:00:00Z', ...extra });

test('operatör: müşterinin planladığı araç Araçlar sekmesinde; gelmeyen yük işaretli, Geldi denebilir; sefer kilitlenir', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  const problems = await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  const trip = page.locator('.nk-trip');
  await expect(trip).toContainText('Müşteri planladı');
  await expect(trip).toContainText('1 yük depoya gelmedi');
  await trip.locator('[data-nk="toggle-trip"]').click();
  await page.locator('.nk-sub [data-nk="arrive-trip"]').click();
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'))).toMatchObject({ status: 'aracta', arrived_by: 'Operatör' });
  await expect(trip).not.toContainText('depoya gelmedi');
  await page.locator('[data-nk="lock-trip"]').click();
  await expect(page.locator('#toast')).toContainText('kilitlendi');
  expect(await page.evaluate(() => window.__db.shp_trips[0].status)).toBe('yolda');
  await expect(trip).toContainText('kilitli');
  await page.locator('[data-nk="lock-trip"][data-v="hazirlaniyor"]').click();
  expect(await page.evaluate(() => window.__db.shp_trips[0].status)).toBe('hazirlaniyor');
  expect(problems).toEqual([]);
});

test('operatör: depoya gelmemiş yükü araçtan çıkarınca "Bekleyenler"e döner', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openNakliye(page, { data: { registry: [], visits: [], app_settings: [], shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-nk="tab"][data-v="trips"]').click();
  await page.locator('[data-nk="toggle-trip"]').click();
  await page.locator('[data-nk="unassign"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5').status)).toBe('bekliyor');
  await page.locator('[data-nk="tab"][data-v="wait"]').click();
  await expect(page.locator('#nk-root')).toContainText('BEKLEYEN GÖNDERİCİ');
});

test('belgeler PLASTNAK örnek taslağıyla birebir: sabit yazılar, kutu numaraları, her yük için bir CMR sayfası, uzun listede Lade Liste sayfalara bölünür', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const trip = { id: 't', poz_no: 'PCS-26-0009', tractor: 'DB 16 CTD', trailer: 'DB 19 CTD', depart_date: '2026-11-18', subject: 'KONU' };
    const c = { name: 'PLASTNAK', carrier: 'RO: +40 (770) 984 922- TR: +90 (532) 782 29 29\nMAİL: info@plastnakinternational.com', cmr_notes: 'This carriage is subject,notwithstanding any clauseto the convention on the contract for the International carriage of oods by road(CMR)\n* Malın sigortasından firmamız sorumlu değildir.', loading_place: 'İSTANBUL - Turkey', logo };
    const mk = i => ({ id: 'x' + i, created_at: '2026-11-' + String(10 + (i % 9)).padStart(2, '0'), sender: 'GÖNDERİCİ ' + i, sender_addr: 'ADRES ' + i, consignee: 'ALICI ' + i, consignee_addr: '', notify: '', pieces: i, packing: 'KAP', goods: 'MAL ' + i, weight: 100 * i, volume: null, country: 'Romanya', code: 'ROBU1400', dest_customs: 'BUCUREŞTI', broker: '' });
    const few = [1, 2, 3].map(mk), many = Array.from({ length: 40 }, (_, i) => mk(i + 1));
    return { cmr: PCSNKB.cmr({ trip, customer: c, loads: few }), lade: PCSNKB.lade({ trip, customer: c, loads: few }), ladeMany: PCSNKB.lade({ trip, customer: c, loads: many }), only: PCSNKB.cmr({ trip, customer: c, loads: few, only: 'x2' }) };
  });
  for (const t of ['INTERNATIONAL CONSIGMENT', 'HAMULE SENEDI', 'Place and dateof taking of the goods', 'Signatuer and stamp of the sender', 'Stamp of the carrier and carrier', 'Navlunun ödenmesi için talimatlar',
    'Serbest Değil / Unfree', 'Hususi şartlar', 'Mallar teslim alındı', 'NOTIFY', 'Plaka No.', 'C M R', 'DB 16 CTD - DB 19 CTD', 'RO: +40 (770) 984 922- TR: +90 (532) 782 29 29', 'PCS-26-0009/01', 'PCS-26-0009/03'])
    expect(out.cmr, t).toContain(t);
  expect((out.cmr.match(/class="pg"/g) || []).length).toBe(3);                       // her yük için bir sayfa
  expect(out.cmr).toContain('This carriage is subject,notwithstanding any clauseto');   // müşterinin kendi şart metni aynen
  expect((out.only.match(/class="pg"/g) || []).length).toBe(1);
  expect(out.only).toContain('PCS-26-0009/02');
  for (const t of ['GÖNDERİCİ', 'ALICI', 'MAL CİNSİ', 'VARIŞ GÜMRÜK', 'GÜMRÜKÇÜ', 'TOPLAM:', 'GENEL TOPLAM:', 'Plaka No', 'Çıkış Tarihi', 'DB 16 CTD', 'DB 19 CTD', 'KONU'])
    expect(out.lade, t).toContain(t);
  expect((out.lade.match(/class="pg"/g) || []).length).toBe(1);
  expect((out.ladeMany.match(/class="pg"/g) || []).length).toBeGreaterThan(1);       // uzun liste sayfalara bölünür
  expect(out.ladeMany).toContain('<span class="pn">2</span>');
  expect(out.ladeMany).toContain('GENEL TOPLAM:');
});
