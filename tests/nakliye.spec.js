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
  expect(lade).toContain('LADE LİSTE');
  expect(lade).toContain('34 ABC 123 - 34 DEF 456');
  expect(lade).toContain('PCS-26-0001');
  expect(lade).toContain('GENEL TOPLAM');
  expect(lade).toContain('10,694.00');
  await dlg.locator('[data-nkb-tab="1"]').click();
  const cmr = await dlg.locator('iframe').evaluate(f => f.srcdoc);
  expect(cmr).toContain('Poz: <b>PCS-26-0001/01</b>');
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
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('LADE LİSTE');
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
  await f.locator('[name="arrived"]').check();
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  await expect(page.locator('#nk-root')).toContainText('YENİ GÖNDERİCİ');
  const saved = await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'YENİ GÖNDERİCİ'));
  expect(saved).toMatchObject({ weight: 1250.5, pieces: 12, status: 'depoda', dest_customs: 'SIBIU', created_by: 'Operatör' });
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
  expect(out.a).toContain('<img class="logo" src="data:image/png;base64,');
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
async function openPortal(page, query, cfg = {}) {
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: false, data: { shp_customers: customers(), shp_loads: loads(), shp_trips: [] }, shpTokens: tokens(), ...cfg });
  await page.clock.install({ time: NOW });
  await page.goto('/nakliye.html' + query);
  return problems;
}

test('müşteri sayfası: yalnızca kendi yüklerini görür; yeni yük yazar, düzenler, siler', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await expect(page.locator('h1')).toContainText('ÖRNEK NAKLİYAT');
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');             // l5: bekliyor
  await expect(page.locator('#p')).not.toContainText('DENEME GÖNDERİCİ');            // başka müşteri
  await expect(page.locator('.sum')).toContainText('Bekleyen');
  // yeni yük
  const f = page.locator('form[data-f="load"]');
  await f.locator('[name="sender"]').fill('PORTAL GÖNDERİCİ');
  await f.locator('[name="consignee"]').fill('PORTAL ALICI SRL');
  await f.locator('[name="pieces"]').fill('12');
  await f.locator('[name="weight"]').fill('1.250,5');
  await f.locator('[name="dest_customs"]').fill('SIBIU');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  await expect(page.locator('#p')).toContainText('PORTAL GÖNDERİCİ');
  const saved = await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'PORTAL GÖNDERİCİ'));
  expect(saved).toMatchObject({ customer_id: 'c1', status: 'bekliyor', weight: 1250.5, pieces: 12, dest_customs: 'SIBIU', created_by: 'Müşteri' });
  await expect(page.locator('form[data-f="load"] [name="sender"]')).toHaveValue('');   // form boşaldı
  // düzenle
  await page.locator('[data-a="edit"]', { has: page.locator('xpath=self::*') }).first().click();
  await expect(page.locator('#form-card h2')).toContainText('düzenle');
  await page.locator('form[data-f="load"] [name="goods"]').fill('YENİ MAL');
  await page.locator('form[data-f="load"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  expect(await page.evaluate(() => window.__db.shp_loads.filter(l => l.goods === 'YENİ MAL').length)).toBe(1);
  // sil: iki adım
  const n0 = await page.evaluate(() => window.__db.shp_loads.length);
  await page.locator('[data-a="del"]').first().click();
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0);
  await page.locator('[data-a="del"]').first().click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0 - 1);
  expect(problems).toEqual([]);
});

test('müşteri sayfası: depoya gelen yük değiştirilemez ve silinemez (düğme yok); yalnızca bekleyende var', async ({ page }) => {
  await openPortal(page, '?m=tokC1');
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('#p')).toContainText('ÖRNEK GÖNDERİCİ BİR');
  await expect(page.locator('[data-a="edit"]')).toHaveCount(0);
  await expect(page.locator('[data-a="del"]')).toHaveCount(0);
});

