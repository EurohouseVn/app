import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { InvoiceProviderCode, TaxBusinessLine, TaxEntityType, TaxPitMethod, UpdateWorkshopTaxProfileInput, WorkshopTaxProfile } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { Banner, Button, Card, Field, Input, Loading, SectionHead, Segmented, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api } from '../src/lib/api';
import { dmy, parseDmy } from '../src/lib/invoiceState';

const LINES: Array<{ key: TaxBusinessLine; title: string; hint: string }> = [
  { key: 'MANUFACTURING', title: 'Sản xuất, gia công nhôm kính', hint: 'Bán cửa, vách đã gia công' },
  { key: 'CONSTRUCTION_WITH_MATERIALS', title: 'Xây lắp có bao thầu vật tư', hint: 'Nhận thi công trọn gói gồm vật tư' },
];

const PROVIDERS: Array<{ key: InvoiceProviderCode; title: string; hint: string; disabled?: boolean }> = [
  { key: 'NONE', title: 'Chưa dùng', hint: 'Xuất hoá đơn ở hệ thống khác rồi ghi số vào app' },
  { key: 'SANDBOX', title: 'Bản thử', hint: 'Chạy thử luồng phát hành, số hoá đơn không có giá trị pháp lý' },
  { key: 'MISA', title: 'MISA meInvoice', hint: 'Sắp có: cần tài khoản API của xưởng', disabled: true },
];

type Form = {
  entityType: TaxEntityType; taxCode: string; legalName: string; legalAddress: string; locationCode: string;
  businessLine: TaxBusinessLine; vatRatePct: string; pitRatePct: string; pitMethod: TaxPitMethod;
  invoiceSeries: string; provider: InvoiceProviderCode; einvoiceRegisteredAt: string;
};

function pctText(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

function parsePct(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const value = Number(t);
  return Number.isFinite(value) ? value : Number.NaN;
}

function toForm(p: WorkshopTaxProfile): Form {
  return {
    entityType: p.entityType, taxCode: p.taxCode, legalName: p.legalName, legalAddress: p.legalAddress, locationCode: p.locationCode,
    businessLine: p.businessLine, vatRatePct: pctText(p.vatRatePct), pitRatePct: pctText(p.pitRatePct), pitMethod: p.pitMethod,
    invoiceSeries: p.invoiceSeries, provider: p.provider, einvoiceRegisteredAt: p.einvoiceRegisteredAt ? dmy(new Date(p.einvoiceRegisteredAt).toISOString().slice(0, 10)) : '',
  };
}

function Choice({ title, hint, active, disabled, onPress }: { title: string; hint: string; active: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, active && styles.choiceOn, disabled && { opacity: 0.5 }]}>
      <View style={[styles.radio, active && styles.radioOn]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <View style={wsStyles.grow}>
        <Text style={[styles.choiceTitle, active && { color: ws.orangeText }]}>{title}</Text>
        <Text style={wsStyles.rowMeta}>{hint}</Text>
      </View>
    </Pressable>
  );
}

