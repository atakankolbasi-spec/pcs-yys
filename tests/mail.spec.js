// Mail okuma betiğinin (scripts/mail-oku/oku.mjs) testleri. Tarayıcı açılmaz; IMAP istemcisi ve fetch sahtedir.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const DIR = path.join(__dirname, '..', 'scripts', 'mail-oku');
const importFresh = new Function('u', 'return import(u)'); // derleyici dokunmasın diye
const yukle = f => importFresh(pathToFileURL(path.join(DIR, f)).href);
const ENV = { GMAIL_ADRES: 'k@gmail.com', GMAIL_UYGULAMA_SIFRESI: 'x', SUPABASE_URL: 'https://proje.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servis' };

const EK = [
  { filename: '26BG05000VIB0IBAT8.pdf' }, { filename: 'X 1443 EM.pdf' },
  { filename: 'image001.gif', contentId: '<a@b>' }, { filename: 'image003.png', contentDisposition: 'inline' }
];
const mailOrnek = (o = {}) => ({
  messageId: '<m1@bultrans>', subject: 'X 7608 MA / X 1443 EM', date: new Date('2026-10-28T08:30:00Z'),
  from: { value: [{ address: 'nurhan@bultrans.com.tr', name: 'Nurhan' }] },
  text: 'Gelen aracın bilgileri ekteki gibidir. HAT BİLDİRİMİ YAPABİLİR MİSİNİZ. 1 beyan daha olacak\n\nSaygılarımla\nNurhan\n\nFrom: Eski <e@x.com>\nSent: dün\nEski yazışma ZZ 9999 YY',
  attachments: EK, ...o
});

// mailler: [{uid, mail}] · gemini: sıradaki cevaplar {status, body}
async function kos({ mailler = [{ uid: 1, mail: mailOrnek() }], env = ENV, gemini = [{ body: { items: [{ action: 'add', tractor: 'X7608MA', trailer: 'X1443EM', date: '2026-10-28', time: '', note: '', parties: [], fee: '' }], customer: '', problem: '', model: 'm' } }], existing = [], emails = { BULTRANS: '@bultrans.com.tr' }, beyan = [], ayar = {}, parse } = {}) {
  const { run } = await yukle('oku.mjs');
  const log = [], satirlar = [], yamalar = [], gorulen = [], cikti = [], gemCagri = [], beyanCagri = [];
  const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { 'Content-Type': 'application/json' } });
  const fetchSahte = async (url, init = {}) => {
    url = String(url); const method = init.method || 'GET'; log.push({ url, method });
    if (url.includes('/app_settings')) return json([{ value: { emails, ...ayar } }]);
    if (url.includes('/incoming_messages?select=id&wa_message_id=')) return json(existing.filter(id => url.endsWith(encodeURIComponent(id))).map(id => ({ id })));
    if (url.includes('/incoming_messages?on_conflict=') && method === 'POST') { const b = JSON.parse(init.body); if (!existing.includes(b.wa_message_id)) { satirlar.push(b); existing.push(b.wa_message_id); } return new Response(null, { status: 201 }); }
    if (url.includes('/incoming_messages?') && method === 'PATCH') { yamalar.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    if (url.endsWith('/functions/v1/ruhsat-oku') && init.headers['x-pcs-mode'] === 'beyanname') { beyanCagri.push({ tur: init.headers['Content-Type'], boyut: init.body.length }); const r = beyan.length > 1 ? beyan.shift() : beyan[0]; return r ? json(r.body, r.status || 200) : json({ error: 'yok' }, 404); }
    if (url.endsWith('/functions/v1/ruhsat-oku')) { gemCagri.push(JSON.parse(init.body)); const r = gemini.length > 1 ? gemini.shift() : gemini[0]; return json(r.body, r.status || 200); }
    return json({ error: 'beklenmeyen ' + method + ' ' + url }, 500);
  };
  const imap = { listUnseen: async () => mailler, markSeen: async uid => { gorulen.push(uid); }, close: async () => {} };
  const sonuc = await run({ env, parse, fetch: fetchSahte, imap, sleep: async () => {}, log: m => cikti.push(m), error: m => cikti.push(m) });
  return { sonuc, log, satirlar, yamalar, gorulen, gemCagri, beyanCagri, cikti };
}

