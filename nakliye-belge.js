/* Nakliye programı: Lade Liste ve CMR belgeleri.
 * Belgeler tarayıcıda, A4 sayfa olarak hazırlanır; önizlenir, "Yazdır / PDF olarak kaydet" ile çıktı alınır.
 * Hem operatör ekranı (nakliye.js) hem müşteri / depo sayfası (nakliye-sayfa.js) kullanır; sunucuya bir şey göndermez.
 *   PCSNKB.lade({trip, customer, loads}) / PCSNKB.cmr({trip, customer, loads, only}) -> tam HTML belgesi (yazı)
 *   PCSNKB.show([{label, html}], {title}) -> önizleme penceresini açar
 *   PCSNKB.order(loads) -> yükleri belgelerdeki sıraya dizer (Lade Liste "No" = CMR "/01, /02 ...") */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = s => esc(s).replace(/\r?\n/g, '<br>');
  const num = (n, d = 2) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const dmy = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
  const NO_DEST = 'VARIŞ BELİRTİLMEMİŞ';
  const tr = s => String(s || '').toLocaleUpperCase('tr-TR');

  // Belgelerdeki sıra: önce varış gümrüğüne göre gruplanır (Lade Liste gibi), grup içinde kayıt sırasına göre.
  function order(loads) {
    return (loads || []).slice().sort((a, b) =>
      tr(a.dest_customs || '￿').localeCompare(tr(b.dest_customs || '￿'), 'tr') ||
      String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)));
  }
  const plates = t => [t && t.tractor, t && t.trailer].filter(Boolean).join(' - ');
  const pozOf = (trip, i) => `${trip.poz_no}/${String(i + 1).padStart(2, '0')}`;
  const logoImg = (c, cls = 'logo') => (c && /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(c.logo || '')) ? `<img class="${cls}" src="${c.logo}" alt="">` : '';

  const wrap = (title, css, body) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;

  // =========================================================================================================
  // Belgeler PLASTNAK örnek taslağının (Lade Liste ve CMR PDF'leri) birebir kopyasıdır: çizgiler, yazı yerleri ve
  // yazı boyları örnekten ölçülerek (milimetre) aktarıldı. Her müşteri kendi logosunu, nakliyeci bilgisini ve
  // şartlarını kullanır; kutuların yerleri, sıra ve etiket metinleri hep aynıdır.
  // =========================================================================================================
  const FONT = '"Microsoft Sans Serif",Arial,Helvetica,"Liberation Sans",sans-serif';
  const px = n => `${n}mm`;
  const LH = 1.117;                                  // örnekteki yazı tipinin satır kutusu / yazı boyu oranı
  // sabit yazı: (x, y, satır yüksekliği mm, metin, sınıf)
  const T = (x, y, h, txt, cls = '') => `<i class="t ${cls}" style="left:${px(x)};top:${px(y)};font-size:${(h / LH).toFixed(3)}mm;line-height:${px(h)}">${txt}</i>`;
  const HL = (y, x1, x2, t = 0.53) => `<b class="l" style="left:${px(x1)};top:${px((y - t / 2).toFixed(3))};width:${px((x2 - x1).toFixed(2))};height:${t}mm"></b>`;
  const VL = (x, y1, y2, t = 0.53) => `<b class="l" style="left:${px((x - t / 2).toFixed(3))};top:${px(y1)};width:${t}mm;height:${px((y2 - y1).toFixed(2))}"></b>`;
  // alan: sığması için kaydırılan serbest metin kutusu
  const BOX = (x, y, w, h, txt, size, cls = '', lh) => `<div class="t blk ${cls}" style="left:${px(x)};top:${px(y)};width:${px(w)};font-size:${size}mm;line-height:${px(lh || +(size * 1.3).toFixed(2))};${h ? `max-height:${px(h)};overflow:hidden;` : ''}">${txt}</div>`;
  const lines = s => String(s || '').split(/\r?\n/);
  const para = s => lines(s).map(x => `<div>${esc(x) || '&nbsp;'}</div>`).join('');
  const UP = s => esc(tr(s));

  const cmrCss = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${FONT};color:#000}
