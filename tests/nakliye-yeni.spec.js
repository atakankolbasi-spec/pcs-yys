// Nakliye yeni özellikler: Takip, bildirim ayarı, Rapor ve arşiv, Ofisle yazışma, Excel'den toplu yük, QR etiket,
// depo Program / yükleme kontrolü / Teslim al (sayım, fotoğraf, raf) / Okut. Gerçek Supabase yerine tests/stub-vendor.js kullanılır.
// Tüm isimler, adresler, plakalar uydurmadır.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'stub-vendor.js'), 'utf8');
const NOW = new Date('2026-09-23T07:00:00Z');   // 23 Eylül 2026 Çarşamba 10:00 (İstanbul)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const customers = () => [
  { id: 'c1', name: 'ÖRNEK NAKLİYAT', carrier: 'ÖRNEK NAKLİYAT LTD', cmr_notes: '* Birinci şart', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z',
    notify_phone: '+90 532 000 00 00', notify_events: { geldi: true, yola: true, teslim: true, sorun: true, mesaj: false } },
  { id: 'c2', name: 'DENEME LOJİSTİK', carrier: 'DENEME LOJİSTİK AŞ', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '', active: true, created_at: '2026-09-01T08:00:00Z' }
];
const L = (id, customer_id, sender, consignee, extra = {}) => ({
  id, customer_id, sender, sender_addr: 'Örnek Mah. No: 1 İSTANBUL', consignee, consignee_addr: 'Str. Ornek nr. 1', notify: '', pieces: 10, packing: 'KAP', goods: 'ÖRNEK MAL', weight: 1000, volume: null,
  country: 'Romanya', code: 'ROBU1400', dest_customs: 'BUCUREŞTI', broker: '', expected_date: null, expected_time: null, driver: '', status: 'depoda', arrived_at: '2026-09-22T08:00:00Z', arrived_by: 'Ahmet',
  trip_id: null, note: '', created_by: 'Müşteri', created_at: '2026-09-21T07:00:00Z', updated_at: '2026-09-22T08:00:00Z', qr_code: ('QRKOD' + id.toUpperCase()).padEnd(10, '0').slice(0, 10),
  location: '', condition: '', counted_pieces: null, counted_weight: null, receive_note: '', assigned_at: null, ...extra
});
const loads = () => [
  L('l1', 'c1', 'KAYA AMBALAJ SAN. A.Ş.', 'DORNA FOODS SRL', { pieces: 840, weight: 8803, goods: 'BANT', status: 'aracta', trip_id: 't1', assigned_at: '2026-09-22T14:20:00Z', inbound_plate: '34 KLM 521', location: 'A-3',
    condition: 'eksik', counted_pieces: 830, receive_note: '2 koli ıslak geldi', created_at: '2026-09-21T06:10:00Z' }),
  L('l2', 'c1', 'DEMİR GIDA LTD. ŞTİ.', 'COMPACT RB', { pieces: 4, weight: 1891, goods: 'KAĞIT', status: 'aracta', trip_id: 't2', assigned_at: '2026-09-23T05:15:00Z', created_at: '2026-09-20T13:40:00Z', arrived_at: '2026-09-22T06:05:00Z' }),
  L('l3', 'c1', 'YILDIZ PLASTİK A.Ş.', 'EUROFINA', { pieces: 1, weight: 207, goods: 'ŞİLTELİK', status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-23', expected_time: '15:00', inbound_plate: '35 XYZ 789', created_at: '2026-09-23T05:50:00Z', driver: 'Mehmet 0532 111 22 33' }),
  L('l4', 'c1', 'ÖZKAN METAL LTD.', 'ARTPACK SRL', { pieces: 4, weight: 1759, goods: 'BASKILI TORBA', status: 'aracta', trip_id: 't3', assigned_at: '2026-09-12T08:00:00Z', created_at: '2026-09-10T08:00:00Z', arrived_at: '2026-09-11T08:00:00Z' }),
  L('l5', 'c1', 'ÇELİK PLASTİK LTD.', 'DAKO SRL', { pieces: 12, weight: 6200, goods: 'GRANÜL', status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-23', expected_time: '09:30', inbound_plate: '16 DEF 456', driver: 'Ali 0533 444 55 66', created_at: '2026-09-22T07:00:00Z' }),
  L('l6', 'c1', 'BERK TEKSTİL A.Ş.', 'NOVA TEXTIL SRL', { pieces: 22, weight: 2140, goods: 'HAZIR GİYİM', status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-23', expected_time: '10:30', inbound_plate: '34 KLM 521', created_at: '2026-09-22T08:00:00Z' }),
  L('l7', 'c1', 'ARDA KİMYA', 'GOURMET SRL', { pieces: 7, weight: 3400, goods: 'KAHVE', status: 'bekliyor', arrived_at: null, arrived_by: '', expected_date: '2026-09-23', expected_time: '10:30', inbound_plate: '34 KLM 521', created_at: '2026-09-22T09:00:00Z' }),
  L('l8', 'c2', 'DENEME GÖNDERİCİ', 'DENEME ALICI SRL', { pieces: 5, weight: 500, goods: 'TORBA', status: 'depoda', arrived_at: '2026-09-23T05:42:00Z', location: 'A-1', arrived_by: 'Ahmet', created_at: '2026-09-22T10:00:00Z' })
];
const trips = () => [
  { id: 't1', poz_no: 'PCS-26-0001', customer_id: 'c1', tractor: '34 ABC 123', trailer: '34 DEF 456', depart_date: '2026-09-23', subject: '', status: 'yolda', departed_at: '2026-09-23T03:30:00Z', delivered_at: null, created_by: 'x', created_at: '2026-09-22T09:00:00Z', updated_at: '2026-09-22T09:00:00Z' },
  { id: 't2', poz_no: 'PCS-26-0002', customer_id: 'c1', tractor: '06 ZZ 999', trailer: '', depart_date: '2026-09-24', subject: '', status: 'hazirlaniyor', departed_at: null, delivered_at: null, created_by: 'x', created_at: '2026-09-23T05:00:00Z', updated_at: '2026-09-23T05:00:00Z' },
  { id: 't3', poz_no: 'PCS-26-0000', customer_id: 'c1', tractor: '35 OLD 111', trailer: '', depart_date: '2026-09-13', subject: '', status: 'teslim', departed_at: '2026-09-13T06:00:00Z', delivered_at: '2026-09-17T07:20:00Z', created_by: 'x', created_at: '2026-09-12T09:00:00Z', updated_at: '2026-09-17T09:00:00Z' }
];
const photos = () => [{ id: 'ph1', load_id: 'l1', customer_id: 'c1', thumb: 'data:image/jpeg;base64,/9j/AAAA', data: 'data:image/jpeg;base64,/9j/BBBB', by_name: 'Ahmet', created_at: '2026-09-22T08:00:00Z' }];
const messages = () => [
  { id: 'm1', customer_id: 'c1', from_role: 'musteri', author: 'Müşteri (bağlantı)', body: 'Yarın sabah çıkabilir mi?', trip_id: 't1', load_id: null, created_at: '2026-09-22T13:20:00Z', read_at: '2026-09-22T13:25:00Z' },
  { id: 'm2', customer_id: 'c1', from_role: 'ofis', author: 'Ofis', body: 'Evet, 06:00\'da çıkış planladık.', trip_id: null, load_id: null, created_at: '2026-09-22T13:48:00Z', read_at: null }
];
const tokens = () => ({ tokC1: { kind: 'musteri', customer: 'c1', active: true }, tokD: { kind: 'depo', active: true } });

async function open(page, query, extra = {}) {
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  await page.route('**/vendor.js', route => route.fulfill({ body: STUB, contentType: 'text/javascript' }));
  const data = { shp_customers: customers(), shp_loads: loads(), shp_trips: trips(), shp_users: [], shp_messages: messages(), shp_photos: photos(), ...(extra.data || {}) };
  await page.addInitScript(c => { window.__PCS_STUB = c; }, { session: false, shpTokens: tokens(), ...extra, data });
  await page.clock.install({ time: NOW });
  await page.goto('/nakliye.html' + query);
  return problems;
}
const customerPage = async (page, v, extra) => { const p = await open(page, '?m=tokC1', extra); await expect(page.locator('.pnav')).toBeVisible(); if (v) await page.locator(`[data-a="page"][data-v="${v}"]`).click(); return p; };
const depot = async (page, tab, extra) => { const p = await open(page, '?d=tokD', extra); await expect(page.locator('.dwrap')).toBeVisible(); if (tab) await page.locator(`[data-a="tab"][data-v="${tab}"]`).click(); return p; };
const rpcs = (page, name) => page.evaluate(n => window.__calls.filter(c => c.rpc === n).map(c => c.params), name);

test.use({ serviceWorkers: 'block' });

// ================================================================================================ müşteri: takip ve bildirim
test('müşteri: Takip sayfası her yükün durum çizgisini (yazıldı → geldi → araca kondu → yolda → teslim), sorunu ve fotoğrafı gösterir', async ({ page }) => {
  const problems = await customerPage(page, 'takip');
  await expect(page.locator('.tit')).toContainText('1 yük yolda');
  const kaya = page.locator('.ld', { hasText: 'KAYA AMBALAJ' });
  await expect(kaya.locator('.tl5 .s.done')).toHaveCount(4);                         // yazıldı, geldi, araca kondu, yolda
  await expect(kaya.locator('.tl5 .s.cur')).toContainText('Teslim');
  await expect(kaya).toContainText('A-3');                                           // raf konumu
  await expect(kaya.locator('.warnbox')).toContainText('Eksik var bildirildi');
  await expect(kaya.locator('.warnbox')).toContainText('beyan 840 kap, sayılan 830 kap');
  await expect(kaya.locator('.warnbox')).toContainText('2 koli ıslak geldi');
  const yildiz = page.locator('.ld', { hasText: 'YILDIZ PLASTİK' });
  await expect(yildiz.locator('.tl5 .s.done')).toHaveCount(1);                       // yalnızca yazıldı
  await expect(yildiz.locator('.tl5 .s.cur')).toContainText('Depoya geldi');
  await expect(yildiz.locator('.tl5 .s.cur')).toContainText('bekleniyor');
  await expect(yildiz.locator('.tl5 .s.cur')).toContainText('15:00');
  const demir = page.locator('.ld', { hasText: 'DEMİR GIDA' });
  await expect(demir.locator('.tl5 .s.done')).toHaveCount(3);                        // araca kondu, henüz yola çıkmadı
  await expect(demir.locator('.tl5 .s.cur')).toContainText('Yolda');
  await expect(page.locator('.sech')).toContainText('Teslim edilenler');
  const ozkan = page.locator('.ld', { hasText: 'ÖZKAN METAL' });
  await expect(ozkan.locator('.tl5 .s.done')).toHaveCount(5);
  await expect(ozkan).toContainText('Teslim edildi');
  // fotoğraf: küçük resim listesi, tıklayınca büyük resim
  await kaya.locator('[data-a="photos"]').click();
  await expect(page.locator('#m .pht')).toHaveCount(1);
  await expect(page.locator('#m .phbig')).toHaveAttribute('src', /BBBB/);
  expect(await rpcs(page, 'shp_portal_photos')).toEqual([{ p_token: 'tokC1', p_load: 'l1' }]);
  await page.locator('#m [data-a="mclose"]').first().click();
  // başka müşterinin yükü görünmez
  await expect(page.locator('.tk')).not.toContainText('DENEME GÖNDERİCİ');
  expect(problems).toEqual([]);
});

test('müşteri: bildirim numarası ve hangi haberleri alacağı kaydedilir; yanlış numara reddedilir', async ({ page }) => {
  await customerPage(page, 'takip');
  await expect(page.locator('#nf-phone')).toHaveValue('+90 532 000 00 00');
  await expect(page.locator('.wa')).toContainText('Yükünüz depoya geldi');             // örnek mesajlar
  await expect(page.locator('[data-i="nf-ev-mesaj"]')).not.toBeChecked();
  await page.locator('[data-i="nf-ev-mesaj"]').check();
  await page.locator('[data-i="nf-ev-geldi"]').uncheck();
  await page.locator('#nf-phone').fill('123');
  await page.locator('form[data-f="notify"] button[type="submit"]').click();
  await expect(page.locator('#nf-err')).toContainText('ülke ya da alan koduyla');
  await page.locator('#nf-phone').fill('+90 532 111 22 33');
  await page.locator('form[data-f="notify"] button[type="submit"]').click();
  await expect(page.locator('#toast')).toContainText('Bildirim ayarlarınız kaydedildi');
  const c1 = await page.evaluate(() => window.__db.shp_customers.find(c => c.id === 'c1'));
  expect(c1.notify_phone).toBe('+90 532 111 22 33');
  expect(c1.notify_events).toMatchObject({ geldi: false, mesaj: true, yola: true });
  await expect(page.locator('[data-i="nf-ev-geldi"]')).not.toBeChecked();
});

// ================================================================================================ müşteri: rapor ve arşiv
test('müşteri: Rapor sayfası göstergeleri, haftalık / aylık grafiği, en çok yük giden alıcıları ve sefer arşivini gösterir', async ({ page }) => {
  const problems = await customerPage(page, 'rapor');
  await expect(page.locator('.kp4 .k2')).toHaveCount(4);
  const monthLoads = await page.evaluate(() => window.__db.shp_loads.filter(l => l.customer_id === 'c1' && l.created_at.startsWith('2026-09')).length);
  await expect(page.locator('.kp4 .k2').first().locator('b')).toHaveText(String(monthLoads));
  await expect(page.locator('.kp4 .k2').nth(2).locator('b')).toHaveText('3');        // bu ay 3 sefer
  await expect(page.locator('.kp4 .k2').nth(3).locator('b')).toHaveText('4,1 gün');   // 13.09 06:00 → 17.09 07:20
  expect(await page.locator('.chart .c').count()).toBeGreaterThan(1);
  await page.locator('[data-a="rp-mode"][data-v="ay"]').click();
  await expect(page.locator('.rph h2')).toContainText('Aylık');
  await expect(page.locator('.top5')).toContainText('DORNA FOODS SRL');
  await expect(page.locator('.top5')).toContainText('8,8 t');
  const rows = page.locator('.tbl2 tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText('PCS-26-0002');                           // en yeni sefer üstte
  await expect(page.locator('.arh select')).toHaveValue('2026-09');
  // sefer belgeleri
  await rows.nth(1).locator('[data-a="arc-doc"]').click();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveCount(2);
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('34 ABC 123');
  await page.locator('#nkb-dlg [data-nkb="close"]').click();
  // ayın tüm belgeleri tek pencerede
  await page.locator('[data-a="arc-month"]').click();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveCount(6);              // 3 sefer × (Lade + CMR)
  await page.locator('#nkb-dlg [data-nkb="close"]').click();
  // Excel (CSV) dökümü
  const dl = page.waitForEvent('download');
  await page.locator('[data-a="rp-csv"]').click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^yuklerim-2026-09-23\.csv$/);
  const csv = fs.readFileSync(await file.path(), 'utf8');
  expect(csv).toContain('Poz No;Plaka;Gönderici');
  expect(csv).toContain('KAYA AMBALAJ SAN. A.Ş.');
  expect(csv).not.toContain('DENEME GÖNDERİCİ');
  expect(problems).toEqual([]);
});

test('müşteri: arşivdeki eski seferin belgeleri sunucudan hazırlanır (ana listede yükü yoksa)', async ({ page }) => {
  await customerPage(page, 'rapor', { data: { shp_customers: customers(), shp_loads: loads().filter(l => l.trip_id !== 't3'), shp_trips: trips(), shp_messages: [], shp_photos: [] } });
  // t3 yüklerini yerel listeden çıkardık; sunucu yine de seferin yüklerini verir
  await page.evaluate(() => window.__db.shp_loads.push({ id: 'old1', customer_id: 'c1', sender: 'ESKİ GÖNDERİCİ', sender_addr: '', consignee: 'ESKİ ALICI', consignee_addr: '', notify: '', pieces: 2, packing: 'KAP', goods: 'MAL', weight: 300, volume: null, country: '', code: '', dest_customs: 'ARAD', broker: '', status: 'aracta', trip_id: 't3', arrived_at: '2026-09-01T08:00:00Z', arrived_by: '', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', qr_code: 'ESKIKOD001' }));
  await page.locator('.tbl2 tbody tr', { hasText: 'PCS-26-0000' }).locator('[data-a="arc-doc"]').click();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveCount(2);
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('ESKİ GÖNDERİCİ');
});

// ================================================================================================ müşteri: ofisle yazışma
test('müşteri: sohbet balonu — depoyla yazışma; okunmamış cevap rozeti, açılınca okundu işareti, konu seçerek mesaj, 5 saniyede yeni cevap', async ({ page }) => {
  await customerPage(page);
  await expect(page.locator('.pnav [data-v="yazisma"]')).toHaveCount(0);              // ayrı sekme yok
  await expect(page.locator('#chat-fab')).toHaveAttribute('aria-label', 'Depo ile yazışma');
  await expect(page.locator('#chat-fab .cdot')).toHaveText('1');                       // okunmamış cevap
  await expect(page.locator('#chat-panel')).toHaveCount(0);
  await page.locator('#chat-fab').click();
  await expect(page.locator('#chat-panel')).toBeVisible();
  await expect(page.locator('#chat-panel .chead b')).toHaveText('Depo ile yazışma');
  await expect(page.locator('#msgs')).toContainText('Yarın sabah çıkabilir mi?');
  await expect(page.locator('#msgs')).toContainText('06:00\'da çıkış planladık');
  await expect(page.locator('#msgs .m.me .lk')).toContainText('PCS-26-0001');        // mesaj seferle ilişkili
  await expect.poll(() => page.evaluate(() => window.__db.shp_messages.find(m => m.id === 'm2').read_at)).toBeTruthy();
  await expect(page.locator('#chat-fab .cdot')).toHaveCount(0);
  expect((await rpcs(page, 'shp_portal_messages_read')).length).toBe(1);
  // boş mesaj gitmez; konu seçerek yazılır
  await page.locator('form[data-f="msg"] button[type="submit"]').click();
  await expect(page.locator('#msg-err')).toContainText('Mesaj yazın');
  await page.locator('[data-i="msg-ref"]').selectOption({ label: 'PCS-26-0002 · 06 ZZ 999' });
  await page.locator('#msg-body').fill('Bu araca bir yük daha ekledik.');
  await page.locator('form[data-f="msg"] button[type="submit"]').click();
  await expect(page.locator('#msgs')).toContainText('Bu araca bir yük daha ekledik.');
  const sent = await page.evaluate(() => window.__db.shp_messages.filter(m => m.from_role === 'musteri' && m.body.startsWith('Bu araca')));
  expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ customer_id: 'c1', trip_id: 't2', load_id: null });
  await expect(page.locator('#msg-body')).toHaveValue('');
  // Enter gönderir, Shift+Enter yeni satır açar
  await page.locator('#msg-body').fill('Enter ile gider');
  await page.locator('#msg-body').press('Enter');
  await expect(page.locator('#msgs')).toContainText('Enter ile gider');
  await page.locator('#msg-body').fill('birinci satır');
  await page.locator('#msg-body').press('Shift+Enter');
  await page.locator('#msg-body').type('ikinci satır');
  expect(await page.locator('#msg-body').inputValue()).toBe('birinci satır\nikinci satır');
  await page.locator('#msg-body').fill('');
  // depo cevap yazar: 5 saniyede ekrana gelir ("Depo" olarak, personel adı gizli); panel açıkken kendiliğinden okundu olur
  await page.evaluate(() => window.__db.shp_messages.push({ id: 'm9', customer_id: 'c1', channel: 'musteri', from_role: 'depo', author: 'Depo · Ahmet', body: 'Yükünüz rampada, yarın çıkıyor.', load_id: null, trip_id: null, created_at: '2026-09-23T07:00:05Z', read_at: null }));
  await page.clock.runFor(5100);
  await expect(page.locator('#msgs .m.o', { hasText: 'Yükünüz rampada' })).toContainText('Depo');
  await expect(page.locator('#msgs .m.o', { hasText: 'Yükünüz rampada' })).not.toContainText('Ahmet');
  await expect.poll(() => page.evaluate(() => window.__db.shp_messages.find(m => m.id === 'm9').read_at)).toBeTruthy();
  // Esc kapatır; panel kapalıyken yeni cevap rozet olur
  await page.keyboard.press('Escape');
  await expect(page.locator('#chat-panel')).toHaveCount(0);
  await page.evaluate(() => window.__db.shp_messages.push({ id: 'm10', customer_id: 'c1', channel: 'musteri', from_role: 'ofis', author: 'Ofis', body: 'Bir şey daha.', load_id: null, trip_id: null, created_at: '2026-09-23T07:00:20Z', read_at: null }));
  await page.clock.runFor(5100);
  await expect(page.locator('#chat-fab .cdot')).toHaveText('1');
  await page.locator('#chat-fab').click();
  await expect(page.locator('#msgs')).toContainText('Bir şey daha.');
  await page.locator('#chat-panel [data-a="chat-close"]').click();
  await expect(page.locator('#chat-panel')).toHaveCount(0);
});

// ================================================================================================ müşteri: Excel'den toplu yük
test('müşteri: yapıştırılan Excel satırları önizlenir (kayıtlı firma, uyarı, hata); yalnızca düzgün satırlar eklenir; 8.803 kilo sekiz bin sekiz yüz üç okunur', async ({ page }) => {
  const contacts = [{ customer_id: 'c1', kind: 'consignee', name: 'DORNA FOODS SRL', addr: 'Str. Dorna 5', notify: '', country: 'ROMANYA', dest_customs: 'BUCUREŞTI', code: 'ROBU1400', broker: '' }];
  const problems = await customerPage(page, null, { data: { shp_customers: customers(), shp_loads: loads(), shp_trips: trips(), shp_messages: [], shp_photos: [], shp_contacts: contacts } });
  await page.locator('[data-a="import"]').click();
  await expect(page.locator('#m .imp')).toBeVisible();
  const text = ['Gönderici\tAlıcı\tMal\tKap\tKilo\tGetirecek plaka\tBeklenen tarih\tBeklenen saat',
    'KAYA AMBALAJ SAN. A.Ş.\tDORNA FOODS SRL\tBANT\t840\t8.803\t34 KLM 521\t25.09.2026\t10:30',
    'DEMİR GIDA\tPAPİRUS SRL\tKAĞIT RULO\t3\tiki bin\t\t\t',
    'YILDIZ PLASTİK\tEUROFINA SRL\tŞİLTELİK\t1\t207\t\t\t',
    '\tMOTO SRL\tYEDEK PARÇA\t2\t310\t\t\t'].join('\n');
  await page.locator('#imp-paste').fill(text);
  const rows = page.locator('.imp-t tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('kayıtlı');                                // alıcı rehberde
  await expect(rows.nth(0)).toContainText('yeni gönderici');                         // gönderici rehberde yok → uyarı
  await expect(rows.nth(0).locator('td').nth(5)).toContainText('8.803');
  await expect(rows.nth(1)).toContainText('Kilo sayı değil');
  await expect(rows.nth(2)).toContainText('yeni gönderici');
  await expect(rows.nth(3)).toContainText('Gönderici boş');
  await expect(page.locator('.mf .sm .wn b')).toHaveText('2');
  await expect(page.locator('.mf .sm .er b')).toHaveText('2');
  await expect(page.locator('[data-a="imp-go"]')).toContainText('2 yükü ekle');
  await page.locator('[data-a="imp-go"]').click();
  await expect(page.locator('#toast')).toContainText('2 yük eklendi');
  const call = (await rpcs(page, 'shp_portal_import'))[0];
  expect(call.p_loads).toHaveLength(2);
  expect(call.p_loads[0]).toMatchObject({ sender: 'KAYA AMBALAJ SAN. A.Ş.', consignee: 'DORNA FOODS SRL', pieces: 840, weight: 8803, inbound_plate: '34 KLM 521', expected_date: '2026-09-25', expected_time: '10:30',
    consignee_addr: 'Str. Dorna 5', country: 'ROMANYA' });                          // kayıtlı alıcının adresi kendiliğinden eklendi
  const added = await page.evaluate(() => window.__db.shp_loads.filter(l => ['KAYA AMBALAJ SAN. A.Ş.', 'YILDIZ PLASTİK'].includes(l.sender) && l.created_by.startsWith('Müşteri') && l.status === 'bekliyor').map(l => l.sender));
  expect(added.sort()).toEqual(['KAYA AMBALAJ SAN. A.Ş.', 'YILDIZ PLASTİK']);
  expect(problems).toEqual([]);
});

test('müşteri: CSV dosyası seçilir (noktalı virgül, Türkçe başlıklar); örnek şablon indirilir; başlıksız liste sırayla okunur', async ({ page }) => {
  await customerPage(page);
  await page.locator('[data-a="import"]').click();
  const dl = page.waitForEvent('download');
  await page.locator('[data-a="imp-tpl"]').click();
  const tpl = fs.readFileSync(await (await dl).path(), 'utf8');
  expect(tpl).toContain('Gönderici;Alıcı;Mal;Kap;Kilo;Getirecek plaka');
  const csv = 'Alıcı;Gönderici;Kilo;Kap;Mal\r\nALICI BİR;GÖNDERİCİ BİR;1.250,5;12;KOLİ\r\nALICI İKİ;GÖNDERİCİ İKİ;300;2;TORBA\r\n';
  await page.locator('#imp-file').setInputFiles({ name: 'liste.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await expect(page.locator('.imp-t tbody tr')).toHaveCount(2);                      // sütunlar sırası farklı olsa da başlığa göre eşleşir
  await expect(page.locator('.imp-t tbody tr').first()).toContainText('GÖNDERİCİ BİR');
  await expect(page.locator('.imp-t tbody tr').first().locator('td').nth(5)).toContainText('1.250,5');
  await expect(page.locator('.drop')).toContainText('liste.csv');
  // başlıksız: sırayla gönderici, alıcı, mal, kap, kilo
  await page.locator('#imp-paste').fill('GÖND A\tALICI A\tMAL A\t5\t100\nGÖND B\tALICI B\tMAL B\t6\t200');
  await expect(page.locator('.drop')).toContainText('Başlık satırı bulunamadı');
  await expect(page.locator('.imp-t tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-a="imp-go"]')).toContainText('2 yükü ekle');
  // 200 satırdan fazlası reddedilir
  await page.locator('#imp-paste').fill(Array.from({ length: 201 }, (_, i) => `G${i}\tA${i}\tM\t1\t1`).join('\n'));
  await expect(page.locator('.drop')).toContainText('En fazla 200 satır');
  await expect(page.locator('[data-a="imp-go"]')).toBeDisabled();
});

// ================================================================================================ QR etiket
test('etiket: QR kodlu A6 etiket açılır; kod yüklenir ve okuyucuyla geri okunabilir (gidiş-dönüş)', async ({ page }) => {
  await customerPage(page);
  await page.locator('li.lo', { hasText: 'ÇELİK PLASTİK' }).locator('[data-a="label"]').click();
  await expect(page.locator('#nkb-dlg')).toBeVisible();
  const html = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(html).toContain('@page{size:148mm 105mm');                                    // ilk sekme A6
  expect(html).toContain('QRKODL5000');                                              // etiketteki okunur kod
  expect(html).toContain('ÇELİK PLASTİK LTD.');
  expect(html).toContain('16 DEF 456');
  expect(html).toMatch(/<svg[^>]*viewBox/);
  await page.locator('#nkb-dlg [data-nkb="close"]').click();
  // üretilen QR'ı çizip okuyucuyla çözüyoruz
  const decoded = await page.evaluate(async () => {
    await window.PCSNKP.qr.lib.gen(); await window.PCSNKP.qr.lib.dec();
    const svg = window.PCSNKP.qr.svgOf(window.PCSNKP.qr.payload('QRKODL5000'));
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg width="300" height="300" '));
    await img.decode();
    const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 300, 300); x.drawImage(img, 0, 0, 300, 300);
    return window.PCSNKP.qr.decode(x.getImageData(0, 0, 300, 300).data, 300, 300);
  });
  expect(decoded).toBe('PCS:QRKODL5000');
  expect(await page.evaluate(() => ['PCS:ABCDEFGHIJ', 'abcdefghij', ' PCS-ABCDEFGHIJ ', 'kısa', 'PCS:ABC'].map(t => window.PCSNKP.qr.parseCode(t)))).toEqual(['ABCDEFGHIJ', 'ABCDEFGHIJ', 'ABCDEFGHIJ', '', '']);
});

test('etiket: seçilen yükler birlikte yazdırılır (her yük bir sayfa)', async ({ page }) => {
  await customerPage(page);
  await page.locator('[data-a="pick"][data-id="l3"]').check();
  await page.locator('[data-a="pick"][data-id="l5"]').check();
  await page.evaluate(() => window.PCSNKP.act.labels());
  const html = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect((html.match(/class="lb"/g) || []).length).toBe(2);
});

// ================================================================================================ depo: program ve yükleme kontrolü
test('depo: Program sayfası günün araçlarını saate göre dizer; geciken, şimdi, bekleniyor, boşaltıldı; Araç geldi tüm yükleri alır; Şoföre yaz', async ({ page }) => {
  const problems = await depot(page, 'program');
  const k = n => page.locator('.kp4d .k', { hasText: n }).locator('b');
  await expect(k('Bugün gelecek araç')).toHaveText('3');                             // 09:30 gecikti, 10:30 şimdi, 15:00 bekleniyor
  await expect(k('Gelen araç')).toHaveText('1');                                     // DENEME (08:42)
  await expect(k('Geciken')).toHaveText('1');
  await expect(k('Beklenen yük')).toHaveText('4');
  const rows = page.locator('.trw');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toHaveClass(/late/);                                     // 09:30 — saat 10:00: 30 dk gecikti
  await expect(rows.nth(0)).toContainText('16 DEF 456');
  await expect(rows.nth(0)).toContainText('30 dk gecikti');
  await expect(rows.nth(0)).toContainText('şoför: Ali 0533 444 55 66');
  const wa = rows.nth(0).locator('a[href^="https://wa.me/"]');
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/905334445566\?text=/);
  await expect(rows.nth(1)).toHaveClass(/now/);                                      // 10:30 — iki yük aynı araçta
  await expect(rows.nth(1)).toContainText('34 KLM 521');
  await expect(rows.nth(1)).toContainText('2 yük');
  await expect(rows.nth(2)).toContainText('35 XYZ 789');
  await expect(rows.nth(3)).toHaveClass(/done/);
  await expect(rows.nth(3)).toContainText('Boşaltıldı');
  await page.locator('#nm').fill('Ahmet');
  await rows.nth(1).locator('[data-a="grp-arrive"]').click();
  await expect(page.locator('#toast')).toContainText('2 yük depoya alındı');
  expect(await page.evaluate(() => ['l6', 'l7'].map(id => window.__db.shp_loads.find(l => l.id === id).arrived_by))).toEqual(['Ahmet', 'Ahmet']);
  await expect(page.locator('.trw.done')).toHaveCount(2);
  await expect(k('Bugün gelecek araç')).toHaveText('2');
  expect(problems).toEqual([]);
});

test('depo: Araç yükleme kontrolü — gelmemiş yük varken araç yola çıkarılamaz; hepsi gelince çıkar, müşteri kilitlenir ve bildirim kuyruğa girer', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l3' ? { ...l, status: 'aracta', trip_id: 't2' } : l);
  await depot(page, 'program', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: trips(), shp_messages: [], shp_photos: [] } });
  const card = page.locator('.prg .card').last();
  await expect(card).toContainText('PCS-26-0002');                                   // yola çıkmamış araç seçili
  await expect(card).toContainText('1 / 2 yük');
  await expect(card).toContainText('1 yük eksik');
  await expect(card.locator('.cb.no')).toHaveCount(1);
  await expect(card.locator('[data-a="depart"]')).toBeDisabled();
  await page.locator('#nm').fill('Ahmet');
  await page.evaluate(() => window.__db.shp_loads.find(l => l.id === 'l3').arrived_at = '2026-09-23T06:50:00Z');
  await page.clock.runFor(5100);                                                     // depo ekranı kendiliğinden yenilenir
  await expect(card).toContainText('2 / 2 yük');
  await expect(card.locator('[data-a="depart"]')).toBeEnabled();
  await card.locator('[data-a="depart"]').click();
  await expect(page.locator('#toast')).toContainText('yola çıktı');
  const t = await page.evaluate(() => ({ t: window.__db.shp_trips.find(x => x.id === 't2'), q: window.__db.shp_outbox.map(o => o.event) }));
  expect(t.t.status).toBe('yolda'); expect(t.t.departed_at).toBeTruthy();
  expect(t.q).toEqual(['yola']);                                                     // müşteriye "araç yola çıktı" bildirimi
  expect(await rpcs(page, 'shp_depot_depart')).toEqual([{ p_token: 'tokD', p_trip: 't2', p_name: 'Ahmet' }]);
  await expect(page.locator('.prg .card').last().locator('[data-a="depart"]')).toBeDisabled();
});

test('depo: sunucu eksik yükle yola çıkmayı reddederse uyarı görünür', async ({ page }) => {
  const ls = loads().map(l => l.id === 'l3' ? { ...l, status: 'aracta', trip_id: 't2' } : l);
  await depot(page, 'program', { data: { shp_customers: customers(), shp_loads: ls, shp_trips: trips(), shp_messages: [], shp_photos: [] } });
  await page.evaluate(() => { const b = document.querySelector('[data-a="depart"]'); b.disabled = false; });   // arayüz kapısı atlanırsa sunucu yine engeller
  await page.locator('[data-a="depart"]').click();
  await expect(page.locator('#toast')).toContainText('hepsi gelmeden araç yola çıkarılamaz');
  expect(await page.evaluate(() => window.__db.shp_trips.find(x => x.id === 't2').status)).toBe('hazirlaniyor');
});

// ================================================================================================ depo: teslim al (sayım, durum, fotoğraf, raf)
test('depo: Teslim al — sayım farkı, durum, not, raf; kaydedince yük gelir ve sorun müşteri bildirimine girer', async ({ page }) => {
  const problems = await depot(page, 'bekliyor');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('tr.dr', { hasText: 'BERK TEKSTİL' }).locator('[data-a="recv"]').click();
  await expect(page.locator('#drw')).toContainText('Yükü teslim al');
  await expect(page.locator('#rc-pieces')).toHaveValue('22');                       // beyan kap önceden yazılı
  await expect(page.locator('#rc-diff')).toContainText('0 kap');
  await expect(page.locator('.rc-alert')).toBeHidden();
  await page.locator('#rc-pieces').fill('20');
  await expect(page.locator('#rc-diff')).toContainText('−2 kap');
  await expect(page.locator('.rc-alert')).toBeVisible();
  await expect(page.locator('#rc-save')).toContainText('Farkla birlikte teslim al');
  await page.locator('[data-a="rc-cond"][data-v="hasarli"]').click();
  await page.locator('#rc-note').fill('Islak geldi');
  await page.locator('[data-a="rc-loc"][data-v="B-1"]').click();
  await expect(page.locator('#rc-loc')).toHaveValue('B-1');
  await page.locator('#rc-save').click();
  await expect(page.locator('#toast')).toContainText('Yük teslim alındı');
  await expect(page.locator('#drw')).toHaveCount(0);
  const l = await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l6'));
  expect(l).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet', counted_pieces: 20, condition: 'hasarli', receive_note: 'Islak geldi', location: 'B-1' });
  expect(l.arrived_at).toBeTruthy();
  expect((await rpcs(page, 'shp_depot_receive'))[0]).toMatchObject({ p_id: 'l6', p_counted_pieces: 20, p_condition: 'hasarli', p_location: 'B-1', p_name: 'Ahmet' });
  const q = await page.evaluate(() => window.__db.shp_outbox.map(o => `${o.event}:${o.body}`));
  expect(q).toHaveLength(2);
  expect(q[0]).toMatch(/^geldi:BERK TEKSTİL A\.Ş\. → NOVA TEXTIL SRL · 22 kap/);
  expect(q[1]).toBe('sorun:BERK TEKSTİL A.Ş. → NOVA TEXTIL SRL: hasarlı');
  await page.locator('[data-a="tab"][data-v="depoda"]').click();
  await expect(page.locator('tr.dr', { hasText: 'BERK TEKSTİL' })).toContainText('Hasarlı');
  await expect(page.locator('tr.dr', { hasText: 'BERK TEKSTİL' })).toContainText('B-1');
  expect(problems).toEqual([]);
});

test('depo: Teslim al — fotoğraf çekilir (küçültülüp yüklenir), büyütülür, silinir; geçersiz sayı reddedilir', async ({ page }) => {
  await depot(page, 'bekliyor');
  await page.locator('tr.dr', { hasText: 'ARDA KİMYA' }).locator('[data-a="recv"]').click();
  await expect(page.locator('.rch h4', { hasText: 'Fotoğraflar (0)' })).toBeVisible();
  await page.locator('#rc-file').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('.ph3 .im')).toHaveCount(1);
  const ph = await page.evaluate(() => window.__db.shp_photos.filter(p => p.load_id === 'l7'));
  expect(ph).toHaveLength(1);
  expect(ph[0].data).toMatch(/^data:image\/jpeg;base64,/); expect(ph[0].thumb).toMatch(/^data:image\/jpeg;base64,/);
  expect(ph[0].customer_id).toBe('c1');
  await page.locator('.ph3 .imb').click();
  await expect(page.locator('#m .phbig')).toBeVisible();
  await page.locator('#m [data-a="mclose"]').first().click();
  await expect(page.locator('tr.dr', { hasText: 'ARDA KİMYA' })).toBeVisible();
  await page.locator('#rc-pieces').fill('abc');
  await page.locator('#rc-save').click();
  await expect(page.locator('#rc-err')).toContainText('tam sayı');
  await page.locator('#rc-pieces').fill('7');
  await page.locator('.ph3 [data-a="rc-photo-del"]').click();
  await expect(page.locator('.ph3 .im')).toHaveCount(0);
  expect(await page.evaluate(() => window.__db.shp_photos.filter(p => p.load_id === 'l7').length)).toBe(0);
  // çekmece Esc ile kapanır
  await page.keyboard.press('Escape');
  await expect(page.locator('#drw')).toHaveCount(0);
});

// ================================================================================================ depo: okut
test('depo: Okut — kod elle yazılır ya da USB okuyucuyla okutulur; raf seçilip GELDİ denir; aynı araçtan kalan yük hatırlatılır', async ({ page }) => {
  await depot(page, 'okut');
  await page.locator('[data-i="sc-auto"]').uncheck();                               // elle düzen: yük açılır, GELDİ'ye elle basılır
  await page.locator('#nm').fill('Ahmet');
  await page.locator('#sc-code').fill('PCS:YANLIS0000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.okt .ferr')).toContainText('bulunamadı');
  await page.locator('#sc-code').fill('kısa');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.okt .ferr')).toContainText('Kod geçersiz');
  await page.locator('#sc-code').fill('pcs:qrkodl6000');                             // küçük harf de olur
  await page.locator('#sc-code').press('Enter');
  const res = page.locator('.res');
  await expect(res).toContainText('BERK TEKSTİL A.Ş. → NOVA TEXTIL SRL');
  await expect(res).toContainText('34 KLM 521');
  await expect(res).toContainText('Depoya gelmedi');
  await expect(res).toContainText('Aynı araçtan 1 yük daha var');                    // l7 de aynı kamyonla geliyor
  await res.locator('[data-a="sc-loc"][data-v="B-2"]').click();
  await res.locator('[data-a="sc-go"]').click();
  await expect(page.locator('.okb')).toContainText('geldi olarak işaretlendi');
  await expect(page.locator('.okb')).toContainText('aynı araçtan 1 yük daha var');
  await expect(page.locator('.res')).toHaveCount(0);
  const l = await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l6'));
  expect(l).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet', location: 'B-2', condition: 'saglam' });
  // gelmiş yük: konumu güncelleyebilir; sorun varsa Teslim al çekmecesi açılır
  await page.locator('#sc-code').fill('QRKODL8000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.res')).toContainText('Geldi');
  await expect(page.locator('.res [data-a="sc-go"]')).toContainText('KONUMU KAYDET');
  await page.locator('.res [data-a="sc-problem"]').click();
  await expect(page.locator('#drw')).toContainText('Yükü teslim al');
  await expect(page.locator('[data-a="rc-cond"][data-v="eksik"]')).toHaveClass(/on/);
});

test('depo: Okut — kamera yoksa ya da izin verilmezse anlaşılır uyarı çıkar, elle kod yazma çalışır', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new DOMException('izin yok', 'NotAllowedError')) }, configurable: true }); });
  await depot(page, 'okut');
  await page.locator('[data-i="sc-auto"]').uncheck();
  await page.locator('[data-a="sc-cam"]').click();
  await expect(page.locator('.camoff')).toContainText('Kamera açılamadı');
  await page.locator('#sc-code').fill('QRKODL5000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.res')).toContainText('ÇELİK PLASTİK');
});

