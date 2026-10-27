// Günlük rapor maili betiği (scripts/gunluk-rapor/gonder.mjs): gerçek gönderim yerine "kuru" modda dosyaya yazar.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'gunluk-rapor', 'gonder.mjs');
const visit = (id, plate, customer, extra = {}) => ({ id, plate, customer, declaration: '', carrier: '', registration: '', visit_date: '2026-09-30', visit_time: '09:00:00',
  onsite: false, t1: false, done: false, onsite_at: null, done_at: null, exit_at: null, sort_order: null, created_at: '2026-09-30T04:00:00Z', ...extra });
function run(data, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rapor-'));
  fs.writeFileSync(path.join(dir, 'veri.json'), JSON.stringify(data));
  const out = path.join(dir, 'cikti');
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { ...process.env, RAPOR_VERI: path.join(dir, 'veri.json'), RAPOR_KURU: out, RAPOR_TARIHI: '2026-09-30', ...extraEnv } });
  return { code: r.status, log: r.stdout + r.stderr, out };
}
const base = () => ({ date: '2026-09-30', enabled: true, recipients: ['evren@ornek.com', 'ofis@ornek.com'], customer_priority: [{ match: 'LİN' }], visits: [
  visit('a1', 'PP 7685 BP - PP 2758 EA', 'LİN LOJİSTİK', { declaration: '26341200EX000001', onsite: true, t1: true, done: true, onsite_at: '2026-09-30T05:12:00Z', done_at: '2026-09-30T09:40:00Z', exit_at: '2026-09-30T10:05:00Z' }),
  visit('a2', 'X 9592 KB - X 2443 EM', 'BULTRANS', { onsite: true, t1: true, done: true, onsite_at: '2026-09-30T06:00:00Z', done_at: '2026-09-30T11:22:00Z' }),
  visit('a3', 'CB 1291 TA', 'TORNADO EXPRESS')
] });

test('günlük rapor maili: özet, giriş-çıkış saatleri ve günlük Excel eki hazırlanır', () => {
  const r = run(base());
  expect(r.code).toBe(0);
  expect(r.log).toContain('2 alıcılık mail');
  const mail = JSON.parse(fs.readFileSync(path.join(r.out, 'mail.json'), 'utf8'));
  expect(mail.to).toEqual(['evren@ornek.com', 'ofis@ornek.com']);
  expect(mail.subject).toBe('PCS TRANSİT · Günlük rapor · 30.09.2026 Çarşamba · 3 araç');
  expect(mail.attachment).toBe('PCS_2026-09-30_GUN.xlsx');
  expect(mail.text).toContain('Toplam araç: 3 · Tesise giren: 2 · T1: 2 · İşlemi biten: 2 · Çıkış yapan: 1 · Bekleyen: 1');
  expect(mail.text).toMatch(/Rapor hazırlandı: (\d{2}\.\d{2} )?\d{2}:\d{2}\./);                      // hazırlanma saati (GitHub gecikirse fark edilir)
  const html = fs.readFileSync(path.join(r.out, 'rapor.html'), 'utf8');
  for (const t of ['30.09.2026 Çarşamba', 'PP 7685 BP - PP 2758 EA', '26341200EX000001', '08:12', '13:05', '4 sa 53 dk', '14:22*', 'Güvenlik çıkışı işlenmemiş', 'Ortalama kalma süresi: <b>5 sa 08 dk</b>', 'Rapor hazırlandı:'])
    expect(html).toContain(t);
  const xlsx = fs.readFileSync(path.join(r.out, mail.attachment));
  expect(xlsx.subarray(0, 2).toString()).toBe('PK');
  const xml = xlsx.toString('utf8');
  expect(xml).toContain('TESİS GİRİŞ');
  expect(xml.indexOf('LİN LOJİSTİK')).toBeLessThan(xml.indexOf('BULTRANS')); // müşteri önceliği Excel'de de geçerli
});

