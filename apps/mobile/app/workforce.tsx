import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  CreateWorkshopWorkerInput,
  WorkshopAttendance,
  WorkshopPayrollRow,
  WorkshopPayType,
  WorkshopWorker,
} from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

type ScreenTab = 'attendance' | 'workers' | 'payroll';

const payTypeLabel: Record<WorkshopPayType, string> = {
  DAILY: 'Theo ngày',
  HOURLY: 'Theo giờ',
  MONTHLY: 'Theo tháng',
};

function money(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

function localDate(): string {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clock(value?: string | null): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function WorkforceScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ScreenTab>('attendance');
  const [workers, setWorkers] = useState<WorkshopWorker[]>([]);
  const [attendance, setAttendance] = useState<WorkshopAttendance[]>([]);
  const [payroll, setPayroll] = useState<WorkshopPayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workerModal, setWorkerModal] = useState(false);
  const [overtimeRecord, setOvertimeRecord] = useState<WorkshopAttendance | null>(null);
  const [overtimeValue, setOvertimeValue] = useState('0');
  const [saving, setSaving] = useState(false);
  const [workerForm, setWorkerForm] = useState<CreateWorkshopWorkerInput>({
    name: '', phone: '', roleName: 'Thợ sản xuất', payType: 'DAILY', baseRate: 0, overtimeRate: 0,
  });

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const month = localDate().slice(0, 7);
      const [workerRows, attendanceRows, payrollRows] = await Promise.all([
        api.get<WorkshopWorker[]>('/workforce/workers'),
        api.get<WorkshopAttendance[]>(`/workforce/attendance?date=${localDate()}`),
        api.get<WorkshopPayrollRow[]>(`/workforce/payroll?month=${month}`),
      ]);
      setWorkers(workerRows);
      setAttendance(attendanceRows);
      setPayroll(payrollRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu nhân sự.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const attendanceByWorker = useMemo(() => new Map(attendance.map((row) => [row.workerId, row])), [attendance]);
  const presentCount = attendance.filter((row) => row.status === 'PRESENT').length;
  const overtimeTotal = attendance.reduce((sum, row) => sum + row.overtimeHours, 0);
  const payrollTotal = payroll.reduce((sum, row) => sum + row.estimatedPay, 0);

  async function check(workerId: string, action: 'CHECK_IN' | 'CHECK_OUT') {
    setSaving(true);
    try {
      await api.post('/workforce/attendance/check', { workerId, action });
      await load(true);
    } catch (checkError) {
      Alert.alert('Không thể chấm công', checkError instanceof Error ? checkError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function createWorker() {
    if (!workerForm.name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thợ.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/workforce/workers', workerForm);
      setWorkerModal(false);
      setWorkerForm({ name: '', phone: '', roleName: 'Thợ sản xuất', payType: 'DAILY', baseRate: 0, overtimeRate: 0 });
      await load(true);
    } catch (createError) {
      Alert.alert('Chưa thêm được nhân sự', createError instanceof Error ? createError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function saveOvertime() {
    if (!overtimeRecord) return;
    setSaving(true);
    try {
      await api.patch(`/workforce/attendance/${overtimeRecord.id}`, { overtimeHours: Number(overtimeValue) || 0 });
      setOvertimeRecord(null);
      await load(true);
    } catch (saveError) {
      Alert.alert('Chưa lưu được giờ tăng ca', saveError instanceof Error ? saveError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" style={styles.backButton} onPress={() => router.back()}><Icon name="arrow-left" size={21} color="#1D2939" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Nhân sự xưởng</Text><Text style={styles.headerSubtitle}>Chấm công, tăng ca và lương</Text></View>
        <Pressable accessibilityLabel="Thêm nhân sự" style={styles.addButton} onPress={() => setWorkerModal(true)}><Icon name="plus" size={21} color={colors.brandOrangeText} /></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandOrange} />}
      >
        <View style={styles.summaryBand}>
          <View style={styles.summaryItem}><Icon name="user-check" size={18} color="#047857" /><Text style={styles.summaryValue}>{presentCount}/{workers.length}</Text><Text style={styles.summaryLabel}>Có mặt</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Icon name="clock" size={18} color="#B45309" /><Text style={styles.summaryValue}>{overtimeTotal.toFixed(1)}h</Text><Text style={styles.summaryLabel}>Tăng ca hôm nay</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Icon name="dollar-sign" size={18} color="#2563EB" /><Text style={styles.summaryValue}>{payrollTotal >= 1_000_000 ? `${(payrollTotal / 1_000_000).toFixed(1)}tr` : `${Math.round(payrollTotal / 1_000)}k`}</Text><Text style={styles.summaryLabel}>Lương dự tính</Text></View>
        </View>

        <View style={styles.tabs}>
          {([
            ['attendance', 'Chấm công'],
            ['workers', 'Nhân sự'],
            ['payroll', 'Bảng lương'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Pressable style={styles.error} onPress={() => void load(true)}><Icon name="alert-circle" size={18} color="#B42318" /><Text style={styles.errorText}>{error}</Text></Pressable> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brandOrange} /><Text style={styles.muted}>Đang tải dữ liệu...</Text></View> : null}

        {!loading && tab === 'attendance' ? (
          <View>
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Chấm công hôm nay</Text><Text style={styles.sectionSub}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text></View></View>
            {workers.length === 0 ? (
              <Pressable style={styles.empty} onPress={() => setWorkerModal(true)}><Icon name="users" size={28} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có nhân sự</Text><Text style={styles.emptyText}>Thêm thợ đầu tiên để bắt đầu chấm công.</Text></Pressable>
            ) : workers.map((worker) => {
              const row = attendanceByWorker.get(worker.id);
              const hasCheckedIn = !!row?.checkInAt;
              const hasCheckedOut = !!row?.checkOutAt;
              return (
                <View key={worker.id} style={styles.attendanceRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{worker.name.trim().charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.personCopy}>
                    <Text style={styles.personName}>{worker.name}</Text>
                    <Text style={styles.personRole}>{worker.roleName}</Text>
                    <Text style={styles.timeLine}>Vào {clock(row?.checkInAt)} · Ra {clock(row?.checkOutAt)}{row?.overtimeHours ? ` · TC ${row.overtimeHours}h` : ''}</Text>
                  </View>
                  {!hasCheckedIn ? (
                    <Pressable disabled={saving} style={styles.checkInButton} onPress={() => void check(worker.id, 'CHECK_IN')}><Text style={styles.checkInText}>Chấm vào</Text></Pressable>
                  ) : !hasCheckedOut ? (
                    <Pressable disabled={saving} style={styles.checkOutButton} onPress={() => void check(worker.id, 'CHECK_OUT')}><Text style={styles.checkOutText}>Chấm ra</Text></Pressable>
                  ) : (
                    <Pressable style={styles.doneButton} onPress={() => { setOvertimeRecord(row); setOvertimeValue(String(row.overtimeHours)); }}><Icon name="edit-2" size={15} color="#475467" /><Text style={styles.doneText}>Tăng ca</Text></Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {!loading && tab === 'workers' ? (
          <View>
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Danh sách nhân sự</Text><Text style={styles.sectionSub}>{workers.length} người đang hoạt động</Text></View><Pressable style={styles.inlineAdd} onPress={() => setWorkerModal(true)}><Icon name="plus" size={17} color={colors.brandOrangeText} /><Text style={styles.inlineAddText}>Thêm</Text></Pressable></View>
            {workers.map((worker) => (
              <View key={worker.id} style={styles.workerRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{worker.name.trim().charAt(0).toUpperCase()}</Text></View>
                <View style={styles.personCopy}><Text style={styles.personName}>{worker.name}</Text><Text style={styles.personRole}>{worker.roleName} · {payTypeLabel[worker.payType]}</Text><Text style={styles.payRate}>{money(worker.baseRate)}{worker.payType === 'DAILY' ? '/ngày' : worker.payType === 'HOURLY' ? '/giờ' : '/tháng'}</Text></View>
              </View>
            ))}
          </View>
        ) : null}

        {!loading && tab === 'payroll' ? (
          <View>
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Lương dự tính tháng này</Text><Text style={styles.sectionSub}>Tự động cộng ngày công và giờ tăng ca</Text></View></View>
            {payroll.length === 0 ? <View style={styles.empty}><Icon name="dollar-sign" size={28} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có dữ liệu lương</Text></View> : payroll.map((row) => (
              <View key={row.worker.id} style={styles.payrollRow}>
                <View style={styles.payrollHead}><View><Text style={styles.personName}>{row.worker.name}</Text><Text style={styles.personRole}>{row.daysWorked} ngày · {row.regularHours.toFixed(1)} giờ · TC {row.overtimeHours.toFixed(1)} giờ</Text></View><Text style={styles.payrollTotal}>{money(row.estimatedPay)}</Text></View>
                <View style={styles.payBreakdown}><Text style={styles.breakdownText}>Lương chính {money(row.basePay)}</Text><Text style={styles.breakdownText}>Tăng ca {money(row.overtimePay)}</Text></View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={workerModal} transparent animationType="slide" onRequestClose={() => setWorkerModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Thêm nhân sự</Text><Text style={styles.sheetSub}>Thông tin dùng để tính công và lương</Text></View><Pressable style={styles.closeButton} onPress={() => setWorkerModal(false)}><Icon name="x" size={20} color="#475467" /></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Họ và tên</Text><TextInput value={workerForm.name} onChangeText={(name) => setWorkerForm((form) => ({ ...form, name }))} placeholder="Ví dụ: Nguyễn Văn An" placeholderTextColor="#98A2B3" style={styles.input} />
              <View style={styles.fieldRow}><View style={styles.fieldHalf}><Text style={styles.label}>Số điện thoại</Text><TextInput value={workerForm.phone} onChangeText={(phone) => setWorkerForm((form) => ({ ...form, phone }))} placeholder="Số liên hệ" placeholderTextColor="#98A2B3" keyboardType="phone-pad" style={styles.input} /></View><View style={styles.fieldHalf}><Text style={styles.label}>Vị trí</Text><TextInput value={workerForm.roleName} onChangeText={(roleName) => setWorkerForm((form) => ({ ...form, roleName }))} placeholder="Thợ sản xuất" placeholderTextColor="#98A2B3" style={styles.input} /></View></View>
              <Text style={styles.label}>Hình thức tính lương</Text>
              <View style={styles.payTypeRow}>{(['DAILY', 'HOURLY', 'MONTHLY'] as WorkshopPayType[]).map((payType) => <Pressable key={payType} style={[styles.payTypeButton, workerForm.payType === payType && styles.payTypeActive]} onPress={() => setWorkerForm((form) => ({ ...form, payType }))}><Text style={[styles.payTypeText, workerForm.payType === payType && styles.payTypeTextActive]}>{payTypeLabel[payType]}</Text></Pressable>)}</View>
              <View style={styles.fieldRow}><View style={styles.fieldHalf}><Text style={styles.label}>Mức lương cơ bản</Text><TextInput value={workerForm.baseRate ? String(workerForm.baseRate) : ''} onChangeText={(value) => setWorkerForm((form) => ({ ...form, baseRate: Number(value.replace(/\D/g, '')) || 0 }))} placeholder="VNĐ" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} /></View><View style={styles.fieldHalf}><Text style={styles.label}>Tăng ca mỗi giờ</Text><TextInput value={workerForm.overtimeRate ? String(workerForm.overtimeRate) : ''} onChangeText={(value) => setWorkerForm((form) => ({ ...form, overtimeRate: Number(value.replace(/\D/g, '')) || 0 }))} placeholder="Tự tính nếu trống" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} /></View></View>
              <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void createWorker()}>{saving ? <ActivityIndicator color="#172033" /> : <><Icon name="save" size={18} color="#172033" /><Text style={styles.primaryText}>Lưu nhân sự</Text></>}</Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!overtimeRecord} transparent animationType="fade" onRequestClose={() => setOvertimeRecord(null)}>
        <View style={styles.centerOverlay}><View style={styles.dialog}><View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Giờ tăng ca</Text><Text style={styles.sheetSub}>{overtimeRecord?.worker.name}</Text></View><Pressable style={styles.closeButton} onPress={() => setOvertimeRecord(null)}><Icon name="x" size={20} color="#475467" /></Pressable></View><Text style={styles.label}>Số giờ tăng ca hôm nay</Text><TextInput value={overtimeValue} onChangeText={setOvertimeValue} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} /><Pressable disabled={saving} style={styles.primaryButton} onPress={() => void saveOvertime()}><Icon name="save" size={18} color="#172033" /><Text style={styles.primaryText}>Lưu giờ tăng ca</Text></Pressable></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { minHeight: 92, paddingTop: Platform.OS === 'ios' ? 44 : 24, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E7E9ED' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 4 },
  headerTitle: { color: '#172033', fontSize: 20, fontWeight: '900' },
  headerSubtitle: { color: '#667085', fontSize: 11, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 120 },
  summaryBand: { minHeight: 94, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: '#E7E9ED' },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  summaryDivider: { width: 1, height: 48, backgroundColor: '#E7E9ED' },
  summaryValue: { color: '#172033', fontSize: 16, fontWeight: '900', marginTop: 4 },
  summaryLabel: { color: '#667085', fontSize: 9, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  tabs: { height: 48, flexDirection: 'row', marginTop: 14, padding: 4, backgroundColor: '#E9ECF1', borderRadius: 10 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: colors.white },
  tabText: { color: '#667085', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#172033', fontWeight: '900' },
  error: { minHeight: 52, marginTop: 12, borderRadius: 10, padding: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11, lineHeight: 16 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#667085', fontSize: 11 },
  sectionHeading: { marginTop: 22, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172033', fontSize: 16, fontWeight: '900' },
  sectionSub: { color: '#667085', fontSize: 10, marginTop: 3 },
  inlineAdd: { minHeight: 40, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, backgroundColor: '#FFF0E5' },
  inlineAddText: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '800' },
  attendanceRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  workerRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E5', marginRight: 10 },
  avatarText: { color: colors.brandOrangeText, fontSize: 16, fontWeight: '900' },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: '#1D2939', fontSize: 13, fontWeight: '900' },
  personRole: { color: '#667085', fontSize: 10, marginTop: 3 },
  timeLine: { color: '#475467', fontSize: 9, marginTop: 5, fontWeight: '600' },
  payRate: { color: '#047857', fontSize: 11, fontWeight: '800', marginTop: 5 },
  checkInButton: { minWidth: 76, minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#E5F7EF' },
  checkInText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  checkOutButton: { minWidth: 76, minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFF0E5' },
  checkOutText: { color: colors.brandOrangeText, fontSize: 10, fontWeight: '900' },
  doneButton: { minWidth: 76, minHeight: 42, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF0F3' },
  doneText: { color: '#475467', fontSize: 10, fontWeight: '800' },
  payrollRow: { padding: 13, marginBottom: 9, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  payrollHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  payrollTotal: { color: '#C54E09', fontSize: 14, fontWeight: '900' },
  payBreakdown: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EEF0F3', flexDirection: 'row', justifyContent: 'space-between' },
  breakdownText: { color: '#667085', fontSize: 9 },
  empty: { minHeight: 180, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: '#344054', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#667085', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.55)' },
  centerOverlay: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(16,24,40,0.55)' },
  sheet: { maxHeight: '92%', paddingHorizontal: 18, paddingBottom: 24, backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  dialog: { padding: 18, backgroundColor: colors.white, borderRadius: 16 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  sheetHeader: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: '#172033', fontSize: 18, fontWeight: '900' },
  sheetSub: { color: '#667085', fontSize: 10, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#344054', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', color: '#172033', backgroundColor: colors.white, fontSize: 12 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  payTypeRow: { flexDirection: 'row', gap: 6 },
  payTypeButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#D0D5DD' },
  payTypeActive: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' },
  payTypeText: { color: '#667085', fontSize: 10, fontWeight: '700' },
  payTypeTextActive: { color: colors.brandOrangeText, fontWeight: '900' },
  primaryButton: { minHeight: 50, marginTop: 20, borderRadius: 11, backgroundColor: '#FF9A3C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#172033', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
