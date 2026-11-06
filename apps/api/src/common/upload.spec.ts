import test from 'node:test';
import assert from 'node:assert/strict';
import { assertWebsiteMediaUpload, pdfExtension } from './upload';

test('accepts a genuine PDF upload', () => {
  assert.equal(
    pdfExtension(
      { originalname: 'EUROHOUSE-CATALOG-R19.pdf', mimetype: 'application/pdf' },
      Buffer.from('%PDF-1.7\n'),
    ),
    '.pdf',
  );
});

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('website media inspection accepts a genuine PNG and reads dimensions', () => {
  const result = assertWebsiteMediaUpload({
    originalname: 'nha-may.png',
    mimetype: 'image/png',
    size: onePixelPng.byteLength,
    buffer: onePixelPng,
  });
  assert.equal(result.mediaType, 'IMAGE');
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
});

test('website media inspection rejects spoofed signatures and media over its class limit', () => {
  assert.throws(
    () => assertWebsiteMediaUpload({ originalname: 'gia-mao.png', mimetype: 'image/png', buffer: Buffer.from('not-png') }),
    /chữ ký|không hợp lệ/i,
  );
  assert.throws(
    () => assertWebsiteMediaUpload({ originalname: 'qua-lon.jpg', mimetype: 'image/jpeg', size: 8 * 1024 * 1024 + 1, buffer: Buffer.from([0xff, 0xd8, 0xff]) }),
    /8 MiB/,
  );
});

test('website media inspection verifies MP4 ftyp and WebM EBML signatures', () => {
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('isom')]);
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
  assert.equal(assertWebsiteMediaUpload({ originalname: 'intro.mp4', mimetype: 'video/mp4', buffer: mp4 }).mediaType, 'VIDEO');
  assert.equal(assertWebsiteMediaUpload({ originalname: 'intro.webm', mimetype: 'video/webm', buffer: webm }).mediaType, 'VIDEO');
  assert.throws(() => assertWebsiteMediaUpload({ originalname: 'intro.mp4', mimetype: 'video/mp4', buffer: webm }), /không khớp/i);
});

test('rejects a renamed or malformed PDF upload', () => {
  assert.throws(
    () => pdfExtension({ originalname: 'catalog.pdf', mimetype: 'application/pdf' }, Buffer.from('not-a-pdf')),
    /PDF không hợp lệ/,
  );
  assert.throws(
    () => pdfExtension({ originalname: 'catalog.exe', mimetype: 'application/pdf' }, Buffer.from('%PDF-1.7')),
    /Chỉ chấp nhận file PDF/,
  );
});
