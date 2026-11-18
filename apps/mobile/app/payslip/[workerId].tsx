import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { WorkshopPayAdjustment, WorkshopPayAdjustmentKind, WorkshopPayslipLine, WorkshopPayslipView } from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import { Icon } from '../../src/components/Icon';
import { api, API_URL, authHeaders } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/alert';
import { formatVndInput, parseVndInput } from '../../src/lib/vndCurrency';
import { monthLabel } from '../../src/lib/workforceState';

const KIND_LABEL: Record<WorkshopPayAdjustmentKind, string> = { ADVANCE: 'Tạm ứng', BONUS: 'Thưởng', PENALTY: 'Phạt' };

function money(value: number): string {
  return Math.round(value).toLocaleString('vi-VN');
}

function num(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function shortDate(value?: string): string {
  if (!value) return '';
  const [, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}`;
}

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return dateKey(new Date(year, monthNumber, 0));
}

export default function PayslipScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workerId: string; month?: string }>();
  const workerId = String(params.workerId ?? '');
  const today = dateKey(new Date());
  const month = String(params.month || today.slice(0, 7));
  const [view, setView] = useState<WorkshopPayslipView | null>(null);
  const [items, setItems] = useState<WorkshopPayAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [slip, adjustments] = await Promise.all([
        api.get<WorkshopPayslipView>(`/workforce/payslips/${workerId}?month=${month}`),
        api.get<WorkshopPayAdjustment[]>(`/workforce/adjustments?month=${month}&workerId=${workerId}`),
      ]);
      setView(slip);
      setItems(adjustments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được phiếu lương.');
    } finally {
      setLoading(false);
    }
  }, [workerId, month]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function exportPdf() {
    if (!view) return;
    setExporting(true);
    const fileName = `phieu-luong-${month}-${view.worker.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.pdf`;
    try {
      const url = `${API_URL}/workforce/payslips/${workerId}/pdf?month=${month}`;
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: authHeaders() });
        if (!response.ok) throw new Error('Không tải được PDF phiếu lương.');
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const { uri } = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${fileName}`, { headers: authHeaders() });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Phiếu lương ${view.worker.name}` });
        } else {
          Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
        }
      }
    } catch (exportError) {
      Alert.alert('Lỗi', exportError instanceof Error ? exportError.message : 'Không xuất được PDF.');
    } finally {
      setExporting(false);
    }
  }

  function removeItem(item: WorkshopPayAdjustment) {
    confirmAction(`Xoá khoản ${KIND_LABEL[item.kind].toLowerCase()}`, `${money(item.amount)} đ ngày ${shortDate(item.workDate)}${item.note ? ` (${item.note})` : ''}?`, async () => {
      try {
        await api.delete(`/workforce/adjustments/${item.id}`);
        await load();
      } catch (deleteError) {
        Alert.alert('Chưa xoá được', deleteError instanceof Error ? deleteError.message : 'Vui lòng thử lại.');
      }
    });
  }

  const slip = view?.payslip;
  const closed = Boolean(view?.closed);
  const lineDetail = (line: WorkshopPayslipLine) => [line.projectName, line.note, shortDate(line.date)].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" style={styles.iconButton} onPress={() => router.back()}><Icon name="arrow-left" size={20} color="#1D2939" /></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Phiếu lương tháng {monthLabel(month).split('/')[0]}</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{view ? `${view.worker.name} · ${view.worker.roleName}` : 'Đang tải...'}</Text>
        </View>
        <Pressable accessibilityLabel="Chia sẻ PDF" disabled={!view || exporting} style={styles.iconButton} onPress={() => void exportPdf()}>
          {exporting ? <ActivityIndicator color={colors.brandOrange} /> : <Icon name="share-2" size={18} color="#1D2939" />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Pressable style={styles.error} onPress={() => void load()}><Icon name="alert-circle" size={18} color="#B42318" /><Text style={styles.errorText}>{error} · Bấm để thử lại</Text></Pressable> : null}
        {loading && !view ? <View style={styles.loading}><ActivityIndicator color={colors.brandOrange} /></View> : null}

        {view && slip ? (
          <>
            {closed ? <View style={styles.closedBanner}><Icon name="lock" size={15} color="#B54708" /><Text style={styles.closedText}>Tháng {monthLabel(month)} đã chốt lương · chỉ xem</Text></View> : null}
            <View style={styles.receipt}>
              <View style={styles.receiptHead}>
                <Text style={styles.orgName}>{(view.organizationName || 'Xưởng của bạn').toUpperCase()}</Text>
                <Text style={styles.period}>Phiếu lương 01/{month.slice(5)} – {shortDate(lastDayOfMonth(month))}/{month.slice(0, 4)}{closed ? '' : ' · tạm tính'}</Text>
              </View>
              <Line label="Ngày công" detail={`${slip.fullDays} đủ · ${slip.halfDays} nửa · ${slip.paidLeaveDays} phép có lương`} value={`${num(slip.workUnits)} công`} />
              {slip.unpaidLeaveDays || slip.absentDays ? <Line label="Nghỉ không lương / vắng" value={`${slip.unpaidLeaveDays} / ${slip.absentDays} ngày`} muted /> : null}
              <Line label="Lương theo công" detail={view.basePayFormula} value={money(slip.basePay)} />
              {slip.overtimePay ? <Line label="Tăng ca" detail={`${num(slip.overtimeHours)} giờ × ${money(slip.overtimeHourlyRate)}`} value={money(slip.overtimePay)} /> : null}
              {slip.sundayPay ? <Line label="Chủ nhật" detail={`${num(slip.sundayDays)} ngày · hệ số ${view.worker.sundayPayPercent}%`} value={money(slip.sundayPay)} /> : null}
              {slip.holidayPay ? <Line label="Ngày lễ" detail={`${num(slip.holidayDays)} ngày · hệ số ${view.worker.holidayPayPercent}%`} value={money(slip.holidayPay)} /> : null}
              {slip.pieces.map((piece, index) => <Line key={`p${index}`} label={`Khoán: ${piece.label}`} detail={lineDetail(piece)} value={money(piece.amount)} />)}
              {slip.bonuses.map((bonus, index) => <Line key={`b${index}`} label="Thưởng" detail={lineDetail(bonus)} value={money(bonus.amount)} />)}
              <Line label="Tổng cộng" value={money(slip.gross)} total />
              {slip.insuranceEmployee ? <Line label="Bảo hiểm 10,5%" detail={`Trên lương đóng BH ${money(slip.insuranceSalary)}`} value={`−${money(slip.insuranceEmployee)}`} minus /> : null}
              {slip.advances.map((advance, index) => <Line key={`a${index}`} label="Tạm ứng" detail={lineDetail(advance)} value={`−${money(advance.amount)}`} minus />)}
              {slip.penalties.map((penalty, index) => <Line key={`f${index}`} label="Phạt" detail={lineDetail(penalty)} value={`−${money(penalty.amount)}`} minus />)}
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>THỰC LĨNH</Text>
                <Text style={[styles.netValue, slip.net < 0 && { color: '#B42318' }]}>{money(slip.net)} đ</Text>
              </View>
            </View>
            {slip.insuranceEmployer ? (
              <View style={styles.note}><Text style={styles.noteText}>Xưởng đóng thêm BH 21,5% = <Text style={styles.noteStrong}>{money(slip.insuranceEmployer)} đ</Text> (chi phí xưởng, không trừ vào lương thợ).</Text></View>
            ) : null}

            <View style={styles.actions}>
              <Pressable disabled={closed} style={[styles.button, closed && styles.disabled]} onPress={() => setSheet(true)}><Icon name="plus" size={16} color="#1D2939" /><Text style={styles.buttonText}>Tạm ứng / thưởng</Text></Pressable>
              <Pressable disabled={exporting} style={[styles.button, styles.buttonPrimary]} onPress={() => void exportPdf()}>
                {exporting ? <ActivityIndicator color={colors.white} /> : <><Icon name="download" size={16} color={colors.white} /><Text style={[styles.buttonText, styles.buttonTextPrimary]}>Xuất PDF</Text></>}
              </Pressable>
            </View>

            {items.length ? (
              <View style={styles.itemsCard}>
                <Text style={styles.itemsTitle}>Khoản đã ghi trong tháng</Text>
                {items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.headerCopy}>
                      <Text style={styles.itemLabel}>{KIND_LABEL[item.kind]} · {shortDate(item.workDate)}</Text>
                      {item.note ? <Text numberOfLines={1} style={styles.itemNote}>{item.note}</Text> : null}
                    </View>
                    <Text style={[styles.itemAmount, item.kind !== 'BONUS' && { color: '#B42318' }]}>{item.kind === 'BONUS' ? '+' : '−'}{money(item.amount)}</Text>
                    {!closed ? <Pressable accessibilityLabel="Xoá khoản" style={styles.itemDelete} onPress={() => removeItem(item)}><Icon name="trash-2" size={15} color="#B42318" /></Pressable> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <AdjustmentSheet
        visible={sheet}
        workerId={workerId}
        workerName={view?.worker.name ?? ''}
        defaultDate={month === today.slice(0, 7) ? today : lastDayOfMonth(month)}
        onClose={() => setSheet(false)}
        onSaved={() => { setSheet(false); void load(); }}
      />
    </View>
  );
}

function Line({ label, detail, value, minus, total, muted }: { label: string; detail?: string; value: string; minus?: boolean; total?: boolean; muted?: boolean }) {
  return (
    <View style={[styles.line, total && styles.lineTotal]}>
      <View style={styles.headerCopy}>
        <Text style={[styles.lineLabel, total && styles.lineLabelTotal, muted && { color: '#667085' }]}>{label}</Text>
        {detail ? <Text style={styles.lineDetail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.lineValue, minus && styles.lineMinus, total && styles.lineLabelTotal]}>{value}</Text>
    </View>
  );
}

function AdjustmentSheet({ visible, workerId, workerName, defaultDate, onClose, onSaved }: {
  visible: boolean;
  workerId: string;
  workerName: string;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<WorkshopPayAdjustmentKind>('ADVANCE');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount) { Alert.alert('Thiếu thông tin', 'Nhập số tiền.'); return; }
    setSaving(true);
    try {
      await api.post('/workforce/adjustments', { workerId, kind, amount, note: note.trim(), workDate: defaultDate });
      onSaved();
    } catch (saveError) {
      Alert.alert('Chưa lưu được', saveError instanceof Error ? saveError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => { setKind('ADVANCE'); setAmount(0); setNote(''); }}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={styles.headerCopy}><Text style={styles.sheetTitle}>Ghi khoản cho {workerName}</Text><Text style={styles.sheetSub}>Ngày {shortDate(defaultDate)}</Text></View>
            <Pressable style={styles.closeButton} onPress={onClose}><Icon name="x" size={20} color="#475467" /></Pressable>
          </View>
          <View style={styles.kindRow}>
            {(['ADVANCE', 'BONUS', 'PENALTY'] as WorkshopPayAdjustmentKind[]).map((value) => (
              <Pressable key={value} style={[styles.kind, kind === value && styles.kindOn]} onPress={() => setKind(value)}>
                <Text style={[styles.kindText, kind === value && styles.kindTextOn]}>{KIND_LABEL[value]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Số tiền</Text>
          <TextInput value={amount ? formatVndInput(amount) : ''} onChangeText={(text) => setAmount(parseVndInput(text))} placeholder="VNĐ" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} />
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput value={note} onChangeText={setNote} placeholder={kind === 'ADVANCE' ? 'Ví dụ: Ứng tiền nhà' : kind === 'BONUS' ? 'Ví dụ: Hoàn thành sớm' : 'Ví dụ: Đi muộn'} placeholderTextColor="#98A2B3" style={styles.input} />
          <Pressable disabled={saving} style={[styles.save, saving && styles.disabled]} onPress={() => void save()}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Lưu {KIND_LABEL[kind].toLowerCase()}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  header: { paddingTop: Platform.OS === 'ios' ? 48 : 28, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E4E7EC' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#0A0A0A', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  headerSubtitle: { color: '#667085', fontSize: 12, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 120 },
  error: { minHeight: 48, marginBottom: 10, borderRadius: 12, padding: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 17 },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89', marginBottom: 10 },
  closedText: { color: '#B54708', fontSize: 12, fontWeight: '700' },
  receipt: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden' },
  receiptHead: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D0D5DD', borderStyle: 'dashed' },
  orgName: { color: '#0A0A0A', fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  period: { color: '#667085', fontSize: 11, marginTop: 3, textAlign: 'center' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  lineTotal: { backgroundColor: '#F9FAFB' },
  lineLabel: { color: '#1D2939', fontSize: 13 },
  lineLabelTotal: { fontWeight: '900', color: '#0A0A0A' },
  lineDetail: { color: '#667085', fontSize: 11, marginTop: 1 },
  lineValue: { color: '#0A0A0A', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lineMinus: { color: '#DC2626' },
  netRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#D0D5DD', borderStyle: 'dashed' },
  netLabel: { color: '#0A0A0A', fontSize: 13, fontWeight: '900' },
  netValue: { color: '#0A0A0A', fontSize: 22, fontWeight: '900' },
  note: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E4E7EC' },
  noteText: { color: '#667085', fontSize: 11.5, lineHeight: 16 },
  noteStrong: { color: '#1D2939', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buttonPrimary: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  buttonText: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  buttonTextPrimary: { color: colors.white },
  disabled: { opacity: 0.45 },
  itemsCard: { marginTop: 14, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', paddingHorizontal: 12, paddingBottom: 4 },
  itemsTitle: { color: '#667085', fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase', paddingVertical: 10 },
  itemRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  itemLabel: { color: '#1D2939', fontSize: 13, fontWeight: '700' },
  itemNote: { color: '#667085', fontSize: 11.5 },
  itemAmount: { color: '#059669', fontSize: 13, fontWeight: '800' },
  itemDelete: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF3F2', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' },
  sheet: { paddingHorizontal: 16, paddingBottom: 26, backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sheetTitle: { color: '#0A0A0A', fontSize: 16, fontWeight: '900' },
  sheetSub: { color: '#667085', fontSize: 12, marginTop: 2 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  kindRow: { flexDirection: 'row', gap: 6 },
  kind: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' },
  kindOn: { borderColor: colors.brandOrange, backgroundColor: '#FFF2E8' },
  kindText: { color: '#667085', fontSize: 13, fontWeight: '700' },
  kindTextOn: { color: colors.brandOrangeText, fontWeight: '900' },
  label: { color: '#344054', fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', color: '#0A0A0A', backgroundColor: colors.white, fontSize: 14 },
  save: { minHeight: 48, marginTop: 16, borderRadius: 12, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.white, fontSize: 14, fontWeight: '900' },
});
