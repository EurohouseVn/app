import test from 'node:test';
import assert from 'node:assert/strict';
import { profileToolGroups } from './profileToolGroups.ts';

test('menu Tài khoản theo wireframe: Tài liệu, Quản lý, Hỗ trợ', () => {
  assert.deepEqual(
    profileToolGroups.map((group) => ({
      title: group.title,
      labels: group.tools.map((tool) => tool.label),
    })),
    [
      { title: 'Tài liệu', labels: ['Kiến thức', 'Thư viện'] },
      { title: 'Quản lý', labels: ['Công nợ', 'Tồn kho & đề-xê', 'Hồ sơ cơ sở'] },
      { title: 'Hỗ trợ', labels: ['Bảo hành QR', 'Zalo hỗ trợ', 'Cộng đồng Facebook'] },
    ],
  );
});

test('liên kết ngoài được đánh dấu để mở trình duyệt', () => {
  const tools = profileToolGroups.flatMap((group) => group.tools);
  for (const tool of tools) assert.equal(Boolean(tool.external), tool.href.startsWith('http'), tool.label);
});
