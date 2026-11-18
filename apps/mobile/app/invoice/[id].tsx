import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkshopSalesInvoice } from '@eurohouse/types';
import { Icon, type IconName } from '../../src/components/Icon';
import { InvoiceStatusPill } from '../../src/components/InvoiceStatusPill';
import { Banner, Button, Card, EmptyState, Field, IconButton, Input, Loading, SectionHead, Sheet, SubHeader, ValueLine, ws, wsStyles } from '../../src/components/ws';
import { api } from '../../src/lib/api';
import { downloadAndShare, PDF_MIME } from '../../src/lib/fileDownload';
import { dmy, money, statusMeta } from '../../src/lib/invoiceState';

const EVENT_ICON: Record<string, IconName> = {
  CREATED: 'file', UPDATED: 'edit-2', ISSUED: 'send', RECORDED_EXTERNAL: 'check', CANCELLED: 'x', REPLACED: 'repeat',
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function timeText(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inv, setInv] = useState<WorkshopSalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'cancel' | 'replace' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = await api.get<WorkshopSalesInvoice>(`/workshop/tax/invoices/${id}`);
      if (row.status === 'DRAFT') { router.replace({ pathname: '/invoice/edit', params: { id: row.id } }); return; }
      setInv(row);
    } catch (loadError) {
      setError(errorText(loadError, 'Không tải được hoá đơn.'));
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function exportPdf() {
    if (!inv) return;
    setExporting(true);
    try {
      await downloadAndShare(`/workshop/tax/invoices/${inv.id}/pdf`, `hoa-don-${inv.series}-${inv.number}.pdf`, PDF_MIME, `Hoá đơn ${inv.number}`);
    } catch (exportError) {
      Alert.alert('Chưa xuất được PDF', errorText(exportError, 'Vui lòng thử lại.'));
    } finally {
      setExporting(false);
    }
  }

  async function cancel() {
    if (!inv) return;
    setBusy('cancel');
    try {
      setInv(await api.post<WorkshopSalesInvoice>(`/workshop/tax/invoices/${inv.id}/cancel`, { reason }));
      setCancelOpen(false);
      setReason('');
    } catch (cancelError) {
      Alert.alert('Chưa huỷ được', errorText(cancelError, 'Vui lòng thử lại.'));
    } finally {
      setBusy(null);
    }
  }

  async function replace() {
    if (!inv) return;
    setBusy('replace');
    try {
      const draft = await api.post<WorkshopSalesInvoice>(`/workshop/tax/invoices/${inv.id}/replace`);
      setCancelOpen(false);
      router.push({ pathname: '/invoice/edit', params: { id: draft.id } });
    } catch (replaceError) {
      Alert.alert('Chưa lập được hoá đơn thay thế', errorText(replaceError, 'Vui lòng thử lại.'));
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <SubHeader
      title={inv?.number ? `Hoá đơn ${inv.number}` : 'Hoá đơn'}
      subtitle={inv ? `${inv.buyerName} · ${dmy(inv.issueDate)}` : undefined}
      onBack={() => router.back()}
      right={inv ? <IconButton icon="share-2" label="Chia sẻ PDF" onPress={() => void exportPdf()} disabled={exporting} /> : undefined}
    />
  );

  if (loading && !inv) return <View style={wsStyles.screen}><Stack.Screen options={{ headerShown: false }} />{header}<Loading /></View>;
  if (!inv) {
    return (
      <View style={wsStyles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={wsStyles.content}>
          {error ? <Banner tone="error" title="Chưa tải được" text={error} onPress={() => void load()} /> : <EmptyState icon="file-text" title="Không tìm thấy hoá đơn" />}
        </View>
      </View>
    );
  }

  const meta = statusMeta(inv);
  const sandbox = inv.provider === 'SANDBOX';
  const replacementDraft = inv.status === 'ISSUED' && inv.replacedById && !inv.replacedByNumber;

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.topRow}>
            <InvoiceStatusPill label={meta.label} tone={meta.tone} />
            <Text style={styles.kind}>{inv.vatRatePct ? 'Hoá đơn GTGT' : 'Hoá đơn bán hàng'}</Text>
          </View>
          <Text style={styles.totalLabel}>Tổng thanh toán</Text>
          <Text style={[styles.total, meta.tone === 'cancel' && styles.totalCrossed]}>{money(inv.total)}</Text>
          <Text style={wsStyles.rowMeta}>{inv.buyerName}{inv.buyerTaxCode ? ` · MST ${inv.buyerTaxCode}` : ''} · {inv.lineCount || inv.lines.length} dòng</Text>
        </Card>

        {sandbox ? <View style={styles.gapTop}><Banner tone="info" title="Bản thử" text="Hoá đơn tạo bằng nhà cung cấp giả lập, không có giá trị pháp lý. Vẫn tính vào sổ doanh thu để anh chị xem thử." /></View> : null}
        {inv.source === 'EXTERNAL' ? <View style={styles.gapTop}><Banner tone="info" title="Hoá đơn xuất ở hệ thống khác" text="App chỉ ghi số để vào sổ doanh thu. Hoá đơn gốc có chữ ký số nằm ở hệ thống đã xuất." /></View> : null}
        {inv.status === 'CANCELLED' ? <View style={styles.gapTop}><Banner tone="error" title="Đã huỷ" text={inv.cancelReason || 'Không tính vào doanh thu.'} /></View> : null}
        {inv.status === 'REPLACED' ? (
          <View style={styles.gapTop}>
            <Banner tone="error" icon="repeat" title={`Đã bị thay thế bởi hoá đơn số ${inv.replacedByNumber ?? ''}`} text="Bấm để mở hoá đơn thay thế." onPress={inv.replacedById ? () => router.push({ pathname: '/invoice/[id]', params: { id: inv.replacedById! } }) : undefined} />
          </View>
        ) : null}
        {replacementDraft ? (
          <View style={styles.gapTop}>
            <Banner tone="orange" icon="repeat" title="Đang có hoá đơn thay thế (nháp)" text="Bấm để sửa và phát hành hoá đơn thay thế." onPress={() => router.push({ pathname: '/invoice/edit', params: { id: inv.replacedById! } })} />
          </View>
        ) : null}

        <SectionHead title="Thông tin" />
        <Card padded={false}>
          <ValueLine first label="Ký hiệu, số" value={`${inv.series} · ${inv.number}`} />
          <ValueLine label="Ngày hoá đơn" value={dmy(inv.issueDate)} />
          {inv.lookupCode ? <ValueLine label="Mã tra cứu" value={inv.lookupCode} /> : null}
          {inv.replacesNumber ? <ValueLine label="Thay thế hoá đơn" value={`Số ${inv.replacesNumber}`} /> : null}
          {inv.projectCode ? <ValueLine label="Công trình" value={inv.projectCode} /> : null}
          {inv.projectCollected !== null ? <ValueLine label="Đã thu của công trình" value={money(inv.projectCollected)} tone="success" /> : null}
          {inv.buyerAddress ? <ValueLine label="Địa chỉ người mua" value={inv.buyerAddress} /> : null}
        </Card>

        <SectionHead title="Hàng hoá, dịch vụ" />
        <Card padded={false}>
          {inv.lines.map((line, index) => (
            <View key={line.id ?? index} style={[styles.line, index > 0 && styles.divider]}>
              <View style={wsStyles.grow}>
                <Text style={styles.lineName}>{line.name}</Text>
                <Text style={wsStyles.rowMeta}>{String(line.quantity).replace('.', ',')} {line.unit} × {line.unitPrice.toLocaleString('vi-VN')}</Text>
              </View>
              <Text style={styles.lineAmount}>{line.amount.toLocaleString('vi-VN')}</Text>
            </View>
          ))}
          {inv.vatRatePct ? <ValueLine label={`Thuế GTGT ${inv.vatRatePct}%`} value={money(inv.vatAmount)} /> : null}
          <ValueLine strong label="Tổng thanh toán" value={money(inv.total)} />
        </Card>

        <SectionHead title="Nhật ký" />
        <Card padded={false}>
          {inv.events.map((event, index) => (
            <View key={`${event.createdAt}-${index}`} style={[styles.event, index > 0 && styles.divider]}>
              <Icon name={EVENT_ICON[event.action] ?? 'circle'} size={14} color={ws.muted} />
              <Text style={styles.eventText}><Text style={styles.eventStrong}>{event.detail}</Text>{event.actorName ? ` · ${event.actorName}` : ''} · {timeText(event.createdAt)}</Text>
            </View>
          ))}
        </Card>

        <View style={[wsStyles.row, styles.actions]}>
          {inv.status === 'ISSUED' && !replacementDraft ? <Button label="Huỷ / thay thế" icon="x" variant="secondary" onPress={() => setCancelOpen(true)} style={wsStyles.half} /> : null}
          <Button label="Tải PDF" icon="download" onPress={() => void exportPdf()} loading={exporting} style={wsStyles.half} />
        </View>
      </ScrollView>

      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title={`Hoá đơn số ${inv.number}`} sub="Hoá đơn đã phát hành không sửa được">
        <Card padded={false}>
          <View style={styles.choice}>
            <Icon name="repeat" size={18} color={ws.orangeText} />
            <View style={wsStyles.grow}>
              <Text style={wsStyles.rowTitle}>Lập hoá đơn thay thế</Text>
              <Text style={wsStyles.rowMeta}>Sai thông tin hoặc giá trị: lập nháp mới, phát hành xong thì hoá đơn này thành Đã bị thay thế.</Text>
            </View>
          </View>
          <View style={styles.choicePad}><Button label="Lập hoá đơn thay thế" variant="soft" onPress={() => void replace()} loading={busy === 'replace'} disabled={Boolean(busy)} /></View>
        </Card>
        <Card style={styles.gapTop}>
          <Text style={wsStyles.rowTitle}>Huỷ hoá đơn</Text>
          <Text style={wsStyles.rowMeta}>Khách huỷ giao dịch. Hoá đơn huỷ không tính doanh thu.</Text>
          <Field label="Lý do huỷ"><Input value={reason} onChangeText={setReason} placeholder="Ví dụ: khách huỷ đơn hàng" /></Field>
          <View style={styles.gapTop} /><Button label="Huỷ hoá đơn" variant="danger" onPress={() => void cancel()} loading={busy === 'cancel'} disabled={Boolean(busy) || !reason.trim()} />
        </Card>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { color: ws.muted, fontSize: 11.5, fontWeight: '700' },
  totalLabel: { color: ws.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  total: { color: ws.ink, fontSize: 26, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  totalCrossed: { color: ws.faint, textDecorationLine: 'line-through' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  lineName: { color: ws.ink, fontSize: 13.5, fontWeight: '800' },
  lineAmount: { color: ws.ink, fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 9 },
  eventText: { flex: 1, color: ws.muted, fontSize: 11.5, lineHeight: 16 },
  eventStrong: { color: ws.text, fontWeight: '700' },
  actions: { marginTop: 14 },
  choice: { flexDirection: 'row', gap: 10, padding: 12 },
  choicePad: { paddingHorizontal: 12, paddingBottom: 12 },
});
