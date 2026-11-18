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
  CreateWorkshopPieceJobInput,
  CreateWorkshopWorkerInput,
  WorkshopAttendance,
  WorkshopAttendanceStatus,
  WorkshopPayrollMonth,
  WorkshopPayType,
  WorkshopPieceJob,
  WorkshopWorkdaySetting,
  WorkshopWorker,
} from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon, type IconName } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { confirmAction } from '../src/lib/alert';
import { useAuth } from '../src/lib/auth';
import { getInstallationIdentity } from '../src/lib/installationIdentity';
import { listGuestAttendance, recordGuestAttendance, type GuestAttendanceRecord } from '../src/lib/localGuestAttendance';
import { formatVndInput, parseVndInput } from '../src/lib/vndCurrency';
import {
  STATUS_LABEL,
  canMarkDay,
  daySummary,
  leaveLeft,
  monthLabel,
  moveMonth,
  segmentOf,
  splitEvenly,
} from '../src/lib/workforceState';

type ScreenTab = 'today' | 'jobs' | 'workers' | 'payroll';
type ProjectOption = { id: string; name: string; code: string; status: string };

const TABS: Array<[ScreenTab, string]> = [
  ['today', 'Hôm nay'],
  ['jobs', 'Việc khoán'],
  ['workers', 'Thợ'],
  ['payroll', 'Lương'],
];

const payTypeLabel: Record<WorkshopPayType, string> = {
  DAILY: 'Theo ngày',
  HOURLY: 'Theo giờ',
  MONTHLY: 'Theo tháng',
};

const OFF_OPTIONS: Array<{ status: WorkshopAttendanceStatus; title: string; hint: string; icon: IconName; color: string }> = [
  { status: 'LEAVE', title: 'Nghỉ phép có lương', hint: 'Tính công, trừ vào ngày phép của tháng', icon: 'calendar', color: '#B54708' },
  { status: 'UNPAID_LEAVE', title: 'Nghỉ không lương', hint: 'Có báo trước, không tính công', icon: 'calendar', color: '#667085' },
  { status: 'ABSENT', title: 'Vắng không báo', hint: 'Không tính công, ghi vào phiếu lương', icon: 'user-x', color: '#DC2626' },
];

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
    insuranceEnabled: false,
    insuranceSalary: 0,
    paidLeaveDaysPerMonth: 1,
  };
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

