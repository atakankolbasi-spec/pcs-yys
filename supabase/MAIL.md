# Müşteri maillerinden gelecek araçları panoya düşürmek

Müşteriler gelecek araçları gumruk@pcstransit.com.tr adresine mail atar. Outlook'taki bir kural bu mailleri ayrı bir
Gmail adresine iletir. GitHub'da **5 dakikada bir** çalışan görev (`.github/workflows/mail-oku.yml`,
betik `scripts/mail-oku/oku.mjs`) o Gmail kutusundaki okunmamış mailleri okur ve WhatsApp mesajlarıyla aynı yere,
`incoming_messages` tablosuna **"Mail"** etiketiyle kaydeder. Sitede **Ruhsattan ekle** penceresinde WhatsApp
mesajlarının yanında onay bekler.

**Hiçbir araç siz onaylamadan panoya eklenmez, taşınmaz ya da silinmez.** Betik `visits` ve `registry` tablolarına
hiç dokunmaz.

## Mail nasıl okunur

- **Plaka:** önce konu satırından (`X 7608 MA / X 1443 EM` = çekici / dorse), sonra gövdeden. Okumayı WhatsApp'taki
  aynı yapay zekâ (`ruhsat-oku` fonksiyonunun mesaj modu, Gemini) yapar.
- **Yalnızca en üstteki yeni yazı okunur:** "From: … Sent: …", "Gönderen:", "-----Original Message-----", "… wrote:"
  ve `>` ile alıntılanmış eski yazışmalar ile uzun imzalar atılır.
- **Yanıtlar yeni araç değildir.** Konusu `RE:` / `YNT:` / `FW:` / `İLT:` ile başlayan, `In-Reply-To` başlığı olan
  ya da "TASLAK OK", "Beyannameler Kapandı", "SON BEYAN EKTEDİR" gibi devam cümleleri olan mailler Gemini'ye
  gönderilmez; "Konuşmanın devamı" notuyla yoksayılmış olarak kaydedilir (ekte beyanname numarası varsa notta yazar).
- **Tesise gelecek mi, gelmeyecek mi?** Asıl ölçü beyannamenin **30. kutusu ("Eşyanın bulunduğu yer")**:
  - Kutuda tesis kodu varsa (varsayılan `Z34089`) araç **tesise gelecektir**: normal öneri olarak düşer, beyanname
    numarası (sağ üstte barkodun altındaki, örn. `26341300EX00874692`) beyanname alanına yazılır.
  - Kutu **boşsa ya da başka bir koddaysa** araç tesise gelmeyecektir: panoya önerilmez, onay listesinde kapalı bir
    **"Tesise gelmeyecek"** bölümünde durur. Yanlışsa oradan yine tek tek eklenebilir.
  - **Beyanname eki yoksa ya da okunamadıysa** müşterinin Ayarlar'daki **"Genelde tesise gelir"** işaretine bakılır
    (varsayılan açık): açıksa öneri düşer ama "Beyanname görülmedi, tesis kodunu kontrol edin" uyarısıyla (toplu
    uygulamaya girmez, tek tek onaylanır); kapalıysa "Tesise gelmeyecek"e gider.
- **Ekler içerikten okunur, dosya adına güvenilmez.** PDF (taranmış olabilir) ve resim ekleri bellekte okunup
  Gemini'ye gönderilir; hangisinin beyanname olduğuna **içerikten** karar verilir (`26BG05000VIB0IBAT8.pdf` de olur,
  `Bul20261027154628.pdf` de). `.docx` ekler düz metne çevrilip mail metnine eklenir. Ruhsat PDF'leri ve imza
  resimleri (`image001.gif`, `image003.png`, satır içi resimler) sonucu etkilemez. Sınırlar: dosya başına 8 MB,
  mail başına en çok 4 belge ve 2 `.docx`, 3 KB'tan küçük dosyalar atlanır. **Ekler hiçbir yerde saklanmaz** (diske,
  GitHub'a ya da günlüğe yazılmaz); günlükte yalnızca sayılar görünür.
- **Müşteri:** gönderenin mail adresinden ya da alan adından (aşağıda Ayarlar). Eşleşme yoksa yapay zekânın bulduğu
  müşteri adı kullanılır. Plaka kayıtlıysa panoda kayıttaki müşteri öne çıkar.
- **Geliş günü:** mailde yazıyorsa o; yoksa mailin geldiği gün olur ve kartta WhatsApp'taki gibi uyarı çıkar.
- Aynı mail iki kez işlenmez (`wa_message_id` alanında `mail:<Message-ID>` saklanır).
- Her çalışmada en çok 30 mail işlenir. Kaydı yazılamayan mail okundu işaretlenmez, sonraki çalışmada yeniden denenir.
  Yapay zekâ okuyamazsa kart "hata" olarak gelir; **Yeniden oku** ile denenir.

## Kurulum

Önce `supabase/MESAJ.md` kurulumu (tablo + `ruhsat-oku` fonksiyonu + `GEMINI_API_KEY`) yapılmış olmalı. Ek SQL gerekmez.

**`ruhsat-oku` fonksiyonunu yeniden yükleyin:** Beyanname okuma modu bu sürümle geldi. Supabase > Edge Functions >
`ruhsat-oku` > **Code** > eski kodu silip `supabase/functions/ruhsat-oku/index.ts` dosyasının tamamını yapıştırın >
**Deploy**. Yapılmazsa beyannameler okunamaz ve mail araçları "Beyanname görülmedi" uyarısıyla (ya da müşteri
"genelde gelmez" ise "Tesise gelmeyecek"te) görünür.