.pg{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
.l{position:absolute;background:#000;display:block}
.t{position:absolute;white-space:nowrap;font-style:normal;margin:0}
.blk{white-space:normal;word-break:normal;overflow-wrap:anywhere}
.n{font-weight:700}
.bd{font-weight:700}
.it{font-style:italic}
.c{text-align:center}.r{text-align:right}
@media screen{body{background:#e6eaee;padding:14px 0}.pg{margin:0 auto 14px;box-shadow:0 2px 14px #0003}}
@media print{body{background:#fff;padding:0}}`;

  const SZ = { lab: 1.88, val: 2.15, ttl: 2.5, big: 3.76 };      // etiket, değer, başlık ve kutu numarası yazı boyları (mm)

  function cmrPage(trip, customer, l, i) {
    const place = (customer && customer.loading_place) || 'İSTANBUL - Turkey';
    const city = place.split(' - ')[0];
    const dest = [l.dest_customs, l.country ? tr(l.country) : ''].filter(Boolean).join('-');
    const notify = l.notify || [l.consignee, l.consignee_addr].filter(Boolean).join('\n');
    const notesRaw = ((customer && customer.cmr_notes) || '').trim();
    const std = 'This carriage is subject, notwithstanding any clause to the convention on the contract for the International carriage of goods by road (CMR)';
    const noteLines = notesRaw ? lines(notesRaw) : [];
    if (!noteLines.length || !/^this carriage/i.test(noteLines[0])) noteLines.unshift(std);
    const logo = logoImg(customer, 'cl');
    const carrier = lines(customer && customer.carrier).filter(x => x.trim());
    const out = [];
    // --- çizgiler (örnek PDF'ten)
    for (const [y, a, b] of [[7.2, 15.3, 197.3], [14.4, 15.3, 197.3], [31.8, 15.3, 197.3], [39.2, 15.3, 197.3], [59.9, 15.3, 197.3], [66.5, 15.3, 197.3], [83.6, 15.3, 101.6], [90.7, 15.3, 197.3],
      [97.8, 101.6, 197.3], [104.6, 15.3, 101.6], [111.5, 15.3, 101.6], [128.9, 15.3, 197.3], [136.2, 15.3, 197.3], [173.9, 15.3, 197.3], [181.5, 15.3, 197.3], [201.4, 15.3, 197.3],
      [209.1, 15.3, 197.3], [216.7, 15.3, 197.3], [224.8, 15.3, 197.3], [234.4, 15.3, 142.3], [261.0, 15.3, 197.3], [269.4, 15.3, 197.3]]) out.push(HL(y, a, b));
    for (const [x, a, b] of [[15.3, 7.2, 269.4], [197.3, 7.2, 269.4], [101.6, 7.2, 128.9], [109.0, 173.9, 224.8], [142.3, 224.8, 261.0], [75.4, 234.4, 261.0]]) out.push(VL(x, a, b));
    // --- kutu numaraları
    for (const [t, x, y, h] of [['1', 16.9, 9.1], ['2', 16.9, 33.5], ['3', 16.9, 61.0], ['4', 16.9, 85.1], ['5', 16.9, 106.2], ['6', 16.9, 130.0], ['7', 40.6, 130.3], ['8', 67.6, 130.3], ['9', 95.9, 130.3],
      ['10', 118.4, 130.6], ['11', 147.3, 130.3], ['12', 175.4, 130.0], ['13', 16.9, 175.5], ['14', 16.9, 202.9], ['15', 16.9, 210.6], ['16', 106.8, 33.5], ['17', 107.1, 61.0], ['18', 107.1, 91.9],
      ['19/20', 111.2, 175.1], ['21', 16.9, 226.9], ['22', 16.9, 235.9], ['23', 76.2, 235.6], ['24', 145.3, 228.0], ['25', 16.9, 262.3]]) out.push(T(x, y, 4.2, t, 'n'));
    // --- sabit etiketler (örnekteki yazımlarıyla)
    for (const [x, y, t] of [
      [22.0, 8.9, 'Gönderen (isim,adres,memleket)'], [22.0, 11.4, 'Sender (name,address,country)'],
      [22.0, 33.1, 'Alıcı (isim,adres,memleket)'], [22.0, 35.6, 'Consignee (name,address,country)'],
      [113.2, 33.1, 'Nakliyeci (isim,adres,memleket)'], [113.2, 35.6, 'Carrier (name,address,country)'],
      [22.0, 61.2, 'Malların gönderildiği yer'], [22.0, 63.6, 'Place of delivery of the goods'],
      [22.0, 72.3, 'Şehir/Place'], [22.0, 74.7, 'Memleket/Country'],
      [113.2, 61.0, 'Diğer nakliyeciler'], [113.2, 63.4, 'Successive carries'],
      [22.0, 84.8, 'Malların teslim alındığı yer ve gün'], [22.0, 87.2, 'Place and dateof taking of the goods'],
      [22.0, 93.1, 'Şehir/Place'], [22.0, 95.6, 'Memleket/Country'], [22.0, 98.0, 'Tarih/Date'],
      [113.2, 91.9, 'Nakliyecinin şart ve mulahazaları'], [113.2, 94.6, 'Carries reservation and observation'],
      [22.0, 105.9, 'Ekli Dökümanlar'], [22.0, 108.3, 'Documents attached'],
      [20.0, 130.0, 'Marka ve numara'], [20.0, 132.4, 'Marks and No'],
      [44.4, 130.0, 'Parça adedi'], [44.4, 132.4, 'Number of packing'],
      [70.9, 130.0, 'Ambalaj nevi'], [70.9, 132.4, 'Method of the goods'],
      [98.8, 130.0, 'Malın cinsi'], [98.8, 132.4, 'Nature of goods'],
      [124.6, 130.0, 'Statistik No'], [124.6, 132.4, 'Statistical Number'],
      [152.0, 130.0, 'Brüt kg.'], [152.0, 132.4, 'Gross weight in kg'],
      [180.6, 130.0, 'Hacim m3'], [180.6, 132.4, 'Volume in m3'],
      [22.0, 175.5, 'Gönderenin talimatı ( Gümrük ve diğer formaliteler)'], [22.0, 178.0, 'Sender\'s instructions ( Customs and formalities)'],
      [126.4, 175.2, 'Hususi şartlar'], [126.4, 177.7, 'Special agreements'],
      [22.0, 201.8, 'İade'], [22.0, 204.3, 'Return to'],
      [22.0, 210.6, 'Navlunun ödenmesi için talimatlar'], [22.0, 213.0, 'Directions as of freight payment'],
      [59.2, 218.1, 'Serbest / Free'], [59.2, 220.6, 'Serbest Değil / Unfree'],
      [22.0, 226.4, 'Tanzim Yeri'], [22.0, 228.9, 'Established in'],
      [104.5, 226.4, 'Tarih'], [104.5, 228.9, 'on'],
      [151.3, 227.0, 'Mallar teslim alındı'], [151.3, 229.5, 'Goods received'],
      [182.5, 227.0, 'Tarih'], [182.5, 229.4, 'Date'],
      [22.0, 253.2, 'Malı gönderenin imzası ve kaşesi'], [22.0, 255.6, 'Signatuer and stamp of the sender'],
      [76.1, 253.4, 'Nakliyeci ve kaşesi'], [76.1, 255.9, 'Stamp of the carrier and carrier'],
      [156.1, 253.5, 'Alıcının imzası ve kaşesi'], [147.9, 256.5, 'Signatuer and stamp of the consignee'],
      [22.0, 262.3, 'Plaka No.'], [22.0, 264.8, 'Vehicle No.']]) out.push(T(x, y, 2.1, esc(t)));
    // --- başlık, Poz ve CMR yazısı
    out.push(T(102.9, 9.0, 2.8, 'INTERNATIONAL CONSIGMENT  NOTE / HAMULE SENEDI', 'bd'));
    out.push(T(106.3, 15.9, 3.2, 'Poz:', 'bd'), T(114.7, 15.9, 3.2, esc(pozOf(trip, i)), 'bd'));
    out.push(`<i class="t it" style="left:133.5mm;top:21.1mm;font-size:8.32mm;line-height:9.3mm;letter-spacing:.35mm">C M R</i>`);
    // --- 1 gönderen, 2 alıcı
    out.push(BOX(16.4, 15.8, 84, 15, `<div>${esc(l.sender)}</div><div style="margin-top:1.1mm">${para(l.sender_addr)}</div>`, SZ.val, '', 2.85));
    out.push(BOX(16.4, 40.5, 84, 19, `<div>${esc(l.consignee)}</div><div style="margin-top:2.4mm">${para(l.consignee_addr)}</div>`, SZ.val, '', 2.85));
    // --- 3 varış, 4 yükleme yeri ve tarihi
    out.push(T(47.6, 73.8, 2.8, UP(dest)), T(47.6, 92.9, 2.4, esc(place)), T(48.7, 95.7, 2.4, esc(dmy(trip.depart_date))));
    // --- 16 nakliyeci: logo ve bilgi satırları ortalı
    if (logo) out.push(`<div class="t" style="left:131.6mm;top:40.2mm;width:35.8mm;height:8.6mm">${logo}</div>`);
    carrier.forEach((ln, k) => out.push(`<i class="t c" style="left:102.5mm;width:94mm;top:${px((logo ? 50.0 : 43.5) + 3.25 * k)};font-size:2.5mm;line-height:2.8mm">${esc(ln)}</i>`));
    // --- 18 nakliyecinin şart ve mulahazaları
    out.push(BOX(103.1, 99.2, 79, 29, noteLines.map((x, k) => `<div${k === 0 ? ' style="margin-bottom:4.8mm"' : ''}>${esc(x) || '&nbsp;'}</div>`).join(''), SZ.lab, 'bd', 2.45));
    // --- 6-12 mal bilgisi (örnekteki yerlerinde)
    out.push(T(26.5, 138.3, 3.2, esc(`${l.pieces} ${l.packing}`)));
    out.push(BOX(70.9, 138.0, 46, 34, esc(l.goods), 2.86, '', 3.3));
    out.push(`<i class="t r" style="left:130mm;width:40.9mm;top:138.0mm;font-size:2.86mm;line-height:3.2mm">${num(l.weight)}</i>`);
    if (l.volume != null) out.push(`<i class="t r" style="left:170mm;width:24mm;top:138.0mm;font-size:2.86mm;line-height:3.2mm">${num(l.volume, 3)}</i>`);
    // --- 13 talimat: NOTIFY
    out.push(T(16.4, 183.1, 2.4, 'NOTIFY'));
    out.push(BOX(16.4, 187.8, 90, 13, `<div>${esc(notify.split(/\r?\n/)[0])}</div><div style="margin-top:1.5mm">${para(notify.split(/\r?\n/).slice(1).join('\n'))}</div>`, SZ.val, '', 2.85));
    // --- 21, 22, 25
    out.push(T(59.2, 228.0, 2.4, esc(city)), T(117.0, 228.0, 2.4, esc(dmy(trip.depart_date))));
    out.push(BOX(17.4, 241.6, 52, 9, esc(l.sender), SZ.val, '', 2.8));
    out.push(T(59.2, 262.0, 2.4, esc(plates(trip))));
    return `<div class="pg">${out.join('')}</div>`;
  }
  // only: yalnızca bu yükün CMR'ı (sıra numarası, tüm sefere göre belirlenir)
  function cmr({ trip, customer, loads, only }) {
    const list = order(loads);
    const pages = list.map((l, i) => ({ l, i })).filter(x => !only || x.l.id === only);
    return wrap(`CMR ${trip.poz_no}`, cmrCss + '.cl{width:35.8mm;height:8.6mm;object-fit:contain;display:block}', pages.map(x => cmrPage(trip, customer, x.l, x.i)).join(''));
  }

  // ------------------------------------------------------------------ Lade Liste (A4 yatay, örnek taslağın kopyası)
  const ladeCss = `
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Arial,Helvetica,"Liberation Sans",sans-serif;color:#000}
.pg{position:relative;width:297mm;height:210mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
.l{position:absolute;background:#000;display:block}
.t{position:absolute;white-space:nowrap;font-style:normal;margin:0}
.bd{font-weight:700}
.lg{position:absolute;left:202.5mm;top:11.8mm;width:87.3mm;height:20.9mm;object-fit:contain}
.tb{position:absolute;left:6.5mm;width:285.5mm;font-size:2.5mm}
.row{display:grid;grid-template-columns:6.6mm 38.2mm 44.5mm 17.9mm 34.4mm 21.8mm 27.3mm 20.0mm 30.8mm 44.0mm;white-space:nowrap}
.row>div{overflow:hidden;height:5mm;line-height:5mm;border-left:0.18mm solid #000;border-bottom:0.18mm solid #000}
.row>div:last-child{border-right:0.18mm solid #000}
.row.f>div{height:5.8mm;line-height:6.4mm}
.row.h{height:8.3mm;border-top:0.18mm solid #000}.row.h>div{height:8.3mm;line-height:8.3mm}
.grp{height:6mm;line-height:4.7mm;padding-left:7.5mm;font-weight:700;border-bottom:0.18mm solid #000;border-left:0.18mm solid #000;border-right:0.18mm solid #000;font-size:2.5mm}
.tot{display:grid;grid-template-columns:89.3mm 17.9mm 34.4mm 21.8mm 1fr;height:5mm;line-height:4.7mm;font-weight:700}
.tot.bx{border-left:0.18mm solid #000;border-right:0.18mm solid #000;border-bottom:0.18mm solid #000}
.tot .a{text-align:right;padding-right:1.1mm}.tot .k{padding-left:2mm}.tot .w{padding-left:1.6mm}
.gap{height:2.7mm}
.pn{position:absolute;right:15.5mm;bottom:8mm;font-weight:700;font-size:3.04mm}
@media screen{body{background:#e6eaee;padding:14px 0}.pg{margin:0 auto 14px;box-shadow:0 2px 14px #0003}}
@media print{body{background:#fff;padding:0}}`;
  const PADH = [0.9, 2.4, 1.4, 1.3, 0.9, 0.9, 0.8, 0.6, 0.7, 1.5];     // başlık hücreleri: soldan boşluk (mm)
  const PADD = [0.9, 1.1, 0.7, 2.0, 0.9, 1.6, 0.8, 0.6, 0.7, 1.5];     // veri hücreleri

  function lade({ trip, customer, loads }) {
    const list = order(loads);
    const groups = [];
    list.forEach((l, i) => {
      const k = l.dest_customs || NO_DEST;
      let g = groups[groups.length - 1];
      if (!g || g.k !== k) { g = { k, rows: [] }; groups.push(g); }
      g.rows.push({ l, i });
    });
    // satırlar (mm yükseklikleriyle) sayfalara bölünür
    const items = [];
    let totPc = 0, totKg = 0;
    for (const g of groups) {
      let pc = 0, kg = 0;
      items.push({ h: 6, html: `<div class="grp">${esc(g.k)}</div>` });
      for (const { l, i } of g.rows) {
        pc += Number(l.pieces) || 0; kg += Number(l.weight) || 0;
        const cells = [i + 1, l.sender, l.consignee, l.pieces, l.goods, num(l.weight), tr(l.country), l.code, l.dest_customs, l.broker];
        items.push({ h: i === 0 ? 5.8 : 5, html: `<div class="row${i === 0 ? ' f' : ''}">${cells.map((c, k) => `<div style="padding-left:${PADD[k]}mm" title="${esc(c)}">${esc(c)}</div>`).join('')}</div>` });
      }
      totPc += pc; totKg += kg;
      items.push({ h: 5, html: `<div class="tot bx"><div class="a">TOPLAM:</div><div class="k">${pc}</div><div></div><div class="w">${num(kg)}</div><div></div></div>` });
    }
    items.push({ h: 2.7, html: '<div class="gap"></div>' });
    items.push({ h: 5, html: `<div class="tot"><div class="a">GENEL TOPLAM:</div><div class="k">${totPc}</div><div></div><div class="w">${num(totKg)}</div><div></div></div>` });
    const head = `<div class="row h">${['No', 'GÖNDERİCİ', 'ALICI', 'KAP', 'MAL CİNSİ', 'KİLO', 'ÜLKE', 'KODU', 'VARIŞ GÜMRÜK', 'GÜMRÜKÇÜ'].map((c, k) => `<div style="padding-left:${PADH[k]}mm">${c}</div>`).join('')}</div>`;
    const pages = [[]];
    let y = 51.0;
    for (const it of items) {
      if (y + it.h > 190 && pages[pages.length - 1].length) { pages.push([]); y = 20.3; }   // devam sayfalarında başlık satırı üstte yeniden yazılır
      pages[pages.length - 1].push(it.html); y += it.h;
    }
    const logo = logoImg(customer, 'lg');
    const top =
      [11.3, 17.7, 23.5, 29.3, 35.5].map(v => HL(v, 6.5, 120.1, 0.18)).join('') + VL(6.5, 11.3, 35.5, 0.18) + VL(120.1, 11.3, 35.5, 0.18) + VL(39.8, 11.3, 35.5, 0.18) +
      [[13.0, 'Plaka No'], [19.0, 'Poz No'], [24.8, 'Konu'], [30.5, 'Çıkış Tarihi']].map(([yy, t]) => T(7.1, yy, 3.1, t, 'bd')).join('') +
      T(41.5, 12.5, 3.2, esc(trip.tractor)) + (trip.trailer ? T(66.9, 12.5, 3.2, esc(trip.trailer)) : '') + T(41.5, 18.5, 3.2, esc(trip.poz_no)) + T(41.5, 24.3, 3.2, esc(trip.subject)) + T(41.5, 30.1, 3.2, esc(dmy(trip.depart_date))) +
      `<i class="t bd" style="left:130.6mm;top:20.8mm;font-size:5.64mm;line-height:6.3mm">L A D E&nbsp; L İ S T E</i>` + logo;
    const html = pages.map((rows, pi) => {
      const first = pi === 0;
      return `<div class="pg">${first ? top : ''}<div class="tb" style="top:${first ? 42.7 : 12}mm">${head}${rows.join('')}</div><span class="pn">${pi + 1}</span></div>`;
    }).join('');
    return wrap(`Lade Liste ${trip.poz_no}`, ladeCss, html);
  }

  // ------------------------------------------------------------------ önizleme penceresi
  const dlgCss = `
#nkb-dlg{border:0;padding:0;border-radius:14px;width:min(1120px,calc(100% - 20px));height:min(94vh,980px);max-height:94vh;overflow:hidden;box-shadow:0 24px 100px #17334240}
#nkb-dlg[open]{display:flex;flex-direction:column}
#nkb-dlg::backdrop{background:#0a1a2a88}
#nkb-dlg .nkb-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #d9e1e6;background:#f6f8fa;font:600 14px/1.2 system-ui,Arial,sans-serif;color:#17334a}
#nkb-dlg .nkb-bar h2{margin:0 8px 0 0;font-size:15px}
#nkb-dlg .nkb-bar .sp{flex:1}
#nkb-dlg button{font:600 13px/1 system-ui,Arial,sans-serif;border:1px solid #b8c6cf;background:#fff;color:#17334a;padding:9px 13px;border-radius:9px;cursor:pointer}
#nkb-dlg button.on{background:#17334a;color:#fff;border-color:#17334a}
#nkb-dlg button.pr{background:#0f766e;color:#fff;border-color:#0f766e}
#nkb-dlg iframe{flex:1;width:100%;border:0;background:#e6eaee}`;

  function show(items, opts = {}) {
    items = (items || []).filter(x => x && x.html);
    if (!items.length) return;
    let dlg = document.getElementById('nkb-dlg');
    if (!dlg) {
      const st = document.createElement('style'); st.textContent = dlgCss; document.head.appendChild(st);
      dlg = document.createElement('dialog'); dlg.id = 'nkb-dlg'; dlg.setAttribute('aria-label', 'Belge önizleme');
      document.body.appendChild(dlg);
    }
    let cur = Math.min(Math.max(Number(opts.start) || 0, 0), items.length - 1);
    const draw = () => {
      dlg.innerHTML = `<div class="nkb-bar"><h2>${esc(opts.title || 'Belge')}</h2>${items.length > 1 ? items.map((x, i) => `<button type="button" data-nkb-tab="${i}" class="${i === cur ? 'on' : ''}">${esc(x.label)}</button>`).join('') : ''}` +
        `<span class="sp"></span><button type="button" class="pr" data-nkb="print">Yazdır / PDF olarak kaydet</button><button type="button" data-nkb="close">Kapat</button></div>` +
        `<iframe id="nkb-frame" title="${esc(items[cur].label)}"></iframe>`;
      dlg.querySelector('iframe').srcdoc = items[cur].html;
    };
    dlg.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.nkb === 'close') return dlg.close();
      if (t.dataset.nkb === 'print') { const f = dlg.querySelector('iframe'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { /* yazdırma açılamadı */ } return; }
      if (t.dataset.nkbTab != null) { cur = Number(t.dataset.nkbTab) || 0; if (opts.onTab) { try { opts.onTab(cur); } catch (_) { /* tercih kaydedilemedi */ } } draw(); }
    };
    draw();
    if (!dlg.open) dlg.showModal();
  }

  const DEFAULT_NOTES = '* Aracınıza yüklenen mallar ambalaj ve yükleme hatalarından dolayı meydana gelecek hasarlardan firmamız sorumlu değildir.\n* Malın sigortasından firmamız sorumlu değildir.\n* Kaza anında firmamız hiçbir mesuliyet kabul etmez.\n* Bu hamule senedi gönderenin beyanına göre tanzim edilmiştir. Gönderenin beyan dışındaki fazla veya eksik ve kanun dışı yüklenen mallardan firmamız sorumlu değildir.';

  window.PCSNKB = { lade, cmr, show, order, esc, num, dmy, plates, pozOf, DEFAULT_NOTES };
})();
