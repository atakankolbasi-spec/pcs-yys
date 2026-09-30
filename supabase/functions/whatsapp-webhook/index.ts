// WhatsApp'tan gelen ruhsat fotoğraflarını alan sunucu fonksiyonu (Supabase Edge Function).
// Kurulum adımları: supabase/WHATSAPP.md
//
// Meta, WhatsApp numarasına her mesaj geldiğinde bu adrese haber verir. Fonksiyon:
//   1. İsteğin gerçekten Meta'dan geldiğini imzadan doğrular (WA_APP_SECRET).
//   2. Fotoğrafı WhatsApp'tan indirip "ruhsat-gelen" deposuna koyar.
//   3. incoming_ruhsat tablosuna bir satır ekler. Fotoğrafı panonun açık olduğu bilgisayar okur ve
//      "Ruhsattan ekle" penceresinde onaya bırakır; hiçbir araç sorulmadan panoya eklenmez.
//   4. Fotoğrafa ✅ ile tepki verir; fotoğraf dışı mesajlara ne gönderileceğini yazar
//      (WA_REPLY=kapali ile kapatılır).
//   5. 60 günden eski fotoğrafları depodan siler (WA_KEEP_DAYS ile değişir); okunan bilgiler kalır.
//
// Dışarıdan paket kullanmaz ve tek dosyadır: Supabase panelindeki düzenleyiciye olduğu gibi
// yapıştırılabilir. Kod bilerek düz JavaScript yazıldı; testler Node'da da çalıştırabiliyor.
//
// Gerekli gizli ayarlar (Supabase > Edge Functions > Secrets):
//   WA_VERIFY_TOKEN  Meta'da webhook tanımlarken yazacağınız, kendi belirlediğiniz parola
//   WA_APP_SECRET    Meta uygulamasının "App secret" değeri
//   WA_TOKEN         WhatsApp'a erişim anahtarı (kalıcı "System user" anahtarı)
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından kendiliğinden verilir.

const BUCKET = 'ruhsat-gelen';
const TABLE = 'incoming_ruhsat';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' };
const HELP = 'Bu numara araç ruhsatı fotoğraflarını otomatik olarak sisteme aktarır. Lütfen çekici ve dorse ruhsatının fotoğrafını gönderin.';
const HELP_FILE = 'Bu dosya okunamıyor. Lütfen ruhsatı fotoğraf (resim) olarak gönderin.';

const env = k => String(globalThis.Deno?.env.get(k) ?? '').trim();
const graph = path => `https://graph.facebook.com/${env('WA_GRAPH_VERSION') || 'v23.0'}/${path}`;
const repliesOff = () => /^(0|hayir|hayır|kapali|kapalı|off|false|no)$/i.test(env('WA_REPLY'));

function supabase(path, init = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(env('SUPABASE_URL') + path, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) } });
}

async function must(res, what) {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  return res;
}

// Meta her isteği uygulama anahtarıyla imzalar (X-Hub-Signature-256). İmzası tutmayan istek reddedilir;
// böylece adresi bilen başka biri sisteme sahte kayıt ekleyemez.
async function signatureOk(raw, header) {
  const secret = env('WA_APP_SECRET');
  if (!secret) { console.error('WA_APP_SECRET tanımlı değil; istekler doğrulanamıyor.'); return false; }
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header || '');
  if (!m) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = new Uint8Array(m[1].match(/../g).map(h => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', key, sig, raw);
}

async function send(phoneId, message) {
  if (!phoneId || !message.to || repliesOff()) return;
  try {
    const res = await fetch(graph(`${phoneId}/messages`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WA_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...message })
    });
    if (!res.ok) console.error('WhatsApp cevabı gönderilemedi:', res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.error('WhatsApp cevabı gönderilemedi:', e?.message || e);
  }
}

