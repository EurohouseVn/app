import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { DebtItem } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

const typeLabel: Record<string, string> = { NPP: 'Nợ NPP', ACCESSORY: 'Nợ phụ kiện', CUSTOMER: 'Khách nợ' };
const filters = ['Tất cả', 'NPP', 'ACCESSORY', 'CUSTOMER'];

export default function DebtsScreen() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [filter, setFilter] = useState('Tất cả');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    api.get<DebtItem[]>('/debts').then(setDebts).catch(() => setDebts([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function addSample() {
    await api.post('/debts', { type: 'NPP', partnerName: 'NPP Miền Nam', amount: 15000000, bankName: 'Vietcombank', bankAccount: '0123456789' });
    load();
  }

  // Bấm trả nợ -> mở app ngân hàng qua deep link / dữ liệu chuyển khoản
  function payDebt(debt: DebtItem) {
    const remaining = debt.amount - debt.paidAmount;
    // Chuẩn VietQR/napas deep link (mở app bank nếu có), fallback hiển thị thông tin
    const bankUrl = `https://dl.vietqr.io/pay?amount=${remaining}&addInfo=${encodeURIComponent('Tra no ' + debt.partnerName)}`;
    Linking.openURL(bankUrl).catch(() => {
      setMessage(`Chuyển ${remaining.toLocaleString('vi-VN')}đ tới ${debt.bankName} ${debt.bankAccount}`);
    });
  }

  const visible = debts.filter((d) => filter === 'Tất cả' || d.type === filter);
  const totalOwed = debts.filter((d) => d.type !== 'CUSTOMER').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
  const totalReceivable = debts.filter((d) => d.type === 'CUSTOMER').reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công nợ" subtitle="NPP · phụ kiện · khách hàng" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: colors.brandBlack }]}>
            <Icon name="arrow-up-circle" size={18} color={colors.danger} />
            <Text style={[styles.kpiLabel, { color: 'rgba(255,255,255,0.8)' }]}>Mình đang nợ</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>{(totalOwed / 1000000).toFixed(1)}tr</Text>
          </View>
          <View style={styles.kpiCard}>
            <Icon name="arrow-down-circle" size={18} color={colors.success} />
            <Text style={styles.kpiLabel}>Khách nợ mình</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>{(totalReceivable / 1000000).toFixed(1)}tr</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {filters.map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f === 'Tất cả' ? f : typeLabel[f]}</Text>
            </Pressable>
          ))}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="credit-card" size={26} color={colors.brandGrey} /></View>
            <Text style={styles.emptyText}>Chưa có công nợ.</Text>
            <Pressable style={styles.addBtn} onPress={addSample}><Text style={styles.addText}>+ Thêm khoản nợ mẫu</Text></Pressable>
          </View>
        ) : (
          visible.map((debt) => {
            const remaining = debt.amount - debt.paidAmount;
            return (
              <View key={debt.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.debtIconWrap}>
                    <Icon name={debt.type === 'CUSTOMER' ? 'user' : 'briefcase'} size={18} color={colors.brandOrange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partner}>{debt.partnerName}</Text>
                    <Text style={styles.type}>{typeLabel[debt.type]} {debt.bankName ? `· ${debt.bankName}` : ''}</Text>
                  </View>
                  <Text style={styles.amount}>{remaining.toLocaleString('vi-VN')}đ</Text>
                </View>
                {debt.type !== 'CUSTOMER' ? (
                  <Pressable style={styles.payBtn} onPress={() => payDebt(debt)}>
                    <Icon name="credit-card" size={16} color={colors.brandBlack} />
                    <Text style={styles.payText}>Trả nợ qua ngân hàng</Text>
                  </Pressable>
                ) : null}
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
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 6, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  kpiLabel: { color: colors.brandGrey, fontWeight: '700', fontSize: 12 },
  kpiValue: { fontWeight: '900', fontSize: 22 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  chipActive: { backgroundColor: colors.brandBlack },
  chipText: { color: colors.brandBlack, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.white },
  message: { color: colors.brandOrange, fontWeight: '700', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey },
  addBtn: { backgroundColor: colors.brandBlack, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  addText: { color: colors.white, fontWeight: '800' },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  debtIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  partner: { color: colors.brandBlack, fontWeight: '900', fontSize: 15 },
  type: { color: colors.brandGrey, marginTop: 2, fontSize: 12 },
  amount: { color: colors.danger, fontWeight: '900', fontSize: 16 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 12, marginTop: 12 },
  payText: { color: colors.brandBlack, fontWeight: '800' },
});
