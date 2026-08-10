'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, subtitleStyle, ghostButtonStyle, primaryButtonStyle, chipStyle } from '../../../src/ui';

interface WorkOrderStep {
  id: string;
  stepName: string;
  status: string;
  inputKg: number;
  outputKg: number;
  scrapKg: number;
}

interface WorkOrder {
  id: string;
  code: string;
  profile: { code: string; name: string };
  die: { code: string } | null;
  targetKg: number;
  actualKg: number;
  scrapKg: number;
  status: string;
  steps: WorkOrderStep[];
}

interface Profile { id: string; code: string; name: string; }
interface Die { id: string; code: string; profileId: string; }

export default function WorkOrdersPage() {
  const [wos, setWos] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dies, setDies] = useState<Die[]>([]);
  const [profileId, setProfileId] = useState('');
  const [dieId, setDieId] = useState('');
  const [targetKg, setTargetKg] = useState(0);
  const [colorCode, setColorCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [wData, pData, dData] = await Promise.all([
        apiGet<WorkOrder[]>('/admin/production/work-orders'),
        apiGet<Profile[]>('/admin/catalog/profiles'), // Lấy danh sách profile
        apiGet<Die[]>('/admin/production/dies'),
      ]);
      setWos(wData);
      setProfiles(pData);
      setDies(dData);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setProfileId('');
    setDieId('');
    setTargetKg(0);
    setColorCode('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiSend('/admin/production/work-orders', 'POST', { profileId, dieId, targetKg, colorCode });
      setShowModal(false);
      await fetchData();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function renderStatus(st: string) {
    if (st === 'PENDING') return <span style={chipStyle('brandBlack')}>Chờ SX</span>;
    if (st === 'IN_PROGRESS') return <span style={chipStyle('warning')}>Đang SX</span>;
    if (st === 'COMPLETED') return <span style={chipStyle('success')}>Hoàn thành</span>;
    if (st === 'CANCELLED') return <span style={chipStyle('danger')}>Đã hủy</span>;
    return st;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Lệnh Sản Xuất (Work Orders)</h1>
          <p style={subtitleStyle}>Quản lý các lệnh đùn ép, hóa già, sơn, đóng gói</p>
        </div>
        <button onClick={handleCreate} style={primaryButtonStyle}>+ Tạo Lệnh Sản Xuất</button>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Mã WO</th>
              <th style={tableHeadStyle}>Mã nhôm</th>
              <th style={tableHeadStyle}>Khuôn đùn</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Mục tiêu</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thực đạt</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Hao hụt (Scrap)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading && wos.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</td></tr>
            ) : wos.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Chưa có lệnh sản xuất.</td></tr>
            ) : wos.map((wo) => {
              const yieldRate = (wo.actualKg > 0 || wo.scrapKg > 0) ? (wo.actualKg / (wo.actualKg + wo.scrapKg) * 100).toFixed(1) : '0.0';
              return (
                <tr key={wo.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.brandText }}>{wo.code}</td>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>{wo.profile.code} <div style={{ fontSize: 12, fontWeight: 400, color: ui.textMuted }}>{wo.profile.name}</div></td>
                  <td style={tableCellStyle}>{wo.die?.code || '-'}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600 }}>{wo.targetKg.toLocaleString('vi-VN')} kg</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', color: ui.success, fontWeight: 700 }}>{wo.actualKg.toLocaleString('vi-VN')} kg</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', color: ui.danger }}>
                    {wo.scrapKg.toLocaleString('vi-VN')} kg
                    <div style={{ fontSize: 11, color: ui.textMuted }}>Yield: {yieldRate}%</div>
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>{renderStatus(wo.status)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...panelStyle, width: 500 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: ui.text }}>Tạo Lệnh Sản Xuất</h2>
            <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Mã nhôm (Profile) <span style={{color: ui.danger}}>*</span></label>
                <select required value={profileId} onChange={e => setProfileId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}>
                  <option value="">-- Chọn mã nhôm --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Khuôn đùn (Die)</label>
                <select value={dieId} onChange={e => setDieId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}>
                  <option value="">-- Chọn khuôn (tùy chọn) --</option>
                  {dies.filter(d => !profileId || d.profileId === profileId).map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Mục tiêu sản xuất (Kg) <span style={{color: ui.danger}}>*</span></label>
                  <input type="number" required value={targetKg} onChange={e => setTargetKg(Number(e.target.value))} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Mã màu sơn</label>
                  <input value={colorCode} onChange={e => setColorCode(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostButtonStyle}>Hủy</button>
                <button type="submit" disabled={saving || !profileId} style={primaryButtonStyle}>{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
