'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, primaryButtonStyle, ghostButtonStyle, subtitleStyle } from '../../../src/ui';

interface SaleReport {
  id: string;
  type: string;
  date: string;
  content: string;
  createdBy: { displayName: string };
  createdAt: string;
}

export default function SaleReportsPage() {
  const [reports, setReports] = useState<SaleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [type, setType] = useState('DAILY');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const data = await apiGet<SaleReport[]>('/admin/sales/reports');
      setReports(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content) return;
    setSaving(true);
    try {
      await apiSend('/admin/sales/reports', 'POST', { type, date, content });
      setShowModal(false);
      setContent('');
      await fetchReports();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Báo cáo Công việc</h1>
          <p style={subtitleStyle}>Nộp và theo dõi báo cáo ngày/tuần</p>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryButtonStyle}>+ Nộp báo cáo</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && reports.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</div>
        ) : reports.length === 0 ? (
          <div style={{ ...panelStyle, textAlign: 'center', color: ui.textMuted }}>Chưa có báo cáo nào.</div>
        ) : reports.map(r => (
          <div key={r.id} style={{ ...panelStyle, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: ui.brandSoft, color: ui.brandText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {r.createdBy.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: ui.text }}>{r.createdBy.displayName}</div>
                  <div style={{ fontSize: 12, color: ui.textMuted }}>
                    {new Intl.DateTimeFormat('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.date))} • {r.type === 'DAILY' ? 'Báo cáo Ngày' : 'Báo cáo Tuần'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: ui.textFaint }}>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(r.createdAt))}</div>
            </div>
            <div style={{ padding: 12, background: ui.surfaceMuted, borderRadius: 8, color: ui.text, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {r.content}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...panelStyle, width: 500 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: ui.text }}>Nộp Báo Cáo</h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Loại báo cáo</label>
                  <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}>
                    <option value="DAILY">Báo cáo Ngày</option>
                    <option value="WEEKLY">Báo cáo Tuần</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Ngày</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Nội dung báo cáo <span style={{color: ui.danger}}>*</span></label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none', resize: 'vertical' }}
                  placeholder="Hôm nay tôi đã làm những gì..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostButtonStyle}>Hủy</button>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? 'Đang gửi...' : 'Gửi Báo Cáo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
