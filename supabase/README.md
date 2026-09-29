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
ayrı kalır. Giriş ve çıkış bekleyenler tek ekrandadır; tarih aralığı seçilebilir ve "Rapor" sekmesinden
giriş-çıkışlar müşteri bazında kopyalanıp WhatsApp'ta paylaşılabilir. Kurulmadıkça site bu özelliği kapalı
tutar. Dosya güncellendiğinde yeniden çalıştırmak zararsızdır.

## Bu klasördeki dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `islem-gecmisi-duzeltmesi.sql` | "Kaydı düzenle"deki `malformed array literal` hatasını düzelten işlem geçmişi tetikleyicisi |
| `anlik-guncelleme-kurulumu.sql` | Tabloları Realtime yayınına ekler (anlık güncelleme) |
| `guvenlik-kurulumu.sql` | Güvenlik linki (GİRİŞ / ÇIKIŞ ekranı) ve ayrı çıkış saati |
| `plaka-harf-duzeltmesi.sql` | Eski kayıtlardaki Kiril / Yunan harfli plakaları Latin harfe çevirir (isteğe bağlı) |
| `whatsapp-kurulumu.sql` | WhatsApp'tan gelen ruhsatlar için tablo, fotoğraf deposu ve yetki kuralları |
| `functions/whatsapp-webhook/index.ts` | WhatsApp numarasına gelen fotoğrafı alan sunucu fonksiyonu |
| `WHATSAPP.md` | WhatsApp kurulum rehberi (Meta + Supabase) |
