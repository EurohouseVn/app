import type { CSSProperties } from 'react';

// ============================================================
// Design system Web Admin Eurohouse — tone "Sáng kiểu SaaS".
// Nền xám-xanh rất nhạt, thẻ trắng, cam Eurohouse làm accent,
// teal làm màu phụ tương sinh. Dịu mắt, gọn gàng, hiện đại.
// ============================================================

export const ui = {
  // Nền & bề mặt
  bg: '#F6F8FB', // nền tổng thể xám-xanh rất nhạt
  surface: '#FFFFFF', // thẻ / panel
  surfaceMuted: '#F1F4F8', // vùng nhấn nhẹ (hàng bảng hover, ô input)
  sidebar: '#FFFFFF',

  // Viền
  border: '#E6EAF0',
  borderStrong: '#D7DDE6',

  // Chữ
  text: '#1C2430', // gần đen nhưng dịu hơn brandBlack
  textMuted: '#6B7684',
  textFaint: '#9AA4B2',

  // Thương hiệu (giữ DNA Eurohouse, hạ độ gắt)
  brand: '#F79009', // cam accent chính (ấm, đỡ chói hơn #FDA720)
  brandSoft: '#FEF3E2', // nền cam nhạt
  brandText: '#B25E09', // cam đậm cho chữ trên nền sáng

  // Màu phụ tương sinh
  teal: '#0E9F92', // xanh teal — màu phụ chính
  tealSoft: '#E1F5F2',
  blue: '#3B82F6',
  blueSoft: '#E8F1FE',
  violet: '#7C6BF0',
  violetSoft: '#EDEBFD',

  // Trạng thái
  success: '#12A150',
  successSoft: '#E3F6EC',
  warning: '#E7A008',
  warningSoft: '#FDF3DC',
  danger: '#E5484D',
  dangerSoft: '#FCE9E9',
} as const;

// Ánh xạ tone (từ API dashboard) → cặp màu {fg, soft}
export type Tone = 'brandOrange' | 'success' | 'warning' | 'danger' | 'brandBlack';

export const toneMap: Record<Tone, { fg: string; soft: string }> = {
  brandOrange: { fg: ui.brand, soft: ui.brandSoft },
  success: { fg: ui.success, soft: ui.successSoft },
  warning: { fg: ui.warning, soft: ui.warningSoft },
  danger: { fg: ui.danger, soft: ui.dangerSoft },
  brandBlack: { fg: ui.text, soft: ui.surfaceMuted },
};

export function tone(t: Tone) {
  return toneMap[t] ?? toneMap.brandOrange;
}

// ---------- Style tái sử dụng ----------

export const panelStyle: CSSProperties = {
  border: `1px solid ${ui.border}`,
  borderRadius: 16,
  padding: 22,
  background: ui.surface,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03)',
};

export const panelTitleStyle: CSSProperties = {
  color: ui.text,
  fontSize: 17,
  fontWeight: 700,
  margin: '0 0 16px',
  letterSpacing: -0.2,
};

export const tableHeadStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  color: ui.textMuted,
  borderBottom: `1px solid ${ui.border}`,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

export const tableCellStyle: CSSProperties = {
  padding: '12px 14px',
  borderBottom: `1px solid ${ui.border}`,
  color: ui.text,
  fontSize: 14,
};

export const eyebrowStyle: CSSProperties = {
  color: ui.brandText,
  fontWeight: 700,
  margin: 0,
  fontSize: 12,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
};

export const pageTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  margin: '6px 0',
  color: ui.text,
  letterSpacing: -0.5,
};

export const subtitleStyle: CSSProperties = {
  color: ui.textMuted,
  margin: '0 0 8px',
  fontSize: 15,
};

export const inputStyle: CSSProperties = {
  border: `1px solid ${ui.borderStrong}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  width: '100%',
  color: ui.text,
  background: ui.surface,
  outline: 'none',
};

export const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: ui.text,
  fontWeight: 600,
  fontSize: 13,
};

export const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 10,
  background: ui.brand,
  color: '#fff',
  padding: '11px 18px',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'center',
};

export const ghostButtonStyle: CSSProperties = {
  border: `1px solid ${ui.borderStrong}`,
  background: ui.surface,
  color: ui.text,
  borderRadius: 10,
  padding: '9px 14px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

// Chip trạng thái (nền nhạt + chữ đậm màu)
export function chipStyle(t: Tone): CSSProperties {
  const c = tone(t);
  return {
    background: c.soft,
    color: c.fg,
    borderRadius: 999,
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
  };
}

export function currency(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`;
}

export function millions(value: number): string {
  return `${(value / 1_000_000).toFixed(1)} tr`;
}

// Giữ tương thích: một số nơi cũ import { colors } từ ui — map tối thiểu.
export const legacy = ui;
