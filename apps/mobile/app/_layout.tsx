import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@eurohouse/ui';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.brandBlack,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.white },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Đăng nhập Eurohouse' }} />
        <Stack.Screen name="quote" options={{ title: 'Tính & Báo giá' }} />
      </Stack>
    </>
  );
}
