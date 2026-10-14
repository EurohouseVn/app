import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api, isNetworkError } from '../src/lib/api';
import { enqueueOperationsMutation } from '../src/lib/localProjects';
import { enqueueMedia, listMediaQueue, syncMediaQueue } from '../src/lib/mediaQueue';

type ChecklistItem = { key: string; label: string; required: boolean; checked: boolean };
type Installation = {
  id: string;
  code: string;
  status: string;
  scheduledStart?: string;
  openingIds: string[];
  materialsChecklist?: unknown;
  toolsChecklist?: unknown;
  requiredPhotoCount: number;
  requiresCustomerSignature: boolean;
  note: string;
  customerName?: string;
  project: { code: string; name: string; address?: string };
  assignedTeam?: { name: string; members: Array<{ worker: { name: string } }> } | null;
};

const nextState: Record<string, string> = { SCHEDULED: 'EN_ROUTE', EN_ROUTE: 'ON_SITE', ON_SITE: 'IN_PROGRESS', IN_PROGRESS: 'QC_PENDING', QC_PENDING: 'ACCEPTED', ACCEPTED: 'COMPLETED' };
const stateLabel: Record<string, string> = { DRAFT: 'Bản nháp', SCHEDULED: 'Bắt đầu di chuyển', EN_ROUTE: 'Đã đến nơi', ON_SITE: 'Bắt đầu lắp', IN_PROGRESS: 'Chuyển chờ QC', QC_PENDING: 'Xác nhận nghiệm thu', ACCEPTED: 'Hoàn tất công việc', COMPLETED: 'Hoàn tất' };

function checklist(value: unknown, prefix: string): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') return { key: `${prefix}-${index}`, label: item, required: true, checked: false };
    const data = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      key: String(data.key ?? `${prefix}-${index}`),
      label: String(data.label ?? data.name ?? `Mục ${index + 1}`),
      required: data.required !== false,
      checked: data.checked === true,
    };
  });
}

