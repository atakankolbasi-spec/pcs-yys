# Nakliye programı

Müşterilerin gönderdiği yükleri takip edin; depoya gelen yükleri aynı müşterinin bir aracına atayın; Lade Liste ve CMR belgelerini
sitede hazırlayın.

## Kurulum (bir kez)

1. Supabase > **SQL Editor**'de `nakliye-kurulumu.sql` dosyasının **tamamını** çalıştırın. En altta dört satır "tamam" görünmelidir.
2. Sitede soldaki menüden **Nakliye**'yi açın. (Yalnızca düzenleyici hesaplarda görünür.)

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
Giriş şifresi yoktur; bağlantıyı yalnızca ilgili kişiye verin.

- **Müşteri bağlantısı**: müşteri yalnızca kendi yüklerini görür; yeni yük yazar, depoya gelmeden önce düzenler ya da siler.
  Araca atanan yüklerin Lade Liste ve CMR belgelerini kendi sayfasından alır.
- **Depo bağlantısı**: depodaki arkadaşlar adlarını yazıp yük gelince **Geldi**'ye basar (yanlışsa **Geri al**). Geldi denen yük sizin
  **Boşta yükler** listenize düşer. **Araçlar** sekmesinde plaka bazında seferleri ve belgeleri görürler. Ekran 30 saniyede bir kendiliğinden yenilenir.
- **Yenile** yeni bir bağlantı üretir; eskisi o an çalışmaz olur. **Kapat** bağlantıyı silmeden durdurur.
- Bağlantı sayfaları herkese açıktır ama yalnızca bağlantıdaki anahtarla çalışır; anahtarlar tahmin edilemez uzunluktadır ve tablolara doğrudan erişim yoktur.

Belgeler açılan pencerede önizlenir; **Yazdır / PDF olarak kaydet** ile çıktı alınır (tarayıcının yazdırma penceresinde "PDF olarak kaydet" seçilebilir).
Belgeler tarayıcıda hazırlanır; sunucuya ya da başka bir siteye gönderilmez.
