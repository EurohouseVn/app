import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api, isNetworkError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { enqueueOperationsMutation } from '../src/lib/localProjects';
import { cancelMedia, enqueueMedia, listMediaQueue, syncMediaQueue } from '../src/lib/mediaQueue';

type ServiceEvent = { id: string; action: string; note: string; occurredAt: string };
type Ticket = { id: string; code: string; status: string; issueType: string; description: string; resolution?: string; assignedTechnicianId?: string; serviceHistory: ServiceEvent[] };
type Asset = { id: string; assetCode: string; status: string; expiresAt: string; project: { code: string; name: string }; tickets: Ticket[] };
const issueTypes = ['Kẹt cửa', 'Kính/phụ kiện', 'Thấm nước', 'Xệ cánh', 'Khác'];
const statusLabel: Record<string, string> = { OPEN: 'Mới', SCHEDULED: 'Đã nhận', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý', CLOSED: 'Đã đóng', REJECTED: 'Từ chối' };

export default function ServiceWarrantyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [asset, setAsset] = useState<Asset | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [issueType, setIssueType] = useState(issueTypes[0]);
  const [description, setDescription] = useState('');
  const [ticketMediaIds, setTicketMediaIds] = useState<string[]>([]);
  const [serviceNote, setServiceNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [serviceMediaIds, setServiceMediaIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Asset[]>('/workshop/v2/warranty/assets');
      setAssets(data);
      setAsset((current) => current ? data.find((item) => item.id === current.id) || null : null);
    } catch (error) {
      Alert.alert('Chưa tải được bảo hành', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => assets.filter((item) => `${item.assetCode} ${item.project.name}`.toLowerCase().includes(search.toLowerCase())), [assets, search]);

  async function openScanner() {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) return Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera để quét mã QR, hoặc tìm bằng mã tài sản.');
    setScanLocked(false);
    setScanning(true);
  }

  async function resolveQr(raw: string) {
    if (scanLocked) return;
    setScanLocked(true);
    setScanning(false);
    const publicId = raw.trim().split(/[/?#]/).filter(Boolean).at(-1) || raw.trim();
    try {
      const identity = await api.get<{ entityType: string; entityId: string }>(`/workshop/v2/qr/${encodeURIComponent(publicId)}`);
      if (identity.entityType !== 'WARRANTY_ASSET') throw new Error('Mã QR này không phải tài sản bảo hành.');
      const current = assets.find((item) => item.id === identity.entityId) || (await api.get<Asset[]>('/workshop/v2/warranty/assets')).find((item) => item.id === identity.entityId);
      if (!current) throw new Error('Không tìm thấy tài sản bảo hành trong xưởng này.');
      setAsset(current);
    } catch (error) {
      Alert.alert('Không đọc được mã', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  }

  async function pickMedia(entityType: 'WARRANTY_ASSET' | 'WARRANTY_TICKET', entityId: string, setter: (updater: (current: string[]) => string[]) => void) {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.75 });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    const media = picked.assets[0];
    const queued = await enqueueMedia({
      entityType,
      entityId,
      uri: media.uri,
      fileName: `warranty-${Date.now()}-${media.fileName || (media.type === 'video' ? 'video.mp4' : 'photo.jpg')}`,
      mime: media.mimeType || (media.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      required: true,
    });
    setter((current) => [...current, queued.localId]);
  }

  async function uploadedObjects(localIds: string[]) {
    await syncMediaQueue();
    return (await listMediaQueue()).filter((item) => localIds.includes(item.localId) && item.uploadState === 'UPLOADED' && item.remoteObjectId).map((item) => item.remoteObjectId as string);
  }

  async function createTicket() {
    if (!asset || !description.trim()) return Alert.alert('Thiếu mô tả', 'Vui lòng mô tả tình trạng cần xử lý.');
    const body = { issueType, description: description.trim(), mediaLocalIds: ticketMediaIds, photoObjectIds: await uploadedObjects(ticketMediaIds) };
    try {
      await api.post(`/workshop/v2/warranty/assets/${asset.id}/tickets`, body);
      await Promise.all(ticketMediaIds.map(cancelMedia));
      Alert.alert('Đã tạo yêu cầu', 'Quản lý xưởng sẽ phân công xử lý.');
      setDescription('');
      setTicketMediaIds([]);
      await load();
    } catch (error) {
      if (!isNetworkError(error)) return Alert.alert('Chưa thể tạo yêu cầu', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại.');
      await enqueueOperationsMutation({ entityType: 'WARRANTY_ASSET', entityId: asset.id, operation: 'CREATE_TICKET', payload: body });
      Alert.alert('Đã lưu ngoại tuyến', 'Yêu cầu và ảnh sẽ được gửi khi có mạng.');
      setDescription('');
      setTicketMediaIds([]);
      setAsset(null);
    }
  }

  async function updateTicket(status: 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') {
    if (!ticket) return;
    if ((status === 'RESOLVED' || status === 'CLOSED') && !resolution.trim()) return Alert.alert('Thiếu kết quả xử lý', 'Vui lòng ghi rõ cách xử lý trước khi hoàn tất.');
    const action = status === 'SCHEDULED' ? 'ASSIGNED' : status === 'IN_PROGRESS' ? 'SERVICE_STARTED' : status === 'RESOLVED' ? 'RESOLVED' : 'CLOSED';
    const body = {
      action,
      status,
      note: serviceNote.trim(),
      resolution: resolution.trim(),
      assignedTechnicianId: status === 'SCHEDULED' ? user?.id : ticket.assignedTechnicianId,
      mediaLocalIds: serviceMediaIds,
      photoObjectIds: await uploadedObjects(serviceMediaIds),
    };
    try {
      await api.post(`/workshop/v2/warranty/tickets/${ticket.id}/events`, body);
      await Promise.all(serviceMediaIds.map(cancelMedia));
      Alert.alert('Đã cập nhật', `Phiếu ${ticket.code}: ${statusLabel[status]}.`);
      setTicket(null);
      setServiceNote('');
      setResolution('');
      setServiceMediaIds([]);
      await load();
    } catch (error) {
      if (!isNetworkError(error)) return Alert.alert('Chưa thể cập nhật', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại.');
      await enqueueOperationsMutation({ entityType: 'WARRANTY_TICKET', entityId: ticket.id, operation: 'SERVICE_EVENT', payload: body });
      Alert.alert('Đã lưu ngoại tuyến', 'Tác vụ và media sẽ được gửi khi có mạng.');
      setTicket(null);
      setServiceMediaIds([]);
    }
  }

  if (scanning) {
    return <View style={styles.scanner}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => void resolveQr(data)} /><View style={styles.scanOverlay}><View style={styles.scanBox} /><Text style={styles.scanText}>Đưa mã QR tài sản vào khung</Text><Pressable style={styles.cancelScan} onPress={() => setScanning(false)}><Text style={styles.cancelScanText}>Hủy quét</Text></Pressable></View></View>;
  }

  if (ticket) {
    return (
      <View style={styles.screen}>
        <Header title={ticket.code} subtitle={`${ticket.issueType} · ${statusLabel[ticket.status] || ticket.status}`} onBack={() => setTicket(null)} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}><Text style={styles.section}>Nội dung yêu cầu</Text><Text style={styles.bodyText}>{ticket.description}</Text><Text style={styles.meta}>{ticket.assignedTechnicianId === user?.id ? 'Đang giao cho bạn' : ticket.assignedTechnicianId ? 'Đã có kỹ thuật viên' : 'Chưa có kỹ thuật viên nhận việc'}</Text></View>
          <TextInput value={serviceNote} onChangeText={setServiceNote} multiline placeholder="Ghi chú công việc đã thực hiện" placeholderTextColor="#98A2B3" style={styles.input} />
          <TextInput value={resolution} onChangeText={setResolution} multiline placeholder="Kết quả xử lý / hướng dẫn khách hàng" placeholderTextColor="#98A2B3" style={[styles.input, { marginTop: 10 }]} />
          <Pressable style={styles.mediaButton} onPress={() => void pickMedia('WARRANTY_TICKET', ticket.id, setServiceMediaIds)}><Icon name="camera" size={18} color="#175CD3" /><Text style={styles.mediaButtonText}>Thêm ảnh hoặc video ({serviceMediaIds.length})</Text></Pressable>
          {!ticket.assignedTechnicianId && ticket.status === 'OPEN' ? <ActionButton label="Nhận xử lý" onPress={() => void updateTicket('SCHEDULED')} /> : null}
          {(ticket.status === 'SCHEDULED' || (ticket.status === 'OPEN' && ticket.assignedTechnicianId === user?.id)) ? <ActionButton label="Bắt đầu xử lý" onPress={() => void updateTicket('IN_PROGRESS')} /> : null}
          {ticket.status === 'IN_PROGRESS' ? <ActionButton label="Xác nhận đã xử lý" onPress={() => void updateTicket('RESOLVED')} /> : null}
          {ticket.status === 'RESOLVED' ? <ActionButton label="Đóng phiếu" onPress={() => void updateTicket('CLOSED')} /> : null}
          <Text style={[styles.section, { marginTop: 24 }]}>Lịch sử dịch vụ</Text>
          {ticket.serviceHistory.length === 0 ? <Text style={styles.meta}>Chưa có thao tác dịch vụ.</Text> : ticket.serviceHistory.map((event) => <View key={event.id} style={styles.history}><Text style={styles.historyAction}>{event.action}</Text><Text style={styles.meta}>{event.note || 'Đã cập nhật dịch vụ'} · {new Date(event.occurredAt).toLocaleString('vi-VN')}</Text></View>)}
        </ScrollView>
      </View>
    );
  }

  if (asset) {
    return (
      <View style={styles.screen}>
        <Header title={asset.assetCode} subtitle={`${asset.project.name} · hết hạn ${new Date(asset.expiresAt).toLocaleDateString('vi-VN')}`} onBack={() => setAsset(null)} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>Tạo yêu cầu mới</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{issueTypes.map((item) => <Pressable key={item} onPress={() => setIssueType(item)} style={[styles.chip, issueType === item && styles.chipActive]}><Text style={[styles.chipText, issueType === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView>
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="Mô tả biểu hiện, vị trí và thời điểm phát sinh" placeholderTextColor="#98A2B3" style={styles.input} />
          <Pressable style={styles.mediaButton} onPress={() => void pickMedia('WARRANTY_ASSET', asset.id, setTicketMediaIds)}><Icon name="camera" size={18} color="#175CD3" /><Text style={styles.mediaButtonText}>Thêm ảnh hoặc video ({ticketMediaIds.length})</Text></Pressable>
          <ActionButton label="Gửi yêu cầu bảo hành" onPress={() => void createTicket()} />
          <Text style={[styles.section, { marginTop: 26 }]}>Phiếu bảo hành</Text>
          {asset.tickets.length === 0 ? <Text style={styles.meta}>Chưa có yêu cầu nào cho tài sản này.</Text> : asset.tickets.map((item) => <Pressable key={item.id} style={styles.card} onPress={() => { setTicket(item); setResolution(item.resolution || ''); }}><View style={styles.row}><View style={styles.ticketIcon}><Icon name="tool" color="#175CD3" /></View><View style={styles.grow}><Text style={styles.code}>{item.code}</Text><Text style={styles.assetName}>{item.issueType}</Text><Text style={styles.meta}>{statusLabel[item.status] || item.status}</Text></View><Icon name="chevron-right" color="#98A2B3" /></View></Pressable>)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Bảo hành & dịch vụ" subtitle="Quét QR hoặc tìm theo mã tài sản" onBack={() => router.back()} />
      <View style={styles.searchRow}><View style={styles.search}><Icon name="search" size={18} color="#667085" /><TextInput value={search} onChangeText={setSearch} placeholder="Mã bảo hành hoặc công trình" placeholderTextColor="#98A2B3" style={styles.searchInput} /></View><Pressable accessibilityLabel="Quét mã QR" style={styles.scanButton} onPress={() => void openScanner()}><Icon name="maximize" size={20} color={colors.white} /></Pressable></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} contentContainerStyle={styles.content}>
        {filtered.length === 0 ? <View style={styles.empty}><Icon name="tool" size={32} color="#175CD3" /><Text style={styles.emptyTitle}>{search ? 'Không tìm thấy tài sản' : 'Chưa có tài sản bảo hành'}</Text><Text style={styles.emptyText}>Quét QR hoặc kéo xuống để cập nhật danh sách.</Text></View> : null}
        {filtered.map((item) => <Pressable key={item.id} style={styles.card} onPress={() => setAsset(item)}><View style={styles.row}><View style={styles.ticketIcon}><Icon name="tool" color="#175CD3" /></View><View style={styles.grow}><Text style={styles.code}>{item.assetCode}</Text><Text style={styles.assetName}>{item.project.name}</Text><Text style={styles.meta}>{item.tickets.filter((entry) => !['CLOSED', 'REJECTED'].includes(entry.status)).length} yêu cầu đang mở</Text></View><Icon name="chevron-right" color="#98A2B3" /></View></Pressable>)}
      </ScrollView>
    </View>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return <View style={styles.header}><Pressable accessibilityLabel="Quay lại" style={styles.back} onPress={onBack}><Icon name="chevron-left" /></Pressable><View style={styles.grow}><Text style={styles.title} numberOfLines={1}>{title}</Text><Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text></View></View>;
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.primary} onPress={onPress}><Icon name="send" /><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white },
  grow: { flex: 1, minWidth: 0 },
  back: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.brandBlack.main },
  subtitle: { color: '#667085', fontSize: 12, marginTop: 3 },
  searchRow: { flexDirection: 'row', margin: 16, marginBottom: 0, gap: 8 },
  search: { flex: 1, height: 50, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: colors.brandBlack.main },
  scanButton: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#175CD3', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 14, marginBottom: 9 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ticketIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EFF8FF', alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 11 },
  assetName: { fontWeight: '900', fontSize: 15, marginTop: 2, color: colors.brandBlack.main },
  section: { fontWeight: '900', fontSize: 16, marginBottom: 10, color: colors.brandBlack.main },
  bodyText: { color: '#344054', fontSize: 13, lineHeight: 20 },
  meta: { color: '#667085', fontSize: 12, marginTop: 5, lineHeight: 18 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: '#D0D5DD' },
  chipActive: { borderColor: colors.brandOrange, backgroundColor: colors.orangeSoft },
  chipText: { color: '#475467', fontWeight: '700' },
  chipTextActive: { color: colors.brandOrangeText },
  input: { minHeight: 100, backgroundColor: colors.white, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, textAlignVertical: 'top', color: colors.brandBlack.main },
  mediaButton: { minHeight: 48, marginTop: 10, borderRadius: 9, backgroundColor: '#EFF8FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  mediaButtonText: { color: '#175CD3', fontWeight: '800', textAlign: 'center' },
  primary: { minHeight: 54, backgroundColor: colors.brandOrange, borderRadius: 10, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
  primaryText: { fontWeight: '900', textAlign: 'center' },
  history: { borderLeftWidth: 3, borderLeftColor: colors.brandOrange, paddingLeft: 12, paddingVertical: 7 },
  historyAction: { fontWeight: '900', color: colors.brandBlack.main },
  scanner: { flex: 1, backgroundColor: colors.brandBlack.main },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 18 },
  scanBox: { width: 240, height: 240, borderRadius: 22, borderWidth: 3, borderColor: colors.brandOrange },
  scanText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  cancelScan: { backgroundColor: colors.white, borderRadius: 22, paddingHorizontal: 24, paddingVertical: 11 },
  cancelScanText: { color: colors.brandBlack.main, fontWeight: '900' },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '900', color: colors.brandBlack.main },
  emptyText: { marginTop: 5, color: '#667085', fontSize: 12, textAlign: 'center' },
});