async function saveImage(msg, media, contact, phoneId) {
  const id = String(msg.id || '');
  if (!id) return;
  // Meta aynı bildirimi tekrar gönderebilir; kaydedilmiş mesaj ikinci kez eklenmez.
  const seen = await must(await supabase(`/rest/v1/${TABLE}?select=id&wa_message_id=eq.${encodeURIComponent(id)}`), 'Kayıt kontrolü');
  if ((await seen.json()).length) return;

  const token = env('WA_TOKEN');
  const info = await (await must(await fetch(graph(encodeURIComponent(media.id)), { headers: { Authorization: `Bearer ${token}` } }), 'Fotoğraf bilgisi alınamadı')).json();
  const file = await must(await fetch(info.url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'pcs-yys-whatsapp/1.0' } }), 'Fotoğraf indirilemedi');
  const mime = String(info.mime_type || media.mime_type || 'image/jpeg').split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const sentAt = new Date((Number(msg.timestamp) || Date.now() / 1000) * 1000);
  const path = `${sentAt.toISOString().slice(0, 10)}/${id.replace(/[^A-Za-z0-9_-]/g, '_')}.${EXT[mime] || 'jpg'}`;
  await must(await supabase(`/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'true' }, body: bytes
  }), 'Fotoğraf depoya kaydedilemedi');

  await must(await supabase(`/rest/v1/${TABLE}?on_conflict=wa_message_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      wa_message_id: id,
      from_number: String(msg.from || '').replace(/\D/g, ''),
      sender_name: String(contact?.profile?.name || '').slice(0, 200),
      caption: String(media.caption || '').slice(0, 1000),
      media_path: path,
      mime,
      created_at: sentAt.toISOString()
    })
  }), 'Kayıt eklenemedi');

  await send(phoneId, { to: msg.from, type: 'reaction', reaction: { message_id: id, emoji: '✅' } });
}

async function handleMessage(msg, contact, phoneId) {
  const media = msg.type === 'image' ? msg.image
    : msg.type === 'document' && /^image\//i.test(msg.document?.mime_type || '') ? msg.document : null;
  if (media?.id) return saveImage(msg, media, contact, phoneId);
  if (msg.type === 'text' || msg.type === 'video' || msg.type === 'audio') await send(phoneId, { to: msg.from, type: 'text', text: { body: HELP } });
  else if (msg.type === 'document') await send(phoneId, { to: msg.from, type: 'text', text: { body: HELP_FILE } });
}

// Eski fotoğrafları siler (her çağrıda en fazla 50 tane). Okunan plaka ve ağırlıklar tabloda kalır.
async function cleanup() {
  const days = Math.max(7, Number(env('WA_KEEP_DAYS')) || 60);
  const before = new Date(Date.now() - days * 86400000).toISOString();
  const res = await must(await supabase(`/rest/v1/${TABLE}?select=id,media_path&media_path=not.is.null&created_at=lt.${encodeURIComponent(before)}&order=created_at&limit=50`), 'Eski fotoğraflar listelenemedi');
  const rows = await res.json();
  if (!rows.length) return;
  await must(await supabase(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: rows.map(r => r.media_path) })
  }), 'Eski fotoğraflar silinemedi');
  await must(await supabase(`/rest/v1/${TABLE}?id=in.(${rows.map(r => r.id).join(',')})`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ media_path: null })
  }), 'Kayıtlar güncellenemedi');
}

export async function handle(req) {
  const url = new URL(req.url);
  // Meta webhook'u tanımlarken bir kez GET ile doğrular: parola tutarsa verdiği sayıyı geri döneriz.
  if (req.method === 'GET') {
    const token = env('WA_VERIFY_TOKEN');
    const ok = token && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === token;
    return ok ? new Response(url.searchParams.get('hub.challenge') || '', { status: 200 }) : new Response('Doğrulama başarısız', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('Yalnızca GET ve POST', { status: 405 });

  const raw = new Uint8Array(await req.arrayBuffer());
  if (!(await signatureOk(raw, req.headers.get('x-hub-signature-256')))) return new Response('İmza geçersiz', { status: 401 });
  let body;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch (_) { return new Response('Geçersiz istek', { status: 400 }); }

  let failed = 0, messages = 0;
  for (const entry of body?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      const value = change.value || {};
      const phoneId = value.metadata?.phone_number_id;
      for (const msg of value.messages || []) {
        messages++;
        const contact = (value.contacts || []).find(c => c.wa_id === msg.from) || (value.contacts || [])[0];
        try { await handleMessage(msg, contact, phoneId); } catch (e) { failed++; console.error('Mesaj işlenemedi:', msg.id, e?.message || e); }
      }
    }
  }
  if (messages) await cleanup().catch(e => console.error(e?.message || e));
  // Hata olursa 500 döneriz; Meta aynı bildirimi bir süre sonra yeniden gönderir.
  return failed ? new Response('Bazı mesajlar işlenemedi', { status: 500 }) : new Response('ok');
}

if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
