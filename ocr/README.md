# Ruhsat okuma (OCR) dosyaları

"Ruhsattan ekle" özelliği ruhsat fotoğraflarını **bu bilgisayarın tarayıcısında** okur; fotoğraf
hiçbir sunucuya gönderilmez. Bu klasördeki dosyalar ilk kullanımda bir kez indirilir (~6 MB).

| Dosya | Kaynak | Lisans |
|---|---|---|
| `tesseract.min.js`, `worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 | Apache-2.0 |
| `tesseract-core-simd-lstm.*`, `tesseract-core-lstm.*` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 7.0.0 | Apache-2.0 (`LICENSE.txt`) |
| `eng.traineddata.gz` | [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) `4.0.0_best_int` (Tesseract tessdata) | Apache-2.0 |

`simd` sürümü modern tarayıcılarda kullanılır; SIMD desteklemeyen eski tarayıcılar için `lstm` sürümü yedektir.
Güncellemek için aynı dosyaları npm paketlerinin yeni sürümlerinden kopyalayın.
