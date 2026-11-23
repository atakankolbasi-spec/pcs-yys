// Nakliye müşteri ve depo sayfaları (nakliye.html): giriş, adım adım müşteri ekranı, masa başı depo ekranı, 5 saniyelik yenileme.
// Gerçek Supabase yerine tests/stub-vendor.js kullanılır. Tüm isimler, adresler, plakalar uydurmadır.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'stub-vendor.js'), 'utf8');
const NOW = new Date('2026-09-23T07:00:00Z');   // 23 Eylül 2026 Çarşamba 10:00 (İstanbul)

const customers = () => [
  { id: 'c1', name: 'ÖRNEK NAKLİYAT', carrier: 'ÖRNEK NAKLİYAT LTD\nTR: +90 000 000 00 00', cmr_notes: '* Birinci şart', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z' },
  { id: 'c2', name: 'DENEME LOJİSTİK', carrier: 'DENEME LOJİSTİK AŞ', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z' }
];
const mk = (id, customer_id, sender, consignee, extra = {}) => ({
  id, customer_id, sender, sender_addr: 'Örnek Mah. No: 1 İSTANBUL', consignee, consignee_addr: 'Str. Ornek nr. 1 Bucuresti', notify: '', pieces: 10, packing: 'KAP', goods: 'ÖRNEK MAL', weight: 1000,
  volume: null, country: 'Romanya', code: 'ROBU1400', dest_customs: 'BUCUREŞTI', broker: 'ÖRNEK GÜMRÜKLEME', expected_date: null, status: 'depoda', arrived_at: '2026-09-22T08:00:00Z', arrived_by: 'Depo',
  trip_id: null, note: '', created_by: 'Müşteri', created_at: `2026-09-2${id.slice(-1)}T07:00:00Z`, updated_at: '2026-09-22T08:00:00Z', ...extra
});
const loads = () => [
  mk('l1', 'c1', 'ÖRNEK GÖNDERİCİ BİR', 'ALICI BİR SRL', { pieces: 840, weight: 8803, goods: 'BANT' }),
  mk('l2', 'c1', 'ÖRNEK GÖNDERİCİ İKİ', 'ALICI İKİ SRL', { pieces: 4, weight: 1891, goods: 'KAĞIT' }),
  mk('l3', 'c1', 'ÖRNEK GÖNDERİCİ ÜÇ', 'ALICI ÜÇ SRL', { pieces: 7, weight: 3400, goods: 'KAHVE', dest_customs: 'ARAD' }),
  mk('l4', 'c2', 'DENEME GÖNDERİCİ', 'DENEME ALICI SRL', { pieces: 5, weight: 500, goods: 'TORBA' }),
  mk('l5', 'c1', 'BEKLEYEN GÖNDERİCİ', 'BEKLEYEN ALICI SRL', { status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-25', goods: 'PLASTİK', inbound_plate: '35 XYZ 789' })
];
const planTrip = (extra = {}) => ({ id: 'tt1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '', depart_date: '2026-09-23', subject: '', status: 'hazirlaniyor', created_by: 'Müşteri', created_at: '2026-09-23T07:00:00Z', ...extra });
const tokens = () => ({ tokC1: { kind: 'musteri', customer: 'c1', active: true }, tokC2: { kind: 'musteri', customer: 'c2', active: true }, tokD: { kind: 'depo', active: true } });
const aracta = (ls, ...ids) => ls.map(l => ids.includes(l.id) ? { ...l, status: 'aracta', trip_id: 'tt1' } : l);
const waiting = (ls, ...ids) => ls.map(l => ids.includes(l.id) ? { ...l, status: 'bekliyor', arrived_at: null, arrived_by: '' } : l);
const user = (extra = {}) => ({ id: 'u1', customer_id: 'c1', username: 'ali.y', display_name: 'Ali Yılmaz', active: true, last_login_at: null, pw: 'sifre123', ...extra });

async function openPortal(page, query, cfg = {}, sess = '') {
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  const data = { shp_customers: customers(), shp_loads: loads(), shp_trips: [], shp_users: [], ...(cfg.data || {}) };
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: false, shpTokens: tokens(), ...cfg, data });
  if (sess) await page.addInitScript(t => { try { localStorage.setItem('pcs-nakliye-oturum', t); } catch (e) {} }, sess);
  await page.clock.install({ time: NOW });
  await page.goto('/nakliye.html' + query);
  return problems;
}
const pick = (page, id) => page.locator(`[data-a="pick"][data-id="${id}"]`);
const rpcCount = (page, name) => page.evaluate(n => window.__calls.filter(c => c.rpc === n).length, name);
const row = (page, text) => page.locator('li.lo', { hasText: text });
const drow = (page, text) => page.locator('tr.dr', { hasText: text });

test.use({ serviceWorkers: 'block' });

// ================================================================================================ müşteri: yükler (adım 1)
test('müşteri sayfası: yalnızca kendi yüklerini görür; hızlı ekle (getirecek kamyon plakası dahil), düzenle, sil', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await expect(page.locator('.top .brand b')).toContainText('ÖRNEK NAKLİYAT');
  await expect(page.locator('.steps')).toContainText('Yükleri yaz');
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  await expect(page.locator('#p')).not.toContainText('DENEME GÖNDERİCİ');            // başka müşteri
  await expect(page.locator('.live')).toContainText('Canlı');
  await page.locator('#qa-sender').fill('PORTAL GÖNDERİCİ');
  await page.locator('#qa-consignee').fill('   ');                                  // boşluk kaydedilmez
  await page.locator('form[data-f="quick"] button[type="submit"]').click();
  await expect(page.locator('#qa-err')).toContainText('Gönderici ve alıcı yazılmalı');
  await page.locator('#qa-consignee').fill('PORTAL ALICI SRL');
  await page.locator('#qa-goods').fill('KOLİ');
  await page.locator('#qa-pieces').fill('12');
  await page.locator('#qa-weight').fill('1.250,5');
  await page.locator('#qa-plate').fill('34 klm 521');
  await page.locator('form[data-f="quick"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  await expect(row(page, 'PORTAL GÖNDERİCİ')).toContainText('34 KLM 521');
  await expect(page.locator('#qa-sender')).toHaveValue('');
  await expect(page.locator('#qa-plate')).toHaveValue('34 klm 521');                  // aynı kamyon birden çok yük getirir
  const saved = await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'PORTAL GÖNDERİCİ'));
  expect(saved).toMatchObject({ customer_id: 'c1', status: 'bekliyor', weight: 1250.5, pieces: 12, goods: 'KOLİ', inbound_plate: '34 KLM 521', created_by: 'Müşteri (bağlantı)' });
  // düzenle (tam form)
  await row(page, 'PORTAL GÖNDERİCİ').locator('[data-a="edit"]').click();
  await expect(page.locator('#m h2')).toContainText('Yükü düzenle');
  await expect(page.locator('#m [name="inbound_plate"]')).toHaveValue('34 KLM 521');
  await page.locator('#m [name="goods"]').fill('YENİ MAL');
  await page.locator('#m button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  expect(await page.evaluate(() => window.__db.shp_loads.filter(l => l.goods === 'YENİ MAL').length)).toBe(1);
  // sil: iki adım
  const n0 = await page.evaluate(() => window.__db.shp_loads.length);
  await row(page, 'PORTAL GÖNDERİCİ').locator('[data-a="del"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0);
  await row(page, 'PORTAL GÖNDERİCİ').locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.length)).toBe(n0 - 1);
  expect(problems).toEqual([]);
});

test('müşteri: tam formda zorunlu alanlar ve sayı kontrolü', async ({ page }) => {
  await openPortal(page, '?m=tokC1');
  await page.locator('[data-a="add-full"]').click();
  const f = page.locator('#m form[data-f="load"]');
  await f.locator('[name="sender"]').fill('TAM GÖNDERİCİ');
  await f.locator('[name="consignee"]').fill('   ');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#ferr')).toContainText('Gönderici ve alıcı yazılmalı');
  await f.locator('[name="consignee"]').fill('TAM ALICI');
  await f.locator('[name="weight"]').fill('abc');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#ferr')).toContainText('sayı olarak');
  await f.locator('[name="weight"]').fill('250');
  await f.locator('[name="dest_customs"]').fill('SIBIU');
  await f.locator('button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'TAM GÖNDERİCİ'))).toMatchObject({ weight: 250, dest_customs: 'SIBIU' });
});

test('müşteri: yazdığı firma ve araç bilgileri saklanır; bir daha yazmaya gerek kalmaz (öneri + kendiliğinden doldurma)', async ({ page }) => {
  const contacts = [
    { customer_id: 'c1', kind: 'consignee', name: 'DORNA FOODS SRL', addr: 'Str. Dorna 5 Bucuresti', notify: 'NOTIFY DORNA', country: 'ROMANYA', dest_customs: 'BUCUREŞTI', code: 'ROBU1400', broker: 'ÖRNEK GÜMRÜKLEME' },
    { customer_id: 'c1', kind: 'sender', name: 'KAYA AMBALAJ', addr: 'Bursa Örnek Sanayi No: 9', notify: '', country: '', dest_customs: '', code: '', broker: '' }];
  await openPortal(page, '?m=tokC1', { data: { shp_contacts: contacts, shp_vehicles: [{ customer_id: 'c1', tractor: '34 ABC 123', trailer: '34 DEF 456' }] } });
  await expect(page.locator('#dl-consignee option[value="DORNA FOODS SRL"]')).toHaveCount(1);
  await expect(page.locator('#dl-sender option[value="KAYA AMBALAJ"]')).toHaveCount(1);
  await expect(page.locator('#dl-tractor option[value="34 ABC 123"]')).toHaveCount(1);
  // hızlı ekle: kayıtlı firma yazılınca adres, ülke, gümrük kendiliğinden eklenir (harf farkı fark etmez)
  await page.locator('#qa-sender').fill('kaya ambalaj');
  await page.locator('#qa-consignee').fill('dorna foods srl');
  await expect(page.locator('#qa-hint')).toContainText('Kayıtlı gönderici ve alıcı');
  await page.locator('#qa-weight').fill('500');
  await page.locator('form[data-f="quick"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'kaya ambalaj'))).toMatchObject({
    sender_addr: 'Bursa Örnek Sanayi No: 9', consignee_addr: 'Str. Dorna 5 Bucuresti', notify: 'NOTIFY DORNA', country: 'ROMANYA', dest_customs: 'BUCUREŞTI', code: 'ROBU1400', broker: 'ÖRNEK GÜMRÜKLEME', weight: 500 });
  // tam form: kayıtlı alıcı seçilince boş alanlar dolar, yazılmış olanın üstüne yazılmaz
  await page.locator('#qa-consignee').fill('DORNA FOODS SRL');
  await page.locator('[data-a="add-full"]').click();
  await expect(page.locator('#m [name="consignee_addr"]')).toHaveValue('Str. Dorna 5 Bucuresti');
  await expect(page.locator('#m [name="country"]')).toHaveValue('ROMANYA');
  await page.locator('#m [name="consignee"]').fill('');
  await page.locator('#m [name="notify"]').fill('BENİM NOTIFY');
  await page.locator('#m [name="consignee"]').fill('DORNA FOODS SRL');
  await page.locator('#m [name="consignee"]').dispatchEvent('change');
  await expect(page.locator('#m [name="notify"]')).toHaveValue('BENİM NOTIFY');
  await page.locator('[data-a="mclose"]').first().click();
  // kayıtlı araç: dokununca çekici ve dorse plakası dolar; yeni araç da kaydedilir
  await pick(page, 'l1').check();
  await page.locator('.vc', { hasText: '34 ABC 123' }).click();
  await expect(page.locator('#nv-tractor')).toHaveValue('34 ABC 123');
  await expect(page.locator('#nv-trailer')).toHaveValue('34 DEF 456');
  await page.locator('#nv-tractor').fill('06 YENI 06');
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('PCS-26-0001');
  const veh = await page.evaluate(() => window.__db.shp_vehicles.map(v => v.tractor));
  expect(veh).toContain('06 YENI 06');
  await expect(page.locator('#dl-tractor option[value="06 YENI 06"]')).toHaveCount(1);
});

// ================================================================================================ müşteri: araçlar (adım 2) ve belgeler (adım 3)
test('müşteri: yüklerini yeni araca koyar (depoya gelmemiş yük de); Poz No otomatik; belgeler hazır', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await pick(page, 'l1').check();                                                    // depoda
  await pick(page, 'l5').check();                                                    // depoya henüz gelmemiş
  await expect(page.locator('.steps')).toContainText('2 yük seçili');
  await expect(page.locator('.p2 .sum')).toContainText('2 yük · 9.803 kg');
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Hangi araca');
  await page.locator('[data-a="target"][data-id="new"]').click();
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Çekici plakasını yazın');
  await page.locator('#nv-tractor').fill('34 abc 123');
  await page.locator('#nv-trailer').fill('34 def 456');
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('PCS-26-0001');
  const card = page.locator('.veh:not(.new)');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('34 ABC 123');
  await expect(card).toContainText('34 DEF 456');
  await expect(card).toContainText('1 yük depoya gelmedi');
  await expect(card).toContainText('%41');                                           // 9.803 kg / 24 t
  await expect(card.locator('.vl li')).toHaveCount(2);
  const calls = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_portal_assign').map(c => c.params));
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ p_token: 'tokC1', p_tractor: '34 abc 123', p_trailer: '34 def 456', p_trip: null });
  expect(calls[0].p_load_ids.sort()).toEqual(['l1', 'l5']);
  const db = await page.evaluate(() => ({ trip: window.__db.shp_trips[0], l1: window.__db.shp_loads.find(l => l.id === 'l1'), l5: window.__db.shp_loads.find(l => l.id === 'l5') }));
  expect(db.trip).toMatchObject({ poz_no: 'PCS-26-0001', status: 'hazirlaniyor', tractor: '34 ABC 123' });
  expect(db.l1).toMatchObject({ status: 'aracta', trip_id: db.trip.id });
  expect(db.l5).toMatchObject({ status: 'aracta', trip_id: db.trip.id, arrived_at: null });
  // adım 3: belgeler bu araç için hazır
  await expect(page.locator('.p3')).toContainText('PCS-26-0001 aracı için hazır');
  await expect(page.locator('.p3 .sum')).toContainText('BUCUREŞTI');
  await page.locator('.p3 [data-a="doc"][data-kind="lade"]').first().click();
  const lade = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(lade).toContain('34 ABC 123');
  expect(lade).toContain('34 DEF 456');
  expect(lade).toContain('BEKLEYEN GÖNDERİCİ');
  expect(problems).toEqual([]);
});

