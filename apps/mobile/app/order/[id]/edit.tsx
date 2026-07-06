import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { CatalogSystem, ColorCode } from '@eurohouse/types';
import { AppHeader } from '../../../src/components/AppHeader';
import { Icon } from '../../../src/components/Icon';
import { ProfileThumb } from '../../../src/components/ProfileThumb';
import { api } from '../../../src/lib/api';

const STD_BAR_M = 6;

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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [note, setNote] = useState('');
  const [accessoriesNote, setAccessoriesNote] = useState('');

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    api.get<OrderDetail>(`/orders/${id}`).then((o) => {
      setOrder(o);
      setCustomerName(o.customerName);
      setCustomerPhone(o.customerPhone);
      setDeliveryAddress(o.deliveryAddress);
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

  const profileById = useMemo(() => {
    const map = new Map<string, { code: string; name: string; kgPerMeter: number; pricePerKg: number; imageUrl?: string }>();
    systems.forEach((s) => s.profiles.forEach((p) => map.set(p.id, p)));
    return map;
  }, [systems]);

  const cart = useMemo(() => {
    let totalKg = 0; let totalAmount = 0; let lines = 0;
    const items: { id: string; code: string; name: string; quantity: number; kg: number; amount: number }[] = [];
    Object.entries(qty).forEach(([id, q]) => {
      if (!q) return;
      const p = profileById.get(id);
      if (!p) return;
      const kg = p.kgPerMeter * STD_BAR_M * q;
      const amount = kg * p.pricePerKg;
      lines += 1; totalKg += kg; totalAmount += amount;
      items.push({ id, code: p.code, name: p.name, quantity: q, kg, amount });
    });
    return { totalKg, totalAmount, lines, items };
  }, [qty, profileById]);

  function toggleColor(code: string) {
    setSelectedColors((cur) => cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  }

  function setQuantity(id: string, value: number) {
    setQty((cur) => ({ ...cur, [id]: Math.max(0, value) }));
  }

  async function save() {
    if (!order) return;
    setMessage(''); setSubmitting(true);
    try {
      const items = cart.items.map((item) => {
        const p = profileById.get(item.id)!;
        return { profileId: item.id, productCode: p.code, productName: p.name, colorCode: selectedColors.join(', '), quantity: item.quantity };
      });
      await api.patch(`/orders/${order.id}`, {
        colorCode: selectedColors.join(', '),
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        deliveryAddress: deliveryAddress || '',
        note: note || '',
        accessoriesNote: accessoriesNote || '',
        items: items.length ? items : undefined,
      });
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
                <Text style={[styles.colorText, active && { color: colors.brandBlack }]} numberOfLines={1}>{c.name}</Text>
                <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                  {active ? <Icon name="check" size={11} color={colors.white} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 4 }]}>Danh sách thanh nhôm</Text>
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

        <Text style={[styles.label, { marginTop: 16 }]}>Thông tin khách hàng</Text>
        <TextInput style={styles.input} placeholder="Tên khách hàng" value={customerName} onChangeText={setCustomerName} />
        <TextInput style={styles.input} placeholder="Số điện thoại" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Địa chỉ giao hàng" value={deliveryAddress} onChangeText={setDeliveryAddress} />
        <TextInput style={[styles.input, { height: 80 }]} placeholder="Ghi chú" value={note} onChangeText={setNote} multiline />

        <Text style={[styles.label, { marginTop: 8 }]}>Phụ kiện đi kèm</Text>
        <TextInput
          style={[styles.input, { height: 120 }]}
          placeholder={"- Khoá Severnday hệ 55 = 5 bộ\n- Keo silicon A500 = 1 thùng"}
          value={accessoriesNote}
          onChangeText={setAccessoriesNote}
          multiline
        />

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <Pressable style={[styles.primaryBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={save}>
          <Icon name="save" size={15} color={colors.brandBlack} />
          <Text style={styles.primaryBtnText}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</Text>
        </Pressable>
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
  label: { color: colors.brandBlack, fontWeight: '800', marginBottom: 10 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.white, width: '48%', shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  colorChipActive: { borderWidth: 1.5, borderColor: colors.brandOrange },
  colorDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  colorText: { flex: 1, color: colors.brandGrey, fontWeight: '700', fontSize: 12 },
  checkBox: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#D5D8DC', alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  treeNode: { borderRadius: 18, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.white, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  stepBtnAdd: { backgroundColor: colors.brandOrange },
  stepVal: { minWidth: 22, textAlign: 'center', color: colors.brandBlack, fontWeight: '900' },
  input: { backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, color: colors.brandBlack, fontSize: 14 },
  errorText: { color: colors.danger, fontWeight: '700', marginTop: 12 },
  primaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 15, marginTop: 20 },
  primaryBtnText: { color: colors.brandBlack, fontWeight: '900' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  secondaryBtnText: { color: colors.brandGrey, fontWeight: '700' },
});
