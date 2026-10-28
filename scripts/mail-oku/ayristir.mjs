// Mail ön işleme: saf (ağsız) fonksiyonlar. Yalnızca en üstteki yeni kısmı alır, yanıtları ayırt eder,
// ek dosya adlarından beyanname numaralarını çıkarır.

const trNorm = s => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Alıntı / eski yazışma başlangıçları: bu satırdan sonrası atılır.
const KESME = [
  /^\s*-{2,}\s*(original message|orijinal (ileti|mesaj)|forwarded message|iletilen (ileti|mesaj))\s*-{2,}/i,
  /^\s*_{5,}\s*$/,
  /^\s*(from|sent|gönderen|gönderilen|kimden|de|von)\s*:/i,
  /^\s*on .{5,200}wrote:\s*$/i,
  /^\s*.{5,200}(tarihinde|tarihli).{0,200}(yazdı|gönderdi)\s*:?\s*$/i,
  /^\s*>/
];
// İmza başlangıçları
const IMZA = [/^--\s*$/, /^\s*(saygılarımla|saygılarımızla|iyi çalışmalar|iyi günler|kind regards|best regards|regards|sincerely|thanks and regards)\b[\s,.!]*$/i];

export function temizGovde(metin, azami = 1500) {
  const satirlar = String(metin || '').replace(/\r/g, '').split('\n');
  const cikti = [];
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    if (KESME.some(r => r.test(s))) break;
    // "On ... \n wrote:" iki satıra bölünmüşse
    if (/^\s*on .{5,200}$/i.test(s) && /wrote:\s*$/i.test(satirlar[i + 1] || '')) break;
    if (IMZA.some(r => r.test(s))) break;
    cikti.push(s);
  }
  return cikti.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, azami);
}

export function htmldenMetin(html) {
  return String(html || '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n');
}

const DEVAM_CUMLE = ['taslak ok', 'taslak onay', 'beyannameler kapandi', 'beyanname kapandi', 'beyan kapandi', 'son beyan ektedir', 'son beyanname ektedir'];
const YANIT_KONU = /^\s*((re|yn?t|fw|fwd|ilt|cvp|aw|wg)\s*:\s*)+/i;

// Mail yeni bir araç bildirimi mi, yoksa konuşmanın devamı mı? Devamsa nedenini, değilse '' döndürür.
export function yanitMi({ subject, inReplyTo, references, temiz }) {
  const refs = Array.isArray(references) ? references.length : String(references || '').trim() ? 1 : 0;
  if (String(inReplyTo || '').trim() || refs) return 'yanıt başlığı';
  if (YANIT_KONU.test(String(subject || ''))) return 'yanıt konusu';
  const n = trNorm(temiz);
  if (n.length <= 300 && DEVAM_CUMLE.some(c => n.includes(c))) return 'devam cümlesi';
  return '';
}

const RESIM = /\.(gif|png|jpe?g|bmp|webp|svg|ico)$/i;
const MRN = /^\d{2}[A-Za-z]{2}[A-Za-z0-9]{12,14}$/;

// Ekleri süzer: imza resimleri atılır. Dosya adı beyanname/MRN biçimindeyse (26BG05000VIB0IBAT8) numara olarak çıkar.
export function ekleriAyikla(ekler) {
  const dosyalar = [], beyannameler = [];
  for (const e of Array.isArray(ekler) ? ekler : []) {
    const ad = String(e?.filename || '').trim();
    if (!ad) continue;
    if (e.contentId || e.related || e.contentDisposition === 'inline' || RESIM.test(ad) || /^image\d+/i.test(ad)) continue;
    const govde = ad.replace(/\.[A-Za-z0-9]{2,5}$/, '');
    if (MRN.test(govde)) { const no = govde.toUpperCase(); if (!beyannameler.includes(no)) beyannameler.push(no); }
    else if (!dosyalar.includes(ad)) dosyalar.push(ad);
  }
  return { dosyalar: dosyalar.slice(0, 10), beyannameler: beyannameler.slice(0, 10) };
}

// Okunacak ekler: beyanname adayı (PDF ya da inline olmayan resim) ve .docx. İmza resimleri, çok küçük ve çok büyük dosyalar atlanır.
// Dosya adına güvenilmez: hangisinin beyanname olduğuna içerikten karar verilir.
export const EK_LIMIT = { enAz: 3000, enCok: 8 * 1024 * 1024, beyanname: 4, docx: 2 };
export function okunacakEkler(ekler) {
  const pdf = [], docx = [];
  for (const e of Array.isArray(ekler) ? ekler : []) {
    const ad = String(e?.filename || '').trim(), icerik = e?.content;
    const boyut = Number(e?.size) || (icerik ? icerik.length : 0);
    if (!ad || !icerik || boyut < EK_LIMIT.enAz || boyut > EK_LIMIT.enCok) continue;
    if (e.contentId || e.related || e.contentDisposition === 'inline' || /^image\d+/i.test(ad)) continue;
    const tur = String(e.contentType || '').toLowerCase();
    if (/\.docx$/i.test(ad) || /wordprocessingml/.test(tur)) { if (docx.length < EK_LIMIT.docx) docx.push(e); }
    else if (/\.pdf$/i.test(ad) || tur === 'application/pdf') { if (pdf.length < EK_LIMIT.beyanname) pdf.push({ e, tur: 'application/pdf' }); }
    else if (/\.(jpe?g|png|webp)$/i.test(ad) || /^image\/(jpeg|png|webp)$/.test(tur)) { if (pdf.length < EK_LIMIT.beyanname) pdf.push({ e, tur: /png/i.test(ad + tur) ? 'image/png' : /webp/i.test(ad + tur) ? 'image/webp' : 'image/jpeg' }); }
  }
  return { belgeler: pdf.map(x => ({ ad: x.e.filename, tur: x.tur, icerik: x.e.content })), docxler: docx.map(e => e.content) };
}

export function istanbulGun(tarih) {
  const d = tarih instanceof Date && !isNaN(tarih) ? tarih : new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Gemini'ye gidecek metin: konu + temiz gövde + ek adları + mailin geldiği gün.
export function geminiMetni({ konu, gonderen, govde, dosyalar, beyannameler, gun }) {
  const s = [
    'Bu mesaj e-posta ile geldi. Plakaları önce konu satırında, sonra gövdede ara.',
    `Mailin geldiği gün: ${gun}. Mailde ayrı bir geliş günü yazmıyorsa araçlar bu gün gelir.`
  ];
  if (gonderen) s.push(`Gönderen: ${gonderen}`);
  s.push(`Konu: ${konu || '(konu yok)'}`, '', govde || '');
  if (dosyalar.length) s.push('', 'Ek dosyalar: ' + dosyalar.join(', '));
  if (beyannameler.length) s.push('Beyanname numaraları (ek adlarından): ' + beyannameler.join(', '));
  return s.join('\n').slice(0, 4000);
}
