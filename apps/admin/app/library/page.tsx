'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Image as ImageIcon, PlayCircle, Video } from 'lucide-react';
import type { LibraryItem } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, assetUrl } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../../src/ui';

const typeMeta: Record<LibraryItem['type'], { label: string; fg: string; soft: string; icon: typeof ImageIcon }> = {
  IMAGE: { label: 'Ảnh', fg: ui.brand, soft: ui.brandSoft, icon: ImageIcon },
  KNOWLEDGE: { label: 'Kiến thức', fg: ui.success, soft: ui.successSoft, icon: BookOpen },
  PRODUCT: { label: 'Sản phẩm', fg: ui.teal, soft: ui.tealSoft, icon: ImageIcon },
  VIDEO: { label: 'Video', fg: ui.danger, soft: ui.dangerSoft, icon: Video },
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
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '12px 0 20px' }}>
        {filters.map((option) => {
          const selected = filter === option.value;
          return (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              style={{
                border: `1px solid ${selected ? ui.brand : ui.borderStrong}`,
                background: selected ? ui.brandSoft : ui.surface,
                color: selected ? ui.brandText : ui.text,
                borderRadius: 10,
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ ...panelStyle, textAlign: 'center', padding: 48, color: ui.textFaint }}>Chưa có nội dung phù hợp.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          {visible.map((item) => {
            const meta = typeMeta[item.type];
            const Icon = meta?.icon ?? ImageIcon;
            return (
              <article key={item.id} style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                {item.imageUrl ? (
                  <img src={assetUrl(item.imageUrl)} alt={item.title} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 160, background: meta?.soft ?? ui.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.type === 'VIDEO' ? <PlayCircle size={36} color={meta?.fg} /> : <Icon size={32} color={meta?.fg} />}
                  </div>
                )}
                <div style={{ padding: 16 }}>
                  <span style={{ color: meta?.fg, fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon size={13} /> {meta?.label ?? item.type}
                  </span>
                  <strong style={{ display: 'block', margin: '8px 0 4px', color: ui.text, fontSize: 14 }}>{item.title}</strong>
                  {item.tag ? <small style={{ color: ui.textFaint }}>#{item.tag}</small> : null}
                  {item.videoUrl ? (
                    <p style={{ margin: '8px 0 0' }}>
                      <a href={item.videoUrl} target="_blank" rel="noreferrer" style={{ color: ui.brandText, fontWeight: 700, fontSize: 13 }}>
                        Mở video →
                      </a>
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
