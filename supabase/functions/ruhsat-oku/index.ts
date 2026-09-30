// Ruhsat fotoğrafını Google Gemini ile okuyan sunucu fonksiyonu.
//
// Site ("Ruhsattan ekle" ve WhatsApp'tan gelen fotoğraflar) fotoğrafı buraya gönderir; fonksiyon Gemini'ye
// okutur ve her ruhsat kartı için plaka, cins (çekici / dorse) ve boş ağırlığı döndürür. Gemini
// kurulmamışsa ya da okuyamazsa site eskisi gibi fotoğrafı kendi bilgisayarında okur.
//
// Yalnızca siteye giriş yapmış DÜZENLEYİCİ çağırabilir (kullanıcının oturumu Supabase'e sorularak denetlenir).
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

// Çağıranın düzenleyici olduğunu Supabase'e sorar (kullanıcının kendi oturum anahtarıyla).
async function isEditor(req) {
  const auth = req.headers.get('authorization') || '', apikey = req.headers.get('apikey') || env('SUPABASE_ANON_KEY');
  if (!/^Bearer\s+\S+/i.test(auth) || !apikey) return false;
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/current_app_role`, {
    method: 'POST', headers: { apikey, Authorization: auth, 'Content-Type': 'application/json' }, body: '{}'
  }).catch(() => null);
  return !!res && res.ok && (await res.json().catch(() => '')) === 'editor';
}

async function gemini(model, mime, data) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA }
    })
  });
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST gerekli' });
  if (!env('GEMINI_API_KEY')) return json(501, { error: 'GEMINI_API_KEY tanımlı değil' });
  if (!(await isEditor(req))) return json(403, { error: 'Bu işlem için düzenleyici girişi gerekli' });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return json(400, { error: 'Fotoğraf boş ya da 10 MB’tan büyük' });
  const mime = (req.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) return json(400, { error: 'Desteklenmeyen dosya türü: ' + mime });

  const wanted = env('GEMINI_MODEL') || 'gemini-flash-latest';
  let res = await gemini(wanted, mime, base64(bytes));
  // model adı bulunamazsa (Google adları değiştirebiliyor) bilinen bir modelle bir kez daha dene
  if (res.status === 404 && wanted !== 'gemini-2.5-flash') res = await gemini('gemini-2.5-flash', mime, base64(bytes));
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 400);
    console.error('Gemini hatası', res.status, detail);
    // 429: ücretsiz kullanım sınırı doldu; site bu fotoğrafı kendisi okur
    return json(res.status === 429 ? 429 : 502, { error: `Gemini ${res.status}`, detail });
  }
  const out = await res.json();
  const text = out?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) {
    console.error('Gemini cevabı anlaşılamadı', text.slice(0, 300));
    return json(502, { error: 'Gemini cevabı anlaşılamadı' });
  }
  const vehicles = (Array.isArray(parsed?.vehicles) ? parsed.vehicles : []).slice(0, 6).map(v => ({
    plate: String(v?.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
    kind: ['tractor', 'trailer'].includes(v?.kind) ? v.kind : 'other',
    empty_weight_kg: Number.isInteger(v?.empty_weight_kg) && v.empty_weight_kg >= 1000 && v.empty_weight_kg <= 20000 ? v.empty_weight_kg : null,
    country: String(v?.country || '').toUpperCase().slice(0, 3)
  }));
  return json(200, { vehicles, problem: String(parsed?.problem || '').slice(0, 300), model: out?.modelVersion || wanted });
}

if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