test('müşteri: belgeler birlikte ya da tek tek açılır; araç kartından başka araca geçilir', async ({ page }) => {
  const ls = aracta(loads(), 'l1').map(l => l.id === 'l2' ? { ...l, status: 'aracta', trip_id: 'tt2' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip(), planTrip({ id: 'tt2', poz_no: 'PCS-26-0002', tractor: '06 ZZ 999', created_at: '2026-09-23T08:00:00Z' })] } });
  await expect(page.locator('.p3')).toContainText('PCS-26-0002');                    // en yeni araç
  await page.locator('.veh', { hasText: 'PCS-26-0001' }).locator('[data-a="doctrip"]').click();
  await expect(page.locator('.p3')).toContainText('PCS-26-0001 aracı için hazır');
  await page.locator('.p3 [data-a="docs-both"]').click();
  await expect(page.locator('#nkb-dlg')).toBeVisible();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveCount(2);              // Lade Liste ve CMR sekmeleri
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('L A D E');
  await page.locator('#nkb-dlg [data-nkb-tab="1"]').click();
  const cmr = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(cmr).toContain('34 ABC 123');
  expect(cmr).not.toContain('L A D E');
});

test('müşteri: mevcut aracına yük ekler, araçtan çıkarır (gelmemiş yük bekleyene, gelmiş yük depoya döner), plakayı düzeltir', async ({ page }) => {
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: aracta(loads(), 'l1', 'l5'), shp_trips: [planTrip()] } });
  await pick(page, 'l2').check();
  await page.locator('[data-a="target"][data-id="tt1"]').click();
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('PCS-26-0001');
  await expect(page.locator('.veh .vl li')).toHaveCount(3);
  // çıkar: l5 hiç gelmemişti -> bekliyor; l1 gelmişti -> depoda
  await page.locator('.vl li', { hasText: 'BEKLEYEN GÖNDERİCİ' }).locator('[data-a="unassign"]').click();
  await page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="unassign"]').click();
  const st = await page.evaluate(() => Object.fromEntries(window.__db.shp_loads.map(l => [l.id, l.status + (l.trip_id ? '*' : '')])));
  expect(st).toMatchObject({ l5: 'bekliyor', l1: 'depoda', l2: 'aracta*' });
  // plakayı düzelt
  await page.locator('[data-a="trip-edit"]').click();
  await page.locator('#te-tractor').fill('06 zz 999');
  await page.locator('[data-a="trip-save"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  await expect(page.locator('.veh:not(.new)')).toContainText('06 ZZ 999');
  // son yükü de çıkarınca araç kalkar
  await page.locator('.vl [data-a="unassign"]').click();
  await expect(page.locator('.veh:not(.new)')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.shp_trips.length)).toBe(0);
});

