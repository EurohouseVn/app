'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Send, Trash2, Warehouse } from 'lucide-react';
import type { CatalogProfile, CatalogSystem, ColorCode, CreateAdminToNppShipmentInput, OrgItem } from '@eurohouse/types';
import { AdminShell } from '../../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../../src/auth';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type ShipmentLine = {
  profileId: string;
  productCode: string;
  productName: string;
  colorCode: string;
  quantity: number;
  kgPerMeter: number;
  barLengthMm: number;
  pricePerKg: number;
};

function theoreticalKg(line: Pick<ShipmentLine, 'quantity' | 'kgPerMeter' | 'barLengthMm'>) {
  return line.quantity * line.kgPerMeter * (line.barLengthMm / 1000);
}

export default function InventoryPage() {
  const { user, ready, login, logout } = useDemoAuth();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [colors, setColors] = useState<ColorCode[]>([]);
  const [nppOrgId, setNppOrgId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<ShipmentLine[]>([]);
  const [actualTotalKg, setActualTotalKg] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiGet<OrgItem[]>('/admin/orgs'),
      apiGet<CatalogSystem[]>('/catalog/systems'),
      apiGet<ColorCode[]>('/catalog/colors'),
    ]).then(([orgItems, systemItems, colorItems]) => {
      const npps = orgItems.filter((org) => org.type === 'NPP');
      setOrgs(npps);
      setSystems(systemItems);
      setColors(colorItems);
      setNppOrgId((current) => current || npps[0]?.id || '');
      setSystemId((current) => current || systemItems[0]?.id || '');
      setProfileId((current) => current || systemItems[0]?.profiles[0]?.id || '');
      setColorCode((current) => current || colorItems[0]?.code || '');
    }).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được dữ liệu kho.'));
  }, [user]);

  const selectedSystem = systems.find((system) => system.id === systemId);
  const selectedProfile = selectedSystem?.profiles.find((profile) => profile.id === profileId) ?? systems.flatMap((system) => system.profiles).find((profile) => profile.id === profileId);

  useEffect(() => {
    if (selectedSystem && !selectedSystem.profiles.some((profile) => profile.id === profileId)) {
      setProfileId(selectedSystem.profiles[0]?.id || '');
    }
  }, [selectedSystem, profileId]);

  const totals = useMemo(() => {
    const totalBars = lines.reduce((sum, line) => sum + line.quantity, 0);
    const theoreticalTotalKg = lines.reduce((sum, line) => sum + theoreticalKg(line), 0);
    const theoreticalAmount = lines.reduce((sum, line) => sum + Math.round(theoreticalKg(line) * line.pricePerKg), 0);
    const finalKg = Number(actualTotalKg) > 0 ? Number(actualTotalKg) : theoreticalTotalKg;
    const avgPrice = theoreticalTotalKg > 0 ? theoreticalAmount / theoreticalTotalKg : 0;
    const totalAmount = Math.round(finalKg * avgPrice);
    return { totalBars, theoreticalTotalKg, finalKg, totalAmount };
  }, [lines, actualTotalKg]);

  function addLine() {
    setError('');
    if (!selectedProfile) {
      setError('Chon ma thanh can giao.');
      return;
    }
    const amount = Number(quantity);
    if (!amount || amount <= 0) {
      setError('Nhap so cay hop le.');
      return;
    }
    setLines((current) => [
      ...current,
      {
        profileId: selectedProfile.id,
        productCode: selectedProfile.code,
        productName: selectedProfile.name,
        colorCode,
        quantity: amount,
        kgPerMeter: selectedProfile.kgPerMeter,
        barLengthMm: selectedProfile.barLengthMm,
        pricePerKg: selectedProfile.pricePerKg,
      },
    ]);
  }

  async function createShipment() {
    setError('');
    setMessage('');
    if (!nppOrgId) {
      setError('Chọn NPP nhận hàng.');
      return;
    }
    if (!lines.length) {
      setError('Thêm ít nhất một dòng hàng.');
      return;
    }
    const body: CreateAdminToNppShipmentInput = {
      nppOrgId,
      invoiceNo,
      poNo,
      note,
      items: lines.map((line) => ({
        profileId: line.profileId,
        productCode: line.productCode,
        productName: line.productName,
        colorCode: line.colorCode,
        quantity: line.quantity,
        kgPerMeter: line.kgPerMeter,
      })),
      actualTotalKg: Number(actualTotalKg) > 0 ? Number(actualTotalKg) : undefined,
    };
    try {
      const created = await apiSend<{ code: string }>('/admin/npp-shipments', 'POST', body);
      setMessage(`Đã tạo phiếu giao ${created.code}. NPP sẽ thấy trong Kho hàng để xác nhận nhận đủ.`);
      setLines([]);
      setInvoiceNo('');
      setPoNo('');
      setNote('');
      setActualTotalKg('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được phiếu giao NPP.');
    }
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={eyebrowStyle}>Kho NVL</p>
      <h1 style={pageTitleStyle}>Tạo phiếu giao hàng về NPP</h1>
      <p style={subtitleStyle}>WebAdmin tạo phiếu xuất; NPP chỉ cập nhật kho riêng sau khi xác nhận đã nhận đủ hàng.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.35fr', gap: 20, alignItems: 'start', marginTop: 18 }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Warehouse size={18} color={ui.brand} /> Thông tin phiếu</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>NPP nhận hàng
              <select style={inputStyle} value={nppOrgId} onChange={(e) => setNppOrgId(e.target.value)}>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.code} - {org.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Số hóa đơn<input style={inputStyle} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Nhập số hóa đơn nếu có" /></label>
            <label style={labelStyle}>Số PO<input style={inputStyle} value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="Nhập mã đơn nội bộ" /></label>
            <label style={labelStyle}>Ghi chú<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú giao hàng" /></label>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><PackagePlus size={18} color={ui.brand} /> Thêm dòng hàng</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 10, alignItems: 'end' }}>
            <label style={labelStyle}>Hệ nhôm
              <select style={inputStyle} value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                {systems.map((system) => <option key={system.id} value={system.id}>{system.code}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Mã thanh
              <select style={inputStyle} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                {(selectedSystem?.profiles ?? []).map((profile: CatalogProfile) => <option key={profile.id} value={profile.id}>{profile.code}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Màu
              <select style={inputStyle} value={colorCode} onChange={(e) => setColorCode(e.target.value)}>
                {colors.map((color) => <option key={color.id} value={color.code}>{color.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Số cây<input style={inputStyle} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" /></label>
            <label style={labelStyle}>Tên hàng<input style={{ ...inputStyle, background: ui.surfaceMuted }} value={selectedProfile?.name ?? ''} readOnly placeholder="Tên thanh" /></label>
            <button onClick={addLine} style={ghostButtonStyle}><Plus size={14} /> Thêm</button>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 18, padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Mã thanh', 'Tên hàng', 'Màu', 'Số cây', 'Kg tạm tính', 'Giá trị tạm tính', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const kg = theoreticalKg(line);
                return (
                  <tr key={`${line.profileId}-${index}`}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{line.productCode}</td>
                    <td style={tableCellStyle}>{line.productName}</td>
                    <td style={tableCellStyle}>{colors.find((color) => color.code === line.colorCode)?.name ?? line.colorCode}</td>
                    <td style={tableCellStyle}>{line.quantity.toLocaleString('vi-VN')}</td>
                    <td style={tableCellStyle}>{kg.toFixed(1)} kg</td>
                    <td style={tableCellStyle}>{currency(Math.round(kg * line.pricePerKg))}</td>
                    <td style={tableCellStyle}><button onClick={() => setLines((current) => current.filter((_, i) => i !== index))} style={ghostButtonStyle}><Trash2 size={14} /> Xóa</button></td>
                  </tr>
                );
              })}
              {lines.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chưa có dòng hàng.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 16, borderTop: `1px solid ${ui.border}`, flexWrap: 'wrap' }}>
          <div style={{ color: ui.textMuted, fontSize: 14 }}>
            <label style={{ ...labelStyle, display: 'inline-grid', minWidth: 220, marginRight: 12 }}>Kg thực cân toàn phiếu
              <input style={inputStyle} type="number" step="0.1" value={actualTotalKg} onChange={(e) => setActualTotalKg(e.target.value)} placeholder={totals.theoreticalTotalKg.toFixed(1)} />
            </label>
            <strong style={{ color: ui.text }}>{totals.totalBars.toLocaleString('vi-VN')} cây</strong> · tạm tính {totals.theoreticalTotalKg.toFixed(1)} kg · thực cân {totals.finalKg.toFixed(1)} kg · <strong style={{ color: ui.text }}>{currency(totals.totalAmount)}</strong>
          </div>
          <button onClick={createShipment} style={primaryButtonStyle}><Send size={15} /> Tạo phiếu giao NPP</button>
        </div>
      </section>
    </AdminShell>
  );
}
