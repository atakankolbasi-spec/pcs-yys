# Ruhsatları yapay zekâyla okuma (Google Gemini): kurulum

Kurulunca "Ruhsattan ekle"ye eklenen ve WhatsApp'tan gelen ruhsat fotoğrafları Google Gemini'ye okutulur.
Gemini fotoğraftaki her ruhsat kartı için plakayı, cinsini (çekici / dorse) ve boş ağırlığı çıkarır. Parlama,
eğik çekim, Kiril harf ve farklı ülke ruhsatlarında bilgisayardaki okuma programından çok daha iyi okur.

Gemini kurulmamışsa, kullanım sınırı dolmuşsa ya da fotoğraftan hiçbir şey çıkaramazsa site eskisi gibi
fotoğrafı kendi bilgisayarında okur. Yani kurulum hiçbir şeyi bozmaz, yalnızca okumayı iyileştirir.

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

**"Okundu · yapay zekâ" yazmıyorsa:** Supabase'de **Edge Functions → ruhsat-oku → Logs**'a bakın.
- Hiç kayıt yoksa fonksiyon adı yanlıştır (tam olarak `ruhsat-oku` olmalı).
- `GEMINI_API_KEY tanımlı değil`: 2. adım.
- `Gemini 400` / `403`: anahtar yanlış ya da etkin değil.
- `Gemini 429`: ücretsiz kullanım sınırı doldu; o fotoğraflar bu bilgisayarda okunur, bir süre sonra düzelir.
