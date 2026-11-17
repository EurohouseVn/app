import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import { filterCuttingFormulaSystems, type FormulaCapability } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { API_URL, api, assetUrl, authHeaders } from '../src/lib/api';
import { resetScrollToTop, useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import { confirmAction } from '../src/lib/alert';
import { useAuth } from '../src/lib/auth';
import { formulaUiState, guardFormulaCall } from '../src/lib/formulaAccess';

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
};

type FormulaTemplate = {
  id: string;
  templateId: string;
  systemName: string;
  windowTypeName: string;
  templateName: string;
  description?: string;
  imageUrl?: string;
  status?: string;
  revision?: number;
  requiredInputs?: RequiredInput[];
};

type RequiredInput = {
  id: string;
  name: string;
  type?: 'number' | 'string' | 'boolean';
  unit?: string;
  defaultValue?: string | number;
  required?: boolean;
};

type DoorSet = {
  id: string;
  name: string;
  template: FormulaTemplate;
  inputs: Record<string, string>;
};

type FormulaCalcResult = {
  aluminum?: { systemCode?: string; name?: string; position?: string; code?: string; angle?: string; quantity?: number; length_mm?: number; total_kg?: number }[];
  glass?: { name?: string; width_mm?: number; height_mm?: number; quantity?: number; area_m2?: number; position?: string }[];
  accessories?: { name?: string; code?: string; unit?: string; quantity?: number }[];
};

type DoorResult = {
  setId: string;
  setName: string;
  templateName: string;
  result: FormulaCalcResult;
};

type CuttingPlanRequest = {
  planRef: string;
  sets: Array<{ setId: string; setName: string; templateId: string; inputs: Record<string, unknown> }>;
};

type CuttingPlan = {
  planRef: string;
  generatedAt: string;
  sets: Array<DoorResult & { templateId: string }>;
  materials: Array<{
    materialCode: string;
    materialName?: string;
    newBarsNeeded: number;
    newDeXeGenerated: number[];
    kgPerMeter: number;
    inputKg: number;
    finishedKg: number;
    reusableRemnantKg: number;
    scrapGeneratedKg: number;
  }>;
  summary: {
    totalInputKg: number;
    newStockKg: number;
    reusedDeXeKg: number;
    finishedKg: number;
    reusableRemnantKg: number;
    scrapKg: number;
    newBars: number;
    reusedDeXePieces: number;
    reusableRemnantPieces: number;
    massBalanceDifferenceKg: number;
  };
};

const DEFAULT_INPUTS: RequiredInput[] = [
  { id: 'W', name: 'Chiều rộng bộ cửa', type: 'number', unit: 'mm' },
  { id: 'H', name: 'Chiều cao bộ cửa', type: 'number', unit: 'mm' },
  { id: 'Q', name: 'Số lượng bộ', type: 'number', unit: 'bộ', defaultValue: 1 },
];

const MAX_ACTIVE_DOOR_HEIGHT_MM = 2800;

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function inputDefaults(inputs: RequiredInput[], quantity = '1') {
  const values: Record<string, string> = {};
  for (const input of inputs) {
    if (input.type === 'boolean') values[input.id] = String(Number(input.defaultValue ?? 0) ? 1 : 0);
    else if (input.id === 'Q') values[input.id] = String(input.defaultValue ?? quantity);
    else values[input.id] = input.defaultValue === undefined || input.defaultValue === null ? '' : String(input.defaultValue);
  }
  return values;
}

function normalizeInputs(inputs: RequiredInput[]) {
  const seen = new Set<string>();
  const merged = inputs.filter((input) => {
    if (seen.has(input.id)) return false;
    seen.add(input.id);
    return true;
  });
  return merged;
}

