/* Nakliye programı: müşteri sayfası (nakliye.html), depo sayfası (nakliye.html?d=ANAHTAR).
 *   Müşteri: kullanıcı adı ve şifreyle girer (kullanıcıyı ofis tanımlar; tanımlanmamışsa ?m=ANAHTAR bağlantısı yeter).
 *            Üç adım: 1 yükleri yazar, 2 hangi araca ne yükleneceğini seçer, 3 Lade Liste ve CMR belgelerini alır.
 *            Yazdığı firma ve araç bilgileri kendiliğinden saklanır, bir daha yazmaya gerek kalmaz.
 *   Depo:    şifresiz bağlantı; gelen yükü "Geldi" diye işaretler (tek tek ya da seçilenleri topluca), yük bilgisini düzeltir.
 * Ekranlar 5 saniyede bir kendiliğinden yenilenir: önce hafif bir değişiklik damgası (shp_stamp) sorulur, değiştiyse veri çekilir.
 * Yetki sunucuda denetlenir (supabase/nakliye-kurulumu.sql).
 * Ek ekranlar ayrı dosyalarda (nakliye-musteri.js: takip, rapor, yazışma, Excel; nakliye-depo.js: program, okut, teslim alma; nakliye-qr.js: QR etiket ve okuyucu)
 * ve window.PCSNKP üzerinden bu çekirdeğe bağlanır. */
