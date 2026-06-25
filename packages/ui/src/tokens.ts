export const colors = {
  brandOrange: '#FDA720',
  brandRed: '#FC0000',
  brandBlack: '#151110',
  brandGrey: '#A9A9A9',
  white: '#FFFFFF',
  orangeSoft: '#FFF3DF',
  success: '#1E8E3E',
  warning: '#F4B400',
  danger: '#FC0000',
} as const;

export const fonts = {
  body: 'Be Vietnam Pro',
  heading: 'Sora',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const eurohouseTheme = {
  colors,
  fonts,
  spacing,
  radii,
} as const;

export type EurohouseTheme = typeof eurohouseTheme;
