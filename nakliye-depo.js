/* Nakliye depo sayfası ek ekranları: Program (günün araçları + yükleme kontrolü), Okut (telefonla QR), Teslim al (sayım, durum, fotoğraf, raf).
 * nakliye-sayfa.js çekirdeğine window.PCSNKP üzerinden bağlanır; yalnızca depo bağlantısında (?d=...) çalışır. */
(() => {
  'use strict';
  const X = window.PCSNKP;
  if (!X || X.MODE !== 'd') return;
  const { P, esc, ic, kg, plate, uniq, tr, sum } = X;
  const B = X.B;
  const pref = (k, d) => { try { const v = localStorage.getItem('pcs.okut.' + k); return v === null ? d : v === '1'; } catch (_) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('pcs.okut.' + k, v ? '1' : '0'); } catch (_) { /* tarayıcı saklamıyorsa oturumda kalır */ } };
  const D = { recv: null, sc: { code: '', load: null, loc: '', busy: false, err: '', camErr: '', done: '', auto: pref('auto', true), reader: pref('reader', false), q: [], working: false, flash: null, list: [], timer: null }, trip: '' };
  const LOCS = ['A-1', 'A-2', 'A-3', 'B-1', 'B-2', 'Açık alan'];
  const istNow = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value])); return Number(p.hour) * 60 + Number(p.minute); };
  const istDate = iso => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const hm = iso => { try { return new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
  const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const nameArg = () => ({ p_name: X.name() });
  const loadOf = id => (P.data.loads || []).find(l => l.id === id);
  const locOptions = () => uniq([...LOCS, ...(P.data.loads || []).map(l => l.location)]).slice(0, 12);
  // Şoför yazısındaki telefon numarasından WhatsApp bağlantısı
  const waLink = (driver, text) => {
    const m = /(\+?\d[\d\s()\-]{8,}\d)/.exec(String(driver || '')); if (!m) return '';
    let d = m[1].replace(/[^\d]/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '90' + d.slice(1); else if (d.length === 10 && d[0] === '5') d = '90' + d;
    return d.length >= 11 && d.length <= 15 ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : '';
  };

  // ------------------------------------------------------------------ Teslim al: sayım, durum, not, fotoğraf, raf
  async function openRecv(l, pre = {}) {
    P.drawer = '';
    D.recv = { id: l.id, pieces: String(l.counted_pieces != null ? l.counted_pieces : l.pieces), weight: String(l.counted_weight != null ? l.counted_weight : l.weight), cond: pre.cond || l.condition || 'saglam',
      note: l.receive_note || '', loc: pre.loc != null ? pre.loc : (l.location || ''), photos: null, busy: false, err: '' };
    X.draw();
    const r = await X.rpc('shp_depot_photos', { p_load: l.id });
    if (D.recv && D.recv.id === l.id) { D.recv.photos = r.error ? [] : (r.data || []); X.draw(); }
  }
  const diffOf = (l, R) => {
    const pc = R.pieces === '' ? null : Number(R.pieces), w = R.weight === '' ? null : X.parseNum(R.weight);
    return { dp: pc == null || Number.isNaN(pc) ? null : pc - l.pieces, dw: w == null || Number.isNaN(w) ? null : Math.round((w - l.weight) * 100) / 100 };
  };
  const num = (n, u) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kg(Math.abs(n))} ${u}`;
  function cmpFoot(l, R) {
    const d = diffOf(l, R), any = (d.dp != null && d.dp !== 0) || (d.dw != null && d.dw !== 0);
    return { any, box: `<small>Fark</small><b>${d.dp == null ? '—' : d.dp === 0 ? '0 kap' : num(d.dp, 'kap')}</b><small>${d.dw == null ? '' : d.dw === 0 ? '0 kg' : num(d.dw, 'kg')}</small>` };
  }
  function recvHtml() {
    const R = D.recv, l = loadOf(R.id); if (!l) return '';
    const c = cmpFoot(l, R), ph = R.photos || [], problem = c.any || R.cond !== 'saglam';
    const seg = (k, t, cls) => `<button type="button" class="${R.cond === k ? 'on ' + cls : ''}" data-a="rc-cond" data-v="${k}">${t}</button>`;
    return `<aside class="drw rcv" id="drw" aria-label="Yükü teslim al"><div class="dhd"><b>Yükü teslim al</b><button type="button" class="x" data-a="rc-close" aria-label="Kapat">${ic('close')}</button></div>
<div class="dbody"><div><b>${esc(l.sender)} → ${esc(l.consignee)}</b><small>${esc(l.goods)}${l.goods ? ' · ' : ''}${l.inbound_plate ? plate(l.inbound_plate, 'in sm') : ''}${l.arrived_at ? ` <span class="ch g">Geldi ${esc(hm(l.arrived_at))}</span>` : ''}</small></div>
<div class="rch"><h4>Sayım ve tartı</h4><div class="cmp"><div><small>Beyan</small><b>${esc(l.pieces)} kap</b><small>${kg(l.weight)} kg</small></div>
<div><small>Sayılan</small><input id="rc-pieces" data-i="rc-pieces" inputmode="numeric" value="${esc(R.pieces)}" aria-label="Sayılan kap" maxlength="8"><input id="rc-weight" data-i="rc-weight" inputmode="decimal" value="${esc(R.weight)}" aria-label="Tartılan kilo (kg)" maxlength="12"></div>
<div id="rc-diff" class="${c.any ? 'df' : ''}">${c.box}</div></div></div>
<div class="rch"><h4>Durum</h4><div class="seg3">${seg('saglam', 'Sağlam', 'ok')}${seg('eksik', 'Eksik var', 'ms')}${seg('hasarli', 'Hasarlı', 'bd')}</div>
<label class="fld"><span>Not</span><textarea id="rc-note" data-i="rc-note" rows="2" maxlength="500" placeholder="Örn. 2 koli ıslak geldi, şoför imzaladı">${esc(R.note)}</textarea></label></div>
<div class="rch"><h4>Fotoğraflar (${ph.length})</h4><div class="ph3">${ph.map(p => `<div class="im"><button type="button" class="imb" data-a="rc-photo" data-id="${esc(p.id)}" aria-label="Fotoğrafı büyüt"><img src="${esc(p.thumb)}" alt=""></button><button type="button" class="x2" data-a="rc-photo-del" data-id="${esc(p.id)}" aria-label="Fotoğrafı sil">×</button></div>`).join('')}
${ph.length < 8 ? `<label class="add" for="rc-file">${ic('camera')}<span>Fotoğraf çek</span></label><input type="file" id="rc-file" accept="image/*" capture="environment" multiple hidden>` : ''}</div></div>
<div class="rch"><label class="fld"><span>Depo konumu</span><input id="rc-loc" data-i="rc-loc" value="${esc(R.loc)}" maxlength="40" placeholder="Örn. A-3 rafı" autocomplete="off"></label><div class="chips3">${locOptions().map(x => `<button type="button" class="${R.loc === x ? 'on' : ''}" data-a="rc-loc" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div></div>
<div id="rc-alert" class="rc-alert" ${problem ? '' : 'hidden'}>${ic('warn')} Sorun olduğu için <b>müşteriye bildirim</b> kuyruğa girer; fotoğraflar yükün kaydında saklanır.</div>
<div id="rc-err" class="ferr" ${R.err ? '' : 'hidden'} role="alert">${esc(R.err)}</div></div>
<div class="dft"><span class="sp"></span><button type="button" class="btn" data-a="rc-close">Vazgeç</button><button type="button" class="btn go" id="rc-save" data-a="rc-save" ${R.busy ? 'disabled' : ''}>${ic('check')}${l.arrived_at ? 'Bilgileri kaydet' : problem && c.any ? 'Farkla birlikte teslim al' : 'Teslim al'}</button></div></aside>`;
  }
  X.sideHtml = () => (D.recv ? recvHtml() : '');
  X.closeSide = () => { D.recv = null; };
  function rcUpdate() {
    const R = D.recv, l = R && loadOf(R.id); if (!l) return;
    const c = cmpFoot(l, R), box = document.getElementById('rc-diff'), al = document.getElementById('rc-alert'), sv = document.getElementById('rc-save');
    if (box) { box.className = c.any ? 'df' : ''; box.innerHTML = c.box; }
    if (al) al.hidden = !(c.any || R.cond !== 'saglam');
    if (sv && !l.arrived_at) sv.lastChild.textContent = c.any ? 'Farkla birlikte teslim al' : 'Teslim al';
  }
  X.inp.push((t, k) => {
    if (!D.recv) return false;
    if (k === 'rc-pieces') { D.recv.pieces = t.value.trim(); rcUpdate(); return true; }
    if (k === 'rc-weight') { D.recv.weight = t.value.trim(); rcUpdate(); return true; }
    if (k === 'rc-note') { D.recv.note = t.value; return true; }
    if (k === 'rc-loc') { D.recv.loc = t.value; return true; }
    return false;
  });
  X.act.recv = (t, e, id) => { const l = loadOf(id); if (l) return openRecv(l); };
  X.act['rc-close'] = () => { D.recv = null; X.draw(); };
  X.act['rc-cond'] = t => { D.recv.cond = t.dataset.v; X.draw(); };
  X.act['rc-loc'] = t => { D.recv.loc = D.recv.loc === t.dataset.v ? '' : t.dataset.v; X.draw(); };
  X.act['rc-photo'] = (t, e, id) => X.photoDialog(D.recv.id, id);
  X.act['rc-photo-del'] = async (t, e, id) => {
    const r = await X.rpc('shp_depot_photo_del', { p_photo: id, ...nameArg() });
    if (r.error) { X.toast(X.explain(r.error), true); return; }
    D.recv.photos = (D.recv.photos || []).filter(p => p.id !== id); X.draw(); X.load0();
  };
  X.act['rc-save'] = async () => {
    const R = D.recv, l = R && loadOf(R.id); if (!l || R.busy) return;
    const pcs = R.pieces === '' ? null : Number(R.pieces), w = R.weight === '' ? null : X.parseNum(R.weight);
    const bad = (pcs != null && (!Number.isInteger(pcs) || pcs < 0)) || Number.isNaN(w) || (w != null && w < 0);
    if (bad) { R.err = 'Kap tam sayı, kilo sayı olmalı (eksi olamaz).'; X.draw(); return; }
    R.busy = true; R.err = ''; X.draw();
    const r = await X.rpc('shp_depot_receive', { p_id: l.id, p_counted_pieces: pcs, p_counted_weight: w, p_condition: R.cond, p_note: R.note.trim(), p_location: R.loc.trim(), ...nameArg() });
    if (!D.recv || D.recv.id !== l.id) return;
    R.busy = false;
    if (r.error) { R.err = X.explain(r.error); X.draw(); return; }
    D.recv = null; X.toast(l.arrived_at ? 'Teslim bilgisi kaydedildi' : 'Yük teslim alındı'); await X.load0();
  };
  // Fotoğraf: telefonda kamera açılır; resim küçültülüp sıkıştırılarak yüklenir
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const enc = (max, q) => { const sc = Math.min(1, max / Math.max(bmp.width, bmp.height)), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc)); cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); return cv.toDataURL('image/jpeg', q); };
    let data = enc(1280, 0.72); if (data.length > 480000) data = enc(1024, 0.6); if (data.length > 480000) data = enc(800, 0.5);
    return { data, thumb: enc(200, 0.6) };
  }
  document.addEventListener('change', async e => {
    const f = e.target;
    if (!f || f.id !== 'rc-file' || !D.recv || !f.files) return;
    const R = D.recv, files = [...f.files].slice(0, 8 - (R.photos || []).length);
    for (const file of files) {
      try {
        const { data, thumb } = await shrink(file);
        const r = await X.rpc('shp_depot_photo_add', { p_load: R.id, p_thumb: thumb, p_data: data, ...nameArg() });
        if (r.error) { X.toast(X.explain(r.error), true); break; }
        (R.photos = R.photos || []).push(r.data);
      } catch (_) { X.toast('Fotoğraf okunamadı; başka bir resim deneyin', true); break; }
    }
    if (D.recv === R) { X.draw(); X.load0(); }
  });

  // ------------------------------------------------------------------ Program: günün araçları ve yükleme kontrolü
  function groups(S) {
    const today = X.today(), now = istNow(), map = new Map();
    for (const l of S.all) {
      const q = (!l.arrived_at && l.expected_date && l.expected_date <= today) || (l.arrived_at && istDate(l.arrived_at) === today);
      if (!q) continue;
      const key = [l.customer_id, l.inbound_plate, l.arrived_at && !l.expected_date ? today : l.expected_date, l.expected_time].join('|');
      if (!map.has(key)) map.set(key, { key, cust: l.customer_id, plate: l.inbound_plate, date: l.expected_date || today, time: l.expected_time || '', loads: [], driver: '' });
      const g = map.get(key); g.loads.push(l); if (!g.driver && l.driver) g.driver = l.driver;
    }
    const out = [...map.values()].map(g => {
      const arrived = g.loads.filter(l => l.arrived_at), done = arrived.length === g.loads.length, tm = toMin(g.time);
      let st = 'wait', note = g.time ? `Beklenen ${g.time}` : 'Saat bildirilmedi';
      if (done) { st = 'done'; const last = arrived.map(l => l.arrived_at).sort().pop(); note = `Geldi ${hm(last)}${arrived[0].arrived_by ? ' · ' + arrived[0].arrived_by : ''}${arrived[0].location ? ' · ' + arrived[0].location : ''}`; }
      else if (g.date < today) { st = 'late'; const days = Math.round((Date.parse(today) - Date.parse(g.date)) / 864e5); note = `${days} gün gecikti`; }
      else if (tm != null && now - tm > 15) { st = 'late'; const m = now - tm; note = `${m >= 60 ? Math.floor(m / 60) + ' sa ' : ''}${m % 60} dk gecikti`; }
      else if (tm != null && Math.abs(now - tm) <= 45) st = 'now';
      return { ...g, st, note, remaining: g.loads.filter(l => !l.arrived_at) };
    });
    out.sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')));
    return out;
  }
  const slotLabel = { done: 'geldi', late: 'geç kaldı', now: 'şimdi', wait: '' };
  function groupRow(g, cu) {
    const wa = g.st === 'late' && g.driver ? waLink(g.driver, `Merhaba, ${g.plate || 'aracınız'} ${g.time ? g.time + "'a" : 'bugün'} depoya bekleniyordu. Ne zaman gelirsiniz?`) : '';
    const act = g.st === 'done' ? `<span class="ch g">Boşaltıldı</span>` : `${wa ? `<a class="btn sm" href="${esc(wa)}" target="_blank" rel="noopener">${ic('wa')}Şoföre yaz</a>` : ''}<button type="button" class="btn ${g.st === 'now' ? 'go' : 'sm'}" data-a="grp-arrive" data-ids="${esc(g.remaining.map(l => l.id).join(','))}">${ic('check')}Araç geldi</button>`;
    return `<div class="slot"><div class="hr">${esc(g.time || '—')}<small class="mut">${slotLabel[g.st]}</small></div><div><div class="trw ${g.st}">${g.plate ? plate(g.plate) : '<span class="pl">plakasız</span>'}<div class="m"><b>${esc(cu(g.cust))} · ${g.loads.length} yük · ${kg(sum(g.loads, 'weight'))} kg</b><small class="${g.st === 'late' ? 'late' : ''}">${esc(g.note)}${g.driver ? ` · şoför: ${esc(g.driver)}` : ''}</small></div><div class="acts">${act}</div></div></div></div>`;
  }
  function checkCard(S, cu) {
    const open = S.trips.filter(t => t.status === 'hazirlaniyor'), all = S.trips.filter(t => t.status === 'hazirlaniyor' || t.status === 'yolda');
    let t = all.find(x => x.id === D.trip) || open[0] || all[0];
    if (!t) return `<section class="card"><h2>Araç yükleme kontrolü</h2><small>Araç yola çıkmadan önce hiçbir yük unutulmasın</small><div class="empty">Araca konmuş yük yok. Müşteri ya da ofis araca yük koyunca burada görünür.</div></section>`;
    const n = B.order(S.all.filter(l => l.trip_id === t.id)), got = n.filter(l => l.arrived_at).length, miss = n.length - got, ready = t.status === 'hazirlaniyor' && miss === 0 && n.length > 0;
    return `<section class="card"><h2>Araç yükleme kontrolü</h2><small>Araç yola çıkmadan önce hiçbir yük unutulmasın</small>
${all.length > 1 ? `<div class="chips3">${all.map(x => `<button type="button" class="${x.id === t.id ? 'on' : ''}" data-a="chk-trip" data-id="${esc(x.id)}">${esc(x.poz_no)} · ${esc(x.tractor)}</button>`).join('')}</div>` : ''}
<div class="chk-h">${plate(t.tractor)}<b>${esc(t.poz_no)}</b><span class="ch b">${esc(cu(t.customer_id))}</span></div>
<div class="pgb"><div class="pgr"><i style="width:${n.length ? Math.round(got / n.length * 100) : 0}%"></i></div><b>${got} / ${n.length} yük</b></div>
<div class="cks">${n.map(l => `<div class="ck"><span class="cb ${l.arrived_at ? 'on' : 'no'}">${l.arrived_at ? '✓' : '!'}</span><div><b>${esc(l.sender)} → ${esc(l.consignee)}</b><small class="${l.arrived_at ? '' : 'late'}">${l.arrived_at ? `${kg(l.weight)} kg${l.location ? ' · ' + esc(l.location) : ''} · Geldi ${esc(stampOf(l.arrived_at))}${X.condChip(l) ? ' · ' : ''}` : `Depoya henüz gelmedi${l.expected_date ? ' · beklenen ' + esc(B.dmy(l.expected_date)) + (l.expected_time ? ' ' + esc(l.expected_time) : '') : ''}`}</small></div></div>`).join('')}</div>
${t.status === 'hazirlaniyor' && miss ? `<div class="alert">${ic('warn')}<div><b>${miss} yük eksik.</b> Yola çıkarmadan önce ofisi arayın ya da yükü araçtan çıkarın.</div></div>` : ''}
<button type="button" class="btn ${ready ? 'go' : 'dis'} wide" data-a="depart" data-id="${esc(t.id)}" ${ready ? '' : 'disabled'}>${ic('truck')}${t.status === 'yolda' ? 'Yola çıktı ✓' : 'Yola çıktı (müşteri değiştiremesin)'}</button>
<small class="cn">${t.status === 'yolda' ? 'Bu araç kilitlendi; müşteri artık değişiklik yapamaz.' : 'Tüm yükler gelince bu düğme yeşile döner. Eksik yükle çıkarmak için ofisle görüşün.'}</small></section>`;
  }
  const stampOf = iso => X.stamp(iso);
  X.views['d-program'] = S => {
    const cu = id => (X.custOf(id) || {}).name || '?', gs = groups(S), todo = gs.filter(g => g.st !== 'done'), kp = (icn, label, n, cls) => `<div class="k ${cls}"><i>${ic(icn)}</i><div><small>${label}</small><b>${n}</b></div></div>`;
    return `<div class="prg"><div><div class="kp4d">${kp('clock', 'Bugün gelecek araç', todo.length, 'amb')}${kp('check', 'Gelen araç', gs.length - todo.length, 'grn')}${kp('bell', 'Geciken', gs.filter(g => g.st === 'late').length, 'red')}${kp('box', 'Beklenen yük', sum(todo.map(g => ({ n: g.remaining.length })), 'n'), 'acc')}</div>
<section class="card day"><h2>Bugünün programı <span class="mut">${esc(new Date().toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long' }))}</span></h2>${gs.length ? gs.map(g => groupRow(g, cu)).join('') : '<div class="empty">Bugün için beklenen araç yok. Müşteriler yüklerine beklenen tarih ve saat yazınca burada görünür.</div>'}
<small class="cn">Tarihi yazılmamış bekleyen yükler programda görünmez; <b>Bekleyenler</b> sekmesinde durur.</small></section></div>${checkCard(S, cu)}</div>`;
  };
  X.act['grp-arrive'] = async t => {
    const ids = String(t.dataset.ids || '').split(',').filter(Boolean); if (!ids.length || P.busy) return;
    P.busy = 'grp'; let ok = 0, bad = 0, last = '';
    for (const id of ids) { const { error } = await X.markOne(id, true); if (error) { bad++; last = X.explain(error); } else ok++; }
    P.busy = '';
    X.toast(bad ? `${ok} yük işaretlendi, ${bad} yük işaretlenemedi: ${last}` : `Araç geldi: ${ok} yük depoya alındı`, !!bad);
    await X.load0();
  };
  X.act['chk-trip'] = (t, e, id) => { D.trip = id; X.draw(); };
  X.act.depart = async (t, e, id) => {
    if (P.busy) return;
    P.busy = 'depart';
    const r = await X.rpc('shp_depot_depart', { p_trip: id, ...nameArg() });
    P.busy = '';
    if (r.error) { X.toast(X.explain(r.error), true); await X.load0(); return; }
    X.toast('Araç yola çıktı olarak işaretlendi; müşteri artık değiştiremez'); await X.load0();
  };

  // ------------------------------------------------------------------ Okut: telefon kamerası, USB / Zebra okuyucu ya da elle kod
  // Varsayılan: kod okununca yük kendiliğinden GELDİ olur, ekranda büyük renkli bir sonuç çıkar, okutmaya devam edilir.
  // "Otomatik GELDİ" kapatılırsa eski düzen: yük açılır, raf seçilir, GELDİ'ye elle basılır.
  // Okuyucu modu: Zebra el terminali ya da USB / Bluetooth okuyucu kodu klavyeden yazılmış gibi gönderir; kutu hep seçili kalır, ekran klavyesi açılmaz.
  const findByCode = code => (P.data.loads || []).find(l => l.qr_code === code);
  function sameTruck(l) { return (P.data.loads || []).filter(x => x.id !== l.id && !x.arrived_at && x.customer_id === l.customer_id && (x.inbound_plate || '') === (l.inbound_plate || '') && (l.inbound_plate || x.trip_id === l.trip_id)).length; }
  let actx = null;
  function feedback(kind) {
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) { actx = actx || new A(); const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = kind === 'ok' ? 880 : 300; g.gain.value = 0.12; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (kind === 'ok' ? 0.12 : 0.3)); }
    } catch (_) { /* ses yok */ }
    try { if (navigator.vibrate) navigator.vibrate(kind === 'ok' ? 90 : [120, 60, 120]); } catch (_) { /* titreşim yok */ }
  }
  // elle düzen (otomatik kapalı): yük açılır, GELDİ'ye elle basılır
  function manualFind(code) {
    const S = D.sc, l = findByCode(code);
    S.code = code; S.done = ''; S.err = l ? '' : `Bu kodlu yük bulunamadı: ${code}`; S.load = l || null; S.loc = l ? (l.location || '') : ''; S.flash = null;
    if (l) feedback('ok');
    X.draw();
  }
  // otomatik düzen: kodlar sırayla işlenir (arka arkaya okutulan kutular kaybolmaz)
  async function pump() {
    const S = D.sc; if (S.working) return;
    S.working = true;
    try { while (S.q.length) await autoOne(S.q.shift()); } finally { S.working = false; }
  }
  async function autoOne(code) {
    const S = D.sc, l = findByCode(code);
    S.code = ''; S.err = ''; S.done = ''; S.load = null;
    if (!l) { S.flash = { kind: 'bad', title: 'KOD BULUNAMADI', text: code }; feedback('bad'); X.draw(); return; }
    if (l.arrived_at) { S.flash = { kind: 'warn', title: 'ZATEN GELMİŞ', text: `${l.sender} → ${l.consignee}`, sub: `${hm(l.arrived_at)}${l.arrived_by ? ' · ' + l.arrived_by : ''} · yeniden işaretlenmedi` }; feedback('bad'); X.draw(); return; }
    const r = await X.rpc('shp_depot_receive', { p_id: l.id, p_counted_pieces: null, p_counted_weight: null, p_condition: 'saglam', p_note: '', p_location: S.loc.trim(), ...nameArg() });
    if (r.error) { S.flash = { kind: 'bad', title: 'İŞARETLENEMEDİ', text: `${l.sender} → ${l.consignee}`, sub: X.explain(r.error) }; feedback('bad'); X.draw(); return; }
    l.arrived_at = new Date().toISOString(); l.arrived_by = X.name(); if (l.status === 'bekliyor') l.status = 'depoda'; if (S.loc.trim()) l.location = S.loc.trim();   // aynı kutu hemen yeniden okutulursa ikinci kez işlenmesin
    const c = X.custOf(l.customer_id) || {}, more = sameTruck(l);
    S.flash = { kind: 'ok', title: 'GELDİ', id: l.id, text: `${l.sender} → ${l.consignee}`, sub: `${c.name ? c.name + ' · ' : ''}${l.pieces} kap · ${kg(l.weight)} kg${l.inbound_plate ? ' · ' + l.inbound_plate : ''}${S.loc.trim() ? ' · ' + S.loc.trim() : ''}`, more };
    S.list.unshift({ id: l.id, label: `${l.sender} → ${l.consignee}`, at: new Date().toISOString() }); S.list.length = Math.min(S.list.length, 10);
    feedback('ok'); X.draw();
    X.load0();
  }
  function onCode(code) {
    if (D.sc.auto) { D.sc.q.push(code); pump(); } else manualFind(code);
  }
  X.views['d-okut'] = () => {
    const S = D.sc, l = S.load && loadOf(S.load.id), cam = X.qr && X.qr.scanning(), f = S.flash;
    const flash = f ? `<div class="scflash ${f.kind}" role="status" aria-live="polite"><b>${ic(f.kind === 'ok' ? 'check' : 'warn')}${esc(f.title)}</b><span class="t">${esc(f.text)}</span>${f.sub ? `<span>${esc(f.sub)}</span>` : ''}${f.more ? `<span>Aynı araçtan ${f.more} yük daha var: okutmaya devam edin</span>` : ''}${f.id && loadOf(f.id) && loadOf(f.id).arrived_at ? `<button type="button" class="btn sm" data-a="sc-undo" data-id="${esc(f.id)}">${ic('undo')}Geri al</button>` : ''}</div>` : '';
    const list = S.list.length ? `<section class="card"><div class="lbl2">BU OTURUMDA GELENLER (${S.list.length})</div><ul class="sclist">${S.list.map(x => `<li><span>${esc(x.label)}</span><small>${esc(hm(x.at))}</small><button type="button" class="btn sm" data-a="sc-undo" data-id="${esc(x.id)}">Geri al</button></li>`).join('')}</ul></section>` : '';
    const locs = S.auto ? `<div class="lbl2">RAF / KONUM (isteğe bağlı; okutulan yüklere yazılır)</div><div class="chips3">${locOptions().map(x => `<button type="button" class="${S.loc === x ? 'on' : ''}" data-a="sc-loc" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
    const result = l ? `<div class="card2"><div class="rline">${l.inbound_plate ? plate(l.inbound_plate, 'big') : ''}${l.arrived_at ? `<span class="ch g">Geldi ${esc(hm(l.arrived_at))}${l.arrived_by ? ' · ' + esc(l.arrived_by) : ''}</span>` : '<span class="ch a">Depoya gelmedi</span>'}</div>
<div class="rt">${esc(l.sender)} → ${esc(l.consignee)}</div><div class="row"><span>Mal</span><b>${esc(l.goods) || '—'}</b></div><div class="row"><span>Kap · Kilo</span><b>${esc(l.pieces)} · ${kg(l.weight)} kg</b></div><div class="row"><span>Varış</span><b>${esc(l.dest_customs) || '—'}</b></div>
<div class="lbl2">DEPO KONUMU</div><div class="chips3">${locOptions().map(x => `<button type="button" class="${S.loc === x ? 'on' : ''}" data-a="sc-loc" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
<div class="acts2"><button type="button" class="btn" data-a="sc-recv">${ic('camera')}Fotoğraf</button><button type="button" class="btn warnb" data-a="sc-problem">${ic('warn')}Sorun var</button></div>
<button type="button" class="btn go big" data-a="sc-go" ${S.busy ? 'disabled' : ''}>${ic('check')}${l.arrived_at ? 'KONUMU KAYDET' : 'GELDİ'}</button>
${sameTruck(l) ? `<div class="same">Aynı araçtan ${sameTruck(l)} yük daha var: okutmaya devam edin</div>` : ''}</div>` : '';
    return `<div class="okt"><section class="card"><h2>${ic('qr')} Yük okut</h2>
<div class="sws"><label class="tg"><span>Okutunca otomatik GELDİ</span><input type="checkbox" role="switch" data-i="sc-auto" ${S.auto ? 'checked' : ''}></label><label class="tg"><span>Okuyucu modu (Zebra / USB okuyucu)</span><input type="checkbox" role="switch" data-i="sc-reader" ${S.reader ? 'checked' : ''}></label></div>
${flash}<div class="camwrap">${cam ? '<div id="scan-slot" class="scan-slot"></div><div class="vf2"></div>' : `<div class="camoff">${ic('camera')}<span>${esc(S.camErr || 'Kamera kapalı')}</span></div>`}</div>
<div class="acts"><button type="button" class="btn ${cam ? '' : 'pri'}" data-a="sc-cam">${ic('camera')}${cam ? 'Kamerayı kapat' : 'Kamerayı aç'}</button></div>
<form data-f="sccode" class="codef"><label class="fld"><span>${S.reader ? 'Okuyucuyla okutun (kutu hazır bekliyor)' : 'Ya da kodu yazın / USB okuyucuyla okutun'}</span><input id="sc-code" data-i="sc-code" value="${esc(S.code)}" placeholder="PCS:ABCDEFGHIJ" autocomplete="off" autocapitalize="characters" enterkeyhint="go" inputmode="${S.reader ? 'none' : 'text'}" maxlength="30" style="text-transform:uppercase"></label><button type="submit" class="btn">${ic('search')}${S.auto ? 'Geldi say' : 'Bul'}</button></form>
${locs}${S.err ? `<div class="ferr" role="alert">${esc(S.err)}</div>` : ''}${S.done ? `<div class="okb" role="status">${ic('check')}${esc(S.done)}</div>` : ''}<small>${S.auto ? 'Etiketteki QR kodu çerçeveye alın: okununca yük kendiliğinden <b>geldi</b> olur. Yanlış okuttuysanız <b>Geri al</b>.' : 'Etiketteki QR kodu çerçeveye alın; okununca yük açılır, GELDİ\'ye basın.'} Etiketsiz yükte <b>Bekleyenler</b> sekmesinden plaka ya da firma adıyla bulun.</small></section>
${result ? `<section class="card res">${result}</section>` : ''}${list}</div>`;
  };
  // kutuya yazılan / okuyucudan gelen kod: "PCS:" ile başlayan tam kod (14 karakter) Enter beklemeden işlenir
  const FULL = /^PCS[:\-\s]*[A-Z0-9]{10}$/i;
  X.inp.push((t, k) => {
    const S = D.sc;
    if (k === 'sc-code') { S.code = t.value; clearTimeout(S.timer); if (FULL.test(t.value.trim())) S.timer = setTimeout(() => { if (FULL.test(String(S.code).trim())) X.submit.sccode(); }, 150); return true; }
    if (k === 'sc-auto') { S.auto = t.checked; setPref('auto', S.auto); S.flash = null; X.draw(); return true; }
    if (k === 'sc-reader') { S.reader = t.checked; setPref('reader', S.reader); X.draw(); return true; }
    return false;
  });
  X.submit.sccode = () => {
    const S = D.sc; clearTimeout(S.timer);
    const c = X.qr.parseCode(S.code);
    if (!c) { S.err = 'Kod geçersiz: 10 harf / rakam (örn. PCS:ABCDEFGHIJ)'; S.load = null; S.flash = null; if (S.auto) feedback('bad'); X.draw(); return; }
    onCode(c);
  };
  X.act['sc-loc'] = t => { D.sc.loc = D.sc.loc === t.dataset.v ? '' : t.dataset.v; X.draw(); };
  X.act['sc-recv'] = () => { const l = D.sc.load && loadOf(D.sc.load.id); if (l) return openRecv(l, { loc: D.sc.loc }); };
  X.act['sc-problem'] = () => { const l = D.sc.load && loadOf(D.sc.load.id); if (l) return openRecv(l, { loc: D.sc.loc, cond: 'eksik' }); };
  X.act['sc-go'] = async () => {
    const S = D.sc, l = S.load && loadOf(S.load.id); if (!l || S.busy) return;
    S.busy = true; X.draw();
    const r = await X.rpc('shp_depot_receive', { p_id: l.id, p_counted_pieces: l.counted_pieces, p_counted_weight: l.counted_weight, p_condition: l.condition || 'saglam', p_note: l.receive_note || '', p_location: S.loc.trim(), ...nameArg() });
    S.busy = false;
    if (r.error) { S.err = X.explain(r.error); X.draw(); return; }
    const more = sameTruck(l);
    S.done = `${l.sender} → ${l.consignee} ${l.arrived_at ? 'kaydedildi' : 'geldi olarak işaretlendi'}${more ? ` · aynı araçtan ${more} yük daha var` : ''}`;
    S.load = null; S.code = ''; S.err = ''; X.toast(l.arrived_at ? 'Konum kaydedildi' : 'Yük geldi olarak işaretlendi'); await X.load0();
  };
  // yanlış okutulan yükü geri al (Geldi işareti kalkar)
  X.act['sc-undo'] = async (t, e, id) => {
    const S = D.sc, l = loadOf(id); if (!l) return;
    const r = await X.markOne(id, false);
    if (r.error) { X.toast(X.explain(r.error), true); return; }
    S.list = S.list.filter(x => x.id !== id);
    S.flash = { kind: 'warn', title: 'GERİ ALINDI', text: `${l.sender} → ${l.consignee}`, sub: 'Yük yeniden "depoya gelmedi" görünür' };
    X.toast('Geri alındı'); await X.load0();
  };
  X.act['sc-cam'] = async () => {
    const S = D.sc;
    if (X.qr.scanning()) { X.qr.scanStop(); X.draw(); return; }
    S.camErr = '';
    try { await X.qr.scanStart(onCode); } catch (er) { S.camErr = er.message; X.qr.scanStop(); }
    X.draw();
  };
  // sekme açılınca: kamera izni daha önce verildiyse kamera kendiliğinden açılır
  X.enter['d-okut'] = () => {
    try { if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'camera' }).then(p => { if (p.state === 'granted' && P.tab === 'okut' && X.qr && !X.qr.scanning()) X.act['sc-cam'](); }).catch(() => {}); } catch (_) { /* izin sorgusu yok */ }
  };
  X.onDraw.push(() => { if (P.tab !== 'okut' && X.qr && X.qr.scanning()) X.qr.scanStop(); });
  // okuyucu modu: kutu hep seçili kalır (ekran klavyesi açılmaz), böylece okutulan kod doğrudan oraya yazılır
  X.onDraw.push(() => {
    if (P.tab !== 'okut' || !D.sc.reader || document.querySelector('dialog[open]') || P.drawer) return;
    const a = document.activeElement, el = document.getElementById('sc-code');
    if (el && a !== el && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) el.focus();
  });
  X.depo = { groups, waLink, onCode, state: D };
})();
