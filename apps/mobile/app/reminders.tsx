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
import type { CreateWorkshopReminderInput, WorkshopReminder, WorkshopReminderPriority } from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

const priorityLabel: Record<WorkshopReminderPriority, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Gấp',
};

function localDate(): string {
  const value = new Date();
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dueText(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const prefix = date.toDateString() === today.toDateString()
    ? 'Hôm nay'
    : date.toDateString() === tomorrow.toDateString()
      ? 'Ngày mai'
      : date.toLocaleDateString('vi-VN');
  return `${prefix} lúc ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function RemindersScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<WorkshopReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDate());
  const [time, setTime] = useState('08:00');
  const [priority, setPriority] = useState<WorkshopReminderPriority>('NORMAL');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setReminders(await api.get<WorkshopReminder[]>('/workforce/reminders?includeCompleted=true'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được nhắc việc.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = useMemo(() => reminders.filter((item) => !item.completedAt), [reminders]);
  const completed = useMemo(() => reminders.filter((item) => !!item.completedAt), [reminders]);

  async function createReminder() {
    if (!title.trim()) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập việc cần nhắc.');
      return;
    }
    const dueAt = new Date(`${date}T${time}:00+07:00`);
    if (Number.isNaN(dueAt.getTime())) {
      Alert.alert('Thời gian không hợp lệ', 'Ngày dùng định dạng YYYY-MM-DD và giờ dùng định dạng HH:mm.');
      return;
    }
    const body: CreateWorkshopReminderInput = { title: title.trim(), note: note.trim(), dueAt: dueAt.toISOString(), priority };
    setSaving(true);
    try {
      await api.post('/workforce/reminders', body);
      setModalOpen(false);
      setTitle('');
      setNote('');
      setDate(localDate());
      setTime('08:00');
      setPriority('NORMAL');
      await load(true);
    } catch (createError) {
      Alert.alert('Chưa tạo được nhắc việc', createError instanceof Error ? createError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(reminder: WorkshopReminder) {
    try {
      await api.patch(`/workforce/reminders/${reminder.id}`, { completed: !reminder.completedAt });
      await load(true);
    } catch (toggleError) {
      Alert.alert('Chưa cập nhật được', toggleError instanceof Error ? toggleError.message : 'Vui lòng thử lại.');
    }
  }

  function reminderRow(reminder: WorkshopReminder) {
    const isDone = !!reminder.completedAt;
    const overdue = !isDone && new Date(reminder.dueAt).getTime() < Date.now();
    return (
      <View key={reminder.id} style={[styles.reminderRow, isDone && styles.reminderDone]}>
        <Pressable accessibilityLabel={isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'} style={[styles.checkButton, isDone && styles.checkButtonDone]} onPress={() => void toggle(reminder)}>
          {isDone ? <Icon name="check" size={18} color={colors.white} /> : null}
        </Pressable>
        <View style={styles.reminderCopy}>
          <View style={styles.reminderTitleRow}>
            <Text style={[styles.reminderTitle, isDone && styles.textDone]} numberOfLines={2}>{reminder.title}</Text>
            {!isDone ? <View style={[styles.priorityBadge, reminder.priority === 'HIGH' && styles.priorityHigh, reminder.priority === 'LOW' && styles.priorityLow]}><Text style={styles.priorityText}>{priorityLabel[reminder.priority]}</Text></View> : null}
          </View>
          <View style={styles.dueRow}><Icon name="clock" size={13} color={overdue ? '#B42318' : '#667085'} /><Text style={[styles.dueText, overdue && styles.overdue]}>{overdue ? 'Quá hạn · ' : ''}{dueText(reminder.dueAt)}</Text></View>
          {reminder.note ? <Text style={[styles.note, isDone && styles.textDone]} numberOfLines={2}>{reminder.note}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" style={styles.iconButton} onPress={() => router.back()}><Icon name="arrow-left" size={21} color="#1D2939" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>Nhắc việc</Text><Text style={styles.headerSubtitle}>{active.length} việc đang chờ xử lý</Text></View>
        <Pressable accessibilityLabel="Thêm nhắc việc" style={styles.addButton} onPress={() => setModalOpen(true)}><Icon name="plus" size={21} color={colors.brandOrangeText} /></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandOrange} />}
      >
        <View style={styles.todayBand}>
          <View style={styles.calendarIcon}><Text style={styles.calendarDay}>{new Date().getDate()}</Text><Text style={styles.calendarMonth}>TH{new Date().getMonth() + 1}</Text></View>
          <View style={styles.todayCopy}><Text style={styles.todayTitle}>Kế hoạch của xưởng</Text><Text style={styles.todaySub}>Lịch giao hàng, gọi khách, mua vật tư và việc nội bộ.</Text></View>
        </View>

        {error ? <Pressable style={styles.error} onPress={() => void load(true)}><Icon name="alert-circle" size={18} color="#B42318" /><Text style={styles.errorText}>{error}</Text></Pressable> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brandOrange} /><Text style={styles.muted}>Đang tải nhắc việc...</Text></View> : null}

        {!loading ? (
          <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Cần làm</Text><Text style={styles.sectionCount}>{active.length}</Text></View>
            {active.length ? active.map(reminderRow) : (
              <Pressable style={styles.empty} onPress={() => setModalOpen(true)}><Icon name="check-circle" size={30} color="#047857" /><Text style={styles.emptyTitle}>Danh sách đã gọn</Text><Text style={styles.emptyText}>Thêm lịch giao hàng hoặc việc cần nhớ cho cả xưởng.</Text></Pressable>
            )}
            {completed.length ? <><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Đã hoàn thành</Text><Text style={styles.sectionCount}>{completed.length}</Text></View>{completed.slice(0, 10).map(reminderRow)}</> : null}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Tạo nhắc việc</Text><Text style={styles.sheetSub}>Nhắc đúng lúc để không bỏ sót việc</Text></View><Pressable style={styles.closeButton} onPress={() => setModalOpen(false)}><Icon name="x" size={20} color="#475467" /></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Việc cần nhắc</Text><TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: Giao cửa công trình anh Minh" placeholderTextColor="#98A2B3" style={styles.input} />
              <View style={styles.fieldRow}><View style={styles.fieldHalf}><Text style={styles.label}>Ngày</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#98A2B3" style={styles.input} /></View><View style={styles.fieldHalf}><Text style={styles.label}>Giờ</Text><TextInput value={time} onChangeText={setTime} placeholder="HH:mm" placeholderTextColor="#98A2B3" style={styles.input} /></View></View>
              <Text style={styles.label}>Mức ưu tiên</Text><View style={styles.priorityOptions}>{(['LOW', 'NORMAL', 'HIGH'] as WorkshopReminderPriority[]).map((value) => <Pressable key={value} style={[styles.priorityOption, priority === value && styles.priorityOptionActive]} onPress={() => setPriority(value)}><Text style={[styles.priorityOptionText, priority === value && styles.priorityOptionTextActive]}>{priorityLabel[value]}</Text></Pressable>)}</View>
              <Text style={styles.label}>Ghi chú</Text><TextInput value={note} onChangeText={setNote} placeholder="Thông tin người nhận, địa chỉ hoặc vật tư cần mang theo" placeholderTextColor="#98A2B3" multiline style={[styles.input, styles.noteInput]} />
              <Pressable disabled={saving} style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void createReminder()}>{saving ? <ActivityIndicator color="#172033" /> : <><Icon name="calendar" size={18} color="#172033" /><Text style={styles.primaryText}>Lưu nhắc việc</Text></>}</Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { minHeight: 92, paddingTop: Platform.OS === 'ios' ? 44 : 24, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E7E9ED' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 4 },
  headerTitle: { color: '#172033', fontSize: 20, fontWeight: '900' },
  headerSubtitle: { color: '#667085', fontSize: 11, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 120 },
  todayBand: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, backgroundColor: '#172033', borderRadius: 14 },
  calendarIcon: { width: 50, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFB15C' },
  calendarDay: { color: '#172033', fontSize: 21, fontWeight: '900', lineHeight: 23 },
  calendarMonth: { color: '#172033', fontSize: 9, fontWeight: '900' },
  todayCopy: { flex: 1 },
  todayTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  todaySub: { color: '#C7D0DC', fontSize: 10, lineHeight: 15, marginTop: 4 },
  error: { minHeight: 52, marginTop: 12, borderRadius: 10, padding: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, color: '#B42318', fontSize: 11, lineHeight: 16 },
  loading: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#667085', fontSize: 11 },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172033', fontSize: 16, fontWeight: '900' },
  sectionCount: { minWidth: 27, height: 27, paddingHorizontal: 8, borderRadius: 14, textAlign: 'center', textAlignVertical: 'center', color: '#667085', backgroundColor: '#E9ECF1', fontSize: 10, lineHeight: 27, fontWeight: '800' },
  reminderRow: { minHeight: 82, flexDirection: 'row', alignItems: 'flex-start', padding: 13, marginBottom: 8, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  reminderDone: { backgroundColor: '#F8F9FA' },
  checkButton: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', marginRight: 11, marginTop: 1 },
  checkButtonDone: { borderColor: '#047857', backgroundColor: '#047857' },
  reminderCopy: { flex: 1 },
  reminderTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reminderTitle: { flex: 1, color: '#1D2939', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  textDone: { color: '#98A2B3', textDecorationLine: 'line-through' },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FFF4D8' },
  priorityHigh: { backgroundColor: '#FEE4E2' },
  priorityLow: { backgroundColor: '#E9ECF1' },
  priorityText: { color: '#475467', fontSize: 8, fontWeight: '900' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  dueText: { color: '#667085', fontSize: 10, fontWeight: '600' },
  overdue: { color: '#B42318' },
  note: { color: '#667085', fontSize: 10, lineHeight: 15, marginTop: 5 },
  empty: { minHeight: 180, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: '#344054', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#667085', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.55)' },
  sheet: { maxHeight: '92%', paddingHorizontal: 18, paddingBottom: 24, backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  sheetHeader: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { color: '#172033', fontSize: 18, fontWeight: '900' },
  sheetSub: { color: '#667085', fontSize: 10, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#344054', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', color: '#172033', backgroundColor: colors.white, fontSize: 12 },
  noteInput: { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  priorityOptions: { flexDirection: 'row', gap: 7 },
  priorityOption: { flex: 1, minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' },
  priorityOptionActive: { borderColor: '#FF7A1A', backgroundColor: '#FFF0E5' },
  priorityOptionText: { color: '#667085', fontSize: 10, fontWeight: '700' },
  priorityOptionTextActive: { color: colors.brandOrangeText, fontWeight: '900' },
  primaryButton: { minHeight: 50, marginTop: 20, borderRadius: 11, backgroundColor: '#FF9A3C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#172033', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
