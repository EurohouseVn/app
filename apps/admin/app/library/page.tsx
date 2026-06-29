'use client';

import { useEffect, useMemo, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { LibraryItem } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, assetUrl } from '../../src/lib/api';
import { eyebrowStyle, ghostButtonStyle, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

const typeMeta: Record<LibraryItem['type'], { label: string; color: string }> = {
  IMAGE: { label: 'Ảnh', color: colors.brandOrange },
  KNOWLEDGE: { label: 'Kiến thức', color: colors.success },
  PRODUCT: { label: 'Sản phẩm', color: colors.brandBlack },
  VIDEO: { label: 'Video', color: colors.brandRed },
};

const filters: { value: 'ALL' | LibraryItem['type']; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IMAGE', label: 'Ảnh' },
  { value: 'KNOWLEDGE', label: 'Kiến thức' },
  { value: 'PRODUCT', label: 'Sản phẩm' },
  { value: 'VIDEO', label: 'Video' },
];

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | LibraryItem['type']>('ALL');
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<LibraryItem[]>('/library').then(setItems).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải thư viện.'));
  }, []);

  const visible = useMemo(() => (filter === 'ALL' ? items : items.filter((item) => item.type === filter)), [items, filter]);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>THƯ VIỆN</p>
      <h1 style={pageTitleStyle}>Thư viện nội dung</h1>
      <p style={subtitleStyle}>Ảnh, kiến thức kỹ thuật và video hiển thị trong app cho thợ và đại lý.</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '12px 0 20px' }}>
        {filters.map((option) => {
          const selected = filter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{ ...ghostButtonStyle, background: selected ? colors.brandOrange : colors.white, fontWeight: 800 }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 48, color: colors.brandGrey }}>Chưa có nội dung phù hợp.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          {visible.map((item) => (
            <article key={item.id} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
              {item.imageUrl ? (
                <img src={assetUrl(item.imageUrl)} alt={item.title} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ height: 160, background: colors.orangeSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                  {item.type === 'VIDEO' ? '🎬' : item.type === 'KNOWLEDGE' ? '📘' : '🖼'}
                </div>
              )}
              <div style={{ padding: 16 }}>
                <span style={{ color: typeMeta[item.type]?.color, fontWeight: 900, fontSize: 12 }}>{typeMeta[item.type]?.label ?? item.type}</span>
                <strong style={{ display: 'block', margin: '6px 0 4px', color: colors.brandBlack }}>{item.title}</strong>
                {item.tag ? <small style={{ color: colors.brandGrey }}>#{item.tag}</small> : null}
                {item.videoUrl ? (
                  <p style={{ margin: '8px 0 0' }}>
                    <a href={item.videoUrl} target="_blank" rel="noreferrer" style={{ color: colors.brandOrange, fontWeight: 700 }}>
                      Mở video →
                    </a>
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