test('müşteri: yola çıkıp kilitlenen araçta değişiklik yapamaz', async ({ page }) => {
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: aracta(loads(), 'l1'), shp_trips: [planTrip({ status: 'yolda' })] } });
  await expect(page.locator('.veh.lk')).toContainText('Yolda · kilitli');
  await page.locator('.veh.lk [data-a="toggle"]').click();
  await expect(page.locator('.veh.lk .vl li')).toHaveCount(1);
  await expect(page.locator('.veh.lk [data-a="unassign"], .veh.lk [data-a="edit"], .veh.lk [data-a="target"]')).toHaveCount(0);
  await expect(page.locator('[data-a="trip-edit"]')).toHaveCount(0);
  await expect(page.locator('.p3 [data-a="doc"]')).toHaveCount(4);                   // belgeler yine alınır (resim + düğme)
  await expect(page.locator('.p3')).toContainText('kilitlendi');
  await pick(page, 'l2').check();
  await page.locator('[data-a="assign"]').click();
  await expect(page.locator('#toast')).toContainText('Hangi araca');                 // kilitli araç seçilemez
});

test('müşteri: depoya gelmiş yük düzenlenir ve silinir; araçtaki yük de düzenlenir ve silinir (yola çıkmadıysa); kilitli araçtaki hiçbiri', async ({ page }) => {
  const cfg = st => ({ data: { shp_customers: customers(), shp_loads: aracta(loads(), 'l3'), shp_trips: [planTrip(st)] } });
  await openPortal(page, '?m=tokC1', cfg());
  await page.locator('[data-a="scope"][data-v="all"]').click();
  await expect(row(page, 'ÖRNEK GÖNDERİCİ BİR').locator('[data-a="edit"]')).toHaveCount(1);   // depoda: düzenlenir
  await expect(row(page, 'ÖRNEK GÖNDERİCİ BİR').locator('[data-a="del"]')).toHaveCount(1);    // ... ve silinir
  await expect(row(page, 'ÖRNEK GÖNDERİCİ ÜÇ').locator('[data-a="edit"]')).toHaveCount(1);    // araçta (kilitsiz): düzenlenir
  await expect(row(page, 'ÖRNEK GÖNDERİCİ ÜÇ').locator('[data-a="del"]')).toHaveCount(1);     // ... ve silinir
  await expect(row(page, 'ÖRNEK GÖNDERİCİ ÜÇ')).toContainText('PCS-26-0001');
  await expect(row(page, 'ÖRNEK GÖNDERİCİ ÜÇ').locator('input[data-a="pick"]')).toHaveCount(0);
  await row(page, 'ÖRNEK GÖNDERİCİ BİR').locator('[data-a="del"]').click();
  await row(page, 'ÖRNEK GÖNDERİCİ BİR').locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l1'))).toBe(false);
  // kilitli araç
  const p2 = await page.context().newPage();
  await openPortal(p2, '?m=tokC1', cfg({ status: 'yolda' }));
  await p2.locator('[data-a="scope"][data-v="all"]').click();
  await expect(row(p2, 'ÖRNEK GÖNDERİCİ ÜÇ')).toBeVisible();
  await expect(row(p2, 'ÖRNEK GÖNDERİCİ ÜÇ').locator('[data-a="edit"], [data-a="del"]')).toHaveCount(0);
});

