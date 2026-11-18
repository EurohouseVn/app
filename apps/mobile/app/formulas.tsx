import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { filterCuttingFormulaSystems, type FormulaCapability } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import {
  Banner, Button, Card, EmptyState, Field, FieldLabel, IconButton, Input, Kpi, KpiRow, ListRow, Loading,
  SectionHead, ValueLine, ws, wsStyles,
} from '../src/components/ws';
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
    return (
      <View style={wsStyles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <AppHeader title="Công thức cắt" subtitle={ui.statusLabel} />
        <Card style={styles.lockedCard}>
          <View style={styles.lockedIcon}><Icon name="lock" size={26} color={ws.orangeText} /></View>
          <Text style={styles.lockedEyebrow}>{ui.statusLabel}</Text>
          <Text style={styles.lockedTitle}>{ui.message}</Text>
          <Text style={styles.lockedCopy}>Công thức Eurohouse được mở riêng cho từng cơ sở bởi NPP phụ trách. Báo giá thủ công và các tiện ích quản lý miễn phí vẫn dùng bình thường.</Text>
          <Button label="Nhập mã mời NPP" icon="send" onPress={() => router.push('/profile')} />
        </Card>
      </View>
    );
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

  const STEP_LABELS = ['Hệ nhôm', 'Loại cửa', 'Mẫu cửa', 'Kích thước'];
  const subtitle = [selectedSystem?.name, selectedType?.name].filter(Boolean).join(' · ') || 'Chọn hệ nhôm để bắt đầu';

  const renderProgress = () => (
    <View style={styles.progress}>
      {STEP_LABELS.map((label, index) => {
        const item = (index + 1) as Step;
        const done = step > item;
        const current = step === item;
        return (
          <Pressable
            key={label}
            disabled={item >= step}
            onPress={() => setStep(item)}
            accessibilityRole="button"
            accessibilityLabel={`Bước ${item}: ${label}`}
            style={styles.progressItem}
          >
            <View style={[styles.progressBar, (done || current) && styles.progressBarOn]} />
            <Text style={[styles.progressText, current && styles.progressTextOn, done && styles.progressTextDone]} numberOfLines={1}>{item}. {label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderSystemStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      <SectionHead title="Chọn hệ nhôm" sub="Công thức do Eurohouse phát hành cho từng hệ" />
      {loading ? <Loading /> : null}
      {!loading && systems.length === 0 ? <EmptyState icon="layers" title="Chưa có hệ nhôm" text="Chưa có công thức nào được phát hành." /> : null}
      {systems.length ? (
        <Card padded={false}>
          {systems.map((system, index) => (
            <ListRow key={system.id} first={index === 0} onPress={() => selectSystem(system)} label={`Chọn ${system.name}`}>
              <View style={wsStyles.avatar}><Icon name="layers" size={17} color={ws.orangeText} /></View>
              <View style={wsStyles.grow}>
                <Text style={wsStyles.rowTitle}>{system.name}</Text>
                <Text style={wsStyles.rowMeta}>{system.profileCount || 0} mã thanh · {system.templateCount} công thức</Text>
              </View>
              <Icon name="chevron-right" size={18} color={ws.muted} />
            </ListRow>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );

  const renderTypeStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      <SectionHead title="Chọn loại cửa" sub={selectedSystem?.name} />
      {loading ? <Loading /> : null}
      {!loading && types.length === 0 ? <EmptyState icon="layout" title="Chưa có loại cửa" text="Hệ nhôm này chưa có công thức được phát hành." /> : null}
      {types.length ? (
        <Card padded={false}>
          {types.map((type, index) => (
            <ListRow key={type.id} first={index === 0} onPress={() => selectType(type)} label={`Chọn ${type.name}`}>
              <View style={wsStyles.avatar}><Icon name="layout" size={17} color={ws.orangeText} /></View>
              <View style={wsStyles.grow}>
                <Text style={wsStyles.rowTitle}>{type.name}</Text>
                <Text style={wsStyles.rowMeta}>{type.templateCount} công thức</Text>
              </View>
              <Icon name="chevron-right" size={18} color={ws.muted} />
            </ListRow>
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );

  const renderTemplateStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      <SectionHead title="Chọn mẫu cửa" sub={`${selectedType?.name ?? ''} · dữ liệu kỹ thuật Eurohouse`} />
      {loading ? <Loading /> : null}
      {!loading && templates.length === 0 ? <EmptyState icon="file" title="Chưa có mẫu cửa" text="Chưa có mẫu cửa được phát hành cho loại này." /> : null}
      <View style={styles.templateGrid}>
        {templates.map((template) => {
          const active = selectedTemplate?.templateId === template.templateId;
          return (
            <Pressable key={template.templateId} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.templateCard, active && styles.templateCardOn]} onPress={() => selectTemplate(template)}>
              <View style={styles.templateImageWrap}>
                {template.imageUrl ? <Image source={{ uri: assetUrl(template.imageUrl) }} style={styles.templateImage} resizeMode="contain" /> : <Text style={styles.templateDescription} numberOfLines={5}>{template.description || 'Chưa có ảnh mẫu'}</Text>}
              </View>
              <View style={styles.templateBody}>
                <Text style={styles.templateName} numberOfLines={2}>{template.templateName}</Text>
                <Text style={wsStyles.rowMeta}>Phiên bản {template.revision || 1}</Text>
              </View>
              {active ? <View style={styles.checkBadge}><Icon name="check" size={13} color={ws.surface} /></View> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );

  const glassCount = results.reduce((total, row) => total + (row.result.glass ?? []).reduce((sum, glass) => sum + Number(glass.quantity || 0), 0), 0);

  const renderInputStep = () => (
    <ScrollView ref={inputScrollRef} contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled">
      {selectedTemplate?.imageUrl ? (
        <Card padded={false} style={styles.heroCard}>
          <Image source={{ uri: assetUrl(selectedTemplate.imageUrl) }} style={styles.heroImage} resizeMode="contain" />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.formTitle}>{selectedTemplate?.templateName}</Text>
        <Text style={wsStyles.rowMeta}>{selectedType?.name} · {selectedSystem?.code || selectedSystem?.name}</Text>
        <Field label="Tên bộ cửa">
          <Input value={doorName} onChangeText={setDoorName} placeholder="VD: D1, D2, Cửa chính" />
        </Field>

        {loading ? <Loading /> : (
          <View style={styles.inputGrid}>
            {requiredInputs.map((input) => {
              if (input.type === 'boolean') {
                const checked = dynamicInputs[input.id] === '1';
                return (
                  <Pressable
                    key={input.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    style={[styles.booleanField, checked && styles.booleanFieldOn]}
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
                    <View style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? <Icon name="check" size={13} color={ws.surface} /> : null}</View>
                    <View style={wsStyles.grow}>
                      <Text style={wsStyles.rowTitle}>{input.name}</Text>
                      {input.id === 'HAS_TOP_FIX' ? <Text style={wsStyles.rowMeta}>Tách ô fix ba khoang L1 - L2 - L1 phía trên khỏi cánh cửa hoạt động</Text> : null}
                    </View>
                  </Pressable>
                );
              }
              if (input.id === 'FIX_H' && !hasTopFix) return null;
              return (
                <View key={input.id} style={input.id === 'FIX_H' ? styles.inputCellFull : styles.inputCell}>
                  <FieldLabel>{input.name}{input.unit ? ` (${input.unit})` : ''}</FieldLabel>
                  <Input
                    value={dynamicInputs[input.id] || ''}
                    onChangeText={(value) => {
                      setResults([]);
                      setCuttingPlan(null);
                      setCuttingPlanRequest(null);
                      setRemnantsCommitted(false);
                      setDynamicInputs((current) => ({ ...current, [input.id]: input.type === 'string' ? value : value.replace(/[^0-9.]/g, '') }));
                    }}
                    keyboardType={input.type === 'string' ? 'default' : 'numeric'}
                    placeholder={input.id === 'FIX_H' ? 'Chiều cao ô fix' : 'Nhập số'}
                  />
                </View>
              );
            })}
          </View>
        )}

        {supportsTopFix && hasTopFix && totalHeight > 0 ? (
          <View style={styles.gapTop}>
            <Banner
              tone={activeDoorHeight > MAX_ACTIVE_DOOR_HEIGHT_MM ? 'error' : 'success'}
              title={`Phần cửa hoạt động: ${formatNumber(activeDoorHeight)} mm`}
              text={`Tổng cao ${formatNumber(totalHeight)} mm − ô fix ${formatNumber(topFixHeight)} mm`}
            />
          </View>
        ) : supportsTopFix && totalHeight > MAX_ACTIVE_DOOR_HEIGHT_MM ? (
          <View style={styles.gapTop}><Banner tone="warning" text={`Chiều cao vượt ${formatNumber(MAX_ACTIVE_DOOR_HEIGHT_MM)} mm. Hãy chọn ô fix phía trên.`} /></View>
        ) : null}

        <View style={styles.actionRow}>
          <Button label="Lưu bộ" icon="save" variant="secondary" onPress={handleSaveCurrentSet} style={wsStyles.half} />
          <Button label="Thêm bộ" icon="plus" variant="secondary" onPress={addAnotherDoor} style={wsStyles.half} />
        </View>
        <Button label="Tính công thức cắt" icon="tool" loading={calculating} onPress={calculateAll} style={styles.gapTop} />
      </Card>

      {results.length > 0 ? (
        <View
          onLayout={(event) => {
            if (!pendingResultScrollRef.current) return;
            pendingResultScrollRef.current = false;
            const targetY = Math.max(0, event.nativeEvent.layout.y - 12);
            requestAnimationFrame(() => inputScrollRef.current?.scrollTo({ y: targetY, animated: true }));
          }}
        >
          <SectionHead title="Kết quả cắt" sub={`${summaryAluminum.length} dòng cắt · ${glassCount} tấm kính`} />

          {cuttingPlan ? (
            <>
              <KpiRow>
                <Kpi label="Nhôm cần" value={formatKg(cuttingPlan.summary.totalInputKg)} />
                <Kpi label="Thành phẩm" value={formatKg(cuttingPlan.summary.finishedKg)} />
              </KpiRow>
              <View style={styles.gapTop}>
                <KpiRow>
                  <Kpi label="DC còn lại" value={formatKg(cuttingPlan.summary.reusableRemnantKg)} tone="success" />
                  <Kpi label="DC vụn" value={formatKg(cuttingPlan.summary.scrapKg)} tone={cuttingPlan.summary.scrapKg > 0 ? 'warning' : undefined} />
                </KpiRow>
              </View>
              <Text style={wsStyles.hint}>Gồm {cuttingPlan.summary.newBars} cây mới và {cuttingPlan.summary.reusedDeXePieces} DC tận dụng. DC từ 1.000 mm được lưu lại; mạch cắt tính 5 mm.</Text>
              {Math.abs(cuttingPlan.summary.massBalanceDifferenceKg) > 0.005 ? (
                <View style={styles.gapTop}><Banner tone="error" text={`Chênh lệch cân bằng ${formatKg(cuttingPlan.summary.massBalanceDifferenceKg)}. Vui lòng kiểm tra lại dữ liệu tỷ trọng.`} /></View>
              ) : null}
              <View style={styles.actionRow}>
                <Button
                  label={remnantsCommitted ? 'Đã lưu kho DC' : 'Lưu DC vào kho'}
                  icon={remnantsCommitted ? 'check' : 'save'}
                  variant="secondary"
                  loading={savingRemnants}
                  disabled={remnantsCommitted}
                  onPress={confirmCommitRemnants}
                  style={wsStyles.half}
                />
                <Button label="Xuất PDF" icon="download" loading={exportingPdf} onPress={() => void exportCuttingPlanPdf()} style={wsStyles.half} />
              </View>
            </>
          ) : null}

          <SectionHead title="Thanh nhôm cần cắt" />
          <Card padded={false}>
            {summaryAluminum.map((item, index) => (
              <ListRow key={`${item.systemCode}-${item.code}-${item.length}`} first={index === 0}>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle}>{item.code}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>{item.systemCode ? `${item.systemCode} · ` : ''}{item.name}</Text>
                </View>
                <Text style={styles.cutValue}>{formatNumber(item.length)} mm × {formatNumber(item.quantity)}</Text>
              </ListRow>
            ))}
          </Card>

          {results.map((row) => ((row.result.glass?.length || row.result.accessories?.length) ? (
            <View key={row.setId}>
              <SectionHead title={`${row.setName} · ${row.templateName}`} />
              <Card padded={false}>
                {(row.result.glass ?? []).map((glass, index) => (
                  <ValueLine key={`${row.setId}-g-${index}`} first={index === 0} label={`Kính ${formatNumber(glass.width_mm)} × ${formatNumber(glass.height_mm)} mm`} value={`SL ${formatNumber(glass.quantity)}`} />
                ))}
                {(row.result.accessories ?? []).slice(0, 8).map((accessory, index) => (
                  <ValueLine key={`${row.setId}-a-${index}`} first={index === 0 && !(row.result.glass ?? []).length} label={accessory.name || accessory.code || '-'} detail="Phụ kiện" value={`SL ${formatNumber(Number(accessory.quantity || 0))}`} />
                ))}
              </Card>
            </View>
          ) : null))}
        </View>
      ) : null}

      {doorSets.length > 0 ? (
        <>
          <SectionHead title="Bộ cửa đã lưu" sub={`${doorSets.length} bộ trong phiếu cắt`} />
          <Card padded={false}>
            {doorSets.map((set, index) => (
              <ListRow key={set.id} first={index === 0}>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle}>{set.name}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={2}>{set.template.windowTypeName} · {inputSummary(set)}</Text>
                </View>
                <IconButton icon="trash-2" tone="danger" label={`Xoá ${set.name}`} onPress={() => removeDoorSet(set)} />
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Công thức cắt" subtitle={subtitle} onBack={step > 1 ? goBack : undefined} />
      {renderProgress()}
      {step === 1 ? renderSystemStep() : null}
      {step === 2 ? renderTypeStep() : null}
      {step === 3 ? renderTemplateStep() : null}
      {step === 4 ? renderInputStep() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockedCard: { margin: 16, alignItems: 'center', gap: 8, paddingVertical: 24 },
  lockedIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: ws.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lockedEyebrow: { color: ws.orangeText, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  lockedTitle: { color: ws.ink, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
  lockedCopy: { color: ws.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginBottom: 8 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2 },
  progressItem: { flex: 1, minWidth: 0, gap: 5 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: ws.line },
  progressBarOn: { backgroundColor: ws.orange },
  progressText: { color: ws.faint, fontSize: 11, fontWeight: '700' },
  progressTextOn: { color: ws.ink, fontWeight: '900' },
  progressTextDone: { color: ws.orangeText },
  gapTop: { marginTop: 10 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  templateCard: { width: '48%', backgroundColor: ws.surface, borderRadius: 14, borderWidth: 1, borderColor: ws.line, overflow: 'hidden' },
  templateCardOn: { borderColor: ws.orange, borderWidth: 2 },
  templateImageWrap: { height: 128, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: ws.lineSoft },
  templateImage: { width: '100%', height: '100%' },
  templateDescription: { color: ws.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', padding: 8 },
  templateBody: { padding: 10 },
  templateName: { color: ws.ink, fontSize: 13, fontWeight: '800', minHeight: 34 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  heroCard: { marginBottom: 10 },
  heroImage: { width: '100%', height: 200, backgroundColor: '#F9FAFB' },
  formTitle: { color: ws.ink, fontSize: 16, fontWeight: '900' },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  inputCell: { flexBasis: '47%', flexGrow: 1 },
  inputCellFull: { flexBasis: '100%', flexGrow: 1 },
  booleanField: { flexBasis: '100%', minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: ws.field, backgroundColor: ws.surface },
  booleanFieldOn: { borderColor: ws.orange, backgroundColor: ws.orangeSoft },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: ws.faint, alignItems: 'center', justifyContent: 'center', backgroundColor: ws.surface },
  checkboxOn: { borderColor: ws.orange, backgroundColor: ws.orange },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cutValue: { color: ws.ink, fontSize: 13, fontWeight: '800' },
});
