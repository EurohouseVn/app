'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Minus, PackagePlus, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CatalogSystem, ColorCode, CreateOrderResult, NppFactoryItem } from '@eurohouse/types';
import { NppPage } from '../../../src/NppPage';
import { apiGet, apiSend } from '../../../src/lib/api';
import { currency, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../../../src/ui';

function requestId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function NewNppOrderPage() {
  const router = useRouter();
  const [factories, setFactories] = useState<NppFactoryItem[]>([]);
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [colors, setColors] = useState<ColorCode[]>([]);
  const [factoryOrgId, setFactoryOrgId] = useState('');
  const [colorCode, setColorCode] = useState('');
  const [query, setQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [accessoriesNote, setAccessoriesNote] = useState('');
  const [clientRequestId, setClientRequestId] = useState(requestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet<NppFactoryItem[]>('/npp/factories'),
      apiGet<CatalogSystem[]>('/catalog/systems'),
      apiGet<ColorCode[]>('/catalog/colors'),
    ]).then(([factoryData, systemData, colorData]) => {
      setFactories(factoryData);
      setSystems(systemData);
      setColors(colorData);
      setFactoryOrgId(factoryData[0]?.id || '');
      setColorCode(colorData[0]?.code || '');
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu tạo đơn.'));
  }, []);

  const profiles = useMemo(() => {
    const keyword = normalize(query.trim());
    return systems.flatMap((system) => system.profiles.map((profile) => ({ profile, system })))
      .filter(({ profile, system }) => !keyword || normalize(`${profile.code} ${profile.name} ${system.name}`).includes(keyword));
  }, [systems, query]);

  const selected = useMemo(() => profiles
    .filter(({ profile }) => (quantities[profile.id] || 0) > 0)
    .map(({ profile, system }) => {
      const quantity = quantities[profile.id];
      const kg = profile.kgPerMeter * ((profile.barLengthMm || 6000) / 1000) * quantity;
      return { profile, system, quantity, kg, amount: kg * profile.pricePerKg };
    }), [profiles, quantities]);

  const totals = useMemo(() => selected.reduce((sum, item) => ({
    bars: sum.bars + item.quantity,
    kg: sum.kg + item.kg,
    amount: sum.amount + item.amount,
  }), { bars: 0, kg: 0, amount: 0 }), [selected]);

  function changeQuantity(profileId: string, delta: number) {
    setQuantities((current) => ({ ...current, [profileId]: Math.max(0, (current[profileId] || 0) + delta) }));
  }

  async function submit() {
    setError('');
    if (!factoryOrgId) return setError('Chọn cơ sở sản xuất nhận hàng.');
    if (!colorCode) return setError('Chọn màu nhôm.');
    if (!selected.length) return setError('Chọn ít nhất một mã thanh nhôm.');
    setBusy(true);
    try {
      const order = await apiSend<CreateOrderResult>('/orders', 'POST', {
        sourceType: 'NPP',
        factoryOrgId,
        clientRequestId,
        colorCode,
        note: note.trim() || undefined,
        accessoriesNote: accessoriesNote.trim() || undefined,
        items: selected.map(({ profile, quantity }) => ({
          profileId: profile.id,
          productCode: profile.code,
          productName: profile.name,
          colorCode,
          quantity,
        })),
      });
      setClientRequestId(requestId());
      router.push(`/orders?created=${encodeURIComponent(order.code)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được đơn hàng.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <NppPage>
      <Link href="/orders" style={{ ...ghostButtonStyle, display: 'inline-flex', textDecoration: 'none', marginBottom: 16 }}><ArrowLeft size={15} /> Danh sách đơn</Link>
      <h1 style={pageTitleStyle}>Tạo đơn cho cơ sở sản xuất</h1>
      <p style={subtitleStyle}>Dùng khi CSSX đặt hàng trực tiếp với NPP. Đơn được gắn đúng mã CSSX và sẵn sàng để tạo phiếu giao.</p>
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(220px, 1fr)', gap: 14 }}>
          <label style={labelStyle}>Cơ sở sản xuất
            <select style={inputStyle} value={factoryOrgId} onChange={(event) => setFactoryOrgId(event.target.value)}>
              <option value="">Chọn CSSX</option>
              {factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name} ({factory.shortLabel || factory.code})</option>)}
            </select>
          </label>
          <label style={labelStyle}>Màu nhôm
            <select style={inputStyle} value={colorCode} onChange={(event) => setColorCode(event.target.value)}>
              {colors.map((color) => <option key={color.id} value={color.code}>{color.name}</option>)}
            </select>
          </label>
        </div>
        {!factories.length ? <p style={{ color: ui.warning, fontWeight: 700 }}>NPP chưa có CSSX. Tạo CSSX tại mục Cơ sở SX trước khi lập đơn.</p> : null}
      </section>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <label style={{ ...labelStyle, position: 'relative' }}>Tìm mã thanh hoặc hệ nhôm
          <Search size={16} style={{ position: 'absolute', left: 12, bottom: 12, color: ui.textFaint }} />
          <input style={{ ...inputStyle, paddingLeft: 38 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: C3300, Hệ 55..." />
        </label>
        <div style={{ maxHeight: 460, overflowY: 'auto', marginTop: 12, borderTop: `1px solid ${ui.border}` }}>
          {profiles.map(({ profile, system }) => {
            const quantity = quantities[profile.id] || 0;
            return (
              <div key={profile.id} style={{ display: 'grid', gridTemplateColumns: '110px minmax(180px, 1fr) minmax(160px, .8fr) 120px', alignItems: 'center', gap: 12, padding: '10px 4px', borderBottom: `1px solid ${ui.border}` }}>
                <strong style={{ color: ui.text }}>{profile.code}</strong>
                <span style={{ color: ui.textMuted }}>{profile.name}</span>
                <small style={{ color: ui.textFaint }}>{system.name}</small>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" aria-label={`Giảm ${profile.code}`} onClick={() => changeQuantity(profile.id, -1)} style={{ ...ghostButtonStyle, width: 32, height: 32, padding: 0, justifyContent: 'center' }}><Minus size={14} /></button>
                  <strong style={{ minWidth: 24, textAlign: 'center' }}>{quantity}</strong>
                  <button type="button" aria-label={`Tăng ${profile.code}`} onClick={() => changeQuantity(profile.id, 1)} style={{ ...ghostButtonStyle, width: 32, height: 32, padding: 0, justifyContent: 'center' }}><Plus size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, color: ui.text }}>Tổng hợp đơn</h2>
        {selected.map(({ profile, quantity, kg, amount }) => (
          <div key={profile.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, padding: '8px 0', borderBottom: `1px solid ${ui.border}` }}>
            <span><strong>{profile.code}</strong> - {profile.name}</span>
            <span>{quantity} cây · {kg.toFixed(2)} kg</span>
            <strong>{currency(Math.round(amount))}</strong>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 14, fontWeight: 800 }}>
          <span>{totals.bars} cây · {totals.kg.toFixed(2)} kg theo tỷ trọng</span>
          <span>{currency(Math.round(totals.amount))}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
          <label style={labelStyle}>Ghi chú giao hàng<textarea style={{ ...inputStyle, minHeight: 90, paddingTop: 10 }} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thời gian giao, người nhận..." /></label>
          <label style={labelStyle}>Phụ kiện, kính đi kèm<textarea style={{ ...inputStyle, minHeight: 90, paddingTop: 10 }} value={accessoriesNote} onChange={(event) => setAccessoriesNote(event.target.value)} placeholder="Tên hàng, quy cách, số lượng..." /></label>
        </div>
        <button type="button" onClick={submit} disabled={busy || !factories.length} style={{ ...ghostButtonStyle, marginTop: 16, background: ui.brand, color: '#fff', opacity: busy ? .65 : 1 }}><PackagePlus size={16} /> {busy ? 'Đang tạo đơn...' : 'Tạo đơn và chuyển sang chuẩn bị giao'}</button>
      </section>
    </NppPage>
  );
}
