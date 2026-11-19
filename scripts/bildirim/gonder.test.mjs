// node --test scripts/bildirim: bildirim göndericinin saf işlevleri ve (sahte WhatsApp / Supabase ile) tam akışı.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { numara, grupla, metin, sablonMetni, govde, calistir } from './gonder.mjs';

test('telefon numarası WhatsApp biçimine çevrilir', () => {
  assert.equal(numara('+90 532 000 00 00'), '905320000000');
  assert.equal(numara('0532 000 00 00'), '905320000000');
  assert.equal(numara('532-000-00-00'), '905320000000');
  assert.equal(numara('00 40 770 984 922'), '40770984922');
  assert.equal(numara('123'), '');
  assert.equal(numara(''), '');
});

test('aynı müşteri ve haber türü tek mesajda birleşir', () => {
  const s = [{ id: 1, customer_id: 'a', event: 'geldi', phone: '+90 532 000 00 00', body: 'X → Y · 4 kap · 100 kg' }, { id: 2, customer_id: 'a', event: 'geldi', phone: '+90 532 000 00 00', body: 'Z → W · 2 kap · 50 kg' },
    { id: 3, customer_id: 'a', event: 'sorun', phone: '+90 532 000 00 00', body: 'X → Y: eksik var' }, { id: 4, customer_id: 'b', event: 'geldi', phone: '+90 533 000 00 00', body: 'Q → R' }];
  const g = grupla(s);
  assert.equal(g.length, 3);
  assert.equal(metin(g[0]), '📦 Yükünüz depoya geldi\nX → Y · 4 kap · 100 kg\nZ → W · 2 kap · 50 kg');
  assert.equal(metin({ event: 'yola', items: [{ body: '34 ABC 123 · PCS-26-0001' }] }), '🚚 Aracınız yola çıktı\n34 ABC 123 · PCS-26-0001\nLade Liste ve CMR belgeleriniz hazır.');
});

test('şablon gövdesinde satır sonu olmaz; şablon adı yoksa düz yazı gönderilir', () => {
  assert.equal(sablonMetni('a\nb\n\nc  d'), 'a | b | c d');
  const g = { phone: '0532 000 00 00', event: 'geldi', items: [{ body: 'X → Y' }] };
  assert.equal(govde(g, {}).type, 'text');
  const t = govde(g, { WA_SABLON: 'nakliye_haber', WA_SABLON_DIL: 'tr' });
  assert.equal(t.type, 'template'); assert.equal(t.template.name, 'nakliye_haber');
  assert.ok(!t.template.components[0].parameters[0].text.includes('\n'));
  assert.equal(t.to, '905320000000');
});

test('tam akış: gönderir, sonucu yazar; eski değilse bekletir; hata olursa işaretler; anahtarlar yoksa hiçbir şey yapmaz', async () => {
  const eski = new Date(Date.now() - 5 * 60e3).toISOString(), yeni = new Date().toISOString();
  const rows = [{ id: 1, customer_id: 'a', event: 'geldi', phone: '+90 532 000 00 00', body: 'X → Y', created_at: eski }, { id: 2, customer_id: 'a', event: 'geldi', phone: '+90 532 000 00 00', body: 'Z → W', created_at: eski },
    { id: 3, customer_id: 'b', event: 'teslim', phone: '+90 533 000 00 00', body: '34 ABC · PCS', created_at: eski }, { id: 4, customer_id: 'c', event: 'geldi', phone: '12', body: 'bozuk numara', created_at: eski }, { id: 5, customer_id: 'd', event: 'geldi', phone: '+90 534 000 00 00', body: 'çok yeni', created_at: yeni }];
  const wa = [], patch = [];
  const sahte = async (url, init = {}) => {
    if (String(url).includes('graph.facebook.com')) { const b = JSON.parse(init.body); wa.push(b); return b.to === '905330000000' ? { ok: false, status: 400, text: async () => '{"error":{"message":"pencere dışı"}}' } : { ok: true, status: 200, text: async () => '{}' }; }
    if (init.method === 'PATCH') { patch.push({ url: String(url), body: JSON.parse(init.body) }); return { ok: true, status: 204, text: async () => '' }; }
    return { ok: true, status: 200, json: async () => rows, text: async () => '' };
  };
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', WA_TOKEN: 't', WA_PHONE_ID: '123' };
  const code = await calistir(env, sahte);
  assert.equal(code, 1);                                                             // biri hata verdi
  assert.equal(wa.length, 2);                                                        // iki geçerli numara (bozuk numara gönderilmez), "çok yeni" bekler
  assert.match(wa[0].text.body, /X → Y\nZ → W/);                                     // iki haber tek mesaj
  const sonuc = Object.fromEntries(patch.map(p => [p.url.match(/in\.\(([^)]*)\)/)[1], p.body]));
  assert.equal(sonuc['1,2'].status, 'gonderildi'); assert.ok(sonuc['1,2'].sent_at);
  assert.equal(sonuc['3'].status, 'hata'); assert.match(sonuc['3'].error, /pencere dışı/);
  assert.equal(sonuc['4'].status, 'hata'); assert.match(sonuc['4'].error, /geçersiz/);
  assert.ok(!('5' in sonuc));
  // eksik anahtar: hiçbir istek yapılmaz
  let istek = 0; assert.equal(await calistir({}, async () => { istek++; return { ok: true }; }), 0); assert.equal(istek, 0);
  assert.equal(await calistir({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }, async () => { istek++; return { ok: true }; }), 0); assert.equal(istek, 0);
  // kuru çalıştırma dosyadan okur, göndermez
  const f = path.join(os.tmpdir(), `bild-${process.pid}.json`); fs.writeFileSync(f, JSON.stringify(rows.slice(0, 1)));
  wa.length = 0; assert.equal(await calistir({ BILDIRIM_VERI: f, BILDIRIM_KURU: '1' }, sahte), 0); assert.equal(wa.length, 0); fs.unlinkSync(f);
});