export default function TaxProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<WorkshopTaxProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const row = await api.get<WorkshopTaxProfile>('/workshop/tax/profile');
      setProfile(row);
      setForm(toForm(row));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ thuế.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    const vat = parsePct(form.vatRatePct);
    const pit = parsePct(form.pitRatePct);
    if (Number.isNaN(vat) || Number.isNaN(pit)) { Alert.alert('Tỷ lệ chưa đúng', 'Nhập số %, ví dụ 3 hoặc 1,5. Để trống để dùng mức mặc định.'); return; }
    const registered = form.einvoiceRegisteredAt.trim() ? parseDmy(form.einvoiceRegisteredAt) : null;
    if (form.einvoiceRegisteredAt.trim() && !registered) { Alert.alert('Ngày đăng ký chưa đúng', 'Nhập theo dạng ngày/tháng/năm.'); return; }
    const body: UpdateWorkshopTaxProfileInput = {
      entityType: form.entityType, taxCode: form.taxCode, legalName: form.legalName, legalAddress: form.legalAddress, locationCode: form.locationCode,
      businessLine: form.businessLine, vatRatePct: vat, pitRatePct: pit, pitMethod: form.pitMethod, invoiceSeries: form.invoiceSeries,
      provider: form.provider, einvoiceRegisteredAt: registered,
    };
    setSaving(true);
    try {
      const saved = await api.put<WorkshopTaxProfile>('/workshop/tax/profile', body);
      setProfile(saved);
      setForm(toForm(saved));
      Alert.alert('Đã lưu hồ sơ thuế', saved.isComplete ? 'Đủ thông tin để lập và phát hành hoá đơn.' : 'Còn thiếu mã số thuế, tên đăng ký hoặc ký hiệu hoá đơn.');
    } catch (saveError) {
      Alert.alert('Chưa lưu được', saveError instanceof Error ? saveError.message : 'Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  }

  const header = <SubHeader title="Hồ sơ thuế" subtitle="Dùng cho hoá đơn và sổ doanh thu" onBack={() => router.back()} />;
  if (!form || !profile) {
    return <View style={wsStyles.screen}><Stack.Screen options={{ headerShown: false }} />{header}<View style={wsStyles.content}>{error ? <Banner tone="error" title="Chưa tải được" text={error} onPress={() => void load()} /> : <Loading />}</View></View>;
  }
  const d = profile.defaults;

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Segmented items={[['HKD', 'Hộ kinh doanh'], ['DN', 'Doanh nghiệp']]} value={form.entityType} onChange={(v) => set('entityType', v)} />

        <SectionHead title="Đăng ký kinh doanh" />
        <Card>
          <Field label={form.entityType === 'HKD' ? 'Tên hộ kinh doanh' : 'Tên doanh nghiệp'}><Input value={form.legalName} onChangeText={(v) => set('legalName', v)} placeholder="Theo giấy đăng ký kinh doanh" /></Field>
          <View style={wsStyles.row}>
            <Field label="Mã số thuế" style={wsStyles.half}><Input value={form.taxCode} onChangeText={(v) => set('taxCode', v)} keyboardType="number-pad" placeholder="10 hoặc 13 số" /></Field>
            <Field label="Mã địa điểm" style={wsStyles.half}><Input value={form.locationCode} onChangeText={(v) => set('locationCode', v)} placeholder="Nếu có" /></Field>
          </View>
          <Field label="Địa chỉ đăng ký"><Input value={form.legalAddress} onChangeText={(v) => set('legalAddress', v)} placeholder="Địa chỉ trên giấy đăng ký" /></Field>
        </Card>

        <SectionHead title="Ngành nghề và thuế" sub={`Mặc định ${d.year}: GTGT ${pctText(d.vatPct)}%, TNCN ${pctText(d.pitPct)}%${d.confirmed ? '' : ' (chưa xác nhận)'}`} />
        <Card>
          {LINES.map((line) => <Choice key={line.key} title={line.title} hint={line.hint} active={form.businessLine === line.key} onPress={() => set('businessLine', line.key)} />)}
          <View style={[wsStyles.row, styles.gapTop]}>
            <Field label="Tỷ lệ GTGT riêng (%)" style={wsStyles.half}><Input value={form.vatRatePct} onChangeText={(v) => set('vatRatePct', v)} keyboardType="decimal-pad" placeholder={`Mặc định ${pctText(d.vatPct)}`} /></Field>
            <Field label="Tỷ lệ TNCN riêng (%)" style={wsStyles.half}><Input value={form.pitRatePct} onChangeText={(v) => set('pitRatePct', v)} keyboardType="decimal-pad" placeholder={`Mặc định ${pctText(d.pitPct)}`} /></Field>
          </View>
          <Text style={styles.label}>Cách tính thuế TNCN khi doanh thu trên {d.exemptThreshold / 1_000_000_000} tỷ</Text>
          <Choice title="Theo tỷ lệ trên doanh thu" hint="TNCN = tỷ lệ × (doanh thu − 1 tỷ)" active={form.pitMethod === 'REVENUE_RATE'} onPress={() => set('pitMethod', 'REVENUE_RATE')} />
          <Choice title="Theo thu nhập" hint="TNCN = 15% × (doanh thu − chi phí). Trên 3 tỷ bắt buộc cách này" active={form.pitMethod === 'INCOME'} onPress={() => set('pitMethod', 'INCOME')} />
          {!d.confirmed ? <Text style={wsStyles.hint}>Tỷ lệ mặc định là mức quen dùng cho nghề nhôm kính, chưa xác nhận cho năm {d.year}. Nhờ kế toán kiểm tra rồi nhập tỷ lệ riêng nếu khác.</Text> : null}
        </Card>

        <SectionHead title="Hoá đơn" />
        <Card>
          <Field label="Ký hiệu hoá đơn"><Input value={form.invoiceSeries} onChangeText={(v) => set('invoiceSeries', v.toUpperCase())} autoCapitalize="characters" placeholder="Ví dụ 1C26TAP" /></Field>
          <Text style={styles.label}>Nhà cung cấp hoá đơn điện tử</Text>
          {PROVIDERS.map((p) => <Choice key={p.key} title={p.title} hint={p.hint} active={form.provider === p.key} disabled={p.disabled} onPress={() => set('provider', p.key)} />)}
          <Field label="Ngày đã đăng ký hoá đơn điện tử với cơ quan thuế"><Input value={form.einvoiceRegisteredAt} onChangeText={(v) => set('einvoiceRegisteredAt', v)} placeholder="dd/mm/yyyy · để trống nếu chưa" keyboardType="numbers-and-punctuation" /></Field>
        </Card>

        <View style={styles.note}>
          <Icon name="lock" size={14} color={ws.muted} />
          <Text style={styles.noteText}>App không lưu chữ ký số, mã PIN hay mật khẩu của nhà cung cấp. Khi nối MISA, việc ký diễn ra ở phía nhà cung cấp.</Text>
        </View>
        <View style={styles.gapTop}><Button label="Lưu hồ sơ thuế" icon="save" onPress={() => void save()} loading={saving} /></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  label: { color: ws.body, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: ws.line, marginBottom: 6 },
  choiceOn: { borderColor: ws.orange, backgroundColor: ws.orangeSoft },
  choiceTitle: { color: ws.ink, fontSize: 13.5, fontWeight: '800' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: ws.field, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: ws.orange },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ws.orange },
  note: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: ws.line },
  noteText: { flex: 1, color: ws.muted, fontSize: 11.5, lineHeight: 16 },
});
