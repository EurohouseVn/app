import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState, Platform } from 'react-native';
import { colors } from '@eurohouse/ui';
import { tabBarIcon } from '../src/components/Icon';
import { AuthProvider, useAuth } from '../src/lib/auth';
import AuthScreen from './auth';
import { syncOperationsQueue } from '../src/lib/localProjects';

function Gate() {
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!user) return undefined;
    const syncAll = () => syncOperationsQueue();
    void syncAll();
    const timer = setInterval(() => void syncAll(), 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void syncAll(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [user]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.brandOrange} size="large" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandOrange,
        tabBarInactiveTintColor: '#9AA0A6',
        tabBarStyle: {
          height: 78,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 24,
          backgroundColor: colors.white,
          borderTopWidth: 0,
          paddingBottom: 14,
          paddingTop: 8,
          shadowColor: colors.brandBlack.main,
          shadowOpacity: 0.12,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        tabBarItemStyle: { height: 58, paddingTop: 2 },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 13, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: tabBarIcon('home') }} />
      <Tabs.Screen name="projects" options={{ title: 'Công trình', tabBarIcon: tabBarIcon('briefcase') }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng', tabBarIcon: tabBarIcon('truck') }} />
      <Tabs.Screen name="formulas" options={{ title: 'Công thức', tabBarIcon: tabBarIcon('layout') }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản', tabBarIcon: tabBarIcon('user') }} />
      <Tabs.Screen name="auth" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="estimate" options={{ href: null }} />
      <Tabs.Screen name="warranty" options={{ href: null }} />
      <Tabs.Screen name="loyalty" options={{ href: null }} />
      <Tabs.Screen name="promo" options={{ href: null }} />
      <Tabs.Screen name="project/[id]" options={{ href: null }} />
      <Tabs.Screen name="debts" options={{ href: null }} />
      <Tabs.Screen name="my-orders" options={{ href: null }} />
      <Tabs.Screen name="quotations" options={{ href: null }} />
      <Tabs.Screen name="quotation/[id]" options={{ href: null }} />
      <Tabs.Screen name="quote" options={{ href: null }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen name="catalog" options={{ href: null }} />
      <Tabs.Screen name="weather" options={{ href: null }} />
      <Tabs.Screen name="contract" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="knowledge" options={{ href: null }} />
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      <Tabs.Screen name="order/[id]/edit" options={{ href: null }} />
      <Tabs.Screen name="workforce" options={{ href: null }} />
      <Tabs.Screen name="reminders" options={{ href: null }} />
      <Tabs.Screen name="survey" options={{ href: null }} />
      <Tabs.Screen name="shop-floor" options={{ href: null }} />
      <Tabs.Screen name="qc" options={{ href: null }} />
      <Tabs.Screen name="installations" options={{ href: null }} />
      <Tabs.Screen name="service-warranty" options={{ href: null }} />
      <Tabs.Screen name="media-sync" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    document.title = 'Eurohouse CSSX';
    if (!('serviceWorker' in navigator)) return;

    let reloading = false;
    const reloadOnUpdate = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnUpdate);
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => undefined);

    return () => navigator.serviceWorker.removeEventListener('controllerchange', reloadOnUpdate);
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate />
    </AuthProvider>
  );
}