test('depo: tablo satırından etiket yazdırılır ve Araçlar başlığında kaç yük geldiği görünür', async ({ page }) => {
  await depot(page, 'bekliyor');
  await page.locator('tr.dr', { hasText: 'ÇELİK PLASTİK' }).locator('[data-a="label"]').click();
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('QRKODL5000');
  await page.locator('#nkb-dlg [data-nkb="close"]').click();
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  await expect(page.locator('tr.gt', { hasText: 'PCS-26-0001' })).toContainText('1/1 yük geldi');
});

test('depo: yükler seçilince alttaki "Etiket yazdır" düğmesi seçilenlerin etiketini açar', async ({ page }) => {
  await depot(page, 'bekliyor');
  const row = page.locator('tr.dr', { hasText: 'ÇELİK PLASTİK' });
  await row.locator('input[data-a="pick"]').check();
  await page.locator('.bulk [data-a="labels"]').click();
  const html = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
  expect(html).toContain('QRKODL5000');
  expect((html.match(/class="lb"/g) || []).length).toBe(1);
});

test('tarz: müşteri ve depo sayfalarında ofis ekranındaki gibi başlık kartı, sayı kutuları ve sayılı sekmeler var', async ({ page }) => {
  const problems = await customerPage(page, null);
  await expect(page.locator('.hd .eyebrow')).toHaveText('Müşteri portalı');
  await expect(page.locator('.hd h1')).toHaveText('Yükler ve araçlar');
  await expect(page.locator('.hd [data-a="refresh"]')).toHaveCount(1);
  for (const [v, t] of [['takip', 'Yük takibi'], ['rapor', 'Rapor ve arşiv']]) {
    await page.locator(`[data-a="page"][data-v="${v}"]`).click();
    await expect(page.locator('.hd h1')).toHaveText(t);
  }
  await page.goto('/nakliye.html?d=tokD');
  await expect(page.locator('.dwrap .hd h1')).toHaveText('Depo ekranı');
  await expect(page.locator('.hd [data-a="refresh"]')).toHaveCount(1);
  await expect(page.locator('.hd [data-a="print"]')).toHaveCount(1);
  await expect(page.locator('.kp .k')).toHaveCount(5);
  await expect(page.locator('.kp .k').first()).toContainText('Müşteri yazdı, depoya gelmedi');
  await expect(page.locator('.tabs button.on')).toContainText('Bekleyenler');
  // başlık kartı çerçeveli: şeffaf kenarlık + gradyan arka plan
  const bi = await page.locator('.hd').evaluate(e => getComputedStyle(e).backgroundImage);
  expect(bi).toContain('linear-gradient');
  expect(problems).toEqual([]);
});

