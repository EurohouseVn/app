import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import type { CatalogProfile, CatalogSystem, ColorCode, CreateOrderResult, QuotationRecord } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { ProfileThumb } from '../src/components/ProfileThumb';
import { api, API_URL, authHeaders } from '../src/lib/api';

const STD_BAR_M = 6;

function actualKgPerBar(profile: Pick<CatalogProfile, 'actualKgPerBar' | 'kgPerMeter' | 'barLengthMm'>) {
  const fallback = profile.kgPerMeter * ((profile.barLengthMm ?? STD_BAR_M * 1000) / 1000);
  return profile.actualKgPerBar && profile.actualKgPerBar > 0 ? profile.actualKgPerBar : fallback;
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

async function buildQuantitiesFromQuotation(quotation: QuotationRecord, systems: CatalogSystem[]) {
  const quantities: Record<string, number> = {};
  let firstSystemId: string | undefined;
  let lines = 0;
  const profileByCode = new Map<string, { profile: CatalogProfile; systemId: string }>();
  systems.forEach((system) => system.profiles.forEach((profile) => profileByCode.set(profile.code.toUpperCase(), { profile, systemId: system.id })));

  for (const item of quotation.items) {
    if (item.templateId) {
      try {
        const result = await api.post<{ aluminum?: { code?: string; quantity?: number }[] }>(`/formulas/templates/${item.templateId}/calc`, {
          width: item.widthMm,
          height: item.heightMm,
          quantity: item.quantity,
        });
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

export default function OrderTreeScreen() {
  const router = useRouter();
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
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [clientRequestId, setClientRequestId] = useState(createClientRequestId);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [draftAppliedKey, setDraftAppliedKey] = useState('');

  const load = useCallback(() => {
    api.get<CatalogSystem[]>('/catalog/systems').then((data) => {
      setSystems(data);
      setOpenSystem((cur) => cur ?? data[0]?.id ?? null);
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
    setNote(`Don tu cong trinh ${draftParams.projectName || draftParams.projectCode || draftParams.projectId}`);
    setStep('browse');

    if (!draftParams.quotationCode) {
      setMessage('Da mo don hang tu cong trinh. Cong trinh chua lien ket bao gia nen vui long chon thanh nhom thu cong.');
      return;
    }

    api.get<QuotationRecord>(`/quotations/${draftParams.quotationCode}`)
      .then(async (quotation) => {
        const draft = await buildQuantitiesFromQuotation(quotation, systems);
        setSelectedColors((cur) => {
          const quoteColors = Array.from(new Set(quotation.items.map((item) => item.color).filter(Boolean))) as string[];
          return quoteColors.length ? quoteColors : cur;
        });
        if (Object.keys(draft.quantities).length > 0) {
          setQty(draft.quantities);
          setOpenSystem(draft.firstSystemId ?? systems[0]?.id ?? null);
          setMessage(`Da boc tach tam tinh ${draft.lines} dong thanh nhom tu bao gia ${quotation.code}. Vui long ra soat so cay truoc khi gui.`);
        } else {
          setMessage(`Chua map duoc he nhom trong bao gia ${quotation.code}. Vui long chon thanh nhom thu cong.`);
        }
      })
      .catch(() => {
        setMessage('Khong tai duoc bao gia lien ket. Vui long chon thanh nhom thu cong.');
      });
  }, [draftParams.projectId, draftParams.projectCode, draftParams.projectName, draftParams.customerName, draftParams.customerPhone, draftParams.deliveryAddress, draftParams.quotationCode, draftAppliedKey, systems]);

  const profileById = useMemo(() => {
    const map = new Map<string, CatalogProfile>();
    systems.forEach((s) => s.profiles.forEach((p) => map.set(p.id, p)));
    return map;
  }, [systems]);

  const cart = useMemo(() => {
    let totalKg = 0;
    let totalAmount = 0;
    let lines = 0;
    const items: { id: string; code: string; name: string; quantity: number; kg: number; amount: number }[] = [];
    Object.entries(qty).forEach(([id, q]) => {
      if (!q) return;
      const p = profileById.get(id);
      if (!p) return;
      const kg = actualKgPerBar(p) * q;
      const amount = kg * p.pricePerKg;
      lines += 1;
      totalKg += kg;
      totalAmount += amount;
      items.push({ id, code: p.code, name: p.name, quantity: q, kg, amount });
    });
    return { totalKg, totalAmount, lines, items };
  }, [qty, profileById]);

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
        const p = profileById.get(item.id)!;
        return { profileId: item.id, productCode: p.code, productName: p.name, colorCode: selectedColors.join(', '), quantity: item.quantity };
      });
      const order = await api.post<CreateOrderResult>('/orders', {
        sourceType: 'FACTORY',
        clientRequestId,
        colorCode: selectedColors.join(', '),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: deliveryAddress || undefined,
        note: note || undefined,
        accessoriesNote: buildAccessoriesNote(accessoriesNote, glassLines) || undefined,
        items,
      });
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
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Phieu dat hang ${order.code}` });
      } else {
        Alert.alert('Da tai PDF', `Da luu file tai: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Loi', e instanceof Error ? e.message : 'Khong xuat duoc PDF.');
    } finally {
      setExportingPdf(false);
    }
  }

  if (result) {
    const hasWarnings = Boolean(result.nppWarning);
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
        <AppHeader title="Đặt hàng nhôm" subtitle="Đơn đã được tạo" />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.successBox}>
            <Icon name="check-circle" size={32} color={colors.success} />
            <Text style={styles.successTitle}>Đã tạo đơn {result.code}</Text>
            <Text style={styles.successSub}>{result.nppName ? `Đã gửi tới ${result.nppName}` : 'Đang chờ gán NPP xử lý'}</Text>
          </View>

          {hasWarnings ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Lưu ý</Text>
              {result.nppWarning ? <Text style={styles.warningText}>• {result.nppWarning}</Text> : null}
            </View>
          ) : null}

          <Pressable style={styles.primaryBtn} onPress={() => router.push(`/order/${result.id}` as Href)}>
            <Text style={styles.primaryBtnText}>Xem chi tiết đơn</Text>
          </Pressable>
          <Pressable style={[styles.pdfBtn, exportingPdf && { opacity: 0.6 }]} disabled={exportingPdf} onPress={() => exportOrderPdf(result)}>
            <Icon name="file-text" size={15} color={colors.brandBlack.main} />
            <Text style={styles.pdfBtnText}>{exportingPdf ? 'Dang xuat PDF...' : 'Xuat phieu dat hang PDF'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={resetAfterSuccess}>
            <Text style={styles.secondaryBtnText}>Đặt thêm đơn khác</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (step === 'confirm') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
        <AppHeader title="Xác nhận đơn hàng" subtitle="Kiểm tra lại trước khi gửi" />
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Danh sách thanh nhôm</Text>
          {cart.items.map((item) => (
            <View key={item.id} style={styles.confirmRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmCode}>{item.code}</Text>
                <Text style={styles.confirmName} numberOfLines={1}>{item.name}</Text>
              </View>
              <Text style={styles.confirmQty}>×{item.quantity}</Text>
              <Text style={styles.confirmAmount}>{Math.round(item.amount).toLocaleString('vi-VN')} đ</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng: {cart.totalKg.toFixed(1)} kg</Text>
            <Text style={styles.totalValue}>{Math.round(cart.totalAmount).toLocaleString('vi-VN')} đ</Text>
          </View>

          <Text style={[styles.label, { marginTop: 20 }]}>Ghi chú đơn hàng</Text>
          <TextInput style={[styles.input, { height: 80 }]} placeholder="Ghi chú giao hàng, thời gian nhận hoặc yêu cầu riêng" value={note} onChangeText={setNote} multiline placeholderTextColor="#94A3B8" />

          <Text style={[styles.label, { marginTop: 16 }]}>Phụ kiện đi kèm (không bắt buộc)</Text>
          <TextInput
            style={[styles.input, { height: 120 }]}
            placeholder={"- Khoá Severnday hệ 55 = 5 bộ\n- Keo silicon A500 = 1 thùng\n- Ron EPDM 8mm = 20m"}
            value={accessoriesNote}
            onChangeText={setAccessoriesNote}
            multiline placeholderTextColor="#94A3B8" />

          <View style={styles.glassHeader}>
            <Text style={styles.label}>Đặt kính</Text>
            <Pressable style={styles.addGlassBtn} onPress={addGlassLine}>
              <Icon name="plus" size={14} color={colors.brandBlack.main} />
              <Text style={styles.addGlassText}>Thêm kích thước</Text>
            </Pressable>
          </View>
          {glassLines.map((line, index) => (
            <View key={line.id} style={styles.glassCard}>
              <View style={styles.glassTitleRow}>
                <Text style={styles.glassTitle}>Kính #{index + 1}</Text>
                <Pressable style={styles.glassRemoveBtn} onPress={() => removeGlassLine(line.id)}>
                  <Icon name="trash-2" size={14} color={colors.danger} />
                </Pressable>
              </View>
              <View style={styles.glassSelectRow}>
                <View style={styles.glassSelectWrap}>
                  <Pressable style={styles.glassSelect} onPress={() => toggleGlassPicker(line.id, 'color')}>
                    <Text style={styles.glassSelectLabel}>Màu kính</Text>
                    <View style={styles.glassSelectValueRow}>
                      <Text style={styles.glassSelectValue} numberOfLines={1}>{line.glassColor}</Text>
                      <Icon name={openGlassPicker?.id === line.id && openGlassPicker.field === 'color' ? 'chevron-up' : 'chevron-down'} size={15} color={colors.brandGrey[500]} />
                    </View>
                  </Pressable>
                  {openGlassPicker?.id === line.id && openGlassPicker.field === 'color' ? (
                    <View style={styles.glassOptions}>
                      {GLASS_COLORS.map((option) => (
                        <Pressable key={option} style={[styles.glassOption, line.glassColor === option && styles.glassOptionActive]} onPress={() => selectGlassOption(line.id, 'color', option)}>
                          <Text style={[styles.glassOptionText, line.glassColor === option && styles.glassOptionTextActive]}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.glassSelectWrap}>
                  <Pressable style={styles.glassSelect} onPress={() => toggleGlassPicker(line.id, 'type')}>
                    <Text style={styles.glassSelectLabel}>Loại kính</Text>
                    <View style={styles.glassSelectValueRow}>
                      <Text style={styles.glassSelectValue} numberOfLines={1}>{line.glassType === 'Loại khác' && line.customGlassType ? line.customGlassType : line.glassType}</Text>
                      <Icon name={openGlassPicker?.id === line.id && openGlassPicker.field === 'type' ? 'chevron-up' : 'chevron-down'} size={15} color={colors.brandGrey[500]} />
                    </View>
                  </Pressable>
                  {openGlassPicker?.id === line.id && openGlassPicker.field === 'type' ? (
                    <View style={styles.glassOptions}>
                      {GLASS_TYPES.map((option) => (
                        <Pressable key={option} style={[styles.glassOption, line.glassType === option && styles.glassOptionActive]} onPress={() => selectGlassOption(line.id, 'type', option)}>
                          <Text style={[styles.glassOptionText, line.glassType === option && styles.glassOptionTextActive]}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              {line.glassType === 'Loại khác' ? (
                <TextInput style={styles.glassInput} placeholder="Nhập loại kính khác" value={line.customGlassType} onChangeText={(value) => updateGlassLine(line.id, { customGlassType: value })} placeholderTextColor="#94A3B8" />
              ) : null}
              <View style={styles.glassSizeRow}>
                <TextInput style={styles.glassSizeInput} placeholder="Rộng" value={line.widthMm} onChangeText={(value) => updateGlassLine(line.id, { widthMm: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholderTextColor="#94A3B8" />
                <TextInput style={styles.glassSizeInput} placeholder="Dài" value={line.heightMm} onChangeText={(value) => updateGlassLine(line.id, { heightMm: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholderTextColor="#94A3B8" />
                <TextInput style={[styles.glassSizeInput, styles.glassQtyInput]} placeholder="SL" value={line.quantity} onChangeText={(value) => updateGlassLine(line.id, { quantity: value.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholderTextColor="#94A3B8" />
              </View>
              <Text style={styles.glassUnitHint}>Đơn vị kích thước: mm</Text>
            </View>
          ))}

          {message ? <Text style={styles.errorText}>{message}</Text> : null}

          <Pressable style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
            <Text style={styles.primaryBtnText}>{submitting ? 'Đang gửi...' : 'Xác nhận gửi đơn'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setStep('browse')}>
            <Text style={styles.secondaryBtnText}>Quay lại chọn thêm</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Đặt hàng nhôm" subtitle="Chọn màu → hệ → thanh → số lượng" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Mã màu</Text>
          <Text style={styles.labelHint}>Chọn 1 hoặc nhiều màu · đã chọn {selectedColors.length}</Text>
        </View>
        <View style={styles.colorGrid}>
          {colorList.map((c) => {
            const active = selectedColors.includes(c.code);
            return (
              <Pressable key={c.code} onPress={() => toggleColor(c.code)} style={[styles.colorChip, active && styles.colorChipActive]}>
                <View style={[styles.colorDot, { backgroundColor: c.hex ?? '#ccc' }]} />
                <Text style={[styles.colorText, active && { color: colors.brandBlack.main }]} numberOfLines={1}>{c.name}</Text>
                <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                  {active ? <Icon name="check" size={11} color={colors.brandBlack.main} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {systems.map((system) => {
          const open = openSystem === system.id;
          const sysQty = system.profiles.reduce((sum, p) => sum + (qty[p.id] ?? 0), 0);
          return (
            <View key={system.id} style={styles.treeNode}>
              <Pressable onPress={() => setOpenSystem(open ? null : system.id)} style={styles.treeHead}>
                <View style={styles.treeIcon}><Icon name="layers" size={16} color={colors.brandOrangeText} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.treeTitle}>{system.name}</Text>
                  <Text style={styles.treeSub}>{system.profiles.length} thanh · {system.code}</Text>
                </View>
                {sysQty > 0 ? <View style={styles.countBadge}><Text style={styles.countText}>{sysQty}</Text></View> : null}
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.brandGrey[500]} />
              </Pressable>

              {open ? (
                <View style={styles.leafWrap}>
                  {system.profiles.map((p) => (
                    <View key={p.id} style={styles.leaf}>
                      <ProfileThumb imageUrl={p.imageUrl} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leafCode}>{p.code}</Text>
                        <Text style={styles.leafName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.leafMeta}>{actualKgPerBar(p).toFixed(2)} kg thực tế/cây · {p.pricePerKg.toLocaleString('vi-VN')} đ/kg</Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable style={styles.stepBtn} onPress={() => setQuantity(p.id, (qty[p.id] ?? 0) - 1)}><Icon name="minus" size={14} color={colors.brandBlack.main} /></Pressable>
                        <Text style={styles.stepVal}>{qty[p.id] ?? 0}</Text>
                        <Pressable style={[styles.stepBtn, styles.stepBtnAdd]} onPress={() => setQuantity(p.id, (qty[p.id] ?? 0) + 1)}><Icon name="plus" size={14} color={colors.brandBlack.main} /></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {message ? <Text style={styles.errorText}>{message}</Text> : null}
        <View style={{ height: 150 }} />
      </ScrollView>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sumLabel}>{cart.lines} loại · {cart.totalKg.toFixed(1)} kg · {selectedColors.length} màu</Text>
          <Text style={styles.sumValue}>{Math.round(cart.totalAmount).toLocaleString('vi-VN')} đ</Text>
        </View>
        <Pressable style={styles.submit} onPress={goToConfirm}>
          <Icon name="send" size={15} color={colors.brandBlack.main} />
          <Text style={styles.submitText}>Xem lại đơn</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  label: { color: colors.brandBlack.main, fontWeight: '800' },
  labelHint: { color: colors.brandOrangeText, fontWeight: '700', fontSize: 12 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.white, width: '48%', shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  colorChipActive: { borderWidth: 1.5, borderColor: colors.brandOrange },
  colorDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  colorText: { flex: 1, color: colors.brandGrey[500], fontWeight: '700', fontSize: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#D5D8DC', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  treeNode: { borderRadius: 18, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.white, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  treeHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.white },
  treeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  treeTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  treeSub: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  countBadge: { backgroundColor: colors.brandOrange, borderRadius: 999, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 12 },
  leafWrap: { backgroundColor: '#FBFBFC', paddingHorizontal: 14, paddingBottom: 8 },
  leaf: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  leafCode: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13 },
  leafName: { color: colors.brandBlack.main, fontSize: 12 },
  leafMeta: { color: colors.brandGrey[500], fontSize: 11, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { backgroundColor: colors.brandOrange },
  stepVal: { minWidth: 22, textAlign: 'center', color: colors.brandBlack.main, fontWeight: '900' },
  errorText: { color: colors.danger, fontWeight: '700', marginTop: 12 },
  summary: { position: 'absolute', left: 16, right: 16, bottom: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.brandBlack.main, borderRadius: 22, padding: 16, paddingHorizontal: 18, shadowColor: colors.brandBlack.main, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  sumLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 12 },
  sumValue: { color: colors.white, fontWeight: '900', fontSize: 19, marginTop: 2 },
  submit: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13 },
  submitText: { color: colors.brandBlack.main, fontWeight: '900' },
  input: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, color: colors.brandBlack.main, fontSize: 14 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  confirmCode: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13 },
  confirmName: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  confirmQty: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 13 },
  confirmAmount: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 13, minWidth: 90, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.brandBlack.main, borderRadius: 16, padding: 16, marginTop: 6 },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 13 },
  totalValue: { color: colors.white, fontWeight: '900', fontSize: 18 },
  glassHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 10 },
  addGlassBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, borderRadius: 999, paddingHorizontal: 12 },
  addGlassText: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 12 },
  glassCard: { backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 10 },
  glassTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  glassTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 13 },
  glassRemoveBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandRed.soft },
  glassSelectRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  glassSelectWrap: { flex: 1 },
  glassSelect: { minHeight: 50, backgroundColor: colors.brandGrey[50], borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center' },
  glassSelectLabel: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '800', marginBottom: 3 },
  glassSelectValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  glassSelectValue: { flex: 1, color: colors.brandBlack.main, fontSize: 13, fontWeight: '900' },
  glassOptions: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brandGrey[200], borderRadius: 12, marginTop: 6, padding: 4, shadowColor: colors.brandBlack.main, shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  glassOption: { minHeight: 40, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 10 },
  glassOptionActive: { backgroundColor: colors.orangeSoft },
  glassOptionText: { color: colors.brandGrey[600], fontWeight: '700', fontSize: 12 },
  glassOptionTextActive: { color: colors.brandOrangeText, fontWeight: '900' },
  glassInput: { minHeight: 44, backgroundColor: colors.brandGrey[50], borderRadius: 12, paddingHorizontal: 12, color: colors.brandBlack.main, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  glassSizeRow: { flexDirection: 'row', gap: 8 },
  glassSizeInput: { flex: 1, minWidth: 0, minHeight: 44, backgroundColor: colors.brandGrey[50], borderRadius: 12, paddingHorizontal: 10, color: colors.brandBlack.main, fontSize: 13, fontWeight: '700' },
  glassQtyInput: { flex: 0.72 },
  glassUnitHint: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 11, marginTop: 6 },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 15, marginTop: 20 },
  primaryBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
  pdfBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.brandOrange, borderRadius: 16, paddingVertical: 15, marginTop: 10 },
  pdfBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  secondaryBtnText: { color: colors.brandGrey[500], fontWeight: '700' },
  successBox: { alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 20, padding: 24, marginTop: 8 },
  successTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 17, marginTop: 4 },
  successSub: { color: colors.brandGrey[500], fontSize: 13 },
  warningBox: { backgroundColor: '#FFF8E5', borderRadius: 16, padding: 16, marginTop: 16, gap: 4 },
  warningTitle: { color: colors.warning, fontWeight: '900', fontSize: 13 },
  warningText: { color: colors.brandBlack.main, fontSize: 12.5, lineHeight: 18 },
});
