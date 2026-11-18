import { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CashMethod, DebtItem, DebtPaymentRequestItem } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { Banner, Button, Card, EmptyState, Kpi, KpiRow, ListRow, SectionHead, Sheet, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api } from '../src/lib/api';
import { compactMoney, money } from '../src/lib/invoiceState';

const methodText: Record<CashMethod, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
};

export default function DebtsScreen() {
  const router = useRouter();
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

  const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
  const openCount = debts.filter((debt) => debt.amount - debt.paidAmount > 0).length;

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Công nợ" subtitle="Tự ghi nhận từ đơn NPP" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
        <KpiRow>
          <Kpi label="Còn phải trả" value={compactMoney(totalOwed)} tone={totalOwed > 0 ? 'danger' : undefined} />
          <Kpi label="Đã phát sinh" value={compactMoney(totalAmount)} />
          <Kpi label="Khoản còn nợ" value={String(openCount)} />
        </KpiRow>

        {message ? <View style={styles.gapTop}><Banner tone="success" text={message} /></View> : null}

        {debts.length === 0 ? (
          <View style={styles.gapTop}><EmptyState icon="check-circle" title="Không có công nợ cần trả" text="Đơn đặt nhôm qua NPP sẽ tự ghi công nợ ở đây." /></View>
        ) : (
          <>
            <SectionHead title="Khoản phải trả" sub="Bấm một khoản để báo đã thanh toán" />
            <Card padded={false}>
              {debts.map((debt, index) => {
                const remaining = Math.max(0, debt.amount - debt.paidAmount);
                const paidPct = Math.min(100, (debt.paidAmount / Math.max(1, debt.amount)) * 100);
                return (
                  <ListRow key={debt.id} first={index === 0} onPress={remaining > 0 ? () => openPayment(debt) : undefined} label={`Thanh toán ${debt.partnerName}`}>
                    <View style={wsStyles.avatar}><Icon name="package" size={17} color={ws.orangeText} /></View>
                    <View style={wsStyles.grow}>
                      <Text style={wsStyles.rowTitle} numberOfLines={1}>{debt.partnerName}{debt.orderCode ? ` · ${debt.orderCode}` : ''}</Text>
                      <Text style={wsStyles.rowMeta} numberOfLines={1}>{remaining > 0 ? `Đã trả ${compactMoney(debt.paidAmount)} / ${compactMoney(debt.amount)}` : 'Đã trả đủ'}</Text>
                      <View style={styles.bar}><View style={[styles.barFill, { width: `${paidPct}%` }]} /></View>
                    </View>
                    <Text style={[styles.amount, remaining === 0 && { color: ws.success }]}>{remaining > 0 ? compactMoney(remaining) : 'Xong'}</Text>
                  </ListRow>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title="Thanh toán công nợ" sub={selected ? `${selected.partnerName}${selected.orderCode ? ` · ${selected.orderCode}` : ''}` : undefined}>
        {selected ? (
          <>
            <Text style={styles.sheetAmount}>{money(selectedRemaining)}</Text>
            {!bankMode ? (
              <View style={styles.options}>
                <Button label="Đã trả tiền mặt" icon="dollar-sign" variant="secondary" loading={sending} disabled={sending} onPress={() => void submitPayment('CASH')} />
                <Button label="Chuyển khoản" icon="credit-card" onPress={() => setBankMode(true)} disabled={sending} />
              </View>
            ) : (
              <View style={styles.qrBox}>
                <Image source={{ uri: qrUrl }} style={styles.qr} />
                <Text style={styles.bankInfo}>{selected.bankName || 'Tài khoản NPP'} · {selected.bankAccount || 'Liên hệ NPP để lấy số tài khoản'}</Text>
                <Button label="Đã chuyển khoản, gửi xác nhận" icon="check-circle" loading={sending} disabled={sending} onPress={() => void submitPayment('BANK_TRANSFER')} />
              </View>
            )}
            <Text style={wsStyles.hint}>NPP xác nhận xong thì công nợ mới được trừ.</Text>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  bar: { height: 4, borderRadius: 2, backgroundColor: '#F2F4F7', marginTop: 6, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: ws.success },
  amount: { color: ws.dangerText, fontSize: 13.5, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sheetAmount: { color: ws.ink, fontSize: 26, fontWeight: '900', marginBottom: 12, fontVariant: ['tabular-nums'] },
  options: { gap: 8 },
  qrBox: { alignItems: 'center', gap: 10 },
  qr: { width: 200, height: 200, borderRadius: 12, backgroundColor: '#F2F4F7' },
  bankInfo: { color: ws.body, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
