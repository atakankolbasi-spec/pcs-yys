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
  const D = { recv: null, sc: { code: '', load: null, loc: '', busy: false, err: '', camErr: '', done: '', auto: pref('auto', true), reader: pref('reader', false), mode: (() => { try { return localStorage.getItem('pcs.okut.mode') === 'yukle' ? 'yukle' : 'geldi'; } catch (_) { return 'geldi'; } })(), q: [], working: false, flash: null, list: [], timer: null }, trip: '' };
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
    const n = B.order(S.all.filter(l => l.trip_id === t.id)), got = n.filter(l => l.arrived_at).length, miss = n.length - got, ready = t.status === 'hazirlaniyor' && miss === 0 && n.length > 0, ld = n.filter(l => l.loaded_at).length, open1 = t.status === 'hazirlaniyor';
    return `<section class="card"><h2>Araç yükleme kontrolü</h2><small>Araç yola çıkmadan önce hiçbir yük unutulmasın</small>
${all.length > 1 ? `<div class="chips3">${all.map(x => `<button type="button" class="${x.id === t.id ? 'on' : ''}" data-a="chk-trip" data-id="${esc(x.id)}">${esc(x.poz_no)} · ${esc(x.tractor)}</button>`).join('')}</div>` : ''}
<div class="chk-h">${plate(t.tractor)}<b>${esc(t.poz_no)}</b><span class="ch b">${esc(cu(t.customer_id))}</span></div>
<div class="pgb"><div class="pgr"><i style="width:${n.length ? Math.round(got / n.length * 100) : 0}%"></i></div><b>${got} / ${n.length} yük geldi</b></div>
<div class="pgb"><div class="pgr yk"><i style="width:${n.length ? Math.round(ld / n.length * 100) : 0}%"></i></div><b>${ld} / ${n.length} yüklendi</b></div>
<div class="cks">${n.map(l => `<div class="ck"><span class="cb ${l.arrived_at ? 'on' : 'no'}">${l.arrived_at ? '✓' : '!'}</span><div><b>${esc(l.sender)} → ${esc(l.consignee)}</b><small class="${l.arrived_at ? '' : 'late'}">${l.arrived_at ? `${kg(l.weight)} kg${l.location ? ' · ' + esc(l.location) : ''} · Geldi ${esc(stampOf(l.arrived_at))}${X.condChip(l) ? ' · ' : ''}${l.loaded_at ? ` · <span class="ch b">${ic('truck')}Yüklendi ${esc(stampOf(l.loaded_at))}</span>` : ''}` : `Depoya henüz gelmedi${l.expected_date ? ' · beklenen ' + esc(B.dmy(l.expected_date)) + (l.expected_time ? ' ' + esc(l.expected_time) : '') : ''}`}</small></div>${open1 && l.arrived_at ? `<button type="button" class="btn sm ${l.loaded_at ? '' : 'go'}" data-a="chk-load" data-id="${esc(l.id)}" data-on="${l.loaded_at ? '0' : '1'}" ${P.busy === l.id ? 'disabled' : ''}>${l.loaded_at ? 'Geri al' : 'Yüklendi'}</button>` : ''}</div>`).join('')}</div>
${open1 && !miss && ld > 0 && ld < n.length ? `<div class="alert">${ic('warn')}<div><b>${n.length - ld} yük araca yüklendi işaretlenmemiş.</b> Barkodunu okutun ya da <b>Yüklendi</b>'ye basın; sonra yola çıkarın.</div></div>` : ''}
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
  // elle yüklendi işareti (okuyucu yoksa ya da bozulduysa)
  X.act['chk-load'] = async (t, e, id) => {
    if (P.busy) return;
    P.busy = id; X.draw();
    const r = await X.rpc('shp_depot_load', { p_id: id, p_loaded: t.dataset.on === '1', ...nameArg() });
    P.busy = '';
    if (r.error) X.toast(X.explain(r.error), true); else X.toast(t.dataset.on === '1' ? 'Araca yüklendi olarak işaretlendi' : 'Yüklendi işareti geri alındı');
    await X.load0();
  };
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
  // sonuç kutusu Okut sekmesi dışında kısa süre üstte görünür, sonra kendiliğinden kapanır
  let flashTimer = null;
  const flashed = () => { D.sc.flashAt = Date.now(); clearTimeout(flashTimer); flashTimer = setTimeout(() => X.draw(), 5200); };
  async function autoOne(code) {
    const S = D.sc, l = findByCode(code);
    S.code = ''; S.err = ''; S.done = ''; S.load = null;
    if (!l) { S.flash = { kind: 'bad', title: 'KOD BULUNAMADI', text: code }; flashed(); feedback('bad'); X.draw(); return; }
    if (S.mode === 'yukle') return loadOne(l);
    if (l.arrived_at) { S.flash = { kind: 'warn', title: 'ZATEN GELMİŞ', text: `${l.sender} → ${l.consignee}`, sub: `${hm(l.arrived_at)}${l.arrived_by ? ' · ' + l.arrived_by : ''} · yeniden işaretlenmedi` }; flashed(); feedback('bad'); X.draw(); return; }
    const r = await X.rpc('shp_depot_receive', { p_id: l.id, p_counted_pieces: null, p_counted_weight: null, p_condition: 'saglam', p_note: '', p_location: S.loc.trim(), ...nameArg() });
    if (r.error) { S.flash = { kind: 'bad', title: 'İŞARETLENEMEDİ', text: `${l.sender} → ${l.consignee}`, sub: X.explain(r.error) }; flashed(); feedback('bad'); X.draw(); return; }
    l.arrived_at = new Date().toISOString(); l.arrived_by = X.name(); if (l.status === 'bekliyor') l.status = 'depoda'; if (S.loc.trim()) l.location = S.loc.trim();   // aynı kutu hemen yeniden okutulursa ikinci kez işlenmesin
    const c = X.custOf(l.customer_id) || {}, more = sameTruck(l);
    S.flash = { kind: 'ok', title: 'GELDİ', act: 'geldi', id: l.id, text: `${l.sender} → ${l.consignee}`, sub: `${c.name ? c.name + ' · ' : ''}${l.pieces} kap · ${kg(l.weight)} kg${l.inbound_plate ? ' · ' + l.inbound_plate : ''}${S.loc.trim() ? ' · ' + S.loc.trim() : ''}`, more };
    S.list.unshift({ id: l.id, act: 'geldi', label: `${l.sender} → ${l.consignee}`, at: new Date().toISOString() }); S.list.length = Math.min(S.list.length, 10);
    flashed(); feedback('ok'); X.draw();
    X.load0();
  }
  // araca yükleme: yük araca yüklenirken barkod okutulur → "yüklendi" (yalnızca depoya gelmiş, araca atanmış, yola çıkmamış araçtaki yükler)
  async function loadOne(l) {
    const S = D.sc, t = X.tripOf(l.trip_id), lbl = `${l.sender} → ${l.consignee}`;
    const stop = (kind, title, sub) => { S.flash = { kind, title, text: lbl, sub }; flashed(); feedback('bad'); X.draw(); };
    if (!l.arrived_at) return stop('bad', 'HENÜZ GELMEMİŞ', 'Önce depoya GELDİ olarak işaretleyin');
    if (!l.trip_id || !t) return stop('warn', 'ARACA ATANMAMIŞ', 'Müşteri bu yükü bir araca koymamış');
    if (t.status !== 'hazirlaniyor') return stop('bad', 'ARAÇ YOLA ÇIKMIŞ', `${t.tractor} · yükleme değiştirilemez`);
    if (l.loaded_at) return stop('warn', 'ZATEN YÜKLENMİŞ', `${hm(l.loaded_at)}${l.loaded_by ? ' · ' + l.loaded_by : ''} · ${t.tractor}`);
    const r = await X.rpc('shp_depot_load', { p_id: l.id, p_loaded: true, ...nameArg() });
    if (r.error) return stop('bad', 'İŞARETLENEMEDİ', X.explain(r.error));
    l.loaded_at = new Date().toISOString(); l.loaded_by = X.name();                 // aynı kutu hemen yeniden okutulursa ikinci kez işlenmesin
    const mine = (P.data.loads || []).filter(x => x.trip_id === t.id), done = mine.filter(x => x.loaded_at).length, left = mine.length - done;
    S.flash = { kind: 'ok yk', title: 'YÜKLENDİ', act: 'yukle', id: l.id, text: lbl, sub: `${t.tractor} · ${t.poz_no} · ${done}/${mine.length} yüklendi`, note: left ? `Bu araçta ${left} yük daha yüklenecek` : 'Bu araçtaki tüm yükler yüklendi ✓' };
    S.list.unshift({ id: l.id, act: 'yukle', label: `${lbl} → ${t.tractor}`, at: new Date().toISOString() }); S.list.length = Math.min(S.list.length, 10);
    flashed(); feedback('ok'); X.draw();
    X.load0();
  }
  function onCode(code) {
    if (D.sc.auto || D.sc.mode === 'yukle') { D.sc.q.push(code); pump(); } else manualFind(code);
  }
  // sonuç kutusu (Okut sekmesinde ve diğer sekmelerde üstte aynı görünür); Geri al yalnız o işlem hâlâ geçerliyse
  const flashHtml = (f, top) => {
    const l = f.id && loadOf(f.id), can = l && (f.act === 'yukle' ? l.loaded_at : l.arrived_at);
    return `<div class="scflash${top ? ' top' : ''} ${f.kind}" role="status" aria-live="polite"><b>${ic(f.kind.startsWith('ok') ? 'check' : 'warn')}${esc(f.title)}</b><span class="t">${esc(f.text)}</span>${f.sub ? `<span>${esc(f.sub)}</span>` : ''}${f.more ? `<span>Aynı araçtan ${f.more} yük daha var: okutmaya devam edin</span>` : ''}${f.note ? `<span>${esc(f.note)}</span>` : ''}${can ? `<button type="button" class="btn sm" data-a="sc-undo" data-id="${esc(f.id)}" data-k="${f.act === 'yukle' ? 'yukle' : 'geldi'}">${ic('undo')}Geri al</button>` : ''}</div>`;
  };
  X.views['d-okut'] = () => {
    const S = D.sc, l = S.load && loadOf(S.load.id), cam = X.qr && X.qr.scanning(), f = S.flash;
    const flash = f ? flashHtml(f, false) : '';
    const list = S.list.length ? `<section class="card"><div class="lbl2">BU OTURUMDA OKUTULANLAR (${S.list.length})</div><ul class="sclist">${S.list.map(x => `<li><span class="ch ${x.act === 'yukle' ? 'b' : 'g'}">${x.act === 'yukle' ? 'Yüklendi' : 'Geldi'}</span><span>${esc(x.label)}</span><small>${esc(hm(x.at))}</small><button type="button" class="btn sm" data-a="sc-undo" data-id="${esc(x.id)}" data-k="${x.act === 'yukle' ? 'yukle' : 'geldi'}">Geri al</button></li>`).join('')}</ul></section>` : '';
    const locs = S.auto ? `<div class="lbl2">RAF / KONUM (isteğe bağlı; okutulan yüklere yazılır)</div><div class="chips3">${locOptions().map(x => `<button type="button" class="${S.loc === x ? 'on' : ''}" data-a="sc-loc" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
    const result = l ? `<div class="card2"><div class="rline">${l.inbound_plate ? plate(l.inbound_plate, 'big') : ''}${l.arrived_at ? `<span class="ch g">Geldi ${esc(hm(l.arrived_at))}${l.arrived_by ? ' · ' + esc(l.arrived_by) : ''}</span>` : '<span class="ch a">Depoya gelmedi</span>'}</div>
<div class="rt">${esc(l.sender)} → ${esc(l.consignee)}</div><div class="row"><span>Mal</span><b>${esc(l.goods) || '—'}</b></div><div class="row"><span>Kap · Kilo</span><b>${esc(l.pieces)} · ${kg(l.weight)} kg</b></div><div class="row"><span>Varış</span><b>${esc(l.dest_customs) || '—'}</b></div>
<div class="lbl2">DEPO KONUMU</div><div class="chips3">${locOptions().map(x => `<button type="button" class="${S.loc === x ? 'on' : ''}" data-a="sc-loc" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
<div class="acts2"><button type="button" class="btn" data-a="sc-recv">${ic('camera')}Fotoğraf</button><button type="button" class="btn warnb" data-a="sc-problem">${ic('warn')}Sorun var</button></div>
<button type="button" class="btn go big" data-a="sc-go" ${S.busy ? 'disabled' : ''}>${ic('check')}${l.arrived_at ? 'KONUMU KAYDET' : 'GELDİ'}</button>
${sameTruck(l) ? `<div class="same">Aynı araçtan ${sameTruck(l)} yük daha var: okutmaya devam edin</div>` : ''}</div>` : '';
    return `<div class="okt"><section class="card"><h2>${ic('qr')} Yük okut</h2>
<div class="seg2" role="group" aria-label="Okutunca ne olsun"><button type="button" class="${S.mode === 'geldi' ? 'on' : ''}" data-a="sc-mode" data-v="geldi">${ic('check')}Depoya GELDİ</button><button type="button" class="${S.mode === 'yukle' ? 'on' : ''}" data-a="sc-mode" data-v="yukle">${ic('truck')}Araca YÜKLENDİ</button></div>
<div class="sws"><label class="tg"><span>Okutunca otomatik GELDİ</span><input type="checkbox" role="switch" data-i="sc-auto" ${S.auto ? 'checked' : ''} ${S.mode === 'yukle' ? 'disabled' : ''}></label><label class="tg"><span>Okuyucu modu (Zebra / USB okuyucu)</span><input type="checkbox" role="switch" data-i="sc-reader" ${S.reader ? 'checked' : ''}></label></div>
${stationCard()}${flash}<div class="camwrap">${cam ? '<div id="scan-slot" class="scan-slot"></div><div class="vf2"></div>' : `<div class="camoff">${ic('camera')}<span>${esc(S.camErr || 'Kamera kapalı')}</span></div>`}</div>
<div class="acts"><button type="button" class="btn ${cam ? '' : 'pri'}" data-a="sc-cam">${ic('camera')}${cam ? 'Kamerayı kapat' : 'Kamerayı aç'}</button></div>
<form data-f="sccode" class="codef"><label class="fld"><span>${S.reader ? 'Okuyucuyla okutun (kutu hazır bekliyor)' : 'Ya da kodu yazın / USB okuyucuyla okutun'}</span><input id="sc-code" data-i="sc-code" value="${esc(S.code)}" placeholder="PCS:ABCDEFGHIJ" autocomplete="off" autocapitalize="characters" enterkeyhint="go" inputmode="${S.reader ? 'none' : 'text'}" maxlength="30" style="text-transform:uppercase"></label><button type="submit" class="btn">${ic('search')}${S.mode === 'yukle' ? 'Yüklendi say' : S.auto ? 'Geldi say' : 'Bul'}</button></form>
${locs}${S.err ? `<div class="ferr" role="alert">${esc(S.err)}</div>` : ''}${S.done ? `<div class="okb" role="status">${ic('check')}${esc(S.done)}</div>` : ''}<small>${S.mode === 'yukle' ? 'Yükü araca yüklerken etiketteki QR kodu okutun: yük kendiliğinden <b>yüklendi</b> olur. Yalnız depoya gelmiş ve araca konmuş yükler okunur. Yanlış okuttuysanız <b>Geri al</b>.' : S.auto ? 'Etiketteki QR kodu çerçeveye alın: okununca yük kendiliğinden <b>geldi</b> olur. Yanlış okuttuysanız <b>Geri al</b>.' : 'Etiketteki QR kodu çerçeveye alın; okununca yük açılır, GELDİ\'ye basın.'} Etiketsiz yükte <b>Bekleyenler</b> sekmesinden plaka ya da firma adıyla bulun.</small></section>
${result ? `<section class="card res">${result}</section>` : ''}${list}</div>`;
  };
  // ---------------- Genel okuma: Okut ekranını açmaya gerek yok.
  // Sayfa açıkken (hangi sekmede olursa olsun) okuyucu / Zebra tarama tuşu kodu klavyeden yazılmış gibi gönderir; "PCS:" ile başlayan tam kod
  // hızlı bir dizi olarak gelince yük kendiliğinden GELDİ olur (otomatik kapalıysa Okut sekmesi açılır). Elle yazı yavaş olduğu için karışmaz.
  const TAIL = /PCS[:\-\s]?([A-Z0-9]{10})$/i;
  const G = { buf: '', last: 0, code: '', at: 0 };
  function scanAnywhere(code) {
    const S = D.sc, now = Date.now();
    if (code === G.code && now - G.at < 1500) return;                          // aynı kod iki yoldan gelirse bir kez işlenir
    G.code = code; G.at = now;
    if (S.auto || S.mode === 'yukle') { onCode(code); return; }
    P.tab = 'okut'; manualFind(code);
  }
  document.addEventListener('keydown', e => {
    if (!P.data || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const t = e.target, tag = t && t.tagName, sink = t && t.id === 'scan-sink';
    if (t && t.id === 'sc-code') return;                                       // Okut kutusunun kendi işleyicisi var
    if (t && !sink && (t.isContentEditable || tag === 'TEXTAREA' || tag === 'SELECT')) return;
    if (document.querySelector('dialog[open]') || P.drawer) return;
    if (e.timeStamp - G.last > 60) G.buf = '';                                  // insan yazışı yavaştır; okuyucu milisaniyelerle yazar
    G.last = e.timeStamp;
    if (e.key === 'Enter') { const m = G.buf.length >= 10 && /([A-Z0-9]{10})$/i.exec(G.buf); G.buf = ''; if (m) { if (sink && t.value) t.value = ''; scanAnywhere(m[1].toUpperCase()); } return; }
    if (e.key.length !== 1) return;
    G.buf = (G.buf + e.key).slice(-40);
    const m = TAIL.exec(G.buf);
    if (!m) return;
    const raw = m[0], code = m[1].toUpperCase();
    G.buf = '';
    if (t && tag === 'INPUT' && !sink) {                                        // kod yanlışlıkla bir kutuya (ad, arama) yazıldıysa oradan silinir; yük ancak ad temizlenince işlenir (işlem kaydına kod karışmasın)
      const clean = n => {                                                       // son karakter henüz yazılmamış olabilir; ekran yenilenmişse kutu yenisidir: kısa aralıklarla, güncel kutuya bakılır
        const el = (t.id && document.getElementById(t.id)) || t;
        if (el.value.toUpperCase().endsWith(raw.toUpperCase())) { el.value = el.value.slice(0, -raw.length); el.dispatchEvent(new Event('input', { bubbles: true })); scanAnywhere(code); }
        else if (n < 12) setTimeout(() => clean(n + 1), 15);
        else scanAnywhere(code);
      };
      setTimeout(() => clean(0), 0);
      return;
    }
    if (sink) { const clr = n => { if (t.value) t.value = ''; if (n < 3) setTimeout(() => clr(n + 1), 20); }; setTimeout(() => clr(0), 0); }
    scanAnywhere(code);
  }, true);
  // Okuyucu modu açıkken her sekmede görünmez bir kutu seçili kalır: ekran klavyesi gibi "metin yazan" okuyucular da çalışsın
  X.headTools.push(() => `<button type="button" class="btn ${D.sc.reader ? 'on' : ''}" data-a="reader-toggle" aria-pressed="${D.sc.reader}" title="Zebra / USB okuyucu: her sekmede okutunca yük kendiliğinden gelir">${ic('qr')}Okuyucu ${D.sc.reader ? 'açık' : 'kapalı'}</button>`);
  X.headTools.push(() => `<button type="button" class="btn ${D.sc.mode === 'yukle' ? 'on' : ''}" data-a="sc-mode" data-v="${D.sc.mode === 'yukle' ? 'geldi' : 'yukle'}" title="Okutunca ne olsun: depoya GELDİ ya da araca YÜKLENDİ">${ic(D.sc.mode === 'yukle' ? 'truck' : 'check')}Okutunca: ${D.sc.mode === 'yukle' ? 'YÜKLENDİ' : 'GELDİ'}</button>`);
  X.act['sc-mode'] = t => { const m = t.dataset.v === 'yukle' ? 'yukle' : 'geldi'; D.sc.mode = m; try { localStorage.setItem('pcs.okut.mode', m); } catch (_) { /* tarayıcı saklamıyorsa her açılışta GELDİ */ } D.sc.flash = null; D.sc.err = ''; D.sc.load = null; X.draw(); };
  X.act['reader-toggle'] = () => { D.sc.reader = !D.sc.reader; setPref('reader', D.sc.reader); X.draw(); };
  X.floats.push(() => {
    const S = D.sc, f = S.flash, parts = [];
    if (S.reader && P.tab !== 'okut') parts.push('<input id="scan-sink" class="sink" data-i="sc-sink" inputmode="none" autocomplete="off" autocapitalize="characters" aria-hidden="true" tabindex="-1">');
    if (f && P.tab !== 'okut' && S.flashAt && Date.now() - S.flashAt < 5000) {
      parts.push(flashHtml(f, true));
    }
    return parts.join('');
  });
  X.onDraw.push(() => {
    if (!D.sc.reader || P.tab === 'okut' || document.querySelector('dialog[open]') || P.drawer) return;
    const a = document.activeElement, el = document.getElementById('scan-sink');
    if (el && a !== el && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) el.focus();
  });
  // kutuya yazılan / okuyucudan gelen kod: "PCS:" ile başlayan tam kod (14 karakter) Enter beklemeden işlenir
  const FULL = /^PCS[:\-\s]*[A-Z0-9]{10}$/i;
  X.inp.push((t, k) => {
    const S = D.sc;
    if (k === 'sc-code') { S.code = t.value; clearTimeout(S.timer); if (FULL.test(t.value.trim())) S.timer = setTimeout(() => { if (FULL.test(String(S.code).trim())) X.submit.sccode(); }, 150); return true; }
    if (k === 'sc-sink') { const m = TAIL.exec(t.value); if (m) { t.value = ''; scanAnywhere(m[1].toUpperCase()); } else if (t.value.length > 40) t.value = ''; return true; }
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
    const S = D.sc, l = loadOf(id), yk = t.dataset.k === 'yukle'; if (!l) return;
    const r = yk ? await X.rpc('shp_depot_load', { p_id: id, p_loaded: false, ...nameArg() }) : await X.markOne(id, false);
    if (r.error) { X.toast(X.explain(r.error), true); return; }
    if (yk) { l.loaded_at = null; l.loaded_by = null; }
    S.list = S.list.filter(x => !(x.id === id && (x.act === 'yukle') === yk));
    S.flash = { kind: 'warn', title: 'GERİ ALINDI', text: `${l.sender} → ${l.consignee}`, sub: yk ? 'Yük yeniden "yüklenmedi" görünür' : 'Yük yeniden "depoya gelmedi" görünür' };
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
  // ---------------- Etiket istasyonu: depo "Geldi" işaretleyince etiket yazıcıdan kendiliğinden çıkar.
  // Yazıcının bağlı olduğu bilgisayarda (Chrome'u --kiosk-printing ile açın, ZD230 varsayılan yazıcı olsun) başlıktan açılır; her yük için etiket
  // yalnızca BİR kez basılır: sunucu etiketi "basıldı" diye işaretler, başka bir cihaz aynı yükü basamaz. Açıldığı andan SONRA gelen yükler basılır.
  const LP_KEY = 'pcs.etiket.istasyon';
  const LP = D.lp = { on: false, since: '', busy: false, n: 0, last: [], err: '' };
  try { const v = localStorage.getItem(LP_KEY); if (v) { LP.on = true; LP.since = v; } } catch (_) { /* saklanamıyorsa her açılışta kapalı */ }
  async function station() {
    if (!LP.on || LP.busy || !P.data) return;
    const since = Date.parse(LP.since) || 0;
    const ids = (P.data.loads || []).filter(l => l.arrived_at && !l.label_printed_at && l.qr_code && Date.parse(l.arrived_at) >= since).map(l => l.id);
    if (!ids.length) return;
    LP.busy = true;
    try {
      const r = await X.rpc('shp_depot_labels_claim', { p_ids: ids, ...nameArg() });
      if (r.error) { LP.err = X.explain(r.error); X.toast(`Etiket basılamadı: ${LP.err}`, true); return; }
      const got = r.data || [];
      if (!got.length) return;                                                  // başka cihaz basmış
      LP.err = ''; LP.last = got;
      let ok = false;
      try { ok = await X.qr.printDirect(got); } catch (_) { ok = false; }
      if (ok) { LP.n += got.length; X.toast(`${got.length} etiket yazıcıya gönderildi`); }
      else { LP.err = 'Yazıcıya gönderilemedi'; X.toast('Etiket yazıcıya gönderilemedi; Okut sekmesinden "Son etiketleri yeniden bas"a basın', true); }
    } catch (er) { LP.err = String((er && er.message) || er); X.toast(`Etiket basılamadı: ${LP.err}`, true); }
    finally { LP.busy = false; X.draw(); }
  }
  X.after.push(() => { station(); });
  X.headTools.push(() => `<button type="button" class="btn ${LP.on ? 'on' : ''}" data-a="lp-toggle" aria-pressed="${LP.on}" title="Yük depoya GELDİ olunca etiket bu bilgisayardaki yazıcıdan kendiliğinden çıkar">${ic('print')}Etiket yazıcı ${LP.on ? 'açık' : 'kapalı'}</button>`);
  X.act['lp-toggle'] = () => {
    LP.on = !LP.on; LP.err = '';
    LP.since = LP.on ? ((P.data && P.data.now) || new Date().toISOString()) : '';
    try { if (LP.on) localStorage.setItem(LP_KEY, LP.since); else localStorage.removeItem(LP_KEY); } catch (_) { /* saklanamadı */ }
    X.toast(LP.on ? 'Etiket yazıcı açık: bundan sonra GELDİ olan yüklerin etiketi otomatik basılır' : 'Etiket yazıcı kapatıldı');
    X.draw();
  };
  X.act['lp-again'] = async () => {
    if (!LP.last.length || LP.busy) return;
    LP.busy = true; X.draw();
    let ok = false; try { ok = await X.qr.printDirect(LP.last); } catch (_) { ok = false; }
    LP.busy = false; if (ok) LP.err = '';
    X.toast(ok ? `${LP.last.length} etiket yeniden gönderildi` : 'Yazıcıya gönderilemedi', !ok); X.draw();
  };
  const stationCard = () => !LP.on ? '' : `<div class="lpc"><div class="lbl2">ETİKET YAZICI · AÇIK</div><div class="lpr"><span>${LP.n ? `<b>${LP.n}</b> etiket gönderildi` : 'Yük GELDİ olunca etiket kendiliğinden çıkar'}${LP.err ? ` · <b class="late">${esc(LP.err)}</b>` : ''}</span>${LP.last.length ? `<button type="button" class="btn sm" data-a="lp-again" ${LP.busy ? 'disabled' : ''}>${ic('print')}Son ${LP.last.length} etiketi yeniden bas</button>` : ''}</div><small>Boyut: ${esc(X.qr.stationSize().name)} · Etiket yazdır penceresinde başka boyut seçilirse bu da değişir.</small></div>`;
  X.depo = { groups, waLink, onCode, state: D };
})();