test.describe('mail okuma', () => {
  test('gerçek örnek: konu plaka, ek adları, beyanname, müşteri', async () => {
    const r = await kos({ mailler: [{ uid: 7, mail: mailOrnek() }] });
    expect(r.satirlar).toHaveLength(1);
    expect(r.satirlar[0]).toMatchObject({ wa_message_id: 'mail:<m1@bultrans>', from_number: 'nurhan@bultrans.com.tr', sender_name: 'Nurhan', status: 'okunuyor' });
    expect(r.satirlar[0].body).toContain('X 7608 MA / X 1443 EM');
    expect(r.satirlar[0].body).toContain('1 beyan daha olacak');
    expect(r.satirlar[0].body).not.toContain('ZZ 9999'); // alıntılanan eski yazışma kesildi
    expect(r.gemCagri).toHaveLength(1);
    const g = r.gemCagri[0];
    expect(g.today).toBe('2026-10-28');
    expect(g.text).toMatch(/Konu: X 7608 MA \/ X 1443 EM/);
    expect(g.text).toContain('X 1443 EM.pdf');
    expect(g.text).not.toContain('image001');
    expect(g.text).not.toContain('ZZ 9999');
    expect(g.text).toContain('26BG05000VIB0IBAT8');
    expect(r.yamalar).toHaveLength(1);
    expect(r.yamalar[0].status).toBe('bekliyor');
    expect(r.yamalar[0].ai.customer).toBe('BULTRANS');
    expect(r.yamalar[0].ai.declarations).toEqual(['26BG05000VIB0IBAT8']);
    expect(r.yamalar[0].ai.items[0].note).toContain('26BG05000VIB0IBAT8');
    expect(r.gorulen).toEqual([7]);
  });

  for (const [ad, ozel] of [
    ['TASLAK OK', { subject: 'X 7608 MA / X 1443 EM', text: 'TASLAK OK' }],
    ['Beyannameler Kapandı', { subject: 'X 7608 MA / X 1443 EM', text: 'Beyannameler Kapandı' }],
    ['SON BEYAN EKTEDİR', { subject: 'X 7608 MA / X 1443 EM', text: 'SON BEYAN EKTEDİR', attachments: [{ filename: '26BG05000VIB0IBAT9.pdf' }] }],
    ['RE: konulu', { subject: 'RE: X 7608 MA / X 1443 EM', text: 'Teşekkürler 34 ABC 123' }],
    ['In-Reply-To başlıklı', { text: 'Tamam 34 ABC 123', inReplyTo: '<a@b>' }]
  ]) {
    test('yanıt yeni araç üretmez, Gemini çağrılmaz: ' + ad, async () => {
      const r = await kos({ mailler: [{ uid: 1, mail: mailOrnek({ messageId: '<y@x>', ...ozel }) }] });
      expect(r.gemCagri).toHaveLength(0);
      expect(r.satirlar[0].status).toBe('yoksayildi');
      expect(r.satirlar[0].note).toMatch(/^Konuşmanın devamı/);
      expect(r.yamalar).toHaveLength(0);
      expect(r.gorulen).toEqual([1]);
    });
  }

  test('yanıtta beyanname numarası nota yazılır', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailOrnek({ messageId: '<y@x>', text: 'SON BEYAN EKTEDİR', attachments: [{ filename: '26BG05000VIB0IBAT9.pdf' }] }) }] });
    expect(r.satirlar[0].note).toBe('Konuşmanın devamı · Beyanname: 26BG05000VIB0IBAT9');
  });

  test('alıntılı eski yazışma ve imza kesilir', async () => {
    const { temizGovde } = await yukle('ayristir.mjs');
    expect(temizGovde('Yeni satır 1\nYeni satır 2\n\nOn Mon, 5 Oct 2026, Ali <a@b.com> wrote:\n> eski')).toBe('Yeni satır 1\nYeni satır 2');
    expect(temizGovde('Yeni\n-----Original Message-----\nFrom: x\nesk')).toBe('Yeni');
    expect(temizGovde('Yeni\nGönderen: Ali\nGönderilen: dün\neski')).toBe('Yeni');
    expect(temizGovde('Yeni\n> alıntı\n> daha')).toBe('Yeni');
    expect(temizGovde('Plaka 34 ABC 123\n-- \nAli Veli\nTel 0212')).toBe('Plaka 34 ABC 123');
  });

  test('beyanname biçimi ve imza resimleri', async () => {
    const { ekleriAyikla } = await yukle('ayristir.mjs');
    const r = ekleriAyikla(EK);
    expect(r.beyannameler).toEqual(['26BG05000VIB0IBAT8']);
    expect(r.dosyalar).toEqual(['X 1443 EM.pdf']);
    expect(ekleriAyikla([{ filename: 'logo.jpg' }, { filename: 'image007.bin' }]).dosyalar).toEqual([]);
  });

  test('müşteri eşleşmesi: tam adres alan adından önce gelir', async () => {
    const { musteriBul } = await yukle('musteri.mjs');
    const e = { BULTRANS: '@bultrans.com.tr', ÖZEL: 'nurhan@bultrans.com.tr; baska@x.com', ALAN: 'alan.com' };
    expect(musteriBul('Nurhan@Bultrans.com.tr', e)).toBe('ÖZEL');
    expect(musteriBul('ali@bultrans.com.tr', e)).toBe('BULTRANS');
    expect(musteriBul('ali@mail.alan.com', e)).toBe('ALAN');
    expect(musteriBul('ali@baska.com', e)).toBe('');
    expect(musteriBul('x', e)).toBe('');
  });

  test('aynı Message-ID iki kez işlenmez', async () => {
    const mail = mailOrnek();
    const r = await kos({ mailler: [{ uid: 1, mail }, { uid: 2, mail: { ...mail } }] });
    expect(r.satirlar).toHaveLength(1);
    expect(r.gemCagri).toHaveLength(1);
    expect(r.sonuc.tekrar).toBe(1);
    expect(r.gorulen).toEqual([1, 2]);
  });

  test('secret eksikken sessiz çıkış, ağ çağrısı yok', async () => {
    const { run } = await yukle('oku.mjs');
    let cagri = 0;
    const s = await run({ env: { ...ENV, SUPABASE_URL: '' }, fetch: async () => { cagri++; }, imap: { listUnseen: async () => { cagri++; return []; } }, log: () => {} });
    expect(s.atlandi).toBe(true);
    expect(cagri).toBe(0);
  });

  test('Gemini hata verince satır hata olur, mail okundu işaretlenir', async () => {
    const r = await kos({ gemini: [{ status: 400, body: { error: 'x', fatal: true, reason: 'anahtar geçersiz' } }] });
    expect(r.yamalar[0].status).toBe('hata');
    expect(r.yamalar[0].note).toContain('anahtar geçersiz');
    expect(r.gorulen).toHaveLength(1);
  });

  test('geçici Gemini hatası yeniden denenir', async () => {
    const ok = { body: { items: [{ action: 'add', tractor: 'X7608MA', trailer: '', date: '', time: '', note: '', parties: [], fee: '' }], customer: 'BULTRANS', problem: '', model: 'm' } };
    const r = await kos({ gemini: [{ status: 503, body: { error: 'x' } }, ok] });
    expect(r.gemCagri).toHaveLength(2);
    expect(r.yamalar[0].status).toBe('bekliyor');
  });

  test('araç yoksa yoksayildi; hiçbir durumda panoya (visits) yazılmaz', async () => {
    const r = await kos({ gemini: [{ body: { items: [], customer: '', problem: 'Plaka yok', model: 'm' } }] });
    expect(r.yamalar[0].status).toBe('yoksayildi');
    const hepsi = (await Promise.all([
      kos(), kos({ gemini: [{ status: 500, body: {} }] }),
      kos({ mailler: [{ uid: 1, mail: mailOrnek({ text: 'TASLAK OK' }) }] })
    ])).concat(r);
    for (const x of hepsi) for (const c of x.log) expect(c.url).not.toMatch(/\/visits|\/registry|save_app_setting|rpc\//);
    for (const x of hepsi) for (const c of x.log) if (c.method !== 'GET') expect(c.url).toMatch(/incoming_messages|ruhsat-oku/);
  });

  // --- Beyanname eki: tesise gelecek / gelmeyecek ---
  const pdfEk = (ad, n = 20000) => ({ filename: ad, contentType: 'application/pdf', content: Buffer.alloc(n, 1), size: n });
  const IMZA = [{ filename: 'image001.gif', contentId: '<a@b>', content: Buffer.alloc(9000), size: 9000 }];
  const beyanOk = kod => ({ body: { declaration: true, number: '26341300EX00874692', facility_code: kod, plates: ['X7608MA'], model: 'm' } });
  const mailPdf = (o = {}) => mailOrnek({ attachments: [pdfEk('Bul20261027154628.pdf'), ...IMZA], ...o });

  test('beyanname: 30. kutu Z34089 -> gelecek, numara ve kod kaydedilir; ek adı güvenilmez', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], beyan: [beyanOk(' z34089 ')] });
    expect(r.beyanCagri).toEqual([{ tur: 'application/pdf', boyut: 20000 }]); // imza resmi okunmadı
    const ai = r.yamalar[0].ai;
    expect(r.yamalar[0].status).toBe('bekliyor');
    expect(ai.items[0].facility).toBe('gelecek');
    expect(ai.items[0].facility_note).toBe('30. kutu: z34089');
    expect(ai.declarations).toEqual(['26341300EX00874692']);
    expect(ai.facility_codes).toEqual(['z34089']);
    expect(r.gemCagri[0].text).toContain('26341300EX00874692');
  });

  test('beyanname: 30. kutu boş -> gelmeyecek ama kaydedilir (bekliyor)', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], beyan: [beyanOk('')] });
    expect(r.yamalar[0].status).toBe('bekliyor');
    expect(r.yamalar[0].ai.items[0]).toMatchObject({ facility: 'gelmeyecek', facility_note: '30. kutu boş' });
    expect(r.yamalar[0].ai.facility_codes).toBeUndefined();
  });

  test('başka kod -> gelmeyecek; ayardaki kod listesi kullanılır; plaka eşleşmesi araç bazında', async () => {
    const it = (t, tr) => ({ action: 'add', tractor: t, trailer: tr, date: '', time: '', note: '', parties: [], fee: '' });
    const gemini = [{ body: { items: [it('X7608MA', 'X1443EM'), it('AB1234', '')], customer: '', problem: '', model: 'm' } }];
    const beyan = [{ body: { declaration: true, number: '1', facility_code: 'Z99999', plates: ['X 7608 MA'], model: 'm' } }];
    let r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], gemini, beyan, ayar: { facility_codes: ['z99999'] } });
    expect(r.yamalar[0].ai.items.map(i => i.facility)).toEqual(['gelecek', 'belirsiz']); // 2. araç: eşleşen beyanname yok
    r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], gemini, beyan });
    expect(r.yamalar[0].ai.items[0]).toMatchObject({ facility: 'gelmeyecek', facility_note: '30. kutu: Z99999' });
  });

  test('beyanname hiçbir araçla eşleşmeyen plakalıysa mailin tüm araçlarına uygulanır', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], beyan: [{ body: { declaration: true, number: '2', facility_code: 'Z34089', plates: ['ZZ0000'], model: 'm' } }] });
    expect(r.yamalar[0].ai.items[0].facility).toBe('gelecek');
  });

  for (const [ad, ayar, bek] of [['varsayılan açık', {}, 'belirsiz'], ['açık', { comes: { BULTRANS: true } }, 'belirsiz'], ['kapalı', { comes: { BULTRANS: false } }, 'gelmeyecek']]) {
    test('ek yok, müşteri "genelde gelir" ' + ad + ' -> ' + bek, async () => {
      const r = await kos({ mailler: [{ uid: 1, mail: mailOrnek({ attachments: [] }) }], ayar });
      expect(r.beyanCagri).toHaveLength(0);
      expect(r.yamalar[0].status).toBe('bekliyor');
      expect(r.yamalar[0].ai.items[0].facility).toBe(bek);
      expect(r.yamalar[0].ai.items[0].facility_note).toMatch(/Beyanname görülmedi/);
    });
  }

  test('okunamayan ek ya da beyanname olmayan belge (ruhsat) sessizce atlanır', async () => {
    const m = mailPdf({ attachments: [pdfEk('a.pdf'), pdfEk('b.pdf')] });
    const r = await kos({ mailler: [{ uid: 1, mail: m }], beyan: [{ status: 400, body: { fatal: true } }, { body: { declaration: false, number: '', facility_code: '', plates: ['X1443EM'], model: 'm' } }] });
    expect(r.beyanCagri).toHaveLength(2);
    expect(r.yamalar[0].status).toBe('bekliyor');
    expect(r.yamalar[0].ai.items[0].facility).toBe('belirsiz');
    expect(r.yamalar[0].ai.declarations).toBeUndefined();
  });

  test('boyut sınırı: çok küçük ve çok büyük ekler okunmaz; en çok 4 belge', async () => {
    const ekler = [pdfEk('kucuk.pdf', 100), pdfEk('dev.pdf', 9 * 1024 * 1024), ...[1, 2, 3, 4, 5, 6].map(i => pdfEk(`b${i}.pdf`))];
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf({ attachments: ekler }) }], beyan: [beyanOk('Z34089')] });
    expect(r.beyanCagri).toHaveLength(4);
    expect(r.beyanCagri.every(c => c.boyut === 20000)).toBe(true);
  });

  test('docx metni mesaja eklenir, docx beyanname olarak okunmaz', async () => {
    const { docxMetni } = await yukle('docx.mjs');
    const zlib = require('zlib');
    const xml = '<w:document><w:body><w:p><w:r><w:t>BULTRANS 18 - X 4999 MB</w:t></w:r></w:p><w:p><w:r><w:t>X 5167 EM &amp; not</w:t></w:r></w:p></w:body></w:document>';
    const adB = Buffer.from('word/document.xml'), veri = zlib.deflateRawSync(Buffer.from(xml));
    const yerel = Buffer.alloc(30); yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(8, 8); yerel.writeUInt32LE(veri.length, 18); yerel.writeUInt32LE(xml.length, 22); yerel.writeUInt16LE(adB.length, 26);
    const merk = Buffer.alloc(46); merk.writeUInt32LE(0x02014b50, 0); merk.writeUInt16LE(8, 10); merk.writeUInt32LE(veri.length, 20); merk.writeUInt32LE(xml.length, 24); merk.writeUInt16LE(adB.length, 28); merk.writeUInt32LE(0, 42);
    const govde = Buffer.concat([yerel, adB, veri]), dizin = Buffer.concat([merk, adB]);
    const son = Buffer.alloc(22); son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(1, 10); son.writeUInt32LE(dizin.length, 12); son.writeUInt32LE(govde.length, 16);
    const docx = Buffer.concat([govde, dizin, son]);
    expect(docxMetni(docx)).toBe('BULTRANS 18 - X 4999 MB\nX 5167 EM & not');
    expect(docxMetni(Buffer.from('bozuk'))).toBe('');
    const big = Buffer.concat([docx, Buffer.alloc(4000)]); // son kayıt dosya sonunda aranır: dolgu 66000 sınırı içinde
    const ek = { filename: 'BULTRANS 18 - X 4999 MB.docx', content: big, size: big.length };
    const r = await kos({ mailler: [{ uid: 1, mail: mailOrnek({ attachments: [ek] }) }] });
    expect(r.beyanCagri).toHaveLength(0);
    expect(r.gemCagri[0].text).toContain('X 5167 EM & not');
  });

  test('ek ve beyanname içeriği loga/konsola basılmaz, depolamaya yazılmaz', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf() }], beyan: [beyanOk('Z34089')] });
    const hepsi = r.cikti.join('\n');
    expect(hepsi).not.toMatch(/Z34089|26341300EX00874692|Bul2026|X 7608|nurhan/);
    expect(hepsi).toMatch(/beyanname/); // yalnızca sayı/durum
    for (const c of r.log) expect(c.url).not.toMatch(/storage/);
  });

  test('yanıtta ek okunmaz (beyanname çağrısı yok)', async () => {
    const r = await kos({ mailler: [{ uid: 1, mail: mailPdf({ text: 'SON BEYAN EKTEDİR' }) }], beyan: [beyanOk('Z34089')] });
    expect(r.beyanCagri).toHaveLength(0);
    expect(r.gemCagri).toHaveLength(0);
  });
});

