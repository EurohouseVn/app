import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, Image, Platform, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QuotationInput, QuotationRecord, QuotationResult, QuotationItemInput } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import {
  Button, Card, Chip, EmptyState, Field, FieldLabel, IconButton, Input, ListRow, Loading, OptionSheet,
  SectionHead, SelectBox, Sheet, SubHeader, ValueLine, ws, wsStyles,
} from '../src/components/ws';
import { api, API_URL, authHeaders } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { canCallFormulaApi, guardFormulaCall } from '../src/lib/formulaAccess';
import { getInstallationIdentity } from '../src/lib/installationIdentity';
import { calculateGuestQuote, saveGuestQuote } from '../src/lib/localGuestQuotes';

function num(v: string | number): number { return Number(String(v).replace(/[^\d.-]/g, '')) || 0; }

function normalizeLookup(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

type ManagedSystem = { id: string; code: string; name: string; templateCount: number };
type ManagedTemplate = {
  id: string;
  templateId: string;
  templateName: string;
  systemName: string;
  imageUrl?: string;
  requiredInputs?: Array<{ id: string; name: string; type?: 'number' | 'boolean'; defaultValue?: number }>;
};

type MobileQuotationItemInput = QuotationItemInput & {
  phaoDinhName?: string;
  phaoDinhLength?: string;
  phaoDinhPrice?: string;
};

export default function QuoteScreen() {
  const { sessionTier } = useAuth();
  return sessionTier === 'GUEST' ? <GuestQuoteScreen /> : <AuthenticatedQuoteScreen />;
}

function GuestQuoteScreen() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [description, setDescription] = useState('Cửa nhôm kính');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [savedMessage, setSavedMessage] = useState('');
  const calculation = calculateGuestQuote([{ description, quantity: num(quantity), unitPrice: num(unitPrice) }]);

  async function saveLocalQuote() {
    if (!description.trim() || calculation.total <= 0) {
      Alert.alert('Chưa đủ dữ liệu', 'Nhập tên hạng mục, số lượng và đơn giá trước khi lưu.');
      return;
    }
    const installationId = await getInstallationIdentity(AsyncStorage);
    await saveGuestQuote(AsyncStorage, installationId, { customerName: customerName.trim(), items: calculation.items, total: calculation.total });
    setSavedMessage('Đã lưu báo giá trên thiết bị này.');
  }

  return (
    <View style={wsStyles.screen}>
      <SubHeader title="Báo giá thủ công" subtitle="Lưu trên thiết bị, không cần tài khoản" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.guestPage} keyboardShouldPersistTaps="handled">
        <Text style={wsStyles.hint}>Bản miễn phí không dùng công thức cắt và không gửi dữ liệu nghiệp vụ lên máy chủ.</Text>
        <Card style={styles.gapTop}>
          <FieldLabel>Khách hàng (không bắt buộc)</FieldLabel>
          <Input value={customerName} onChangeText={setCustomerName} placeholder="Tên khách hàng" />
          <Field label="Hạng mục"><Input value={description} onChangeText={setDescription} placeholder="Hạng mục" /></Field>
          <View style={[wsStyles.row, styles.gapTop]}>
            <View style={wsStyles.half}><FieldLabel>Số lượng</FieldLabel><Input value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="1" /></View>
            <View style={wsStyles.half}><FieldLabel>Đơn giá</FieldLabel><Input value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" placeholder="0" /></View>
          </View>
          <View style={styles.guestTotal}>
            <Text style={wsStyles.rowTitle}>Tạm tính</Text>
            <Text style={styles.guestTotalValue}>{calculation.total.toLocaleString('vi-VN')} đ</Text>
          </View>
          <Button label="Lưu trên thiết bị" icon="save" onPress={() => void saveLocalQuote()} style={styles.gapTop} />
          {savedMessage ? <Text style={styles.savedMsg}>{savedMessage}</Text> : null}
        </Card>
      </ScrollView>
    </View>
  );
}

function AuthenticatedQuoteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const formulaCapability = user?.capabilities.formulas;
  const formulaEnabled = canCallFormulaApi(formulaCapability);
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

  const [managedSystems, setManagedSystems] = useState<ManagedSystem[]>([]);
  const [templates, setTemplates] = useState<ManagedTemplate[]>([]);
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
              templateId: i.templateId,
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
    if (!formulaEnabled) { setManagedSystems([]); return; }
    void guardFormulaCall(formulaCapability, () => api.get<ManagedSystem[]>('/system-formulas/managed/systems')).then(setManagedSystems).catch(() => setManagedSystems([]));
  }, [formulaCapability, formulaEnabled]);

  const openTemplateModal = async (index: number) => {
    const item = items[index];
    const systemNeedle = normalizeLookup(item.system || '');
    const system = managedSystems.find(candidate => [candidate.name, candidate.code].some(value => normalizeLookup(value) === systemNeedle));
    if (!system) {
      Alert.alert('Chưa nhận diện hệ nhôm', 'Hãy chọn đúng hệ nhôm Eurohouse trước khi gắn công thức cắt.');
      return;
    }
    if (system.templateCount <= 0) {
      Alert.alert('Chưa có công thức phát hành', `${system.name} chưa có công thức được WebAdmin phát hành.`);
      return;
    }
    try {
      const list = await guardFormulaCall(formulaCapability, () => api.get<ManagedTemplate[]>(`/system-formulas/managed/templates?aluSystemId=${encodeURIComponent(system.id)}`));
      setTemplates(list);
      setSelectingIndex(index);
      setModalVisible(true);
    } catch (error) {
      Alert.alert('Không tải được công thức', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const selectTemplate = async (t: ManagedTemplate) => {
    if (selectingIndex !== null) {
      setItems(prev => {
        const clone = [...prev];
        const current = clone[selectingIndex];
        const init: Record<string, string> = {};
        (t.requiredInputs || []).forEach(req => {
          const key = req.id.toUpperCase();
          const fallback = ['W', 'WIDTH', 'B'].includes(key) ? current.widthMm
            : ['H', 'HEIGHT'].includes(key) ? current.heightMm
              : ['Q', 'QUANTITY'].includes(key) ? current.quantity
                : req.defaultValue ?? '';
          init[req.id] = String(fallback);
        });
        clone[selectingIndex] = {
          ...current,
          system: t.systemName || current.system,
          doorType: t.templateName,
          templateId: t.templateId,
          requiredInputs: (t.requiredInputs || []) as any,
          dynamicInputs: init,
        };
        return clone;
      });
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

  async function exportPdf(type: 'quotation' | 'estimate' = 'quotation') {
    if (!saved) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`${API_URL}/quotations/${saved.id}/pdf?type=${type}`, {
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Không thể tải PDF');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type === 'estimate' ? 'du-toan' : 'bao-gia'}-${saved.code}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const target = `${FileSystem.cacheDirectory}${type === 'estimate' ? 'du-toan' : 'bao-gia'}-${saved.code}.pdf`;
        const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${saved.id}/pdf?type=${type}`, target, {
          headers: authHeaders(),
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${type === 'estimate' ? 'Dự toán' : 'Báo giá'} ${saved.code}` });
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
        const sysKey = it.system || 'Hệ 55 Vát Cạnh';
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

      const res = await guardFormulaCall(formulaCapability, () => api.post<any[]>('/quotations/optimize-cut', requests));
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
    let sys = ['Hệ Thuỷ lực', 'Hệ Ecento 70', 'Hệ Ecento Plus', 'Hệ Trượt quay', 'Hệ trượt Châu âu', 'Hệ 55 Vát Cạnh', 'Hệ 55 Preco'];
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
      case 'Hệ 55 Vát Cạnh': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91', 'Cửa 1 cánh VIP 118', 'Cửa 2 cánh VIP 118', 'Cửa 4 cánh VIP 118', 'Cửa 1 cánh liền phào 125', 'Cửa 2 cánh liền phào 125', 'Cửa 4 cánh liền phào 125'];
      case 'Hệ 55 Preco': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91'];
      default: return ['Cửa 1 cánh', 'Cửa 2 cánh', 'Cửa 4 cánh'];
    }
  }

  function applySelect(item: string) {
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
  }

  const selectedValue = (() => {
    if (selectModal.field === 'phaoDinhDirect') return phaoDinh.name || 'Không';
    if (selectModal.index === null) return undefined;
    const current = items[selectModal.index] as any;
    if (!current) return undefined;
    if (selectModal.field === 'chanSongSystem' || selectModal.field === 'chanSongType') return current.dynamicInputs?.[selectModal.field];
    return current[selectModal.field];
  })();

  const openSelect = (title: string, options: string[], field: string, index: number | null) => setSelectModal({ visible: true, title, options, field, index });

  const updateExtraList = (
    list: typeof accessoriesList,
    setList: typeof setAccessoriesList,
    idx: number,
    field: 'name' | 'description' | 'unit' | 'quantity' | 'unitPrice',
    value: string,
  ) => {
    const clone = [...list];
    clone[idx] = { ...clone[idx], [field]: value };
    setList(clone);
  };

  return (
    <View style={wsStyles.screen}>
      <SubHeader
        title={isEditing ? 'Sửa báo giá' : 'Lập báo giá'}
        subtitle={saved ? `Đã lưu ${saved.code}` : 'Tính chi tiết nhiều hạng mục cửa'}
        onBack={() => router.back()}
        right={<IconButton icon="file-text" tone="orange" label="Xem báo giá đã lưu" onPress={() => router.push('/quotations' as Href)} />}
      />
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SectionHead title="Khách hàng" />
        <Card>
          <View style={wsStyles.row}>
            <View style={wsStyles.half}><FieldLabel>Họ tên</FieldLabel><Input value={customerName} onChangeText={setCustomerName} placeholder="Nguyễn Văn A" /></View>
            <View style={wsStyles.half}><FieldLabel>Số điện thoại</FieldLabel><Input value={customerPhone} onChangeText={setCustomerPhone} placeholder="09..." keyboardType="phone-pad" /></View>
          </View>
          <Field label="Địa chỉ"><Input value={customerAddress} onChangeText={setCustomerAddress} placeholder="Số nhà, đường..." /></Field>
        </Card>

        <SectionHead title="Hạng mục cửa" sub={`${items.length} hạng mục`} />
        {items.map((item, index) => {
          const dyn = (item.dynamicInputs as any) || {};
          const isWindow = (item.name || '').trim().toUpperCase().startsWith('CS');
          return (
            <Card key={index} style={styles.itemCard}>
              <View style={styles.itemHead}>
                <View style={styles.itemBadge}><Text style={styles.itemBadgeText}>{index + 1}</Text></View>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle} numberOfLines={1}>{item.name || `Hạng mục ${index + 1}`}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>{[item.system, item.doorType].filter(Boolean).join(' · ') || 'Chưa chọn hệ và loại cửa'}</Text>
                </View>
                {items.length > 1 ? <IconButton icon="trash-2" tone="danger" label={`Xoá hạng mục ${index + 1}`} onPress={() => removeItem(index)} /> : null}
              </View>

              <View style={wsStyles.row}>
                <View style={wsStyles.half}><FieldLabel>Ký hiệu</FieldLabel><SelectBox value={item.name} placeholder="Ký hiệu" onPress={() => openSelect('Chọn ký hiệu', ['D1-Cửa chính', 'D2', 'D3', 'CS1', 'CS2', 'CS3', 'VK1', 'VK2', 'VK3', 'OFix 1', 'OFix 2', 'Other'], 'name', index)} /></View>
                <View style={wsStyles.half}><FieldLabel>Màu sắc</FieldLabel><SelectBox value={item.color} placeholder="Màu" onPress={() => openSelect('Chọn màu sắc', COLORS, 'color', index)} /></View>
              </View>
              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Hệ nhôm</FieldLabel><SelectBox value={item.system} placeholder="Hệ nhôm" onPress={() => openSelect('Chọn hệ nhôm', getSystemOptions(item.name, item.color), 'system', index)} /></View>
                <View style={wsStyles.half}><FieldLabel>Loại cửa (mẫu)</FieldLabel><SelectBox value={item.doorType} placeholder="Loại cửa" onPress={() => openSelect('Chọn kiểu cửa', getDoorTypeOptions(item.name || '', item.system || ''), 'doorType', index)} /></View>
              </View>

              {formulaEnabled ? (
                <Pressable style={[styles.formulaPicker, item.templateId && styles.formulaPickerOn]} onPress={() => openTemplateModal(index)}>
                  <Icon name={item.templateId ? 'check-circle' : 'tool'} size={17} color={item.templateId ? ws.success : ws.orangeText} />
                  <View style={wsStyles.grow}>
                    <Text style={styles.formulaLabel}>Công thức cắt để bóc tách nhôm</Text>
                    <Text style={[styles.formulaValue, item.templateId && { color: ws.success }]} numberOfLines={1}>{item.templateId ? `Đã gắn: ${item.doorType}` : 'Chọn công thức đã phát hành'}</Text>
                  </View>
                  <Icon name="chevron-right" size={17} color={ws.muted} />
                </Pressable>
              ) : null}

              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Loại kính</FieldLabel><SelectBox value={item.glassType} placeholder="Loại kính" onPress={() => openSelect('Chọn loại kính', KINH_LOAI, 'glassType', index)} /></View>
                <View style={wsStyles.half}><FieldLabel>Màu kính</FieldLabel><SelectBox value={item.glassColor} placeholder="Màu kính" onPress={() => openSelect('Chọn màu kính', KINH_MAU, 'glassColor', index)} /></View>
              </View>
              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Ôm tường</FieldLabel><SelectBox value={item.wallHugging || 'Non'} placeholder="Ôm tường" onPress={() => openSelect('Chọn ôm tường', ['Tường 200', 'Tường 150', 'Tường 250', 'Non'], 'wallHugging', index)} /></View>
                <View style={wsStyles.half} />
              </View>

              {isWindow ? (
                <View style={styles.subBox}>
                  <Text style={styles.subTitle}>Chấn song bảo vệ (cửa sổ)</Text>
                  <View style={wsStyles.row}>
                    <View style={wsStyles.half}><FieldLabel>Hệ chấn song</FieldLabel><SelectBox value={dyn.chanSongSystem || 'Không'} placeholder="Không" onPress={() => openSelect('Chọn hệ chấn song', ['Không', 'Hệ chấn song khung độc lập', 'Hệ chấn song tích hợp'], 'chanSongSystem', index)} /></View>
                    {dyn.chanSongSystem && dyn.chanSongSystem !== 'Không' ? (
                      <View style={wsStyles.half}><FieldLabel>Loại song</FieldLabel><SelectBox value={dyn.chanSongType || 'Song tròn D28'} placeholder="Loại song" onPress={() => openSelect('Chọn loại song', ['Song tròn D28', 'Song lục giác 31x35mm', 'Song chữ nhật 25x40mm'], 'chanSongType', index)} /></View>
                    ) : <View style={wsStyles.half} />}
                  </View>
                </View>
              ) : null}

              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Rộng (mm)</FieldLabel><Input value={String(item.widthMm || '')} onChangeText={(v) => updateItem(index, 'widthMm', v)} keyboardType="numeric" /></View>
                <View style={wsStyles.half}><FieldLabel>Cao (mm)</FieldLabel><Input value={String(item.heightMm || '')} onChangeText={(v) => updateItem(index, 'heightMm', v)} keyboardType="numeric" /></View>
                <View style={styles.qtyCol}><FieldLabel>SL</FieldLabel><Input value={String(item.quantity || '')} onChangeText={(v) => updateItem(index, 'quantity', v)} keyboardType="numeric" /></View>
              </View>
              <Field label="Đơn giá / m² (đ)"><Input value={String(item.pricePerM2)} onChangeText={(v) => updateItem(index, 'pricePerM2', v)} keyboardType="numeric" /></Field>

              <Field label="Phụ kiện">
                <View style={styles.choiceRow}>
                  <Chip label="Đã gồm trong đơn giá" active={item.includesAccessories !== false} onPress={() => updateItem(index, 'includesAccessories', 'true')} />
                  <Chip label="Chưa gồm" active={item.includesAccessories === false} onPress={() => updateItem(index, 'includesAccessories', 'false')} />
                </View>
              </Field>
              {item.includesAccessories === false ? (
                <Field label="Giá bộ phụ kiện (đ) — cộng thêm vào tổng">
                  <Input value={String(item.accessoriesPrice || '')} onChangeText={(v) => updateItem(index, 'accessoriesPrice', v)} keyboardType="numeric" />
                </Field>
              ) : null}
            </Card>
          );
        })}
        <Button label="Thêm hạng mục cửa" icon="plus" variant="soft" onPress={addItem} />

        <SectionHead title="Sản phẩm gia tăng" sub="Phào đỉnh, phụ kiện, sản phẩm khác" />
        <Card>
          <FieldLabel>Phào đỉnh</FieldLabel>
          <SelectBox value={phaoDinh.name || 'Không'} placeholder="Không" onPress={() => openSelect('Chọn phào đỉnh', ['Không', 'Phào đơn 75mm', 'Phào kép 220mm', 'Phào kép 280mm'], 'phaoDinhDirect', null)} />
          {Boolean(phaoDinh.name) && phaoDinh.name !== 'Không' ? (
            <View style={[wsStyles.row, styles.gapTop]}>
              <View style={wsStyles.half}><FieldLabel>Mét dài (md)</FieldLabel><Input value={phaoDinh.length} onChangeText={(v) => setPhaoDinh(p => ({ ...p, length: v }))} keyboardType="numeric" placeholder="10" /></View>
              <View style={wsStyles.half}><FieldLabel>Đơn giá (đ/m)</FieldLabel><Input value={phaoDinh.price} onChangeText={(v) => setPhaoDinh(p => ({ ...p, price: v }))} keyboardType="numeric" placeholder="900000" /></View>
            </View>
          ) : null}

          <Text style={styles.groupTitle}>Phụ kiện (tay nắm, khoá điện tử, khoá từ...)</Text>
          {accessoriesList.map((acc, idx) => (
            <View key={idx} style={styles.subBox}>
              <View style={wsStyles.row}>
                <View style={styles.wide}><FieldLabel>Tên phụ kiện</FieldLabel><Input value={acc.name} onChangeText={(v) => updateExtraList(accessoriesList, setAccessoriesList, idx, 'name', v)} placeholder="VD: Tay nắm Juai" /></View>
                <View style={wsStyles.half}><FieldLabel>Đơn vị</FieldLabel><Input value={acc.unit} onChangeText={(v) => updateExtraList(accessoriesList, setAccessoriesList, idx, 'unit', v)} placeholder="bộ" /></View>
              </View>
              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Số lượng</FieldLabel><Input value={acc.quantity} onChangeText={(v) => updateExtraList(accessoriesList, setAccessoriesList, idx, 'quantity', v)} keyboardType="numeric" placeholder="1" /></View>
                <View style={wsStyles.half}><FieldLabel>Đơn giá (đ)</FieldLabel><Input value={acc.unitPrice} onChangeText={(v) => updateExtraList(accessoriesList, setAccessoriesList, idx, 'unitPrice', v)} keyboardType="numeric" placeholder="0" /></View>
                {accessoriesList.length > 1 ? <View style={styles.trashCol}><IconButton icon="trash-2" tone="danger" label="Xoá phụ kiện" onPress={() => setAccessoriesList(prev => prev.filter((_, i) => i !== idx))} /></View> : null}
              </View>
            </View>
          ))}
          <Button label="Thêm phụ kiện" icon="plus" variant="secondary" onPress={() => setAccessoriesList(prev => [...prev, { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }])} style={styles.gapTop} />

          <Text style={styles.groupTitle}>Sản phẩm khác (mái tôn, lan can, cửa cổng...)</Text>
          {customExtras.map((ext, idx) => (
            <View key={idx} style={styles.subBox}>
              <View style={wsStyles.row}>
                <View style={styles.wide}><FieldLabel>Tên sản phẩm</FieldLabel><Input value={ext.name} onChangeText={(v) => updateExtraList(customExtras, setCustomExtras, idx, 'name', v)} placeholder="VD: Mái tôn, lan can" /></View>
                <View style={wsStyles.half}><FieldLabel>Đơn vị</FieldLabel><Input value={ext.unit} onChangeText={(v) => updateExtraList(customExtras, setCustomExtras, idx, 'unit', v)} placeholder="bộ" /></View>
              </View>
              <Field label="Mô tả"><Input value={ext.description} onChangeText={(v) => updateExtraList(customExtras, setCustomExtras, idx, 'description', v)} placeholder="VD: Mái tôn 0.45mm chống nóng" /></Field>
              <View style={[wsStyles.row, styles.gapTop]}>
                <View style={wsStyles.half}><FieldLabel>Số lượng / mét</FieldLabel><Input value={ext.quantity} onChangeText={(v) => updateExtraList(customExtras, setCustomExtras, idx, 'quantity', v)} keyboardType="numeric" placeholder="1" /></View>
                <View style={wsStyles.half}><FieldLabel>Đơn giá (đ)</FieldLabel><Input value={ext.unitPrice} onChangeText={(v) => updateExtraList(customExtras, setCustomExtras, idx, 'unitPrice', v)} keyboardType="numeric" placeholder="0" /></View>
                {customExtras.length > 1 ? <View style={styles.trashCol}><IconButton icon="trash-2" tone="danger" label="Xoá sản phẩm" onPress={() => setCustomExtras(prev => prev.filter((_, i) => i !== idx))} /></View> : null}
              </View>
            </View>
          ))}
          <Button label="Thêm sản phẩm khác" icon="plus" variant="secondary" onPress={() => setCustomExtras(prev => [...prev, { name: '', description: '', unit: 'bộ', quantity: '', unitPrice: '' }])} style={styles.gapTop} />
        </Card>

        <SectionHead title="Tuỳ chọn báo giá / quyết toán" />
        <Card>
          <FieldLabel>Thuế VAT (%)</FieldLabel>
          <Input value={globalCosts.vatPct} onChangeText={(v) => updateCost('vatPct', v)} keyboardType="numeric" placeholder="0" />
          {isEditing ? (
            <View style={styles.settleBox}>
              <View style={styles.settleRow}>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle}>Chuyển sang quyết toán</Text>
                  <Text style={wsStyles.rowMeta}>Bật khi sửa báo giá để xuất bảng quyết toán</Text>
                </View>
                <Switch value={isFinalSettlement} onValueChange={setIsFinalSettlement} trackColor={{ true: ws.orange, false: ws.lineSoft }} />
              </View>
              {isFinalSettlement ? (
                <Field label="Giá trị tạm ứng (VNĐ)">
                  <Input value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" placeholder="Số tiền khách đã tạm ứng / đặt cọc" />
                </Field>
              ) : null}
            </View>
          ) : null}
        </Card>

        <Button label="Tính báo giá" icon="zap" loading={busy && !result} onPress={calc} disabled={busy} style={styles.calcButton} />

        {result ? (
          <>
            <SectionHead title="Xem trước dự toán" sub="Kéo ngang để xem đủ các cột" />
            <Card padded={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View style={styles.table}>
                  <View style={[styles.tr, styles.thRow]}>
                    {TABLE_COLUMNS.map(([label, width]) => <Text key={label} style={[styles.th, { width }]}>{label}</Text>)}
                  </View>
                  {result.items.map((it, idx) => {
                    let quyCach = it.doorType;
                    if (it.system) quyCach += `\n- Hệ: ${it.system.replace(/^Hệ\s+/i, '')}`;
                    if (it.color) quyCach += `\n- Màu: ${it.color.replace(/^Màu\s+/i, '')}`;
                    if (it.glassType) quyCach += `\n- Kính: ${it.glassType.replace(/^Kính\s+/i, '')}`;
                    if (it.wallHugging && it.wallHugging !== 'Non') quyCach += `\n- Ôm tường: ${it.wallHugging}`;
                    const rowDyn = (it.dynamicInputs as any) || {};
                    if (rowDyn.chanSongSystem && rowDyn.chanSongSystem !== 'Không') {
                      let csStr = rowDyn.chanSongSystem.replace(/^Hệ\s+/i, '');
                      if (rowDyn.chanSongType) csStr += ` (${rowDyn.chanSongType})`;
                      quyCach += `\n- Chấn song: ${csStr}`;
                    }
                    return (
                      <View key={idx} style={styles.tr}>
                        <Text style={[styles.td, styles.center, { width: 40 }]}>{idx + 1}</Text>
                        <Text style={[styles.td, styles.center, { width: 80 }]}>{it.name}</Text>
                        <Text style={[styles.td, { width: 200 }]}>{quyCach}</Text>
                        <Text style={[styles.td, styles.center, { width: 60 }]}>{it.widthMm}</Text>
                        <Text style={[styles.td, styles.center, { width: 60 }]}>{it.heightMm}</Text>
                        <Text style={[styles.td, styles.center, { width: 80 }]}>{it.areaM2}</Text>
                        <Text style={[styles.td, styles.center, { width: 50 }]}>{it.quantity}</Text>
                        <Text style={[styles.td, styles.right, { width: 100 }]}>{it.pricePerM2.toLocaleString('vi-VN')}</Text>
                        <Text style={[styles.td, styles.right, styles.tdStrong, { width: 120 }]}>{it.totalPrice.toLocaleString('vi-VN')}</Text>
                      </View>
                    );
                  })}
                  {result.extraProducts && result.extraProducts.length > 0 ? (
                    <>
                      <View style={[styles.tr, styles.groupRow]}><Text style={styles.groupRowText}>Sản phẩm gia tăng & phụ kiện</Text></View>
                      {result.extraProducts.map((ep, eIdx) => (
                        <View key={eIdx} style={styles.tr}>
                          <Text style={[styles.td, styles.center, { width: 40 }]}>{eIdx + 1}</Text>
                          <Text style={[styles.td, styles.tdStrong, { width: 80 }]}>{ep.name}</Text>
                          <Text style={[styles.td, { width: 200 }]}>{ep.description || ep.name}</Text>
                          <Text style={[styles.td, { width: 60 }]} />
                          <Text style={[styles.td, { width: 60 }]} />
                          <Text style={[styles.td, styles.center, { width: 80 }]}>{ep.quantity} {ep.unit || 'md'}</Text>
                          <Text style={[styles.td, { width: 50 }]} />
                          <Text style={[styles.td, styles.right, { width: 100 }]}>{(ep.unitPrice || 0).toLocaleString('vi-VN')}</Text>
                          <Text style={[styles.td, styles.right, styles.tdStrong, { width: 120 }]}>{(ep.totalPrice || (ep.quantity * ep.unitPrice)).toLocaleString('vi-VN')}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              </ScrollView>
            </Card>

            <Card padded={false} style={styles.gapTop}>
              <ValueLine first label="Tổng diện tích" value={`${result.areaM2} m²`} />
              <ValueLine label="Giá trị cửa" value={vnd(result.baseAmount - (result.extraProductsAmount || 0))} />
              {result.extraProductsAmount ? <ValueLine label="Sản phẩm gia tăng & phụ kiện" value={vnd(result.extraProductsAmount)} /> : null}
              {result.vatAmount ? <ValueLine label={`Thuế VAT (${globalCosts.vatPct}%)`} value={vnd(result.vatAmount)} /> : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TỔNG THANH TOÁN</Text>
                <Text style={styles.totalValue}>{vnd(result.totalAmount)}</Text>
              </View>
            </Card>

            <View style={styles.actionGrid}>
              <Button label={isEditing ? 'Cập nhật' : 'Lưu dự toán'} icon="save" onPress={save} disabled={busy} style={wsStyles.half} />
              <Button label="Báo giá PDF" icon="download" variant="secondary" onPress={() => exportPdf('quotation')} disabled={busy || !saved} style={wsStyles.half} />
            </View>
            <View style={styles.actionGrid}>
              <Button label="Sinh hợp đồng" icon="file-text" variant="secondary" onPress={() => saved && router.push({ pathname: '/contract', params: { quotationId: saved.id } })} disabled={busy || !saved} style={wsStyles.half} />
              {formulaEnabled ? <Button label="Tối ưu cắt" icon="tool" variant="secondary" onPress={runCuttingOptimizer} disabled={busy} style={wsStyles.half} /> : <View style={wsStyles.half} />}
            </View>
            {!saved ? <Text style={wsStyles.hint}>Lưu dự toán trước để xuất PDF, sinh hợp đồng, đặt nhôm hoặc tạo công trình.</Text> : null}

            {saved ? (
              <>
                <SectionHead title="Bước tiếp theo" sub={`Báo giá ${saved.code} đã lưu`} />
                <View style={styles.stack}>
                  <Button label="Đặt nhôm gửi NPP theo báo giá này" icon="truck" variant="soft" onPress={convertToOrder} disabled={busy} />
                  <Button
                    label="Tạo công trình từ báo giá này"
                    icon="briefcase"
                    variant="secondary"
                    disabled={busy}
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
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Sheet visible={optModalOpen} onClose={() => setOptModalOpen(false)} title="Sơ đồ cắt & tối ưu phế liệu" sub="Xếp nhôm best-fit, tận dụng đề-xê" tall>
        {optLoading ? (
          <Loading text="Đang tính sơ đồ cắt tối ưu..." />
        ) : optResults.length === 0 ? (
          <EmptyState icon="tool" title="Không có dữ liệu để tối ưu" />
        ) : (
          optResults.map((opt, oIdx) => (
            <Card key={oIdx} style={styles.optCard}>
              <Text style={wsStyles.rowTitle}>Hệ nhôm: {opt.materialCode}</Text>
              <Text style={wsStyles.rowMeta}>
                Cần <Text style={styles.optStrong}>{opt.newBarsNeeded} cây 6m</Text> · sinh {opt.newDeXeGenerated?.length || 0} đoạn đề-xê · phế <Text style={styles.optScrap}>{opt.scrapGeneratedKg} kg</Text>
              </Text>
              {opt.barLayouts && opt.barLayouts.length > 0 ? opt.barLayouts.map((bar: any, bIdx: number) => (
                <View key={bIdx} style={styles.barBox}>
                  <View style={styles.barHead}>
                    <Text style={styles.barTitle}>{bar.isDeXe ? `Cây đề-xê (${bar.barLengthMm}mm)` : `Cây nguyên #${bar.barIndex} (${bar.barLengthMm}mm)`}</Text>
                    <Text style={wsStyles.rowMeta}>Dùng {bar.usedLengthMm} · thừa {bar.remainingLengthMm}mm</Text>
                  </View>
                  <View style={styles.barTrack}>
                    {bar.cuts?.map((cut: any, cIdx: number) => (
                      <View key={cIdx} style={[styles.cutSegment, { width: `${Math.max(8, (cut.lengthMm / bar.barLengthMm) * 100)}%`, backgroundColor: cIdx % 2 === 0 ? '#F79009' : '#DC6803' }]}>
                        <Text style={styles.cutText} numberOfLines={1}>{cut.lengthMm}</Text>
                      </View>
                    ))}
                    {bar.remainingLengthMm > 0 ? (
                      <View style={[styles.cutSegment, { width: `${Math.max(5, (bar.remainingLengthMm / bar.barLengthMm) * 100)}%`, backgroundColor: bar.isNewDeXe ? ws.success : ws.faint }]}>
                        <Text style={styles.cutText} numberOfLines={1}>{bar.remainingLengthMm} {bar.isNewDeXe ? 'ĐX' : 'Phế'}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cutList}>
                    {bar.cuts?.map((c: any, ci: number) => (
                      <View key={ci} style={styles.cutPill}><Text style={styles.cutPillText}>{c.doorName ? `${c.doorName}: ` : ''}{c.lengthMm}mm ({c.cutAngle || '45°'})</Text></View>
                    ))}
                  </View>
                </View>
              )) : <Text style={wsStyles.hint}>Chưa có sơ đồ chi tiết.</Text>}
            </Card>
          ))
        )}
      </Sheet>

      <Sheet visible={modalVisible} onClose={() => setModalVisible(false)} title="Chọn công thức cửa" sub="Công thức do Eurohouse phát hành">
        {templates.length === 0 ? <EmptyState icon="file" title="Chưa có công thức" /> : templates.map((t, index) => (
          <ListRow key={t.templateId} first={index === 0} onPress={() => selectTemplate(t)} label={`Chọn ${t.templateName}`}>
            {t.imageUrl ? (
              <Image source={{ uri: t.imageUrl.startsWith('http') ? t.imageUrl : `${API_URL.replace('/api', '')}${t.imageUrl}` }} style={styles.templateImage} resizeMode="contain" />
            ) : (
              <View style={wsStyles.avatar}><Icon name="file" size={18} color={ws.orangeText} /></View>
            )}
            <Text style={[wsStyles.rowTitle, wsStyles.grow]}>{t.templateName}</Text>
            <Icon name="chevron-right" size={17} color={ws.muted} />
          </ListRow>
        ))}
      </Sheet>

      <OptionSheet
        visible={selectModal.visible}
        title={selectModal.title}
        options={selectModal.options}
        value={selectedValue}
        onSelect={applySelect}
        onClose={() => setSelectModal({ ...selectModal, visible: false })}
      />
    </View>
  );
}

const TABLE_COLUMNS: Array<[string, number]> = [
  ['STT', 40], ['Ký hiệu', 80], ['Loại cửa - Quy cách', 200], ['Rộng', 60], ['Cao', 60], ['Diện tích', 80], ['SL', 50], ['Đơn giá', 100], ['Thành tiền', 120],
];

function vnd(value: number): string {
  return `${Math.round(value || 0).toLocaleString('vi-VN')} đ`;
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  stack: { gap: 10 },
  guestPage: { padding: 16, paddingBottom: 80, width: '100%', maxWidth: 680, alignSelf: 'center' },
  guestTotal: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  guestTotalValue: { color: ws.ink, fontSize: 20, fontWeight: '900' },
  savedMsg: { color: ws.success, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  itemCard: { marginBottom: 10 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  itemBadge: { width: 30, height: 30, borderRadius: 9, backgroundColor: ws.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  itemBadgeText: { color: ws.orangeText, fontSize: 13, fontWeight: '900' },
  qtyCol: { width: 64 },
  wide: { flex: 2, minWidth: 0 },
  trashCol: { justifyContent: 'flex-end' },
  formulaPicker: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: ws.orangeLine, backgroundColor: ws.orangeSoft },
  formulaPickerOn: { borderColor: '#A6F4C5', backgroundColor: ws.successBg },
  formulaLabel: { color: ws.body, fontSize: 11.5, fontWeight: '700' },
  formulaValue: { color: ws.orangeText, fontSize: 13, fontWeight: '800', marginTop: 2 },
  subBox: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: ws.lineSoft },
  subTitle: { color: ws.ink, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  groupTitle: { color: ws.ink, fontSize: 13, fontWeight: '800', marginTop: 18 },
  settleBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  settleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calcButton: { marginTop: 18 },
  table: { minWidth: 790 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: ws.lineSoft },
  thRow: { backgroundColor: '#F9FAFB', borderBottomColor: ws.line },
  th: { paddingVertical: 9, paddingHorizontal: 8, color: ws.muted, fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  td: { paddingVertical: 8, paddingHorizontal: 8, color: ws.text, fontSize: 12, lineHeight: 17 },
  tdStrong: { color: ws.ink, fontWeight: '800' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
  groupRow: { backgroundColor: ws.orangeSoft, justifyContent: 'center' },
  groupRowText: { paddingVertical: 7, paddingHorizontal: 10, color: ws.orangeText, fontSize: 12, fontWeight: '800' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: ws.line },
  totalLabel: { color: ws.ink, fontSize: 13, fontWeight: '900' },
  totalValue: { color: ws.ink, fontSize: 21, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  optCard: { marginBottom: 10 },
  optStrong: { color: ws.orangeText, fontWeight: '900' },
  optScrap: { color: ws.dangerText, fontWeight: '900' },
  barBox: { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: ws.lineSoft, backgroundColor: '#F9FAFB' },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  barTitle: { color: ws.ink, fontSize: 12.5, fontWeight: '800', flexShrink: 1 },
  barTrack: { flexDirection: 'row', height: 28, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: ws.line, backgroundColor: '#F2F4F7' },
  cutSegment: { height: '100%', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: ws.surface },
  cutText: { color: ws.surface, fontSize: 10.5, fontWeight: '800' },
  cutList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cutPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: ws.line, backgroundColor: ws.surface },
  cutPillText: { color: ws.text, fontSize: 11 },
  templateImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F2F4F7' },
});