function formatNumber(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function formatKg(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${Number(value).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return globalThis.btoa(binary);
}

function inputSummary(set: DoorSet) {
  const supportsTopFix = Object.prototype.hasOwnProperty.call(set.inputs, 'HAS_TOP_FIX');
  const hasTopFix = set.inputs.HAS_TOP_FIX === '1';
  return Object.entries(set.inputs)
    .filter(([key]) => key !== 'HAS_TOP_FIX' && (key !== 'FIX_H' || hasTopFix))
    .map(([key, value]) => `${key} ${value}`)
    .concat(supportsTopFix ? [hasTopFix ? 'Có ô fix 3 khoang' : 'Không ô fix'] : [])
    .join(' · ');
}

export default function FormulasScreen() {
  const { user } = useAuth();
  const capability = user?.capabilities.eurohouse.features.FORMULA_CUTTING ?? user?.capabilities.formulas;
  const ui = formulaUiState(capability);
  const router = useRouter();
  if (ui.showLockedScreen) {
    return <View style={styles.lockedScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.lockedIcon}><Icon name="lock" size={28} color={colors.brandOrangeText} /></View>
      <Text style={styles.lockedEyebrow}>{ui.statusLabel}</Text>
      <Text style={styles.lockedTitle}>{ui.message}</Text>
      <Text style={styles.lockedCopy}>Công thức Eurohouse được mở riêng cho từng cơ sở bởi NPP phụ trách. Báo giá thủ công và các tiện ích quản lý miễn phí vẫn sử dụng bình thường.</Text>
      <Pressable style={styles.lockedAction} onPress={() => router.push('/profile')}><Text style={styles.lockedActionText}>Nhập mã mời NPP</Text></Pressable>
    </View>;
  }
  return <ActiveFormulasScreen capability={capability!} />;
}

function ActiveFormulasScreen({ capability }: { capability: FormulaCapability }) {
  const router = useRouter();
  const inputScrollRef = React.useRef<ScrollView>(null);
  const pendingResultScrollRef = React.useRef(false);
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
  const [cuttingPlan, setCuttingPlan] = useState<CuttingPlan | null>(null);
  const [cuttingPlanRequest, setCuttingPlanRequest] = useState<CuttingPlanRequest | null>(null);
  const [savingRemnants, setSavingRemnants] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [remnantsCommitted, setRemnantsCommitted] = useState(false);

  useResetScrollOnFocus(inputScrollRef);

  useEffect(() => {
    const timer = setTimeout(() => resetScrollToTop(inputScrollRef), 0);
    return () => clearTimeout(timer);
  }, [step]);

  const loadSystems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await guardFormulaCall(capability, () => api.get<FormulaSystem[]>('/system-formulas/managed/systems'));
      setSystems(filterCuttingFormulaSystems(data));
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được hệ nhôm.');
    } finally {
      setLoading(false);
    }
  }, [capability]);

  useEffect(() => { loadSystems(); }, [loadSystems]);

  const removeDoorSet = useCallback((set: DoorSet) => {
    confirmAction('Xoá bộ cửa', `Xoá ${set.name} khỏi danh sách tính toán?`, () => {
      setDoorSets((current) => current.filter((item) => item.id !== set.id));
      setResults((current) => current.filter((item) => item.setId !== set.id));
      setCuttingPlan(null);
      setCuttingPlanRequest(null);
      setRemnantsCommitted(false);
      if (currentSetId === set.id) {
        setCurrentSetId(null);
        setDoorName(`D${Math.max(1, doorSets.length)}`);
      }
    });
  }, [currentSetId, doorSets.length]);

  const summaryAluminum = useMemo(() => {
    const map = new Map<string, { systemCode: string; code: string; name: string; length: number; quantity: number }>();
    for (const item of results.flatMap((row) => row.result.aluminum ?? [])) {
      if (!item.code || !item.length_mm) continue;
      const systemCode = item.systemCode || selectedSystem?.code || '';
      const key = `${systemCode}:${item.code}:${item.length_mm}`;
      const current = map.get(key) ?? { systemCode, code: item.code, name: item.name || item.position || 'Thanh nhôm', length: item.length_mm, quantity: 0 };
      current.quantity += Number(item.quantity || 0);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code) || b.length - a.length);
  }, [results, selectedSystem?.code]);

  const hasTopFix = dynamicInputs.HAS_TOP_FIX === '1';
  const supportsTopFix = requiredInputs.some((input) => input.id === 'HAS_TOP_FIX');
  const totalHeight = Number(dynamicInputs.H || 0);
  const topFixHeight = hasTopFix ? Number(dynamicInputs.FIX_H || 0) : 0;
  const activeDoorHeight = Math.max(0, totalHeight - topFixHeight);

  async function selectSystem(system: FormulaSystem) {
    setSelectedSystem(system);
    setSelectedType(null);
    setSelectedTemplate(null);
    setTypes([]);
    setTemplates([]);
    setStep(2);
    setLoading(true);
    try {
      const data = await guardFormulaCall(capability, () => api.get<FormulaType[]>(`/system-formulas/managed/types?aluSystemId=${encodeURIComponent(system.id)}`));
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
      const data = await guardFormulaCall(capability, () => api.get<FormulaTemplate[]>(`/system-formulas/managed/templates?aluSystemId=${encodeURIComponent(selectedSystem.id)}&type=${encodeURIComponent(type.name)}`));
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
    setCuttingPlan(null);
    setCuttingPlanRequest(null);
    setRemnantsCommitted(false);
    setStep(4);
    setLoading(true);
    try {
      const detail = await guardFormulaCall(capability, () => api.get<{ requiredInputs?: RequiredInput[] }>(`/system-formulas/managed/templates/${template.templateId}`));
      const inputs = normalizeInputs(detail.requiredInputs?.length ? detail.requiredInputs : []);
      setRequiredInputs(inputs);
      setDynamicInputs(inputDefaults(inputs));
    } catch (error) {
      setRequiredInputs([]);
      setDynamicInputs({});
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không tải được trường kích thước của công thức.');
    } finally {
      setLoading(false);
    }
  }

  function validateCurrent() {
    const missing = requiredInputs.filter((input) => {
      const required = input.required !== false;
      return required && !dynamicInputs[input.id];
    });
    if (missing.length > 0) {
      Alert.alert('Thiếu kích thước', `Vui lòng nhập: ${missing.map((input) => input.name).join(', ')}`);
      return false;
    }
    const totalHeight = Number(dynamicInputs.H || 0);
    const hasTopFix = dynamicInputs.HAS_TOP_FIX === '1';
    const topFixHeight = hasTopFix ? Number(dynamicInputs.FIX_H || 0) : 0;
    if (hasTopFix && (!Number.isFinite(topFixHeight) || topFixHeight <= 110)) {
      Alert.alert('Chiều cao ô fix chưa hợp lệ', 'Chiều cao ô fix phải lớn hơn 110 mm để còn kích thước lọt kính.');
      return false;
    }
    if (hasTopFix && topFixHeight >= totalHeight) {
      Alert.alert('Chiều cao ô fix chưa hợp lệ', 'Chiều cao ô fix phải nhỏ hơn tổng chiều cao phủ bì.');
      return false;
    }
    const activeDoorHeight = totalHeight - topFixHeight;
    if (supportsTopFix && activeDoorHeight > MAX_ACTIVE_DOOR_HEIGHT_MM) {
      Alert.alert(
        'Chiều cao phần cửa vượt giới hạn',
        `Phần cửa hoạt động đang cao ${formatNumber(activeDoorHeight)} mm. Vui lòng chọn ô fix hoặc tăng chiều cao ô fix để phần cửa không vượt ${formatNumber(MAX_ACTIVE_DOOR_HEIGHT_MM)} mm.`,
      );
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
    setRequiredInputs([]);
    setDynamicInputs({});
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

    setResults([]);
    setCuttingPlan(null);
    setCuttingPlanRequest(null);
    setRemnantsCommitted(false);
    setCalculating(true);
    try {
      const planRef = `PC-${Date.now().toString(36).toUpperCase()}`;
      const request: CuttingPlanRequest = {
        planRef,
        sets: saved.map((set) => {
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(set.inputs)) {
          payload[key] = key === 'glass_type' ? value : Number(value) || value;
        }
          return { setId: set.id, setName: set.name, templateId: set.template.templateId, inputs: payload };
        }),
      };
      const plan = await guardFormulaCall(capability, () => api.post<CuttingPlan>('/system-formulas/managed/cutting-plan', request));
      pendingResultScrollRef.current = true;
      setResults(plan.sets.map((set) => ({ setId: set.setId, setName: set.setName, templateName: set.templateName, result: set.result })));
      setCuttingPlan(plan);
      setCuttingPlanRequest(request);
    } catch (error) {
      Alert.alert('Lỗi tính công thức', error instanceof Error ? error.message : 'Không tính được công thức cắt.');
    } finally {
      setCalculating(false);
    }
  }

  async function commitRemnants() {
    if (!cuttingPlanRequest || !cuttingPlan || remnantsCommitted) return;
    setSavingRemnants(true);
    try {
      await guardFormulaCall(capability, () => api.post<{
        reusableRemnantPieces: number;
        reusableRemnantKg: number;
        scrapKg: number;
      }>('/system-formulas/managed/cutting-plan/commit-remnants', cuttingPlanRequest, {
        headers: { 'Idempotency-Key': `cut-plan-${cuttingPlan.planRef}` },
      }));
      setRemnantsCommitted(true);
      Alert.alert('Đã cập nhật kho', `${cuttingPlan.summary.reusableRemnantPieces} đoạn DC còn lại đã được lưu. DC vụn tăng ${formatKg(cuttingPlan.summary.scrapKg)}.`);
    } catch (error) {
      Alert.alert('Không lưu được DC', error instanceof Error ? error.message : 'Không cập nhật được tồn kho và DC.');
    } finally {
      setSavingRemnants(false);
    }
  }

  function confirmCommitRemnants() {
    if (!cuttingPlan) return;
    const message = `Xác nhận đã cắt xong phiếu ${cuttingPlan.planRef}. Hệ thống sẽ trừ DC đã tận dụng, lưu ${cuttingPlan.summary.reusableRemnantPieces} DC còn lại và cộng ${formatKg(cuttingPlan.summary.scrapKg)} DC vụn.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) void commitRemnants();
      return;
    }
    Alert.alert('Lưu kết quả cắt vào kho?', message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Lưu kho', onPress: () => void commitRemnants() },
    ]);
  }

  async function exportCuttingPlanPdf() {
    if (!cuttingPlanRequest || !cuttingPlan) return;
    setExportingPdf(true);
    try {
      const response = await guardFormulaCall(capability, () => fetch(`${API_URL}/system-formulas/managed/cutting-plan/pdf`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(cuttingPlanRequest),
      }));
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Không thể tạo PDF (lỗi ${response.status}).`);
      }
      const fileName = `phieu-cat-nhom-${cuttingPlan.planRef}.pdf`;
      if (Platform.OS === 'web') {
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const target = `${FileSystem.cacheDirectory}${fileName}`;
        const base64 = arrayBufferToBase64(await response.arrayBuffer());
        await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(target, { mimeType: 'application/pdf', dialogTitle: `Phiếu cắt nhôm ${cuttingPlan.planRef}` });
        } else {
          Alert.alert('Đã tạo PDF', `File được lưu tại: ${target}`);
        }
      }
    } catch (error) {
      Alert.alert('Không xuất được PDF', error instanceof Error ? error.message : 'Không tạo được phiếu cắt nhôm.');
    } finally {
      setExportingPdf(false);
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
    <ScrollView ref={inputScrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn Hệ Nhôm</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      {!loading && systems.length === 0 ? <Text style={styles.emptyText}>Chưa có dữ liệu hệ nhôm.</Text> : null}
      {systems.map((system) => (
        <Pressable key={system.id} style={styles.listCard} onPress={() => selectSystem(system)}>
          <View style={styles.listIcon}><Icon name="layers" size={18} color={colors.brandOrangeText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{system.name}</Text>
            <Text style={styles.cardSub}>{system.profileCount || 0} mã thanh · {system.templateCount} công thức đã phát hành</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.brandGrey[500]} />
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderTypeStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn loại cửa</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      {!loading && types.length === 0 ? <Text style={styles.emptyText}>WebAdmin chưa phát hành công thức nào cho hệ nhôm này.</Text> : null}
      {types.map((type) => (
        <Pressable key={type.id} style={styles.listCard} onPress={() => selectType(type)}>
          <View style={styles.listIcon}><Icon name="layout" size={18} color={colors.brandOrangeText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{type.name}</Text>
            <Text style={styles.cardSub}>{type.templateCount} công thức đang sử dụng</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.brandGrey[500]} />
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderTemplateStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Chọn mẫu cửa</Text>
      <Text style={styles.helperText}>{selectedType?.name} · Dữ liệu kỹ thuật do Eurohouse phát hành</Text>
      {loading ? <ActivityIndicator color={colors.brandOrange} /> : null}
      {!loading && templates.length === 0 ? <Text style={styles.emptyText}>Chưa có mẫu cửa được phát hành.</Text> : null}
      <View style={styles.templateGrid}>
        {templates.map((template) => (
          <Pressable key={template.templateId} style={[styles.templateCard, selectedTemplate?.templateId === template.templateId && styles.templateCardActive]} onPress={() => selectTemplate(template)}>
            <View style={styles.templateImageWrap}>
              {template.imageUrl ? <Image source={{ uri: assetUrl(template.imageUrl) }} style={styles.templateImage} resizeMode="contain" /> : <Text style={styles.templateDescription} numberOfLines={5}>{template.description || 'Chưa có ảnh mẫu'}</Text>}
            </View>
            <View style={styles.templateBody}>
              <Text style={styles.templateName} numberOfLines={2}>{template.templateName}</Text>
              <Text style={styles.cardSub}>Revision {template.revision || 1} · Đã phát hành</Text>
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
    <ScrollView ref={inputScrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
            {requiredInputs.map((input) => {
              if (input.type === 'boolean') {
                const checked = dynamicInputs[input.id] === '1';
                return (
                  <Pressable
                    key={input.id}
                    style={[styles.booleanField, checked && styles.booleanFieldActive]}
                    onPress={() => {
                      const nextChecked = !checked;
                      setResults([]);
                      setCuttingPlan(null);
                      setCuttingPlanRequest(null);
                      setRemnantsCommitted(false);
                      setDynamicInputs((current) => ({
                        ...current,
                        [input.id]: nextChecked ? '1' : '0',
                        ...(input.id === 'HAS_TOP_FIX' ? { FIX_H: nextChecked ? '' : '0' } : {}),
                      }));
                    }}
                  >
                    <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                      {checked ? <Icon name="check" size={14} color={colors.white} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.booleanLabel}>{input.name}</Text>
                      {input.id === 'HAS_TOP_FIX' ? <Text style={styles.booleanHint}>Tách ô fix ba khoang L1 - L2 - L1 phía trên khỏi cánh cửa hoạt động</Text> : null}
                    </View>
                  </Pressable>
                );
              }
              if (input.id === 'FIX_H' && !hasTopFix) return null;
              return (
                <View key={input.id} style={input.id === 'FIX_H' ? styles.inputCellFull : styles.inputCell}>
                  <Text style={styles.inputLabel}>{input.name}{input.unit ? ` (${input.unit})` : ''}</Text>
                  <TextInput
                    style={styles.input}
                    value={dynamicInputs[input.id] || ''}
                    onChangeText={(value) => {
                      setResults([]);
                      setCuttingPlan(null);
                      setCuttingPlanRequest(null);
                      setRemnantsCommitted(false);
                      setDynamicInputs((current) => ({ ...current, [input.id]: input.type === 'string' ? value : value.replace(/[^0-9.]/g, '') }));
                    }}
                    keyboardType={input.type === 'string' ? 'default' : 'numeric'}
                    placeholder={input.id === 'FIX_H' ? 'Nhập chiều cao ô fix' : 'Nhập số'}
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              );
            })}
          </View>
        )}

        {supportsTopFix && hasTopFix && totalHeight > 0 ? (
          <View style={styles.fixSummary}>
            <Text style={styles.fixSummaryLabel}>Phần cửa hoạt động</Text>
            <Text style={[styles.fixSummaryValue, activeDoorHeight > MAX_ACTIVE_DOOR_HEIGHT_MM && styles.fixSummaryDanger]}>{formatNumber(activeDoorHeight)} mm</Text>
            <Text style={styles.fixSummaryHint}>Tổng cao {formatNumber(totalHeight)} mm - ô fix {formatNumber(topFixHeight)} mm</Text>
          </View>
        ) : supportsTopFix && totalHeight > MAX_ACTIVE_DOOR_HEIGHT_MM ? (
          <View style={styles.heightWarning}><Text style={styles.heightWarningText}>Chiều cao vượt {formatNumber(MAX_ACTIVE_DOOR_HEIGHT_MM)} mm. Hãy tick chọn ô fix phía trên.</Text></View>
        ) : null}

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

      {results.length > 0 ? (
        <View
          style={styles.resultBox}
          onLayout={(event) => {
            if (!pendingResultScrollRef.current) return;
            pendingResultScrollRef.current = false;
            const targetY = Math.max(0, event.nativeEvent.layout.y - 12);
            requestAnimationFrame(() => inputScrollRef.current?.scrollTo({ y: targetY, animated: true }));
          }}
        >
          <Text style={styles.resultTitle}>Tổng thanh nhôm cần cắt</Text>
          <Text style={styles.resultSummary}>
            {summaryAluminum.length} dòng cắt · {results.reduce((total, row) => total + (row.result.glass ?? []).reduce((sum, glass) => sum + Number(glass.quantity || 0), 0), 0)} tấm kính
          </Text>
          {summaryAluminum.map((item) => (
            <View key={`${item.code}-${item.length}`} style={styles.resultRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{item.code}</Text>
                <Text style={styles.cardSub}>{item.systemCode ? `${item.systemCode} · ` : ''}{item.name}</Text>
              </View>
              <Text style={styles.resultValue}>{formatNumber(item.length)} mm x {formatNumber(item.quantity)}</Text>
            </View>
          ))}

          {cuttingPlan ? (
            <View style={styles.massSection}>
              <Text style={styles.massTitle}>Dự tính khối lượng nhôm</Text>
              <View style={styles.massTable}>
                <View style={styles.massTableRow}>
                  {['Tổng kg nhôm cần', 'Kg nhôm thành phẩm', 'DC còn lại', 'DC vụn'].map((label) => (
                    <View key={label} style={styles.massCell}><Text style={styles.massLabel}>{label}</Text></View>
                  ))}
                </View>
                <View style={[styles.massTableRow, styles.massValueRow]}>
                  {[cuttingPlan.summary.totalInputKg, cuttingPlan.summary.finishedKg, cuttingPlan.summary.reusableRemnantKg, cuttingPlan.summary.scrapKg].map((value, index) => (
                    <View key={`${index}-${value}`} style={styles.massCell}><Text style={styles.massValue}>{formatKg(value)}</Text></View>
                  ))}
                </View>
              </View>
              <Text style={styles.massHint}>
                Gồm {cuttingPlan.summary.newBars} cây mới và {cuttingPlan.summary.reusedDeXePieces} DC tận dụng. DC từ 1.000 mm được lưu lại; mạch cắt tính 5 mm.
              </Text>
              {Math.abs(cuttingPlan.summary.massBalanceDifferenceKg) > 0.005 ? (
                <Text style={styles.massWarning}>Chênh lệch cân bằng: {formatKg(cuttingPlan.summary.massBalanceDifferenceKg)}. Vui lòng kiểm tra lại dữ liệu tỷ trọng.</Text>
              ) : null}
              <View style={styles.resultActions}>
                <Pressable
                  style={[styles.inventoryAction, (savingRemnants || remnantsCommitted) && styles.actionDisabled]}
                  disabled={savingRemnants || remnantsCommitted}
                  onPress={confirmCommitRemnants}
                >
                  {savingRemnants ? <ActivityIndicator color={colors.success} /> : <Icon name={remnantsCommitted ? 'check' : 'save'} size={16} color={colors.success} />}
                  <Text style={styles.inventoryActionText}>{remnantsCommitted ? 'Đã lưu kho DC' : 'Lưu DC vào kho'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.pdfAction, exportingPdf && styles.actionDisabled]}
                  disabled={exportingPdf}
                  onPress={() => void exportCuttingPlanPdf()}
                >
                  {exportingPdf ? <ActivityIndicator color={colors.brandBlack.main} /> : <Icon name="download" size={16} color={colors.brandBlack.main} />}
                  <Text style={styles.pdfActionText}>Xuất PDF</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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

      {doorSets.length > 0 ? (
        <View style={styles.savedBox}>
          <Text style={styles.smallTitle}>Bộ cửa đã lưu</Text>
          {doorSets.map((set) => (
            <View key={set.id} style={styles.savedRow}>
              <View style={styles.savedContent}>
                <Text style={styles.savedName}>{set.name}</Text>
                <Text style={styles.savedMeta}>{set.template.windowTypeName} · {inputSummary(set)}</Text>
              </View>
              <Pressable accessibilityLabel={`Xoá ${set.name}`} style={styles.savedDelete} onPress={() => removeDoorSet(set)}>
                <Icon name="trash-2" size={17} color={colors.danger} />
              </Pressable>
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
  lockedScreen: { flex: 1, backgroundColor: '#FFF9F3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  lockedIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  lockedEyebrow: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  lockedTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: 8 },
  lockedCopy: { color: colors.brandGrey[600], fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginTop: 10 },
  lockedAction: { minHeight: 50, borderRadius: 14, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 22 },
  lockedActionText: { color: colors.white, fontWeight: '900', fontSize: 15 },
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
  templateDescription: { color: colors.brandGrey[600], fontWeight: '700', fontSize: 12, lineHeight: 17, textAlign: 'center', padding: 8 },
  templateBody: { padding: 12 },
  templateName: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13, minHeight: 34 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 999, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' },
  heroImageCard: { backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  heroImage: { width: '100%', height: 210, backgroundColor: '#F8FAFC' },
  formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 14 },
  fieldFull: { marginBottom: 12 },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  inputCell: { flexBasis: '48%', flexGrow: 1 },
  inputCellFull: { flexBasis: '100%', flexGrow: 1 },
  inputLabel: { color: colors.brandGrey[600], fontWeight: '800', fontSize: 12, marginBottom: 6 },
  input: { minHeight: 46, backgroundColor: colors.brandGrey[50], borderRadius: 12, paddingHorizontal: 12, color: colors.brandBlack.main, fontWeight: '800' },
  booleanField: { flexBasis: '100%', minHeight: 62, borderWidth: 1.5, borderColor: colors.brandGrey[200], borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.brandGrey[50] },
  booleanFieldActive: { borderColor: colors.brandOrange, backgroundColor: colors.orangeSoft },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.brandGrey[400], alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxActive: { borderColor: colors.brandOrangeText, backgroundColor: colors.brandOrangeText },
  booleanLabel: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  booleanHint: { color: colors.brandGrey[600], fontWeight: '600', fontSize: 11, marginTop: 3, lineHeight: 15 },
  fixSummary: { marginTop: 10, borderLeftWidth: 3, borderLeftColor: colors.success, backgroundColor: '#F0FDF4', padding: 11, borderRadius: 8 },
  fixSummaryLabel: { color: colors.brandGrey[600], fontWeight: '800', fontSize: 11 },
  fixSummaryValue: { color: colors.success, fontWeight: '900', fontSize: 18, marginTop: 2 },
  fixSummaryDanger: { color: colors.danger },
  fixSummaryHint: { color: colors.brandGrey[600], fontWeight: '600', fontSize: 11, marginTop: 2 },
  heightWarning: { marginTop: 10, borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FFFBEB', padding: 11, borderRadius: 8 },
  heightWarningText: { color: '#92400E', fontWeight: '800', fontSize: 12, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryAction: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.white },
  secondaryActionText: { color: colors.brandOrangeText, fontWeight: '900' },
  primaryAction: { minHeight: 52, borderRadius: 15, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  primaryActionText: { color: colors.brandBlack.main, fontWeight: '900' },
  savedBox: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 14 },
  smallTitle: { color: colors.brandBlack.main, fontWeight: '900', marginBottom: 8 },
  savedRow: { minHeight: 58, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.brandGrey[100], flexDirection: 'row', alignItems: 'center', gap: 10 },
  savedContent: { flex: 1, minWidth: 0 },
  savedDelete: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  savedName: { color: colors.brandBlack.main, fontWeight: '900' },
  savedMeta: { color: colors.brandGrey[500], fontWeight: '700', marginTop: 3, fontSize: 12 },
  resultBox: { backgroundColor: colors.white, borderRadius: 18, padding: 16 },
  resultTitle: { color: colors.success, fontWeight: '900', fontSize: 16, marginBottom: 10 },
  resultSummary: { color: colors.brandGrey[600], fontWeight: '800', fontSize: 12, marginTop: -4, marginBottom: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.brandGrey[100] },
  resultName: { color: colors.brandBlack.main, fontWeight: '900' },
  resultValue: { color: colors.brandOrangeText, fontWeight: '900' },
  massSection: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.brandGrey[200] },
  massTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15, marginBottom: 9 },
  massTable: { borderWidth: 1, borderColor: colors.brandGrey[200], borderRadius: 10, overflow: 'hidden' },
  massTableRow: { flexDirection: 'row', minHeight: 46, backgroundColor: colors.brandGrey[50] },
  massValueRow: { minHeight: 48, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.brandGrey[200] },
  massCell: { width: '25%', paddingHorizontal: 5, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.brandGrey[200] },
  massLabel: { color: colors.brandGrey[600], fontWeight: '800', fontSize: 9, lineHeight: 12, textAlign: 'center' },
  massValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 11, textAlign: 'center' },
  massHint: { color: colors.brandGrey[600], fontWeight: '600', fontSize: 11, lineHeight: 16, marginTop: 8 },
  massWarning: { color: colors.danger, fontWeight: '800', fontSize: 11, lineHeight: 16, marginTop: 5 },
  resultActions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  inventoryAction: { flex: 1, minHeight: 47, borderRadius: 13, borderWidth: 1.5, borderColor: colors.success, backgroundColor: '#F0FDF4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  inventoryActionText: { color: colors.success, fontWeight: '900', fontSize: 12, textAlign: 'center' },
  pdfAction: { flex: 1, minHeight: 47, borderRadius: 13, backgroundColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  pdfActionText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 12 },
  actionDisabled: { opacity: 0.55 },
  doorResult: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.brandGrey[200] },
  glassLine: { color: colors.brandGrey[700], fontWeight: '700', lineHeight: 20 },
});
