/* Testlerde gerçek Supabase yerine kullanılan sahte istemci (vendor.js yerine yüklenir).
 * Ayarlar sayfa açılmadan önce window.__PCS_STUB ile verilir:
 *   { session: true|false, role: 'editor'|'viewer', data: {registry, visits, app_settings, incoming_ruhsat}, offline: false,
 *     files: { 'depo/yolu.png': base64 },   // storage.download için dosyalar
 *     missing: ['incoming_ruhsat'] }        // "tablo yok" hatası veren tablolar (kurulum yapılmamış gibi)
 * Yapılan her çağrı window.__calls dizisine yazılır. */
(() => {
  const cfg = window.__PCS_STUB || {};
  const calls = (window.__calls = []);
  const db = (window.__db = {
    registry: (cfg.data && cfg.data.registry) || [],
    visits: (cfg.data && cfg.data.visits) || [],
    app_settings: (cfg.data && cfg.data.app_settings) || [],
    incoming_ruhsat: (cfg.data && cfg.data.incoming_ruhsat) || []
  });
  const netError = () => ({ data: null, count: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
  const clone = v => JSON.parse(JSON.stringify(v));
  const now = () => new Date().toISOString();

  // PostgREST mantık filtresi: "status.eq.yeni,and(status.eq.okunuyor,claimed_at.lt.\"2026-...\")"
  function splitTop(s) { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
  function cond(s) {
    const m = /^([a-z_]+)\.(eq|neq|lt|gt)\.(.*)$/.exec(s); if (!m) throw new Error('stub: filtre anlaşılamadı ' + s);
    const val = m[3].replace(/^"|"$/g, '');
    return r => { const x = r[m[1]]; if (m[2] === 'eq') return String(x) === val; if (m[2] === 'neq') return String(x) !== val; if (x == null) return false; return m[2] === 'lt' ? String(x) < val : String(x) > val; };
  }
  function logic(s, any) { const parts = splitTop(s).map(p => { const m = /^(and|or)\((.*)\)$/.exec(p); return m ? logic(m[2], m[1] === 'or') : cond(p); }); return r => (any ? parts.some(f => f(r)) : parts.every(f => f(r))); }

  function query(table) {
    const st = { table, op: 'select', filters: [], order: null, from: 0, to: Infinity, count: null, cols: '*', rows: null, patch: null };
    const rowsNow = () => (db[table] || []).filter(r => st.filters.every(f => f(r)));
    const q = {
      select(cols, opts) { if (st.op === 'select') st.cols = cols || '*'; if (opts && opts.count) st.count = opts.count; return q; },
      order(col, opts) { st.order = { col, asc: !opts || opts.ascending !== false }; return q; },
      range(a, b) { st.from = a; st.to = b; return q; },
      limit(n) { st.to = st.from + n - 1; return q; },
      eq(col, val) { st.filters.push(r => r[col] === val); return q; },
      in(col, vals) { st.filters.push(r => vals.includes(r[col])); return q; },
      or(expr) { st.filters.push(logic(expr, true)); return q; },
      insert(rows) { st.op = 'insert'; st.rows = Array.isArray(rows) ? rows : [rows]; return q; },
      update(patch) { st.op = 'update'; st.patch = patch; return q; },
      delete() { st.op = 'delete'; return q; },
      then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); }
    };
    function run() {
      calls.push({ table, op: st.op, cols: st.cols, count: st.count, rows: st.rows && clone(st.rows) });
      if (window.__hang) return new Promise(() => {}); // takılan istek: hiç cevap gelmez
      if (cfg.offline) return netError();
      if ((cfg.missing || []).includes(table)) return { data: null, count: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` } };
      const t = db[table] || (db[table] = []);
      if (st.op === 'insert') {
        const plate = r => String(r.plate || '').replace(/\s/g, '').toUpperCase();
        if (table === 'registry' && st.rows.some(r => t.some(x => plate(x) === plate(r))))
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        const added = st.rows.map(r => ({ ...r, created_at: now(), updated_at: now() }));
        t.push(...added);
        return { data: clone(added), error: null };
      }
      if (st.op === 'update') {
        const hit = rowsNow();
        hit.forEach(r => Object.assign(r, st.patch, { updated_at: now() }));
        return { data: clone(hit), error: null };
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
      return { data: clone(rows), count: st.count ? total : null, error: null };
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
      async signInWithPassword() { session = { user: { id: 'u1', email: 'test@ornek.com' }, access_token: 'x' }; emit('SIGNED_IN'); return { error: null }; },
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
    async rpc(name) {
      calls.push({ rpc: name });
      if (cfg.offline) return netError();
      if (name === 'current_app_role') return { data: cfg.role || 'editor', error: null };
      if (name === 'list_backups') return { data: [{ id: 1, taken_at: now() }], error: null };
      if (name === 'visit_history') return { data: [], error: null };
      return { data: null, error: null };
    }
  });
})();