test('müşteri: araçtaki yük silinir (kartından ya da listeden); depo "yüklendi" işaretlediyse silinemez', async ({ page }) => {
  const ls = aracta(loads(), 'l1', 'l2').map(l => l.id === 'l2' ? { ...l, loaded_at: '2026-09-23T06:30:00Z', loaded_by: 'Ahmet' } : l);
  await openPortal(page, '?m=tokC1', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('[data-a="scope"][data-v="all"]').click();
  await expect(row(page, 'ÖRNEK GÖNDERİCİ İKİ').locator('[data-a="del"]')).toHaveCount(0);     // depo yüklendi dedi: silinemez
  await expect(row(page, 'ÖRNEK GÖNDERİCİ BİR').locator('[data-a="del"]')).toHaveCount(1);
  // araç kartındaki yük listesinden de silinir
  await page.locator('.veh [data-a="toggle"]').click();
  await expect(page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="del"]')).toHaveCount(1);
  await expect(page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ İKİ' }).locator('[data-a="del"]')).toHaveCount(0);
  await page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="del"]').click();
  await expect(page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="del"]')).toContainText('Evet, sil');
  await page.locator('.vl li', { hasText: 'ÖRNEK GÖNDERİCİ BİR' }).locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l1'))).toBe(false);
  expect(await page.evaluate(() => window.__db.shp_trips.some(t => t.id === 'tt1'))).toBe(true);   // araçta hâlâ yük var
  // sunucu da yüklendi işaretli yükün silinmesini reddeder
  const r = await page.evaluate(() => window.PCSNKP.rpc('shp_portal_delete', { p_id: 'l2' }));
  expect(r.error && r.error.message).toContain('yüklenmiş');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l2'))).toBe(true);
});

test('müşteri: aracı sil — yalnız araç (yükler boşta kalır) ya da araç ve yükleri birlikte; vazgeçilir; yüklenmiş yük varsa silinmez; yoldaki araçta düğme yok', async ({ page }) => {
  const cfg = (st, extra) => ({ data: { shp_customers: customers(), shp_loads: aracta(loads(), 'l1', 'l2').map(l => extra && l.id === 'l2' ? { ...l, ...extra } : l), shp_trips: [planTrip(st ? { status: st } : {})] } });
  await openPortal(page, '?m=tokC1', cfg());
  const veh = page.locator('.veh', { hasText: 'PCS-26-0001' });
  await expect(page.locator('.tdel')).toHaveCount(0);
  await veh.locator('[data-a="tdel"]').click();
  await expect(page.locator('.tdel')).toContainText('PCS-26-0001');
  await expect(page.locator('.tdel')).toContainText('2 yük');
  await page.locator('.tdel [data-a="tdel-no"]').click();                                       // vazgeç
  await expect(page.locator('.tdel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.shp_trips.length)).toBe(1);
  // yalnız aracı sil: yükler boşta döner
  await veh.locator('[data-a="tdel"]').click();
  await page.locator('.tdel [data-a="tdel-go"][data-w="0"]').click();
  await expect(page.locator('#toast')).toContainText('Araç silindi');
  const st = await page.evaluate(() => ({ trips: window.__db.shp_trips.length, l1: window.__db.shp_loads.find(l => l.id === 'l1'), l2: window.__db.shp_loads.find(l => l.id === 'l2') }));
  expect(st.trips).toBe(0);
  expect([st.l1.status, st.l1.trip_id, st.l2.status, st.l2.trip_id]).toEqual(['depoda', null, 'depoda', null]);
  await expect(page.locator('.veh', { hasText: 'PCS-26-0001' })).toHaveCount(0);
  await expect(row(page, 'ÖRNEK GÖNDERİCİ BİR')).toBeVisible();                                 // yük "Araca konmamış" listesinde
  // araç ve yükleri birlikte sil
  const p2 = await page.context().newPage();
  await openPortal(p2, '?m=tokC1', cfg());
  await p2.locator('.veh', { hasText: 'PCS-26-0001' }).locator('[data-a="tdel"]').click();
  await p2.locator('.tdel [data-a="tdel-go"][data-w="1"]').click();
  await expect(p2.locator('#toast')).toContainText('Araç ve 2 yük silindi');
  const st2 = await p2.evaluate(() => ({ trips: window.__db.shp_trips.length, l1: window.__db.shp_loads.some(l => l.id === 'l1'), l2: window.__db.shp_loads.some(l => l.id === 'l2'), other: window.__db.shp_loads.some(l => l.id === 'l4') }));
  expect(st2).toEqual({ trips: 0, l1: false, l2: false, other: true });                          // başka müşterinin yükü durur
  // depo yük yüklemişse silinemez
  const p3 = await page.context().newPage();
  await openPortal(p3, '?m=tokC1', cfg('hazirlaniyor', { loaded_at: '2026-09-23T06:30:00Z', loaded_by: 'Ahmet' }));
  await p3.locator('.veh', { hasText: 'PCS-26-0001' }).locator('[data-a="tdel"]').click();
  await expect(p3.locator('.tdel')).toContainText('depo bu araca yük yüklemiş');
  await expect(p3.locator('.tdel [data-a="tdel-go"]')).toHaveCount(0);
  // yola çıkmış (kilitli) araçta düğme yok
  const p4 = await page.context().newPage();
  await openPortal(p4, '?m=tokC1', cfg('yolda'));
  await expect(p4.locator('.veh.lk')).toBeVisible();
  await expect(p4.locator('.veh [data-a="tdel"]')).toHaveCount(0);
});

// ================================================================================================ bağlantı ve giriş
test('geçersiz ya da kapatılmış bağlantı anlaşılır uyarı verir; kurulum yoksa bunu söyler', async ({ page }) => {
  await openPortal(page, '?m=yanlis');
  await expect(page.locator('#p')).toContainText('geçersiz ya da kapatılmış');
  const p2 = await page.context().newPage();
  const t = tokens(); t.tokC1.active = false;
  await openPortal(p2, '?m=tokC1', { shpTokens: t });
  await expect(p2.locator('#p')).toContainText('geçersiz ya da kapatılmış');
  const p3 = await page.context().newPage();
  await openPortal(p3, '?m=tokC1', { missing: ['shp-rpc'] });
  await expect(p3.locator('#p')).toContainText('henüz kurulmamış');
  const p4 = await page.context().newPage();
  await openPortal(p4, '?d=tokD', { missing: ['shp-rpc'] });
  await expect(p4.locator('#p')).toContainText('henüz kurulmamış');
});

test('bağlantısız açılan sayfa kullanıcı girişi ister (sunucuya hiçbir istek gitmez)', async ({ page }) => {
  const problems = await openPortal(page, '');
  await expect(page.locator('#lg-u')).toBeVisible();
  await expect(page.locator('#lg-p')).toHaveAttribute('type', 'password');
  expect(await page.evaluate(() => window.__calls.filter(c => c.rpc).length)).toBe(0);
  expect(problems).toEqual([]);
});

test('kullanıcısı olan müşterinin bağlantısı giriş ister; yanlış şifre, doğru şifre, işlemler kullanıcının adıyla kaydedilir, çıkış', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1', { data: { shp_users: [user()] } });
  await expect(page.locator('#lg-u')).toBeVisible();                                 // bağlantı tek başına yetmez
  await expect(page.locator('#p')).not.toContainText('BEKLEYEN GÖNDERİCİ');
  await page.locator('form[data-f="login"] button[type="submit"]').click();
  await expect(page.locator('#lg-err')).toContainText('yazın');
  await page.locator('#lg-u').fill('ali.y');
  await page.locator('#lg-p').fill('yanlis');
  await page.locator('form[data-f="login"] button[type="submit"]').click();
  await expect(page.locator('#lg-err')).toContainText('hatalı');
  await page.locator('#lg-p').fill('sifre123');
  await page.locator('form[data-f="login"] button[type="submit"]').click();
  await expect(page.locator('.uchip')).toContainText('Ali Yılmaz');
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  expect(await page.evaluate(() => localStorage.getItem('pcs-nakliye-oturum'))).toMatch(/^oturum/);
  // yük ekler: kayıtta kullanıcının adı var, "Son işlemler"de görünür
  await page.locator('#qa-sender').fill('GİRİŞLİ GÖNDERİCİ');
  await page.locator('#qa-consignee').fill('GİRİŞLİ ALICI');
  await page.locator('form[data-f="quick"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Yük eklendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.sender === 'GİRİŞLİ GÖNDERİCİ').created_by)).toBe('Müşteri · Ali Yılmaz');
  await expect(page.locator('.log')).toContainText('Yük eklendi');
  await expect(page.locator('.log')).toContainText('Ali Yılmaz');
  const log = await page.evaluate(() => window.__db.shp_log.map(x => `${x.role}:${x.actor}:${x.action}`));
  expect(log).toContain('musteri:Müşteri · Ali Yılmaz:Giriş yaptı');
  // çıkış: oturum silinir, giriş ekranı gelir
  await page.locator('[data-a="logout"]').click();
  await expect(page.locator('#lg-u')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pcs-nakliye-oturum'))).toBeNull();
  expect(await rpcCount(page, 'shp_logout')).toBe(1);
  expect(problems).toEqual([]);
});

test('giriş: kayıtlı oturumla doğrudan açılır; oturum sona erince giriş ekranı döner; 5 yanlış denemeden sonra kilitlenir', async ({ page }) => {
  await openPortal(page, '', { data: { shp_users: [user()] }, shpSessions: { oturumA: 'u1' } }, 'oturumA');
  await expect(page.locator('.uchip')).toContainText('Ali Yılmaz');
  await expect(page.locator('#lg-u')).toHaveCount(0);
  await page.evaluate(() => { window.__PCS_STUB.shpSessions = {}; });                 // ofis şifreyi değiştirdi / oturumu kapattı
  await page.clock.runFor(5100);
  await expect(page.locator('#lg-u')).toBeVisible();
  await expect(page.locator('#lg-err')).toContainText('sona erdi');
  for (let i = 0; i < 5; i++) {
    await page.locator('#lg-u').fill('ali.y');
    await page.locator('#lg-p').fill('yanlis' + i);
    await page.locator('form[data-f="login"] button[type="submit"]').click();
    await expect(page.locator('#lg-err')).toContainText('hatalı');
  }
  await page.locator('#lg-u').fill('ali.y');
  await page.locator('#lg-p').fill('sifre123');                                      // doğru şifre bile kilitliyken geçmez
  await page.locator('form[data-f="login"] button[type="submit"]').click();
  await expect(page.locator('#lg-err')).toContainText('Çok fazla hatalı deneme');
  await expect(page.locator('#lg-u')).toBeVisible();
});

// ================================================================================================ 5 saniyelik otomatik yenileme
test('müşteri ekranı 5 saniyede bir kendiliğinden yenilenir; değişiklik yoksa veri çekilmez; bağlantı kopunca uyarır', async ({ page }) => {
  const problems = await openPortal(page, '?m=tokC1');
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  const n0 = await rpcCount(page, 'shp_portal');
  await page.clock.runFor(5100);
  await expect.poll(() => rpcCount(page, 'shp_stamp')).toBeGreaterThan(1);
  expect(await rpcCount(page, 'shp_portal')).toBe(n0);                               // değişmedi: yalnızca hafif damga sorgusu
  await page.evaluate(() => window.__db.shp_loads.push({ id: 'lz', customer_id: 'c1', sender: 'SONRADAN YAZILAN', sender_addr: '', consignee: 'X ALICI', consignee_addr: '', notify: '', pieces: 1, packing: 'KAP', goods: '', weight: 1, volume: null, country: '', code: '', dest_customs: '', broker: '', expected_date: null, status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, note: '', inbound_plate: '', created_by: 'ofis', created_at: '2026-09-23T07:00:00Z', updated_at: '2026-09-23T07:00:00Z' }));
  await page.clock.runFor(5100);
  await expect(page.locator('#p')).toContainText('SONRADAN YAZILAN');
  expect(await rpcCount(page, 'shp_portal')).toBe(n0 + 1);
  // yazarken yenileme yazıyı bozmaz
  await page.locator('#qa-sender').fill('YARIM YAZI');
  await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'lz').weight = 2);
  await page.clock.runFor(5100);
  await expect(page.locator('#qa-sender')).toHaveValue('YARIM YAZI');
  // bağlantı koptu
  await page.evaluate(() => { window.__PCS_STUB.offline = true; });
  await page.clock.runFor(5100);
  await expect(page.locator('.live.off')).toContainText('Bağlantı yok');
  await page.evaluate(() => { window.__PCS_STUB.offline = false; });
  await page.clock.runFor(5100);
  await expect(page.locator('.live.ok')).toBeVisible();
  expect(problems.filter(p => !/Failed to fetch/.test(p))).toEqual([]);
});

test('depo ekranı 5 saniyede bir kendiliğinden yenilenir (yeni yük görünür); damga işlevi yoksa her seferinde çeker', async ({ page }) => {
  await openPortal(page, '?d=tokD');
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);
  const newLoad = { id: 'lz', customer_id: 'c2', sender: 'SONRADAN GELEN', sender_addr: '', consignee: 'X', consignee_addr: '', notify: '', pieces: 1, packing: 'KAP', goods: '', weight: 1, volume: null, country: '', code: '', dest_customs: '', broker: '', expected_date: null, status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, note: '', inbound_plate: '', created_by: 'x', created_at: '2026-09-23T07:00:00Z', updated_at: '2026-09-23T07:00:00Z' };
  await page.evaluate(l => window.__db.shp_loads.push(l), newLoad);
  await page.clock.runFor(5100);
  await expect(page.locator('#p')).toContainText('SONRADAN GELEN');
  const p2 = await page.context().newPage();
  await openPortal(p2, '?d=tokD', { missing: ['shp-stamp'] });
  await expect(p2.locator('[data-a="arrive"]')).toHaveCount(1);
  await p2.evaluate(l => window.__db.shp_loads.push(l), newLoad);
  await p2.clock.runFor(5100);
  await expect(p2.locator('#p')).toContainText('SONRADAN GELEN');
});

// ================================================================================================ depo ekranı
test('depo: Geldi işaretler (adıyla), Geri al ile döner; müşteriye göre gruplar; getirecek araç plakası görünür ve aranır', async ({ page }) => {
  const problems = await openPortal(page, '?d=tokD');
  await expect(page.locator('.top .brand b')).toContainText('Depo ekranı');
  await expect(page.locator('.kp .k')).toHaveCount(5);
  await expect(page.locator('tr.g', { hasText: 'ÖRNEK NAKLİYAT' })).toBeVisible();
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
  expect(await page.evaluate(() => window.__db.shp_log.filter(x => x.role === 'depo').map(x => x.actor + ':' + x.action))).toContain('Depo · Ahmet:Depoya geldi olarak işaretlendi');
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('#p')).toContainText('BEKLEYEN GÖNDERİCİ');
  await drow(page, 'BEKLEYEN GÖNDERİCİ').locator('[data-a="undo"]').click();
  await expect(page.locator('#toast')).toContainText('geri alındı');
  expect(problems).toEqual([]);
});

