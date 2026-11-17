import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { confirmAction, showAlert } from '../src/lib/alert';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';

const statusLabel: Record<string, { text: string; color: string }> = {
  OPEN: { text: 'Khảo sát', color: colors.brandOrange },
  IN_PROGRESS: { text: 'Đang thi công', color: colors.warning },
  DONE: { text: 'Hoàn tất', color: colors.success },
  CANCELLED: { text: 'Đã hủy', color: colors.danger },
};

export default function ProjectsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useResetScrollOnFocus(scrollRef);

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
      setDeletingId(id);
      try {
        await LocalProjectsApi.delete(id);
        setProjects(prev => prev.filter(p => p.id !== id && p.code !== id));
      } catch (error) {
        showAlert('Không thể xoá công trình', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      } finally {
        setDeletingId(null);
      }
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công trình" subtitle="Lưu trữ an toàn trên thiết bị" />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* DASHBOARD TỔNG DOANH THU */}
        <View style={styles.dashboardCard}>
          <View style={styles.dashHeader}>
            <Icon name="trending-up" size={20} color={colors.brandOrangeText} />
            <Text style={styles.dashTitle}>Doanh thu {currentYear}</Text>
          </View>
          <Text style={styles.dashAmount}>{(yearlyRevenue / 1000000).toLocaleString('vi-VN')} triệu</Text>
          <Text style={styles.dashSubtitle}>Chỉ tính các công trình đã Hoàn tất</Text>
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
                    <Text style={styles.pname} numberOfLines={2}>{p.name}</Text>
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
                      <Pressable
                        accessibilityLabel={`Xoá công trình ${p.name}`}
                        disabled={deletingId === p.id}
                        style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }, deletingId === p.id && { opacity: 0.45 }]}
                        onPress={() => handleDeleteProject(p.id, p.name)}
                      >
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
                  style={styles.orderBtn}
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
                  <Text style={styles.orderBtnText} numberOfLines={1}>BÓC TÁCH & ĐẶT NHÔM TỪ CÔNG TRÌNH</Text>
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
  dashboardCard: { backgroundColor: colors.orangeSoft, borderRadius: 22, padding: 20, marginBottom: 18, shadowColor: colors.brandOrange, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  dashHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dashTitle: { color: colors.brandOrangeText, fontSize: 12, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase' },
  dashAmount: { color: colors.brandBlack.main, fontSize: 30, lineHeight: 36, fontWeight: '900' },
  dashSubtitle: { color: colors.brandGrey[500], fontSize: 12, lineHeight: 17, marginTop: 2 },
  createBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 14, marginBottom: 16, shadowColor: colors.brandOrange, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  createText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500], textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrange, fontWeight: '900', fontSize: 11, lineHeight: 14 },
  pname: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14, lineHeight: 18, marginTop: 2 },
  customer: { color: colors.brandGrey[500], fontSize: 12, lineHeight: 16, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontWeight: '800', fontSize: 11 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingTop: 10 },
  mLabel: { color: colors.brandGrey[500], fontSize: 10, lineHeight: 14, fontWeight: '700' },
  mValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13, lineHeight: 17, marginTop: 1 },
  actionBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
  orderBtn: { minHeight: 40, backgroundColor: colors.brandOrange, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  orderBtnText: { flexShrink: 1, color: colors.brandBlack.main, fontWeight: '900', fontSize: 11, lineHeight: 14 },
});
