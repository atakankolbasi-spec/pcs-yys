/* Testlerde gerçek Supabase yerine kullanılan sahte istemci (vendor.js yerine yüklenir).
 * Ayarlar sayfa açılmadan önce window.__PCS_STUB ile verilir:
 *   { session: true|false, role: 'editor'|'viewer', data: {registry, visits, app_settings, incoming_ruhsat}, offline: false,
 *     files: { 'depo/yolu.png': base64 },   // storage.download için dosyalar
 *     aiText: { items: [...], customer, problem },  // ruhsat-oku mesaj modu cevabı (ya da { status, body } hata)
 *     missing: ['incoming_ruhsat'],         // "tablo yok" hatası veren tablolar (kurulum yapılmamış gibi)
 *     noFee: true,                          // visits.fee_amount / fee_currency sütunları yokmuş gibi (ucret-kurulumu.sql çalıştırılmamış)
 *     guardToken: 'g1', today: '2026-09-23',  // güvenlik linki anahtarı ve güvenlik ekranının "bugün"ü
 *     guardViewToken: 'gv1',                   // güvenlik ekranı izleme linki (yalnızca görüntüleme)
 *     guardAccount: { name: 'Tepecik', active: true },  // giriş yapan kullanıcı güvenlik hesabı
 *     guardAccounts: [{ email, name, active, has_user, last_sign_in_at }],  // Ayarlar > Güvenlik hesapları
 *     report: { enabled, recipients, token, last_run_at, last_ok, last_note },  // Ayarlar > Otomatik günlük rapor
 *     backup: { enabled, recipients, last_at, last_ok, last_note } }              // Ayarlar > Gece yedeği (missing: ['backup'] = kurulmamış)
 * Yapılan her çağrı window.__calls dizisine yazılır. */
