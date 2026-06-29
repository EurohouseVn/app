import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { ProjectDetail } from '@eurohouse/types';
import { Icon } from '../../src/components/Icon';
import { api } from '../../src/lib/api';

type FieldKey =
  | 'contractValue' | 'extraRevenue'
  | 'costAluminum' | 'costAccessory' | 'costLockHinge' | 'costGasket'
  | 'costSilicone' | 'costScrew' | 'costGlass' | 'costLabor' | 'costOther' | 'costPartnerPct';

const revenueFields: { key: FieldKey; label: string }[] = [
  { key: 'contractValue', label: 'Giá nhận với chủ nhà' },
  { key: 'extraRevenue', label: 'Phát sinh tăng' },
];

const costFields: { key: FieldKey; label: string }[] = [
  { key: 'costAluminum', label: 'Thanh nhôm' },
  { key: 'costAccessory', label: 'Phụ kiện' },
  { key: 'costLockHinge', label: 'Khóa, bản lề' },
  { key: 'costGasket', label: 'Zoăng' },
  { key: 'costSilicone', label: 'Keo silicon' },
  { key: 'costScrew', label: 'Vít (gồm hao hụt)' },
  { key: 'costGlass', label: 'Kính' },
  { key: 'costLabor', label: 'Nhân công' },
  { key: 'costOther', label: 'Chi phí khác' },
];

function num(v: string): number {
  return Number(v.replace(/[^\d.-]/g, '')) || 0;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api.get<ProjectDetail>(`/projects/${id}`).then((p) => {
      setProject(p);
      setName(p.name);
      setCustomer(p.customerName);
      setForm({
        contractValue: String(p.contractValue), extraRevenue: String(p.extraRevenue),
        costAluminum: String(p.costAluminum), costAccessory: String(p.costAccessory),
        costLockHinge: String(p.costLockHinge), costGasket: String(p.costGasket),
        costSilicone: String(p.costSilicone), costScrew: String(p.costScrew),
        costGlass: String(p.costGlass), costLabor: String(p.costLabor),
        costOther: String(p.costOther), costPartnerPct: String(p.costPartnerPct),
      });
    }).catch(() => undefined);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Tính lợi nhuận realtime ngay trên app
  const revenue = num(form.contractValue) + num(form.extraRevenue);
  const baseCost = ['costAluminum', 'costAccessory', 'costLockHinge', 'costGasket', 'costSilicone', 'costScrew', 'costGlass', 'costLabor', 'costOther']
    .reduce((s, k) => s + num(form[k]), 0);
  const partnerCost = Math.round((revenue * num(form.costPartnerPct)) / 100);
  const totalCost = baseCost + partnerCost;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

  async function save() {
    if (!id) return;
    const payload: Record<string, unknown> = { name, customerName: customer };
    [...revenueFields, ...costFields, { key: 'costPartnerPct' as FieldKey, label: '' }].forEach(({ key }) => {
      payload[key] = num(form[key]);
    });
    await api.patch(`/projects/${id}`, payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  function field(key: FieldKey, label: string) {
    return (
      <View key={key} style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          value={form[key]}
          onChangeText={(v) => setForm((cur) => ({ ...cur, [key]: v }))}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
        <Text style={styles.topTitle}>{project?.code ?? 'Công trình'}</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Thông tin</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tên công trình</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Khách hàng</Text>
          <TextInput value={customer} onChangeText={setCustomer} style={styles.input} />
        </View>

        <Text style={styles.sectionTitle}>Doanh thu</Text>
        {revenueFields.map((f) => field(f.key, f.label))}

        <Text style={styles.sectionTitle}>Chi phí đầu vào</Text>
        {costFields.map((f) => field(f.key, f.label))}
        {field('costPartnerPct', '% chi phí đối tác')}

        {/* Bảng tổng hợp lợi nhuận */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Tổng hợp lợi nhuận</Text>
          <Row label="Doanh thu" value={revenue} />
          <Row label="Tổng chi phí" value={totalCost} />
          <View style={styles.divider} />
          <Row label="Lợi nhuận" value={profit} bold color={profit >= 0 ? colors.success : colors.danger} />
          <Text style={styles.margin}>Biên lợi nhuận: {margin}%</Text>
        </View>

        <Pressable style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveText}>{saved ? '✓ Đã lưu' : 'Lưu công trình'}</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold, color }: { label: string; value: number; bold?: boolean; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '900', color: colors.brandBlack }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: 20 }, color ? { color } : null]}>{value.toLocaleString('vi-VN')} đ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.brandBlack, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.white, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 40 },
  sectionTitle: { color: colors.brandBlack, fontSize: 16, fontWeight: '900', marginTop: 20, marginBottom: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.brandBlack, fontWeight: '700', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: colors.white, borderRadius: 14, padding: 14, color: colors.brandBlack, shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  summary: { backgroundColor: colors.white, borderRadius: 20, padding: 18, marginTop: 24, shadowColor: colors.brandBlack, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  summaryTitle: { color: colors.brandBlack, fontWeight: '900', fontSize: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { color: colors.brandGrey, fontWeight: '700' },
  rowValue: { color: colors.brandBlack, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#EEF0F3', marginVertical: 8 },
  margin: { color: colors.brandGrey, marginTop: 6, fontWeight: '700' },
  saveBtn: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveText: { color: colors.brandBlack, fontWeight: '900', fontSize: 16 },
});
