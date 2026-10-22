(function () {
  'use strict';

  var KEY = 'siya.musteriler.v1';
  var HIZMETLER = ['Saç Kesimi', 'Fön', 'Saç Boyama', 'Röfle / Balyaj', 'Keratin', 'Perma', 'Saç Bakımı', 'Manikür', 'Pedikür',
    'Kalıcı Oje', 'Protez Tırnak', 'Cilt Bakımı', 'Kaş / Kirpik', 'Makyaj', 'Gelin Başı', 'Ağda', 'Lazer', 'Masaj'];
  var ODEMELER = ['Nakit', 'Kredi Kartı', 'Havale / EFT'];
  var GUN_RISK = 60;

  var db = yukle();
  var durum = { ara: '', filtre: 'hepsi', sirala: 'ad' };
  var $ = function (s) { return document.querySelector(s); };
  var modal = $('#modal');

  /* ---------- veri ---------- */
  function yukle() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function kaydet() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { bildir('Kaydedilemedi: tarayıcı depolaması dolu ya da kapalı.'); return false; }
  }
  function yeniId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function bul(id) { return db.filter(function (m) { return m.id === id; })[0]; }

  /* ---------- yardımcılar ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tr(s) { return String(s || '').toLocaleLowerCase('tr'); }
  function bugun() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function tarihGoster(iso) {
    if (!iso) return '—';
    var a = iso.split('-');
    return a.length === 3 ? a[2] + '.' + a[1] + '.' + a[0] : iso;
  }
  function para(n) {
    return (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' ₺';
  }
  function gunFarki(iso) {
    if (!iso) return null;
    var a = iso.split('-').map(Number);
    var t = new Date(a[0], a[1] - 1, a[2]);
    var b = new Date(); b = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((b - t) / 864e5);
  }
  function ziyaretler(m) { return (m.ziyaretler || []).slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; }); }
  function sonZiyaret(m) { var z = ziyaretler(m)[0]; return z ? z.tarih : ''; }
  function toplam(m) { return (m.ziyaretler || []).reduce(function (s, z) { return s + (Number(z.tutar) || 0); }, 0); }
  function sonrakiDogum(iso) {
    if (!iso) return null;
    var a = iso.split('-').map(Number);
    var b = new Date(); b = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    var d = new Date(b.getFullYear(), a[1] - 1, a[2]);
    if (d < b) d = new Date(b.getFullYear() + 1, a[1] - 1, a[2]);
    return Math.round((d - b) / 864e5);
  }
  function yas(iso) {
    if (!iso) return '';
    var a = iso.split('-').map(Number), n = new Date();
    var y = n.getFullYear() - a[0];
    if (n.getMonth() + 1 < a[1] || (n.getMonth() + 1 === a[1] && n.getDate() < a[2])) y--;
    return y > 0 && y < 120 ? y : '';
  }
  function telTemiz(t) { return String(t || '').replace(/[^\d+]/g, ''); }
  function waLink(t) {
    var d = telTemiz(t).replace(/^\+/, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.charAt(0) === '0') d = '90' + d.slice(1);
    else if (d.length === 10) d = '90' + d;
    return 'https://wa.me/' + d;
  }
  function renkler(ad) {
    var h = 0, i;
    for (i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) % 70;
    h = (h + 335) % 360;
    return '--h1:hsl(' + h + ',42%,62%);--h2:hsl(' + ((h + 28) % 360) + ',38%,42%)';
  }
  function bas(ad) {
    var p = String(ad || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toLocaleUpperCase('tr');
  }
  var tmr;
  function bildir(msg) {
    var t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(tmr); tmr = setTimeout(function () { t.classList.remove('on'); }, 2800);
  }

  /* ---------- liste ---------- */
  function ozet() {
    var ay = bugun().slice(0, 7), ayZiyaret = 0, ayCiro = 0, yaklasan = 0, risk = 0;
    db.forEach(function (m) {
      (m.ziyaretler || []).forEach(function (z) {
        if ((z.tarih || '').slice(0, 7) === ay) { ayZiyaret++; ayCiro += Number(z.tutar) || 0; }
      });
      var d = sonrakiDogum(m.dogum); if (d !== null && d <= 30) yaklasan++;
      if (riskli(m)) risk++;
    });
    var kart = function (baslik, deger, alt, renk) {
      return '<div class="stat" style="--c:' + renk + '"><small>' + baslik + '</small><b>' + deger + '</b><span>' + alt + '</span></div>';
    };
    $('#stats').innerHTML =
      kart('Toplam Müşteri', db.length, db.filter(function (m) { return m.vip; }).length + ' VIP müşteri', '#b76e79') +
      kart('Bu Ay Ziyaret', ayZiyaret, 'İşlem yapılan randevu', '#b8935a') +
      kart('Bu Ay Ciro', para(ayCiro), 'Kayıtlı işlemlerden', '#3f8f6b') +
      kart('Yaklaşan Doğum Günü', yaklasan, 'Önümüzdeki 30 gün', '#9a5560') +
      kart('Uzun Süredir Gelmeyen', risk, GUN_RISK + '+ gündür ziyaret yok', '#c27a2c');
  }
  function riskli(m) {
    var f = gunFarki(sonZiyaret(m));
    return f !== null && f >= GUN_RISK;
  }
  var FILTRELER = [
    ['hepsi', 'Tümü', function () { return true; }],
    ['vip', 'VIP', function (m) { return m.vip; }],
    ['dogum', 'Doğum günü yakın', function (m) { var d = sonrakiDogum(m.dogum); return d !== null && d <= 30; }],
    ['risk', GUN_RISK + '+ gün gelmeyen', riskli],
    ['alerji', 'Alerji notlu', function (m) { return !!(m.alerji && m.alerji.trim()); }]
  ];
  function aramaMetni(m) {
    return tr([m.ad, m.tel, m.eposta, m.not, m.alerji].concat((m.ziyaretler || []).map(function (z) {
      return (z.hizmetler || []).join(' ') + ' ' + (z.personel || '') + ' ' + (z.not || '');
    })).join(' '));
  }
  function liste() {
    var q = tr(durum.ara).trim();
    var f = FILTRELER.filter(function (x) { return x[0] === durum.filtre; })[0];
    var sirali = db.filter(function (m) { return f[2](m) && (!q || aramaMetni(m).indexOf(q) > -1 || telTemiz(m.tel).indexOf(telTemiz(q)) > -1 && telTemiz(q)); });
    var cmp = {
      ad: function (a, b) { return a.ad.localeCompare(b.ad, 'tr'); },
      son: function (a, b) { return sonZiyaret(b).localeCompare(sonZiyaret(a)); },
      harcama: function (a, b) { return toplam(b) - toplam(a); },
      ziyaret: function (a, b) { return (b.ziyaretler || []).length - (a.ziyaretler || []).length; },
      yeni: function (a, b) { return (b.olusturma || '').localeCompare(a.olusturma || ''); }
    }[durum.sirala];
    sirali.sort(cmp);

    $('#filtreler').innerHTML = FILTRELER.map(function (x) {
      var n = db.filter(x[2]).length;
      return '<button type="button" class="chip" data-f="' + x[0] + '" aria-pressed="' + (durum.filtre === x[0]) + '">' +
        esc(x[1]) + '<span class="n">' + n + '</span></button>';
    }).join('');

    if (!sirali.length) {
      $('#liste').innerHTML = db.length
        ? '<div class="bos"><div class="big">Sonuç bulunamadı</div>Arama ya da filtreyi değiştirmeyi deneyin.</div>'
        : '<div class="bos"><div class="big">Henüz müşteri kaydı yok</div>İlk müşterinizi eklemek için “+ Yeni Müşteri” düğmesine basın.</div>';
      return;
    }
    $('#liste').innerHTML = sirali.map(function (m) {
      var son = sonZiyaret(m), fark = gunFarki(son), rozet = '';
      if (m.vip) rozet += '<span class="tag vip">★ VIP</span>';
      var d = sonrakiDogum(m.dogum);
      if (d !== null && d <= 30) rozet += '<span class="tag dogum">' + (d === 0 ? 'Bugün doğum günü' : '🎂 ' + d + ' gün') + '</span>';
      if (m.alerji && m.alerji.trim()) rozet += '<span class="tag alerji">Alerji</span>';
      if (riskli(m)) rozet += '<span class="tag risk">' + fark + ' gün</span>';
      return '<button type="button" class="row" data-id="' + esc(m.id) + '">' +
        '<span class="avatar" style="' + renkler(m.ad) + '">' + esc(bas(m.ad)) + '</span>' +
        '<span class="who"><b>' + esc(m.ad) + rozet + '</b><small>' + esc(m.tel || 'Telefon yok') + '</small>' +
        '<small class="mob">' + (son ? 'Son: ' + tarihGoster(son) + ' · ' : '') + para(toplam(m)) + '</small></span>' +
        '<span class="cell c2"><small>Son ziyaret</small><b>' + (son ? tarihGoster(son) : '—') + '</b></span>' +
        '<span class="cell c3"><small>Ziyaret</small><b>' + (m.ziyaretler || []).length + '</b></span>' +
        '<span class="cell c4"><small>Toplam harcama</small><b>' + para(toplam(m)) + '</b></span>' +
        '<span class="arrow" aria-hidden="true">›</span></button>';
    }).join('');
  }
  function tazele() { ozet(); liste(); }

  /* ---------- diyalog ---------- */
  function ac(html) {
    modal.innerHTML = html;
    if (!modal.open) modal.showModal();
    var x = modal.querySelector('.x'); if (x) x.onclick = kapat;
  }
  function kapat() { if (modal.open) modal.close(); }
  modal.addEventListener('click', function (e) { if (e.target === modal) kapat(); });

  function baslik(t) { return '<div class="m-head"><h2 id="modal-baslik">' + t + '</h2><button class="x" type="button" aria-label="Kapat">×</button></div>'; }

  /* müşteri formu */
  function musteriForm(id) {
    var m = id ? bul(id) : { vip: false };
    ac(baslik(id ? 'Müşteriyi Düzenle' : 'Yeni Müşteri') +
      '<form id="mf" autocomplete="off"><div class="m-body"><div class="grid f">' +
      '<div class="full"><label for="f-ad">Ad Soyad *</label><input id="f-ad" required maxlength="80" value="' + esc(m.ad) + '"></div>' +
      '<div><label for="f-tel">Telefon</label><input id="f-tel" type="tel" inputmode="tel" maxlength="20" placeholder="05xx xxx xx xx" value="' + esc(m.tel) + '"></div>' +
      '<div><label for="f-ep">E-posta</label><input id="f-ep" type="email" maxlength="100" value="' + esc(m.eposta) + '"></div>' +
      '<div><label for="f-dg">Doğum tarihi</label><input id="f-dg" type="date" max="' + bugun() + '" value="' + esc(m.dogum) + '"></div>' +
      '<div><label for="f-kn">Nasıl tanıştık?</label><select id="f-kn">' +
      ['', 'Tavsiye', 'Instagram', 'Yoldan geçerken', 'Eski müşteri', 'Diğer'].map(function (o) {
        return '<option' + (m.kaynak === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="full"><label for="f-al">Alerji / hassasiyet uyarısı</label><textarea id="f-al" maxlength="400" placeholder="Örn. boya içeriğindeki PPD’ye alerjisi var">' + esc(m.alerji) + '</textarea></div>' +
      '<div class="full"><label for="f-nt">Notlar / tercihler</label><textarea id="f-nt" maxlength="800" placeholder="Örn. 7 numara dip boya, kahve sever, sabah randevusu tercih eder">' + esc(m.not) + '</textarea></div>' +
      '<div class="full check"><input id="f-vip" type="checkbox"' + (m.vip ? ' checked' : '') + '><label for="f-vip" style="margin:0;color:inherit;font-size:14px">★ VIP müşteri</label></div>' +
      '</div><p class="err" id="f-err" hidden></p></div>' +
      '<div class="m-foot">' + (id ? '<button type="button" class="btn danger left" id="sil">Müşteriyi Sil</button>' : '') +
      '<button type="button" class="btn" id="vazgec">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div></form>');
    $('#vazgec').onclick = function () { id ? detay(id) : kapat(); };
    if (id) $('#sil').onclick = function () { sil(id); };
    $('#mf').onsubmit = function (e) {
      e.preventDefault();
      var ad = $('#f-ad').value.trim();
      if (!ad) { var er = $('#f-err'); er.textContent = 'Ad soyad gerekli.'; er.hidden = false; return; }
      var tel = $('#f-tel').value.trim();
      var cift = db.filter(function (x) { return x.id !== id && tel && telTemiz(x.tel) === telTemiz(tel); })[0];
      if (cift && !confirm('Bu telefon numarası “' + cift.ad + '” adlı müşteride kayıtlı. Yine de kaydedilsin mi?')) return;
      var hedef = id ? m : { id: yeniId(), olusturma: new Date().toISOString(), ziyaretler: [] };
      hedef.ad = ad; hedef.tel = tel; hedef.eposta = $('#f-ep').value.trim(); hedef.dogum = $('#f-dg').value;
      hedef.kaynak = $('#f-kn').value; hedef.alerji = $('#f-al').value.trim(); hedef.not = $('#f-nt').value.trim();
      hedef.vip = $('#f-vip').checked;
      if (!id) db.push(hedef);
      if (kaydet()) { tazele(); bildir(id ? 'Müşteri güncellendi.' : 'Müşteri eklendi.'); detay(hedef.id); }
    };
    setTimeout(function () { $('#f-ad').focus(); }, 30);
  }
  function sil(id) {
    var m = bul(id);
    if (!m || !confirm('“' + m.ad + '” ve tüm ziyaret geçmişi silinsin mi? Bu işlem geri alınamaz.')) return;
    db = db.filter(function (x) { return x.id !== id; });
    kaydet(); tazele(); kapat(); bildir('Müşteri silindi.');
  }

  /* detay */
  function detay(id, duzenlenenZiyaret) {
    var m = bul(id); if (!m) return kapat();
    var zs = ziyaretler(m), son = zs[0], d = sonrakiDogum(m.dogum), ya = yas(m.dogum);
    var tel = m.tel ? '<a href="tel:' + esc(telTemiz(m.tel)) + '">' + esc(m.tel) + '</a> · <a href="' + esc(waLink(m.tel)) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' : '—';
    var h = baslik('Müşteri Kartı') + '<div class="m-body">' +
      '<div class="hero"><span class="avatar" style="' + renkler(m.ad) + '">' + esc(bas(m.ad)) + '</span><div><h3>' + esc(m.ad) +
      (m.vip ? '<span class="tag vip">★ VIP</span>' : '') + '</h3><p>' + (m.kaynak ? esc(m.kaynak) + ' ile geldi · ' : '') +
      'Kayıt: ' + tarihGoster((m.olusturma || '').slice(0, 10)) + '</p></div></div>' +
      '<div class="kv">' +
      '<div><small>Telefon</small><b>' + tel + '</b></div>' +
      '<div><small>E-posta</small><b>' + (m.eposta ? '<a href="mailto:' + esc(m.eposta) + '">' + esc(m.eposta) + '</a>' : '—') + '</b></div>' +
      '<div><small>Doğum günü</small><b>' + (m.dogum ? tarihGoster(m.dogum) + (ya ? ' (' + ya + ')' : '') : '—') + '</b>' +
      (d !== null && d <= 30 ? '<br><small>' + (d === 0 ? 'Bugün! 🎂' : d + ' gün sonra') + '</small>' : '') + '</div>' +
      '<div><small>Ziyaret / Harcama</small><b>' + zs.length + ' · ' + para(toplam(m)) + '</b></div>' +
      '<div><small>Son ziyaret</small><b>' + (son ? tarihGoster(son.tarih) : '—') + '</b></div>' +
      '<div><small>Ort. harcama</small><b>' + (zs.length ? para(toplam(m) / zs.length) : '—') + '</b></div></div>' +
      (m.alerji ? '<div class="note al"><b>⚠ Alerji / hassasiyet:</b> ' + esc(m.alerji) + '</div>' : '') +
      (m.not ? '<div class="note">' + esc(m.not) + '</div>' : '') +
      '<div class="sec">Ziyaret Geçmişi</div><div id="vform"></div>' +
      (zs.length ? zs.map(function (z) {
        return '<div class="visit"><span class="d">' + tarihGoster(z.tarih) + '</span><span class="money">' + para(z.tutar) + '</span>' +
          '<span class="svc">' + (z.hizmetler || []).map(function (s) { return '<i>' + esc(s) + '</i>'; }).join('') + '</span>' +
          '<span class="meta">' + [z.personel && 'Uzman: ' + z.personel, z.odeme, z.not].filter(Boolean).map(esc).join(' · ') + '</span>' +
          '<span class="acts"><button class="link" data-zd="' + esc(z.id) + '" type="button">Düzenle</button>' +
          '<button class="link d" data-zs="' + esc(z.id) + '" type="button">Sil</button></span></div>';
      }).join('') : '<p style="color:var(--muted)">Henüz ziyaret kaydı yok.</p>') +
      '</div><div class="m-foot"><button class="btn" id="yazdir" type="button">Yazdır</button>' +
      '<button class="btn" id="duzenle" type="button">Bilgileri Düzenle</button>' +
      '<button class="btn primary" id="zekle" type="button">+ Ziyaret Ekle</button></div>';
    ac(h);
    $('#duzenle').onclick = function () { musteriForm(id); };
    $('#yazdir').onclick = function () { window.print(); };
    $('#zekle').onclick = function () { ziyaretForm(m, null); };
    Array.prototype.forEach.call(modal.querySelectorAll('[data-zd]'), function (b) {
      b.onclick = function () {
        ziyaretForm(m, (m.ziyaretler || []).filter(function (z) { return z.id === b.getAttribute('data-zd'); })[0]);
      };
    });
    Array.prototype.forEach.call(modal.querySelectorAll('[data-zs]'), function (b) {
      b.onclick = function () {
        if (!confirm('Bu ziyaret kaydı silinsin mi?')) return;
        m.ziyaretler = m.ziyaretler.filter(function (z) { return z.id !== b.getAttribute('data-zs'); });
        kaydet(); tazele(); detay(id);
      };
    });
  }

  function ziyaretForm(m, z) {
    var secili = (z && z.hizmetler) || [];
    var tum = HIZMETLER.concat(secili.filter(function (s) { return HIZMETLER.indexOf(s) < 0; }));
    var kutu = $('#vform');
    kutu.className = 'vform f';
    kutu.innerHTML = '<div class="grid">' +
      '<div><label for="z-t">Tarih *</label><input id="z-t" type="date" required value="' + esc(z ? z.tarih : bugun()) + '"></div>' +
      '<div><label for="z-tu">Tutar (₺)</label><input id="z-tu" type="number" min="0" step="1" inputmode="numeric" value="' + esc(z ? z.tutar : '') + '"></div>' +
      '<div class="full"><span class="lbl">Yapılan işlemler</span><div class="pick" id="z-h">' + tum.map(function (s) {
        return '<label><input type="checkbox" value="' + esc(s) + '"' + (secili.indexOf(s) > -1 ? ' checked' : '') + '><span>' + esc(s) + '</span></label>';
      }).join('') + '</div></div>' +
      '<div class="full"><label for="z-o">Başka işlem (virgülle ayırın)</label><input id="z-o" maxlength="120"></div>' +
      '<div><label for="z-p">Uzman</label><input id="z-p" maxlength="60" value="' + esc(z && z.personel) + '"></div>' +
      '<div><label for="z-od">Ödeme</label><select id="z-od">' + ODEMELER.map(function (o) {
        return '<option' + (z && z.odeme === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('') + '</select></div>' +
      '<div class="full"><label for="z-n">Not (kullanılan ürün, renk kodu, sonuç…)</label><textarea id="z-n" maxlength="500">' + esc(z && z.not) + '</textarea></div>' +
      '</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">' +
      '<button class="btn sm" type="button" id="z-v">Vazgeç</button><button class="btn sm primary" type="button" id="z-k">Kaydet</button></div>';
    $('#z-v').onclick = function () { detay(m.id); };
    $('#z-k').onclick = function () {
      var tarih = $('#z-t').value;
      if (!tarih) { bildir('Tarih seçin.'); return; }
      var hz = Array.prototype.map.call(document.querySelectorAll('#z-h input:checked'), function (c) { return c.value; });
      $('#z-o').value.split(',').forEach(function (s) { s = s.trim(); if (s && hz.indexOf(s) < 0) hz.push(s); });
      if (!hz.length) { bildir('En az bir işlem seçin.'); return; }
      var kayit = z || { id: yeniId() };
      kayit.tarih = tarih; kayit.tutar = Math.max(0, Number($('#z-tu').value) || 0); kayit.hizmetler = hz;
      kayit.personel = $('#z-p').value.trim(); kayit.odeme = $('#z-od').value; kayit.not = $('#z-n').value.trim();
      if (!z) { m.ziyaretler = m.ziyaretler || []; m.ziyaretler.push(kayit); }
      if (kaydet()) { tazele(); detay(m.id); bildir('Ziyaret kaydedildi.'); }
    };
    kutu.scrollIntoView({ block: 'nearest' });
  }

  /* yedek / aktarım */
  function csvHucre(v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function indir(ad, icerik, tip) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([icerik], { type: tip }));
    a.download = ad; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function yedekEkrani() {
    ac(baslik('Yedekle / Aktar') + '<div class="m-body">' +
      '<p>Kayıtlar yalnızca bu tarayıcıda durur. Tarayıcı verisi silinirse kaybolur; bu yüzden düzenli yedek alın.</p>' +
      '<div class="sec">Dışa aktar</div><div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn primary" id="y-json" type="button">Yedek dosyası (.json)</button>' +
      '<button class="btn" id="y-csv" type="button">Excel için liste (.csv)</button></div>' +
      '<div class="sec">İçe aktar</div><p>Daha önce aldığınız yedek dosyasını seçin. Aynı kayıtlar güncellenir, yenileri eklenir; mevcut kayıt silinmez.</p>' +
      '<button class="btn" id="y-ice" type="button">Yedek dosyası seç…</button></div>');
    $('#y-json').onclick = function () {
      indir('siya-yedek-' + bugun() + '.json', JSON.stringify({ uygulama: 'siya', surum: 1, tarih: new Date().toISOString(), musteriler: db }, null, 2), 'application/json');
    };
    $('#y-csv').onclick = function () {
      var s = ['Ad Soyad;Telefon;E-posta;Doğum Tarihi;VIP;Ziyaret Sayısı;Son Ziyaret;Toplam Harcama;Alerji;Not'];
      db.forEach(function (m) {
        s.push([m.ad, m.tel, m.eposta, tarihGoster(m.dogum) === '—' ? '' : tarihGoster(m.dogum), m.vip ? 'Evet' : '', (m.ziyaretler || []).length,
          sonZiyaret(m) ? tarihGoster(sonZiyaret(m)) : '', toplam(m), m.alerji, m.not].map(csvHucre).join(';'));
      });
      indir('siya-musteriler-' + bugun() + '.csv', '﻿' + s.join('\r\n'), 'text/csv;charset=utf-8');
    };
    $('#y-ice').onclick = function () { $('#dosya').click(); };
  }
  $('#dosya').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var v = JSON.parse(r.result), arr = Array.isArray(v) ? v : v.musteriler;
        if (!Array.isArray(arr)) throw new Error('biçim');
        var yeni = 0, guncel = 0;
        arr.forEach(function (m) {
          if (!m || typeof m.ad !== 'string' || !m.ad.trim()) return;
          m.id = typeof m.id === 'string' && m.id ? m.id : yeniId();
          m.ziyaretler = Array.isArray(m.ziyaretler) ? m.ziyaretler : [];
          var i = db.map(function (x) { return x.id; }).indexOf(m.id);
          if (i > -1) { db[i] = m; guncel++; } else { db.push(m); yeni++; }
        });
        kaydet(); tazele(); kapat();
        bildir(yeni + ' yeni, ' + guncel + ' güncellenen müşteri aktarıldı.');
      } catch (err) { bildir('Dosya okunamadı: geçerli bir SİYA yedeği değil.'); }
    };
    r.readAsText(f);
  });

  /* olaylar */
  $('#btn-yeni').onclick = function () { musteriForm(); };
  $('#btn-yedek').onclick = yedekEkrani;
  $('#ara').addEventListener('input', function (e) { durum.ara = e.target.value; liste(); });
  $('#sirala').addEventListener('change', function (e) { durum.sirala = e.target.value; liste(); });
  $('#filtreler').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    durum.filtre = b.getAttribute('data-f'); liste();
  });
  $('#liste').addEventListener('click', function (e) {
    var r = e.target.closest('[data-id]'); if (r) detay(r.getAttribute('data-id'));
  });

  tazele();
})();
