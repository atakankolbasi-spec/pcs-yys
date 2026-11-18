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

test('müşteri sayfası: yalnızca kendi yüklerini görür; yük yazar (getirecek kamyon plakası dahil), düzenler, siler', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await expect(page.locator('.cn b')).toContainText('ÖRNEK NAKLİYAT');
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  await expect(page.locator('#p')).not.toContainText('DENEME GÖNDERİCİ');            // başka müşteri
  await expect(page.locator('.kpis')).toContainText('Bekleyen');
  // yeni yük (pencerede)
  await page.locator('[data-a="add"]').click();
  const f = page.locator('#m form[data-f="load"]');
  await f.locator('[name="sender"]').fill('PORTAL GÖNDERİCİ');
  await f.locator('[name="consignee"]').fill('   ');                                // boşluk zorunlu alanı geçer ama kaydedilmez
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#ferr')).toContainText('Gönderici ve alıcı yazılmalı');
  await f.locator('[name="consignee"]').fill('PORTAL ALICI SRL');
  await f.locator('[name="pieces"]').fill('12');
  await f.locator('[name="weight"]').fill('1.250,5');
  await f.locator('[name="dest_customs"]').fill('SIBIU');
  await f.locator('[name="inbound_plate"]').fill('34 klm 521');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  await expect(page.locator('#m[open]')).toHaveCount(0);
  const row = () => page.locator('tr.lr', { hasText: 'PORTAL GÖNDERİCİ' });
  await expect(row()).toContainText('34 KLM 521');
  const saved = await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'PORTAL GÖNDERİCİ'));
  expect(saved).toMatchObject({ customer_id: 'c1', status: 'bekliyor', weight: 1250.5, pieces: 12, dest_customs: 'SIBIU', inbound_plate: '34 KLM 521', created_by: 'Müşteri' });
  // düzenle
  await row().locator('[data-a="edit"]').click();
  await expect(page.locator('#m h2')).toContainText('Yükü düzenle');
  await expect(page.locator('#m [name="inbound_plate"]')).toHaveValue('34 KLM 521');
  await page.locator('#m [name="goods"]').fill('YENİ MAL');
  await page.locator('#m button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  expect(await page.evaluate(() => window.__db.shp_loads.filter(l => l.goods === 'YENİ MAL').length)).toBe(1);
  // sil: iki adım
  const n0 = await page.evaluate(() => window.__db.shp_loads.length);
  await row().locator('[data-a="del"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0);
  await row().locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0 - 1);
  expect(problems).toEqual([]);
});

test('müşteri sayfası: depoya gelmiş yük de düzenlenir ve silinir; araçtaki yük düzenlenir ama silinemez; kilitli araçtaki hiçbiri', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l3' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  const r1 = page.locator('tr.lr', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }), r3 = page.locator('tr.lr', { hasText: 'ÖRNEK GÖNDERİCİ ÜÇ' });
  await expect(r1.locator('[data-a="edit"]')).toHaveCount(1);                       // depoda: düzenlenir
  await expect(r1.locator('[data-a="del"]')).toHaveCount(1);                        // ... ve silinir
  await expect(r3.locator('[data-a="edit"]')).toHaveCount(1);                       // araçta (kilitsiz): düzenlenir
  await expect(r3.locator('[data-a="del"]')).toHaveCount(0);                        // ... ama silinemez
  await expect(r3.locator('[data-a="unassign"]')).toHaveCount(1);
  await r1.locator('[data-a="del"]').click();
  await r1.locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l1'))).toBe(false);
  // kilitli araç
  const page2 = await page.context().newPage();
  await page2.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  await page2.addInitScript(c => { window.__PCS_STUB = c; }, { session: false, data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip({ status: 'yolda' })] }, shpTokens: tokens() });
  await page2.goto('/nakliye.html?m=tokC1');
  const k3 = page2.locator('tr.lr', { hasText: 'ÖRNEK GÖNDERİCİ ÜÇ' });
  await expect(k3).toBeVisible();
  await expect(k3.locator('[data-a="edit"], [data-a="del"], [data-a="unassign"]')).toHaveCount(0);
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

