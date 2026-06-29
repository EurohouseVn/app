import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { ProfileThumb } from '../src/components/ProfileThumb';
import { api } from '../src/lib/api';

const STD_BAR_M = 5.8;

export default function OrderTreeScreen() {
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [colorList, setColorList] = useState<ColorCode[]>([]);
  const [openSystem, setOpenSystem] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const profileById = useMemo(() => {
    const map = new Map<string, { code: string; name: string; kgPerMeter: number; pricePerKg: number; imageUrl?: string }>();
    systems.forEach((s) => s.profiles.forEach((p) => map.set(p.id, p)));
    return map;
  }, [systems]);

  const cart = useMemo(() => {
    let totalKg = 0;
    let totalAmount = 0;
    let lines = 0;
    Object.entries(qty).forEach(([id, q]) => {
      if (!q) return;
      const p = profileById.get(id);
      if (!p) return;
      lines += 1;
      const kg = p.kgPerMeter * STD_BAR_M * q;
      totalKg += kg;
      totalAmount += kg * p.pricePerKg;
    });
    return { totalKg, totalAmount, lines };
  }, [qty, profileById]);

  function toggleColor(code: string) {
    setSelectedColors((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }

  function setQuantity(id: string, value: number) {
    setQty((cur) => ({ ...cur, [id]: Math.max(0, value) }));
  }

  async function submit() {
    setMessage('');
    if (selectedColors.length === 0) {
      setMessage('Chọn ít nhất một màu.');
      return;
    }
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = profileById.get(id)!;
        return { profileId: id, productCode: p.code, productName: p.name, colorCode: selectedColors.join(', '), quantity: q };
      });
    if (items.length === 0) {
      setMessage('Chọn ít nhất một thanh nhôm.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await api.post<{ code: string }>('/orders', {
        sourceType: 'FACTORY',
        createdByEmail: 'tho@eurohouse.vn',
        colorCode: selectedColors.join(', '),
        items,
      });
      setMessage(`Đã tạo đơn ${order.code} và gửi lên NPP.`);
      setQty({});
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Tạo đơn thất bại');
    } finally {
      setSubmitting(false);
    }
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
                <Text style={[styles.colorText, active && { color: colors.brandBlack }]} numberOfLines={1}>{c.name}</Text>
                <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                  {active ? <Icon name="check" size={11} color={colors.white} /> : null}
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
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.brandGrey} />
              </Pressable>

              {open ? (
                <View style={styles.leafWrap}>
                  {system.profiles.map((p) => (
                    <View key={p.id} style={styles.leaf}>
                      <ProfileThumb imageUrl={p.imageUrl} size={48} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leafCode}>{p.code}</Text>
                        <Text style={styles.leafName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.leafMeta}>{p.kgPerMeter} kg/m · cây {(p.barLengthMm / 1000).toFixed(1)}m · bó {p.barsPerBundle}</Text>
                      </View>
                      <View style={styles.stepper}>
                        <Pressable style={styles.stepBtn} onPress={() => setQuantity(p.id, (qty[p.id] ?? 0) - 1)}><Icon name="minus" size={14} color={colors.brandBlack} /></Pressable>
                        <Text style={styles.stepVal}>{qty[p.id] ?? 0}</Text>
                        <Pressable style={[styles.stepBtn, styles.stepBtnAdd]} onPress={() => setQuantity(p.id, (qty[p.id] ?? 0) + 1)}><Icon name="plus" size={14} color={colors.white} /></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={{ height: 150 }} />
      </ScrollView>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sumLabel}>{cart.lines} loại · {cart.totalKg.toFixed(1)} kg · {selectedColors.length} màu</Text>
          <Text style={styles.sumValue}>{Math.round(cart.totalAmount).toLocaleString('vi-VN')} đ</Text>
        </View>
        <Pressable style={[styles.submit, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
          <Icon name="send" size={15} color={colors.brandBlack} />
          <Text style={styles.submitText}>{submitting ? 'Đang gửi...' : 'Tạo đơn'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  label: { color: colors.brandBlack, fontWeight: '800' },
  labelHint: { color: colors.brandOrangeText, fontWeight: '700', fontSize: 12 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.white, width: '48%', shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  colorChipActive: { borderWidth: 1.5, borderColor: colors.brandOrange },
  colorDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  colorText: { flex: 1, color: colors.brandGrey, fontWeight: '700', fontSize: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#D5D8DC', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  treeNode: { borderRadius: 18, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.white, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  treeHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.white },
  treeIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  treeTitle: { color: colors.brandBlack, fontWeight: '900', fontSize: 15 },
  treeSub: { color: colors.brandGrey, fontSize: 12, marginTop: 2 },
  countBadge: { backgroundColor: colors.brandOrange, borderRadius: 999, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { color: colors.brandBlack, fontWeight: '900', fontSize: 12 },
  leafWrap: { backgroundColor: '#FBFBFC', paddingHorizontal: 14, paddingBottom: 8 },
  leaf: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  leafCode: { color: colors.brandBlack, fontWeight: '900', fontSize: 13 },
  leafName: { color: colors.brandBlack, fontSize: 12 },
  leafMeta: { color: colors.brandGrey, fontSize: 11, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { backgroundColor: colors.brandOrange },
  stepVal: { minWidth: 22, textAlign: 'center', color: colors.brandBlack, fontWeight: '900' },
  message: { color: colors.success, fontWeight: '700', marginTop: 12 },
  summary: { position: 'absolute', left: 16, right: 16, bottom: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.brandBlack, borderRadius: 22, padding: 16, paddingHorizontal: 18, shadowColor: colors.brandBlack, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  sumLabel: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 12 },
  sumValue: { color: colors.white, fontWeight: '900', fontSize: 19, marginTop: 2 },
  submit: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 13 },
  submitText: { color: colors.brandBlack, fontWeight: '900' },
});
