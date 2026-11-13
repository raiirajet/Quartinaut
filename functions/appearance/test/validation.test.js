'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { safeUid,imagePath,decodeImage,MAX_RAW } = require('../validation');

const jpeg = Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(48,0)]);
test('background filename never depends on untrusted path arguments', () => {
  assert.equal(imagePath('abc_12'), 'dashboard-backgrounds/abc_12/current.jpg');
  assert.throws(() => safeUid('../admin'),/Benutzerkennung/);
  assert.throws(() => imagePath('user/other'),/Benutzerkennung/);
});
test('accept compact JPEG after data URL or raw base64', () => {
  const value=jpeg.toString('base64');
  assert.deepEqual(decodeImage(value),jpeg);
  assert.deepEqual(decodeImage('data:image/jpeg;base64,'+value),jpeg);
});
test('reject forged non-JPEG input and non-base64 data', () => {
  assert.throws(() => decodeImage(Buffer.alloc(40,1).toString('base64')),/JPEG/);
  assert.throws(() => decodeImage('not:a:data/url:!@#'),/Bild|Format/);
});
test('reject oversized uploads before touching Storage', () => {
  assert.throws(()=>decodeImage(Buffer.alloc(MAX_RAW+1,1).toString('base64')),/gross/);
});