(() => {
  'use strict';
  const B = window.PCSNKB;
  const Q = new URLSearchParams(location.search);
  const MT = (Q.get('m') || '').trim(), DT = (Q.get('d') || '').trim();
  const MODE = MT ? 'm' : DT ? 'd' : 'm';
  const SK = 'pcs-nakliye-oturum', NAME_KEY = 'pcs-nakliye-depo-ad';
  const getSess = () => { try { return localStorage.getItem(SK) || ''; } catch (_) { return ''; } };
  const setSess = v => { try { if (v) localStorage.setItem(SK, v); else localStorage.removeItem(SK); } catch (_) { /* kayıt yoksa oturum açık kalmaz */ } };
  let TOKEN = MODE === 'd' ? DT : (getSess() || MT);
  const esc = B.esc;
  const root = document.getElementById('p');
  const client = window.createPCSClient('https://ollrccfqiqilbflanuik.supabase.co', 'sb_publishable_BV4TQSJ5lCNyTdRZV-Ouvg_bDOzBNQk');
  const CAP = 24000;   // tır kapasitesi (kg): araç doluluk göstergesi için yaklaşık değer
  const POLL_MS = 5000;
  const P = { data: null, err: '', loading: false, polling: false, down: 0, at: '', stamp: '', noStamp: false, live: '', needLogin: MODE === 'm' && !TOKEN, tab: 'bekliyor', scope: 'free', q: '', cf: '',
    confirm: '', name: '', busy: '', sel: new Set(), target: '', nv: { tractor: '', trailer: '', date: '' }, open: new Set(), editTrip: '', te: { tractor: '', trailer: '', date: '', subject: '' },
    qa: { sender: '', consignee: '', goods: '', pieces: '', weight: '', plate: '' }, docTrip: '', drawer: '', dr: {}, page: 'plan', login: { u: '', p: '', err: '', busy: false } };
  try { P.name = localStorage.getItem(NAME_KEY) || ''; } catch (_) { /* kayıt yoksa boş kalır */ }
  // Ek ekranların (nakliye-musteri.js, nakliye-depo.js, nakliye-qr.js) bağlandığı yer
  const X = window.PCSNKP = { views: {}, act: {}, inp: [], submit: {}, after: [], onDraw: [], enter: {}, sideHtml: null, closeSide: null };

  // ------------------------------------------------------------------ küçük yardımcılar
  const I = {
    plus: '<path d="M12 5v14M5 12h14"/>', refresh: '<path d="M4 12a8 8 0 0114-5.3M20 4v4h-4M20 12a8 8 0 01-14 5.3M4 20v-4h4"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4zM13.5 6.5l4 4"/>', trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', truck: '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h9a6 6 0 010 12"/>', doc: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', close: '<path d="M6 6l12 12M6 18L18 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', out: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>', print: '<path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z"/>',
    bell: '<path d="M6 17v-6a6 6 0 0112 0v6l1.5 2h-15zM10 21h4"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6h-6"/>', upload: '<path d="M12 16V5M7 9l5-5 5 5M4 19h16"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', warn: '<path d="M12 4l9 16H3zM12 10v5M12 18h.01"/>', sheet: '<path d="M5 4h14v16H5zM5 10h14M5 15h14M11 4v16"/>', wa: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z"/><path d="M9 9c.3 2.5 2.5 4.7 5.5 5.5l1.3-1.3-2-1-1 .7c-.8-.4-1.6-1.2-2-2l.7-1-1-2z"/>', download: '<path d="M12 4v11M7 11l5 5 5-5M4 19h16"/>', pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', down: '<path d="M6 9l6 6 6-6"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
  const tr = s => String(s || '').toLocaleUpperCase('tr-TR');
  const kg = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const ton = n => (Number(n || 0) / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const stamp = iso => { try { return iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; } catch (_) { return ''; } };
  const clock = () => new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const sum = (a, k) => a.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const uniq = a => [...new Set(a.filter(Boolean))];
  const tripOf = id => id ? ((P.data && P.data.trips) || []).find(t => t.id === id) : null;
  const custOf = id => MODE === 'm' ? P.data.customer : (P.data.customers || []).find(c => c.id === id);
  const locked = t => t.status !== 'hazirlaniyor';
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const toast = (t, bad) => { const el = document.getElementById('toast'); clearTimeout(toast.t); el.textContent = t; el.className = 'show' + (bad ? ' error' : ''); toast.t = setTimeout(() => { el.className = ''; }, bad ? 7000 : 3200); };
  const parseNum = v => { let s = String(v ?? '').replace(/\s/g, ''); if (!s) return null; if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',')) s = s.replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const plate = (p, cls = '') => p ? `<span class="pl ${cls}">${esc(p)}</span>` : '';
  const dash = '<span class="mut">—</span>';
  const condChip = l => l.condition === 'eksik' ? '<span class="ch r">Eksik var</span>' : l.condition === 'hasarli' ? '<span class="ch r">Hasarlı</span>' : (l.counted_pieces != null && l.counted_pieces !== l.pieces ? '<span class="ch r">Sayım farkı</span>' : '');
  const pct = w => Math.round((Number(w) || 0) / CAP * 100);
  const isFree = l => (l.status === 'bekliyor' || l.status === 'depoda') && !l.trip_id;
  const canEdit = l => isFree(l) || (l.status === 'aracta' && (tripOf(l.trip_id) ? !locked(tripOf(l.trip_id)) : false));
  const canDel = l => isFree(l);
  const sortedTrips = () => ((P.data && P.data.trips) || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  // ------------------------------------------------------------------ giriş ve oturum
  function explain(e) {
    const m = `${e && e.code} ${e && e.message}`;
    if (/PGRST202|42883|schema cache|Could not find the function/.test(m)) return 'Nakliye programı henüz kurulmamış ya da güncellenmemiş. Size bağlantıyı gönderen kişiyle görüşün.';
    if (/42501|geçersiz|kapatılmış/i.test(m)) return 'Bu bağlantı geçersiz ya da kapatılmış. Size bağlantıyı gönderen kişiden yenisini isteyin.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
    return (e && e.message) || 'İşlem yapılamadı';
  }
  // Müşteri sayfasında yetki hatası: kullanıcı girişi gerekiyor ya da oturum bitmiş → giriş ekranı
  function authFail(e) {
    if (MODE !== 'm') return false;
    const m = `${e && e.code} ${e && e.message}`;
    if (/28000|kullanıcı girişi/i.test(m)) { P.needLogin = true; P.data = null; return true; }
    if (/42501|geçersiz|kapatılmış/i.test(m) && TOKEN && TOKEN === getSess()) {
      setSess(''); TOKEN = MT; P.data = null; P.needLogin = true; P.login.err = 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.'; return true;
    }
    return false;
  }
  async function doLogin() {
    const L = P.login;
    if (L.busy) return;
    if (!L.u.trim() || !L.p) { L.err = 'Kullanıcı adı ve şifre yazın.'; draw(); return; }
    L.busy = true; L.err = ''; draw();
    let r; try { r = await client.rpc('shp_login', { p_username: L.u.trim(), p_password: L.p }); } catch (_) { r = { error: { message: 'Failed to fetch' } }; }
    L.busy = false;
    if (r.error) { L.err = explain(r.error); draw(); return; }
    if (!r.data || !r.data.ok) { L.err = (r.data && r.data.message) || 'Giriş yapılamadı.'; L.p = ''; draw(); return; }
    setSess(r.data.token); TOKEN = r.data.token; P.needLogin = false; P.err = ''; P.data = null; L.u = ''; L.p = ''; L.err = '';
    await load();
  }
  async function doLogout() {
    const t = getSess();
    if (t) { try { await client.rpc('shp_logout', { p_token: t }); } catch (_) { /* sunucuya ulaşılamasa da bu cihazdaki oturum kapanır */ } }
    setSess(''); TOKEN = MT; P.data = null; P.needLogin = true; P.sel.clear(); P.login = { u: '', p: '', err: '', busy: false }; draw();
  }

  // ------------------------------------------------------------------ veri ve 5 saniyelik yenileme
  async function fetchStamp() {
    if (P.noStamp) return { v: '' };
    let r; try { r = await client.rpc('shp_stamp', { p_token: TOKEN }); } catch (_) { return { off: true }; }
    if (r.error) {
      const m = `${r.error.code} ${r.error.message}`;
      if (/PGRST202|42883|schema cache|Could not find the function/.test(m)) { P.noStamp = true; return { v: '' }; }
      if (/Failed to fetch|NetworkError|network/i.test(m)) return { off: true };
      return { err: r.error };
    }
    return { v: String(r.data || '') };
  }
  async function load(quiet) {
    if (P.loading || P.needLogin || !TOKEN) return;
    P.loading = true;
    if (!quiet) draw();
    const s = await fetchStamp();
    let r;
    if (s.err) r = { error: s.err };
    else { try { r = await client.rpc(MODE === 'm' ? 'shp_portal' : 'shp_depot', { p_token: TOKEN }); } catch (_) { r = { error: { message: 'Failed to fetch' } }; } }
    P.loading = false;
    if (r.error) {
      if (authFail(r.error)) { draw(); return; }
      P.live = 'off';
      if (!quiet || !P.data) P.err = explain(r.error); else toast(explain(r.error), true);
    } else {
      P.data = r.data; P.err = ''; P.live = 'ok'; P.stamp = s.v === undefined ? '' : s.v; P.at = clock();
      for (const id of [...P.sel]) { const l = (P.data.loads || []).find(x => x.id === id); if (!l || !selectable(l)) P.sel.delete(id); }
      if (P.drawer && !(P.data.loads || []).some(x => x.id === P.drawer)) P.drawer = '';
      if (P.target && P.target !== 'new') { const tt = tripOf(P.target); if (!tt || locked(tt)) P.target = ''; }
      X.after.forEach(f => { try { f(); } catch (_) { /* ek ekran hatası ana ekranı bozmasın */ } });
    }
    draw();
  }
  const load0 = () => load(true);
  async function poll() {
    if (P.polling || P.loading || !P.data || P.needLogin || (P.down && Date.now() - P.down < 3000) || document.visibilityState === 'hidden') return;
    P.polling = true;
    try {
      const s = await fetchStamp();
      if (s.off) P.live = 'off';
      else if (s.err) { if (authFail(s.err)) { draw(); return; } P.live = 'off'; }
      else { P.live = 'ok'; P.at = clock(); if (P.noStamp || s.v !== P.stamp) { P.polling = false; await load(true); return; } }
    } finally { P.polling = false; }
    liveTick();
  }
  const liveHtml = () => `<span id="live" class="live ${P.live === 'off' ? 'off' : 'ok'}" title="Ekran 5 saniyede bir kendiliğinden yenilenir">${P.live === 'off' ? 'Bağlantı yok' : `Canlı<em>${esc(P.at)}</em>`}</span>`;
  function liveTick() { const el = document.getElementById('live'); if (el) el.outerHTML = liveHtml(); }

  // ------------------------------------------------------------------ ortak parçalar
  const chip = l => l.status === 'aracta' ? `<span class="ch b">Araçta</span> ${l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>'}` : l.status === 'depoda' ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>';
  const docButtons = trip => `<button type="button" class="btn sm" data-a="doc" data-kind="lade" data-id="${esc(trip.id)}">${ic('doc')}Lade Liste</button><button type="button" class="btn sm" data-a="doc" data-kind="cmr" data-id="${esc(trip.id)}">${ic('doc')}CMR</button>`;
  function docsOf(tripId, kinds) {
    const trip = tripOf(tripId); if (!trip) return null;
    const loads = P.data.loads.filter(l => l.trip_id === tripId);
    const customer = custOf(trip.customer_id) || { name: '', carrier: '', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '' };
    return { trip, list: kinds.map(k => ({ label: k === 'lade' ? 'Lade Liste' : 'CMR', html: k === 'lade' ? B.lade({ trip, customer, loads }) : B.cmr({ trip, customer, loads }) })) };
  }
  function showDocs(tripId, kinds) {
    const d = docsOf(tripId, kinds); if (!d) return;
    B.show(d.list, { title: `${d.trip.poz_no} · ${B.plates(d.trip)}` });
  }
  const custName = l => (custOf(l.customer_id) || {}).name || '';
  const hit = l => !P.q || [l.sender, l.consignee, l.goods, l.dest_customs, l.inbound_plate, custName(l), (tripOf(l.trip_id) || {}).poz_no, B.plates(tripOf(l.trip_id))].some(x => tr(x).includes(tr(P.q)));
  const searchBar = ph => `<label class="srch">${ic('search')}<input id="q" data-i="q" type="search" value="${esc(P.q)}" placeholder="${ph}" autocomplete="off" aria-label="Ara"></label>`;
  const brandMark = '<img src="logo.svg" alt="" class="bm">';
  const dl = (id, vals) => `<datalist id="${id}">${vals.map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  const contactOf = (kind, name) => { const n = tr(String(name || '').trim()); return n ? ((P.data.contacts || []).find(c => c.kind === kind && tr(c.name) === n) || null) : null; };
  const datalists = () => {
    const d = P.data, ls = d.loads || [], cs = d.contacts || [], vs = d.vehicles || [];
    return dl('dl-sender', uniq([...cs.filter(c => c.kind === 'sender').map(c => c.name), ...ls.map(l => l.sender)])) + dl('dl-consignee', uniq([...cs.filter(c => c.kind === 'consignee').map(c => c.name), ...ls.map(l => l.consignee)]))
      + dl('dl-plate', uniq([...ls.map(l => l.inbound_plate), ...vs.map(v => v.tractor)])) + dl('dl-tractor', uniq(vs.map(v => v.tractor))) + dl('dl-trailer', uniq(vs.map(v => v.trailer)));
  };

  // ------------------------------------------------------------------ yük formu (pencere): müşteri tarafında tam form
  const F = [  // [alan, etiket, tür, geniş mi, bölüm]
    ['sender', 'Gönderici', 'text', 0, 0], ['consignee', 'Alıcı', 'text', 0, 0], ['sender_addr', 'Gönderici adresi', 'area', 0, 0], ['consignee_addr', 'Alıcı adresi', 'area', 0, 0], ['notify', 'Notify (bildirim adresi)', 'area', 1, 0],
    ['goods', 'Mal cinsi', 'text', 1, 1], ['pieces', 'Kap adedi', 'num', 0, 1], ['packing', 'Ambalaj', 'text', 0, 1], ['weight', 'Brüt kilo (kg)', 'num', 0, 1], ['volume', 'Hacim (m³)', 'num', 0, 1],
    ['dest_customs', 'Varış gümrük', 'text', 0, 2], ['country', 'Ülke', 'text', 0, 2], ['code', 'Gümrük kodu', 'text', 0, 2], ['broker', 'Gümrükçü', 'text', 0, 2], ['expected_date', 'Beklenen tarih', 'date', 0, 2], ['expected_time', 'Beklenen saat (depoya varış)', 'time', 0, 2],
    ['inbound_plate', 'Yükü getirecek kamyon plakası', 'plate', 0, 3], ['driver', 'Şoför adı ve telefonu', 'text', 0, 3], ['note', 'Not', 'text', 1, 3]
  ];
  const SEC = ['Taraflar', 'Mal bilgisi', 'Varış ve teslim', 'Yükü getirecek araç'];
  const LIST = { sender: 'dl-sender', consignee: 'dl-consignee', inbound_plate: 'dl-plate' };
  const blank = () => ({ id: '', sender: '', consignee: '', pieces: '', packing: 'KAP', goods: '', weight: '', dest_customs: '', country: '', expected_date: '', expected_time: '', driver: '', sender_addr: '', consignee_addr: '', notify: '', volume: '', code: '', broker: '', inbound_plate: '', note: '' });
  const inp = (k, lab, kind, wide, v) => {
    const req = k === 'sender' || k === 'consignee';
    const t = kind === 'area' ? `<textarea id="f-${k}" name="${k}" rows="2" maxlength="300">${esc(v)}</textarea>` :
      `<input id="f-${k}" name="${k}" type="${kind === 'date' ? 'date' : kind === 'time' ? 'time' : 'text'}" ${kind === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v)}" maxlength="${k === 'note' ? 500 : kind === 'plate' ? 40 : 200}" ${req ? 'required' : ''} ${LIST[k] ? `list="${LIST[k]}"` : ''} ${kind === 'plate' ? 'style="text-transform:uppercase" placeholder="Örn. 34 ABC 123"' : ''} autocomplete="off">`;
    return `<label class="fld ${wide ? 'wide' : ''}"><span>${lab}${req ? ' <i>*</i>' : ''}</span>${t}</label>`;
  };
  function openForm(l) {
    const f = { ...blank(), ...Object.fromEntries(Object.entries(l || {}).map(([k, v]) => [k, v == null ? '' : v])) }, edit = !!f.id;
    const dlg = document.getElementById('m');
    dlg.innerHTML = `<form data-f="load" autocomplete="off"><div class="mh"><div><h2>${edit ? 'Yükü düzenle' : 'Yeni yük'}</h2><p>${edit ? 'Değişiklik belgelerde (Lade Liste ve CMR) de görünür.' : 'Gönderici ve alıcı yazılmalı; diğer alanlar belgeler için kullanılır. Daha önce yazdığınız firmalar kendiliğinden önerilir.'}</p></div><button type="button" class="x" data-a="mclose" aria-label="Kapat">${ic('close')}</button></div>
<div class="mb"><input type="hidden" name="id" value="${esc(f.id)}">${SEC.map((t, s) => `<section class="fs"><h3>${t}</h3><div class="grid">${F.filter(x => x[4] === s).map(x => inp(x[0], x[1], x[2], x[3], f[x[0]])).join('')}</div></section>`).join('')}<div id="ferr" class="ferr" hidden></div></div>
<div class="mf">${canDel(f) && edit ? `<button type="button" class="btn danger" data-a="mdel" data-id="${esc(f.id)}">${ic('trash')}Sil</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-a="mclose">Vazgeç</button><button type="submit" class="btn pri">${ic('check')}${edit ? 'Değişikliği kaydet' : 'Yükü ekle'}</button></div></form>`;
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('#f-sender')?.focus();
  }
  const closeForm = () => { const d = document.getElementById('m'); if (d.open) d.close(); };
  // Kayıtlı firma seçilince boş adres / ülke / gümrük alanları kendiliğinden dolar
  function autofillForm(form, kind, name) {
    const c = contactOf(kind, name); if (!c) return;
    const map = kind === 'sender' ? { sender_addr: 'addr' } : { consignee_addr: 'addr', notify: 'notify', country: 'country', dest_customs: 'dest_customs', code: 'code', broker: 'broker' };
    for (const [field, key] of Object.entries(map)) { const el = form.elements[field]; if (el && !el.value.trim() && c[key]) el.value = c[key]; }
  }

  async function save(form) {
    const fd = new FormData(form), err = m => { const e = document.getElementById('ferr'); if (e) { e.textContent = m; e.hidden = false; } };
    const g = k => String(fd.get(k) || '').trim();
    if (!g('sender') || !g('consignee')) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(fd.get('weight')), v = parseNum(fd.get('volume')), pc = parseNum(fd.get('pieces'));
    if ([w, v, pc].some(Number.isNaN)) return err('Kap, kilo ve hacim sayı olarak yazılmalı.');
    if ((w || 0) < 0 || (v || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap, kilo ve hacim eksi olamaz; kap tam sayı olmalı.');
    const row = { id: g('id') || undefined, sender: g('sender'), consignee: g('consignee'), pieces: pc || 0, packing: g('packing') || 'KAP', goods: g('goods'), weight: w || 0, volume: v == null ? null : v,
      dest_customs: g('dest_customs'), country: g('country'), expected_date: g('expected_date') || null, expected_time: g('expected_time') || null, driver: g('driver'), sender_addr: g('sender_addr'), consignee_addr: g('consignee_addr'), notify: g('notify'), code: g('code'), broker: g('broker'),
      inbound_plate: g('inbound_plate').toUpperCase(), note: g('note') };
    P.busy = 'save';
    const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    const { error } = await client.rpc('shp_portal_save', { p_token: TOKEN, p_load: row });
    P.busy = '';
    if (error) { if (btn) btn.disabled = false; if (authFail(error)) { closeForm(); draw(); return; } err(explain(error)); return; }
    closeForm();
    toast(row.id ? 'Yük güncellendi' : 'Yük eklendi. Depo yük geldiğinde işaretleyecek.');
    if (!row.id) P.scope = 'free';
    await load0();
  }
  async function removeLoad(id) {
    const { error } = MODE === 'm' ? await client.rpc('shp_portal_delete', { p_token: TOKEN, p_id: id }) : await client.rpc('shp_depot_delete', { p_token: TOKEN, p_id: id, p_name: P.name.trim() });
    if (error) { if (authFail(error)) { closeForm(); draw(); return false; } toast(explain(error), true); return false; }
    toast('Yük silindi'); P.sel.delete(id); P.confirm = ''; if (P.drawer === id) P.drawer = ''; closeForm(); await load0(); return true;
  }

  // ------------------------------------------------------------------ giriş ekranı
  function loginView() {
    const L = P.login;
    return `<main class="lgn"><section class="lg-card"><div class="lg-h">${brandMark}<div><b>PCS TRANSİT YYS</b><small>Nakliye portalı</small></div></div>
<h1>Giriş yapın</h1><p class="mut">Ofisimizin size verdiği kullanıcı adı ve şifreyle giriş yapın.</p>
<form data-f="login" autocomplete="on"><label class="fld"><span>Kullanıcı adı</span><input id="lg-u" data-i="lg-u" name="username" value="${esc(L.u)}" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="40"></label>
<label class="fld"><span>Şifre</span><input id="lg-p" data-i="lg-p" name="password" type="password" value="${esc(L.p)}" autocomplete="current-password" maxlength="100"></label>
<div id="lg-err" class="ferr" ${L.err ? '' : 'hidden'} role="alert">${esc(L.err)}</div>
<button type="submit" class="btn pri lg wide" ${L.busy ? 'disabled' : ''}>${ic('lock')}${L.busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</button></form>
<p class="hint-s">Şifrenizi unuttuysanız ofisimizle görüşün; yeni şifre ofisimiz tarafından verilir.</p></section></main>`;
  }

  // ------------------------------------------------------------------ müşteri sayfası (adım adım)
  const topCustomer = () => {
    const d = P.data, c = d.customer, u = d.user;
    return `<header class="top"><div class="in"><div class="brand">${brandMark}<div><b>${esc(c.name)}</b><small>Nakliye portalı</small></div></div><div class="who">${c.logo ? `<img class="clogo" src="${esc(c.logo)}" alt="">` : ''}${liveHtml()}${u ? `<span class="uchip">${ic('user')}<b>${esc(u.name)}</b></span>` : ''}</div></div></header>`;
  };
  // Ofis Nakliye ekranıyla aynı tarz: renkli çerçeveli başlık kartı (üstte küçük yazı, büyük başlık, sağda düğmeler)
  const heading = (eyebrow, title, right) => `<section class="hd"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div><div class="hd-r">${right}</div></section>`;
  const PAGE_TITLES = { plan: 'Yükler ve araçlar', takip: 'Yük takibi', rapor: 'Rapor ve arşiv', yazisma: 'Ofisle yazışma' };
  const customerHead = () => {
    const u = P.data.user;
    return `${topCustomer()}<div class="sh">${heading('Müşteri portalı', PAGE_TITLES[P.page] || PAGE_TITLES.plan, `<button type="button" class="btn" data-a="refresh">${ic('refresh')}Yenile</button>${u ? `<button type="button" class="btn" data-a="logout">${ic('out')}Çıkış</button>` : ''}`)}${pageNav()}</div>`;
  };
  function stepper(all, free, trips) {
    const s1 = all.length ? 'done' : 'cur', s2 = !all.length ? '' : free.length || !trips.length ? 'cur' : 'done', s3 = trips.length ? (free.length ? '' : 'cur') : '';
    const st = (cls, n, t, sub) => `<div class="st ${cls}"><i>${cls === 'done' ? '✓' : n}</i><div><b>${n} · ${t}</b><small>${sub}</small></div></div>`;
    return `<nav class="steps" aria-label="Adımlar">${st(s1, 1, 'Yükleri yaz', `${all.length} yük kayıtlı`)}${st(s2, 2, 'Araca yerleştir', `${P.sel.size} yük seçili`)}${st(s3, 3, 'Belgeleri al', 'Lade Liste · CMR')}</nav>`;
  }
  function loadRow(l) {
    const t = tripOf(l.trip_id), sel = P.sel.has(l.id), fr = isFree(l);
    const state = t ? `<span class="ch b">${esc(t.poz_no)} · ${esc(B.plates(t))}</span>` : '';
    return `<li class="lo ${sel ? 'sel' : ''}"><span class="cbx">${fr ? `<input type="checkbox" data-a="pick" data-id="${esc(l.id)}" ${sel ? 'checked' : ''} aria-label="Araca koymak için seç: ${esc(l.sender)}">` : ''}</span>
<div class="lm"><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}${l.goods ? ` · ${esc(l.goods)}` : ''} · ${esc(l.pieces)} ${esc(l.packing)} · ${kg(l.weight)} kg</small>
<div class="chs">${state}${t ? (l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>') : chip(l)}${l.inbound_plate ? plate(l.inbound_plate, 'in sm') : ''}${!l.arrived_at && l.expected_date ? `<span class="ch n">Beklenen ${esc(B.dmy(l.expected_date))}${l.expected_time ? ' ' + esc(l.expected_time) : ''}</span>` : ''}${condChip(l)}</div></div>
<span class="le"><button type="button" class="ib" data-a="label" data-id="${esc(l.id)}" title="Etiket yazdır" aria-label="Etiket yazdır: ${esc(l.sender)}">${ic('qr')}</button>${canEdit(l) ? `<button type="button" class="ib" data-a="edit" data-id="${esc(l.id)}" title="Düzenle" aria-label="Düzenle: ${esc(l.sender)}">${ic('edit')}</button>` : ''}${canDel(l) ? `<button type="button" class="ib bad ${P.confirm === l.id ? 'ask' : ''}" data-a="del" data-id="${esc(l.id)}" title="Sil" aria-label="Sil: ${esc(l.sender)}">${ic('trash')}${P.confirm === l.id ? '<span>Evet, sil</span>' : ''}</button>` : ''}</span></li>`;
  }
  function panel1(all, free) {
    const rows = (P.scope === 'all' ? all : free).filter(hit), qa = P.qa;
    const sc = [['free', 'Araca konmamış', free.length], ['all', 'Tümü', all.length]];
    const hint = quickHint();
    return `<section class="pn p1" aria-labelledby="h1"><h2 id="h1"><i>1</i> Yüklerim <span class="cnt">${all.length}</span></h2>
<form class="quick" data-f="quick" autocomplete="off"><div class="r2"><input id="qa-sender" data-i="qa-sender" list="dl-sender" value="${esc(qa.sender)}" placeholder="Gönderici" aria-label="Gönderici" maxlength="200"><input id="qa-consignee" data-i="qa-consignee" list="dl-consignee" value="${esc(qa.consignee)}" placeholder="Alıcı" aria-label="Alıcı" maxlength="200"></div>
<div class="r3"><input id="qa-goods" data-i="qa-goods" value="${esc(qa.goods)}" placeholder="Mal cinsi" aria-label="Mal cinsi" maxlength="200"><input id="qa-pieces" data-i="qa-pieces" value="${esc(qa.pieces)}" placeholder="Kap" aria-label="Kap adedi" inputmode="numeric" maxlength="8"><input id="qa-weight" data-i="qa-weight" value="${esc(qa.weight)}" placeholder="Kilo" aria-label="Brüt kilo (kg)" inputmode="decimal" maxlength="12"></div>
<label class="qp">${ic('truck')}<input id="qa-plate" data-i="qa-plate" list="dl-plate" value="${esc(qa.plate)}" placeholder="Getirecek kamyon plakası" aria-label="Yükü getirecek kamyon plakası" maxlength="40" style="text-transform:uppercase"></label>
<div id="qa-hint" class="qhint" ${hint ? '' : 'hidden'}>${hint}</div><div id="qa-err" class="ferr" hidden role="alert"></div>
<div class="qb"><button type="submit" class="btn pri" ${P.busy === 'quick' ? 'disabled' : ''}>${ic('plus')}Hızlı ekle</button><button type="button" class="lnk" data-a="add-full">Tüm alanlarla ekle</button><button type="button" class="lnk" data-a="import">${ic('sheet')}Excel'den ekle</button></div></form>
<div class="lbar"><div class="seg" role="tablist">${sc.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${P.scope === k}" class="${P.scope === k ? 'on' : ''}" data-a="scope" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>${searchBar('Ara…')}</div>
${rows.length ? `<ul class="lol">${rows.map(loadRow).join('')}</ul>` : `<div class="empty">${all.length ? 'Bu görünümde yük yok.' : 'Henüz yük yazmadınız. Yukarıdaki alanlara gönderici ve alıcıyı yazıp "Hızlı ekle" deyin.'}</div>`}</section>`;
  }
  function quickHint() {
    const s = contactOf('sender', P.qa.sender), c = contactOf('consignee', P.qa.consignee);
    return s || c ? `${ic('check')}Kayıtlı ${s && c ? 'gönderici ve alıcı' : s ? 'gönderici' : 'alıcı'}: adres ve diğer bilgiler kendiliğinden eklenecek.` : '';
  }
  function truckSvg() { return '<svg class="trk" viewBox="0 0 96 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h56v24H2zM58 14h18l10 9v7H58z"/><circle cx="16" cy="32" r="5" fill="#fff"/><circle cx="44" cy="32" r="5" fill="#fff"/><circle cx="74" cy="32" r="5" fill="#fff"/></svg>'; }
  const ring = w => `<div class="ring ${pct(w) > 100 ? 'over' : ''}" style="--p:${Math.min(pct(w), 100)}%" role="img" aria-label="Doluluk %${pct(w)}"><span>%${pct(w)}</span></div>`;
  function truckCard(t, all) {
    const n = all.filter(l => l.trip_id === t.id), w = sum(n, 'weight'), lk = locked(t), on = P.target === t.id, open = P.open.has(t.id), editing = P.editTrip === t.id, te = P.te;
    const gel = n.filter(l => !l.arrived_at).length;
    const head = editing ? `<div class="grid"><label class="fld"><span>Çekici plaka</span><input id="te-tractor" data-i="te-tractor" list="dl-tractor" value="${esc(te.tractor)}" maxlength="30" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Dorse plaka</span><input id="te-trailer" data-i="te-trailer" list="dl-trailer" value="${esc(te.trailer)}" maxlength="30" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Çıkış tarihi</span><input id="te-date" data-i="te-date" type="date" value="${esc(te.date)}"></label><label class="fld"><span>Konu (isteğe bağlı)</span><input id="te-subject" data-i="te-subject" value="${esc(te.subject)}" maxlength="200" autocomplete="off"></label></div><div class="acts"><button type="button" class="btn pri sm" data-a="trip-save" data-id="${esc(t.id)}">${ic('check')}Kaydet</button><button type="button" class="btn sm" data-a="trip-cancel">Vazgeç</button></div>`
      : `<div class="vh" ${lk ? '' : `data-a="target" data-id="${esc(t.id)}" role="button" tabindex="0" aria-pressed="${on}"`}>${truckSvg()}<div class="vi"><div class="vt"><b class="poz">${esc(t.poz_no)}</b>${on ? '<span class="ch g">Seçili</span>' : ''}${lk ? '<span class="ch b">Yolda · kilitli</span>' : ''}</div><div class="vp">${plate(t.tractor)}${plate(t.trailer, 'alt')}</div><small>${n.length} yük · ${ton(w)} t dolu${lk ? '' : ` · ${ton(Math.max(CAP - w, 0))} t boş yer`} · ${esc(B.dmy(t.depart_date))}${gel ? ` · <span class="warn">${gel} yük depoya gelmedi</span>` : ''}</small></div>${ring(w)}</div>`;
    const lines = open ? `<ul class="vl">${B.order(n).map(l => `<li><span><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)} · ${kg(l.weight)} kg · ${l.arrived_at ? 'Depoda' : 'Depoya gelmedi'}</small></span>${lk ? '' : `<span class="le"><button type="button" class="ib" data-a="edit" data-id="${esc(l.id)}" title="Düzenle" aria-label="Düzenle: ${esc(l.sender)}">${ic('edit')}</button><button type="button" class="ib keep" data-a="unassign" data-id="${esc(l.id)}">${ic('undo')}<span>Araçtan çıkar</span></button></span>`}</li>`).join('')}</ul>` : '';
    return `<article class="veh ${on ? 'on' : ''} ${lk ? 'lk' : ''}">${head}${editing ? '' : `<div class="vb"><button type="button" class="lnk" data-a="toggle" data-id="${esc(t.id)}" aria-expanded="${open}">${ic('down')}Yükleri ${open ? 'gizle' : 'gör'} (${n.length})</button><button type="button" class="lnk" data-a="doctrip" data-id="${esc(t.id)}">${ic('doc')}Belgeler</button>${lk ? '' : `<button type="button" class="lnk" data-a="trip-edit" data-id="${esc(t.id)}">${ic('edit')}Plakayı değiştir</button>`}</div>`}${lines}</article>`;
  }
  function panel2(all, trips) {
    const sl = [...P.sel].map(id => all.find(l => l.id === id)).filter(Boolean), sw = sum(sl, 'weight'), nv = P.nv;
    const tgt = P.target && P.target !== 'new' ? tripOf(P.target) : null, base = tgt ? sum(all.filter(l => l.trip_id === tgt.id), 'weight') : 0;
    const vs = (P.data.vehicles || []).slice(0, 6);
    const cta = sl.length ? `${sl.length} yükü ${P.target ? 'bu araca' : 'araca'} koy` : 'Önce soldan yük seçin';
    return `<section class="pn p2" aria-labelledby="h2"><h2 id="h2"><i>2</i> Hangi araca yüklensin?</h2>
${trips.map(t => truckCard(t, all)).join('')}
<article class="veh new ${P.target === 'new' ? 'on' : ''}"><div class="vh nw" data-a="target" data-id="new" role="button" tabindex="0" aria-pressed="${P.target === 'new'}"><b>${ic('plus')}Yeni araç</b>${P.target === 'new' ? '<span class="ch g">Seçili</span>' : ''}</div>
<div class="grid"><label class="fld"><span>Çekici plaka <i>*</i></span><input id="nv-tractor" data-i="nv-tractor" list="dl-tractor" value="${esc(nv.tractor)}" maxlength="30" placeholder="Örn. 34 ABC 123" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Dorse plaka</span><input id="nv-trailer" data-i="nv-trailer" list="dl-trailer" value="${esc(nv.trailer)}" maxlength="30" placeholder="Örn. 34 DEF 456" autocomplete="off" style="text-transform:uppercase"></label></div>
<label class="fld"><span>Çıkış tarihi</span><input id="nv-date" data-i="nv-date" type="date" value="${esc(nv.date || today())}"></label>
${vs.length ? `<div class="sv"><small>Kayıtlı araçlarınız (dokunun)</small><div class="chs">${vs.map((v, i) => `<button type="button" class="vc" data-a="usev" data-i="${i}">${esc(v.tractor)}${v.trailer ? ` / ${esc(v.trailer)}` : ''}</button>`).join('')}</div></div>` : ''}</article>
<div class="sum"><div><span>Seçilen yük</span><b>${sl.length} yük · ${kg(sw)} kg</b></div><div><span>Araç doluluğu</span><b>${P.target ? `%${pct(base)} → %${pct(base + sw)}` : '—'}</b></div></div>
<button type="button" class="btn go wide" data-a="assign" ${sl.length && P.busy !== 'assign' ? '' : 'disabled'}>${ic('truck')}${P.busy === 'assign' ? 'Koyuluyor…' : cta}</button></section>`;
  }
  const docTripOf = trips => tripOf(P.docTrip) || (P.target && P.target !== 'new' && tripOf(P.target)) || trips[0] || null;
  function panel3(all, trips) {
    const t = docTripOf(trips), log = (P.data.log || []).slice(0, 8);
    const logHtml = log.length ? `<h3 class="lh">Son işlemler</h3><ul class="log">${log.map(x => `<li><i></i><span><b>${esc(x.action)}</b><small>${esc(x.actor)} · ${esc(stamp(x.at))}${x.summary ? ` · ${esc(x.summary)}` : ''}</small></span></li>`).join('')}</ul>` : '';
    if (!t) return `<section class="pn p3" aria-labelledby="h3"><h2 id="h3"><i>3</i> Belgeleriniz</h2><div class="empty">Bir araca yük koyduğunuzda Lade Liste ve CMR belgeleriniz burada hazır olur.</div>${logHtml}</section>`;
    const n = all.filter(l => l.trip_id === t.id), lk = locked(t);
    return `<section class="pn p3" aria-labelledby="h3"><h2 id="h3"><i>3</i> Belgeleriniz</h2><small class="sub">${esc(t.poz_no)} aracı için hazır</small>
<div class="docs"><button type="button" class="dc" data-a="doc" data-kind="lade" data-id="${esc(t.id)}" aria-label="Lade Liste belgesini aç"><span class="pg"><i class="h"></i><i style="width:40%"></i><span class="g"><u></u><u></u><u></u><u></u></span><i style="margin-top:10px"></i><i></i><i></i><i style="width:70%"></i></span><b>Lade Liste</b></button>
<button type="button" class="dc" data-a="doc" data-kind="cmr" data-id="${esc(t.id)}" aria-label="CMR belgesini aç"><span class="pg"><i class="h" style="width:80%"></i><span class="g"><u></u><u></u></span><span class="g"><u></u><u></u></span><i style="margin-top:8px"></i><i></i><i style="width:60%"></i></span><b>CMR (${Math.max(n.length, 1)} sayfa)</b></button></div>
<div class="sum"><div><span>Poz No</span><b>${esc(t.poz_no)}</b></div><div><span>Araç</span><b>${esc(B.plates(t))}</b></div><div><span>Varış</span><b>${esc(uniq(n.map(l => l.dest_customs)).join(' · ') || '—')}</b></div><div><span>Çıkış</span><b>${esc(B.dmy(t.depart_date))}</b></div><div><span>Yük</span><b>${n.length} · ${kg(sum(n, 'weight'))} kg</b></div></div>
<button type="button" class="btn pri wide" data-a="doc" data-kind="lade" data-id="${esc(t.id)}">${ic('doc')}Lade Liste · PDF / yazdır</button><button type="button" class="btn wide" data-a="doc" data-kind="cmr" data-id="${esc(t.id)}">${ic('doc')}CMR · PDF / yazdır</button><button type="button" class="btn wide" data-a="docs-both" data-id="${esc(t.id)}">${ic('print')}İkisini birlikte aç</button>
<div class="tip">${ic('lock')}<div>${lk ? 'Bu araç yola çıktı ve kilitlendi. Değişiklik için ofisimizle görüşün.' : 'Araç yola çıkınca ofisimiz kilitler; sonrasında değişiklik için bizimle görüşün.'}</div></div>${logHtml}</section>`;
  }
  const unread = () => ((P.data && P.data.messages) || []).filter(m => m.from_role === 'ofis' && !m.read_at).length;
  const pageNav = () => {
    const un = unread(), pages = [['plan', 'Yükler ve araçlar', 'truck'], ['takip', 'Takip', 'clock'], ['rapor', 'Rapor ve arşiv', 'doc'], ['yazisma', 'Ofisle yazışma', 'chat']];
    return `<nav class="pnav" aria-label="Sayfalar">${pages.map(([k, l, i]) => `<button type="button" class="${P.page === k ? 'on' : ''}" aria-current="${P.page === k}" data-a="page" data-v="${k}">${ic(i)}${l}${k === 'yazisma' && un ? `<span class="bdg">${un}</span>` : ''}</button>`).join('')}</nav>`;
  };
  function customerView() {
    const d = P.data, all = d.loads || [], free = all.filter(isFree), trips = sortedTrips();
    if (P.page !== 'plan' && X.views[P.page]) return `${customerHead()}<main class="pg2">${X.views[P.page]()}</main>${datalists()}`;
    return `${customerHead()}${stepper(all, free, trips)}<main class="cols">${panel1(all, free)}${panel2(all, trips)}${panel3(all, trips)}</main>${datalists()}`;
  }

  // ------------------------------------------------------------------ depo sayfası (masa başı tablo)
  const selectable = l => MODE === 'm' ? isFree(l) : P.tab === 'depoda' ? l.status === 'depoda' && !!l.arrived_at : !l.arrived_at && (l.status === 'bekliyor' || l.status === 'aracta');
  const depotSets = () => {
    const all = P.data.loads || [];
    return { all, wait: all.filter(l => !l.arrived_at && (l.status === 'bekliyor' || l.status === 'aracta')), idle: all.filter(l => l.status === 'depoda'),
      trips: (P.data.trips || []).filter(t => all.some(l => l.trip_id === t.id)) };
  };
  const when = l => {
    if (l.arrived_at) return `${esc(stamp(l.arrived_at))}${l.arrived_by ? `<small>${esc(l.arrived_by)}</small>` : ''}`;
    if (!l.expected_date) return dash;
    const late = l.expected_date < today();
    return `${l.expected_date === today() ? '<b>Bugün</b>' : esc(B.dmy(l.expected_date))}${late ? '<small class="warn">Gecikti</small>' : ''}`;
  };
  function depotRow(l, mode) {
    const t = tripOf(l.trip_id), sel = P.sel.has(l.id), arrived = !!l.arrived_at, ck = selectable(l);
    const act = arrived ? `<button type="button" class="btn undo" data-a="undo" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>${ic('undo')}Geri al</button>` : `<button type="button" class="btn go" data-a="arrive" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>${ic('check')}Geldi</button>`;
    return `<tr class="dr ${sel ? 'sel' : ''} ${P.drawer === l.id ? 'cur' : ''}"><td class="ck">${ck ? `<input type="checkbox" data-a="pick" data-id="${esc(l.id)}" ${sel ? 'checked' : ''} aria-label="Seç: ${esc(l.sender)}">` : ''}</td>
<td data-l="Gönderici → Alıcı" class="who2"><b>${esc(l.sender)} → ${esc(l.consignee)}</b>${l.dest_customs ? `<small>${esc(l.dest_customs)}</small>` : ''}${t && mode !== 'trip' ? `<small class="tp">${esc(t.poz_no)} · ${esc(B.plates(t))}</small>` : ''}${l.location || condChip(l) ? `<small>${l.location ? `${ic('pin')}${esc(l.location)} ` : ''}${condChip(l)}</small>` : ''}</td>
<td data-l="Mal">${esc(l.goods) || dash}</td><td data-l="Kap · Kilo" class="r">${esc(l.pieces)} · ${kg(l.weight)} kg</td><td data-l="Getirecek araç">${l.inbound_plate ? plate(l.inbound_plate, 'in') : dash}</td>
<td data-l="${arrived ? 'Geldi' : 'Beklenen'}">${when(l)}</td><td class="act">${act}<button type="button" class="ib sq" data-a="recv" data-id="${esc(l.id)}" title="Teslim al: sayım, fotoğraf, not, raf" aria-label="Teslim al: ${esc(l.sender)}">${ic('camera')}</button><button type="button" class="ib sq" data-a="label" data-id="${esc(l.id)}" title="Etiket yazdır" aria-label="Etiket yazdır: ${esc(l.sender)}">${ic('qr')}</button><button type="button" class="ib sq" data-a="edit" data-id="${esc(l.id)}" title="Düzenle" aria-label="Düzenle: ${esc(l.sender)}">${ic('edit')}</button>${canDel(l) ? `<button type="button" class="ib sq bad ${P.confirm === l.id ? 'ask' : ''}" data-a="del" data-id="${esc(l.id)}" title="Sil" aria-label="Sil: ${esc(l.sender)}">${ic('trash')}${P.confirm === l.id ? '<span>Evet, sil</span>' : ''}</button>` : ''}</td></tr>`;
  }
  function kpi5(S) {
    const arrToday = S.all.filter(l => l.arrived_at && new Date(l.arrived_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) === today()).length;
    const late = S.wait.filter(l => l.expected_date && l.expected_date < today()).length;
    const k = (icon, label, n, note, cls) => `<div class="k ${cls}"><i>${ic(icon)}</i><div><small>${label}</small><b>${n}</b><em>${note}</em></div></div>`;
    return `<div class="kp">${k('clock', 'Bekleyen', S.wait.length, 'Müşteri yazdı, depoya gelmedi', 'amb')}${k('check', 'Bugün gelen', arrToday, 'Bugün depoya alınan', 'grn')}${k('box', 'Depoda', S.idle.length, 'Depoda, araca atanmadı', 'blu')}${k('truck', 'Araçlar', S.trips.length, 'Müşterilerin hazırladığı', 'acc')}${k('bell', 'Geciken', late, 'Beklenen günü geçti', 'red')}</div>`;
  }
  function depotView() {
    const S = depotSets(), cu = id => (custOf(id) || {}).name || '?';
    const rowsOf = P.tab === 'depoda' ? S.idle : S.wait;
    const present = uniq(rowsOf.map(l => l.customer_id)).sort((a, b) => tr(cu(a)).localeCompare(tr(cu(b)), 'tr'));
    const cf = present.includes(P.cf) ? P.cf : '';
    const chips = P.tab === 'araclar' ? '' : `<div class="chips"><button type="button" class="${cf ? '' : 'on'}" data-a="chip" data-id="">Tüm firmalar</button>${present.map(id => `<button type="button" class="${cf === id ? 'on' : ''}" data-a="chip" data-id="${esc(id)}">${esc(cu(id))}</button>`).join('')}</div>`;
    const head = (all) => `<thead><tr><th class="ck">${all ? `<input type="checkbox" data-a="pickall" aria-label="Görünenlerin hepsini seç" ${allPicked() ? 'checked' : ''}>` : ''}</th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap · Kilo</th><th>Getirecek araç</th><th>${P.tab === 'depoda' ? 'Geldi' : 'Beklenen'}</th><th></th></tr></thead>`;
    let body;
    if (P.tab === 'araclar') {
      const ts = tripsShown(S);
      body = ts.length ? `<table class="tbl dt">${head(true)}<tbody>${ts.map(t => {
        const n = B.order(S.all.filter(l => l.trip_id === t.id));
        return `<tr class="g gt"><td colspan="7"><span class="gtl">${plate(t.tractor)}${plate(t.trailer, 'alt')}<b>${esc(t.poz_no)}</b> <span class="mut">· ${esc(cu(t.customer_id))} · ${esc(B.dmy(t.depart_date))}${locked(t) ? ' · yolda' : ''}</span> <span class="ch ${n.every(l => l.arrived_at) ? 'g' : 'a'}">${n.filter(l => l.arrived_at).length}/${n.length} yük geldi</span></span><span class="acts">${docButtons(t)}</span></td></tr>${n.map(l => depotRow(l, 'trip')).join('')}`;
      }).join('')}</tbody></table>` : '<div class="empty">Araca atanmış yük yok.</div>';
    } else {
      const rows = rowsOf.filter(l => (!cf || l.customer_id === cf) && hit(l)), by = {};
      rows.forEach(l => { (by[l.customer_id] = by[l.customer_id] || []).push(l); });
      const ids = Object.keys(by).sort((a, b) => tr(cu(a)).localeCompare(tr(cu(b)), 'tr'));
      body = ids.length ? `<table class="tbl dt">${head(true)}<tbody>${ids.map(id => `<tr class="g"><td colspan="7">${esc(cu(id))} <span class="mut">· ${by[id].length} yük · ${kg(sum(by[id], 'weight'))} kg</span></td></tr>${by[id].map(l => depotRow(l, 'list')).join('')}`).join('')}</tbody></table>` : `<div class="empty">${P.tab === 'depoda' ? 'Depoda araca atanmamış yük yok.' : 'Bekleyen yük yok.'}</div>`;
    }
    const tabs = [['bekliyor', 'Bekleyenler', S.wait.length], ['depoda', 'Depoda', S.idle.length], ['araclar', 'Araçlar', S.trips.length], ['program', 'Program', ''], ['okut', 'Okut', '']];
    const ext = P.tab === 'program' || P.tab === 'okut';
    const side = P.drawer ? drawerHtml() : (X.sideHtml ? X.sideHtml() : '');
    return `<header class="top"><div class="in"><div class="brand">${brandMark}<div><b>Depo ekranı</b><small>Nakliye portalı${P.name.trim() ? ` · ${esc(P.name.trim())}` : ''}</small></div></div><div class="who"><label class="nm ${P.name.trim() ? '' : 'need'}"><span>Adınız</span><input id="nm" data-i="name" value="${esc(P.name)}" maxlength="60" autocomplete="off" placeholder="İşlemler adınızla kaydedilir"></label>${liveHtml()}</div></div></header>
<main class="dwrap">${heading('Depo portalı', 'Depo ekranı', `<button type="button" class="btn" data-a="refresh">${ic('refresh')}Yenile</button><button type="button" class="btn" data-a="print">${ic('print')}Listeyi yazdır</button>`)}${ext ? '' : kpi5(S)}<div class="tools"><div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${P.tab === k}" class="${P.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}${n === '' ? '' : `<span>${n}</span>`}</button>`).join('')}</div>${ext ? '' : chips + searchBar('Plaka, firma, mal ara…')}</div>
${ext ? (X.views['d-' + P.tab] ? X.views['d-' + P.tab](S) : '') + (side ? `<div class="dmain with side-only">${side}</div>` : '') : `<div class="dmain ${side ? 'with' : ''}"><div class="card flush scroll">${body}</div>${side}</div>`}</main>${ext ? '' : bulkBar()}${dl('dl-plate', uniq(S.all.map(l => l.inbound_plate)))}`;
  }
  const tripsShown = S => S.trips.filter(t => !P.q || [t.poz_no, t.tractor, t.trailer, (custOf(t.customer_id) || {}).name].some(x => tr(x).includes(tr(P.q))));
  const visibleSel = () => {
    const S = depotSets();
    if (P.tab === 'araclar') { const ids = new Set(tripsShown(S).map(t => t.id)); return S.all.filter(l => ids.has(l.trip_id) && selectable(l)); }
    return (P.tab === 'depoda' ? S.idle : S.wait).filter(l => (!P.cf || l.customer_id === P.cf) && hit(l) && selectable(l));
  };
  const allPicked = () => { const v = visibleSel(); return v.length > 0 && v.every(l => P.sel.has(l.id)); };
  const selLoads = () => [...P.sel].map(id => (P.data.loads || []).find(l => l.id === id)).filter(Boolean);
  function bulkBar() {
    const sl = selLoads(); if (!sl.length) return '';
    const undo = P.tab === 'depoda';
    return `<div class="bulk" role="region" aria-label="Seçili yükler"><b>${sl.length} yük seçili</b><span class="bs">${sum(sl, 'pieces')} kap · ${kg(sum(sl, 'weight'))} kg</span><button type="button" class="btn go" data-a="bulk" ${P.busy === 'bulk' ? 'disabled' : ''}>${ic('check')}${P.busy === 'bulk' ? 'İşaretleniyor…' : undo ? 'Seçilileri geri al' : 'Seçilileri geldi işaretle'}</button><button type="button" class="btn lbl" data-a="labels" title="Seçili yüklerin QR etiketlerini yazdır">${ic('qr')}Etiket yazdır</button><button type="button" class="bx" data-a="clear" aria-label="Seçimi temizle">${ic('close')}</button></div>`;
  }
  const DRF = ['sender', 'consignee', 'pieces', 'weight', 'goods', 'inbound_plate', 'driver', 'dest_customs', 'expected_date', 'expected_time'];
  function openDrawer(l) { if (X.closeSide) X.closeSide(); P.drawer = l.id; P.confirm = ''; P.dr = Object.fromEntries(DRF.map(k => [k, l[k] == null ? '' : String(l[k])])); }
  function drawerHtml() {
    const l = (P.data.loads || []).find(x => x.id === P.drawer); if (!l) return '';
    const f = P.dr, fld = (k, lab, extra = '') => `<label class="fld"><span>${lab}</span><input id="dr-${k}" data-i="dr-${k}" value="${esc(f[k])}" maxlength="200" autocomplete="off" ${extra}></label>`;
    return `<aside class="drw" id="drw" aria-label="Yükü düzenle"><div class="dhd"><b>Yükü düzenle</b><button type="button" class="x" data-a="dclose" aria-label="Kapat">${ic('close')}</button></div>
<div class="dbody">${fld('sender', 'Gönderici')}${fld('consignee', 'Alıcı')}<div class="g2">${fld('pieces', 'Kap', 'inputmode="numeric"')}${fld('weight', 'Brüt kilo', 'inputmode="decimal"')}</div>${fld('goods', 'Mal cinsi')}
<label class="fld"><span>Getirecek kamyon plakası</span><input id="dr-inbound_plate" data-i="dr-inbound_plate" list="dl-plate" value="${esc(f.inbound_plate)}" maxlength="40" autocomplete="off" placeholder="Örn. 34 ABC 123" style="text-transform:uppercase"></label>
${fld('driver', 'Şoför adı ve telefonu')}
<div class="g2">${fld('dest_customs', 'Varış gümrük')}<label class="fld"><span>Beklenen tarih</span><input id="dr-expected_date" data-i="dr-expected_date" type="date" value="${esc(f.expected_date)}"></label></div>
<label class="fld"><span>Beklenen saat</span><input id="dr-expected_time" data-i="dr-expected_time" type="time" value="${esc(f.expected_time)}"></label><div id="derr" class="ferr" hidden role="alert"></div></div>
<div class="dft">${canDel(l) ? `<button type="button" class="btn danger" data-a="ddel" data-id="${esc(l.id)}">${ic('trash')}${P.confirm === 'dr' + l.id ? 'Emin misiniz? Evet, sil' : 'Sil'}</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-a="dclose">Vazgeç</button><button type="button" class="btn pri" data-a="dsave" ${P.busy === 'dsave' ? 'disabled' : ''}>${ic('check')}Kaydet</button></div></aside>`;
  }
  async function saveDrawer() {
    const l = (P.data.loads || []).find(x => x.id === P.drawer); if (!l || P.busy) return;
    const f = P.dr, err = m => { const e = document.getElementById('derr'); if (e) { e.textContent = m; e.hidden = false; } };
    if (!String(f.sender).trim() || !String(f.consignee).trim()) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(f.weight), pc = parseNum(f.pieces);
    if ([w, pc].some(Number.isNaN) || (w || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap tam sayı, kilo sayı olmalı (eksi olamaz).');
    const keep = {}; ['sender_addr', 'consignee_addr', 'notify', 'packing', 'volume', 'country', 'code', 'broker', 'note'].forEach(k => { keep[k] = l[k] == null ? (k === 'volume' ? null : '') : l[k]; });
    const row = { ...keep, id: l.id, sender: String(f.sender).trim(), consignee: String(f.consignee).trim(), pieces: pc || 0, weight: w || 0, goods: String(f.goods).trim(), inbound_plate: String(f.inbound_plate).trim().toUpperCase(),
      driver: String(f.driver).trim(), dest_customs: String(f.dest_customs).trim(), expected_date: f.expected_date || null, expected_time: f.expected_time || null };
    P.busy = 'dsave'; draw();
    const { error } = await client.rpc('shp_depot_save', { p_token: TOKEN, p_load: row, p_name: P.name.trim() });
    P.busy = '';
    if (error) { draw(); err(explain(error)); return; }
    P.drawer = ''; toast('Yük güncellendi'); await load0();
  }
  async function markOne(id, arrive) {
    return client.rpc('shp_depot_mark', { p_token: TOKEN, p_id: id, p_arrived: arrive, p_name: P.name.trim() });
  }
  async function bulk() {
    const ids = [...P.sel]; if (!ids.length || P.busy) return;
    const arrive = P.tab !== 'depoda';
    P.busy = 'bulk'; draw();
    let ok = 0, bad = 0, last = '';
    for (const id of ids) { const { error } = await markOne(id, arrive); if (error) { bad++; last = explain(error); } else ok++; }
    P.busy = ''; P.sel.clear();
    toast(bad ? `${ok} yük işaretlendi, ${bad} yük işaretlenemedi: ${last}` : arrive ? `${ok} yük geldi olarak işaretlendi` : `${ok} yükün işareti geri alındı`, !!bad);
    await load0();
  }

  // ------------------------------------------------------------------ çizim ve olaylar
  function draw() {
    if (P.needLogin) { redraw(loginView()); return; }
    if (P.err && !P.data) { root.innerHTML = `<main class="wrap"><section class="card note"><h1>Nakliye programı</h1><p>${esc(P.err)}</p><button type="button" class="btn pri" data-a="refresh">Tekrar dene</button></section></main>`; return; }
    if (!P.data) { root.innerHTML = '<main class="wrap"><section class="card note"><p>Yükleniyor…</p></section></main>'; return; }
    redraw((P.err ? `<div class="gerr">${esc(P.err)}</div>` : '') + (MODE === 'm' ? customerView() : depotView()));
  }
  function redraw(html) {
    const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd, y = window.scrollY;
    const dy = (document.getElementById('drw') || {}).scrollTop;
    root.innerHTML = html;
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (_) { /* tarih alanı */ } } }
    if (window.scrollY !== y) window.scrollTo(0, y);
    const dw = document.getElementById('drw'); if (dw && dy) dw.scrollTop = dy;
    X.onDraw.forEach(f => { try { f(); } catch (_) { /* ek ekran hatası ana ekranı bozmasın */ } });
  }

  async function assign() {
    if (P.busy) return;
    const ids = [...P.sel]; if (!ids.length) return;
    const isNew = P.target === 'new';
    if (!P.target) { toast('Hangi araca koyacağınızı seçin: bir araç kartına dokunun ya da "Yeni araç" yazın', true); return; }
    if (isNew && !P.nv.tractor.trim()) { toast('Çekici plakasını yazın', true); document.getElementById('nv-tractor')?.focus(); return; }
    P.busy = 'assign'; draw();
    const { data, error } = await client.rpc('shp_portal_assign', { p_token: TOKEN, p_load_ids: ids, p_trip: isNew ? null : P.target, p_tractor: isNew ? P.nv.tractor.trim() : '', p_trailer: isNew ? P.nv.trailer.trim() : '',
      p_depart: isNew ? (P.nv.date || today()) : null, p_subject: '' });
    P.busy = '';
    if (error) { if (authFail(error)) { draw(); return; } toast(explain(error), true); await load0(); return; }
    const t = data && data.trip;
    toast(t ? `${ids.length} yük ${t.poz_no} · ${B.plates(t)} aracına konuldu. Belgeleriniz hazır.` : 'Yükler araca konuldu');
    P.sel.clear(); P.nv = { tractor: '', trailer: '', date: '' };
    if (t) { P.target = t.id; P.docTrip = t.id; P.open.add(t.id); } else P.target = '';
    await load0();
  }
  async function quickAdd() {
    if (P.busy) return;
    const qa = P.qa, err = m => { const e = document.getElementById('qa-err'); if (e) { e.textContent = m; e.hidden = !m; } };
    if (!qa.sender.trim() || !qa.consignee.trim()) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(qa.weight), pc = parseNum(qa.pieces);
    if ([w, pc].some(Number.isNaN) || (w || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap tam sayı, kilo sayı olmalı (eksi olamaz).');
    const s = contactOf('sender', qa.sender), c = contactOf('consignee', qa.consignee);
    const row = { sender: qa.sender.trim(), sender_addr: s ? s.addr : '', consignee: qa.consignee.trim(), consignee_addr: c ? c.addr : '', notify: c ? c.notify : '', pieces: pc || 0, packing: 'KAP', goods: qa.goods.trim(), weight: w || 0,
      country: c ? c.country : '', code: c ? c.code : '', dest_customs: c ? c.dest_customs : '', broker: c ? c.broker : '', expected_date: null, inbound_plate: qa.plate.trim().toUpperCase(), note: '' };
    P.busy = 'quick'; err('');
    const btn = document.querySelector('form[data-f="quick"] button[type="submit"]'); if (btn) btn.disabled = true;
    const { error } = await client.rpc('shp_portal_save', { p_token: TOKEN, p_load: row });
    P.busy = '';
    if (error) { if (authFail(error)) { draw(); return; } if (btn) btn.disabled = false; err(explain(error)); return; }
    P.qa = { sender: '', consignee: '', goods: '', pieces: '', weight: '', plate: qa.plate };   // aynı kamyon birden çok yük getirir: plaka kalır
    P.scope = 'free';
    toast('Yük eklendi. Depo yük geldiğinde işaretleyecek.');
    await load0();
    document.getElementById('qa-sender')?.focus();
  }

  async function onClick(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, id = t.dataset.id;
    if (X.act[a]) { await X.act[a](t, e, id); return; }
    if (a === 'refresh') { P.err = ''; await load(); return; }
    if (a === 'page') { P.page = t.dataset.v; if (X.enter[P.page]) X.enter[P.page](); draw(); window.scrollTo(0, 0); return; }
    if (a === 'logout') { await doLogout(); return; }
    if (a === 'tab') { P.tab = t.dataset.v; P.confirm = ''; P.sel.clear(); P.drawer = ''; if (X.closeSide) X.closeSide(); if (X.enter['d-' + P.tab]) X.enter['d-' + P.tab](); draw(); return; }
    if (a === 'scope') { P.scope = t.dataset.v; draw(); return; }
    if (a === 'chip') { P.cf = id || ''; P.sel.clear(); draw(); return; }
    if (a === 'doc') { showDocs(id, [t.dataset.kind]); return; }
    if (a === 'docs-both') { showDocs(id, ['lade', 'cmr']); return; }
    if (a === 'doctrip') { P.docTrip = id; draw(); return; }
    if (a === 'print') { window.print(); return; }
    if (a === 'add-full') {
      const q = P.qa, w = parseNum(q.weight), pc = parseNum(q.pieces);
      openForm({ ...blank(), sender: q.sender, consignee: q.consignee, goods: q.goods, pieces: Number.isFinite(pc) && pc ? pc : '', weight: Number.isFinite(w) && w ? w : '', inbound_plate: q.plate.toUpperCase() });
      const f = document.querySelector('#m form'); if (f) { autofillForm(f, 'sender', q.sender); autofillForm(f, 'consignee', q.consignee); }
      return;
    }
    if (a === 'edit') { const l = P.data.loads.find(x => x.id === id); if (!l) return; if (MODE === 'd') { openDrawer(l); draw(); document.getElementById('dr-sender')?.focus(); } else openForm(l); return; }
    if (a === 'mclose') { closeForm(); return; }
    if (a === 'mdel') { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.lastChild.textContent = 'Emin misiniz? Evet, sil'; return; } await removeLoad(id); return; }
    if (a === 'del') { if (P.confirm !== id) { P.confirm = id; draw(); return; } P.confirm = ''; await removeLoad(id); return; }
    if (a === 'dclose') { P.drawer = ''; P.confirm = ''; draw(); return; }
    if (a === 'dsave') { await saveDrawer(); return; }
    if (a === 'ddel') { if (P.confirm !== 'dr' + id) { P.confirm = 'dr' + id; draw(); return; } await removeLoad(id); return; }
    if (a === 'pick') { P.sel.has(id) ? P.sel.delete(id) : P.sel.add(id); draw(); return; }
    if (a === 'pickall') { const v = visibleSel(); if (allPicked()) v.forEach(l => P.sel.delete(l.id)); else v.forEach(l => P.sel.add(l.id)); draw(); return; }
    if (a === 'clear') { P.sel.clear(); draw(); return; }
    if (a === 'bulk') { await bulk(); return; }
    if (a === 'target') { P.target = P.target === id && id !== 'new' ? '' : id; if (id !== 'new') P.docTrip = id; draw(); if (id === 'new') document.getElementById('nv-tractor')?.focus(); return; }
    if (a === 'toggle') { P.open.has(id) ? P.open.delete(id) : P.open.add(id); draw(); return; }
    if (a === 'usev') { const v = (P.data.vehicles || [])[Number(t.dataset.i)]; if (v) { P.nv.tractor = v.tractor; P.nv.trailer = v.trailer || ''; P.target = 'new'; draw(); } return; }
    if (a === 'assign') { await assign(); return; }
    if (a === 'unassign') {
      const { error } = await client.rpc('shp_portal_unassign', { p_token: TOKEN, p_load_id: id });
      if (error) { if (authFail(error)) { draw(); return; } toast(explain(error), true); } else toast('Yük araçtan çıkarıldı');
      await load0(); return;
    }
    if (a === 'trip-edit') { const tp = tripOf(id); if (tp) { P.editTrip = id; P.te = { tractor: tp.tractor || '', trailer: tp.trailer || '', date: tp.depart_date || '', subject: tp.subject || '' }; draw(); } return; }
    if (a === 'trip-cancel') { P.editTrip = ''; draw(); return; }
    if (a === 'trip-save') {
      const te = P.te;
      if (!te.tractor.trim()) { toast('Çekici plakasını yazın', true); return; }
      const { error } = await client.rpc('shp_portal_trip_update', { p_token: TOKEN, p_trip: id, p_tractor: te.tractor.trim(), p_trailer: te.trailer.trim(), p_depart: te.date || null, p_subject: te.subject.trim() });
      if (error) { if (authFail(error)) { draw(); return; } toast(explain(error), true); return; }
      toast('Araç bilgisi güncellendi'); P.editTrip = ''; await load0(); return;
    }
    if (a === 'arrive' || a === 'undo') {
      if (P.busy) return;
      P.busy = id; draw();
      const { error } = await markOne(id, a === 'arrive');
      P.busy = '';
      if (error) toast(explain(error), true); else toast(a === 'arrive' ? 'Yük geldi olarak işaretlendi' : 'İşaret geri alındı');
      await load0(); return;
    }
  }

  const NV = { 'nv-tractor': 'tractor', 'nv-trailer': 'trailer', 'nv-date': 'date' }, TE = { 'te-tractor': 'tractor', 'te-trailer': 'trailer', 'te-date': 'date', 'te-subject': 'subject' };
  const QA = { 'qa-sender': 'sender', 'qa-consignee': 'consignee', 'qa-goods': 'goods', 'qa-pieces': 'pieces', 'qa-weight': 'weight', 'qa-plate': 'plate' };
  function wire() {
    document.addEventListener('click', e => { onClick(e).catch(() => toast('İşlem yapılamadı', true)); });
    document.addEventListener('input', e => {
      const f = e.target.closest('form[data-f="load"]');
      if (f && (e.target.id === 'f-sender' || e.target.id === 'f-consignee') && (!e.inputType || e.inputType === 'insertReplacementText')) { autofillForm(f, e.target.id === 'f-sender' ? 'sender' : 'consignee', e.target.value); return; }
      const t = e.target.closest('[data-i]'); if (!t) return;
      const k = t.dataset.i;
      if (X.inp.some(f => f(t, k, e))) return;
      if (k === 'q') { P.q = t.value; draw(); }
      else if (k in QA) {
        P.qa[QA[k]] = t.value;
        const h = document.getElementById('qa-hint'); if (h) { const s = quickHint(); h.innerHTML = s; h.hidden = !s; }
      }
      else if (k in NV) { P.nv[NV[k]] = t.value; if (k !== 'nv-date' && P.target !== 'new') { P.target = 'new'; draw(); } }
      else if (k in TE) P.te[TE[k]] = t.value;
      else if (k.startsWith('dr-')) P.dr[k.slice(3)] = t.value;
      else if (k === 'lg-u') P.login.u = t.value;
      else if (k === 'lg-p') P.login.p = t.value;
      else if (k === 'name') { P.name = t.value; try { localStorage.setItem(NAME_KEY, P.name); } catch (_) { /* kaydedilemezse oturumda kalır */ } }
    });
    document.addEventListener('change', e => {   // kayıtlı firma seçilince boş alanlar dolar (tam form)
      const f = e.target.closest('form[data-f="load"]');
      if (f && (e.target.id === 'f-sender' || e.target.id === 'f-consignee')) autofillForm(f, e.target.id === 'f-sender' ? 'sender' : 'consignee', e.target.value);
    });
    document.addEventListener('submit', e => {
      const f = e.target.closest('form[data-f]'); if (!f) return;
      e.preventDefault();
      if (f.dataset.f === 'load') save(f).catch(() => toast('Kaydedilemedi', true));
      else if (f.dataset.f === 'quick') quickAdd().catch(() => toast('Kaydedilemedi', true));
      else if (f.dataset.f === 'login') doLogin().catch(() => toast('Giriş yapılamadı', true));
      else if (X.submit[f.dataset.f]) Promise.resolve(X.submit[f.dataset.f](f)).catch(() => toast('İşlem yapılamadı', true));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && (P.drawer || (X.sideHtml && X.sideHtml())) && !document.querySelector('dialog[open]')) { P.drawer = ''; if (X.closeSide) X.closeSide(); draw(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.vh[data-a]')) { e.preventDefault(); e.target.click(); return; }
      if (e.key === 'Enter' && MODE === 'd' && P.sel.size && !document.querySelector('dialog[open]') && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); bulk().catch(() => toast('İşlem yapılamadı', true)); }
    });
    // Basılı tuş varken ekran yeniden çizilmesin (tıklama kaçmasın)
    document.addEventListener('pointerdown', () => { P.down = Date.now(); }, true);
    document.addEventListener('pointerup', () => { P.down = 0; }, true);
    document.addEventListener('pointercancel', () => { P.down = 0; }, true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll().catch(() => {}); });
    setInterval(() => { poll().catch(() => {}); }, POLL_MS);
  }

  const rpc = async (name, params = {}) => {
    let r; try { r = await client.rpc(name, { p_token: TOKEN, ...params }); } catch (_) { r = { error: { message: 'Failed to fetch' } }; }
    if (r.error && authFail(r.error)) draw();
    return r;
  };
  const dialog = html => { const d = document.getElementById('m'); d.innerHTML = html; if (!d.open) d.showModal(); return d; };
  Object.assign(X, { P, MODE, client, B, esc, ic, tr, kg, ton, stamp, clock, sum, uniq, today, toast, plate, dash, parseNum, tripOf, custOf, locked, isFree, canEdit, canDel, hit, sortedTrips, draw, load, load0,
    explain, rpc, dialog, closeForm, openForm, docsOf, showDocs, contactOf, selLoads, depotSets, markOne, condChip, unread, dmy: B.dmy, pct, token: () => TOKEN, name: () => P.name.trim() });

  const start = () => { wire(); draw(); if (!P.needLogin) load(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
