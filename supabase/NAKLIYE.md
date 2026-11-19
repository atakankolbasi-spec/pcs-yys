# Nakliye programı

Müşterilerin gönderdiği yükleri takip edin; depoya gelen yükleri aynı müşterinin bir aracına atayın; Lade Liste ve CMR belgelerini
sitede hazırlayın.

## Kurulum (bir kez)

1. Supabase > **SQL Editor**'de `nakliye-kurulumu.sql` dosyasının **tamamını** çalıştırın. En altta 14 satır "tamam" görünmelidir.
2. Sitede soldaki menüden **Nakliye**'yi açın. (Yalnızca düzenleyici hesaplarda görünür.)

`nakliye-kurulumu.sql` güncellendiğinde (örneğin müşteri araç planı eklenince) dosyanın **tamamını yeniden çalıştırın**; mevcut kayıtlar korunur, en altta 14 satır "tamam" görünür (yük takibi ve bildirim, Excel'den yükleme, depoda teslim alma ve fotoğraf, ofisle yazışma eklenince 14 satıra çıktı).

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

## Yük takibi, bildirim ve Excel'den yükleme (müşteri sayfası)

- **Takip** sekmesi: her yük için 5 adımlı çizgi (yazıldı, araca konuldu, depoya geldi, yola çıktı, teslim edildi). Depoda eksik ya da hasar görülürse yükte kırmızı uyarı çıkar.
  Müşteri aynı sekmeden hangi haberleri istediğini seçer (depoya geldi, yola çıktı, teslim, sorun, depo ya da ofis mesajı) ve haberlerin gideceği WhatsApp numarasını yazar.
- **Excel'den ekle** (Yeni yük düğmesinin yanında): müşteri Excel ya da CSV dosyasını seçer ya da tabloyu yapıştırır; sütun başlıkları Türkçe/İngilizce tanınır.
  Önizlemede hatalı satırlar kırmızı görünür. Hepsi doğruysa toplu eklenir; tek satır hatalıysa hiçbiri eklenmez. En çok 200 satır. Örnek dosya sayfadan indirilir.
- **Rapor ve arşiv** sekmesi: haftalık/aylık yük ve ton grafiği, en çok gönderilen alıcılar, geçmiş seferler (belgeleri yeniden açılır, bir ayın belgeleri birlikte açılıp yazdırılır) ve CSV olarak indirme.
- **Sohbet balonu** (sayfanın sağ altı, ana ekrandaki gibi): müşteri **depoyla** yazışır (isterse bir yüke ya da araca bağlayarak); Enter gönderir. Deponun cevabı balonda kırmızı rozetle görünür ve müşteri bildirimi açıksa WhatsApp haberi olarak da gider. Deponun personel adı müşteriye görünmez, yalnızca "Depo" yazar.
  **Depo sayfasında** aynı sohbet balonu vardır: depodaki arkadaş balona basıp bir **müşteri seçer**, müşterinin yazdıklarını görür (açılınca okundu olur) ve cevap yazar (adıyla kaydolur). Okunmamış müşteri mesajları balonda ve müşteri listesinde sayılır. Ofis bu yazışmaların tarafı değildir; müşteri ofise değil depoya yazar.

## Depoda teslim alma, fotoğraf, QR etiket ve günün programı (depo sayfası)

- **Teslim al** (kamera simgesi): depodaki arkadaş gerçek kap ve kiloyu yazar; yük "sağlam / eksik / hasarlı" işaretlenir, not ve raf konumu yazılır, telefonla en çok 8 fotoğraf çekilir.
  Sayım beyandan farklıysa ya da yük eksik/hasarlıysa müşteriye otomatik "sorun" haberi gider ve ofis ekranında yükün yanında görünür. Fotoğraflar küçültülerek veritabanında saklanır.
- **Etiket**: her yükün 10 harfli kısa kodu vardır. Yükte **Etiket** düğmesi (ya da birkaç yükü seçip alttaki **Etiket yazdır**) A6 boyutunda, QR kodlu etiket açar; yazdırıp kabın üstüne yapıştırın. QR kodda gizli anahtar yok, yalnızca yükün kısa kodu var.
- **Okut** sekmesi: telefonla etiketi okutun (ya da kodu elle yazın, USB okuyucu da yazar gibi çalışır); yük açılır, tek dokunuşla **Geldi** denir. Kamera için tarayıcı izin ister; izin verilmezse kod elle yazılır.
- **Program** sekmesi: bugün gelmesi beklenen yükler müşteri ve araca göre gruplanır (geçti / şimdi / bekliyor / tamam). Araç depoya gelince **Araç geldi** ile o aracın yükleri topluca işaretlenir.
  **Araçlar** sekmesinde yükleme kontrolü vardır: araçtaki yüklerin kaçı depoya geldi, doluluk (24 ton kamyon esas alınır). Geri kalan yük varsa **Yola çıktı** düğmesi uyarır ve yola çıkarmaz; hepsi gelince basılır.

## Ofis: yazışmaları izleme (mesaj balonu ve Mesajlar sekmesi)

Müşteriler depoyla yazışır; ofis bu konuşmaları görür. Nakliye sayfasının sağ altında, ana ekrandaki sohbet balonunun hemen üstünde **mesaj balonu** durur: balona basınca üstteki listeden müşteriyi seçersiniz,
müşteri ile deponun yazışması görünür. **Mesajlar** sekmesi aynı yazışmaların tam sayfa halidir. İsterseniz siz de yazabilirsiniz (Enter gönderir); müşteri bunu "Ofis" olarak görür ve WhatsApp haberi gider.
Okundu işareti müşteriye ve depoya aittir: ofis okuyunca işaretlenmez. Listede kırmızı sayı, müşterinin yazdığı ama deponun henüz okumadığı mesajlardır.


## Bildirimler (kendiliğinden WhatsApp'a, ofiste kontrol)

Müşterinin seçtiği haberler (depoya geldi, yola çıktı, teslim edildi, sorun, deponun ya da ofisin yazdığı mesaj) **olay olur olmaz** müşterinin yazdığı WhatsApp numarasına gider
(aşağıdaki kurulum yapıldıysa): depoda **Geldi** denince "Yükünüz depoya geldi", araç **Yola çıktı** denince "Aracınız yola çıktı, Lade Liste ve CMR belgeleriniz hazır",
sefer **Teslim edildi** olunca, depo eksik/hasar bildirince ve depo (ya da siz) müşteriye mesaj yazınca. Aynı anda gelen birkaç yük tek mesajda birleşir.
Haber yalnızca müşterinin **bildirim telefonu** yazılıysa (siz Müşteriler'den ya da müşteri kendi sayfasında *Takip* sekmesinden yazar) ve o haberi kapatmadıysa gönderilir.

Nakliye > **Bildirimler** sekmesi kontrol yeridir: yalnızca **henüz gönderilemeyen** haberler görünür. Otomatik gönderim kurulmadıysa hepsi burada bekler;
gönderilemeyenlerin yanında nedeni yazar (ör. "onaylı şablon gerekir", "numara geçersiz"). **WhatsApp'ta gönder** mesajı hazır halde açar, gönderdikten sonra
**Gönderildi say** denir; istenmeyen haber **Gönderme** ile geçilir. Gönderilen haberler listeden kendiliğinden kalkar.

### Otomatik bildirim kurulumu (bir kez, yaklaşık 15 dakika)

`WHATSAPP.md` kurulumunu zaten yaptıysanız `WA_TOKEN` hazırdır; kalan adımlar:

1. **SQL**: `nakliye-kurulumu.sql` dosyasının tamamını yeniden çalıştırın (haber eklenince fonksiyonu çağıran tetikleyiciyi kurar). En altta 14 satır "tamam" çıkar.
2. **Fonksiyon**: Supabase > **Edge Functions** > **Deploy a new function** > **Via Editor**. Adı tam olarak `nakliye-bildirim` yazın, örnek kodu silip
   `supabase/functions/nakliye-bildirim/index.ts` dosyasının tamamını yapıştırın, **Deploy**. Sonra fonksiyonun ayarlarında **Verify JWT** seçeneğini **kapatın**
   (veritabanı fonksiyonu giriş yapmadan çağırır; fonksiyon yalnızca kuyruktaki haberleri gönderir, dışarıdan veri kabul etmez).
3. **Gizli ayarlar** (Edge Functions > Secrets): `WA_PHONE_ID` = Meta > WhatsApp > **API Setup** sayfasındaki **Phone number ID**. (`WA_TOKEN` zaten var.)
4. **Şablon** (Meta kuralı): müşteri son 24 saat içinde numaranıza yazmadıysa WhatsApp yalnızca **onaylı şablon** mesajına izin verir. [business.facebook.com](https://business.facebook.com)
   > WhatsApp Manager > **Message templates** > **Create template**: Kategori **Utility**, ad `nakliye_haber`, dil **Turkish**, gövde şu cümle olsun
   (değişken başta ya da sonda olamaz):
   `Merhaba, PCS Transit nakliye bildiriminiz: {{1}} İyi çalışmalar.`
   Örnek değer olarak `Yükünüz depoya geldi | KAYA AMBALAJ → DORNA FOODS · 840 kap` yazın. Meta onaylayınca (dakikalar-saatler) Supabase Secrets'a
   `WA_SABLON` = `nakliye_haber` ekleyin. Şablon yokken mesajlar yalnızca müşteri son 24 saatte yazdıysa gider; diğerleri "hata" olarak Bildirimler'de kalır.
5. **Deneme**: bir müşteriye bildirim telefonu yazın (kendi numaranız olabilir), depoda bir yüke **Geldi** deyin; birkaç saniye içinde WhatsApp'a gelir.
   Gelmezse Bildirimler sekmesinde nedeni yazar. Ayrıca `https://<proje>.supabase.co/functions/v1/nakliye-bildirim?bekle=0` adresini tarayıcıda açarsanız
   fonksiyon beklemeden çalışır ve `{"sent":1,"failed":0}` gibi bir sonuç yazar (ayar eksikse `"ayar":"eksik"`).

Notlar:
- Meta, şablon (işletmenin başlattığı) mesajlar için küçük bir ücret alır; güncel fiyat için Meta'nın fiyat sayfasına bakın. Yalnızca müşterinin seçtiği haberler gönderilir.
- Müşteri bu mesaja cevap yazarsa cevap `whatsapp-webhook` fonksiyonuna düşer (ruhsat/araç listesi okuyucusu); depoyla yazışmak için müşteriye sayfadaki sohbet balonunu kullanmasını söyleyin.
- Fonksiyon kurulmadıysa ya da gizli ayarlar eksikse hiçbir şey bozulmaz; haberler Bildirimler sekmesinde elle gönderilmeyi bekler.

## PLASTNAK taslağı

Lade Liste ve CMR çıktıları, gönderdiğiniz PLASTNAK örnek PDF'lerinin milimetre ölçülü kopyasıdır (çizgiler, yazı yerleri, etiket yazımları örnektekiyle aynı; örnekteki
yazım hataları da dahil, ör. "CONSIGMENT"). `nakliye-kurulumu.sql` PLASTNAK müşterisine örnekteki logoyu, nakliyeci bilgisini (telefon, mail, web) ve
şart metnini yazar; panoda adında PLASTNAK geçen müşteri varsa onu doldurur, yoksa ekler. Elle yazdığınız bilgilerin üzerine yazılmaz.
Diğer müşteriler aynı taslağı kendi logosu, nakliyeci bilgisi ve şartlarıyla kullanır. Poz No **PCS-26-0001** biçiminde kalır.

Belgeler açılan pencerede önizlenir; **Yazdır / PDF olarak kaydet** ile çıktı alınır (tarayıcının yazdırma penceresinde "PDF olarak kaydet" seçilebilir).
Belgeler tarayıcıda hazırlanır; sunucuya ya da başka bir siteye gönderilmez.
