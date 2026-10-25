/* PCS TRANSİT YYS · gece yedeği (e-posta).
 * GitHub Actions'ta her gece 02:30'da (İstanbul) çalışır (.github/workflows/gece-yedegi.yml):
 *   1. Bütün plaka kayıtlarını, gelişleri ve ayarları "rapor anahtarı" ile veritabanından sayfa sayfa okur (backup_page).
 *   2. Üç dosya hazırlar: tam yedek (JSON) ve iki CSV (plaka kayıtları, gelişler; Excel'de açılır).
 *   3. Ayarlar > Rapor ve yedek'teki alıcılara Gmail üzerinden gönderir, sonucu yazar (backup_log).
 * Ortam değişkenleri (günlük raporla aynı GitHub gizli değerleri): PCS_RAPOR_ANAHTARI, GMAIL_ADRES, GMAIL_UYGULAMA_SIFRESI.
 * İsteğe bağlı: YEDEK_KURU (klasör: gönderme, dosyalara yaz), YEDEK_VERI (JSON dosyası: veritabanı yerine bu veriyi kullan;
 * deneme için: {enabled, recipients, registry, visits, app_settings}). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const env = process.env;
const TZ = 'Europe/Istanbul';
const PAGE = 1000;
const MAX_MAIL_BYTES = 20 * 1024 * 1024; // Gmail'in 25 MB sınırının altında kalmak için

const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const SB_URL = (appJs.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
const SB_KEY = (appJs.match(/sb_publishable_[A-Za-z0-9_-]+/) || [])[0];
const TOKEN = (env.PCS_RAPOR_ANAHTARI || '').trim();

const istDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); // YYYY-AA-GG
const fmtDate = s => s.split('-').reverse().join('.');
const nf = new Intl.NumberFormat('tr-TR');
/* 02:30 görevi gece yarısından sonra çalışır; dosya adındaki tarih bugünün tarihidir */
const TODAY = istDate(Date.now());

