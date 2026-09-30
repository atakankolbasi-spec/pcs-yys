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
  const html = fs.readFileSync(path.join(r.out, 'rapor.html'), 'utf8');
  for (const t of ['30.09.2026 Çarşamba', 'PP 7685 BP - PP 2758 EA', '26341200EX000001', '08:12', '13:05', '4 sa 53 dk', '14:22*', 'Güvenlik çıkışı işlenmemiş', 'Ortalama kalma süresi: <b>5 sa 08 dk</b>'])
    expect(html).toContain(t);
  const xlsx = fs.readFileSync(path.join(r.out, mail.attachment));
  expect(xlsx.subarray(0, 2).toString()).toBe('PK');
  const xml = xlsx.toString('utf8');
  expect(xml).toContain('TESİS GİRİŞ');
  expect(xml.indexOf('LİN LOJİSTİK')).toBeLessThan(xml.indexOf('BULTRANS')); // müşteri önceliği Excel'de de geçerli
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
