/* Nakliye müşteri sayfası ek ekranları: Takip (durum çizgisi + bildirim ayarı), Rapor ve arşiv, Excel'den toplu yük; sohbet balonu (müşteri ile depo yazışması).
 * Fotoğraf görüntüleyici müşteri ve depo sayfasında ortaktır. nakliye-sayfa.js çekirdeğine window.PCSNKP üzerinden bağlanır. */
(() => {
  'use strict';
  const X = window.PCSNKP;
  if (!X) return;
  const { P, esc, ic, kg, ton, stamp, uniq, plate, tr } = X;
  const B = X.B;
  const M = { rp: 'hafta', report: null, month: '', msg: { body: '', ref: '' }, dc: '', nf: null, imp: null, stick: false, reading: false, ph: null };

  const cut = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const dt = iso => stamp(iso);
  const download = (name, text, type = 'text/csv;charset=utf-8') => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const csvCell = v => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  // ------------------------------------------------------------------ fotoğraf görüntüleyici (müşteri ve depo)
  async function photoDialog(loadId, startId) {
    const m = X.MODE === 'm', l = (P.data.loads || []).find(x => x.id === loadId);
    X.dialog(`<div class="mh"><div><h2>Fotoğraflar</h2><p>${l ? esc(l.sender + ' → ' + l.consignee) : ''}</p></div><button type="button" class="x" data-a="mclose" aria-label="Kapat">${ic('close')}</button></div><div class="mb"><p class="mut">Yükleniyor…</p></div>`);
    const r = await X.rpc(m ? 'shp_portal_photos' : 'shp_depot_photos', { p_load: loadId });
    if (r.error) { X.toast(X.explain(r.error), true); return; }
    M.ph = { loadId, list: r.data || [], cur: startId || (r.data && r.data[0] && r.data[0].id) || '', full: {} };
    drawPhotos();
    if (M.ph.cur) showPhoto(M.ph.cur);
  }
  function drawPhotos() {
    const ph = M.ph, l = (P.data.loads || []).find(x => x.id === ph.loadId);
    const big = ph.cur ? (ph.full[ph.cur] ? `<img class="phbig" src="${esc(ph.full[ph.cur])}" alt="Yük fotoğrafı">` : '<p class="mut">Fotoğraf yükleniyor…</p>') : '<p class="mut">Bu yük için fotoğraf yok.</p>';
    X.dialog(`<div class="mh"><div><h2>Fotoğraflar (${ph.list.length})</h2><p>${l ? esc(l.sender + ' → ' + l.consignee) : ''}</p></div><button type="button" class="x" data-a="mclose" aria-label="Kapat">${ic('close')}</button></div>
<div class="mb"><div class="phwrap">${big}</div><div class="phs">${ph.list.map(p => `<button type="button" class="pht ${p.id === ph.cur ? 'on' : ''}" data-a="ph-show" data-id="${esc(p.id)}" aria-label="Fotoğrafı göster"><img src="${esc(p.thumb)}" alt=""><small>${esc(dt(p.at))}${p.by ? ' · ' + esc(p.by) : ''}</small></button>`).join('')}</div>
${l && (l.receive_note || l.condition) ? `<div class="ferr" style="background:#fff7e0;color:#7a4f00">${ic('warn')} ${esc(l.condition === 'eksik' ? 'Eksik var' : l.condition === 'hasarli' ? 'Hasarlı' : 'Not')}${l.receive_note ? ': ' + esc(l.receive_note) : ''}</div>` : ''}</div>
<div class="mf"><span class="sp"></span><button type="button" class="btn" data-a="mclose">Kapat</button></div>`);
  }
  async function showPhoto(id) {
    const ph = M.ph; if (!ph) return;
    ph.cur = id;
    if (!ph.full[id]) {
      drawPhotos();
      const r = await X.rpc(X.MODE === 'm' ? 'shp_portal_photo' : 'shp_depot_photo', { p_photo: id });
      if (r.error) { X.toast(X.explain(r.error), true); return; }
      ph.full[id] = r.data;
    }
    if (M.ph === ph && ph.cur === id) drawPhotos();
  }
  X.act.photos = (t, e, id) => photoDialog(id);
  X.act['ph-show'] = (t, e, id) => showPhoto(id);
  X.photoDialog = photoDialog;

  // ------------------------------------------------------------------ sohbet balonu (müşteri: ofisle yazışma · depo: ofisle yazışma)
  // Müşteri ↔ depo yazışması. Müşteri sayfasında tek konuşma (depo ile); depo sayfasında müşteri seçilir.
  // Okundu işareti alıcıya aittir: müşterinin yazdığını depo okuyunca, deponun yazdığını müşteri okuyunca işaretlenir.
  const CUST = X.MODE === 'm', MINE = CUST ? 'musteri' : 'depo';
  const THEM = m => CUST ? (m.from_role === 'ofis' || m.from_role === 'depo') : m.from_role === 'musteri';   // bana yazılan mesaj mı
  const custName = id => ((P.data.customers || []).find(c => c.id === id) || {}).name || '?';
  const allMsgs = () => P.data.messages || [];
  const cur = () => {                                                       // depo: açık konuşmanın müşterisi
    if (CUST) return '';
    const cs = (P.data.customers || []);
    if (M.dc && cs.some(c => c.id === M.dc)) return M.dc;
    const unread = allMsgs().filter(m => THEM(m) && !m.read_at).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
    const last = allMsgs().slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    return (unread || last || {}).customer_id || (cs[0] || {}).id || '';
  };
  const thread = () => CUST ? allMsgs() : allMsgs().filter(m => m.customer_id === cur());
  const unreadAll = () => allMsgs().filter(m => THEM(m) && !m.read_at).length;
  const unreadHere = () => thread().filter(m => THEM(m) && !m.read_at).length;
  async function markRead() {
    if (M.reading || !unreadHere()) return;
    M.reading = true;
    const cid = cur();
    const r = await (CUST ? X.rpc('shp_portal_messages_read') : X.rpc('shp_depot_messages_read', { p_name: X.name(), p_customer: cid }));
    M.reading = false;
    if (!r.error) { thread().forEach(m => { if (THEM(m) && !m.read_at) m.read_at = new Date().toISOString(); }); X.draw(); }
  }
  // Sohbet balonu: sayfanın sağ altında, ana ekrandaki sohbet balonu gibi
  const CH = { open: false };
  const openChat = () => { M.dc = cur(); CH.open = true; CH.n = thread().length; M.stick = true; X.draw(); setTimeout(() => { markRead(); const t = document.getElementById('msg-body'); if (t && !document.activeElement.matches('input,textarea,select')) t.focus(); }, 60); };
  const closeChat = () => { CH.open = false; X.draw(); };
  X.act['chat-toggle'] = () => { CH.open ? closeChat() : openChat(); };
  X.act['chat-close'] = () => closeChat();
  X.after.push(() => { if (CH.open) { const n = thread().length; if (n !== CH.n) { CH.n = n; M.stick = true; } setTimeout(markRead, 50); } });
  X.onDraw.push(() => { const el = document.getElementById('msgs'); if (el && M.stick) { el.scrollTop = el.scrollHeight; M.stick = false; } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && CH.open && !document.querySelector('dialog[open]')) { CH.open = false; X.draw(); return; }
    // Enter gönderir, Shift+Enter yeni satır
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target && e.target.id === 'msg-body') { e.preventDefault(); X.submit.msg().catch(() => {}); }
  });
  const refLabel = m => { const l = m.load_id && (P.data.loads || []).find(x => x.id === m.load_id), t = m.trip_id && X.tripOf(m.trip_id);
    return l ? `${ic('box')}${esc(cut(l.sender + ' → ' + l.consignee, 40))}` : t ? `${ic('truck')}${esc(t.poz_no)} · ${esc(t.tractor)}` : ''; };
  const who = m => m.from_role === 'ofis' ? 'Ofis' : m.from_role === 'depo' ? (CUST ? 'Depo' : m.author || 'Depo') : (CUST ? m.author || 'Siz' : m.author || 'Müşteri');
  // depo: konuşma listesi (okunmamışı olan müşteri üstte, sonra en son yazışılan)
  function customerOptions() {
    const by = {};
    allMsgs().forEach(m => { const o = by[m.customer_id] = by[m.customer_id] || { un: 0, at: '' }; if (THEM(m) && !m.read_at) o.un++; if (String(m.created_at) > o.at) o.at = String(m.created_at); });
    return (P.data.customers || []).map(c => ({ id: c.id, name: c.name, un: (by[c.id] || {}).un || 0, at: (by[c.id] || {}).at || '' }))
      .sort((a, b) => (b.un > 0) - (a.un > 0) || b.at.localeCompare(a.at) || a.name.localeCompare(b.name, 'tr'));
  }
  function chatWidget() {
    const un = unreadAll();
    let panel = '';
    if (CH.open) {
      const ms = thread(), cid = cur();
      const trips = CUST ? X.sortedTrips().slice(0, 12) : [], loads = CUST ? (P.data.loads || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 25) : [];
      const bubble = m => `<div class="m ${m.from_role === MINE ? 'me' : 'o'}">${esc(m.body).replace(/\n/g, '<br>')}${refLabel(m) ? `<span class="lk">${refLabel(m)}</span>` : ''}<small>${esc(dt(m.created_at))} · ${esc(who(m))}</small></div>`;
      const head = CUST ? ['Depo ile yazışma', 'Yükünüz ya da aracınızla ilgili depoya yazın; cevap burada görünür'] : ['Müşteri yazışmaları', 'Müşteri seçin; yazdıkları ve cevabınız burada görünür'];
      const pick = CUST ? `<select data-i="msg-ref" aria-label="Mesajın konusu"><option value="">Konu: genel</option>${trips.length ? `<optgroup label="Araçlarım">${trips.map(t => `<option value="t:${esc(t.id)}" ${M.msg.ref === 't:' + t.id ? 'selected' : ''}>${esc(t.poz_no)} · ${esc(t.tractor)}</option>`).join('')}</optgroup>` : ''}${loads.length ? `<optgroup label="Yüklerim">${loads.map(l => `<option value="l:${esc(l.id)}" ${M.msg.ref === 'l:' + l.id ? 'selected' : ''}>${esc(cut(l.sender + ' → ' + l.consignee, 48))}</option>`).join('')}</optgroup>` : ''}</select>`
        : `<select data-i="dc-cust" aria-label="Müşteri seç">${customerOptions().map(o => `<option value="${esc(o.id)}" ${o.id === cid ? 'selected' : ''}>${esc(o.name)}${o.un ? ` (${o.un} yeni)` : ''}</option>`).join('')}</select>`;
      panel = `<div class="cpanel" id="chat-panel" role="dialog" aria-label="${head[0]}"><div class="chead"><span class="cava">PCS</span><div><b>${head[0]}</b><small>${head[1]}</small></div><button type="button" class="cx" data-a="chat-close" aria-label="Sohbeti kapat">${ic('close')}</button></div>
<div class="msgs" id="msgs">${ms.length ? ms.map(bubble).join('') : `<div class="empty">${CUST ? 'Henüz mesaj yok. Aşağıdan depoya yazabilirsiniz.' : `${esc(custName(cid))} ile henüz yazışma yok.`}</div>`}</div>
<form data-f="msg" class="cform">${pick}
<div class="crow"><textarea id="msg-body" data-i="msg-body" rows="2" maxlength="1000" placeholder="${CUST ? 'Depoya yazın…' : esc(custName(cid)) + ' için yazın…'}" aria-label="Mesajınız">${esc(M.msg.body)}</textarea><button type="submit" class="csend" aria-label="Gönder">${ic('send')}</button></div>
<div id="msg-err" class="ferr" hidden role="alert"></div></form></div>`;
    }
    const label = CUST ? 'Depo ile yazışma' : 'Müşteri yazışmaları';
    return `<div class="cwrap">${panel}<button type="button" class="cfab ${CH.open ? 'open' : ''}" id="chat-fab" data-a="chat-toggle" aria-label="${label}" aria-expanded="${CH.open}">${ic(CH.open ? 'close' : 'chat')}${un && !CH.open ? `<span class="cdot" aria-label="${un} okunmamış mesaj">${un}</span>` : ''}</button></div>`;
  }
  X.floats.push(chatWidget);
  X.inp.push((t, k) => {
    if (k === 'msg-body') { M.msg.body = t.value; return true; }
    if (k === 'msg-ref') { M.msg.ref = t.value; return true; }
    if (k === 'dc-cust') { M.dc = t.value; M.stick = true; X.draw(); setTimeout(markRead, 50); return true; }
    return false;
  });
  X.submit.msg = async () => {
    const err = m => { const e = document.getElementById('msg-err'); if (e) { e.textContent = m; e.hidden = !m; } };
    const body = M.msg.body.trim();
    if (!body) return err('Mesaj yazın.');
    const ref = M.msg.ref, r = CUST ? await X.rpc('shp_portal_message_send', { p_body: body, p_load: ref.startsWith('l:') ? ref.slice(2) : null, p_trip: ref.startsWith('t:') ? ref.slice(2) : null })
      : await X.rpc('shp_depot_message_send', { p_name: X.name(), p_customer: cur(), p_body: body });
    if (r.error) { err(X.explain(r.error)); return; }
    (P.data.messages = P.data.messages || []).push(r.data); M.msg.body = ''; M.stick = true; X.draw(); X.load0();
  };



  if (X.MODE !== 'm') return;   // buradan sonrası yalnızca müşteri sayfası

  // ------------------------------------------------------------------ Takip: durum çizgisi
  const delivered = l => { const t = X.tripOf(l.trip_id); return !!t && t.status === 'teslim'; };
  function steps(l) {
    const t = X.tripOf(l.trip_id), out = t && (t.status === 'yolda' || t.status === 'teslim');
    const list = [['Yazıldı', l.created_at, true], ['Depoya geldi', l.arrived_at, !!l.arrived_at], ['Araca kondu', l.assigned_at, !!l.trip_id],
      ['Yolda', t && t.departed_at, !!out], ['Teslim', t && t.delivered_at, !!t && t.status === 'teslim']];
    const cur = list.findIndex(s => !s[2]);
    return list.map((s, i) => {
      const cls = s[2] ? 'done' : i === cur ? 'cur' : 'todo';
      let sub = '—';
      if (s[2]) sub = s[1] ? dt(s[1]) : '✓';
      else if (i === cur) sub = i === 1 && l.expected_date ? `bekleniyor · ${B.dmy(l.expected_date)}${l.expected_time ? ' ' + l.expected_time : ''}` : 'bekleniyor';
      const icon = s[2] ? '✓' : i === cur ? ic(['', 'clock', 'box', 'truck', 'check'][i] || 'clock') : String(i + 1);
      return `<div class="s ${cls}"><i>${icon}</i><b>${s[0]}</b><small>${esc(sub)}${i === 1 && l.arrived_at && l.location ? ' · ' + esc(l.location) : ''}</small></div>`;
    }).join('');
  }
  function trackCard(l) {
    const t = X.tripOf(l.trip_id), pc = (P.data.photo_counts || {})[l.id] || 0;
    const sorun = X.condChip(l) ? `<div class="warnbox">${ic('warn')}<div><b>${l.condition === 'hasarli' ? 'Yük hasarlı bildirildi' : l.condition === 'eksik' ? 'Eksik var bildirildi' : 'Sayım farkı var'}</b>${l.counted_pieces != null && l.counted_pieces !== l.pieces ? ` · beyan ${esc(l.pieces)} kap, sayılan ${esc(l.counted_pieces)} kap` : ''}${l.receive_note ? `<div>${esc(l.receive_note)}</div>` : ''}</div></div>` : '';
    return `<article class="ld"><div class="h"><div><b>${esc(l.sender)} → ${esc(l.consignee)}</b><small>${esc(l.goods)}${l.goods ? ' · ' : ''}${esc(l.pieces)} ${esc(l.packing)} · ${kg(l.weight)} kg${l.qr_code ? ` · kod ${esc(l.qr_code)}` : ''}</small></div>
<div class="hr">${plate(t ? t.tractor : l.inbound_plate, t ? '' : 'in')}${t ? `<span class="ch b">${esc(t.poz_no)}</span>` : ''}${delivered(l) ? '<span class="ch g">Teslim edildi</span>' : ''}${pc ? `<button type="button" class="lnk" data-a="photos" data-id="${esc(l.id)}">${ic('camera')}Fotoğraflar (${pc})</button>` : ''}</div></div>
<div class="tl5">${steps(l)}</div>${sorun}</article>`;
  }
  const DEF = { geldi: ['Yük depoya gelince', '📦 Yükünüz depoya geldi'], yola: ['Araç yola çıkınca', '🚚 Aracınız yola çıktı'], teslim: ['Teslim edilince', '✅ Yükünüz teslim edildi'],
    sorun: ['Eksik / hasar bildirilince', '⚠️ Yükünüzde sorun bildirildi'], mesaj: ['Depo ya da ofis mesaj yazınca', '💬 Yeni mesaj'] };
  function nfState() {
    if (!M.nf) { const n = P.data.notify || {}; M.nf = { phone: n.phone || '', events: { geldi: true, yola: true, teslim: true, sorun: true, mesaj: true, ...(n.events || {}) }, saved: true }; }
    return M.nf;
  }
  function preview() {
    const all = P.data.loads || [], l = all.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const t = l && X.tripOf(l.trip_id) || X.sortedTrips()[0];
    const line = l ? `${l.sender} → ${l.consignee} · ${l.pieces} kap · ${kg(l.weight)} kg` : 'ÖRNEK GÖNDERİCİ → ÖRNEK ALICI · 10 kap · 1.000 kg';
    const trip = t ? `${t.tractor}${t.trailer ? ' / ' + t.trailer : ''} · ${t.poz_no}` : '34 ABC 123 · PCS-26-0001';
    const b = (head, body, tm) => `<div class="msg">${esc(head)}<br>${body}<small>${tm}</small></div>`;
    return `<div class="wa"><div class="bar"><i>PCS</i><div><b>PCS TRANSİT</b><small>bildirim örneği</small></div></div>${b(DEF.geldi[1], esc(line), '11:00')}${b(DEF.yola[1], esc(trip) + '<br>Lade Liste ve CMR belgeleriniz hazır.', '06:31')}</div>`;
  }
  X.views.takip = () => {
    const nf = nfState(), all = (P.data.loads || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const act = all.filter(l => !delivered(l)), done = all.filter(delivered).slice(0, 20);
    const onRoad = all.filter(l => { const t = X.tripOf(l.trip_id); return t && t.status === 'yolda'; }).length;
    return `<div class="tk"><div><div class="tit"><h1>Yüklerim nerede?</h1>${onRoad ? `<span class="ch b">${onRoad} yük yolda</span>` : ''}</div>
${act.length ? act.map(trackCard).join('') : '<div class="card empty">Takip edilecek yük yok. "Yükler ve araçlar" sayfasından yük ekleyin.</div>'}
${done.length ? `<h3 class="sech">Teslim edilenler</h3>${done.map(trackCard).join('')}` : ''}</div>
<aside class="side2">${preview()}
<form class="card" data-f="notify"><h2>Bildirimler</h2><small>Hangi haberleri WhatsApp'tan alacağınızı siz seçersiniz</small>
${Object.entries(DEF).map(([k, v]) => `<label class="tg"><span>${v[0]}</span><input type="checkbox" role="switch" data-i="nf-ev-${k}" ${nf.events[k] ? 'checked' : ''}></label>`).join('')}
<label class="fld" style="margin-top:12px"><span>WhatsApp numarası</span><input id="nf-phone" data-i="nf-phone" type="tel" value="${esc(nf.phone)}" placeholder="+90 5xx xxx xx xx" autocomplete="tel" maxlength="30"></label>
<div id="nf-err" class="ferr" hidden role="alert"></div><button type="submit" class="btn pri wide" style="margin-top:10px">${ic('check')}Bildirim ayarlarını kaydet</button>
<small style="margin-top:8px">${nf.phone ? '' : 'Numara yazılmazsa bildirim gönderilmez. '}Bildirimleri ofisimiz gönderir; mesajlar bu sayfadaki bilgilerden hazırlanır.</small></form></aside></div>`;
  };
  X.inp.push((t, k) => {
    if (k === 'nf-phone') { nfState().phone = t.value; nfState().saved = false; return true; }
    if (k.startsWith('nf-ev-')) { nfState().events[k.slice(6)] = t.checked; nfState().saved = false; return true; }
    return false;
  });
  X.submit.notify = async () => {
    const nf = nfState(), err = m => { const e = document.getElementById('nf-err'); if (e) { e.textContent = m; e.hidden = !m; } };
    const r = await X.rpc('shp_portal_notify_save', { p_phone: nf.phone.trim(), p_events: nf.events });
    if (r.error) { err(X.explain(r.error)); return; }
    M.nf = null; P.data.notify = r.data; X.toast('Bildirim ayarlarınız kaydedildi'); X.draw();
  };

  // ------------------------------------------------------------------ Rapor ve arşiv
  async function fetchReport() {
    const r = await X.rpc('shp_portal_report');
    if (r.error) { X.toast(X.explain(r.error), true); return; }
    M.report = r.data; if (P.page === 'rapor') X.draw();
  }
  X.enter.rapor = () => { fetchReport(); };
  X.after.push(() => { if (P.page === 'rapor') fetchReport(); });
  const MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const monthKey = d => String(d || '').slice(0, 7);
  const monthLabel = k => `${MON[Number(k.slice(5, 7)) - 1] || ''} ${k.slice(0, 4)}`;
  const tripStatus = t => t.status === 'teslim' ? '<span class="ch g">Teslim</span>' : t.status === 'yolda' ? '<span class="ch b">Yolda</span>' : '<span class="ch a">Hazırlanıyor</span>';
  X.views.rapor = () => {
    const r = M.report;
    if (!r) return '<div class="card empty">Rapor hazırlanıyor…</div>';
    const k = r.kpi || {}, pc = (a, b) => b > 0 ? Math.round((a - b) / b * 100) : null;
    const dl = pc(k.month_loads, k.prev_loads), dk = pc(k.month_kg, k.prev_kg);
    const arrow = v => v == null ? '' : `<em class="${v >= 0 ? 'up' : 'dn'}">${v >= 0 ? '▲' : '▼'} %${Math.abs(v)} geçen aya göre</em>`;
    const kp = (t, v, n) => `<div class="k2"><small>${t}</small><b>${v}</b>${n || ''}</div>`;
    const series = M.rp === 'ay' ? (r.months || []).map(x => ({ l: MON[Number(String(x.start).slice(5, 7)) - 1], kg: Number(x.kg) })) : (r.weeks || []).map(x => ({ l: B.dmy(x.start).slice(0, 5), kg: Number(x.kg) }));
    const mx = Math.max(1, ...series.map(s => s.kg));
    const top = r.top || [], tmx = Math.max(1, ...top.map(x => Number(x.kg)));
    const arch = (r.archive || []);
    const months = uniq(arch.map(t => monthKey(t.depart_date))).sort().reverse();
    if (!M.month || (M.month !== 'hepsi' && !months.includes(M.month))) M.month = months[0] || 'hepsi';
    const shown = arch.filter(t => M.month === 'hepsi' || monthKey(t.depart_date) === M.month);
    return `<div class="rp"><div><div class="kp4">${kp('Bu ay yük', k.month_loads || 0, arrow(dl))}${kp('Bu ay ağırlık', `${ton(k.month_kg)} t`, arrow(dk))}${kp('Bu ay sefer', k.month_trips || 0, k.avg_fill != null ? `<em>ortalama %${esc(k.avg_fill)} dolu</em>` : '')}${kp('Teslim süresi', k.avg_days != null ? `${String(k.avg_days).replace('.', ',')} gün` : '—', '<em>yola çıkıştan teslime</em>')}</div>
<section class="card"><div class="rph"><h2>${M.rp === 'ay' ? 'Aylık' : 'Haftalık'} ağırlık (ton)</h2><div class="seg"><button type="button" class="${M.rp === 'hafta' ? 'on' : ''}" data-a="rp-mode" data-v="hafta">Hafta</button><button type="button" class="${M.rp === 'ay' ? 'on' : ''}" data-a="rp-mode" data-v="ay">Ay</button><button type="button" class="btn sm" data-a="rp-csv">${ic('download')}Excel (CSV)</button></div></div>
${series.length ? `<div class="chart">${series.map(s => `<div class="c"><b>${(s.kg / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</b><i style="height:${Math.max(3, Math.round(s.kg / mx * 100))}%"></i></div>`).join('')}</div><div class="lbl">${series.map(s => `<span>${esc(s.l)}</span>`).join('')}</div>` : '<div class="empty">Henüz veri yok.</div>'}</section>
<div class="two"><section class="card top5"><h2>En çok yük giden alıcılar</h2>${top.length ? top.map(x => `<div><span title="${esc(x.name)}">${esc(cut(x.name, 22))}</span><div class="bar"><i style="width:${Math.round(Number(x.kg) / tmx * 100)}%"></i></div><b>${ton(x.kg)} t</b></div>`).join('') : '<div class="empty">Henüz veri yok.</div>'}</section>
<section class="card flush"><div class="arh"><h2>Sefer arşivi</h2><select data-i="rp-month" aria-label="Ay seç"><option value="hepsi" ${M.month === 'hepsi' ? 'selected' : ''}>Tümü</option>${months.map(m => `<option value="${m}" ${M.month === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></div>
${shown.length ? `<div class="scroll"><table class="tbl2"><thead><tr><th>Poz No</th><th>Plaka</th><th>Çıkış</th><th>Durum</th><th>Yük</th><th></th></tr></thead><tbody>${shown.map(t => `<tr><td><b>${esc(t.poz_no)}</b></td><td>${esc(B.plates(t))}</td><td>${esc(B.dmy(t.depart_date))}</td><td>${tripStatus(t)}</td><td>${esc(t.loads)} · ${ton(t.kg)} t</td><td><button type="button" class="btn sm" data-a="arc-doc" data-id="${esc(t.id)}">${ic('doc')}Belgeler</button></td></tr>`).join('')}</tbody></table></div>
<div class="arf"><button type="button" class="btn pri wide" data-a="arc-month">${ic('doc')}${M.month === 'hepsi' ? 'Tüm seferlerin' : 'Seçilen ayın'} belgelerini birlikte aç (PDF / yazdır)</button></div>` : '<div class="empty">Bu dönemde sefer yok.</div>'}</section></div></div></div>`;
  };
  X.act['rp-mode'] = (t) => { M.rp = t.dataset.v; X.draw(); };
  X.inp.push((t, k) => { if (k === 'rp-month') { M.month = t.value; X.draw(); return true; } return false; });
  async function tripDocs(id) {
    const local = (P.data.trips || []).find(t => t.id === id);
    if (local && (P.data.loads || []).some(l => l.trip_id === id)) {
      const loads = P.data.loads.filter(l => l.trip_id === id);
      return { trip: local, loads };
    }
    const r = await X.rpc('shp_portal_trip_docs', { p_trip: id });
    if (r.error) { X.toast(X.explain(r.error), true); return null; }
    return r.data;
  }
  const docItems = (d, withName) => {
    const customer = P.data.customer, nm = withName ? `${d.trip.poz_no} ` : '';
    return [{ label: `${nm}Lade Liste`, html: B.lade({ trip: d.trip, customer, loads: d.loads }) }, { label: `${nm}CMR`, html: B.cmr({ trip: d.trip, customer, loads: d.loads }) }];
  };
  X.act['arc-doc'] = async (t, e, id) => {
    const d = await tripDocs(id); if (!d) return;
    B.show(docItems(d, false), { title: `${d.trip.poz_no} · ${B.plates(d.trip)}` });
  };
  X.act['arc-month'] = async () => {
    const arch = ((M.report && M.report.archive) || []).filter(t => M.month === 'hepsi' || monthKey(t.depart_date) === M.month).slice(0, 12);
    if (!arch.length) return;
    const items = [];
    for (const a of arch) { const d = await tripDocs(a.id); if (d) items.push(...docItems(d, true)); }
    if (items.length) B.show(items, { title: M.month === 'hepsi' ? 'Seferlerin belgeleri' : `${monthLabel(M.month)} belgeleri` });
  };
  X.act['rp-csv'] = () => {
    const head = ['Poz No', 'Plaka', 'Gönderici', 'Alıcı', 'Mal', 'Kap', 'Kilo', 'Varış gümrük', 'Durum', 'Yazıldı', 'Depoya geldi', 'Araca kondu', 'Yolda', 'Teslim'];
    const rows = (P.data.loads || []).map(l => { const t = X.tripOf(l.trip_id); return [t ? t.poz_no : '', t ? B.plates(t) : l.inbound_plate, l.sender, l.consignee, l.goods, l.pieces, l.weight, l.dest_customs,
      t ? (t.status === 'teslim' ? 'Teslim' : t.status === 'yolda' ? 'Yolda' : 'Araçta') : l.arrived_at ? 'Depoda' : 'Bekliyor', dt(l.created_at), dt(l.arrived_at), dt(l.assigned_at), t ? dt(t.departed_at) : '', t ? dt(t.delivered_at) : '']; });
    download(`yuklerim-${X.today()}.csv`, [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n'));
  };

  // ------------------------------------------------------------------ Excel'den (ya da yapıştırarak) toplu yük
  const norm = s => String(s == null ? '' : s).toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
  const HEAD = { sender: ['GONDERICI', 'GONDEREN', 'GONDERENFIRMA'], consignee: ['ALICI', 'ALICIFIRMA', 'ALICIFIRMASI'], goods: ['MAL', 'MALCINSI', 'URUN', 'ACIKLAMA', 'MALINCINSI'],
    pieces: ['KAP', 'KAPADEDI', 'ADET', 'KOLI', 'KOLIADEDI'], weight: ['KILO', 'BRUTKILO', 'AGIRLIK', 'KG', 'BRUT', 'BRUTAGIRLIK'], volume: ['HACIM', 'M3'],
    inbound_plate: ['PLAKA', 'GETIRECEKPLAKA', 'KAMYONPLAKASI', 'ARACPLAKASI', 'GETIRECEKKAMYONPLAKASI'], dest_customs: ['VARISGUMRUK', 'GUMRUK', 'VARIS'], country: ['ULKE'],
    code: ['GUMRUKKODU', 'KOD', 'KODU'], broker: ['GUMRUKCU'], expected_date: ['BEKLENENTARIH', 'TARIH', 'GELISTARIHI', 'BEKLENEN'], expected_time: ['BEKLENENSAAT', 'SAAT', 'GELISSAATI'],
    driver: ['SOFOR', 'SOFORBILGISI', 'SOFORADI', 'SOFORTELEFON'], sender_addr: ['GONDERICIADRESI', 'GONDERENADRES'], consignee_addr: ['ALICIADRESI'], notify: ['NOTIFY', 'BILDIRIM'], note: ['NOT', 'NOTLAR'], packing: ['AMBALAJ'] };
  const ORDER = ['sender', 'consignee', 'goods', 'pieces', 'weight', 'inbound_plate', 'dest_customs'];
  const TEMPLATE = [['Gönderici', 'Alıcı', 'Mal', 'Kap', 'Kilo', 'Getirecek plaka', 'Varış gümrük', 'Beklenen tarih', 'Beklenen saat', 'Şoför'],
    ['ÖRNEK GÖNDERİCİ A.Ş.', 'ÖRNEK ALICI SRL', 'KOLİ', '12', '1250,5', '34 ABC 123', 'BUCUREŞTI', '25.09.2026', '10:30', 'Ali 0532 000 00 00']];
  function parseText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lines.length) return [];
    const d = ['\t', ';', ','].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
    return lines.map(l => { const out = []; let f = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"') { if (l[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; } else if (c === '"') q = true; else if (c === d) { out.push(f); f = ''; } else f += c; } out.push(f); return out; });
  }
  const isoDate = v => {
    const s = String(v == null ? '' : v).trim(); if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (/^\d{5}(\.\d+)?$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5); return d.toISOString().slice(0, 10); }
    return undefined;
  };
  const isoTime = v => {
    const s = String(v == null ? '' : v).trim(); if (!s) return null;
    let m = /^(\d{1,2})[:.](\d{2})/.exec(s); if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${m[1].padStart(2, '0')}:${m[2]}`;
    if (/^0?\.\d+$/.test(s) || /^0\.\d+$/.test(s)) { const mins = Math.round(Number(s) * 1440); return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; }
    return undefined;
  };
  function convert(rows) {
    rows = rows.filter(r => r && r.some(c => String(c == null ? '' : c).trim()));
    if (!rows.length) return { items: [], note: 'Dosyada satır bulunamadı.' };
    const first = rows[0].map(norm), map = {};
    Object.entries(HEAD).forEach(([k, names]) => { const i = first.findIndex(h => names.includes(h)); if (i >= 0) map[k] = i; });
    let body = rows, note = '';
    if (Object.keys(map).length >= 2 && ('sender' in map || 'consignee' in map)) { body = rows.slice(1); note = 'İlk satır başlık olarak alındı · sütunlar kendiliğinden eşleştirildi'; }
    else { ORDER.forEach((k, i) => { map[k] = i; }); note = 'Başlık satırı bulunamadı; sütunlar sırayla alındı (gönderici, alıcı, mal, kap, kilo, plaka, varış gümrük)'; }
    if (body.length > 200) return { items: [], note: `En fazla 200 satır yüklenebilir (dosyada ${body.length} satır var).` };
    const items = body.map((r, i) => {
      const g = k => (k in map ? String(r[map[k]] == null ? '' : r[map[k]]).trim() : '');
      const errs = [], warns = [];
      const row = { sender: g('sender'), consignee: g('consignee'), goods: g('goods'), packing: g('packing') || 'KAP', inbound_plate: g('inbound_plate').toUpperCase(), dest_customs: g('dest_customs'), country: g('country'), code: g('code'), broker: g('broker'),
        driver: g('driver'), sender_addr: g('sender_addr'), consignee_addr: g('consignee_addr'), notify: g('notify'), note: g('note') };
      if (!row.sender) errs.push('Gönderici boş'); if (!row.consignee) errs.push('Alıcı boş');
      const tn = v => X.parseNum(/^\d{1,3}(\.\d{3})+$/.test(String(v).trim()) ? String(v).replace(/\./g, '') : v);   // 8.803 = sekiz bin sekiz yüz üç
      const w = tn(g('weight')), pc = tn(g('pieces')), vol = X.parseNum(g('volume'));
      if (Number.isNaN(w)) errs.push(`Kilo sayı değil: "${cut(g('weight'), 18)}"`); else if (w != null && w < 0) errs.push('Kilo eksi olamaz');
      if (Number.isNaN(pc) || (pc != null && (pc < 0 || pc % 1))) errs.push(`Kap tam sayı değil: "${cut(g('pieces'), 18)}"`);
      if (Number.isNaN(vol)) errs.push('Hacim sayı değil');
      row.weight = Number.isFinite(w) ? w : 0; row.pieces = Number.isFinite(pc) ? pc : 0; row.volume = Number.isFinite(vol) ? vol : null;
      const ed = isoDate(g('expected_date')); if (ed === undefined) errs.push(`Tarih okunamadı: "${cut(g('expected_date'), 14)}"`); row.expected_date = ed || null;
      const et = isoTime(g('expected_time')); if (et === undefined) errs.push(`Saat okunamadı: "${cut(g('expected_time'), 10)}"`); row.expected_time = et || null;
      const s = X.contactOf('sender', row.sender), c = X.contactOf('consignee', row.consignee);
      if (s && !row.sender_addr) row.sender_addr = s.addr;
      if (c) { ['consignee_addr:addr', 'notify:notify', 'country:country', 'dest_customs:dest_customs', 'code:code', 'broker:broker'].forEach(p => { const [a, b] = p.split(':'); if (!row[a] && c[b]) row[a] = c[b]; }); }
      if (!errs.length) { if (!row.inbound_plate) warns.push('plaka yok'); if (row.sender && !s) warns.push('yeni gönderici'); if (row.consignee && !c) warns.push('yeni alıcı'); }
      return { n: i + 1, row, errs, warns, sKnown: !!s, cKnown: !!c };
    });
    return { items, note };
  }
  const impState = () => M.imp || (M.imp = { items: [], note: '', file: '', err: '', busy: false, paste: '' });
  function impHtml() {
    const S = impState(), ok = S.items.filter(x => !x.errs.length), bad = S.items.length - ok.length, wn = ok.filter(x => x.warns.length).length;
    const tbl = S.items.length ? `<div class="scroll"><table class="tbl2 imp-t"><thead><tr><th>#</th><th>Gönderici</th><th>Alıcı</th><th>Mal</th><th>Kap</th><th>Kilo</th><th>Getirecek plaka</th><th>Durum</th></tr></thead><tbody>${S.items.map(it => {
      const r = it.row, mark = k => k ? '<span class="okm">✓ kayıtlı</span>' : '';
      return `<tr class="${it.errs.length ? 'bad' : it.warns.length ? 'warn' : ''}"><td>${it.n}</td><td>${esc(r.sender) || dash0}${r.sender ? mark(it.sKnown) : ''}</td><td>${esc(r.consignee) || dash0}${r.consignee ? mark(it.cKnown) : ''}</td><td>${esc(r.goods)}</td><td>${esc(r.pieces)}</td><td>${kg(r.weight)}</td><td>${r.inbound_plate ? plate(r.inbound_plate) : '<span class="mut">—</span>'}</td>
<td>${it.errs.length ? `<span class="ch r" title="${esc(it.errs.join('; '))}">${esc(it.errs[0])}</span>` : it.warns.length ? `<span class="ch a">${esc(it.warns.join(', '))}</span>` : '<span class="ch g">Hazır</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '';
    return `<div class="imp"><div class="mh"><div><h2>Excel'den toplu yük ekle</h2><p>Excel dosyasını seçin ya da satırları Excel'den kopyalayıp yapıştırın; yüklerin hepsi tek seferde eklenir.</p></div><button type="button" class="x" data-a="mclose" aria-label="Kapat">${ic('close')}</button></div>
<div class="mb"><div class="drop"><div class="dz">${ic('sheet')}<div><b>${S.file ? esc(S.file) : 'Excel (.xlsx), CSV ya da yapıştırılan liste'}</b><small>${esc(S.note || 'En fazla 200 satır · ilk satır başlık olabilir (Gönderici, Alıcı, Mal, Kap, Kilo, Getirecek plaka…)')}</small></div></div>
<div class="acts"><label class="btn sm" for="imp-file">${ic('upload')}Dosya seç</label><input type="file" id="imp-file" accept=".xlsx,.csv,.tsv,text/csv" hidden><button type="button" class="btn sm" data-a="imp-tpl">${ic('download')}Örnek şablon (CSV)</button></div></div>
<label class="fld"><span>ya da Excel'den kopyaladığınız satırları buraya yapıştırın</span><textarea id="imp-paste" data-i="imp-paste" rows="3" placeholder="Gönderici⇥Alıcı⇥Mal⇥Kap⇥Kilo…">${esc(S.paste)}</textarea></label>
${S.err ? `<div class="ferr" role="alert">${esc(S.err)}</div>` : ''}${tbl}</div>
<div class="mf"><div class="sm"><span><b>${ok.length - wn}</b>hazır</span>${wn ? `<span class="wn"><b>${wn}</b>uyarılı</span>` : ''}${bad ? `<span class="er"><b>${bad}</b>düzeltilmeli</span>` : ''}</div><span class="mut hint2">${bad ? 'Hatalı satırlar eklenmez; Excel\'de düzeltip dosyayı yeniden yükleyebilirsiniz.' : ''}</span><span class="sp"></span><button type="button" class="btn" data-a="mclose">Vazgeç</button><button type="button" class="btn go" data-a="imp-go" ${ok.length && !S.busy ? '' : 'disabled'}>${ic('check')}${ok.length} yükü ekle</button></div></div>`;
  }
  const dash0 = '<span class="mut">—</span>';
  const impDraw = () => { const ta = document.getElementById('imp-paste'), pos = ta && document.activeElement === ta ? ta.selectionStart : null; X.dialog(impHtml()); if (pos != null) { const t2 = document.getElementById('imp-paste'); t2.focus(); try { t2.setSelectionRange(pos, pos); } catch (_) { /* imleç */ } } };
  X.act.import = () => { M.imp = null; impState(); impDraw(); };
  X.act['imp-tpl'] = () => download('yuk-listesi-sablon.csv', TEMPLATE.map(r => r.map(csvCell).join(';')).join('\r\n'));
  X.act['imp-go'] = async () => {
    const S = impState(), ok = S.items.filter(x => !x.errs.length);
    if (!ok.length || S.busy) return;
    S.busy = true; impDraw();
    const r = await X.rpc('shp_portal_import', { p_loads: ok.map(x => x.row) });
    S.busy = false;
    if (r.error) { S.err = X.explain(r.error); impDraw(); return; }
    X.closeForm(); X.toast(`${r.data.count} yük eklendi. Depo yük geldiğinde işaretleyecek.`); P.scope = 'free'; P.page = 'plan'; M.imp = null; X.load0();
  };
  X.inp.push((t, k) => {
    if (k !== 'imp-paste') return false;
    const S = impState(); S.paste = t.value; S.file = '';
    try { const c = convert(parseText(t.value)); S.items = c.items; S.note = c.note; S.err = ''; } catch (er) { S.items = []; S.err = er.message; }
    impDraw(); return true;
  });
  document.addEventListener('change', async e => {
    const f = e.target;
    if (!f || f.id !== 'imp-file' || !f.files || !f.files[0]) return;
    const S = impState(), file = f.files[0];
    try {
      if (!window.PCSXLSX) throw new Error('Excel okuyucu yüklenemedi; satırları yapıştırın.');
      const rows = await window.PCSXLSX.readRows(file);
      const c = convert((rows || []).map(r => Array.from(r || [], c2 => c2)));
      S.items = c.items; S.note = c.note; S.err = ''; S.file = file.name; S.paste = '';
    } catch (er) { S.items = []; S.err = er.message || 'Dosya okunamadı'; S.file = file.name; }
    impDraw();
  });
  X.imp = { convert, parseText };
})();
