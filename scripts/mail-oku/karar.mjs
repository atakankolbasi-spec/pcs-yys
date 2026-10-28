// Tesise gelecek / gelmeyecek kararı (saf). Asıl ölçü beyannamenin 30. kutusu (Eşyanın bulunduğu yer).
// Ayar sözleşmesi: customer_contacts.facility_codes = ["Z34089"], customer_contacts.comes = { "MÜŞTERİ": false }.

export const VARSAYILAN_KODLAR = ['Z34089'];
const kod = s => String(s || '').toUpperCase().replace(/\s+/g, '');
const plaka = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function kodListesi(ayar) {
  const l = (Array.isArray(ayar) ? ayar : []).map(kod).filter(Boolean);
  return l.length ? l : VARSAYILAN_KODLAR;
}

// "Genelde tesise gelir" işareti: yoksa ya da false dışındaysa true. Müşteri adı büyük/küçük harf duyarsız aranır.
export function geliyorMu(comes, musteri) {
  if (!comes || typeof comes !== 'object' || !musteri) return true;
  const k = Object.keys(comes).find(x => x === musteri) ?? Object.keys(comes).find(x => x.toLocaleLowerCase('tr') === String(musteri).toLocaleLowerCase('tr'));
  return k === undefined ? true : comes[k] !== false;
}

// items: Gemini araçları · beyannameler: [{number, facility_code, plates}] (yalnızca beyanname olduğu anlaşılanlar)
// Dönüş: items'in facility / facility_note alanları eklenmiş kopyası.
export function tesisKarari({ items, beyannameler, kodlar, gelirMi }) {
  const liste = kodListesi(kodlar).map(kod);
  const plakali = it => [plaka(it.tractor), plaka(it.trailer)].filter(Boolean);
  const eslesir = (d, it) => (d.plates || []).map(plaka).some(p => plakali(it).includes(p));
  const hicbiri = beyannameler.filter(d => !items.some(it => eslesir(d, it)));
  return items.map(it => {
    const secilen = beyannameler.filter(d => eslesir(d, it));
    const kullan = secilen.length ? secilen : hicbiri;
    if (kullan.length) {
      const gelen = kullan.find(d => liste.includes(kod(d.facility_code)));
      if (gelen) return { ...it, facility: 'gelecek', facility_note: `30. kutu: ${String(gelen.facility_code).trim()}` };
      const d = kullan[0], c = String(d.facility_code || '').trim();
      return { ...it, facility: 'gelmeyecek', facility_note: c ? `30. kutu: ${c}` : '30. kutu boş' };
    }
    return gelirMi
      ? { ...it, facility: 'belirsiz', facility_note: 'Beyanname görülmedi, tesis kodunu kontrol edin' }
      : { ...it, facility: 'gelmeyecek', facility_note: 'Beyanname görülmedi · müşteri genelde tesise gelmez' };
  });
}
