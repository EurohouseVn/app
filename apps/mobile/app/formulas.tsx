import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

type Step = 1 | 2 | 3 | 4;

type FormulaSystem = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  profileCount?: number;
  templateCount: number;
};

type FormulaType = {
  id: string;
  name: string;
  templateCount: number;
  popularCount?: number;
};

type FormulaTemplate = {
  id: string;
  templateId: string;
  systemName: string;
  windowTypeName: string;
  templateName: string;
  sourceSystemName?: string;
  imageUrl?: string;
  variantCount?: number;
  isPopular?: boolean;
};

type RequiredInput = {
  id: string;
  name: string;
  type?: 'number' | 'string';
  unit?: string;
};

type DoorSet = {
  id: string;
  name: string;
  template: FormulaTemplate;
  inputs: Record<string, string>;
};

type FormulaCalcResult = {
  aluminum?: { name?: string; position?: string; code?: string; angle?: string; quantity?: number; length_mm?: number; total_kg?: number }[];
  glass?: { name?: string; width_mm?: number; height_mm?: number; quantity?: number; area_m2?: number; position?: string }[];
  accessories?: { name?: string; code?: string; unit?: string; quantity?: number }[];
};

type DoorResult = {
  setId: string;
  setName: string;
  templateName: string;
  result: FormulaCalcResult;
};

const DEFAULT_INPUTS: RequiredInput[] = [
  { id: 'width', name: 'Rộng cửa', type: 'number', unit: 'mm' },
  { id: 'height', name: 'Cao cửa', type: 'number', unit: 'mm' },
  { id: 'quantity', name: 'Số bộ', type: 'number' },
];

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function inputDefaults(inputs: RequiredInput[], quantity = '1') {
  const values: Record<string, string> = {};
  for (const input of inputs) {
    if (input.id === 'quantity') values[input.id] = quantity;
    else values[input.id] = '';
  }
  return values;
}

function normalizeInputs(inputs: RequiredInput[]) {
  const seen = new Set<string>();
  const merged = [...DEFAULT_INPUTS, ...inputs].filter((input) => {
    if (seen.has(input.id)) return false;
    seen.add(input.id);
    return true;
  });
  return merged.filter((input) => !['aluminum_price', 'glass_price'].includes(input.id));
}

