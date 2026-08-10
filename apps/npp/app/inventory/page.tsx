'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, FileScan, History, Layers3, PackageCheck, Warehouse } from 'lucide-react';
import type { AdjustProfileStockInput, InventoryProfile, NppInboundShipment, ProfileStockMovementItem, StockDirection } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { chipStyle, currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type SystemGroup = {
  code: string;
  name: string;
  profiles: InventoryProfile[];
  stockBars: number;
};

function statusLabel(status: string) {
  if (status === 'ADMIN_SENT_NPP') return 'Cho NPP nhan';
  if (status === 'NPP_RECEIVED') return 'Da nhan du';
  return status;
}

export default function NppInventoryPage() {
  const [profiles, setProfiles] = useState<InventoryProfile[]>([]);
  const [inbound, setInbound] = useState<NppInboundShipment[]>([]);
  const [movements, setMovements] = useState<ProfileStockMovementItem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState('ALL');
  const [selected, setSelected] = useState<InventoryProfile | null>(null);
  const [direction, setDirection] = useState<StockDirection>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Nhap truc tiep ngoai luong');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function loadProfiles() {
    apiGet<InventoryProfile[]>('/npp/inventory/profiles')
      .then((items) => {
        setProfiles(items);
        setSelected((current) => current ? items.find((item) => item.id === current.id) ?? items[0] ?? null : items[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Khong tai duoc ton kho.'));
  }

  function loadInbound() {
    apiGet<NppInboundShipment[]>('/npp/inventory/inbound-shipments')
      .then(setInbound)
      .catch(() => setInbound([]));
  }

  function loadMovements(profileId?: string) {
    const query = profileId ? `?profileId=${profileId}` : '';
    apiGet<ProfileStockMovementItem[]>(`/npp/inventory/movements${query}`).then(setMovements).catch(() => setMovements([]));
  }

  function refreshAll(profileId = selected?.id) {
    loadProfiles();
    loadInbound();
    loadMovements(profileId);
  }

  useEffect(() => {
    refreshAll(undefined);
  }, []);

  useEffect(() => {
    loadMovements(selected?.id);
  }, [selected?.id]);

  const groups = useMemo<SystemGroup[]>(() => {
    const map = new Map<string, SystemGroup>();
    for (const profile of profiles) {
      const code = profile.systemCode || 'KHAC';
      const current = map.get(code) ?? { code, name: profile.systemName || code, profiles: [], stockBars: 0 };
      current.profiles.push(profile);
      current.stockBars += profile.stockBars;
      map.set(code, current);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [profiles]);

  const visibleProfiles = useMemo(() => {
    if (selectedSystem === 'ALL') return profiles;
    return profiles.filter((item) => (item.systemCode || 'KHAC') === selectedSystem);
  }, [profiles, selectedSystem]);

  const totals = useMemo(() => {
    const stockBars = profiles.reduce((sum, item) => sum + item.stockBars, 0);
    const lowCount = profiles.filter((item) => item.lowStockAlert !== undefined && item.lowStockAlert > 0 && item.stockBars <= item.lowStockAlert).length;
    const inboundPending = inbound.filter((item) => item.status === 'ADMIN_SENT_NPP').length;
    return { stockBars, lowCount, inboundPending };
  }, [profiles, inbound]);

  async function adjustStock() {
    if (!selected) return;
    const amount = Number(quantity);
    if (!amount || amount <= 0) {
      setError('Nhap so cay hop le.');
      return;
    }
    const body: AdjustProfileStockInput = { direction, quantity: amount, reason, note };
    setError('');
    setMessage('');
    try {
      await apiSend(`/npp/inventory/profiles/${selected.id}/stock-adjust`, 'POST', body);
      setMessage('Da ghi nhan xuat/nhap vao kho rieng cua NPP.');
      setQuantity('');
      setNote('');
      refreshAll(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong cap nhat duoc ton kho.');
    }
  }

  async function receiveShipment(shipment: NppInboundShipment) {
    setError('');
    setMessage('');
    try {
      await apiSend(`/npp/inventory/inbound-shipments/${shipment.id}/receive`, 'POST');
      setMessage(`Da xac nhan nhan du hang ${shipment.code}. Kho NPP da duoc cap nhat.`);
      refreshAll(selected?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong xac nhan duoc phieu nhap.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Kho hang NPP</p>
      <h1 style={pageTitleStyle}>Quan ly ton kho theo he nhom</h1>
      <p style={subtitleStyle}>Ton kho nay chi danh cho NPP. App CSSX khong hien so ton cua nha phan phoi.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
        <div style={{ ...panelStyle, padding: 18 }}><Warehouse size={18} color={ui.brand} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>Tong ton NPP</p><strong style={{ color: ui.text, fontSize: 24 }}>{totals.stockBars.toLocaleString('vi-VN')} cay</strong></div>
        <div style={{ ...panelStyle, padding: 18 }}><Layers3 size={18} color={ui.teal} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>He nhom</p><strong style={{ color: ui.text, fontSize: 24 }}>{groups.length}</strong></div>
        <div style={{ ...panelStyle, padding: 18 }}><PackageCheck size={18} color={ui.warning} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>Phieu cho nhan</p><strong style={{ color: totals.inboundPending ? ui.warning : ui.success, fontSize: 24 }}>{totals.inboundPending}</strong></div>
      </div>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, color: ui.text, fontSize: 18 }}>Phieu WebAdmin giao ve NPP</h2>
          <span style={{ color: ui.textFaint, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileScan size={14} /> OCR anh don hang se bo sung o buoc sau</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Ma phieu', 'Ngay tao', 'So cay', 'So kg', 'Gia tri', 'Trang thai', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {inbound.map((shipment) => {
                const bars = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
                const pending = shipment.status === 'ADMIN_SENT_NPP';
                return (
                  <tr key={shipment.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{shipment.code}</td>
                    <td style={tableCellStyle}>{new Date(shipment.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td style={tableCellStyle}>{bars.toLocaleString('vi-VN')} cay</td>
                    <td style={tableCellStyle}>{shipment.totalKg.toFixed(1)} kg</td>
                    <td style={tableCellStyle}>{currency(shipment.totalAmount)}</td>
                    <td style={tableCellStyle}><span style={chipStyle(pending ? 'warning' : 'success')}>{statusLabel(shipment.status)}</span></td>
                    <td style={tableCellStyle}>{pending ? <button onClick={() => receiveShipment(shipment)} style={ghostButtonStyle}><CheckCircle2 size={14} /> Xac nhan nhan du</button> : null}</td>
                  </tr>
                );
              })}
              {inbound.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chua co phieu WebAdmin giao ve NPP.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 12px', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedSystem('ALL')} style={{ ...ghostButtonStyle, background: selectedSystem === 'ALL' ? ui.brandSoft : ui.surface, color: selectedSystem === 'ALL' ? ui.brandText : ui.text }}>Tat ca</button>
        {groups.map((group) => (
          <button key={group.code} onClick={() => setSelectedSystem(group.code)} style={{ ...ghostButtonStyle, background: selectedSystem === group.code ? ui.brandSoft : ui.surface, color: selectedSystem === group.code ? ui.brandText : ui.text }}>
            {group.code} <span style={{ color: ui.textFaint }}>({group.stockBars})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.9fr', gap: 20, alignItems: 'start' }}>
        <section style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['He', 'Ma thanh', 'Ten thanh', 'Ton NPP', 'Canh bao'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {visibleProfiles.map((profile) => {
                  const low = (profile.lowStockAlert ?? 0) > 0 && profile.stockBars <= (profile.lowStockAlert ?? 0);
                  return (
                    <tr key={profile.id} onClick={() => setSelected(profile)} style={{ cursor: 'pointer', background: selected?.id === profile.id ? ui.brandSoft : 'transparent' }}>
                      <td style={tableCellStyle}>{profile.systemCode || '-'}</td>
                      <td style={{ ...tableCellStyle, fontWeight: 800 }}>{profile.code}</td>
                      <td style={tableCellStyle}>{profile.name}</td>
                      <td style={tableCellStyle}>{profile.stockBars.toLocaleString('vi-VN')} cay</td>
                      <td style={tableCellStyle}><span style={chipStyle(low ? 'danger' : 'success')}>{low ? 'Sap het' : 'On dinh'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected ? `${selected.code} - ${selected.name}` : 'Chon ma thanh'}</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { setDirection('IN'); setReason('Nhap truc tiep ngoai luong'); }} style={{ ...ghostButtonStyle, background: direction === 'IN' ? ui.successSoft : ui.surface, color: direction === 'IN' ? ui.success : ui.text }}><ArrowDownToLine size={14} /> Nhap</button>
            <button onClick={() => { setDirection('OUT'); setReason('Xuat dieu chinh'); }} style={{ ...ghostButtonStyle, background: direction === 'OUT' ? ui.dangerSoft : ui.surface, color: direction === 'OUT' ? ui.danger : ui.text }}><ArrowUpFromLine size={14} /> Xuat</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>So cay<input style={inputStyle} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Nhap so cay" /></label>
            <label style={labelStyle}>Ly do<input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhap kho truc tiep / xuat dieu chinh / kiem ke" /></label>
            <label style={labelStyle}>Ghi chu<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="So phieu, ma don hoac ghi chu noi bo" /></label>
            <button disabled={!selected} onClick={adjustStock} style={{ ...primaryButtonStyle, opacity: selected ? 1 : 0.6 }}>Ghi nhan vao kho NPP</button>
          </div>

          <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 800, marginTop: 20, display: 'flex', gap: 6, alignItems: 'center' }}><History size={15} /> Lich su gan nhat</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {movements.slice(0, 8).map((movement) => (
              <div key={movement.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ color: movement.direction === 'IN' ? ui.success : ui.danger, fontSize: 13 }}>{movement.direction === 'IN' ? 'Nhap' : 'Xuat'} {movement.quantity} cay</strong>
                  <p style={{ margin: '3px 0 0', color: ui.textFaint, fontSize: 12 }}>{movement.reason || movement.note || 'Khong ghi chu'}</p>
                </div>
                <span style={{ color: ui.textFaint, fontSize: 12 }}>{new Date(movement.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
            {movements.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13 }}>Chua co lich su xuat nhap.</p> : null}
          </div>
        </section>
      </div>
    </NppPage>
  );
}
