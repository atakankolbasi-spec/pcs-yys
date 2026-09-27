# PCS TRANSİT YYS

Araç geliş ve gümrük işlemleri takip panosu. Kurulum gerektirmeyen statik bir sitedir;
veriler Supabase'de tutulur.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Sayfa iskeleti ve güvenlik ayarları (CSP) |
| `app.css` | Tüm görünüm / stil |
| `app.js` | Uygulamanın kendisi (pano, raporlar, saha modu, senkron) |
| `xlsx.js` | Excel içe / dışa aktarma |
| `xlsx-templates.js` | Excel şablonları (openpyxl ile üretildi) |
| `vendor.js` | Supabase istemcisi |
| `sw.js` | Service worker: internet yokken sitenin açılmasını sağlar |
| `fonts/` | Roboto yazı tipi (WOFF2) |
| `_headers` | Sunucu güvenlik başlıkları |
| `supabase/` | Veritabanı tarafı notları ve kontrol sorguları |
| `tests/` | Otomatik tarayıcı testleri (siteye dahil değildir) |

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
