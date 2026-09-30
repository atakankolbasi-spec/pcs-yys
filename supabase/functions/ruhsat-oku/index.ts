// Ruhsat fotoğrafını Google Gemini ile okuyan sunucu fonksiyonu.
//
// Site ("Ruhsattan ekle" ve WhatsApp'tan gelen fotoğraflar) fotoğrafı buraya gönderir; fonksiyon Gemini'ye
// okutur ve her ruhsat kartı için plaka, cins (çekici / dorse) ve boş ağırlığı döndürür.
//
// Google meşgulse ya da ücretsiz kullanımın dakikalık sınırı dolmuşsa fonksiyon pes etmez: aynı modeli kısa bir
// beklemeyle bir kez daha dener, olmazsa sırayla yedek modellere geçer (her modelin ayrı sınırı vardır). Hepsi
// doluysa 429 ile Gemini'nin "şu kadar saniye sonra dene" süresini (retry_after) siteye iletir; site o kadar
// bekleyip yeniden dener.
//
// Yalnızca siteye giriş yapmış DÜZENLEYİCİ (kullanıcının oturumu Supabase'e sorularak denetlenir) ya da
// Supabase'in kendi gizli anahtarıyla gelen sunucu çağrısı kullanabilir.
// Gizli ayarlar (Edge Functions > Secrets):
//   GEMINI_API_KEY  Google AI Studio'dan alınan anahtar (zorunlu)
//   GEMINI_MODEL    İsteğe bağlı model adı; boşsa "gemini-flash-latest"
// Kurulum: supabase/GEMINI.md. Tek dosyadır; Supabase panelinde düzenleyiciye yapıştırılarak kurulabilir.

const env = k => String(globalThis.Deno?.env.get(k) ?? '').trim();
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MAX_BYTES = 10 * 1024 * 1024;
// İstenen model olmazsa sırayla denenen yedekler. Adı artık olmayan model (404) atlanır.
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-lite-latest'];
// Supabase bir çağrıya 150 sn tanır; son deneme bunun içinde bitsin.
const BUDGET_MS = 120000;
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

const PROMPT = `This photo shows one or more vehicle registration certificates (Turkish "ruhsat", Bulgarian, Romanian,
Serbian, Montenegrin, Hungarian, Polish, etc.) of a truck and its trailer. For EACH registration certificate visible,
return one item in "vehicles":
- plate: the registration number from field (A) / "PLAKA" / "A", exactly as printed, with spaces and hyphens removed,
  in Latin capital letters (write Cyrillic look-alike letters as Latin: В=B, Е=E, К=K, М=M, Н=H, О=O, Р=P, С=C, Т=T, Х=X, А=A).
  Empty string if the plate is not on the visible side of the card.
- kind: "tractor" for a tractor unit / truck (ВЛЕКАЧ, TRACTOR, ÇEKİCİ, AUTOUTILITARA, AUTOTRACTOR, VUČNO VOZILO,
  CIĄGNIK SIODŁOWY, vehicle category N3), "trailer" for a semi-trailer / trailer (ПОЛУРЕМАРКЕ, SEMI-TRAILER, YARI RÖMORK,
  SEMIREMORCA, PRIKLJUČNO VOZILO, NACZEPA, category O4), otherwise "other".
- empty_weight_kg: the vehicle's own (empty) mass. On EU-format documents this is field "G". On Turkish documents it is
  "(G.1) NET AĞIRLIĞI" – never use "(G) KATAR AĞIRLIĞI" (combination weight) or "(F.1) AZAMİ YÜKLÜ AĞIRLIĞI". null if unsure.
- country: 2-letter country code of the document if known, else "".
Only use printed registration certificates. Ignore handwritten entry/exit log sheets, passports, stamps and other papers
in the background even if they contain plate numbers. Never guess: if a character or number is not clearly legible,
leave the field empty (plate "") or null (weight) and explain briefly in "problem" (e.g. glare, blur, cropped).
If no registration certificate is visible at all, return an empty "vehicles" list and explain in "problem".
Write "problem" in Turkish, one short sentence.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    vehicles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          plate: { type: 'STRING' },
          kind: { type: 'STRING', enum: ['tractor', 'trailer', 'other'] },
          empty_weight_kg: { type: 'INTEGER', nullable: true },
          country: { type: 'STRING' }
        },
        required: ['plate', 'kind']
      }
    },
    problem: { type: 'STRING' }
  },
  required: ['vehicles']
};

function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Çağıranın düzenleyici olduğunu Supabase'e sorar (kullanıcının kendi oturum anahtarıyla).
// Sonuç: 'ok' | 'hayir' | 'suresi-doldu' (oturum anahtarı geçersiz) | 'hata' (Supabase'e sorulamadı)
async function caller(req) {
  const auth = req.headers.get('authorization') || '', service = env('SUPABASE_SERVICE_ROLE_KEY');
  if (service && sameText(auth, `Bearer ${service}`)) return 'ok'; // Supabase'in kendi sunucu fonksiyonu
  const apikey = req.headers.get('apikey') || env('SUPABASE_ANON_KEY');
  if (!/^Bearer\s+\S+/i.test(auth) || !apikey) return 'hayir';
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/current_app_role`, {
    method: 'POST', headers: { apikey, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}'
  }).catch(() => null);
  if (!res || res.status >= 500) return 'hata';
  if (res.status === 401) return 'suresi-doldu';
  return res.ok && (await res.json().catch(() => '')) === 'editor' ? 'ok' : 'hayir';
}

