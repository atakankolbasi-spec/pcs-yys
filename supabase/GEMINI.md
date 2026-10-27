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

**Mesajlar da okunur:** Müşterinin WhatsApp'tan ya da başka yerden yazdığı "şu araçlar gelecek" gibi mesajlar da
aynı fonksiyonla (`ruhsat-oku`, mesaj modu) okunur: plaka, tarih, saat ve gelecek / ertelendi / iptal. Kurulum ve
kullanım: `supabase/MESAJ.md`.

**Liste fotoğrafları da okunur:** Fotoğrafta ruhsat çıkmazsa ama müşterinin gönderdiği bir araç listesi varsa (ekran
görüntüsü ya da liste fotoğrafı) liste mesaj gibi okunur; kurulum ve kullanım: `supabase/MESAJ.md`. Fotoğraftan
okunan listedeki araçlar hiçbir zaman kendiliğinden eklenmez.

Hangi yolla okunursa okunsun, hiçbir araç siz onaylamadan panoya eklenmez: kartta **Panoya ekle** ya da
pencerenin üstündeki **Hepsini panoya ekle** ile eklersiniz.

**Gizlilik:** Kurulunca ruhsat fotoğrafları ve (mesaj özelliği kuruluysa) müşteri mesajlarının metni okunmak üzere Google'a gönderilir. Google'ın **ücretsiz**
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
| `GEMINI_CHAT_MODEL` | İsteğe bağlı. Yalnızca sohbet balonuna yazılan **kısa** komutlarda (400 karakterden kısa) ilk denenen model; daha hızlı cevap için `gemini-flash-lite-latest` yazılabilir. Boşsa `GEMINI_MODEL` kullanılır |

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

## Sohbet balonu neden yavaş olabilir, ne yapıldı
- Sık sorular ve plakalı durum komutları (**"bugün kaç araç tesiste?"**, **"gelecek araçları listele"**, **"CB 1234 AB tesiste"**,
  **"CB 1234 AB ne durumda"**) sitede yerelde, yapay zekâya gitmeden anında cevaplanır. Cümledeki her sözcük bilinmiyorsa ya da
  tarih / sıra numarası gibi rakam varsa cümle Gemini'ye gider; böylece yanlış anlama yerine yapay zekâya sorulur.
- Gemini'ye giden kısa komutlarda modelin "düşünme" adımı kapatılır (cevap birkaç saniye yerine bir iki saniyede gelir). Model bu
  ayarı kabul etmezse fonksiyon sıradaki yönteme, o da olmazsa ayarsız isteğe geçer. Uzun listeler ve müşteri mesajları düşünerek okunur.
- Kısa komutlar önce hızlı ve kararlı **gemini-2.5-flash** ile denenir (`GEMINI_MODEL` elle seçildiyse o); bir deneme en fazla
  12 saniye bekler, takılırsa sıradaki modele geçilir. Sohbet en kötü durumda yaklaşık 40 saniyede cevap ya da hata alır
  (eskiden Google takılınca iki dakikadan fazla beklenebiliyordu). Sitede de sohbet için bekleme 50 saniye ve en çok iki denemeyle sınırlıdır.
- Yerel anlama doğal cümleleri de kapsar: **"CT 29 BWT dorse plakalı aracı T1 yazıldı işaretle"** (çekici ya da dorse plakası, ikisi de olur),
  **"CB 1234 AB tesiste değil"** / **"T1 yazılmadı"** (olumsuz), **"34 ABC 123 ve CT 29 BWT bitti"** (birden fazla araç),
  **"2. sıradaki aracı bitti yap"**, **"bu aracı bitti yap"**, **"CT 29 BWT tesiste mi"**. "lütfen, dorse, plakalı, işaretle, yap" gibi dolgu sözcükler sayılmaz.
- **Sıralama:** "Sıralamayı düzenleyebilir misin? 1. İşlemleri biten 2. Sıra tesiste olan araçlar 3. Sıra T1 işaretli olan araçlar" gibi bir cümle
  (ya da "sırala: tesiste, T1, biten") yerelde anlaşılır: durum sözcüklerinin geçiş sırası öncelik sırasıdır. Her müşterinin araçları bu sırayla dizilir;
  ayar herkes için kaydedilir (Ayarlar > Yerleşim > Durum sıralaması). Seçili günde elle (sürükleyerek) ayarlanmış sıra varsa o gün otomatiğe döner.
  "Sıralamayı sıfırla" varsayılana döndürür. "En alta al" gibi konum belirten cümleler yapay zekâya gider.
- **Geri al:** her düzeltme ve sıralama cevabında "Geri al" düğmesi çıkar; "geri al" yazmak son işlemi geri alar. Araya başka biri aynı alanı
  değiştirmişse o alana dokunulmaz.
- Gemini'ye giden her sohbet cümlesine panoda seçili günün sıra numaralı araç listesi (plaka | müşteri | durum) ve kayıtlı müşteri adları
  **veri olarak** eklenir; model "hangi araç / hangi müşteri" sorusunu bununla çözer (talimat olarak okunmaz). Gizlilik sayfasında belirtilmiştir.
- Gemini isteği (örn. şema ya da model sınırı yüzünden) **400** ile reddederse fonksiyon önce aynı modeli şemasız dener, sonra yedek modelleri;
  hiçbiri kabul etmezse hata verir. Sohbette hata mesajının altında **"Teknik ayrıntı"** açılır (Gemini'nin yazdığı neden; anahtar içermez).
  Yapay zekâ cevap veremese bile cümlede bilinen bir plaka ve tesiste / T1 / bitti gibi bir sözcük varsa "Şunu mu demek istediniz?" önerilir.
- Plaka bir harf yanlış yazıldıysa ("CB 1234 A yi T1 yazıldı yap") yapay zekâ beklenmeden "Şunu mu demek istediniz?" önerilir.
- Beklerken sohbette geçen süre ("Yanıt bekleniyor… 8 sn") görünür.
- Süreleri görmek için Supabase → Edge Functions → `ruhsat-oku` → **Logs**: her Gemini cevabı için `ruhsat-oku: <model> <süre> ms` satırı yazılır.
  Süre hâlâ 5 saniyenin üzerindeyse `GEMINI_CHAT_MODEL` ayarını deneyin.

