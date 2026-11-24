import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { PROJECT_STATUS } from '../src/components/projectStatus';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import {
  amountDue,
  compactVnd,
  contractValue,
  countByFilter,
  daysSinceUpdate,
  filterProjects,
  hasDebt,
  isStale,
  projectSummary,
  sortForList,
  type ProjectFilter,
} from '../src/lib/projectListState';


const FILTERS: { key: ProjectFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'ATTENTION', label: 'Cần xử lý' },
  { key: 'IN_PROGRESS', label: 'Đang thi công' },
  { key: 'DEBT', label: 'Còn nợ' },
  { key: 'OPEN', label: 'Báo giá' },
  { key: 'DONE', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã huỷ' },
];

function ProjectRow({ project, now, onPress }: { project: LocalProject; now: number; onPress: () => void }) {
  const status = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.OPEN;
  const due = amountDue(project);
  const stale = isStale(project, now);
  const debt = hasDebt(project);
  let sideLabel = 'Giá trị';
  let sideValue = compactVnd(contractValue(project));
  let sideTone: 'due' | 'ok' | 'muted' | 'plain' = 'plain';
  if (project.status === 'CANCELLED') { sideLabel = 'Đã huỷ'; sideValue = '—'; sideTone = 'muted'; }
  else if (project.status === 'OPEN') sideLabel = 'Báo giá';
  else if (due !== undefined && due > 0) { sideLabel = 'Còn phải thu'; sideValue = compactVnd(due); sideTone = 'due'; }
  else if (due === 0 && project.receivedAmount !== undefined && contractValue(project) > 0) { sideLabel = 'Đã thu đủ'; sideTone = 'ok'; }
  const meta = [project.customerName, project.address].filter(Boolean).join(' · ') || project.code;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở công trình ${project.name}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.rowIcon, { backgroundColor: status.bg }]}><Icon name={status.icon} size={18} color={status.text} /></View>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={2}>{project.name || 'Công trình chưa đặt tên'}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text>
        <View style={styles.flags}>
          <View style={[styles.badge, { backgroundColor: status.bg }]}><Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text></View>
          {debt ? <View style={[styles.badge, styles.badgeDanger]}><Icon name="alert-circle" size={11} color="#B42318" /><Text style={[styles.badgeText, { color: '#B42318' }]}>Còn nợ</Text></View> : null}
          {stale ? <View style={[styles.badge, styles.badgeMuted]}><Icon name="clock" size={11} color="#475467" /><Text style={[styles.badgeText, { color: '#475467' }]}>{daysSinceUpdate(project, now)} ngày chưa cập nhật</Text></View> : null}
          {project.syncState === 'PENDING' ? <View style={[styles.badge, styles.badgeMuted]}><Icon name="refresh-cw" size={11} color="#475467" /><Text style={[styles.badgeText, { color: '#475467' }]}>Chờ đồng bộ</Text></View> : null}
        </View>
      </View>
      <View style={styles.rowSide}>
        <Text style={styles.sideLabel}>{sideLabel}</Text>
        <Text style={[styles.sideValue, sideTone === 'due' && styles.sideDue, sideTone === 'ok' && styles.sideOk, sideTone === 'muted' && styles.sideMuted]} numberOfLines={1}>{sideValue}</Text>
      </View>
    </Pressable>
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<LocalProject>>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('ALL');

  useResetScrollOnFocus(listRef);

  const load = useCallback(async () => {
    try {
      setProjects(await LocalProjectsApi.getAll());
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const now = Date.now();
  const summary = useMemo(() => projectSummary(projects, now), [projects, now]);
  const counts = useMemo(() => countByFilter(projects, now), [projects, now]);
  const visible = useMemo(() => sortForList(filterProjects(projects, { query, filter }, now)), [projects, query, filter, now]);

  async function refresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function createProject() {
    setCreating(true);
    try {
      const project = await LocalProjectsApi.create({ name: 'Công trình mới' });
      router.push(`/project/${project.id}` as Href);
    } finally {
      setCreating(false);
    }
  }

  const open = (project: LocalProject) => router.push(`/project/${project.id}` as Href);
  const filtersShown = FILTERS.filter((item) => item.key === 'ALL' || counts[item.key] > 0 || item.key === filter);

  const header = (
    <View>
      <View style={styles.kpis}>
        <View style={styles.kpi}><Text style={styles.kpiLabel}>Đang thi công</Text><Text style={styles.kpiValue}>{summary.running}</Text></View>
        <View style={styles.kpi}><Text style={styles.kpiLabel} numberOfLines={1}>Còn phải thu</Text><Text style={[styles.kpiValue, summary.totalDue > 0 && styles.kpiDue]} numberOfLines={1}>{summary.dueKnown ? compactVnd(summary.totalDue) : '—'}</Text></View>
        <View style={styles.kpi}><Text style={styles.kpiLabel} numberOfLines={1}>Doanh thu {new Date(now).getFullYear()}</Text><Text style={styles.kpiValue} numberOfLines={1}>{compactVnd(summary.revenueThisYear)}</Text></View>
      </View>

      {summary.attention > 0 && filter !== 'ATTENTION' ? (
        <Pressable accessibilityRole="button" onPress={() => setFilter('ATTENTION')} style={({ pressed }) => [styles.attention, pressed && { opacity: 0.85 }]}>
          <View style={styles.attentionIcon}><Icon name="alert-circle" size={16} color={colors.brandOrangeText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.attentionTitle}>Cần xử lý ({summary.attention})</Text>
            <Text style={styles.attentionText}>Còn nợ hoặc quá 14 ngày chưa cập nhật</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.brandOrangeText} />
        </Pressable>
      ) : null}

      <View style={styles.search}>
        <Icon name="search" size={17} color="#667085" />
        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm tên, khách hàng, mã công trình" placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" />
        {query ? <Pressable accessibilityLabel="Xoá tìm kiếm" hitSlop={8} onPress={() => setQuery('')}><Icon name="x" size={17} color="#667085" /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {filtersShown.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setFilter(item.key)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>{counts[item.key]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const empty = !loaded ? (
    <View style={styles.listCard}>{[0, 1, 2].map((i) => <View key={i} style={styles.row}><View style={[styles.rowIcon, styles.skeleton]} /><View style={styles.rowMain}><View style={[styles.skeleton, { height: 13, width: '70%' }]} /><View style={[styles.skeleton, { height: 10, width: '50%', marginTop: 8 }]} /></View></View>)}</View>
  ) : projects.length === 0 ? (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name="briefcase" size={24} color={colors.brandOrangeText} /></View>
      <Text style={styles.emptyTitle}>Chưa có công trình nào</Text>
      <Text style={styles.emptyText}>Tạo công trình đầu tiên để lập báo giá, đặt nhôm và theo dõi thu chi ở một chỗ.</Text>
      <Pressable style={styles.emptyButton} disabled={creating} onPress={createProject}><Icon name="plus" size={16} color={colors.white} /><Text style={styles.emptyButtonText}>Tạo công trình</Text></Pressable>
    </View>
  ) : (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Không có công trình phù hợp</Text>
      <Text style={styles.emptyText}>Thử từ khoá khác hoặc bỏ bộ lọc đang chọn.</Text>
      <Pressable style={styles.clearButton} onPress={() => { setQuery(''); setFilter('ALL'); }}><Text style={styles.clearButtonText}>Xem tất cả</Text></Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AppHeader title="Công trình" subtitle={loaded ? `${projects.length} công trình` : 'Đang tải...'} />
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <View style={[styles.rowWrap, index === 0 && styles.rowWrapFirst, index === visible.length - 1 && styles.rowWrapLast]}>
            <ProjectRow project={item} now={now} onPress={() => open(item)} />
          </View>
        )}
        contentContainerStyle={[styles.content, { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brandOrange} />}
      />
      {projects.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tạo công trình mới" disabled={creating} onPress={createProject} style={({ pressed }) => [styles.fab, { bottom: 16 }, (pressed || creating) && { opacity: 0.85 }]}>
          <Icon name="plus" size={20} color={colors.white} />
          <Text style={styles.fabText}>{creating ? 'Đang tạo...' : 'Công trình'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  content: { paddingHorizontal: 14, paddingTop: 12 },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, minWidth: 0, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', paddingHorizontal: 10, paddingVertical: 9 },
  kpiLabel: { color: '#667085', fontSize: 10.5, fontWeight: '700' },
  kpiValue: { color: '#101828', fontSize: 16, fontWeight: '900', marginTop: 2 },
  kpiDue: { color: '#B54708' },
  attention: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, backgroundColor: '#FFF7EF', borderWidth: 1, borderColor: '#FED7AA' },
  attentionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  attentionTitle: { color: '#7A3108', fontSize: 13.5, fontWeight: '900' },
  attentionText: { color: '#9A4B15', fontSize: 11.5, marginTop: 1 },
  search: { marginTop: 10, height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC' },
  searchInput: { flex: 1, minWidth: 0, color: '#101828', fontSize: 14, paddingVertical: 0 },
  chips: { gap: 6, paddingTop: 10, paddingBottom: 10 },
  chip: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.brandBlack.main, borderColor: colors.brandBlack.main },
  chipText: { color: '#1D2939', fontSize: 12.5, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  chipCount: { color: '#667085', fontSize: 12, fontWeight: '700' },
  chipCountActive: { color: '#D0D5DD' },
  rowWrap: { backgroundColor: colors.white, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E4E7EC', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  rowWrapFirst: { borderTopWidth: 1, borderTopColor: '#E4E7EC', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  rowWrapLast: { borderBottomColor: '#E4E7EC', borderBottomLeftRadius: 18, borderBottomRightRadius: 18, overflow: 'hidden' },
  listCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  rowPressed: { backgroundColor: '#F9FAFB' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { color: '#101828', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  rowMeta: { color: '#667085', fontSize: 11.5, marginTop: 2 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  badge: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeDanger: { backgroundColor: '#FEF3F2' },
  badgeMuted: { backgroundColor: '#F2F4F7' },
  rowSide: { alignItems: 'flex-end', maxWidth: 112 },
  sideLabel: { color: '#667085', fontSize: 10.5, fontWeight: '700' },
  sideValue: { color: '#101828', fontSize: 14, fontWeight: '900', marginTop: 1 },
  sideDue: { color: '#B54708' },
  sideOk: { color: '#067647' },
  sideMuted: { color: '#98A2B3' },
  skeleton: { backgroundColor: '#EEF0F3', borderRadius: 8 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E4E7EC' },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFF2E8', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { color: '#101828', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#667085', fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  emptyButton: { marginTop: 14, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.brandOrange },
  emptyButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  clearButton: { marginTop: 12, height: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', justifyContent: 'center' },
  clearButtonText: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  fab: { position: 'absolute', right: 18, height: 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 18, borderRadius: 18, backgroundColor: colors.brandOrange, shadowColor: colors.brandOrange, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabText: { color: colors.white, fontSize: 14, fontWeight: '900' },
});
