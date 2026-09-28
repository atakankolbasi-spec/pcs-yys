# WhatsApp'tan otomatik ruhsat aktarma: kurulum

Şoför ya da müşteri ruhsat fotoğrafını şirketin WhatsApp numarasına gönderir, gerisi kendiliğinden olur:

1. Fotoğraf Supabase'e kaydedilir ve gönderenin mesajına ✅ ile tepki verilir.
2. Panonun açık olduğu bir düzenleyici bilgisayarı fotoğrafı okur. Okuma ücretsiz programla bu
   bilgisayarda yapılır, fotoğraf başka bir yere gönderilmez.
3. Sonuç şöyle işlenir:
   - **Çekici + dorse plaka kayıtlarında müşterisiyle varsa**, araç fotoğrafın geldiği güne panoya eklenir.
     Pazar günü gelen fotoğraf Pazartesi'ye eklenir.
   - **Araç o gün zaten panodaysa** tekrar eklenmez.
   - **Diğerleri** (yeni araç, okunamayan plaka) "Ruhsattan ekle" düğmesinde rozetle görünür. Oradan
     "Hemen ekle", "Formda aç" ya da "Listeden çıkar" denir. Gönderenin numarası Ayarlar'daki WhatsApp
     numaraları listesinde bir müşteriye aitse, formda o müşteri seçili gelir.

**Önemli:**
- Bu numara mevcut WhatsApp grubunuza eklenemez; fotoğraflar numaraya doğrudan gönderilmelidir.
  Gruptaki fotoğrafları ofisten bu numaraya topluca iletmek de olur: fotoğrafları seçin → İlet.
- Fotoğrafların okunması için mesai saatinde en az bir düzenleyicide pano açık olmalı. Açık değilse
  fotoğraflar bekler, biri siteyi açınca işlenir.

## Ücret

| Kalem | Ücret |
|---|---|
| WhatsApp'a gelen mesajlar, ✅ tepkisi ve yardım cevabı | Ücretsiz (hepsi gönderenin mesajına verilen cevap) |
| Meta hesabı, uygulama, numara bağlama | Ücretsiz |
| Telefon hattı | WhatsApp'ta kullanılmayan bir numara gerekir. Şirketin sabit hattı olur (sesli aramayla doğrulanır) |
| Fotoğrafı okuma | Ücretsiz (tarayıcıda) |
| Supabase | Ücretsiz plan yeter. Fotoğraflar 60 gün sonra kendiliğinden silinir; okunan bilgiler kalır |

Meta fiyatlarını zaman zaman değiştiriyor. Bu sistem yalnızca gelen mesaja cevap veriyor, kendiliğinden
mesaj başlatmıyor; bu tür mesajlar şu an ücretsiz. Yine de başlamadan Meta'nın fiyat sayfasına bakın.

---

## A. Supabase tarafı (yaklaşık 10 dakika)

### A1. Veritabanı
**SQL Editor**'de `supabase/whatsapp-kurulumu.sql` dosyasının tamamını çalıştırın. En altta dört satır
çıkar ve hepsi **tamam** olmalı.

### A2. Sunucu fonksiyonu
1. Sol menüden **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Fonksiyon adına tam olarak `whatsapp-webhook` yazın.
3. Düzenleyicideki örnek kodu silin. `supabase/functions/whatsapp-webhook/index.ts` dosyasının
   tamamını yapıştırıp **Deploy**'a basın.
