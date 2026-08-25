import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { CatalogProfile, CatalogSystem, ColorCode } from '@eurohouse/types';
import { AppHeader } from '../../../src/components/AppHeader';
import { Icon } from '../../../src/components/Icon';
import { ProfileThumb } from '../../../src/components/ProfileThumb';
import { api } from '../../../src/lib/api';
import { isSystemAllowedForColors } from '../../orders';

const STD_BAR_M = 6;

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

function createGlassLine(): GlassLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, glassColor: GLASS_COLORS[0], glassType: GLASS_TYPES[0], customGlassType: '', widthMm: '', heightMm: '', quantity: '1' };
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

type OrderDetail = {
  id: string; code: string; status: string;
  customerName: string; customerPhone: string; deliveryAddress: string;
  colorCode: string; note: string; accessoriesNote: string;
  items: { profileId: string | null; productCode: string; productName: string; quantity: number }[];
};

export default function EditOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [colorList, setColorList] = useState<ColorCode[]>([]);
  const [openSystem, setOpenSystem] = useState<string | null>(null);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [accessoriesNote, setAccessoriesNote] = useState('');
  const [glassLines, setGlassLines] = useState<GlassLine[]>([createGlassLine()]);
  const [openGlassPicker, setOpenGlassPicker] = useState<{ id: string; field: 'color' | 'type' } | null>(null);

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    api.get<OrderDetail>(`/orders/${id}`).then((o) => {
      setOrder(o);
      setNote(o.note);
      setAccessoriesNote(o.accessoriesNote);
      setSelectedColors(o.colorCode ? o.colorCode.split(', ').filter(Boolean) : []);
      const qtyMap: Record<string, number> = {};
      for (const item of o.items) {
        if (item.profileId) qtyMap[item.profileId] = item.quantity;
      }
      setQty(qtyMap);
    }).catch((e) => setMessage(e instanceof Error ? e.message : 'Không tải được đơn.'));
  }, [id]));

  useEffect(() => {
    api.get<CatalogSystem[]>('/catalog/systems').then((data) => {
      setSystems(data);
      setOpenSystem((cur) => cur ?? data[0]?.id ?? null);
    }).catch(() => undefined);
    api.get<ColorCode[]>('/catalog/colors').then(setColorList).catch(() => undefined);
  }, []);

  const visibleSystems = useMemo(() => {
    return systems.filter((sys) => isSystemAllowedForColors(sys, selectedColors, colorList));
  }, [systems, selectedColors, colorList]);

  useEffect(() => {
    if (visibleSystems.length > 0) {
      setOpenSystem((cur) => {
        if (!cur || !visibleSystems.some((s) => s.id === cur)) {
          return visibleSystems[0].id;
        }
        return cur;
      });
    }
  }, [visibleSystems]);

  const colorRuleHint = useMemo(() => {
    if (!selectedColors.length) return null;
    const hasGroup2 = selectedColors.some((colCode) => {
      const colObj = colorList.find((c) => c.code === colCode || c.id === colCode);
      const s = (colCode + ' ' + (colObj?.name || '')).toLowerCase();
      return s.includes('cafe thuong') || s.includes('cafe_thuong') || s.includes('cafe-thuong') || s.includes('rita');
    });
    const hasGroup1 = selectedColors.some((colCode) => {
      const colObj = colorList.find((c) => c.code === colCode || c.id === colCode);
      const s = (colCode + ' ' + (colObj?.name || '')).toLowerCase();
      return !s.includes('cafe thuong') && !s.includes('cafe_thuong') && !s.includes('cafe-thuong') && !s.includes('rita');
    });

    if (hasGroup2 && !hasGroup1) {
      return 'Màu Café thường / Xám Rita: Chỉ khả dụng Hệ 55 Euroqueen, Preco & Mặt dựng';
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

  const cart = useMemo(() => {
    let totalKg = 0; let totalAmount = 0; let lines = 0;
    const items: { id: string; profileId: string; colorCode: string; code: string; name: string; quantity: number; kg: number; amount: number }[] = [];
    Object.entries(qty).forEach(([id, q]) => {
      if (!q) return;
      const p = profileById.get(id);
      if (!p) return;
      const kg = theoreticalKgPerBar(p) * q;
      const amount = kg * p.pricePerKg;
      selectedColors.forEach((colorCode) => {
        lines += 1; totalKg += kg; totalAmount += amount;
        items.push({ id: `${id}:${colorCode}`, profileId: id, colorCode, code: p.code, name: p.name, quantity: q, kg, amount });
      });
    });
    return { totalKg, totalAmount, lines, items };
  }, [qty, profileById, selectedColors]);

  function toggleColor(code: string) {
    setSelectedColors((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
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

  async function save(sendToNpp = false) {
    if (!order) return;
    setMessage(''); setSubmitting(true);
    try {
      const items = cart.items.map((item) => {
        const p = profileById.get(item.profileId)!;
        return { profileId: item.profileId, productCode: p.code, productName: p.name, colorCode: item.colorCode, quantity: item.quantity };
      });
      await api.patch(`/orders/${order.id}`, {
        colorCode: selectedColors.join(', '),
        note: note || '',
        accessoriesNote: buildAccessoriesNote(accessoriesNote, glassLines) || '',
        items: items.length ? items : undefined,
      });
      if (sendToNpp) {
        await api.post(`/orders/${order.id}/submit-npp`);
      }
      router.back();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
        <AppHeader title="Sửa đơn hàng" />
        {message ? <Text style={{ color: colors.danger, padding: 18, fontWeight: '700' }}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title={`Sửa đơn ${order.code}`} subtitle="Chỉ sửa được khi đơn còn Mới" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Text style={styles.label}>Mã màu</Text>
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

        {colorRuleHint ? (
          <View style={styles.colorRuleBox}>
            <Icon name="sliders" size={13} color={colors.brandOrangeText} />
            <Text style={styles.colorRuleText}>{colorRuleHint}</Text>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 4 }]}>Danh sách thanh nhôm</Text>
        {visibleSystems.map((system) => {
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

        <Text style={[styles.label, { marginTop: 16 }]}>Ghi chú đơn hàng</Text>
        <TextInput style={[styles.input, { height: 80 }]} placeholder="Ghi chú giao hàng, thời gian nhận hoặc yêu cầu riêng" value={note} onChangeText={setNote} multiline placeholderTextColor="#94A3B8" />

        <Text style={[styles.label, { marginTop: 8 }]}>Phụ kiện đi kèm</Text>
        <TextInput
          style={[styles.input, { height: 120 }]}
          placeholder={"- Khoá Severnday hệ 55 = 5 bộ\n- Keo silicon A500 = 1 thùng"}
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

        <View style={styles.actionRow}>
          <Pressable style={[styles.draftBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={() => save(false)}>
            <Icon name="save" size={15} color={colors.brandOrangeText} />
            <Text style={styles.draftBtnText}>{submitting ? 'Đang lưu...' : 'Lưu đơn'}</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, styles.sendBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={() => save(true)}>
            <Icon name="send" size={15} color={colors.brandBlack.main} />
            <Text style={styles.primaryBtnText}>{submitting ? 'Đang gửi...' : 'Gửi NPP'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Huỷ</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 20 },
  label: { color: colors.brandBlack.main, fontWeight: '800', marginBottom: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.white, width: '48%', shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  colorChipActive: { borderWidth: 1.5, borderColor: colors.brandOrange },
  colorDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  colorText: { flex: 1, color: colors.brandGrey[500], fontWeight: '700', fontSize: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#D5D8DC', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  colorRuleBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  colorRuleText: { flex: 1, color: colors.brandOrangeText, fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  treeNode: { borderRadius: 18, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.white, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { backgroundColor: colors.brandOrange },
  stepVal: { minWidth: 22, textAlign: 'center', color: colors.brandBlack.main, fontWeight: '900' },
  input: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, color: colors.brandBlack.main, fontSize: 14 },
  errorText: { color: colors.danger, fontWeight: '700', marginTop: 12 },
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  draftBtn: { flex: 1, minHeight: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.brandOrange, borderRadius: 16 },
  draftBtnText: { color: colors.brandOrangeText, fontWeight: '900' },
  sendBtn: { flex: 1, marginTop: 0 },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 15, marginTop: 20 },
  primaryBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  secondaryBtnText: { color: colors.brandGrey[500], fontWeight: '700' },
});
