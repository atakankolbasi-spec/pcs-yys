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
    ready: false, loading: false, err: '', missing: false, customers: [], loads: [], trips: [], log: [], logMiss: false, msgs: [], outbox: [], newMiss: false, msgCust: '', msgBody: '', bub: false,
    tab: 'idle', syncing: false, tried: new Set(), sel: new Set(), cust: '', q: '', tq: '', open: new Set(), busy: false, confirm: '', rt: null,
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
      const [a, t, l, g, mg, ob] = await Promise.all([
        c.from('shp_customers').select('*').order('name'),
        c.from('shp_trips').select('*').order('created_at', { ascending: false }).limit(500),
        c.from('shp_loads').select('*').order('created_at', { ascending: false }).limit(3000),
        c.rpc('shp_log_list', { p_customer: null, p_limit: 400 }),
        c.from('shp_messages').select('*').order('id', { ascending: false }).limit(600),
        c.from('shp_outbox').select('*').in('status', ['bekliyor', 'hata']).order('id')
      ]);
      const e = a.error || t.error || l.error;
      if (e) {
        S.missing = /PGRST205|PGRST202|42P01|schema cache|does not exist/.test(`${e.code || ''} ${e.message || ''}`);
        S.err = S.missing ? '' : `Yüklenemedi: ${e.message || 'bilinmeyen hata'}`;
      } else {
        S.customers = a.data || []; S.trips = t.data || []; S.loads = l.data || [];
        S.log = g && !g.error && Array.isArray(g.data) ? g.data : []; S.logMiss = !!(g && g.error);
        S.msgs = mg && !mg.error && Array.isArray(mg.data) ? mg.data.filter(m => m.customer_id).reverse() : []; S.outbox = ob && !ob.error && Array.isArray(ob.data) ? ob.data : []; S.newMiss = !!((mg && mg.error) || (ob && ob.error));
        S.err = ''; S.missing = false; S.ready = true;
        for (const id of [...S.sel]) { const x = loadOf(id); if (!x || x.status !== 'depoda') S.sel.delete(id); }
      }
    } catch (_) {
      S.err = 'Bağlantı kurulamadı. İnternetinizi kontrol edip Yenile\'ye basın.';
    }
    S.loading = false;
    redraw();
    syncPano();
  }

  // Panodaki müşteriler (Plaka kayıtları ve araç geliş kayıtları) Nakliye müşterisi olarak kendiliğinden eklenir.
  // Ad büyük / küçük harf ve fazla boşluk farkına bakmadan karşılaştırılır; kapatılmış müşteri yeniden eklenmez.
  const nameKey = n => tr(String(n || '').replace(/\s+/g, ' ').trim());
  async function syncPano() {
    if (!X || !X.panoCustomers || !S.ready || S.syncing) return;
    const have = new Set(S.customers.map(c => nameKey(c.name))), add = new Map();
    for (const raw of X.panoCustomers()) {
      const name = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 120), k = nameKey(name);
      if (k && !have.has(k) && !add.has(k) && !S.tried.has(k)) add.set(k, name);
    }
    if (!add.size) return;
    S.syncing = true; add.forEach((_, k) => S.tried.add(k));
    const { error } = await X.client.from('shp_customers').insert([...add.values()].map(name => ({ name, carrier: '', cmr_notes: B.DEFAULT_NOTES, loading_place: 'İSTANBUL - Turkey', logo: '' })));
    S.syncing = false;
    if (!error) X.toast(`${add.size} müşteri panodan eklendi`);
    else if (!/23505|duplicate/.test(`${error.code} ${error.message}`)) X.toast('Panodaki müşteriler Nakliye\'ye eklenemedi', true);
    await load(true);
  }

  function listen() {
    if (S.rt || !X) return;
    try {
      let timer = null;
      const ping = () => { clearTimeout(timer); timer = setTimeout(() => { if (S.ready && document.getElementById('nk-root')) load(true); }, 500); };
      S.rt = X.client.channel('pcs-nakliye').on('postgres_changes', { event: '*', schema: 'public', table: 'shp_loads' }, ping)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shp_trips' }, ping)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shp_messages' }, ping).on('postgres_changes', { event: '*', schema: 'public', table: 'shp_outbox' }, ping);
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
    const t = [['idle', 'Boşta yükler', idleLoads().length], ['trips', 'Araçlar', S.trips.length], ['wait', 'Bekleyenler', waitLoads().length], ['all', 'Tüm yükler', S.loads.length], ['msg', 'Mesajlar', new Set(S.msgs.map(tk)).size], ['out', 'Bildirimler', S.outbox.length], ['log', 'Hareketler', S.log.length]];
    return `<div class="nk-tabs" role="tablist">${t.map(([k, l, n]) => `<button type="button" role="tab" class="${S.tab === k ? 'on' : ''}" aria-selected="${S.tab === k}" data-nk="tab" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div>`;
  }

  const custSelect = () => `<select id="nk-cust" data-nk-in="cust" aria-label="Müşteri süz"><option value="">Tüm müşteriler</option>${S.customers.map(c => `<option value="${c.id}" ${S.cust === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  const searchBox = (id, key, val) => `<label class="nk-search">${ic('search')}<input id="${id}" data-nk-in="${key}" type="search" value="${esc(val)}" placeholder="Ara: gönderici, alıcı, mal, plaka…" autocomplete="off" aria-label="Ara"></label>`;
  const hit = (l, q) => !q || [l.sender, l.consignee, l.goods, l.dest_customs, l.broker, l.note, l.inbound_plate, (cust(l.customer_id) || {}).name, (byId(S.trips, l.trip_id) || {}).poz_no, B.plates(byId(S.trips, l.trip_id))].some(x => tr(x).includes(tr(q)));

  const loadCells = l => `<td>${pill(l.customer_id)}</td><td><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small>${l.condition === 'eksik' || l.condition === 'hasarli' || (l.counted_pieces != null && l.counted_pieces !== l.pieces) ? `<small><span class="nk-ch r">${l.condition === 'hasarli' ? 'Hasarlı' : l.condition === 'eksik' ? 'Eksik var' : 'Sayım farkı'}</span>${l.receive_note ? ' ' + esc(l.receive_note) : ''}</small>` : ''}${l.location ? `<small>Konum: ${esc(l.location)}</small>` : ''}${l.inbound_plate ? `<small>Getirecek araç: <span class="nk-pl">${esc(l.inbound_plate)}</span></small>` : ''}</td><td>${esc(l.goods) || '—'}</td><td class="r">${esc(l.pieces)} ${esc(l.packing)}</td><td class="r">${kg(l.weight)}</td>`;

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
      const head = `<tr class="nk-trip ${open ? 'open' : ''}"><td><button type="button" class="nk-exp" data-nk="toggle-trip" data-id="${t.id}" aria-expanded="${open}" aria-label="Yükleri göster">${open ? '▾' : '▸'}</button></td><td><b class="nk-poz">${esc(t.poz_no)}</b>${t.created_by === 'Müşteri' ? '<small>Müşteri planladı</small>' : ''}${t.status === 'yolda' ? ' <span class="nk-ch b">Yolda · kilitli</span>' : t.status === 'teslim' ? ' <span class="nk-ch g">Teslim edildi</span>' : ''}${ls.some(l => !l.arrived_at) ? ` <span class="nk-ch a">${ls.filter(l => !l.arrived_at).length} yük depoya gelmedi</span>` : ''}</td>` +
        `<td><span class="nk-pl">${esc(t.tractor)}</span>${t.trailer ? `<span class="nk-pl alt">${esc(t.trailer)}</span>` : ''}</td><td>${pill(t.customer_id)}</td><td>${esc(dmy(t.depart_date))}</td><td class="r">${ls.length}</td><td class="r">${kg(sum(ls, 'weight'))} kg</td>` +
        `<td class="r"><button type="button" class="btn small" data-nk="doc" data-kind="lade" data-id="${t.id}">Lade Liste</button> <button type="button" class="btn small" data-nk="doc" data-kind="cmr" data-id="${t.id}">CMR</button></td></tr>`;
      if (!open) return head;
      const sub = ls.map((l, i) => `<tr><td>${esc(B.pozOf(t, i))}</td><td><b>${esc(l.sender)}</b><small>→ ${esc(l.consignee)}</small>${l.inbound_plate ? `<small>Getirecek araç: <span class="nk-pl">${esc(l.inbound_plate)}</span></small>` : ''}</td><td>${esc(l.goods) || '—'}</td><td>${esc(l.dest_customs) || '—'}</td><td class="r">${esc(l.pieces)} ${esc(l.packing)}</td><td class="r">${kg(l.weight)}</td>` +
        `<td>${l.arrived_at ? `<span class="nk-ch g">Depoda</span><small>${esc(stamp(l.arrived_at))}</small>` : `<span class="nk-ch a">Depoya gelmedi</span> <button type="button" class="nk-lnk" data-nk="arrive-trip" data-id="${l.id}">Geldi</button>`}</td><td class="r"><button type="button" class="nk-lnk" data-nk="doc" data-kind="cmr" data-id="${t.id}" data-load="${l.id}">CMR</button> <button type="button" class="nk-lnk" data-nk="edit-load" data-id="${l.id}">Düzenle</button> <button type="button" class="nk-lnk" data-nk="unassign" data-id="${l.id}">Araçtan çıkar</button></td></tr>`).join('');
      const del = S.confirm === 'trip:' + t.id
        ? `<button type="button" class="btn small danger" data-nk="del-trip" data-id="${t.id}">Evet, seferi sil</button>` : `<button type="button" class="btn small" data-nk="del-trip" data-id="${t.id}">Seferi sil (yükler boşa döner)</button>`;
      const miss = ls.filter(l => !l.arrived_at).length, askGo = S.confirm === 'go:' + t.id;
      const lock = t.status === 'hazirlaniyor' ? `<button type="button" class="btn small ${askGo ? 'danger' : ''}" data-nk="lock-trip" data-id="${t.id}" data-v="yolda">${askGo ? `Evet, ${miss} yük depoya gelmedi ama araç yola çıksın` : 'Yola çıktı (müşteri değiştiremesin)'}</button>`
        : `${t.status === 'yolda' ? `<button type="button" class="btn small primary" data-nk="lock-trip" data-id="${t.id}" data-v="teslim">Teslim edildi (müşteriye bildirilir)</button>` : ''}<button type="button" class="btn small" data-nk="lock-trip" data-id="${t.id}" data-v="hazirlaniyor">Kilidi aç (müşteri değiştirebilsin)</button>`;
      return head + `<tr class="nk-sub"><td></td><td colspan="7"><table class="nk-t inner"><thead><tr><th>CMR No</th><th>Gönderici → Alıcı</th><th>Mal</th><th>Varış</th><th class="r">Kap</th><th class="r">Kilo</th><th>Depo</th><th></th></tr></thead><tbody>${sub}</tbody></table><div class="nk-subact">${lock}${del}</div></td></tr>`;
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
    const body = rows.map(l => { const t = byId(S.trips, l.trip_id); return `<tr>${loadCells(l)}<td>${chip(l)}${t ? `<small>${esc(B.plates(t))}</small>` : ''}</td><td class="r"><button type="button" class="nk-lnk" data-nk="edit-load" data-id="${l.id}">Düzenle</button></td></tr>`; }).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Tüm yükler <span>${rows.length}</span></h2><div class="nk-bar-r">${custSelect()}${searchBox('nk-q', 'q', S.q)}</div></div>` +
      (rows.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th>Müşteri</th><th>Gönderici → Alıcı</th><th>Mal</th><th class="r">Kap</th><th class="r">Kilo</th><th>Durum</th><th></th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="nk-empty">Kayıt yok.</div>') + '</section>';
  }

  const waPhone = ph => { let d = String(ph || '').replace(/[^\d]/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '90' + d.slice(1); else if (d.length === 10 && d[0] === '5') d = '90' + d; return d; };
  // Yazışma müşteri ile depo arasındadır; ofis konuşmaları görür ve isterse yazar. Okundu işareti alıcıya (müşteri / depo) aittir: ofis okuyunca işaretlenmez.
  const dtm = iso => stamp(iso);
  const tk = m => m.customer_id;
  const thName = id => (cust(id) || {}).name || '?';
  const lastAt = id => { const ms = S.msgs.filter(m => tk(m) === id); return ms.length ? String(ms[ms.length - 1].created_at) : ''; };
  const curThread = () => {
    const ids = [...new Set(S.msgs.map(tk))];
    return S.msgCust && (ids.includes(S.msgCust) || cust(S.msgCust)) ? S.msgCust : (ids.sort((a, b) => lastAt(b).localeCompare(lastAt(a)))[0] || '');
  };
  const unread4depot = id => S.msgs.filter(m => tk(m) === id && m.from_role === 'musteri' && !m.read_at).length;   // depo henüz okumadı
  function msgView() {
    if (S.newMiss) return notice('Yazışma ve bildirimler kurulmamış', 'Bu bölüm için <b>supabase/nakliye-kurulumu.sql</b> dosyasının son halini Supabase SQL Editor\'de çalıştırın, sonra Yenile\'ye basın.', true);
    const by = {};
    S.msgs.forEach(m => { (by[tk(m)] = by[tk(m)] || []).push(m); });
    const ids = Object.keys(by).sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
    const cur = curThread() || (S.customers[0] || {}).id || '';
    const list = ids.length ? ids.map(id => { const ms = by[id], un = unread4depot(id), last = ms[ms.length - 1];
      return `<button type="button" class="nk-th ${id === cur ? 'on' : ''}" data-nk="msg-open" data-id="${id}"><b>${esc(thName(id))}</b>${un ? `<span class="nk-bdg" title="Depo henüz okumadı">${un}</span>` : ''}<small>${esc(String(last.body).slice(0, 60))}</small></button>`; }).join('') : '<div class="nk-empty">Henüz mesaj yok. Müşteriler sayfalarından depoya yazınca burada görünür.</div>';
    const thread = (by[cur] || []).map(msgBubble).join('');
    return `<section class="nk-pn nk-msgs"><div class="nk-bar"><h2>Mesajlar <span>${S.msgs.length}</span></h2><div class="nk-bar-r">${custSelect().replace('Tüm müşteriler', 'Müşteri seç')}</div></div>
<div class="nk-note2">Müşteriler <b>depoyla</b> yazışır, depo da müşteriyle. Burada bütün konuşmaları görürsünüz; isterseniz siz de yazabilirsiniz (müşteri "Ofis" olarak görür). Kırmızı sayı, müşterinin yazdığı ama deponun henüz okumadığı mesajlardır.</div>
<div class="nk-mg"><div class="nk-ths">${list}</div><div class="nk-thread"><div class="nk-mlist" id="nk-mlist">${thread || `<div class="nk-empty">${esc(thName(cur))} ile henüz yazışma yok.</div>`}</div>
${cur ? `<form data-nk-form="reply" data-cid="${cur}" class="nk-reply"><textarea id="nk-reply" data-nk-in="msg-body" rows="2" maxlength="1000" placeholder="${esc(thName(cur))} için yazın…">${esc(S.msgBody)}</textarea><button type="submit" class="btn primary">${ic('check')}Gönder</button></form>` : ''}</div></div></section>`;
  }
  const msgBubble = m => { const mine = m.from_role === 'ofis', l = m.load_id && loadOf(m.load_id), t = m.trip_id && byId(S.trips, m.trip_id);
    return `<div class="nk-m ${mine ? 'me' : 'o'}">${esc(m.body).replace(/\n/g, '<br>')}${l ? `<span class="nk-lk2">${esc(l.sender)} → ${esc(l.consignee)}</span>` : t ? `<span class="nk-lk2">${esc(t.poz_no)} · ${esc(t.tractor)}</span>` : ''}<small>${esc(dtm(m.created_at))} · ${esc(mine ? 'Ofis' : m.author || (m.from_role === 'depo' ? 'Depo' : 'Müşteri'))}</small></div>`; };
  // Mesaj balonu simgeleri (uygulamanın simge listesinde yok)
  const svg = d => `<svg class="nk-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const BIC = { chat: svg('<path d="M4 5h16v11H9l-5 4z"/>'), send: svg('<path d="M21 3L10 14M21 3l-7 18-4-8-8-4z"/>'), close: svg('<path d="M6 6l12 12M6 18L18 6"/>') };
  // Mesaj balonu (sayfanın sağ altı): müşteri ile depo yazışmalarına hızlı bakış; konuşma seçilir, isterseniz yazarsınız
  function msgBubbleHtml() {
    if (S.newMiss) return '';
    let panel = '';
    if (S.bub) {
      const cur = curThread() || (S.customers[0] || {}).id || '';
      const ids = new Set(S.msgs.map(tk));
      const opts = S.customers.filter(c => c.active || ids.has(c.id)).map(c => ({ id: c.id, name: c.name, un: unread4depot(c.id), at: lastAt(c.id) }))
        .sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name, 'tr'));
      const thread = S.msgs.filter(m => tk(m) === cur).map(msgBubble).join('');
      panel = `<div class="nk-cpanel" id="nk-cpanel" role="dialog" aria-label="Nakliye mesajları"><div class="nk-chead"><span class="nk-cava">PCS</span><div><b>Nakliye mesajları</b><small>Müşteri ve depo yazışmaları</small></div><button type="button" class="nk-cx" data-nk="bub-close" aria-label="Kapat">${BIC.close}</button></div>
<div class="nk-csel"><select data-nk-in="bub-th" aria-label="Müşteri seç">${opts.map(o => `<option value="${esc(o.id)}" ${o.id === cur ? 'selected' : ''}>${esc(o.name)}${o.un ? ` (${o.un} okunmadı)` : ''}</option>`).join('')}</select></div>
<div class="nk-cmsgs" id="nk-bmlist">${thread || `<div class="nk-cempty">${esc(thName(cur))} ile henüz yazışma yok.</div>`}</div>
<form data-nk-form="reply" data-cid="${esc(cur)}" class="nk-cform"><textarea id="nk-breply" data-nk-in="msg-body" rows="2" maxlength="1000" placeholder="${esc(thName(cur))} için yazın…" aria-label="Mesajınız">${esc(S.msgBody)}</textarea><button type="submit" class="nk-csend" aria-label="Gönder">${BIC.send}</button></form></div>`;
    }
    return `<div class="nk-cwrap">${panel}<button type="button" class="nk-cfab ${S.bub ? 'open' : ''}" id="nk-cfab" data-nk="bub-toggle" title="Müşteri ve depo yazışmaları" aria-label="Müşteri ve depo yazışmaları" aria-expanded="${!!S.bub}">${S.bub ? BIC.close : BIC.chat}</button></div>`;
  }
  // Bildirimler: kuyruktaki haberler müşteri ve konuya göre birleşir; tek tıkla WhatsApp'ta gönderilir
  const EVT = { geldi: ['📦 Yükünüz depoya geldi', 'Depoya geldi'], yola: ['🚚 Aracınız yola çıktı', 'Yola çıktı'], teslim: ['✅ Yükünüz teslim edildi', 'Teslim'], sorun: ['⚠️ Yükünüzde sorun bildirildi', 'Sorun'], mesaj: ['💬 Yeni mesaj', 'Mesaj'] };
  function outGroups() {
    const m = new Map();
    S.outbox.forEach(o => { const k = o.customer_id + '|' + o.event + '|' + o.phone; if (!m.has(k)) m.set(k, { key: k, customer_id: o.customer_id, event: o.event, phone: o.phone, items: [], err: '' }); const g = m.get(k); g.items.push(o); if (o.status === 'hata' && o.error && !g.err) g.err = o.error; });
    return [...m.values()];
  }
  const outText = g => `${EVT[g.event][0]}\n${g.items.map(o => o.body).join('\n')}${g.event === 'yola' ? '\nLade Liste ve CMR belgeleriniz hazır.' : ''}`;
  function outView() {
    if (S.newMiss) return notice('Yazışma ve bildirimler kurulmamış', 'Bu bölüm için <b>supabase/nakliye-kurulumu.sql</b> dosyasının son halini Supabase SQL Editör\'de çalıştırın, sonra Yenile\'ye basın.', true);
    const gs = outGroups();
    const rows = gs.map((g, i) => `<li><div><b>${esc((cust(g.customer_id) || {}).name || '?')}</b> <span class="nk-ch ${g.event === 'sorun' ? 'a' : 'b'}">${EVT[g.event][1]}</span>${g.err ? '<span class="nk-ch r">Gönderilemedi</span>' : ''}<small>${esc(g.phone)} · ${g.items.length} haber · ${esc(dtm(g.items[0].created_at))}</small>${g.err ? `<small class="nk-err">${esc(g.err)}</small>` : ''}<pre class="nk-pre">${esc(outText(g))}</pre></div>
<div class="nk-lk-a"><button type="button" class="btn small primary" data-nk="out-send" data-i="${i}">${ic('send')}WhatsApp'ta gönder</button><button type="button" class="btn small" data-nk="out-done" data-i="${i}">Gönderildi say</button><button type="button" class="btn small" data-nk="out-skip" data-i="${i}">Gönderme</button></div></li>`).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Bildirimler <span>${gs.length}</span></h2></div><div class="nk-note2">Müşterilerin seçtiği haberler (depoya geldi, yola çıktı, teslim, sorun, mesaj) <b>WhatsApp'tan kendiliğinden gider</b> (kurulum: <b>supabase/NAKLIYE.md</b> > "Otomatik bildirim"). Burada yalnızca henüz gönderilemeyenler görünür: kurulum yapılmadıysa hepsi, gönderilemeyenlerin nedeni yazar. <b>WhatsApp'ta gönder</b> mesajı hazır halde açar; gönderdikten sonra <b>Gönderildi say</b> deyin.</</div>
${gs.length ? `<ul class="nk-ol">${rows}</ul>` : '<div class="nk-empty">Gönderilecek bildirim yok. Haberler kendiliğinden gidiyorsa ya da müşteri bildirim numarasını yazmadıysa burası boş kalır.</div>'}</section>`;
  }
  const ROLE = { musteri: ['Müşteri', 'b'], depo: ['Depo', 'g'], operator: ['Ofis', 'a'] };
  function logView() {
    if (S.logMiss) return notice('Hareket kaydı kurulmamış', 'Kim neyi yaptı kaydı için <b>supabase/nakliye-kurulumu.sql</b> dosyasının son halini Supabase SQL Editor\'de çalıştırın, sonra Yenile\'ye basın.', true);
    const rows = S.log.filter(x => (!S.cust || x.customer_id === S.cust) && (!S.q || [x.actor, x.action, x.summary, x.customer].some(v => tr(v).includes(tr(S.q)))));
    const body = rows.map(x => { const [rl, rc] = ROLE[x.role] || ROLE.operator; return `<tr><td class="nk-nowrap">${esc(stamp(x.at))}</td><td>${esc(x.customer || '—')}</td><td><span class="nk-ch ${rc}">${rl}</span> ${esc(x.actor)}</td><td><b>${esc(x.action)}</b></td><td>${esc(x.summary)}</td></tr>`; }).join('');
    return `<section class="nk-pn"><div class="nk-bar"><h2>Hareketler <span>${rows.length}</span></h2><div class="nk-bar-r">${custSelect()}<label class="nk-search">${ic('search')}<input id="nk-q" data-nk-in="q" type="search" value="${esc(S.q)}" placeholder="Ara: kullanıcı, işlem, yük…" autocomplete="off" aria-label="Ara"></label></div></div>` +
      (rows.length ? `<div class="nk-scroll"><table class="nk-t"><thead><tr><th>Zaman</th><th>Müşteri</th><th>Kim</th><th>İşlem</th><th>Ayrıntı</th></tr></thead><tbody>${body}</tbody></table></div>` : '<div class="nk-empty">Henüz hareket yok. Müşteri, depo ya da ofis bir işlem yaptıkça burada görünür.</div>') + '</section>';
  }

  function notice(title, text, retry) {
    return `<div class="nk-pn nk-note"><h2>${esc(title)}</h2><p>${text}</p>${retry ? '<button type="button" class="btn primary" data-nk="refresh">Yenile</button>' : ''}</div>`;
  }

  function inner() {
    if (S.missing) return notice('Nakliye programı için bir kerelik kurulum gerekli', 'Supabase içinde <b>SQL Editor</b>\'ü açıp <b>supabase/nakliye-kurulumu.sql</b> dosyasının içindekileri çalıştırın, sonra Yenile\'ye basın.', true);
    if (S.err && !S.ready) return notice('Nakliye açılamadı', esc(S.err), true);
    if (!S.ready) return '<div class="nk-pn nk-note"><p>Yükleniyor…</p></div>';
    const err = S.err ? `<div class="nk-warn">${esc(S.err)}</div>` : '';
    return err + kpis() + tabs() + (S.tab === 'trips' ? tripsView() : S.tab === 'wait' ? waitView() : S.tab === 'all' ? allView() : S.tab === 'log' ? logView() : S.tab === 'msg' ? msgView() : S.tab === 'out' ? outView() : idleView()) + msgBubbleHtml();
  }

  function redraw() {
    const root = document.getElementById('nk-root');
    if (!root) return;
    const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd, y = window.scrollY;
    // sohbet listeleri baştan çizilir: kaydırma konumu korunur (altta olan altta kalır, yukarıda okuyan yerinde kalır)
    const keep = ['nk-mlist', 'nk-bmlist'].map(i => { const el = document.getElementById(i); return el ? { i, top: el.scrollTop, end: el.scrollHeight - el.scrollTop - el.clientHeight < 40 } : null; }).filter(Boolean);
    root.innerHTML = inner();
    keep.forEach(k => { const el = document.getElementById(k.i); if (el) el.scrollTop = k.end ? el.scrollHeight : k.top; });
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
    else if (S.ready) setTimeout(syncPano, 0);
    listen();
    return `<div id="nk-root" class="nk">${inner()}</div>`;
  }
  const actions = () => `<button type="button" class="btn" data-nk="refresh">${ic('refresh')}Yenile</button><button type="button" class="btn" data-nk="customers">${ic('building')}Müşteriler</button><button type="button" class="btn" data-nk="links">${ic('doc')}Bağlantılar</button><button type="button" class="btn primary" data-nk="add-load">${ic('plus')}Yük ekle</button>`;

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
    if (a === 'arrive-trip') { if (await db(X.client.from('shp_loads').update({ arrived_at: new Date().toISOString(), arrived_by: 'Operatör' }).eq('id', id), 'Yük depoya geldi olarak işaretlendi')) await load(true); return; }
    if (a === 'lock-trip') {
      const v = t.dataset.v, tp = byId(S.trips, id);
      if (v === 'yolda' && tp && tripLoads(tp).some(l => !l.arrived_at) && S.confirm !== 'go:' + id) { S.confirm = 'go:' + id; redraw(); return; }
      S.confirm = '';
      if (await db(X.client.from('shp_trips').update({ status: v }).eq('id', id), v === 'yolda' ? 'Sefer kilitlendi; müşteri artık değiştiremez' : v === 'teslim' ? 'Sefer teslim edildi olarak işaretlendi' : 'Kilit açıldı; müşteri değiştirebilir')) await load(true); else redraw();
      return;
    }
    if (a === 'add-load') { loadForm(''); return; }
    if (a === 'edit-load') { loadForm(id); return; }
    if (a === 'customers') { customersModal(); return; }
    if (a === 'links') { await linksModal(); return; }
    if (a.startsWith('lk-')) { await linkAction(a, t); return; }
    if (a === 'edit-cust') { customerForm(id); return; }
    if (a === 'back-cust') { customersModal(); return; }
    if (a === 'bub-toggle') { S.bub = !S.bub; redraw(); if (S.bub) { const el = document.getElementById('nk-bmlist'); if (el) el.scrollTop = el.scrollHeight; const ta = document.getElementById('nk-breply'); if (ta) ta.focus(); } return; }
    if (a === 'bub-close') { S.bub = false; redraw(); return; }
    if (a === 'msg-open') {
      S.msgCust = id; redraw();
      return;
    }
    if (a === 'out-send' || a === 'out-done' || a === 'out-skip') {
      const g = outGroups()[Number(t.dataset.i)]; if (!g) return;
      if (a === 'out-send') X.wa(waPhone(g.phone), outText(g));
      const ids = g.items.map(o => o.id);
      const upd = a === 'out-skip' ? { status: 'iptal' } : { status: 'gonderildi', sent_at: new Date().toISOString() };
      if (a !== 'out-send') { const r = await X.client.from('shp_outbox').update(upd).in('id', ids); if (r.error) X.toast(r.error.message || 'Kaydedilemedi', true); else { S.outbox = S.outbox.filter(o => !ids.includes(o.id)); redraw(); } }
      return;
    }
    if (a === 'ph-big') {
      const r = await X.client.from('shp_photos').select('data').eq('id', id); const big = document.getElementById('nk-phbig');
      if (big && !r.error && r.data && r.data[0]) big.innerHTML = `<img class="nk-phimg" src="${esc(r.data[0].data)}" alt="Yük fotoğrafı">`;
      return;
    }
    if (a === 'users') { await usersModal(id); return; }
    if (a === 'users-back') { drawUsers(); return; }
    if (a === 'edit-user') { userForm(id); return; }
    if (a === 'del-user') {
      if (S.confirm !== 'usr:' + id) { S.confirm = 'usr:' + id; drawUsers(); return; }
      S.confirm = '';
      const r = await X.client.rpc('shp_user_delete', { p_id: id });
      if (r.error) { X.toast(r.error.message || 'Silinemedi', true); drawUsers(); return; }
      UL.list = UL.list.filter(u => u.id !== id); X.toast('Kullanıcı silindi'); drawUsers(); load(true); return;
    }
    if (a === 'user-copy') { X.toast(await copyText(loginUrl()) ? 'Giriş adresi kopyalandı' : 'Kopyalanamadı; kutudan elle kopyalayın', false); return; }
    if (a === 'user-wa') { X.wa('', `${(cust(UL.cid) || {}).name || ''} nakliye programı giriş adresi: ${loginUrl()} (kullanıcı adı ve şifreyi ayrıca ileteceğiz)`); return; }
    if (a === 'pw-gen') { const el = document.getElementById('nkf-password'); if (el) { el.value = rndPw(); el.focus(); } return; }
    if (a === 'del-load') { await removeLoad(t); return; }
  }

  function onInput(e) {
    const t = e.target.closest('[data-nk-in]'); if (!t || !X) return;
    const k = t.dataset.nkIn, v = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'q') { S.q = v; redraw(); return; }
    if (k === 'tq') { S.tq = v; redraw(); return; }
    if (k === 'cust') { if (S.tab === 'msg') S.msgCust = v; S.cust = v; redraw(); return; }
    if (k === 'msg-body') { S.msgBody = v; return; }
    if (k === 'bub-th') { S.msgCust = v; redraw(); const el = document.getElementById('nk-bmlist'); if (el) el.scrollTop = el.scrollHeight; return; }
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
    const l = id ? loadOf(id) : { customer_id: S.cust || selCust() || (S.customers.find(c => c.active) || {}).id || '', sender: '', sender_addr: '', consignee: '', consignee_addr: '', notify: '', pieces: '', packing: 'KAP', goods: '', weight: '', volume: '', country: '', code: '', dest_customs: '', broker: '', expected_date: '', inbound_plate: '', note: '', status: 'bekliyor' };
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
${fld('expected_date', 'Beklenen tarih', l.expected_date || '', { type: 'date', opt: true })}${fld('expected_time', 'Beklenen saat (depoya varış)', l.expected_time || '', { type: 'time', opt: true })}${fld('inbound_plate', 'Yükü getirecek kamyon plakası', l.inbound_plate || '', { max: 40, opt: true })}${fld('driver', 'Şoför adı ve telefonu', l.driver || '', { max: 80, opt: true })}
${fld('note', 'Not', l.note, { max: 500, opt: true, full: true })}
${id && l.arrived_at ? `<div class="field full nk-rc"><label>Depo teslim bilgisi</label><div class="nk-rcbox"><div>${l.condition === 'eksik' ? '<span class="nk-ch r">Eksik var</span>' : l.condition === 'hasarli' ? '<span class="nk-ch r">Hasarlı</span>' : l.condition === 'saglam' ? '<span class="nk-ch g">Sağlam</span>' : '<span class="nk-ch">Durum girilmedi</span>'} Beyan ${esc(l.pieces)} kap · sayılan ${l.counted_pieces == null ? '—' : esc(l.counted_pieces)}${l.counted_weight != null ? ` · tartı ${kg(l.counted_weight)} kg` : ''}${l.location ? ` · konum ${esc(l.location)}` : ''}${l.receive_note ? `<br>${esc(l.receive_note)}` : ''}</div><div id="nk-phs" class="nk-phs"></div><div id="nk-phbig"></div></div></div>` : ''}
</div><datalist id="nk-packs"><option>KAP</option><option>PALET</option><option>KOLİ</option><option>RULO</option><option>BIG BAG</option><option>DÖKME</option></datalist>
${id ? '' : '<label class="form-chip nk-arr"><input type="checkbox" name="arrived" class="check"><span>Yük zaten depoda (boşta listesine ekle)</span></label>'}
<div id="nk-ferr" class="nk-ferr" hidden></div></div><div class="modal-footer">${id && l.status !== 'aracta' ? `<button type="button" class="btn danger" data-nk="del-load" data-id="${esc(id)}">Sil</button>` : ''}${id && l.status === 'aracta' ? '<small class="nk-hint2">Araçtaki yük silinemez; önce araçtan çıkarın.</small>' : ''}<span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Vazgeç</button><button type="submit" class="btn primary">${ic('check')}Kaydet</button></div></form>`);
    if (id && l.arrived_at) loadPhotos(id);
  }
  // Depo fotoğrafları: küçük resimler açılışta, büyük resim tıklayınca yüklenir
  async function loadPhotos(lid) {
    const r = await X.client.from('shp_photos').select('id,thumb,created_at,by_name').eq('load_id', lid).order('created_at');
    const box = document.getElementById('nk-phs'); if (!box || r.error || !(r.data || []).length) return;
    box.innerHTML = r.data.map(p => `<button type="button" class="nk-pht" data-nk="ph-big" data-id="${esc(p.id)}" aria-label="Fotoğrafı büyüt"><img src="${esc(p.thumb)}" alt=""></button>`).join('');
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
      code: g('code'), dest_customs: g('dest_customs'), broker: g('broker'), expected_date: g('expected_date') || null, expected_time: g('expected_time') || null, driver: g('driver'), inbound_plate: g('inbound_plate').toUpperCase(), note: g('note')
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
    const rows = S.customers.map(c => `<li><span>${pill(c.id)}${c.active ? '' : ' <em>(kapalı)</em>'}<small>${esc((c.carrier || '').split('\n')[0] || 'Nakliyeci bilgisi yok')}</small></span><span class="nk-ua"><button type="button" class="btn small" data-nk="users" data-id="${c.id}">Kullanıcılar</button><button type="button" class="btn small" data-nk="edit-cust" data-id="${c.id}">Düzenle</button></span></li>`).join('');
    X.openModal(`${head('Müşteriler', 'Panodaki müşteriler buraya kendiliğinden eklenir. Her müşterinin belgelerinde kendi logosu ve nakliyeci bilgisi çıkar.')}<div class="modal-body"><ul class="nk-cl">${rows || '<li><span>Henüz müşteri yok.</span></li>'}</ul></div><div class="modal-footer"><span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Kapat</button><button type="button" class="btn primary" data-nk="edit-cust" data-id="">${ic('plus')}Yeni müşteri</button></div>`);
  }

  function customerForm(id) {
    const c = id ? cust(id) : { name: '', carrier: '', cmr_notes: B.DEFAULT_NOTES, loading_place: 'İSTANBUL - Turkey', logo: '', active: true };
    if (!c) return;
    X.openModal(`${head(id ? 'Müşteriyi düzenle' : 'Yeni müşteri', 'Bu bilgiler yalnızca bu müşterinin Lade Liste ve CMR belgelerinde kullanılır.')}<form data-nk-form="customer" data-cid="${esc(id)}"><div class="modal-body"><div class="form-grid">
${fld('name', 'Müşteri adı', c.name, { req: true, full: true, max: 120 })}
<div class="field full"><label for="nkf-carrier">Nakliyeci bilgisi <span class="optional">(CMR 16. kutu: ad, adres, telefon, e-posta)</span></label><textarea id="nkf-carrier" name="carrier" rows="4" maxlength="600">${esc(c.carrier)}</textarea></div>
<div class="field full"><label for="nkf-cmr_notes">Nakliyecinin şart ve mülahazaları <span class="optional">(CMR 18. kutu; her satır ayrı madde)</span></label><textarea id="nkf-cmr_notes" name="cmr_notes" rows="5" maxlength="1500">${esc(c.cmr_notes)}</textarea></div>
${fld('loading_place', 'Yükleme yeri (CMR 4. ve 21. kutu)', c.loading_place, { max: 120, full: true })}
${fld('notify_phone', 'Bildirim telefonu (WhatsApp; müşteri sayfasından da değiştirebilir)', c.notify_phone || '', { max: 30, full: true, opt: true })}
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
    const row = { name, carrier: String(fd.get('carrier') || '').trim(), cmr_notes: String(fd.get('cmr_notes') || '').trim(), loading_place: String(fd.get('loading_place') || '').trim() || 'İSTANBUL - Turkey', logo: String(fd.get('logo') || ''), notify_phone: String(fd.get('notify_phone') || '').trim().slice(0, 30) };
    if (id) row.active = !!fd.get('active');
    const r = id ? await X.client.from('shp_customers').update(row).eq('id', id) : await X.client.from('shp_customers').insert(row);
    if (r.error) return err(/23505|duplicate/.test(`${r.error.code} ${r.error.message}`) ? 'Bu adla bir müşteri zaten var.' : (r.error.message || 'Kaydedilemedi'));
    X.toast(id ? 'Müşteri güncellendi' : 'Müşteri eklendi');
    await load(true);
    customersModal();
  }

  async function sendReply(form) {
    const body = S.msgBody.trim(), cid = form.dataset.cid;
    if (!body || !cid) return;
    const r = await X.client.from('shp_messages').insert({ customer_id: cid, from_role: 'ofis', body });
    if (r.error) { X.toast(r.error.message || 'Gönderilemedi', true); return; }
    S.msgBody = ''; X.toast('Cevabınız gönderildi'); await load(true);
    for (const id of ['nk-mlist', 'nk-bmlist']) { const el = document.getElementById(id); if (el) el.scrollTop = el.scrollHeight; }
  }

  // ------------------------------------------------------------------ müşteri kullanıcıları (kullanıcı adı ve şifre)
  // Müşteriye kullanıcı eklenince müşteri sayfası yalnızca bu kullanıcılarla açılır; her işlem kullanıcının adıyla kaydedilir (Hareketler).
  const UL = { cid: '', list: [] };
  const loginUrl = () => new URL('nakliye.html', location.href).href;
  const rndPw = () => { const al = 'abcdefghjkmnpqrstuvwxyz23456789', b = new Uint32Array(8); crypto.getRandomValues(b); return [...b].map(n => al[n % al.length]).join(''); };
  async function usersModal(cid) {
    const c = cust(cid); if (!c) return;
    UL.cid = cid; S.confirm = '';
    X.openModal(`${head(`${c.name} · Kullanıcılar`, '')}<div class="modal-body"><p>Yükleniyor…</p></div>`);
    const r = await X.client.rpc('shp_users_list', { p_customer: cid });
    if (r.error) {
      const miss = /PGRST202|42883|schema cache|Could not find the function/.test(`${r.error.code} ${r.error.message}`);
      X.openModal(`${head(`${c.name} · Kullanıcılar`, '')}<div class="modal-body"><p>${miss ? 'Kullanıcılar için nakliye-kurulumu.sql\'in son hali çalıştırılmamış.' : esc(r.error.message || 'Yüklenemedi')}</p></div><div class="modal-footer"><button type="button" class="btn" data-nk="back-cust">Geri</button></div>`);
      return;
    }
    UL.list = r.data || []; drawUsers();
  }
  function drawUsers() {
    const c = cust(UL.cid); if (!c) return;
    const rows = UL.list.map(u => `<li class="${u.active ? '' : 'off'}"><span><b>${esc(u.display_name || u.username)}</b>${u.active ? '' : ' <em>(pasif)</em>'}<small>Kullanıcı adı: <code>${esc(u.username)}</code> · ${u.last_login_at ? `Son giriş ${esc(stamp(u.last_login_at))}` : 'Henüz giriş yapmadı'}</small></span><span class="nk-ua"><button type="button" class="btn small" data-nk="edit-user" data-id="${esc(u.id)}">Düzenle</button><button type="button" class="btn small ${S.confirm === 'usr:' + u.id ? 'danger' : ''}" data-nk="del-user" data-id="${esc(u.id)}">${S.confirm === 'usr:' + u.id ? 'Evet, sil' : 'Sil'}</button></span></li>`).join('');
    X.openModal(`${head(`${c.name} · Kullanıcılar`, 'Kullanıcı adlarını ve şifreleri siz belirlersiniz. Müşterinin yaptığı her işlem kullanıcının adıyla kaydedilir (Hareketler sekmesi).')}<div class="modal-body">
<div class="nk-info"><b>Giriş adresi</b><input type="text" readonly value="${esc(loginUrl())}" aria-label="Giriş adresi" onfocus="this.select()"><div class="nk-lk-a"><button type="button" class="btn small" data-nk="user-copy">Kopyala</button><button type="button" class="btn small" data-nk="user-wa">WhatsApp</button></div>
<small>${UL.list.length ? 'Bu müşteriye kullanıcı tanımlı olduğu için müşteri bağlantısı (?m=…) tek başına çalışmaz; kullanıcı adı ve şifre sorulur.' : 'Henüz kullanıcı yok: müşteri bağlantısı şifresiz açılır. İlk kullanıcıyı ekleyince giriş zorunlu olur.'}</small></div>
<ul class="nk-cl">${rows || '<li><span>Henüz kullanıcı yok.</span></li>'}</ul></div><div class="modal-footer"><button type="button" class="btn" data-nk="back-cust">Geri</button><span style="flex:1"></span><button type="button" class="btn primary" data-nk="edit-user" data-id="">${ic('plus')}Yeni kullanıcı</button></div>`);
  }
  function userForm(uid) {
    const u = uid ? UL.list.find(x => x.id === uid) : { username: '', display_name: '', active: true };
    if (!u) return;
    X.openModal(`${head(uid ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı', 'Şifreyi müşteriye siz iletirsiniz. Şifre yalnızca sunucuda şifreli saklanır; sonradan görülemez, yalnızca yenisi verilebilir.')}<form data-nk-form="user" data-uid="${esc(uid)}" autocomplete="off"><div class="modal-body"><div class="form-grid">
${fld('username', 'Kullanıcı adı <span class="optional">(küçük harf, rakam, nokta, tire, alt çizgi; 3-40 karakter)</span>', u.username, { req: true, full: true, max: 40 })}
${fld('display_name', 'Görünen ad <span class="optional">(işlem kayıtlarında bu ad çıkar)</span>', u.display_name, { full: true, max: 80, opt: true })}
<div class="field full"><label for="nkf-password">Şifre${uid ? ' <span class="optional">(boş bırakırsanız değişmez)</span>' : ''}</label><div class="nk-pw"><input id="nkf-password" name="password" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="100" ${uid ? '' : 'required'} placeholder="En az 6 karakter"><button type="button" class="btn small" data-nk="pw-gen">Şifre öner</button></div></div>
${uid ? `<label class="form-chip nk-arr"><input type="checkbox" name="active" class="check" ${u.active ? 'checked' : ''}><span>Kullanıcı açık (kapatılırsa giriş yapamaz)</span></label>` : ''}
</div><div id="nk-ferr" class="nk-ferr" hidden></div></div><div class="modal-footer"><button type="button" class="btn" data-nk="users-back">Geri</button><span style="flex:1"></span><button type="submit" class="btn primary">${ic('check')}Kaydet</button></div></form>`);
    document.getElementById('nkf-username')?.focus();
  }
  async function saveUser(form) {
    const fd = new FormData(form), uid = form.dataset.uid;
    const err = m => { const el = document.getElementById('nk-ferr'); if (el) { el.textContent = m; el.hidden = false; } };
    const un = String(fd.get('username') || '').trim().toLowerCase(), pw = String(fd.get('password') || '');
    if (!/^[a-z0-9._-]{3,40}$/.test(un)) return err('Kullanıcı adı 3-40 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ya da alt çizgi kullanın.');
    if (!uid && pw.length < 6) return err('Şifre en az 6 karakter olmalı.');
    if (uid && pw && pw.length < 6) return err('Şifre en az 6 karakter olmalı.');
    const r = await X.client.rpc('shp_user_save', { p_id: uid || null, p_customer: UL.cid, p_username: un, p_name: String(fd.get('display_name') || '').trim(), p_password: pw, p_active: uid ? !!fd.get('active') : true });
    if (r.error) return err(r.error.message || 'Kaydedilemedi');
    X.toast(uid ? (pw ? 'Kullanıcı güncellendi, yeni şifre geçerli' : 'Kullanıcı güncellendi') : 'Kullanıcı eklendi');
    await usersModal(UL.cid);
    load(true);
  }

  // ------------------------------------------------------------------ bağlantılar (müşteri ve depo sayfaları)
  let LK = null;
  const linkUrl = (kind, token) => new URL(`nakliye.html?${kind}=${encodeURIComponent(token)}`, location.href).href;
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* kopyalanamadı */ } ta.remove(); return ok;
    }
  }
  function linksHtml() {
    const row = (key, kind, title, sub, l) => `<li class="${l.active ? '' : 'off'}"><div class="nk-lk-t"><b>${esc(title)}</b>${l.active ? '' : ' <em>(kapalı)</em>'}<small>${esc(sub)}</small>` +
      `<input type="text" readonly value="${esc(linkUrl(kind, l.token))}" aria-label="${esc(title)} bağlantısı" onfocus="this.select()"></div><div class="nk-lk-a">` +
      `<button type="button" class="btn small" data-nk="lk-copy" data-key="${key}" data-kind="${kind}">Kopyala</button>` +
      `<button type="button" class="btn small" data-nk="lk-wa" data-key="${key}" data-kind="${kind}">WhatsApp</button>` +
      `<a class="btn small" href="${esc(linkUrl(kind, l.token))}" target="_blank" rel="noopener">Aç</a>` +
      `<button type="button" class="btn small" data-nk="lk-toggle" data-key="${key}" data-kind="${kind}">${l.active ? 'Kapat' : 'Aç (etkinleştir)'}</button>` +
      `<button type="button" class="btn small ${S.confirm === 'rot:' + key ? 'danger' : ''}" data-nk="lk-rot" data-key="${key}" data-kind="${kind}">${S.confirm === 'rot:' + key ? 'Evet, yenile (eskisi çalışmaz)' : 'Yenile'}</button></div></li>`;
    return `<ul class="nk-lk">${row('depo', 'd', 'Depo ekranı', 'Depodaki arkadaşlar yük gelince "Geldi" der; plaka bazında seferleri ve belgeleri görür', LK.depot)}` +
      LK.customers.map(c => row(c.customer_id, 'm', c.name, 'Bu müşteri yalnızca kendi yüklerini yazar ve görür', c)).join('') + '</ul>';
  }
  function drawLinks() {
    X.openModal(`${head('Bağlantılar', 'Depo bağlantısı şifresizdir; müşteri bağlantısı, müşteriye kullanıcı tanımlamadıkça şifresiz açılır (kullanıcı tanımlarsanız kullanıcı adı ve şifre sorulur). Bağlantıyı yalnızca ilgili kişiye verin. Yanlış ellere geçerse "Yenile" deyin, eski bağlantı çalışmaz olur.')}<div class="modal-body">${linksHtml()}</div><div class="modal-footer"><span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Kapat</button></div>`);
  }
  async function linksModal() {
    X.openModal(`${head('Bağlantılar', '')}<div class="modal-body"><p>Yükleniyor…</p></div>`);
    const r = await X.client.rpc('shp_links');
    if (r.error) {
      const miss = /PGRST202|42883|schema cache|Could not find the function/.test(`${r.error.code} ${r.error.message}`);
      X.openModal(`${head('Bağlantılar', '')}<div class="modal-body"><p>${miss ? 'Bağlantılar için nakliye-kurulumu.sql çalıştırılmamış.' : esc(r.error.message || 'Yüklenemedi')}</p></div><div class="modal-footer"><span style="flex:1"></span><button type="button" class="btn" data-action="close-modal">Kapat</button></div>`);
      return;
    }
    LK = r.data; S.confirm = ''; drawLinks();
  }
  async function linkAction(a, t) {
    if (!LK) return;
    const key = t.dataset.key, kind = t.dataset.kind, isDepot = key === 'depo';
    const item = isDepot ? LK.depot : LK.customers.find(c => c.customer_id === key); if (!item) return;
    const name = isDepot ? 'Depo' : item.name;
    if (a === 'lk-copy') { X.toast(await copyText(linkUrl(kind, item.token)) ? 'Bağlantı kopyalandı' : 'Kopyalanamadı; kutudan elle kopyalayın', false); return; }
    if (a === 'lk-wa') { X.wa('', isDepot ? `PCS TRANSİT depo nakliye ekranı: ${linkUrl(kind, item.token)}` : `${name} yükleri için PCS TRANSİT nakliye programı bağlantınız: ${linkUrl(kind, item.token)}`); return; }
    if (a === 'lk-toggle') {
      const r = await X.client.rpc('shp_set_link', { p_customer: isDepot ? null : key, p_active: !item.active });
      if (r.error) { X.toast(r.error.message || 'İşlem yapılamadı', true); return; }
      item.active = !item.active; X.toast(item.active ? 'Bağlantı açıldı' : 'Bağlantı kapatıldı'); drawLinks(); return;
    }
    if (a === 'lk-rot') {
      if (S.confirm !== 'rot:' + key) { S.confirm = 'rot:' + key; drawLinks(); return; }
      S.confirm = '';
      const r = await X.client.rpc('shp_rotate_link', { p_customer: isDepot ? null : key });
      if (r.error) { X.toast(r.error.message || 'Yenilenemedi', true); drawLinks(); return; }
      item.token = r.data; item.active = true; X.toast('Yeni bağlantı oluşturuldu; eskisi artık çalışmaz'); drawLinks();
    }
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
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && S.bub && document.getElementById('nk-cpanel') && !document.querySelector('dialog[open]')) { S.bub = false; redraw(); return; }
      // Mesaj balonunda Enter gönderir, Shift+Enter yeni satır
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target && e.target.id === 'nk-breply') { e.preventDefault(); const f = e.target.closest('form'); if (f) sendReply(f).catch(() => X.toast('Gönderilemedi', true)); }
    });
    document.addEventListener('submit', e => {
      const f = e.target.closest && e.target.closest('form[data-nk-form]'); if (!f) return;
      e.preventDefault();
      (f.dataset.nkForm === 'load' ? saveLoad(f) : f.dataset.nkForm === 'user' ? saveUser(f) : f.dataset.nkForm === 'reply' ? sendReply(f) : saveCustomer(f)).catch(() => X.toast('Kaydedilemedi', true));
    });
  }

  window.PCSNK = { init, view, actions, reload: () => load(true), state: S };
})();
