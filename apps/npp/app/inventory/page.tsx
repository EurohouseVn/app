'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, FileScan, History, Layers3, PackageCheck, Warehouse } from 'lucide-react';
import type { AdjustProfileStockInput, CatalogSystem, CreateOrderInput, InventoryProfile, NppFactoryItem, NppInboundShipment, ProfileStockMovementItem, StockDirection } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { chipStyle, currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type SystemGroup = {
  code: string;
  name: string;
  profiles: InventoryProfile[];
  stockBars: number;
};

const ALUMINUM_COLORS = [
  { code: 'CAFE_METALIC', name: 'Màu Café Metalic' },
  { code: 'CAFE_THUONG', name: 'Màu Café thường' },
  { code: 'XAM_NGOC_TRAI', name: 'Màu Xám Ngọc Trai' },
  { code: 'VAN_GO_CAM_LAI', name: 'Màu Vân gỗ Cẩm Lai' },
  { code: 'VAN_GO_OLAK', name: 'Màu vân gỗ Olak' },
  { code: 'XAM_RITA', name: 'Màu Xám Rita (dự án)' },
];

function profileBarsForColors(profile: InventoryProfile, colorCodes: string[]) {
  const stockByColor = profile.stockByColor ?? [];
  if (stockByColor.length === 0) return colorCodes.length === ALUMINUM_COLORS.length ? profile.stockBars : 0;
  return stockByColor.filter((item) => colorCodes.includes(item.colorCode)).reduce((sum, item) => sum + item.stockBars, 0);
}

function profileTonsForColors(profile: InventoryProfile, colorCodes: string[]) {
  const stockByColor = profile.stockByColor ?? [];
  if (stockByColor.length > 0) {
    return stockByColor.filter((item) => colorCodes.includes(item.colorCode)).reduce((sum, item) => sum + item.tons, 0);
  }
  return ((profileBarsForColors(profile, colorCodes) * (profile.kgPerMeter ?? 0) * 6) / 1000);
}

function statusLabel(status: string) {
  if (status === 'ADMIN_SENT_NPP') return 'Chờ NPP nhận';
  if (status === 'NPP_RECEIVED') return 'Đã nhận đủ';
  return status;
}

export default function NppInventoryPage() {
  const [profiles, setProfiles] = useState<InventoryProfile[]>([]);
  const [factories, setFactories] = useState<NppFactoryItem[]>([]);
  const [inbound, setInbound] = useState<NppInboundShipment[]>([]);
  const [movements, setMovements] = useState<ProfileStockMovementItem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState('ALL');
  const [selectedColors, setSelectedColors] = useState<string[]>(ALUMINUM_COLORS.map((color) => color.code));
  const [adjustColor, setAdjustColor] = useState(ALUMINUM_COLORS[0].code);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [selected, setSelected] = useState<InventoryProfile | null>(null);
  const [direction, setDirection] = useState<StockDirection>('IN');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Nhập trực tiếp ngoài luồng');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function loadProfiles() {
    apiGet<InventoryProfile[]>('/npp/inventory/profiles')
      .then((items) => {
        setError('');
        setProfiles(items);
        setSelected((current) => current ? items.find((item) => item.id === current.id) ?? items[0] ?? null : items[0] ?? null);
      })
      .catch(() => {
        apiGet<CatalogSystem[]>('/catalog/systems')
          .then((systems) => {
            const fallback = systems.flatMap((system) => system.profiles.map((profile) => ({
              id: profile.id,
              code: profile.code,
              name: profile.name,
              systemCode: system.code,
              systemName: system.name,
              stockBars: 0,
              kgPerMeter: profile.kgPerMeter,
              lowStockAlert: 0,
              pricePerKg: profile.pricePerKg,
              stockByColor: ALUMINUM_COLORS.map((color) => ({ colorCode: color.code, colorName: color.name, stockBars: 0, tons: 0 })),
            })));
            setProfiles(fallback);
            setSelected((current) => current ? fallback.find((item) => item.id === current.id) ?? fallback[0] ?? null : fallback[0] ?? null);
            setError('API tồn kho đang lỗi, tạm hiển thị danh sách mã cây từ catalog. Nhập/xuất kho sẽ hoạt động sau khi API tồn kho redeploy xong.');
          })
          .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được tồn kho.'));
      });
  }

  function loadInbound() {
    apiGet<NppInboundShipment[]>('/npp/inventory/inbound-shipments')
      .then(setInbound)
      .catch(() => setInbound([]));
  }

  function loadFactories() {
    apiGet<NppFactoryItem[]>('/npp/factories')
      .then((items) => {
        setFactories(items);
        setSelectedFactoryId((current) => current || items[0]?.id || '');
      })
      .catch(() => setFactories([]));
  }

  function loadMovements(profileId?: string) {
    const query = profileId ? `?profileId=${profileId}` : '';
    apiGet<ProfileStockMovementItem[]>(`/npp/inventory/movements${query}`).then(setMovements).catch(() => setMovements([]));
  }

  function refreshAll(profileId = selected?.id) {
    loadProfiles();
    loadInbound();
    loadMovements(profileId);
    loadFactories();
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
    const stockBars = profiles.reduce((sum, item) => sum + profileBarsForColors(item, selectedColors), 0);
    const totalTons = profiles.reduce((sum, item) => sum + profileTonsForColors(item, selectedColors), 0);
    const lowCount = profiles.filter((item) => item.lowStockAlert !== undefined && item.lowStockAlert > 0 && profileBarsForColors(item, selectedColors) <= item.lowStockAlert).length;
    const inboundPending = inbound.filter((item) => item.status === 'ADMIN_SENT_NPP').length;
    return { stockBars, totalTons, lowCount, inboundPending };
  }, [profiles, inbound, selectedColors]);

  function toggleColor(code: string) {
    setSelectedColors((current) => {
      if (current.includes(code)) {
        const next = current.filter((item) => item !== code);
        return next.length ? next : current;
      }
      return [...current, code];
    });
  }

  async function adjustStock() {
    if (!selected) return;
    const amount = Number(quantity);
    if (!amount || amount <= 0) {
      setError('Nhập số cây hợp lệ.');
      return;
    }
    const body: AdjustProfileStockInput = { direction, quantity: amount, colorCode: adjustColor, reason, note };
    setError('');
    setMessage('');
    try {
      await apiSend(`/npp/inventory/profiles/${selected.id}/stock-adjust`, 'POST', body);
      setMessage('Đã ghi nhận xuất/nhập vào kho riêng của NPP.');
      setQuantity('');
      setNote('');
      refreshAll(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật được tồn kho.');
    }
  }

  async function createManualFactoryOrder() {
    if (!selected) return;
    const amount = Number(quantity);
    if (!amount || amount <= 0) {
      setError('Nhập số cây hợp lệ.');
      return;
    }
    const factory = factories.find((item) => item.id === selectedFactoryId);
    if (!factory) {
      setError('Chọn xưởng thợ cần xuất hàng.');
      return;
    }
    const body: CreateOrderInput = {
      sourceType: 'NPP',
      customerName: factory.name,
      customerPhone: factory.phone,
      deliveryAddress: factory.address,
      colorCode: adjustColor,
      note: `NPP tạo đơn thủ công cho ${factory.code}`,
      items: [{
        profileId: selected.id,
        productCode: selected.code,
        productName: selected.name,
        colorCode: adjustColor,
        quantity: amount,
        kgPerMeter: selected.kgPerMeter,
      }],
    };
    try {
      const created = await apiSend<{ code: string }>('/orders', 'POST', body);
      setMessage(`Đã tạo đơn thủ công ${created.code} cho ${factory.name}.`);
      refreshAll(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được đơn thủ công.');
    }
  }

  async function createCompanyPurchaseOrder() {
    if (!selected) return;
    const amount = Number(quantity);
    if (!amount || amount <= 0) {
      setError('Nhập số cây hợp lệ.');
      return;
    }
    const body: CreateOrderInput = {
      sourceType: 'NPP_TO_ADMIN',
      colorCode: adjustColor,
      note: note || 'NPP đặt hàng công ty từ WebNPP',
      items: [{
        profileId: selected.id,
        productCode: selected.code,
        productName: selected.name,
        colorCode: adjustColor,
        quantity: amount,
        kgPerMeter: selected.kgPerMeter,
      }],
    };
    try {
      const created = await apiSend<{ code: string }>('/orders', 'POST', body);
      setMessage(`Đã tạo yêu cầu đặt hàng công ty ${created.code}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được yêu cầu đặt hàng công ty.');
    }
  }

  async function receiveShipment(shipment: NppInboundShipment) {
    setError('');
    setMessage('');
    try {
      await apiSend(`/npp/inventory/inbound-shipments/${shipment.id}/receive`, 'POST');
      setMessage(`Đã xác nhận nhận đủ hàng ${shipment.code}. Kho NPP đã được cập nhật.`);
      refreshAll(selected?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xác nhận được phiếu nhập.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Kho hàng NPP</p>
      <h1 style={pageTitleStyle}>Quản lý tồn kho theo hệ nhôm</h1>
      <p style={subtitleStyle}>Tồn kho này chỉ dành cho NPP. App CSSX không hiển thị số tồn của nhà phân phối.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
        <div style={{ ...panelStyle, padding: 18 }}><Warehouse size={18} color={ui.brand} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>Tổng tồn NPP</p><strong style={{ color: ui.text, fontSize: 24 }}>{totals.stockBars.toLocaleString('vi-VN')} cây</strong><p style={{ margin: '4px 0 0', color: ui.textMuted, fontSize: 12 }}>{totals.totalTons.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} tấn</p></div>
        <div style={{ ...panelStyle, padding: 18 }}><Layers3 size={18} color={ui.teal} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>Hệ nhôm</p><strong style={{ color: ui.text, fontSize: 24 }}>{groups.length}</strong></div>
        <div style={{ ...panelStyle, padding: 18 }}><PackageCheck size={18} color={ui.warning} /><p style={{ margin: '10px 0 0', color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>Phiếu chờ nhận</p><strong style={{ color: totals.inboundPending ? ui.warning : ui.success, fontSize: 24 }}>{totals.inboundPending}</strong></div>
      </div>

      <section style={{ ...panelStyle, marginTop: 18, padding: 16 }}>
        <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 18 }}>Lọc tồn kho theo màu nhôm</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALUMINUM_COLORS.map((color) => (
            <button key={color.code} onClick={() => toggleColor(color.code)} style={{ ...ghostButtonStyle, background: selectedColors.includes(color.code) ? ui.brandSoft : ui.surface, color: selectedColors.includes(color.code) ? ui.brandText : ui.text }}>
              {selectedColors.includes(color.code) ? '✓ ' : ''}{color.name}
            </button>
          ))}
          <button onClick={() => setSelectedColors(ALUMINUM_COLORS.map((color) => color.code))} style={ghostButtonStyle}>Chọn cả 6 màu</button>
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, color: ui.text, fontSize: 18 }}>Phiếu WebAdmin giao về NPP</h2>
          <span style={{ color: ui.textFaint, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileScan size={14} /> OCR ảnh đơn hàng sẽ bổ sung ở bước sau</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Mã phiếu', 'Ngày tạo', 'Số cây', 'Số kg', 'Giá trị', 'Trạng thái', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {inbound.map((shipment) => {
                const bars = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
                const pending = shipment.status === 'ADMIN_SENT_NPP';
                return (
                  <tr key={shipment.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{shipment.code}</td>
                    <td style={tableCellStyle}>{new Date(shipment.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td style={tableCellStyle}>{bars.toLocaleString('vi-VN')} cây</td>
                    <td style={tableCellStyle}>{shipment.totalKg.toFixed(1)} kg</td>
                    <td style={tableCellStyle}>{currency(shipment.totalAmount)}</td>
                    <td style={tableCellStyle}><span style={chipStyle(pending ? 'warning' : 'success')}>{statusLabel(shipment.status)}</span></td>
                    <td style={tableCellStyle}>{pending ? <button onClick={() => receiveShipment(shipment)} style={ghostButtonStyle}><CheckCircle2 size={14} /> Xác nhận nhận đủ</button> : null}</td>
                  </tr>
                );
              })}
              {inbound.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chưa có phiếu WebAdmin giao về NPP.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, margin: '18px 0 12px', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedSystem('ALL')} style={{ ...ghostButtonStyle, background: selectedSystem === 'ALL' ? ui.brandSoft : ui.surface, color: selectedSystem === 'ALL' ? ui.brandText : ui.text }}>Tất cả</button>
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
                <tr>{['Hệ', 'Mã thanh', 'Tên thanh', 'Tồn NPP', 'Tấn', 'Cảnh báo'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {visibleProfiles.map((profile) => {
                  const visibleBars = profileBarsForColors(profile, selectedColors);
                  const visibleTons = profileTonsForColors(profile, selectedColors);
                  const low = (profile.lowStockAlert ?? 0) > 0 && visibleBars <= (profile.lowStockAlert ?? 0);
                  return (
                    <tr key={profile.id} onClick={() => setSelected(profile)} style={{ cursor: 'pointer', background: selected?.id === profile.id ? ui.brandSoft : 'transparent' }}>
                      <td style={tableCellStyle}>{profile.systemCode || '-'}</td>
                      <td style={{ ...tableCellStyle, fontWeight: 800 }}>{profile.code}</td>
                      <td style={tableCellStyle}>{profile.name}</td>
                      <td style={tableCellStyle}>{visibleBars.toLocaleString('vi-VN')} cây</td>
                      <td style={tableCellStyle}>{visibleTons.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td>
                      <td style={tableCellStyle}><span style={chipStyle(low ? 'danger' : 'success')}>{low ? 'Sắp hết' : 'Ổn định'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected ? `${selected.code} - ${selected.name}` : 'Chọn mã thanh'}</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => { setDirection('IN'); setReason('Nhập trực tiếp ngoài luồng'); }} style={{ ...ghostButtonStyle, background: direction === 'IN' ? ui.successSoft : ui.surface, color: direction === 'IN' ? ui.success : ui.text }}><ArrowDownToLine size={14} /> Nhập</button>
            <button onClick={() => { setDirection('OUT'); setReason('Xuất điều chỉnh'); }} style={{ ...ghostButtonStyle, background: direction === 'OUT' ? ui.dangerSoft : ui.surface, color: direction === 'OUT' ? ui.danger : ui.text }}><ArrowUpFromLine size={14} /> Xuất</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Số cây<input style={inputStyle} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Nhập số cây" /></label>
            <label style={labelStyle}>Màu nhôm<select style={inputStyle} value={adjustColor} onChange={(e) => setAdjustColor(e.target.value)}>{ALUMINUM_COLORS.map((color) => <option key={color.code} value={color.code}>{color.name}</option>)}</select></label>
            <label style={labelStyle}>Xưởng thợ<select style={inputStyle} value={selectedFactoryId} onChange={(e) => setSelectedFactoryId(e.target.value)}><option value="">Chọn xưởng thợ</option>{factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.code} - {factory.name}</option>)}</select></label>
            <label style={labelStyle}>Lý do<input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập kho trực tiếp / xuất điều chỉnh / kiểm kê" /></label>
            <label style={labelStyle}>Ghi chú<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Số phiếu, mã đơn hoặc ghi chú nội bộ" /></label>
            <button disabled={!selected} onClick={adjustStock} style={{ ...primaryButtonStyle, opacity: selected ? 1 : 0.6 }}>Ghi nhận vào kho NPP</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button disabled={!selected || !selectedFactoryId} onClick={createManualFactoryOrder} style={{ ...ghostButtonStyle, justifyContent: 'center', opacity: selected && selectedFactoryId ? 1 : 0.6 }}>Tạo đơn cho thợ</button>
              <button disabled={!selected} onClick={createCompanyPurchaseOrder} style={{ ...ghostButtonStyle, justifyContent: 'center', background: ui.brandSoft, color: ui.brandText, opacity: selected ? 1 : 0.6 }}>Đặt hàng công ty</button>
            </div>
          </div>

          <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 800, marginTop: 20, display: 'flex', gap: 6, alignItems: 'center' }}><History size={15} /> Lịch sử gần nhất</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {movements.slice(0, 8).map((movement) => (
              <div key={movement.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 10, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ color: movement.direction === 'IN' ? ui.success : ui.danger, fontSize: 13 }}>{movement.direction === 'IN' ? 'Nhập' : 'Xuất'} {movement.quantity} cây</strong>
                  <p style={{ margin: '3px 0 0', color: ui.textFaint, fontSize: 12 }}>{movement.reason || movement.note || 'Không ghi chú'}</p>
                </div>
                <span style={{ color: ui.textFaint, fontSize: 12 }}>{new Date(movement.createdAt).toLocaleDateString('vi-VN')}</span>
              </div>
            ))}
            {movements.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13 }}>Chưa có lịch sử xuất nhập.</p> : null}
          </div>
        </section>
      </div>
    </NppPage>
  );
}