1. **Gmail uygulama şifresi:** Mailleri alacak Gmail hesabında *Google Hesabı > Güvenlik* bölümünden **2 adımlı
   doğrulamayı** açın, sonra https://myaccount.google.com/apppasswords adresinden bir **uygulama şifresi** (16 harf)
   üretin. IMAP Gmail'de varsayılan olarak açıktır (kapalıysa Gmail > Ayarlar > Yönlendirme ve POP/IMAP'tan açın).
2. **GitHub Secrets:** GitHub'da depo > *Settings > Secrets and variables > Actions > New repository secret* ile
   dört değer ekleyin:
   - `GMAIL_ADRES1`: mailleri alacak Gmail adresi
   - `GMAIL_UYGULAMA_SIFRESI1`: 1. adımdaki 16 harfli şifre
   - (Adların sonundaki "1" bilinçlidir: `GMAIL_ADRES` / `GMAIL_UYGULAMA_SIFRESI` günlük rapor ve gece yedeğini
     gönderen hesaba aittir; onlara dokunmayın.)
   - `SUPABASE_URL`: Supabase projenizin adresi (*Project Settings > API > Project URL*)
   - `SUPABASE_SERVICE_ROLE_KEY`: aynı sayfadaki **service_role** anahtarı (gizli tutun; siteye ya da bir yere yazmayın)
3. **SQL:** Yeni SQL yok. `supabase/mesaj-kurulumu.sql` daha önce çalıştırılmadıysa Supabase > SQL Editor'de bir kez
   çalıştırın (beş satırın hepsi `tamam` olmalı).
4. **Outlook kuralı:** Outlook'ta *Kurallar ve Uyarılar > Yeni Kural > Boş kuraldan başla: Aldığım iletilerde
   kuralı uygula*.
   - Koşul: **"gönderenin adresinde belirli sözcükler bulunan"** > müşterilerin alan adları (ör. `bultrans.com.tr`;
     her müşteri için bir tane ekleyin).
   - Eylem: **"ek olarak kişi veya ortak grup nesnesine ilet"** > 1. adımdaki Gmail adresi.

   **Düz "ilet" değil, mutlaka "ek olarak ilet" seçin:** düz "ilet"te konu `FW: …` olur, gönderen
   gumruk@pcstransit.com.tr görünür ve müşterinin yazısı "From: … Sent: …" satırının altına iner; müşterinin özgün
   maili ve ekleri bozulur. "Ek olarak ilet"te özgün mail olduğu gibi (`.eml` eki olarak) Gmail'e ulaşır; betik onu
   açıp gönderen, konu, Message-ID ve beyanname eklerini özgün maildeki haliyle okur. Aynı müşteri maili iki kez
   iletilse bile bir kez işlenir; bir iletide en çok 5 özgün mail okunur. Yedek olarak, ek olmadan kendi alan
   adımızdan (`@pcstransit.com.tr`) düz "ilet" ile gelen `FW:`/`İLT:` mailleri de gövdedeki iletme başlığından
   (From/Kimden, Subject/Konu) okunur, ama bu yol en iyi çabadır; Outlook'ta `.msg` olarak iletilen ekler
   okunamaz, yalnızca `.eml`/`message/rfc822` desteklenir.
5. **Müşteri mail adresleri ve tesis kodları (isteğe bağlı):** Sitede *Ayarlar > WhatsApp* bölümünde her müşteri
   için mail adresi ya da alan adı (`nurhan@bultrans.com.tr` ya da `@bultrans.com.tr`) girin; tam adres alan adından
   önceliklidir. Aynı yerde **Tesis kodları** (virgülle çoğaltılır, varsayılan `Z34089`) ve her müşteri için
   **"Genelde tesise gelir"** işareti (varsayılan açık) bulunur.
6. **Deneme:** GitHub > *Actions > Müşteri maillerini oku > Run workflow*. Gmail'e bir deneme maili iletip
   çalışma bittikten sonra sitede *Ruhsattan ekle*'de "Mail" kartını görün.

## Sorun giderme

| Belirti | Neden |
|---|---|
| Görev "kırmızı" bitiyor, günlükte IMAP giriş hatası | Uygulama şifresi yanlış ya da 2 adımlı doğrulama kapalı |
| Görev yeşil ama hiçbir şey olmuyor | Dört secret'tan biri eksik (görev sessizce biter) ya da Gmail'de okunmamış mail yok |
| Mail geldi, kart yok | Mail bir yanıttı ("Konuşmanın devamı" olarak yoksayılır), rakam içermiyordu ya da Gmail'de zaten okunmuş |
| Kartta "Yapay zekâ mesajı okuyamadı" | Gemini sınırı ya da yoğunluğu: **Yeniden oku** |
| Müşteri boş geliyor | Ayarlar'da o müşterinin mail adresi/alan adı yok |

## Gizlilik

Mailin konusu ve yeni yazısı (plaka, tarih) ile beyanname olabilecek **PDF/resim ekleri ve `.docx` ekinin metni**
okunmak üzere Google Gemini'ye gönderilir. Ekler yalnızca bellekte tutulur, hiçbir yerde saklanmaz. Google'ın
**ücretsiz** kullanımında gönderilen içerik Google'ın ürünlerini geliştirmek için kullanılabilir; beyannameler ticari
bilgi içerdiği için bu sizin kararınızdır (ücretli Gemini kullanımında bu geçerli değildir). Ayrıntı:
`supabase/GEMINI.md`. Herkese açık `gizlilik.html` sayfasındaki metnin buna göre gözden geçirilmesi gerekir.