test('depo: sohbet balonu — müşteri seçilip yazışılır; müşterinin yazdığı rozet olur, açılınca okundu olur; başka müşterinin mesajı karışmaz', async ({ page }) => {
  const m = (id, cid, from, body, extra = {}) => ({ id, customer_id: cid, channel: 'musteri', from_role: from, author: from === 'ofis' ? 'Ofis' : from === 'depo' ? 'Depo · Ahmet' : 'Müşteri · Ali', body, load_id: null, trip_id: null, created_at: '2026-09-22T09:00:00Z', read_at: null, ...extra });
  const msgs = [m('d1', 'c1', 'musteri', 'Yüküm ne zaman yüklenir?'), m('d2', 'c1', 'musteri', 'Acil lütfen.', { created_at: '2026-09-22T09:01:00Z' }),
    m('d3', 'c2', 'musteri', 'Belgeler hazır mı?', { created_at: '2026-09-22T10:00:00Z' }), m('d4', 'c2', 'depo', 'Hazır.', { created_at: '2026-09-22T10:05:00Z', read_at: '2026-09-22T10:06:00Z' })];
  const problems = await depot(page, null, { data: { shp_messages: msgs } });
  await page.locator('#nm').fill('Ahmet');
  await expect(page.locator('#chat-fab')).toHaveAttribute('aria-label', 'Müşteri yazışmaları');
  await expect(page.locator('#chat-fab .cdot')).toHaveText('3');                       // 2 + 1 okunmamış müşteri mesajı
  await page.locator('#chat-fab').click();
  await expect(page.locator('#chat-panel')).toBeVisible();
  // en eski okunmamış mesajı olan müşteri açılır (ÖRNEK NAKLİYAT: iki okunmamış)
  await expect(page.locator('#chat-panel [data-i="dc-cust"]')).toHaveValue('c1');
  await expect(page.locator('#msgs')).toContainText('Yükum ne zaman'.replace('Yükum', 'Yüküm'));
  await expect(page.locator('#msgs')).toContainText('Acil lütfen.');
  await expect(page.locator('#msgs')).not.toContainText('Belgeler hazır mı?');         // başka müşteri
  await expect.poll(() => page.evaluate(() => window.__db.shp_messages.filter(x => x.customer_id === 'c1' && !x.read_at).length)).toBe(0);
  expect(await page.evaluate(() => window.__db.shp_messages.find(x => x.id === 'd3').read_at)).toBeNull();   // öteki müşteriye dokunulmadı
  expect(await rpcs(page, 'shp_depot_messages_read')).toEqual([{ p_token: 'tokD', p_name: 'Ahmet', p_customer: 'c1' }]);
  await expect(page.locator('#chat-panel [data-i="dc-cust"] option[value="c2"]')).toContainText('(1 yeni)');
  // müşteriye cevap: adıyla kaydolur; boş mesaj gitmez; Enter gönderir
  await page.locator('form[data-f="msg"] button[type="submit"]').click();
  await expect(page.locator('#msg-err')).toContainText('Mesaj yazın');
  await page.locator('#msg-body').fill('Yarın sabah yüklüyoruz.');
  await page.locator('#msg-body').press('Enter');
  await expect(page.locator('#msgs')).toContainText('Yarın sabah yüklüyoruz.');
  const sent = await page.evaluate(() => window.__db.shp_messages.filter(x => x.from_role === 'depo' && x.body.startsWith('Yarın')));
  expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ customer_id: 'c1', author: 'Depo · Ahmet' });
  expect(await rpcs(page, 'shp_depot_message_send')).toEqual([{ p_token: 'tokD', p_name: 'Ahmet', p_customer: 'c1', p_body: 'Yarın sabah yüklüyoruz.' }]);
  // öteki müşteriyi seç: onun yazışması açılır, okundu olur, rozet kalkar
  await page.locator('#chat-panel [data-i="dc-cust"]').selectOption('c2');
  await expect(page.locator('#msgs')).toContainText('Belgeler hazır mı?');
  await expect(page.locator('#msgs')).not.toContainText('Yarın sabah yüklüyoruz.');
  await expect.poll(() => page.evaluate(() => window.__db.shp_messages.find(x => x.id === 'd3').read_at)).toBeTruthy();
  await expect(page.locator('#chat-panel')).toBeVisible();
  // kapat; müşteri yazınca 5 saniyede balonda rozet
  await page.keyboard.press('Escape');
  await expect(page.locator('#chat-panel')).toHaveCount(0);
  await expect(page.locator('#chat-fab .cdot')).toHaveCount(0);
  await page.evaluate(() => window.__db.shp_messages.push({ id: 'd9', customer_id: 'c2', channel: 'musteri', from_role: 'musteri', author: 'Müşteri · Ali', body: 'Teşekkürler.', load_id: null, trip_id: null, created_at: '2026-09-23T07:00:20Z', read_at: null }));
  await page.clock.runFor(5100);
  await expect(page.locator('#chat-fab .cdot')).toHaveText('1');
  expect(problems).toEqual([]);
});

