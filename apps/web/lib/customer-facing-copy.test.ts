import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const publicCopyFiles = [
  '../app/nhom-cong-nghiep/page.tsx',
  '../app/nhom-cong-nghiep/[slug]/page.tsx',
  '../app/nhom-dan-dung/so-sanh/page.tsx',
  '../app/nang-luc/page.tsx',
  '../app/nang-luc/[slug]/page.tsx',
  '../app/tai-nguyen/page.tsx',
  '../app/catalog/page.tsx',
  '../app/ve-eurohouse/page.tsx',
  '../components/content/DocumentList.tsx',
  '../components/explore/DocumentGroups.tsx',
  '../components/content/ProductDetail.tsx',
  '../lib/explore-data.ts',
  '../lib/industrial-content.ts',
  '../lib/residential-content.ts',
] as const;

test('public website copy does not expose internal approval and publication workflow', () => {
  const combinedCopy = publicCopyFiles
    .map((relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8'))
    .join('\n')
    .toLocaleLowerCase('vi');

  for (const forbidden of [
    'chưa được duyệt',
    'được phê duyệt',
    'phê duyệt kỹ thuật',
    'liên hệ xác nhận kỹ thuật',
    'hồ sơ xuất bản',
    'người duyệt',
    'admin và npp',
    'datasetrevision',
    'chỉ công bố điều',
    'website không tự suy diễn',
    'thông số chưa được công bố',
    'thông số kỹ thuật chỉ được hiển thị',
  ]) {
    assert.equal(combinedCopy.includes(forbidden), false, `public copy must not contain internal phrase: ${forbidden}`);
  }
});
