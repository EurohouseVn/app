import { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CreateWorkshopReminderInput, WorkshopReminder, WorkshopReminderPriority } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Banner, Button, Card, Chip, EmptyState, Field, IconButton, Input, Loading, SectionHead, Sheet, SubHeader, ws, wsStyles } from '../src/components/ws';
import { dmy, parseDmy } from '../src/lib/invoiceState';

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
      : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix} lúc ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
  const [date, setDate] = useState(dmy(localDate()));
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
    const dateKey = parseDmy(date);
    const dueAt = new Date(`${dateKey}T${time.trim().padStart(5, '0')}:00+07:00`);
    if (!dateKey || !/^\d{1,2}:\d{2}$/.test(time.trim()) || Number.isNaN(dueAt.getTime())) {
      Alert.alert('Thời gian chưa đúng', 'Ngày nhập dạng ngày/tháng/năm (18/11/2026), giờ dạng 08:00.');
      return;
    }
    const body: CreateWorkshopReminderInput = { title: title.trim(), note: note.trim(), dueAt: dueAt.toISOString(), priority };
    setSaving(true);
    try {
      await api.post('/workforce/reminders', body);
      setModalOpen(false);
      setTitle('');
      setNote('');
      setDate(dmy(localDate()));
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

  function reminderRow(reminder: WorkshopReminder, index: number) {
    const isDone = !!reminder.completedAt;
    const overdue = !isDone && new Date(reminder.dueAt).getTime() < Date.now();
    return (
      <View key={reminder.id} style={[styles.row, index > 0 && styles.divider]}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} accessibilityLabel={isDone ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'} hitSlop={8} style={[styles.check, isDone && styles.checkDone]} onPress={() => void toggle(reminder)}>
          {isDone ? <Icon name="check" size={15} color="#FFFFFF" /> : null}
        </Pressable>
        <View style={wsStyles.grow}>
          <Text style={[wsStyles.rowTitle, isDone && styles.textDone]} numberOfLines={2}>{reminder.title}</Text>
          <Text style={[wsStyles.rowMeta, overdue && { color: ws.dangerText, fontWeight: '700' }]}>{overdue ? 'Quá hạn · ' : ''}{dueText(reminder.dueAt)}</Text>
          {reminder.note ? <Text style={[wsStyles.rowMeta, isDone && styles.textDone]} numberOfLines={2}>{reminder.note}</Text> : null}
        </View>
        {!isDone ? <View style={[styles.priority, reminder.priority === 'HIGH' && styles.priorityHigh, reminder.priority === 'LOW' && styles.priorityLow]}><Text style={[styles.priorityText, reminder.priority === 'HIGH' && { color: ws.dangerText }]}>{priorityLabel[reminder.priority]}</Text></View> : null}
      </View>
    );
  }

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader
        title="Nhắc việc"
        subtitle={`${active.length} việc đang chờ`}
        onBack={() => router.back()}
        right={<IconButton icon="plus" tone="orange" label="Thêm nhắc việc" onPress={() => setModalOpen(true)} />}
      />
      <ScrollView
        contentContainerStyle={wsStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={ws.orange} />}
      >
        {error ? <Banner tone="error" title="Chưa tải được" text={error} onPress={() => void load(true)} /> : null}
        {loading ? <Loading text="Đang tải nhắc việc..." /> : (
          <>
            <SectionHead title="Cần làm" sub="Giao hàng, gọi khách, mua vật tư, việc nội bộ" action={<Text style={styles.count}>{active.length}</Text>} />
            {active.length ? <Card padded={false}>{active.map(reminderRow)}</Card> : (
              <EmptyState icon="check-circle" title="Danh sách đã gọn" text="Thêm lịch giao hàng hoặc việc cần nhớ cho cả xưởng." action={<Button label="Thêm nhắc việc" icon="plus" onPress={() => setModalOpen(true)} />} />
            )}
            {completed.length ? (
              <>
                <SectionHead title="Đã hoàn thành" action={<Text style={styles.count}>{completed.length}</Text>} />
                <Card padded={false}>{completed.slice(0, 10).map(reminderRow)}</Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Sheet visible={modalOpen} onClose={() => setModalOpen(false)} title="Tạo nhắc việc" sub="Nhắc đúng lúc để không bỏ sót việc">
        <Field label="Việc cần nhắc"><Input value={title} onChangeText={setTitle} placeholder="Ví dụ: Giao cửa công trình anh Minh" /></Field>
        <View style={wsStyles.row}>
          <Field label="Ngày" style={wsStyles.half}><Input value={date} onChangeText={setDate} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" /></Field>
          <Field label="Giờ" style={wsStyles.half}><Input value={time} onChangeText={setTime} placeholder="08:00" keyboardType="numbers-and-punctuation" /></Field>
        </View>
        <Field label="Mức ưu tiên">
          <View style={styles.priorityRow}>{(['LOW', 'NORMAL', 'HIGH'] as WorkshopReminderPriority[]).map((value) => <Chip key={value} label={priorityLabel[value]} active={priority === value} onPress={() => setPriority(value)} />)}</View>
        </Field>
        <Field label="Ghi chú"><Input value={note} onChangeText={setNote} placeholder="Người nhận, địa chỉ hoặc vật tư cần mang" multiline /></Field>
        <View style={styles.gapTop}><Button label="Lưu nhắc việc" icon="calendar" loading={saving} disabled={saving} onPress={() => void createReminder()} /></View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  divider: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: ws.field, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkDone: { borderColor: ws.success, backgroundColor: ws.success },
  textDone: { color: ws.faint, textDecorationLine: 'line-through' },
  priority: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: ws.warningBg },
  priorityHigh: { backgroundColor: ws.dangerBg },
  priorityLow: { backgroundColor: '#F2F4F7' },
  priorityText: { color: ws.warning, fontSize: 10.5, fontWeight: '800' },
  priorityRow: { flexDirection: 'row', gap: 6 },
  count: { color: ws.muted, fontSize: 12.5, fontWeight: '800' },
});
