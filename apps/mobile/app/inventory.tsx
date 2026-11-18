import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Chip, EmptyState, Field, IconButton, Input, Kpi, KpiRow, ListRow, Loading, SearchBox, SectionHead, Segmented, Sheet, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api } from '../src/lib/api';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';

type InventoryItem = {
  id: string; materialCode: string; profileName?: string; systemCode?: string; systemName?: string;
  lengthMm: number; quantity: number; kgPerMeter?: number; type: 'FULL_BAR' | 'DE_XE';
};

export default function InventoryScreen() {
  const router = useRouter();
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

  const openAdjust = (materialCode = '', lengthMm = tab === 'FULL_BAR' ? '6000' : '') => {
    setForm({ materialCode, lengthMm, quantity: '1' });
    setAdjustOpen(true);
  };
  const kg = (value: number, digits = 1) => `${value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} kg`;

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader
        title="Tồn kho & đề-xê"
        subtitle="Cây nguyên, đoạn dư và phế liệu"
        onBack={() => router.back()}
        right={<IconButton icon="plus" tone="orange" label="Nhận hoặc xuất kho" onPress={() => openAdjust()} />}
      >
        <Segmented items={[['FULL_BAR', 'Cây nguyên'], ['DE_XE', 'Đoạn đề-xê']]} value={tab} onChange={(next) => { setTab(next); setSystem('ALL'); }} />
      </SubHeader>
      <ScrollView ref={scrollRef} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} tintColor={ws.orange} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} />}>
        <KpiRow>
          <Kpi label="Cây nguyên" value={`${fullBars} cây`} />
          <Kpi label="Đoạn đề-xê" value={`${remnantPieces} đoạn`} />
          <Kpi label="Phế liệu" value={kg(scrapKg)} />
        </KpiRow>
        <Text style={wsStyles.hint}>Cây nguyên khoảng {kg(fullBarKg)}. Đoạn đề-xê dùng lại được khi cắt; phế liệu là đoạn quá ngắn.</Text>

        <View style={styles.gapTop}><SearchBox value={search} onChangeText={setSearch} placeholder="Tìm mã thanh hoặc tên thanh" /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label="Tất cả" count={filtered.length} active={system === 'ALL'} onPress={() => setSystem('ALL')} />
          {systems.map(([code, name]) => <Chip key={code} label={name} active={system === code} onPress={() => setSystem(code)} />)}
        </ScrollView>

        {loading ? <Loading /> : groups.length === 0 ? (
          <EmptyState
            icon="box"
            title={tab === 'FULL_BAR' ? 'Kho cây nguyên đang trống' : 'Chưa có đoạn đề-xê'}
            text="Bấm + để ghi nhận hàng nhận từ NPP hoặc tồn thực tế."
            action={<Button label="Nhận kho" icon="plus" onPress={() => openAdjust()} />}
          />
        ) : groups.map(([code, group]) => (
          <View key={code}>
            <SectionHead title={group.name} sub={`${code} · ${group.items.length} quy cách · ${group.items.reduce((sum, item) => sum + item.quantity, 0)} ${tab === 'FULL_BAR' ? 'cây' : 'đoạn'}`} />
            <Card padded={false}>
              {group.items.map((item, index) => (
                <ListRow key={item.id} first={index === 0} onPress={() => openAdjust(item.materialCode, String(item.lengthMm))} label={`Cập nhật ${item.materialCode}`}>
                  <View style={wsStyles.grow}>
                    <Text style={wsStyles.rowTitle}>{item.materialCode}</Text>
                    <Text style={wsStyles.rowMeta} numberOfLines={1}>
                      {[item.profileName && item.profileName !== item.materialCode ? item.profileName : '', `dài ${(item.lengthMm / 1000).toLocaleString('vi-VN')} m`, item.kgPerMeter ? kg(item.quantity * item.lengthMm / 1000 * item.kgPerMeter, 2) : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.qty}><Text style={styles.qtyText}>{item.quantity}</Text><Text style={styles.qtyUnit}>{tab === 'FULL_BAR' ? 'cây' : 'đoạn'}</Text></View>
                </ListRow>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>

      <Sheet visible={adjustOpen} onClose={() => setAdjustOpen(false)} title={tab === 'FULL_BAR' ? 'Cập nhật cây nguyên' : 'Cập nhật đoạn đề-xê'} sub="Nhận kho để cộng, xuất kho để trừ">
        <Field label="Mã thanh"><Input value={form.materialCode} onChangeText={(v) => setForm((p) => ({ ...p, materialCode: v }))} placeholder="Ví dụ C3304" autoCapitalize="characters" /></Field>
        <View style={wsStyles.row}>
          <Field label="Chiều dài (mm)" style={wsStyles.half}><Input value={form.lengthMm} onChangeText={(v) => setForm((p) => ({ ...p, lengthMm: v }))} keyboardType="numeric" placeholder="6000" /></Field>
          <Field label="Số lượng" style={wsStyles.half}><Input value={form.quantity} onChangeText={(v) => setForm((p) => ({ ...p, quantity: v }))} keyboardType="numeric" placeholder="1" /></Field>
        </View>
        <View style={[wsStyles.row, styles.gapTop]}>
          <Button label="Xuất kho" icon="arrow-up-circle" variant="danger" disabled={saving} onPress={() => void adjust(-1)} style={wsStyles.half} />
          <Button label="Nhận kho" icon="arrow-down-circle" loading={saving} disabled={saving} onPress={() => void adjust(1)} style={wsStyles.half} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  filters: { gap: 6, paddingVertical: 10 },
  qty: { minWidth: 52, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: ws.orangeSoft },
  qtyText: { color: ws.orangeText, fontSize: 16, fontWeight: '900' },
  qtyUnit: { color: ws.orangeText, fontSize: 10, fontWeight: '700' },
});
