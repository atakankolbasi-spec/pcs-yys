/* PCS TRANSİT YYS · Nakliye bildirimlerini WhatsApp'tan göndermek (isteğe bağlı otomatik gönderim).
 * GitHub Actions'ta 5 dakikada bir çalışır (.github/workflows/bildirim-gonder.yml):
 *   1. shp_outbox tablosundaki bekleyen haberleri (depoya geldi, yola çıktı, teslim, sorun, ofis mesajı) okur.
 *   2. Aynı müşteri ve aynı haber türündekileri tek mesajda birleştirir.
 *   3. WhatsApp Cloud API ile müşterinin kendi yazdığı numaraya gönderir; sonucu tabloya yazar (gonderildi / hata).
 * Gerekli gizli değerler: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WA_TOKEN, WA_PHONE_ID.
 * İsteğe bağlı: WA_SABLON (Meta'da onaylı şablon adı; tek gövde değişkeni alır), WA_SABLON_DIL (varsayılan tr), WA_GRAPH_VERSION.
 * Eksik gizli değer varsa hiçbir şey yapmadan biter (bildirimler ofiste "WhatsApp'ta gönder" ile elle gönderilir).
 * Not: Meta, müşteri sizinle son 24 saat içinde yazışmadıysa yalnızca onaylı şablon mesajına izin verir; şablon yoksa o mesajlar "hata"
 * olarak işaretlenir ve ofisteki Bildirimler sekmesinde elle gönderilmeyi bekler.
 * Deneme için: BILDIRIM_VERI (JSON dosyası: bekleyen satırlar), BILDIRIM_KURU=1 (gönderme, yalnızca yaz). */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BASLIK = { geldi: '📦 Yükünüz depoya geldi', yola: '🚚 Aracınız yola çıktı', teslim: '✅ Yükünüz teslim edildi', sorun: '⚠️ Yükünüzde sorun bildirildi', mesaj: '💬 Ofisten yeni mesaj' };

/* Telefon yazısından WhatsApp numarası: 0532… → 90532…, +90 532… → 90532…, 532… → 90532… */
export function numara(tel) {
  let d = String(tel || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '90' + d.slice(1); else if (d.length === 10 && d[0] === '5') d = '90' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
}
/* Aynı müşteri + haber türü + numara tek mesaj olur */
export function grupla(satirlar) {
  const m = new Map();
  for (const o of satirlar) { const k = `${o.customer_id}|${o.event}|${o.phone}`; if (!m.has(k)) m.set(k, { customer_id: o.customer_id, event: o.event, phone: o.phone, items: [] }); m.get(k).items.push(o); }
  return [...m.values()];
}
export const metin = g => `${BASLIK[g.event] || '🔔 Nakliye haberi'}\n${g.items.map(o => o.body).join('\n')}${g.event === 'yola' ? '\nLade Liste ve CMR belgeleriniz hazır.' : ''}`;
/* Şablon değişkeni satır sonu ve art arda boşluk kabul etmez */
export const sablonMetni = t => t.replace(/\s*\n+\s*/g, ' | ').replace(/ {2,}/g, ' ').slice(0, 1000);

export function govde(g, env) {
  const to = numara(g.phone), text = metin(g);
  if (env.WA_SABLON) return { messaging_product: 'whatsapp', to, type: 'template', template: { name: env.WA_SABLON, language: { code: env.WA_SABLON_DIL || 'tr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: sablonMetni(text) }] }] } };
  return { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text.slice(0, 4000) } };
}

async function calistir(env = process.env, fetchFn = fetch) {
  const URL_ = (env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const kuru = env.BILDIRIM_KURU === '1';
  if (!env.BILDIRIM_VERI && (!URL_ || !KEY)) { console.log('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil: otomatik bildirim kapalı.'); return 0; }
  if (!kuru && !(env.WA_TOKEN && env.WA_PHONE_ID)) { console.log('WA_TOKEN / WA_PHONE_ID tanımlı değil: otomatik bildirim kapalı (ofiste elle gönderilir).'); return 0; }
  const sb = (yol, init = {}) => fetchFn(`${URL_}/rest/v1/${yol}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal', ...(init.headers || {}) } });
  let satirlar;
  if (env.BILDIRIM_VERI) satirlar = JSON.parse(fs.readFileSync(env.BILDIRIM_VERI, 'utf8'));
  else {
    const r = await sb('shp_outbox?status=eq.bekliyor&order=id&limit=200', { headers: { Prefer: '' } });
    if (!r.ok) { console.log('Kuyruk okunamadı:', r.status, (await r.text()).slice(0, 200)); return 1; }
    satirlar = await r.json();
  }
  // Çok yeni haberler (1 dk) biraz beklesin: aynı anda gelen yükler tek mesaja birleşsin
  const eski = satirlar.filter(o => !o.created_at || Date.now() - Date.parse(o.created_at) >= 60e3);
  const gruplar = grupla(eski);
  let hata = 0;
  for (const g of gruplar) {
    const ids = g.items.map(o => o.id), to = numara(g.phone);
    if (kuru) { console.log(`[kuru] ${g.phone} -> ${to || '(geçersiz numara)'}\n${metin(g)}\n`); continue; }
    let sonuc = { status: 'gonderildi', error: '' };
    if (!to) sonuc = { status: 'hata', error: 'Telefon numarası geçersiz' };
    else {
      try {
        const r = await fetchFn(`https://graph.facebook.com/${env.WA_GRAPH_VERSION || 'v23.0'}/${env.WA_PHONE_ID}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${env.WA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(govde(g, env)) });
        if (!r.ok) sonuc = { status: 'hata', error: `WhatsApp ${r.status}: ${(await r.text()).replace(/\s+/g, ' ').slice(0, 240)}` };
      } catch (e) { sonuc = { status: 'hata', error: String(e && e.message || e).slice(0, 240) }; }
    }
    if (sonuc.status === 'hata') hata++;
    const u = await sb(`shp_outbox?id=in.(${ids.join(',')})`, { method: 'PATCH', body: JSON.stringify({ status: sonuc.status, error: sonuc.error, sent_at: sonuc.status === 'gonderildi' ? new Date().toISOString() : null }) });
    if (!u.ok) console.log('Sonuç yazılamadı:', u.status);
    console.log(`${sonuc.status === 'gonderildi' ? 'Gönderildi' : 'HATA'}: müşteri ${g.customer_id} · ${g.event} · ${ids.length} haber${sonuc.error ? ' · ' + sonuc.error : ''}`);
  }
  if (!gruplar.length) console.log('Bekleyen bildirim yok.');
  return hata ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) calistir().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
export { calistir };
