import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { CatalogProfile, CatalogSystem, ColorCode, CreateOrderResult, EurohouseFeatureCapability, FormulaCapability, QuotationRecord } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { ProfileThumb } from '../src/components/ProfileThumb';
import {
  Banner, Button, Card, EmptyState, Field, FieldLabel, IconButton, Input, Kpi, KpiRow, ListRow,
  OptionSheet, QtyStepper, SearchBox, SectionHead, SelectBox, ValueLine, ws, wsStyles,
} from '../src/components/ws';
import { api, API_URL, authHeaders } from '../src/lib/api';
import { resetScrollToTop, useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import { reconcileOpenCatalogSystem, shouldShowOrderSummary } from '../src/lib/orderCatalogState.js';
import { useAuth } from '../src/lib/auth';
import { canCallFormulaApi, guardFormulaCall } from '../src/lib/formulaAccess';
import { featureUiState, guardEurohouseMutation, orderingCta, orderingScreenPolicy } from '../src/lib/eurohouseFeatureAccess';

const STD_BAR_M = 6;

/** 4,2 kg — số kiểu Việt Nam. */
function kg(value: number, digits = 1): string {
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} kg`;
}

function colorLabel(name: string): string {
  const label = name.replace(/^Màu\s+/i, '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function theoreticalKgPerBar(profile: Pick<CatalogProfile, 'kgPerMeter' | 'barLengthMm'>) {
  const fallback = profile.kgPerMeter * ((profile.barLengthMm ?? STD_BAR_M * 1000) / 1000);
  return fallback;
}

type GlassLine = {
  id: string;
  glassColor: string;
  glassType: string;
  customGlassType: string;
  widthMm: string;
  heightMm: string;
  quantity: string;
};

const GLASS_COLORS = ['Trắng trong', 'Trắng đục', 'Xanh đen', 'Xanh đục'];
const GLASS_TYPES = ['Dán 6.38', 'Dán 8.38', 'CL 8mm', 'CL 10mm', 'CL 12mm', 'KH Thường', 'KH Nan đồng', 'Loại khác'];

function createClientRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createGlassLine(): GlassLine {
  return { id: createClientRequestId(), glassColor: GLASS_COLORS[0], glassType: GLASS_TYPES[0], customGlassType: '', widthMm: '', heightMm: '', quantity: '1' };
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isSystemAllowedForColors(system: Pick<CatalogSystem, 'code' | 'name'>, selectedColors: string[], colorList?: ColorCode[]): boolean {
  if (!selectedColors || selectedColors.length === 0) return true;

  const normSysCode = normalizeText(system.code);
  const normSysName = normalizeText(system.name);

  const is55 = normSysCode.includes('55') || normSysName.includes('55');
  const isPreco = normSysCode.includes('preco') || normSysName.includes('preco');
  const isMatDung = normSysCode.includes('md') || normSysName.includes('mat dung');
  const isNoiThat = normSysCode.includes('noithat') || normSysCode.includes('noi that') || normSysName.includes('noi that');

  // Kiểm tra xem hệ này có hợp lệ với ít nhất 1 màu đang chọn không
  return selectedColors.some((colCode) => {
    const colObj = colorList?.find((c) => c.code === colCode || c.id === colCode);
    const colSearch = normalizeText(`${colCode} ${colObj?.name || ''}`);

    const isGroup2 = colSearch.includes('cafe thuong') || colSearch.includes('cafe_thuong') || colSearch.includes('cafe-thuong') || colSearch.includes('rita');

    if (isGroup2) {
      // Cafe thường hoặc Xám Rita: chỉ hiện hệ 55 Vát Cạnh, Preco và mặt dựng.
      return is55 || isPreco || isMatDung;
    }

    // Cafe Metalic, Gỗ Cẩm Lai, Gỗ Olak (Trắc), Xám Ngọc Trai (và các màu Nhóm 1):
    // Hiện đủ tất cả các hệ TRỪ Preco, mặt dựng, và nội thất
    return !isPreco && !isMatDung && !isNoiThat;
  });
}

function findMatchingSystem(systems: CatalogSystem[], quoteSystem?: string) {
  const normalized = normalizeText(quoteSystem);
  if (!normalized) return systems[0];
  return systems.find((system) => {
    const haystack = `${normalizeText(system.code)} ${normalizeText(system.name)}`;
    return haystack.includes(normalized) || normalized.includes(haystack) || normalized.split(/\s+/).some((part) => part.length >= 2 && haystack.includes(part));
  }) ?? systems[0];
}

function findDraftProfile(system: CatalogSystem | undefined, kind: 'frame' | 'sash', itemLabel: string) {
  if (!system) return undefined;
  const label = normalizeText(itemLabel);
  const isSliding = label.includes('truot') || label.includes('lua');
  const isWindow = label.includes('so');
  const preferred = kind === 'frame'
    ? ['khung', 'bao', 'dak', 'rpk', 'pr5542', 'e701', 'c3328']
    : isSliding
      ? ['canh truot', 'pr2966', 't9801']
      : isWindow
        ? ['canh cua so', 'das', 'prs', 'eps']
        : ['canh cua di', 'dad', 'prd', 'epd'];
  return preferred
    .map((needle) => system.profiles.find((profile) => {
      const text = `${normalizeText(profile.code)} ${normalizeText(profile.name)}`;
      return text.includes(needle);
    }))
    .find(Boolean) ?? system.profiles[0];
}

function addDraftQty(target: Record<string, number>, profile: CatalogProfile | undefined, quantity: number) {
  if (!profile || quantity <= 0) return false;
  target[profile.id] = (target[profile.id] ?? 0) + quantity;
  return true;
}

function buildAccessoriesNote(accessoriesNote: string, glassLines: GlassLine[]) {
  const glassNote = glassLines
    .filter((line) => line.widthMm || line.heightMm)
    .map((line) => {
      const glassType = line.glassType === 'Loại khác' ? line.customGlassType.trim() || 'Loại khác' : line.glassType;
      const size = line.widthMm || line.heightMm ? `${line.widthMm || '?'}x${line.heightMm || '?'}mm` : 'chưa nhập kích thước';
      return `- ${glassType || 'Kính'}${line.glassColor ? ` màu ${line.glassColor}` : ''}: ${size} x ${line.quantity || '1'}`;
    })
    .join('\n');
  return [accessoriesNote.trim(), glassNote ? `Đặt kính:\n${glassNote}` : ''].filter(Boolean).join('\n\n');
}

async function buildQuantitiesFromQuotation(quotation: QuotationRecord, systems: CatalogSystem[], capability?: FormulaCapability) {
  const quantities: Record<string, number> = {};
  let firstSystemId: string | undefined;
  let lines = 0;
  const profileByCode = new Map<string, { profile: CatalogProfile; systemId: string }>();
  systems.forEach((system) => system.profiles.forEach((profile) => profileByCode.set(profile.code.toUpperCase(), { profile, systemId: system.id })));

  for (const item of quotation.items) {
    if (item.templateId && canCallFormulaApi(capability)) {
      try {
        const result = await guardFormulaCall(capability, () => api.post<{ aluminum?: { code?: string; quantity?: number }[] }>(`/formulas/templates/${item.templateId}/calc`, {
          width: item.widthMm,
          height: item.heightMm,
          quantity: item.quantity,
        }));
        let mapped = 0;
        for (const alu of result.aluminum ?? []) {
          const mappedProfile = alu.code ? profileByCode.get(String(alu.code).toUpperCase()) : undefined;
          const quantity = Math.max(0, Math.ceil(Number(alu.quantity || 0)));
          if (!mappedProfile || quantity <= 0) continue;
          addDraftQty(quantities, mappedProfile.profile, quantity);
          firstSystemId ??= mappedProfile.systemId;
          mapped += 1;
        }
        if (mapped > 0) {
          lines += mapped;
          continue;
        }
      } catch {
        // Fallback below keeps project ordering usable while templates are being normalized.
      }
    }
    const system = findMatchingSystem(systems, item.system);
    if (!system) continue;
    firstSystemId ??= system.id;
    const barsPerimeter = Math.max(1, Math.ceil((((item.widthMm + item.heightMm) * 2) / 1000) / STD_BAR_M)) * Math.max(1, item.quantity || 1);
    const label = `${item.name} ${item.doorType}`;
    if (addDraftQty(quantities, findDraftProfile(system, 'frame', label), barsPerimeter)) lines += 1;
    if (addDraftQty(quantities, findDraftProfile(system, 'sash', label), barsPerimeter)) lines += 1;
  }

  return { quantities, firstSystemId, lines };
}

function OrderingLockedScreen({
  capability,
  cta,
}: {
  capability?: EurohouseFeatureCapability;
  cta: ReturnType<typeof orderingCta>;
}) {
  const appRouter = useRouter();
  const ui = featureUiState(capability);
  return (
    <View style={wsStyles.screen}>
      <AppHeader title="Đặt hàng Eurohouse" subtitle={ui.statusLabel} />
      <Card style={styles.lockedCard}>
        <View style={styles.lockedIcon}><Icon name="lock" size={26} color={ws.orangeText} /></View>
        <Text style={styles.lockedTitle}>Đặt hàng Nhôm Eurohouse</Text>
        <Text style={styles.lockedCopy}>{ui.message}</Text>
        <Button label={cta.label} onPress={() => appRouter.push(cta.href)} />
      </Card>
    </View>
  );
}

export default function OrderTreeScreen() {
  const { user, sessionTier } = useAuth();
  const access = user?.capabilities.eurohouse;
  const orderingCapability = access?.features.EUROHOUSE_ORDERING;
  const orderingPolicy = orderingScreenPolicy(orderingCapability);
  if (!orderingPolicy.canLoadCatalog) return <OrderingLockedScreen capability={orderingCapability} cta={orderingCta(sessionTier ?? 'GUEST', access)} />;
  return <ActiveOrderingScreen orderingCapability={orderingCapability!} />;
}

function ActiveOrderingScreen({ orderingCapability }: { orderingCapability: EurohouseFeatureCapability }) {
  const router = useRouter();
  const { user } = useAuth();
  const formulaCapability = user?.capabilities.formulas;
  const scrollRef = useRef<ScrollView>(null);
  const draftParams = useLocalSearchParams<{
    projectId?: string;
    projectCode?: string;
    projectName?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    quotationCode?: string;
  }>();
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [colorList, setColorList] = useState<ColorCode[]>([]);
  const [openSystem, setOpenSystem] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'browse' | 'confirm'>('browse');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [note, setNote] = useState('');
  const [accessoriesNote, setAccessoriesNote] = useState('');
  const [glassLines, setGlassLines] = useState<GlassLine[]>([createGlassLine()]);
  const [openGlassPicker, setOpenGlassPicker] = useState<{ id: string; field: 'color' | 'type' } | null>(null);

  useResetScrollOnFocus(scrollRef);
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [clientRequestId, setClientRequestId] = useState(createClientRequestId);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [draftAppliedKey, setDraftAppliedKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => resetScrollToTop(scrollRef), 0);
    return () => clearTimeout(timer);
  }, [step, result]);

  const load = useCallback(() => {
    api.get<CatalogSystem[]>('/catalog/systems').then((data) => {
      setSystems(data);
    }).catch((e) => setMessage(e instanceof Error ? e.message : 'Lỗi tải danh mục'));
    api.get<ColorCode[]>('/catalog/colors').then((data) => {
      setColorList(data);
      setSelectedColors((cur) => (cur.length ? cur : data[0] ? [data[0].code] : []));
    }).catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draftParams.projectId || systems.length === 0) return;
    const key = `${draftParams.projectId}:${draftParams.quotationCode || ''}`;
    if (draftAppliedKey === key) return;
    setDraftAppliedKey(key);

    setCustomerName(String(draftParams.customerName || ''));
    setCustomerPhone(String(draftParams.customerPhone || ''));
    setDeliveryAddress(String(draftParams.deliveryAddress || ''));
    setNote(`Đơn từ công trình ${draftParams.projectName || draftParams.projectCode || draftParams.projectId}`);
    setStep('browse');

    if (!draftParams.quotationCode) {
      setMessage('Đã mở đơn hàng từ công trình. Công trình chưa liên kết báo giá nên vui lòng chọn thanh nhôm thủ công.');
      return;
    }

    api.get<QuotationRecord>(`/quotations/${draftParams.quotationCode}`)
      .then(async (quotation) => {
        const draft = await buildQuantitiesFromQuotation(quotation, systems, formulaCapability);
        setSelectedColors((cur) => {
          const quoteColors = Array.from(new Set(quotation.items.map((item) => item.color).filter(Boolean))) as string[];
          return quoteColors.length ? quoteColors : cur;
        });
        if (Object.keys(draft.quantities).length > 0) {
          setQty(draft.quantities);
          setOpenSystem(draft.firstSystemId ?? systems[0]?.id ?? null);
          setMessage(`Đã bóc tách tạm tính ${draft.lines} dòng thanh nhôm từ báo giá ${quotation.code}. Vui lòng rà soát số cây trước khi gửi.`);
        } else {
          setMessage(`Chưa ánh xạ được hệ nhôm trong báo giá ${quotation.code}. Vui lòng chọn thanh nhôm thủ công.`);
        }
      })
      .catch(() => {
        setMessage('Không tải được báo giá liên kết. Vui lòng chọn thanh nhôm thủ công.');
      });
  }, [draftParams.projectId, draftParams.projectCode, draftParams.projectName, draftParams.customerName, draftParams.customerPhone, draftParams.deliveryAddress, draftParams.quotationCode, draftAppliedKey, systems, formulaCapability]);

  const visibleSystems = useMemo(() => {
    return systems.filter((sys) => isSystemAllowedForColors(sys, selectedColors, colorList));
  }, [systems, selectedColors, colorList]);

  useEffect(() => {
    const visibleSystemIds = visibleSystems.map((system) => system.id);
    setOpenSystem((currentSystemId) => reconcileOpenCatalogSystem(currentSystemId, visibleSystemIds));
  }, [visibleSystems]);

  const colorRuleHint = useMemo(() => {
    if (!selectedColors.length) return null;
    const hasGroup2 = selectedColors.some((colCode) => {
      const colObj = colorList.find((c) => c.code === colCode || c.id === colCode);
      const s = normalizeText(`${colCode} ${colObj?.name || ''}`);
      return s.includes('cafe thuong') || s.includes('cafe_thuong') || s.includes('cafe-thuong') || s.includes('rita');
    });
    const hasGroup1 = selectedColors.some((colCode) => {
      const colObj = colorList.find((c) => c.code === colCode || c.id === colCode);
      const s = normalizeText(`${colCode} ${colObj?.name || ''}`);
      return !s.includes('cafe thuong') && !s.includes('cafe_thuong') && !s.includes('cafe-thuong') && !s.includes('rita');
    });

    if (hasGroup2 && !hasGroup1) {
      return 'Màu Café thường / Xám Rita: Chỉ khả dụng Hệ 55 Vát Cạnh, Preco & Mặt dựng';
    }
    if (hasGroup1 && !hasGroup2) {
      return 'Màu Metalic / Vân gỗ / Ngọc trai: Khả dụng tất cả hệ (trừ Preco, Mặt dựng, Nội thất)';
    }
    return 'Áp dụng danh mục hệ nhôm theo các màu đã chọn';
  }, [selectedColors, colorList]);

  const profileById = useMemo(() => {
    const map = new Map<string, CatalogProfile>();
    systems.forEach((s) => s.profiles.forEach((p) => map.set(p.id, p)));
    return map;
  }, [systems]);

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = normalizeText(searchQuery);
    const list: { profile: CatalogProfile; systemName: string }[] = [];
    visibleSystems.forEach((sys) => {
      sys.profiles.forEach((p) => {
        const text = `${normalizeText(p.code)} ${normalizeText(p.name)} ${normalizeText(sys.name)}`;
        if (text.includes(q)) {
          list.push({ profile: p, systemName: sys.name });
        }
      });
    });
    return list;
  }, [searchQuery, visibleSystems]);

  const cart = useMemo(() => {
    let totalKg = 0;
    let lines = 0;
    const items: { id: string; profileId: string; colorCode: string; colorName: string; code: string; name: string; quantity: number; kg: number }[] = [];
    Object.entries(qty).forEach(([id, q]) => {
      if (!q) return;
      const p = profileById.get(id);
      if (!p) return;
      const kg = theoreticalKgPerBar(p) * q;
      selectedColors.forEach((colorCode) => {
        const colorName = colorList.find((color) => color.code === colorCode)?.name || colorCode;
        lines += 1;
        totalKg += kg;
        items.push({ id: `${id}:${colorCode}`, profileId: id, colorCode, colorName, code: p.code, name: p.name, quantity: q, kg });
      });
    });
    return { totalKg, lines, items };
  }, [qty, profileById, selectedColors, colorList]);

  function toggleColor(code: string) {
    setSelectedColors((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }

  function setQuantity(id: string, value: number) {
    setQty((cur) => ({ ...cur, [id]: Math.max(0, value) }));
  }

  function updateGlassLine(id: string, patch: Partial<GlassLine>) {
    setGlassLines((cur) => cur.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addGlassLine() {
    setGlassLines((cur) => [...cur, createGlassLine()]);
  }

  function removeGlassLine(id: string) {
    setGlassLines((cur) => (cur.length <= 1 ? [createGlassLine()] : cur.filter((line) => line.id !== id)));
    setOpenGlassPicker((cur) => (cur?.id === id ? null : cur));
  }

  function toggleGlassPicker(id: string, field: 'color' | 'type') {
    setOpenGlassPicker((cur) => (cur?.id === id && cur.field === field ? null : { id, field }));
  }

  function selectGlassOption(id: string, field: 'color' | 'type', value: string) {
    updateGlassLine(id, field === 'color' ? { glassColor: value } : { glassType: value, customGlassType: '' });
    setOpenGlassPicker(null);
  }

  function goToConfirm() {
    setMessage('');
    if (selectedColors.length === 0) {
      setMessage('Chọn ít nhất một màu.');
      return;
    }
    if (cart.lines === 0) {
      setMessage('Chọn ít nhất một thanh nhôm.');
      return;
    }
    setStep('confirm');
  }

  async function submit() {
    setMessage('');
    setSubmitting(true);
    try {
      const items = cart.items.map((item) => {
        const p = profileById.get(item.profileId)!;
        return { profileId: item.profileId, productCode: p.code, productName: p.name, colorCode: item.colorCode, quantity: item.quantity };
      });
      const order = await guardEurohouseMutation(orderingCapability, () => api.post<CreateOrderResult>('/orders', {
        sourceType: 'FACTORY',
        clientRequestId,
        submitToNpp: true,
        colorCode: selectedColors.join(', '),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        note: note || undefined,
        accessoriesNote: buildAccessoriesNote(accessoriesNote, glassLines) || undefined,
        items,
      }));
      setResult(order);
      setQty({});
      setClientRequestId(createClientRequestId());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Tạo đơn thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  function resetAfterSuccess() {
    setResult(null);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setNote('');
    setAccessoriesNote('');
    setGlassLines([createGlassLine()]);
    setClientRequestId(createClientRequestId());
    setStep('browse');
  }

  async function exportOrderPdf(order: CreateOrderResult) {
    setExportingPdf(true);
    try {
      const target = `${FileSystem.cacheDirectory}phieu-dat-hang-${order.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/orders/${order.id}/pdf`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Phiếu đặt hàng ${order.code}` });
      } else {
        Alert.alert('Đã tải PDF', `Đã lưu file tại: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  const glassOptions = openGlassPicker?.field === 'color' ? GLASS_COLORS : GLASS_TYPES;
  const pickerLine = openGlassPicker ? glassLines.find((line) => line.id === openGlassPicker.id) : undefined;

  if (result) {
    const hasWarnings = Boolean(result.nppWarning);
    return (
      <View style={wsStyles.screen}>
        <AppHeader title="Đặt hàng nhôm" subtitle="Đơn đã được tạo" />
        <ScrollView ref={scrollRef} contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
          <Card style={styles.successCard}>
            <View style={styles.successIcon}><Icon name="check-circle" size={28} color={ws.success} /></View>
            <Text style={styles.successTitle}>Đã tạo đơn {result.code}</Text>
            <Text style={styles.successSub}>{result.status === 'NEW' && result.nppName ? `Đã gửi tới ${result.nppName}` : 'Đơn đang lưu nháp; cần gán NPP trước khi gửi'}</Text>
          </Card>

          {hasWarnings ? <View style={styles.gapTop}><Banner tone="warning" title="Lưu ý" text={result.nppWarning ?? ''} /></View> : null}

          <View style={styles.stack}>
            <Button label="Xem chi tiết đơn" icon="file-text" onPress={() => router.push(`/order/${result.id}` as Href)} />
            <Button label={exportingPdf ? 'Đang xuất PDF...' : 'Xuất phiếu đặt hàng PDF'} icon="download" variant="secondary" loading={exportingPdf} onPress={() => exportOrderPdf(result)} />
            <Button label="Đặt thêm đơn khác" icon="plus" variant="soft" onPress={resetAfterSuccess} />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (step === 'confirm') {
    return (
      <View style={wsStyles.screen}>
        <AppHeader title="Xác nhận đơn hàng" subtitle="Kiểm tra lại trước khi gửi NPP" onBack={() => setStep('browse')} />
        <ScrollView ref={scrollRef} contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <KpiRow>
            <Kpi label="Loại thanh × màu" value={String(cart.lines)} />
            <Kpi label="Dự tính" value={kg(cart.totalKg)} />
            <Kpi label="Màu" value={String(selectedColors.length)} />
          </KpiRow>

          <SectionHead title="Danh sách thanh nhôm" sub="NPP cân hàng và xác nhận giá chính thức khi giao" />
          <Card padded={false}>
            {cart.items.map((item, index) => (
              <ListRow key={item.id} first={index === 0}>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle}>{item.code}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>{item.name} · {item.colorName}</Text>
                </View>
                <Text style={styles.qtyText}>×{item.quantity}</Text>
                <Text style={styles.kgText}>{kg(item.kg, 2)}</Text>
              </ListRow>
            ))}
            <ValueLine label="Tổng dự tính" value={kg(cart.totalKg, 2)} strong />
          </Card>

          <SectionHead title="Ghi chú & phụ kiện" />
          <Card>
            <FieldLabel>Ghi chú đơn hàng</FieldLabel>
            <Input value={note} onChangeText={setNote} multiline placeholder="Thời gian nhận, địa điểm giao hoặc yêu cầu riêng" />
            <Field label="Phụ kiện đi kèm (không bắt buộc)">
              <Input
                value={accessoriesNote}
                onChangeText={setAccessoriesNote}
                multiline
                style={styles.tallInput}
                placeholder={'- Khoá Severnday hệ 55 = 5 bộ\n- Keo silicon A500 = 1 thùng\n- Ron EPDM 8mm = 20m'}
              />
            </Field>
          </Card>

          <SectionHead
            title="Đặt kính"
            sub="Kích thước tính bằng mm"
            action={<Button label="Thêm kính" icon="plus" variant="soft" onPress={addGlassLine} style={styles.smallButton} />}
          />
          {glassLines.map((line, index) => (
            <Card key={line.id} style={styles.glassCard}>
              <View style={styles.glassHead}>
                <Text style={wsStyles.rowTitle}>Kính #{index + 1}</Text>
                <IconButton icon="trash-2" tone="danger" label={`Xoá kính ${index + 1}`} onPress={() => removeGlassLine(line.id)} />
              </View>
              <View style={wsStyles.row}>
                <View style={wsStyles.half}>
                  <FieldLabel>Màu kính</FieldLabel>
                  <SelectBox value={line.glassColor} placeholder="Chọn màu" onPress={() => toggleGlassPicker(line.id, 'color')} />
                </View>
                <View style={wsStyles.half}>
                  <FieldLabel>Loại kính</FieldLabel>
                  <SelectBox value={line.glassType === 'Loại khác' && line.customGlassType ? line.customGlassType : line.glassType} placeholder="Chọn loại" onPress={() => toggleGlassPicker(line.id, 'type')} />
                </View>
              </View>
              {line.glassType === 'Loại khác' ? (
                <Field label="Loại kính khác">
                  <Input value={line.customGlassType} onChangeText={(value) => updateGlassLine(line.id, { customGlassType: value })} placeholder="Nhập loại kính" />
                </Field>
              ) : null}
              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Rộng</FieldLabel><Input value={line.widthMm} onChangeText={(value) => updateGlassLine(line.id, { widthMm: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="mm" /></View>
                <View style={wsStyles.half}><FieldLabel>Dài</FieldLabel><Input value={line.heightMm} onChangeText={(value) => updateGlassLine(line.id, { heightMm: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="mm" /></View>
                <View style={styles.qtyCol}><FieldLabel>SL</FieldLabel><Input value={line.quantity} onChangeText={(value) => updateGlassLine(line.id, { quantity: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder="1" /></View>
              </View>
            </Card>
          ))}

          {message ? <View style={styles.gapTop}><Banner tone="error" text={message} /></View> : null}

          <View style={styles.stack}>
            <Button label={submitting ? 'Đang gửi...' : 'Xác nhận gửi đơn'} icon="send" loading={submitting} onPress={submit} />
            <Button label="Quay lại chọn thêm" icon="arrow-left" variant="secondary" onPress={() => setStep('browse')} />
          </View>
        </ScrollView>

        <OptionSheet
          visible={Boolean(openGlassPicker)}
          title={openGlassPicker?.field === 'color' ? 'Chọn màu kính' : 'Chọn loại kính'}
          options={glassOptions}
          value={openGlassPicker?.field === 'color' ? pickerLine?.glassColor : pickerLine?.glassType}
          onSelect={(value) => openGlassPicker && selectGlassOption(openGlassPicker.id, openGlassPicker.field, value)}
          onClose={() => setOpenGlassPicker(null)}
        />
      </View>
    );
  }

  const renderProfile = (p: CatalogProfile, index: number, systemName?: string) => (
    <ListRow key={p.id} first={index === 0}>
      <ProfileThumb imageUrl={p.imageUrl} size={44} />
      <View style={wsStyles.grow}>
        <Text style={wsStyles.rowTitle}>{p.code}</Text>
        <Text style={wsStyles.rowMeta} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.metaFaint} numberOfLines={1}>{systemName ? `${systemName} · ` : ''}{kg(theoreticalKgPerBar(p), 2)}/cây</Text>
      </View>
      <QtyStepper value={qty[p.id] ?? 0} onChange={(value) => setQuantity(p.id, value)} />
    </ListRow>
  );

  return (
    <View style={wsStyles.screen}>
      <AppHeader title="Đặt hàng nhôm" subtitle="Chọn màu → hệ → thanh → số lượng" />
      <ScrollView ref={scrollRef} contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SectionHead title="Mã màu" sub={`Chọn một hoặc nhiều màu · đã chọn ${selectedColors.length}`} />
        <View style={styles.colorGrid}>
          {colorList.map((c) => {
            const active = selectedColors.includes(c.code);
            return (
              <Pressable
                key={c.code}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                onPress={() => toggleColor(c.code)}
                style={[styles.colorCard, active && styles.colorCardOn]}
              >
                <View style={[styles.colorDot, { backgroundColor: c.hex ?? '#ccc' }]} />
                <Text style={[styles.colorText, active && styles.colorTextOn]} numberOfLines={2}>{colorLabel(c.name)}</Text>
                <View style={[styles.checkBox, active && styles.checkBoxOn]}>{active ? <Icon name="check" size={11} color={ws.surface} /> : null}</View>
              </Pressable>
            );
          })}
        </View>

        {colorRuleHint ? <View style={styles.gapTop}><Banner tone="orange" text={colorRuleHint} /></View> : null}

        <View style={styles.gapTop}>
          <SearchBox value={searchQuery} onChangeText={setSearchQuery} placeholder="Tìm nhanh mã thanh (DAK55, DAD91, E70...)" />
        </View>

        {searchQuery.trim() ? (
          <>
            <SectionHead title="Kết quả tìm" sub={`${filteredProfiles.length} thanh khớp "${searchQuery.trim()}"`} />
            {filteredProfiles.length === 0 ? (
              <EmptyState icon="search" title="Không tìm thấy thanh nhôm" text="Thử mã khác, hoặc đổi màu để mở thêm hệ nhôm." />
            ) : (
              <Card padded={false}>{filteredProfiles.map(({ profile, systemName }, index) => renderProfile(profile, index, systemName))}</Card>
            )}
          </>
        ) : (
          <>
            <SectionHead title="Hệ nhôm" sub={`${visibleSystems.length} hệ phù hợp với màu đã chọn`} />
            {visibleSystems.length === 0 ? <EmptyState icon="layers" title="Chưa có hệ nhôm" text="Danh mục đang tải hoặc không có hệ phù hợp với màu đã chọn." /> : null}
            {visibleSystems.map((system) => {
              const open = openSystem === system.id;
              const sysQty = system.profiles.reduce((sum, p) => sum + (qty[p.id] ?? 0), 0);
              return (
                <Card key={system.id} padded={false} style={styles.systemCard}>
                  <ListRow first onPress={() => setOpenSystem(open ? null : system.id)} label={`${open ? 'Thu gọn' : 'Mở'} ${system.name}`}>
                    <View style={wsStyles.avatar}><Icon name="layers" size={17} color={ws.orangeText} /></View>
                    <View style={wsStyles.grow}>
                      <Text style={wsStyles.rowTitle}>{system.name}</Text>
                      <Text style={wsStyles.rowMeta}>{system.profiles.length} thanh · {system.code}</Text>
                    </View>
                    {sysQty > 0 ? <View style={styles.countBadge}><Text style={styles.countText}>{sysQty}</Text></View> : null}
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={ws.muted} />
                  </ListRow>
                  {open ? <View style={styles.profileList}>{system.profiles.map((p, index) => renderProfile(p, index))}</View> : null}
                </Card>
              );
            })}
          </>
        )}

        {message ? <View style={styles.gapTop}><Banner tone="warning" text={message} /></View> : null}
        <View style={{ height: 90 }} />
      </ScrollView>

      {shouldShowOrderSummary(cart.lines) ? (
        <View style={styles.summaryBar}>
          <View style={wsStyles.grow}>
            <Text style={styles.summaryTitle}>{cart.lines} loại · {kg(cart.totalKg)}</Text>
            <Text style={styles.summarySub} numberOfLines={1}>{selectedColors.length} màu · NPP xác nhận giá sau khi cân</Text>
          </View>
          <Button label="Xem lại đơn" icon="send" onPress={goToConfirm} style={styles.summaryButton} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockedCard: { margin: 16, alignItems: 'center', gap: 10, paddingVertical: 24 },
  lockedIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: ws.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { color: ws.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  lockedCopy: { color: ws.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 420, marginBottom: 6 },
  gapTop: { marginTop: 10 },
  stack: { gap: 10, marginTop: 16 },
  successCard: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  successIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: ws.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { color: ws.ink, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  successSub: { color: ws.muted, fontSize: 13, textAlign: 'center' },
  qtyText: { color: ws.orangeText, fontSize: 13, fontWeight: '800' },
  kgText: { minWidth: 78, textAlign: 'right', color: ws.ink, fontSize: 13, fontWeight: '800' },
  tallInput: { minHeight: 110 },
  smallButton: { minHeight: 38, paddingHorizontal: 12 },
  glassCard: { marginBottom: 10 },
  glassHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  qtyCol: { width: 70 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorCard: { width: '48.5%', minHeight: 50, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: ws.line, backgroundColor: ws.surface },
  colorCardOn: { borderColor: ws.orange, backgroundColor: ws.orangeSoft },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  colorText: { flex: 1, color: ws.body, fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  colorTextOn: { color: ws.orangeText, fontWeight: '800' },
  checkBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: ws.field, alignItems: 'center', justifyContent: 'center', backgroundColor: ws.surface },
  checkBoxOn: { backgroundColor: ws.orange, borderColor: ws.orange },
  systemCard: { marginBottom: 10 },
  profileList: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  metaFaint: { color: ws.faint, fontSize: 11, marginTop: 1 },
  countBadge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  countText: { color: ws.surface, fontSize: 12, fontWeight: '900' },
  summaryBar: { position: 'absolute', left: 14, right: 14, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 14, paddingRight: 10, borderRadius: 16, backgroundColor: ws.surface, borderWidth: 1, borderColor: ws.line, shadowColor: '#101828', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  summaryTitle: { color: ws.ink, fontSize: 14, fontWeight: '900' },
  summarySub: { color: ws.muted, fontSize: 11.5, marginTop: 1 },
  summaryButton: { minHeight: 42 },
});
