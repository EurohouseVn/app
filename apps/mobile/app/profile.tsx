import { useCallback, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { ProjectSummary } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  NPP: 'Nhà phân phối',
  DAILY: 'Đại lý',
  FACTORY: 'Thợ / Xưởng sản xuất',
};

const tools: { label: string; href: Href; icon: IconName; desc: string; bg: string; fg: string }[] = [
  { label: 'Công trình', href: '/projects', icon: 'layers', desc: 'Quản lý & theo dõi lợi nhuận', bg: '#FFF3DF', fg: colors.brandOrange },
  { label: 'Báo giá tự động', href: '/quotation', icon: 'file-text', desc: 'Sinh báo giá chào khách', bg: '#E8F1FF', fg: '#2F6FED' },
  { label: 'Công nợ', href: '/debts', icon: 'credit-card', desc: 'NPP, phụ kiện, khách hàng', bg: '#FFEAEA', fg: colors.brandRed },
  { label: 'Bảo hành QR', href: '/warranty', icon: 'maximize', desc: 'Kích hoạt & tích điểm', bg: '#E9F8EE', fg: colors.success },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.get<ProjectSummary[]>('/projects').then(setProjects).catch(() => setProjects([]));
    }, []),
  );

  const totalRevenue = projects.reduce((s, p) => s + p.contractValue, 0);
  const totalProfit = projects.reduce((s, p) => s + p.profit, 0);
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
  const roleLabel = user ? roleLabels[user.role] ?? user.role : '';

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Khu làm việc" subtitle={roleLabel || 'Eurohouse'} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Icon name="user" size={24} color={colors.brandOrange} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.displayName ?? 'Người dùng'}</Text>
            <Text style={styles.area}>{user?.email ?? ''}</Text>
          </View>
          <Pressable style={styles.settingsBtn} onPress={logout}><Icon name="log-out" size={18} color={colors.brandGrey} /></Pressable>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Icon name="layers" size={18} color={colors.brandOrange} />
            <Text style={styles.kpiValue}>{projects.length}</Text>
            <Text style={styles.kpiLabel}>Công trình</Text>
          </View>
          <View style={styles.kpiCard}>
            <Icon name="trending-up" size={18} color="#2F6FED" />
            <Text style={styles.kpiValue}>{(totalRevenue / 1000000).toFixed(0)}tr</Text>
            <Text style={styles.kpiLabel}>Doanh thu</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.brandBlack }]}>
            <Icon name="award" size={18} color={colors.brandOrange} />
            <Text style={[styles.kpiValue, { color: colors.brandOrange }]}>{(totalProfit / 1000000).toFixed(0)}tr</Text>
            <Text style={[styles.kpiLabel, { color: 'rgba(255,255,255,0.8)' }]}>Lãi · {margin}%</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Công cụ</Text>
        {tools.map((tool) => (
          <Link key={tool.label} href={tool.href} asChild>
            <Pressable style={styles.toolItem}>
              <View style={[styles.toolIcon, { backgroundColor: tool.bg }]}><Icon name={tool.icon} size={22} color={tool.fg} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toolLabel}>{tool.label}</Text>
                <Text style={styles.toolDesc}>{tool.desc}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.brandGrey} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 22, padding: 16, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.brandBlack, fontWeight: '900', fontSize: 16 },
  area: { color: colors.brandGrey, marginTop: 2 },
  settingsBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 6, shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  kpiValue: { color: colors.brandBlack, fontWeight: '900', fontSize: 20 },
  kpiLabel: { color: colors.brandGrey, fontWeight: '700', fontSize: 11 },
  sectionTitle: { color: colors.brandBlack, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 14 },
  toolItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  toolIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { color: colors.brandBlack, fontWeight: '900', fontSize: 15 },
  toolDesc: { color: colors.brandGrey, fontSize: 12, marginTop: 2 },
});