async function gemini(model, mime, data, ms) {
  try {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
      }),
      signal: AbortSignal.timeout(ms)
    });
  } catch (e) {
    // zaman aşımı ya da bağlantı kopması: Google yoğun sayılır
    return new Response(JSON.stringify({ error: { message: String(e?.name || e) } }), { status: 504 });
  }
}

// Gemini'nin "şu kadar sonra dene" süresi (saniye): Retry-After başlığı ya da hata ayrıntısındaki retryDelay.
function retryAfter(res, text) {
  const h = Number(res.headers.get('retry-after'));
  if (h > 0) return Math.ceil(h);
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text);
  return m ? Math.ceil(Number(m[1])) : 0;
}

// Gemini cevabını sadeleştirir; anlaşılamazsa null.
async function parse(res, model) {
  const out = await res.json().catch(() => null);
  const text = out?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) {
    console.error('Gemini cevabı anlaşılamadı', model, out?.candidates?.[0]?.finishReason || '', text.slice(0, 300));
    return null;
  }
  const vehicles = (Array.isArray(parsed?.vehicles) ? parsed.vehicles : []).slice(0, 6).map(v => ({
    plate: String(v?.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
    kind: ['tractor', 'trailer'].includes(v?.kind) ? v.kind : 'other',
    empty_weight_kg: Number.isInteger(v?.empty_weight_kg) && v.empty_weight_kg >= 1000 && v.empty_weight_kg <= 20000 ? v.empty_weight_kg : null,
    country: String(v?.country || '').toUpperCase().slice(0, 3)
  }));
  return { vehicles, problem: String(parsed?.problem || '').slice(0, 300), model: out?.modelVersion || model };
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST gerekli' });
  if (!env('GEMINI_API_KEY')) return json(501, { error: 'GEMINI_API_KEY tanımlı değil' });
  const who = await caller(req);
  if (who === 'suresi-doldu') return json(401, { error: 'Oturum süresi dolmuş' });
  if (who === 'hata') return json(503, { error: 'Yetki kontrol edilemedi', reason: 'Supabase şu an cevap vermedi' });
  if (who !== 'ok') return json(403, { error: 'Bu işlem için düzenleyici girişi gerekli' });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return json(400, { error: 'Fotoğraf boş ya da 10 MB’tan büyük', fatal: true });
  const mime = (req.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) return json(400, { error: 'Desteklenmeyen dosya türü: ' + mime, fatal: true });

  const data = base64(bytes), start = Date.now(), left = () => BUDGET_MS - (Date.now() - start);
  const models = [...new Set([env('GEMINI_MODEL') || 'gemini-flash-latest', ...FALLBACK_MODELS])];
  const limits = [];
  let last = null, busy = false;
  for (const model of models) {
    for (let again = 0; again < 2 && left() > 15000; again++) {
      const res = await gemini(model, mime, data, Math.min(60000, left()));
      if (res.ok) {
        const out = await parse(res, model);
        if (out) return json(200, out);
        last = { status: 502, error: 'Gemini cevabı anlaşılamadı' };
        busy = true;
        break; // başka modelle dene
      }
      const text = await res.text().catch(() => '');
      console.error('Gemini hatası', model, res.status, text.slice(0, 400));
      last = { status: res.status, error: `Gemini ${res.status}`, detail: text.slice(0, 400) };
      if (res.status === 429) { limits.push({ after: retryAfter(res, text), daily: /PerDay/i.test(text) }); break; }
      if (res.status >= 500) { busy = true; if (!again) { await sleep(1500); continue; } break; }
      if (res.status === 404) break; // bu adla model yok
      // 400 / 401 / 403: anahtar geçersiz, izin yok ya da fotoğraf kabul edilmedi; beklemekle düzelmez
      const key = /API_KEY|API key/i.test(text) || res.status === 401 || res.status === 403;
      return json(502, { ...last, fatal: true, reason: key ? 'Gemini anahtarı (GEMINI_API_KEY) geçersiz ya da yetkisiz' : 'Gemini bu fotoğrafı kabul etmedi' });
    }
  }
  if (limits.length) {
    // Her modelin dakikalık ya da günlük sınırı dolu. Günlük sınır dolduysa bugün beklemenin anlamı yok.
    const daily = !busy && limits.every(l => l.daily), after = Math.min(...limits.map(l => l.after || 60));
    return json(429, {
      error: 'Gemini 429', retry_after: daily ? 0 : after, daily, fatal: daily, detail: last?.detail || '',
      reason: daily ? 'Gemini’nin günlük ücretsiz sınırı doldu (Türkiye saatiyle 10:00–11:00 arasında sıfırlanır)' : 'Gemini ücretsiz kullanım sınırı doldu'
    });
  }
  return json(502, last || { error: 'Gemini okuyamadı' });
}

if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
