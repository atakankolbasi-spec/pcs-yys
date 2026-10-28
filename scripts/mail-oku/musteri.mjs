// Gönderen adresinden müşteri bulma. Veri biçimi (Ayarlar'daki 'customer_contacts' ayarı):
//   customer_contacts.emails = { "MÜŞTERİ ADI": "a@x.com, @alanadi.com" }
// Her değerde virgül / noktalı virgül / boşlukla ayrılmış tam adresler ya da "@alanadi.com" (veya "alanadi.com") olabilir.
// Tam adres eşleşmesi alan adı eşleşmesinden önceliklidir.

const kucuk = s => String(s || '').trim().toLowerCase();

export function musteriBul(adres, emails) {
  const a = kucuk(adres);
  if (!a.includes('@') || !emails || typeof emails !== 'object' || Array.isArray(emails)) return '';
  const alan = a.slice(a.lastIndexOf('@') + 1);
  let alanEsles = '';
  for (const [ad, deger] of Object.entries(emails)) {
    for (const p of String(deger || '').split(/[\s,;]+/).map(kucuk).filter(Boolean)) {
      if (p.includes('@') && !p.startsWith('@')) { if (p === a) return ad; continue; }
      const d = p.replace(/^@/, '');
      if (!alanEsles && d && (alan === d || alan.endsWith('.' + d))) alanEsles = ad;
    }
  }
  return alanEsles;
}
