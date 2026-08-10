'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../src/lib/api';
import { Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { pageTitleStyle, eyebrowStyle, glassPanelStyle, ui } from '../../src/ui';

export default function KnowledgePage() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await apiGet<any[]>('/content/admin/knowledge');
      setArticles(data);
    } catch (e) {
      console.error(e);
      alert('Lỗi tải danh sách kiến thức');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const title = prompt('Tiêu đề bài viết:');
    if (!title) return;
    const desc = prompt('Mô tả/Nội dung ngắn:');
    
    try {
      await apiPost('/content/admin/knowledge', {
        title,
        description: desc || '',
        imageUrl: '',
        contentUrl: '',
        isShared: false
      });
      loadArticles();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi tạo mới');
    }
  };

  const handleToggleShare = async (id: string, currentShare: boolean) => {
    try {
      await apiPatch(`/content/admin/knowledge/${id}`, { isShared: !currentShare });
      loadArticles();
    } catch (e) {
      console.error(e);
      alert('Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá?')) return;
    try {
      await apiDelete(`/content/admin/knowledge/${id}`);
      loadArticles();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xoá');
    }
  };

  return (
    <div>
      <p style={eyebrowStyle}>MARKETING</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={pageTitleStyle}>Kiến thức</h1>
        <button
          onClick={handleCreate}
          style={{
            background: ui.brand, color: '#fff', border: 'none', padding: '10px 20px',
            borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: 600
          }}
        >
          <Plus size={18} />
          Thêm bài viết
        </button>
      </div>

      <div style={{ ...glassPanelStyle, marginTop: 24, padding: 24 }}>
        {loading ? <p>Đang tải...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ui.border}` }}>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted }}>Tiêu đề</th>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted }}>Chia sẻ App Thợ</th>
                <th style={{ textAlign: 'right', padding: '12px 0', color: ui.textMuted }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${ui.border}` }}>
                  <td style={{ padding: '16px 0', fontWeight: 600 }}>{a.title}</td>
                  <td style={{ padding: '16px 0' }}>
                    <button 
                      onClick={() => handleToggleShare(a.id, a.isShared)}
                      style={{ 
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: a.isShared ? '#16a34a' : ui.textMuted,
                        display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                      }}
                    >
                      {a.isShared ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      {a.isShared ? 'Đang chia sẻ' : 'Không chia sẻ'}
                    </button>
                  </td>
                  <td style={{ padding: '16px 0', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', color: ui.danger, cursor: 'pointer', padding: 8 }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {articles.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px 0', color: ui.textMuted }}>Không có bài viết nào</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
