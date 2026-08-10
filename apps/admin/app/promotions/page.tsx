'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, apiUrl, assetUrl } from '../../src/lib/api';
import { Plus, Trash2, Edit, ImagePlus, Loader2 } from 'lucide-react';
import { pageTitleStyle, eyebrowStyle, glassPanelStyle, ui } from '../../src/ui';

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await apiGet<any[]>('/content/admin/promotions');
      setPromotions(data);
    } catch (e) {
      console.error(e);
      alert('Lỗi tải danh sách khuyến mãi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const title = prompt('Tiêu đề khuyến mãi:');
    if (!title) return;
    const desc = prompt('Mô tả:');
    
    try {
      await apiPost('/content/admin/promotions', {
        title,
        description: desc || '',
        imageUrl: '',
        active: true,
        targetAudience: 'ALL'
      });
      loadPromotions();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi tạo mới');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá?')) return;
    try {
      await apiDelete(`/content/admin/promotions/${id}`);
      loadPromotions();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xoá');
    }
  };

  const handleUploadClick = (id: string) => {
    setPendingUploadId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !pendingUploadId) return;

    try {
      setUploadingImage(pendingUploadId);
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const { getToken } = await import('../../src/auth');
      const token = getToken();
      
      const res = await fetch(`${apiUrl}/content/admin/promotions/${pendingUploadId}/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('Upload image failed');
      
      alert('Tải ảnh lên thành công!');
      loadPromotions();
    } catch (e) {
      console.error(e);
      alert('Lỗi tải ảnh');
    } finally {
      setUploadingImage(null);
      setPendingUploadId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearImages = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá tất cả ảnh của khuyến mãi này?')) return;
    try {
      await apiDelete(`/content/admin/promotions/${id}/image`);
      alert('Đã xoá ảnh thành công!');
      loadPromotions();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi xoá ảnh');
    }
  };

  return (
    <div>
      <p style={eyebrowStyle}>MARKETING</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={pageTitleStyle}>Khuyến mãi</h1>
        <button
          onClick={handleCreate}
          style={{
            background: ui.brand, color: '#fff', border: 'none', padding: '10px 20px',
            borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: 600
          }}
        >
          <Plus size={18} />
          Thêm mới
        </button>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={handleFileChange}
      />

      <div style={{ ...glassPanelStyle, marginTop: 24, padding: 24 }}>
        {loading ? <p>Đang tải...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ui.border}` }}>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted, width: 80 }}>Ảnh</th>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted }}>Tiêu đề</th>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted }}>Đối tượng</th>
                <th style={{ textAlign: 'left', padding: '12px 0', color: ui.textMuted }}>Trạng thái</th>
                <th style={{ textAlign: 'right', padding: '12px 0', color: ui.textMuted }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${ui.border}` }}>
                  <td style={{ padding: '16px 0' }}>
                    {p.imageUrl ? (
                      <img src={assetUrl(p.imageUrl)} alt={p.title} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, background: ui.surfaceHover, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, color: ui.textMuted }}>Trống</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 0', fontWeight: 600 }}>{p.title}</td>
                  <td style={{ padding: '16px 0' }}>{p.targetAudience}</td>
                  <td style={{ padding: '16px 0' }}>
                    <span style={{ 
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: p.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: p.active ? '#16a34a' : '#dc2626'
                    }}>
                      {p.active ? 'Đang chạy' : 'Đã dừng'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button 
                        onClick={() => handleUploadClick(p.id)} 
                        disabled={uploadingImage === p.id}
                        style={{ background: 'none', border: 'none', color: ui.brand, cursor: uploadingImage === p.id ? 'not-allowed' : 'pointer', padding: 8 }}
                        title="Tải ảnh lên (Thay thế ảnh cũ)"
                      >
                        {uploadingImage === p.id ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                      </button>
                      {p.imageUrl && (
                        <button onClick={() => handleClearImages(p.id)} style={{ background: 'none', border: 'none', color: ui.textMuted, cursor: 'pointer', padding: 8 }} title="Xoá toàn bộ ảnh">
                          <Trash2 size={18} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'none', border: 'none', color: ui.danger, cursor: 'pointer', padding: 8 }} title="Xoá khuyến mãi">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {promotions.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: ui.textMuted }}>Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