test('depo: birden çok yükü seçip topluca "Geldi" işaretler; firma süzgeci, tümünü seç, Enter', async ({ page }) => {
  const ls = waiting(loads(), 'l2', 'l3', 'l4');
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [] } });
  await page.locator('#nm').fill('Ahmet');
  await expect(page.locator('.chips button')).toHaveCount(3);                        // tüm firmalar + 2 firma
  await expect(page.locator('.bulk')).toHaveCount(0);
  await pick(page, 'l2').check();
  await pick(page, 'l3').check();
  await expect(page.locator('.bulk')).toContainText('2 yük seçili');
  await expect(page.locator('.bulk')).toContainText('11 kap · 5.291 kg');
  await page.locator('[data-a="bulk"]').click();
  await expect(page.locator('#toast')).toContainText('2 yük geldi olarak işaretlendi');
  const st = await page.evaluate(() => Object.fromEntries(window.__db.shp_loads.map(l => [l.id, l.status])));
  expect(st).toMatchObject({ l2: 'depoda', l3: 'depoda', l4: 'bekliyor', l5: 'bekliyor' });
  expect(await rpcCount(page, 'shp_depot_mark')).toBe(2);
  await expect(page.locator('.bulk')).toHaveCount(0);
  // firma süzgeci + tümünü seç yalnızca görünenleri seçer
  await page.locator('.chips button', { hasText: 'DENEME LOJİSTİK' }).click();
  await expect(page.locator('tr.dr')).toHaveCount(1);
  await page.locator('[data-a="pickall"]').check();
  await expect(page.locator('.bulk')).toContainText('1 yük seçili');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('1 yük geldi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5').status)).toBe('bekliyor');
  // Depoda sekmesinde toplu geri alma
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await page.locator('.chips button', { hasText: 'Tüm firmalar' }).click();
  await pick(page, 'l2').check();
  await expect(page.locator('[data-a="bulk"]')).toContainText('geri al');
});

