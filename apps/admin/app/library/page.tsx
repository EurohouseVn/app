'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Image as ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { getToken } from '../../src/auth';
import { apiDelete, apiGet, apiUrl, assetUrl } from '../../src/lib/api';
import { eyebrowStyle, glassPanelStyle, pageTitleStyle, ui } from '../../src/ui';

type LibraryItem = {
  id: string;
  title: string;
  description?: string | null;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  categoryId: string;
  createdAt: string;
};

export default function LibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [catalogTitle, setCatalogTitle] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [catalogFile, setCatalogFile] = useState<File | null>(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      setItems(await apiGet<LibraryItem[]>('/content/admin/library'));
    } catch (error) {
      console.error(error);
      alert('Không tải được danh sách thư viện.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const uploadCatalog = async () => {
    if (!catalogFile) {
      alert('Vui lòng chọn file catalog PDF.');
      return;
    }
    if (catalogFile.type !== 'application/pdf' && !catalogFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Chỉ chấp nhận file PDF.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', catalogFile);
      formData.append('title', catalogTitle.trim());
      formData.append('description', catalogDescription.trim());
      const response = await fetch(`${apiUrl}/content/admin/library/catalog`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() || ''}` },
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || `Tải catalog thất bại (${response.status})`);

      setCatalogTitle('');
      setCatalogDescription('');
      setCatalogFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadItems();
      alert('Đã tải catalog lên hệ thống.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Không tải được catalog.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá nội dung này khỏi thư viện?')) return;
    try {
      await apiDelete(`/content/admin/library/${id}`);
      await loadItems();
    } catch (error) {
      console.error(error);
      alert('Không xoá được nội dung.');
    }
  };

  return (
    <div>
      <p style={eyebrowStyle}>NỘI DUNG DÙNG CHUNG</p>
      <h1 style={pageTitleStyle}>Thư viện & Catalog</h1>
      <p style={{ margin: '8px 0 0', color: ui.textMuted, maxWidth: 720 }}>
        Catalog PDF tải tại đây sẽ xuất hiện cho toàn bộ tài khoản CSSX trong ứng dụng Mobile.
      </p>

      <section style={{ ...glassPanelStyle, marginTop: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: '#FFF3E8', display: 'grid', placeItems: 'center' }}>
            <FileText size={21} color={ui.brand} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: ui.text }}>Tải catalog sản phẩm</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: ui.textMuted }}>PDF tối đa 30 MB, nên ghi rõ phiên bản phát hành.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1.4fr)', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, color: ui.text, fontSize: 13, fontWeight: 700 }}>
            Tên catalog
            <input
              value={catalogTitle}
              onChange={(event) => setCatalogTitle(event.target.value)}
              placeholder="Ví dụ: Catalog Eurohouse R19"
              style={{ minHeight: 42, border: `1px solid ${ui.border}`, borderRadius: 6, padding: '0 12px', color: ui.text, background: ui.surface }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, color: ui.text, fontSize: 13, fontWeight: 700 }}>
            Ghi chú / phiên bản
            <input
              value={catalogDescription}
              onChange={(event) => setCatalogDescription(event.target.value)}
              placeholder="Ngày phát hành, nội dung cập nhật..."
              style={{ minHeight: 42, border: `1px solid ${ui.border}`, borderRadius: 6, padding: '0 12px', color: ui.text, background: ui.surface }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setCatalogFile(event.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ minHeight: 42, border: `1px solid ${ui.border}`, borderRadius: 6, padding: '0 14px', background: ui.surface, color: ui.text, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FileText size={17} /> Chọn PDF
          </button>
          <span style={{ color: catalogFile ? ui.text : ui.textMuted, fontSize: 13, flex: 1, minWidth: 180 }}>
            {catalogFile ? `${catalogFile.name} · ${(catalogFile.size / 1024 / 1024).toFixed(1)} MB` : 'Chưa chọn file'}
          </span>
          <button
            type="button"
            disabled={uploading || !catalogFile}
            onClick={() => void uploadCatalog()}
            style={{ minHeight: 42, border: 0, borderRadius: 6, padding: '0 16px', background: ui.brand, color: '#fff', fontWeight: 800, cursor: uploading || !catalogFile ? 'not-allowed' : 'pointer', opacity: uploading || !catalogFile ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {uploading ? <Loader2 size={17} /> : <Upload size={17} />}
            {uploading ? 'Đang tải...' : 'Đăng catalog'}
          </button>
        </div>
      </section>

      <section style={{ ...glassPanelStyle, marginTop: 20, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: ui.text }}>Nội dung đã đăng</h2>
          <span style={{ color: ui.textMuted, fontSize: 13 }}>{items.length} mục</span>
        </div>
        {loading ? <p>Đang tải...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {items.map((item) => (
              <article key={item.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 8, overflow: 'hidden', background: ui.surface }}>
                <div style={{ height: 112, background: item.mediaType === 'DOCUMENT' ? '#FFF3E8' : ui.surfaceMuted, display: 'grid', placeItems: 'center' }}>
                  {item.mediaType === 'DOCUMENT' ? <FileText size={38} color={ui.brand} /> : item.mediaType === 'VIDEO' ? <Video size={38} color={ui.textFaint} /> : <ImageIcon size={38} color={ui.textFaint} />}
                </div>
                <div style={{ padding: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: ui.text }}>{item.title}</h3>
                  {item.description ? <p style={{ margin: '6px 0 0', color: ui.textMuted, fontSize: 12, lineHeight: 1.45 }}>{item.description}</p> : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 14 }}>
                    <span style={{ fontSize: 11, color: ui.textMuted, background: ui.surfaceMuted, padding: '4px 7px', borderRadius: 4 }}>
                      {item.categoryId === 'PRODUCT_CATALOG' ? 'CATALOG PDF' : item.categoryId}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <a href={assetUrl(item.mediaUrl)} target="_blank" rel="noreferrer" title="Mở nội dung" style={{ color: ui.brand, display: 'grid', placeItems: 'center', padding: 7 }}>
                        <ExternalLink size={17} />
                      </a>
                      <button type="button" onClick={() => void handleDelete(item.id)} title="Xoá" style={{ background: 'none', border: 0, color: ui.danger, cursor: 'pointer', padding: 7, display: 'grid', placeItems: 'center' }}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {items.length === 0 ? <p style={{ color: ui.textMuted }}>Chưa có nội dung thư viện.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
