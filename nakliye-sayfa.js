/* Nakliye programı: müşteri sayfası (nakliye.html?m=ANAHTAR) ve depo sayfası (nakliye.html?d=ANAHTAR).
 * Giriş şifresi yoktur; link anahtarı sunucuda doğrulanır (supabase/nakliye-kurulumu.sql).
 *   Müşteri: yalnızca kendi yüklerini yazar, düzenler, siler (depoya gelene kadar) ve kendi seferlerinin belgelerini alır.
 *   Depo:    gelen yükü "Geldi" diye işaretler (geri alabilir) ve plaka bazında seferleri ve belgeleri görür. */
(() => {
  'use strict';
  const B = window.PCSNKB;
  const Q = new URLSearchParams(location.search);
  const MT = (Q.get('m') || '').trim(), DT = (Q.get('d') || '').trim();
  const MODE = MT ? 'm' : DT ? 'd' : '';
  const TOKEN = MT || DT;
  const esc = B.esc;
  const root = document.getElementById('p');
  const client = window.createPCSClient('https://ollrccfqiqilbflanuik.supabase.co', 'sb_publishable_BV4TQSJ5lCNyTdRZV-Ouvg_bDOzBNQk');
  const NAME_KEY = 'pcs-nakliye-depo-ad';
  const P = { data: null, err: '', loading: false, tab: 'bekliyor', q: '', form: null, confirm: '', name: '', busy: '',
    sel: new Set(), target: '', nv: { tractor: '', trailer: '', date: '', subject: '' }, editTrip: '', te: { tractor: '', trailer: '', date: '', subject: '' } };
  try { P.name = localStorage.getItem(NAME_KEY) || ''; } catch (_) { /* kayıt yoksa boş kalır */ }

  const tr = s => String(s || '').toLocaleUpperCase('tr-TR');
  const kg = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const stamp = iso => { try { return iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; } catch (_) { return ''; } };
  const sum = (a, k) => a.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const tripOf = id => (P.data.trips || []).find(t => t.id === id);
  const custOf = id => MODE === 'm' ? P.data.customer : (P.data.customers || []).find(c => c.id === id);
  const toast = (t, bad) => { const el = document.getElementById('toast'); clearTimeout(toast.t); el.textContent = t; el.className = 'show' + (bad ? ' error' : ''); toast.t = setTimeout(() => { el.className = ''; }, bad ? 7000 : 3200); };
  const parseNum = v => { let s = String(v ?? '').replace(/\s/g, ''); if (!s) return null; if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',')) s = s.replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };

  // ------------------------------------------------------------------ veri
  function explain(e) {
    const m = `${e && e.code} ${e && e.message}`;
    if (/PGRST202|42883|schema cache|Could not find the function/.test(m)) return 'Nakliye programı henüz kurulmamış. Size bağlantıyı gönderen kişiyle görüşün.';
    if (/42501|geçersiz|kapatılmış/i.test(m)) return 'Bu bağlantı geçersiz ya da kapatılmış. Size bağlantıyı gönderen kişiden yenisini isteyin.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
    return (e && e.message) || 'İşlem yapılamadı';
  }
  async function load(quiet) {
    if (P.loading || !MODE) return;
    P.loading = true;
    if (!quiet) draw();
    let r;
    try { r = await client.rpc(MODE === 'm' ? 'shp_portal' : 'shp_depot', { p_token: TOKEN }); } catch (_) { r = { error: { message: 'Failed to fetch' } }; }
    P.loading = false;
    if (r.error) { if (!quiet || !P.data) P.err = explain(r.error); else toast(explain(r.error), true); }
    else {
      P.data = r.data; P.err = '';
      for (const id of [...P.sel]) { const l = (P.data.loads || []).find(x => x.id === id); if (!l || (l.status !== 'bekliyor' && l.status !== 'depoda')) P.sel.delete(id); }
    }
    draw();
  }

  // ------------------------------------------------------------------ ortak parçalar
  const chip = l => l.status === 'aracta' ? `<span class="ch b">Araçta</span> ${l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>'}` : l.status === 'depoda' ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Bekliyor</span>';
  const locked = t => t.status !== 'hazirlaniyor';
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  function docButtons(trip) {
    return `<button type="button" class="btn sm" data-a="doc" data-kind="lade" data-id="${esc(trip.id)}">Lade Liste</button> <button type="button" class="btn sm" data-a="doc" data-kind="cmr" data-id="${esc(trip.id)}">CMR</button>`;
  }
  function showDocs(tripId, kind) {
    const trip = tripOf(tripId); if (!trip) return;
    const loads = P.data.loads.filter(l => l.trip_id === tripId);
    const customer = custOf(trip.customer_id) || { name: '', carrier: '', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '' };
    B.show([{ label: kind === 'lade' ? 'Lade Liste' : 'CMR', html: kind === 'lade' ? B.lade({ trip, customer, loads }) : B.cmr({ trip, customer, loads }) }], { title: `${trip.poz_no} · ${B.plates(trip)}` });
  }
  const loadLine = l => `<b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small>`;
  const meta = l => [l.goods, `${l.pieces} ${l.packing}`, `${kg(l.weight)} kg`, l.dest_customs].filter(Boolean).map(esc).join(' · ');
  const searchBar = ph => `<label class="srch"><input id="q" data-i="q" type="search" value="${esc(P.q)}" placeholder="${ph}" autocomplete="off" aria-label="Ara"></label>`;
  const hit = l => !P.q || [l.sender, l.consignee, l.goods, l.dest_customs, (tripOf(l.trip_id) || {}).poz_no, B.plates(tripOf(l.trip_id))].some(x => tr(x).includes(tr(P.q)));

  // ------------------------------------------------------------------ müşteri sayfası
  const F = [  // [alan, etiket, tür, ayrıntı mı]
    ['sender', 'Gönderici', 'text', 0], ['consignee', 'Alıcı', 'text', 0], ['pieces', 'Kap adedi', 'num', 0], ['packing', 'Ambalaj', 'text', 0],
    ['goods', 'Mal cinsi', 'text', 0], ['weight', 'Brüt kilo (kg)', 'num', 0], ['dest_customs', 'Varış gümrük', 'text', 0], ['country', 'Ülke', 'text', 0],
    ['expected_date', 'Beklenen tarih', 'date', 0],
    ['sender_addr', 'Gönderici adresi', 'area', 1], ['consignee_addr', 'Alıcı adresi', 'area', 1], ['notify', 'Notify (bildirim adresi)', 'area', 1],
    ['volume', 'Hacim (m³)', 'num', 1], ['code', 'Gümrük kodu', 'text', 1], ['broker', 'Gümrükçü', 'text', 1], ['note', 'Not', 'text', 1]
  ];
  const blank = () => ({ id: '', sender: '', consignee: '', pieces: '', packing: 'KAP', goods: '', weight: '', dest_customs: '', country: '', expected_date: '', sender_addr: '', consignee_addr: '', notify: '', volume: '', code: '', broker: '', note: '' });
  const inp = (k, lab, kind, v) => {
    const req = k === 'sender' || k === 'consignee';
    const t = kind === 'area' ? `<textarea id="f-${k}" name="${k}" rows="2" maxlength="300">${esc(v)}</textarea>` :
      `<input id="f-${k}" name="${k}" type="${kind === 'date' ? 'date' : 'text'}" ${kind === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v)}" maxlength="${k === 'note' ? 500 : 200}" ${req ? 'required' : ''} autocomplete="off">`;
    return `<label class="fld ${kind === 'area' ? 'wide' : ''}"><span>${lab}</span>${t}</label>`;
  };
  function formCard() {
    const f = P.form || blank(), edit = !!f.id;
    return `<section class="card" id="form-card"><h2>${edit ? 'Yükü düzenle' : 'Yeni yük yaz'}</h2><form data-f="load" autocomplete="off"><input type="hidden" name="id" value="${esc(f.id)}">
<div class="grid">${F.filter(x => !x[3]).map(x => inp(x[0], x[1], x[2], f[x[0]] ?? '')).join('')}</div>
<details ${edit && F.filter(x => x[3]).some(x => f[x[0]]) ? 'open' : ''}><summary>Daha fazla alan (adresler, hacim, kod, gümrükçü, not)</summary><div class="grid">${F.filter(x => x[3]).map(x => inp(x[0], x[1], x[2], f[x[0]] ?? '')).join('')}</div></details>
<div id="ferr" class="ferr" hidden></div>
<div class="acts"><button type="submit" class="btn pri" ${P.busy ? 'disabled' : ''}>${edit ? 'Değişikliği kaydet' : 'Yükü ekle'}</button>${edit ? '<button type="button" class="btn" data-a="cancel">Vazgeç</button>' : ''}</div></form></section>`;
  }
  function customerView() {
    const d = P.data, c = d.customer, all = d.loads;
    const cnt = s => all.filter(l => l.status === s).length;
    const tabs = [['bekliyor', 'Bekleyen', cnt('bekliyor')], ['depoda', 'Depoda', cnt('depoda')], ['aracta', 'Araçta', cnt('aracta')], ['hepsi', 'Tümü', all.length]];
    const rows = all.filter(l => (P.tab === 'hepsi' || l.status === P.tab) && hit(l));
    const free = l => l.status === 'bekliyor' || l.status === 'depoda';
    const list = rows.length ? `<div class="rows">${rows.map(l => { const t = tripOf(l.trip_id); return `<article class="row ${P.sel.has(l.id) ? 'sel' : ''}">
${free(l) ? `<label class="pk"><input type="checkbox" data-a="pick" data-id="${esc(l.id)}" ${P.sel.has(l.id) ? 'checked' : ''} aria-label="Yükü araca koymak için seç: ${esc(l.sender)}"></label>` : ''}
<div class="main">${loadLine(l)}<div class="meta">${meta(l)}${l.expected_date ? ` · beklenen ${esc(B.dmy(l.expected_date))}` : ''}</div></div>
<div class="side">${chip(l)}${t ? `<small>${esc(t.poz_no)} · ${esc(B.plates(t))}</small>` : l.arrived_at ? `<small>${esc(stamp(l.arrived_at))}</small>` : ''}
<div class="acts">${l.status === 'bekliyor' ? `<button type="button" class="lnk" data-a="edit" data-id="${esc(l.id)}">Düzenle</button><button type="button" class="lnk bad" data-a="del" data-id="${esc(l.id)}">${P.confirm === l.id ? 'Evet, sil' : 'Sil'}</button>` : ''}${l.status === 'aracta' && t && !locked(t) ? `<button type="button" class="lnk" data-a="unassign" data-id="${esc(l.id)}">Araçtan çıkar</button>` : ''}</div></div></article>`; }).join('')}</div>` : '<div class="empty">Bu bölümde yük yok.</div>';
    // seçili yükleri araca koyma çubuğu
    const sl = [...P.sel].map(id => all.find(l => l.id === id)).filter(Boolean);
    const open = (d.trips || []).filter(t => !locked(t));
    const nv = P.nv;
    const bar = sl.length ? `<div class="sbar" id="sbar"><div class="sb-t"><b>${sl.length} yük seçili</b> · ${kg(sum(sl, 'weight'))} kg</div>
<label class="fld"><span>Hangi araca?</span><select id="tg" data-i="target"><option value="">Araç seçin…</option>${open.map(t => `<option value="${esc(t.id)}" ${P.target === t.id ? 'selected' : ''}>${esc(t.poz_no)} · ${esc(B.plates(t))}</option>`).join('')}<option value="new" ${P.target === 'new' ? 'selected' : ''}>+ Yeni araç</option></select></label>
${P.target === 'new' ? `<div class="grid sb-g"><label class="fld"><span>Çekici plaka</span><input id="nv-tractor" data-i="nv-tractor" value="${esc(nv.tractor)}" maxlength="30" placeholder="Örn. 34 ABC 123" autocomplete="off"></label><label class="fld"><span>Dorse plaka</span><input id="nv-trailer" data-i="nv-trailer" value="${esc(nv.trailer)}" maxlength="30" placeholder="Örn. 34 DEF 456" autocomplete="off"></label><label class="fld"><span>Çıkış tarihi</span><input id="nv-date" data-i="nv-date" type="date" value="${esc(nv.date || today())}"></label></div>` : ''}
<div class="acts"><button type="button" class="btn pri" data-a="assign" ${P.busy === 'assign' ? 'disabled' : ''}>${P.busy === 'assign' ? 'Koyuluyor…' : 'Araca koy'}</button><button type="button" class="lnk" data-a="clear">Seçimi bırak</button></div></div>` : '';
    const trips = (d.trips || []).map(t => {
      const n = all.filter(l => l.trip_id === t.id), lk = locked(t), editing = P.editTrip === t.id, te = P.te;
      const gel = n.filter(l => !l.arrived_at).length;
      const head = editing ? `<div class="grid"><label class="fld"><span>Çekici plaka</span><input id="te-tractor" data-i="te-tractor" value="${esc(te.tractor)}" maxlength="30" autocomplete="off"></label><label class="fld"><span>Dorse plaka</span><input id="te-trailer" data-i="te-trailer" value="${esc(te.trailer)}" maxlength="30" autocomplete="off"></label><label class="fld"><span>Çıkış tarihi</span><input id="te-date" data-i="te-date" type="date" value="${esc(te.date)}"></label><label class="fld"><span>Konu (isteğe bağlı)</span><input id="te-subject" data-i="te-subject" value="${esc(te.subject)}" maxlength="200" autocomplete="off"></label></div><div class="acts"><button type="button" class="btn pri sm" data-a="trip-save" data-id="${esc(t.id)}">Kaydet</button><button type="button" class="btn sm" data-a="trip-cancel">Vazgeç</button></div>`
        : `<div class="th"><div><b>${esc(t.poz_no)}</b> <span class="pl">${esc(t.tractor)}</span>${t.trailer ? `<span class="pl alt">${esc(t.trailer)}</span>` : ''}<div class="meta">${esc(B.dmy(t.depart_date))} · ${n.length} yük · ${kg(sum(n, 'weight'))} kg${gel ? ` · ${gel} yük depoya gelmedi` : ''}${lk ? ' · <b>yola çıktı, kilitli</b>' : ''}</div></div><div class="acts">${docButtons(t)}${lk ? '' : ` <button type="button" class="btn sm" data-a="trip-edit" data-id="${esc(t.id)}">Plakayı değiştir</button>`}</div></div>`;
      return `<article class="tc">${head}<div class="rows">${B.order(n).map(l => `<div class="row sm"><div class="main">${loadLine(l)}<div class="meta">${meta(l)}</div></div><div class="side">${l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>'}${lk ? '' : `<div class="acts"><button type="button" class="lnk" data-a="unassign" data-id="${esc(l.id)}">Araçtan çıkar</button></div>`}</div></div>`).join('')}</div></article>`;
    }).join('');
    return `<header class="top">${c.logo ? `<img class="lg" src="${esc(c.logo)}" alt="">` : ''}<div><h1>${esc(c.name)}</h1><p>Nakliye programı · yüklerinizi yazın, hangi araca ne yükleneceğini ayarlayın</p></div><button type="button" class="btn" data-a="refresh">Yenile</button></header>
<div class="sum"><div><b>${cnt('bekliyor')}</b><span>Bekleyen</span></div><div><b>${cnt('depoda')}</b><span>Depoda</span></div><div><b>${cnt('aracta')}</b><span>Araçta</span></div></div>
${formCard()}
<section class="card"><div class="bar"><h2>Yüklerim</h2>${searchBar('Ara: gönderici, alıcı, mal…')}</div><p class="hint">Bir araca koymak için yükleri işaretleyin (depoya henüz gelmemiş yük de olur). Depodaki arkadaşlar yük gelince işaretler.</p><div class="tabs" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${P.tab === k}" class="${P.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>${list}</section>
${trips ? `<section class="card"><h2>Araçlarım</h2><p class="hint">Hangi araçta hangi yük var. Lade Liste ve CMR belgelerini buradan alabilirsiniz. Araç yola çıkınca ofis kilitler; sonrasında değişiklik için ofisle görüşün.</p>${trips}</section>` : ''}
${bar}`;
  }

  // ------------------------------------------------------------------ depo sayfası
  function depotView() {
    const d = P.data, all = d.loads;
    const cu = id => (custOf(id) || {}).name || '?';
    const wait = all.filter(l => !l.arrived_at && (l.status === 'bekliyor' || l.status === 'aracta')), idle = all.filter(l => l.status === 'depoda');
    const trips = (d.trips || []).filter(t => all.some(l => l.trip_id === t.id));
    const tabs = [['bekliyor', 'Bekleyenler', wait.length], ['depoda', 'Depoda', idle.length], ['araclar', 'Araçlar', trips.length]];
    const goBtn = l => `<button type="button" class="btn go" data-a="arrive" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>Geldi</button>`;
    const undoBtn = l => `<button type="button" class="btn undo" data-a="undo" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>Geri al</button>`;
    const group = (rows, btn) => {
      const by = {}; rows.filter(hit).forEach(l => { (by[l.customer_id] = by[l.customer_id] || []).push(l); });
      const ids = Object.keys(by).sort((a, b) => tr(cu(a)).localeCompare(tr(cu(b)), 'tr'));
      return ids.length ? ids.map(id => `<section class="card"><h2>${esc(cu(id))} <span class="cnt">${by[id].length}</span></h2><div class="rows">${by[id].map(l => { const t = tripOf(l.trip_id); return `<article class="row big"><div class="main">${loadLine(l)}<div class="meta">${meta(l)}</div>${t ? `<div class="meta">Araç: <span class="pl">${esc(t.tractor)}</span> ${esc(t.poz_no)}</div>` : ''}${l.expected_date && !l.arrived_at ? `<div class="meta">Beklenen: ${esc(B.dmy(l.expected_date))}</div>` : ''}${l.arrived_at ? `<div class="meta">Geldi: ${esc(stamp(l.arrived_at))}${l.arrived_by ? ` · ${esc(l.arrived_by)}` : ''}</div>` : ''}</div><div class="side">${btn(l)}</div></article>`; }).join('')}</div></section>`).join('') : '<div class="empty">Burada yük yok.</div>';
    };
    let body;
    if (P.tab === 'bekliyor') body = group(wait, goBtn);
    else if (P.tab === 'depoda') body = group(idle, undoBtn);
    else body = trips.length ? trips.filter(t => !P.q || [t.poz_no, t.tractor, t.trailer, cu(t.customer_id)].some(x => tr(x).includes(tr(P.q)))).map(t => {
      const n = all.filter(l => l.trip_id === t.id);
      return `<section class="card"><div class="bar"><h2><span class="pl">${esc(t.tractor)}</span>${t.trailer ? `<span class="pl alt">${esc(t.trailer)}</span>` : ''} <small>${esc(t.poz_no)} · ${esc(cu(t.customer_id))} · ${esc(B.dmy(t.depart_date))}</small></h2><div>${docButtons(t)}</div></div><div class="rows">${B.order(n).map(l => `<article class="row big"><div class="main">${loadLine(l)}<div class="meta">${meta(l)}</div>${l.arrived_at ? `<div class="meta">Geldi: ${esc(stamp(l.arrived_at))}${l.arrived_by ? ` · ${esc(l.arrived_by)}` : ''}</div>` : ''}</div><div class="side">${l.arrived_at ? undoBtn(l) : goBtn(l)}</div></article>`).join('')}</div></section>`;
    }).join('') : '<div class="empty">Araca atanmış yük yok.</div>';
    return `<header class="top"><div><h1>Depo · Nakliye</h1><p>Yük gelince <b>Geldi</b>'ye basın. Yanlışlıkla basarsanız <b>Geri al</b> deyin.</p></div><button type="button" class="btn" data-a="refresh">Yenile</button></header>
<section class="card"><label class="fld"><span>Adınız <small>(işaretlemeyi kimin yaptığı görünsün)</small></span><input id="nm" data-i="name" value="${esc(P.name)}" maxlength="60" autocomplete="off" placeholder="Örn. Ahmet"></label></section>
<div class="tabs big" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${P.tab === k}" class="${P.tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>
<div class="bar solo">${searchBar('Ara: gönderici, alıcı, mal, plaka…')}</div>${body}`;
  }

  // ------------------------------------------------------------------ çizim ve olaylar
  function draw() {
    if (!MODE) { root.innerHTML = '<main class="wrap"><section class="card note"><h1>Nakliye programı</h1><p>Bu sayfa size gönderilen özel bağlantıyla açılır. Bağlantıyı gönderen kişiyle görüşün.</p></section></main>'; return; }
    if (P.err && !P.data) { root.innerHTML = `<main class="wrap"><section class="card note"><h1>Nakliye programı</h1><p>${esc(P.err)}</p><button type="button" class="btn pri" data-a="refresh">Tekrar dene</button></section></main>`; return; }
    if (!P.data) { root.innerHTML = '<main class="wrap"><section class="card note"><p>Yükleniyor…</p></section></main>'; return; }
    const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd, y = window.scrollY;
    // form açıkken yeniden çizim yazılanları silmesin: değerleri önce toplar
    const fm = document.querySelector('form[data-f="load"]');
    if (fm && MODE === 'm' && !P.noCap) { const fd = new FormData(fm), cur = {}; for (const [k, v] of fd.entries()) cur[k] = v; P.form = { ...(P.form || blank()), ...cur }; }
    P.noCap = false;
    root.innerHTML = `<main class="wrap">${P.err ? `<div class="ferr">${esc(P.err)}</div>` : ''}${MODE === 'm' ? customerView() : depotView()}</main>`;
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (_) { /* tarih alanı */ } } }
    if (window.scrollY !== y) window.scrollTo(0, y);
  }

  async function save(form) {
    const fd = new FormData(form), err = m => { const e = document.getElementById('ferr'); if (e) { e.textContent = m; e.hidden = false; } };
    const g = k => String(fd.get(k) || '').trim();
    if (!g('sender') || !g('consignee')) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(fd.get('weight')), v = parseNum(fd.get('volume')), pc = parseNum(fd.get('pieces'));
    if ([w, v, pc].some(Number.isNaN)) return err('Kap, kilo ve hacim sayı olarak yazılmalı.');
    if ((w || 0) < 0 || (v || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap, kilo ve hacim eksi olamaz; kap tam sayı olmalı.');
    const row = { id: g('id') || undefined, sender: g('sender'), consignee: g('consignee'), pieces: pc || 0, packing: g('packing') || 'KAP', goods: g('goods'), weight: w || 0, volume: v == null ? null : v,
      dest_customs: g('dest_customs'), country: g('country'), expected_date: g('expected_date') || null, sender_addr: g('sender_addr'), consignee_addr: g('consignee_addr'), notify: g('notify'), code: g('code'), broker: g('broker'), note: g('note') };
    P.busy = 'save'; draw();
    const { error } = await client.rpc('shp_portal_save', { p_token: TOKEN, p_load: row });
    P.busy = '';
    if (error) { draw(); err(explain(error)); return; }
    toast(row.id ? 'Yük güncellendi' : 'Yük eklendi. Depo yük geldiğinde işaretleyecek.');
    setForm(null); P.tab = 'bekliyor';
    await load0();
  }
  const load0 = () => load(true);
  // Seçili yükleri araca koyar (yeni araç ya da kendi mevcut aracı); atama kesindir, Poz No yeni araçta otomatik verilir
  async function assign() {
    if (P.busy) return;
    const ids = [...P.sel];
    if (!ids.length) return;
    const isNew = P.target === 'new';
    if (!P.target) { toast('Hangi araca koyacağınızı seçin', true); document.getElementById('tg')?.focus(); return; }
    if (isNew && !P.nv.tractor.trim()) { toast('Çekici plakasını yazın', true); document.getElementById('nv-tractor')?.focus(); return; }
    P.busy = 'assign'; draw();
    const { data, error } = await client.rpc('shp_portal_assign', { p_token: TOKEN, p_load_ids: ids, p_trip: isNew ? null : P.target, p_tractor: isNew ? P.nv.tractor.trim() : '', p_trailer: isNew ? P.nv.trailer.trim() : '',
      p_depart: isNew ? (P.nv.date || today()) : null, p_subject: '' });
    P.busy = '';
    if (error) { toast(explain(error), true); await load0(); return; }
    const t = data && data.trip;
    toast(t ? `${ids.length} yük ${t.poz_no} · ${B.plates(t)} aracına konuldu` : 'Yükler araca konuldu');
    P.sel.clear(); P.target = ''; P.nv = { tractor: '', trailer: '', date: '', subject: '' };
    P.tab = 'aracta';
    await load0();
  }
  const setForm = v => { P.form = v; P.noCap = true; };   // ekrandaki form değerleri bir sonraki çizimde bunun üzerine yazılmasın

  async function onClick(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, id = t.dataset.id;
    if (a === 'refresh') { P.err = ''; await load(); return; }
    if (a === 'tab') { P.tab = t.dataset.v; P.confirm = ''; draw(); return; }
    if (a === 'doc') { showDocs(id, t.dataset.kind); return; }
    if (a === 'edit') { const l = P.data.loads.find(x => x.id === id); if (l) { setForm({ ...blank(), ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v == null ? '' : v])) }); draw(); document.getElementById('form-card')?.scrollIntoView({ block: 'start' }); } return; }
    if (a === 'cancel') { setForm(null); draw(); return; }
    if (a === 'pick') { P.sel.has(id) ? P.sel.delete(id) : P.sel.add(id); draw(); return; }
    if (a === 'clear') { P.sel.clear(); draw(); return; }
    if (a === 'assign') { await assign(); return; }
    if (a === 'unassign') {
      const { error } = await client.rpc('shp_portal_unassign', { p_token: TOKEN, p_load_id: id });
      if (error) toast(explain(error), true); else toast('Yük araçtan çıkarıldı');
      await load0(); return;
    }
    if (a === 'trip-edit') { const tp = tripOf(id); if (tp) { P.editTrip = id; P.te = { tractor: tp.tractor || '', trailer: tp.trailer || '', date: tp.depart_date || '', subject: tp.subject || '' }; draw(); } return; }
    if (a === 'trip-cancel') { P.editTrip = ''; draw(); return; }
    if (a === 'trip-save') {
      const te = P.te;
      if (!te.tractor.trim()) { toast('Çekici plakasını yazın', true); return; }
      const { error } = await client.rpc('shp_portal_trip_update', { p_token: TOKEN, p_trip: id, p_tractor: te.tractor.trim(), p_trailer: te.trailer.trim(), p_depart: te.date || null, p_subject: te.subject.trim() });
      if (error) { toast(explain(error), true); return; }
      toast('Araç bilgisi güncellendi'); P.editTrip = ''; await load0(); return;
    }
    if (a === 'del') {
      if (P.confirm !== id) { P.confirm = id; draw(); return; }
      P.confirm = '';
      const { error } = await client.rpc('shp_portal_delete', { p_token: TOKEN, p_id: id });
      if (error) toast(explain(error), true); else toast('Yük silindi');
      await load0(); return;
    }
    if (a === 'arrive' || a === 'undo') {
      if (P.busy) return;
      P.busy = id; draw();
      const { error } = await client.rpc('shp_depot_mark', { p_token: TOKEN, p_id: id, p_arrived: a === 'arrive', p_name: P.name.trim() });
      P.busy = '';
      if (error) toast(explain(error), true); else toast(a === 'arrive' ? 'Yük geldi olarak işaretlendi' : 'İşaret geri alındı');
      await load0(); return;
    }
  }

  function wire() {
    document.addEventListener('click', e => { onClick(e).catch(() => toast('İşlem yapılamadı', true)); });
    document.addEventListener('input', e => {
      const t = e.target.closest('[data-i]'); if (!t) return;
      const k = t.dataset.i;
      if (k === 'q') { P.q = t.value; draw(); }
      else if (k === 'target') { P.target = t.value; draw(); }
      else if (k.startsWith('nv-')) P.nv[{ 'nv-tractor': 'tractor', 'nv-trailer': 'trailer', 'nv-date': 'date' }[k]] = t.value;
      else if (k.startsWith('te-')) P.te[{ 'te-tractor': 'tractor', 'te-trailer': 'trailer', 'te-date': 'date', 'te-subject': 'subject' }[k]] = t.value;
      else if (k === 'name') { P.name = t.value; try { localStorage.setItem(NAME_KEY, P.name); } catch (_) { /* kaydedilemezse oturumda kalır */ } }
    });
    document.addEventListener('submit', e => { const f = e.target.closest('form[data-f="load"]'); if (f) { e.preventDefault(); save(f).catch(() => toast('Kaydedilemedi', true)); } });
    // Açık ekran kendiliğinden tazelenir (depodaki ekran yeni yükleri görsün); yazarken ya da pencere açıkken dokunmaz
    setInterval(() => {
      if (document.visibilityState === 'hidden' || document.querySelector('dialog[open]')) return;
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'q') return;
      load(true);
    }, 30000);
  }

  wire();
  draw();
  if (MODE) load();
})();
