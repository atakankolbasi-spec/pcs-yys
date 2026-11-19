// Nakliye bildirimlerini WhatsApp'tan müşteriye gönderen sunucu fonksiyonu (Supabase Edge Function).
// Kurulum adımları: supabase/NAKLIYE.md > "Otomatik bildirim".
//
// Nasıl çalışır:
//   1. Depoda "Geldi", araç "Yola çıktı", sefer "Teslim edildi", depoda eksik/hasar ya da ofisin müşteriye yazdığı mesaj gibi
//      bir olay olunca veritabanı (nakliye-kurulumu.sql) shp_outbox tablosuna bir haber ekler ve bu fonksiyonu çağırır.
//      Haber yalnızca müşteri bildirim numarasını yazmış ve o haberi açık bırakmışsa eklenir.
//   2. Fonksiyon birkaç saniye bekler (aynı anda gelen birkaç yük tek mesajda birleşsin), bekleyen haberleri alır ve
//      müşterinin kendi yazdığı numaraya WhatsApp Cloud API ile gönderir. Aynı müşteri ve aynı tür haberler tek mesaj olur.
//   3. Sonucu tabloya yazar: gonderildi ya da hata (nedeniyle). Gönderilemeyenler ofiste Nakliye > Bildirimler sekmesinde
//      kalır ve oradan elle gönderilebilir. Gizli ayarlar eksikse hiçbir şey yapılmaz, haberler bekler.
//   Adresi tarayıcıda "...?bekle=0" ile açarsanız beklemeden çalışır ve sonucu yazar (deneme için).
//
// Dışarıdan paket kullanmaz ve tek dosyadır: Supabase panelindeki düzenleyiciye olduğu gibi yapıştırılabilir.
// Kod bilerek düz JavaScript yazıldı; testler Node'da da çalıştırabiliyor.
//
// Gerekli gizli ayarlar (Supabase > Edge Functions > Secrets):
//   WA_TOKEN      WhatsApp'a erişim anahtarı (whatsapp-webhook için zaten tanımlı)
//   WA_PHONE_ID   WhatsApp telefon numarası kimliği (Meta > WhatsApp > API Setup sayfasında "Phone number ID")
//   WA_SABLON     İsteğe bağlı ama pratikte gerekli: Meta'da onaylı şablon adı (tek gövde değişkeni {{1}}). Müşteri son 24 saatte
//                 numaranıza yazmadıysa Meta yalnızca onaylı şablon mesajına izin verir.
//   WA_SABLON_DIL İsteğe bağlı: şablon dili (varsayılan tr)
//   WA_BEKLE      İsteğe bağlı: birleştirme için bekleme saniyesi (varsayılan 8)
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase tarafından kendiliğinden verilir.

const BASLIK = { geldi: '📦 Yükünüz depoya geldi', yola: '🚚 Aracınız yola çıktı', teslim: '✅ Yükünüz teslim edildi', sorun: '⚠️ Yükünüzde sorun bildirildi', mesaj: '💬 Ofisten yeni mesaj' };
const TAKIP_MS = 10 * 60 * 1000;   // "gonderiliyor" durumunda bu süreden uzun kalan haber (fonksiyon yarıda kesildi) yeniden denenir
const LIMIT = 100;                 // bir çalışmada en çok bu kadar haber

const env = k => String(globalThis.Deno?.env.get(k) ?? '').trim();
const graph = path => `https://graph.facebook.com/${env('WA_GRAPH_VERSION') || 'v23.0'}/${path}`;
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

// Cevap döndükten sonra arka planda süren iş. Supabase'de EdgeRuntime.waitUntil işin bitmesini bekletir; testler idle() ile bekler.
const background = new Set();
function later(promise) {
  const task = promise.catch(e => console.error('Bildirim gönderimi yarım kaldı:', e?.message || e)).finally(() => background.delete(task));
  background.add(task);
  globalThis.EdgeRuntime?.waitUntil?.(task);
}
export const idle = () => Promise.all([...background]);

function supabase(path, init = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(env('SUPABASE_URL') + path, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.headers || {}) } });
}

