# Nakliye programı

Müşterilerin gönderdiği yükleri takip edin; depoya gelen yükleri aynı müşterinin bir aracına atayın; Lade Liste ve CMR belgelerini
sitede hazırlayın.

## Kurulum (bir kez)

1. Supabase > **SQL Editor**'de `nakliye-kurulumu.sql` dosyasının **tamamını** çalıştırın. En altta on satır "tamam" görünmelidir.
2. Sitede soldaki menüden **Nakliye**'yi açın. (Yalnızca düzenleyici hesaplarda görünür.)

`nakliye-kurulumu.sql` güncellendiğinde (örneğin müşteri araç planı eklenince) dosyanın **tamamını yeniden çalıştırın**; mevcut kayıtlar korunur, en altta on satır "tamam" görünür (kullanıcı girişi, işlem geçmişi ve 5 saniyelik yenileme eklenince on satıra çıktı).

Çalıştırılmadan Nakliye sayfası açılırsa sayfada "bir kerelik kurulum gerekli" uyarısı çıkar; başka bir yer etkilenmez.

## Kullanım

1. **Müşteriler**: her müşteriyi ekleyin. Müşteriye özel *nakliyeci bilgisi* (CMR 16. kutu), *şart ve mülahazalar* (CMR 18. kutu),
   *yükleme yeri* ve *logo* o müşterinin Lade Liste ve CMR belgelerinde çıkar.
2. **Yük ekle**: gönderici, alıcı, kap, mal, kilo, varış gümrük vb. "Yük zaten depoda" işaretlenirse doğrudan boşta listesine girer;
   işaretlenmezse **Bekleyenler**'de durur ve depoya gelince **Geldi** denir.
3. **Boşta yükler**: depoya gelmiş, araca atanmamış yükler varışa göre gruplanır. **Aynı müşterinin** yüklerini işaretleyin
   (bir araç yalnızca tek müşterinin yüklerini taşır), sağdan çekici ve dorse plakasını yazın, **Araca ata ve belgeleri hazırla**'ya basın.
