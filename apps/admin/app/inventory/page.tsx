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
  pricePerKg: number;
};

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
    }).catch((e) => setError(e instanceof Error ? e.message : 'Khong tai duoc du lieu kho.'));
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
    const totalKg = lines.reduce((sum, line) => sum + line.quantity * line.kgPerMeter * 6.5, 0);
    const totalAmount = lines.reduce((sum, line) => sum + Math.round(line.quantity * line.kgPerMeter * 6.5 * line.pricePerKg), 0);
    return { totalBars, totalKg, totalAmount };
  }, [lines]);

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
        pricePerKg: selectedProfile.pricePerKg,
      },
    ]);
  }

  async function createShipment() {
    setError('');
    setMessage('');
    if (!nppOrgId) {
      setError('Chon NPP nhan hang.');
      return;
    }
    if (!lines.length) {
      setError('Them it nhat mot dong hang.');
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
    };
    try {
      const created = await apiSend<{ code: string }>('/admin/npp-shipments', 'POST', body);
      setMessage(`Da tao phieu giao ${created.code}. NPP se thay trong Kho hang de xac nhan nhan du.`);
      setLines([]);
      setInvoiceNo('');
      setPoNo('');
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong tao duoc phieu giao NPP.');
    }
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={eyebrowStyle}>Kho NVL</p>
      <h1 style={pageTitleStyle}>Tao phieu giao hang ve NPP</h1>
      <p style={subtitleStyle}>WebAdmin tao phieu xuat, NPP chi cap nhat kho rieng sau khi bam xac nhan nhan du hang.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.35fr', gap: 20, alignItems: 'start', marginTop: 18 }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Warehouse size={18} color={ui.brand} /> Thong tin phieu</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={labelStyle}>NPP nhan hang
              <select style={inputStyle} value={nppOrgId} onChange={(e) => setNppOrgId(e.target.value)}>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.code} - {org.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>So hoa don<input style={inputStyle} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Nhap so hoa don neu co" /></label>
            <label style={labelStyle}>So PO<input style={inputStyle} value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="Nhap ma don noi bo" /></label>
            <label style={labelStyle}>Ghi chu<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chu giao hang" /></label>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><PackagePlus size={18} color={ui.brand} /> Them dong hang</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) auto', gap: 10, alignItems: 'end' }}>
            <label style={labelStyle}>He nhom
              <select style={inputStyle} value={systemId} onChange={(e) => setSystemId(e.target.value)}>
                {systems.map((system) => <option key={system.id} value={system.id}>{system.code}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Ma thanh
              <select style={inputStyle} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                {(selectedSystem?.profiles ?? []).map((profile: CatalogProfile) => <option key={profile.id} value={profile.id}>{profile.code}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Mau
              <select style={inputStyle} value={colorCode} onChange={(e) => setColorCode(e.target.value)}>
                {colors.map((color) => <option key={color.id} value={color.code}>{color.name}</option>)}
              </select>
            </label>
            <label style={labelStyle}>So cay<input style={inputStyle} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" /></label>
            <label style={labelStyle}>Ten hang<input style={{ ...inputStyle, background: ui.surfaceMuted }} value={selectedProfile?.name ?? ''} readOnly placeholder="Ten thanh" /></label>
            <button onClick={addLine} style={ghostButtonStyle}><Plus size={14} /> Them</button>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 18, padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Ma thanh', 'Ten hang', 'Mau', 'So cay', 'So kg', 'Gia tri', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const kg = line.quantity * line.kgPerMeter * 6.5;
                return (
                  <tr key={`${line.profileId}-${index}`}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{line.productCode}</td>
                    <td style={tableCellStyle}>{line.productName}</td>
                    <td style={tableCellStyle}>{colors.find((color) => color.code === line.colorCode)?.name ?? line.colorCode}</td>
                    <td style={tableCellStyle}>{line.quantity.toLocaleString('vi-VN')}</td>
                    <td style={tableCellStyle}>{kg.toFixed(1)} kg</td>
                    <td style={tableCellStyle}>{currency(Math.round(kg * line.pricePerKg))}</td>
                    <td style={tableCellStyle}><button onClick={() => setLines((current) => current.filter((_, i) => i !== index))} style={ghostButtonStyle}><Trash2 size={14} /> Xoa</button></td>
                  </tr>
                );
              })}
              {lines.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chua co dong hang.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: 16, borderTop: `1px solid ${ui.border}`, flexWrap: 'wrap' }}>
          <div style={{ color: ui.textMuted, fontSize: 14 }}>
            <strong style={{ color: ui.text }}>{totals.totalBars.toLocaleString('vi-VN')} cay</strong> · {totals.totalKg.toFixed(1)} kg · <strong style={{ color: ui.text }}>{currency(totals.totalAmount)}</strong>
          </div>
          <button onClick={createShipment} style={primaryButtonStyle}><Send size={15} /> Tao phieu giao NPP</button>
        </div>
      </section>
    </AdminShell>
  );
}
