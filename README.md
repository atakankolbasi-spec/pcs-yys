# PCS TRANSİT YYS

Araç geliş ve gümrük işlemleri takip panosu. Kurulum gerektirmeyen statik bir sitedir;
veriler Supabase'de tutulur.

Site GitHub Pages'te yayınlanır: https://atakankolbasi-spec.github.io/pcs-yys/
`main` dalına yapılan her değişiklik 1–2 dakika içinde otomatik yayına girer.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Sayfa iskeleti ve güvenlik ayarları (CSP) |
| `gizlilik.html` | Herkese açık gizlilik politikası (Meta/WhatsApp uygulaması bu adresi ister). Veri silme bölümü: `gizlilik.html#veri-silme` |
| `app.css` | Tüm görünüm / stil |
| `app.js` | Uygulamanın kendisi (pano, raporlar, saha modu, senkron) |
| `xlsx.js` | Excel içe / dışa aktarma |
| `xlsx-templates.js` | Excel şablonları (openpyxl ile üretildi) |
| `vendor.js` | Supabase istemcisi |
| `sw.js` | Service worker: internet yokken sitenin açılmasını sağlar |
| `fonts/` | Roboto yazı tipi (WOFF2) |
| `ocr/` | "Ruhsattan ekle" için tarayıcıda çalışan metin okuma programı (Tesseract). Ayrıntı: `ocr/README.md` |
| `_headers` | Sunucu güvenlik başlıkları. **GitHub Pages'te etkisizdir**; site Cloudflare Pages veya Netlify'a taşınırsa kullanılır. Gömülmeye (iframe) karşı koruma bu yüzden `app.js` başında yapılır. |
| `supabase/` | Veritabanı tarafı notları, kurulum SQL'leri ve WhatsApp sunucu fonksiyonu. WhatsApp kurulumu: `supabase/WHATSAPP.md` |
| `tests/` | Otomatik tarayıcı testleri (uygulamanın parçası değildir) |

## Düzenleme yaparken

- Bir dosyayı değiştirmeden önce **GitHub'daki güncel halini indirin.** Eski bir kopyayı
  yüklemek sonradan yapılan düzeltmeleri geri alır.
- Sayfaya satır içi `<script>` eklemeyin: güvenlik ayarı (CSP) yalnızca ayrı `.js`
  dosyalarına izin verir. Yeni kodu `app.js`'e ekleyin.
- Yeni bir dosya eklerseniz ve internetsiz de açılması gerekiyorsa `sw.js` içindeki
  `SHELL` listesine de ekleyin.

## Testler

GitHub'a her yüklemede testler otomatik çalışır (Actions sekmesi). Bilgisayarda çalıştırmak için:

```bash
cd tests
npm install
npx playwright install chromium
npx playwright test
```
