'use strict';
/**
 * Zero-IO validation routines. The Cloud Function always re-encodes with
 * Sharp; no original EXIF, ICC profile or other uploaded metadata is retained.
 */
const MAX_ENCODED = 4 * 1024 * 1024;
const MAX_RAW = 3 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 24 * 1000 * 1000;
const BUCKET = 'quartinaut.firebasestorage.app';

function safeUid(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new Error('Ungültige Benutzerkennung.');
  }
  return value;
}
function imagePath(uid) {
  return 'dashboard-backgrounds/' + safeUid(uid) + '/current.jpg';
}
function decodeImage(raw) {
  if (typeof raw !== 'string' || raw.length < 40 || raw.length > MAX_ENCODED) {
    throw new Error('Bild ist zu gross oder leer.');
  }
  const stripped = raw.startsWith('data:image/jpeg;base64,')
    ? raw.slice('data:image/jpeg;base64,'.length) : raw;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(stripped) || stripped.length % 4 === 1) {
    throw new Error('Ungültiges Bildformat.');
  }
  const data = Buffer.from(stripped, 'base64');
  if (data.length < 32 || data.length > MAX_RAW) {
    throw new Error('Das Bild darf nach Komprimierung höchstens 3 MB gross sein.');
  }
  if (data[0] !== 0xFF || data[1] !== 0xD8 || data[2] !== 0xFF) {
    throw new Error('Nur echte JPEG-Bilder sind erlaubt.');
  }
  return data;
}
module.exports = { MAX_RAW, MAX_IMAGE_PIXELS, BUCKET, safeUid, imagePath, decodeImage };
