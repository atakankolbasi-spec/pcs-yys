// Beyannamedeki gönderici/ihracatçı adının kısa hali (saf fonksiyon).
// Önce yapay zekânın verdiği kısa ad (exporter_short) kullanılır; yoksa tam addan hukuki biçim ve genel faaliyet
// sözcükleri atılarak kısaltılır: "ELMA İSTANBUL TAM ELEKTRİK EKİPMANLARI SAN. VE TİC. LTD. ŞTİ." → "ELMA İSTANBUL".

const ust = s => String(s || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');

// Bu sözcüklerden ilki görüldüğü yerde ad biter (hukuki biçim ve faaliyet tarifi başlar).
const KES = /^(SAN\.?|SANAYİ|SANAYI|TİC\.?|TIC\.?|TİCARET|TICARET|VE|LTD\.?|LİMİTED|LIMITED|ŞTİ\.?|STI\.?|ŞİRKETİ|A\.?Ş\.?|AŞ|A\.S\.?|DIŞ|İTH\.?|İHR\.?|İTHALAT|İHRACAT|PAZ\.?|PAZARLAMA|SAN\.VE|TİC\.LTD\.?|TAM|ÜRETİM|URETIM|İNŞ\.?|İNŞAAT|NAK\.?|NAKLİYAT|LOJ\.?|LOJİSTİK|ELEKTRİK|ELEKTRONİK|EKİPMANLARI|SAN\.TİC\.?)$/;

export function kisaltAd(tam) {
  const kelimeler = ust(tam).replace(/[“”"]/g, '').split(' ').filter(Boolean);
  const out = [];
  for (const k of kelimeler) {
    if (out.length && KES.test(k)) break;
    out.push(k);
    if (out.length >= 3) break;
  }
  return out.join(' ').replace(/[.,;:\-/]+$/, '').slice(0, 60);
}

export function kisaGonderici(d) {
  const kisa = ust(d?.exporter_short);
  if (kisa) return kisa.slice(0, 60);
  return d?.exporter ? kisaltAd(d.exporter) : '';
}