function hours(value: number): string {
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDate(): string {
  return dateKey(new Date());
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function moveDate(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function displayDate(value: string): string {
  return dateFromKey(value).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function shortDate(value: string): string {
  const [, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}`;
}

function clock(value?: string | null): string {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  const letters = name.trim().split(/\s+/).map((part) => part.match(/[A-Za-zÀ-ỹ]/)?.[0]).filter((letter): letter is string => Boolean(letter));
  if (!letters.length) return '?';
  return `${letters.length > 1 ? letters[0] : ''}${letters[letters.length - 1]}`.toUpperCase();
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
  const today = localDate();
  const [tab, setTab] = useState<ScreenTab>('today');
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [workers, setWorkers] = useState<WorkshopWorker[]>([]);
  const [attendance, setAttendance] = useState<WorkshopAttendance[]>([]);
  const [dayMonth, setDayMonth] = useState<WorkshopPayrollMonth | null>(null);
  const [payroll, setPayroll] = useState<WorkshopPayrollMonth | null>(null);
  const [jobs, setJobs] = useState<WorkshopPieceJob[]>([]);
  const [workdaySetting, setWorkdaySetting] = useState<WorkshopWorkdaySetting>({ date: today, isHoliday: false, label: 'Lễ/Tết' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [offWorker, setOffWorker] = useState<WorkshopWorker | null>(null);
  const [detailWorker, setDetailWorker] = useState<WorkshopWorker | null>(null);
  const [overtimeValue, setOvertimeValue] = useState('0');
  const [workerModal, setWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkshopWorker | null>(null);
  const [workerForm, setWorkerForm] = useState<CreateWorkshopWorkerInput>(emptyWorkerForm);
  const [jobModal, setJobModal] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      if (tab === 'today') {
        const [workerRows, attendanceRows, daySetting, monthRows] = await Promise.all([
          api.get<WorkshopWorker[]>('/workforce/workers'),
          api.get<WorkshopAttendance[]>(`/workforce/attendance?date=${selectedDate}`),
          api.get<WorkshopWorkdaySetting>(`/workforce/attendance/day-setting?date=${selectedDate}`),
          api.get<WorkshopPayrollMonth>(`/workforce/payroll?month=${selectedDate.slice(0, 7)}`),
        ]);
        setWorkers(workerRows);
        setAttendance(attendanceRows);
        setWorkdaySetting(daySetting);
        setDayMonth(monthRows);
      } else if (tab === 'jobs') {
        const [workerRows, jobRows, monthRows] = await Promise.all([
          api.get<WorkshopWorker[]>('/workforce/workers'),
          api.get<WorkshopPieceJob[]>(`/workforce/piece-jobs?month=${month}`),
          api.get<WorkshopPayrollMonth>(`/workforce/payroll?month=${month}`),
        ]);
        setWorkers(workerRows);
        setJobs(jobRows);
        setPayroll(monthRows);
      } else if (tab === 'workers') {
        setWorkers(await api.get<WorkshopWorker[]>('/workforce/workers'));
      } else {
        setPayroll(await api.get<WorkshopPayrollMonth>(`/workforce/payroll?month=${month}`));
      }
    } catch (loadError) {
      setError(errorText(loadError, 'Không tải được dữ liệu xưởng.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, selectedDate, month]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const attendanceByWorker = useMemo(() => new Map(attendance.map((row) => [row.workerId, row])), [attendance]);
  const leaveUsed = useMemo(() => new Map((dayMonth?.rows ?? []).map((row) => [row.worker.id, row.payslip.paidLeaveDays])), [dayMonth]);
  const summary = daySummary(attendance.map((row) => ({ status: row.status, overtimeHours: row.overtimeHours })));
  const dayRule = canMarkDay(selectedDate, today, Boolean(dayMonth?.closed));
  const unmarked = workers.filter((worker) => !attendanceByWorker.has(worker.id)).length;

  async function run(action: () => Promise<unknown>, failTitle: string) {
    setSaving(true);
    try {
      await action();
      await load(true);
      return true;
    } catch (actionError) {
      Alert.alert(failTitle, errorText(actionError, 'Vui lòng thử lại.'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const setStatus = (workerId: string, status: WorkshopAttendanceStatus) =>
    run(() => api.post('/workforce/attendance/day-status', { workerId, date: selectedDate, status }), 'Chưa chấm được công');

  const markAll = () => run(() => api.post('/workforce/attendance/mark-all', { date: selectedDate }), 'Chưa chấm được cả đội');

  const toggleHoliday = () => run(
    () => api.patch(`/workforce/attendance/day-setting/${selectedDate}`, { isHoliday: !workdaySetting.isHoliday, label: 'Lễ/Tết' }),
    'Chưa đổi được loại ngày',
  );

  function openDetail(worker: WorkshopWorker) {
    const row = attendanceByWorker.get(worker.id);
    setOvertimeValue(row ? String(row.overtimeHours) : '0');
    setDetailWorker(worker);
  }

  async function clockAction(action: 'CHECK_IN' | 'CHECK_OUT') {
    if (!detailWorker) return;
    const ok = await run(() => api.post('/workforce/attendance/check', { workerId: detailWorker.id, action }), action === 'CHECK_IN' ? 'Chưa chấm giờ vào' : 'Chưa chấm giờ ra');
    if (ok) setDetailWorker(null);
  }

  async function saveOvertime() {
    const row = detailWorker ? attendanceByWorker.get(detailWorker.id) : undefined;
    if (!row) return;
    const ok = await run(() => api.patch(`/workforce/attendance/${row.id}`, { overtimeHours: Number(overtimeValue.replace(',', '.')) || 0 }), 'Chưa lưu được giờ tăng ca');
    if (ok) setDetailWorker(null);
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
      insuranceEnabled: worker.insuranceEnabled,
      insuranceSalary: worker.insuranceSalary,
      paidLeaveDaysPerMonth: worker.paidLeaveDaysPerMonth,
    });
    setWorkerModal(true);
  }

  async function saveWorker() {
    if (!workerForm.name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thợ.');
      return;
    }
    if (workerForm.insuranceEnabled && !workerForm.insuranceSalary) {
      Alert.alert('Thiếu thông tin', 'Nhập mức lương đóng bảo hiểm cho thợ có đóng BH.');
      return;
    }
    const ok = await run(
      () => (editingWorker ? api.patch(`/workforce/workers/${editingWorker.id}`, workerForm) : api.post('/workforce/workers', workerForm)),
      editingWorker ? 'Chưa cập nhật được thợ' : 'Chưa thêm được thợ',
    );
    if (ok) {
      setWorkerModal(false);
      setEditingWorker(null);
    }
  }

  function deleteWorker(worker: WorkshopWorker) {
    confirmAction('Ngừng theo dõi thợ', `Ẩn ${worker.name} khỏi danh sách đang làm? Lịch sử chấm công và phiếu lương vẫn được giữ.`, async () => {
      await run(() => api.delete(`/workforce/workers/${worker.id}`), 'Chưa xoá được thợ');
    });
  }

  function deleteJob(job: WorkshopPieceJob) {
    confirmAction('Xoá việc khoán', `Xoá "${job.title}" (${money(job.totalAmount)})? Khoản khoán sẽ bị bỏ khỏi lương tháng.`, async () => {
      await run(() => api.delete(`/workforce/piece-jobs/${job.id}`), 'Chưa xoá được việc khoán');
    });
  }

  function closeMonth() {
    if (!payroll) return;
    confirmAction(
      `Chốt lương tháng ${monthLabel(payroll.month)}`,
      `Tổng thực lĩnh ${money(payroll.totals.net)} cho ${payroll.totals.workers} thợ. Sau khi chốt, chấm công, việc khoán và tạm ứng của tháng này bị khoá.`,
      async () => { await run(() => api.post(`/workforce/payroll/${payroll.month}/close`, {}), 'Chưa chốt được lương'); },
    );
  }

  function reopenMonth() {
    if (!payroll) return;
    confirmAction(`Mở lại tháng ${monthLabel(payroll.month)}`, 'Mở lại để sửa chấm công hoặc các khoản. Nhớ chốt lại sau khi sửa.', async () => {
      await run(() => api.post(`/workforce/payroll/${payroll.month}/reopen`, {}), 'Chưa mở lại được tháng');
    });
  }

  const offRow = offWorker ? attendanceByWorker.get(offWorker.id) : undefined;
  const offLeft = offWorker ? leaveLeft(offWorker.paidLeaveDaysPerMonth, leaveUsed.get(offWorker.id) ?? 0) : 0;
  const detailRow = detailWorker ? attendanceByWorker.get(detailWorker.id) : undefined;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityLabel="Quay lại" style={styles.iconButton} onPress={() => router.back()}><Icon name="arrow-left" size={20} color="#1D2939" /></Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Quản lý xưởng</Text>
            <Text style={styles.headerSubtitle}>{workers.length ? `${workers.length} thợ đang làm` : 'Chấm công, việc khoán và lương'}</Text>
          </View>
        </View>
        <View style={styles.tabs}>
          {TABS.map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} style={[styles.tab, tab === value && styles.tabActive]} onPress={() => setTab(value)}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandOrange} />}
      >
        {error ? <Pressable style={styles.error} onPress={() => void load(true)}><Icon name="alert-circle" size={18} color="#B42318" /><Text style={styles.errorText}>{error} · Bấm để thử lại</Text></Pressable> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brandOrange} /><Text style={styles.muted}>Đang tải...</Text></View> : null}

        {!loading && tab === 'today' ? (
          <View>
            <View style={styles.dateBar}>
              <Pressable accessibilityLabel="Ngày trước" style={styles.iconButton} onPress={() => setSelectedDate((current) => moveDate(current, -1))}><Icon name="chevron-left" size={19} color="#344054" /></Pressable>
              <Pressable style={styles.dateCenter} onPress={() => setSelectedDate(today)}>
                <Text style={styles.dateTitle}>{displayDate(selectedDate)}</Text>
                <Text style={[styles.dateHint, !dayRule.editable && styles.dateHintLocked]}>
                  {dayRule.editable
                    ? selectedDate === today ? `Tháng ${monthLabel(selectedDate.slice(0, 7))} chưa chốt lương · sửa được` : 'Ngày đã qua · vẫn sửa được · bấm để về hôm nay'
                    : dayRule.reason}
                </Text>
              </Pressable>
              <Pressable accessibilityLabel="Ngày sau" disabled={selectedDate >= today} style={[styles.iconButton, selectedDate >= today && styles.disabled]} onPress={() => setSelectedDate((current) => moveDate(current, 1))}><Icon name="chevron-right" size={19} color="#344054" /></Pressable>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryBox value={String(summary.full)} label="Đủ công" />
              <SummaryBox value={String(summary.half)} label="Nửa công" />
              <SummaryBox value={String(summary.off)} label="Nghỉ" />
              <SummaryBox value={`${hours(summary.overtimeHours)} g`} label="Tăng ca" />
            </View>

            <View style={styles.dayActions}>
              <Pressable
                disabled={!dayRule.editable || saving || unmarked === 0}
                style={[styles.bulkButton, (!dayRule.editable || unmarked === 0) && styles.bulkButtonDone]}
                onPress={() => void markAll()}
              >
                <Icon name="user-check" size={16} color={dayRule.editable && unmarked ? colors.brandOrangeText : '#667085'} />
                <Text style={[styles.bulkText, (!dayRule.editable || unmarked === 0) && styles.bulkTextDone]}>
                  {unmarked === 0 && workers.length ? 'Đã chấm đủ cả đội' : `Cả đội đủ công${unmarked && unmarked < workers.length ? ` (${unmarked} người còn lại)` : ''}`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: workdaySetting.isHoliday }}
                disabled={!dayRule.editable || saving}
                style={[styles.holidayChip, workdaySetting.isHoliday && styles.holidayChipOn]}
                onPress={() => void toggleHoliday()}
              >
                <Text style={[styles.holidayText, workdaySetting.isHoliday && styles.holidayTextOn]}>{workdaySetting.isHoliday ? 'Ngày lễ ✓' : 'Ngày lễ?'}</Text>
              </Pressable>
            </View>

            {workers.length === 0 ? (
              <Pressable style={styles.empty} onPress={() => { setTab('workers'); openCreateWorker(); }}>
                <Icon name="users" size={28} color="#98A2B3" />
                <Text style={styles.emptyTitle}>Chưa có thợ nào</Text>
                <Text style={styles.emptyText}>Thêm thợ đầu tiên để bắt đầu chấm công.</Text>
              </Pressable>
            ) : (
              <View style={styles.listCard}>
                {workers.map((worker, index) => {
                  const row = attendanceByWorker.get(worker.id);
                  const segment = segmentOf(row?.status);
                  const left = leaveLeft(worker.paidLeaveDaysPerMonth, leaveUsed.get(worker.id) ?? 0);
                  let sub = worker.roleName;
                  if (row?.status === 'PRESENT' || row?.status === 'HALF') {
                    sub = row.checkInAt ? `${clock(row.checkInAt)} – ${row.checkOutAt ? clock(row.checkOutAt) : 'đang làm'}` : STATUS_LABEL[row.status];
                  } else if (row) {
                    sub = row.status === 'LEAVE' ? `Nghỉ phép · còn ${left} ngày` : STATUS_LABEL[row.status];
                  }
                  return (
                    <View key={worker.id} style={[styles.workerRow, index > 0 && styles.rowDivider]}>
                      <Pressable style={styles.workerTap} onPress={() => openDetail(worker)} accessibilityLabel={`Chi tiết ngày công của ${worker.name}`}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View>
                        <View style={styles.personCopy}>
                          <Text numberOfLines={1} style={styles.personName}>{worker.name}</Text>
                          <Text numberOfLines={1} style={styles.personSub}>
                            {sub}{row?.overtimeHours ? <Text style={styles.overtime}> · +{hours(row.overtimeHours)} g</Text> : null}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={[styles.segment, !dayRule.editable && styles.disabled]}>
                        <Pressable disabled={!dayRule.editable || saving} style={[styles.segmentButton, segment === 'FULL' && styles.segmentFull]} onPress={() => void setStatus(worker.id, 'PRESENT')}>
                          <Text style={[styles.segmentText, segment === 'FULL' && styles.segmentTextOn]}>Đủ</Text>
                        </Pressable>
                        <Pressable disabled={!dayRule.editable || saving} style={[styles.segmentButton, styles.segmentBorder, segment === 'HALF' && styles.segmentHalf]} onPress={() => void setStatus(worker.id, 'HALF')}>
                          <Text style={[styles.segmentText, segment === 'HALF' && styles.segmentTextOn]}>½</Text>
                        </Pressable>
                        <Pressable disabled={!dayRule.editable || saving} style={[styles.segmentButton, styles.segmentBorder, styles.segmentWide, segment === 'OFF' && (row?.status === 'ABSENT' ? styles.segmentAbsent : row?.status === 'LEAVE' ? styles.segmentLeave : styles.segmentUnpaid)]} onPress={() => setOffWorker(worker)}>
                          <Text style={[styles.segmentText, segment === 'OFF' && styles.segmentTextOn]}>
                            {row?.status === 'LEAVE' ? 'Phép' : row?.status === 'UNPAID_LEAVE' ? 'K.lương' : row?.status === 'ABSENT' ? 'Vắng' : 'Nghỉ'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {workers.length ? <Text style={styles.footHint}>Bấm vào tên thợ để chấm giờ vào/ra hoặc sửa giờ tăng ca.</Text> : null}
          </View>
        ) : null}

        {!loading && tab === 'jobs' ? (
          <View>
            <MonthBar month={month} today={today} onChange={setMonth} closed={Boolean(payroll?.closed)} />
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Việc khoán tháng {monthLabel(month)}</Text>
                <Text style={styles.sectionSub}>{jobs.length} việc · {money(jobs.reduce((sum, job) => sum + job.totalAmount, 0))}</Text>
              </View>
              {!payroll?.closed && month <= today.slice(0, 7) ? (
                <Pressable style={styles.inlineAdd} onPress={() => setJobModal(true)}><Icon name="plus" size={16} color={colors.brandOrangeText} /><Text style={styles.inlineAddText}>Việc khoán</Text></Pressable>
              ) : null}
            </View>
            {jobs.length === 0 ? (
              <View style={styles.empty}>
                <Icon name="briefcase" size={28} color="#98A2B3" />
                <Text style={styles.emptyTitle}>Chưa có việc khoán</Text>
                <Text style={styles.emptyText}>Ghi việc khoán theo công trình, chia cho một hoặc nhiều thợ. Tiền khoán tự cộng vào lương tháng.</Text>
              </View>
            ) : jobs.map((job) => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobHead}>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.personName}>{job.title}</Text>
                    <Text style={styles.personSub}>{[job.projectName, shortDate(job.workDate)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={styles.jobTotal}>{money(job.totalAmount)}</Text>
                </View>
                <View style={styles.shareList}>
                  {job.shares.map((share) => (
                    <View key={share.workerId} style={styles.sharePill}><Text style={styles.shareText}>{share.workerName} · {money(share.amount)}</Text></View>
                  ))}
                </View>
                {!payroll?.closed ? (
                  <Pressable style={styles.jobDelete} onPress={() => deleteJob(job)} accessibilityLabel={`Xoá việc khoán ${job.title}`}><Icon name="trash-2" size={15} color="#B42318" /><Text style={styles.jobDeleteText}>Xoá</Text></Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {!loading && tab === 'workers' ? (
          <View>
            <View style={styles.sectionHead}>
              <View style={styles.sectionCopy}><Text style={styles.sectionTitle}>Danh sách thợ</Text><Text style={styles.sectionSub}>{workers.length} người đang làm</Text></View>
              <Pressable style={styles.inlineAdd} onPress={openCreateWorker}><Icon name="plus" size={16} color={colors.brandOrangeText} /><Text style={styles.inlineAddText}>Thêm thợ</Text></Pressable>
            </View>
            {workers.length === 0 ? (
              <Pressable style={styles.empty} onPress={openCreateWorker}><Icon name="users" size={28} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có thợ nào</Text><Text style={styles.emptyText}>Thêm thợ với mức lương, bảo hiểm và ngày phép để tính lương tự động.</Text></Pressable>
            ) : (
              <View style={styles.listCard}>
                {workers.map((worker, index) => (
                  <View key={worker.id} style={[styles.workerRow, index > 0 && styles.rowDivider]}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(worker.name)}</Text></View>
                    <View style={styles.personCopy}>
                      <Text numberOfLines={1} style={styles.personName}>{worker.name}</Text>
                      <Text numberOfLines={1} style={styles.personSub}>{worker.roleName} · {payTypeLabel[worker.payType]} {money(worker.baseRate)}</Text>
                      <Text numberOfLines={1} style={styles.workerTags}>
                        {[
                          worker.insuranceEnabled ? `BH trên ${money(worker.insuranceSalary)}` : 'Không đóng BH',
                          `${worker.paidLeaveDaysPerMonth} ngày phép/tháng`,
                          worker.sundayPayEnabled ? `CN ${worker.sundayPayPercent}%` : '',
                          worker.holidayPayEnabled ? `Lễ ${worker.holidayPayPercent}%` : '',
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable accessibilityLabel={`Sửa ${worker.name}`} style={styles.smallIcon} onPress={() => openEditWorker(worker)}><Icon name="edit-2" size={16} color="#475467" /></Pressable>
                    <Pressable accessibilityLabel={`Ẩn ${worker.name}`} style={[styles.smallIcon, styles.smallIconDanger]} onPress={() => deleteWorker(worker)}><Icon name="trash-2" size={16} color="#B42318" /></Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {!loading && tab === 'payroll' && payroll ? (
          <View>
            <MonthBar month={month} today={today} onChange={setMonth} closed={payroll.closed} />
            <View style={styles.summaryGrid}>
              <SummaryBox value={money(payroll.totals.net)} label="Tổng thực lĩnh" wide />
              <SummaryBox value={money(payroll.totals.advances)} label="Đã tạm ứng" wide />
            </View>
            {payroll.totals.insuranceEmployer ? <Text style={styles.footHint}>Xưởng đóng BH 21,5%: {money(payroll.totals.insuranceEmployer)} (chi phí xưởng, không trừ lương thợ).</Text> : null}
            {payroll.rows.length === 0 ? (
              <View style={styles.empty}><Icon name="dollar-sign" size={28} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có dữ liệu lương</Text><Text style={styles.emptyText}>Chấm công ở tab Hôm nay, lương sẽ tự tính.</Text></View>
            ) : (
              <View style={[styles.listCard, { marginTop: 10 }]}>
                {payroll.rows.map((row, index) => (
                  <Pressable key={row.worker.id} style={[styles.workerRow, index > 0 && styles.rowDivider]} onPress={() => router.push({ pathname: '/payslip/[workerId]', params: { workerId: row.worker.id, month: payroll.month } })}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.worker.name)}</Text></View>
                    <View style={styles.personCopy}>
                      <Text numberOfLines={1} style={styles.personName}>{row.worker.name}</Text>
                      <Text numberOfLines={1} style={styles.personSub}>
                        {hours(row.payslip.workUnits)} công{row.payslip.overtimeHours ? ` · TC ${hours(row.payslip.overtimeHours)} g` : ''}{row.payslip.pieceTotal ? ' · có khoán' : ''}{row.payslip.advanceTotal ? ` · ứng ${money(row.payslip.advanceTotal)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.netCol}>
                      <Text style={[styles.netValue, row.payslip.net < 0 && styles.netNegative]}>{money(row.payslip.net)}</Text>
                      <Text style={styles.netLabel}>thực lĩnh</Text>
                    </View>
                    <Icon name="chevron-right" size={18} color="#98A2B3" />
                  </Pressable>
                ))}
              </View>
            )}
            {payroll.closed ? (
              <Pressable disabled={saving} style={styles.secondaryButton} onPress={reopenMonth}><Icon name="lock" size={16} color="#344054" /><Text style={styles.secondaryText}>Đã chốt {payroll.closedAt ? shortDate(payroll.closedAt.slice(0, 10)) : ''} · Mở lại tháng</Text></Pressable>
            ) : month < today.slice(0, 7) ? (
              <Pressable disabled={saving || !payroll.rows.length} style={[styles.primaryButton, !payroll.rows.length && styles.disabled]} onPress={closeMonth}><Icon name="check-circle" size={18} color={colors.white} /><Text style={styles.primaryText}>Chốt lương tháng {monthLabel(month)}</Text></Pressable>
            ) : (
              <Text style={styles.footHint}>Lương tháng {monthLabel(month)} đang tạm tính. Chốt lương sau khi hết tháng.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Chọn loại nghỉ */}
      <Modal visible={!!offWorker} transparent animationType="slide" onRequestClose={() => setOffWorker(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOffWorker(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{offWorker?.name} nghỉ ngày {shortDate(selectedDate)}</Text>
            {OFF_OPTIONS.map((option) => {
              const active = offRow?.status === option.status;
              const hint = option.status === 'LEAVE'
                ? offLeft > 0 || active ? `Còn ${offLeft} ngày phép có lương trong tháng` : 'Hết phép tháng này: tính là nghỉ không lương'
                : option.hint;
              return (
                <Pressable
                  key={option.status}
                  disabled={saving}
                  style={styles.optionRow}
                  onPress={async () => {
                    if (!offWorker) return;
                    const ok = await setStatus(offWorker.id, option.status);
                    if (ok) setOffWorker(null);
                  }}
                >
                  <Icon name={option.icon} size={20} color={option.color} />
                  <View style={styles.optionCopy}><Text style={styles.optionTitle}>{option.title}</Text><Text style={styles.optionHint}>{hint}</Text></View>
                  {active ? <Icon name="check" size={18} color={colors.brandOrange} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Chi tiết ngày công của một thợ */}
      <Modal visible={!!detailWorker} transparent animationType="slide" onRequestClose={() => setDetailWorker(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sheetTitle}>{detailWorker?.name}</Text>
                <Text style={styles.sheetSub}>{displayDate(selectedDate)} · {detailRow ? STATUS_LABEL[detailRow.status] : 'Chưa chấm'}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setDetailWorker(null)}><Icon name="x" size={20} color="#475467" /></Pressable>
            </View>
            {selectedDate === today && dayRule.editable ? (
              <View style={styles.clockRow}>
                <Pressable disabled={saving || Boolean(detailRow?.checkInAt)} style={[styles.clockButton, Boolean(detailRow?.checkInAt) && styles.disabled]} onPress={() => void clockAction('CHECK_IN')}>
                  <Text style={styles.clockLabel}>Giờ vào</Text><Text style={styles.clockValue}>{clock(detailRow?.checkInAt)}</Text>
                </Pressable>
                <Pressable disabled={saving || !detailRow?.checkInAt || Boolean(detailRow?.checkOutAt)} style={[styles.clockButton, (!detailRow?.checkInAt || detailRow?.checkOutAt) && styles.disabled]} onPress={() => void clockAction('CHECK_OUT')}>
                  <Text style={styles.clockLabel}>Giờ ra</Text><Text style={styles.clockValue}>{clock(detailRow?.checkOutAt)}</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.sheetNote}>{detailRow?.checkInAt ? `Vào ${clock(detailRow.checkInAt)} · Ra ${clock(detailRow.checkOutAt)}` : 'Giờ vào/ra chỉ chấm trong ngày hôm nay.'}</Text>
            )}
            <Text style={styles.label}>Giờ tăng ca</Text>
            <TextInput
              editable={Boolean(detailRow) && dayRule.editable}
              value={overtimeValue}
              onChangeText={setOvertimeValue}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#98A2B3"
              style={[styles.input, (!detailRow || !dayRule.editable) && styles.inputDisabled]}
            />
            <Text style={styles.sheetNote}>{detailRow ? 'Chấm ra sau 8 giờ làm thì tăng ca tự tính; sửa ở đây nếu cần.' : 'Chấm trạng thái ngày công trước khi nhập tăng ca.'}</Text>
            <Pressable disabled={saving || !detailRow || !dayRule.editable} style={[styles.primaryButton, (!detailRow || !dayRule.editable) && styles.disabled]} onPress={() => void saveOvertime()}>
              <Icon name="save" size={18} color={colors.white} /><Text style={styles.primaryText}>Lưu giờ tăng ca</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <WorkerModal
        visible={workerModal}
        editing={Boolean(editingWorker)}
        form={workerForm}
        saving={saving}
        onChange={setWorkerForm}
        onClose={() => { setWorkerModal(false); setEditingWorker(null); }}
        onSave={() => void saveWorker()}
      />

      <PieceJobModal
        visible={jobModal}
        month={month}
        today={today}
        workers={workers}
        onClose={() => setJobModal(false)}
        onSaved={() => { setJobModal(false); void load(true); }}
      />
    </View>
  );
}

function SummaryBox({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  return (
    <View style={[styles.summaryBox, wide && styles.summaryBoxWide]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue, wide && styles.summaryValueWide]}>{value}</Text>
      <Text numberOfLines={1} style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MonthBar({ month, today, closed, onChange }: { month: string; today: string; closed: boolean; onChange: (month: string) => void }) {
  const current = today.slice(0, 7);
  return (
    <View style={styles.dateBar}>
      <Pressable accessibilityLabel="Tháng trước" style={styles.iconButton} onPress={() => onChange(moveMonth(month, -1))}><Icon name="chevron-left" size={19} color="#344054" /></Pressable>
      <Pressable style={styles.dateCenter} onPress={() => onChange(current)}>
        <Text style={styles.dateTitle}>Tháng {monthLabel(month)}</Text>
        <Text style={[styles.dateHint, closed && styles.dateHintLocked]}>{closed ? 'Đã chốt lương · chỉ xem' : month === current ? 'Tháng hiện tại · đang tạm tính' : 'Chưa chốt lương'}</Text>
      </Pressable>
      <Pressable accessibilityLabel="Tháng sau" disabled={month >= current} style={[styles.iconButton, month >= current && styles.disabled]} onPress={() => onChange(moveMonth(month, 1))}><Icon name="chevron-right" size={19} color="#344054" /></Pressable>
    </View>
  );
}

function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (value: number) => void; placeholder?: string }) {
  return (
    <TextInput
      value={value ? formatVndInput(value) : ''}
      onChangeText={(text) => onChange(parseVndInput(text))}
      placeholder={placeholder ?? 'VNĐ'}
      placeholderTextColor="#98A2B3"
      keyboardType="number-pad"
      style={styles.input}
    />
  );
}

function WorkerModal({ visible, editing, form, saving, onChange, onClose, onSave }: {
  visible: boolean;
  editing: boolean;
  form: CreateWorkshopWorkerInput;
  saving: boolean;
  onChange: (updater: (form: CreateWorkshopWorkerInput) => CreateWorkshopWorkerInput) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof CreateWorkshopWorkerInput>(key: K, value: CreateWorkshopWorkerInput[K]) => onChange((current) => ({ ...current, [key]: value }));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, styles.sheetTall]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sectionCopy}><Text style={styles.sheetTitle}>{editing ? 'Sửa thông tin thợ' : 'Thêm thợ'}</Text><Text style={styles.sheetSub}>Dùng để tính công, bảo hiểm và lương</Text></View>
            <Pressable style={styles.closeButton} onPress={onClose}><Icon name="x" size={20} color="#475467" /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Họ và tên</Text>
            <TextInput value={form.name} onChangeText={(name) => set('name', name)} placeholder="Ví dụ: Nguyễn Văn Hùng" placeholderTextColor="#98A2B3" style={styles.input} />
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}><Text style={styles.label}>Số điện thoại</Text><TextInput value={form.phone} onChangeText={(phone) => set('phone', phone)} placeholder="Không bắt buộc" placeholderTextColor="#98A2B3" keyboardType="phone-pad" style={styles.input} /></View>
              <View style={styles.fieldHalf}><Text style={styles.label}>Công việc</Text><TextInput value={form.roleName} onChangeText={(roleName) => set('roleName', roleName)} placeholder="Thợ sản xuất" placeholderTextColor="#98A2B3" style={styles.input} /></View>
            </View>
            <Text style={styles.label}>Hình thức lương</Text>
            <View style={styles.choiceRow}>
              {(['DAILY', 'MONTHLY', 'HOURLY'] as WorkshopPayType[]).map((payType) => (
                <Pressable key={payType} style={[styles.choice, form.payType === payType && styles.choiceOn]} onPress={() => set('payType', payType)}>
                  <Text style={[styles.choiceText, form.payType === payType && styles.choiceTextOn]}>{payTypeLabel[payType]}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}><Text style={styles.label}>{form.payType === 'DAILY' ? 'Lương một ngày' : form.payType === 'HOURLY' ? 'Lương một giờ' : 'Lương tháng'}</Text><MoneyInput value={form.baseRate} onChange={(value) => set('baseRate', value)} /></View>
              <View style={styles.fieldHalf}><Text style={styles.label}>Tăng ca mỗi giờ</Text><MoneyInput value={form.overtimeRate ?? 0} onChange={(value) => set('overtimeRate', value)} placeholder="Tự tính ×1,5" /></View>
            </View>
            <View style={styles.fieldRow}>
              {form.payType === 'MONTHLY' ? (
                <View style={styles.fieldHalf}><Text style={styles.label}>Công chuẩn / tháng</Text><TextInput value={String(form.standardMonthlyDays || 26)} onChangeText={(value) => set('standardMonthlyDays', Number(value.replace(/\D/g, '')) || 26)} keyboardType="number-pad" style={styles.input} /></View>
              ) : null}
              <View style={styles.fieldHalf}><Text style={styles.label}>Ngày phép có lương / tháng</Text><TextInput value={String(form.paidLeaveDaysPerMonth ?? 1)} onChangeText={(value) => set('paidLeaveDaysPerMonth', Number(value.replace(/\D/g, '')) || 0)} keyboardType="number-pad" style={styles.input} /></View>
            </View>

            <View style={styles.ruleBox}>
              <ToggleRow label="Có đóng bảo hiểm" hint="Trừ 10,5% vào lương thợ; xưởng đóng thêm 21,5%" value={Boolean(form.insuranceEnabled)} onToggle={() => set('insuranceEnabled', !form.insuranceEnabled)} />
              {form.insuranceEnabled ? (<><Text style={styles.label}>Mức lương đóng bảo hiểm</Text><MoneyInput value={form.insuranceSalary ?? 0} onChange={(value) => set('insuranceSalary', value)} /></>) : null}
              <ToggleRow label="Tính thêm ngày Chủ nhật" hint="Tổng mức hưởng so với ngày thường" value={Boolean(form.sundayPayEnabled)} onToggle={() => set('sundayPayEnabled', !form.sundayPayEnabled)} />
              {form.sundayPayEnabled ? <PercentInput value={form.sundayPayPercent ?? 200} onChange={(value) => set('sundayPayPercent', value)} /> : null}
              <ToggleRow label="Tính thêm ngày Lễ/Tết" hint="Ngày được đánh dấu lễ ở tab Hôm nay" value={Boolean(form.holidayPayEnabled)} onToggle={() => set('holidayPayEnabled', !form.holidayPayEnabled)} />
              {form.holidayPayEnabled ? <PercentInput value={form.holidayPayPercent ?? 300} onChange={(value) => set('holidayPayPercent', value)} /> : null}
            </View>

            <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={onSave}>
              {saving ? <ActivityIndicator color={colors.white} /> : <><Icon name="save" size={18} color={colors.white} /><Text style={styles.primaryText}>{editing ? 'Lưu thay đổi' : 'Thêm thợ'}</Text></>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ToggleRow({ label, hint, value, onToggle }: { label: string; hint: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} style={styles.toggleRow} onPress={onToggle}>
      <View style={styles.sectionCopy}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.optionHint}>{hint}</Text></View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}><View style={[styles.switchThumb, value && styles.switchThumbOn]} /></View>
    </Pressable>
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.percentRow}>
      <Text style={styles.optionHint}>Tỷ lệ</Text>
      <View style={styles.percentWrap}>
        <TextInput value={String(value)} onChangeText={(text) => onChange(Number(text.replace(/\D/g, '')) || 0)} keyboardType="number-pad" style={styles.percentInput} />
        <Text style={styles.percentSuffix}>%</Text>
      </View>
    </View>
  );
}

function PieceJobModal({ visible, month, today, workers, onClose, onSaved }: {
  visible: boolean;
  month: string;
  today: string;
  workers: WorkshopWorker[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const defaultDate = month === today.slice(0, 7) ? today : `${month}-01`;
  const [title, setTitle] = useState('');
  const [workDate, setWorkDate] = useState(defaultDate);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setTitle('');
    setWorkDate(defaultDate);
    setTotal(0);
    setSelected([]);
    setManual(false);
    setShares({});
    setProjectId(undefined);
  }, [defaultDate]);

  async function onShow() {
    reset();
    try {
      const rows = await api.get<ProjectOption[]>('/workshop/v2/projects');
      setProjects(rows.filter((project) => project.status === 'IN_PROGRESS' || project.status === 'OPEN').slice(0, 12));
    } catch {
      setProjects([]);
    }
  }

  const even = splitEvenly(total, selected.length);
  const manualSum = selected.reduce((sum, id) => sum + (shares[id] ?? 0), 0);

  function toggleWorker(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function save() {
    if (!title.trim()) { Alert.alert('Thiếu thông tin', 'Nhập tên việc khoán.'); return; }
    if (!total) { Alert.alert('Thiếu thông tin', 'Nhập số tiền khoán.'); return; }
    if (!selected.length) { Alert.alert('Thiếu thông tin', 'Chọn ít nhất một thợ.'); return; }
    if (manual && manualSum !== total) { Alert.alert('Chưa khớp', `Tổng phần chia ${money(manualSum)} phải bằng ${money(total)}.`); return; }
    const body: CreateWorkshopPieceJobInput = {
      title: title.trim(),
      projectId,
      workDate,
      totalAmount: total,
      ...(manual ? { shares: selected.map((workerId) => ({ workerId, amount: shares[workerId] ?? 0 })) } : { workerIds: selected }),
    };
    setSaving(true);
    try {
      await api.post('/workforce/piece-jobs', body);
      onSaved();
    } catch (saveError) {
      Alert.alert('Chưa lưu được việc khoán', errorText(saveError, 'Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  const firstDay = `${month}-01`;
  const lastAllowed = month === today.slice(0, 7) ? today : moveDate(`${moveMonth(month, 1)}-01`, -1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => void onShow()}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, styles.sheetTall]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sectionCopy}><Text style={styles.sheetTitle}>Ghi việc khoán</Text><Text style={styles.sheetSub}>Cộng vào lương tháng {monthLabel(month)}</Text></View>
            <Pressable style={styles.closeButton} onPress={onClose}><Icon name="x" size={20} color="#475467" /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tên việc</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: Lắp cửa nhà chị Lan" placeholderTextColor="#98A2B3" style={styles.input} />
            <Text style={styles.label}>Công trình (không bắt buộc)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Pressable style={[styles.chip, !projectId && styles.chipOn]} onPress={() => setProjectId(undefined)}><Text style={[styles.chipText, !projectId && styles.chipTextOn]}>Không gắn</Text></Pressable>
              {projects.map((project) => (
                <Pressable key={project.id} style={[styles.chip, projectId === project.id && styles.chipOn]} onPress={() => setProjectId(project.id)}>
                  <Text numberOfLines={1} style={[styles.chipText, projectId === project.id && styles.chipTextOn]}>{project.name || project.code}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Ngày</Text>
                <View style={styles.stepper}>
                  <Pressable disabled={workDate <= firstDay} style={[styles.stepperButton, workDate <= firstDay && styles.disabled]} onPress={() => setWorkDate((value) => moveDate(value, -1))}><Icon name="chevron-left" size={16} color="#344054" /></Pressable>
                  <Text style={styles.stepperValue}>{shortDate(workDate)}</Text>
                  <Pressable disabled={workDate >= lastAllowed} style={[styles.stepperButton, workDate >= lastAllowed && styles.disabled]} onPress={() => setWorkDate((value) => moveDate(value, 1))}><Icon name="chevron-right" size={16} color="#344054" /></Pressable>
                </View>
              </View>
              <View style={styles.fieldHalf}><Text style={styles.label}>Tổng tiền khoán</Text><MoneyInput value={total} onChange={setTotal} /></View>
            </View>
            <Text style={styles.label}>Thợ nhận khoán</Text>
            <View style={styles.wrapRow}>
              {workers.map((worker) => {
                const on = selected.includes(worker.id);
                return (
                  <Pressable key={worker.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleWorker(worker.id)}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? '✓ ' : ''}{worker.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selected.length > 1 ? (
              <View style={[styles.choiceRow, { marginTop: 12 }]}>
                <Pressable style={[styles.choice, !manual && styles.choiceOn]} onPress={() => setManual(false)}><Text style={[styles.choiceText, !manual && styles.choiceTextOn]}>Chia đều</Text></Pressable>
                <Pressable style={[styles.choice, manual && styles.choiceOn]} onPress={() => setManual(true)}><Text style={[styles.choiceText, manual && styles.choiceTextOn]}>Tự nhập phần</Text></Pressable>
              </View>
            ) : null}
            {selected.length ? (
              <View style={styles.splitBox}>
                {selected.map((id, index) => {
                  const worker = workers.find((item) => item.id === id);
                  return (
                    <View key={id} style={styles.splitRow}>
                      <Text numberOfLines={1} style={styles.splitName}>{worker?.name}</Text>
                      {manual ? (
                        <View style={styles.splitInput}><MoneyInput value={shares[id] ?? 0} onChange={(value) => setShares((current) => ({ ...current, [id]: value }))} /></View>
                      ) : (
                        <Text style={styles.splitValue}>{money(even[index] ?? 0)}</Text>
                      )}
                    </View>
                  );
                })}
                {manual ? <Text style={[styles.optionHint, manualSum !== total && { color: '#B42318' }]}>Đã chia {money(manualSum)} / {money(total)}</Text> : null}
              </View>
            ) : null}
            <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()}>
              {saving ? <ActivityIndicator color={colors.white} /> : <><Icon name="save" size={18} color={colors.white} /><Text style={styles.primaryText}>Lưu việc khoán</Text></>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  guestAttendancePage: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingTop: 34 },
  guestBack: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }, guestBackText: { color: '#344054', fontSize: 13, fontWeight: '800' },
  guestKicker: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 }, guestTitle: { color: '#172033', fontSize: 28, lineHeight: 35, fontWeight: '900', marginTop: 8 }, guestDescription: { color: '#667085', fontSize: 14, lineHeight: 21, marginTop: 9 },
  guestAttendanceCard: { marginTop: 24, padding: 20, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC' }, guestDate: { color: '#344054', fontSize: 14, fontWeight: '900', textTransform: 'capitalize' }, guestTimeRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 28 }, guestTimeLabel: { color: '#667085', fontSize: 11, fontWeight: '700', textAlign: 'center' }, guestTime: { color: '#172033', fontSize: 30, fontWeight: '900', marginTop: 5 },
  guestButtonRow: { flexDirection: 'row', gap: 10 }, guestCheckButton: { flex: 1, minHeight: 50, borderRadius: 14, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' }, guestCheckButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' }, guestCheckoutButton: { backgroundColor: '#FFF1E7', borderWidth: 1, borderColor: '#F4B17C' }, guestCheckoutText: { color: colors.brandOrangeText, fontSize: 13, fontWeight: '900' }, guestButtonDisabled: { opacity: 0.42 },

  header: { paddingTop: Platform.OS === 'ios' ? 48 : 28, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E4E7EC' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#0A0A0A', fontSize: 19, lineHeight: 23, fontWeight: '900' },
  headerSubtitle: { color: '#667085', fontSize: 12, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 12, padding: 4, backgroundColor: '#F2F4F7', borderRadius: 12 },
  tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: colors.white, shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: '#667085', fontSize: 12.5, fontWeight: '700' },
  tabTextActive: { color: '#0A0A0A', fontWeight: '800' },
  content: { padding: 14, paddingBottom: 120 },

  error: { minHeight: 48, marginBottom: 10, borderRadius: 12, padding: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 17 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#667085', fontSize: 12 },

  dateBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateCenter: { flex: 1, alignItems: 'center', minWidth: 0 },
  dateTitle: { color: '#0A0A0A', fontSize: 14, fontWeight: '800', textTransform: 'capitalize', textAlign: 'center' },
  dateHint: { color: '#667085', fontSize: 11.5, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  dateHintLocked: { color: '#B54708' },

  summaryGrid: { flexDirection: 'row', gap: 6, marginTop: 10 },
  summaryBox: { flex: 1, minHeight: 52, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  summaryBoxWide: { paddingHorizontal: 10, alignItems: 'flex-start' },
  summaryValue: { color: '#0A0A0A', fontSize: 16, fontWeight: '900' },
  summaryValueWide: { fontSize: 17 },
  summaryLabel: { color: '#667085', fontSize: 10.5, fontWeight: '700', marginTop: 2 },

  dayActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  bulkButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#FED7AA', backgroundColor: '#FFF2E8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  bulkButtonDone: { borderStyle: 'solid', borderColor: '#E4E7EC', backgroundColor: '#F9FAFB' },
  bulkText: { color: colors.brandOrangeText, fontSize: 13, fontWeight: '800' },
  bulkTextDone: { color: '#667085' },
  holidayChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  holidayChipOn: { borderColor: '#FED7AA', backgroundColor: '#FFF2E8' },
  holidayText: { color: '#667085', fontSize: 12, fontWeight: '800' },
  holidayTextOn: { color: colors.brandOrangeText },

  listCard: { marginTop: 10, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden' },
  workerRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  workerTap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#475467', fontSize: 12, fontWeight: '800' },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { color: '#0A0A0A', fontSize: 13.5, fontWeight: '800' },
  personSub: { color: '#667085', fontSize: 11.5, marginTop: 1 },
  overtime: { color: colors.brandOrangeText, fontWeight: '700' },
  workerTags: { color: '#475467', fontSize: 11, marginTop: 3 },

  segment: { flexDirection: 'row', borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, overflow: 'hidden' },
  segmentButton: { minWidth: 38, height: 38, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  segmentBorder: { borderLeftWidth: 1, borderLeftColor: '#E4E7EC' },
  segmentWide: { minWidth: 50 },
  segmentFull: { backgroundColor: '#059669' },
  segmentHalf: { backgroundColor: '#1D4ED8' },
  segmentLeave: { backgroundColor: '#B54708' },
  segmentUnpaid: { backgroundColor: '#475467' },
  segmentAbsent: { backgroundColor: '#DC2626' },
  segmentText: { color: '#667085', fontSize: 12, fontWeight: '800' },
  segmentTextOn: { color: colors.white },
  footHint: { color: '#667085', fontSize: 11.5, lineHeight: 16, marginTop: 10, textAlign: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, marginBottom: 2 },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: '#0A0A0A', fontSize: 15, fontWeight: '900' },
  sectionSub: { color: '#667085', fontSize: 11.5, marginTop: 2 },
  inlineAdd: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: '#FFF2E8' },
  inlineAddText: { color: colors.brandOrangeText, fontSize: 12.5, fontWeight: '800' },

  jobCard: { marginTop: 10, padding: 12, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC' },
  jobHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobTotal: { color: '#0A0A0A', fontSize: 14, fontWeight: '900' },
  shareList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sharePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F2F4F7' },
  shareText: { color: '#344054', fontSize: 11.5, fontWeight: '700' },
  jobDelete: { alignSelf: 'flex-end', minHeight: 32, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  jobDeleteText: { color: '#B42318', fontSize: 12, fontWeight: '700' },

  smallIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  smallIconDanger: { backgroundColor: '#FEF3F2' },

  netCol: { alignItems: 'flex-end' },
  netValue: { color: '#0A0A0A', fontSize: 14, fontWeight: '900' },
  netNegative: { color: '#B42318' },
  netLabel: { color: '#98A2B3', fontSize: 10.5, fontWeight: '700' },

  empty: { minHeight: 170, marginTop: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyTitle: { color: '#344054', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#667085', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' },
  sheet: { paddingHorizontal: 16, paddingBottom: 26, backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTall: { maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sheetTitle: { color: '#0A0A0A', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  sheetSub: { color: '#667085', fontSize: 12, textTransform: 'none' },
  sheetNote: { color: '#667085', fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  optionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingVertical: 10, paddingHorizontal: 4 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { color: '#1D2939', fontSize: 14, fontWeight: '800' },
  optionHint: { color: '#667085', fontSize: 11.5, lineHeight: 16, marginTop: 1 },

  clockRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  clockButton: { flex: 1, minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF2E8', alignItems: 'center', justifyContent: 'center' },
  clockLabel: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '800' },
  clockValue: { color: '#0A0A0A', fontSize: 20, fontWeight: '900', marginTop: 2 },

  label: { color: '#344054', fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', color: '#0A0A0A', backgroundColor: colors.white, fontSize: 14 },
  inputDisabled: { backgroundColor: '#F9FAFB', color: '#98A2B3' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1, minWidth: 0 },
  choiceRow: { flexDirection: 'row', gap: 6 },
  choice: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white },
  choiceOn: { borderColor: colors.brandOrange, backgroundColor: '#FFF2E8' },
  choiceText: { color: '#667085', fontSize: 12.5, fontWeight: '700' },
  choiceTextOn: { color: colors.brandOrangeText, fontWeight: '900' },
  ruleBox: { marginTop: 16, paddingHorizontal: 12, paddingBottom: 10, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EEF0F3' },
  toggleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 },
  toggleLabel: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D0D5DD', padding: 3 },
  switchTrackOn: { backgroundColor: colors.brandOrange },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchThumbOn: { transform: [{ translateX: 18 }] },
  percentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  percentWrap: { width: 96, height: 40, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white },
  percentInput: { height: 40, paddingLeft: 10, paddingRight: 28, color: '#0A0A0A', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  percentSuffix: { position: 'absolute', right: 10, color: '#667085', fontSize: 12, fontWeight: '800' },

  chipRow: { gap: 6, paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: 220, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: colors.brandOrange, backgroundColor: '#FFF2E8' },
  chipText: { color: '#475467', fontSize: 12.5, fontWeight: '700' },
  chipTextOn: { color: colors.brandOrangeText },
  stepper: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white },
  stepperButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { flex: 1, textAlign: 'center', color: '#0A0A0A', fontSize: 14, fontWeight: '800' },
  splitBox: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#EEF0F3', gap: 6 },
  splitRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitName: { flex: 1, color: '#344054', fontSize: 13, fontWeight: '700' },
  splitValue: { color: '#0A0A0A', fontSize: 13, fontWeight: '800' },
  splitInput: { width: 150 },

  primaryButton: { minHeight: 48, marginTop: 16, borderRadius: 12, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 46, marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: '#344054', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
