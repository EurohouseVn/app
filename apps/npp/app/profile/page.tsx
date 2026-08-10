'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, UserCircle, Image as ImageIcon, MapPin, Phone, Mail, Globe, Hammer } from 'lucide-react';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../../src/ui';

export default function NppProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  const [form, setForm] = useState({
    productionName: '',
    logoUrl: '',
    address: '',
    phone: '',
    email: '',
    fanpage: '',
    mainCategories: ''
  });

  useEffect(() => {
    apiGet<any>('/npp/profile')
      .then(res => {
        if (res) {
          setForm({
            productionName: res.productionName || res.name || '',
            logoUrl: res.logoUrl || '',
            address: res.address || '',
            phone: res.phone || '',
            email: res.email || '',
            fanpage: res.fanpage || '',
            mainCategories: res.mainCategories || ''
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage('Lỗi tải thông tin cấu hình.');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await apiSend('/npp/profile', 'PUT', form);
      setMessage('Lưu cấu hình thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Lỗi khi lưu cấu hình.');
    }
    setSaving(false);
  };

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${ui.border}`,
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff'
  };

  const labelStyle = {
    display: 'flex',
    fontSize: 13,
    fontWeight: 600,
    color: ui.textMuted,
    marginBottom: 6,
    alignItems: 'center',
    gap: 6
  };

  return (
    <NppPage>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={eyebrowStyle}>ACCOUNT</p>
          <h1 style={pageTitleStyle}>Cấu hình Tài khoản & Báo giá</h1>
          <p style={subtitleStyle}>Thông tin này sẽ được hiển thị trên tiêu đề của file xuất PDF Báo giá.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || loading}
          style={{ background: ui.brand, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: (saving || loading) ? 'not-allowed' : 'pointer', opacity: (saving || loading) ? 0.7 : 1 }}>
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
        </button>
      </div>

      {message && (
        <p style={{ color: message.includes('Lỗi') ? ui.danger : ui.success, fontWeight: 700, background: message.includes('Lỗi') ? ui.dangerSoft : ui.successSoft, display: 'inline-block', padding: '8px 16px', borderRadius: 8, fontSize: 13, marginTop: 16 }}>
          {message}
        </p>
      )}

      {loading ? (
        <p style={{ marginTop: 24, color: ui.textMuted }}>Đang tải dữ liệu...</p>
      ) : (
        <div style={{ ...panelStyle, marginTop: 24, padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}><UserCircle size={16} /> Tên cơ sở sản xuất / Đại lý</label>
            <input 
              value={form.productionName} 
              onChange={e => update('productionName', e.target.value)} 
              placeholder="VD: NHÔM KÍNH TIẾN MẠNH"
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}><ImageIcon size={16} /> Link Ảnh Logo (Tùy chọn)</label>
            <input 
              value={form.logoUrl} 
              onChange={e => update('logoUrl', e.target.value)} 
              placeholder="VD: https://example.com/logo.png"
              style={inputStyle} 
            />
            {form.logoUrl && (
              <img src={form.logoUrl} alt="Logo Preview" style={{ marginTop: 12, height: 60, objectFit: 'contain', border: `1px dashed ${ui.border}`, borderRadius: 8, padding: 4 }} />
            )}
          </div>

          <div>
            <label style={labelStyle}><Hammer size={16} /> Hạng mục thi công chính</label>
            <input 
              value={form.mainCategories} 
              onChange={e => update('mainCategories', e.target.value)} 
              placeholder="VD: Thiết kế, thi công các hạng mục nhôm kính cao cấp..."
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}><MapPin size={16} /> Địa chỉ</label>
            <input 
              value={form.address} 
              onChange={e => update('address', e.target.value)} 
              placeholder="VD: TAO HOA - TRUNG KENH - BAC NINH"
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}><Phone size={16} /> Số điện thoại</label>
            <input 
              value={form.phone} 
              onChange={e => update('phone', e.target.value)} 
              placeholder="VD: 0966422381"
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}><Mail size={16} /> Email</label>
            <input 
              value={form.email} 
              onChange={e => update('email', e.target.value)} 
              placeholder="VD: lienhe@tienmanh.com"
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}><Globe size={16} /> Fanpage / Website</label>
            <input 
              value={form.fanpage} 
              onChange={e => update('fanpage', e.target.value)} 
              placeholder="VD: fb.com/nhomkinhtienmanh"
              style={inputStyle} 
            />
          </div>

        </div>
      )}
    </NppPage>
  );
}
