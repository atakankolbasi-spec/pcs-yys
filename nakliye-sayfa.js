/* Nakliye programı: müşteri sayfası (nakliye.html?m=ANAHTAR) ve depo sayfası (nakliye.html?d=ANAHTAR).
 * Giriş şifresi yoktur; link anahtarı sunucuda doğrulanır (supabase/nakliye-kurulumu.sql).
 *   Müşteri: kendi yüklerini yazar, düzenler, siler; hangi araca ne yükleneceğini ayarlar; seferlerinin belgelerini alır.
 *   Depo:    gelen yükü "Geldi" diye işaretler (geri alabilir), yük bilgisini düzeltir / siler, plaka bazında seferleri ve belgeleri görür. */
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
  const P = { data: null, err: '', loading: false, at: '', view: 'loads', tab: MODE === 'm' ? 'hepsi' : 'bekliyor', q: '', confirm: '', name: '', busy: '',
    sel: new Set(), target: '', nv: { tractor: '', trailer: '', date: '' }, editTrip: '', te: { tractor: '', trailer: '', date: '', subject: '' } };
  try { P.name = localStorage.getItem(NAME_KEY) || ''; } catch (_) { /* kayıt yoksa boş kalır */ }

  // ------------------------------------------------------------------ küçük yardımcılar
  const I = {
    plus: '<path d="M12 5v14M5 12h14"/>', refresh: '<path d="M4 12a8 8 0 0114-5.3M20 4v4h-4M20 12a8 8 0 01-14 5.3M4 20v-4h4"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16v4zM13.5 6.5l4 4"/>', trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', truck: '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h9a6 6 0 010 12"/>', doc: '<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', close: '<path d="M6 6l12 12M6 18L18 6"/>',
    scale: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-3 7a3 3 0 006 0zM19 8l-3 7a3 3 0 006 0z"/>'
  };
  const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
  const tr = s => String(s || '').toLocaleUpperCase('tr-TR');
  const kg = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const stamp = iso => { try { return iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; } catch (_) { return ''; } };
  const sum = (a, k) => a.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const tripOf = id => (P.data.trips || []).find(t => t.id === id);
  const custOf = id => MODE === 'm' ? P.data.customer : (P.data.customers || []).find(c => c.id === id);
  const locked = t => t.status !== 'hazirlaniyor';
  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const toast = (t, bad) => { const el = document.getElementById('toast'); clearTimeout(toast.t); el.textContent = t; el.className = 'show' + (bad ? ' error' : ''); toast.t = setTimeout(() => { el.className = ''; }, bad ? 7000 : 3200); };
  const parseNum = v => { let s = String(v ?? '').replace(/\s/g, ''); if (!s) return null; if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',')) s = s.replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const plate = (p, cls = '') => p ? `<span class="pl ${cls}">${esc(p)}</span>` : '';

  // ------------------------------------------------------------------ veri
  function explain(e) {
    const m = `${e && e.code} ${e && e.message}`;
    if (/PGRST202|42883|schema cache|Could not find the function/.test(m)) return 'Nakliye programı henüz kurulmamış ya da güncellenmemiş. Size bağlantıyı gönderen kişiyle görüşün.';
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
      P.data = r.data; P.err = ''; P.at = new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
      for (const id of [...P.sel]) { const l = (P.data.loads || []).find(x => x.id === id); if (!l || (l.status !== 'bekliyor' && l.status !== 'depoda')) P.sel.delete(id); }
    }
    draw();
  }
  const load0 = () => load(true);

  // ------------------------------------------------------------------ ortak parçalar
  const chip = l => l.status === 'aracta' ? `<span class="ch b">Araçta</span> ${l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>'}` : l.status === 'depoda' ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Bekliyor</span>';
  function docButtons(trip) {
    return `<button type="button" class="btn sm" data-a="doc" data-kind="lade" data-id="${esc(trip.id)}">${ic('doc')}Lade Liste</button><button type="button" class="btn sm" data-a="doc" data-kind="cmr" data-id="${esc(trip.id)}">${ic('doc')}CMR</button>`;
  }
  function showDocs(tripId, kind) {
    const trip = tripOf(tripId); if (!trip) return;
    const loads = P.data.loads.filter(l => l.trip_id === tripId);
    const customer = custOf(trip.customer_id) || { name: '', carrier: '', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '' };
    B.show([{ label: kind === 'lade' ? 'Lade Liste' : 'CMR', html: kind === 'lade' ? B.lade({ trip, customer, loads }) : B.cmr({ trip, customer, loads }) }], { title: `${trip.poz_no} · ${B.plates(trip)}` });
  }
  const loadLine = l => `<b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small>`;
  const hit = l => !P.q || [l.sender, l.consignee, l.goods, l.dest_customs, l.inbound_plate, (tripOf(l.trip_id) || {}).poz_no, B.plates(tripOf(l.trip_id))].some(x => tr(x).includes(tr(P.q)));
  const kpi = (icon, label, val, note, cls = '') => `<div class="kpi ${cls}"><span class="ki">${ic(icon)}</span><div><small>${label}</small><b>${val}</b><em>${note}</em></div></div>`;
  const searchBar = ph => `<label class="srch">${ic('search')}<input id="q" data-i="q" type="search" value="${esc(P.q)}" placeholder="${ph}" autocomplete="off" aria-label="Ara"></label>`;
  const tabsHtml = (list, cur, act = 'tab') => `<div class="tabs" role="tablist">${list.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-a="${act}" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>`;
  const brand = right => `<header class="app-top"><div class="in"><div class="brand"><img src="logo.svg" alt=""><div><b>PCS TRANSİT YYS</b><small>Nakliye portalı</small></div></div><div class="who">${right}</div></div></header>`;

  // ------------------------------------------------------------------ yük formu (pencere)
  const F = [  // [alan, etiket, tür, geniş mi, bölüm]
    ['sender', 'Gönderici', 'text', 0, 0], ['consignee', 'Alıcı', 'text', 0, 0], ['sender_addr', 'Gönderici adresi', 'area', 0, 0], ['consignee_addr', 'Alıcı adresi', 'area', 0, 0], ['notify', 'Notify (bildirim adresi)', 'area', 1, 0],
    ['goods', 'Mal cinsi', 'text', 1, 1], ['pieces', 'Kap adedi', 'num', 0, 1], ['packing', 'Ambalaj', 'text', 0, 1], ['weight', 'Brüt kilo (kg)', 'num', 0, 1], ['volume', 'Hacim (m³)', 'num', 0, 1],
    ['dest_customs', 'Varış gümrük', 'text', 0, 2], ['country', 'Ülke', 'text', 0, 2], ['code', 'Gümrük kodu', 'text', 0, 2], ['broker', 'Gümrükçü', 'text', 0, 2], ['expected_date', 'Beklenen tarih', 'date', 0, 2],
    ['inbound_plate', 'Yükü getirecek kamyon plakası', 'plate', 0, 3], ['note', 'Not', 'text', 1, 3]
  ];
  const SEC = ['Taraflar', 'Mal bilgisi', 'Varış ve teslim', 'Yükü getirecek araç'];
  const blank = () => ({ id: '', sender: '', consignee: '', pieces: '', packing: 'KAP', goods: '', weight: '', dest_customs: '', country: '', expected_date: '', sender_addr: '', consignee_addr: '', notify: '', volume: '', code: '', broker: '', inbound_plate: '', note: '' });
  const inp = (k, lab, kind, wide, v) => {
    const req = k === 'sender' || k === 'consignee';
    const t = kind === 'area' ? `<textarea id="f-${k}" name="${k}" rows="2" maxlength="300">${esc(v)}</textarea>` :
      `<input id="f-${k}" name="${k}" type="${kind === 'date' ? 'date' : 'text'}" ${kind === 'num' ? 'inputmode="decimal"' : ''} value="${esc(v)}" maxlength="${k === 'note' ? 500 : kind === 'plate' ? 40 : 200}" ${req ? 'required' : ''} ${kind === 'plate' ? 'style="text-transform:uppercase" placeholder="Örn. 34 ABC 123"' : ''} autocomplete="off">`;
    return `<label class="fld ${wide ? 'wide' : ''}"><span>${lab}${req ? ' <i>*</i>' : ''}</span>${t}</label>`;
  };
  function openForm(l) {
    const f = { ...blank(), ...Object.fromEntries(Object.entries(l || {}).map(([k, v]) => [k, v == null ? '' : v])) }, edit = !!f.id;
    const canDel = edit && f.status !== 'aracta';
    const dlg = document.getElementById('m');
    dlg.innerHTML = `<form data-f="load" autocomplete="off"><div class="mh"><div><h2>${edit ? 'Yükü düzenle' : 'Yeni yük'}</h2><p>${edit ? 'Değişiklik belgelerde (Lade Liste ve CMR) de görünür.' : 'Gönderici ve alıcı yazılmalı; diğer alanlar belgeler için kullanılır.'}</p></div><button type="button" class="x" data-a="mclose" aria-label="Kapat">${ic('close')}</button></div>
<div class="mb"><input type="hidden" name="id" value="${esc(f.id)}">${SEC.map((t, s) => `<section class="fs"><h3>${t}</h3><div class="grid">${F.filter(x => x[4] === s).map(x => inp(x[0], x[1], x[2], x[3], f[x[0]])).join('')}</div></section>`).join('')}<div id="ferr" class="ferr" hidden></div></div>
<div class="mf">${canDel ? `<button type="button" class="btn danger" data-a="mdel" data-id="${esc(f.id)}">${ic('trash')}Sil</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-a="mclose">Vazgeç</button><button type="submit" class="btn pri">${ic('check')}${edit ? 'Değişikliği kaydet' : 'Yükü ekle'}</button></div></form>`;
    if (!dlg.open) dlg.showModal();
    setTimeout(() => dlg.querySelector('#f-sender')?.focus(), 30);
  }
  const closeForm = () => { const d = document.getElementById('m'); if (d.open) d.close(); };

  async function save(form) {
    const fd = new FormData(form), err = m => { const e = document.getElementById('ferr'); if (e) { e.textContent = m; e.hidden = false; } };
    const g = k => String(fd.get(k) || '').trim();
    if (!g('sender') || !g('consignee')) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(fd.get('weight')), v = parseNum(fd.get('volume')), pc = parseNum(fd.get('pieces'));
    if ([w, v, pc].some(Number.isNaN)) return err('Kap, kilo ve hacim sayı olarak yazılmalı.');
    if ((w || 0) < 0 || (v || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap, kilo ve hacim eksi olamaz; kap tam sayı olmalı.');
    const row = { id: g('id') || undefined, sender: g('sender'), consignee: g('consignee'), pieces: pc || 0, packing: g('packing') || 'KAP', goods: g('goods'), weight: w || 0, volume: v == null ? null : v,
      dest_customs: g('dest_customs'), country: g('country'), expected_date: g('expected_date') || null, sender_addr: g('sender_addr'), consignee_addr: g('consignee_addr'), notify: g('notify'), code: g('code'), broker: g('broker'),
      inbound_plate: g('inbound_plate').toUpperCase(), note: g('note') };
    P.busy = 'save';
    const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    const { error } = await client.rpc(MODE === 'm' ? 'shp_portal_save' : 'shp_depot_save', { p_token: TOKEN, p_load: row });
    P.busy = '';
    if (error) { if (btn) btn.disabled = false; err(explain(error)); return; }
    closeForm();
    toast(row.id ? 'Yük güncellendi' : 'Yük eklendi. Depo yük geldiğinde işaretleyecek.');
    if (!row.id) P.tab = 'hepsi';
    await load0();
  }
  async function removeLoad(id) {
    const { error } = await client.rpc(MODE === 'm' ? 'shp_portal_delete' : 'shp_depot_delete', MODE === 'm' ? { p_token: TOKEN, p_id: id } : { p_token: TOKEN, p_id: id });
    if (error) { toast(explain(error), true); return false; }
    toast('Yük silindi'); P.sel.delete(id); closeForm(); await load0(); return true;
  }

  // ------------------------------------------------------------------ müşteri sayfası
  const canEdit = l => (l.status !== 'aracta' && !l.trip_id) || (l.status === 'aracta' && (tripOf(l.trip_id) ? !locked(tripOf(l.trip_id)) : false));
  const canDel = l => (l.status === 'bekliyor' || l.status === 'depoda') && !l.trip_id;
  const free = l => l.status === 'bekliyor' || l.status === 'depoda';
  const dash = '<span class="mut">—</span>';

  function customerRow(l) {
    const t = tripOf(l.trip_id), sel = P.sel.has(l.id);
    return `<tr class="lr ${sel ? 'sel' : ''}"><td class="ck">${free(l) ? `<input type="checkbox" data-a="pick" data-id="${esc(l.id)}" ${sel ? 'checked' : ''} aria-label="Yükü araca koymak için seç: ${esc(l.sender)}">` : ''}</td>
<td data-l="Gönderici → Alıcı" class="who2">${loadLine(l)}</td><td data-l="Mal">${esc(l.goods) || dash}${l.dest_customs ? `<small>Varış: ${esc(l.dest_customs)}</small>` : ''}</td><td data-l="Kap · Kilo" class="r">${esc(l.pieces)} ${esc(l.packing)}<small>${kg(l.weight)} kg</small></td>
<td data-l="Getirecek araç">${l.inbound_plate ? plate(l.inbound_plate, 'in') : dash}</td>
<td data-l="Durum">${chip(l)}${t ? `<small>${esc(t.poz_no)} · ${esc(B.plates(t))}</small>` : l.arrived_at ? `<small>Geldi ${esc(stamp(l.arrived_at))}</small>` : l.expected_date ? `<small>Beklenen ${esc(B.dmy(l.expected_date))}</small>` : ''}</td>
<td class="act"><span class="stk">${canEdit(l) ? `<button type="button" class="ib" data-a="edit" data-id="${esc(l.id)}" title="Düzenle">${ic('edit')}<span>Düzenle</span></button>` : ''}${canDel(l) ? `<button type="button" class="ib bad" data-a="del" data-id="${esc(l.id)}" title="Sil">${ic('trash')}<span>${P.confirm === l.id ? 'Evet, sil' : 'Sil'}</span></button>` : ''}${l.status === 'aracta' && t && !locked(t) ? `<button type="button" class="ib keep" data-a="unassign" data-id="${esc(l.id)}" title="Araçtan çıkar">${ic('undo')}<span>Araçtan çıkar</span></button>` : ''}</span></td></tr>`;
  }

  function sidePanel(all) {
    const sl = [...P.sel].map(id => all.find(l => l.id === id)).filter(Boolean);
    if (!sl.length) return `<h2>Araca yerleştir</h2><p class="hint">Soldaki listeden araca koymak istediğiniz yükleri işaretleyin. Depoya henüz gelmemiş yük de araca konabilir.</p><div class="tip">${ic('truck')}<div>Atama kesindir: yeni araca otomatik <b>Poz No</b> verilir, Lade Liste ve CMR belgeleri hazır olur.</div></div>`;
    const open = (P.data.trips || []).filter(t => !locked(t)), nv = P.nv;
    return `<h2>Araca yerleştir</h2><div class="sb-t"><b>${sl.length} yük seçili</b><span>${kg(sum(sl, 'weight'))} kg · ${sum(sl, 'pieces')} kap</span></div>
<label class="fld"><span>Hangi araca?</span><select id="tg" data-i="target"><option value="">Araç seçin…</option>${open.map(t => `<option value="${esc(t.id)}" ${P.target === t.id ? 'selected' : ''}>${esc(t.poz_no)} · ${esc(B.plates(t))}</option>`).join('')}<option value="new" ${P.target === 'new' ? 'selected' : ''}>+ Yeni araç</option></select></label>
${P.target === 'new' ? `<div class="grid one"><label class="fld"><span>Çekici plaka <i>*</i></span><input id="nv-tractor" data-i="nv-tractor" value="${esc(nv.tractor)}" maxlength="30" placeholder="Örn. 34 ABC 123" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Dorse plaka</span><input id="nv-trailer" data-i="nv-trailer" value="${esc(nv.trailer)}" maxlength="30" placeholder="Örn. 34 DEF 456" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Çıkış tarihi</span><input id="nv-date" data-i="nv-date" type="date" value="${esc(nv.date || today())}"></label></div>` : ''}
<ul class="sl">${sl.map(l => `<li><span><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)} · ${kg(l.weight)} kg</small></span><button type="button" data-a="unpick" data-id="${esc(l.id)}" aria-label="Seçimden çıkar">${ic('close')}</button></li>`).join('')}</ul>
<button type="button" class="btn pri wide" data-a="assign" ${P.busy === 'assign' ? 'disabled' : ''}>${ic('truck')}${P.busy === 'assign' ? 'Koyuluyor…' : 'Araca koy'}</button><button type="button" class="lnk" data-a="clear">Seçimi bırak</button>`;
  }

  function tripCard(t, all) {
    const n = all.filter(l => l.trip_id === t.id), lk = locked(t), editing = P.editTrip === t.id, te = P.te, gel = n.filter(l => !l.arrived_at).length;
    const head = editing ? `<div class="grid"><label class="fld"><span>Çekici plaka</span><input id="te-tractor" data-i="te-tractor" value="${esc(te.tractor)}" maxlength="30" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Dorse plaka</span><input id="te-trailer" data-i="te-trailer" value="${esc(te.trailer)}" maxlength="30" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>Çıkış tarihi</span><input id="te-date" data-i="te-date" type="date" value="${esc(te.date)}"></label><label class="fld"><span>Konu (isteğe bağlı)</span><input id="te-subject" data-i="te-subject" value="${esc(te.subject)}" maxlength="200" autocomplete="off"></label></div><div class="acts"><button type="button" class="btn pri sm" data-a="trip-save" data-id="${esc(t.id)}">${ic('check')}Kaydet</button><button type="button" class="btn sm" data-a="trip-cancel">Vazgeç</button></div>`
      : `<div class="th"><div><b class="poz">${esc(t.poz_no)}</b>${plate(t.tractor)}${plate(t.trailer, 'alt')}<div class="meta">${esc(B.dmy(t.depart_date))} · ${n.length} yük · ${kg(sum(n, 'weight'))} kg${gel ? ` · <span class="warn">${gel} yük depoya gelmedi</span>` : ''}${lk ? ' · <b>Yola çıktı, kilitli</b>' : ''}</div></div><div class="acts">${docButtons(t)}${lk ? '' : `<button type="button" class="btn sm" data-a="trip-edit" data-id="${esc(t.id)}">${ic('edit')}Plakayı değiştir</button>`}</div></div>`;
    return `<article class="tc">${head}<div class="tls">${B.order(n).map(l => `<div class="tl"><div class="main">${loadLine(l)}<div class="meta">${[l.goods, `${l.pieces} ${l.packing}`, `${kg(l.weight)} kg`, l.dest_customs].filter(Boolean).map(esc).join(' · ')}</div></div><div class="side">${l.arrived_at ? '<span class="ch g">Depoda</span>' : '<span class="ch a">Depoya gelmedi</span>'}${lk ? '' : `<button type="button" class="ib" data-a="unassign" data-id="${esc(l.id)}">${ic('undo')}<span>Araçtan çıkar</span></button>`}</div></div>`).join('')}</div></article>`;
  }

  function customerView() {
    const d = P.data, c = d.customer, all = d.loads;
    const cnt = s => all.filter(l => l.status === s).length, w = s => sum(all.filter(l => l.status === s), 'weight');
    const stats = [['hepsi', 'Tümü', all.length], ['bekliyor', 'Bekleyen', cnt('bekliyor')], ['depoda', 'Depoda', cnt('depoda')], ['aracta', 'Araçta', cnt('aracta')]];
    const rows = all.filter(l => (P.tab === 'hepsi' || l.status === P.tab) && hit(l));
    const table = rows.length ? `<div class="scroll"><table class="tbl"><thead><tr><th class="ck"></th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap · Kilo</th><th>Getirecek araç</th><th>Durum</th><th></th></tr></thead><tbody>${rows.map(customerRow).join('')}</tbody></table></div>` : '<div class="empty">Bu görünümde yük yok.</div>';
    const trips = (d.trips || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const loadsView = `<div class="layout"><section class="card flush"><div class="bar"><h2>Yüklerim <span class="cnt">${rows.length}</span></h2>${searchBar('Ara: gönderici, alıcı, mal, plaka…')}</div>${tabsHtml(stats, P.tab)}${table}</section><aside class="card side" id="sbar">${sidePanel(all)}</aside></div>`;
    const tripsView = trips.length ? `<div class="tcs">${trips.map(t => tripCard(t, all)).join('')}</div>` : '<section class="card"><div class="empty">Henüz araç yok. Yüklerinizi işaretleyip "Araca koy" dediğinizde burada görünür.</div></section>';
    return `${brand(`${c.logo ? `<img class="clogo" src="${esc(c.logo)}" alt="">` : ''}<div class="cn"><b>${esc(c.name)}</b><small>${P.at ? `Güncelleme ${P.at}` : ''}</small></div><button type="button" class="btn sm ghost" data-a="refresh">${ic('refresh')}Yenile</button>`)}
<main class="wrap"><div class="hero"><div><h1>Yüklerinizi yönetin</h1><p>Gelecek yüklerinizi yazın, hangi araca ne yükleneceğini ayarlayın, Lade Liste ve CMR belgelerinizi alın.</p></div><button type="button" class="btn pri lg" data-a="add">${ic('plus')}Yük ekle</button></div>
<div class="kpis">${kpi('clock', 'Bekleyen', cnt('bekliyor'), `${kg(w('bekliyor'))} kg · depoya gelmedi`, 'amb')}${kpi('box', 'Depoda', cnt('depoda'), `${kg(w('depoda'))} kg · araca atanmadı`, 'grn')}${kpi('truck', 'Araçta', cnt('aracta'), `${trips.length} araç`, 'blu')}${kpi('scale', 'Toplam kilo', `${kg(sum(all, 'weight'))}`, 'tüm yükleriniz')}</div>
${tabsHtml([['loads', 'Yüklerim', all.length], ['trips', 'Araçlarım', trips.length]], P.view, 'view').replace('class="tabs"', 'class="tabs top"')}
${P.view === 'trips' ? tripsView : loadsView}</main>`;
  }

  // ------------------------------------------------------------------ depo sayfası
  function depotRow(l, btn) {
    const t = tripOf(l.trip_id);
    return `<tr class="dr"><td data-l="Gönderici → Alıcı" class="who2">${loadLine(l)}</td><td data-l="Mal">${esc(l.goods) || dash}</td><td data-l="Kap · Kilo" class="r">${esc(l.pieces)} ${esc(l.packing)} · ${kg(l.weight)} kg</td><td data-l="Getirecek araç">${l.inbound_plate ? plate(l.inbound_plate, 'in') : dash}</td>
<td data-l="Sefer">${t ? `${plate(t.tractor)}<small>${esc(t.poz_no)}</small>` : dash}</td><td data-l="${l.arrived_at ? 'Geldi' : 'Beklenen'}">${l.arrived_at ? `${esc(stamp(l.arrived_at))}${l.arrived_by ? `<small>${esc(l.arrived_by)}</small>` : ''}` : l.expected_date ? esc(B.dmy(l.expected_date)) : dash}</td>
<td class="act big">${btn}<span class="stk"><button type="button" class="ib" data-a="edit" data-id="${esc(l.id)}" title="Düzenle">${ic('edit')}<span>Düzenle</span></button>${canDel(l) ? `<button type="button" class="ib bad" data-a="del" data-id="${esc(l.id)}" title="Sil">${ic('trash')}<span>${P.confirm === l.id ? 'Evet, sil' : 'Sil'}</span></button>` : ''}</span></td></tr>`;
  }

  function depotView() {
    const d = P.data, all = d.loads, cu = id => (custOf(id) || {}).name || '?';
    const wait = all.filter(l => !l.arrived_at && (l.status === 'bekliyor' || l.status === 'aracta')), idle = all.filter(l => l.status === 'depoda');
    const trips = (d.trips || []).filter(t => all.some(l => l.trip_id === t.id));
    const arrToday = all.filter(l => l.arrived_at && new Date(l.arrived_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) === today()).length;
    const goBtn = l => `<button type="button" class="btn go" data-a="arrive" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>${ic('check')}Geldi</button>`;
    const undoBtn = l => `<button type="button" class="btn undo" data-a="undo" data-id="${esc(l.id)}" ${P.busy === l.id ? 'disabled' : ''}>${ic('undo')}Geri al</button>`;
    const head = '<thead><tr><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap · Kilo</th><th>Getirecek araç</th><th>Sefer</th><th>Zaman</th><th></th></tr></thead>';
    const group = (rows, btn) => {
      const by = {}; rows.filter(hit).forEach(l => { (by[l.customer_id] = by[l.customer_id] || []).push(l); });
      const ids = Object.keys(by).sort((a, b) => tr(cu(a)).localeCompare(tr(cu(b)), 'tr'));
      return ids.length ? ids.map(id => `<section class="card flush"><div class="gh"><h2>${esc(cu(id))}</h2><span class="cnt">${by[id].length} yük · ${kg(sum(by[id], 'weight'))} kg</span></div><div class="scroll"><table class="tbl dt">${head}<tbody>${by[id].map(l => depotRow(l, btn(l))).join('')}</tbody></table></div></section>`).join('') : '<section class="card"><div class="empty">Burada yük yok.</div></section>';
    };
    let body;
    if (P.tab === 'bekliyor') body = group(wait, goBtn);
    else if (P.tab === 'depoda') body = group(idle, undoBtn);
    else body = trips.length ? trips.filter(t => !P.q || [t.poz_no, t.tractor, t.trailer, cu(t.customer_id)].some(x => tr(x).includes(tr(P.q)))).map(t => {
      const n = B.order(all.filter(l => l.trip_id === t.id));
      return `<section class="card flush"><div class="gh"><h2>${plate(t.tractor)}${plate(t.trailer, 'alt')} <small>${esc(t.poz_no)} · ${esc(cu(t.customer_id))} · ${esc(B.dmy(t.depart_date))}</small></h2><div class="acts">${docButtons(t)}</div></div><div class="scroll"><table class="tbl dt">${head}<tbody>${n.map(l => depotRow(l, l.arrived_at ? undoBtn(l) : goBtn(l))).join('')}</tbody></table></div></section>`;
    }).join('') : '<section class="card"><div class="empty">Araca atanmış yük yok.</div></section>';
    return `${brand(`<label class="nm"><span>Adınız</span><input id="nm" data-i="name" value="${esc(P.name)}" maxlength="60" autocomplete="off" placeholder="Örn. Ahmet"></label><button type="button" class="btn sm ghost" data-a="refresh">${ic('refresh')}Yenile</button>`)}
<main class="wrap"><div class="hero"><div><h1>Depo ekranı</h1><p>Yük gelince <b>Geldi</b>'ye basın. Yanlışlıkla basarsanız <b>Geri al</b> deyin. Yük bilgisi yanlışsa <b>Düzenle</b> ile düzeltin.${P.at ? ` <span class="mut">Son güncelleme ${P.at}</span>` : ''}</p></div></div>
<div class="kpis">${kpi('clock', 'Bekleyen', wait.length, 'depoya gelmedi', 'amb')}${kpi('check', 'Bugün gelen', arrToday, 'bugün işaretlenen', 'grn')}${kpi('box', 'Depoda', idle.length, 'araca atanmadı', 'blu')}${kpi('truck', 'Araçlar', trips.length, 'plaka bazında')}</div>
${tabsHtml([['bekliyor', 'Bekleyenler', wait.length], ['depoda', 'Depoda', idle.length], ['araclar', 'Araçlar', trips.length]], P.tab).replace('class="tabs"', 'class="tabs top"')}
<div class="bar solo">${searchBar('Ara: gönderici, alıcı, mal, plaka…')}</div>${body}</main>`;
  }

  // ------------------------------------------------------------------ çizim ve olaylar
  function draw() {
    if (!MODE) { root.innerHTML = '<main class="wrap"><section class="card note"><h1>Nakliye programı</h1><p>Bu sayfa size gönderilen özel bağlantıyla açılır. Bağlantıyı gönderen kişiyle görüşün.</p></section></main>'; return; }
    if (P.err && !P.data) { root.innerHTML = `<main class="wrap"><section class="card note"><h1>Nakliye programı</h1><p>${esc(P.err)}</p><button type="button" class="btn pri" data-a="refresh">Tekrar dene</button></section></main>`; return; }
    if (!P.data) { root.innerHTML = '<main class="wrap"><section class="card note"><p>Yükleniyor…</p></section></main>'; return; }
    const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd, y = window.scrollY;
    root.innerHTML = (P.err ? `<div class="gerr">${esc(P.err)}</div>` : '') + (MODE === 'm' ? customerView() : depotView());
    if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (_) { /* tarih alanı */ } } }
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  // Yan paneli tek başına yeniler (plaka yazarken odak kaybolmasın)
  const drawSide = () => { const s = document.getElementById('sbar'); if (s && MODE === 'm') s.innerHTML = sidePanel(P.data.loads); };

  async function assign() {
    if (P.busy) return;
    const ids = [...P.sel];
    if (!ids.length) return;
    const isNew = P.target === 'new';
    if (!P.target) { toast('Hangi araca koyacağınızı seçin', true); document.getElementById('tg')?.focus(); return; }
    if (isNew && !P.nv.tractor.trim()) { toast('Çekici plakasını yazın', true); document.getElementById('nv-tractor')?.focus(); return; }
    P.busy = 'assign'; drawSide();
    const { data, error } = await client.rpc('shp_portal_assign', { p_token: TOKEN, p_load_ids: ids, p_trip: isNew ? null : P.target, p_tractor: isNew ? P.nv.tractor.trim() : '', p_trailer: isNew ? P.nv.trailer.trim() : '',
      p_depart: isNew ? (P.nv.date || today()) : null, p_subject: '' });
    P.busy = '';
    if (error) { toast(explain(error), true); await load0(); return; }
    const t = data && data.trip;
    toast(t ? `${ids.length} yük ${t.poz_no} · ${B.plates(t)} aracına konuldu` : 'Yükler araca konuldu');
    P.sel.clear(); P.target = ''; P.nv = { tractor: '', trailer: '', date: '' };
    P.view = 'trips';
    await load0();
  }

  async function onClick(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, id = t.dataset.id;
    if (a === 'refresh') { P.err = ''; await load(); return; }
    if (a === 'tab') { P.tab = t.dataset.v; P.confirm = ''; draw(); return; }
    if (a === 'view') { P.view = t.dataset.v; draw(); return; }
    if (a === 'doc') { showDocs(id, t.dataset.kind); return; }
    if (a === 'add') { openForm(null); return; }
    if (a === 'edit') { const l = P.data.loads.find(x => x.id === id); if (l) openForm(l); return; }
    if (a === 'mclose') { closeForm(); return; }
    if (a === 'mdel') { if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.lastChild.textContent = 'Emin misiniz? Evet, sil'; return; } await removeLoad(id); return; }
    if (a === 'del') {
      if (P.confirm !== id) { P.confirm = id; draw(); return; }
      P.confirm = ''; await removeLoad(id); return;
    }
    if (a === 'pick') { P.sel.has(id) ? P.sel.delete(id) : P.sel.add(id); draw(); return; }
    if (a === 'unpick') { P.sel.delete(id); draw(); return; }
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
      else if (k === 'target') { P.target = t.value; drawSide(); }
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
