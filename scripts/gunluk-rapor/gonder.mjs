/* PCS TRANSİT YYS · günlük rapor maili.
 * GitHub Actions'ta her iş günü 23:59'da çalışır (.github/workflows/gunluk-rapor.yml):
 *   1. Günün araçlarını "rapor anahtarı" ile veritabanından okur (report_day).
 *   2. Sitedeki günlük Excel'in aynısını üretir (xlsx.js) ve mail içine günün özetini yazar.
 *   3. Ayarlar > Otomatik günlük rapor'daki alıcılara Gmail üzerinden gönderir, sonucu yazar (report_log).
 * Ortam değişkenleri (GitHub gizli değerleri): PCS_RAPOR_ANAHTARI, GMAIL_ADRES, GMAIL_UYGULAMA_SIFRESI.
 * İsteğe bağlı: RAPOR_TARIHI (YYYY-AA-GG; boşsa bugün), RAPOR_KURU (klasör: gönderme, dosyalara yaz),
 * RAPOR_VERI (JSON dosyası: veritabanı yerine bu veriyi kullan; deneme için). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const env = process.env;
const TZ = 'Europe/Istanbul';
const DAY = 86400000;
const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const SB_URL = (appJs.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
const SB_KEY = (appJs.match(/sb_publishable_[A-Za-z0-9_-]+/) || [])[0];
const TOKEN = (env.PCS_RAPOR_ANAHTARI || '').trim();

const istDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms)); // YYYY-AA-GG
/* 23:59 görevi gecikip gece yarısını geçse de rapor o günün olsun: 3 saat geriye bakılır */
const DATE = /^\d{4}-\d{2}-\d{2}$/.test(env.RAPOR_TARIHI || '') ? env.RAPOR_TARIHI : istDate(Date.now() - 3 * 3600e3);

