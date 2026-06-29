import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@eurohouse/ui';
import { tabBarIcon } from '../src/components/Icon';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandOrange,
          tabBarInactiveTintColor: '#9AA0A6',
          tabBarStyle: {
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 14,
            height: 66,
            borderRadius: 24,
            backgroundColor: colors.white,
            borderTopWidth: 0,
            paddingBottom: 10,
            paddingTop: 10,
            shadowColor: colors.brandBlack,
            shadowOpacity: 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: tabBarIcon('home') }} />
        <Tabs.Screen name="orders" options={{ title: 'Đặt hàng', tabBarIcon: tabBarIcon('grid') }} />
        <Tabs.Screen name="quote" options={{ title: 'Công thức', tabBarIcon: tabBarIcon('sliders') }} />
        <Tabs.Screen name="library" options={{ title: 'Thư viện', tabBarIcon: tabBarIcon('image') }} />
        <Tabs.Screen name="profile" options={{ title: 'Cá nhân', tabBarIcon: tabBarIcon('user') }} />
        <Tabs.Screen name="auth" options={{ href: null }} />
        <Tabs.Screen name="warranty" options={{ href: null }} />
        <Tabs.Screen name="loyalty" options={{ href: null }} />
        <Tabs.Screen name="promo" options={{ href: null }} />
        <Tabs.Screen name="projects" options={{ href: null }} />
        <Tabs.Screen name="project/[id]" options={{ href: null }} />
        <Tabs.Screen name="debts" options={{ href: null }} />
        <Tabs.Screen name="quotation" options={{ href: null }} />
      </Tabs>
    </>
  );
}
