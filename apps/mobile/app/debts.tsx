import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { CashMethod, DebtItem, DebtPaymentRequestItem } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

const methodText: Record<CashMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
};

export default function DebtsScreen() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [bankMode, setBankMode] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api.get<DebtItem[]>('/debts').then(setDebts).catch(() => setDebts([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalOwed = debts.reduce((sum, debt) => sum + Math.max(0, debt.amount - debt.paidAmount), 0);
  const selectedRemaining = selected ? Math.max(0, selected.amount - selected.paidAmount) : 0;
  const qrUrl = useMemo(() => {
    if (!selected) return '';
    const content = `Thanh toan cong no ${selected.orderCode ?? selected.partnerName}`;
    const payload = `NPP=${selected.partnerName};BANK=${selected.bankName || 'NPP'};ACCOUNT=${selected.bankAccount || 'LIEN_HE_NPP'};AMOUNT=${selectedRemaining};CONTENT=${content}`;
    return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(payload)}`;
  }, [selected, selectedRemaining]);

  function openPayment(debt: DebtItem) {
    setSelected(debt);
    setBankMode(false);
    setMessage('');
  }

  async function submitPayment(method: CashMethod) {
    if (!selected) return;
    setSending(true);
    setMessage('');
    try {
      const request = await api.post<DebtPaymentRequestItem>(`/debts/${selected.id}/payment-requests`, {
        amount: selectedRemaining,
        method,
        note: method === 'BANK_TRANSFER' ? 'CSSX đã gửi yêu cầu xác nhận chuyển khoản.' : 'CSSX báo thanh toán tiền mặt cho NPP.',
      });
      setMessage(`Đã gửi yêu cầu ${methodText[request.method].toLowerCase()} ${request.amount.toLocaleString('vi-VN')}đ. Chờ NPP xác nhận để trừ công nợ.`);
      setSelected(null);
      setBankMode(false);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không gửi được yêu cầu thanh toán.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công nợ NPP" subtitle="Tự động ghi nhận từ NPP" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiCard}>
          <Icon name="credit-card" size={20} color={colors.danger} />
          <Text style={styles.kpiLabel}>Còn phải thanh toán</Text>
          <Text style={styles.kpiValue}>{(totalOwed / 1000000).toFixed(1)}tr</Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {debts.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="check-circle" size={26} color={colors.success} /></View>
            <Text style={styles.emptyText}>Chưa có công nợ NPP cần thanh toán.</Text>
          </View>
        ) : (
          debts.map((debt) => {
            const remaining = Math.max(0, debt.amount - debt.paidAmount);
            return (
              <View key={debt.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.debtIconWrap}><Icon name="briefcase" size={18} color={colors.brandOrange} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.partner}>{debt.partnerName}</Text>
                    <Text style={styles.type}>{debt.orderCode ? `Đơn ${debt.orderCode}` : 'Công nợ NPP'} {debt.bankName ? `· ${debt.bankName}` : ''}</Text>
                  </View>
                  <Text style={styles.amount}>{remaining.toLocaleString('vi-VN')}đ</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (debt.paidAmount / Math.max(1, debt.amount)) * 100)}%` }]} />
                </View>
                <Pressable style={styles.payBtn} onPress={() => openPayment(debt)} disabled={remaining <= 0}>
                  <Icon name="credit-card" size={16} color={colors.brandBlack.main} />
                  <Text style={styles.payText}>Thanh toán công nợ</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Thanh toán công nợ</Text>
              <Pressable onPress={() => setSelected(null)} style={styles.closeBtn}><Icon name="x" size={18} color={colors.brandGrey[600]} /></Pressable>
            </View>
            {selected ? (
              <>
                <Text style={styles.modalDesc}>{selected.partnerName}</Text>
                <Text style={styles.modalAmount}>{selectedRemaining.toLocaleString('vi-VN')}đ</Text>
                {!bankMode ? (
                  <View style={{ gap: 10 }}>
                    <Pressable disabled={sending} style={styles.optionBtn} onPress={() => submitPayment('CASH')}>
                      <Icon name="briefcase" size={17} color={colors.brandBlack.main} />
                      <Text style={styles.optionText}>Thanh toán tiền mặt</Text>
                    </Pressable>
                    <Pressable disabled={sending} style={styles.optionBtn} onPress={() => setBankMode(true)}>
                      <Icon name="credit-card" size={17} color={colors.brandBlack.main} />
                      <Text style={styles.optionText}>Thanh toán chuyển khoản</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.qrBox}>
                    <Image source={{ uri: qrUrl }} style={styles.qr} />
                    <Text style={styles.bankInfo}>{selected.bankName || 'Tài khoản NPP'} · {selected.bankAccount || 'Liên hệ NPP để lấy STK'}</Text>
                    <Pressable disabled={sending} style={styles.confirmBtn} onPress={() => submitPayment('BANK_TRANSFER')}>
                      <Icon name="check-circle" size={16} color={colors.brandBlack.main} />
                      <Text style={styles.payText}>Đã chuyển khoản, gửi xác nhận</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  kpiCard: { backgroundColor: colors.white, borderRadius: 18, padding: 18, gap: 7, marginBottom: 16, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  kpiLabel: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 12 },
  kpiValue: { color: colors.danger, fontWeight: '900', fontSize: 28 },
  message: { color: colors.brandOrangeText, fontWeight: '700', marginBottom: 12, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 44, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500], fontWeight: '700' },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  debtIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  partner: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  type: { color: colors.brandGrey[500], marginTop: 2, fontSize: 12 },
  amount: { color: colors.danger, fontWeight: '900', fontSize: 16 },
  progressBar: { height: 6, borderRadius: 999, backgroundColor: colors.brandGrey[100], marginTop: 14, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 12, marginTop: 12 },
  payText: { color: colors.brandBlack.main, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,10,10,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandGrey[100], alignItems: 'center', justifyContent: 'center' },
  modalDesc: { color: colors.brandGrey[500], fontWeight: '700' },
  modalAmount: { color: colors.danger, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  optionBtn: { minHeight: 52, borderRadius: 16, backgroundColor: colors.orangeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  optionText: { color: colors.brandBlack.main, fontWeight: '900' },
  qrBox: { alignItems: 'center', gap: 10 },
  qr: { width: 220, height: 220, backgroundColor: colors.brandGrey[100], borderRadius: 14 },
  bankInfo: { color: colors.brandGrey[600], textAlign: 'center', fontWeight: '700', lineHeight: 20 },
  confirmBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 13 },
});
