# Ruhsatları yapay zekâyla okuma (Google Gemini): kurulum

Kurulunca "Ruhsattan ekle"ye eklenen ve WhatsApp'tan gelen ruhsat fotoğrafları Google Gemini'ye okutulur.
Gemini fotoğraftaki her ruhsat kartı için plakayı, cinsini (çekici / dorse) ve boş ağırlığı çıkarır. Parlama,
eğik çekim, Kiril harf ve farklı ülke ruhsatlarında bilgisayardaki okuma programından çok daha iyi okur.

Gemini kurulunca fotoğraflar **yalnızca Gemini ile** okunur; bilgisayardaki eski okuma programına kendiliğinden
geçilmez. Gemini hata verirse (ücretsiz kullanımın dakikalık sınırı, Google'ın yoğunluğu) pes edilmez:
- Sunucu fonksiyonu önce aynı modeli bir kez daha, sonra sırayla yedek modelleri (`gemini-2.5-flash`,
  `gemini-flash-lite-latest`) dener. Her modelin ayrı kullanım sınırı vardır.
- Hepsi doluysa site, Gemini'nin söylediği süre kadar bekleyip yeniden dener; en fazla altı deneme (yaklaşık
  4 dakika). Kartta kaç saniye sonra yeniden deneneceği yazar.
- Yine olmazsa kart "Gemini şu an okuyamadı" olur. **Yeniden oku** ile tekrar denenir. Beklemek istemezseniz
  **Bu bilgisayarda oku** ile eski yoldan okunur (daha az güvenilir).
- WhatsApp'tan gelen fotoğraf Gemini'ye okutulamadıysa panonun açık olduğu bir bilgisayarda 10 dakikada bir
  kendiliğinden yeniden denenir (fotoğraf geldikten sonra 12 saat boyunca).

**WhatsApp fotoğrafları sunucuda okunur:** Gemini kuruluysa WhatsApp'tan gelen fotoğraf, panonun açık
olmasını beklemeden birkaç saniye içinde sunucuda okunur. Fotoğrafta hiç plaka okunamazsa gönderene ⚠️ ile
tepki verilir ve ruhsatı yeniden çekip göndermesi istenir. Bunun için `whatsapp-webhook` fonksiyonunun da
güncel olması ve `supabase/whatsapp-kurulumu.sql` dosyasının son halinin çalıştırılmış olması gerekir.
Gemini o an okuyamazsa fotoğraf panonun açık olduğu bilgisayara kalır ve orada denenir.

Gemini hiç kurulmamışsa (fonksiyon yok ya da anahtar tanımlı değil) site eskisi gibi fotoğrafı kendi
bilgisayarında okur.

Hangi yolla okunursa okunsun, hiçbir araç siz onaylamadan panoya eklenmez: kartta **Panoya ekle** ya da
pencerenin üstündeki **Hepsini panoya ekle** ile eklersiniz.

**Gizlilik:** Kurulunca ruhsat fotoğrafları okunmak üzere Google'a gönderilir. Google'ın **ücretsiz**
kullanımında gönderilen içerik Google'ın ürünlerini geliştirmek için kullanılabilir ve çalışanlarınca
incelenebilir; faturalandırma açık (ücretli) kullanımda kullanılmaz. Ruhsatlarda kişisel veri bulunduğu için
denemeden sonra ücretli kullanıma geçmeniz önerilir. Güncel koşullar: [ai.google.dev](https://ai.google.dev/gemini-api/terms).

## 1. Google'dan API anahtarı
1. [aistudio.google.com](https://aistudio.google.com) adresine Google hesabınızla girin.
2. Sol menüden **Get API key** → **Create API key**. İsterse yeni bir proje oluşturmasına izin verin.
3. Çıkan anahtarı kopyalayın. Kimseyle paylaşmayın; sohbete, e-postaya yazmayın.

## 2. Supabase'e kaydetme
**Edge Functions** → **Secrets** → yeni ayar:

| Ad | Değer |
|---|---|
| `GEMINI_API_KEY` | 1. adımda kopyaladığınız anahtar |
| `GEMINI_MODEL` | İsteğe bağlı. Boş bırakılırsa `gemini-flash-latest` kullanılır |

## 3. Sunucu fonksiyonu
1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Fonksiyon adına tam olarak `ruhsat-oku` yazın (kod yapıştırmadan önce).
3. Örnek kodu silin; `supabase/functions/ruhsat-oku/index.ts` dosyasının tamamını yapıştırıp **Deploy**'a basın.
4. Fonksiyonun **Details** sayfasında **Verify JWT** seçeneğini **kapatın** ve kaydedin. Fonksiyon kimin
   çağırdığını kendisi denetler: yalnızca siteye giriş yapmış düzenleyiciler kullanabilir.

## 4. Deneme
Siteyi yenileyin (Ctrl + F5), **Ruhsattan ekle**'ye birkaç ruhsat fotoğrafı sürükleyin. Okunanların altında
**"Okundu · yapay zekâ"** yazar. Pencerenin üst yazısı da "yapay zekâyla (Google Gemini) okunur" olur.
Önceden okunmuş fotoğrafları **Yeniden oku** ile Gemini'ye okutabilirsiniz.

**Güncelleme:** `supabase/functions/ruhsat-oku/index.ts` değiştiğinde fonksiyonun sayfasında **Code**
sekmesine girin, eski kodu tamamen silip yenisini yapıştırın ve **Deploy**'a basın.

**"Okundu · yapay zekâ" yazmıyorsa:** kartta nedeni yazar. Ayrıntı için Supabase'de
**Edge Functions → ruhsat-oku → Logs**'a bakın.
- Hiç kayıt yoksa fonksiyon adı yanlıştır (tam olarak `ruhsat-oku` olmalı).
- `GEMINI_API_KEY tanımlı değil`: 2. adım.
- `Gemini 400` / `403` ("anahtar geçersiz"): anahtar yanlış ya da etkin değil; beklemekle düzelmez.
- `Gemini 429`: ücretsiz kullanım sınırı doldu. Dakikalık sınırsa site bekleyip kendisi yeniden dener.
  Kartta "günlük ücretsiz sınır doldu" yazıyorsa o gün beklemenin anlamı yok; sınır Türkiye saatiyle
  10:00–11:00 arasında sıfırlanır. Sık oluyorsa Google AI Studio'da faturalandırmayı açın (ücretli kullanım
  sınırları çok daha yüksektir).
- `Gemini 503`: Google o an çok yoğun; site bekleyip yeniden dener.