(() => {
  const cfg = window.__PCS_STUB || {};
  const calls = (window.__calls = []);
  const db = (window.__db = {
    registry: (cfg.data && cfg.data.registry) || [],
    visits: (cfg.data && cfg.data.visits) || [],
    app_settings: (cfg.data && cfg.data.app_settings) || [],
    incoming_ruhsat: (cfg.data && cfg.data.incoming_ruhsat) || [],
    incoming_messages: (cfg.data && cfg.data.incoming_messages) || [],
    // Nakliye programı (supabase/nakliye-kurulumu.sql)
    shp_customers: (cfg.data && cfg.data.shp_customers) || [],
    shp_trips: (cfg.data && cfg.data.shp_trips) || [],
    shp_loads: (cfg.data && cfg.data.shp_loads) || [],
    shp_messages: (cfg.data && cfg.data.shp_messages) || [],
    shp_outbox: (cfg.data && cfg.data.shp_outbox) || [],
    shp_photos: (cfg.data && cfg.data.shp_photos) || []
  });
  const netError = () => ({ data: null, count: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
  const clone = v => JSON.parse(JSON.stringify(v));
  const now = () => new Date().toISOString();
  let shpSeq = 0;

  // PostgREST mantık filtresi: "status.eq.yeni,and(status.eq.okunuyor,claimed_at.lt.\"2026-...\")"
  function splitTop(s) { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
  function cond(s) {
    const m = /^([a-z_]+)\.(eq|neq|lt|gt)\.(.*)$/.exec(s); if (!m) throw new Error('stub: filtre anlaşılamadı ' + s);
    const val = m[3].replace(/^"|"$/g, '');
    return r => { const x = r[m[1]]; if (m[2] === 'eq') return String(x) === val; if (m[2] === 'neq') return String(x) !== val; if (x == null) return false; return m[2] === 'lt' ? String(x) < val : String(x) > val; };
  }
  function logic(s, any) { const parts = splitTop(s).map(p => { const m = /^(and|or)\((.*)\)$/.exec(p); return m ? logic(m[2], m[1] === 'or') : cond(p); }); return r => (any ? parts.some(f => f(r)) : parts.every(f => f(r))); }

  function query(table) {
    const st = { table, op: 'select', filters: [], order: null, from: 0, to: Infinity, count: null, cols: '*', rows: null, patch: null, gte: null };
    const rowsNow = () => (db[table] || []).filter(r => st.filters.every(f => f(r)));
    const q = {
      select(cols, opts) { if (st.op === 'select') st.cols = cols || '*'; if (opts && opts.count) st.count = opts.count; return q; },
      order(col, opts) { st.order = { col, asc: !opts || opts.ascending !== false }; return q; },
      range(a, b) { st.from = a; st.to = b; return q; },
      limit(n) { st.to = st.from + n - 1; return q; },
      eq(col, val) { st.filters.push(r => r[col] === val); return q; },
      in(col, vals) { st.filters.push(r => vals.includes(r[col])); return q; },
      is(col, val) { st.filters.push(r => (val === null ? r[col] == null : r[col] === val)); return q; },
      gte(col, val) { st.gte = { col, val }; st.filters.push(r => r[col] != null && Date.parse(r[col]) >= Date.parse(val)); return q; },
      or(expr) { st.filters.push(logic(expr, true)); return q; },
      insert(rows) { st.op = 'insert'; st.rows = Array.isArray(rows) ? rows : [rows]; return q; },
      update(patch) { st.op = 'update'; st.patch = patch; return q; },
      delete() { st.op = 'delete'; return q; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); }
    };
    // PostgREST "select *" bütün sütunları döndürür: ücret sütunları varsa boş olsalar da satırda görünür
    const withFee = r => (table === 'visits' && !cfg.noFee && !('fee_amount' in r) ? { ...r, fee_amount: null, fee_currency: '' } : r);
    function run() {
      calls.push({ table, op: st.op, cols: st.cols, count: st.count, rows: st.rows && clone(st.rows), gte: st.gte, from: st.from });
      if (window.__hang) return new Promise(() => {}); // takılan istek: hiç cevap gelmez
      if (window.__hangReads && st.op === 'select') return new Promise(() => {}); // yalnızca okuma (yenileme) takılır, yazma çalışır
      if (cfg.offline) return netError();
      if ((cfg.missing || []).includes(table)) return { data: null, count: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` } };
      // ücret sütunları (supabase/ucret-kurulumu.sql) yokmuş gibi: okuma 42703, yazma PGRST204 verir
      if (table === 'visits' && cfg.noFee) {
        if (st.op === 'select' && /fee_amount/.test(st.cols)) return { data: null, count: null, error: { code: '42703', message: 'column visits.fee_amount does not exist' } };
        if ((st.rows || [st.patch]).some(r => r && ('fee_amount' in r || 'fee_currency' in r))) return { data: null, error: { code: 'PGRST204', message: "Could not find the 'fee_amount' column of 'visits' in the schema cache" } };
      }
      const t = db[table] || (db[table] = []);
      if (st.op === 'insert') {
        const plate = r => String(r.plate || '').replace(/\s/g, '').toUpperCase();
        if (table === 'registry' && st.rows.some(r => t.some(x => plate(x) === plate(r))))
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        const shpDefaults = {
          shp_customers: { active: true, carrier: '', cmr_notes: '', loading_place: 'İSTANBUL - Turkey', logo: '', notify_phone: '', notify_events: { geldi: true, yola: true, teslim: true, sorun: true, mesaj: true } },
          shp_loads: { status: 'bekliyor', trip_id: null, arrived_at: null, arrived_by: '', note: '' },
          shp_messages: { read_at: null, author: 'Ofis' }
        }[table];
        if (table === 'shp_customers' && st.rows.some(r => t.some(x => x.name === r.name))) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "shp_customers_name_key"' } };
        const added = st.rows.map(r => ({ ...(shpDefaults || {}), ...(table.startsWith('shp_') ? { id: 'shp' + (++shpSeq) } : {}), ...r, created_at: now(), updated_at: now() }));
        t.push(...added);
        return { data: clone(added.map(withFee)), error: null };
      }
      if (st.op === 'update') {
        const hit = rowsNow();
        hit.forEach(r => {
          const old = r.status; Object.assign(r, st.patch, { updated_at: now() });
          if (table === 'shp_trips' && 'status' in st.patch && st.patch.status !== old) {
            if (r.status === 'yolda') { r.departed_at = now(); r.delivered_at = null; } else if (r.status === 'teslim') { r.delivered_at = now(); r.departed_at = r.departed_at || now(); } else { r.departed_at = null; r.delivered_at = null; }
            const c = db.shp_customers.find(x => x.id === r.customer_id), ev = r.status === 'yolda' ? 'yola' : r.status === 'teslim' ? 'teslim' : '';
            if (ev && c && String(c.notify_phone || '').trim() && (c.notify_events || {})[ev] !== false) db.shp_outbox.push({ id: 'ob' + (++shpSeq), customer_id: r.customer_id, event: ev, phone: c.notify_phone, body: `${r.tractor} · ${r.poz_no}`, status: 'bekliyor', error: '', created_at: now(), sent_at: null });
          }
        });
        return { data: clone(hit.map(withFee)), error: null };
      }
      if (st.op === 'delete') {
        const hit = rowsNow();
        db[table] = t.filter(r => !hit.includes(r));
        return { data: clone(hit), error: null };
      }
      let rows = rowsNow();
      if (st.order) {
        const { col, asc } = st.order;
        rows = rows.slice().sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (asc ? 1 : -1));
      }
      const total = rows.length;
      rows = rows.slice(st.from, st.to === Infinity ? undefined : st.to + 1);
      return { data: clone(rows.map(withFee)), count: st.count ? total : null, error: null };
    }
    return q;
  }

  let session = cfg.session ? { user: { id: 'u1', email: 'test@ornek.com' }, access_token: 'x' } : null;
  const listeners = [];
  const emit = ev => listeners.forEach(cb => cb(ev, session));

  window.createPCSClient = () => ({
    auth: {
      onAuthStateChange(cb) { listeners.push(cb); setTimeout(() => cb('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async getSession() { return { data: { session } }; },
      async signInWithPassword() {
        if (cfg.authError) return { data: null, error: { ...cfg.authError } }; // ör. { code: 'invalid_credentials', message: 'Invalid login credentials' }
        session = { user: { id: 'u1', email: 'test@ornek.com' }, access_token: 'x' }; emit('SIGNED_IN'); return { error: null };
      },
      async signOut() { session = null; emit('SIGNED_OUT'); return { error: null }; },
      async resetPasswordForEmail() { return { error: null }; },
      async updateUser() { return { error: null }; }
    },
    from: query,
    storage: {
      from(bucket) {
        return {
          async download(path) {
            calls.push({ storage: 'download', bucket, path });
            if (cfg.offline) return netError();
            const b64 = (cfg.files || {})[path];
            if (!b64) return { data: null, error: { message: 'Object not found' } };
            return { data: new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' }), error: null };
          }
        };
      }
    },
    // Sunucu fonksiyonları. cfg.ai: ruhsat-oku cevabı ({ vehicles, problem }) ya da { status: 429, body: {...} } gibi hata;
    // verilmezse fonksiyon kurulmamış gibi 404 döner (site bu bilgisayarda okur).
    functions: {
      async invoke(name, opts = {}) {
        // mesaj modu: gövde JSON yazıdır ({ text, today }) ya da liste fotoğrafıdır (x-pcs-mode: liste); cevabı cfg.aiText verir. Ruhsat fotoğrafında cfg.ai kullanılır.
        const isJson = !!(opts.headers && opts.headers['Content-Type'] === 'application/json');
        // liste fotoğrafı: resim gövdesi + "x-pcs-mode: liste" başlığı; cevabı yine cfg.aiText verir (mesaj biçiminde)
        const isList = !!(opts.headers && opts.headers['x-pcs-mode'] === 'liste');
        const isText = isJson || isList;
        calls.push({ fn: name, timeout: opts.timeout, type: opts.headers && opts.headers['Content-Type'], size: opts.body && opts.body.size, text: isJson ? JSON.parse(opts.body) : undefined, list: isList ? { today: opts.headers['x-pcs-today'] } : undefined });
        if (cfg.offline) return { data: null, error: { message: 'Failed to send a request to the Edge Function' } };
        if (cfg.aiDelay) await new Promise(r => setTimeout(r, cfg.aiDelay));   // yavaş cevap (sahte saatle ilerler)
        // dizi verilirse sırayla kullanılır (ör. önce 429, sonra cevap); son eleman tekrar eder
        const src = isList ? (cfg.aiText || { items: [], customer: '', problem: '', model: 'gemini-test' }) : isText ? cfg.aiText : name !== 'ruhsat-oku' ? null : cfg.ai;
        const r = Array.isArray(src) ? (src.length > 1 ? src.shift() : src[0]) : src;
        const err = (status, body) => ({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context: new Response(body ? JSON.stringify(body) : null, { status }) } });
        if (!r) return err(404);
        if (r.status) return err(r.status, r.body);
        return { data: clone(r), error: null };
      }
    },
    // Realtime: testler window.__rtEmit(tablo) ile "başka kullanıcı değiştirdi" bildirimi gönderebilir.
    channel(name) {
      const handlers = [];
      const ch = {
        name,
        on(type, filter, cb) { handlers.push({ type, filter, cb }); return ch; },
        subscribe(cb) { (window.__channels = window.__channels || []).push(ch); if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; },
        emit(table) { handlers.filter(h => h.type === 'postgres_changes' && h.filter.table === table).forEach(h => h.cb({ table, eventType: 'UPDATE' })); }
      };
      window.__rtEmit = table => (window.__channels || []).forEach(c => c.emit(table));
      return ch;
    },
    removeChannel(ch) { window.__channels = (window.__channels || []).filter(c => c !== ch); return Promise.resolve('ok'); },
    async rpc(name, params = {}) {
      calls.push({ rpc: name, params: clone(params) });
      if (window.__hangRpc) return new Promise(() => {}); // takılan istek: hiç cevap gelmez
      if (cfg.offline) return netError();
      // Güvenlik linki (supabase/guvenlik-kurulumu.sql'deki fonksiyonların sade karşılığı)
      const guardErr = (code, message) => ({ data: null, error: { code, message } });
      if (name === 'get_guard_link' || name === 'rotate_guard_link') {
        if ((cfg.missing || []).includes('guard')) return guardErr('PGRST202', 'Could not find the function');
        if (name === 'rotate_guard_link') cfg.guardToken = 'yeni' + Date.now();
        return { data: cfg.guardToken || 'g1', error: null };
      }
      if (name === 'get_guard_view_link' || name === 'rotate_guard_view_link') {
        if ((cfg.missing || []).includes('guard-view')) return guardErr('PGRST202', 'Could not find the function');
        if (name === 'rotate_guard_view_link' || !cfg.guardViewToken) cfg.guardViewToken = 'izle' + Date.now();
        return { data: cfg.guardViewToken, error: null };
      }
      // Otomatik günlük rapor ayarları (supabase/gunluk-rapor-kurulumu.sql'in sade karşılığı)
      if (name === 'get_report_settings' || name === 'save_report_settings' || name === 'rotate_report_token') {
        if ((cfg.missing || []).includes('report')) return guardErr('PGRST202', 'Could not find the function');
        const r = (cfg.report = cfg.report || { enabled: false, recipients: [], token: 'rapor1', last_run_at: null, last_ok: null, last_note: null });
        if (name === 'rotate_report_token') { r.token = 'rapor' + Date.now(); return { data: r.token, error: null }; }
        if (name === 'save_report_settings') {
          const list = [...new Set((params.p_recipients || []).map(x => String(x).trim().toLowerCase()).filter(Boolean))].sort();
          if (list.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return guardErr('22023', 'Geçersiz e-posta adresi var; her satıra bir adres yazın');
          Object.assign(r, { enabled: !!params.p_enabled, recipients: list });
        }
        return { data: clone(r), error: null };
      }
      // Gece yedeği ayarları (supabase/gece-yedegi-kurulumu.sql'in sade karşılığı)
      if (name === 'get_backup_settings' || name === 'save_backup_settings') {
        if ((cfg.missing || []).includes('backup')) return guardErr('PGRST202', 'Could not find the function');
        const r = (cfg.backup = cfg.backup || { enabled: false, recipients: [], last_at: null, last_ok: null, last_note: null });
        if (name === 'save_backup_settings') {
          const list = [...new Set((params.p_recipients || []).map(x => String(x).trim().toLowerCase()).filter(Boolean))].sort();
          if (list.some(x => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return guardErr('22023', 'Geçersiz e-posta adresi var; her satıra bir adres yazın');
          if (list.length > 5) return guardErr('22023', 'Yedek en fazla 5 adrese gönderilebilir');
          Object.assign(r, { enabled: !!params.p_enabled, recipients: list });
        }
        return { data: clone(r), error: null };
      }
      // Güvenlik hesapları: cfg.guardAccount = { name, active } ise giriş yapan kullanıcı güvenlik hesabıdır
      if (name === 'guard_account') {
        if ((cfg.missing || []).includes('guard-accounts')) return guardErr('PGRST202', 'Could not find the function');
        return { data: session && cfg.guardAccount ? clone(cfg.guardAccount) : null, error: null };
      }
      if (name === 'list_guard_accounts' || name === 'save_guard_account' || name === 'delete_guard_account') {
        if ((cfg.missing || []).includes('guard-accounts')) return guardErr('PGRST202', 'Could not find the function');
        const list = (cfg.guardAccounts = cfg.guardAccounts || []), e = String(params.p_email || '').toLowerCase();
        if (name === 'save_guard_account') {
          const a = list.find(x => x.email === e);
          if (a) Object.assign(a, { name: params.p_name || '', active: params.p_active !== false });
          else list.push({ email: e, name: params.p_name || '', active: params.p_active !== false, has_user: false, last_sign_in_at: null });
        }
        if (name === 'delete_guard_account') {
          const i = list.findIndex(x => x.email === e);
          if (i >= 0 && list[i].has_user) return guardErr('22023', "Bu kullanıcı Supabase'de duruyor. Önce Authentication > Users'tan silin.");
          if (i >= 0) list.splice(i, 1);
        }
        return { data: name === 'list_guard_accounts' ? clone(list) : null, error: null };
      }
      if (name === 'guard_board' || name === 'guard_mark' || name === 'guard_driver') {
        const acct = params.p_token == null && !!session && !!cfg.guardAccount && cfg.guardAccount.active !== false && !cfg.guardOldBoard;
        const canMark = acct || (!!cfg.guardToken && params.p_token === cfg.guardToken);
        const viewOk = name === 'guard_board' && !!cfg.guardViewToken && params.p_token === cfg.guardViewToken;
        if (!canMark && !viewOk) {
          // cfg.guardOldBoard: veritabanında guard_board'un eski (yalnızca linkle çalışan) sürümü duruyor
          if (params.p_token == null && !cfg.guardOldBoard) return guardErr('42501', 'Güvenlik hesabı listede yok ya da erişimi durdurulmuş');
          return guardErr('42501', 'Güvenlik linki geçersiz');
        }
        const today = cfg.today || '2026-09-23', back = d => new Date(Date.parse(today) - d * 864e5).toISOString().slice(0, 10);
        const ymdIst = iso => new Date(Date.parse(iso) + 3 * 36e5).toISOString().slice(0, 10); // İstanbul (UTC+3) günü
        const pick = v => ({ id: v.id, plate: v.plate, customer: v.customer, registration: v.registration || '', visit_date: v.visit_date, visit_time: v.visit_time, onsite: v.onsite, onsite_at: v.onsite_at || null, done: v.done, done_at: v.done_at || null, driver_name: v.driver_name || null, driver_phone: v.driver_phone || null, mrn: v.mrn || null, seal_no: v.seal_no || null, exit_at: v.exit_at || null });
        if (name === 'guard_board') {
          if (cfg.guardOldSql && params.p_from) return guardErr('PGRST202', 'Could not find the function public.guard_board(p_from, p_to, p_token)');
          const f = params.p_from || today, t = params.p_to || f;
          if (t < f) return guardErr('22023', 'Bitiş tarihi başlangıçtan önce olamaz');
          return { data: { today, from: f, to: t, now: now(), can_mark: canMark, visits: db.visits.filter(v => (v.visit_date >= f && v.visit_date <= t) || (t >= today && v.visit_date >= back(7) && v.visit_date < f && v.onsite_at && !v.exit_at)
            || (v.exit_at && v.visit_date < f && v.visit_date >= new Date(Date.parse(f) - 7 * 864e5).toISOString().slice(0, 10) && ymdIst(v.exit_at) >= f && ymdIst(v.exit_at) <= t)).map(pick) }, error: null };
        }
        const v = db.visits.find(x => x.id === params.p_visit_id && x.visit_date >= back(7) && x.visit_date <= back(-1));
        if (!v) return guardErr('P0002', 'Araç bulunamadı');
        if (name === 'guard_driver') {   // cfg.guardNoDriver: veritabanında guard_driver (sürücü alanları) henüz kurulmamış
          if (cfg.guardNoDriver) return guardErr('PGRST202', 'Could not find the function public.guard_driver(p_name, p_phone, p_token, p_visit_id)');
          v.driver_name = String(params.p_name || '').trim() || null;
          v.driver_phone = String(params.p_phone || '').replace(/[^0-9+]/g, '') || null;
          v.updated_at = now();
          return { data: { id: v.id, driver_name: v.driver_name, driver_phone: v.driver_phone }, error: null };
        }
        const recent = t => t && Date.now() - Date.parse(t) < 15 * 60000;
        const a = params.p_action;
        if (a === 'giris') Object.assign(v, { onsite: true, onsite_at: v.onsite_at || now() });
        else if (a === 'cikis') { if (!v.onsite && !v.onsite_at) return guardErr('22023', 'Önce giriş yapılmalı'); v.exit_at = v.exit_at || now(); }
        else if (a === 'giris_geri') { if (v.exit_at || !recent(v.onsite_at)) return guardErr('22023', 'Giriş artık geri alınamaz; ofise haber verin'); Object.assign(v, { onsite: false, onsite_at: null }); }
        else if (a === 'cikis_geri') { if (!recent(v.exit_at)) return guardErr('22023', 'Çıkış artık geri alınamaz; ofise haber verin'); v.exit_at = null; }
        else return guardErr('22023', 'Geçersiz işlem');
        v.updated_at = now();
        return { data: { id: v.id, onsite: v.onsite, onsite_at: v.onsite_at, exit_at: v.exit_at }, error: null };
      }
      // Nakliye programı: araca atama (supabase/nakliye-kurulumu.sql'deki shp_assign'ın sade karşılığı)
      if (name === 'shp_assign') {
        const ids = [...new Set(params.p_load_ids || [])];
        if (!ids.length) return guardErr('22023', 'Önce yük seçin');
        if (!String(params.p_tractor || '').trim()) return guardErr('22023', 'Çekici plakası gerekli');
        const ls = ids.map(id => db.shp_loads.find(l => l.id === id));
        if (ls.some(l => !l || l.status !== 'depoda' || l.trip_id || l.customer_id !== params.p_customer))
          return guardErr('22023', 'Seçilen yüklerden bazıları artık boşta değil ya da başka müşteriye ait; listeyi yenileyip tekrar seçin');
        const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
        cfg.pozSeq = cfg.pozSeq || {}; cfg.pozSeq[yy] = (cfg.pozSeq[yy] || 0) + 1;
        const trip = { id: 'shpt' + (++shpSeq), poz_no: `PCS-${yy}-${String(cfg.pozSeq[yy]).padStart(4, '0')}`, customer_id: params.p_customer,
          tractor: String(params.p_tractor).trim().toUpperCase(), trailer: String(params.p_trailer || '').trim().toUpperCase(), depart_date: params.p_depart || now().slice(0, 10),
          subject: params.p_subject || '', status: 'hazirlaniyor', created_by: 'test@ornek.com', created_at: now(), updated_at: now() };
        db.shp_trips.push(trip);
        ls.forEach(l => Object.assign(l, { status: 'aracta', trip_id: trip.id, updated_at: now() }));
        return { data: { trip: clone(trip) }, error: null };
      }
      if (name === 'shp_unassign') {
        const l = db.shp_loads.find(x => x.id === params.p_load_id && x.status === 'aracta');
        if (!l) return guardErr('22023', 'Yük bir araçta değil');
        const tid = l.trip_id; Object.assign(l, { status: l.arrived_at ? 'depoda' : 'bekliyor', trip_id: null, updated_at: now() });
        const gone = !db.shp_loads.some(x => x.trip_id === tid);
        if (gone) db.shp_trips = db.shp_trips.filter(x => x.id !== tid);
        return { data: { trip_deleted: gone }, error: null };
      }
      if (name === 'shp_delete_trip') {
        db.shp_loads.filter(l => l.trip_id === params.p_trip).forEach(l => Object.assign(l, { status: l.arrived_at ? 'depoda' : 'bekliyor', trip_id: null, updated_at: now() }));
        db.shp_trips = db.shp_trips.filter(x => x.id !== params.p_trip);
        return { data: null, error: null };
      }
      // Nakliye bağlantıları ve müşteri / depo sayfası (supabase/nakliye-kurulumu.sql'in sade karşılığı)
      // cfg.shpTokens: { anahtar: { kind: 'musteri', customer: 'c1', active: true } | { kind: 'depo', active: true } }
      // data.shp_users: [{ id, customer_id, username, display_name, active, pw }]; kullanıcısı olan müşterinin bağlantısı giriş ister
      if (/^shp_(links|rotate_link|set_link|portal|portal_save|portal_delete|portal_assign|portal_unassign|portal_trip_update|depot|depot_mark|depot_save|depot_delete|login|logout|stamp|users_list|user_save|user_delete|log_list|portal_notify_save|portal_message_send|portal_messages_read|portal_import|portal_report|portal_trip_docs|portal_photos|portal_photo|depot_photos|depot_photo|depot_photo_add|depot_photo_del|depot_receive|depot_depart)$/.test(name)) {
        if ((cfg.missing || []).includes('shp-rpc')) return guardErr('PGRST202', 'Could not find the function public.' + name);
        if (name === 'shp_stamp' && (cfg.missing || []).includes('shp-stamp')) return guardErr('PGRST202', 'Could not find the function public.shp_stamp');
        if (cfg.offline && /^shp_(portal|depot|stamp|login)/.test(name)) return netError();
        const T = (cfg.shpTokens = cfg.shpTokens || {});
        const bad = () => guardErr('42501', 'Bağlantı geçersiz ya da kapatılmış');
        const mk = () => 'k' + Math.random().toString(36).slice(2, 10);
        const loadJson = l => { const { created_by, updated_by, updated_at, ...x } = l; return clone(x); };
        const qrNew = () => Math.random().toString(36).slice(2, 12).toUpperCase().padEnd(10, 'X');
        const enqueue = (cid, ev, body) => { const c = db.shp_customers.find(x => x.id === cid); if (!c || !String(c.notify_phone || '').trim() || (c.notify_events || {})[ev] === false) return; db.shp_outbox.push({ id: 'ob' + (++shpSeq), customer_id: cid, event: ev, phone: c.notify_phone, body, status: 'bekliyor', error: '', created_at: now(), sent_at: null }); };
        const tripJson = t => { const { created_by, updated_by, ...x } = t; return clone(x); };
        const isEditor = !!session;
        const SS = (cfg.shpSessions = cfg.shpSessions || {});
        db.shp_users = db.shp_users || (cfg.data && cfg.data.shp_users) || [];
        db.shp_log = db.shp_log || (cfg.data && cfg.data.shp_log) || []; db.shp_contacts = db.shp_contacts || (cfg.data && cfg.data.shp_contacts) || []; db.shp_vehicles = db.shp_vehicles || (cfg.data && cfg.data.shp_vehicles) || [];
        const roleOf = a => /^Müşteri/.test(a) ? 'musteri' : /^Depo/.test(a) ? 'depo' : 'operator';
        const log = (cust, actor, action, summary = '') => db.shp_log.push({ id: db.shp_log.length + 1, at: now(), customer_id: cust, actor, role: roleOf(actor), action, summary });
        const lsum = l => `${l.sender} → ${l.consignee} · ${l.weight} kg`;
        const remember = (cid, l) => {
          const up = (kind, name, extra) => { if (!String(name).trim()) return; const k = db.shp_contacts.find(c => c.customer_id === cid && c.kind === kind && c.name.toUpperCase() === String(name).toUpperCase());
            if (k) Object.entries(extra).forEach(([a, b]) => { if (b) k[a] = b; }); else db.shp_contacts.push({ customer_id: cid, kind, name, addr: '', notify: '', country: '', dest_customs: '', code: '', broker: '', ...extra }); };
          up('sender', l.sender, { addr: l.sender_addr });
          up('consignee', l.consignee, { addr: l.consignee_addr, notify: l.notify, country: l.country, dest_customs: l.dest_customs, code: l.code, broker: l.broker });
        };
        const rememberVeh = (cid, t) => { if (t.tractor && !db.shp_vehicles.some(v => v.customer_id === cid && v.tractor === t.tractor && v.trailer === t.trailer)) db.shp_vehicles.unshift({ customer_id: cid, tractor: t.tractor, trailer: t.trailer || '' }); };
        const cAuth = tok => {   // müşteri sayfası yetkisi: oturum anahtarı ya da (kullanıcısı olmayan müşteri için) bağlantı
          const sid = SS[tok];
          if (sid) { const u = db.shp_users.find(x => x.id === sid && x.active); if (u && db.shp_customers.some(c => c.id === u.customer_id && c.active !== false)) return { customer: u.customer_id, user: u, actor: 'Müşteri · ' + (u.display_name || u.username) }; return { res: bad() }; }
          const kt = T[tok];
          if (!kt || kt.kind !== 'musteri' || !kt.active) return { res: bad() };
          if (db.shp_users.some(u => u.customer_id === kt.customer)) return { res: guardErr('28000', 'Bu sayfa için kullanıcı girişi gerekli') };
          return { customer: kt.customer, user: null, actor: 'Müşteri (bağlantı)' };
        };
        const editorOnly = () => (isEditor ? null : guardErr('42501', 'Bu işlem için düzenleyici yetkisi gerekli'));
        if (name === 'shp_login') {
          const un = String(params.p_username || '').trim().toLowerCase();
          const F = (cfg.shpFails = cfg.shpFails || {}); const f = F[un] || { n: 0 };
          if (f.n >= 5) return { data: { ok: false, message: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.' }, error: null };
          const u = db.shp_users.find(x => x.username === un && x.active);
          if (!u || u.pw !== params.p_password) { f.n++; F[un] = f; return { data: { ok: false, message: 'Kullanıcı adı ya da şifre hatalı.' }, error: null }; }
          delete F[un];
          const tok = 'oturum' + Math.random().toString(36).slice(2, 10); SS[tok] = u.id; u.last_login_at = now();
          log(u.customer_id, 'Müşteri · ' + (u.display_name || u.username), 'Giriş yaptı');
          return { data: { ok: true, token: tok, name: u.display_name || u.username, username: u.username }, error: null };
        }
        if (name === 'shp_logout') { delete SS[params.p_token]; return { data: null, error: null }; }
        if (name === 'shp_users_list') {
          const e = editorOnly(); if (e) return e;
          return { data: db.shp_users.filter(u => !params.p_customer || u.customer_id === params.p_customer).map(u => ({ id: u.id, customer_id: u.customer_id, customer: (db.shp_customers.find(c => c.id === u.customer_id) || {}).name, username: u.username, display_name: u.display_name, active: u.active, last_login_at: u.last_login_at || null })), error: null };
        }
        if (name === 'shp_user_save') {
          const e = editorOnly(); if (e) return e;
          const un = String(params.p_username || '').trim().toLowerCase(), pw = String(params.p_password || '');
          if (!/^[a-z0-9._-]{3,40}$/.test(un)) return guardErr('22023', 'Kullanıcı adı 3-40 karakter olmalı; küçük harf, rakam, nokta, tire ya da alt çizgi kullanın');
          if (db.shp_users.some(u => u.username === un && u.id !== params.p_id)) return guardErr('22023', 'Bu kullanıcı adı başka biri tarafından kullanılıyor');
          let u;
          if (!params.p_id) {
            if (pw.length < 6) return guardErr('22023', 'Şifre en az 6 karakter olmalı');
            u = { id: 'su' + (++shpSeq), customer_id: params.p_customer, username: un, display_name: String(params.p_name || '').trim(), active: params.p_active !== false, last_login_at: null, pw }; db.shp_users.push(u);
            log(u.customer_id, 'ofis@ornek.com', 'Kullanıcı eklendi', un);
          } else {
            u = db.shp_users.find(x => x.id === params.p_id); if (!u) return guardErr('22023', 'Kullanıcı bulunamadı');
            if (pw && pw.length < 6) return guardErr('22023', 'Şifre en az 6 karakter olmalı');
            Object.assign(u, { username: un, display_name: String(params.p_name || '').trim(), active: params.p_active !== false }); if (pw) u.pw = pw;
            if (pw || !u.active) Object.keys(SS).forEach(k => { if (SS[k] === u.id) delete SS[k]; });
            log(u.customer_id, 'ofis@ornek.com', pw ? 'Kullanıcı şifresi değiştirildi' : 'Kullanıcı güncellendi', un);
          }
          return { data: { id: u.id, username: u.username, display_name: u.display_name, active: u.active }, error: null };
        }
        if (name === 'shp_user_delete') {
          const e = editorOnly(); if (e) return e;
          const i = db.shp_users.findIndex(u => u.id === params.p_id);
          if (i >= 0) { const [u] = db.shp_users.splice(i, 1); Object.keys(SS).forEach(k => { if (SS[k] === u.id) delete SS[k]; }); log(u.customer_id, 'ofis@ornek.com', 'Kullanıcı silindi', u.username); }
          return { data: null, error: null };
        }
        if (name === 'shp_log_list') {
          const e = editorOnly(); if (e) return e;
          return { data: db.shp_log.filter(x => !params.p_customer || x.customer_id === params.p_customer).slice().reverse().slice(0, params.p_limit || 200).map(x => ({ ...x, customer: (db.shp_customers.find(c => c.id === x.customer_id) || {}).name || '' })), error: null };
        }
        if (name === 'shp_links') {
          const e = editorOnly(); if (e) return e;
          db.shp_customers.forEach(c => { if (!Object.values(T).some(v => v.customer === c.id)) T[mk()] = { kind: 'musteri', customer: c.id, active: true }; });
          if (!Object.values(T).some(v => v.kind === 'depo')) T[mk()] = { kind: 'depo', active: true };
          const dep = Object.entries(T).find(([, v]) => v.kind === 'depo');
          return { data: { depot: { token: dep[0], active: dep[1].active },
            customers: db.shp_customers.map(c => { const e2 = Object.entries(T).find(([, v]) => v.customer === c.id); return { customer_id: c.id, name: c.name, token: e2[0], active: e2[1].active }; }) }, error: null };
        }
        if (name === 'shp_rotate_link' || name === 'shp_set_link') {
          const e = editorOnly(); if (e) return e;
          const e2 = Object.entries(T).find(([, v]) => params.p_customer ? v.customer === params.p_customer : v.kind === 'depo');
          if (!e2) return guardErr('22023', 'Bağlantı yok');
          if (name === 'shp_set_link') { e2[1].active = params.p_active !== false; return { data: null, error: null }; }
          delete T[e2[0]]; const t = mk(); T[t] = e2[1]; e2[1].active = true; return { data: t, error: null };
        }
        let k = T[params.p_token], actor = '';
        if (name === 'shp_stamp') {
          let ls, ts;
          const dk = T[params.p_token];
          if (dk && dk.kind === 'depo' && dk.active) { ls = db.shp_loads; ts = db.shp_trips; }
          else { const ca = cAuth(params.p_token); if (ca.res) return ca.res; ls = db.shp_loads.filter(l => l.customer_id === ca.customer); ts = db.shp_trips.filter(t => t.customer_id === ca.customer); }
          const s = JSON.stringify([ls, ts]); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
          const ms = dk && dk.kind === 'depo' ? '' : '/' + JSON.stringify(db.shp_messages.filter(m => m.customer_id === (T[params.p_token] ? T[params.p_token].customer : (SS[params.p_token] ? (db.shp_users.find(u => u.id === SS[params.p_token]) || {}).customer_id : null)))).length;
          return { data: `${ls.length}/${ts.length}/${s.length}/${h}${ms}`, error: null };
        }
        if (name.startsWith('shp_portal')) {
          const ca = cAuth(params.p_token); if (ca.res) return ca.res;
          k = { customer: ca.customer }; actor = ca.actor;
          if (name === 'shp_portal') {
            const c = db.shp_customers.find(x => x.id === k.customer);
            return { data: { now: now(), customer: clone(c), user: ca.user ? { username: ca.user.username, name: ca.user.display_name || ca.user.username } : null,
              loads: db.shp_loads.filter(l => l.customer_id === k.customer).map(loadJson), trips: db.shp_trips.filter(t => t.customer_id === k.customer).map(tripJson),
              contacts: clone(db.shp_contacts.filter(x => x.customer_id === k.customer).slice().reverse()), vehicles: clone(db.shp_vehicles.filter(v => v.customer_id === k.customer)),
              log: db.shp_log.filter(x => x.customer_id === k.customer).slice().reverse().slice(0, 60).map(x => ({ at: x.at, actor: x.role === 'operator' ? 'Ofis' : x.role === 'depo' ? 'Depo' : x.actor, action: x.action, summary: x.summary })),
              photo_counts: db.shp_photos.filter(p => p.customer_id === k.customer).reduce((m, p) => ((m[p.load_id] = (m[p.load_id] || 0) + 1), m), {}),
              notify: { phone: c.notify_phone || '', events: c.notify_events || { geldi: true, yola: true, teslim: true, sorun: true, mesaj: true } },
              messages: db.shp_messages.filter(m => m.customer_id === k.customer).slice(-100).map(m => ({ id: m.id, from_role: m.from_role, author: m.from_role === 'ofis' ? 'Ofis' : m.author, body: m.body, load_id: m.load_id || null, trip_id: m.trip_id || null, created_at: m.created_at, read_at: m.read_at || null })) }, error: null };
          }
          if (name === 'shp_portal_notify_save') {
            const ph = String(params.p_phone || '').replace(/[^0-9+() -]/g, '').slice(0, 30), dg = ph.replace(/[^0-9]/g, '').length;
            if (ph && (dg < 10 || dg > 15)) return guardErr('22023', 'Telefon numarasını ülke ya da alan koduyla yazın (örn. +90 5xx xxx xx xx)');
            const c = db.shp_customers.find(x => x.id === k.customer), ev = { geldi: true, yola: true, teslim: true, sorun: true, mesaj: true, ...(c.notify_events || {}) };
            Object.entries(params.p_events || {}).forEach(([a, b]) => { if (a in ev && typeof b === 'boolean') ev[a] = b; });
            c.notify_phone = ph; c.notify_events = ev; log(k.customer, actor, 'Bildirim ayarı değiştirildi');
            return { data: { phone: ph, events: ev }, error: null };
          }
          if (name === 'shp_portal_message_send') {
            const b = String(params.p_body || '').replace(/\r/g, '').trim().slice(0, 1000);
            if (!b) return guardErr('22023', 'Mesaj boş olamaz');
            const own = (arr, id) => (id && arr.some(x => x.id === id && x.customer_id === k.customer) ? id : null);
            const m = { id: 'msg' + (++shpSeq), customer_id: k.customer, from_role: 'musteri', author: actor, body: b, load_id: own(db.shp_loads, params.p_load), trip_id: own(db.shp_trips, params.p_trip), created_at: now(), read_at: null };
            db.shp_messages.push(m); return { data: clone(m), error: null };
          }
          if (name === 'shp_portal_messages_read') { db.shp_messages.forEach(m => { if (m.customer_id === k.customer && m.from_role === 'ofis' && !m.read_at) m.read_at = now(); }); return { data: null, error: null }; }
          if (name === 'shp_portal_import') {
            const rows = params.p_loads;
            if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) return guardErr('22023', 'Bir seferde 1 ile 200 arası satır eklenebilir');
            for (let i = 0; i < rows.length; i++) if (!String(rows[i].sender || '').trim() || !String(rows[i].consignee || '').trim()) return guardErr('22023', `Satır ${i + 1}: Gönderici ve alıcı yazılmalı`);
            rows.forEach(p => {
              const l = { id: 'shp' + (++shpSeq), customer_id: k.customer, sender: p.sender, sender_addr: p.sender_addr || '', consignee: p.consignee, consignee_addr: p.consignee_addr || '', notify: p.notify || '', pieces: p.pieces || 0, packing: p.packing || 'KAP',
                goods: p.goods || '', weight: p.weight || 0, volume: p.volume == null ? null : p.volume, country: p.country || '', code: p.code || '', dest_customs: p.dest_customs || '', broker: p.broker || '', expected_date: p.expected_date || null,
                expected_time: p.expected_time || null, driver: p.driver || '', inbound_plate: String(p.inbound_plate || '').toUpperCase(), note: p.note || '', qr_code: qrNew(), status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, created_by: actor, created_at: now(), updated_at: now() };
              db.shp_loads.push(l); remember(k.customer, l); log(k.customer, actor, 'Yük eklendi', lsum(l));
            });
            return { data: { count: rows.length }, error: null };
          }
          if (name === 'shp_portal_report') {
            const ls = db.shp_loads.filter(l => l.customer_id === k.customer), ts = db.shp_trips.filter(t => t.customer_id === k.customer);
            const wk = iso => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
            const grp = fn => { const m = {}; ls.forEach(l => { const key = fn(l.created_at); m[key] = m[key] || { kg: 0, n: 0 }; m[key].kg += Number(l.weight) || 0; m[key].n++; }); return Object.entries(m).sort().map(([start, v]) => ({ start, kg: v.kg, loads: v.n })); };
            const mk = now().slice(0, 7), pk = new Date(Date.UTC(+mk.slice(0, 4), +mk.slice(5) - 2, 1)).toISOString().slice(0, 7);
            const inM = (l, key) => l.created_at.slice(0, 7) === key, sumKg = a => a.reduce((x, l) => x + (Number(l.weight) || 0), 0);
            const top = {}; ls.forEach(l => { const n = l.consignee.toUpperCase(); top[n] = top[n] || { kg: 0, n: 0 }; top[n].kg += Number(l.weight) || 0; top[n].n++; });
            const monthTrips = ts.filter(t => String(t.depart_date).slice(0, 7) === mk);
            const fills = monthTrips.map(t => sumKg(ls.filter(l => l.trip_id === t.id)) / 24000 * 100), dd = ts.filter(t => t.delivered_at && t.departed_at).map(t => (Date.parse(t.delivered_at) - Date.parse(t.departed_at)) / 864e5);
            return { data: { weeks: grp(wk).slice(-8), months: grp(i => i.slice(0, 7) + '-01').slice(-12),
              top: Object.entries(top).map(([name, v]) => ({ name, kg: v.kg, loads: v.n })).sort((a, b) => b.loads - a.loads || b.kg - a.kg).slice(0, 8),
              kpi: { month_loads: ls.filter(l => inM(l, mk)).length, month_kg: sumKg(ls.filter(l => inM(l, mk))), prev_loads: ls.filter(l => inM(l, pk)).length, prev_kg: sumKg(ls.filter(l => inM(l, pk))), month_trips: monthTrips.length,
                avg_fill: fills.length ? Math.round(fills.reduce((a, b) => a + b, 0) / fills.length) : null, avg_days: dd.length ? Math.round(dd.reduce((a, b) => a + b, 0) / dd.length * 10) / 10 : null },
              archive: ts.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(t => ({ id: t.id, poz_no: t.poz_no, tractor: t.tractor, trailer: t.trailer, depart_date: t.depart_date, status: t.status,
                loads: ls.filter(l => l.trip_id === t.id).length, kg: sumKg(ls.filter(l => l.trip_id === t.id)) })), today: now().slice(0, 10) }, error: null };
          }
          if (name === 'shp_portal_trip_docs') {
            const t = db.shp_trips.find(x => x.id === params.p_trip && x.customer_id === k.customer);
            if (!t) return guardErr('22023', 'Sefer bulunamadı');
            return { data: { trip: tripJson(t), loads: db.shp_loads.filter(l => l.trip_id === t.id).map(loadJson) }, error: null };
          }
          if (name === 'shp_portal_photos') return { data: db.shp_photos.filter(p => p.load_id === params.p_load && p.customer_id === k.customer).map(p => ({ id: p.id, thumb: p.thumb, by: p.by_name, at: p.created_at })), error: null };
          if (name === 'shp_portal_photo') { const p = db.shp_photos.find(x => x.id === params.p_photo && x.customer_id === k.customer); return p ? { data: p.data, error: null } : guardErr('22023', 'Fotoğraf bulunamadı'); }
          if (name === 'shp_portal_assign') {
            const ids = [...new Set(params.p_load_ids || [])];
            if (!ids.length) return guardErr('22023', 'Önce yük seçin');
            const ls = ids.map(id => db.shp_loads.find(l => l.id === id));
            if (ls.some(l => !l || l.customer_id !== k.customer || !['bekliyor', 'depoda'].includes(l.status) || l.trip_id))
              return guardErr('22023', 'Seçilen yüklerden bazıları artık araca konamaz (başka araçta ya da silinmiş); listeyi yenileyip tekrar seçin');
            let trip;
            if (params.p_trip) {
              trip = db.shp_trips.find(t => t.id === params.p_trip && t.customer_id === k.customer);
              if (!trip) return guardErr('22023', 'Araç bulunamadı');
              if (trip.status !== 'hazirlaniyor') return guardErr('22023', 'Bu araç yola çıktı, değişiklik için ofisle görüşün');
            } else {
              if (!String(params.p_tractor || '').trim()) return guardErr('22023', 'Çekici plakası gerekli');
              const yy = String(new Date().getFullYear() % 100).padStart(2, '0');
              cfg.pozSeq = cfg.pozSeq || {}; cfg.pozSeq[yy] = (cfg.pozSeq[yy] || 0) + 1;
              trip = { id: 'shpt' + (++shpSeq), poz_no: `PCS-${yy}-${String(cfg.pozSeq[yy]).padStart(4, '0')}`, customer_id: k.customer, tractor: String(params.p_tractor).trim().toUpperCase(),
                trailer: String(params.p_trailer || '').trim().toUpperCase(), depart_date: params.p_depart || now().slice(0, 10), subject: params.p_subject || '', status: 'hazirlaniyor', created_by: actor, created_at: now(), updated_at: now() };
              db.shp_trips.push(trip); rememberVeh(k.customer, trip); log(k.customer, actor, 'Sefer oluşturuldu', `${trip.poz_no} · ${trip.tractor}`);
            }
            ls.forEach(l => { Object.assign(l, { status: 'aracta', trip_id: trip.id, updated_at: now(), updated_by: actor }); log(k.customer, actor, 'Araca konuldu: ' + trip.poz_no + ' · ' + trip.tractor, lsum(l)); });
            return { data: { trip: tripJson(trip) }, error: null };
          }
          if (name === 'shp_portal_unassign') {
            const l = db.shp_loads.find(x => x.id === params.p_load_id && x.customer_id === k.customer && x.status === 'aracta');
            const t = l && db.shp_trips.find(x => x.id === l.trip_id);
            if (!l || !t || t.status !== 'hazirlaniyor') return guardErr('22023', 'Yük bir araçta değil ya da araç yola çıktığı için değiştirilemez');
            Object.assign(l, { status: l.arrived_at ? 'depoda' : 'bekliyor', trip_id: null, updated_at: now(), updated_by: actor }); log(k.customer, actor, 'Araçtan çıkarıldı', lsum(l));
            const gone = !db.shp_loads.some(x => x.trip_id === t.id);
            if (gone) { db.shp_trips = db.shp_trips.filter(x => x.id !== t.id); log(k.customer, actor, 'Sefer silindi', t.poz_no); }
            return { data: { trip_deleted: gone }, error: null };
          }
          if (name === 'shp_portal_trip_update') {
            const t = db.shp_trips.find(x => x.id === params.p_trip && x.customer_id === k.customer && x.status === 'hazirlaniyor');
            if (!t) return guardErr('22023', 'Araç bulunamadı ya da yola çıktığı için değiştirilemez');
            if (!String(params.p_tractor || '').trim()) return guardErr('22023', 'Çekici plakası gerekli');
            Object.assign(t, { tractor: String(params.p_tractor).trim().toUpperCase(), trailer: String(params.p_trailer || '').trim().toUpperCase(), depart_date: params.p_depart || t.depart_date, subject: params.p_subject || '', updated_at: now() });
            rememberVeh(k.customer, t); log(k.customer, actor, 'Araç bilgisi değiştirildi', `${t.poz_no} · ${t.tractor}`);
            return { data: tripJson(t), error: null };
          }
          if (name === 'shp_portal_delete') {
            const i = db.shp_loads.findIndex(l => l.id === params.p_id && l.customer_id === k.customer && ['bekliyor', 'depoda'].includes(l.status) && !l.trip_id);
            if (i < 0) return guardErr('22023', 'Yük bulunamadı ya da araca konduğu için silinemez; önce araçtan çıkarın');
            log(k.customer, actor, 'Yük silindi', lsum(db.shp_loads[i])); db.shp_loads.splice(i, 1); return { data: null, error: null };
          }
          const p = params.p_load || {};
          if (!String(p.sender || '').trim() || !String(p.consignee || '').trim()) return guardErr('22023', 'Gönderici ve alıcı yazılmalı');
          const row = { sender: p.sender, sender_addr: p.sender_addr || '', consignee: p.consignee, consignee_addr: p.consignee_addr || '', notify: p.notify || '', pieces: p.pieces || 0, packing: p.packing || 'KAP',
            goods: p.goods || '', weight: p.weight || 0, volume: p.volume == null ? null : p.volume, country: p.country || '', code: p.code || '', dest_customs: p.dest_customs || '', broker: p.broker || '',
            expected_date: p.expected_date || null, expected_time: p.expected_time || null, driver: p.driver || '', inbound_plate: String(p.inbound_plate || '').toUpperCase(), note: p.note || '' };
          if (p.id) {
            const l = db.shp_loads.find(x => x.id === p.id && x.customer_id === k.customer && ((['bekliyor', 'depoda'].includes(x.status) && !x.trip_id) || (x.status === 'aracta' && (db.shp_trips.find(t => t.id === x.trip_id) || {}).status === 'hazirlaniyor')));
            if (!l) return guardErr('22023', 'Yük bulunamadı ya da araç yola çıktığı için değiştirilemez');
            Object.assign(l, row, { updated_at: now(), updated_by: actor }); remember(k.customer, l); log(k.customer, actor, 'Yük düzenlendi', lsum(l)); return { data: loadJson(l), error: null };
          }
          const l = { id: 'shp' + (++shpSeq), customer_id: k.customer, ...row, expected_time: p.expected_time || null, driver: p.driver || '', qr_code: qrNew(), status: 'bekliyor', arrived_at: null, arrived_by: '', trip_id: null, created_by: actor, created_at: now(), updated_at: now() };
          db.shp_loads.push(l); remember(k.customer, l); log(k.customer, actor, 'Yük eklendi', lsum(l)); return { data: loadJson(l), error: null };
        }
        if (!k || k.kind !== 'depo' || !k.active) return bad();
        actor = 'Depo · ' + (String(params.p_name || '').trim() || 'adı yazılmamış');
        if (name === 'shp_depot') return { data: { now: now(), customers: clone(db.shp_customers.filter(c => c.active)), loads: db.shp_loads.map(loadJson), trips: db.shp_trips.map(tripJson),
          photo_counts: db.shp_photos.reduce((m, p) => ((m[p.load_id] = (m[p.load_id] || 0) + 1), m), {}) }, error: null };
        const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
        if (name === 'shp_depot_photos') return { data: db.shp_photos.filter(p => p.load_id === params.p_load).map(p => ({ id: p.id, thumb: p.thumb, by: p.by_name, at: p.created_at })), error: null };
        if (name === 'shp_depot_photo') { const p = db.shp_photos.find(x => x.id === params.p_photo); return p ? { data: p.data, error: null } : guardErr('22023', 'Fotoğraf bulunamadı'); }
        if (name === 'shp_depot_photo_add') {
          const l = db.shp_loads.find(x => x.id === params.p_load);
          if (!l) return guardErr('22023', 'Yük bulunamadı');
          if (db.shp_photos.filter(p => p.load_id === l.id).length >= 8) return guardErr('22023', 'Bir yüke en fazla 8 fotoğraf eklenebilir');
          if (!IMG.test(String(params.p_thumb)) || !IMG.test(String(params.p_data))) return guardErr('22023', 'Fotoğraf geçersiz ya da çok büyük');
          const ph = { id: 'pic' + (++shpSeq), load_id: l.id, customer_id: l.customer_id, thumb: params.p_thumb, data: params.p_data, by_name: String(params.p_name || '').trim(), created_at: now() };
          db.shp_photos.push(ph); l.updated_at = now(); log(l.customer_id, actor, 'Fotoğraf eklendi', `${l.sender} → ${l.consignee}`);
          return { data: { id: ph.id, thumb: ph.thumb, by: ph.by_name, at: ph.created_at }, error: null };
        }
        if (name === 'shp_depot_photo_del') { const i = db.shp_photos.findIndex(x => x.id === params.p_photo); if (i >= 0) { const l = db.shp_loads.find(x => x.id === db.shp_photos[i].load_id); db.shp_photos.splice(i, 1); if (l) l.updated_at = now(); } return { data: null, error: null }; }
        if (name === 'shp_depot_receive') {
          const l = db.shp_loads.find(x => x.id === params.p_id && ['bekliyor', 'depoda', 'aracta'].includes(x.status));
          if (!l) return guardErr('22023', 'Yük bulunamadı ya da bu işlem artık yapılamaz');
          const cond = params.p_condition || 'saglam';
          if (!['saglam', 'eksik', 'hasarli'].includes(cond)) return guardErr('22023', 'Durum seçimi geçersiz');
          const first = !l.arrived_at;
          Object.assign(l, { status: l.status === 'aracta' ? 'aracta' : 'depoda', arrived_at: l.arrived_at || now(), arrived_by: first ? String(params.p_name || '').trim() : l.arrived_by,
            counted_pieces: params.p_counted_pieces == null ? null : params.p_counted_pieces, counted_weight: params.p_counted_weight == null ? null : params.p_counted_weight, condition: cond,
            receive_note: String(params.p_note || '').trim(), location: String(params.p_location || '').trim(), updated_at: now(), updated_by: actor });
          if (first) enqueue(l.customer_id, 'geldi', `${l.sender} → ${l.consignee} · ${l.pieces} kap · ${l.weight} kg`);
          if (cond !== 'saglam' || (l.counted_pieces != null && l.counted_pieces !== l.pieces)) enqueue(l.customer_id, 'sorun', `${l.sender} → ${l.consignee}: ${cond === 'eksik' ? 'eksik var' : cond === 'hasarli' ? 'hasarlı' : 'sayım farkı'}`);
          log(l.customer_id, actor, first ? 'Depoya geldi olarak işaretlendi' : 'Depo teslim bilgisi girildi', lsum(l));
          return { data: loadJson(l), error: null };
        }
        if (name === 'shp_depot_depart') {
          const t = db.shp_trips.find(x => x.id === params.p_trip);
          if (!t) return guardErr('22023', 'Sefer bulunamadı');
          if (t.status !== 'hazirlaniyor') return guardErr('22023', 'Bu araç zaten yola çıkmış');
          const ls = db.shp_loads.filter(l => l.trip_id === t.id);
          if (!ls.length) return guardErr('22023', 'Araçta yük yok');
          if (ls.some(l => !l.arrived_at)) return guardErr('22023', 'Depoya gelmemiş yük var; hepsi gelmeden araç yola çıkarılamaz (ofisle görüşün)');
          Object.assign(t, { status: 'yolda', departed_at: now(), updated_at: now() }); enqueue(t.customer_id, 'yola', `${t.tractor} · ${t.poz_no}`); log(t.customer_id, actor, 'Sefer kilitlendi (yola çıktı)', t.poz_no);
          return { data: tripJson(t), error: null };
        }
        if (name === 'shp_depot_save') {
          const p = params.p_load || {};
          if (!String(p.sender || '').trim() || !String(p.consignee || '').trim()) return guardErr('22023', 'Gönderici ve alıcı yazılmalı');
          const l = db.shp_loads.find(x => x.id === p.id);
          if (!l) return guardErr('22023', 'Yük bulunamadı');
          Object.assign(l, { sender: p.sender, consignee: p.consignee, sender_addr: p.sender_addr || '', consignee_addr: p.consignee_addr || '', notify: p.notify || '', pieces: p.pieces || 0, packing: p.packing || 'KAP',
            goods: p.goods || '', weight: p.weight || 0, volume: p.volume == null ? null : p.volume, country: p.country || '', code: p.code || '', dest_customs: p.dest_customs || '', broker: p.broker || '',
            expected_date: p.expected_date || null, expected_time: p.expected_time || null, driver: p.driver || '', inbound_plate: String(p.inbound_plate || '').toUpperCase(), note: p.note || '', updated_at: now(), updated_by: actor });
          log(l.customer_id, actor, 'Yük düzenlendi', lsum(l));
          return { data: loadJson(l), error: null };
        }
        if (name === 'shp_depot_delete') {
          const i = db.shp_loads.findIndex(x => x.id === params.p_id && ['bekliyor', 'depoda'].includes(x.status) && !x.trip_id);
          if (i < 0) return guardErr('22023', 'Yük bulunamadı ya da araca konduğu için silinemez; önce araçtan çıkarılmalı');
          log(db.shp_loads[i].customer_id, actor, 'Yük silindi', lsum(db.shp_loads[i])); db.shp_loads.splice(i, 1); return { data: null, error: null };
        }
        const l = db.shp_loads.find(x => x.id === params.p_id && (params.p_arrived === false ? ['depoda', 'aracta'].includes(x.status) && x.arrived_at : ['bekliyor', 'depoda', 'aracta'].includes(x.status)));
        if (!l) return guardErr('22023', 'Yük bulunamadı ya da bu işlem artık yapılamaz');
        if (params.p_arrived === false) Object.assign(l, { status: l.status === 'aracta' ? 'aracta' : 'bekliyor', arrived_at: null, arrived_by: '', updated_at: now(), updated_by: actor });
        else { const was = !!l.arrived_at; Object.assign(l, { status: l.status === 'aracta' ? 'aracta' : 'depoda', arrived_at: now(), arrived_by: String(params.p_name || '').trim(), updated_at: now(), updated_by: actor }); if (!was) enqueue(l.customer_id, 'geldi', `${l.sender} → ${l.consignee} · ${l.pieces} kap · ${l.weight} kg`); }
        log(l.customer_id, actor, params.p_arrived === false ? 'Geldi işareti geri alındı' : 'Depoya geldi olarak işaretlendi', lsum(l));
        return { data: loadJson(l), error: null };
      }
      if (name === 'current_app_role') return { data: cfg.role || 'editor', error: null };
      // Görünüm vb. ortak ayarlar (ayar-kaydetme-kurulumu.sql'in sade karşılığı)
      if (name === 'save_app_setting') {
        const rows = (db.app_settings = db.app_settings || []), r = rows.find(x => x.key === params.p_key);
        const v = { key: params.p_key, value: clone(params.p_value), updated_at: now() };
        if (r) Object.assign(r, v); else rows.push(v);
        return { data: null, error: null };
      }
      if (name === 'set_visit_order') {   // elle sıralama: verilen sırayla sort_order yazılır
        (params.p_ids || []).forEach((id, i) => { const v = db.visits.find(x => x.id === id); if (v) v.sort_order = i; });
        return { data: null, error: null };
      }
      if (name === 'list_backups') return { data: [{ id: 1, taken_at: now() }], error: null };
      if (name === 'visit_history') return { data: (cfg.history || {})[params.p_visit_id] || [], error: null };
      return { data: null, error: null };
    }
  });
})();
