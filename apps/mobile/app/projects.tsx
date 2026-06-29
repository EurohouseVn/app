import { useCallback, useState } from 'react';
import { Link, useFocusEffect, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { ProjectSummary } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

const statusLabel: Record<string, { text: string; color: string }> = {
  OPEN: { text: 'Đang mở', color: colors.brandOrange },
  IN_PROGRESS: { text: 'Thi công', color: colors.warning },
  DONE: { text: 'Hoàn tất', color: colors.success },
  CANCELLED: { text: 'Đã hủy', color: colors.danger },
};

export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.get<ProjectSummary[]>('/projects').then(setProjects).catch(() => setProjects([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function createProject() {
    setCreating(true);
    try {
      const project = await api.post<{ id: string }>('/projects', {
        ownerEmail: 'tho@eurohouse.vn',
        name: 'Công trình mới',
      });
      router.push(`/project/${project.id}` as Href);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công trình" subtitle="Theo dõi lợi nhuận từng công trình" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={[styles.createBtn, creating && { opacity: 0.6 }]} disabled={creating} onPress={createProject}>
          <Icon name="plus" size={18} color={colors.brandOrange} />
          <Text style={styles.createText}>{creating ? 'Đang tạo...' : 'Tạo công trình mới'}</Text>
        </Pressable>

        {projects.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="layers" size={26} color={colors.brandGrey} /></View>
            <Text style={styles.emptyText}>Chưa có công trình. Tạo công trình đầu tiên để theo dõi lợi nhuận.</Text>
          </View>
        ) : (
          projects.map((p) => {
            const st = statusLabel[p.status] ?? statusLabel.OPEN;
            const profitColor = p.profit >= 0 ? colors.success : colors.danger;
            return (
              <Link key={p.id} href={`/project/${p.id}` as Href} asChild>
                <Pressable style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.cardIcon}><Icon name="home" size={20} color={colors.brandOrange} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.code}>{p.code}</Text>
                      <Text style={styles.pname}>{p.name}</Text>
                      {p.customerName ? <Text style={styles.customer}>{p.customerName}</Text> : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: st.color + '1A' }]}><Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text></View>
                  </View>
                  <View style={styles.metrics}>
                    <View><Text style={styles.mLabel}>Doanh thu</Text><Text style={styles.mValue}>{(p.contractValue / 1000000).toFixed(1)}tr</Text></View>
                    <View><Text style={styles.mLabel}>Chi phí</Text><Text style={styles.mValue}>{(p.totalCost / 1000000).toFixed(1)}tr</Text></View>
                    <View><Text style={styles.mLabel}>Lợi nhuận</Text><Text style={[styles.mValue, { color: profitColor }]}>{(p.profit / 1000000).toFixed(1)}tr · {p.profitPct}%</Text></View>
                  </View>
                </Pressable>
              </Link>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  createBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack, borderRadius: 16, paddingVertical: 15, marginBottom: 16 },
  createText: { color: colors.brandOrange, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey, textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrange, fontWeight: '900', fontSize: 12 },
  pname: { color: colors.brandBlack, fontWeight: '900', fontSize: 16, marginTop: 2 },
  customer: { color: colors.brandGrey, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '800', fontSize: 12 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingTop: 12 },
  mLabel: { color: colors.brandGrey, fontSize: 11, fontWeight: '700' },
  mValue: { color: colors.brandBlack, fontWeight: '900', marginTop: 2 },
});
