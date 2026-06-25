import { colors, eurohouseTheme } from '@eurohouse/ui';

export const mobileTheme = {
  ...eurohouseTheme,
  screen: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
  },
  shadow: {
    shadowColor: colors.brandBlack,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