4. Fonksiyonun sayfasında **Details** (ya da **Settings**) bölümüne gidin. **Verify JWT / Enforce JWT
   verification** seçeneğini **kapatın** ve kaydedin. Meta, Supabase hesabıyla giriş yapmadan çağırdığı
   için bu kapalı olmalı; güvenliği fonksiyon kendisi sağlar (Meta'nın imzasını kontrol eder).
5. Fonksiyonun adresi şudur:
   `https://ollrccfqiqilbflanuik.supabase.co/functions/v1/whatsapp-webhook`

Bilgisayarınızda Node.js varsa aynı işi tek komutla da yapabilirsiniz:
`npx supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref ollrccfqiqilbflanuik`

### A3. Gizli ayarlar
**Edge Functions** → **Secrets** bölümüne şu ayarları ekleyin:

| Ad | Değer |
|---|---|
| `WA_VERIFY_TOKEN` | Kendi uydurduğunuz uzun bir parola, örneğin `pcs-ruhsat-7Hq2xK9m`. B4'te Meta'ya da aynısını yazacaksınız |
| `WA_APP_SECRET` | B5'te Meta'dan alacaksınız |
| `WA_TOKEN` | B6'da Meta'dan alacaksınız |

İsteğe bağlı ayarlar:
- `WA_REPLY` = `kapali`: Gönderene hiçbir cevap ve tepki gitmez.
- `WA_KEEP_DAYS` = `90`: Fotoğraflar 60 yerine 90 gün saklanır.

---

## B. Meta tarafı

Meta ekranlarındaki adlar zaman zaman değişiyor; aşağıdakiler yol göstermek için. Takıldığınız ekranın
görüntüsünü gönderin, birlikte bakarız.

### B1. Telefon numarası
WhatsApp'ta (normal ya da Business uygulamasında) **kullanılmayan** bir numara seçin. Şirketin sabit
hattı olabilir. Numara şu an bir telefonda WhatsApp'ta kullanılıyorsa önce o hesabı silmek gerekir.
Bağlandıktan sonra bu numara telefondaki WhatsApp uygulamasında kullanılamaz; mesajlar yalnızca bu
sisteme gelir.

### B2. İşletme hesabı
[business.facebook.com](https://business.facebook.com) adresinde şirket adına bir işletme hesabı
(Business portfolio) açın. Hesap zaten varsa onu kullanın.

### B3. Uygulama ve numara
1. [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Kullanım amacı olarak **WhatsApp** ile ilgili olanı ("Connect with customers through WhatsApp")
   seçin. İşletme hesabı olarak B2'deki hesabı seçin.
3. Uygulamada **WhatsApp → API Setup** sayfasını açın. Meta burada deneme için geçici bir numara verir.
   Gerçek numara için **Add phone number** deyin:
   - Görünen ad olarak şirket adını yazın.
   - Numarayı SMS ya da sesli aramayla doğrulayın.

### B4. Webhook (Meta'nın fotoğrafları Supabase'e iletmesi)
Bu adımdan önce A2 ve A3'teki `WA_VERIFY_TOKEN` hazır olmalı.
1. **WhatsApp → Configuration** → **Webhook** → **Edit**.
2. **Callback URL**: `https://ollrccfqiqilbflanuik.supabase.co/functions/v1/whatsapp-webhook`
3. **Verify token**: A3'te `WA_VERIFY_TOKEN` için yazdığınız parolanın aynısı.
4. **Verify and save**'e basın. Hata verirse A2'nin 4. adımını (JWT kapalı) ve parolayı kontrol edin.
5. Aynı sayfada **Webhook fields** listesinde **messages** satırını **Subscribe** yapın.

### B5. Uygulama anahtarı (App secret)
**App settings → Basic** → **App secret** yanındaki **Show**'a basın. Çıkan değeri Supabase'de
`WA_APP_SECRET` olarak kaydedin. Bu olmadan fonksiyon gelen bildirimleri reddeder.

### B6. Kalıcı erişim anahtarı
API Setup sayfasındaki geçici anahtar 24 saatte biter; ilk denemede kullanılabilir. Kalıcı anahtar için:
1. [business.facebook.com](https://business.facebook.com) → **Settings** → **Users → System users**
   → **Add**. Ad olarak örneğin "pcs-yys" yazın, rol **Admin** olsun.
2. **Assign assets** ile bu kullanıcıya iki şeyde tam yetki verin: B3'teki uygulama ve WhatsApp hesabı.
3. **Generate new token** deyin:
   - Uygulamayı seçin.
   - Süre olarak **Never** (süresiz) seçin.
   - İzinlerden `whatsapp_business_messaging` ve `whatsapp_business_management` işaretleyin.
4. Çıkan anahtarı Supabase'de `WA_TOKEN` olarak kaydedin. Anahtar bir daha gösterilmez; kimseyle
   paylaşmayın.

### B7. Uygulamayı yayına alma (gerekirse)
Meta bazı hesaplarda gerçek kişilerden gelen mesajları ancak uygulama **Live** moddayken iletiyor.
Deneme mesajı geliyor ama gerçek numaradan gelmiyorsa **App settings → Basic**'e gidin:
- **Privacy Policy URL** doldurun.
- Kategoriyi seçin.
- Sayfanın üstündeki **App Mode**'u **Live** yapın.

Gizlilik politikası sayfası yoksa bana şirket unvanını ve iletişim e-postasını yazın, sitede hazırlayayım.

---

## C. Deneme
1. Telefonunuzdan numaraya bir ruhsat fotoğrafı gönderin. Birkaç saniye içinde fotoğrafa ✅ tepkisi gelmeli.
2. Siteyi düzenleyici hesabıyla açın. Araç kayıtlıysa panoya eklenir ve ekranda "WhatsApp: … eklendi"
   yazısı çıkar. Değilse **Ruhsattan ekle** düğmesinde rozet çıkar.

**✅ gelmediyse:**
- Supabase'de **Edge Functions → whatsapp-webhook → Logs** sayfasına bakın.
  - `İmza geçersiz`: `WA_APP_SECRET` yanlış.
  - `Fotoğraf bilgisi alınamadı: 401`: `WA_TOKEN` yanlış ya da süresi bitmiş.
  - Hiç kayıt yoksa Meta bildirimi göndermiyordur: B4'ü ve B7'yi kontrol edin.
- ✅ geldiyse ama sitede görünmüyorsa: A1'deki kontrol satırlarına bakın ve siteyi yenileyin.

## Saklama ve gizlilik
- Fotoğraflar herkese kapalı bir depoda durur; yalnızca düzenleyiciler görebilir. 60 gün sonra silinir.
- Okunan plaka ve ağırlıklar ile gönderenin adı ve numarası `incoming_ruhsat` tablosunda kalır.
- Ruhsatlarda kişisel veri bulunduğu için bu işleyişi KVKK aydınlatma metninize eklemenizi öneririz.