test('depo: çekmeceden yük bilgisini düzeltir (adres gibi diğer alanlar korunur) ve siler; araçtaki yük silinemez', async ({ page }) => {
  const ls = aracta(loads(), 'l1');
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await page.locator('#nm').fill('Ahmet');
  // depoda duran yükü düzelt (gerçek kap ve plaka)
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await drow(page, 'DENEME GÖNDERİCİ').locator('[data-a="edit"]').click();
  await expect(page.locator('#drw')).toContainText('Yükü düzenle');
  await page.locator('#dr-pieces').fill('9');
  await page.locator('#dr-inbound_plate').fill('06 xx 11');
  await page.locator('[data-a="dsave"]').click();
  await expect(page.locator('#toast')).toContainText('güncellendi');
  await expect(page.locator('#drw')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l4'))).toMatchObject({ pieces: 9, inbound_plate: '06 XX 11', sender_addr: 'Örnek Mah. No: 1 İSTANBUL', country: 'Romanya', broker: 'ÖRNEK GÜMRÜKLEME', weight: 500 });
  await expect(drow(page, 'DENEME GÖNDERİCİ')).toContainText('06 XX 11');
  const saveCall = await page.evaluate(() => window.__calls.filter(c => c.rpc === 'shp_depot_save').map(c => c.params.p_name));
  expect(saveCall).toEqual(['Ahmet']);
  // hatalı değer
  await drow(page, 'DENEME GÖNDERİCİ').locator('[data-a="edit"]').click();
  await page.locator('#dr-weight').fill('abc');
  await page.locator('[data-a="dsave"]').click();
  await expect(page.locator('#derr')).toContainText('sayı');
  await page.keyboard.press('Escape');
  await expect(page.locator('#drw')).toHaveCount(0);
  // bekleyen yükü sil (iki adım)
  await page.locator('[data-a="tab"][data-v="bekliyor"]').click();
  await drow(page, 'BEKLEYEN GÖNDERİCİ').locator('[data-a="del"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l5'))).toBe(true);
  await drow(page, 'BEKLEYEN GÖNDERİCİ').locator('[data-a="del"]').click();
  await expect(page.locator('#toast')).toContainText('Yük silindi');
  expect(await page.evaluate(() => window.__db.shp_loads.some(l => l.id === 'l5'))).toBe(false);
  // araçtaki yükte Sil yok (satırda da çekmecede de), Düzenle var
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  const r1 = drow(page, 'ÖRNEK GÖNDERİCİ BİR');
  await expect(r1.locator('[data-a="edit"]')).toHaveCount(1);
  await expect(r1.locator('[data-a="del"]')).toHaveCount(0);
  await r1.locator('[data-a="edit"]').click();
  await expect(page.locator('#drw')).toBeVisible();
  await expect(page.locator('[data-a="ddel"]')).toHaveCount(0);
});

