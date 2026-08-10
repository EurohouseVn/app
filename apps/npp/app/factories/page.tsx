'use client';

import { useEffect, useState } from 'react';
import { Copy, Factory, Plus } from 'lucide-react';
import type { CreateNppFactoryInput, NppFactoryItem } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const emptyForm: CreateNppFactoryInput = { name: '', phone: '', address: '', province: '', email: '', shortLabel: '' };

export default function NppFactoriesPage() {
  const [factories, setFactories] = useState<NppFactoryItem[]>([]);
  const [form, setForm] = useState<CreateNppFactoryInput>(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    apiGet<NppFactoryItem[]>('/npp/factories').then(setFactories).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được cơ sở sản xuất.'));
  }

  useEffect(() => { load(); }, []);

  function update<K extends keyof CreateNppFactoryInput>(key: K, value: CreateNppFactoryInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createFactory() {
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const created = await apiSend<NppFactoryItem>('/npp/factories', 'POST', form);
      setForm(emptyForm);
      setMessage(`Đã tạo CSSX ${created.name}. Mã kích hoạt: ${created.code}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được cơ sở sản xuất.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard?.writeText(code);
    setMessage(`Đã copy mã ${code}.`);
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>CƠ SỞ SẢN XUẤT</p>
      <h1 style={pageTitleStyle}>Quản lý CSSX do NPP phụ trách</h1>
      <p style={subtitleStyle}>Tạo mã kích hoạt cho từng xưởng. Khi xưởng đăng ký app mobile bằng mã này, đơn hàng sẽ tự chuyển về NPP của bạn.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start', marginTop: 18 }}>
        <div style={panelStyle}>
          <h2 style={{ margin: '0 0 16px', color: ui.text, fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Factory size={18} /> Tạo CSSX mới</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>Tên cơ sở sản xuất<input style={inputStyle} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="VD: Nhôm kính Minh Việt" /></label>
            <label style={labelStyle}>Số điện thoại<input style={inputStyle} value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="09..." /></label>
            <label style={labelStyle}>Tỉnh/Thành<input style={inputStyle} value={form.province} onChange={(e) => update('province', e.target.value)} placeholder="VD: Bắc Ninh" /></label>
            <label style={labelStyle}>Địa chỉ<input style={inputStyle} value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Địa chỉ xưởng" /></label>
            <label style={labelStyle}>Email<input style={inputStyle} value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@..." /></label>
            <label style={labelStyle}>Ký hiệu ngắn<input style={inputStyle} value={form.shortLabel} onChange={(e) => update('shortLabel', e.target.value)} placeholder="VD: MV" /></label>
            <button disabled={saving} onClick={createFactory} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}><Plus size={15} /> Tạo và sinh mã CSSX</button>
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['CSSX', 'Mã kích hoạt', 'Liên hệ', 'Tài khoản'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {factories.map((factory) => (
                  <tr key={factory.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 700 }}>
                      {factory.name}
                      <div style={{ color: ui.textFaint, fontSize: 12, fontWeight: 500 }}>{factory.address || factory.province || 'Chưa cập nhật địa chỉ'}</div>
                    </td>
                    <td style={tableCellStyle}>
                      <button onClick={() => copyCode(factory.code)} style={{ ...ghostButtonStyle, padding: '7px 10px', fontSize: 13 }}>
                        <Copy size={14} /> {factory.code}
                      </button>
                    </td>
                    <td style={tableCellStyle}>{factory.phone || factory.email || 'Chưa cập nhật'}</td>
                    <td style={tableCellStyle}>{factory.userCount}</td>
                  </tr>
                ))}
                {factories.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có cơ sở sản xuất nào.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </NppPage>
  );
}
