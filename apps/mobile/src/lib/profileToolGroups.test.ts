import test from 'node:test';
import assert from 'node:assert/strict';
import { profileToolGroups } from './profileToolGroups.ts';

test('workspace tools follow the information-to-operations workflow', () => {
  assert.deepEqual(
    profileToolGroups.map((group) => ({
      title: group.title,
      labels: group.tools.map((tool) => tool.label),
    })),
    [
      { title: 'Kiến thức & tài liệu', labels: ['Kiến thức', 'Catalog sản phẩm', 'Thư viện'] },
      { title: 'Kinh doanh & vận hành', labels: ['Báo giá tự động', 'Công trình', 'Công nợ', 'Tồn kho & Đề xê'] },
      { title: 'Tài khoản & hỗ trợ', labels: ['Cấu hình báo giá / Hồ sơ', 'Bảo hành QR', 'Đổi quà tích luỹ', 'Cộng đồng Facebook', 'Zalo Support (OA)'] },
    ],
  );
});
