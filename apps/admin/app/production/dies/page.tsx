'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, subtitleStyle, primaryButtonStyle, ghostButtonStyle, chipStyle } from '../../../src/ui';

interface Die {
  id: string;
  code: string;
  profile: { code: string; name: string } | null;
  status: string;
  totalExtrusions: number;
  totalKg: number;
  maintenanceAlert: number;
  location: string;
}

interface Profile { id: string; code: string; name: string; }

export default function DiesPage() {
  const [dies, setDies] = useState<Die[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [code, setCode] = useState('');
  const [profileId, setProfileId] = useState('');
  const [location, setLocation] = useState('');
  const [maintenanceAlert, setMaintenanceAlert] = useState(500);

  useEffect(() => {
    fetchDies();
  }, []);

  async function fetchDies() {
    setLoading(true);
    try {
      const [dData, pData] = await Promise.all([
        apiGet<Die[]>('/admin/production/dies'),
        apiGet<Profile[]>('/admin/catalog/profiles')
      ]);
      setDies(dData);
      setProfiles(pData);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiSend('/admin/production/dies', 'POST', { code, profileId, location, maintenanceAlert });
      setShowModal(false);
      setCode('');
      await fetchDies();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Quản Lý Khuôn Đùn (Dies)</h1>
          <p style={subtitleStyle}>Theo dõi tuổi thọ và cảnh báo bảo trì khuôn</p>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryButtonStyle}>+ Thêm Khuôn</button>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Mã Khuôn</th>
              <th style={tableHeadStyle}>Mã nhôm (Profile)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Số lần đùn</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Cảnh báo BT</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Tổng khối lượng</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading && dies.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</td></tr>
            ) : dies.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Chưa có khuôn.</td></tr>
            ) : dies.map((d) => {
              const needsMaintenance = d.totalExtrusions >= d.maintenanceAlert;
              return (
                <tr key={d.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 700 }}>
                    {d.code}
                    <div style={{ fontSize: 12, color: ui.textMuted, fontWeight: 400 }}>{d.location}</div>
                  </td>
                  <td style={tableCellStyle}>{d.profile?.code || '-'}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center', color: needsMaintenance ? ui.danger : ui.text, fontWeight: needsMaintenance ? 700 : 400 }}>
                    {d.totalExtrusions}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'center', color: ui.textMuted }}>{d.maintenanceAlert}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{d.totalKg.toLocaleString('vi-VN')} kg</td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                    {needsMaintenance ? <span style={chipStyle('danger')}>Cần bảo trì</span> : <span style={chipStyle('success')}>Hoạt động</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...panelStyle, width: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: ui.text }}>Thêm Khuôn Mới</h2>
            <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Mã khuôn <span style={{color: ui.danger}}>*</span></label>
                <input required value={code} onChange={e => setCode(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} placeholder="VD: K-1025-01" />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Dùng cho mã nhôm (Profile)</label>
                <select required value={profileId} onChange={e => setProfileId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}>
                  <option value="">-- Chọn mã nhôm --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Vị trí lưu kho</label>
                  <input value={location} onChange={e => setLocation(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Ngưỡng bảo trì</label>
                  <input type="number" value={maintenanceAlert} onChange={e => setMaintenanceAlert(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostButtonStyle}>Hủy</button>
                <button type="submit" style={primaryButtonStyle}>Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