export default function InstallationsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Installation[]>([]);
  const [selected, setSelected] = useState<Installation | null>(null);
  const [materials, setMaterials] = useState<ChecklistItem[]>([]);
  const [tools, setTools] = useState<ChecklistItem[]>([]);
  const [note, setNote] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setJobs(await api.get<Installation[]>('/workshop/v2/installations'));
    } catch (error) {
      Alert.alert('Chưa tải được lịch lắp', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function openJob(job: Installation) {
    setSelected(job);
    setNote(job.note || '');
    setMaterials(checklist(job.materialsChecklist, 'material'));
    setTools(checklist(job.toolsChecklist, 'tool'));
  }

  function toggle(setter: Dispatch<SetStateAction<ChecklistItem[]>>, key: string) {
    setter((current) => current.map((item) => item.key === key ? { ...item, checked: !item.checked } : item));
  }

  async function capture(kind: 'installation' | 'signature') {
    if (!selected) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera để lưu hồ sơ lắp đặt.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (result.canceled || !result.assets[0]?.uri) return;
    await enqueueMedia({ entityType: 'INSTALLATION', entityId: selected.id, uri: result.assets[0].uri, fileName: `${kind}-${selected.code}-${Date.now()}.jpg`, mime: result.assets[0].mimeType || 'image/jpeg', required: true });
    Alert.alert('Đã lưu ảnh', 'Ảnh được giữ an toàn trên máy và sẽ tự gửi khi có mạng.');
  }

  async function advance() {
    if (!selected) return;
    const status = nextState[selected.status];
    if (!status) return;
    if (status === 'COMPLETED') {
      const missing = [...materials, ...tools].filter((item) => item.required && !item.checked);
      if (missing.length) return Alert.alert('Chưa đủ checklist', `Còn ${missing.length} mục dụng cụ hoặc vật tư bắt buộc chưa xác nhận.`);
    }
    await syncMediaQueue();
    const media = (await listMediaQueue()).filter((item) => item.entityId === selected.id && item.entityType === 'INSTALLATION' && item.uploadState === 'UPLOADED');
    const body = {
      status,
      note,
      materialsChecklist: materials,
      toolsChecklist: tools,
      photoObjectIds: media.filter((item) => !item.fileName.startsWith('signature-')).map((item) => item.remoteObjectId).filter(Boolean),
      customerSignatureObjectId: media.find((item) => item.fileName.startsWith('signature-'))?.remoteObjectId,
    };
    try {
      await api.patch(`/workshop/v2/installations/${selected.id}/status`, body);
      const optimistic = { ...selected, status, note, materialsChecklist: materials, toolsChecklist: tools };
      setJobs((current) => current.map((item) => item.id === selected.id ? optimistic : item));
      setSelected(optimistic);
      Alert.alert('Đã cập nhật', status === 'COMPLETED' ? 'Công việc lắp đặt đã hoàn tất.' : stateLabel[status]);
    } catch (error) {
      if (!isNetworkError(error)) return Alert.alert('Chưa thể cập nhật', error instanceof Error ? error.message : 'Kiểm tra checklist, ảnh, QC và chữ ký.');
      await enqueueOperationsMutation({ entityType: 'INSTALLATION', entityId: selected.id, operation: 'STATUS', payload: body });
      setSelected({ ...selected, status, note, materialsChecklist: materials, toolsChecklist: tools });
      Alert.alert('Đã lưu ngoại tuyến', 'Trạng thái và hồ sơ sẽ được gửi khi có mạng.');
    }
  }

  if (selected) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}><Pressable accessibilityLabel="Quay lại lịch lắp" style={styles.back} onPress={() => setSelected(null)}><Icon name="chevron-left" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>{selected.code}</Text><Text style={styles.subtitle}>{stateLabel[selected.status] || selected.status}</Text></View></View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.project}>{selected.project.name}</Text>
            <Text style={styles.meta}>{selected.openingIds.length} ô cửa · {selected.project.address || 'Chưa có địa chỉ'}</Text>
            {selected.scheduledStart ? <Text style={styles.meta}>Lịch: {new Date(selected.scheduledStart).toLocaleString('vi-VN')}</Text> : null}
            {selected.assignedTeam ? <Text style={styles.meta}>Đội: {selected.assignedTeam.name} · {selected.assignedTeam.members.map((item) => item.worker.name).join(', ') || 'chưa có thành viên'}</Text> : null}
            {selected.project.address ? <Pressable style={styles.map} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.project.address || '')}`)}><Icon name="map-pin" size={17} color="#175CD3" /><Text style={styles.mapText}>Mở chỉ đường</Text></Pressable> : null}
          </View>

          {tools.length > 0 ? <Checklist title="Dụng cụ mang theo" items={tools} onToggle={(key) => toggle(setTools, key)} /> : null}
          {materials.length > 0 ? <Checklist title="Vật tư bàn giao" items={materials} onToggle={(key) => toggle(setMaterials, key)} /> : null}

          <View style={styles.card}>
            <Text style={styles.section}>Hồ sơ bắt buộc</Text>
            <Text style={styles.meta}>Cần ít nhất {selected.requiredPhotoCount} ảnh lắp đặt{selected.requiresCustomerSignature ? ' và chữ ký khách hàng' : ''}.</Text>
            <View style={styles.actions}>
              <Pressable style={styles.secondary} onPress={() => void capture('installation')}><Icon name="camera" size={18} /><Text style={styles.buttonText}>Ảnh lắp đặt</Text></Pressable>
              {selected.requiresCustomerSignature ? <Pressable style={styles.secondary} onPress={() => void capture('signature')}><Icon name="edit-2" size={18} /><Text style={styles.buttonText}>Chụp chữ ký</Text></Pressable> : null}
            </View>
          </View>
          <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú cho khách hàng hoặc quản lý" placeholderTextColor="#98A2B3" multiline style={styles.input} />
          {nextState[selected.status] ? <Pressable style={styles.primary} onPress={() => void advance()}><Text style={styles.primaryText}>{stateLabel[selected.status] || 'Cập nhật'}</Text><Icon name="arrow-right" /></Pressable> : <View style={styles.completed}><Icon name="check-circle" color="#039855" /><Text style={styles.completedText}>Công việc đã hoàn tất</Text></View>}
          <Pressable style={styles.syncLink} onPress={() => router.push('/media-sync' as Href)}><Icon name="cloud" size={17} color="#475467" /><Text style={styles.syncText}>Xem ảnh chờ đồng bộ</Text></Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}><Pressable accessibilityLabel="Quay lại" style={styles.back} onPress={() => router.back()}><Icon name="chevron-left" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Lắp đặt hôm nay</Text><Text style={styles.subtitle}>Chọn công việc được giao</Text></View></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={styles.content}>
        {jobs.length === 0 ? <View style={styles.empty}><Icon name="tool" size={32} color="#B54708" /><Text style={styles.emptyTitle}>Chưa có lịch lắp đặt</Text><Text style={styles.emptyText}>Lịch được quản lý giao sẽ xuất hiện tại đây.</Text></View> : null}
        {jobs.map((job) => <Pressable key={job.id} style={styles.card} onPress={() => openJob(job)}><View style={styles.row}><View style={styles.icon}><Icon name="tool" color="#B54708" /></View><View style={styles.headerCopy}><Text style={styles.code}>{job.code}</Text><Text style={styles.project}>{job.project.name}</Text><Text style={styles.meta}>{stateLabel[job.status] || job.status}</Text></View><Icon name="chevron-right" color="#98A2B3" /></View></Pressable>)}
      </ScrollView>
    </View>
  );
}

function Checklist({ title, items, onToggle }: { title: string; items: ChecklistItem[]; onToggle: (key: string) => void }) {
  return <View style={styles.card}><Text style={styles.section}>{title}</Text>{items.map((item) => <Pressable key={item.key} style={styles.checkRow} onPress={() => onToggle(item.key)}><View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>{item.checked ? <Icon name="check" size={15} color={colors.white} /> : null}</View><Text style={styles.checkLabel}>{item.label}{item.required ? ' *' : ''}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white },
  headerCopy: { flex: 1, minWidth: 0 },
  back: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.brandBlack.main },
  subtitle: { color: '#667085', fontSize: 12 },
  content: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900' },
  project: { fontSize: 16, fontWeight: '900', color: colors.brandBlack.main, marginTop: 2 },
  meta: { color: '#667085', fontSize: 12, marginTop: 5, lineHeight: 18 },
  section: { fontSize: 15, fontWeight: '900', marginBottom: 9 },
  map: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 12 },
  mapText: { color: '#175CD3', fontWeight: '800' },
  checkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#EAECF0' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#039855', borderColor: '#039855' },
  checkLabel: { flex: 1, color: '#344054', fontWeight: '700', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondary: { flex: 1, minHeight: 46, borderRadius: 8, backgroundColor: '#F2F4F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 6 },
  buttonText: { fontWeight: '800', fontSize: 12, textAlign: 'center' },
  input: { minHeight: 86, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, backgroundColor: colors.white, color: colors.brandBlack.main, textAlignVertical: 'top' },
  primary: { minHeight: 54, borderRadius: 10, backgroundColor: colors.brandOrange, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  primaryText: { fontWeight: '900', textAlign: 'center' },
  completed: { minHeight: 54, marginTop: 12, borderRadius: 10, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  completedText: { color: '#027A48', fontWeight: '900' },
  syncLink: { height: 48, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  syncText: { color: '#475467', fontWeight: '800' },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: colors.brandBlack.main },
  emptyText: { marginTop: 5, color: '#667085', fontSize: 12, textAlign: 'center' },
});
