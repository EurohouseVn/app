import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { enqueueOperationsMutation } from '../src/lib/localProjects';
import { enqueueMedia } from '../src/lib/mediaQueue';

type Opening = {
  id: string;
  stableCode: string;
  description: string;
  widthMm?: number;
  heightMm?: number;
  measurementStatus: string;
  doorRequest?: { intentType: string };
};

type SurveyResponse = {
  project: { id: string; code: string; name: string; openings: Opening[] };
};

const INTENTS = ['Cửa đi', 'Cửa sổ', 'Vách kính', 'Ô thoáng', 'Khác'];

export default function SurveyScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [survey, setSurvey] = useState<SurveyResponse | null>(null);
  const [description, setDescription] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [intentType, setIntentType] = useState(INTENTS[0]);
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || projectId.startsWith('local-')) return;
    try {
      setSurvey(await api.get<SurveyResponse>(`/workshop/v2/projects/${projectId}/survey`));
    } catch (error) {
      Alert.alert('Chưa đồng bộ được', error instanceof Error ? error.message : 'Không tải được dữ liệu khảo sát.');
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function pickPhoto() {
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]?.uri) setPhotoUri(result.assets[0].uri);
  }

  async function queuePhoto(openingId: string): Promise<void> {
    if (!photoUri || !projectId) return;
    await enqueueMedia({ entityType: 'OPENING', entityId: openingId, uri: photoUri, fileName: `survey-${Date.now()}.jpg`, mime: 'image/jpeg', required: false });
  }

  async function saveAndNext() {
    if (!projectId) return;
    const width = Math.round(Number(widthMm));
    const height = Math.round(Number(heightMm));
    if (!(width > 0) || !(height > 0)) {
      Alert.alert('Thiếu kích thước', 'Vui lòng nhập chiều rộng và chiều cao theo mm.');
      return;
    }
    if (projectId.startsWith('local-')) {
      Alert.alert('Công trình đang chờ đồng bộ', 'Kết nối mạng và mở lại công trình trước khi thêm ô chờ.');
      return;
    }
    const payload = { projectId, description, widthMm: width, heightMm: height, intentType, installationNotes: note };
    setSaving(true);
    try {
      const opening = await api.post<Opening>(`/workshop/v2/projects/${projectId}/openings`, payload);
      if (note.trim()) await api.post(`/workshop/v2/projects/${projectId}/notes`, { openingId: opening.id, content: note.trim() });
      if (photoUri) await queuePhoto(opening.id);
      setDescription('');
      setWidthMm('');
      setHeightMm('');
      setNote('');
      setPhotoUri('');
      await load();
    } catch {
      const temporaryOpeningId = `local-opening-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await enqueueOperationsMutation({ entityType: 'OPENING', entityId: temporaryOpeningId, operation: 'CREATE', payload });
      if (photoUri) await queuePhoto(temporaryOpeningId);
      setDescription('');
      setWidthMm('');
      setHeightMm('');
      setNote('');
      setPhotoUri('');
      Alert.alert('Đã lưu chờ đồng bộ', 'Số đo đã được đưa vào hàng đợi và sẽ gửi lại khi có mạng.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}><Icon name="chevron-left" size={22} color={colors.brandBlack.main} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{survey?.project.code || 'KHẢO SÁT HIỆN TRƯỜNG'}</Text>
          <Text style={styles.title}>{survey?.project.name || 'Thêm ô chờ'}</Text>
        </View>
        <View style={styles.counter}><Text style={styles.counterText}>{survey?.project.openings.length || 0}</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Loại yêu cầu</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {INTENTS.map((item) => (
            <Pressable key={item} onPress={() => setIntentType(item)} style={[styles.chip, intentType === item && styles.chipActive]}>
              <Text style={[styles.chipText, intentType === item && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Mô tả vị trí</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Ví dụ: Cửa phòng khách, tầng 1" placeholderTextColor="#94A3B8" style={styles.input} />

        <View style={styles.dimensionRow}>
          <View style={{ flex: 1 }}><Text style={styles.label}>Rộng (mm)</Text><TextInput value={widthMm} onChangeText={setWidthMm} keyboardType="numeric" placeholder="1200" placeholderTextColor="#94A3B8" style={styles.dimensionInput} /></View>
          <Text style={styles.multiply}>×</Text>
          <View style={{ flex: 1 }}><Text style={styles.label}>Cao (mm)</Text><TextInput value={heightMm} onChangeText={setHeightMm} keyboardType="numeric" placeholder="2200" placeholderTextColor="#94A3B8" style={styles.dimensionInput} /></View>
        </View>

        <Text style={styles.label}>Ghi chú lắp đặt</Text>
        <TextInput value={note} onChangeText={setNote} multiline placeholder="Tường, cốt nền, hướng mở hoặc lưu ý hiện trường" placeholderTextColor="#94A3B8" style={[styles.input, styles.noteInput]} />

        <Pressable onPress={pickPhoto} style={styles.photoButton}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : <><Icon name="camera" size={24} color={colors.brandOrangeText} /><Text style={styles.photoText}>Chụp ảnh vị trí</Text></>}
        </Pressable>

        <Pressable disabled={saving} onPress={saveAndNext} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          <Icon name="save" size={19} color={colors.brandBlack.main} />
          <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu & thêm ô tiếp theo'}</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Ô chờ đã khảo sát</Text>
        {(survey?.project.openings || []).map((opening) => (
          <View key={opening.id} style={styles.openingRow}>
            <View style={styles.openingIcon}><Icon name="maximize-2" size={18} color={colors.brandOrangeText} /></View>
            <View style={{ flex: 1 }}><Text style={styles.openingCode}>{opening.stableCode}</Text><Text style={styles.openingDescription}>{opening.description || opening.doorRequest?.intentType || 'Ô chờ'}</Text></View>
            <Text style={styles.openingSize}>{opening.widthMm} × {opening.heightMm}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 18, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#E7EAF0' },
  iconButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '800' },
  title: { color: colors.brandBlack.main, fontSize: 20, fontWeight: '900', marginTop: 2 },
  counter: { minWidth: 36, height: 36, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  counterText: { color: colors.brandOrangeText, fontWeight: '900' },
  content: { padding: 18, paddingBottom: 120 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 17, fontWeight: '900', marginBottom: 12 },
  chips: { gap: 8, paddingBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#DDE2E8', backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  chipActive: { borderColor: colors.brandOrange, backgroundColor: colors.orangeSoft },
  chipText: { color: colors.brandGrey[500], fontWeight: '700' },
  chipTextActive: { color: colors.brandOrangeText },
  label: { color: colors.brandBlack.main, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 7 },
  input: { minHeight: 50, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E1E5EA', borderRadius: 10, paddingHorizontal: 14, color: colors.brandBlack.main },
  dimensionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  dimensionInput: { height: 58, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E1E5EA', borderRadius: 10, paddingHorizontal: 14, fontSize: 22, fontWeight: '900', color: colors.brandBlack.main },
  multiply: { color: colors.brandGrey[500], fontSize: 24, fontWeight: '700', paddingBottom: 15 },
  noteInput: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
  photoButton: { height: 112, marginTop: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brandOrange, borderRadius: 10, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoText: { color: colors.brandOrangeText, fontWeight: '800' },
  saveButton: { height: 56, marginTop: 16, borderRadius: 10, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  openingRow: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  openingIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  openingCode: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900' },
  openingDescription: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '700', marginTop: 2 },
  openingSize: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '900' },
});
