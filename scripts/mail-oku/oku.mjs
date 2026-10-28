// Müşteri maillerini (Gmail kutusu) okuyup incoming_messages tablosuna araç mesajı olarak kaydeder.
// Hiçbir araç panoya (visits) yazılmaz: satırlar sitede "Mail" mesajı olarak onay bekler.
// Gerekli env: GMAIL_ADRES, GMAIL_UYGULAMA_SIFRESI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Eksikse sessizce çıkar.
// Test için run(deps) bağımlılıkları (env, fetch, imap, sleep, log) parametreyle alır.
import { pathToFileURL } from 'node:url';
import { temizGovde, htmldenMetin, yanitMi, ekleriAyikla, okunacakEkler, istanbulGun, geminiMetni } from './ayristir.mjs';
import { docxMetni } from './docx.mjs';
import { tesisKarari, kodListesi, geliyorMu } from './karar.mjs';
import { musteriBul } from './musteri.mjs';

const NL = String.fromCharCode(10);
const TABLO = 'incoming_messages';
const AZAMI_MAIL = 30;     // bir çalışmada en çok bu kadar mail
const AZAMI_YAZI = 4000;   // WhatsApp ile aynı sınır
const GEREKLI = ['GMAIL_ADRES', 'GMAIL_UYGULAMA_SIFRESI', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

// Gerçek IMAP bağlantısı (yalnızca elle/Actions çalışmasında yüklenir; testlerde sahte istemci verilir).
async function gmailBaglan(env) {
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: env.GMAIL_ADRES, pass: env.GMAIL_UYGULAMA_SIFRESI }, logger: false });
  await client.connect();
  const kilit = await client.getMailboxLock('INBOX');
  return {
    async listUnseen(azami) {
      const uids = ((await client.search({ seen: false }, { uid: true })) || []).slice(0, azami);
      const out = [];
      for (const uid of uids) {
        const m = await client.fetchOne(uid, { source: true }, { uid: true });
        out.push({ uid, mail: await simpleParser(m.source) });
      }
      return out;
    },
    async markSeen(uid) { await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }); },
    async close() { kilit.release(); await client.logout(); }
  };
}