test('depo: araca konmuş ama gelmemiş yük Bekleyenler\'de plakasıyla görünür; Geldi araçta kalır, Araçlar sekmesinde Geri al çıkar', async ({ page }) => {
  const ls = aracta(loads(), 'l5', 'l1');
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [planTrip()] } });
  await expect(page.locator('[data-a="arrive"]')).toHaveCount(1);
  await expect(drow(page, 'BEKLEYEN GÖNDERİCİ')).toContainText('34 ABC 123');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('[data-a="arrive"]').click();
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'))).toMatchObject({ status: 'aracta', trip_id: 'tt1', arrived_by: 'Ahmet' });
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  await expect(page.locator('#p [data-a="undo"]')).toHaveCount(2);                   // l1 ve l5 artık gelmiş
  await expect(page.locator('tr.gt')).toContainText('PCS-26-0001');
  await expect(page.locator('tr.gt [data-a="doc"]')).toHaveCount(2);
  await drow(page, 'BEKLEYEN GÖNDERİCİ').locator('[data-a="undo"]').click();
  expect(await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l5'))).toMatchObject({ status: 'aracta', arrived_at: null });
});

test('depo: göstergeler ve geciken yük', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l5' ? { ...l, expected_date: '2026-09-20' } : l.id === 'l4' ? { ...l, arrived_at: '2026-09-23T06:00:00Z' } : l);
  await openPortal(page, '?d=tokD', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: [] } });
  const k = name => page.locator('.k', { hasText: name }).locator('b');
  await expect(k('Bekleyen')).toHaveText('1');
  await expect(k('Geciken')).toHaveText('1');
  await expect(k('Bugün gelen')).toHaveText('1');
  await expect(k('Depoda')).toHaveText('4');
  await expect(drow(page, 'BEKLEYEN GÖNDERİCİ')).toContainText('Gecikti');
});
