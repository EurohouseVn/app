'use client';

import { useEffect, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { Promotion } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, assetUrl } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN');
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<Promotion[]>('/promotions').then(setPromotions).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải khuyến mãi.'));
  }, []);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>KHUYẾN MÃI</p>
      <h1 style={pageTitleStyle}>Chương trình khuyến mãi</h1>
      <p style={subtitleStyle}>Các chương trình đang chạy hiển thị trên app của thợ, đại lý và NPP.</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      {promotions.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 48, color: colors.brandGrey, marginTop: 12 }}>
          Chưa có chương trình khuyến mãi nào.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginTop: 12 }}>
          {promotions.map((promo) => (
            <article key={promo.id} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              <img src={assetUrl(promo.imageUrl)} alt={promo.title} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, color: colors.brandBlack, fontSize: 20 }}>{promo.title}</h2>
                  <span
                    style={{
                      background: promo.active ? colors.success : colors.brandGrey,
                      color: colors.white,
                      borderRadius: 999,
                      padding: '4px 12px',
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {promo.active ? 'Đang chạy' : 'Tắt'}
                  </span>
                </div>
                {promo.subtitle ? <p style={{ margin: '6px 0', color: colors.brandOrange, fontWeight: 700 }}>{promo.subtitle}</p> : null}
                {promo.content ? <p style={{ margin: '8px 0', color: colors.brandBlack, lineHeight: 1.6 }}>{promo.content}</p> : null}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, color: colors.brandGrey, fontSize: 13 }}>
                  <span>🖼 {promo.gallery.length} ảnh poster</span>
                  {promo.startDate ? <span>📅 {formatDate(promo.startDate)} – {formatDate(promo.endDate)}</span> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
