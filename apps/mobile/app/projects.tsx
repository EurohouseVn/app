import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { confirmAction } from '../src/lib/alert';

const statusLabel: Record<string, { text: string; color: string }> = {
  OPEN: { text: 'Khảo sát', color: colors.brandOrange },
  IN_PROGRESS: { text: 'Đang thi công', color: colors.warning },
  DONE: { text: 'Hoàn tất', color: colors.success },
  CANCELLED: { text: 'Đã hủy', color: colors.danger },
};

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const data = await LocalProjectsApi.getAll();
    setProjects(data);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createProject() {
    setCreating(true);
    try {
      const project = await LocalProjectsApi.create({
        name: 'Công trình mới',
      });
      router.push(`/project/${project.id}` as Href);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteProject = (id: string, name: string) => {
    confirmAction('Xoá công trình', `Bạn có chắc chắn muốn xoá công trình "${name}"?`, async () => {
      await LocalProjectsApi.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id && p.code !== id));
      load();
    });
  };

  // Phan tich dashboard.
  const currentYear = new Date().getFullYear();
  let yearlyRevenue = 0;
  projects.forEach((p) => {
    const pDate = new Date(p.createdAt);
    if (pDate.getFullYear() === currentYear && p.status === 'DONE') {
      yearlyRevenue += p.finalAmount || p.estimatedAmount || 0;
    }
  });

  const highestProfitProject = projects.reduce((max, p) => (p.expectedProfit > (max?.expectedProfit || 0) && p.expectedProfit > 0) ? p : max, null as LocalProject | null);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công trình" subtitle="Lưu trữ an toàn trên thiết bị" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* DASHBOARD TỔNG DOANH THU */}
        <View style={styles.dashboardCard}>
          <View style={styles.dashHeader}>
            <Icon name="trending-up" size={24} color={colors.brandOrangeText} />
            <Text style={styles.dashTitle}>Doanh thu {currentYear}</Text>
          </View>
          <Text style={styles.dashAmount}>{(yearlyRevenue / 1000000).toLocaleString('vi-VN')} triệu</Text>
          <Text style={styles.dashSubtitle}>Chỉ tính các công trình đã Hoàn tất</Text>

          {highestProfitProject && (
            <View style={styles.highlightRow}>
              <Icon name="award" size={16} color={colors.brandOrangeText} />
              <Text style={styles.highlightText} numberOfLines={1}>
                Siêu lợi nhuận: {highestProfitProject.name} ({(highestProfitProject.expectedProfit / 1000000).toLocaleString('vi-VN')}tr)
              </Text>
            </View>
          )}
        </View>

        <Pressable style={[styles.createBtn, creating && { opacity: 0.6 }]} disabled={creating} onPress={createProject}>
          <Icon name="plus" size={20} color={colors.brandBlack.main} />
          <Text style={styles.createText}>{creating ? 'Đang tạo...' : 'Tạo công trình mới'}</Text>
        </Pressable>

        {projects.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="layers" size={26} color={colors.brandGrey[500]} /></View>
            <Text style={styles.emptyText}>Chưa có công trình. Tạo công trình đầu tiên để theo dõi doanh thu và lợi nhuận.</Text>
          </View>
        ) : (
          projects.map((p) => {
            const st = statusLabel[p.status] ?? statusLabel.OPEN;
            const profitColor = p.expectedProfit >= 0 ? colors.success : colors.danger;
            const revenue = p.finalAmount || p.estimatedAmount || 0;
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Pressable style={styles.cardIcon} onPress={() => router.push(`/project/${p.id}` as Href)}>
                    <Icon name="home" size={20} color={colors.brandOrange} />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/project/${p.id}` as Href)}>
                    <Text style={styles.code}>{p.code}</Text>
                    <Text style={styles.pname}>{p.name}</Text>
                    {p.customerName ? <Text style={styles.customer}>{p.customerName}</Text> : null}
                  </Pressable>

                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: st.color + '1A' }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      <Pressable style={styles.actionBtn} onPress={() => router.push(`/project/${p.id}` as Href)}>
                        <Icon name="edit-2" size={13} color={colors.brandBlack.main} />
                      </Pressable>
                      <Pressable style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDeleteProject(p.id, p.name)}>
                        <Icon name="trash-2" size={13} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <Pressable style={styles.metrics} onPress={() => router.push(`/project/${p.id}` as Href)}>
                  <View><Text style={styles.mLabel}>Doanh thu</Text><Text style={styles.mValue}>{(revenue / 1000000).toFixed(1)}tr</Text></View>
                  <View><Text style={styles.mLabel}>Phát sinh</Text><Text style={styles.mValue}>{(p.additionalCosts / 1000000).toFixed(1)}tr</Text></View>
                  <View><Text style={styles.mLabel}>Lợi nhuận</Text><Text style={[styles.mValue, { color: profitColor }]}>{(p.expectedProfit / 1000000).toFixed(1)}tr</Text></View>
                </Pressable>

                <Pressable
                  style={{ backgroundColor: colors.brandOrange, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onPress={() => {
                    router.push({
                      pathname: '/orders',
                      params: {
                        projectId: p.id,
                        projectCode: p.code,
                        projectName: p.name,
                        customerName: p.customerName,
                        customerPhone: p.customerPhone,
                        deliveryAddress: p.address,
                        quotationCode: p.quotationCode,
                      },
                    } as Href);
                  }}
                >
                  <Icon name="shopping-bag" size={14} color={colors.brandBlack.main} />
                  <Text style={{ color: colors.brandBlack.main, fontWeight: '900', fontSize: 12 }}>BÓC TÁCH & ĐẶT NHÔM TỪ CÔNG TRÌNH</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  dashboardCard: { backgroundColor: colors.orangeSoft, borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: colors.brandOrange, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  dashHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  dashTitle: { color: colors.brandOrangeText, fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  dashAmount: { color: colors.brandBlack.main, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  dashSubtitle: { color: colors.brandGrey[500], fontSize: 13, marginTop: 4 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255, 107, 0, 0.1)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginTop: 18 },
  highlightText: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '700', flex: 1 },
  createBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 16, marginBottom: 16, shadowColor: colors.brandOrange, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  createText: { color: colors.brandBlack.main, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500], textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrange, fontWeight: '900', fontSize: 12 },
  pname: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 16, marginTop: 2 },
  customer: { color: colors.brandGrey[500], marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '800', fontSize: 12 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingTop: 12 },
  mLabel: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '700' },
  mValue: { color: colors.brandBlack.main, fontWeight: '900', marginTop: 2 },
  actionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
});