// "Ek olarak ilet": Outlook kuralı müşterinin özgün mailini message/rfc822 ek olarak gönderir.
test.describe('ek olarak iletilen mailler', () => {
  const EKLER_IC = [{ filename: 'BULTRANS 18 - X 4999 MB - X 5167 EM.docx' }, { filename: 'Bul20261027154628.pdf' }];
  const icMail = (o = {}) => ({
    messageId: '<ic1@bultrans>', subject: 'X 4999 MB / X 5167 EM', date: new Date('2026-10-28T08:30:00Z'),
    from: { value: [{ address: 'nurhan@bultrans.com.tr', name: 'Nurhan' }] },
    text: 'Gelecek olan aracın bilgileri ekteki gibidir. 1 beyan daha olacak.', attachments: EKLER_IC, ...o
  });
  // Dış mail: gumruk@pcstransit.com.tr'den "FW:" konusuyla gelir; özgün mail .eml ek olarak durur.
  const dis = (ic, o = {}, anahtar = 'ic1') => ({
    messageId: '<dis-' + anahtar + '@pcstransit>', subject: 'FW: ' + ic.subject, date: new Date('2026-10-28T09:00:00Z'),
    from: { value: [{ address: 'gumruk@pcstransit.com.tr', name: 'Gümrük' }] },
    text: 'Özgün mail ektedir.', inReplyTo: '<x@y>', references: ['<x@y>'],
    attachments: [{ filename: 'ileti.eml', contentType: 'message/rfc822', content: Buffer.from(anahtar) }], ...o
  });
  const parseSahte = tablo => async buf => tablo[buf.toString()];

  test('(a) ek olarak iletilmiş yeni araç maili: iç mailden öneri, gönderen ve konu', async () => {
    const ic = icMail();
    const r = await kos({ mailler: [{ uid: 3, mail: dis(ic) }], parse: parseSahte({ ic1: ic }) });
    expect(r.satirlar).toHaveLength(1);
    expect(r.satirlar[0]).toMatchObject({ wa_message_id: 'mail:<ic1@bultrans>', from_number: 'nurhan@bultrans.com.tr', sender_name: 'Nurhan' });
    expect(r.satirlar[0].body).toContain('X 4999 MB / X 5167 EM');
    expect(r.satirlar[0].body).not.toContain('FW:');
    expect(r.satirlar[0].from_number).not.toContain('pcstransit');
    expect(r.gemCagri).toHaveLength(1);
    expect(r.gemCagri[0].text).toContain('Konu: X 4999 MB / X 5167 EM');
    expect(r.gemCagri[0].text).toContain('BULTRANS 18 - X 4999 MB - X 5167 EM.docx');
    expect(r.yamalar[0].status).toBe('bekliyor');
    expect(r.yamalar[0].ai.customer).toBe('BULTRANS'); // müşteri iç mailin göndericisinden
    expect(r.gorulen).toEqual([3]);
  });

  test('(b) ek olarak iletilmiş "RE: … TASLAK OK" devam olarak yoksayılır', async () => {
    const ic = icMail({ messageId: '<ic2@bultrans>', subject: 'RE: X 4999 MB / X 5167 EM', text: 'TASLAK OK', inReplyTo: '<ic1@bultrans>', attachments: [] });
    const r = await kos({ mailler: [{ uid: 4, mail: dis(ic, {}, 'ic2') }], parse: parseSahte({ ic2: ic }) });
    expect(r.satirlar).toHaveLength(1);
    expect(r.satirlar[0]).toMatchObject({ wa_message_id: 'mail:<ic2@bultrans>', status: 'yoksayildi', note: expect.stringContaining('Konuşmanın devamı') });
    expect(r.gemCagri).toHaveLength(0);
    expect(r.sonuc.devam).toBe(1);
  });

  test('(c) aynı iç mail iki kez iletilirse ikincisi tekrar sayılır', async () => {
    const ic = icMail();
    const r = await kos({ mailler: [{ uid: 5, mail: dis(ic, {}, 'ic1') }, { uid: 6, mail: dis(ic, { messageId: '<dis-ikinci@pcstransit>' }, 'ic1') }], parse: parseSahte({ ic1: ic }) });
    expect(r.satirlar).toHaveLength(1);
    expect(r.gemCagri).toHaveLength(1);
    expect(r.sonuc.tekrar).toBe(1);
    expect(r.gorulen).toEqual([5, 6]);
  });

  test('bir dış mailde birden fazla iç mail: her biri ayrı işlenir, en çok 5', async () => {
    const tablo = {}, ekler = [];
    for (let i = 1; i <= 7; i++) { tablo['k' + i] = icMail({ messageId: '<k' + i + '@bultrans>', subject: 'X ' + (1000 + i) + ' AB' }); ekler.push({ filename: i + '.eml', contentType: 'message/rfc822', content: Buffer.from('k' + i) }); }
    const r = await kos({ mailler: [{ uid: 9, mail: dis(tablo.k1, { attachments: ekler }) }], parse: parseSahte(tablo) });
    expect(r.satirlar.map(x => x.wa_message_id)).toEqual([1, 2, 3, 4, 5].map(i => 'mail:<k' + i + '@bultrans>'));
    expect(r.gorulen).toEqual([9]);
  });

  test('.eml uzantılı ek (türü genel) de iç mail sayılır; ayrıştırılamayan iç mail yüzünden dış mail kaybolmaz', async () => {
    const ic = icMail();
    const eml = dis(ic, { attachments: [{ filename: 'Orijinal.EML', contentType: 'application/octet-stream', content: Buffer.from('ic1') }] });
    expect((await kos({ mailler: [{ uid: 1, mail: eml }], parse: parseSahte({ ic1: ic }) })).satirlar[0].wa_message_id).toBe('mail:<ic1@bultrans>');
    const bozuk = await kos({ mailler: [{ uid: 2, mail: dis(ic) }], parse: async () => { throw new Error('bozuk'); } });
    expect(bozuk.satirlar).toHaveLength(1); // iç mail okunamadı: dış mail olduğu gibi işlenir
    expect(bozuk.satirlar[0].wa_message_id).toBe('mail:<dis-ic1@pcstransit>');
  });

  const ILET_GOVDE = 'Müşteri maili aşağıdadır.\n\nFrom: Nurhan Yılmaz <nurhan@bultrans.com.tr>\nSent: Tuesday, October 27, 2026 3:46 PM\nTo: gumruk@pcstransit.com.tr\nSubject: X 4999 MB / X 5167 EM\n\nGelecek olan aracın bilgileri ekteki gibidir. 1 beyan daha olacak.\n\nSaygılarımla\n\nFrom: Eski <e@x.com>\nSent: dün\nEski yazışma ZZ 9999 YY';
  const normalIlet = (o = {}) => ({
    messageId: '<fw1@pcstransit>', subject: 'FW: X 4999 MB / X 5167 EM', date: new Date('2026-10-28T09:00:00Z'),
    from: { value: [{ address: 'gumruk@pcstransit.com.tr', name: 'Gümrük' }] }, text: ILET_GOVDE, inReplyTo: '', attachments: EKLER_IC, ...o
  });

  test('(d) normal "ilet" (iç ek yok): yedek yol özgün gönderen, konu ve yazıyı iletme başlığından okur', async () => {
    const r = await kos({ mailler: [{ uid: 8, mail: normalIlet() }] });
    expect(r.satirlar).toHaveLength(1);
    expect(r.satirlar[0]).toMatchObject({ from_number: 'nurhan@bultrans.com.tr', sender_name: 'Nurhan Yılmaz' });
    expect(r.satirlar[0].body).toContain('X 4999 MB / X 5167 EM');
    expect(r.satirlar[0].body).toContain('1 beyan daha olacak');
    expect(r.satirlar[0].body).not.toMatch(/FW:|ZZ 9999|gumruk@/);
    expect(r.gemCagri[0].text).toContain('Konu: X 4999 MB / X 5167 EM');
    expect(r.yamalar[0].ai.customer).toBe('BULTRANS');
  });

  test('yedek yol: iletilen yanıt ("RE: … TASLAK OK") yine devam sayılır; yalnızca kendi alan adımızdan iletilen FW: çözülür', async () => {
    const devam = normalIlet({ text: 'Fyi\n\nFrom: N <nurhan@bultrans.com.tr>\nSent: x\nTo: g\nSubject: RE: X 4999 MB / X 5167 EM\n\nTASLAK OK' });
    const r = await kos({ mailler: [{ uid: 1, mail: devam }] });
    expect(r.satirlar[0]).toMatchObject({ status: 'yoksayildi', from_number: 'nurhan@bultrans.com.tr' });
    expect(r.gemCagri).toHaveLength(0);
    // dışarıdan gelen FW: konulu mail yedek yola girmez: eskisi gibi yanıt konusu sayılır
    const dis2 = await kos({ mailler: [{ uid: 2, mail: normalIlet({ from: { value: [{ address: 'biri@baska.com', name: 'B' }] } }) }] });
    expect(dis2.satirlar[0]).toMatchObject({ status: 'yoksayildi', from_number: 'biri@baska.com' });
  });
});
