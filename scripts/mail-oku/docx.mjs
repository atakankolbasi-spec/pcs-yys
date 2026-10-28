// .docx içindeki düz metni çıkarır (zip + XML, paket gerektirmez). Diske yazılmaz; her şey bellekte.
import { inflateRawSync } from 'node:zlib';

const AZAMI_XML = 2 * 1024 * 1024;

export function docxMetni(buf, azami = 2000) {
  try {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return '';
    const n = b.readUInt16LE(eocd + 10);
    let p = b.readUInt32LE(eocd + 16);
    for (let k = 0; k < n && p + 46 <= b.length && b.readUInt32LE(p) === 0x02014b50; k++) {
      const yontem = b.readUInt16LE(p + 10), boyut = b.readUInt32LE(p + 20), acik = b.readUInt32LE(p + 24);
      const ad = b.toString('utf8', p + 46, p + 46 + b.readUInt16LE(p + 28)), yerel = b.readUInt32LE(p + 42);
      p += 46 + b.readUInt16LE(p + 28) + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
      if (ad !== 'word/document.xml' || acik > AZAMI_XML) continue;
      const veri = b.subarray(yerel + 30 + b.readUInt16LE(yerel + 26) + b.readUInt16LE(yerel + 28), yerel + 30 + b.readUInt16LE(yerel + 26) + b.readUInt16LE(yerel + 28) + boyut);
      const xml = (yontem === 0 ? veri : inflateRawSync(veri, { maxOutputLength: AZAMI_XML })).toString('utf8');
      return xml.replace(/<\/w:p>|<w:br\s*\/?>|<w:tab\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, azami);
    }
  } catch (_) { /* bozuk dosya: metin çıkmaz */ }
  return '';
}
