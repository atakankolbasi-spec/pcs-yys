/* Nakliye programı: operatör ekranı (Nakliye sayfası).
 * Müşterilerin yazdığı yükler; depoya gelince "boşta" olur; operatör aynı müşterinin yüklerini seçip bir araca (plakaya) atar.
 * Araca atanan yük boşta listesinden çıkar, plakanın altında durur. Her sefere otomatik Poz No verilir (PCS-26-0001 ...).
 * Lade Liste ve CMR belgeleri nakliye-belge.js'tedir. Bu dosya app.js'ten window.PCSNK.init({...}) ile bağlanır. */
(() => {
  'use strict';
  const B = window.PCSNKB;
  if (!B) return;
  let X = null;                         // app.js'ten gelen bağlantılar (istemci, toast, openModal ...)
  const CAP = 24000;                    // araç kapasitesi (kg): doluluk çubuğu için
  const esc = B.esc;
  const S = {
    ready: false, loading: false, err: '', missing: false, customers: [], loads: [], trips: [],
    tab: 'idle', sel: new Set(), cust: '', q: '', tq: '', open: new Set(), busy: false, confirm: '', rt: null,
    form: { tractor: '', trailer: '', date: '', subject: '', lade: true, cmr: true }
  };

  // ------------------------------------------------------------------ küçük yardımcılar
  const tr = s => String(s || '').toLocaleUpperCase('tr-TR');
  const kg = n => Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const stamp = iso => { try { return iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; } catch (_) { return ''; } };
  const dmy = B.dmy;
  const byId = (arr, id) => arr.find(x => x.id === id);
  const cust = id => byId(S.customers, id);
  const loadOf = id => byId(S.loads, id);
  const tripLoads = t => B.order(S.loads.filter(l => l.trip_id === t.id));
  const COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#16a34a', '#0891b2', '#b45309'];
  const colorOf = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const pill = id => { const c = cust(id); return c ? `<span class="nk-cu"><i style="background:${colorOf(id)}"></i>${esc(c.name)}</span>` : '<span class="nk-cu">?</span>'; };
  const ic = n => (X ? X.icon(n) : '');
  const sum = (arr, k) => arr.reduce((a, l) => a + (Number(l[k]) || 0), 0);
  const selected = () => [...S.sel].map(loadOf).filter(Boolean);
  const selCust = () => { const l = selected()[0]; return l ? l.customer_id : ''; };
  const idleLoads = () => S.loads.filter(l => l.status === 'depoda');
  const waitLoads = () => S.loads.filter(l => l.status === 'bekliyor');

  function parseNum(v) {
    let s = String(v ?? '').replace(/\s/g, '');
    if (!s) return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // ------------------------------------------------------------------ veri
  async function load(quiet) {
    if (!X || S.loading) return;
    S.loading = true;
    if (!quiet) { S.err = ''; redraw(); }
    try {
      const c = X.client;
      const [a, t, l] = await Promise.all([
        c.from('shp_customers').select('*').order('name'),
        c.from('shp_trips').select('*').order('created_at', { ascending: false }).limit(500),
        c.from('shp_loads').select('*').order('created_at', { ascending: false }).limit(3000)
      ]);
      const e = a.error || t.error || l.error;
      if (e) {
        S.missing = /PGRST205|PGRST202|42P01|schema cache|does not exist/.test(`${e.code || ''} ${e.message || ''}`);
        S.err = S.missing ? '' : `Yüklenemedi: ${e.message || 'bilinmeyen hata'}`;
      } else {
        S.customers = a.data || []; S.trips = t.data || []; S.loads = l.data || [];
        S.err = ''; S.missing = false; S.ready = true;
        for (const id of [...S.sel]) { const x = loadOf(id); if (!x || x.status !== 'depoda') S.sel.delete(id); }
      }
    } catch (_) {
      S.err = 'Bağlantı kurulamadı. İnternetinizi kontrol edip Yenile\'ye basın.';
    }
    S.loading = false;
    redraw();
  }

  function listen() {
    if (S.rt || !X) return;
    try {
      let timer = null;
      const ping = () => { clearTimeout(timer); timer = setTimeout(() => { if (S.ready && document.getElementById('nk-root')) load(true); }, 500); };
      S.rt = X.client.channel('pcs-nakliye').on('postgres_changes', { event: '*', schema: 'public', table: 'shp_loads' }, ping)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shp_trips' }, ping);
      S.rt.subscribe();
    } catch (_) { S.rt = null; }
  }

  // ------------------------------------------------------------------ ekran
  function kpis() {
    const idle = idleLoads(), month = X.today().slice(0, 7);
    const sl = selected();
    const items = [
      ['Bekleyen yük', waitLoads().length, 'Müşteri yazdı, depoya gelmedi', 'clock'],
      ['Boşta yük', idle.length, 'Depoda, araca atanmadı', 'building'],
      ['Boşta toplam', `${kg(sum(idle, 'weight'))} kg`, `${sum(idle, 'pieces')} kap`, 'database'],
      ['Seçili yük', sl.length, `${kg(sum(sl, 'weight'))} kg`, 'check'],
      ['Bu ay sefer', S.trips.filter(t => String(t.depart_date).startsWith(month)).length, `${S.customers.filter(c => c.active).length} aktif müşteri`, 'truck']
    ];
    return `<div class="nk-kpis">${items.map(([t, v, n, i]) => `<div class="nk-kpi"><div class="nk-kpi-t">${ic(i)}${esc(t)}</div><div class="nk-kpi-v">${esc(v)}</div><div class="nk-kpi-n">${esc(n)}</div></div>`).join('')}</div>`;
  }

  function tabs() {
    const t = [['idle', 'Boşta yükler', idleLoads().length], ['trips', 'Araçlar', S.trips.length], ['wait', 'Bekleyenler', waitLoads().length], ['all', 'Tüm yükler', S.loads.length]];
    return `<div class="nk-tabs" role="tablist">${t.map(([k, l, n]) => `<button type="button" role="tab" class="${S.tab === k ? 'on' : ''}" aria-selected="${S.tab === k}" data-nk="tab" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>`;
  }

  const custSelect = () => `<select id="nk-cust" data-nk-in="cust" aria-label="Müşteri süz"><option value="">Tüm müşteriler</option>${S.customers.map(c => `<option value="${c.id}" ${S.cust === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const searchBox = (id, key, val) => `<label class="nk-search">${ic('search')}<input id="${id}" data-nk-in="${key}" type="search" value="${esc(val)}" placeholder="Ara: gönderici, alıcı, mal, plaka…" autocomplete="off" aria-label="Ara"></label>`;
  const hit = (l, q) => !q || [l.sender, l.consignee, l.goods, l.dest_customs, l.broker, l.note, (cust(l.customer_id) || {}).name, (byId(S.trips, l.trip_id) || {}).poz_no, B.plates(byId(S.trips, l.trip_id))].some(x => tr(x).includes(tr(q)));

  const loadCells = l => `<td>${pill(l.customer_id)}</td><td><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small></td><td>${esc(l.goods) || '—'}</td><td class="r">${esc(l.pieces)} ${esc(l.packing)}</td><td class="r">${kg(l.weight)}</td>`;

  function idleView() {
    const sc = selCust();
    const rows = idleLoads().filter(l => (!S.cust || l.customer_id === S.cust) && hit(l, S.q))
      .sort((a, b) => tr(a.dest_customs).localeCompare(tr(b.dest_customs), 'tr') || String(a.arrived_at || '').localeCompare(String(b.arrived_at || '')));
    const groups = [];
    for (const l of rows) { const k = l.dest_customs || 'Varış belirtilmemiş'; let g = groups[groups.length - 1]; if (!g || g.k !== k) { g = { k, rows: [] }; groups.push(g); } g.rows.push(l); }
    const pickable = rows.filter(l => !sc || l.customer_id === sc);
    const allOn = pickable.length > 0 && pickable.every(l => S.sel.has(l.id));
    const canAll = !!(sc || S.cust) && pickable.length > 0;
    const body = groups.map(g => `<tr class="nk-grp"><td colspan="9">${esc(g.k)} <span>${g.rows.length} yük · ${kg(sum(g.rows, 'weight'))} kg</span></td></tr>` + g.rows.map(l => {
      const off = !!sc && sc !== l.customer_id;
      return `<tr class="${S.sel.has(l.id) ? 'sel' : ''} ${off ? 'dim' : ''}"><td class="ck"><input type="checkbox" data-nk="pick" data-id="${l.id}" ${S.sel.has(l.id) ? 'checked' : ''} ${off ? 'disabled' : ''} aria-label="Yükü seç: ${esc(l.sender)}" ${off ? 'title="Bir sefer yalnızca tek müşterinin yüklerini taşır"' : ''}></td>${loadCells(l)}<td>${esc(stamp(l.arrived_at))}</td><td class="r"><button type="button" class="nk-lnk" data-nk="edit-load" data-id="${l.id}">Düzenle</button></td></tr>`;
    }).join('')).join('');
    const table = rows.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th class="ck"><input type="checkbox" data-nk="pick-all" ${allOn ? 'checked' : ''} ${canAll ? '' : 'disabled'} aria-label="Görünen yüklerin hepsini seç" ${canAll ? '' : 'title="Önce bir müşteri seçin ya da bir yük işaretleyin"'}></th><th>Müşteri</th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap</th><th class="r">Kilo</th><th>Geldi</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`
      : `<div class="nk-empty">${idleLoads().length ? 'Bu süzgece uyan boşta yük yok.' : 'Boşta yük yok. Müşterinin yazdığı yükler depoya gelince burada görünür.'}</div>`;
    return `<div class="nk-cols"><section class="nk-pn"><div class="nk-bar"><h2>Boşta yükler <span>${rows.length}</span></h2><div class="nk-bar-r">${custSelect()}${searchBox('nk-q', 'q', S.q)}</div></div>${table}</section><aside class="nk-pn nk-side" id="nk-side">${panel()}</aside></div>`;
  }

  function panel() {
    const sl = selected();
    if (!sl.length) return `<h2>Sefer hazırlığı</h2><p class="nk-hint">Soldaki listeden <b>aynı müşteriye ait</b> yükleri işaretleyin. Seçince buradan araca atayıp belgeleri hazırlayabilirsiniz.</p><div class="nk-hint2">Bir araç yalnızca tek müşterinin yüklerini taşır. Atanan yükler bu listeden çıkar ve plakanın altında durur.</div>`;
    const c = cust(sl[0].customer_id) || { name: '' };
    const w = sum(sl, 'weight'), pct = Math.round(w / CAP * 100);
    const dests = [...new Set(sl.map(l => l.dest_customs || '—'))];
    const f = S.form;
    return `<h2>Sefer hazırlığı</h2><div class="nk-who">${pill(sl[0].customer_id)}</div>
<div class="nk-fg"><label>Çekici plaka<input id="nk-tractor" data-nk-in="f-tractor" value="${esc(f.tractor)}" maxlength="30" placeholder="Örn. 34 ABC 123" autocomplete="off"></label>
<label>Dorse plaka<input id="nk-trailer" data-nk-in="f-trailer" value="${esc(f.trailer)}" maxlength="30" placeholder="Örn. 34 DEF 456" autocomplete="off"></label>
<label>Poz No<input value="Otomatik verilir" disabled></label>
<label>Çıkış tarihi<input id="nk-date" data-nk-in="f-date" type="date" value="${esc(f.date || X.today())}"></label>
<label class="full">Konu <small>(isteğe bağlı)</small><input id="nk-subject" data-nk-in="f-subject" value="${esc(f.subject)}" maxlength="200" autocomplete="off"></label></div>
<div class="nk-sum"><div><small>Varış</small><b>${esc(dests.join(' · '))}</b></div><div><small>Yük · Kap</small><b>${sl.length} · ${sum(sl, 'pieces')}</b></div></div>
<div class="nk-fill ${pct > 100 ? 'over' : ''}"><div class="nk-fill-top"><span>Doluluk</span><b>${kg(w)} / ${kg(CAP)} kg · %${pct}</b></div><div class="nk-pg"><i style="width:${Math.min(100, pct)}%"></i></div>${pct > 100 ? '<small>Kapasiteyi aştı; yine de atayabilirsiniz.</small>' : ''}</div>
<ul class="nk-sel">${sl.map(l => `<li><span><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)} · ${esc(l.pieces)} ${esc(l.packing)} · ${kg(l.weight)} kg</small></span><button type="button" data-nk="unpick" data-id="${l.id}" aria-label="Seçimden çıkar">×</button></li>`).join('')}</ul>
<div class="nk-docs"><label><input type="checkbox" data-nk-in="f-lade" ${f.lade ? 'checked' : ''}> Lade Liste</label><label><input type="checkbox" data-nk-in="f-cmr" ${f.cmr ? 'checked' : ''}> CMR</label></div>
<button type="button" class="btn primary nk-go" data-nk="assign" ${S.busy ? 'disabled' : ''}>${ic('truck')}${S.busy ? 'Atanıyor…' : 'Araca ata ve belgeleri hazırla'}</button>
<button type="button" class="nk-lnk nk-clear" data-nk="clear">Seçimi temizle</button>
<p class="nk-hint2">${esc(c.name)} müşterisinin ${sl.length} yükü seçili.</p>`;
  }

  function tripsView() {
    const trips = S.trips.filter(t => !S.tq || [t.poz_no, t.tractor, t.trailer, (cust(t.customer_id) || {}).name, t.subject].some(x => tr(x).includes(tr(S.tq))));
    const body = trips.map(t => {
      const ls = tripLoads(t), open = S.open.has(t.id);
      const head = `<tr class="nk-trip ${open ? 'open' : ''}"><td><button type="button" class="nk-exp" data-nk="toggle-trip" data-id="${t.id}" aria-expanded="${open}" aria-label="Yükleri göster">${open ? '▾' : '▸'}</button></td><td><b class="nk-poz">${esc(t.poz_no)}</b></td>` +
        `<td><span class="nk-pl">${esc(t.tractor)}</span>${t.trailer ? `<span class="nk-pl alt">${esc(t.trailer)}</span>` : ''}</td><td>${pill(t.customer_id)}</td><td>${esc(dmy(t.depart_date))}</td><td class="r">${ls.length}</td><td class="r">${kg(sum(ls, 'weight'))} kg</td>` +
        `<td class="r"><button type="button" class="btn small" data-nk="doc" data-kind="lade" data-id="${t.id}">Lade Liste</button> <button type="button" class="btn small" data-nk="doc" data-kind="cmr" data-id="${t.id}">CMR</button></td></tr>`;
      if (!open) return head;
      const sub = ls.map((l, i) => `<tr><td>${esc(B.pozOf(t, i))}</td><td><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small></td><td>${esc(l.goods) || '—'}</td><td>${esc(l.dest_customs) || '—'}</td><td class="r">${esc(l.pieces)} ${esc(l.packing)}</td><td class="r">${kg(l.weight)}</td>` +
        `<td class="r"><button type="button" class="nk-lnk" data-nk="doc" data-kind="cmr" data-id="${t.id}" data-load="${l.id}">CMR</button> <button type="button" class="nk-lnk" data-nk="unassign" data-id="${l.id}">Araçtan çıkar</button></td></tr>`).join('');
      const del = S.confirm === 'trip:' + t.id
        ? `<button type="button" class="btn small danger" data-nk="del-trip" data-id="${t.id}">Evet, seferi sil</button>` : `<button type="button" class="btn small" data-nk="del-trip" data-id="${t.id}">Seferi sil (yükler boşa döner)</button>`;
      return head + `<tr class="nk-sub"><td></td><td colspan="7"><table class="nk-t inner"><thead><tr><th>CMR No</th><th>Gönderici → Alıcı</th><th>Mal</th><th>Varış</th><th class="r">Kap</th><th class="r">Kilo</th><th></th></tr></thead><tbody>${sub}</tbody></table><div class="nk-subact">${del}</div></td></tr>`;
    }).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Araçlar ve seferler <span>${trips.length}</span></h2><div class="nk-bar-r">${searchBox('nk-tq', 'tq', S.tq)}</div></div>` +
      (trips.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th></th><th>Poz No</th><th>Plaka</th><th>Müşteri</th><th>Çıkış</th><th class="r">Yük</th><th class="r">Toplam</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`
        : '<div class="nk-empty">Henüz sefer yok. Boşta yükleri seçip bir araca atayınca burada görünür.</div>') + '</section>';
  }

  function waitView() {
    const rows = waitLoads().filter(l => hit(l, S.q) && (!S.cust || l.customer_id === S.cust)).sort((a, b) => String(a.expected_date || '9999').localeCompare(String(b.expected_date || '9999')));
    const body = rows.map(l => `<tr>${loadCells(l)}<td>${esc(dmy(l.expected_date)) || '—'}</td><td class="r"><button type="button" class="btn small primary" data-nk="arrive" data-id="${l.id}">Geldi</button> <button type="button" class="nk-lnk" data-nk="edit-load" data-id="${l.id}">Düzenle</button></td></tr>`).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Bekleyenler <span>${rows.length}</span></h2><div class="nk-bar-r">${custSelect()}${searchBox('nk-q', 'q', S.q)}</div></div>` +
      (rows.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th>Müşteri</th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap</th><th class="r">Kilo</th><th>Beklenen</th><th></th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="nk-empty">Bekleyen yük yok. Müşterilerin yazdığı, henüz depoya gelmemiş yükler burada görünür.</div>') + '</section>';
  }

  function allView() {
    const rows = S.loads.filter(l => hit(l, S.q) && (!S.cust || l.customer_id === S.cust)).slice(0, 400);
    const chip = l => l.status === 'aracta' ? `<span class="nk-ch b">${esc((byId(S.trips, l.trip_id) || {}).poz_no || 'Araçta')}</span>` : l.status === 'depoda' ? '<span class="nk-ch g">Boşta</span>' : '<span class="nk-ch a">Bekliyor</span>';
    const body = rows.map(l => { const t = byId(S.trips, l.trip_id); return `<tr>${loadCells(l)}<td>${chip(l)}${t ? `<small>${esc(B.plates(t))}</small>` : ''}</td><td class="r">${l.status === 'aracta' ? '' : `<button type="button" class="nk-lnk" data-nk="edit-load" data-id="${l.id}">Düzenle</button>`}</td></tr>`; }).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Tüm yükler <span>${rows.length}</span></h2><div class="nk-bar-r">${custSelect()}${searchBox('nk-q', 'q', S.q)}</div></div>` +
      (rows.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th>Müşteri</th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap</th><th class="r">Kilo</th><th>Durum</th><th></th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="nk-empty">Kayıt yok.</div>') + '</section>';
  }

  function notice(title, text, retry) {
    return `<div class="nk-pn nk-note"><h2>${esc(title)}</h2><p>${text}</p>${retry ? '<button type="button" class="btn primary" data-nk="refresh">Yenile</button>' : ''}</div>`;
  }

  function inner() {
    if (S.missing) return notice('Nakliye programı için bir kerelik kurulum gerekli', 'Supabase içinde <b>SQL Editor</b>\'ü açıp <b>supabase/nakliye-kurulumu.sql</b> dosyasının içindekileri çalıştırın, sonra Yenile\'ye basın.', true);
    if (S.err && !S.ready) return notice('Nakliye açılamadı', esc(S.err), true);
    if (!S.ready) return '<div class="nk-pn nk-note"><p>Yükleniyor…</p></div>';
    const err = S.err ? `<div class="nk-warn">${esc(S.err)}</div>` : '';
    return err + kpis() + tabs() + (S.tab === 'trips' ? tripsView() : S.tab === 'wait' ? waitView() : S.tab === 'all' ? allView() : idleView());
  }

  function redraw() {
    const root = document.getElementById('nk-root');
    if (!root) return;
    const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd, y = window.scrollY;
    root.innerHTML = inner();
    if (id) { const el = document.getElementById(id); if (el && el !== document.activeElement) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (_) { /* tarih gibi alanlarda imleç yok */ } } }
    if (window.scrollY !== y) window.scrollTo(0, y);
  }
  // Yalnızca sağdaki paneli yeniler (plaka yazarken odak kaybolmasın)
  function redrawSide() {
    const side = document.getElementById('nk-side');
    if (side) side.innerHTML = panel();
    const k = document.querySelector('.nk-kpis');
    if (k) k.outerHTML = kpis();
  }

  function view() {
    if (!S.ready && !S.loading && !S.err && !S.missing) setTimeout(() => load(), 0);
    listen();
    return `<div id="nk-root" class="nk">${inner()}</div>`;
  }
  const actions = () => `<button type="button" class="btn" data-nk="refresh">${ic('refresh')}Yenile</button><button type="button" class="btn" data-nk="customers">${ic('building')}Müşteriler</button><button type="button" class="btn primary" data-nk="add-load">${ic('plus')}Yük ekle</button>`;

  // ------------------------------------------------------------------ belgeler
  function showDocs(trip, loads, which) {
    const c = cust(trip.customer_id) || { name: '', carrier: '', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '' };
    const items = [];
    if (which.lade) items.push({ label: 'Lade Liste', html: B.lade({ trip, customer: c, loads }) });
    if (which.cmr) items.push({ label: which.only ? 'CMR (tek yük)' : 'CMR', html: B.cmr({ trip, customer: c, loads, only: which.only }) });
    B.show(items, { title: `${trip.poz_no} · ${B.plates(trip)}` });
  }

  // ------------------------------------------------------------------ eylemler
  async function assign() {
    if (S.busy) return;
    const sl = selected(); if (!sl.length) return;
    const f = S.form, tractor = f.tractor.trim();
    if (!tractor) { X.toast('Çekici plakasını yazın', true); document.getElementById('nk-tractor')?.focus(); return; }
    S.busy = true; redrawSide();
    const ids = sl.map(l => l.id), keep = sl.map(l => ({ ...l })), docs = { lade: f.lade, cmr: f.cmr };
    const { data, error } = await X.client.rpc('shp_assign', { p_customer: sl[0].customer_id, p_load_ids: ids, p_tractor: tractor, p_trailer: f.trailer.trim(), p_depart: f.date || X.today(), p_subject: f.subject.trim() });
    S.busy = false;
    if (error) { X.toast(error.message || 'Araca atanamadı', true); await load(true); return; }
    const trip = data && data.trip;
    S.sel.clear(); S.form = { ...S.form, tractor: '', trailer: '', subject: '' };
    await load(true);
    if (trip) {
      X.toast(`${trip.poz_no} numarasıyla ${ids.length} yük ${B.plates(trip)} aracına atandı`);
      const fresh = S.loads.filter(l => l.trip_id === trip.id);
      showDocs(trip, fresh.length ? fresh : keep, docs.lade || docs.cmr ? docs : { lade: true, cmr: false });
    }
  }

  async function db(promise, okText) {
    const r = await promise;
    if (r.error) { X.toast(r.error.message || 'İşlem yapılamadı', true); return false; }
    if (okText) X.toast(okText);
    return true;
  }

  async function onClick(e) {
    const t = e.target.closest('[data-nk]'); if (!t || !X) return;
    const a = t.dataset.nk, id = t.dataset.id;
    if (a === 'tab') { S.tab = t.dataset.v; S.confirm = ''; redraw(); return; }
    if (a === 'refresh') { await load(); return; }
    if (a === 'pick') {
      if (S.sel.has(id)) S.sel.delete(id);
      else { const l = loadOf(id), sc = selCust(); if (l && sc && sc !== l.customer_id) { t.checked = false; X.toast('Bir sefer yalnızca tek müşterinin yüklerini taşıyabilir', true); return; } if (l) S.sel.add(id); }
      redraw(); return;
    }
    if (a === 'pick-all') {
      const sc = selCust() || S.cust; if (!sc) return;
      const rows = idleLoads().filter(l => l.customer_id === sc && hit(l, S.q));
      const all = rows.every(l => S.sel.has(l.id));
      rows.forEach(l => all ? S.sel.delete(l.id) : S.sel.add(l.id));
      redraw(); return;
    }
    if (a === 'unpick') { S.sel.delete(id); redraw(); return; }
    if (a === 'clear') { S.sel.clear(); redraw(); return; }
    if (a === 'assign') { await assign(); return; }
    if (a === 'toggle-trip') { S.open.has(id) ? S.open.delete(id) : S.open.add(id); S.confirm = ''; redraw(); return; }
    if (a === 'doc') {
      const trip = byId(S.trips, id); if (!trip) return;
      showDocs(trip, tripLoads(trip), t.dataset.kind === 'lade' ? { lade: true } : { cmr: true, only: t.dataset.load || undefined });
      return;
    }
    if (a === 'unassign') { if (await db(X.client.rpc('shp_unassign', { p_load_id: id }), 'Yük araçtan çıkarıldı, boşta listesine döndü')) await load(true); return; }
    if (a === 'del-trip') {
      if (S.confirm !== 'trip:' + id) { S.confirm = 'trip:' + id; redraw(); return; }
      S.confirm = '';
      if (await db(X.client.rpc('shp_delete_trip', { p_trip: id }), 'Sefer silindi, yükler boşta listesine döndü')) await load(true); else redraw();
      return;
    }
    if (a === 'arrive') { if (await db(X.client.from('shp_loads').update({ status: 'depoda', arrived_at: new Date().toISOString(), arrived_by: 'Operatör' }).eq('id', id), 'Yük boşta listesine alındı')) await load(true); return; }
    if (a === 'add-load') { loadForm(''); return; }
    if (a === 'edit-load') { loadForm(id); return; }
    if (a === 'customers') { customersModal(); return; }
    if (a === 'edit-cust') { customerForm(id); return; }
    if (a === 'back-cust') { customersModal(); return; }
    if (a === 'del-load') { await removeLoad(t); return; }
  }

  function onInput(e) {
    const t = e.target.closest('[data-nk-in]'); if (!t || !X) return;
    const k = t.dataset.nkIn, v = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'q') { S.q = v; redraw(); return; }
    if (k === 'tq') { S.tq = v; redraw(); return; }
    if (k === 'cust') { S.cust = v; redraw(); return; }
    if (k === 'f-tractor') S.form.tractor = v;
    else if (k === 'f-trailer') S.form.trailer = v;
    else if (k === 'f-date') S.form.date = v;
    else if (k === 'f-subject') S.form.subject = v;
    else if (k === 'f-lade') S.form.lade = v;
    else if (k === 'f-cmr') S.form.cmr = v;
  }

  // ------------------------------------------------------------------ yük formu (operatör ekler / düzenler)
  const fld = (name, label, val, o = {}) => `<div class="field ${o.full ? 'full' : ''}"><label for="nkf-${name}">${label}${o.opt ? ' <span class="optional">(isteğe bağlı)</span>' : ''}</label>` +
    (o.area ? `<textarea id="nkf-${name}" name="${name}" rows="2" maxlength="${o.max || 300}">${esc(val)}</textarea>` : `<input id="nkf-${name}" name="${name}" type="${o.type || 'text'}" value="${esc(val)}" maxlength="${o.max || 200}" ${o.req ? 'required' : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''} ${o.list ? `list="${o.list}"` : ''} autocomplete="off">`) + `</div>`;
  const head = (title, sub) => `<div class="modal-header"><div><h2 id="modal-title">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button type="button" class="icon-btn" data-action="close-modal" aria-label="Kapat">${ic('close')}</button></div>`;

  function loadForm(id) {
    const l = id ? loadOf(id) : { customer_id: S.cust || selCust() || (S.customers.find(c => c.active) || {}).id || '', sender: '', sender_addr: '', consignee: '', consignee_addr: '', notify: '', pieces: '', packing: 'KAP', goods: '', weight: '', volume: '', country: '', code: '', dest_customs: '', broker: '', expected_date: '', note: '', status: 'bekliyor' };
    if (!l) return;
    if (!S.customers.length) { X.toast('Önce Müşteriler bölümünden bir müşteri ekleyin', true); customersModal(); return; }
    const num = v => v == null || v === '' ? '' : String(v);
    X.openModal(`${head(id ? 'Yükü düzenle' : 'Yeni yük', 'Gönderici ve alıcı yazılmalı; diğer alanlar belge için kullanılır.')}<form data-nk-form="load" data-lid="${esc(id)}"><div class="modal-body"><div class="form-grid">
<div class="field full"><label for="nkf-customer">Müşteri</label><select id="nkf-customer" name="customer_id" required>${S.customers.filter(c => c.active || c.id === l.customer_id).map(c => `<option value="${c.id}" ${c.id === l.customer_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
${fld('sender', 'Gönderici', l.sender, { req: true })}${fld('consignee', 'Alıcı', l.consignee, { req: true })}
${fld('sender_addr', 'Gönderici adresi', l.sender_addr, { area: true, opt: true })}${fld('consignee_addr', 'Alıcı adresi', l.consignee_addr, { area: true, opt: true })}
${fld('notify', 'Notify (bildirim adresi)', l.notify, { area: true, opt: true, full: true })}
${fld('pieces', 'Kap adedi', num(l.pieces), { inputmode: 'numeric' })}${fld('packing', 'Ambalaj', l.packing, { max: 40, list: 'nk-packs' })}
${fld('goods', 'Mal cinsi', l.goods, { full: true })}
${fld('weight', 'Brüt kilo (kg)', num(l.weight), { inputmode: 'decimal' })}${fld('volume', 'Hacim (m³)', num(l.volume), { inputmode: 'decimal', opt: true })}
${fld('country', 'Ülke', l.country, { max: 60 })}${fld('dest_customs', 'Varış gümrük', l.dest_customs, { max: 80 })}
${fld('code', 'Gümrük kodu', l.code, { max: 40, opt: true })}${fld('broker', 'Gümrükçü', l.broker, { max: 120, opt: true })}
${fld('expected_date', 'Beklenen tarih', l.expected_date || '', { type: 'date', opt: true })}${fld('note', 'Not', l.note, { max: 500, opt: true })}
</div><datalist id="nk-packs"><option>KAP</option><option>PALET</option><option>KOLİ</option><option>RULO</option><option>BIG BAG</option><option>DÖKME</option></datalist>
${id ? '' : '<label class="form-chip nk-arr"><input type="checkbox" name="arrived" class="check"><span>Yük zaten depoda (boşta listesine ekle)</span></label>'}
<div id="nk-ferr" class="nk-ferr" hidden></div></div><div class="modal-footer">${id ? `<button type="button" class="btn danger" data-nk="del-load" data-id="${esc(id)}">Sil</button>` : ''}<span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Vazgeç</button><button type="submit" class="btn primary">${ic('check')}Kaydet</button></div></form>`);
  }

  async function removeLoad(btn) {
    if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Emin misiniz? Evet, sil'; return; }
    if (await db(X.client.from('shp_loads').delete().eq('id', btn.dataset.id), 'Yük silindi')) { X.closeModal(); S.sel.delete(btn.dataset.id); await load(true); }
  }

  async function saveLoad(form) {
    const fd = new FormData(form), g = k => String(fd.get(k) || '').trim().replace(/[\r\n\t]+/g, ' ');
    const err = m => { const el = document.getElementById('nk-ferr'); if (el) { el.textContent = m; el.hidden = false; } };
    if (!g('sender') || !g('consignee')) return err('Gönderici ve alıcı yazılmalı.');
    const w = parseNum(fd.get('weight')), v = parseNum(fd.get('volume')), pc = parseNum(fd.get('pieces'));
    if (Number.isNaN(w) || Number.isNaN(v) || Number.isNaN(pc)) return err('Kap, kilo ve hacim sayı olarak yazılmalı.');
    if ((w || 0) < 0 || (v || 0) < 0 || (pc || 0) < 0 || (pc || 0) % 1) return err('Kap, kilo ve hacim eksi ya da küsuratlı kap olamaz.');
    const row = {
      customer_id: g('customer_id'), sender: g('sender'), sender_addr: String(fd.get('sender_addr') || '').trim(), consignee: g('consignee'), consignee_addr: String(fd.get('consignee_addr') || '').trim(),
      notify: String(fd.get('notify') || '').trim(), pieces: pc || 0, packing: g('packing') || 'KAP', goods: g('goods'), weight: w || 0, volume: v == null ? null : v, country: g('country'),
      code: g('code'), dest_customs: g('dest_customs'), broker: g('broker'), expected_date: g('expected_date') || null, note: g('note')
    };
    const id = form.dataset.lid;
    let r;
    if (id) r = await X.client.from('shp_loads').update(row).eq('id', id);
    else {
      if (fd.get('arrived')) Object.assign(row, { status: 'depoda', arrived_at: new Date().toISOString(), arrived_by: 'Operatör' });
      r = await X.client.from('shp_loads').insert({ ...row, created_by: 'Operatör' });
    }
    if (r.error) return err(r.error.message || 'Kaydedilemedi');
    X.closeModal(); X.toast(id ? 'Yük güncellendi' : 'Yük eklendi');
    await load(true);
  }

  // ------------------------------------------------------------------ müşteriler
  function customersModal() {
    const rows = S.customers.map(c => `<li><span>${pill(c.id)}${c.active ? '' : ' <em>(kapalı)</em>'}<small>${esc((c.carrier || '').split('\n')[0] || 'Nakliyeci bilgisi yok')}</small></span><button type="button" class="btn small" data-nk="edit-cust" data-id="${c.id}">Düzenle</button></li>`).join('');
    X.openModal(`${head('Müşteriler', 'Her müşterinin belgelerinde kendi logosu ve nakliyeci bilgisi çıkar.')}<div class="modal-body"><ul class="nk-cl">${rows || '<li><span>Henüz müşteri yok.</span></li>'}</ul></div><div class="modal-footer"><span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Kapat</button><button type="button" class="btn primary" data-nk="edit-cust" data-id="">${ic('plus')}Yeni müşteri</button></div>`);
  }

  function customerForm(id) {
    const c = id ? cust(id) : { name: '', carrier: '', cmr_notes: B.DEFAULT_NOTES, loading_place: 'İSTANBUL - Turkey', logo: '', active: true };
    if (!c) return;
    X.openModal(`${head(id ? 'Müşteriyi düzenle' : 'Yeni müşteri', 'Bu bilgiler yalnızca bu müşterinin Lade Liste ve CMR belgelerinde kullanılır.')}<form data-nk-form="customer" data-cid="${esc(id)}"><div class="modal-body"><div class="form-grid">
${fld('name', 'Müşteri adı', c.name, { req: true, full: true, max: 120 })}
<div class="field full"><label for="nkf-carrier">Nakliyeci bilgisi <span class="optional">(CMR 16. kutu: ad, adres, telefon, e-posta)</span></label><textarea id="nkf-carrier" name="carrier" rows="4" maxlength="600">${esc(c.carrier)}</textarea></div>
<div class="field full"><label for="nkf-cmr_notes">Nakliyecinin şart ve mülahazaları <span class="optional">(CMR 18. kutu; her satır ayrı madde)</span></label><textarea id="nkf-cmr_notes" name="cmr_notes" rows="5" maxlength="1500">${esc(c.cmr_notes)}</textarea></div>
${fld('loading_place', 'Yükleme yeri (CMR 4. ve 21. kutu)', c.loading_place, { max: 120, full: true })}
<div class="field full"><label>Logo <span class="optional">(Lade Liste ve CMR üstünde; isteğe bağlı)</span></label><div class="nk-logo"><span id="nk-logo-prev">${c.logo ? `<img src="${esc(c.logo)}" alt="Logo">` : '<em>Logo yok</em>'}</span><input type="file" id="nk-logo-file" accept="image/png,image/jpeg,image/webp" aria-label="Logo seç"><button type="button" class="nk-lnk" id="nk-logo-clear">Logoyu kaldır</button></div><input type="hidden" name="logo" id="nk-logo-val" value="${esc(c.logo)}"></div>
${id ? `<label class="form-chip nk-arr"><input type="checkbox" name="active" class="check" ${c.active ? 'checked' : ''}><span>Müşteri açık (kapatılırsa yeni yük eklenemez)</span></label>` : ''}
</div><div id="nk-ferr" class="nk-ferr" hidden></div></div><div class="modal-footer"><button type="button" class="btn" data-nk="back-cust">Geri</button><span style="flex:1"></span><button type="submit" class="btn primary">${ic('check')}Kaydet</button></div></form>`);
  }

  // Logoyu küçültüp yazı (data:) olarak saklar; belgelerde ve müşteri sayfasında aynen kullanılır
  async function logoFrom(file) {
    const bmp = await createImageBitmap(file);
    const sc = Math.min(1, 360 / bmp.width, 140 / bmp.height), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * sc)); cv.height = Math.max(1, Math.round(bmp.height * sc));
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    let url = cv.toDataURL('image/png');
    if (url.length > 250000) url = cv.toDataURL('image/jpeg', 0.85);
    if (url.length > 280000) throw new Error('Logo çok büyük');
    return url;
  }

  async function saveCustomer(form) {
    const fd = new FormData(form), id = form.dataset.cid;
    const err = m => { const el = document.getElementById('nk-ferr'); if (el) { el.textContent = m; el.hidden = false; } };
    const name = String(fd.get('name') || '').trim().replace(/\s+/g, ' ');
    if (!name) return err('Müşteri adı yazılmalı.');
    const row = { name, carrier: String(fd.get('carrier') || '').trim(), cmr_notes: String(fd.get('cmr_notes') || '').trim(), loading_place: String(fd.get('loading_place') || '').trim() || 'İSTANBUL - Turkey', logo: String(fd.get('logo') || '') };
    if (id) row.active = !!fd.get('active');
    const r = id ? await X.client.from('shp_customers').update(row).eq('id', id) : await X.client.from('shp_customers').insert(row);
    if (r.error) return err(/23505|duplicate/.test(`${r.error.code} ${r.error.message}`) ? 'Bu adla bir müşteri zaten var.' : (r.error.message || 'Kaydedilemedi'));
    X.toast(id ? 'Müşteri güncellendi' : 'Müşteri eklendi');
    await load(true);
    customersModal();
  }

  // ------------------------------------------------------------------ kurulum
  let wired = false;
  function init(ctx) {
    X = ctx;
    if (wired) return; wired = true;
    document.addEventListener('click', e => { onClick(e).catch(() => X.toast('İşlem yapılamadı', true)); });
    document.addEventListener('input', onInput);
    document.addEventListener('change', e => {
      const t = e.target;
      if (t && t.id === 'nk-logo-file' && t.files && t.files[0]) {
        logoFrom(t.files[0]).then(url => { document.getElementById('nk-logo-val').value = url; document.getElementById('nk-logo-prev').innerHTML = `<img src="${esc(url)}" alt="Logo">`; }).catch(er => X.toast(er.message === 'Logo çok büyük' ? er.message : 'Resim okunamadı', true));
        return;
      }
      onInput(e);
    });
    document.addEventListener('click', e => {
      if (e.target && e.target.id === 'nk-logo-clear') { const v = document.getElementById('nk-logo-val'); if (v) v.value = ''; const p = document.getElementById('nk-logo-prev'); if (p) p.innerHTML = '<em>Logo yok</em>'; const f = document.getElementById('nk-logo-file'); if (f) f.value = ''; }
    });
    document.addEventListener('submit', e => {
      const f = e.target.closest && e.target.closest('form[data-nk-form]'); if (!f) return;
      e.preventDefault();
      (f.dataset.nkForm === 'load' ? saveLoad(f) : saveCustomer(f)).catch(() => X.toast('Kaydedilemedi', true));
    });
  }

  window.PCSNK = { init, view, actions, reload: () => load(true), state: S };
})();