test('depo sayfası: Geldi işaretler (adıyla), Geri al ile döner; müşteriye göre gruplar; getirecek araç plakası görünür ve aranır', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, inbound_plate: '35 XYZ 789' } : l);
  const problems = await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [] } });
  await expect(page.locator('h1')).toContainText('Depo');
  await expect(page.locator('#p .gh h2').filter({ hasText: 'ÖRNEK NAKLİYAT' })).toBeVisible();
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);                    // yalnızca l5 bekliyor
  await expect(page.locator('tr.dr')).toContainText('35 XYZ 789');                   // yükü getirecek kamyonun plakası
  await page.locator('#q').fill('35 xyz');
  await expect(page.locator('tr.dr')).toHaveCount(1);
  await page.locator('#q').fill('yok boyle');
  await expect(page.locator('tr.dr')).toHaveCount(0);
  await page.locator('#q').fill('');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('[data-a="arrive"]').click();
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  const l5 = await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'));
  expect(l5).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet' });
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  await page.locator('tr.dr', { hasText: 'BEKLEYEN GÖNDERİCİ' }).locator('[data-a="undo"]').click();
  await expect(page.locator('#toast')).toContainText('geri alındı');
  expect(problems).toEqual([]);
});

test('depo sayfası: yük bilgisini düzeltir ve siler; araçtaki yük silinemez', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  // depoda duran yükü düzelt (gerçek kap ve plaka)
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await page.locator('tr.dr', { hasText: 'DENEME GÖNDERİCİ' }).locator('[data-a="edit"]').click();
  await expect(page.locator('#m h2')).toContainText('Yükü düzenle');
  await page.locator('#m [name="pieces"]').fill('9');
  await page.locator('#m [name="inbound_plate"]').fill('06 xx 11');
  await page.locator('#m button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l4'))).toMatchObject({ pieces: 9, inbound_plate: '06 XX 11' });
  await expect(page.locator('tr.dr', { hasText: 'DENEME GÖNDERİCİ' })).toContainText('06 XX 11');
  // bekleyen yükü sil (iki adım)
  await page.locator('[data-a="tab"][data-v="bekliyor"]').click();
  const r5 = () => page.locator('tr.dr', { hasText: 'BEKLEYEN GÖNDERİCİ' });
  await r5().locator('[data-a="del"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l5'))).toBe(true);
  await r5().locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l5'))).toBe(false);
  // araçtaki yükte Sil düğmesi yok, Düzenle var
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  const r1 = page.locator('tr.dr', { hasText: 'ÖRNEK GÖNDERİCİ BİR' });
  await expect(r1.locator('[data-a="edit"]')).toHaveCount(1);
  await expect(r1.locator('[data-a="del"]')).toHaveCount(0);
});

test('müşteri sayfası: araca atanan yükler "Araçta" görünür ve sefer belgeleri alınır (Araçlarım)', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-a="tab"][data-v="aracta"]').click();
  await expect(page.locator('tr.lr').first()).toContainText('PCS-26-0001');
  await page.locator('[data-a="view"][data-v="trips"]').click();
  await page.locator('.tc [data-a="doc"][data-kind="lade"]').first().click();
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('L A D E');
});

