# Supabase (veritabanı) tarafı

Site, verileri `ollrccfqiqilbflanuik` Supabase projesinde tutar. Tablolar, yetki kuralları (RLS)
ve uygulamanın çağırdığı fonksiyonlar bu repoda **yoktu**. Aşağıdaki adımlar hem güvenliği
kontrol etmek hem de veritabanı yapısını repoya kaydetmek için.

## 1. Herkese açık kayıt olmayı kapatın (önemli)

Giriş ekranındaki "Hesap oluştur" düğmesi kaldırıldı. Ancak düğmeyi kaldırmak yetmez: Supabase
ayarı açık kaldıkça sitedeki anahtarla dışarıdan hâlâ hesap açılabilir.

1. Supabase paneli → **Authentication → Sign In / Providers**
2. **Allow new users to sign up** seçeneğini kapatın → Kaydet.

Yeni çalışan eklemek için: **Authentication → Users → Add user → Create new user**
(e-posta + parola, "Auto Confirm User" işaretli). Ardından kişiye düzenleyici yetkisini
bugüne kadar nasıl veriyorsanız öyle verin.

## 2. Yetki kurallarını (RLS) kontrol edin

Supabase paneli → **SQL Editor**'de çalıştırın:

```sql
-- Her tabloda RLS açık mı? (relrowsecurity = true olmalı)
select c.relname as tablo, c.relrowsecurity as rls_acik
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- Hangi kural kime ne izin veriyor?
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;
```

Dikkat edilecekler:

- `rls_acik = false` olan tablo varsa, sitedeki anahtarı bilen **herkes** o tabloyu okuyup
  yazabilir.
- `registry` / `visits` için `roles = {authenticated}` ve `qual = true` olan bir SELECT kuralı,
  giriş yapmış **her** hesabın tüm kayıtları görebildiği anlamına gelir. 1. adımda kayıt olma
  kapatıldıysa bu kabul edilebilir; kapatılmadıysa yabancılar kayıt olup verileri görebilir.
- Yazma (INSERT / UPDATE / DELETE) kuralları yalnızca düzenleyicilere izin vermeli.

## 3. Veritabanı yapısını repoya kaydedin

Uygulama şu Supabase fonksiyonlarına bağlı: `current_app_role`, `public_board`,
`get_public_link`, `rotate_public_link`, `save_app_setting`, `visit_history`, `list_backups`,
`get_backup`, `take_backup_now`. Ayrıca kurulumda şu SQL dosyaları çalıştırılmış:
`giris-cikis-gecmis-yedek-kurulumu.sql`, `musteri-onceligi-kurulumu.sql`,
`ayar-okuma-duzeltmesi.sql`.

**Elinizdeki bu `.sql` dosyalarını bu klasöre (`supabase/`) yükleyin.** Proje silinir ya da
bozulursa sistemi yeniden kurmanın tek yolu bunlar.

Güncel yapının tam dökümünü almak için (bilgisayarınızda Node.js kuruluysa):

```bash
npx supabase login
npx supabase link --project-ref ollrccfqiqilbflanuik
npx supabase db dump --schema public -f supabase/schema.sql
```

CLI kullanamıyorsanız, en azından fonksiyonların tanımını SQL Editor'den alabilirsiniz:

```sql
select p.proname as fonksiyon, pg_get_functiondef(p.oid) as tanim
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;
```

## 4. Kullanıcı görünen adları

İşlem geçmişinde kullanıcı adları daha önce kodun içine sabit yazılmıştı; artık `app_settings`
tablosundaki `display_names` ayarından okunuyor. Ayar yoksa e-postanın `@` öncesi gösterilir.
Panodaki **Son hareketler** listesi de işlemi kimin yaptığını bu adlarla gösterir (işlem geçmişinden okunur;
güvenlik ekranından yapılanlar "Güvenlik" yazılır).
Kendi e-posta adreslerinizle bir kez çalıştırın:

```sql
insert into public.app_settings (key, value, updated_at)
values ('display_names', '{"ornek@firma.com": "Ad Soyad", "ikinci@firma.com": "İkinci Kişi"}'::jsonb, now())
on conflict (key) do update set value = excluded.value, updated_at = now();
```

