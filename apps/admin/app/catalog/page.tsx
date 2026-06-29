'use client';

import { useEffect, useMemo, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet } from '../../src/lib/api';
import {
  currency,
  eyebrowStyle,
  ghostButtonStyle,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
} from '../../src/ui';

export default function CatalogPage() {
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [palette, setPalette] = useState<ColorCode[]>([]);
  const [activeId, setActiveId] = useState<string>('');
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

  const active = useMemo(() => systems.find((s) => s.id === activeId) ?? null, [systems, activeId]);
  const totalProfiles = useMemo(() => systems.reduce((sum, s) => sum + s.profiles.length, 0), [systems]);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>DANH MỤC</p>
      <h1 style={pageTitleStyle}>Hệ nhôm & thanh profile</h1>
      <p style={subtitleStyle}>
        {systems.length} hệ nhôm · {totalProfiles} thanh profile · {palette.length} màu sơn tĩnh điện.
      </p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      {/* Bộ chọn hệ nhôm */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '12px 0 20px' }}>
        {systems.map((system) => {
          const selected = system.id === activeId;
          return (
            <button
              key={system.id}
              onClick={() => setActiveId(system.id)}
              style={{
                ...ghostButtonStyle,
                background: selected ? colors.brandOrange : colors.white,
                fontWeight: 800,
              }}
            >
              {system.name}
              <span style={{ color: colors.brandGrey, fontWeight: 700, marginLeft: 8 }}>{system.profiles.length}</span>
            </button>
          );
        })}
      </div>

      {/* Bảng màu */}
      <div style={{ ...panelStyle, marginBottom: 20 }}>
        <h2 style={panelTitleStyle}>Màu sơn tiêu chuẩn</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {palette.map((color) => (
            <div key={color.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: color.hex ?? colors.brandGrey,
                  border: `1px solid ${colors.orangeSoft}`,
                  display: 'inline-block',
                }}
              />
              <div>
                <strong style={{ display: 'block', fontSize: 14 }}>{color.name}</strong>
                <small style={{ color: colors.brandGrey }}>{color.code}</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bảng profile của hệ đang chọn */}
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <h2 style={panelTitleStyle}>{active ? active.name : 'Thanh profile'}</h2>
          {active?.description ? <span style={{ color: colors.brandGrey }}>{active.description}</span> : null}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã cây', 'Tên thanh', 'Độ dày', 'kg/m', 'Dài cây', 'Cây/bó', 'Giá/kg'].map((head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(active?.profiles ?? []).map((profile) => (
                <tr key={profile.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 800 }}>{profile.code}</td>
                  <td style={tableCellStyle}>{profile.name}</td>
                  <td style={tableCellStyle}>{profile.thicknessMm ?? '—'}</td>
                  <td style={tableCellStyle}>{profile.kgPerMeter}</td>
                  <td style={tableCellStyle}>{profile.barLengthMm} mm</td>
                  <td style={tableCellStyle}>{profile.barsPerBundle || '—'}</td>
                  <td style={tableCellStyle}>{currency(profile.pricePerKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
