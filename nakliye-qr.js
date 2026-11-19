/* Nakliye: yük etiketi (QR kodlu, A6) ve telefon kamerasıyla QR okuyucu.
 * QR üretimi ve okuma kütüphaneleri (qr/qrcode.js: MIT, qr/jsqr.js: Apache-2.0) yalnızca gerektiğinde yüklenir.
 * Etiketteki kod yalnızca yükün kısa kodudur (PCS:ABCDEFGHIJ); gizli anahtar içermez, okutulan kod depo ekranında yükle eşleşir. */
(() => {
  'use strict';
  const X = window.PCSNKP;
  if (!X) return;
  const { esc, kg } = X;

  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { s.remove(); no(new Error('Okuyucu dosyası yüklenemedi')); };
    document.head.appendChild(s);
  });
  let genP = null, decP = null;
  const qrLib = () => window.qrcode ? Promise.resolve() : (genP = genP || loadScript('qr/qrcode.js').catch(e => { genP = null; throw e; }));
  const jsqrLib = () => window.jsQR ? Promise.resolve() : (decP = decP || loadScript('qr/jsqr.js').catch(e => { decP = null; throw e; }));

  const payload = code => `PCS:${code}`;
  // Okunan yazıdan yük kodunu çıkarır (etiket okutma ya da elle yazma / USB okuyucu): PCS:ABCDEFGHIJ ya da ABCDEFGHIJ
  const parseCode = text => { const m = /^(?:PCS[:\-\s]*)?([A-Z0-9]{10})$/i.exec(String(text || '').trim().replace(/\s+/g, '')); return m ? m[1].toUpperCase() : ''; };

  function svgOf(text) {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  // Etiket boyutları: A6 (normal yazıcı) ve Zebra gibi etiket yazıcıları için yaygın rulo ölçüleri (mm). Yazıcı sürücüsünde kağıt boyutu rulonuzla aynı olmalı.
  const SIZES = [
    { id: 'a6', name: 'A6 (normal yazıcı)', w: 148, h: 105, qr: 46, pad: 6, k: 1 },
    { id: 'z150', name: 'Zebra 100×150', w: 100, h: 150, qr: 66, pad: 3, k: 1, portrait: true },
    { id: 'z100', name: 'Zebra 100×100', w: 100, h: 100, qr: 48, pad: 3, k: 0.85, portrait: true },
    { id: 'z70', name: 'Zebra 100×70', w: 100, h: 70, qr: 38, pad: 3, k: 0.7 },
    { id: 'z50', name: 'Zebra 100×50', w: 100, h: 50, qr: 30, pad: 2.5, k: 0.55 }
  ];
  const SIZE_KEY = 'pcs.etiket.boyut';
  const savedSize = () => { try { const i = SIZES.findIndex(x => x.id === localStorage.getItem(SIZE_KEY)); return i < 0 ? 0 : i; } catch (_) { return 0; } };
  const saveSize = i => { try { localStorage.setItem(SIZE_KEY, SIZES[i].id); } catch (_) { /* tarayıcı saklamıyorsa her seferinde A6 açılır */ } };
  const css = z => {
    const k = z.k, f = n => (n * k).toFixed(2);
    return `@page{size:${z.w}mm ${z.h}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,"Liberation Sans",sans-serif;color:#000}
.lb{width:${z.w}mm;height:${z.h}mm;padding:${z.pad}mm;page-break-after:always;break-after:page;display:flex;overflow:hidden}.lb:last-child{page-break-after:auto;break-after:auto}
.bx{flex:1;min-width:0;min-height:0;border:${f(0.8)}mm solid #000;border-radius:${f(3)}mm;padding:${f(5)}mm;display:flex;flex-direction:column;justify-content:space-between}
.t{display:flex;gap:${f(5)}mm;align-items:${z.portrait ? 'center' : 'flex-start'};flex-direction:${z.portrait ? 'column' : 'row'};${z.portrait ? 'text-align:center;' : ''}}.qq{width:${z.qr}mm;height:${z.qr}mm;flex:none}.qq svg{width:100%;height:100%;display:block}
.in{flex:1;min-width:0;${z.portrait ? 'width:100%;' : ''}}.pz{font-size:${f(3.4)}mm;font-weight:700;color:#444}.sn{font-size:${f(6.6)}mm;font-weight:800;line-height:1.15;margin:${f(1.5)}mm 0;overflow-wrap:anywhere}
.cs{font-size:${f(4.6)}mm;overflow-wrap:anywhere}.gd{font-size:${f(4)}mm;margin-top:${f(3)}mm}.pl{display:inline-block;border:${f(0.6)}mm solid #000;border-radius:${f(1.6)}mm;padding:${f(0.8)}mm ${f(3)}mm;font-weight:800;font-size:${f(4.6)}mm;letter-spacing:.4mm;margin-top:${f(3)}mm}
.bt{display:flex;justify-content:space-between;align-items:flex-end;border-top:${f(0.5)}mm dashed #000;padding-top:${f(3)}mm}.cd{font:700 ${f(5)}mm "Courier New",monospace;letter-spacing:${f(0.8)}mm}.bt b{font-size:${f(5)}mm}
@media screen{body{background:#e6eaee;padding:12px 0}.lb{margin:0 auto 12px;background:#fff;box-shadow:0 2px 14px #0003}}`;
  };

  function labelHtml(l, ctx) {
    const t = ctx.trips[l.trip_id], cust = ctx.customerName(l);
    const pz = t ? `${esc(t.poz_no)} · ` : '';
    return `<div class="lb"><div class="bx"><div class="t"><div class="qq">${svgOf(payload(l.qr_code))}</div><div class="in"><div class="pz">${pz}${esc(cust)}</div><div class="sn">${esc(l.sender)}</div><div class="cs">→ <b>${esc(l.consignee)}</b></div>
<div class="gd">${esc(l.goods)}${l.goods ? ' · ' : ''}${esc(l.pieces)} ${esc(l.packing)} · ${kg(l.weight)} kg</div>${l.inbound_plate ? `<span class="pl">${esc(l.inbound_plate)}</span>` : ''}</div></div>
<div class="bt"><span class="cd">${esc(l.qr_code)}</span><b>${esc(l.dest_customs)}</b></div></div></div>`;
  }

  async function printLabels(loads) {
    const list = loads.filter(l => l && l.qr_code);
    if (!list.length) { X.toast('Etiket için yük seçin', true); return; }
    try { await qrLib(); } catch (e) { X.toast(e.message, true); return; }
    const trips = Object.fromEntries(((X.P.data && X.P.data.trips) || []).map(t => [t.id, t]));
    const ctx = { trips, customerName: l => (X.custOf(l.customer_id) || {}).name || '' };
    const page = z => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Yük etiketleri</title><style>${css(z)}</style></head><body>${list.map(l => labelHtml(l, ctx)).join('')}</body></html>`;
    X.B.show(SIZES.map(z => ({ label: z.name, html: page(z) })), { title: `Yük etiketleri (${list.length})`, start: savedSize(), onTab: saveSize });
  }
  X.act.label = (t, e, id) => { const l = (X.P.data.loads || []).find(x => x.id === id); return printLabels(l ? [l] : []); };
  X.act.labels = () => {
    const sel = X.selLoads();
    return printLabels(sel.length ? sel : X.P.data.loads.filter(l => X.MODE === 'm' ? X.isFree(l) : !l.arrived_at));
  };

  // ------------------------------------------------------------------ kamera ile okuma
  const Scan = { stream: null, video: null, timer: null, det: null, busy: false, last: '', lastAt: 0, cb: null, canvas: null };
  async function scanStart(cb) {
    if (Scan.stream) { Scan.cb = cb; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Bu tarayıcı kamerayı kullanamıyor. Kodu elle yazın ya da USB okuyucu kullanın.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (_) { throw new Error('Kamera açılamadı. Tarayıcıdan kamera iznini verin ya da kodu elle yazın.'); }
    const v = document.createElement('video');
    v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = stream;
    await v.play().catch(() => {});
    Scan.stream = stream; Scan.video = v; Scan.cb = cb;
    if ('BarcodeDetector' in window) { try { Scan.det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { Scan.det = null; } }
    if (!Scan.det) await jsqrLib();
    Scan.timer = setInterval(tick, 260);
    placeVideo();
  }
  function scanStop() {
    clearInterval(Scan.timer); Scan.timer = null;
    if (Scan.stream) Scan.stream.getTracks().forEach(t => t.stop());
    if (Scan.video) Scan.video.remove();
    Scan.stream = null; Scan.video = null; Scan.det = null; Scan.cb = null;
  }
  async function tick() {
    const v = Scan.video;
    if (!v || Scan.busy || v.readyState < 2 || !v.videoWidth) return;
    Scan.busy = true;
    try {
      let text = '';
      if (Scan.det) { const r = await Scan.det.detect(v); text = r && r[0] ? r[0].rawValue : ''; }
      else {
        const w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
        const c = Scan.canvas = Scan.canvas || document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, 0, 0, w, h);
        const r = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        text = r ? r.data : '';
      }
      const code = parseCode(text);
      if (code && (code !== Scan.last || Date.now() - Scan.lastAt > 3000)) { Scan.last = code; Scan.lastAt = Date.now(); if (Scan.cb) Scan.cb(code); }
    } catch (_) { /* bir kare okunamadı: sonrakini dene */ }
    Scan.busy = false;
  }
  // Ekran yeniden çizilince kamera görüntüsü yeni yuvaya taşınır
  function placeVideo() {
    const slot = document.getElementById('scan-slot');
    if (slot && Scan.video && !slot.contains(Scan.video)) { slot.appendChild(Scan.video); Scan.video.play().catch(() => {}); }
  }
  X.onDraw.push(placeVideo);

  X.qr = { svgOf, labelHtml, printLabels, SIZES, parseCode, payload, scanStart, scanStop, lib: { gen: qrLib, dec: jsqrLib }, decode: (data, w, h) => { const r = window.jsQR(data, w, h); return r ? r.data : ''; },
    scanning: () => !!Scan.stream };
})();