test('geçersiz ya da kapatılmış bağlantı anlaşılır uyarı verir; bağlantı yoksa genel uyarı', async ({ page }) => {
  await openPortal(page, '?m=yanlis');
  await expect(page.locator('#p')).toContainText('geçersiz ya da kapatılmış');
  const page2 = await page.context().newPage();
  await page2.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page2.goto('/nakliye.html');
  await expect(page2.locator('#p')).toContainText('özel bağlantıyla açılır');
});

test('kapatılmış müşteri bağlantısı çalışmaz', async ({ page }) => {
  const t = tokens(); t.tokC1.active = false;
  await openPortal(page, '?m=tokC1', { shpTokens: t });
  await expect(page.locator('#p')).toContainText('geçersiz ya da kapatılmış');
});

test('depo sayfası: Geldi işaretler (adıyla), Geri al ile döner; müşteriye göre gruplar', async ({ page }) => {
  const problems = await openPortal(page, '?d=tokD');
  await expect(page.locator('h1')).toContainText('Depo');
  await expect(page.locator('#p .card h2').filter({ hasText: 'ÖRNEK NAKLİYAT' })).toBeVisible();
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);                    // yalnızca l5 bekliyor
  await page.locator('#nm').fill('Ahmet');
  await page.locator('[data-a="arrive"]').click();
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  const l5 = await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'));
  expect(l5).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet' });
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  await page.locator('[data-a="undo"]').filter({ has: page.locator('xpath=self::*') }).first().click();
  await expect(page.locator('#toast')).toContainText('geri alındı');
  expect(problems).toEqual([]);
});

test('depo sayfası: plaka bazında araçlar ve belgeler; araca verilen yük bekleyen/depoda listelerinden çıkar', async ({ page }) => {
  const trip = { id: 'tt1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '34 DEF 456', depart_date: '2026-09-23', subject: '', status: 'hazirlaniyor', created_at: '2026-09-23T07:00:00Z' };
  const ls = loads().map(l => l.id === 'l1' || l.id === 'l2' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [trip] } });
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('#p')).not.toContainText('ÖRNEK GÖNDERİCİ BİR');         // araçta: depoda listesinde yok
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  await expect(page.locator('#p .pl').first()).toContainText('34 ABC 123');
  await expect(page.locator('#p')).toContainText('ÖRNEK GÖNDERİCİ BİR');
  await page.locator('[data-a="doc"][data-kind="cmr"]').click();
  const cmr = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(cmr).toContain('PCS-26-0001/01');
  expect(cmr).toContain('ÖRNEK NAKLİYAT LTD');
});

test('müşteri sayfası: araca atanan yükler "Araçta" görünür ve sefer belgeleri alınır', async ({ page }) => {
  const trip = { id: 'tt1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '', depart_date: '2026-09-23', subject: '', status: 'hazirlaniyor', created_at: '2026-09-23T07:00:00Z' };
  const ls = loads().map(l => l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [trip] } });
  await page.locator('[data-a="tab"][data-v="aracta"]').click();
  await expect(page.locator('#p .row').first()).toContainText('PCS-26-0001');
  await page.locator('section', { hasText: 'Seferlerim' }).locator('[data-a="doc"][data-kind="lade"]').click();
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('LADE LİSTE');
});

test('depo sayfası: açık ekran kendiliğinden yenilenir (yeni yük görünür)', async ({ page }) => {
  await openPortal(page, '?d=tokD');
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);
  await page.evaluate(() => window.__db.shp_loads.push({ id: 'lz', customer_id: 'c2', sender: 'SONRADAN GELEN', consignee: 'X', consignee_addr: '', sender_addr: '', notify: '', pieces: 1, packing: 'KAP', goods: '', weight: 1, volume: null, country: '', code: '', dest_customs: '', broker: '', expected_date: null, status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, note: '', created_at: '2026-09-23T07:00:00Z' }));
  await page.clock.runFor(31000);
  await expect(page.locator('#p')).toContainText('SONRADAN GELEN');
});

test('kurulum yapılmamışsa müşteri sayfası bunu söyler', async ({ page }) => {
  await openPortal(page, '?m=tokC1', { missing: ['shp-rpc'] });
  await expect(page.locator('#p')).toContainText('henüz kurulmamış');
});

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