## 5. Hafif senkron için `updated_at` tetikleyicisi

Site artık her 15 saniyede tüm tabloları indirmiyor. Önce `registry`, `visits` ve
`app_settings` tablolarının satır sayısına ve en yeni `updated_at` değerine bakıyor,
değişiklik varsa tam veriyi çekiyor. Güvenlik için en geç 2 dakikada bir yine tam senkron
yapılıyor.

Bunun anında çalışması için her güncellemede `updated_at` değerinin değişmesi gerekir.
Uygulamanın "başka kullanıcı değiştirdi" kontrolü de buna dayandığı için büyük ihtimalle
zaten böyle. Kontrol etmek için:

```sql
select event_object_table as tablo, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
order by 1, 2;
```

`registry` ve `visits` için `BEFORE UPDATE` ile `updated_at = now()` yapan bir tetikleyici
görmelisiniz. Yoksa değişiklikler diğer ekranlara en geç 2 dakika içinde yansır.
(Kontrol edildi: `registry_set_updated_at` ve `visits_set_updated_at` mevcut.)

## 6. Anlık güncelleme (Realtime)

`anlik-guncelleme-kurulumu.sql` dosyasını SQL Editor'de bir kez çalıştırın. Bundan sonra
biri araç eklediğinde ya da değiştirdiğinde diğer ekranlar 15 saniye beklemeden, yaklaşık
1 saniye içinde yenilenir. Çalıştırılmazsa site yine 15 saniyede bir kendini yeniler.

## 7. WhatsApp'tan otomatik ruhsat aktarma

Kurulum adımları `WHATSAPP.md` dosyasında. Kurulmadıkça site bu özelliği sessizce kapalı tutar.

## 8. Güvenlik linki ve ayrı çıkış saati

`guvenlik-kurulumu.sql` dosyasını SQL Editor'de bir kez çalıştırın. Ardından **Ayarlar → Güvenlik linki**
bölümünden linki alıp kapıdaki güvenliğe gönderin. Güvenlik linki giriş yapmadan açar; yalnızca **GİRİŞ**
(araç TESİSTE olur) ve **ÇIKIŞ** (ayrı çıkış saati yazılır) düğmelerine basabilir. "İşlemler bitti" saati
ayrı kalır. "Bekleyenler" üç bloktur: **Gelecek araçlar**, **Tesiste · işlemde** ve ofisin "işlemleri bitti"
dediği **Çıkışa hazır** araçlar. Tarih aralığı seçilebilir (Bugün / Bu hafta ya da takvimden); "Çıkanlar"
yalnızca seçilen aralığın araçlarını gösterir ve her kartta o aracın bilgisini WhatsApp'ta paylaşma düğmesi
vardır. "Rapor" sekmesinden giriş-çıkışlar müşteri bazında kopyalanıp WhatsApp'ta paylaşılabilir. Kurulmadıkça
site bu özelliği kapalı tutar.

**Ayarlar → Güvenlik ekranı izleme linki** aynı ekranı yalnızca görüntüleme için açar (`?guvenlik-izle=…`):
açan kişi listeleri ve raporu görür, GİRİŞ / ÇIKIŞ yapamaz (sunucu da reddeder). Anahtarı güvenlik linkinden
ayrıdır; biri yenilenince diğeri etkilenmez. Dosya güncellendiğinde yeniden çalıştırmak zararsızdır.

**Güvenlik hesapları** (linke gerek kalmadan, kişiye özel kullanıcı adı ve şifre):

1. Supabase → **Authentication → Users → Add user → Create new user**: görevlinin e-postası ve şifresi,
   "Auto Confirm User" işaretli.
2. Sitede **Ayarlar → Güvenlik hesapları**: aynı e-postayı ve görevlinin adını yazıp **Ekle**.
3. Görevli sitede bu e-posta ve şifreyle giriş yapar; yalnızca güvenlik ekranı açılır (GİRİŞ / ÇIKIŞ,
   Çıkanlar, Rapor). Ofis panosu, beyanname ve nakliyeci bilgisi kapalıdır; veritabanı da bu hesapların
   tablolara doğrudan erişimini engeller. İşlem geçmişinde "Güvenlik · ad" yazılır.

