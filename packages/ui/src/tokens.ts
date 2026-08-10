export const colors = {
  brandGold: {
    50: '#FDFBF4',
    100: '#FBF5E0',
    200: '#F6E9BD',
    300: '#F0D692',
    400: '#EBC467',
    500: '#D4AF37', // Gold Leaf - Luxury Accent
    600: '#B59124',
    700: '#916E16',
    800: '#755615',
    900: '#634716',
  },
  brandObsidian: {
    50: '#F6F6F6',
    100: '#E7E7E7',
    200: '#D1D1D1',
    300: '#B0B0B0',
    400: '#888888',
    500: '#6D6D6D',
    600: '#5D5D5D',
    700: '#4F4F4F',
    800: '#454545',
    900: '#121212', // Deep Obsidian - Nền chủ đạo
    950: '#0A0A0A',
  },
  brandOrange: '#F47C20',
  brandOrangeText: '#C45513',
  brandRed: {
    soft: '#FEE2E2',
    main: '#DC2626',
    dark: '#991B1B',
  },
  brandBlack: {
    main: '#0A0A0A',
    soft: '#171717',
    muted: '#404040',
  },
  brandGrey: {
    50: '#FAFAFA', // Nền sáng
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
  },
  white: '#FFFFFF',
  orangeSoft: '#FFF2E8',
  success: '#059669', // Emerald
  warning: '#D4AF37', // Gold Leaf cho cảnh báo
  danger: '#DC2626',
} as const;

export const fonts = {
  body: 'Inter',
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
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
  glass: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
} as const;

export const eurohouseTheme = {
  colors,
  fonts,
  spacing,
  radii,
  shadows,
} as const;

export type EurohouseTheme = typeof eurohouseTheme;
