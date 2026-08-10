'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../../src/lib/api';
import { Plus, Trash2, Image as ImageIcon, Video } from 'lucide-react';
import { pageTitleStyle, eyebrowStyle, glassPanelStyle, ui } from '../../src/ui';

export default function LibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiGet<any[]>('/content/admin/library');
      setItems(data);
    } catch (e) {
      console.error(e);
      alert('Lỗi tải danh sách thư viện');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const title = prompt('Tiêu đề media:');
    if (!title) return;
    
    try {
      await apiPost('/content/admin/library', {
        title,
        mediaUrl: '/images/placeholder.jpg', // Should be replaced with actual file upload in a real app
        mediaType: 'IMAGE',
        categoryId: 'PROJECT_IMAGE'
      });
      loadItems();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi tạo mới');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá?')) return;
    try {
      await apiDelete(`/content/admin/library/${id}`);
      loadItems();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xoá');
    }
  };

  return (
    <div>
      <p style={eyebrowStyle}>MARKETING</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={pageTitleStyle}>Thư viện Hình ảnh / Video</h1>
        <button
          onClick={handleCreate}
          style={{
            background: ui.brand, color: '#fff', border: 'none', padding: '10px 20px',
            borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: 600
          }}
        >
          <Plus size={18} />
          Thêm Media
        </button>
      </div>

      <div style={{ ...glassPanelStyle, marginTop: 24, padding: 24 }}>
        {loading ? <p>Đang tải...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 20 }}>
            {items.map(item => (
              <div key={item.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 12, overflow: 'hidden', background: ui.surface }}>
                <div style={{ height: 160, background: ui.surfaceMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.mediaType === 'VIDEO' ? <Video size={48} color={ui.textFaint} /> : <ImageIcon size={48} color={ui.textFaint} />}
                </div>
                <div style={{ padding: 16 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: ui.text }}>{item.title}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: ui.textMuted, background: ui.surfaceMuted, padding: '4px 8px', borderRadius: 4 }}>
                      {item.categoryId}
                    </span>
                    <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: ui.danger, cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p style={{ color: ui.textMuted, gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0' }}>Không có dữ liệu</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