async function rpc(name, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${json?.message || text}`);
  return json;
}
async function log(ok, note) {
  console.log(`${ok ? 'Tamam' : 'HATA'}: ${note}`);
  if (env.YEDEK_VERI || !TOKEN) return;
  try { await rpc('backup_log', { p_token: TOKEN, p_ok: ok, p_note: note }); } catch (e) { console.log('Sonuç veritabanına yazılamadı:', e.message); }
}

/* bir tablonun bütün satırları (sayfa sayfa); ilk sayfa ayarları da getirir */
async function readAll() {
  const out = { enabled: false, recipients: [] };
  for (const table of ['registry', 'visits', 'app_settings']) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await rpc('backup_page', { p_token: TOKEN, p_table: table, p_offset: offset, p_limit: PAGE });
      if (table === 'registry' && offset === 0) { out.enabled = !!page.enabled; out.recipients = page.recipients || []; if (!out.enabled) return out; }
      rows.push(...(page.rows || []));
      if ((page.rows || []).length < PAGE) break;
    }
    out[table] = rows;
  }
  return out;
}

/* CSV: Türkçe Excel için noktalı virgül ve UTF-8 BOM */
/* Excel'de formül sayılmasın diye = + @ (ve - ile başlayan yazı) önüne ' konur; tam kayıt JSON dosyasındadır */
const csvCell = v => { let s = v == null ? '' : typeof v === 'boolean' ? (v ? 'EVET' : 'HAYIR') : String(v); if (/^([=+@]|-[^\d.,\s])/.test(s)) s = "'" + s; return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (head, rows) => '﻿' + [head.join(';'), ...rows.map(r => r.map(csvCell).join(';'))].join('\r\n') + '\r\n';
const ts = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(d); };

function build(data) {
  const registry = data.registry || [], visits = data.visits || [];
  const stamp = TODAY;
  const json = JSON.stringify({ app: 'PCS TRANSIT YYS', schemaVersion: 1, kind: 'gece-yedegi', exportedAt: new Date().toISOString(), data: { registry, visits, app_settings: data.app_settings || [] } });
  const regCsv = csv(['PLAKA', 'MÜŞTERİ', 'BEYANNAME', 'NAKLİYECİ', 'RUHSAT'], registry.slice().sort((a, b) => String(a.plate).localeCompare(String(b.plate))).map(r => [r.plate, r.customer, r.declaration, r.carrier, r.registration]));
  const visCsv = csv(['GELİŞ TARİHİ', 'SAAT', 'PLAKA', 'MÜŞTERİ', 'BEYANNAME', 'NAKLİYECİ', 'RUHSAT', 'NOT', 'TESİSTE', 'T1 YAZILDI', 'İŞLEMLER BİTTİ', 'TESİS GİRİŞ', 'İŞLEM BİTTİ SAATİ', 'TESİS ÇIKIŞ', 'ÜCRET', 'PARA BİRİMİ'],
    visits.slice().sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)) || String(a.visit_time || '').localeCompare(String(b.visit_time || '')) || String(a.plate).localeCompare(String(b.plate)))
      .map(v => [v.visit_date, String(v.visit_time || '').slice(0, 5), v.plate, v.customer, v.declaration, v.carrier, v.registration, v.note, !!v.onsite, !!v.t1, !!v.done, ts(v.onsite_at), ts(v.done_at), ts(v.exit_at), v.fee_amount, v.fee_currency]));
  const files = [
    { filename: `PCS_YEDEK_${stamp}.json`, content: Buffer.from(json, 'utf8'), contentType: 'application/json' },
    { filename: `PCS_PLAKA_KAYITLARI_${stamp}.csv`, content: Buffer.from(regCsv, 'utf8'), contentType: 'text/csv; charset=utf-8' },
    { filename: `PCS_GELISLER_${stamp}.csv`, content: Buffer.from(visCsv, 'utf8'), contentType: 'text/csv; charset=utf-8' }
  ];
  const dates = visits.map(v => v.visit_date).filter(Boolean).sort();
  return { files, registry: registry.length, visits: visits.length, first: dates[0] || '', last: dates[dates.length - 1] || '' };
}

function mail(b) {
  const total = b.files.reduce((n, f) => n + f.content.length, 0);
  const subject = `PCS TRANSİT · Gece yedeği · ${fmtDate(TODAY)} · ${nf.format(b.registry)} plaka, ${nf.format(b.visits)} geliş`;
  const size = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const list = b.files.map(f => `${f.filename} (${size(f.content.length)})`);
  const range = b.first ? `${fmtDate(b.first)} – ${fmtDate(b.last)}` : '—';
  const text = `${subject}\n\nPlaka kaydı: ${nf.format(b.registry)}\nGeliş kaydı: ${nf.format(b.visits)} (${range})\n\nEkler:\n- ${list.join('\n- ')}\n\n` +
    'JSON dosyası bütün kayıtları içerir (veritabanı bozulursa buradan geri yüklenir); CSV dosyaları Excel\'de açılır. ' +
    'Bu dosyalar müşteri ve araç bilgisi içerir: güvenli saklayın, başkalarına iletmeyin. Bu mail PCS TRANSİT YYS tarafından otomatik gönderildi.';
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${subject}</title></head><body style="margin:0;padding:20px;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif;color:#16233a">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden"><div style="background:#16233a;padding:16px 20px;color:#fff"><div style="font-size:12px;letter-spacing:2px;color:#8fb3ff;font-weight:700">PCS TRANSİT YYS · GECE YEDEĞİ</div><div style="font-size:20px;font-weight:800;margin-top:4px">${fmtDate(TODAY)}</div></div>
<div style="padding:18px 20px;font-size:14px;line-height:1.55"><p style="margin:0 0 10px"><b>${nf.format(b.registry)}</b> plaka kaydı · <b>${nf.format(b.visits)}</b> geliş kaydı <span style="color:#5b6b82">(${range})</span></p>
<p style="margin:0 0 6px;font-weight:700">Ekler (${size(total)})</p><ul style="margin:0 0 14px;padding-left:20px">${list.map(x => `<li>${x}</li>`).join('')}</ul>
<p style="margin:0 0 10px">JSON dosyası bütün kayıtları içerir; veritabanı bozulursa buradan geri yüklenir. CSV dosyaları Excel'de açılır.</p>
<p style="margin:0;font-size:12px;color:#6b7a90">Dosyalar müşteri ve araç bilgisi içerir: güvenli saklayın, başkalarına iletmeyin. Bu mail otomatik gönderildi.</p></div></div></body></html>`;
  return { subject, html, text, total };
}

