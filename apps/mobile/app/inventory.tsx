import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';

type InventoryItem = {
  id: string; materialCode: string; profileName?: string; systemCode?: string; systemName?: string;
  lengthMm: number; quantity: number; kgPerMeter?: number; type: 'FULL_BAR' | 'DE_XE';
};

export default function InventoryScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [scrapKg, setScrapKg] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'FULL_BAR' | 'DE_XE'>('FULL_BAR');
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState('ALL');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ materialCode: '', lengthMm: '6000', quantity: '1' });
  useResetScrollOnFocus(scrollRef);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<{ items: InventoryItem[]; scrapKg: number }>('/inventory');
      setItems(res.items || []);
      setScrapKg(res.scrapKg || 0);
    } catch (error) {
      setItems([]);
      Alert.alert('Không tải được kho', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void fetchData(); }, [fetchData]));

  const systems = useMemo(() => Array.from(new Map(items.map((item) => [item.systemCode || 'KHAC', item.systemName || 'Khác'])).entries()), [items]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi');
    return items.filter((item) => item.type === tab && (system === 'ALL' || item.systemCode === system) && (!needle || `${item.materialCode} ${item.profileName || ''}`.toLocaleLowerCase('vi').includes(needle)));
  }, [items, search, system, tab]);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: InventoryItem[] }>();
    filtered.forEach((item) => {
      const key = item.systemCode || 'KHAC';
      const group = map.get(key) || { name: item.systemName || 'Khác', items: [] };
      group.items.push(item);
      map.set(key, group);
    });
    return Array.from(map.entries());
  }, [filtered]);
  const fullBars = items.filter((item) => item.type === 'FULL_BAR').reduce((sum, item) => sum + item.quantity, 0);
  const fullBarKg = items.filter((item) => item.type === 'FULL_BAR').reduce((sum, item) => sum + item.quantity * (item.lengthMm / 1000) * Number(item.kgPerMeter || 0), 0);
  const remnantPieces = items.filter((item) => item.type === 'DE_XE').reduce((sum, item) => sum + item.quantity, 0);

  const adjust = async (direction: 1 | -1) => {
    setSaving(true);
    try {
      await api.post('/inventory/items/adjust', { materialCode: form.materialCode, lengthMm: Number(form.lengthMm), quantity: direction * Math.max(1, Number(form.quantity) || 1), type: tab });
      setAdjustOpen(false);
      setForm({ materialCode: '', lengthMm: tab === 'FULL_BAR' ? '6000' : '', quantity: '1' });
      await fetchData();
    } catch (error) {
      Alert.alert('Không cập nhật được kho', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại dữ liệu.');
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Kho của tôi', headerShadowVisible: false }} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} />}>
        <View style={styles.headerRow}>
          <View><Text style={styles.title}>Kho nhôm xưởng</Text><Text style={styles.subtitle}>Cây nguyên, đoạn dư và phế liệu được tách riêng.</Text></View>
          <Pressable style={styles.addButton} onPress={() => { setForm({ materialCode: '', lengthMm: tab === 'FULL_BAR' ? '6000' : '', quantity: '1' }); setAdjustOpen(true); }}><Icon name="plus" size={19} color={colors.brandBlack.main} /></Pressable>
        </View>

        <View style={styles.kpiRow}>
          <Kpi icon="box" label="Cây nguyên" value={`${fullBars} cây`} sub={`${fullBarKg.toFixed(1)} kg`} />
          <Kpi icon="repeat" label="Đoạn DC" value={`${remnantPieces} đoạn`} sub="Có thể tái sử dụng" />
          <Kpi icon="trash-2" label="Phế liệu" value={`${scrapKg.toFixed(1)} kg`} sub="Dưới ngưỡng DC" />
        </View>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'FULL_BAR' && styles.tabActive]} onPress={() => { setTab('FULL_BAR'); setSystem('ALL'); }}><Text style={[styles.tabText, tab === 'FULL_BAR' && styles.tabTextActive]}>Kho cây nguyên</Text></Pressable>
          <Pressable style={[styles.tab, tab === 'DE_XE' && styles.tabActive]} onPress={() => { setTab('DE_XE'); setSystem('ALL'); }}><Text style={[styles.tabText, tab === 'DE_XE' && styles.tabTextActive]}>Tồn kho & DC</Text></Pressable>
        </View>
        <View style={styles.searchBox}><Icon name="search" size={17} color={colors.brandGrey[500]} /><TextInput value={search} onChangeText={setSearch} style={styles.searchInput} placeholder="Tìm mã thanh hoặc tên thanh" placeholderTextColor="#94A3B8" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Filter active={system === 'ALL'} label={`Tất cả (${filtered.length})`} onPress={() => setSystem('ALL')} />
          {systems.map(([code, name]) => <Filter key={code} active={system === code} label={name} onPress={() => setSystem(code)} />)}
        </ScrollView>

        {loading ? <ActivityIndicator color={colors.brandOrange} style={{ marginTop: 34 }} /> : groups.length === 0 ? (
          <View style={styles.empty}><Icon name="box" size={30} color={colors.brandGrey[400]} /><Text style={styles.emptyTitle}>{tab === 'FULL_BAR' ? 'Kho cây nguyên đang trống' : 'Chưa có đoạn DC phù hợp'}</Text><Text style={styles.emptyText}>Bấm nút + để ghi nhận hàng nhận từ NPP hoặc tồn thực tế.</Text></View>
        ) : groups.map(([code, group]) => (
          <View key={code} style={styles.group}>
            <View style={styles.groupHeader}><View><Text style={styles.groupTitle}>{group.name}</Text><Text style={styles.groupMeta}>{code} · {group.items.length} quy cách</Text></View><Text style={styles.groupQty}>{group.items.reduce((sum, item) => sum + item.quantity, 0)}</Text></View>
            {group.items.map((item) => (
              <Pressable key={item.id} style={styles.item} onPress={() => { setForm({ materialCode: item.materialCode, lengthMm: String(item.lengthMm), quantity: '1' }); setAdjustOpen(true); }}>
                <View style={{ flex: 1 }}><Text style={styles.itemCode}>{item.materialCode}</Text><Text style={styles.itemName}>{item.profileName || item.materialCode}</Text><Text style={styles.itemMeta}>Dài {(item.lengthMm / 1000).toLocaleString('vi-VN')} m{item.kgPerMeter ? ` · ${(item.quantity * item.lengthMm / 1000 * item.kgPerMeter).toFixed(2)} kg` : ''}</Text></View>
                <View style={styles.qtyBadge}><Text style={styles.qtyText}>{item.quantity}</Text><Text style={styles.qtyUnit}>{tab === 'FULL_BAR' ? 'cây' : 'đoạn'}</Text></View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={adjustOpen} transparent animationType="slide" onRequestClose={() => setAdjustOpen(false)}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>{tab === 'FULL_BAR' ? 'Cập nhật cây nguyên' : 'Cập nhật đoạn DC'}</Text><Text style={styles.sheetSub}>Nhập dương để nhận kho, chọn Xuất để giảm kho.</Text></View><Pressable style={styles.close} onPress={() => setAdjustOpen(false)}><Icon name="x" size={20} /></Pressable></View>
          <Text style={styles.label}>Mã thanh</Text><TextInput value={form.materialCode} onChangeText={(v) => setForm((p) => ({ ...p, materialCode: v }))} style={styles.input} placeholder="Ví dụ C3304" autoCapitalize="characters" placeholderTextColor="#94A3B8" />
          <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Text style={styles.label}>Chiều dài (mm)</Text><TextInput value={form.lengthMm} onChangeText={(v) => setForm((p) => ({ ...p, lengthMm: v }))} style={styles.input} keyboardType="numeric" placeholder="6000" placeholderTextColor="#94A3B8" /></View><View style={{ flex: 1 }}><Text style={styles.label}>Số lượng</Text><TextInput value={form.quantity} onChangeText={(v) => setForm((p) => ({ ...p, quantity: v }))} style={styles.input} keyboardType="numeric" placeholder="1" placeholderTextColor="#94A3B8" /></View></View>
          <View style={styles.actionRow}><Pressable disabled={saving} style={styles.outButton} onPress={() => adjust(-1)}><Icon name="arrow-up-circle" size={18} color={colors.danger} /><Text style={styles.outText}>Xuất kho</Text></Pressable><Pressable disabled={saving} style={styles.inButton} onPress={() => adjust(1)}>{saving ? <ActivityIndicator color={colors.brandBlack.main} /> : <Icon name="arrow-down-circle" size={18} color={colors.brandBlack.main} />}<Text style={styles.inText}>Nhận kho</Text></Pressable></View>
        </View></View>
      </Modal>
    </View>
  );
}

function Kpi({ icon, label, value, sub }: { icon: 'box' | 'repeat' | 'trash-2'; label: string; value: string; sub: string }) { return <View style={styles.kpi}><Icon name={icon} size={18} color={colors.brandOrangeText} /><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue}>{value}</Text><Text style={styles.kpiSub}>{sub}</Text></View>; }
function Filter({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable style={[styles.filter, active && styles.filterActive]} onPress={onPress}><Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandGrey[50] }, content: { padding: 16, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 22, fontWeight: '900', color: colors.brandBlack.main }, subtitle: { color: colors.brandGrey[500], fontSize: 12, marginTop: 3 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' },
  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 18 }, kpi: { flex: 1, minHeight: 116, backgroundColor: colors.white, borderRadius: 14, padding: 11, borderWidth: 1, borderColor: colors.brandGrey[100] }, kpiLabel: { color: colors.brandGrey[500], fontSize: 10, fontWeight: '700', marginTop: 7 }, kpiValue: { color: colors.brandBlack.main, fontSize: 17, fontWeight: '900', marginTop: 4 }, kpiSub: { color: colors.brandGrey[500], fontSize: 9, marginTop: 3 },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, padding: 4, borderRadius: 13, marginTop: 18 }, tab: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: colors.orangeSoft }, tabText: { color: colors.brandGrey[500], fontWeight: '800', fontSize: 12 }, tabTextActive: { color: colors.brandOrangeText },
  searchBox: { minHeight: 48, borderRadius: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginTop: 12, borderWidth: 1, borderColor: colors.brandGrey[100] }, searchInput: { flex: 1, color: colors.brandBlack.main },
  filters: { gap: 8, paddingVertical: 12 }, filter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brandGrey[200] }, filterActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange }, filterText: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 11 }, filterTextActive: { color: colors.brandOrangeText },
  empty: { alignItems: 'center', padding: 38, backgroundColor: colors.white, borderRadius: 14, marginTop: 6 }, emptyTitle: { fontWeight: '900', color: colors.brandBlack.main, marginTop: 10 }, emptyText: { color: colors.brandGrey[500], textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 5 },
  group: { backgroundColor: colors.white, borderRadius: 14, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.brandGrey[100] }, groupHeader: { minHeight: 62, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF9F5' }, groupTitle: { fontWeight: '900', color: colors.brandBlack.main, fontSize: 14 }, groupMeta: { color: colors.brandGrey[500], fontSize: 10, marginTop: 3 }, groupQty: { color: colors.brandOrangeText, fontSize: 20, fontWeight: '900' },
  item: { minHeight: 77, padding: 13, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.brandGrey[100] }, itemCode: { color: colors.brandBlack.main, fontSize: 15, fontWeight: '900' }, itemName: { color: colors.brandGrey[600], fontSize: 11, marginTop: 2 }, itemMeta: { color: colors.brandGrey[500], fontSize: 10, marginTop: 4 }, qtyBadge: { minWidth: 48, alignItems: 'center', padding: 7, borderRadius: 10, backgroundColor: colors.orangeSoft }, qtyText: { color: colors.brandOrangeText, fontSize: 17, fontWeight: '900' }, qtyUnit: { color: colors.brandOrangeText, fontSize: 9, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, sheetTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900' }, sheetSub: { color: colors.brandGrey[500], fontSize: 11, marginTop: 3 }, close: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandGrey[100], alignItems: 'center', justifyContent: 'center' }, label: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 12, marginBottom: 6 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.brandGrey[200], borderRadius: 12, paddingHorizontal: 12, color: colors.brandBlack.main, marginBottom: 14 }, actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 }, outButton: { flex: 1, minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#FDA4AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, outText: { color: colors.danger, fontWeight: '900' }, inButton: { flex: 1, minHeight: 52, borderRadius: 13, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, inText: { color: colors.brandBlack.main, fontWeight: '900' },
});