Görevli ayrılırsa ya da telefon kaybolursa listede **Kapat** deyin; o an güvenlik ekranını açamaz. Kapatılan
hesabın tablolara erişim engeli sürer. Listeden tamamen silmek için önce kullanıcıyı Supabase'den silin (aksi
halde o kullanıcı normal hesap gibi tablolara erişebilirdi). Şifreyi değiştirmek için kullanıcıyı Supabase'den
silip aynı e-postayla yeniden açmak yeterlidir; listedeki kayıt durur.

## 9. Ücretsiz planda uzun süre sorunsuz kullanım

- **Duraklama:** Supabase'in ücretsiz planı 7 gün hiç kullanılmayan projeyi duraklatır. GitHub'daki
  "Supabase'i canlı tut" görevi (`.github/workflows/supabase-canli-tut.yml`) her gün 08:23'te veritabanına kısa
  bir okuma isteği atar; hiçbir veriyi değiştirmez. Proje yine de duraklarsa görev kırmızı olur ve GitHub
  e-posta gönderir: Supabase panelinde projeyi açıp **Restore project** deyin. GitHub, depoda 60 gün hiç
  değişiklik olmazsa zamanlanmış görevleri durdurup e-postayla haber verir; **Actions** sekmesinden tek
  tıkla yeniden açılır.
- **Veri aktarımı:** Site, değişiklik olmadıkça hiçbir şey indirmez; değişiklikte yalnızca son değişen
  kayıtları çeker, tüm tabloları en geç 10 dakikada bir baştan indirir. Kayıt sayısı arttıkça aylık aktarım
  büyümez.
- **Kontrol:** Ayda bir Supabase → **Organization → Usage** sayfasına bakın; bir çubuk %70'i geçerse
  geliştiriciye haber verin.
- **Yedek:** Ücretsiz planda Supabase indirilebilir yedek tutmaz; sitenin gece aldığı yedekler de aynı
  veritabanındadır. Verinin dışarıda da kopyası olması için **gece yedeği e-postasını** kurun (bölüm 12);
  ayrıca haftada bir sitede **Veri ve yedek** sayfasından yedeği indirip bilgisayara ya da Drive'a koyun.
- **SQL dosyaları:** GitHub'da düzenlemeyin (kalem simgesi). Dosyanın tamamını "kopyala" simgesiyle alıp
  SQL Editor'deki eski içeriğin yerine yapıştırın; kontrol satırlarının hepsi "tamam" demeli.

## 10. Otomatik günlük rapor (e-posta)

Her iş günü (Pazartesi–Cumartesi) yaklaşık 23:00'te günün raporu e-postayla gider: günün özeti, müşteri bazında
sayılar, araçların tesis giriş – işlem bitti – tesis çıkış – kalma saatleri ve ekte günlük Excel. Araç olmayan
günlerde gönderilmez. Gönderimi GitHub'daki "Günlük rapor maili" görevi yapar
(`.github/workflows/gunluk-rapor.yml`, betik `scripts/gunluk-rapor/gonder.mjs`).

**Gönderim saati:** Görev 22:55'e (İstanbul) kuruludur; mail yaklaşık 23:00'te gelir. GitHub zamanlanmış görevleri tam saatinde
değil, yoğunluğa göre dakikalar hatta saatler sonra başlatır (Ekim 2026'da 2–3 saat gecikme görüldü; bu yüzden eskiden saat
23:59'a kuruluyken mail gece 02:00–04:00'te geliyordu). Raporun altında "Rapor hazırlandı" saati yazar, gecikmeyi oradan
görürsünüz. Gecikme sürerse saat tam tutsun diye görev Supabase'in zamanlayıcısından tetiklenebilir; geliştiriciye haber verin.

Kurulum (bir kez):

1. `gunluk-rapor-kurulumu.sql` dosyasının **tamamını** SQL Editor'de çalıştırın (iki satır "tamam").
2. Gönderen Gmail hesabında **2 Adımlı Doğrulama** açık olmalı. https://myaccount.google.com/apppasswords
   sayfasında "PCS Rapor" adıyla bir uygulama şifresi oluşturun ve 16 harfli şifreyi kopyalayın (normal Gmail
   şifresi çalışmaz).
