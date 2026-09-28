// PCS TRANSIT YYS - Asistan (Supabase Edge Function).
// Tarayıcı ile Claude arasında aracıdır: Anthropic API anahtarı yalnızca burada, sunucuda durur.
// Yalnızca giriş yapmış kullanıcılar çağırabilir. Sistem talimatı ve araç listesi burada sabittir;
// tarayıcı yalnızca konuşma geçmişini gönderir. Araçları (veri okuma / kayıt değiştirme) tarayıcı
// çalıştırır; kayıt değiştirme her zaman kullanıcı onayıyla ve kullanıcının kendi yetkisiyle yapılır.
import Anthropic from "npm:@anthropic-ai/sdk@^0.128.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";
const ALLOWED_ORIGINS = new Set([
  "https://atakankolbasi-spec.github.io",
  "http://localhost:4173",
]);
const MAX_BODY_BYTES = 400_000; // konuşma geçmişi için üst sınır
const MAX_MESSAGES = 60;

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY ortam değişkeninden (Supabase secret)

const TOOLS: Anthropic.Tool[] = [
  {
    name: "gelisleri_ara",
    description:
      "Araç gelişlerini (ziyaretlerini) arar. Plaka, müşteri, nakliyeci veya beyanname metniyle ve tarih aralığı / durumla süzülebilir. " +
      "Her gelişin kimliği (id), plaka, müşteri, tarih, saat, beyanname, nakliyeci, ruhsat, not ve durum kutuları (tesiste, t1, bitti) döner. " +
      "Durum değiştirmek için gereken id buradan alınır.",
    input_schema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "Plaka, müşteri, nakliyeci veya beyannamede geçen metin. Boş bırakılabilir." },
        baslangic: { type: "string", description: "İlk tarih, YYYY-AA-GG. Boş bırakılabilir." },
        bitis: { type: "string", description: "Son tarih, YYYY-AA-GG. Boş bırakılabilir." },
        durum: { type: "string", enum: ["hepsi", "bekleyen", "biten"], description: "bekleyen = işlemleri bitmemiş." },
      },
      required: ["metin", "baslangic", "bitis", "durum"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "ozet",
    description:
      "Bir tarih aralığındaki gelişlerin sayısal özetini verir: toplam, tesiste, T1 yazıldı, bitti, bekleyen, tamamlanma yüzdesi; " +
      "ayrıca müşteri bazlı ve gün bazlı dağılım. Günlük / haftalık rapor için kullanın.",
    input_schema: {
      type: "object",
      properties: {
        baslangic: { type: "string", description: "İlk tarih, YYYY-AA-GG." },
        bitis: { type: "string", description: "Son tarih, YYYY-AA-GG." },
      },
      required: ["baslangic", "bitis"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "plaka_kayitlari",
    description:
      "Kayıtlı plakaları (ana plaka kayıtları) arar: plaka, müşteri, beyanname, nakliyeci, ruhsat. Yeni geliş eklerken müşteriyi bulmak için de kullanılır.",
    input_schema: {
      type: "object",
      properties: {
        metin: { type: "string", description: "Plaka veya müşteri adında geçen metin." },
      },
      required: ["metin"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "durum_guncelle",
    description:
      "Bir gelişin durum kutularını değiştirir (tesiste, t1, bitti). Değiştirilmeyecek kutu için null verin. " +
      "Kullanıcıya bir onay kartı gösterilir; kullanıcı onaylamazsa değişiklik yapılmaz. Önce gelisleri_ara ile doğru gelişin id'sini bulun.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Gelişin id'si (gelisleri_ara sonucundan)." },
        tesiste: { type: ["boolean", "null"] },
        t1: { type: ["boolean", "null"] },
        bitti: { type: ["boolean", "null"] },
      },
      required: ["id", "tesiste", "t1", "bitti"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "gelis_ekle",
    description:
      "Yeni araç gelişi ekler. Plaka kayıtlıysa müşteri, beyanname, nakliyeci ve ruhsat kayıttan otomatik gelir; kayıtlı değilse müşteri zorunludur. " +
      "Tarih Pazartesi–Cumartesi olmalı (Pazar olamaz). Kullanıcıya bir onay kartı gösterilir; onaylamazsa kayıt yapılmaz.",
    input_schema: {
      type: "object",
      properties: {
        plaka: { type: "string" },
        tarih: { type: "string", description: "YYYY-AA-GG" },
        saat: { type: "string", description: "SS:DD; bilinmiyorsa boş." },
        musteri: { type: "string", description: "Plaka kayıtlıysa boş bırakılabilir." },
        not: { type: "string", description: "İsteğe bağlı operasyon notu; yoksa boş." },
      },
      required: ["plaka", "tarih", "saat", "musteri", "not"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function systemPrompt(today: string): string {
  return `Sen PCS TRANSİT YYS araç operasyon panosunun asistanısın. Bir gümrük / transit tesisinde çalışan operasyon ekibine yardım ediyorsun.
Bugünün tarihi: ${today} (Europe/Istanbul). Çalışma günleri Pazartesi–Cumartesi; Pazar günü kayıt olmaz.

Panodaki kavramlar:
- Plaka kaydı: bir aracın ana bilgileri (müşteri, beyanname, nakliyeci, ruhsat/kg).
- Geliş: bir aracın belirli bir gündeki tesise gelişi. Her gelişin üç bağımsız durum kutusu vardır: TESİSTE, T1 YAZILDI, İŞLEMLER BİTTİ.
- Bekleyen: işlemleri bitmemiş geliş.

Kurallar:
- Türkçe, kısa ve net cevap ver. Kullanıcı çoğu zaman sahada, telefondan ya da sesli soruyor.
- Sayıları ve plakaları araçlardan aldığın verilere dayandır; tahmin etme. Veri yoksa bunu söyle.
- Kayıt değiştirmeden önce doğru kaydı bul. Birden fazla eşleşme varsa hangisi olduğunu kullanıcıya sor.
- Değişiklik araçları kullanıcıya onay kartı gösterir; kullanıcı reddederse ısrar etme.
- Markdown başlıkları ve tablo kullanma; gerekirse kısa madde işaretleri ve **kalın** yeterli.`;
}

function istanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://atakankolbasi-spec.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "Yalnızca POST." }, 405, headers);

  // Oturum kontrolü: yalnızca panoya giriş yapmış kullanıcılar.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Giriş yapmanız gerekiyor." }, 401, headers);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "Oturum geçersiz. Yeniden giriş yapın." }, 401, headers);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "Konuşma çok uzadı. Yeni bir konuşma başlatın." }, 413, headers);
  let messages: Anthropic.MessageParam[];
  try {
    messages = JSON.parse(raw).messages;
  } catch {
    return json({ error: "Geçersiz istek." }, 400, headers);
  }
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES ||
      messages.some((m) => m?.role !== "user" && m?.role !== "assistant")) {
    return json({ error: "Konuşma geçersiz ya da çok uzun. Yeni bir konuşma başlatın." }, 400, headers);
  }

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" }, // sohbet: hızlı cevap için orta düzey
      system: [{ type: "text", text: systemPrompt(istanbulToday()), cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      // Güvenlik sınıflandırıcısı bir isteği reddederse Anthropic'in önerdiği modelle yeniden dener.
      fallbacks: "default",
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);
    return json({ content: response.content, stop_reason: response.stop_reason }, 200, headers);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Asistan şu an yoğun. Biraz sonra tekrar deneyin." }, 429, headers);
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API anahtarı geçersiz veya eksik.");
      return json({ error: "Asistan yapılandırılmamış (API anahtarı). Yöneticiye bildirin." }, 500, headers);
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error("Anthropic 400:", e.message);
      if (/credit balance/i.test(e.message)) {
        return json({ error: "Anthropic API bakiyesi yetersiz. Yönetici console.anthropic.com → Billing sayfasından bakiye yüklemeli." }, 402, headers);
      }
      // Anthropic'in hata açıklaması gizli bilgi içermez; sorunu bulmayı kolaylaştırmak için iletilir.
      return json({ error: "Konuşma işlenemedi. Yeni bir konuşma başlatın.", detay: e.message }, 400, headers);
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic hata:", e.status, e.message);
      return json({ error: "Asistana ulaşılamadı. Biraz sonra tekrar deneyin." }, 502, headers);
    }
    console.error(e);
    return json({ error: "Beklenmeyen bir hata oluştu." }, 500, headers);
  }
});