test('depo: Okut — kod okununca yük kendiliğinden GELDİ olur (sonuç kutusu, raf, aynı araç hatırlatması, zaten gelmiş uyarısı, geri al, oturum listesi)', async ({ page }) => {
  const problems = await depot(page, 'okut');
  await page.locator('#nm').fill('Ahmet');
  await expect(page.locator('[data-i="sc-auto"]')).toBeChecked();                       // varsayılan: otomatik
  // bilinmeyen kod: kırmızı uyarı, hiçbir şey değişmez
  await page.locator('#sc-code').fill('PCS:YANLIS0000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.scflash.bad')).toContainText('KOD BULUNAMADI');
  // geçersiz yazı
  await page.locator('#sc-code').fill('kısa');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.okt .ferr')).toContainText('Kod geçersiz');
  // gerçek kod: Enter ile tek adımda GELDİ
  await page.locator('#sc-code').fill('pcs:qrkodl6000');
  await page.locator('#sc-code').press('Enter');
  const ok = page.locator('.scflash.ok');
  await expect(ok).toContainText('GELDİ');
  await expect(ok).toContainText('BERK TEKSTİL A.Ş. → NOVA TEXTIL SRL');
  await expect(ok).toContainText('ÖRNEK NAKLİYAT');
  await expect(ok).toContainText('22 kap');
  await expect(ok).toContainText('Aynı araçtan 1 yük daha var');
  await expect(page.locator('.res')).toHaveCount(0);                                     // sonuç kartı / GELDİ düğmesi yok
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l6'))).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet', location: '' });
  expect(await rpcs(page, 'shp_depot_receive')).toHaveLength(1);
  await expect(page.locator('#sc-code')).toHaveValue('');                                // kutu temizlenir, sıradaki okutmaya hazır
  // raf seçilirse sonraki yüklere yazılır
  await page.locator('.okt [data-a="sc-loc"][data-v="B-2"]').click();
  await page.locator('#sc-code').fill('QRKODL7000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.scflash.ok')).toContainText('ARDA KİMYA → GOURMET SRL');
  await expect(page.locator('.scflash.ok')).toContainText('B-2');
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l7').location)).toBe('B-2');
  await expect(page.locator('.sclist li')).toHaveCount(2);
  // aynı kutuyu yeniden okutmak ikinci kez işlemez
  await page.locator('#sc-code').fill('QRKODL6000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.scflash.warn')).toContainText('ZATEN GELMİŞ');
  expect(await rpcs(page, 'shp_depot_receive')).toHaveLength(2);
  // yanlış okutulan: geri al
  await page.locator('.sclist li', { hasText: 'ARDA KİMYA' }).locator('[data-a="sc-undo"]').click();
  await expect(page.locator('.scflash.warn')).toContainText('GERİ ALINDI');
  await expect(page.locator('.sclist li')).toHaveCount(1);
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l7').arrived_at)).toBeNull();
  // tam kod (PCS: ile) Enter'a basmadan, okuyucu gibi hızlı yazılınca da işlenir
  await page.locator('#sc-code').fill('PCS:QRKODL5000');
  await expect(page.locator('.scflash.ok')).toContainText('ÇELİK PLASTİK LTD. → DAKO SRL');
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l5').status)).toBe('depoda');
  expect(problems).toEqual([]);
});