3. GitHub'da depo → **Settings → Secrets and variables → Actions → New repository secret** ile üç değer ekleyin:
   - `GMAIL_ADRES`: gönderen Gmail adresi
   - `GMAIL_UYGULAMA_SIFRESI`: 16 harfli uygulama şifresi
   - `PCS_RAPOR_ANAHTARI`: sitede **Ayarlar → Otomatik günlük rapor → Rapor anahtarı** ("Kopyala")
4. Sitede aynı bölümde alıcıları yazın (her satıra bir e-posta), "Günlük rapor gönderilsin"i işaretleyip
   **Kaydet**'e basın.
5. Denemek için GitHub → **Actions → Günlük rapor maili → Run workflow** (tarih boşsa bugün). Sonuç sitede
   "Son çalışma" satırında görünür.

**Uzun bekleyen araçlar:** tesise girip işlemleri bitmeden belirlenen süreyi (Ayarlar → **Uyarılar**, varsayılan 48 saat)
aşan araçlar panoda kırmızı görünür, bildirim zilinde ve bu raporda "Uzun bekleyen araçlar" bölümünde listelenir
(0 = kapalı). Rapordaki bölüm için `gunluk-rapor-kurulumu.sql` dosyasının son halini bir kez daha çalıştırın
(zararsızdır); çalıştırılmazsa rapor eskisi gibi gider, yalnızca bu bölüm çıkmaz.

Gizli değerler girilmeden görev hiçbir şey göndermeden biter. Gönderim başarısız olursa görev kırmızı olur,
GitHub e-posta gönderir ve sebep Ayarlar'da "Son çalışma" satırında yazar. Rapor anahtarını bilen günlerin araç
listesini (gece yedeği kuruluysa bütün kayıtları) okuyabilir; yanlış ellere geçerse Ayarlar'dan "Yeni anahtar" deyip GitHub'daki değeri güncelleyin.
Gmail uygulama şifresini değiştirirseniz GitHub'daki `GMAIL_UYGULAMA_SIFRESI` değerini de güncelleyin.

## 12. Gece yedeği (e-posta)

