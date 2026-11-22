import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVideoSchema } from './video-metadata';

test('video schema requires crawlable title, description, poster and transcript', () => {
  assert.equal(buildVideoSchema({ name: '', description: 'Mô tả', thumbnailUrl: '/poster.webp', transcript: 'Nội dung' }), undefined);
  assert.equal(buildVideoSchema({ name: 'Nhà máy', description: '', thumbnailUrl: '/poster.webp', transcript: 'Nội dung' }), undefined);
  assert.equal(buildVideoSchema({ name: 'Nhà máy', description: 'Mô tả', thumbnailUrl: '', transcript: 'Nội dung' }), undefined);
  assert.equal(buildVideoSchema({ name: 'Nhà máy', description: 'Mô tả', thumbnailUrl: '/poster.webp', transcript: '' }), undefined);
});

test('video schema uses production URLs without inventing dates or duration', () => {
  const schema = buildVideoSchema({
    name: 'Bên trong dây chuyền sản xuất EUROHOUSE',
    description: 'Tư liệu thực tế về một công đoạn xử lý profile nhôm.',
    thumbnailUrl: '/media/eurohouse-factory-line-poster.webp',
    contentUrl: '/media/eurohouse-factory-line.mp4',
    transcript: 'Video cho thấy profile nhôm đi qua một công đoạn trong nhà máy.',
  });
  assert.ok(schema);
  assert.equal(schema.thumbnailUrl, 'https://nhomeurohouse.com/media/eurohouse-factory-line-poster.webp');
  assert.equal(schema.contentUrl, 'https://nhomeurohouse.com/media/eurohouse-factory-line.mp4');
  assert.equal('uploadDate' in schema, false);
  assert.equal('duration' in schema, false);
});