test('depo: Okut — arka arkaya okutulan kutular sırayla işlenir; tercihler hatırlanır; elle düzen açılabilir', async ({ page }) => {
  await depot(page, 'okut');
  await page.locator('#nm').fill('Ahmet');
  // iki kod hemen peş peşe (kamera aynı anda iki kutu görürse) kaybolmaz
  await page.evaluate(() => { window.PCSNKP.depo.onCode('QRKODL5000'); window.PCSNKP.depo.onCode('QRKODL7000'); });
  await expect(page.locator('.sclist li')).toHaveCount(2);
  expect(await page.evaluate(() => window.__db.shp_loads.filter(x => ['l5', 'l7'].includes(x.id)).map(x => x.status))).toEqual(['depoda', 'depoda']);
  // tercih: otomatik kapatılır, sayfa yenilenince de kapalı kalır
  await page.locator('[data-i="sc-auto"]').uncheck();
  await page.reload();
  await expect(page.locator('.dwrap')).toBeVisible();
  await page.locator('[data-a="tab"][data-v="okut"]').click();
  await expect(page.locator('[data-i="sc-auto"]')).not.toBeChecked();
  await page.locator('#sc-code').fill('QRKODL3000');
  await page.locator('#sc-code').press('Enter');
  await expect(page.locator('.res')).toContainText('YILDIZ PLASTİK A.Ş.');                // elle düzen: sonuç kartı
  await expect(page.locator('.res [data-a="sc-go"]')).toContainText('GELDİ');
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l3').arrived_at)).toBeNull();   // elle basılana dek gelmedi
});

