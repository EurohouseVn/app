import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

type InventoryItem = {
  id: string;
  materialCode: string;
  lengthMm: number;
  quantity: number;
  type: 'FULL_BAR' | 'DE_XE';
};

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [scrapKg, setScrapKg] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // For this mockup, we'll fetch from a generic endpoint or mock data if it doesn't exist yet
      // The API side for this needs `GET /inventory`
      const res = await api.get<{ items: InventoryItem[], scrapKg: number }>('/inventory');
      setItems(res.items || []);
      setScrapKg(res.scrapKg || 0);
    } catch (e) {
      console.log('Error fetching inventory', e);
      // Fallback mockup
      setItems([
        { id: '1', materialCode: 'C3304', lengthMm: 2150, quantity: 2, type: 'DE_XE' },
        { id: '2', materialCode: 'C3304', lengthMm: 1200, quantity: 1, type: 'DE_XE' },
        { id: '3', materialCode: 'C3328', lengthMm: 1850, quantity: 3, type: 'DE_XE' },
      ]);
      setScrapKg(12.5);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const deXeItems = items.filter(i => i.type === 'DE_XE');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Kho của tôi', headerShadowVisible: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.scrapCard}>
          <View style={styles.scrapIcon}>
            <Icon name="trash-2" size={24} color={colors.brandOrangeText} />
          </View>
          <View style={styles.scrapInfo}>
            <Text style={styles.scrapLabel}>Nhôm phế liệu dự tính</Text>
            <Text style={styles.scrapValue}>{scrapKg.toFixed(1)} kg</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Đoạn Đề Xê (DC) đang lưu kho</Text>
        <Text style={styles.sectionDesc}>Các đoạn nhôm {'>='} 1 mét có thể tận dụng cho công trình sau.</Text>

        {deXeItems.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="box" size={32} color={colors.brandGrey[500]} />
            <Text style={styles.emptyText}>Kho Đề Xê đang trống</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {deXeItems.map(item => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemCode}>{item.materialCode}</Text>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>SL: {item.quantity}</Text>
                  </View>
                </View>
                <Text style={styles.itemLength}>Dài: {item.lengthMm / 1000} m</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scrollContent: { padding: 16 },
  scrapCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: colors.brandBlack.main,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 16
  },
  scrapIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.orangeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrapInfo: { flex: 1 },
  scrapLabel: { color: colors.brandGrey[500], fontSize: 13, fontWeight: '600' },
  scrapValue: { color: colors.brandBlack.main, fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '800' },
  sectionDesc: { color: colors.brandGrey[500], fontSize: 13, marginTop: 4, marginBottom: 16 },
  empty: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { color: colors.brandGrey[500], fontWeight: '600' },
  list: { gap: 12 },
  itemCard: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.brandOrange,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemCode: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 16 },
  qtyBadge: { backgroundColor: colors.orangeSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  qtyText: { color: colors.brandOrangeText, fontWeight: '700', fontSize: 12 },
  itemLength: { color: colors.brandGrey[500], fontSize: 14, marginTop: 8 },
});
