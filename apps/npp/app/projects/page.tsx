'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

export default function NppProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<any[]>('/projects');
      setProjects(data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không tải được danh sách công trình.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateOrderDraft = async (projectId: string, projectName: string) => {
    try {
      await apiSend<any>(`/projects/${projectId}/create-order-draft`, 'POST');
      alert(`Đã bóc tách nhôm từ công trình "${projectName}" thành công!`);
      router.push('/orders');
    } catch {
      alert('Lỗi bóc tách nhôm từ công trình.');
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.customerName && p.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <NppPage>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={eyebrowStyle}>Công trình</p>
          <h1 style={pageTitleStyle}>Quản lý công trình và đặt nhôm</h1>
          <p style={subtitleStyle}>Theo dõi tiến độ, doanh thu và bóc tách nhu cầu nhôm cây cho từng công trình.</p>
        </div>
      </div>

      {message ? (
        <p style={{ color: ui.danger, fontWeight: 700, background: ui.dangerSoft, padding: '8px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>
          {message}
        </p>
      ) : null}

      <div style={{ ...panelStyle, marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: ui.surfaceMuted, borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 320 }}>
            <Search size={16} color={ui.textMuted} />
            <input
              placeholder="Tìm tên công trình, mã, khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', padding: '10px 8px', fontSize: 14, width: '100%', color: ui.text }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Mã công trình</th>
              <th style={tableHeadStyle}>Tên công trình</th>
              <th style={tableHeadStyle}>Khách hàng</th>
              <th style={tableHeadStyle}>Dự toán / Giá trị</th>
              <th style={tableHeadStyle}>Trạng thái</th>
              <th style={tableHeadStyle}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tableCellStyle, fontWeight: 600, color: ui.brand }}>{p.code}</td>
                <td style={{ ...tableCellStyle, fontWeight: 600 }}>{p.name}</td>
                <td style={tableCellStyle}>
                  <div>{p.customerName || '---'}</div>
                  {p.customerPhone && <div style={{ fontSize: 12, color: ui.textMuted }}>{p.customerPhone}</div>}
                </td>
                <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.success }}>{currency(p.contractValue || p.estimatedValue || 0)}</td>
                <td style={tableCellStyle}>
                  <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                    {p.status || 'Đang mở'}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  <button
                    onClick={() => handleCreateOrderDraft(p.id, p.name)}
                    style={{ background: ui.brand, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12 }}
                  >
                    <ShoppingBag size={14} /> Bóc tách và đặt nhôm
                  </button>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: ui.textMuted }}>
                  Chưa có công trình nào. Bạn có thể bấm "Tạo công trình" từ màn hình Báo giá.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </NppPage>
  );
}