4. Her sefere otomatik **Poz No** verilir: `PCS-26-0001`, `PCS-26-0002` ... (yıl değişince `PCS-27-0001`'den başlar).
   CMR numaraları Poz No'ya `/01`, `/02` ... eklenerek yazılır.
5. Atanan yükler boşta listesinden çıkar ve **Araçlar** sekmesinde plakanın altında durur. Oradan Lade Liste ve CMR yeniden açılır;
   yanlış atanan yük **Araçtan çıkar** ile boşa döner, **Seferi sil** tüm yükleri boşa döndürür.

## Müşteri ve depo bağlantıları

**Bağlantılar** düğmesinde her müşteriye ve depoya ayrı bir bağlantı çıkar (Kopyala, WhatsApp, Aç, Kapat, Yenile).
Depo bağlantısı şifresizdir; müşteri bağlantısı, müşteriye kullanıcı tanımlamadıkça şifresiz açılır (aşağıda **Müşteri kullanıcıları**).
Bağlantıyı yalnızca ilgili kişiye verin.

- **Müşteri bağlantısı**: müşteri yalnızca kendi yüklerini görür; yeni yük yazar, depoya gelmeden önce düzenler ya da siler.
  **Hangi araca ne yükleneceğini kendisi ayarlar**: yüklerini işaretleyip "Araca koy" der (yeni araç için çekici ve dorse plakası yazar ya da
  kendi mevcut aracını seçer). Depoya henüz gelmemiş yük de araca konabilir. Bu atama kesindir: Poz No otomatik verilir, yük sizin
  *Boşta yükler* listenizden çıkar ve *Araçlar* sekmesinde plakanın altında "Müşteri planladı" ile görünür. Müşteri aracındaki yükü
  çıkarabilir, plakayı düzeltebilir, Lade Liste ve CMR belgelerini kendi sayfasından alır.
  Araç yola çıkınca **Araçlar** sekmesinde **Yola çıktı (müşteri değiştiremesin)** deyin; müşteri o araçta artık değişiklik yapamaz
  (**Kilidi aç** ile geri açılır).
- **Depo bağlantısı**: depodaki arkadaşlar adlarını yazıp yük gelince **Geldi**'ye basar (yanlışsa **Geri al**). Geldi denen yük sizin
  **Boşta yükler** listenize düşer. Müşterinin araca koyduğu ama depoya henüz gelmemiş yükler de **Bekleyenler**'de plakasıyla görünür; gelince
  **Geldi** denir, yük araçta kalır. **Araçlar** sekmesinde plaka bazında seferleri ve belgeleri görürler.
- **Yenile** yeni bir bağlantı üretir; eskisi o an çalışmaz olur. **Kapat** bağlantıyı silmeden durdurur.
- Bağlantı sayfaları herkese açıktır ama yalnızca bağlantıdaki anahtarla çalışır; anahtarlar tahmin edilemez uzunluktadır ve tablolara doğrudan erişim yoktur.

## Müşteri kullanıcıları: kullanıcı adı ve şifreyle giriş (yalnızca müşteri tarafı)

**Müşteriler** > müşterinin yanındaki **Kullanıcılar** düğmesinden kullanıcı eklenir. Kullanıcı adını, görünen adı ve şifreyi **siz belirlersiniz**
(**Şifre öner** rastgele bir şifre yazar); müşteriye giriş adresini (`nakliye.html`), kullanıcı adını ve şifreyi iletin.

- Müşteriye ilk kullanıcıyı eklediğiniz anda **müşteri bağlantısı (`?m=…`) tek başına çalışmaz**, kullanıcı adı ve şifre sorulur. Kullanıcılar pasif olsa bile
  bağlantı açılmaz; yalnızca tüm kullanıcıları silerseniz bağlantı yine şifresiz çalışır. Depo bağlantısı değişmez.
- Bir müşterinin birden çok kullanıcısı olabilir (ör. her çalışan ayrı). Kullanıcı adı tüm müşteriler arasında tektir; küçük harf, rakam, nokta, tire ve alt çizgi kullanılır.
- Şifre sunucuda şifrelenmiş (bcrypt) saklanır; kimse göremez, yalnızca yenisi verilebilir. Şifreyi değiştirirseniz ya da kullanıcıyı pasife alırsanız açık oturumları kapanır.
- Oturum bu cihazda 30 gün açık kalır; müşteri **Çıkış** ile kapatabilir. 5 yanlış denemede o kullanıcı adı 15 dakika kilitlenir.
- **Hareketler** sekmesi kim, ne zaman, ne yaptı kaydını gösterir: müşteri kullanıcıları adlarıyla, depo yazdığı adla, siz e-postanızla görünür
  (yük ekleme, düzenleme, silme, araca koyma, araçtan çıkarma, depoya geldi, sefer işlemleri, giriş, kullanıcı değişiklikleri). Müşteriye göre süzebilirsiniz.
  Müşteri kendi sayfasında yalnızca kendi son işlemlerini görür (ofis ve depo adları gizlenir: "Ofis", "Depo" yazar). Kayıtlar 400 gün saklanır.
- Depo bağlantısında işlemler, sayfanın üstündeki **Adınız** kutusuna yazılan adla kaydedilir; kutu boşsa "adı yazılmamış" görünür.

## Kayıtlı firma ve araçlar (tekrar yazmaya gerek kalmaz)

Müşterinin yazdığı gönderici ve alıcı firmalar (adres, ülke, gümrük kodu vb. ile) ve araç plakaları (çekici + dorse) kendiliğinden saklanır. Sonraki yüklerde
firma adını yazmaya başlayınca öneri çıkar; kayıtlı firma seçilince adres, ülke, gümrük gibi boş alanlar kendiliğinden dolar. Yeni araç eklerken kayıtlı araçlara dokunmak yeter.
Panoda önceden yazılmış yükler ilk kurulumda rehbere aktarılır.

## Ekran yenileme

Müşteri ve depo ekranları **5 saniyede bir** kendiliğinden yenilenir: önce çok hafif bir değişiklik sorgusu yapılır, bir şey değiştiyse liste çekilir.
Sayfanın üstünde yeşil **Canlı** göstergesi görünür; bağlantı koparsa kırmızı **Bağlantı yok** olur ve geri gelince kendiliğinden toparlanır. Yazı yazarken ekran yenilense de yazdığınız kaybolmaz.

## Müşteri ve depo sayfaları: yük düzenleme, silme, getirecek kamyon

- Her yükte **Yükü getirecek kamyon plakası** alanı vardır (müşteri yazar; depo ve siz görürsünüz, plakayla arama yapılır).
- **Müşteri** yüklerini kendi sayfasında **Düzenle** ve **Sil** düğmeleriyle yönetir: araca konmamış yük (bekleyen ya da depoda) düzenlenir ve silinir;
  araçtaki yük düzenlenir (silmek için önce "Araçtan çıkar"); sefer **Yola çıktı** diye kilitlenince hiçbiri değişmez.
- **Depo** yük bilgisini (gerçek kap, kilo, plaka) **Düzenle** ile (sağdan açılan çekmecede) düzeltir; araca konmamış yükü **Sil** ile siler. Birden çok yükü kutucukla seçip **Seçilileri geldi işaretle** ile topluca işaretleyebilir.
- Siz Nakliye sayfasında her yükü düzenleyebilirsiniz (araçtaki yük silinmez, önce araçtan çıkarılır).

## PLASTNAK taslağı

Lade Liste ve CMR çıktıları, gönderdiğiniz PLASTNAK örnek PDF'lerinin milimetre ölçülü kopyasıdır (çizgiler, yazı yerleri, etiket yazımları örnektekiyle aynı; örnekteki
yazım hataları da dahil, ör. "CONSIGMENT"). `nakliye-kurulumu.sql` PLASTNAK müşterisine örnekteki logoyu, nakliyeci bilgisini (telefon, mail, web) ve
şart metnini yazar; panoda adında PLASTNAK geçen müşteri varsa onu doldurur, yoksa ekler. Elle yazdığınız bilgilerin üzerine yazılmaz.
Diğer müşteriler aynı taslağı kendi logosu, nakliyeci bilgisi ve şartlarıyla kullanır. Poz No **PCS-26-0001** biçiminde kalır.

Belgeler açılan pencerede önizlenir; **Yazdır / PDF olarak kaydet** ile çıktı alınır (tarayıcının yazdırma penceresinde "PDF olarak kaydet" seçilebilir).
Belgeler tarayıcıda hazırlanır; sunucuya ya da başka bir siteye gönderilmez.
