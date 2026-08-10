'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, subtitleStyle, ghostButtonStyle, primaryButtonStyle, chipStyle } from '../../../src/ui';

interface Lead {
  id: string;
  name: string;
  address: string;
  province: string;
  phone: string;
  currentBrand: string;
  scale: string;
  potentialRating: number;
  status: string;
  managedBy: { displayName: string } | null;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [currentBrand, setCurrentBrand] = useState('');
  const [scale, setScale] = useState('');
  const [potentialRating, setPotentialRating] = useState(3);
  const [status, setStatus] = useState('NEW');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const data = await apiGet<Lead[]>('/admin/sales/leads');
      setLeads(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingId(null);
    setName('');
    setPhone('');
    setProvince('');
    setAddress('');
    setCurrentBrand('');
    setScale('');
    setPotentialRating(3);
    setStatus('NEW');
    setShowModal(true);
  }

  function handleEdit(l: Lead) {
    setEditingId(l.id);
    setName(l.name);
    setPhone(l.phone);
    setProvince(l.province);
    setAddress(l.address);
    setCurrentBrand(l.currentBrand);
    setScale(l.scale);
    setPotentialRating(l.potentialRating);
    setStatus(l.status);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, phone, province, address, currentBrand, scale, potentialRating, status };
      if (editingId) {
        await apiSend(`/admin/sales/leads/${editingId}`, 'PATCH', payload);
      } else {
        await apiSend('/admin/sales/leads', 'POST', payload);
      }
      setShowModal(false);
      await fetchLeads();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function renderStatus(st: string) {
    if (st === 'NEW') return <span style={chipStyle('brandBlack')}>Mới</span>;
    if (st === 'CONTACTED') return <span style={chipStyle('warning')}>Đang liên hệ</span>;
    if (st === 'CONVERTED') return <span style={chipStyle('success')}>Đã thành NPP</span>;
    if (st === 'REJECTED') return <span style={chipStyle('danger')}>Từ chối</span>;
    return st;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Xưởng & Đại Lý Tiềm Năng (Leads)</h1>
          <p style={subtitleStyle}>Quản lý danh sách khách hàng chưa ký kết hợp đồng</p>
        </div>
        <button onClick={handleCreate} style={primaryButtonStyle}>+ Thêm Lead</button>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Tên Cơ Sở</th>
              <th style={tableHeadStyle}>Khu vực</th>
              <th style={tableHeadStyle}>Hãng đang làm</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Đánh giá</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Trạng thái</th>
              <th style={tableHeadStyle}>NVKD Phụ trách</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && leads.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Chưa có dữ liệu Leads.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id}>
                <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.brandText }}>
                  {l.name}
                  <div style={{ fontSize: 12, color: ui.textMuted, fontWeight: 400, marginTop: 4 }}>{l.phone}</div>
                </td>
                <td style={tableCellStyle}>{l.province || '-'}</td>
                <td style={tableCellStyle}>{l.currentBrand || '-'}</td>
                <td style={{ ...tableCellStyle, textAlign: 'center', color: ui.warning, fontSize: 16 }}>
                  {'★'.repeat(l.potentialRating)}{'☆'.repeat(5 - l.potentialRating)}
                </td>
                <td style={{ ...tableCellStyle, textAlign: 'center' }}>{renderStatus(l.status)}</td>
                <td style={tableCellStyle}>{l.managedBy?.displayName || '-'}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                  <button onClick={() => handleEdit(l)} style={{ ...ghostButtonStyle, padding: '6px 12px', fontSize: 12 }}>Cập nhật</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...panelStyle, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: ui.text }}>{editingId ? 'Cập nhật Lead' : 'Thêm Lead mới'}</h2>
            <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Tên Cơ sở <span style={{color: ui.danger}}>*</span></label>
                  <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>SĐT</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Tỉnh/Thành phố</label>
                  <input value={province} onChange={e => setProvince(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Hãng nhôm đang dùng</label>
                  <input value={currentBrand} onChange={e => setCurrentBrand(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Đánh giá tiềm năng (1-5 Sao)</label>
                <input type="range" min={1} max={5} value={potentialRating} onChange={e => setPotentialRating(Number(e.target.value))} style={{ width: '100%', accentColor: ui.warning }} />
                <div style={{ textAlign: 'center', color: ui.warning, fontSize: 20, marginTop: 4 }}>{'★'.repeat(potentialRating)}{'☆'.repeat(5 - potentialRating)}</div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Trạng thái</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}>
                  <option value="NEW">Mới</option>
                  <option value="CONTACTED">Đang liên hệ/Chăm sóc</option>
                  <option value="CONVERTED">Đã thành công (Ký HĐ NPP)</option>
                  <option value="REJECTED">Từ chối/Hủy</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostButtonStyle}>Hủy</button>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
