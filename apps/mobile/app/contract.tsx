import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import type { QuotationRecord } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { API_URL, api, authHeaders } from '../src/lib/api';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';

export default function ContractScreen() {
  const { quotationId } = useLocalSearchParams<{ quotationId: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [quotation, setQuotation] = useState<QuotationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    contractNumber: '', advanceAmount: '', constructionDays: '',
    paymentTerms: 'Thanh toán theo các đợt được hai bên thống nhất và ghi rõ trước khi ký hợp đồng.',
    paymentCommitment: 'Bên A thanh toán đúng tiến độ; mỗi khoản thanh toán có chứng từ hoặc xác nhận hợp lệ.',
    warrantyTerms: 'Bảo hành lỗi kỹ thuật thuộc phạm vi thi công theo thỏa thuận; không bao gồm hư hỏng do sử dụng sai, ngoại lực hoặc bên thứ ba.',
    customTerms: '',
  });
  useResetScrollOnFocus(scrollRef);

  useEffect(() => {
    if (!quotationId) return;
    api.get<QuotationRecord>(`/quotations/${quotationId}`)
      .then((data) => {
        setQuotation(data);
        setForm((current) => ({ ...current, contractNumber: `HĐ-${data.code}` }));
      })
      .catch((error) => Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được báo giá.'))
      .finally(() => setLoading(false));
  }, [quotationId]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const exportContract = async () => {
    if (!quotation) return;
    setExporting(true);
    try {
      const url = `${API_URL}/quotations/${quotation.id}/contract-pdf`;
      const body = JSON.stringify(form);
      if (Platform.OS === 'web') {
        const response = await fetch(url, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body });
        if (!response.ok) throw new Error(await response.text() || 'Không tạo được hợp đồng.');
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `hop-dong-${quotation.code}.pdf`;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const result = await fetch(url, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body });
        if (!result.ok) throw new Error(await result.text() || 'Không tạo được hợp đồng.');
        const buffer = await result.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
        const uri = `${FileSystem.cacheDirectory}hop-dong-${quotation.code}.pdf`;
        await FileSystem.writeAsStringAsync(uri, globalThis.btoa(binary), { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Hợp đồng ${quotation.code}` });
        else Alert.alert('Đã tạo hợp đồng', `File đã lưu tại ${uri}`);
      }
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tạo được hợp đồng PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}><Icon name="chevron-left" size={22} color={colors.brandBlack.main} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.title}>Soạn hợp đồng</Text><Text style={styles.subtitle}>{quotation?.code || 'Đang tải báo giá...'}</Text></View>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.brandOrange} /> : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>Giá trị theo báo giá</Text>
            <Text style={styles.summaryValue}>{(quotation?.totalAmount || 0).toLocaleString('vi-VN')} đ</Text>
            <Text style={styles.summaryMeta}>{quotation?.customerName || 'Khách hàng chưa nhập tên'}</Text>
          </View>
          <Field label="Số hợp đồng" value={form.contractNumber} onChangeText={(v) => update('contractNumber', v)} placeholder="HĐ-BG-..." />
          <Field label="Tiền tạm ứng" value={form.advanceAmount} onChangeText={(v) => update('advanceAmount', v)} placeholder="Để trống và điền khi chốt với khách" keyboardType="numeric" />
          <Field label="Thời gian thi công" value={form.constructionDays} onChangeText={(v) => update('constructionDays', v)} placeholder="Ví dụ: 20 ngày kể từ khi nhận tạm ứng" />
          <Field label="Điều khoản thanh toán" value={form.paymentTerms} onChangeText={(v) => update('paymentTerms', v)} multiline />
          <Field label="Cam kết thanh toán" value={form.paymentCommitment} onChangeText={(v) => update('paymentCommitment', v)} multiline />
          <Field label="Bảo hành và chất lượng" value={form.warrantyTerms} onChangeText={(v) => update('warrantyTerms', v)} multiline />
          <Field label="Điều khoản bổ sung" value={form.customTerms} onChangeText={(v) => update('customTerms', v)} placeholder="Nội dung tùy biến khác (nếu có)" multiline />
          <Pressable style={[styles.exportButton, exporting && { opacity: 0.6 }]} disabled={exporting} onPress={exportContract}>
            {exporting ? <ActivityIndicator color={colors.brandBlack.main} /> : <Icon name="file-text" size={18} color={colors.brandBlack.main} />}
            <Text style={styles.exportText}>{exporting ? 'Đang tạo hợp đồng...' : 'Sinh hợp đồng PDF'}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: 'numeric' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline} keyboardType={keyboardType} style={[styles.input, multiline && styles.multiline]} placeholderTextColor="#94A3B8" textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandGrey[50] },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.brandGrey[100] },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandGrey[100], alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.brandBlack.main },
  subtitle: { fontSize: 12, fontWeight: '700', color: colors.brandGrey[500], marginTop: 2 },
  content: { padding: 16, paddingBottom: 120 },
  summary: { backgroundColor: colors.orangeSoft, borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: '#FED7AA' },
  summaryLabel: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: colors.brandBlack.main, fontSize: 24, fontWeight: '900', marginTop: 5 },
  summaryMeta: { color: colors.brandGrey[700], fontSize: 13, marginTop: 6 },
  field: { marginBottom: 14 }, label: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.brandGrey[200], borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 11, color: colors.brandBlack.main },
  multiline: { minHeight: 96 },
  exportButton: { minHeight: 54, borderRadius: 14, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  exportText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
});
