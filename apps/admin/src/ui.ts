import type { CSSProperties } from 'react';
import { colors } from '@eurohouse/ui';

// Style dùng chung cho các trang admin (đồng bộ với Dashboard & Orders).

export const panelStyle: CSSProperties = {
  border: `1px solid ${colors.orangeSoft}`,
  borderRadius: 20,
  padding: 24,
  background: colors.white,
  boxShadow: '0 10px 26px rgba(21,17,16,0.05)',
};

export const panelTitleStyle: CSSProperties = {
  color: colors.brandBlack,
  fontSize: 20,
  margin: '0 0 16px',
};

export const tableHeadStyle: CSSProperties = {
  textAlign: 'left',
  padding: 12,
  color: colors.brandGrey,
  borderBottom: `1px solid ${colors.orangeSoft}`,
  fontSize: 13,
};

export const tableCellStyle: CSSProperties = {
  padding: 12,
  borderBottom: `1px solid ${colors.orangeSoft}`,
  color: colors.brandBlack,
};

export const eyebrowStyle: CSSProperties = {
  color: colors.brandOrange,
  fontWeight: 900,
  margin: 0,
  letterSpacing: 0.5,
};

export const pageTitleStyle: CSSProperties = {
  fontSize: 34,
  margin: '8px 0',
  color: colors.brandBlack,
};

export const subtitleStyle: CSSProperties = {
  color: colors.brandGrey,
  margin: '0 0 8px',
};

export const inputStyle: CSSProperties = {
  border: `2px solid ${colors.orangeSoft}`,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 15,
  width: '100%',
  color: colors.brandBlack,
};

export const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: colors.brandBlack,
  fontWeight: 700,
  fontSize: 13,
};

export const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  background: colors.brandOrange,
  color: colors.brandBlack,
  padding: '12px 20px',
  fontWeight: 900,
  fontSize: 15,
  cursor: 'pointer',
};

export const ghostButtonStyle: CSSProperties = {
  border: `1px solid ${colors.brandOrange}`,
  background: colors.white,
  color: colors.brandBlack,
  borderRadius: 999,
  padding: '8px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

export function currency(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`;
}

export function millions(value: number): string {
  return `${(value / 1_000_000).toFixed(1)} tr`;
}
