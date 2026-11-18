import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RecordExternalInvoiceInput, SaveWorkshopSalesInvoiceInput, WorkshopSalesInvoice, WorkshopTaxProfile } from '@eurohouse/types';
import { Icon } from '../../src/components/Icon';
import { Banner, Button, Card, Chip, Field, IconButton, Input, Loading, SectionHead, Sheet, SubHeader, ws, wsStyles } from '../../src/components/ws';
import { api } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/alert';
import { dmy, draftTotal, money, parseDmy, todayKey } from '../../src/lib/invoiceState';
import { formatVndInput, parseVndInput } from '../../src/lib/vndCurrency';

type LineForm = { name: string; unit: string; quantity: string; unitPrice: string };
type Form = {
  buyerName: string; buyerTaxCode: string; buyerAddress: string; buyerPhone: string; buyerEmail: string;
  issueDate: string; note: string; vatRatePct: number; lines: LineForm[];
};

const EMPTY_LINE: LineForm = { name: '', unit: '', quantity: '1', unitPrice: '' };

function qtyText(value: number): string {
  return String(value).replace('.', ',');
}

function parseQty(text: string): number {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function formFrom(inv: WorkshopSalesInvoice | null): Form {
  return {
    buyerName: inv?.buyerName ?? '',
    buyerTaxCode: inv?.buyerTaxCode ?? '',
    buyerAddress: inv?.buyerAddress ?? '',
    buyerPhone: inv?.buyerPhone ?? '',
    buyerEmail: inv?.buyerEmail ?? '',
    issueDate: dmy(inv?.issueDate ?? todayKey()),
    note: inv?.note ?? '',
    vatRatePct: inv?.vatRatePct ?? 0,
    lines: inv?.lines.length
      ? inv.lines.map((l) => ({ name: l.name, unit: l.unit, quantity: qtyText(l.quantity), unitPrice: formatVndInput(l.unitPrice) }))
      : [{ ...EMPTY_LINE }],
  };
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function InvoiceEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [id, setId] = useState<string | undefined>(params.id ? String(params.id) : undefined);
  const [invoice, setInvoice] = useState<WorkshopSalesInvoice | null>(null);
  const [profile, setProfile] = useState<WorkshopTaxProfile | null>(null);
  const [form, setForm] = useState<Form>(() => formFrom(null));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'issue' | 'external' | null>(null);
  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [lineDraft, setLineDraft] = useState<LineForm>(EMPTY_LINE);
  const [externalOpen, setExternalOpen] = useState(false);
  const [external, setExternal] = useState({ series: '', number: '', date: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRow, invoiceRow] = await Promise.all([
        api.get<WorkshopTaxProfile>('/workshop/tax/profile'),
        params.id ? api.get<WorkshopSalesInvoice>(`/workshop/tax/invoices/${params.id}`) : Promise.resolve(null),
      ]);
      if (invoiceRow && invoiceRow.status !== 'DRAFT') {
        router.replace({ pathname: '/invoice/[id]', params: { id: invoiceRow.id } });
        return;
      }
      setProfile(profileRow);
      setInvoice(invoiceRow);
      setForm(formFrom(invoiceRow));
    } catch (loadError) {
      Alert.alert('Chưa tải được hoá đơn', errorText(loadError, 'Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const lines = form.lines.map((l) => ({ name: l.name, unit: l.unit, quantity: parseQty(l.quantity), unitPrice: parseVndInput(l.unitPrice) }));
  const subtotal = draftTotal(lines);
  const vatAmount = Math.round((subtotal * form.vatRatePct) / 100);
  const total = subtotal + vatAmount;
  const isDn = profile?.entityType === 'DN';

  function payload(): SaveWorkshopSalesInvoiceInput | null {
    const issueDate = parseDmy(form.issueDate);
    if (!issueDate) { Alert.alert('Ngày hoá đơn chưa đúng', 'Nhập theo dạng ngày/tháng/năm, ví dụ 18/11/2026.'); return null; }
    return {
      projectId: invoice?.projectId ?? null,
      customerId: invoice?.customerId ?? null,
      buyerName: form.buyerName,
      buyerTaxCode: form.buyerTaxCode,
      buyerAddress: form.buyerAddress,
      buyerPhone: form.buyerPhone,
      buyerEmail: form.buyerEmail,
      issueDate,
      note: form.note,
      vatRatePct: form.vatRatePct,
      lines: lines.filter((l) => l.name.trim() || l.unitPrice),
    };
  }

  async function save(): Promise<WorkshopSalesInvoice | null> {
    const body = payload();
    if (!body) return null;
    const saved = id
      ? await api.patch<WorkshopSalesInvoice>(`/workshop/tax/invoices/${id}`, body)
      : await api.post<WorkshopSalesInvoice>('/workshop/tax/invoices', body);
    setId(saved.id);
    setInvoice(saved);
    return saved;
  }

  async function onSave() {
    setBusy('save');
    try {
      if (await save()) Alert.alert('Đã lưu nháp', 'Hoá đơn nháp chưa tính vào doanh thu cho tới khi phát hành.');
    } catch (saveError) {
      Alert.alert('Chưa lưu được', errorText(saveError, 'Vui lòng thử lại.'));
    } finally {
      setBusy(null);
    }
  }

  function onIssue() {
    if (profile?.provider !== 'SANDBOX') {
      Alert.alert('Chưa chọn nhà cung cấp', 'Chọn Bản thử trong hồ sơ thuế để chạy thử, hoặc bấm "Ghi số đã xuất" nếu đã xuất hoá đơn ở MISA, Viettel...');
      return;
    }
    confirmAction('Phát hành hoá đơn (Bản thử)', `Tổng ${money(total)} cho ${form.buyerName || 'người mua'}. Hoá đơn Bản thử không có giá trị pháp lý. Đã phát hành thì không sửa được, chỉ huỷ hoặc thay thế.`, async () => {
      setBusy('issue');
      try {
        const saved = await save();
        if (!saved) return;
        const issued = await api.post<WorkshopSalesInvoice>(`/workshop/tax/invoices/${saved.id}/issue`);
        router.replace({ pathname: '/invoice/[id]', params: { id: issued.id } });
      } catch (issueError) {
        Alert.alert('Chưa phát hành được', errorText(issueError, 'Vui lòng thử lại.'));
      } finally {
        setBusy(null);
      }
    });
  }

  function openExternal() {
    setExternal({ series: profile?.invoiceSeries ?? '', number: '', date: form.issueDate });
    setExternalOpen(true);
  }

  async function onRecordExternal() {
    const date = parseDmy(external.date);
    if (!date) { Alert.alert('Ngày hoá đơn chưa đúng', 'Nhập theo dạng ngày/tháng/năm.'); return; }
    setBusy('external');
    try {
      const saved = await save();
      if (!saved) return;
      const body: RecordExternalInvoiceInput = { series: external.series, number: external.number, issueDate: date };
      const recorded = await api.post<WorkshopSalesInvoice>(`/workshop/tax/invoices/${saved.id}/record-external`, body);
      setExternalOpen(false);
      router.replace({ pathname: '/invoice/[id]', params: { id: recorded.id } });
    } catch (recordError) {
      Alert.alert('Chưa ghi được', errorText(recordError, 'Vui lòng thử lại.'));
    } finally {
      setBusy(null);
    }
  }

  function onDelete() {
    if (!id) { router.back(); return; }
    confirmAction('Xoá hoá đơn nháp', 'Hoá đơn nháp này sẽ bị xoá hẳn.', async () => {
      try {
        await api.delete(`/workshop/tax/invoices/${id}`);
        router.back();
      } catch (deleteError) {
        Alert.alert('Chưa xoá được', errorText(deleteError, 'Vui lòng thử lại.'));
      }
    });
  }

  function editLine(index: number | null) {
    setLineIndex(index === null ? form.lines.length : index);
    setLineDraft(index === null ? { ...EMPTY_LINE } : form.lines[index]);
  }

  function commitLine() {
    if (lineIndex === null) return;
    const next = [...form.lines];
    next[lineIndex] = lineDraft;
    set('lines', next.filter((l) => l.name.trim() || l.unitPrice));
    setLineIndex(null);
  }

  function removeLine() {
    if (lineIndex === null) return;
    set('lines', form.lines.filter((_, i) => i !== lineIndex));
    setLineIndex(null);
  }

  const header = (
    <SubHeader
      title={id ? 'Sửa hoá đơn nháp' : 'Lập hoá đơn'}
      subtitle={isDn ? 'Hoá đơn GTGT' : 'Hoá đơn bán hàng · không tách GTGT'}
      onBack={() => router.back()}
      right={<>
        <IconButton icon="save" label="Lưu nháp" onPress={() => void onSave()} disabled={Boolean(busy)} />
        <IconButton icon="trash-2" tone="danger" label="Xoá nháp" onPress={onDelete} />
      </>}
    />
  );

  if (loading) return <View style={wsStyles.screen}><Stack.Screen options={{ headerShown: false }} />{header}<Loading /></View>;

  const visibleLines = form.lines.filter((l) => l.name.trim() || l.unitPrice);

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={[wsStyles.content, { paddingBottom: 180 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {profile?.provider === 'SANDBOX' ? (
          <Banner tone="info" icon="info" title="Đang dùng Bản thử" text="Số hoá đơn chỉ để chạy thử, không có giá trị pháp lý. Đổi nhà cung cấp trong hồ sơ thuế." />
        ) : (
          <Banner tone="warning" title="Chưa nối nhà cung cấp hoá đơn" text='Xuất hoá đơn ở hệ thống của anh chị (MISA, Viettel...), rồi bấm "Ghi số đã xuất" để vào sổ doanh thu.' />
        )}
        {invoice?.replacesNumber ? <View style={styles.gapTop}><Banner tone="orange" icon="repeat" title={`Thay thế hoá đơn số ${invoice.replacesNumber}`} text="Khi phát hành, hoá đơn cũ chuyển sang Đã bị thay thế và không tính doanh thu." /></View> : null}

        <SectionHead title="Người mua" sub={invoice?.projectCode ? `Lấy từ công trình ${invoice.projectCode}` : undefined} />
        <Card>
          <Field label="Tên người mua"><Input value={form.buyerName} onChangeText={(v) => set('buyerName', v)} placeholder="Họ tên hoặc tên công ty" /></Field>
          <Field label="Mã số thuế (nếu có)"><Input value={form.buyerTaxCode} onChangeText={(v) => set('buyerTaxCode', v)} placeholder="Để trống với khách cá nhân" keyboardType="number-pad" /></Field>
          <Field label="Địa chỉ"><Input value={form.buyerAddress} onChangeText={(v) => set('buyerAddress', v)} placeholder="Địa chỉ người mua" /></Field>
          <View style={wsStyles.row}>
            <Field label="Điện thoại" style={wsStyles.half}><Input value={form.buyerPhone} onChangeText={(v) => set('buyerPhone', v)} keyboardType="phone-pad" /></Field>
            <Field label="Email" style={wsStyles.half}><Input value={form.buyerEmail} onChangeText={(v) => set('buyerEmail', v)} keyboardType="email-address" autoCapitalize="none" /></Field>
          </View>
        </Card>

        <SectionHead title="Hàng hoá, dịch vụ" sub={`${visibleLines.length} dòng · bấm dòng để sửa`} />
        <Card padded={false}>
          {visibleLines.map((line, index) => {
            const amount = Math.round(parseQty(line.quantity) * parseVndInput(line.unitPrice));
            return (
              <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Sửa dòng ${index + 1}`} onPress={() => editLine(form.lines.indexOf(line))} style={({ pressed }) => [styles.line, index > 0 && styles.divider, pressed && { backgroundColor: '#F9FAFB' }]}>
                <View style={wsStyles.grow}>
                  <Text style={styles.lineName} numberOfLines={2}>{line.name || 'Chưa đặt tên'}</Text>
                  <Text style={wsStyles.rowMeta}>{line.quantity} {line.unit || ''} × {line.unitPrice || '0'}</Text>
                </View>
                <Text style={styles.lineAmount}>{amount.toLocaleString('vi-VN')}</Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={() => editLine(null)} style={({ pressed }) => [styles.addLine, visibleLines.length > 0 && styles.dividerDashed, pressed && { opacity: 0.8 }]}>
            <Icon name="plus" size={15} color={ws.orangeText} />
            <Text style={styles.addLineText}>Thêm dòng</Text>
          </Pressable>
        </Card>

        <SectionHead title="Thông tin hoá đơn" />
        <Card>
          <View style={wsStyles.row}>
            <Field label="Ngày hoá đơn" style={wsStyles.half}><Input value={form.issueDate} onChangeText={(v) => set('issueDate', v)} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" /></Field>
            <Field label="Ký hiệu" style={wsStyles.half}><Input value={profile?.invoiceSeries || 'Chưa khai'} editable={false} /></Field>
          </View>
          {isDn ? (
            <Field label="Thuế suất GTGT">
              <View style={styles.vatRow}>{[0, 5, 8, 10].map((rate) => <Chip key={rate} label={`${rate}%`} active={form.vatRatePct === rate} onPress={() => set('vatRatePct', rate)} />)}</View>
            </Field>
          ) : null}
          <Field label="Ghi chú (không bắt buộc)"><Input value={form.note} onChangeText={(v) => set('note', v)} placeholder="Ví dụ: thanh toán đợt 2" /></Field>
          <Text style={wsStyles.hint}>Số hoá đơn được cấp khi phát hành. Hoá đơn nháp chưa tính vào doanh thu.</Text>
        </Card>
      </ScrollView>

      <View style={styles.sticky}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng thanh toán · {visibleLines.length} dòng{isDn && vatAmount ? ` · GTGT ${vatAmount.toLocaleString('vi-VN')}` : ''}</Text>
          <Text style={styles.totalValue}>{money(total)}</Text>
        </View>
        <View style={wsStyles.row}>
          <Button label="Ghi số đã xuất" variant="secondary" onPress={openExternal} disabled={Boolean(busy)} loading={busy === 'external'} style={wsStyles.half} />
          <Button label="Phát hành" icon="send" onPress={onIssue} disabled={Boolean(busy)} loading={busy === 'issue'} style={wsStyles.half} />
        </View>
      </View>

      <Sheet visible={lineIndex !== null} onClose={() => setLineIndex(null)} title={lineIndex !== null && lineIndex < form.lines.length ? `Sửa dòng ${lineIndex + 1}` : 'Thêm dòng'}>
        <Field label="Tên hàng hoá, dịch vụ"><Input value={lineDraft.name} onChangeText={(v) => setLineDraft((d) => ({ ...d, name: v }))} placeholder="Ví dụ: Cửa đi mở quay hệ 55" multiline /></Field>
        <View style={wsStyles.row}>
          <Field label="Đơn vị" style={wsStyles.half}><Input value={lineDraft.unit} onChangeText={(v) => setLineDraft((d) => ({ ...d, unit: v }))} placeholder="bộ, m², gói" /></Field>
          <Field label="Số lượng" style={wsStyles.half}><Input value={lineDraft.quantity} onChangeText={(v) => setLineDraft((d) => ({ ...d, quantity: v }))} keyboardType="decimal-pad" /></Field>
        </View>
        <Field label="Đơn giá (đồng)"><Input value={lineDraft.unitPrice} onChangeText={(v) => setLineDraft((d) => ({ ...d, unitPrice: formatVndInput(v) }))} keyboardType="number-pad" placeholder="0" /></Field>
        <Text style={styles.sheetTotal}>Thành tiền: {money(Math.round(parseQty(lineDraft.quantity) * parseVndInput(lineDraft.unitPrice)))}</Text>
        <View style={[wsStyles.row, styles.gapTop]}>
          {lineIndex !== null && lineIndex < form.lines.length ? <Button label="Xoá dòng" variant="danger" onPress={removeLine} style={wsStyles.half} /> : null}
          <Button label="Xong" onPress={commitLine} style={wsStyles.half} />
        </View>
      </Sheet>

      <Sheet visible={externalOpen} onClose={() => setExternalOpen(false)} title="Ghi số đã xuất ngoài" sub="Hoá đơn đã xuất ở MISA, Viettel, VNPT... hoặc eTax">
        <View style={wsStyles.row}>
          <Field label="Ký hiệu" style={wsStyles.half}><Input value={external.series} onChangeText={(v) => setExternal((e) => ({ ...e, series: v.toUpperCase() }))} autoCapitalize="characters" placeholder="1C26TAP" /></Field>
          <Field label="Số hoá đơn" style={wsStyles.half}><Input value={external.number} onChangeText={(v) => setExternal((e) => ({ ...e, number: v }))} keyboardType="number-pad" placeholder="148" /></Field>
        </View>
        <Field label="Ngày trên hoá đơn"><Input value={external.date} onChangeText={(v) => setExternal((e) => ({ ...e, date: v }))} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" /></Field>
        <Text style={wsStyles.hint}>App chỉ ghi lại số để vào sổ doanh thu. Hoá đơn gốc có chữ ký số vẫn nằm ở hệ thống đã xuất.</Text>
        <View style={styles.gapTop}><Button label="Ghi vào sổ" icon="check" onPress={() => void onRecordExternal()} loading={busy === 'external'} /></View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  dividerDashed: { borderTopWidth: 1, borderTopColor: ws.line, borderStyle: 'dashed' },
  lineName: { color: ws.ink, fontSize: 13.5, fontWeight: '800' },
  lineAmount: { color: ws.ink, fontSize: 13.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  addLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  addLineText: { color: ws.orangeText, fontSize: 13, fontWeight: '800' },
  vatRow: { flexDirection: 'row', gap: 6 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: ws.surface, borderTopWidth: 1, borderTopColor: ws.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 22 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  totalLabel: { flex: 1, color: ws.muted, fontSize: 12, fontWeight: '700' },
  totalValue: { color: ws.ink, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sheetTotal: { color: ws.ink, fontSize: 14, fontWeight: '800', marginTop: 4 },
});
