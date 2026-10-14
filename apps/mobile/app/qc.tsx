import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api, isNetworkError } from '../src/lib/api';
import { enqueueOperationsMutation } from '../src/lib/localProjects';
import { enqueueMedia, listMediaQueue, syncMediaQueue } from '../src/lib/mediaQueue';

type WorkOrder = { id: string; code: string; title: string; status: string; project?: { name: string } };
type Template = { id: string; name: string; appliesTo: string; items: Array<{ checkKey: string; label: string; required: boolean; instructions?: string }> };
type QcValue = 'PASS' | 'FAIL' | 'REWORK' | '';
type Result = { checkKey: string; label: string; required: boolean; result: QcValue; note: string };

function mediaKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export default function QcScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [inspectionId, setInspectionId] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [note, setNote] = useState('');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [work, checks] = await Promise.all([
        api.get<WorkOrder[]>('/workshop/v2/work-orders'),
        api.get<Template[]>('/workshop/v2/qc/templates'),
      ]);
      setOrders(work.filter((item) => !['DONE', 'CANCELLED'].includes(item.status)));
      setTemplates(checks);
    } catch (error) {
      Alert.alert('Chưa tải được QC', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function begin(order: WorkOrder, picked = templates[0]) {
    if (!picked) return Alert.alert('Chưa có mẫu QC', 'Quản lý cần tạo mẫu kiểm tra trước.');
    try {
      const inspection = await api.post<{ id: string }>('/workshop/v2/qc/inspections', {
        templateId: picked.id,
        workOrderId: order.id,
        entityType: 'WORK_ORDER',
        entityId: order.id,
      });
      setSelected(order);
      setTemplate(picked);
      setInspectionId(inspection.id);
      setEvidenceCount(0);
      setResults(picked.items.map((item) => ({ checkKey: item.checkKey, label: item.label, required: item.required, result: '', note: '' })));
    } catch (error) {
      Alert.alert('Không mở được phiếu QC', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  }

  async function capture(checkKey: string) {
    if (!inspectionId) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera để chụp ảnh QC.');
    const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    await enqueueMedia({
      entityType: 'QC_INSPECTION',
      entityId: inspectionId,
      uri: picked.assets[0].uri,
      fileName: `qc-${mediaKey(checkKey)}-${Date.now()}.jpg`,
      mime: picked.assets[0].mimeType || 'image/jpeg',
      required: true,
    });
    setEvidenceCount((current) => current + 1);
  }

  async function complete() {
    if (!inspectionId || !selected) return;
    const missing = results.filter((item) => item.required && !item.result);
    if (missing.length) return Alert.alert('Chưa kiểm tra đủ', `Còn ${missing.length} tiêu chí bắt buộc chưa được xác nhận.`);
    const requiresEvidence = results.some((item) => item.result === 'FAIL' || item.result === 'REWORK');
    const localEvidence = (await listMediaQueue()).filter((item) => item.entityType === 'QC_INSPECTION' && item.entityId === inspectionId && item.uploadState !== 'CANCELLED');
    if (requiresEvidence && localEvidence.length === 0) return Alert.alert('Thiếu ảnh hiện trường', 'Hạng mục không đạt hoặc cần làm lại phải có ít nhất một ảnh.');

    await syncMediaQueue();
    const uploaded = (await listMediaQueue()).filter((item) => item.entityType === 'QC_INSPECTION' && item.entityId === inspectionId && item.uploadState === 'UPLOADED' && item.remoteObjectId);
    const payloadResults = results.map((item) => ({
      ...item,
      result: item.result || 'PASS',
      photoObjectIds: uploaded.filter((media) => media.fileName.includes(`-${mediaKey(item.checkKey)}-`)).map((media) => media.remoteObjectId),
    }));
    const body = { results: payloadResults, note, photoObjectIds: uploaded.map((item) => item.remoteObjectId) };
    try {
      await api.patch(`/workshop/v2/qc/inspections/${inspectionId}/complete`, body);
      Alert.alert('Đã hoàn tất', results.every((item) => item.result === 'PASS') ? 'Hạng mục đạt QC.' : 'Đã ghi nhận hạng mục cần xử lý lại.');
      setSelected(null);
      await load();
    } catch (error) {
      if (!isNetworkError(error)) return Alert.alert('Chưa thể hoàn tất QC', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại phiếu.');
      await enqueueOperationsMutation({ entityType: 'QC_INSPECTION', entityId: inspectionId, operation: 'COMPLETE', payload: body });
      Alert.alert('Đã lưu ngoại tuyến', 'Kết quả và ảnh QC sẽ được gửi khi có mạng.');
      setSelected(null);
    }
  }

  if (selected && template) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại danh sách QC" style={styles.back} onPress={() => setSelected(null)}><Icon name="chevron-left" /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.title}>{selected.code}</Text><Text style={styles.subtitle}>{template.name}</Text></View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.notice}><Icon name="alert-circle" size={18} color="#175CD3" /><Text style={styles.noticeText}>Xác nhận từng tiêu chí. Mục không đạt hoặc làm lại cần có ảnh hiện trường.</Text></View>
          {results.map((result, index) => (
            <View key={result.checkKey} style={styles.card}>
              <Text style={styles.checkTitle}>{index + 1}. {result.label}{result.required ? ' *' : ''}</Text>
              <View style={styles.segments}>
                {(['PASS', 'FAIL', 'REWORK'] as const).map((value) => (
                  <Pressable key={value} onPress={() => setResults((current) => current.map((item) => item.checkKey === result.checkKey ? { ...item, result: value } : item))} style={[styles.segment, result.result === value && (value === 'PASS' ? styles.pass : styles.fail)]}>
                    <Text style={[styles.segmentText, result.result === value && styles.selectedText]}>{value === 'PASS' ? 'Đạt' : value === 'FAIL' ? 'Không đạt' : 'Làm lại'}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={result.note} onChangeText={(value) => setResults((current) => current.map((item) => item.checkKey === result.checkKey ? { ...item, note: value } : item))} placeholder="Ghi chú tiêu chí" placeholderTextColor="#98A2B3" style={styles.itemNote} />
              <Pressable style={styles.photoButton} onPress={() => void capture(result.checkKey)}><Icon name="camera" size={17} color="#175CD3" /><Text style={styles.photoText}>Chụp ảnh tiêu chí</Text></Pressable>
            </View>
          ))}
          <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú tổng hợp" placeholderTextColor="#98A2B3" multiline style={styles.input} />
          <Text style={styles.evidenceText}>{evidenceCount} ảnh đã lưu trên thiết bị</Text>
          <Pressable style={styles.primary} onPress={() => void complete()}><Icon name="check-circle" /><Text style={styles.primaryText}>Hoàn tất QC</Text></Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" style={styles.back} onPress={() => router.back()}><Icon name="chevron-left" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Kiểm tra chất lượng</Text><Text style={styles.subtitle}>Chọn lệnh việc cần kiểm tra</Text></View>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={styles.content}>
        {orders.length === 0 ? <View style={styles.empty}><Icon name="check-circle" size={32} color="#039855" /><Text style={styles.emptyTitle}>Chưa có lệnh chờ QC</Text><Text style={styles.emptyText}>Kéo xuống để cập nhật khi quản lý giao việc mới.</Text></View> : null}
        {orders.map((order) => (
          <Pressable key={order.id} style={styles.card} onPress={() => void begin(order)}>
            <View style={styles.row}><View style={styles.qcIcon}><Icon name="check-square" color="#067647" /></View><View style={styles.headerCopy}><Text style={styles.code}>{order.code}</Text><Text style={styles.orderTitle}>{order.title}</Text><Text style={styles.subtitle}>{order.project?.name || order.status}</Text></View><Icon name="chevron-right" color="#98A2B3" /></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white },
  headerCopy: { flex: 1, minWidth: 0 },
  back: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.brandBlack.main },
  subtitle: { color: '#667085', fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 120 },
  notice: { flexDirection: 'row', gap: 9, padding: 12, marginBottom: 10, borderRadius: 10, backgroundColor: '#EFF8FF', borderWidth: 1, borderColor: '#B2DDFF' },
  noticeText: { flex: 1, color: '#344054', fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 14, marginBottom: 9 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  qcIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#ECFDF3', alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 11 },
  orderTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15, marginTop: 3 },
  checkTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15, marginBottom: 10 },
  segments: { flexDirection: 'row', gap: 7 },
  segment: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pass: { backgroundColor: '#12B76A' },
  fail: { backgroundColor: '#F04438' },
  segmentText: { color: '#475467', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  selectedText: { color: colors.white },
  itemNote: { minHeight: 42, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 11, color: colors.brandBlack.main },
  photoButton: { minHeight: 42, marginTop: 8, borderRadius: 8, backgroundColor: '#EFF8FF', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  photoText: { color: '#175CD3', fontWeight: '800', fontSize: 12 },
  input: { minHeight: 80, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white, padding: 12, color: colors.brandBlack.main, textAlignVertical: 'top' },
  evidenceText: { marginTop: 8, color: '#667085', fontSize: 11, textAlign: 'right' },
  primary: { height: 54, marginTop: 12, borderRadius: 10, backgroundColor: colors.brandOrange, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontWeight: '900' },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: colors.brandBlack.main },
  emptyText: { marginTop: 5, color: '#667085', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