test('depo: Okut — okuyucu modu (Zebra / USB): kutu hep seçili, ekran klavyesi açılmaz, okutulan kod kendiliğinden GELDİ olur', async ({ page }) => {
  await depot(page, 'okut');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('[data-i="sc-reader"]').check();
  await expect(page.locator('#sc-code')).toBeFocused();
  await expect(page.locator('#sc-code')).toHaveAttribute('inputmode', 'none');
  // okuyucu kodu klavyeden yazar ve Enter gönderir
  await page.keyboard.type('PCS:QRKODL6000');
  await page.keyboard.press('Enter');
  await expect(page.locator('.scflash.ok')).toContainText('NOVA TEXTIL SRL');
  await expect(page.locator('#sc-code')).toBeFocused();                                  // sıradaki okutma için kutu hazır
  await page.keyboard.type('QRKODL7000');
  await page.keyboard.press('Enter');
  await expect(page.locator('.scflash.ok')).toContainText('GOURMET SRL');
  await expect(page.locator('.sclist li')).toHaveCount(2);
  await page.locator('[data-i="sc-reader"]').uncheck();
  await expect(page.locator('#sc-code')).toHaveAttribute('inputmode', 'text');
});

test('etiket: yazıcıya göre boyut sekmeleri (A6, Zebra 100×150 / 100×100 / 100×70 / 100×50); her boyutta QR ve kod var; seçim hatırlanır', async ({ page }) => {
  await depot(page, 'bekliyor');
  const open = () => page.locator('tr.dr', { hasText: 'ÇELİK PLASTİK' }).locator('[data-a="label"]').click();
  await open();
  await expect(page.locator('#nkb-dlg [data-nkb-tab]')).toHaveText(['A6 (normal yazıcı)', 'Zebra 100×150', 'Zebra 100×100', 'Zebra 100×70', 'Zebra 100×50']);
  const sizes = { 'Zebra 100×150': '100mm 150mm', 'Zebra 100×100': '100mm 100mm', 'Zebra 100×70': '100mm 70mm', 'Zebra 100×50': '100mm 50mm', 'A6 (normal yazıcı)': '148mm 105mm' };
  for (const [name, mm] of Object.entries(sizes)) {
    await page.locator('#nkb-dlg [data-nkb-tab]', { hasText: name }).click();
    const html = await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc);
    expect(html).toContain(`@page{size:${mm};margin:0}`);
    expect(html).toContain('QRKODL5000');
    expect(html).toContain('<svg');
    expect(html).toContain('ÇELİK PLASTİK LTD.');
  }
  // seçilen boyut bir sonraki açılışta hazır gelir
  await page.locator('#nkb-dlg [data-nkb-tab]', { hasText: 'Zebra 100×150' }).click();
  await page.locator('#nkb-dlg [data-nkb="close"]').click();
  await open();
  await expect(page.locator('#nkb-dlg [data-nkb-tab].on')).toHaveText('Zebra 100×150');
  expect(await page.locator('#nkb-dlg iframe').evaluate(f => f.srcdoc)).toContain('@page{size:100mm 150mm;margin:0}');
});

