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
  { label: 'Công trình', href: '/projects', icon: 'layers', desc: 'Quản lý & theo dõi lợi nhuận', bg: '#FFFFFF', fg: colors.brandOrange },
  { label: 'Báo giá tự động', href: '/quote', icon: 'file-text', desc: 'Sinh báo giá chào khách', bg: '#FFFFFF', fg: '#2F6FED' },
  { label: 'Kiến thức', href: '/knowledge' as any, icon: 'book' as any, desc: 'Cẩm nang & Hướng dẫn thi công', bg: '#FFFFFF', fg: '#0284c7' },
  { label: 'Thư viện', href: '/library', icon: 'image', desc: 'Mẫu cửa & Hình ảnh từ Eurohouse', bg: '#FFFFFF', fg: '#9333ea' },
  { label: 'Tồn kho & Đề xê', href: '/inventory', icon: 'box', desc: 'Quản lý kho nhôm & phế liệu', bg: '#FFFFFF', fg: '#0090FF' },
  { label: 'Công nợ', href: '/debts', icon: 'credit-card', desc: 'NPP, phụ kiện, khách hàng', bg: '#FFFFFF', fg: colors.danger },
  { label: 'Cấu hình báo giá / Hồ sơ', href: '/edit-profile', icon: 'settings', desc: 'Sửa tên, logo, địa chỉ...', bg: '#FFFFFF', fg: colors.brandGrey[800] },
  { label: 'Bảo hành QR', href: '/warranty', icon: 'maximize', desc: 'Kích hoạt & tích điểm', bg: '#FFFFFF', fg: colors.success },
  { label: 'Đổi quà tích luỹ', href: '/loyalty', icon: 'gift', desc: 'Xem điểm và đổi quà tặng', bg: '#FFFFFF', fg: '#8833FF' },
  { label: 'Cộng đồng Facebook', href: 'https://www.facebook.com/eurohouse' as any, icon: 'facebook' as any, desc: 'Giao lưu & hỏi đáp kỹ thuật', bg: '#FFFFFF', fg: '#1877F2' },
  { label: 'Zalo Support (OA)', href: 'https://zalo.me/eurohouse' as any, icon: 'message-circle', desc: 'Hỗ trợ kỹ thuật 24/7', bg: '#FFFFFF', fg: '#0068FF' },
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
    <View style={{ flex: 1, backgroundColor: colors.brandGrey[50] || '#FAFAFA' }}>
      <AppHeader title="Khu làm việc" subtitle={roleLabel || 'Eurohouse'} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Icon name="user" size={24} color={colors.brandOrange} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.displayName ?? 'Người dùng'}</Text>
            <Text style={styles.area}>{user?.email ?? ''}</Text>
          </View>
          <Pressable style={styles.settingsBtn} onPress={logout}><Icon name="log-out" size={18} color={colors.brandGrey[500]} /></Pressable>
        </View>

        {/* Thợ Pro Summary Card */}
        <View style={{ backgroundColor: '#1e293b', borderRadius: 22, padding: 16, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ color: colors.brandBlack.main, fontWeight: '900', fontSize: 11 }}>THỢ PRO · GOLD</Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>Thợ Lành nghề</Text>
            </View>
            <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 14 }}>{user?.points || 0} EP</Text>
          </View>

          <View style={{ height: 6, backgroundColor: '#334155', borderRadius: 3, marginVertical: 8, overflow: 'hidden' }}>
            <View style={{ width: '70%', height: '100%', backgroundColor: '#f59e0b', borderRadius: 3 }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: '#cbd5e1', fontSize: 12 }}>Nhiệm vụ tháng: 2/3 công trình QR</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Link href="/loyalty" asChild>
                <Pressable style={{ backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12 }}>Đổi quà</Text>
                </Pressable>
              </Link>
            </View>
          </View>
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
          <View style={[styles.kpiCard, { backgroundColor: colors.white }]}>
            <Icon name="award" size={18} color={colors.brandOrangeText} />
            <Text style={[styles.kpiValue, { color: colors.brandOrangeText }]}>{(totalProfit / 1000000).toFixed(0)}tr</Text>
            <Text style={[styles.kpiLabel, { color: colors.brandGrey[500] }]}>Lãi · {margin}%</Text>
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
              <Icon name="chevron-right" size={22} color={colors.brandGrey[500]} />
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 22, padding: 16, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  avatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 16 },
  area: { color: colors.brandGrey[500], marginTop: 2 },
  settingsBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 6, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  kpiValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 20 },
  kpiLabel: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 11 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900', marginTop: 26, marginBottom: 14 },
  toolItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  toolIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  toolLabel: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  toolDesc: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
});
