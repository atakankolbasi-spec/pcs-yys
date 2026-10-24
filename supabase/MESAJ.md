# Mesajdan araç ekleme (Gemini): WhatsApp, sohbet balonu ve yapıştırma

Müşteri şirketin WhatsApp numarasına şöyle bir yazı gönderir:

> Yarın şu araçlar gelecek: 34 ABC 123 / PB 5678 CD, CB 1234 AB.
> 06 KL 4567'nin geliş günü cumaya ertelendi. B 123 XYZ iptal.

Gerisi kendiliğinden olur:

1. Mesaj Supabase'e kaydedilir ve Google Gemini'ye okutulur: hangi plakalar, hangi gün, hangi saat; araç
   **gelecek mi**, **tarihi mi değişti**, **iptal mi**.
2. Araç bulunduysa müşterinin mesajına ✅ ile tepki verilir. Bulunmadıysa ("tamam", "teşekkürler" gibi) ne
   gönderebileceği yazılır.
3. Sitede **Ruhsattan ekle** düğmesinde rozet çıkar. Pencerede **WhatsApp mesajları** bölümünde her araç için
   ne yapılacağı yazar:
   - **Gelecek:** kayıtlı araçsa **Panoya ekle**. Kayıtlı değilse **Formda aç** (müşteri formda seçilir; mesajı
     gönderen numara Ayarlar'daki müşteri numaralarındansa o müşteri hazır gelir).
   - **Tarih değişti:** panodaki mevcut geliş **Tarihi değiştir** ile yeni güne taşınır.
   - **İptal:** panodaki geliş **Panodan sil** ile silinir (Ctrl+Z ile geri alınır).
   - Araç o gün zaten panodaysa tekrar eklenmez.
   - Her aracın tarihi kutudan değiştirilebilir. Mesajda tarih yoksa mesajın geldiği gün yazılır ve uyarı verilir.
   - Birden fazla araç hazırsa **Hepsini uygula** tek onayla yapar. Silme asla toplu yapılmaz.
4. **Hiçbir araç siz onaylamadan eklenmez, taşınmaz ya da silinmez.**

## Sohbet balonu: kendiniz yazın, kendiliğinden eklesin

Sayfanın **sağ alt köşesinde** yuvarlak bir sohbet balonu durur (yalnızca düzenleyici hesaplarda; saha ve güvenlik
ekranlarında yoktur). Tıklayınca küçük bir sohbet penceresi açılır. Oraya kendi cümlenizi yazıp **Enter**'a basın
(satır atlamak için Shift+Enter):

> Yarın 34 ABC 123 / PB 5678 CD ve CB 1234 AB gelecek. 06 KL 4567 cumaya ertelendi.

Gemini cümleyi okur ve **hazır olanları panoya kendisi işler**:
- Kayıtlı bir araç gelecekse panoya eklenir; panodaki bir aracın günü değiştiyse yeni güne taşınır.
- Araç o gün zaten panodaysa dokunulmaz ("Yapılacak bir şey yoktu").
- Tarih yazmadıysanız bugün yazılır (Pazar ise Pazartesi); sohbette bunun yazdığını görürsünüz.

Bunları yazan siz olduğunuz için ayrıca onay sorulmaz. **Şunlar yine de sorulmadan yapılmaz:**
- **Silme (iptal):** sohbette **Panodan sil** düğmesi çıkar; onaylarsanız silinir (Ctrl+Z ile geri alınır).
- **Plakası kayıtlarda olmayan** ya da kayıtlara benzetilerek bulunan araç: **Formda aç** denir.
- Müşterisi bilinmeyen araç.

**Müşterinin gönderdiği firmalı listeyi de yapıştırabilirsiniz.** Örneğin:

> PB 7831 KT - PB 7569 EB (90 EURO)
> 1.GALATA PETROL OTOMOTİV
> 2.PLASTEK PLASTİK
>
> CT 04 LLA - CT 05 LLA (90 EURO)
> 1.TALIA

Her çekici-dorse çifti bir araç sayılır; altındaki firmalar o aracın yükünün sahipleridir:
- **Beyanname** sütunu: tek firma varsa firmanın adı (örn. `TALIA`), birden fazlaysa `PARSİYEL` yazılır.
- **Not**: ücret ve (birden fazlaysa) firmaların listesi nota yazılır (örn. `90 EURO · 1.GALATA PETROL OTOMOTİV · 2.PLASTEK PLASTİK`).
- **Müşteri / nakliyeci / ruhsat kilosu**: plaka kayıtlıysa kayıttan gelir.
- **Plakası kayıtlı olmayan araç:** müşteri mesajın imzasından, gönderen numaradan ya da listedeki kayıtlı araçların
  ortak müşterisinden alınır. Yine de kendiliğinden eklenmez; **Plaka kaydıyla ekle** ya da **Hepsini uygula** ile
  onaylarsınız, plaka kaydı da birlikte açılır. Müşteri yanlışsa **Formda aç**.
- **Listede tarih yoksa** (ikiden fazla araçta) yanlış güne toplu kayıt açmamak için önce sorar: **Bugün** mi **Yarın** mı.

**"Aracı yarına al" gibi cümleler:** Araç panoda zaten açıksa (o gün kaydı yoksa) yeni geliş açılmaz, **mevcut kayıt**
yeni güne taşınır. Ayrı bir geliş istiyorsanız kartta **Yeni geliş olarak ekle**.

### Sohbetle kayıt düzeltme ve soru sorma

Aynı pencereden panodaki kayıtları düzeltebilir ve pano hakkında soru sorabilirsiniz:

- **Düzeltme:** "24. sıradaki aracın müşterisini ETL LOJ yap", "CB 1234 AB tesiste", "34 ABC 123 T1 yazıldı, not acil",
  "bu aracın nakliyecisi KAAN LOJ. olsun" (önce panoda araca tıklayın), "CB 1234 AB'nin saatini 14:00 yap".
  Düzenlenebilen alanlar: müşteri, beyanname, nakliyeci, not (değiştir ya da ekle), plaka, ruhsat kilosu, saat, gün,
  tesiste / T1 yazıldı / işlemler bitti. Sıra numarası panodaki `#` sütunudur (açık günün, ya da gün seçili değilse
  bugünün sırası); başka günü cümlede söylemeniz yeter.
  - Tek araç değişiyorsa hemen yapılır; sohbette "eski → yeni" olarak yazar. Bir araçta birkaç alan varsa tek
    kayıt işleminde yapılır. Zaten öyle olan ya da bulunamayan araç ayrı satırda açıkça yazılır.
  - **Müşteri adıyla birden fazla araç** değişecekse ("BULTRANS araçlarının beyannamesini PARSİYEL yap") önce kaç
    aracın değişeceği yazılır, **Uygula** ya da **Vazgeç** dersiniz.
  - Panodaki gibi, son değişiklik 10 saniye içinde **Geri al** / Ctrl+Z ile geri alınır (birkaç araç birden
    değiştiyse yalnızca sonuncusu; bu yüzden toplu değişiklikte önce onay sorulur).
- **Soru:** "Bugün kaç araç tesiste?", "Gelecek araçları listele", "Bugünün özeti", "ETL LOJ'un bu haftaki araçları",
  "CB 1234 AB son kayıtları". Cevap panodaki kayıtlardan sayılır (pano bilgisi Google'a gönderilmez, yalnızca sizin
  yazdığınız cümle gönderilir). Listedeki bir araca tıklarsanız panoda o güne gidip aracı seçer. Sorular hiçbir şeyi değiştirmez.

Müşteriden WhatsApp'la gelen mesajlarda bu düzeltme ve soru özelliği **kapalıdır**: müşteri mesajı yalnızca araç
ekleme / taşıma / iptal olarak okunur ve sizin onayınızdan geçer. Düzeltme ve soru yalnızca sizin sohbet
penceresine yazdıklarınızda çalışır.

Yapılan her şey sohbette araç araç yazar. Sohbet sayfayı yenileyince temizlenir; veritabanına yazılmaz.
Müşteriden WhatsApp'la gelen mesajlar bekliyorsa balonda kırmızı bir sayı görünür ve panelin üstünde
"WhatsApp'tan gelen N mesaj onayınızı bekliyor" bağlantısı çıkar (müşteri mesajları yine sizin onayınızla işlenir).

Sohbet balonu WhatsApp kurulumu olmadan da çalışır; yalnızca `ruhsat-oku` fonksiyonunun güncel olması ve
`GEMINI_API_KEY` yeter.

**Aynı pencereden elle de olur:** WhatsApp dışından gelen bir mesajı (e-posta, başka bir uygulama) **Mesajdan araç
ekle** kutusuna yapıştırıp **Yapay zekâyla oku**'ya basın; aynı kartlar çıkar. Bu yol WhatsApp kurulumu
olmadan da çalışır (yalnızca `ruhsat-oku` fonksiyonunun güncel olması yeter).

## Kurulum

Önce `supabase/WHATSAPP.md` ve `supabase/GEMINI.md` kurulu olmalı (WhatsApp numarası, `GEMINI_API_KEY`).

1. **Tablo:** Supabase > **SQL Editor** > `supabase/mesaj-kurulumu.sql` dosyasının tamamını yapıştırıp **Run**.
   Sonuçta beş satırın hepsi `tamam` olmalı.
2. **`ruhsat-oku` fonksiyonunu güncelleyin:** Edge Functions > `ruhsat-oku` > **Code** > eski kodu tamamen silip
   `supabase/functions/ruhsat-oku/index.ts` dosyasının tamamını yapıştırın > **Deploy**.
3. **`whatsapp-webhook` fonksiyonunu güncelleyin:** aynı şekilde `supabase/functions/whatsapp-webhook/index.ts`
   dosyasının tamamını yapıştırıp **Deploy**.
4. Siteyi yenileyin (Ctrl + F5).

**Deneme:** Ruhsattan ekle > **Mesajdan araç ekle**'ye bir mesaj yapıştırıp okutun. Sonra WhatsApp numarasına
gerçek bir mesaj gönderin; mesaja ✅ tepkisi gelmeli ve sitede rozet çıkmalı.

## Sınırlar ve güvenlik

- Rakam içermeyen ya da çok kısa yazılar (ör. "tamam") kaydedilmez ve Gemini'ye gitmez.
- Bir numaradan **saatte en fazla 20 mesaj** okunur; fazlası okunmaz (Gemini'nin ücretsiz kullanımı tükenmesin).
- Mesaj Gemini'ye yalnızca **veri** olarak verilir; içine yazılan "şunu yap" talimatlarına uyulmaz. Her durumda
  değişiklikler sizin onayınızla yapılır.
- Mesaj en fazla 4000 karakter okunur. İşlemi tamamlanmış ya da yoksayılmış mesajlar **60 gün** sonra silinir
  (`WA_KEEP_DAYS` ile değişir).
- Gemini mesajı okuyamazsa (sınır dolu, Google yoğun) kart **Yeniden oku** düğmesiyle gelir.
- Plaka kayıtlarda yoksa ya da kayıttaki plakaya benzetilerek bulunduysa (tek harf farkı, kayıttaki dorse
  önerisi) kartta uyarı yazar; bu araçlar toplu işleme girmez, tek tek onaylanır.

## Sorun giderme

| Belirti | Neden |
|---|---|
| Mesaja ✅ gelmiyor, sitede rozet yok | `whatsapp-webhook` güncel değil ya da `mesaj-kurulumu.sql` çalışmamış. **Edge Functions > whatsapp-webhook > Logs**'ta `mesaj-kurulumu.sql` yazıyorsa tablo yok |
| Mesaja eski yönlendirme cevabı geliyor ("ruhsatın fotoğrafını gönderin") | Tablo kurulu değil ya da `GEMINI_API_KEY` tanımlı değil |
| Yapıştırınca "ruhsat-oku fonksiyonunun güncel hali yüklenmemiş" | 2. adım yapılmamış |
| Kartta "Yapay zekâ mesajı okuyamadı" | Gemini sınırı ya da yoğunluğu; **Yeniden oku**. Ayrıntı: **Edge Functions > ruhsat-oku > Logs** |
| Mesajda araç var ama kart çıkmadı | Mesaj "okunuyor" olabilir (birkaç saniye) ya da Gemini plaka bulamadı; Logs'a bakın |

## Gizlilik

Kurulunca müşterilerin yazdığı mesajların metni (içindeki plaka, tarih, şoför adı/telefonu dahil) okunmak üzere
Google'a gönderilir; müşterinin telefon numarası gönderilmez. Google'ın **ücretsiz** kullanımında gönderilen
içerik Google'ın ürünlerini geliştirmek için kullanılabilir (bkz. `supabase/GEMINI.md`). Herkese açık
`gizlilik.html` sayfası bunu anlatır.
