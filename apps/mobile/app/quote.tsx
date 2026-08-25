import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Modal, FlatList, ActivityIndicator, Image, Platform, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import type { QuotationInput, QuotationRecord, QuotationResult, QuotationItemInput } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api, API_URL, authHeaders } from '../src/lib/api';

function num(v: string | number): number { return Number(String(v).replace(/[^\d.-]/g, '')) || 0; }

type MobileQuotationItemInput = QuotationItemInput & {
  phaoDinhName?: string;
  phaoDinhLength?: string;
  phaoDinhPrice?: string;
};

export default function QuoteScreen() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState<MobileQuotationItemInput[]>([
    { name: 'D1-Cửa chính', color: 'Màu Café Metalic', system: 'Hệ Thuỷ lực', doorType: 'Cửa TL 1 cánh 140', widthMm: 1200, heightMm: 2200, wallHugging: 'Non', quantity: 1, pricePerM2: 2800000, includesAccessories: true, accessoriesPrice: 0, phaoDinhName: '', phaoDinhLength: '', phaoDinhPrice: '' }
  ]);
  const [globalCosts, setGlobalCosts] = useState({
    accessoryCost: '0',
    laborCost: '0',
    installCost: '0',
    depreciation: '0',
    profitPct: '0',
    vatPct: '0',
  });
  
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [saved, setSaved] = useState<QuotationRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const [templates, setTemplates] = useState<{templateId: string; templateName: string; imagePath?: string}[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null);

  const [phaoDinh, setPhaoDinh] = useState({
    name: '',
    length: '',
    price: '',
  });
  const [accessoriesList, setAccessoriesList] = useState<Array<{ name: string; description: string; unit: string; quantity: string; unitPrice: string }>>([
    { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }
  ]);
  const [customExtras, setCustomExtras] = useState<Array<{ name: string; description: string; unit: string; quantity: string; unitPrice: string }>>([
    { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }
  ]);

  const [isFinalSettlement, setIsFinalSettlement] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  // Sơ đồ cắt & tối ưu thanh nhôm
  const [optModalOpen, setOptModalOpen] = useState(false);
  const [optResults, setOptResults] = useState<any[]>([]);
  const [optLoading, setOptLoading] = useState(false);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;

  useEffect(() => {
    if (id) {
      setBusy(true);
      api.get<QuotationRecord>(`/quotations/${id}`)
        .then(record => {
          setSaved(record);
          setIsFinalSettlement(record.isFinalSettlement !== undefined ? record.isFinalSettlement : true);
          setDepositAmount(record.depositAmount ? String(record.depositAmount) : '');
          setCustomerName(record.customerName || '');
          setCustomerPhone(record.customerPhone || '');
          setCustomerAddress(record.customerAddress || '');
          setGlobalCosts({
            accessoryCost: String(record.accessoryCost || '0'),
            laborCost: String(record.laborCost || '0'),
            installCost: String(record.installCost || '0'),
            depreciation: String(record.depreciation || '0'),
            profitPct: String(record.profitPct || '0'),
            vatPct: String(record.vatPct || '0'),
          });

          // Load extra products
          if (record.extraProducts && record.extraProducts.length > 0) {
            const phao = record.extraProducts.find(e => e.name.includes('Phào'));
            if (phao) {
              setPhaoDinh({
                name: phao.name,
                length: String(phao.quantity || ''),
                price: String(phao.unitPrice || ''),
              });
            }
            const others = record.extraProducts.filter(e => !e.name.includes('Phào'));
            if (others.length > 0) {
              setCustomExtras(others.map(o => ({
                name: o.name,
                description: o.description || '',
                unit: o.unit || 'bộ',
                quantity: String(o.quantity || ''),
                unitPrice: String(o.unitPrice || ''),
              })));
            }
          }

          if (record.items && record.items.length > 0) {
            setItems(record.items.map(i => ({
              name: i.name,
              color: i.color || 'Màu Café Metalic',
              system: i.system,
              doorType: i.doorType,
              widthMm: i.widthMm,
              heightMm: i.heightMm,
              wallHugging: i.wallHugging,
              quantity: i.quantity,
              pricePerM2: i.pricePerM2,
              includesAccessories: i.includesAccessories,
              accessoriesPrice: i.accessoriesPrice,
              glassType: i.glassType || '',
              glassColor: i.glassColor || '',
              dynamicInputs: i.dynamicInputs as any || {},
            })));
          }
        })
        .catch(() => Alert.alert('Lỗi', 'Không tải được báo giá cũ'))
        .finally(() => setBusy(false));
    }
  }, [id]);


  const [selectModal, setSelectModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    field: string;
    index: number | null;
  }>({ visible: false, title: '', options: [], field: '', index: null });

  useEffect(() => {
    api.get<{templateId: string; templateName: string; imagePath?: string}[]>('/formulas/templates?onlyPopular=true').then(setTemplates).catch(() => undefined);
  }, []);

  const openTemplateModal = (index: number) => {
    setSelectingIndex(index);
    setModalVisible(true);
  };

  const selectTemplate = async (t: {templateId: string; templateName: string}) => {
    if (selectingIndex !== null) {
      updateItem(selectingIndex, 'doorType', t.templateName);
      updateItem(selectingIndex, 'templateId', t.templateId);
      
      try {
        const data = await api.get<any>(`/formulas/templates/${t.templateId}`);
        if (data && data.requiredInputs) {
          setItems(prev => {
            const clone = [...prev];
            clone[selectingIndex].requiredInputs = data.requiredInputs;
            const init: Record<string, string> = {};
            data.requiredInputs.forEach((req: any) => {
              init[req.id] = String(req.defaultValue ?? (req.id === 'quantity' ? '1' : ''));
            });
            clone[selectingIndex].dynamicInputs = init;
            return clone;
          });
        }
      } catch (e) {}
    }
    setModalVisible(false);
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: `D${prev.length + 1}`, color: 'Màu Café Metalic', system: 'Hệ Ecento 70', doorType: 'Cửa 1 cánh 110', widthMm: 1200, heightMm: 1400, wallHugging: 'Non', quantity: 1, pricePerM2: 2200000, includesAccessories: true, accessoriesPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof MobileQuotationItemInput | string, value: string) => {
    setItems(prev => {
      const clone = [...prev];
      if (field === 'includesAccessories') {
        clone[index] = { ...clone[index], includesAccessories: value === 'true' };
      } else if (field === 'name' || field === 'doorType' || field === 'templateId' || field === 'system' || field === 'wallHugging' || field === 'color' || field === 'glassType' || field === 'glassColor' || field === 'dynamicInputs') {
        clone[index] = { ...clone[index], [field]: value };
      } else if (field.startsWith('dynamic_')) {
        const key = field.replace('dynamic_', '');
        clone[index] = {
          ...clone[index],
          dynamicInputs: { ...clone[index].dynamicInputs, [key]: value }
        };
        // Auto map back to widthMm and heightMm if they match
        if (key.toLowerCase().includes('w')) {
          clone[index].widthMm = num(value);
        } else if (key.toLowerCase().includes('h') && !key.toLowerCase().includes('h1') && !key.toLowerCase().includes('h2')) {
          clone[index].heightMm = num(value);
        }
      } else {
        clone[index] = { ...clone[index], [field]: num(value) };
      }
      return clone;
    });
  };

  const updateCost = (field: keyof typeof globalCosts, value: string) => {
    setGlobalCosts(prev => ({ ...prev, [field]: value }));
  };

  function buildPayload(): QuotationInput {
    const extraProducts: any[] = [];
    if (phaoDinh.name && phaoDinh.name !== 'Không') {
      const qty = num(phaoDinh.length);
      const price = num(phaoDinh.price);
      extraProducts.push({
        name: phaoDinh.name,
        description: phaoDinh.name,
        unit: 'md',
        quantity: qty,
        unitPrice: price,
        totalPrice: Math.round(qty * price),
      });
    }
    accessoriesList.forEach(acc => {
      if (acc.name && acc.name.trim() !== '') {
        const qty = num(acc.quantity);
        const price = num(acc.unitPrice);
        extraProducts.push({
          name: acc.name.trim(),
          description: acc.description ? acc.description.trim() : '',
          unit: acc.unit || 'bộ',
          quantity: qty,
          unitPrice: price,
          totalPrice: Math.round(qty * price),
        });
      }
    });
    customExtras.forEach(ext => {
      if (ext.name && ext.name.trim() !== '') {
        const qty = num(ext.quantity);
        const price = num(ext.unitPrice);
        extraProducts.push({
          name: ext.name.trim(),
          description: ext.description ? ext.description.trim() : '',
          unit: ext.unit || 'bộ',
          quantity: qty,
          unitPrice: price,
          totalPrice: Math.round(qty * price),
        });
      }
    });

    return {
      customerName,
      customerPhone,
      customerAddress,
      items: items.map(i => ({ 
        ...i, 
        widthMm: num(i.widthMm), 
        heightMm: num(i.heightMm), 
        quantity: num(i.quantity), 
        pricePerM2: num(i.pricePerM2),
        accessoriesPrice: num(i.accessoriesPrice || 0),
        color: i.color,
        glassType: i.glassType,
        glassColor: i.glassColor,
        dynamicInputs: i.dynamicInputs || {}
      })),
      extraProducts,
      accessoryCost: num(globalCosts.accessoryCost),
      laborCost: num(globalCosts.laborCost),
      installCost: num(globalCosts.installCost),
      depreciation: num(globalCosts.depreciation),
      profitPct: num(globalCosts.profitPct),
      vatPct: num(globalCosts.vatPct),
      isFinalSettlement,
      depositAmount: num(depositAmount),
    };
  }

  async function calc() {
    if (items.length === 0) return Alert.alert('Lỗi', 'Vui lòng thêm ít nhất 1 hạng mục cửa');
    setBusy(true);
    try {
      const res = await api.post<QuotationResult>('/quotations/calc', buildPayload());
      setResult(res);
      setSaved(null);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tính được báo giá.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      let record;
      if (isEditing && saved?.id) {
        record = await api.put<QuotationRecord>(`/quotations/${saved.id}`, buildPayload());
      } else {
        record = await api.post<QuotationRecord>('/quotations', buildPayload());
      }
      setSaved(record);
      Alert.alert('Đã lưu', `Báo giá ${record.code} đã được lưu.`);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không lưu được báo giá.');
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    if (!saved) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`${API_URL}/quotations/${saved.id}/pdf`, {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Không thể tải PDF');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bao-gia-${saved.code}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const target = `${FileSystem.cacheDirectory}bao-gia-${saved.code}.pdf`;
        const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${saved.id}/pdf`, target, {
          headers: authHeaders(),
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Báo giá ${saved.code}` });
        } else {
          Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
        }
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setBusy(false);
    }
  }

  async function convertToOrder() {
    if (!saved) {
      Alert.alert('Chưa lưu báo giá', 'Vui lòng bấm "Lưu dự toán" trước khi tạo đơn đặt hàng.');
      return;
    }
    setBusy(true);
    try {
      const order = await api.post<any>('/orders/convert-from-quotation', {
        quotationId: saved.id,
        note: `Tạo từ Báo giá ${saved.code}`,
        submitToNpp: true,
      });
      Alert.alert('Thành công', `Đã tạo Đơn đặt hàng ${order.code} gửi tới NPP!`, [
        { text: 'Xem đơn hàng', onPress: () => router.push('/orders' as Href) },
        { text: 'Ở lại', style: 'cancel' }
      ]);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể tạo đơn hàng.');
    } finally {
      setBusy(false);
    }
  }

  async function runCuttingOptimizer() {
    setOptModalOpen(true);
    setOptLoading(true);
    try {
      const requests: any[] = [];
      const cutsBySystem: Record<string, { lengths: number[]; pieces: any[] }> = {};

      items.forEach((it) => {
        const sysKey = it.system || 'EUROQUEEN 55';
        if (!cutsBySystem[sysKey]) cutsBySystem[sysKey] = { lengths: [], pieces: [] };
        const qty = it.quantity || 1;
        for (let q = 0; q < qty; q++) {
          // Khung đứng (2 thanh ~ H) + Khung ngang (2 thanh ~ W)
          cutsBySystem[sysKey].lengths.push(it.heightMm, it.heightMm, it.widthMm, it.widthMm);
          cutsBySystem[sysKey].pieces.push(
            { lengthMm: it.heightMm, doorName: it.name, profileName: 'Khung/Cánh đứng', cutAngle: '45-45' },
            { lengthMm: it.heightMm, doorName: it.name, profileName: 'Khung/Cánh đứng', cutAngle: '45-45' },
            { lengthMm: it.widthMm, doorName: it.name, profileName: 'Khung/Cánh ngang', cutAngle: '45-45' },
            { lengthMm: it.widthMm, doorName: it.name, profileName: 'Khung/Cánh ngang', cutAngle: '45-45' }
          );
        }
      });

      Object.entries(cutsBySystem).forEach(([matCode, data]) => {
        requests.push({ materialCode: matCode, lengths: data.lengths, pieces: data.pieces });
      });

      const res = await api.post<any[]>('/quotations/optimize-cut', requests);
      setOptResults(Array.isArray(res) ? res : []);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể tính toán tối ưu cắt nhôm.');
      setOptResults([]);
    } finally {
      setOptLoading(false);
    }
  }

  const KINH_LOAI = ['Kính dán 6.38', 'Kính dán 8.38', 'Kính cường lực 8mm', 'Kính cường lực 10mm', 'Kính cường lực 12mm', 'Kinh dán cường lực 12mm', 'Kính hộp nan đồng', 'Tấm nhôm liền 10mm', 'Tấm nhôm liền 18mm'];
  const KINH_MAU = ['Trong suốt', 'Trắng đục', 'Xanh đục', 'Xanh đen', 'Phản quang', 'Xanh green', 'Xám khói'];
  const COLORS = ['Màu Café Metalic', 'Màu Café thường', 'Màu Xám Ngọc Trai', 'Màu Vân gỗ Cẩm Lai', 'Màu vân gỗ Olak', 'Màu Xám Rita (dự án)'];

  function getSystemOptions(name: string, color?: string) {
    const upper = (name || '').trim().toUpperCase();
    if (upper.startsWith('CS')) {
      return ['Hệ cửa sổ 55', 'Hệ cửa sổ Ecento 70', 'Hệ cửa sổ Ecento Plus'];
    }
    if (upper.startsWith('VK')) {
      return ['Vách hệ 55', 'Vách hệ Ecento 70', 'Vách hệ Ecento Plus', 'Vách mặt dựng'];
    }
    let sys = ['Hệ Thuỷ lực', 'Hệ Ecento 70', 'Hệ Ecento Plus', 'Hệ Trượt quay', 'Hệ trượt Châu âu', 'Hệ 55 Euroqueen', 'Hệ 55 Preco'];
    if (name !== 'D1-Cửa chính' && name !== 'D2') {
      sys = sys.filter(s => s !== 'Hệ Thuỷ lực');
    }
    if (color === 'Màu Xám Rita (dự án)' || color === 'Màu Café thường') {
      sys = sys.filter(s => !['Hệ Thuỷ lực', 'Hệ Trượt quay', 'Hệ Ecento 70', 'Hệ Ecento Plus', 'Hệ trượt Châu âu'].includes(s));
    }
    return sys;
  }

  function getDoorTypeOptions(name: string, system: string) {
    const upperName = (name || '').trim().toUpperCase();
    const upperSys = (system || '').trim().toUpperCase();

    if (upperName.startsWith('CS') || upperSys.includes('CỬA SỔ') || upperSys.includes('CUẢ SỔ')) {
      return [
        'Cửa lùa 2 cánh',
        'Cửa lùa 4 cánh',
        'Cửa mở hất 1 cánh',
        'Cửa mở hất 2 cánh + Vách',
        'Cửa mở hất 3 cánh',
        'Cửa 2 cánh quay-2 cánh hất',
        'Cửa 1 cánh quay',
        'Cửa 2 cánh quay + Vách',
        'Cửa 2 cánh quay – 1 cánh hất'
      ];
    }

    if (upperName.startsWith('VK') || upperSys.includes('VÁCH')) {
      if (upperSys.includes('MẶT DỰNG')) {
        return [
          'Mặt dựng hệ 65',
          'Mặt dựng hệ 65 (Gồm cửa)',
          'Mặt dựng hệ 120',
          'Mặt dựng hệ 120 (Gồm cửa)'
        ];
      }
      return ['Vách kính độc lập', 'Vách kính kèm cửa sổ'];
    }

    switch(system) {
      case 'Hệ Thuỷ lực': return ['Cửa TL 1 cánh 140', 'Cửa TL 1 cánh 180', 'Cửa TL 2 cánh 140', 'Cửa TL 2 cánh 180'];
      case 'Hệ Ecento 70': return ['Cửa 1 cánh 110', 'Cửa 2 cánh 110', 'Cửa 4 cánh 110', 'Cửa 1 cánh 150', 'Cửa 2 cánh 150', 'Cửa 4 cánh 150', 'Cửa 1 cánh 190', 'Cửa 2 cánh 190', 'Cửa 4 cánh 190'];
      case 'Hệ Ecento Plus': return ['Cửa 1 cánh 98', 'Cửa 2 cánh 98', 'Cửa 4 cánh 98', 'Cửa 1 cánh 138', 'Cửa 2 cánh 138', 'Cửa 4 cánh 138', 'Cửa 1 cánh liền phào 138', 'Cửa 2 cánh liền phào 138', 'Cửa 4 cánh liền phào 138'];
      case 'Hệ Trượt quay': return ['Trượt quay 2 cánh', 'Trượt quay 4 cánh'];
      case 'Hệ trượt Châu âu': return ['Cửa trượt ray đơn 1 cánh', 'Cửa trượt ray đôi 2 cánh', 'Cửa trượt ray đôi 4 cánh', 'Cửa trượt 3 ray – 3 cánh', 'Cửa trượt 3 ray – 6 cánh'];
      case 'Hệ 55 Euroqueen': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91', 'Cửa 1 cánh VIP 118', 'Cửa 2 cánh VIP 118', 'Cửa 4 cánh VIP 118', 'Cửa 1 cánh liền phào 125', 'Cửa 2 cánh liền phào 125', 'Cửa 4 cánh liền phào 125'];
      case 'Hệ 55 Preco': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91'];
      default: return ['Cửa 1 cánh', 'Cửa 2 cánh', 'Cửa 4 cánh'];
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Tạo Báo Giá" subtitle="Tính chi tiết đa hạng mục cửa" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.savedLink} onPress={() => router.push('/quotations' as Href)}>
          <Icon name="file-text" size={16} color={colors.brandOrangeText} />
          <Text style={styles.savedLinkText}>Xem báo giá đã lưu</Text>
          <Icon name="chevron-right" size={18} color={colors.brandGrey[500]} />
        </Pressable>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Thông tin khách hàng</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Họ tên</Text>
              <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} placeholder="Nguyễn Văn A" placeholderTextColor="#94a3b8" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Số điện thoại</Text>
              <TextInput value={customerPhone} onChangeText={setCustomerPhone} style={styles.input} placeholder="09..." keyboardType="phone-pad" placeholderTextColor="#94a3b8" />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Địa chỉ</Text>
            <TextInput value={customerAddress} onChangeText={setCustomerAddress} style={styles.input} placeholder="Số nhà, đường..." placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <View style={[styles.panel, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Danh sách hạng mục</Text>
          {items.map((item, index) => (
            <View key={index} style={styles.itemBox}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Hạng mục {index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
                    <Icon name="trash-2" size={16} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Xoá</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ký hiệu</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn ký hiệu', options: ['D1-Cửa chính', 'D2', 'D3', 'CS1', 'CS2', 'CS3', 'VK1', 'VK2', 'VK3', 'OFix 1', 'OFix 2', 'Other'], field: 'name', index })}>
                    <Text style={{ flex: 1, color: item.name ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.name || 'Ký hiệu...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Màu sắc</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn màu sắc', options: COLORS, field: 'color', index })}>
                    <Text style={{ flex: 1, color: item.color ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.color || 'Màu...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Hệ nhôm</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn hệ nhôm', options: getSystemOptions(item.name, item.color), field: 'system', index })}>
                    <Text style={{ flex: 1, color: item.system ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.system || 'Hệ nhôm...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Loại cửa (Mẫu)</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn kiểu', options: getDoorTypeOptions(item.name || '', item.system || ''), field: 'doorType', index })}>
                    <Text style={{ flex: 1, color: item.doorType ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.doorType || 'Loại cửa...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
              </View>

              {/* Extra toggles based on system/doorType */}

              {/* Glass & Wall Hugging */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ôm tường</Text>
                  <Pressable style={styles.inputSmall} onPress={() => setSelectModal({ visible: true, title: 'Chọn ôm tường', options: ['Tường 200', 'Tường 150', 'Tường 250', 'Non'], field: 'wallHugging', index })}>
                    <Text numberOfLines={1}>{item.wallHugging || 'Non'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Special Protected Grille (Chấn Song) for Cửa Sổ (CS) */}
              {(item.name || '').trim().toUpperCase().startsWith('CS') && (
                <View style={{ backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginTop: 4, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.brandBlack.main, marginBottom: 6 }}>Hệ chấn song bảo vệ (Cửa sổ)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Hệ chấn song</Text>
                      <Pressable 
                        style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center' }]} 
                        onPress={() => setSelectModal({ 
                          visible: true, 
                          title: 'Chọn hệ chấn song', 
                          options: ['Không', 'Hệ chấn song khung độc lập', 'Hệ chấn song tích hợp'], 
                          field: 'chanSongSystem', 
                          index 
                        })}>
                        <Text style={{ flex: 1, fontSize: 12 }} numberOfLines={1}>{(item.dynamicInputs as any)?.chanSongSystem || 'Không'}</Text>
                        <Icon name="chevron-down" size={14} color={colors.brandGrey[500]} />
                      </Pressable>
                    </View>
                    {((item.dynamicInputs as any)?.chanSongSystem && (item.dynamicInputs as any)?.chanSongSystem !== 'Không') && (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Loại song</Text>
                        <Pressable 
                          style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center' }]} 
                          onPress={() => setSelectModal({ 
                            visible: true, 
                            title: 'Chọn loại song', 
                            options: ['Song tròn D28', 'Song lục giác 31x35mm', 'Song chữ nhật 25x40mm'], 
                            field: 'chanSongType', 
                            index 
                          })}>
                          <Text style={{ flex: 1, fontSize: 12 }} numberOfLines={1}>{(item.dynamicInputs as any)?.chanSongType || 'Song tròn D28'}</Text>
                          <Icon name="chevron-down" size={14} color={colors.brandGrey[500]} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Loại Kính</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn loại kính', options: KINH_LOAI, field: 'glassType', index })}>
                    <Text style={{ flex: 1, color: item.glassType ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.glassType || 'Loại kính...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Màu Kính</Text>
                  <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn màu kính', options: KINH_MAU, field: 'glassColor', index })}>
                    <Text style={{ flex: 1, color: item.glassColor ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{item.glassColor || 'Màu kính...'}</Text>
                    <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Rộng(mm)</Text>
                  <TextInput value={String(item.widthMm || '')} onChangeText={(v) => updateItem(index, 'widthMm', v)} style={styles.inputSmall} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Cao(mm)</Text>
                  <TextInput value={String(item.heightMm || '')} onChangeText={(v) => updateItem(index, 'heightMm', v)} style={styles.inputSmall} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Số lượng</Text>
                  <TextInput value={String(item.quantity || '')} onChangeText={(v) => updateItem(index, 'quantity', v)} style={styles.inputSmall} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Đơn giá / m² (đ)</Text>
                  <TextInput value={String(item.pricePerM2)} onChangeText={(v) => updateItem(index, 'pricePerM2', v)} style={styles.inputSmall} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Phụ kiện</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => updateItem(index, 'includesAccessories', 'true')}>
                    <Icon name={item.includesAccessories !== false ? 'check-circle' : 'circle'} size={16} color={item.includesAccessories !== false ? colors.brandOrange : colors.brandGrey[500]} />
                    <Text style={{ fontSize: 13, color: colors.brandBlack.main }}>Đã gồm (vào đơn giá/m²)</Text>
                  </Pressable>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => updateItem(index, 'includesAccessories', 'false')}>
                    <Icon name={item.includesAccessories === false ? 'check-circle' : 'circle'} size={16} color={item.includesAccessories === false ? colors.brandOrange : colors.brandGrey[500]} />
                    <Text style={{ fontSize: 13, color: colors.brandBlack.main }}>Chưa gồm</Text>
                  </Pressable>
                </View>
              </View>
              {item.includesAccessories === false && (
                <View style={[styles.field, { marginTop: 8 }]}>
                  <Text style={styles.fieldLabel}>Giá bộ phụ kiện (đ) (Sẽ tính thêm vào tổng)</Text>
                  <TextInput value={String(item.accessoriesPrice || '')} onChangeText={(v) => updateItem(index, 'accessoriesPrice', v)} style={styles.inputSmall} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                </View>
              )}
            </View>
          ))}
          <Pressable style={styles.addBtn} onPress={addItem}>
            <Icon name="plus" size={16} color={colors.brandOrange} />
            <Text style={styles.addBtnText}>Thêm hạng mục cửa</Text>
          </Pressable>
        </View>

        {/* Dedicated Extra Products Panel */}
        <View style={[styles.panel, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Sản phẩm gia tăng (Phụ kiện & Phào đỉnh)</Text>
          
          {/* Sub A: Phào đỉnh */}
          <Text style={[styles.fieldLabel, { fontWeight: '700', color: colors.brandBlack.main, marginTop: 4 }]}>+ Thêm Phào đỉnh</Text>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Loại phào đỉnh</Text>
              <Pressable style={[styles.inputSmall, { flexDirection: 'row', alignItems: 'center', gap: 8 }]} onPress={() => setSelectModal({ visible: true, title: 'Chọn phào đỉnh', options: ['Không', 'Phào đơn 75mm', 'Phào kép 220mm', 'Phào kép 280mm'], field: 'phaoDinhDirect', index: null })}>
                <Text style={{ flex: 1, color: phaoDinh.name ? colors.brandBlack.main : colors.brandGrey[500] }} numberOfLines={1}>{phaoDinh.name || 'Không'}</Text>
                <Icon name="chevron-down" size={16} color={colors.brandGrey[500]} />
              </Pressable>
            </View>
          </View>

          {phaoDinh.name && phaoDinh.name !== 'Không' && (
            <View style={[styles.rowInputs, { backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, marginTop: 4 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Mét dài (md)</Text>
                <TextInput value={phaoDinh.length} onChangeText={(v) => setPhaoDinh(p => ({ ...p, length: v }))} style={styles.inputSmall} keyboardType="numeric" placeholder="10" placeholderTextColor="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Đơn giá (đ/m)</Text>
                <TextInput value={phaoDinh.price} onChangeText={(v) => setPhaoDinh(p => ({ ...p, price: v }))} style={styles.inputSmall} keyboardType="numeric" placeholder="900000" placeholderTextColor="#94a3b8" />
              </View>
            </View>
          )}

          {/* Sub B: Accessories (Tay nắm, Khóa điện tử...) */}
          <Text style={[styles.fieldLabel, { fontWeight: '700', color: colors.brandBlack.main, marginTop: 14 }]}>+ Thêm Phụ kiện (Tay nắm, Khóa điện tử, Khóa từ...)</Text>
          {accessoriesList.map((acc, idx) => (
            <View key={idx} style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 6, gap: 6 }}>
              <View style={styles.rowInputs}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Tên phụ kiện</Text>
                  <TextInput value={acc.name} onChangeText={(v) => {
                    const clone = [...accessoriesList];
                    clone[idx].name = v;
                    setAccessoriesList(clone);
                  }} style={styles.inputSmall} placeholder="VD: Tay nắm Juai, Khóa từ Kaadas..." placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Đơn vị tính</Text>
                  <TextInput value={acc.unit} onChangeText={(v) => {
                    const clone = [...accessoriesList];
                    clone[idx].unit = v;
                    setAccessoriesList(clone);
                  }} style={styles.inputSmall} placeholder="bộ" placeholderTextColor="#94a3b8" />
                </View>
              </View>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Số lượng</Text>
                  <TextInput value={acc.quantity} onChangeText={(v) => {
                    const clone = [...accessoriesList];
                    clone[idx].quantity = v;
                    setAccessoriesList(clone);
                  }} style={styles.inputSmall} keyboardType="numeric" placeholder="1" placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Đơn giá (đ)</Text>
                  <TextInput value={acc.unitPrice} onChangeText={(v) => {
                    const clone = [...accessoriesList];
                    clone[idx].unitPrice = v;
                    setAccessoriesList(clone);
                  }} style={styles.inputSmall} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
                </View>
                {accessoriesList.length > 1 && (
                  <Pressable onPress={() => setAccessoriesList(prev => prev.filter((_, i) => i !== idx))} style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Icon name="trash-2" size={18} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          <Pressable style={[styles.addBtn, { marginTop: 8 }]} onPress={() => setAccessoriesList(prev => [...prev, { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }])}>
            <Icon name="plus" size={14} color={colors.brandOrange} />
            <Text style={[styles.addBtnText, { fontSize: 13 }]}>Thêm Phụ kiện</Text>
          </Pressable>

          {/* Sub C: Custom Extra Products */}
          <Text style={[styles.fieldLabel, { fontWeight: '700', color: colors.brandBlack.main, marginTop: 14 }]}>+ Sản phẩm gia tăng khác (Mái tôn, lan can, cửa cổng...)</Text>
          {customExtras.map((ext, idx) => (
            <View key={idx} style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 6, gap: 6 }}>
              <View style={styles.rowInputs}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Tên sản phẩm gia tăng</Text>
                  <TextInput value={ext.name} onChangeText={(v) => {
                    const clone = [...customExtras];
                    clone[idx].name = v;
                    setCustomExtras(clone);
                  }} style={styles.inputSmall} placeholder="VD: Mái tôn, Lan can, Cửa cổng..." placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Đơn vị tính</Text>
                  <TextInput value={ext.unit} onChangeText={(v) => {
                    const clone = [...customExtras];
                    clone[idx].unit = v;
                    setCustomExtras(clone);
                  }} style={styles.inputSmall} placeholder="bộ" placeholderTextColor="#94a3b8" />
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mô tả chi tiết</Text>
                <TextInput value={ext.description} onChangeText={(v) => {
                  const clone = [...customExtras];
                  clone[idx].description = v;
                  setCustomExtras(clone);
                }} style={styles.inputSmall} placeholder="VD: Mái tôn 0.45mm chống nóng, Khóa từ cao cấp..." placeholderTextColor="#94a3b8" />
              </View>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Số lượng / Mét</Text>
                  <TextInput value={ext.quantity} onChangeText={(v) => {
                    const clone = [...customExtras];
                    clone[idx].quantity = v;
                    setCustomExtras(clone);
                  }} style={styles.inputSmall} keyboardType="numeric" placeholder="1" placeholderTextColor="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Đơn giá (đ)</Text>
                  <TextInput value={ext.unitPrice} onChangeText={(v) => {
                    const clone = [...customExtras];
                    clone[idx].unitPrice = v;
                    setCustomExtras(clone);
                  }} style={styles.inputSmall} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
                </View>
                {customExtras.length > 1 && (
                  <Pressable onPress={() => setCustomExtras(prev => prev.filter((_, i) => i !== idx))} style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Icon name="trash-2" size={18} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
          <Pressable style={[styles.addBtn, { marginTop: 8 }]} onPress={() => setCustomExtras(prev => [...prev, { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }])}>
            <Icon name="plus" size={14} color={colors.brandOrange} />
            <Text style={[styles.addBtnText, { fontSize: 13 }]}>Thêm sản phẩm gia tăng khác</Text>
          </Pressable>
        </View>

        <View style={[styles.panel, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Tùy chọn Báo Giá / Quyết Toán</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Thuế VAT (%)</Text>
            <TextInput value={globalCosts.vatPct} onChangeText={(v) => updateCost('vatPct', v)} style={styles.inputSmall} keyboardType="numeric" placeholder="0" placeholderTextColor="#94a3b8" />
          </View>
          {isEditing && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontWeight: '800', color: colors.brandBlack.main, fontSize: 14 }}>Chuyển sang Chức năng Quyết Toán</Text>
                  <Text style={{ fontSize: 12, color: colors.brandGrey[500] }}>Tự động bật khi chỉnh sửa báo giá để xuất BẢNG QUYẾT TOÁN</Text>
                </View>
                <Switch
                  value={isFinalSettlement}
                  onValueChange={setIsFinalSettlement}
                  trackColor={{ true: colors.brandOrange, false: '#EEF0F3' }}
                />
              </View>

              {isFinalSettlement && (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3' }}>
                  <Text style={styles.fieldLabel}>Giá trị tạm ứng (VNĐ)</Text>
                  <TextInput
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    style={styles.inputSmall}
                    keyboardType="numeric"
                    placeholder="Nhập số tiền đã tạm ứng / đặt cọc"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}
            </View>
          )}
        </View>

        <Pressable style={styles.calcBtn} onPress={calc} disabled={busy}>
          <Icon name="zap" size={18} color={colors.brandOrange} />
          <Text style={styles.calcText}>TÍNH TOÁN BÁO GIÁ</Text>
        </Pressable>

        {result ? (
          <View style={styles.result}>
            
            <Text style={styles.resultTitle}>Xem Trước Dự Toán</Text>
            <ScrollView horizontal style={{ marginTop: 12, marginBottom: 12 }}>
              <View style={{ minWidth: 800 }}>
                {/* Table Header */}
                <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e1' }}>
                  <Text style={{ width: 40, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>STT</Text>
                  <Text style={{ width: 80, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Ký hiệu</Text>
                  <Text style={{ width: 200, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Loại cửa - Quy cách</Text>
                  <Text style={{ width: 60, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Rộng</Text>
                  <Text style={{ width: 60, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Cao</Text>
                  <Text style={{ width: 80, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Diện tích</Text>
                  <Text style={{ width: 50, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>SL</Text>
                  <Text style={{ width: 100, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Đơn giá</Text>
                  <Text style={{ width: 120, padding: 8, fontWeight: '700', fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>Thành tiền</Text>
                </View>
                {/* Table Body */}
                {result.items.map((it, idx) => {
                  let quyCach = it.doorType;
                  if (it.system) quyCach += `\n- Hệ: ${it.system.replace(/^Hệ\s+/i, '')}`;
                  if (it.color) quyCach += `\n- Màu: ${it.color.replace(/^Màu\s+/i, '')}`;
                  if (it.glassType) quyCach += `\n- Kính: ${it.glassType.replace(/^Kính\s+/i, '')}`;
                  if (it.wallHugging && it.wallHugging !== 'Non') quyCach += `\n- Ôm tường: ${it.wallHugging}`;
                  const dyn = (it.dynamicInputs as any) || {};
                  if (dyn.chanSongSystem && dyn.chanSongSystem !== 'Không') {
                    let csStr = dyn.chanSongSystem.replace(/^Hệ\s+/i, '');
                    if (dyn.chanSongType) csStr += ` (${dyn.chanSongType})`;
                    quyCach += `\n- Chấn song: ${csStr}`;
                  }
                  
                  return (
                    <View key={idx} style={{ flexDirection: 'row', borderLeftWidth: 1, borderColor: '#cbd5e1' }}>
                      <Text style={{ width: 40, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{idx + 1}</Text>
                      <Text style={{ width: 80, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{it.name}</Text>
                      <Text style={{ width: 200, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1' }}>{quyCach}</Text>
                      <Text style={{ width: 60, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{it.widthMm}</Text>
                      <Text style={{ width: 60, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{it.heightMm}</Text>
                      <Text style={{ width: 80, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{it.areaM2}</Text>
                      <Text style={{ width: 50, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{it.quantity}</Text>
                      <Text style={{ width: 100, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'right' }}>{it.pricePerM2.toLocaleString('vi-VN')}</Text>
                      <Text style={{ width: 120, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'right' }}>{it.totalPrice.toLocaleString('vi-VN')}</Text>
                    </View>
                  );
                })}

                    {/* Extra Products Rows */}
                    {result.extraProducts && result.extraProducts.length > 0 && (
                      <View>
                        <View style={{ backgroundColor: '#e2e8f0', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', padding: 6 }}>
                          <Text style={{ textAlign: 'center', fontWeight: '700', fontSize: 12, color: colors.brandBlack.main }}>SẢN PHẨM GIA TĂNG & PHỤ KIỆN</Text>
                        </View>
                        {result.extraProducts.map((ep, eIdx) => (
                          <View key={eIdx} style={{ flexDirection: 'row', borderLeftWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff7ed' }}>
                            <Text style={{ width: 40, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{eIdx + 1}</Text>
                            <Text style={{ width: 80, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', fontWeight: '600' }}>{ep.name}</Text>
                            <Text style={{ width: 200, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', color: colors.brandOrangeText }}>{ep.description || ep.name}</Text>
                            <Text style={{ width: 60, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}></Text>
                            <Text style={{ width: 60, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}></Text>
                            <Text style={{ width: 80, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}>{ep.quantity} {ep.unit || 'md'}</Text>
                            <Text style={{ width: 50, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'center' }}></Text>
                            <Text style={{ width: 100, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'right' }}>{(ep.unitPrice || 0).toLocaleString('vi-VN')}</Text>
                            <Text style={{ width: 120, padding: 8, fontSize: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1', textAlign: 'right', color: colors.brandOrangeText, fontWeight: '700' }}>{(ep.totalPrice || (ep.quantity * ep.unitPrice)).toLocaleString('vi-VN')}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </ScrollView>
                
                <View style={{ backgroundColor: '#fff7ed', padding: 12, borderRadius: 8, marginTop: 8 }}>
                  <Row label={`Tổng diện tích`} value={`${result.areaM2} m²`} />
                  <Row label={`Giá trị cửa`} value={result.baseAmount - (result.extraProductsAmount || 0)} />
                  {result.extraProductsAmount ? (
                    <Row label="Sản phẩm gia tăng & Phụ kiện" value={result.extraProductsAmount} />
                  ) : null}
                  {result.vatAmount ? (
                    <Row label={`Thuế VAT (${globalCosts.vatPct}%)`} value={result.vatAmount} />
                  ) : null}
                  <View style={styles.divider} />
                  <Row label="TỔNG THANH TOÁN" value={result.totalAmount} bold />
                </View>
                
                <View style={styles.actionRow}>
                  <Pressable style={styles.darkButton} onPress={save} disabled={busy}>
                    <Icon name="save" size={16} color={colors.white} />
                    <Text style={styles.darkButtonText}>{isEditing ? 'Cập nhật' : 'Lưu dự toán'}</Text>
                  </Pressable>
                  <Pressable style={[styles.orangeButton, !saved && { opacity: 0.5 }]} onPress={exportPdf} disabled={busy || !saved}>
                    <Icon name="file-text" size={16} color={colors.brandBlack.main} />
                    <Text style={styles.orangeButtonText}>Xuất PDF</Text>
                  </Pressable>
                </View>

                {/* NÚT TỐI ƯU CẮT & SƠ ĐỒ THANH NHÔM */}
                <Pressable
                  style={[styles.purpleButton, { marginTop: 10 }]}
                  onPress={runCuttingOptimizer}
                  disabled={busy}
                >
                  <Icon name="zap" size={16} color="#ffffff" />
                  <Text style={styles.purpleButtonText}>TỐI ƯU CẮT & SƠ ĐỒ THANH (TIẾT KIỆM PHẾ)</Text>
                </Pressable>

                {saved ? (
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {/* NÚT TẠO ĐƠN ĐẶT HÀNG GỬI NPP */}
                    <Pressable
                      style={{ backgroundColor: colors.brandOrange, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onPress={convertToOrder}
                      disabled={busy}
                    >
                      <Icon name="truck" size={18} color={colors.brandBlack.main} />
                      <Text style={{ color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 }}>ĐẶT NHÔM GỬI NPP THEO BÁO GIÁ NÀY</Text>
                    </Pressable>

                    <Pressable
                      style={{ backgroundColor: '#0284c7', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      onPress={async () => {
                        setBusy(true);
                        try {
                          const project = await api.post<any>(`/quotations/${saved.id}/convert-to-project`);
                          Alert.alert('Thành công', `Đã chuyển Báo giá ${saved.code} thành Công trình ${project.code}!`);
                          router.push('/projects');
                        } catch (e) {
                          Alert.alert('Lỗi', 'Không thể chuyển thành công trình.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                    >
                      <Icon name="layers" size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>TẠO CÔNG TRÌNH TỪ BÁO GIÁ NÀY</Text>
                    </Pressable>
                    <Text style={styles.savedNote}>Đã lưu {saved.code}. Bấm "Đặt nhôm gửi NPP" hoặc "Xuất PDF".</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* MODAL SƠ ĐỒ CẮT TRỰC QUAN (VISUAL CUTTING BLUEPRINT) */}
      <Modal visible={optModalOpen} animationType="slide" transparent onRequestClose={() => setOptModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Sơ Đồ Cắt & Tối Ưu Phế Liệu</Text>
                <Text style={{ fontSize: 12, color: colors.brandGrey[500] }}>Thuật toán Best-Fit xếp nhôm + Tận dụng Đề-xê</Text>
              </View>
              <Pressable onPress={() => setOptModalOpen(false)} style={{ padding: 4 }}>
                <Icon name="x" size={24} color={colors.brandBlack.main} />
              </Pressable>
            </View>

            {optLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.brandOrange} />
                <Text style={{ marginTop: 12, color: colors.brandBlack.main, fontWeight: '700' }}>Đang tính toán sơ đồ cắt tối ưu...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {optResults.length === 0 ? (
                  <Text style={{ textAlign: 'center', padding: 20, color: colors.brandGrey[500] }}>Không có dữ liệu thanh nhôm để tối ưu.</Text>
                ) : (
                  optResults.map((opt, oIdx) => (
                    <View key={oIdx} style={styles.optCard}>
                      <View style={styles.optCardHeader}>
                        <Text style={styles.optCardTitle}>Hệ nhôm: {opt.materialCode}</Text>
                        <Text style={styles.optCardDesc}>
                          Cần <Text style={{ fontWeight: '900', color: colors.brandOrange }}>{opt.newBarsNeeded} cây 6m</Text> • Sinh {opt.newDeXeGenerated?.length || 0} đoạn Đề-xê • Phế nhôm: <Text style={{ fontWeight: '900', color: colors.danger }}>{opt.scrapGeneratedKg} kg</Text>
                        </Text>
                      </View>

                      {opt.barLayouts && opt.barLayouts.length > 0 ? (
                        opt.barLayouts.map((bar: any, bIdx: number) => (
                          <View key={bIdx} style={styles.barItemBox}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.brandBlack.main }}>
                                {bar.isDeXe ? `🔄 CÂY ĐỀ-XÊ (${bar.barLengthMm}mm)` : `🌲 CÂY NGUYÊN #${bar.barIndex} (${bar.barLengthMm}mm)`}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.brandGrey[500] }}>
                                Dùng: {bar.usedLengthMm}mm | Thừa: {bar.remainingLengthMm}mm
                              </Text>
                            </View>

                            {/* Thanh trực quan */}
                            <View style={styles.barVisualTrack}>
                              {bar.cuts?.map((cut: any, cIdx: number) => {
                                const pct = Math.max(8, (cut.lengthMm / bar.barLengthMm) * 100);
                                return (
                                  <View key={cIdx} style={[styles.cutSegment, { width: `${pct}%`, backgroundColor: cIdx % 2 === 0 ? '#FDA720' : '#ea580c' }]}>
                                    <Text style={styles.cutSegmentText} numberOfLines={1}>{cut.lengthMm}</Text>
                                  </View>
                                );
                              })}
                              {bar.remainingLengthMm > 0 && (
                                <View style={[styles.remainingSegment, { width: `${Math.max(5, (bar.remainingLengthMm / bar.barLengthMm) * 100)}%`, backgroundColor: bar.isNewDeXe ? '#10b981' : '#94a3b8' }]}>
                                  <Text style={styles.remainingSegmentText} numberOfLines={1}>{bar.remainingLengthMm} {bar.isNewDeXe ? 'ĐX' : 'Phế'}</Text>
                                </View>
                              )}
                            </View>

                            {/* Chi tiết đoạn cắt */}
                            <View style={{ marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              {bar.cuts?.map((c: any, ci: number) => (
                                <View key={ci} style={{ backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 11, color: colors.brandBlack.main }}>
                                    {c.doorName ? `${c.doorName}: ` : ''}<Text style={{ fontWeight: '700' }}>{c.lengthMm}mm</Text> ({c.cutAngle || '45°'})
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={{ fontSize: 12, color: colors.brandGrey[500], padding: 8 }}>Chưa có sơ đồ chi tiết</Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Kiểu Cửa</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Icon name="x" size={24} color={colors.brandBlack.main} />
              </Pressable>
            </View>
            <FlatList
              data={templates}
              keyExtractor={(item) => item.templateId}
              contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <Pressable style={styles.templateItem} onPress={() => selectTemplate(item)}>
                  {item.imagePath ? (
                    <Image source={{ uri: item.imagePath.startsWith('http') ? item.imagePath : `${API_URL.replace('/api', '')}${item.imagePath}` }} style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 12 }} resizeMode="contain" />
                  ) : (
                    <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff7ed', borderRadius: 6, marginRight: 12 }}>
                      <Icon name="file" size={20} color={colors.brandOrange} />
                    </View>
                  )}
                  <Text style={styles.templateName}>{item.templateName}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
      <Modal visible={selectModal.visible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectModal.title}</Text>
              <Pressable onPress={() => setSelectModal({ ...selectModal, visible: false })}>
                <Icon name="x" size={24} color={colors.brandBlack.main} />
              </Pressable>
            </View>
            <FlatList
              data={selectModal.options}
              keyExtractor={(item) => item}
              contentContainerStyle={{ padding: 18 }}
              renderItem={({ item }) => (
                <Pressable style={styles.templateItem} onPress={() => {
                  if (selectModal.field === 'phaoDinhDirect') {
                    setPhaoDinh(p => ({ ...p, name: item }));
                  } else if (selectModal.field === 'chanSongSystem') {
                    if (selectModal.index !== null) {
                      const curDyn = (items[selectModal.index]?.dynamicInputs as any) || {};
                      updateItem(selectModal.index, 'dynamicInputs', {
                        ...curDyn,
                        chanSongSystem: item,
                        chanSongType: item === 'Không' ? '' : (curDyn.chanSongType || 'Song tròn D28')
                      });
                    }
                  } else if (selectModal.field === 'chanSongType') {
                    if (selectModal.index !== null) {
                      const curDyn = (items[selectModal.index]?.dynamicInputs as any) || {};
                      updateItem(selectModal.index, 'dynamicInputs', {
                        ...curDyn,
                        chanSongType: item
                      });
                    }
                  } else if (selectModal.index !== null) {
                    updateItem(selectModal.index, selectModal.field, item);
                  }
                  setSelectModal({ ...selectModal, visible: false });
                }}>
                  <Text style={styles.templateName}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  const displayValue = typeof value === 'number' ? `${value.toLocaleString('vi-VN')} đ` : value;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '900', color: colors.brandBlack.main }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: 20, color: colors.brandOrange }]}>{displayValue}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18 },
  savedLink: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  savedLinkText: { flex: 1, color: colors.brandBlack.main, fontWeight: '800' },
  panel: { backgroundColor: colors.white, borderRadius: 20, padding: 18, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.brandBlack.main, marginBottom: 14 },
  itemBox: { backgroundColor: '#F0F2F5', borderRadius: 12, padding: 12, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontWeight: '700', color: colors.brandBlack.main },
  rowInputs: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.brandBlack.main, fontWeight: '700', marginBottom: 6, fontSize: 12 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 12, padding: 14, color: colors.brandBlack.main },
  inputSmall: { backgroundColor: '#FFF', borderRadius: 8, padding: 10, color: colors.brandBlack.main, borderWidth: 1, borderColor: '#EEE' },
  addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255, 107, 0, 0.1)', borderWidth: 1, borderColor: colors.brandOrange },
  addBtnText: { color: colors.brandOrange, fontWeight: '700' },
  calcBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack.main, borderRadius: 999, paddingVertical: 16, marginTop: 16 },
  calcText: { color: colors.brandOrange, fontWeight: '900', fontSize: 16 },
  result: { backgroundColor: colors.white, borderRadius: 20, padding: 18, marginTop: 18, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  resultTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  rowLabel: { color: colors.brandGrey[500], fontWeight: '700' },
  rowValue: { color: colors.brandBlack.main, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#EEF0F3', marginVertical: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  darkButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack.main, borderRadius: 14, paddingVertical: 14 },
  darkButtonText: { color: colors.white, fontWeight: '800' },
  orangeButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 14 },
  orangeButtonText: { color: colors.brandBlack.main, fontWeight: '800' },
  purpleButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#8B5CF6', borderRadius: 14, paddingVertical: 14 },
  purpleButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  savedNote: { textAlign: 'center', color: colors.success, fontWeight: '600', marginTop: 12, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.brandBlack.main },
  templateItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4F4F5' },
  templateName: { flex: 1, color: colors.brandBlack.main, fontWeight: '700' },

  // Sơ đồ cắt
  optCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  optCardHeader: { marginBottom: 8 },
  optCardTitle: { fontSize: 15, fontWeight: '900', color: colors.brandBlack.main },
  optCardDesc: { fontSize: 12, color: colors.brandGrey[500], marginTop: 2 },
  barItemBox: { backgroundColor: '#ffffff', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  barVisualTrack: { flexDirection: 'row', height: 28, backgroundColor: '#f1f5f9', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1' },
  cutSegment: { height: '100%', justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderColor: '#ffffff' },
  cutSegmentText: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  remainingSegment: { height: '100%', justifyContent: 'center', alignItems: 'center' },
  remainingSegmentText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
});
