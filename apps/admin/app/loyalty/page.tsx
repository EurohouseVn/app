'use client';

import { useEffect, useMemo, useState } from 'react';
import { Drill, Gift, Package, Smartphone } from 'lucide-react';
import type { GiftItem } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

function giftIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('khoan')) return Drill;
  if (n.includes('điện thoại')) return Smartphone;
  if (n.includes('balo')) return Package;
  return Gift;
}

export default function LoyaltyPage() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<GiftItem[]>('/gifts').then(setGifts).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải quà tặng.'));
  }, []);

  const totalStock = useMemo(() => gifts.reduce((sum, g) => sum + (g.stock ?? 0), 0), [gifts]);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>LOYALTY</p>
      <h1 style={pageTitleStyle}>Quà tặng & tích điểm</h1>
      <p style={subtitleStyle}>{gifts.length} quà · tổng tồn kho {totalStock} phần. Người dùng đổi điểm để nhận quà trên app.</p>
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      {/* Lưới quà */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, margin: '12px 0 24px' }}>
        {gifts.map((gift) => {
          const Icon = giftIcon(gift.name);
          return (
            <div key={gift.id} style={{ ...panelStyle, padding: 18 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: ui.brandSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={20} color={ui.brand} />
              </div>
              <strong style={{ display: 'block', fontSize: 15, margin: '12px 0 4px', color: ui.text }}>{gift.name}</strong>
              <p style={{ margin: 0, color: ui.brandText, fontWeight: 800, fontSize: 17 }}>{gift.points.toLocaleString('vi-VN')} điểm</p>
              <p style={{ margin: '6px 0 0', color: ui.textFaint, fontSize: 13 }}>Tồn kho: {gift.stock ?? 0}</p>
            </div>
          );
        })}
      </div>

      {/* Bảng tổng hợp */}
      <div style={{ ...panelStyle, padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Quà tặng', 'Điểm cần đổi', 'Tồn kho'].map((head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gifts.map((gift) => (
                <tr key={gift.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 700 }}>{gift.name}</td>
                  <td style={tableCellStyle}>{gift.points.toLocaleString('vi-VN')}</td>
                  <td style={tableCellStyle}>{gift.stock ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