async function main() {
  if (!SB_URL || !SB_KEY) throw new Error('app.js içinde Supabase adresi ya da anahtarı bulunamadı.');
  let data;
  if (env.YEDEK_VERI) data = JSON.parse(fs.readFileSync(env.YEDEK_VERI, 'utf8'));
  else {
    const missing = ['PCS_RAPOR_ANAHTARI', 'GMAIL_ADRES', 'GMAIL_UYGULAMA_SIFRESI'].filter(k => !(env[k] || '').trim());
    if (missing.length && !env.YEDEK_KURU) { console.log(`::notice::Gece yedeği henüz kurulmadı (GitHub gizli değerleri eksik: ${missing.join(', ')}). Kurulum: supabase/README.md bölüm 12.`); return; }
    data = await readAll();
  }
  if (!data.enabled) { console.log('Gece yedeği Ayarlar\'da kapalı; gönderilmedi.'); return; }
  const to = (data.recipients || []).filter(Boolean);
  if (!to.length) return log(false, 'Alıcı yok; Ayarlar > Rapor ve yedek bölümünden ekleyin.');
  if (!(data.registry || []).length && !(data.visits || []).length) return log(false, 'Veritabanı boş görünüyor; yedek gönderilmedi. Beklenmedik bir durumsa Supabase\'i kontrol edin.');
  const b = build(data), m = mail(b);
  if (b.files[0].content.length > MAX_MAIL_BYTES) return log(false, `Yedek e-postaya sığmayacak kadar büyük (${(b.files[0].content.length / 1048576).toFixed(1)} MB). Veri ve yedek sayfasından elle indirin.`);
  // CSV'ler sığmıyorsa yalnızca tam yedek (JSON) gönderilir
  if (m.total > MAX_MAIL_BYTES) b.files = b.files.slice(0, 1);
  if (env.YEDEK_KURU) {
    fs.mkdirSync(env.YEDEK_KURU, { recursive: true });
    for (const f of b.files) fs.writeFileSync(path.join(env.YEDEK_KURU, f.filename), f.content);
    fs.writeFileSync(path.join(env.YEDEK_KURU, 'mail.json'), JSON.stringify({ to, subject: m.subject, text: m.text, attachments: b.files.map(f => f.filename) }, null, 2));
    return log(true, `Deneme: ${to.length} alıcılık yedek dosyaya yazıldı (${b.registry} plaka, ${b.visits} geliş).`);
  }
  const { default: nodemailer } = await import('nodemailer');
  const from = env.GMAIL_ADRES.trim();
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: from, pass: env.GMAIL_UYGULAMA_SIFRESI.replace(/\s+/g, '') } });
  await transport.sendMail({ from: { name: 'PCS TRANSİT YYS', address: from }, to, subject: m.subject, text: m.text, html: m.html, attachments: b.files });
  await log(true, `${fmtDate(TODAY)}: ${to.length} alıcıya gönderildi · ${b.registry} plaka, ${b.visits} geliş.`);
}

main().catch(async e => {
  const msg = /Invalid login|Username and Password not accepted|EAUTH/i.test(String(e?.message || e))
    ? 'Gmail girişi reddedildi: GMAIL_ADRES ve GMAIL_UYGULAMA_SIFRESI değerlerini kontrol edin (uygulama şifresi gerekir, normal şifre çalışmaz).'
    : /backup_page|backup_log/.test(String(e?.message || e)) && /404|PGRST202|Could not find/i.test(String(e?.message || e))
      ? 'Veritabanında yedek fonksiyonları yok: supabase/gece-yedegi-kurulumu.sql dosyasını çalıştırın.'
      : String(e?.message || e);
  await log(false, msg);
  console.log(`::error::${msg}`);
  process.exit(1);
});