test('depo: Okut ekranını açmadan, hangi sekmede olursa olsun okuyucu kodu yük kendiliğinden GELDİ olur (üstte kısa süre görünen kutu, geri al)', async ({ page }) => {
  const problems = await depot(page, 'bekliyor');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('.hd h1').click();                                                // hiçbir kutu seçili değil
  await page.keyboard.type('PCS:QRKODL6000');                                          // okuyucu hızında (gecikmesiz)
  const top = page.locator('.scflash.top.ok');
  await expect(top).toContainText('GELDİ');
  await expect(top).toContainText('NOVA TEXTIL SRL');
  await expect(page.locator('[data-a="tab"][data-v="bekliyor"].on')).toHaveCount(1);   // sekme değişmedi
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l6'))).toMatchObject({ status: 'depoda', arrived_by: 'Ahmet' });
  // elle yazış yavaştır: okuma sayılmaz
  await page.keyboard.type('PCS:QRKODL7000', { delay: 120 });
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l7').arrived_at)).toBeNull();
  // sonuna Enter ekleyen okuyucu (önek olmadan 10 harf + Enter)
  await page.keyboard.type('QRKODL7000');
  await page.keyboard.press('Enter');
  await expect(page.locator('.scflash.top.ok')).toContainText('GOURMET SRL');
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l7').arrived_at)).toBeTruthy();
  // yanlış okutulan geri alınır
  await page.locator('.scflash.top [data-a="sc-undo"]').click();
  await expect(page.locator('.scflash.top')).toContainText('GERİ ALINDI');
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l7').arrived_at)).toBeNull();
  // kutu birkaç saniye sonra kendiliğinden kapanır
  await page.clock.runFor(6000);
  await expect(page.locator('.scflash.top')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('depo: okuyucu kodu yanlışlıkla ad ya da arama kutusuna yazılırsa oradan silinir ve yük yine gelir; pencere açıkken okuma yok sayılır', async ({ page }) => {
  await depot(page, 'bekliyor');
  await page.locator('#nm').fill('Ahmet');
  await page.locator('#nm').focus();
  await page.keyboard.type('PCS:QRKODL5000');
  await expect(page.locator('.scflash.top.ok')).toContainText('DAKO SRL');
  await expect(page.locator('#nm')).toHaveValue('Ahmet');                              // kod ad kutusundan silindi
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l5').arrived_by)).toBe('Ahmet');
  // etiket penceresi açıkken (kullanıcı başka işte) okuma yok sayılır
  await page.locator('tr.dr', { hasText: 'BERK TEKSTİL' }).locator('[data-a="label"]').click();
  await expect(page.locator('#nkb-dlg')).toBeVisible();
  await page.keyboard.type('PCS:QRKODL6000');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l6').arrived_at)).toBeNull();
});

test('depo: başlıktaki "Okuyucu" düğmesi her sekmede görünmez bir kutuyu seçili tutar (klavye olayı vermeyen okuyucular için de); otomatik kapalıysa Okut açılır', async ({ page }) => {
  await depot(page, 'bekliyor');
  await page.locator('#nm').fill('Ahmet');
  await expect(page.locator('[data-a="reader-toggle"]')).toContainText('Okuyucu kapalı');
  await page.locator('[data-a="reader-toggle"]').click();
  await expect(page.locator('[data-a="reader-toggle"]')).toContainText('Okuyucu açık');
  await expect(page.locator('#scan-sink')).toBeFocused();
  // metin olarak gelen okuma (klavye olayı yok, yalnızca giriş olayı)
  await page.locator('#scan-sink').evaluate(el => { el.value = 'PCS:QRKODL6000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('.scflash.top.ok')).toContainText('NOVA TEXTIL SRL');
  await expect(page.locator('#scan-sink')).toBeFocused();                              // sıradaki okuma için hazır
  // klavye olayı olarak gelen okuma
  await page.keyboard.type('PCS:QRKODL7000');
  await expect(page.locator('.scflash.top.ok')).toContainText('GOURMET SRL');
  expect(await rpcs(page, 'shp_depot_receive')).toHaveLength(2);                      // iki yoldan gelse de bir kez işlendi
  // otomatik kapalı: okuma Okut sekmesini açar, GELDİ'ye elle basılır
  await page.locator('[data-a="tab"][data-v="okut"]').click();
  await page.locator('[data-i="sc-auto"]').uncheck();
  await page.locator('[data-a="tab"][data-v="bekliyor"]').click();
  await page.locator('#scan-sink').focus();
  await page.keyboard.type('PCS:QRKODL3000');
  await expect(page.locator('.res')).toContainText('YILDIZ PLASTİK A.Ş.');
  await expect(page.locator('[data-a="tab"][data-v="okut"].on')).toHaveCount(1);
  expect(await page.evaluate(() => window.__db.shp_loads.find(x => x.id === 'l3').arrived_at)).toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------
// Araca YÜKLENDİ (okutunca) ve etiketin otomatik basımı
const yukData = () => ({ shp_customers: customers(), shp_loads: [...loads(), L('l9', 'c1', 'SIRA GIDA A.Ş.', 'YENI IMPEX SRL', { pieces: 3, weight: 300, goods: 'UN', status: 'aracta', trip_id: 't2', assigned_at: '2026-09-23T05:20:00Z', arrived_at: '2026-09-23T06:10:00Z' })],
  shp_trips: trips(), shp_messages: [], shp_photos: [] });
const db1 = (page, id) => page.evaluate(i => window.__db.shp_loads.find(x => x.id === i), id);

test('depo: Okut — "Araca YÜKLENDİ" modu: okutunca yük araçta yüklendi olur; gelmemiş / araçsız / yola çıkmış / zaten yüklenmiş uyarıları; geri al; oturum listesi', async ({ page }) => {
  const problems = await depot(page, 'okut', { data: yukData() });
  await page.locator('#nm').fill('Ahmet');
  await page.locator('.seg2 [data-a="sc-mode"][data-v="yukle"]').click();
  await expect(page.locator('.seg2 .on')).toContainText('Araca YÜKLENDİ');
  await expect(page.locator('[data-i="sc-auto"]')).toBeDisabled();                       // yükleme modunda her okutma tek adımdır
  const scan = async code => { await page.locator('#sc-code').fill(code); await page.locator('#sc-code').press('Enter'); };
  await scan('PCS:YANLIS0000');
  await expect(page.locator('.scflash.bad')).toContainText('KOD BULUNAMADI');
  await scan('QRKODL6000');                                                              // depoya henüz gelmemiş
  await expect(page.locator('.scflash.bad')).toContainText('HENÜZ GELMEMİŞ');
  await scan('QRKODL8000');                                                              // geldi ama müşteri araca koymamış
  await expect(page.locator('.scflash.warn')).toContainText('ARACA ATANMAMIŞ');
  await scan('QRKODL1000');                                                              // araç yolda
  await expect(page.locator('.scflash.bad')).toContainText('ARAÇ YOLA ÇIKMIŞ');
  expect(await rpcs(page, 'shp_depot_load')).toHaveLength(0);                            // hiçbiri sunucuya gitmedi
  expect(await rpcs(page, 'shp_depot_receive')).toHaveLength(0);
  await scan('pcs:qrkodl2000');
  const ok = page.locator('.scflash.ok.yk');
  await expect(ok).toContainText('YÜKLENDİ');
  await expect(ok).toContainText('DEMİR GIDA LTD. ŞTİ. → COMPACT RB');
  await expect(ok).toContainText('06 ZZ 999');
  await expect(ok).toContainText('1/2 yüklendi');
  await expect(ok).toContainText('Bu araçta 1 yük daha yüklenecek');
  expect(await db1(page, 'l2')).toMatchObject({ loaded_by: 'Ahmet' });
  expect((await db1(page, 'l2')).loaded_at).toBeTruthy();
  expect(await rpcs(page, 'shp_depot_load')).toEqual([{ p_token: 'tokD', p_id: 'l2', p_loaded: true, p_name: 'Ahmet' }]);
  await scan('QRKODL2000');                                                              // aynı kutu ikinci kez
  await expect(page.locator('.scflash.warn')).toContainText('ZATEN YÜKLENMİŞ');
  expect(await rpcs(page, 'shp_depot_load')).toHaveLength(1);
  await scan('QRKODL9000');
  await expect(page.locator('.scflash.ok.yk')).toContainText('2/2 yüklendi');
  await expect(page.locator('.scflash.ok.yk')).toContainText('tüm yükler yüklendi');
  await expect(page.locator('.sclist li')).toHaveCount(2);
  await expect(page.locator('.sclist li .ch.b').first()).toHaveText('Yüklendi');
  // yükleme sayıları: Araçlar başlığı ve Program'daki yükleme kontrolü
  await page.locator('[data-a="tab"][data-v="program"]').click();
  const card = page.locator('.prg .card').last();
  await expect(card).toContainText('2 / 2 yüklendi');
  await expect(card.locator('.ck .ch.b')).toHaveCount(2);
  await page.locator('[data-a="tab"][data-v="araclar"]').click();
  await expect(page.locator('tr.gt', { hasText: 'PCS-26-0002' })).toContainText('2/2 yüklendi');
  await expect(page.locator('tr.dr .ch.b', { hasText: 'Yüklendi' })).toHaveCount(2);
  // yanlış okutulan: geri al (oturum listesinden)
  await page.locator('[data-a="tab"][data-v="okut"]').click();
  await page.locator('.sclist li', { hasText: 'SIRA GIDA' }).locator('[data-a="sc-undo"]').click();
  await expect(page.locator('.scflash.warn')).toContainText('GERİ ALINDI');
  await expect(page.locator('.sclist li')).toHaveCount(1);
  expect((await db1(page, 'l9')).loaded_at).toBeNull();
  expect(await rpcs(page, 'shp_depot_load')).toHaveLength(3);
  expect(problems).toEqual([]);
});

test('depo: Araç yükleme kontrolü — yüklendi sayısı, elle "Yüklendi" / geri al düğmesi, eksik yüklenmiş uyarısı; araç yola çıkınca yükleme değişmez', async ({ page }) => {
  const problems = await depot(page, 'program', { data: yukData() });
  await page.locator('#nm').fill('Ahmet');
  const card = page.locator('.prg .card').last();
  await expect(card).toContainText('2 / 2 yük geldi');
  await expect(card).toContainText('0 / 2 yüklendi');
  await expect(card.locator('[data-a="depart"]')).toBeEnabled();                          // yüklendi bilgisi yola çıkışı engellemez
  await card.locator('.ck', { hasText: 'DEMİR GIDA' }).locator('[data-a="chk-load"]').click();
  await expect(page.locator('#toast')).toContainText('yüklendi olarak işaretlendi');
  await expect(card).toContainText('1 / 2 yüklendi');
  await expect(card).toContainText('1 yük araca yüklendi işaretlenmemiş');                // bazısı yüklendi, bazısı değil: uyarı
  await card.locator('.ck', { hasText: 'DEMİR GIDA' }).locator('[data-a="chk-load"]').click();   // geri al
  await expect(card).toContainText('0 / 2 yüklendi');
  await expect(card).not.toContainText('işaretlenmemiş');
  await card.locator('.ck', { hasText: 'DEMİR GIDA' }).locator('[data-a="chk-load"]').click();
  await card.locator('.ck', { hasText: 'SIRA GIDA' }).locator('[data-a="chk-load"]').click();
  await expect(card).toContainText('2 / 2 yüklendi');
  await card.locator('[data-a="depart"]').click();
  await expect(page.locator('#toast')).toContainText('yola çıktı');
  await expect(page.locator('.prg .card').last().locator('[data-a="chk-load"]')).toHaveCount(0);   // yola çıkan araçta düğme yok
  // sunucu da yola çıkmış araçta yüklemeyi değiştirtmez
  const r = await page.evaluate(() => window.PCSNKP.rpc('shp_depot_load', { p_id: 'l2', p_loaded: false, p_name: 'Ahmet' }));
  expect(r.error && r.error.message).toContain('yola çıkmış');
  expect(problems).toEqual([]);
});

test('depo: Yükleme modu her sekmede çalışır (üstte kısa süre görünen kutu); başlıktaki düğmeyle mod değişir ve hatırlanır', async ({ page }) => {
  const problems = await depot(page, 'bekliyor', { data: yukData() });
  await page.locator('#nm').fill('Ahmet');
  const btn = page.locator('.hd [data-a="sc-mode"]');
  await expect(btn).toContainText('Okutunca: GELDİ');
  await btn.click();
  await expect(btn).toContainText('Okutunca: YÜKLENDİ');
  expect(await page.evaluate(() => localStorage.getItem('pcs.okut.mode'))).toBe('yukle');
  await page.locator('.hd h1').click();
  await page.keyboard.type('PCS:QRKODL2000');                                            // hangi sekmede olursa olsun
  const top = page.locator('.scflash.top.ok.yk');
  await expect(top).toContainText('YÜKLENDİ');
  await expect(top).toContainText('COMPACT RB');
  await expect(page.locator('[data-a="tab"][data-v="bekliyor"].on')).toHaveCount(1);
  expect((await db1(page, 'l2')).loaded_at).toBeTruthy();
  expect(await rpcs(page, 'shp_depot_receive')).toHaveLength(0);
  await top.locator('[data-a="sc-undo"]').click();                                       // üstteki kutudan geri al: yükleme geri alınır, geldi işareti kalır
  expect((await db1(page, 'l2')).loaded_at).toBeNull();
  expect((await db1(page, 'l2')).arrived_at).toBeTruthy();
  await btn.click();
  await expect(btn).toContainText('Okutunca: GELDİ');
  expect(problems).toEqual([]);
});

test('müşteri: Takip — depo yüklendi işaretleyince "Araca yüklendi" ve saati görünür', async ({ page }) => {
  const data = yukData(); data.shp_loads.find(l => l.id === 'l9').loaded_at = '2026-09-23T06:40:00Z'; data.shp_loads.find(l => l.id === 'l9').loaded_by = 'Ahmet';
  await customerPage(page, 'takip', { data });
  const card = page.locator('article.ld', { hasText: 'SIRA GIDA' });
  await expect(card.locator('.tl5')).toContainText('Araca yüklendi');
  await expect(card.locator('.tl5')).toContainText('yüklendi ·');
  await expect(page.locator('article.ld', { hasText: 'DEMİR GIDA' }).locator('.tl5')).toContainText('Araca kondu');   // yüklenmemiş yükte eski adım adı
});

test('depo: Etiket yazıcı — açıldıktan sonra GELDİ olan yükün etiketi kendiliğinden basılır; bir kez; başka cihazın bastığı basılmaz; boyut; yeniden bas; kapatınca durur', async ({ page }) => {
  const problems = await depot(page, 'bekliyor', { data: yukData() });
  await page.locator('#nm').fill('Ahmet');
  await page.evaluate(() => { window.__printed = []; window.__okPrint = true; window.PCSNKP.qr.printHtml = async html => { window.__printed.push(html); return window.__okPrint; }; });
  const printed = () => page.evaluate(() => window.__printed.length);
  const lp = page.locator('.hd [data-a="lp-toggle"]');
  await expect(lp).toContainText('Etiket yazıcı kapalı');
  await page.locator('tr.dr', { hasText: 'ÇELİK PLASTİK' }).locator('[data-a="arrive"]').click();   // kapalıyken gelen: basılmaz
  await expect(page.locator('#toast')).toContainText('geldi olarak işaretlendi');
  expect(await printed()).toBe(0);
  await lp.click();
  await expect(lp).toContainText('Etiket yazıcı açık');
  expect(await page.evaluate(() => localStorage.getItem('pcs.etiket.istasyon'))).toBeTruthy();
  await page.clock.runFor(5100);
  expect(await printed()).toBe(0);                                                       // eskiden gelmiş yükler (açılmadan önce) basılmaz
  expect(await rpcs(page, 'shp_depot_labels_claim')).toHaveLength(0);
  // açıldıktan sonra gelen: otomatik basılır (varsayılan boyut Zebra 100×70 = 10×7 cm)
  await page.clock.runFor(1000);
  await page.locator('tr.dr', { hasText: 'BERK TEKSTİL' }).locator('[data-a="arrive"]').click();
  await expect.poll(printed).toBe(1);
  const html = await page.evaluate(() => window.__printed[0]);
  expect(html).toContain('@page{size:100mm 70mm');
  expect(html).toContain('QRKODL6000');
  expect(html).toContain('NOVA TEXTIL SRL');
  await expect(page.locator('#toast')).toContainText('1 etiket yazıcıya gönderildi');
  expect((await db1(page, 'l6')).label_printed_at).toBeTruthy();
  expect((await rpcs(page, 'shp_depot_labels_claim'))[0]).toMatchObject({ p_token: 'tokD', p_ids: ['l6'] });
  await page.clock.runFor(11000);                                                        // sonraki yenilemelerde aynı etiket yeniden basılmaz
  expect(await printed()).toBe(1);
  // başka bir bilgisayar (aynı depo) bu yükün etiketini zaten bastıysa burada basılmaz
  await page.evaluate(() => { const l = window.__db.shp_loads.find(x => x.id === 'l7'); l.arrived_at = new Date().toISOString(); l.status = 'depoda'; l.label_printed_at = new Date().toISOString(); });
  await page.clock.runFor(5100);
  expect(await printed()).toBe(1);
  // yazıcı boyutu: Etiket yazdır penceresinde seçilen boyut kullanılır
  await page.evaluate(() => localStorage.setItem('pcs.etiket.boyut', 'z150'));
  await page.evaluate(() => { const l = window.__db.shp_loads.find(x => x.id === 'l5'); l.arrived_at = new Date().toISOString(); l.status = 'depoda'; });
  await page.clock.runFor(5100);
  await expect.poll(printed).toBe(2);
  expect(await page.evaluate(() => window.__printed[1])).toContain('@page{size:100mm 150mm');
  // yazıcıya gönderilemezse uyarı çıkar, Okut sekmesinden yeniden basılır
  await page.evaluate(() => { window.__okPrint = false; const l = window.__db.shp_loads.find(x => x.id === 'l3'); l.arrived_at = new Date().toISOString(); l.status = 'depoda'; });
  await page.clock.runFor(5100);
  await expect(page.locator('#toast')).toContainText('yazıcıya gönderilemedi');
  await page.locator('[data-a="tab"][data-v="okut"]').click();
  await expect(page.locator('.lpc')).toContainText('ETİKET YAZICI · AÇIK');
  await page.evaluate(() => { window.__okPrint = true; });
  const before = await printed();
  await page.locator('.lpc [data-a="lp-again"]').click();
  await expect.poll(printed).toBe(before + 1);
  expect(await page.evaluate(() => window.__printed[window.__printed.length - 1])).toContain('EUROFINA');
  // kapatınca durur
  await lp.click();
  await expect(lp).toContainText('Etiket yazıcı kapalı');
  expect(await page.evaluate(() => localStorage.getItem('pcs.etiket.istasyon'))).toBeNull();
  await page.evaluate(() => { const l = window.__db.shp_loads.find(x => x.id === 'l7'); l.label_printed_at = null; });
  await page.clock.runFor(5100);
  expect(await printed()).toBe(before + 1);
  expect(problems).toEqual([]);
});

test('etiket: printHtml gizli bir çerçeveye sayfayı yazar ve print() çağırır; iş bitince çerçeve silinir', async ({ page }) => {
  // çerçevelerde print() sayılır (gerçek yazdırma penceresi açılmasın)
  await page.addInitScript(() => { if (window !== window.top) window.print = () => { window.parent.__prints = (window.parent.__prints || 0) + 1; window.parent.__printedText = document.body.innerText; }; });
  await depot(page, 'bekliyor', { data: yukData() });
  const ok = await page.evaluate(() => window.PCSNKP.qr.printHtml('<!doctype html><html><body><p id="x">ÖRNEK ETİKET</p></body></html>'));
  expect(ok).toBe(true);
  expect(await page.evaluate(() => window.__prints)).toBe(1);
  expect(await page.evaluate(() => window.__printedText)).toContain('ÖRNEK ETİKET');       // boş sayfa değil, etiket yazdırılır
  await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCount(1);              // iş sırasında görünmez çerçeve durur
  expect(await page.locator('iframe[aria-hidden="true"]').evaluate(f => f.srcdoc)).toContain('ÖRNEK ETİKET');
  await page.clock.runFor(5000);
  await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCount(0);              // sonra silinir
});
