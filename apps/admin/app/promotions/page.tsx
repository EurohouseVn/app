'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Images, Megaphone } from 'lucide-react';
import type { Promotion } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, assetUrl } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../../src/ui';

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
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      {promotions.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 48, color: ui.textFaint, marginTop: 12 }}>
          <Megaphone size={28} color={ui.textFaint} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0 }}>Chưa có chương trình khuyến mãi nào.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginTop: 12 }}>
          {promotions.map((promo) => (
            <article key={promo.id} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              <img src={assetUrl(promo.imageUrl)} alt={promo.title} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ margin: 0, color: ui.text, fontSize: 18, fontWeight: 800 }}>{promo.title}</h2>
                  <span
                    style={{
                      background: promo.active ? ui.successSoft : ui.surfaceMuted,
                      color: promo.active ? ui.success : ui.textFaint,
                      borderRadius: 999,
                      padding: '4px 12px',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {promo.active ? 'Đang chạy' : 'Tắt'}
                  </span>
                </div>
                {promo.subtitle ? <p style={{ margin: '6px 0', color: ui.brandText, fontWeight: 700, fontSize: 13 }}>{promo.subtitle}</p> : null}
                {promo.content ? <p style={{ margin: '8px 0', color: ui.textMuted, lineHeight: 1.6, fontSize: 14 }}>{promo.content}</p> : null}
                <div style={{ display: 'flex', gap: 16, marginTop: 12, color: ui.textFaint, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Images size={14} /> {promo.gallery.length} ảnh poster
                  </span>
                  {promo.startDate ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CalendarRange size={14} /> {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