test('depo sayfası: açık ekran kendiliğinden yenilenir (yeni yük görünür)', async ({ page }) => {
  await openPortal(page, '?d=tokD');
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);
  await page.evaluate(() => window.__db.shp_loads.push({ id: 'lz', customer_id: 'c2', sender: 'SONRADAN GELEN', consignee: 'X', consignee_addr: '', sender_addr: '', notify: '', pieces: 1, packing: 'KAP', goods: '', weight: 1, volume: null, country: '', code: '', dest_customs: '', broker: '', expected_date: null, inbound_plate: '', status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, note: '', created_at: '2026-09-23T07:00:00Z' }));
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

// ---------------------------------------------------------------------------------------------- müşteri yüklerini kendi sayfasında araçlara yerleştirir
const planTrip = (extra = {}) => ({ id: 'tt1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '', depart_date: '2026-09-23', subject: '', status: 'hazirlaniyor', created_by: 'Müşteri', created_at: '2026-09-23T07:00:00Z', ...extra });
const pickP = (page, id) => page.locator(`[data-a="pick"][data-id="${id}"]`);

test('müşteri: yüklerini yeni araca koyar (depoya gelmemiş yük de); Poz No otomatik; atama kesindir', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await pickP(page, 'l1').check();                                                   // depoda
  await pickP(page, 'l5').check();                                                   // depoya henüz gelmemiş
  await expect(page.locator('#sbar')).toContainText('2 yük seçili');
  await page.locator('#sbar [data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Hangi araca');
  await page.locator('#tg').selectOption('new');
  await page.locator('#sbar [data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Çekici plakasını yazın');
  await page.locator('#nv-tractor').fill('34 abc 123');
  await page.locator('#nv-trailer').fill('34 def 456');
  await page.locator('#sbar [data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('PCS-26-0001');
  await expect(page.locator('#sbar')).toHaveCount(0);                                // Araçlarım görünümüne geçti
  // Araçlarım: plaka altında, depoya gelmeyen yük işaretli
  const card = page.locator('.tc');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('34 ABC 123');
  await expect(card).toContainText('34 DEF 456');
  await expect(card).toContainText('1 yük depoya gelmedi');
  await expect(card.locator('.tl')).toHaveCount(2);
  const calls = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_portal_assign').map(c => c.params));
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_token: 'tokC1', p_tractor: '34 abc 123', p_trailer: '34 def 456', p_trip: null });
  expect(calls[0].p_load_ids.sort()).toEqual(['l1', 'l5']);
  const db = await page.evaluate(() => ({ trip: window.__db.shp_trips[0], l1: window.__db.shp_loads.find(l => l.id === 'l1'), l5: window.__db.shp_loads.find(l => l.id === 'l5') }));
  expect(db.trip).toMatchObject({ poz_no: 'PCS-26-0001', created_by: 'Müşteri', status: 'hazirlaniyor', tractor: '34 ABC 123' });
  expect(db.l1).toMatchObject({ status: 'aracta', trip_id: db.trip.id });
  expect(db.l5).toMatchObject({ status: 'aracta', trip_id: db.trip.id, arrived_at: null });
  // Lade Liste bu yükleri içerir
  await card.locator('[data-a="doc"][data-kind="lade"]').click();
  const lade = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(lade).toContain('34 ABC 123');
  expect(lade).toContain('34 DEF 456');
  expect(lade).toContain('BEKLEYEN GÖNDERİCİ');
  expect(problems).toEqual([]);
});

test('müşteri: mevcut aracına yük ekler, araçtan çıkarır (gelmemiş yük bekleyene, gelmiş yük depoya döner), plakayı düzeltir', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l.id === 'l5' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await pickP(page, 'l2').check();
  await page.locator('#tg').selectOption('tt1');
  await page.locator('#sbar [data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('PCS-26-0001');
  await expect(page.locator('.tc .tl')).toHaveCount(3);
  // çıkar: l5 hiç gelmemişti -> bekliyor; l1 gelmişti -> depoda
  await page.locator('.tc .tl', { hasText: 'BEKLEYEN GÖNDERİCİ' }).locator('[data-a="unassign"]').click();
  await page.locator('.tc .tl', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="unassign"]').click();
  const st = await page.evaluate(() => Object.fromEntries(window.__db.shp_loads.map(l => [l.id, l.status + (l.trip_id ? '*' : '')])));
  expect(st).toMatchObject({ l5: 'bekliyor', l1: 'depoda', l2: 'aracta*' });
  // plakayı düzelt
  await page.locator('[data-a="trip-edit"]').click();
  await page.locator('#te-tractor').fill('06 zz 999');
  await page.locator('[data-a="trip-save"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  await expect(page.locator('.tc')).toContainText('06 ZZ 999');
  // son yükü de çıkarınca araç kalkar
  await page.locator('.tc [data-a="unassign"]').click();
  await expect(page.locator('.tc')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.shp_trips.length)).toBe(0);
});

test('müşteri: yola çıkıp kilitlenen araçta değişiklik yapamaz', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip({ status: 'yolda' })] } });
  await page.locator('[data-a="view"][data-v="trips"]').click();
  await expect(page.locator('.tc')).toContainText('kilitli');
  await expect(page.locator('.tc [data-a="unassign"]')).toHaveCount(0);
  await expect(page.locator('[data-a="trip-edit"]')).toHaveCount(0);
  await expect(page.locator('.tc [data-a="doc"]')).toHaveCount(2);                   // belgeler yine alınır
  await page.locator('[data-a="view"][data-v="loads"]').click();
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await pickP(page, 'l2').check();
  await expect(page.locator('#tg option[value="tt1"]')).toHaveCount(0);              // kilitli araç listede yok
});

test('depo: araca konmuş ama gelmemiş yük Bekleyenler\'de plakasıyla görünür; Geldi araçta kalır, Araçlar sekmesinde Geri al çıkar', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l.id === 'l1' ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);
  await expect(page.locator('tr.dr', { hasText: 'BEKLEYEN GÖNDERİCİ' })).toContainText('34 ABC 123');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('[data-a="arrive"]').click();
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'))).toMatchObject({ status: 'aracta', trip_id: 'tt1', arrived_by: 'Ahmet' });
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  await expect(page.locator('#p [data-a="undo"]')).toHaveCount(2);                   // l1 ve l5 artık gelmiş
  await page.locator('tr.dr', { hasText: 'BEKLEYEN GÖNDERİCİ' }).locator('[data-a="undo"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'))).toMatchObject({ status: 'aracta', arrived_at: null });
});


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
  await page.locator('[data-nk="lock-trip"]').click();
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