async function rpc(name, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${json?.message || text}`);
  return json;
}
async function log(ok, note) {
  console.log(`${ok ? 'Tamam' : 'HATA'}: ${note}`);
  if (env.RAPOR_VERI || !TOKEN) return;
  try { await rpc('report_log', { p_token: TOKEN, p_ok: ok, p_note: note }); } catch (e) { console.log('Sonuç veritabanına yazılamadı:', e.message); }
}

/* ---- tarih / saat yardımcıları ---- */
const pad = n => String(n).padStart(2, '0');
const fmtDate = s => s.split('-').reverse().join('.');
const dayIdx = s => (new Date(s + 'T12:00:00Z').getUTCDay() + 6) % 7;
const addDays = (s, n) => new Date(Date.parse(s + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
function weekInfo(s) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const y = d.getUTCFullYear(); return { year: y, week: Math.ceil(((d - Date.UTC(y, 0, 1)) / DAY + 1) / 7) }; }
const hm = iso => new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
/* raporun gününden farklı bir günse tarih de yazılır */
const when = iso => { if (!iso) return '—'; const d = istDate(Date.parse(iso)); return (d === DATE ? '' : fmtDate(d).slice(0, 5) + ' ') + hm(iso); };
const stay = m => m == null ? '—' : m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${pad(m % 60)} dk`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---- günlük Excel: sitedeki xlsx.js ile aynı dosya ---- */
async function excel(visits, priority) {
  globalThis.window = globalThis;
  (0, eval)(fs.readFileSync(path.join(ROOT, 'xlsx.js'), 'utf8'));
  const wk = weekInfo(DATE), monday = addDays(DATE, -dayIdx(DATE));
  const out = window.PCSXLSX.makeWorkbook({ state: { visits, registry: [] }, year: wk.year, week: wk.week, monday, selectedDate: DATE, demo: false, customerPriority: priority }, 'day');
  return { name: out.name, content: Buffer.from(await out.blob.arrayBuffer()) };
}

/* ---- mail içeriği ---- */
function report(visits) {
  const outAt = v => v.exit_at || v.done_at || null;
  const stayMin = v => { const o = outAt(v); if (!v.onsite_at || !o) return null; const m = Math.round((new Date(o) - new Date(v.onsite_at)) / 60000); return m >= 0 ? m : null; };
  const n = { total: visits.length, onsite: visits.filter(v => v.onsite || v.onsite_at).length, t1: visits.filter(v => v.t1).length, done: visits.filter(v => v.done).length, out: visits.filter(v => v.exit_at).length };
  n.pending = n.total - n.done;
  const stays = visits.map(stayMin).filter(m => m != null), avg = stays.length ? Math.round(stays.reduce((a, b) => a + b, 0) / stays.length) : null;
  const groups = new Map();
  for (const v of visits) { const k = v.customer || '(Müşteri yok)'; const g = groups.get(k) || { n: 0, o: 0, t: 0, d: 0, x: 0 }; g.n++; g.o += (v.onsite || v.onsite_at) ? 1 : 0; g.t += v.t1 ? 1 : 0; g.d += v.done ? 1 : 0; g.x += v.exit_at ? 1 : 0; groups.set(k, g); }
  const custs = [...groups].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], 'tr'));
  const list = visits.slice().sort((a, b) => (a.customer || '').localeCompare(b.customer || '', 'tr') || String(a.onsite_at || a.visit_time || '~').localeCompare(String(b.onsite_at || b.visit_time || '~')) || a.plate.localeCompare(b.plate));
  const title = `${fmtDate(DATE)} ${GUNLER[dayIdx(DATE)]}`;
  const subject = `PCS TRANSİT · Günlük rapor · ${title} · ${n.total} araç`;

  const th = 'padding:8px 10px;background:#16233a;color:#fff;font-size:12px;text-align:left;font-weight:700';
  const td = 'padding:7px 10px;border-bottom:1px solid #e3e8ef;font-size:13px;color:#16233a';
  const num = td + ';text-align:center';
  const kpi = (l, v, c) => `<td style="padding:12px 14px;border:1px solid #e3e8ef;border-top:3px solid ${c};border-radius:6px;background:#fff;text-align:center"><div style="font-size:24px;font-weight:800;color:${c}">${v}</div><div style="font-size:11px;color:#5b6b82;font-weight:700;text-transform:uppercase">${l}</div></td>`;
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:#f4f6fa;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#16233a;padding:18px 22px;color:#fff"><div style="font-size:12px;letter-spacing:2px;color:#8fb3ff;font-weight:700">PCS TRANSİT YYS · GÜNLÜK RAPOR</div><div style="font-size:22px;font-weight:800;margin-top:4px">${esc(title)}</div></td></tr>
<tr><td style="padding:18px 22px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>${kpi('Toplam araç', n.total, '#1f4fb8')}${kpi('Tesise giren', n.onsite, '#d97706')}${kpi('T1 yazılan', n.t1, '#2f5fd0')}${kpi('İşlemi biten', n.done, '#15803d')}${kpi('Çıkış yapan', n.out, '#0f766e')}${kpi('Bekleyen', n.pending, '#b91c1c')}</tr></table>
<p style="font-size:13px;color:#3e4c63;margin:10px 4px 18px">Ortalama kalma süresi: <b>${stay(avg)}</b>${stays.length ? ` (${stays.length} araç)` : ''}</p>
<div style="font-size:13px;font-weight:800;color:#16233a;margin:0 4px 8px">MÜŞTERİ BAZINDA</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:22px"><tr><th style="${th}">Müşteri</th><th style="${th};text-align:center">Araç</th><th style="${th};text-align:center">Tesiste</th><th style="${th};text-align:center">T1</th><th style="${th};text-align:center">Bitti</th><th style="${th};text-align:center">Çıktı</th></tr>
${custs.map(([k, g]) => `<tr><td style="${td};font-weight:700">${esc(k)}</td><td style="${num}">${g.n}</td><td style="${num}">${g.o}</td><td style="${num}">${g.t}</td><td style="${num}">${g.d}</td><td style="${num}">${g.x}</td></tr>`).join('')}</table>
<div style="font-size:13px;font-weight:800;color:#16233a;margin:0 4px 8px">ARAÇLAR · GİRİŞ – ÇIKIŞ</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><th style="${th}">Müşteri</th><th style="${th}">Plaka</th><th style="${th}">Beyanname</th><th style="${th};text-align:center">Tesis giriş</th><th style="${th};text-align:center">İşlem bitti</th><th style="${th};text-align:center">Tesis çıkış</th><th style="${th};text-align:center">Kalma</th></tr>
${list.map(v => { const est = !v.exit_at && v.done_at; return `<tr><td style="${td}">${esc(v.customer || '—')}</td><td style="${td};font-weight:700;white-space:nowrap">${esc(v.plate)}</td><td style="${td}">${esc(v.declaration || '—')}</td><td style="${num}">${when(v.onsite_at)}</td><td style="${num}">${when(v.done_at)}</td><td style="${num}${est ? ';color:#9c6500;font-style:italic' : ''}">${when(outAt(v))}${est ? '*' : ''}</td><td style="${num}">${stay(stayMin(v))}</td></tr>`; }).join('')}</table>
${list.some(v => !v.exit_at && v.done_at) ? '<p style="font-size:12px;color:#6b7a90;margin:8px 4px 0">* Güvenlik çıkışı işlenmemiş; işlemlerin bittiği saat yazıldı.</p>' : ''}
<p style="font-size:12px;color:#6b7a90;margin:22px 4px 0">Ekte günün Excel raporu var. Bu mail PCS TRANSİT YYS tarafından otomatik gönderildi; almak istemiyorsanız ofise haber verin.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${subject}\n\nToplam araç: ${n.total} · Tesise giren: ${n.onsite} · T1: ${n.t1} · İşlemi biten: ${n.done} · Çıkış yapan: ${n.out} · Bekleyen: ${n.pending}\nOrtalama kalma: ${stay(avg)}\n\n` +
    custs.map(([k, g]) => `${k}: ${g.n} araç (tesiste ${g.o}, T1 ${g.t}, bitti ${g.d}, çıktı ${g.x})`).join('\n') + '\n\nAyrıntılar ekteki Excel dosyasında.';
  return { subject, html, text };
}

async function main() {
  if (!SB_URL || !SB_KEY) throw new Error('app.js içinde Supabase adresi ya da anahtarı bulunamadı.');
  let data;
  if (env.RAPOR_VERI) data = JSON.parse(fs.readFileSync(env.RAPOR_VERI, 'utf8'));
  else {
    const missing = ['PCS_RAPOR_ANAHTARI', 'GMAIL_ADRES', 'GMAIL_UYGULAMA_SIFRESI'].filter(k => !(env[k] || '').trim());
    if (missing.length && !env.RAPOR_KURU) { console.log(`::notice::Günlük rapor henüz kurulmadı (GitHub gizli değerleri eksik: ${missing.join(', ')}). Kurulum: supabase/README.md bölüm 10.`); return; }
    data = await rpc('report_day', { p_token: TOKEN, p_date: DATE });
  }
  console.log(`Rapor günü: ${DATE}`);
  if (!data.enabled) { console.log('Otomatik rapor Ayarlar\'da kapalı; gönderilmedi.'); return; }
  const to = (data.recipients || []).filter(Boolean);
  if (!to.length) return log(false, 'Alıcı yok; Ayarlar > Otomatik günlük rapor bölümünden ekleyin.');
  const visits = (data.visits || []).map(v => ({ ...v, date: v.visit_date, time: String(v.visit_time || '').slice(0, 5), createdAt: v.created_at, customer: v.customer || '', declaration: v.declaration || '', carrier: v.carrier || '', registration: v.registration || '', note: v.note || '', plate: v.plate || '' }));
  if (!visits.length) return log(true, `${fmtDate(DATE)}: araç kaydı yok; rapor gönderilmedi.`);
  const mail = report(visits);
  const xlsx = await excel(visits, Array.isArray(data.customer_priority) ? data.customer_priority : []);
  if (env.RAPOR_KURU) {
    fs.mkdirSync(env.RAPOR_KURU, { recursive: true });
    fs.writeFileSync(path.join(env.RAPOR_KURU, 'rapor.html'), mail.html);
    fs.writeFileSync(path.join(env.RAPOR_KURU, xlsx.name), xlsx.content);
    fs.writeFileSync(path.join(env.RAPOR_KURU, 'mail.json'), JSON.stringify({ to, subject: mail.subject, text: mail.text, attachment: xlsx.name }, null, 2));
    return log(true, `Deneme: ${to.length} alıcılık mail dosyaya yazıldı (${visits.length} araç).`);
  }
  const { default: nodemailer } = await import('nodemailer');
  const from = env.GMAIL_ADRES.trim();
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: from, pass: env.GMAIL_UYGULAMA_SIFRESI.replace(/\s+/g, '') } });
  await transport.sendMail({ from: { name: 'PCS TRANSİT YYS', address: from }, to, subject: mail.subject, text: mail.text, html: mail.html,
    attachments: [{ filename: xlsx.name, content: xlsx.content, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }] });
  await log(true, `${fmtDate(DATE)}: ${to.length} alıcıya gönderildi · ${visits.length} araç.`);
}

main().catch(async e => {
  const msg = /Invalid login|Username and Password not accepted|EAUTH/i.test(String(e?.message || e))
    ? 'Gmail girişi reddedildi: GMAIL_ADRES ve GMAIL_UYGULAMA_SIFRESI değerlerini kontrol edin (uygulama şifresi gerekir, normal şifre çalışmaz).'
    : String(e?.message || e);
  await log(false, msg);
  console.log(`::error::${msg}`);
  process.exit(1);
});