export async function run(deps = {}) {
  const env = deps.env || process.env;
  const log = deps.log || console.log;
  const hata = deps.error || console.error;
  const fetchFn = deps.fetch || globalThis.fetch;
  const sleep = deps.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const eksik = GEREKLI.filter(k => !String(env[k] || '').trim());
  if (eksik.length) { log('Mail okuma atlandı: eksik gizli değerler: ' + eksik.join(', ')); return { atlandi: true }; }

  const base = String(env.SUPABASE_URL).replace(/\/+$/, '');
  const anahtar = env.SUPABASE_SERVICE_ROLE_KEY;
  const baslik = { apikey: anahtar, Authorization: 'Bearer ' + anahtar };
  const sb = (yol, init = {}) => fetchFn(base + yol, { ...init, headers: { ...baslik, ...(init.headers || {}) } });
  const JSON_BASLIK = { 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const sonuc = { islenen: 0, yeni: 0, devam: 0, tekrar: 0, hata: 0, yoksayilan: 0, beyanname: 0 };

  // Ayarlar'daki müşteri e-posta listesi (okunamazsa Gemini'nin müşteri alanı kullanılır)
  let emails = {}, kodlar = [], comes = {};
  try {
    const r = await sb('/rest/v1/app_settings?select=value&key=eq.customer_contacts');
    if (r.ok) { const v = (await r.json())[0]?.value || {}; emails = v.emails || {}; kodlar = kodListesi(v.facility_codes); comes = v.comes || {}; }
  } catch (_) { /* ayar okunamadı: sorun değil */ }

  const imap = deps.imap || await gmailBaglan(env);
  try {
    const mailler = await imap.listUnseen(AZAMI_MAIL);
    for (const { uid, mail } of mailler) {
      try {
        const bitti = await isle(mail);
        if (bitti) await imap.markSeen(uid);
      } catch (e) { sonuc.hata++; hata('Mail işlenemedi:', e.message); }
    }
  } finally { await imap.close?.(); }
  log(`Mail okuma bitti: ${JSON.stringify(sonuc)}`);
  return sonuc;

  // true: mail kaydedildi (ya da zaten kayıtlıydı), okundu işaretlenebilir
  async function isle(mail) {
    sonuc.islenen++;
    const adres = String(mail.from?.value?.[0]?.address || mail.from?.address || '').trim().toLowerCase();
    const ad = String(mail.from?.value?.[0]?.name || mail.from?.name || '').trim();
    const konu = String(mail.subject || '').trim();
    const kimlik = 'mail:' + (String(mail.messageId || '').trim() || `${adres}|${konu}|${new Date(mail.date || 0).toISOString()}`);

    const var_ = await sb(`/rest/v1/${TABLO}?select=id&wa_message_id=eq.${encodeURIComponent(kimlik)}`);
    if (!var_.ok) throw new Error(`Mesaj kontrolü: ${var_.status} ${(await var_.text().catch(() => '')).slice(0, 200)}`);
    if ((await var_.json()).length) { sonuc.tekrar++; return true; }

    const ham = mail.text || htmldenMetin(mail.html || '');
    const govde = temizGovde(ham);
    const { dosyalar, beyannameler: adBeyan } = ekleriAyikla(mail.attachments);
    let beyannameler = adBeyan;
    const tarih = mail.date instanceof Date && !isNaN(mail.date) ? mail.date : new Date();
    const gun = istanbulGun(tarih);
    const devam = yanitMi({ subject: konu, inReplyTo: mail.inReplyTo, references: mail.references, temiz: govde });
    const yazi = [konu, govde].filter(Boolean).join('\n\n').slice(0, AZAMI_YAZI);
    const musteri = musteriBul(adres, emails);
    const satir = { wa_message_id: kimlik, from_number: adres.slice(0, 200), sender_name: ad.slice(0, 200), body: yazi, created_at: tarih.toISOString() };
    const ekle = async ek => {
      const r = await sb(`/rest/v1/${TABLO}?on_conflict=wa_message_id`, { method: 'POST', headers: { ...JSON_BASLIK, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ ...satir, ...ek }) });
      if (!r.ok) throw new Error(`Mesaj kaydedilemedi: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
    };
    const guncelle = async govdeJson => {
      const r = await sb(`/rest/v1/${TABLO}?wa_message_id=eq.${encodeURIComponent(kimlik)}&status=eq.okunuyor`, { method: 'PATCH', headers: JSON_BASLIK, body: JSON.stringify(govdeJson) });
      if (!r.ok) throw new Error(`Mesaj satırı güncellenemedi: ${r.status}`);
    };

    // Konuşmanın devamı: Gemini'ye gitmez, yeni araç önerilmez.
    if (devam) {
      await ekle({ status: 'yoksayildi', note: ('Konuşmanın devamı' + (beyannameler.length ? ' · Beyanname: ' + beyannameler.join(', ') : '')).slice(0, 300) });
      sonuc.devam++; return true;
    }
    // Rakam içermeyen ya da çok kısa yazı plaka taşımaz
    if (!/\d/.test(yazi) || yazi.length < 6) { await ekle({ status: 'yoksayildi', note: 'Araç bilgisi yok' }); sonuc.yoksayilan++; return true; }

    await ekle({ status: 'okunuyor' });
    // Ekler yalnızca bellekte okunur: beyanname adayları Gemini'ye, .docx düz metne çevrilip mesaja eklenir.
    const { belgeler, docxler } = okunacakEkler(mail.attachments);
    const okunan = [];
    for (const b of belgeler) { const d = await beyannameOku(b); if (d?.declaration) okunan.push(d); }
    const docxYazi = docxler.map(b => docxMetni(b)).filter(Boolean).join(NL).slice(0, 2000);
    beyannameler = [...new Set([...okunan.map(d => d.number).filter(Boolean), ...adBeyan])].slice(0, 10);
    const r = await gemini(geminiMetni({ konu, gonderen: ad ? `${ad} <${adres}>` : adres, govde: [govde, docxYazi && 'Ek belge (docx) metni:' + NL + docxYazi].filter(Boolean).join(NL + NL), dosyalar, beyannameler, gun }), gun);
    if (!r.ok) { await guncelle({ status: 'hata', note: ('Yapay zekâ mesajı okuyamadı' + (r.neden ? ': ' + r.neden : '')).slice(0, 300) }); sonuc.hata++; return true; }
    const v = r.veri, sorun = String(v.problem || '').trim();
    const musteriAdi = musteri || String(v.customer || '');
    const items = tesisKarari({
      items: (v.items || []).map(it => beyannameler.length ? { ...it, note: [it.note, 'Beyanname: ' + beyannameler.join(', ')].filter(Boolean).join(' · ').slice(0, 160) } : it),
      beyannameler: okunan, kodlar, gelirMi: geliyorMu(comes, musteriAdi)
    });
    const aiSonuc = { items, customer: musteriAdi, problem: sorun, model: String(v.model || '') };
    if (beyannameler.length) aiSonuc.declarations = beyannameler;
    const kodOku = [...new Set(okunan.map(d => String(d.facility_code || '').trim()).filter(Boolean))];
    if (kodOku.length) aiSonuc.facility_codes = kodOku;
    sonuc.beyanname += okunan.length;
    if (!items.length) { await guncelle({ status: 'yoksayildi', note: ('Araç bulunamadı' + (sorun ? ' · ' + sorun : '')).slice(0, 300), ai: { ...aiSonuc, items: [] } }); sonuc.yoksayilan++; return true; }
    await guncelle({ status: 'bekliyor', ai: aiSonuc });
    sonuc.yeni++; return true;
  }

  // ruhsat-oku çağrısı. Geçici hatalarda (429/5xx/ağ) en çok 3 deneme. İçerik hiçbir yere yazılmaz.
  async function cagir(init, gecerli) {
    let neden = '';
    for (let i = 1; i <= 3; i++) {
      let durum = 0, govde = null;
      try {
        const r = await sb('/functions/v1/ruhsat-oku', { method: 'POST', ...init });
        durum = r.status; govde = await r.json().catch(() => null);
        if (r.ok && gecerli(govde)) return { ok: true, veri: govde };
      } catch (_) { durum = 0; }
      neden = govde?.reason || (durum ? 'sunucu hatası ' + durum : 'bağlantı kurulamadı');
      if (govde?.fatal || !(durum === 0 || durum === 429 || durum >= 500) || i === 3) break;
      await sleep(Math.min(40, durum === 429 ? Math.max(5, +govde?.retry_after || 15) : 8) * 1000);
    }
    return { ok: false, neden };
  }
  function gemini(metin, gun) { return cagir({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: metin, today: gun }) }, g => Array.isArray(g?.items)); }
  // Beyanname modu: okunamazsa ya da beyanname değilse null (sessizce atlanır)
  async function beyannameOku(b) {
    const r = await cagir({ headers: { 'Content-Type': b.tur, 'x-pcs-mode': 'beyanname' }, body: b.icerik }, g => typeof g?.declaration === 'boolean');
    return r.ok ? r.veri : null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(e => { console.error('Mail okuma hatası:', e.message); process.exit(1); }).then(s => { if (s && s.hata) process.exitCode = 1; });
}