// Telefon yazısından WhatsApp numarası: 0532… → 90532…, +90 532… → 90532…, 532… → 90532…
export function numara(tel) {
  let d = String(tel || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '90' + d.slice(1); else if (d.length === 10 && d[0] === '5') d = '90' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}
// Aynı müşteri + haber türü + numara tek mesaj olur
export function grupla(rows) {
  const m = new Map();
  for (const o of rows) { const k = `${o.customer_id}|${o.event}|${o.phone}`; if (!m.has(k)) m.set(k, { customer_id: o.customer_id, event: o.event, phone: o.phone, items: [] }); m.get(k).items.push(o); }
  return [...m.values()];
}
// Ofisteki "WhatsApp'ta gönder" ve müşteri sayfasındaki örnek mesajla aynı metin
export const metin = g => `${BASLIK[g.event] || '🔔 Nakliye haberi'}\n${g.items.map(o => o.body).join('\n')}${g.event === 'yola' ? '\nLade Liste ve CMR belgeleriniz hazır.' : ''}`;
// Şablon değişkeni satır sonu ve art arda boşluk kabul etmez
export const sablonMetni = t => t.replace(/\s*\n+\s*/g, ' | ').replace(/ {2,}/g, ' ').slice(0, 1000);

export function govde(g) {
  const to = numara(g.phone), text = metin(g), sablon = env('WA_SABLON');
  if (sablon) return { messaging_product: 'whatsapp', to, type: 'template', template: { name: sablon, language: { code: env('WA_SABLON_DIL') || 'tr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: sablonMetni(text) }] }] } };
  return { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text.slice(0, 4000) } };
}

// Meta'nın hata cevabını ofisin anlayacağı bir cümleye çevirir
export function hataMetni(status, raw) {
  let code = 0, msg = '';
  try { const e = JSON.parse(raw).error || {}; code = Number(e.code) || 0; msg = String(e.message || ''); } catch (_) { msg = String(raw || ''); }
  const ipucu = code === 131047 || code === 131026 ? ' — Müşteri son 24 saatte numaranıza yazmadı: onaylı şablon gerekir (WA_SABLON).'
    : code === 132001 ? ' — Şablon bulunamadı: WA_SABLON adını ve dilini (WA_SABLON_DIL) kontrol edin.'
    : code === 132000 || code === 132012 ? ' — Şablon değişkeni kabul edilmedi.'
    : code === 190 || status === 401 ? ' — Erişim anahtarı geçersiz (WA_TOKEN).'
    : code === 100 && /phone/i.test(msg) ? ' — Telefon numarası kimliği (WA_PHONE_ID) yanlış olabilir.' : '';
  return `WhatsApp ${status}${code ? ` (${code})` : ''}: ${msg.replace(/\s+/g, ' ').slice(0, 160)}${ipucu}`.slice(0, 400);
}

async function sonucuYaz(ids, durum) {
  const res = await supabase(`/rest/v1/shp_outbox?id=in.(${ids.join(',')})`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(durum) });
  if (!res.ok) console.error('Sonuç yazılamadı:', res.status, (await res.text().catch(() => '')).slice(0, 200));
}

// Bekleyen haberleri alır ve gönderir. bekle: birleştirme için beklenecek saniye (verilmezse WA_BEKLE ya da 8).
export async function flush({ bekle } = {}) {
  const token = env('WA_TOKEN'), phoneId = env('WA_PHONE_ID');
  if (!token || !phoneId) { console.log('WA_TOKEN / WA_PHONE_ID tanımlı değil: haberler gönderilmedi, ofisteki Bildirimler sekmesinde bekliyor.'); return { sent: 0, failed: 0, ayar: 'eksik' }; }
  const w = bekle != null ? Number(bekle) : env('WA_BEKLE') !== '' && Number(env('WA_BEKLE')) >= 0 ? Number(env('WA_BEKLE')) : 8;
  if (w > 0) await sleep(w * 1000);
  // bekleyenler + yarıda kalmış (uzun süredir "gonderiliyor") olanlar
  const filtre = `(status.eq.bekliyor,and(status.eq.gonderiliyor,sent_at.lt.${new Date(Date.now() - TAKIP_MS).toISOString()}))`;
  const list = await supabase(`/rest/v1/shp_outbox?select=id&or=${encodeURIComponent(filtre)}&order=id&limit=${LIMIT}`);
  if (!list.ok) throw new Error(`Kuyruk okunamadı: ${list.status} ${(await list.text().catch(() => '')).slice(0, 200)}`);
  const ids = (await list.json()).map(x => x.id);
  if (!ids.length) return { sent: 0, failed: 0 };
  // Haberleri "al": aynı anda çalışan başka bir çağrı aynı haberi ikinci kez göndermesin (yalnızca bu çağrının aldıkları döner)
  const claim = await supabase(`/rest/v1/shp_outbox?or=${encodeURIComponent(filtre)}&id=in.(${ids.join(',')})`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'gonderiliyor', sent_at: new Date().toISOString(), error: '' }) });
  if (!claim.ok) throw new Error(`Haberler alınamadı: ${claim.status} ${(await claim.text().catch(() => '')).slice(0, 200)}`);
  const rows = (await claim.json()).sort((a, b) => a.id - b.id);
  let sent = 0, failed = 0;
  for (const g of grupla(rows)) {
    const gids = g.items.map(o => o.id);
    let durum = { status: 'gonderildi', sent_at: new Date().toISOString(), error: '' };
    if (!numara(g.phone)) durum = { status: 'hata', sent_at: null, error: 'Telefon numarası geçersiz' };
    else {
      try {
        const res = await fetch(graph(`${phoneId}/messages`), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(govde(g)) });
        if (!res.ok) durum = { status: 'hata', sent_at: null, error: hataMetni(res.status, await res.text().catch(() => '')) };
      } catch (e) { durum = { status: 'hata', sent_at: null, error: `Bağlantı hatası: ${String(e?.message || e).slice(0, 200)}` }; }
    }
    if (durum.status === 'gonderildi') sent++; else { failed++; console.error(`Bildirim gönderilemedi (müşteri ${g.customer_id}, ${g.event}):`, durum.error); }
    await sonucuYaz(gids, durum);
  }
  return { sent, failed };
}

export async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  const bekle = new URL(req.url).searchParams.get('bekle');
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
  // Deneme: ?bekle=0 beklemeden çalışır ve sonucu yazar
  if (bekle !== null && bekle !== '') {
    try { return json(await flush({ bekle: Math.max(0, Math.min(30, Number(bekle) || 0)) })); } catch (e) { return json({ hata: String(e?.message || e) }, 500); }
  }
  // Normal çağrı (veritabanından): hemen cevap ver, gönderimi arka planda yap
  later(flush());
  return json({ ok: true }, 202);
}

if (globalThis.Deno?.serve) globalThis.Deno.serve(handle);
