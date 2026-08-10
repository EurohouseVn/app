import type { CSSProperties } from 'react';
import { colors, shadows, radii } from '@eurohouse/ui';

// ============================================================
// AI Aurora Light Design System (Modern & Fresh)
// Nền sáng thanh thoát, thẻ kính mờ (Light Glass), 
// viền mảnh mai tinh tế, Typography siêu hiện đại.
// ============================================================

export const ui = {
  // Nền & bề mặt (Pro Max: Zinc / Obsidian & Pure White)
  bg: '#FAFAFA', // Zinc 50
  background: '#FAFAFA',
  surface: '#FFFFFF', // Thẻ trắng tinh khiết, tương phản cao
  surfaceMuted: '#F4F4F5', // Zinc 100
  surfaceHover: '#F4F4F5',
  sidebar: '#FFFFFF', 
  
  // Viền
  border: '#E4E4E7', // Zinc 200
  borderStrong: '#D4D4D8', // Zinc 300

  // Chữ
  text: '#09090B', // Zinc 950
  textMuted: '#52525B', // Zinc 600
  textFaint: '#A1A1AA', // Zinc 400

  // Thương hiệu
  brand: '#FF6B00', // Eurohouse Orange
  brandSoft: 'rgba(255, 107, 0, 0.15)', 
  brandText: '#EA580C', // Orange 600 để dễ đọc trên nền sáng

  blue: '#3B82F6', 
  blueSoft: 'rgba(59, 130, 246, 0.1)',

  teal: '#14B8A6',
  tealSoft: 'rgba(20, 184, 166, 0.1)',

  shadowMd: '0 4px 12px rgba(15, 23, 42, 0.05)',
  shadowLg: '0 12px 32px rgba(15, 23, 42, 0.04)', // Hào quang bóng đổ siêu nhẹ

  // Trạng thái
  success: '#10B981',
  successSoft: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444', 
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
} as const;

// Ánh xạ tone (từ API dashboard) → cặp màu {fg, soft}
export type Tone = 'brandOrange' | 'success' | 'warning' | 'danger' | 'brandBlack';

export const toneMap: Record<Tone, { fg: string; soft: string }> = {
  brandOrange: { fg: ui.brandText, soft: ui.brandSoft },
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
  borderRadius: radii.xl,
  padding: 24,
  background: ui.surface,
  boxShadow: ui.shadowLg,
  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s',
};

export const glassPanelStyle: CSSProperties = {
  border: `1px solid ${ui.border}`,
  borderRadius: radii.xl,
  padding: 24,
  background: ui.surface,
  boxShadow: '0 8px 32px rgba(9, 9, 11, 0.04)',
  transition: 'transform 0.3s ease, box-shadow 0.3s',
};

export const panelTitleStyle: CSSProperties = {
  color: ui.text,
  fontSize: 18,
  fontWeight: 700,
  margin: '0 0 16px',
  letterSpacing: '-0.02em',
  fontFamily: 'var(--font-heading)',
};

export const tableHeadStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  color: ui.brandText, // Gold
  borderBottom: `1px solid ${ui.border}`,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export const tableCellStyle: CSSProperties = {
  padding: '14px 16px',
  borderBottom: `1px solid ${ui.border}`,
  color: ui.text,
  fontSize: 14,
  fontWeight: 500,
};

export const eyebrowStyle: CSSProperties = {
  color: ui.brandText,
  fontWeight: 700,
  margin: 0,
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

export const pageTitleStyle: CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  margin: '8px 0',
  color: 'transparent',
  backgroundImage: 'linear-gradient(135deg, #FF6B00 0%, #FBBF24 100%)', // Gradient Eurohouse
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  letterSpacing: '-0.04em',
  fontFamily: 'var(--font-heading)',
};

export const subtitleStyle: CSSProperties = {
  color: ui.textMuted,
  margin: '0 0 12px',
  fontSize: 15,
};

export const inputStyle: CSSProperties = {
  border: `1px solid ${ui.border}`,
  borderRadius: radii.md,
  padding: '12px 14px',
  fontSize: 14,
  width: '100%',
  color: ui.text,
  background: ui.bg,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

export const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  color: ui.text,
  fontWeight: 600,
  fontSize: 13,
};

export const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: radii.md,
  background: 'linear-gradient(135deg, #FF6B00 0%, #EA580C 100%)',
  color: '#FFFFFF',
  padding: '12px 20px',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(255, 107, 0, 0.25)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
};

export const ghostButtonStyle: CSSProperties = {
  border: `1px solid ${ui.border}`,
  background: '#FFFFFF',
  color: ui.text,
  borderRadius: radii.md,
  padding: '10px 16px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  boxShadow: shadows.sm,
  transition: 'background 0.2s, transform 0.15s',
};

// Chip trạng thái
export function chipStyle(t: Tone): CSSProperties {
  const c = tone(t);
  return {
    background: c.soft,
    color: c.fg,
    borderRadius: radii.pill,
    padding: '4px 12px',
    fontWeight: 600,
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    border: `1px solid ${c.soft}`, // Glassy chip
  };
}

export function currency(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`;
}

export function millions(value: number): string {
  return `${(value / 1_000_000).toFixed(1)} tr`;
}

export const legacy = ui;