test('günlük rapor maili: eşiği aşan bekleyen araçlar "Uzun bekleyen araçlar" bölümünde en uzundan başlayarak listelenir; eşik kapalıysa ya da veri yoksa bölüm çıkmaz', () => {
  const open = [
    { plate: 'CB 1291 TA', customer: 'TORNADO EXPRESS', declaration: '', visit_date: '2026-09-28', visit_time: '09:00:00', onsite: true, t1: false, onsite_at: '2026-09-28T00:00:00Z' },   // girişten beri ≈ 69 saat (2 gün 20 sa)
    { plate: '34 ABC 123', customer: 'BULTRANS', declaration: '26341200EX0001', visit_date: '2026-09-27', visit_time: '08:00:00', onsite: true, t1: true, onsite_at: '2026-09-27T05:00:00Z' },   // girişten beri ≈ 88 saat
    { plate: 'X 111 YY', customer: 'LİN LOJ', declaration: '', visit_date: '2026-09-30', visit_time: '10:00:00', onsite: true, t1: false, onsite_at: '2026-09-30T07:00:00Z' },                    // bugün girdi: eşiğin altında
    { plate: 'Y 222 ZZ', customer: 'LİN LOJ', declaration: '', visit_date: '2026-09-25', visit_time: '10:00:00', onsite: false, t1: false, onsite_at: null }                                    // hiç gelmedi: uyarıya girmez (her gün bugüne aktarılır)
  ];
  let r = run({ ...base(), wait_hours: 48, open_visits: open });
  expect(r.code).toBe(0);
  const html = fs.readFileSync(path.join(r.out, 'rapor.html'), 'utf8');
  expect(html).toContain('UZUN BEKLEYEN ARAÇLAR · 2 gün ve üstü · 2 araç');
  expect(html.indexOf('34 ABC 123')).toBeGreaterThan(html.indexOf('UZUN BEKLEYEN'));
  expect(html.indexOf('34 ABC 123')).toBeLessThan(html.indexOf('CB 1291 TA', html.indexOf('UZUN BEKLEYEN')));   // en uzun (88 sa) üstte
  for (const t of ['3 gün 15 sa', '2 gün 20 sa', 'Tesiste · T1', '27.09 08:00']) expect(html).toContain(t);
  expect(html).not.toContain('X 111 YY');
  expect(html).not.toContain('Y 222 ZZ');
  const mail = JSON.parse(fs.readFileSync(path.join(r.out, 'mail.json'), 'utf8'));
  expect(mail.text).toContain('UZUN BEKLEYEN ARAÇLAR (2 gün ve üstü, 2 araç):\n34 ABC 123 · BULTRANS · tesiste · T1 · 3 gün 15 sa\nCB 1291 TA · TORNADO EXPRESS · tesiste · 2 gün 20 sa');
  // 12 saat eşiği: bugün girenler de (≈ 17 sa) listelenir
  r = run({ ...base(), wait_hours: 12, open_visits: open });
  expect(fs.readFileSync(path.join(r.out, 'rapor.html'), 'utf8')).toContain('UZUN BEKLEYEN ARAÇLAR · 12 sa ve üstü · 3 araç');
  // kapalı (0), hiç ayarlanmamış ya da eski veritabanı fonksiyonu (open_visits yok): bölüm çıkmaz, rapor yine gider
  for (const extra of [{ wait_hours: 0, open_visits: open }, { open_visits: open }, { wait_hours: 48 }]) {
    r = run({ ...base(), ...extra });
    expect(r.code).toBe(0);
    expect(fs.readFileSync(path.join(r.out, 'rapor.html'), 'utf8')).not.toContain('UZUN BEKLEYEN');
    expect(JSON.parse(fs.readFileSync(path.join(r.out, 'mail.json'), 'utf8')).text).not.toContain('UZUN BEKLEYEN');
  }
});

test('günlük rapor maili: kapalıysa, alıcı yoksa ya da araç yoksa gönderilmez', () => {
  let r = run({ ...base(), enabled: false });
  expect(r.code).toBe(0);
  expect(r.log).toContain('kapalı');
  expect(fs.existsSync(path.join(r.out, 'mail.json'))).toBe(false);
  r = run({ ...base(), recipients: [] });
  expect(r.code).toBe(0);
  expect(r.log).toContain('Alıcı yok');
  r = run({ ...base(), visits: [] });
  expect(r.code).toBe(0);
  expect(r.log).toContain('araç kaydı yok');
  expect(fs.existsSync(path.join(r.out, 'mail.json'))).toBe(false);
});

test('günlük rapor maili: GitHub gizli değerleri girilmemişse görev sessizce biter', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('henüz kurulmadı');
});

// ---- gece yedeği (scripts/gunluk-rapor/yedek.mjs): gerçek gönderim yerine "kuru" modda dosyaya yazar ----
const YEDEK = path.join(__dirname, '..', 'scripts', 'gunluk-rapor', 'yedek.mjs');
function runBackup(data, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-'));
  fs.writeFileSync(path.join(dir, 'veri.json'), JSON.stringify(data));
  const out = path.join(dir, 'cikti');
  const r = spawnSync(process.execPath, [YEDEK], { encoding: 'utf8', env: { ...process.env, YEDEK_VERI: path.join(dir, 'veri.json'), YEDEK_KURU: out, ...extraEnv } });
  return { code: r.status, log: r.stdout + r.stderr, out };
}
const bkData = () => ({
  enabled: true, recipients: ['ofis@ornek.com'],
  registry: [
    { id: 'r1', plate: '34 ABC 123', customer: 'BULTRANS', declaration: '26341200EX0001', carrier: 'KAAN LOJ.', registration: '15400 KG', updated_at: '2026-09-01T08:00:00Z' },
    { id: 'r2', plate: 'CB 1234 AB', customer: 'TORNADO; "EXPRESS"', declaration: '', carrier: '', registration: '' }
  ],
  visits: [
    visit('a1', '34 ABC 123', 'BULTRANS', { visit_date: '2026-09-28', note: 'acil, "özel"', onsite: true, t1: true, done: true, onsite_at: '2026-09-28T05:12:00Z', done_at: '2026-09-28T09:40:00Z', exit_at: '2026-09-28T10:05:00Z', fee_amount: 90, fee_currency: 'EUR' }),
    visit('a2', 'CB 1234 AB', 'TORNADO', { visit_date: '2026-09-30', note: '=1+1', fee_amount: null, fee_currency: '' }),
    visit('a3', 'X 1', 'LİN', { visit_date: '2026-09-29', note: '-acil' })
  ],
  app_settings: [{ key: 'appearance', value: { waitHours: '48' } }]
});

