'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers, Palette, Save } from 'lucide-react';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { ProfileImage } from '../../src/ProfileImage';
import {
  currency,
  ghostButtonStyle,
  inputStyle,
  eyebrowStyle,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
  ui,
} from '../../src/ui';

export default function CatalogPage() {
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [palette, setPalette] = useState<ColorCode[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [draftWeights, setDraftWeights] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<CatalogSystem[]>('/catalog/systems')
      .then((data) => {
        setSystems(data);
        setActiveId((current) => current || data[0]?.id || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được danh mục.'));
    apiGet<ColorCode[]>('/catalog/colors')
      .then(setPalette)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const next: Record<string, string> = {};
    systems.forEach((system) => {
      system.profiles.forEach((profile) => {
        const fallback = profile.kgPerMeter * (profile.barLengthMm / 1000);
        next[profile.id] = String(profile.actualKgPerBar ?? Number(fallback.toFixed(3)));
      });
    });
    setDraftWeights((current) => ({ ...next, ...current }));
  }, [systems]);

  const active = useMemo(() => systems.find((s) => s.id === activeId) ?? null, [systems, activeId]);
  const totalProfiles = useMemo(() => systems.reduce((sum, s) => sum + s.profiles.length, 0), [systems]);

  async function saveActualWeight(profileId: string) {
    const value = Number(draftWeights[profileId]);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Kg thuc te/cay phai lon hon 0.');
      return;
    }
    setSavingId(profileId);
    setError('');
    try {
      const updated = await apiSend<{ id: string; actualKgPerBar: number }>(`/catalog/profiles/${profileId}`, 'PATCH', { actualKgPerBar: value });
      setSystems((current) => current.map((system) => ({
        ...system,
        profiles: system.profiles.map((profile) => profile.id === profileId ? { ...profile, actualKgPerBar: updated.actualKgPerBar } : profile),
      })));
      setDraftWeights((current) => ({ ...current, [profileId]: String(updated.actualKgPerBar) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong luu duoc kg thuc te.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>DANH MỤC</p>
      <h1 style={pageTitleStyle}>Hệ nhôm & thanh profile</h1>
      <p style={subtitleStyle}>
        {systems.length} hệ nhôm · {totalProfiles} thanh profile · {palette.length} màu sơn tĩnh điện.
      </p>
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      {/* Bộ chọn hệ nhôm */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '12px 0 20px' }}>
        {systems.map((system) => {
          const selected = system.id === activeId;
          return (
            <button
              key={system.id}
              onClick={() => setActiveId(system.id)}
              style={{
                border: `1px solid ${selected ? ui.brand : ui.borderStrong}`,
                background: selected ? ui.brandSoft : ui.surface,
                color: selected ? ui.brandText : ui.text,
                borderRadius: 10,
                padding: '9px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Layers size={14} />
              {system.name}
              <span style={{ color: selected ? ui.brandText : ui.textFaint, fontWeight: 700 }}>{system.profiles.length}</span>
            </button>
          );
        })}
      </div>

      {/* Bảng màu */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <h2 style={panelTitleStyle}>
          <Palette size={16} style={{ verticalAlign: -2, marginRight: 8 }} color={ui.textMuted} />
          Màu sơn tiêu chuẩn
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {palette.map((color) => (
            <div key={color.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: color.hex ?? ui.textFaint,
                  border: `1px solid ${ui.border}`,
                  display: 'inline-block',
                }}
              />
              <div>
                <strong style={{ display: 'block', fontSize: 13, color: ui.text }}>{color.name}</strong>
                <small style={{ color: ui.textFaint }}>{color.code}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bảng profile của hệ đang chọn */}
      <div style={{ ...panelStyle, padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '20px 20px 0' }}>
          <h2 style={panelTitleStyle}>{active ? active.name : 'Thanh profile'}</h2>
          {active?.description ? <span style={{ color: ui.textFaint, fontSize: 13 }}>{active.description}</span> : null}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mặt cắt', 'Mã cây', 'Tên thanh', 'Độ dày', 'kg/m', 'Dài cây', 'Cây/bó', 'Giá/kg'].map((head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                ))}
                <th style={tableHeadStyle}>Kg thuc te/cay</th>
              </tr>
            </thead>
            <tbody>
              {(active?.profiles ?? []).map((profile) => (
                <tr key={profile.id}>
                  <td style={tableCellStyle}>
                    <ProfileImage imageUrl={profile.imageUrl} />
                  </td>
                  <td style={{ ...tableCellStyle, fontWeight: 700 }}>{profile.code}</td>
                  <td style={tableCellStyle}>{profile.name}</td>
                  <td style={tableCellStyle}>{profile.thicknessMm ?? '—'}</td>
                  <td style={tableCellStyle}>{profile.kgPerMeter}</td>
                  <td style={tableCellStyle}>{profile.barLengthMm} mm</td>
                  <td style={tableCellStyle}>{profile.barsPerBundle || '—'}</td>
                  <td style={tableCellStyle}>{currency(profile.pricePerKg)}</td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 150 }}>
                      <input
                        style={{ ...inputStyle, height: 34, padding: '6px 10px', width: 88 }}
                        type="number"
                        step="0.001"
                        value={draftWeights[profile.id] ?? ''}
                        onChange={(e) => setDraftWeights((current) => ({ ...current, [profile.id]: e.target.value }))}
                      />
                      <button onClick={() => saveActualWeight(profile.id)} disabled={savingId === profile.id} style={{ ...ghostButtonStyle, padding: '7px 10px' }}>
                        <Save size={14} /> Luu
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
