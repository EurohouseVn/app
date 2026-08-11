import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '@eurohouse/ui';
import { tabBarIcon } from '../src/components/Icon';
import { AuthProvider, useAuth } from '../src/lib/auth';
import AuthScreen from './auth';

function Gate() {
  const { user, ready } = useAuth();

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
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 12,
          height: 78,
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
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="knowledge" options={{ href: null }} />
      <Tabs.Screen name="order/[id]" options={{ href: null }} />
      <Tabs.Screen name="order/[id]/edit" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate />
    </AuthProvider>
  );
}