test('gece yedeği: tam yedek (JSON) ve iki CSV hazırlanır; müşteri, ücret ve saatler yerinde, formül sayılabilecek yazılar korunur', () => {
  const r = runBackup(bkData());
  expect(r.code).toBe(0);
  expect(r.log).toContain('1 alıcılık yedek');
  const mail = JSON.parse(fs.readFileSync(path.join(r.out, 'mail.json'), 'utf8'));
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  expect(mail.to).toEqual(['ofis@ornek.com']);
  expect(mail.subject).toBe(`PCS TRANSİT · Gece yedeği · ${day.split('-').reverse().join('.')} · 2 plaka, 3 geliş`);
  expect(mail.attachments).toEqual([`PCS_YEDEK_${day}.json`, `PCS_PLAKA_KAYITLARI_${day}.csv`, `PCS_GELISLER_${day}.csv`]);
  expect(mail.text).toContain('Geliş kaydı: 3 (28.09.2026 – 30.09.2026)');
  const json = JSON.parse(fs.readFileSync(path.join(r.out, mail.attachments[0]), 'utf8'));
  expect(json).toMatchObject({ app: 'PCS TRANSIT YYS', schemaVersion: 1, kind: 'gece-yedegi' });
  expect(json.data.registry.length).toBe(2);
  expect(json.data.visits.length).toBe(3);
  expect(json.data.visits[0]).toMatchObject({ id: 'a1', fee_amount: 90, exit_at: '2026-09-28T10:05:00Z' });      // veritabanı satırları olduğu gibi
  expect(json.data.app_settings).toEqual([{ key: 'appearance', value: { waitHours: '48' } }]);
  const reg = fs.readFileSync(path.join(r.out, mail.attachments[1]), 'utf8');
  expect(reg.charCodeAt(0)).toBe(0xFEFF);                                                                       // Excel için BOM
  expect(reg.split('\r\n')).toEqual(['﻿PLAKA;MÜŞTERİ;BEYANNAME;NAKLİYECİ;RUHSAT', '34 ABC 123;BULTRANS;26341200EX0001;KAAN LOJ.;15400 KG', 'CB 1234 AB;"TORNADO; ""EXPRESS""";;;', '']);
  const vis = fs.readFileSync(path.join(r.out, mail.attachments[2]), 'utf8').split('\r\n');
  expect(vis[0]).toContain('GELİŞ TARİHİ;SAAT;PLAKA;MÜŞTERİ');
  expect(vis[1]).toBe('2026-09-28;09:00;34 ABC 123;BULTRANS;;;;"acil, ""özel""";EVET;EVET;EVET;2026-09-28 08:12;2026-09-28 12:40;2026-09-28 13:05;90;EUR');
  expect(vis[2]).toContain(";'-acil;");                                                                         // "-acil" formül sayılmasın
  expect(vis[3]).toContain(";'=1+1;");
  expect(vis.length).toBe(5);
});

test('gece yedeği: kapalıysa, alıcı yoksa, veritabanı boşsa ya da çok büyükse gönderilmez; gizli değerler yoksa sessizce biter', () => {
  let r = runBackup({ ...bkData(), enabled: false });
  expect(r.code).toBe(0);
  expect(r.log).toContain('kapalı');
  expect(fs.existsSync(path.join(r.out, 'mail.json'))).toBe(false);
  r = runBackup({ ...bkData(), recipients: [] });
  expect(r.code).toBe(0);
  expect(r.log).toContain('Alıcı yok');
  r = runBackup({ ...bkData(), registry: [], visits: [] });
  expect(r.code).toBe(0);
  expect(r.log).toContain('Veritabanı boş görünüyor');
  expect(fs.existsSync(path.join(r.out, 'mail.json'))).toBe(false);
  // 20 MB'ı aşan yedek e-postaya sığmaz
  const big = bkData();
  big.visits = Array.from({ length: 30000 }, (_, i) => visit('b' + i, 'PL ' + i, 'MÜŞTERİ', { note: 'x'.repeat(900) }));
  r = runBackup(big);
  expect(r.log).toContain('e-postaya sığmayacak kadar büyük');
  expect(fs.existsSync(path.join(r.out, 'mail.json'))).toBe(false);
  const quiet = spawnSync(process.execPath, [YEDEK], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  expect(quiet.status).toBe(0);
  expect(quiet.stdout).toContain('henüz kurulmadı');
});