Her gece **02:30**'da (İstanbul) bütün plaka kayıtları, gelişler ve ayarlar e-postayla gider: tam yedek (`PCS_YEDEK_<tarih>.json`)
ve iki CSV (`PCS_PLAKA_KAYITLARI_<tarih>.csv`, `PCS_GELISLER_<tarih>.csv`; Excel'de açılır). Böylece verinin Supabase'in
dışında, e-posta kutunuzda da bir kopyası durur (Supabase'in ücretsiz planı indirilebilir yedek tutmaz). Gönderimi GitHub'daki
"Gece yedeği" görevi yapar (`.github/workflows/gece-yedegi.yml`, betik `scripts/gunluk-rapor/yedek.mjs`).

Kurulum (bir kez):

1. Günlük rapor kurulu olmalı (bölüm 10): yedek aynı gönderen Gmail ve GitHub gizli değerlerini (`GMAIL_ADRES`,
   `GMAIL_UYGULAMA_SIFRESI`, `PCS_RAPOR_ANAHTARI`) kullanır; yeni bir şey girmeniz gerekmez.
2. `gece-yedegi-kurulumu.sql` dosyasının **tamamını** SQL Editor'de çalıştırın (iki satır "tamam").
3. Sitede **Ayarlar → Rapor ve yedek → Gece yedeği** bölümünde alıcıları yazın (en fazla 5; her satıra bir e-posta),
   "Gece yedeği gönderilsin"i işaretleyip **Kaydet**'e basın.
4. Denemek için GitHub → **Actions → Gece yedeği → Run workflow**. Sonuç sitede "Son yedek" satırında görünür.

Bilmeniz gerekenler:
- Yedek dosyaları müşteri ve araç bilgisi içerir; yalnızca güvendiğiniz adreslere gönderin, e-postayı başkalarına iletmeyin.
- Rapor anahtarını bilen, günlük raporun yanında yedekteki **bütün** kayıtları da okuyabilir. Anahtarı kimseyle paylaşmayın;
  yanlış ellere geçerse Ayarlar'dan "Yeni anahtar" deyip GitHub'daki `PCS_RAPOR_ANAHTARI` değerini de güncelleyin.
- Dosyalar toplamı 20 MB'ı aşarsa yalnızca JSON gönderilir; JSON tek başına 20 MB'ı aşarsa yedek gönderilmez, görev
  kırmızı olur ve sebep "Son yedek" satırında yazar (o durumda Veri ve yedek sayfasından elle indirin).
- Veritabanı boş görünüyorsa yedek gönderilmez (boş bir yedek yanıltıcı olur); görev kırmızı olup GitHub e-posta gönderir.
- JSON, veritabanı satırlarının olduğu gibi dökümüdür (`data.registry`, `data.visits`, `data.app_settings`). Veritabanı
  bozulursa bu dosyadan yeniden yüklenir.

## 11. Araç ücreti ve aylık müşteri raporu

Her geliş için ayrı bir **Ücret** (tutar + para birimi: EUR, USD, TRY, GBP) alanı vardır. Sitede **Raporlar → Aylık müşteri
raporu**, seçilen ayda her müşterinin araç sayısını ve ücret toplamını (para birimi ayrı) gösterir; **Excel'e aktar**
müşteri özeti ve araç detayını indirir. Müşterinin gönderdiği listedeki ücret (`90 EURO`) de bu alana yazılır.

Kurulum (bir kez): `ucret-kurulumu.sql` dosyasının **tamamını** SQL Editor'de çalıştırın (iki satır "tamam"). Çalıştırılmazsa
site eskisi gibi çalışır: Ücret kutuları çıkmaz, ücret notta kalır ve rapor yalnızca notun başındaki tutarları
(`90 EURO · ...`) sayar. Eski kayıtlara dokunulmaz; notun başındaki tutar rapora zaten sayılır.

## Bu klasördeki dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `islem-gecmisi-duzeltmesi.sql` | "Kaydı düzenle"deki `malformed array literal` hatasını düzelten işlem geçmişi tetikleyicisi |
| `anlik-guncelleme-kurulumu.sql` | Tabloları Realtime yayınına ekler (anlık güncelleme) |
| `guvenlik-kurulumu.sql` | Güvenlik linki, güvenlik hesapları (GİRİŞ / ÇIKIŞ ekranı) ve ayrı çıkış saati |
| `gunluk-rapor-kurulumu.sql` | Otomatik günlük rapor maili: alıcılar, rapor anahtarı, günün verisi |
| `gece-yedegi-kurulumu.sql` | Gece yedeği e-postası: alıcılar, sayfa sayfa okuma, son yedek durumu (önce gunluk-rapor-kurulumu.sql) |
| `ucret-kurulumu.sql` | Araç ücreti için ayrı alan (tutar + para birimi); Raporlar > Aylık müşteri raporu bunu toplar |
| `plaka-harf-duzeltmesi.sql` | Eski kayıtlardaki Kiril / Yunan harfli plakaları Latin harfe çevirir (isteğe bağlı) |
| `whatsapp-kurulumu.sql` | WhatsApp'tan gelen ruhsatlar için tablo, fotoğraf deposu ve yetki kuralları |
| `mesaj-kurulumu.sql` | WhatsApp'tan gelen müşteri mesajlarından araç ekleme için tablo ve yetki kuralları. Kullanım: `MESAJ.md` |
| `functions/whatsapp-webhook/index.ts` | WhatsApp numarasına gelen fotoğrafı alan sunucu fonksiyonu |
| `functions/ruhsat-oku/index.ts` | Ruhsat fotoğrafını ve müşteri mesajlarını Google Gemini ile okuyan sunucu fonksiyonu (isteğe bağlı). Kurulum: `GEMINI.md`, `MESAJ.md` |
| `WHATSAPP.md` | WhatsApp kurulum rehberi (Meta + Supabase) |
| `MESAJ.md` | Müşterinin WhatsApp mesajından, sohbet balonundan ve yapıştırılan mesajdan araç ekleme (Gemini): kurulum ve kullanım |