function formatNumber(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

export default function FormulasScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [systems, setSystems] = useState<FormulaSystem[]>([]);
  const [types, setTypes] = useState<FormulaType[]>([]);
  const [templates, setTemplates] = useState<FormulaTemplate[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<FormulaSystem | null>(null);
  const [selectedType, setSelectedType] = useState<FormulaType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormulaTemplate | null>(null);
  const [requiredInputs, setRequiredInputs] = useState<RequiredInput[]>(DEFAULT_INPUTS);
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, string>>(inputDefaults(DEFAULT_INPUTS));
  const [doorName, setDoorName] = useState('D1');
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [doorSets, setDoorSets] = useState<DoorSet[]>([]);
  const [results, setResults] = useState<DoorResult[]>([]);
  const [calculating, setCalculating] = useState(false);

  const loadSystems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<FormulaSystem[]>('/system-formulas/template-systems');
      setSystems(data);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được hệ nhôm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSystems(); }, [loadSystems]);

  const summaryAluminum = useMemo(() => {
    const map = new Map<string, { code: string; name: string; length: number; quantity: number }>();
    for (const item of results.flatMap((row) => row.result.aluminum ?? [])) {
      if (!item.code || !item.length_mm) continue;
      const key = `${item.code}:${item.length_mm}`;
      const current = map.get(key) ?? { code: item.code, name: item.name || item.position || 'Thanh nhôm', length: item.length_mm, quantity: 0 };
      current.quantity += Number(item.quantity || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code) || b.length - a.length);
  }, [results]);

  async function selectSystem(system: FormulaSystem) {
    setSelectedSystem(system);
    setSelectedType(null);
    setSelectedTemplate(null);
    setTypes([]);
    setTemplates([]);
    setStep(2);
    setLoading(true);
    try {
      const data = await api.get<FormulaType[]>(`/system-formulas/template-types?eurohouseSystemId=${encodeURIComponent(system.id)}`);
      setTypes(data);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được loại cửa.');
    } finally {
      setLoading(false);
    }
  }

  async function selectType(type: FormulaType) {
    if (!selectedSystem) return;
    setSelectedType(type);
    setSelectedTemplate(null);
    setTemplates([]);
    setStep(3);
    setLoading(true);
    try {
      const data = await api.get<FormulaTemplate[]>(`/system-formulas/templates?eurohouseSystemId=${encodeURIComponent(selectedSystem.id)}&windowTypeName=${encodeURIComponent(type.name)}&onlyPopular=true`);
      setTemplates(data);
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được mẫu cửa.');
    } finally {
      setLoading(false);
    }
  }

  async function selectTemplate(template: FormulaTemplate) {
    setSelectedTemplate(template);
    setCurrentSetId(null);
    setDoorName(`D${doorSets.length + 1}`);
    setResults([]);
    setStep(4);
    setLoading(true);
    try {
      const detail = await api.get<{ requiredInputs?: RequiredInput[] }>(`/formulas/templates/${template.templateId}`);
      const inputs = normalizeInputs(detail.requiredInputs?.length ? detail.requiredInputs : DEFAULT_INPUTS);
      setRequiredInputs(inputs);
      setDynamicInputs(inputDefaults(inputs));
    } catch {
      setRequiredInputs(DEFAULT_INPUTS);
      setDynamicInputs(inputDefaults(DEFAULT_INPUTS));
    } finally {
      setLoading(false);
    }
  }

  function validateCurrent() {
    const missing = requiredInputs.filter((input) => {
      const required = ['width', 'height', 'quantity'].includes(input.id);
      return required && !dynamicInputs[input.id];
    });
    if (missing.length > 0) {
      Alert.alert('Thiếu kích thước', `Vui lòng nhập: ${missing.map((input) => input.name).join(', ')}`);
      return false;
    }
    return true;
  }

  function saveCurrentSet() {
    if (!selectedTemplate) return doorSets;
    if (!validateCurrent()) return null;
    const id = currentSetId ?? nextId();
    const set: DoorSet = {
      id,
      name: doorName.trim() || `D${doorSets.length + 1}`,
      template: selectedTemplate,
      inputs: { ...dynamicInputs },
    };
    const next = currentSetId ? doorSets.map((item) => (item.id === currentSetId ? set : item)) : [...doorSets, set];
    setDoorSets(next);
    setCurrentSetId(id);
    return next;
  }

  function addAnotherDoor() {
    const saved = saveCurrentSet();
    if (!saved) return;
    setSelectedTemplate(null);
    setRequiredInputs(DEFAULT_INPUTS);
    setDynamicInputs(inputDefaults(DEFAULT_INPUTS));
    setDoorName(`D${saved.length + 1}`);
    setCurrentSetId(null);
    setStep(3);
  }

  function handleSaveCurrentSet() {
    const saved = saveCurrentSet();
    if (!saved) return;
    Alert.alert('Đã lưu bộ cửa', `${doorName.trim() || `D${saved.length}`} đã được đưa vào danh sách tính cắt.`);
  }

  async function calculateAll() {
    const saved = selectedTemplate ? saveCurrentSet() : doorSets;
    if (!saved || saved.length === 0) {
      Alert.alert('Chưa có bộ cửa', 'Vui lòng chọn mẫu cửa và lưu ít nhất một bộ cửa.');
      return;
    }

    setCalculating(true);
    try {
      const rows: DoorResult[] = [];
      for (const set of saved) {
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(set.inputs)) {
          payload[key] = key === 'glass_type' ? value : Number(value) || value;
        }
        const result = await api.post<FormulaCalcResult>(`/formulas/templates/${set.template.templateId}/calc`, payload);
        rows.push({ setId: set.id, setName: set.name, templateName: set.template.templateName, result });
      }
      setResults(rows);
    } catch (error) {
      Alert.alert('Lỗi tính công thức', error instanceof Error ? error.message : 'Không tính được công thức cắt.');
    } finally {
      setCalculating(false);
    }
  }

  function goBack() {
    if (step === 1) router.back();
    else setStep((step - 1) as Step);
  }

  const renderHeader = () => (
    <View style={styles.header}>
      {step > 1 ? (
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={colors.brandBlack.main} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Công Thức Cắt</Text>
        <Text style={styles.subtitle}>{selectedSystem?.name || 'Chọn hệ nhôm để bắt đầu'}</Text>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={styles.progress}>
      {[1, 2, 3, 4].map((item, index) => (
        <React.Fragment key={item}>
          <View style={[styles.stepDot, step >= item && styles.stepDotActive]}>
            <Text style={[styles.stepText, step >= item && styles.stepTextActive]}>{item}</Text>
          </View>
          {index < 3 ? <View style={[styles.stepLine, step > item && styles.stepLineActive]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );

  const renderSystemStep = () => (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn Hệ Nhôm</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      {!loading && systems.length === 0 ? <Text style={styles.emptyText}>Chưa có dữ liệu hệ nhôm. Hãy kiểm tra seed công thức.</Text> : null}
      {systems.map((system) => (
        <Pressable key={system.id} style={styles.listCard} onPress={() => selectSystem(system)}>
          <View style={styles.listIcon}><Icon name="layers" size={18} color={colors.brandOrangeText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{system.name}</Text>
            <Text style={styles.cardSub}>{system.profileCount || 0} mã thanh · {system.templateCount} mẫu tham chiếu</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.brandGrey[500]} />
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderTypeStep = () => (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn loại cửa</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      {types.map((type) => (
        <Pressable key={type.id} style={styles.listCard} onPress={() => selectType(type)}>
          <View style={styles.listIcon}><Icon name="layout" size={18} color={colors.brandOrangeText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{type.name}</Text>
            <Text style={styles.cardSub}>{type.popularCount ? `${type.popularCount} mẫu thông dụng / ` : ''}{type.templateCount} mẫu tham chiếu</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.brandGrey[500]} />
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderTemplateStep = () => (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn mẫu cửa</Text>
      <Text style={styles.helperText}>{selectedType?.name} · Mẫu tham chiếu tạm thời</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      <View style={styles.templateGrid}>
        {templates.map((template) => (
          <Pressable key={template.templateId} style={[styles.templateCard, selectedTemplate?.templateId === template.templateId && styles.templateCardActive]} onPress={() => selectTemplate(template)}>
            <View style={styles.templateImageWrap}>
              {template.imageUrl ? <Image source={{ uri: assetUrl(template.imageUrl) }} style={styles.templateImage} resizeMode="contain" /> : <Text style={styles.emptyText}>No image</Text>}
            </View>
            <View style={styles.templateBody}>
              <Text style={styles.templateName} numberOfLines={2}>{template.templateName}</Text>
              <Text style={styles.cardSub}>{template.isPopular ? 'Thông dụng' : (template.sourceSystemName || `${template.variantCount || 0} biến thể`)}</Text>
            </View>
            {selectedTemplate?.templateId === template.templateId ? (
              <View style={styles.checkBadge}><Icon name="check" size={13} color={colors.brandBlack.main} /></View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const renderInputStep = () => (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {selectedTemplate?.imageUrl ? (
        <View style={styles.heroImageCard}>
          <Image source={{ uri: assetUrl(selectedTemplate.imageUrl) }} style={styles.heroImage} resizeMode="contain" />
        </View>
      ) : null}

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{selectedTemplate?.templateName}</Text>
        <Text style={styles.helperText}>{selectedType?.name} · {selectedSystem?.code || selectedSystem?.name}</Text>
        <View style={styles.fieldFull}>
          <Text style={styles.inputLabel}>Tên bộ cửa</Text>
          <TextInput style={styles.input} value={doorName} onChangeText={setDoorName} placeholder="VD: D1, D2, Cửa chính" placeholderTextColor="#94A3B8" />
        </View>

        {loading ? <ActivityIndicator color={colors.brandOrange} /> : (
          <View style={styles.inputGrid}>
            {requiredInputs.map((input) => (
              <View key={input.id} style={styles.inputCell}>
                <Text style={styles.inputLabel}>{input.name}{input.unit ? ` (${input.unit})` : ''}</Text>
                <TextInput
                  style={styles.input}
                  value={dynamicInputs[input.id] || ''}
                  onChangeText={(value) => setDynamicInputs((current) => ({ ...current, [input.id]: input.type === 'string' ? value : value.replace(/[^0-9.]/g, '') }))}
                  keyboardType={input.type === 'string' ? 'default' : 'numeric'}
                  placeholder="Nhập số"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryAction} onPress={handleSaveCurrentSet}>
            <Icon name="save" size={15} color={colors.brandOrangeText} />
            <Text style={styles.secondaryActionText}>Lưu</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={addAnotherDoor}>
            <Icon name="plus" size={15} color={colors.brandOrangeText} />
            <Text style={styles.secondaryActionText}>Thêm bộ</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.primaryAction, calculating && { opacity: 0.6 }]} disabled={calculating} onPress={calculateAll}>
          {calculating ? <ActivityIndicator color={colors.brandBlack.main} /> : <Icon name="tool" size={17} color={colors.brandBlack.main} />}
          <Text style={styles.primaryActionText}>Tính toán công thức cắt</Text>
        </Pressable>
      </View>

      {doorSets.length > 0 ? (
        <View style={styles.savedBox}>
          <Text style={styles.smallTitle}>Bộ cửa đã lưu</Text>
          {doorSets.map((set) => (
            <View key={set.id} style={styles.savedRow}>
              <Text style={styles.savedName}>{set.name}</Text>
              <Text style={styles.savedMeta}>{set.template.windowTypeName} · {set.inputs.width || '-'}x{set.inputs.height || '-'}mm · SL {set.inputs.quantity || '1'}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {results.length > 0 ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>Tổng thanh nhôm cần cắt</Text>
          {summaryAluminum.map((item) => (
            <View key={`${item.code}-${item.length}`} style={styles.resultRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{item.code}</Text>
                <Text style={styles.cardSub}>{item.name}</Text>
              </View>
              <Text style={styles.resultValue}>{formatNumber(item.length)} mm x {formatNumber(item.quantity)}</Text>
            </View>
          ))}

          {results.map((row) => (
            <View key={row.setId} style={styles.doorResult}>
              <Text style={styles.smallTitle}>{row.setName} · {row.templateName}</Text>
              {(row.result.glass ?? []).map((glass, index) => (
                <Text key={`${row.setId}-glass-${index}`} style={styles.glassLine}>
                  Kính: {formatNumber(glass.width_mm)} x {formatNumber(glass.height_mm)} mm · SL {formatNumber(glass.quantity)}
                </Text>
              ))}
              {(row.result.accessories ?? []).slice(0, 8).map((accessory, index) => (
                <Text key={`${row.setId}-acc-${index}`} style={styles.glassLine}>
                  Phụ kiện: {accessory.name || accessory.code || '-'} · SL {formatNumber(Number(accessory.quantity || 0))}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {renderHeader()}
      {renderProgress()}
      {step === 1 ? renderSystemStep() : null}
      {step === 2 ? renderTypeStep() : null}
      {step === 3 ? renderTemplateStep() : null}
      {step === 4 ? renderInputStep() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.brandGrey[50] },
  header: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 16, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.brandGrey[200] },
  backBtn: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.brandGrey[100], alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 21 },
  subtitle: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 12, marginTop: 3 },
  progress: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  stepDot: { width: 25, height: 25, borderRadius: 999, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.brandOrange },
  stepText: { color: colors.brandGrey[600], fontWeight: '900', fontSize: 12 },
  stepTextActive: { color: colors.brandBlack.main },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 5 },
  stepLineActive: { backgroundColor: colors.brandOrange },
  container: { padding: 18, paddingBottom: 120 },
  sectionTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 18, marginBottom: 8 },
  helperText: { color: colors.brandGrey[500], fontWeight: '700', marginBottom: 14 },
  emptyText: { color: colors.brandGrey[500], textAlign: 'center', fontWeight: '700' },
  listCard: { minHeight: 72, backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  listIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  cardSub: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 12, marginTop: 3 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  templateCard: { width: '48%', minHeight: 206, backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', marginBottom: 10 },
  templateCardActive: { borderColor: colors.brandOrange },
  templateImageWrap: { height: 132, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 8 },
  templateImage: { width: '100%', height: '100%' },
  templateBody: { padding: 12 },
  templateName: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13, minHeight: 34 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 999, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' },
  heroImageCard: { backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  heroImage: { width: '100%', height: 210, backgroundColor: '#F8FAFC' },
  formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 14 },
  fieldFull: { marginBottom: 12 },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inputCell: { flexBasis: '48%', flexGrow: 1 },
  inputLabel: { color: colors.brandGrey[600], fontWeight: '800', fontSize: 12, marginBottom: 6 },
  input: { minHeight: 46, backgroundColor: colors.brandGrey[50], borderRadius: 12, paddingHorizontal: 12, color: colors.brandBlack.main, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryAction: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.white },
  secondaryActionText: { color: colors.brandOrangeText, fontWeight: '900' },
  primaryAction: { minHeight: 52, borderRadius: 15, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  primaryActionText: { color: colors.brandBlack.main, fontWeight: '900' },
  savedBox: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 14 },
  smallTitle: { color: colors.brandBlack.main, fontWeight: '900', marginBottom: 8 },
  savedRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.brandGrey[100] },
  savedName: { color: colors.brandBlack.main, fontWeight: '900' },
  savedMeta: { color: colors.brandGrey[500], fontWeight: '700', marginTop: 3, fontSize: 12 },
  resultBox: { backgroundColor: colors.white, borderRadius: 18, padding: 16 },
  resultTitle: { color: colors.success, fontWeight: '900', fontSize: 16, marginBottom: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.brandGrey[100] },
  resultName: { color: colors.brandBlack.main, fontWeight: '900' },
  resultValue: { color: colors.brandOrangeText, fontWeight: '900' },
  doorResult: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.brandGrey[200] },
  glassLine: { color: colors.brandGrey[700], fontWeight: '700', lineHeight: 20 },
});
