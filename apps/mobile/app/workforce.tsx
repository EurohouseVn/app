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
  WorkshopWorkdaySetting,
  WorkshopWorker,
} from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { confirmAction } from '../src/lib/alert';
import { useAuth } from '../src/lib/auth';
import { getInstallationIdentity } from '../src/lib/installationIdentity';
import { listGuestAttendance, recordGuestAttendance, type GuestAttendanceRecord } from '../src/lib/localGuestAttendance';

type ScreenTab = 'attendance' | 'workers' | 'payroll';

const payTypeLabel: Record<WorkshopPayType, string> = {
  DAILY: 'Theo ngày',
  HOURLY: 'Theo giờ',
  MONTHLY: 'Theo tháng',
};

function emptyWorkerForm(): CreateWorkshopWorkerInput {
  return {
    name: '',
    phone: '',
    roleName: 'Thợ sản xuất',
    payType: 'DAILY',
    baseRate: 0,
    overtimeRate: 0,
    sundayPayEnabled: false,
    sundayPayPercent: 200,
    holidayPayEnabled: false,
    holidayPayPercent: 300,
  };
}

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

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function moveDate(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function displayDate(value: string): string {
  return dateFromKey(value).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function clock(value?: string | null): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function WorkforceScreen() {
  const { sessionTier } = useAuth();
  return sessionTier === 'GUEST' ? <GuestAttendanceScreen /> : <AuthenticatedWorkforceScreen />;
}

function GuestAttendanceScreen() {
  const router = useRouter();
  const [record, setRecord] = useState<GuestAttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const today = localDate();

  const loadLocal = useCallback(async () => {
    const installationId = await getInstallationIdentity(AsyncStorage);
    const records = await listGuestAttendance(AsyncStorage, installationId);
    setRecord(records.find((item) => item.date === today) ?? null);
  }, [today]);
  useFocusEffect(useCallback(() => { void loadLocal(); }, [loadLocal]));

  async function checkLocal(action: 'CHECK_IN' | 'CHECK_OUT') {
    setSaving(true);
    try {
      const installationId = await getInstallationIdentity(AsyncStorage);
      setRecord(await recordGuestAttendance(AsyncStorage, installationId, today, action));
    } finally {
      setSaving(false);
    }
  }

  return <ScrollView style={styles.screen} contentContainerStyle={styles.guestAttendancePage}>
    <Pressable style={styles.guestBack} onPress={() => router.back()}><Icon name="arrow-left" size={20} color="#344054" /><Text style={styles.guestBackText}>Trang chủ</Text></Pressable>
    <Text style={styles.guestKicker}>CHẤM CÔNG CÁ NHÂN</Text>
    <Text style={styles.guestTitle}>Ghi lại ngày làm việc ngay trên thiết bị</Text>
    <Text style={styles.guestDescription}>Dữ liệu này chỉ lưu cục bộ. Đăng ký tài khoản khi bạn muốn quản lý nhiều thợ, tính lương và đồng bộ lịch sử.</Text>
    <View style={styles.guestAttendanceCard}>
      <Text style={styles.guestDate}>{new Date(`${today}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
      <View style={styles.guestTimeRow}><View><Text style={styles.guestTimeLabel}>Vào ca</Text><Text style={styles.guestTime}>{clock(record?.checkIn)}</Text></View><View><Text style={styles.guestTimeLabel}>Ra ca</Text><Text style={styles.guestTime}>{clock(record?.checkOut)}</Text></View></View>
      <View style={styles.guestButtonRow}><Pressable disabled={saving || Boolean(record?.checkIn)} onPress={() => void checkLocal('CHECK_IN')} style={[styles.guestCheckButton, record?.checkIn && styles.guestButtonDisabled]}><Text style={styles.guestCheckButtonText}>Chấm vào ca</Text></Pressable><Pressable disabled={saving || !record?.checkIn || Boolean(record?.checkOut)} onPress={() => void checkLocal('CHECK_OUT')} style={[styles.guestCheckButton, styles.guestCheckoutButton, (!record?.checkIn || record?.checkOut) && styles.guestButtonDisabled]}><Text style={styles.guestCheckoutText}>Chấm ra ca</Text></Pressable></View>
    </View>
  </ScrollView>;
}

function AuthenticatedWorkforceScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ScreenTab>('attendance');
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [workers, setWorkers] = useState<WorkshopWorker[]>([]);
  const [attendance, setAttendance] = useState<WorkshopAttendance[]>([]);
  const [payroll, setPayroll] = useState<WorkshopPayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workerModal, setWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkshopWorker | null>(null);
  const [workdaySetting, setWorkdaySetting] = useState<WorkshopWorkdaySetting>({ date: localDate(), isHoliday: false, label: 'Lễ/Tết' });
  const [overtimeRecord, setOvertimeRecord] = useState<WorkshopAttendance | null>(null);
  const [overtimeValue, setOvertimeValue] = useState('0');
  const [saving, setSaving] = useState(false);
  const [workerForm, setWorkerForm] = useState<CreateWorkshopWorkerInput>(emptyWorkerForm);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const month = selectedDate.slice(0, 7);
      const [workerRows, attendanceRows, payrollRows, daySetting] = await Promise.all([
        api.get<WorkshopWorker[]>('/workforce/workers'),
        api.get<WorkshopAttendance[]>(`/workforce/attendance?date=${selectedDate}`),
        api.get<WorkshopPayrollRow[]>(`/workforce/payroll?month=${month}`),
        api.get<WorkshopWorkdaySetting>(`/workforce/attendance/day-setting?date=${selectedDate}`),
      ]);
      setWorkers(workerRows);
      setAttendance(attendanceRows);
      setPayroll(payrollRows);
      setWorkdaySetting(daySetting);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu nhân sự.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const attendanceByWorker = useMemo(() => new Map(attendance.map((row) => [row.workerId, row])), [attendance]);
  const presentCount = attendance.filter((row) => row.status === 'PRESENT').length;
  const overtimeTotal = attendance.reduce((sum, row) => sum + row.overtimeHours, 0);
  const payrollTotal = payroll.reduce((sum, row) => sum + row.estimatedPay, 0);
  const today = localDate();
  const isToday = selectedDate === today;
  const isPastDate = selectedDate < today;
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => moveDate(selectedDate, index - 3)), [selectedDate]);

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

  function openCreateWorker() {
    setEditingWorker(null);
    setWorkerForm(emptyWorkerForm());
    setWorkerModal(true);
  }

  function openEditWorker(worker: WorkshopWorker) {
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      roleName: worker.roleName,
      payType: worker.payType,
      baseRate: worker.baseRate,
      overtimeRate: worker.overtimeRate,
      standardMonthlyDays: worker.standardMonthlyDays,
      sundayPayEnabled: worker.sundayPayEnabled,
      sundayPayPercent: worker.sundayPayPercent,
      holidayPayEnabled: worker.holidayPayEnabled,
      holidayPayPercent: worker.holidayPayPercent,
    });
    setWorkerModal(true);
  }

  function closeWorkerModal() {
    setWorkerModal(false);
    setEditingWorker(null);
  }

  async function saveWorker() {
    if (!workerForm.name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thợ.');
      return;
    }
    setSaving(true);
    try {
      if (editingWorker) await api.patch(`/workforce/workers/${editingWorker.id}`, workerForm);
      else await api.post('/workforce/workers', workerForm);
      closeWorkerModal();
      setWorkerForm(emptyWorkerForm());
      await load(true);
    } catch (createError) {
      Alert.alert(editingWorker ? 'Chưa cập nhật được nhân sự' : 'Chưa thêm được nhân sự', createError instanceof Error ? createError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleHolidayDay() {
    if (isPastDate || saving) return;
    const nextValue = !workdaySetting.isHoliday;
    setSaving(true);
    try {
      const updated = await api.patch<WorkshopWorkdaySetting>(`/workforce/attendance/day-setting/${selectedDate}`, {
        isHoliday: nextValue,
        label: 'Lễ/Tết',
      });
      setWorkdaySetting(updated);
      await load(true);
    } catch (settingError) {
      Alert.alert('Chưa cập nhật được loại ngày', settingError instanceof Error ? settingError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  function deleteWorker(worker: WorkshopWorker) {
    confirmAction('Xoá nhân sự', `Xoá ${worker.name} khỏi danh sách đang hoạt động? Lịch sử chấm công và bảng lương vẫn được giữ lại.`, async () => {
      try {
        await api.delete(`/workforce/workers/${worker.id}`);
        await load(true);
      } catch (deleteError) {
        Alert.alert('Chưa xoá được nhân sự', deleteError instanceof Error ? deleteError.message : 'Vui lòng thử lại.');
      }
    });
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
        <Pressable accessibilityLabel="Thêm nhân sự" style={styles.addButton} onPress={openCreateWorker}><Icon name="plus" size={21} color={colors.brandOrangeText} /></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandOrange} />}
      >
        <View style={styles.summaryBand}>
          <View style={styles.summaryItem}><Icon name="user-check" size={18} color="#047857" /><Text style={styles.summaryValue}>{presentCount}/{workers.length}</Text><Text style={styles.summaryLabel}>Có mặt</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}><Icon name="clock" size={18} color="#B45309" /><Text style={styles.summaryValue}>{overtimeTotal.toFixed(1)}h</Text><Text style={styles.summaryLabel}>Tăng ca ngày chọn</Text></View>
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
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Bảng chấm công</Text><Text style={styles.sectionSub}>{isPastDate ? 'Ngày đã khóa, chỉ được xem' : isToday ? 'Hôm nay, có thể chấm công' : 'Ngày tương lai, chưa thể chấm công'}</Text></View></View>
            <View style={styles.dateNavigator}>
              <Pressable accessibilityLabel="Ngày trước" style={styles.dateArrow} onPress={() => setSelectedDate(current => moveDate(current, -1))}><Icon name="chevron-left" size={19} color="#344054" /></Pressable>
              <Pressable style={styles.dateTitleButton} onPress={() => setSelectedDate(today)}>
                <Text style={styles.dateTitle}>{displayDate(selectedDate)}</Text>
                <Text style={styles.dateHint}>{isToday ? 'Hôm nay' : 'Bấm để về hôm nay'}</Text>
              </Pressable>
              <Pressable accessibilityLabel="Ngày sau" style={styles.dateArrow} onPress={() => setSelectedDate(current => moveDate(current, 1))}><Icon name="chevron-right" size={19} color="#344054" /></Pressable>
            </View>
            <Pressable
              disabled={isPastDate || saving}
              style={[styles.holidayDayToggle, workdaySetting.isHoliday && styles.holidayDayToggleActive, isPastDate && styles.disabled]}
              onPress={() => void toggleHolidayDay()}
            >
              <View style={[styles.checkbox, workdaySetting.isHoliday && styles.checkboxActive]}>
                {workdaySetting.isHoliday ? <Icon name="check" size={14} color={colors.white} /> : null}
              </View>
              <View style={styles.holidayDayCopy}>
                <Text style={styles.holidayDayTitle}>Ngày Lễ/Tết</Text>
                <Text style={styles.holidayDayText}>{isPastDate ? 'Ngày đã khóa' : 'Tick để áp dụng tỷ lệ Lễ/Tết trong bảng lương'}</Text>
              </View>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
              {weekDates.map((date) => {
                const active = date === selectedDate;
                const parsed = dateFromKey(date);
                return (
                  <Pressable key={date} style={[styles.dayCell, active && styles.dayCellActive]} onPress={() => setSelectedDate(date)}>
                    <Text style={[styles.dayName, active && styles.dayNameActive]}>{parsed.toLocaleDateString('vi-VN', { weekday: 'short' })}</Text>
                    <Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{parsed.getDate()}</Text>
                    {date === today ? <View style={[styles.todayDot, active && { backgroundColor: colors.white }]} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {workers.length === 0 ? (
              <Pressable style={styles.empty} onPress={openCreateWorker}><Icon name="users" size={28} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có nhân sự</Text><Text style={styles.emptyText}>Thêm thợ đầu tiên để bắt đầu chấm công.</Text></Pressable>
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
                  {!isToday ? (
                    <View style={[styles.lockedButton, !isPastDate && styles.futureButton]}><Icon name={isPastDate ? 'lock' : 'calendar'} size={14} color="#667085" /><Text style={styles.lockedText}>{isPastDate ? (row ? 'Đã khóa' : 'Không chấm') : 'Chưa đến'}</Text></View>
                  ) : !hasCheckedIn ? (
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
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Danh sách nhân sự</Text><Text style={styles.sectionSub}>{workers.length} người đang hoạt động</Text></View><Pressable style={styles.inlineAdd} onPress={openCreateWorker}><Icon name="plus" size={17} color={colors.brandOrangeText} /><Text style={styles.inlineAddText}>Thêm</Text></Pressable></View>
            {workers.map((worker) => (
              <View key={worker.id} style={styles.workerRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{worker.name.trim().charAt(0).toUpperCase()}</Text></View>
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{worker.name}</Text>
                  <Text style={styles.personRole}>{worker.roleName} · {payTypeLabel[worker.payType]}</Text>
                  <Text style={styles.payRate}>{money(worker.baseRate)}{worker.payType === 'DAILY' ? '/ngày' : worker.payType === 'HOURLY' ? '/giờ' : '/tháng'}</Text>
                  {worker.sundayPayEnabled || worker.holidayPayEnabled ? (
                    <Text style={styles.specialPaySummary}>
                      {[worker.sundayPayEnabled ? `CN ${worker.sundayPayPercent}%` : '', worker.holidayPayEnabled ? `Lễ/Tết ${worker.holidayPayPercent}%` : ''].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.workerActions}>
                  <Pressable accessibilityLabel={`Sửa ${worker.name}`} style={styles.editWorkerButton} onPress={() => openEditWorker(worker)}><Icon name="edit-2" size={17} color="#475467" /></Pressable>
                  <Pressable accessibilityLabel={`Xoá ${worker.name}`} style={styles.deleteWorkerButton} onPress={() => deleteWorker(worker)}><Icon name="trash-2" size={17} color="#B42318" /></Pressable>
                </View>
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
                <View style={styles.payBreakdown}>
                  <Text style={styles.breakdownText}>Lương chính {money(row.basePay)}</Text>
                  <Text style={styles.breakdownText}>Tăng ca {money(row.overtimePay)}</Text>
                  {row.sundayPay > 0 ? <Text style={styles.breakdownText}>CN ({row.sundayDays} ngày) +{money(row.sundayPay)}</Text> : null}
                  {row.holidayPay > 0 ? <Text style={styles.breakdownText}>Lễ/Tết ({row.holidayDays} ngày) +{money(row.holidayPay)}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={workerModal} transparent animationType="slide" onRequestClose={closeWorkerModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{editingWorker ? 'Sửa nhân sự' : 'Thêm nhân sự'}</Text>
                <Text style={styles.sheetSub}>Thông tin dùng để tính công và lương</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={closeWorkerModal}><Icon name="x" size={20} color="#475467" /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Họ và tên</Text><TextInput value={workerForm.name} onChangeText={(name) => setWorkerForm((form) => ({ ...form, name }))} placeholder="Ví dụ: Nguyễn Văn An" placeholderTextColor="#98A2B3" style={styles.input} />
              <View style={styles.fieldRow}><View style={styles.fieldHalf}><Text style={styles.label}>Số điện thoại</Text><TextInput value={workerForm.phone} onChangeText={(phone) => setWorkerForm((form) => ({ ...form, phone }))} placeholder="Số liên hệ" placeholderTextColor="#98A2B3" keyboardType="phone-pad" style={styles.input} /></View><View style={styles.fieldHalf}><Text style={styles.label}>Vị trí</Text><TextInput value={workerForm.roleName} onChangeText={(roleName) => setWorkerForm((form) => ({ ...form, roleName }))} placeholder="Thợ sản xuất" placeholderTextColor="#98A2B3" style={styles.input} /></View></View>
              <Text style={styles.label}>Hình thức tính lương</Text>
              <View style={styles.payTypeRow}>{(['DAILY', 'HOURLY', 'MONTHLY'] as WorkshopPayType[]).map((payType) => <Pressable key={payType} style={[styles.payTypeButton, workerForm.payType === payType && styles.payTypeActive]} onPress={() => setWorkerForm((form) => ({ ...form, payType }))}><Text style={[styles.payTypeText, workerForm.payType === payType && styles.payTypeTextActive]}>{payTypeLabel[payType]}</Text></Pressable>)}</View>
              <View style={styles.fieldRow}><View style={styles.fieldHalf}><Text style={styles.label}>Mức lương cơ bản</Text><TextInput value={workerForm.baseRate ? String(workerForm.baseRate) : ''} onChangeText={(value) => setWorkerForm((form) => ({ ...form, baseRate: Number(value.replace(/\D/g, '')) || 0 }))} placeholder="VNĐ" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} /></View><View style={styles.fieldHalf}><Text style={styles.label}>Tăng ca mỗi giờ</Text><TextInput value={workerForm.overtimeRate ? String(workerForm.overtimeRate) : ''} onChangeText={(value) => setWorkerForm((form) => ({ ...form, overtimeRate: Number(value.replace(/\D/g, '')) || 0 }))} placeholder="Tự tính nếu trống" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} /></View></View>
              {workerForm.payType === 'MONTHLY' ? (
                <><Text style={styles.label}>Ngày công chuẩn trong tháng</Text><TextInput value={String(workerForm.standardMonthlyDays || 26)} onChangeText={(value) => setWorkerForm((form) => ({ ...form, standardMonthlyDays: Number(value.replace(/\D/g, '')) || 26 }))} placeholder="26 ngày" placeholderTextColor="#98A2B3" keyboardType="number-pad" style={styles.input} /></>
              ) : null}

              <View style={styles.specialRuleSection}>
                <Text style={styles.specialRuleHeading}>Lương ngày đặc biệt</Text>
                <Text style={styles.specialRuleHint}>Tỷ lệ là tổng mức hưởng so với ngày thường.</Text>

                <Pressable style={[styles.specialRuleRow, workerForm.sundayPayEnabled && styles.specialRuleRowActive]} onPress={() => setWorkerForm((form) => ({ ...form, sundayPayEnabled: !form.sundayPayEnabled }))}>
                  <View style={[styles.checkbox, workerForm.sundayPayEnabled && styles.checkboxActive]}>{workerForm.sundayPayEnabled ? <Icon name="check" size={14} color={colors.white} /> : null}</View>
                  <View style={styles.specialRuleCopy}><Text style={styles.specialRuleTitle}>Áp dụng lương Chủ nhật</Text><Text style={styles.specialRuleText}>Tự động nhận diện ngày Chủ nhật đã chấm công</Text></View>
                </Pressable>
                {workerForm.sundayPayEnabled ? (
                  <View style={styles.percentRow}><Text style={styles.percentLabel}>Tỷ lệ lương Chủ nhật</Text><View style={styles.percentInputWrap}><TextInput value={String(workerForm.sundayPayPercent || 200)} onChangeText={(value) => setWorkerForm((form) => ({ ...form, sundayPayPercent: Number(value.replace(/\D/g, '')) || 200 }))} keyboardType="number-pad" style={styles.percentInput} /><Text style={styles.percentSuffix}>%</Text></View></View>
                ) : null}

                <Pressable style={[styles.specialRuleRow, workerForm.holidayPayEnabled && styles.specialRuleRowActive]} onPress={() => setWorkerForm((form) => ({ ...form, holidayPayEnabled: !form.holidayPayEnabled }))}>
                  <View style={[styles.checkbox, workerForm.holidayPayEnabled && styles.checkboxActive]}>{workerForm.holidayPayEnabled ? <Icon name="check" size={14} color={colors.white} /> : null}</View>
                  <View style={styles.specialRuleCopy}><Text style={styles.specialRuleTitle}>Áp dụng lương Lễ/Tết</Text><Text style={styles.specialRuleText}>Dùng cho ngày được đánh dấu Lễ/Tết trong chấm công</Text></View>
                </Pressable>
                {workerForm.holidayPayEnabled ? (
                  <View style={styles.percentRow}><Text style={styles.percentLabel}>Tỷ lệ lương Lễ/Tết</Text><View style={styles.percentInputWrap}><TextInput value={String(workerForm.holidayPayPercent || 300)} onChangeText={(value) => setWorkerForm((form) => ({ ...form, holidayPayPercent: Number(value.replace(/\D/g, '')) || 300 }))} keyboardType="number-pad" style={styles.percentInput} /><Text style={styles.percentSuffix}>%</Text></View></View>
                ) : null}
              </View>

              <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void saveWorker()}>{saving ? <ActivityIndicator color="#172033" /> : <><Icon name="save" size={18} color="#172033" /><Text style={styles.primaryText}>{editingWorker ? 'Lưu thay đổi' : 'Lưu nhân sự'}</Text></>}</Pressable>
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
  guestAttendancePage: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingTop: 34 },
  guestBack: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }, guestBackText: { color: '#344054', fontSize: 13, fontWeight: '800' },
  guestKicker: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 }, guestTitle: { color: '#172033', fontSize: 28, lineHeight: 35, fontWeight: '900', marginTop: 8 }, guestDescription: { color: '#667085', fontSize: 14, lineHeight: 21, marginTop: 9 },
  guestAttendanceCard: { marginTop: 24, padding: 20, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC' }, guestDate: { color: '#344054', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }, guestTimeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 28 }, guestTimeLabel: { color: '#667085', fontSize: 11, fontWeight: '700', textAlign: 'center' }, guestTime: { color: '#172033', fontSize: 30, fontWeight: '900', marginTop: 5 },
  guestButtonRow: { flexDirection: 'row', gap: 10 }, guestCheckButton: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' }, guestCheckButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' }, guestCheckoutButton: { backgroundColor: '#FFF1E7', borderWidth: 1, borderColor: '#F4B17C' }, guestCheckoutText: { color: colors.brandOrangeText, fontSize: 13, fontWeight: '900' }, guestButtonDisabled: { opacity: 0.42 },
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
  dateNavigator: { minHeight: 64, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED', paddingHorizontal: 7 },
  holidayDayToggle: { minHeight: 54, marginTop: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#E7E9ED', backgroundColor: colors.white },
  holidayDayToggleActive: { borderColor: '#F59E0B', backgroundColor: '#FFF8E8' },
  holidayDayCopy: { flex: 1, marginLeft: 10 },
  holidayDayTitle: { color: '#344054', fontSize: 11, fontWeight: '900' },
  holidayDayText: { color: '#667085', fontSize: 9, lineHeight: 13, marginTop: 2 },
  dateArrow: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F2F4F7' },
  dateTitleButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  dateTitle: { color: '#172033', fontSize: 12, fontWeight: '900', textTransform: 'capitalize', textAlign: 'center' },
  dateHint: { color: colors.brandOrangeText, fontSize: 9, fontWeight: '700', marginTop: 4 },
  weekStrip: { gap: 6, paddingVertical: 10 },
  dayCell: { width: 46, height: 58, borderRadius: 10, borderWidth: 1, borderColor: '#E7E9ED', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dayCellActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  dayName: { color: '#667085', fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  dayNameActive: { color: '#172033' },
  dayNumber: { color: '#172033', fontSize: 15, fontWeight: '900', marginTop: 2 },
  dayNumberActive: { color: '#172033' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brandOrange, marginTop: 3 },
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
  specialPaySummary: { color: '#B45309', fontSize: 9, fontWeight: '800', marginTop: 4 },
  checkInButton: { minWidth: 76, minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#E5F7EF' },
  checkInText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  checkOutButton: { minWidth: 76, minHeight: 42, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFF0E5' },
  checkOutText: { color: colors.brandOrangeText, fontSize: 10, fontWeight: '900' },
  doneButton: { minWidth: 76, minHeight: 42, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF0F3' },
  doneText: { color: '#475467', fontSize: 10, fontWeight: '800' },
  lockedButton: { minWidth: 76, minHeight: 42, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF0F3' },
  futureButton: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E7E9ED' },
  lockedText: { color: '#667085', fontSize: 9, fontWeight: '800' },
  workerActions: { flexDirection: 'row', gap: 6, marginLeft: 7 },
  editWorkerButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  deleteWorkerButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#FEF3F2', alignItems: 'center', justifyContent: 'center' },
  payrollRow: { padding: 13, marginBottom: 9, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  payrollHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  payrollTotal: { color: '#C54E09', fontSize: 14, fontWeight: '900' },
  payBreakdown: { marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EEF0F3', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  breakdownText: { color: '#667085', fontSize: 9, fontWeight: '600' },
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
  specialRuleSection: { marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E7E9ED' },
  specialRuleHeading: { color: '#172033', fontSize: 13, fontWeight: '900' },
  specialRuleHint: { color: '#667085', fontSize: 9, lineHeight: 13, marginTop: 3, marginBottom: 8 },
  specialRuleRow: { minHeight: 58, marginTop: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white },
  specialRuleRowActive: { borderColor: '#FF9A3C', backgroundColor: '#FFF8F1' },
  specialRuleCopy: { flex: 1, marginLeft: 10 },
  specialRuleTitle: { color: '#344054', fontSize: 11, fontWeight: '900' },
  specialRuleText: { color: '#667085', fontSize: 9, lineHeight: 13, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxActive: { borderColor: '#F97316', backgroundColor: '#F97316' },
  percentRow: { minHeight: 52, paddingLeft: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  percentLabel: { flex: 1, color: '#475467', fontSize: 10, fontWeight: '700' },
  percentInputWrap: { position: 'relative', width: 92, height: 40, justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white, overflow: 'hidden' },
  percentInput: { width: '100%', height: 40, paddingLeft: 10, paddingRight: 28, color: '#172033', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  percentSuffix: { position: 'absolute', right: 10, color: '#667085', fontSize: 11, fontWeight: '800' },
  primaryButton: { minHeight: 50, marginTop: 20, borderRadius: 11, backgroundColor: '#FF9A3C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#172033', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
