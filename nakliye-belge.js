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

  // ------------------------------------------------------------------ Lade Liste (A4 yatay)
  const ladeCss = `
@page{size:A4 landscape;margin:10mm}
*{box-sizing:border-box}
body{margin:0;font:9.5pt/1.35 Arial,Helvetica,sans-serif;color:#111}
@media screen{body{background:#e6eaee;padding:12px 0}.pg{background:#fff;width:297mm;min-height:200mm;margin:0 auto;padding:10mm;box-shadow:0 2px 14px #0003}}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:8px}
.info{border-collapse:collapse;font-size:10pt}.info td{padding:2px 14px 2px 0;vertical-align:top}.info td:first-child{font-weight:700;white-space:nowrap}
.ttl{font-size:20pt;font-weight:800;letter-spacing:.5px;text-align:right}.logo{max-height:18mm;max-width:60mm;display:block;margin-left:auto;margin-bottom:4px}
table.t{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:6px}
.t th{background:#e8edf1;border:1px solid #333;padding:4px 5px;font-size:8pt;text-align:left;overflow-wrap:anywhere}
.t td{border:1px solid #777;padding:4px 5px;vertical-align:top;overflow-wrap:anywhere}
.t .n{text-align:right;white-space:nowrap}.t .c{text-align:center;white-space:nowrap}
.t tr{page-break-inside:avoid}
.grp td{background:#f4f6f8;font-weight:800;border-color:#333}
.sum td{font-weight:800;background:#fafbfc}
.tot td{font-weight:800;background:#e8edf1;border-color:#111}
.foot{margin-top:10px;font-size:8pt;color:#555}`;

  function lade({ trip, customer, loads }) {
    const list = order(loads);
    const groups = [];
    list.forEach((l, i) => {
      const k = l.dest_customs || NO_DEST;
      let g = groups[groups.length - 1];
      if (!g || g.k !== k) { g = { k, rows: [] }; groups.push(g); }
      g.rows.push({ l, i });
    });
    const cols = ['<col style="width:4%">', '<col style="width:19%">', '<col style="width:17%">', '<col style="width:5%">', '<col style="width:14%">', '<col style="width:8%">',
      '<col style="width:8%">', '<col style="width:8%">', '<col style="width:9%">', '<col style="width:8%">'].join('');
    let totPc = 0, totKg = 0, body = '';
    for (const g of groups) {
      let pc = 0, kg = 0;
      body += `<tr class="grp"><td colspan="10">${esc(g.k)}</td></tr>`;
      for (const { l, i } of g.rows) {
        pc += Number(l.pieces) || 0; kg += Number(l.weight) || 0;
        body += `<tr><td class="c">${i + 1}</td><td>${esc(l.sender)}</td><td>${esc(l.consignee)}</td><td class="n">${esc(l.pieces)}</td><td>${esc(l.goods)}</td>` +
          `<td class="n">${num(l.weight)}</td><td>${esc(tr(l.country))}</td><td>${esc(l.code)}</td><td>${esc(l.dest_customs)}</td><td>${esc(l.broker)}</td></tr>`;
      }
      totPc += pc; totKg += kg;
      body += `<tr class="sum"><td colspan="3" class="n">TOPLAM:</td><td class="n">${pc}</td><td></td><td class="n">${num(kg)}</td><td colspan="4"></td></tr>`;
    }
    body += `<tr class="tot"><td colspan="3" class="n">GENEL TOPLAM:</td><td class="n">${totPc}</td><td></td><td class="n">${num(totKg)}</td><td colspan="4"></td></tr>`;
    const html = `<div class="pg"><div class="top"><table class="info">
<tr><td>Plaka No</td><td>${esc(plates(trip))}</td></tr><tr><td>Poz No</td><td>${esc(trip.poz_no)}</td></tr>
<tr><td>Konu</td><td>${esc(trip.subject)}</td></tr><tr><td>Çıkış Tarihi</td><td>${esc(dmy(trip.depart_date))}</td></tr></table>
<div>${logoImg(customer)}<div class="ttl">LADE LİSTE</div></div></div>
<table class="t"><colgroup>${cols}</colgroup><thead><tr><th>No</th><th>GÖNDERİCİ</th><th>ALICI</th><th>KAP</th><th>MAL CİNSİ</th><th>KİLO</th><th>ÜLKE</th><th>KODU</th><th>VARIŞ GÜMRÜK</th><th>GÜMRÜKÇÜ</th></tr></thead>
<tbody>${body}</tbody></table>
<div class="foot">${esc(customer && customer.name)} · ${esc(trip.poz_no)}</div></div>`;
    return wrap(`Lade Liste ${trip.poz_no}`, ladeCss, html);
  }

  // ------------------------------------------------------------------ CMR (A4 dikey, her yük için bir sayfa)
  const cmrCss = `
@page{size:A4;margin:8mm}
*{box-sizing:border-box}
body{margin:0;font:8.5pt/1.3 Arial,Helvetica,sans-serif;color:#111}
@media screen{body{background:#e6eaee;padding:12px 0}.pg{background:#fff;width:210mm;height:281mm;margin:0 auto 14px;box-shadow:0 2px 14px #0003}}
@media print{.pg{height:281mm;page-break-after:always}.pg:last-child{page-break-after:auto}}
.pg{padding:0;position:relative}
.cm{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111;border-bottom:0}
.cm.one{grid-template-columns:1fr}
.col>.b{border-bottom:1.5px solid #111}.col:first-child{border-right:1.5px solid #111}
.b{position:relative;padding:3px 6px 3px 28px;overflow:hidden}
.b>i{position:absolute;left:5px;top:2px;font:800 13pt/1 Arial,sans-serif;font-style:normal}
.b.w46{padding-left:46px}.b.w46>i{font-size:11pt}.b>s{display:block;text-decoration:none;font-size:6.6pt;line-height:1.15;color:#222;margin-bottom:2px}
.b .v{font-size:8.6pt;line-height:1.3}
.h24{height:24mm}.h26{height:26mm}.h22{height:22mm}.h46{height:46mm}.h28{height:28mm}.h9{height:9mm}.h15{height:15mm}.h12{height:12mm}.h30{height:30mm}.h32{height:32mm}
.title{padding:3px 8px;text-align:left}
.title b{font-size:8.4pt}.poz{margin-top:2px;font-size:9.6pt}.big{font:italic 800 22pt/1 Arial,sans-serif;letter-spacing:3px;text-align:center;margin-top:2px}
.logo{max-height:14mm;max-width:55mm;display:block;margin:0 auto 2px}
.carrier{text-align:center;font-size:8pt;line-height:1.3}
.goods{display:grid;grid-template-columns:20% 11% 13% 23% 10% 12% 11%;border:1.5px solid #111;border-bottom:0}
.goods>div{padding:3px 6px 3px 28px;position:relative;border-right:1.5px solid #111}.goods>div:last-child{border-right:0}
.goods .hd{height:9mm;border-bottom:1.5px solid #111}.goods .bd{height:48mm;padding-left:8px}
.goods .hd i{position:absolute;left:5px;top:2px;font:800 13pt/1 Arial,sans-serif;font-style:normal}.goods .hd s{text-decoration:none;font-size:6.4pt;line-height:1.1;display:block}
.r{text-align:right}
.note{font-size:7.6pt}.note p{margin:0 0 3px}
.sig{display:grid;grid-template-columns:1fr 1fr 1fr;border:1.5px solid #111;border-bottom:0}
.sig>div{height:26mm;border-right:1.5px solid #111;padding:3px 6px 3px 28px;position:relative}.sig>div:last-child{border-right:0}
.sig>div>i{position:absolute;left:5px;top:2px;font:800 13pt/1 Arial,sans-serif;font-style:normal}
.sig s{position:absolute;left:28px;right:6px;bottom:3px;text-decoration:none;font-size:6.6pt;color:#222}
.two{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111;border-bottom:0}
.two>div:first-child{border-right:1.5px solid #111}
.two2{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #111;border-bottom:0}
.two2>div{border-right:1.5px solid #111}.two2>div:last-child{border-right:0}
.last{border:1.5px solid #111}`;

  const DEFAULT_NOTES = '* Aracınıza yüklenen mallar ambalaj ve yükleme hatalarından dolayı meydana gelecek hasarlardan firmamız sorumlu değildir.\n* Malın sigortasından firmamız sorumlu değildir.\n* Kaza anında firmamız hiçbir mesuliyet kabul etmez.\n* Bu hamule senedi gönderenin beyanına göre tanzim edilmiştir. Gönderenin beyan dışındaki fazla veya eksik ve kanun dışı yüklenen mallardan firmamız sorumlu değildir.';

  const box = (n, tr1, en1, inner, cls = '') => `<div class="b ${cls}"><i>${n}</i><s>${tr1}<br>${en1}</s>${inner}</div>`;

  function cmrPage(trip, customer, l, i) {
    const dest = [l.dest_customs, l.country ? tr(l.country) : ''].filter(Boolean).join('-');
    const place = (customer && customer.loading_place) || 'İSTANBUL - Turkey';
    const city = place.split(' - ')[0];
    const notify = l.notify || [l.consignee, l.consignee_addr].filter(Boolean).join('\n');
    const notes = (customer && customer.cmr_notes) || '';
    const noteHtml = `<p><b>This carriage is subject, notwithstanding any clause to the convention on the contract for the International carriage of goods by road (CMR)</b></p>` +
      (notes ? notes.split(/\r?\n/).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('') : '');
    const left = [
      box(1, 'Gönderen (isim,adres,memleket)', 'Sender (name,address,country)', `<div class="v"><b>${esc(l.sender)}</b><br>${nl(l.sender_addr)}</div>`, 'h24'),
      box(2, 'Alıcı (isim,adres,memleket)', 'Consignee (name,address,country)', `<div class="v"><b>${esc(l.consignee)}</b><br>${nl(l.consignee_addr)}</div>`, 'h26'),
      box(3, 'Malların gönderildiği yer', 'Place of delivery of the goods', `<div class="v">Şehir/Place · Memleket/Country<br><b>${esc(dest)}</b></div>`, 'h22'),
      box(4, 'Malların teslim alındığı yer ve gün', 'Place and date of taking of the goods', `<div class="v">Şehir/Place · Memleket/Country<br><b>${esc(place)}</b><br>Tarih/Date: <b>${esc(dmy(trip.depart_date))}</b></div>`, 'h24'),
      box(5, 'Ekli Dökümanlar', 'Documents attached', '', 'h22')
    ].join('');
    const right = [
      `<div class="b title h24"><b>INTERNATIONAL CONSIGNMENT NOTE / HAMULE SENEDİ</b><div class="poz">Poz: <b>${esc(pozOf(trip, i))}</b></div><div class="big">CMR</div></div>`,
      box(16, 'Nakliyeci (isim,adres,memleket)', 'Carrier (name,address,country)', `${logoImg(customer)}<div class="carrier">${nl(customer && customer.carrier)}</div>`, 'h26'),
      box(17, 'Diğer nakliyeciler', 'Successive carriers', '', 'h22'),
      box(18, 'Nakliyecinin şart ve mülahazaları', 'Carrier\'s reservations and observations', `<div class="note">${noteHtml}</div>`, 'h46')
    ].join('');
    const goods = `<div class="goods"><div class="hd"><i>6</i><s>Marka ve numara<br>Marks and No</s></div><div class="hd"><i>7</i><s>Parça adedi<br>Number of packages</s></div><div class="hd"><i>8</i><s>Ambalaj nevi<br>Method of packing</s></div>` +
      `<div class="hd"><i>9</i><s>Malın cinsi<br>Nature of goods</s></div><div class="hd"><i>10</i><s>Statistik No<br>Stat. number</s></div><div class="hd"><i>11</i><s>Brüt kg.<br>Gross kg</s></div><div class="hd"><i>12</i><s>Hacim m³<br>Volume m³</s></div>` +
      `<div class="bd"></div><div class="bd"><b>${esc(l.pieces)}</b></div><div class="bd"><b>${esc(l.packing)}</b></div><div class="bd"><b>${esc(l.goods)}</b></div><div class="bd"></div><div class="bd r"><b>${num(l.weight)}</b></div><div class="bd r">${l.volume == null ? '' : `<b>${num(l.volume, 3)}</b>`}</div></div>`;
    const mid = `<div class="two"><div>${[
      box(13, 'Gönderenin talimatı (Gümrük ve diğer formaliteler)', 'Sender\'s instructions (Customs and formalities)', `<div class="v"><b>NOTIFY</b><br>${nl(notify)}</div>`, 'h30'),
      box(14, 'İade', 'Return to', '', 'h9'),
      box(15, 'Navlunun ödenmesi için talimatlar', 'Directions as of freight payment', '<div class="v r">Serbest / Free<br>Serbest Değil / Unfree</div>', 'h15')].map((x, k) => k < 2 ? x.replace('class="b ', 'class="b bb ') : x).join('')}</div><div>${box('19/20', 'Hususi şartlar', 'Special agreements', '', 'h32 w46')}</div></div>`;
    const est = `<div class="two2"><div class="b h12"><i>21</i><s>Tanzim Yeri · Established in</s><div class="v"><b>${esc(city)}</b></div></div><div class="b h12"><s>Tarih · on</s><div class="v"><b>${esc(dmy(trip.depart_date))}</b></div></div></div>`;
    const sig = `<div class="sig"><div><i>22</i><div class="v"><b>${esc(l.sender)}</b></div><s>Malı gönderenin imzası ve kaşesi · Signature and stamp of the sender</s></div>` +
      `<div><i>23</i><s>Nakliyecinin imzası ve kaşesi · Signature and stamp of the carrier</s></div>` +
      `<div><i>24</i><div class="v">Mallar teslim alındı · Goods received<br>Tarih / Date:</div><s>Alıcının imzası ve kaşesi · Signature and stamp of the consignee</s></div></div>`;
    const plate = `<div class="last"><div class="b h9"><i>25</i><s>Plaka No. · Vehicle No.</s><div class="v" style="position:absolute;left:150px;top:6px"><b>${esc(plates(trip))}</b></div></div></div>`;
    return `<div class="pg"><div class="cm"><div class="col">${left}</div><div class="col">${right}</div></div>${goods}${mid}${est}${sig}${plate}</div>`;
  }

  // only: yalnızca bu yükün CMR'ı (sıra numarası, tüm sefere göre belirlenir)
  function cmr({ trip, customer, loads, only }) {
    const list = order(loads);
    const pages = list.map((l, i) => ({ l, i })).filter(x => !only || x.l.id === only);
    const css = cmrCss + '.bb{border-bottom:1.5px solid #111}';
    return wrap(`CMR ${trip.poz_no}`, css, pages.map(x => cmrPage(trip, customer, x.l, x.i)).join(''));
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
    let cur = 0;
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
      if (t.dataset.nkbTab != null) { cur = Number(t.dataset.nkbTab) || 0; draw(); }
    };
    draw();
    if (!dlg.open) dlg.showModal();
  }

  window.PCSNKB = { lade, cmr, show, order, esc, num, dmy, plates, pozOf, DEFAULT_NOTES };
})();
