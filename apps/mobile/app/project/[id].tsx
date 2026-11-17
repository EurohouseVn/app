import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Switch, Alert, Modal, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import { LocalProjectsApi, type LocalProject } from '../../src/lib/localProjects';
import { Icon, type IconName } from '../../src/components/Icon';
import { PROJECT_STATUS } from '../../src/components/projectStatus';
import { api, API_URL, authHeaders } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/alert';
import { resetScrollToTop, useResetScrollOnFocus } from '../../src/hooks/useResetScrollOnFocus';
import { formatVndInput, parseVndInput } from '../../src/lib/vndCurrency';

const PROJECT_TYPES = ['Nhà ống', 'Biệt thự', 'Dân dụng', 'Cải tạo', 'Khác'];
const CATEGORIES = ['Nhôm kính', 'Sắt thép', 'Inox', 'Mái tôn', 'Cầu thang', 'Lan can', 'Năng lượng mặt trời'];
const PAYMENT_CATEGORIES = ['Mua nhôm', 'Mua phụ kiện', 'Mua kính', 'Nhân công', 'Vận chuyển', 'Lắp đặt', 'Chi phí phát sinh'];

type ProjectCashTransaction = {
  id: string;
  code: string;
  type: 'RECEIPT' | 'PAYMENT';
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER';
  category: string;
  note: string;
  transDate: string;
};

function num(v: string): number {
  return parseVndInput(v);
}

function VndMoneyInput({
  value,
  onChangeText,
  placeholder = '0',
  accent = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.currencyInputWrap}>
      <TextInput
        value={value}
        onChangeText={(nextValue) => onChangeText(formatVndInput(nextValue))}
        keyboardType="numeric"
        style={[styles.currencyInput, accent && styles.currencyInputAccent]}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
      />
      <Text style={[styles.currencySuffix, accent && styles.currencySuffixAccent]}>đ</Text>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [project, setProject] = useState<LocalProject | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'files'>('overview');
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [projectType, setProjectType] = useState('');
  const [isContractSigned, setIsContractSigned] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Financial
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [additionalCosts, setAdditionalCosts] = useState('');
  const [incurredType, setIncurredType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [finalAmount, setFinalAmount] = useState('');
  const [quotationCode, setQuotationCode] = useState('');
  const [quotationId, setQuotationId] = useState('');
  const [costAluminum, setCostAluminum] = useState('');
  const [costAccessory, setCostAccessory] = useState('');
  const [costGlass, setCostGlass] = useState('');
  const [costLabor, setCostLabor] = useState('');
  const [costTransport, setCostTransport] = useState('');
  const [costInstallation, setCostInstallation] = useState('');
  const [costOther, setCostOther] = useState('');
  const [extraRevenue, setExtraRevenue] = useState('');

  // Images
  const [images, setImages] = useState<string[]>([]);

  // Modal & state
  const [saved, setSaved] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quotesList, setQuotesList] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [exportingFinancialPdf, setExportingFinancialPdf] = useState(false);
  const [exportingAcceptancePdf, setExportingAcceptancePdf] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cashTransactions, setCashTransactions] = useState<ProjectCashTransaction[]>([]);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashType, setCashType] = useState<'RECEIPT' | 'PAYMENT'>('PAYMENT');
  const [cashAmount, setCashAmount] = useState('');
  const [cashCategory, setCashCategory] = useState('Mua nhôm');
  const [cashMethod, setCashMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [cashNote, setCashNote] = useState('');
  const [savingCash, setSavingCash] = useState(false);

  useResetScrollOnFocus(scrollRef);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await LocalProjectsApi.getOne(id);
    if (!p) {
      Alert.alert('Lỗi', 'Không tìm thấy công trình này');
      router.back();
      return;
    }
    setProject(p);
    // Công trình vừa tạo, chưa có thông tin: mở thẳng chế độ sửa.
    if (p.name === 'Công trình mới' && !p.customerName && !p.estimatedAmount) setMode('edit');
    setName(p.name);
    setAddress(p.address);
    setCustomerName(p.customerName || '');
    setCustomerPhone(p.customerPhone || '');
    setProjectType(p.projectType);
    setIsContractSigned(p.isContractSigned);
    setCategories(p.categories || []);
    setEstimatedAmount(formatVndInput(p.estimatedAmount || 0));
    setAdditionalCosts(formatVndInput(p.additionalCosts || 0));
    setIncurredType(p.incurredType || 'INCREASE');
    setFinalAmount(formatVndInput(p.finalAmount || 0));
    setQuotationCode(p.quotationCode || '');
    setQuotationId(p.quotationId || '');
    setCostAluminum(formatVndInput(p.costAluminum || 0));
    setCostAccessory(formatVndInput(p.costAccessory || 0));
    setCostGlass(formatVndInput(p.costGlass || 0));
    setCostLabor(formatVndInput(p.costLabor || 0));
    setCostTransport(formatVndInput(p.costTransport || 0));
    setCostInstallation(formatVndInput(p.costInstallation || 0));
    setCostOther(formatVndInput(p.costOther || 0));
    setExtraRevenue(formatVndInput(p.extraRevenue || 0));
    setImages(p.images || []);
    if (p.id.startsWith('local-')) setCashTransactions([]);
    else {
      api.get<ProjectCashTransaction[]>(`/workshop/v2/projects/${p.id}/cash-transactions`)
        .then(setCashTransactions)
        .catch(() => setCashTransactions([]));
    }
    setTimeout(() => resetScrollToTop(scrollRef), 0);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const legacyExpense = useMemo(() => [costAluminum, costAccessory, costGlass, costLabor, costTransport, costInstallation, costOther].reduce((sum, value) => sum + num(value), 0), [costAluminum, costAccessory, costGlass, costLabor, costTransport, costInstallation, costOther]);
  const actualReceipt = useMemo(() => cashTransactions.filter(item => item.type === 'RECEIPT').reduce((sum, item) => sum + item.amount, 0), [cashTransactions]);
  const actualPayment = useMemo(() => cashTransactions.filter(item => item.type === 'PAYMENT').reduce((sum, item) => sum + item.amount, 0), [cashTransactions]);
  const totalExpense = actualPayment > 0 ? actualPayment : legacyExpense;
  const calculatedProfit = Math.max(0, num(finalAmount) + num(extraRevenue)) - totalExpense;
  const expenseByCategory = useMemo(() => Array.from(
    cashTransactions.filter(item => item.type === 'PAYMENT').reduce((groups, item) => {
      const category = item.category || 'Chi phí khác';
      groups.set(category, (groups.get(category) || 0) + item.amount);
      return groups;
    }, new Map<string, number>()),
  ), [cashTransactions]);

  const toggleCategory = (cat: string) => {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleIncurredTypeChange = (type: 'INCREASE' | 'DECREASE') => {
    setIncurredType(type);
    const est = num(estimatedAmount);
    const inc = num(additionalCosts);
    const calculated = type === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(formatVndInput(calculated > 0 ? calculated : 0));
  };

  const handleAdditionalCostsChange = (val: string) => {
    setAdditionalCosts(formatVndInput(val));
    const est = num(estimatedAmount);
    const inc = num(val);
    const calculated = incurredType === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(formatVndInput(calculated > 0 ? calculated : 0));
  };

  const handleEstimatedAmountChange = (val: string) => {
    setEstimatedAmount(formatVndInput(val));
    const est = num(val);
    const inc = num(additionalCosts);
    const calculated = incurredType === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(formatVndInput(calculated > 0 ? calculated : 0));
  };

  const openQuotationModal = async () => {
    setQuoteModalOpen(true);
    setLoadingQuotes(true);
    try {
      const res = await api.get<any>('/quotations?mine=true');
      const list = Array.isArray(res) ? res : (res?.items || res?.data || []);
      setQuotesList(list);
    } catch (e) {
      setQuotesList([]);
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    confirmAction('Xoá công trình', 'Bạn có chắc chắn muốn xoá công trình này?', async () => {
      await LocalProjectsApi.delete(id);
      router.back();
    });
  };

  const selectQuotation = (q: any) => {
    const total = Number(q.totalAmount) || 0;
    setEstimatedAmount(formatVndInput(total));
    setQuotationId(q.id);
    setQuotationCode(q.code);
    if (q.customerName) setCustomerName(q.customerName);
    if (q.customerPhone) setCustomerPhone(q.customerPhone);
    const inc = num(additionalCosts);
    const calculated = incurredType === 'INCREASE' ? total + inc : total - inc;
    setFinalAmount(formatVndInput(calculated > 0 ? calculated : 0));
    setQuoteModalOpen(false);
    Alert.alert('Đã import', `Đã lấy dữ liệu từ báo giá ${q.code} (${total.toLocaleString('vi-VN')} đ)`);
  };

  const handlePreviewQuotation = async () => {
    if (!quotationId && !quotationCode) return;
    try {
      const q = await api.get<any>(`/quotations/${quotationId || quotationCode}`);
      if (q && q.id) {
        const target = `${FileSystem.cacheDirectory}bao-gia-${q.code}.pdf`;
        const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${q.id}/pdf`, target, { headers: authHeaders() });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Dự toán / Báo giá ${q.code}` });
        } else {
          router.push({ pathname: '/quote', params: { id: q.id } });
        }
      }
    } catch (e) {
      router.push({ pathname: '/quote', params: { id: quotationCode } });
    }
  };

  const handleOrderFromProjectQuotation = async () => {
    if (!project || !quotationCode) return;
    try {
      await api.post(`/projects/${project.id}/create-order-draft`, {});
      router.push({ pathname: '/orders', params: {
        projectId: project.id, projectCode: project.code, projectName: name,
        customerName, customerPhone, deliveryAddress: address, quotationCode: quotationId || quotationCode,
      } } as never);
    } catch (e) {
      Alert.alert('Chưa thể bóc tách', e instanceof Error ? e.message : 'Không thể tạo bản nháp đặt nhôm từ công trình này.');
    }
  };

  const exportFinancialPdf = async () => {
    if (!project || !id) return;
    if (project.id.startsWith('local-')) {
      Alert.alert('Chưa đồng bộ', 'Công trình cần được đồng bộ lên hệ thống trước khi xuất báo cáo thu chi.');
      return;
    }
    setExportingFinancialPdf(true);
    try {
      const url = `${API_URL}/workshop/v2/projects/${project.id}/financial-pdf`;
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: authHeaders() });
        if (!response.ok) throw new Error('Không thể tải báo cáo thu chi.');
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `tong-hop-thu-chi-${project.code}.pdf`;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const target = `${FileSystem.cacheDirectory}tong-hop-thu-chi-${project.code}.pdf`;
        const { uri } = await FileSystem.downloadAsync(url, target, { headers: authHeaders() });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Tổng hợp thu chi ${project.code}` });
        } else {
          Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
        }
      }
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không xuất được báo cáo thu chi.');
    } finally {
      setExportingFinancialPdf(false);
    }
  };

  const exportAcceptancePdf = async () => {
    if (!project || project.id.startsWith('local-')) {
      Alert.alert('Chưa đồng bộ', 'Hãy lưu và đồng bộ công trình trước khi xuất biên bản nghiệm thu.');
      return;
    }
    setExportingAcceptancePdf(true);
    try {
      const url = `${API_URL}/workshop/v2/projects/${project.id}/acceptance-pdf`;
      if (Platform.OS === 'web') {
        const response = await fetch(url, { headers: authHeaders() });
        if (!response.ok) throw new Error('Không thể tải biên bản nghiệm thu.');
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `bien-ban-nghiem-thu-${project.code}.pdf`;
        anchor.click();
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const target = `${FileSystem.cacheDirectory}bien-ban-nghiem-thu-${project.code}.pdf`;
        const { uri } = await FileSystem.downloadAsync(url, target, { headers: authHeaders() });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Biên bản nghiệm thu ${project.code}` });
        else Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không xuất được biên bản nghiệm thu.');
    } finally {
      setExportingAcceptancePdf(false);
    }
  };

  const completeProject = () => {
    if (!project || project.id.startsWith('local-')) {
      Alert.alert('Chưa đồng bộ', 'Công trình cần đồng bộ lên hệ thống trước khi hoàn thành.');
      return;
    }
    confirmAction('Hoàn thành công trình', 'Xác nhận hoàn thành và ghi nhận giá trị quyết toán vào doanh thu?', async () => {
      setCompleting(true);
      try {
        await handleSave();
        await api.post(`/workshop/v2/projects/${project.id}/complete`, { settledValue: num(finalAmount) || num(estimatedAmount) });
        await load();
        Alert.alert('Đã hoàn thành', 'Doanh thu công trình đã được ghi nhận vào tổng hợp.');
      } catch (error) {
        Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể hoàn thành công trình.');
      } finally {
        setCompleting(false);
      }
    }, 'Hoàn thành');
  };

  const openCashModal = (type: 'RECEIPT' | 'PAYMENT') => {
    setCashType(type);
    setCashAmount('');
    setCashCategory(type === 'RECEIPT' ? 'Thu khách hàng' : 'Mua nhôm');
    setCashMethod('CASH');
    setCashNote('');
    setCashModalOpen(true);
  };

  const saveCashTransaction = async () => {
    if (!project || project.id.startsWith('local-')) {
      Alert.alert('Chưa đồng bộ', 'Hãy đồng bộ công trình trước khi ghi nhận thu chi.');
      return;
    }
    if (num(cashAmount) <= 0) {
      Alert.alert('Thiếu số tiền', 'Vui lòng nhập số tiền lớn hơn 0.');
      return;
    }
    setSavingCash(true);
    try {
      await api.post(`/workshop/v2/projects/${project.id}/cash-transactions`, {
        type: cashType,
        amount: num(cashAmount),
        category: cashCategory,
        method: cashMethod,
        note: cashNote,
      });
      const list = await api.get<ProjectCashTransaction[]>(`/workshop/v2/projects/${project.id}/cash-transactions`);
      setCashTransactions(list);
      setCashModalOpen(false);
    } catch (error) {
      Alert.alert('Không thể ghi nhận', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingCash(false);
    }
  };

  const removeCashTransaction = (item: ProjectCashTransaction) => {
    if (!project) return;
    confirmAction('Xoá giao dịch', `Xoá ${item.code} trị giá ${item.amount.toLocaleString('vi-VN')} đ?`, async () => {
      try {
        await api.delete(`/workshop/v2/projects/${project.id}/cash-transactions/${item.id}`);
        setCashTransactions(current => current.filter(transaction => transaction.id !== item.id));
      } catch (error) {
        Alert.alert('Không thể xoá', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      }
    });
  };

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Giới hạn', 'Tối đa 5 ảnh công trình');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setImages(prev => [...prev, res.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  async function handleSave() {
    if (!id) return;
    const est = num(estimatedAmount);
    const inc = num(additionalCosts);
    const finalVal = incurredType === 'INCREASE' ? est + inc : est - inc;
    const profit = calculatedProfit;

    await LocalProjectsApi.update(id, {
      name: name || 'Công trình mới',
      address,
      customerName,
      customerPhone,
      projectType,
      isContractSigned,
      categories,
      estimatedAmount: est,
      additionalCosts: inc,
      incurredType,
      finalAmount: finalVal,
      expectedProfit: profit,
      quotationCode,
      quotationId,
      images,
      status: project?.status === 'DONE' ? 'DONE' : isContractSigned ? 'IN_PROGRESS' : 'OPEN',
      costAluminum: num(costAluminum),
      costAccessory: num(costAccessory),
      costGlass: num(costGlass),
      costLabor: num(costLabor),
      costTransport: num(costTransport),
      costInstallation: num(costInstallation),
      costOther: num(costOther),
      extraRevenue: num(extraRevenue),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const status = (project?.status ?? 'OPEN') as LocalProject['status'];
  const statusInfo = PROJECT_STATUS[status] ?? PROJECT_STATUS.OPEN;
  const contractTotal = num(finalAmount) || num(estimatedAmount);
  const remaining = status === 'OPEN' || status === 'CANCELLED' ? 0 : Math.max(0, contractTotal - actualReceipt);
  const steps: { key: LocalProject['status']; label: string }[] = [
    { key: 'OPEN', label: 'Báo giá' },
    { key: 'IN_PROGRESS', label: 'Đang thi công' },
    { key: 'DONE', label: 'Hoàn tất' },
  ];
  const stepIndex = status === 'DONE' ? 2 : status === 'IN_PROGRESS' ? 1 : 0;
  const metaLine = [customerName, customerPhone, address].filter(Boolean).join(' · ');
  const updatedDays = project ? Math.floor((Date.now() - project.updatedAt) / 86_400_000) : 0;
  const updatedText = updatedDays <= 0 ? 'Hôm nay' : updatedDays === 1 ? 'Hôm qua' : `${updatedDays} ngày trước`;

  const goQuotation = () => {
    if (quotationCode) void handlePreviewQuotation();
    else router.push('/quote');
  };
  const goOrder = () => {
    if (quotationCode) { void handleOrderFromProjectQuotation(); return; }
    router.push({ pathname: '/orders', params: { projectId: project?.id, projectCode: project?.code, projectName: name, customerName, customerPhone, deliveryAddress: address } } as never);
  };

  async function saveAndClose() {
    await handleSave();
    await load();
    setMode('view');
  }

  const infoRows: [string, string][] = [
    ['Loại công trình', projectType || 'Chưa chọn'],
    ['Hạng mục', categories.length ? categories.join(' · ') : 'Chưa chọn'],
    ['Hợp đồng', isContractSigned ? 'Đã ký' : 'Chưa ký'],
    ['Dự toán ban đầu', `${num(estimatedAmount).toLocaleString('vi-VN')} đ`],
    ['Phát sinh', `${incurredType === 'DECREASE' ? '−' : '+'}${num(additionalCosts).toLocaleString('vi-VN')} đ`],
    ['Giá trị quyết toán', `${num(finalAmount).toLocaleString('vi-VN')} đ`],
    ['Thu bổ sung', `${num(extraRevenue).toLocaleString('vi-VN')} đ`],
    ['Cập nhật', updatedText],
  ];

  const quickActions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'file-text', label: quotationCode ? 'Báo giá' : 'Lập báo giá', onPress: goQuotation },
    { icon: 'package', label: 'Đặt nhôm', onPress: goOrder },
    { icon: 'dollar-sign', label: 'Thu chi', onPress: () => setActiveTab('costs') },
    { icon: 'download', label: 'Xuất PDF', onPress: () => setActiveTab('files') },
  ];
  const documents: { icon: IconName; label: string; onPress: () => Promise<void> | void }[] = [
    { icon: 'clipboard', label: exportingAcceptancePdf ? 'Đang tạo biên bản...' : 'Biên bản nghiệm thu', onPress: exportAcceptancePdf },
    { icon: 'bar-chart-2', label: exportingFinancialPdf ? 'Đang tạo báo cáo...' : 'Bảng tổng hợp thu chi', onPress: exportFinancialPdf },
    ...(quotationCode ? [{ icon: 'file-text' as IconName, label: `Báo giá / dự toán ${quotationCode}`, onPress: handlePreviewQuotation }] : []),
  ];
  const tabs: { key: 'overview' | 'costs' | 'files'; label: string }[] = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'costs', label: `Thu chi (${cashTransactions.length})` },
    { key: 'files', label: `Hồ sơ (${images.length})` },
  ];
  const isNewDraft = project?.name === 'Công trình mới' && !project?.customerName;

  return (
    <View style={{ flex: 1, backgroundColor: '#F6F7F9' }}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" onPress={() => (mode === 'edit' && !isNewDraft ? setMode('view') : router.back())} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.brandOrangeText} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{mode === 'edit' ? 'Sửa công trình' : project?.code ?? 'Chi tiết công trình'}</Text>
        {mode === 'view' ? (
          <Pressable accessibilityRole="button" onPress={() => setMode('edit')} style={styles.editBtn}><Icon name="edit-2" size={15} color="#1D2939" /><Text style={styles.editBtnText}>Sửa</Text></Pressable>
        ) : null}
        <Pressable accessibilityLabel="Xoá công trình" onPress={handleDelete} style={[styles.backBtn, { backgroundColor: '#FEF3F2' }]}>
          <Icon name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {mode === 'edit' ? (
          <>
        <Text style={[styles.sectionTitle, styles.detailsSectionTitle]}>Thông tin chung</Text>
        <View style={styles.infoPanel}>
          <View style={styles.compactField}>
            <Text style={styles.fieldLabel}>Tên công trình</Text>
            <TextInput value={name} onChangeText={setName} style={styles.compactInput} placeholder="Tên công trình" placeholderTextColor="#94a3b8" />
          </View>
          <View style={styles.fieldPair}>
            <View style={[styles.compactField, styles.fieldPairItem]}>
              <Text style={styles.fieldLabel}>Tên khách hàng</Text>
              <TextInput value={customerName} onChangeText={setCustomerName} style={styles.compactInput} placeholder="Tên khách hàng" placeholderTextColor="#94a3b8" />
            </View>
            <View style={[styles.compactField, styles.fieldPairItem]}>
              <Text style={styles.fieldLabel}>Số điện thoại</Text>
              <TextInput value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={styles.compactInput} placeholder="Số điện thoại" placeholderTextColor="#94a3b8" />
            </View>
          </View>
          <View style={[styles.compactField, styles.compactFieldLast]}>
            <Text style={styles.fieldLabel}>Địa chỉ thi công</Text>
            <TextInput value={address} onChangeText={setAddress} style={styles.compactInput} placeholder="Địa chỉ công trình" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <Text style={[styles.sectionTitle, styles.compactSectionTitle]}>Thể loại công trình</Text>
        <View style={styles.projectTypeGrid}>
          {PROJECT_TYPES.map(pt => (
            <Pressable key={pt} onPress={() => setProjectType(pt)} style={[styles.projectTypeChip, projectType === pt && styles.chipActive]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.projectTypeText, projectType === pt && styles.chipTextActive]}>{pt}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Hạng mục thi công</Text>
        <View style={styles.tagsGrid}>
          {CATEGORIES.map(cat => {
            const active = categories.includes(cat);
            return (
              <Pressable key={cat} onPress={() => toggleCategory(cat)} style={[styles.tag, active && styles.tagActive]}>
                <Text style={[styles.tagText, active && styles.tagTextActive]}>{cat}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Đã ký hợp đồng</Text>
            <Text style={styles.switchDesc}>Xác nhận chốt để bắt đầu thi công</Text>
          </View>
          <Switch value={isContractSigned} onValueChange={setIsContractSigned} trackColor={{ true: colors.brandOrange, false: '#EEF0F3' }} />
        </View>

        <View style={styles.financialHeader}>
          <Text style={styles.sectionTitle}>Tài chính (VNĐ)</Text>
          <Pressable style={styles.importBtn} onPress={openQuotationModal}>
            <Icon name="download" size={14} color={colors.brandOrangeText} />
            <Text style={styles.importBtnText}>Import từ báo giá</Text>
          </Pressable>
        </View>

        {quotationCode ? (
          <View style={{ gap: 8, marginBottom: 12 }}>
            <Pressable style={styles.quoteLinkedBanner} onPress={handlePreviewQuotation}>
              <Icon name="file-text" size={16} color={colors.brandOrangeText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteLinkedText}>
                  Liên kết báo giá: <Text style={{ fontWeight: '900', textDecorationLine: 'underline' }}>{quotationCode}</Text>
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.brandOrangeText, fontWeight: '800' }}>Xem dự toán ›</Text>
            </Pressable>

            <Pressable
              style={{ backgroundColor: colors.brandOrange, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={handleOrderFromProjectQuotation}
            >
              <Icon name="truck" size={16} color={colors.brandBlack.main} />
              <Text style={{ color: colors.brandBlack.main, fontWeight: '900', fontSize: 13 }}>ĐẶT NHÔM GỬI NPP CHO CÔNG TRÌNH NÀY</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Dự toán ban đầu (Từ báo giá)</Text>
          <VndMoneyInput value={estimatedAmount} onChangeText={handleEstimatedAmountChange} />
        </View>

        {/* PHÁT SINH VỚI TÍNH NĂNG TICK TĂNG / GIẢM */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Giá trị phát sinh</Text>
          <View style={styles.typeRadioGroup}>
            <Pressable style={[styles.radioBtn, incurredType === 'INCREASE' && styles.radioBtnActive]} onPress={() => handleIncurredTypeChange('INCREASE')}>
              <View style={[styles.radioDot, incurredType === 'INCREASE' && styles.radioDotActive]} />
              <Text style={[styles.radioText, incurredType === 'INCREASE' && styles.radioTextActive]}>+ Phát sinh TĂNG</Text>
            </Pressable>
            <Pressable style={[styles.radioBtn, incurredType === 'DECREASE' && styles.radioBtnActive]} onPress={() => handleIncurredTypeChange('DECREASE')}>
              <View style={[styles.radioDot, incurredType === 'DECREASE' && styles.radioDotActive]} />
              <Text style={[styles.radioText, incurredType === 'DECREASE' && styles.radioTextActive]}>- Phát sinh GIẢM</Text>
            </Pressable>
          </View>
          <VndMoneyInput value={additionalCosts} onChangeText={handleAdditionalCostsChange} placeholder="Nhập số tiền phát sinh" />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Giá trị quyết toán (Tự động hoặc tự nhập)</Text>
          <VndMoneyInput value={finalAmount} onChangeText={setFinalAmount} accent />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Thu bổ sung / phát sinh tăng</Text>
          <VndMoneyInput value={extraRevenue} onChangeText={setExtraRevenue} />
        </View>

        {/* ẢNH CÔNG TRÌNH (TỐI ĐA 5 ẢNH) */}
        <Text style={styles.sectionTitle}>Ảnh công trình ({images.length}/5)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {images.length < 5 && (
            <Pressable style={styles.addImageBtn} onPress={pickImage}>
              <Icon name="camera" size={24} color={colors.brandGrey[500]} />
              <Text style={styles.addImageText}>Thêm ảnh</Text>
            </Pressable>
          )}
          {images.map((img, idx) => (
            <View key={idx} style={styles.imgWrapper}>
              <Image source={{ uri: img }} style={styles.previewImage} />
              <Pressable style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                <Icon name="x" size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
        </ScrollView>


            <Pressable style={styles.saveBtn} onPress={() => void saveAndClose()}>
              <Text style={styles.saveText}>{saved ? '✓ Đã lưu thành công' : 'Lưu công trình'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryName}>{name || 'Công trình chưa đặt tên'}</Text>
              {metaLine ? <Text style={styles.summaryMeta}>{metaLine}</Text> : null}
              {status === 'CANCELLED' ? (
                <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}><Text style={[styles.statusPillText, { color: statusInfo.text }]}>{statusInfo.label}</Text></View>
              ) : (
                <View style={styles.steps}>
                  {steps.map((step, index) => (
                    <View key={step.key} style={styles.step}>
                      <View style={[styles.stepBar, index <= stepIndex && styles.stepBarDone]} />
                      <Text style={[styles.stepText, index === stepIndex && styles.stepTextNow, index < stepIndex && styles.stepTextDone]}>{step.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.moneyGrid}>
              <View style={styles.moneyCell}><Text style={styles.moneyLabel}>Giá trị hợp đồng</Text><Text style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit>{contractTotal.toLocaleString('vi-VN')} đ</Text></View>
              <View style={styles.moneyCell}><Text style={styles.moneyLabel}>Đã thu</Text><Text style={[styles.moneyValue, { color: '#067647' }]} numberOfLines={1} adjustsFontSizeToFit>{actualReceipt.toLocaleString('vi-VN')} đ</Text></View>
              <View style={styles.moneyCell}><Text style={styles.moneyLabel}>Còn phải thu</Text><Text style={[styles.moneyValue, remaining > 0 && { color: '#B54708' }]} numberOfLines={1} adjustsFontSizeToFit>{remaining.toLocaleString('vi-VN')} đ</Text></View>
              <View style={styles.moneyCell}><Text style={styles.moneyLabel}>Lợi nhuận tạm tính</Text><Text style={[styles.moneyValue, calculatedProfit < 0 && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{calculatedProfit.toLocaleString('vi-VN')} đ</Text></View>
            </View>

            <View style={styles.quickActions}>
              {quickActions.map((action) => (
                <Pressable key={action.label} accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => [styles.quickAction, pressed && { opacity: 0.8 }]}>
                  <View style={styles.quickIcon}><Icon name={action.icon} size={18} color={colors.brandOrangeText} /></View>
                  <Text style={styles.quickText} numberOfLines={1}>{action.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.viewTabs}>
              {tabs.map((tab) => (
                <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }} onPress={() => setActiveTab(tab.key)} style={[styles.viewTab, activeTab === tab.key && styles.viewTabActive]}>
                  <Text style={[styles.viewTabText, activeTab === tab.key && styles.viewTabTextActive]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'overview' ? (
              <>
                <View style={styles.infoList}>
                  {infoRows.map(([label, value], index) => (
                    <View key={label} style={[styles.infoRow, index === infoRows.length - 1 && !quotationCode && { borderBottomWidth: 0 }]}>
                      <Text style={styles.infoLabel}>{label}</Text>
                      <Text style={styles.infoValue}>{value}</Text>
                    </View>
                  ))}
                  {quotationCode ? (
                    <Pressable style={[styles.infoRow, { borderBottomWidth: 0 }]} onPress={() => void handlePreviewQuotation()}>
                      <Text style={styles.infoLabel}>Báo giá liên kết</Text>
                      <Text style={[styles.infoValue, { color: colors.brandOrangeText }]}>{quotationCode} ›</Text>
                    </Pressable>
                  ) : null}
                </View>
                {status !== 'DONE' && status !== 'CANCELLED' ? (
                  <Pressable style={[styles.completeBtn, completing && { opacity: 0.6 }]} disabled={completing} onPress={completeProject}>
                    <Icon name="check-circle" size={18} color={colors.white} />
                    <Text style={styles.completeText}>{completing ? 'Đang hoàn thành...' : 'Đánh dấu hoàn thành công trình'}</Text>
                  </Pressable>
                ) : null}
              </>
            ) : activeTab === 'costs' ? (
              <>
            <View style={styles.costTabHeader}>
              <View style={styles.costTabIcon}><Icon name="bar-chart-2" size={20} color={colors.brandOrangeText} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 3 }]}>Chi phí công trình</Text>
                <Text style={styles.sectionHelp}>Tổng chi phí được lấy trực tiếp từ các phiếu chi bên dưới.</Text>
              </View>
            </View>

            <View style={styles.financialSummary}>
              <View><Text style={styles.summaryLabel}>Tổng chi thực tế</Text><Text style={styles.summaryValue}>{totalExpense.toLocaleString('vi-VN')} đ</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.summaryLabel}>Lợi nhuận tạm tính</Text><Text style={[styles.summaryValue, { color: calculatedProfit >= 0 ? colors.success : colors.danger }]}>{calculatedProfit.toLocaleString('vi-VN')} đ</Text></View>
            </View>
            {actualPayment === 0 && legacyExpense > 0 ? (
              <View style={styles.legacyCostNotice}><Icon name="info" size={16} color="#B45309" /><Text style={styles.legacyCostText}>Đang hiển thị {legacyExpense.toLocaleString('vi-VN')} đ từ dữ liệu chi phí cũ. Khi tạo phiếu chi đầu tiên, hệ thống sẽ chuyển sang tổng hợp theo giao dịch thực tế.</Text></View>
            ) : null}

            <View style={styles.cashTotals}>
              <View><Text style={styles.cashTotalLabel}>Đã thu</Text><Text style={[styles.cashTotalValue, { color: colors.success }]}>{actualReceipt.toLocaleString('vi-VN')} đ</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.cashTotalLabel}>Đã chi</Text><Text style={[styles.cashTotalValue, { color: colors.danger }]}>{actualPayment.toLocaleString('vi-VN')} đ</Text></View>
            </View>

            {expenseByCategory.length ? (
              <View style={styles.costBreakdown}>
                <Text style={styles.costBreakdownTitle}>Chi phí theo khoản mục</Text>
                {expenseByCategory.map(([category, amount]) => (
                  <View key={category} style={styles.costBreakdownRow}><Text style={styles.costBreakdownLabel}>{category}</Text><Text style={styles.costBreakdownValue}>{amount.toLocaleString('vi-VN')} đ</Text></View>
                ))}
              </View>
            ) : null}

            <View style={styles.cashHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 4 }]}>Phiếu thu chi</Text>
                <Text style={styles.sectionHelp}>Mỗi phiếu chi cập nhật ngay tổng chi phí và lợi nhuận công trình.</Text>
              </View>
              <View style={styles.cashActions}>
                <Pressable style={[styles.cashAddBtn, styles.cashReceiptBtn]} onPress={() => openCashModal('RECEIPT')}>
                  <Icon name="plus" size={15} color={colors.success} /><Text style={[styles.cashAddText, { color: colors.success }]}>Thu</Text>
                </Pressable>
                <Pressable style={[styles.cashAddBtn, styles.cashPaymentBtn]} onPress={() => openCashModal('PAYMENT')}>
                  <Icon name="minus" size={15} color={colors.danger} /><Text style={[styles.cashAddText, { color: colors.danger }]}>Chi</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.cashList}>
              {cashTransactions.length === 0 ? (
                <Text style={styles.cashEmpty}>Chưa có giao dịch thực tế cho công trình này.</Text>
              ) : cashTransactions.map(item => (
                <View key={item.id} style={styles.cashItem}>
                  <View style={[styles.cashIcon, { backgroundColor: item.type === 'RECEIPT' ? '#EAFBF1' : '#FFF1F2' }]}>
                    <Icon name={item.type === 'RECEIPT' ? 'arrow-down-circle' : 'arrow-up-circle'} size={18} color={item.type === 'RECEIPT' ? colors.success : colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cashItemTitle}>{item.category || (item.type === 'RECEIPT' ? 'Khoản thu' : 'Khoản chi')}</Text>
                    <Text style={styles.cashItemMeta}>{item.code} · {item.method === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}{item.note ? ` · ${item.note}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 5 }}>
                    <Text style={[styles.cashItemAmount, { color: item.type === 'RECEIPT' ? colors.success : colors.danger }]}>{item.type === 'RECEIPT' ? '+' : '-'}{item.amount.toLocaleString('vi-VN')} đ</Text>
                    <Pressable accessibilityLabel={`Xoá ${item.code}`} onPress={() => removeCashTransaction(item)} style={styles.cashDeleteBtn}>
                      <Icon name="trash-2" size={14} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <Pressable style={[styles.financialPdfButton, exportingFinancialPdf && { opacity: 0.6 }]} disabled={exportingFinancialPdf} onPress={exportFinancialPdf}>
              <Icon name="file-text" size={18} color={colors.brandBlack.main} />
              <Text style={styles.financialPdfButtonText}>{exportingFinancialPdf ? 'Đang tạo báo cáo...' : 'Xuất bảng tổng hợp thu chi PDF'}</Text>
            </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Ảnh công trình ({images.length}/5)</Text>
                {images.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
                    {images.map((img, idx) => <Image key={idx} source={{ uri: img }} style={styles.previewImage} />)}
                  </ScrollView>
                ) : (
                  <Pressable style={styles.filesEmpty} onPress={() => setMode('edit')}>
                    <Icon name="camera" size={20} color={colors.brandGrey[500]} />
                    <Text style={styles.filesEmptyText}>Chưa có ảnh. Bấm để thêm ảnh trong phần Sửa.</Text>
                  </Pressable>
                )}
                <Text style={styles.sectionTitle}>Xuất tài liệu</Text>
                <View style={styles.infoList}>
                  {documents.map((doc, index) => (
                    <Pressable key={doc.icon + index} onPress={() => void doc.onPress()} style={[styles.docRow, index === documents.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={styles.quickIcon}><Icon name={doc.icon} size={17} color={colors.brandOrangeText} /></View>
                      <Text style={styles.docText}>{doc.label}</Text>
                      <Icon name="download" size={17} color="#667085" />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL IMPORT BÁO GIÁ */}
      <Modal visible={quoteModalOpen} transparent animationType="slide" onRequestClose={() => setQuoteModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn báo giá để Import</Text>
              <Pressable onPress={() => setQuoteModalOpen(false)} style={styles.closeBtn}>
                <Icon name="x" size={20} color={colors.brandBlack.main} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {loadingQuotes ? (
                <Text style={{ textAlign: 'center', padding: 20, color: colors.brandGrey[500] }}>Đang tải báo giá...</Text>
              ) : quotesList.length === 0 ? (
                <Text style={{ textAlign: 'center', padding: 20, color: colors.brandGrey[500] }}>Không có báo giá nào khả dụng</Text>
              ) : (
                quotesList.map(q => (
                  <Pressable key={q.id} style={styles.quoteItem} onPress={() => selectQuotation(q)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.quoteCode}>{q.code}</Text>
                      <Text style={styles.quoteCustomer}>{q.customerName || 'Khách lẻ'} • {q.customerPhone || 'N/A'}</Text>
                    </View>
                    <Text style={styles.quoteAmount}>{(q.totalAmount || 0).toLocaleString('vi-VN')} đ</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={cashModalOpen} transparent animationType="slide" onRequestClose={() => setCashModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{cashType === 'RECEIPT' ? 'Ghi nhận khoản thu' : 'Ghi nhận khoản chi'}</Text>
              <Pressable onPress={() => setCashModalOpen(false)} style={styles.closeBtn}><Icon name="x" size={20} color={colors.brandBlack.main} /></Pressable>
            </View>
            <Text style={styles.fieldLabel}>Số tiền</Text>
            <VndMoneyInput value={cashAmount} onChangeText={setCashAmount} placeholder="Nhập số tiền" />
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Nội dung</Text>
            {cashType === 'RECEIPT' ? (
              <TextInput value={cashCategory} onChangeText={setCashCategory} style={styles.input} placeholder="Ví dụ: Thu tạm ứng" placeholderTextColor="#94a3b8" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cashCategoryRow}>
                {PAYMENT_CATEGORIES.map(category => (
                  <Pressable key={category} onPress={() => setCashCategory(category)} style={[styles.cashCategoryChip, cashCategory === category && styles.cashCategoryChipActive]}>
                    <Text style={[styles.cashCategoryText, cashCategory === category && styles.cashCategoryTextActive]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Phương thức</Text>
            <View style={styles.methodRow}>
              <Pressable onPress={() => setCashMethod('CASH')} style={[styles.methodBtn, cashMethod === 'CASH' && styles.methodBtnActive]}><Text style={[styles.methodText, cashMethod === 'CASH' && styles.methodTextActive]}>Tiền mặt</Text></Pressable>
              <Pressable onPress={() => setCashMethod('BANK_TRANSFER')} style={[styles.methodBtn, cashMethod === 'BANK_TRANSFER' && styles.methodBtnActive]}><Text style={[styles.methodText, cashMethod === 'BANK_TRANSFER' && styles.methodTextActive]}>Chuyển khoản</Text></Pressable>
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Ghi chú</Text>
            <TextInput value={cashNote} onChangeText={setCashNote} style={styles.input} placeholder="Số chứng từ hoặc ghi chú" placeholderTextColor="#94a3b8" />
            <Pressable disabled={savingCash} onPress={saveCashTransaction} style={[styles.cashSaveBtn, savingCash && { opacity: 0.6 }]}>
              <Icon name="save" size={17} color={colors.brandBlack.main} /><Text style={styles.cashSaveText}>{savingCash ? 'Đang lưu...' : 'Lưu giao dịch'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  editBtn: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: colors.white },
  editBtnText: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  summaryCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E4E7EC', padding: 14 },
  summaryName: { color: '#101828', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  summaryMeta: { color: '#667085', fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  statusPill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, height: 24, borderRadius: 999, justifyContent: 'center' },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  steps: { flexDirection: 'row', gap: 6, marginTop: 12 },
  step: { flex: 1, minWidth: 0 },
  stepBar: { height: 4, borderRadius: 4, backgroundColor: '#EEF0F3' },
  stepBarDone: { backgroundColor: colors.brandOrange },
  stepText: { color: '#98A2B3', fontSize: 11, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  stepTextNow: { color: colors.brandOrangeText },
  stepTextDone: { color: '#1D2939' },
  moneyGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#E4E7EC', gap: 1, borderRadius: 18, borderWidth: 1, borderColor: '#E4E7EC', overflow: 'hidden' },
  moneyCell: { width: '49.8%', flexGrow: 1, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 11 },
  moneyLabel: { color: '#667085', fontSize: 11, fontWeight: '700' },
  moneyValue: { color: '#101828', fontSize: 16, fontWeight: '900', marginTop: 2 },
  quickActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: colors.white },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2E8' },
  quickText: { color: '#1D2939', fontSize: 11.5, fontWeight: '800' },
  viewTabs: { marginTop: 16, flexDirection: 'row', gap: 18, borderBottomWidth: 1, borderBottomColor: '#E4E7EC', paddingHorizontal: 4 },
  viewTab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  viewTabActive: { borderBottomColor: colors.brandOrange },
  viewTabText: { color: '#667085', fontSize: 13.5, fontWeight: '800' },
  viewTabTextActive: { color: '#101828' },
  infoList: { marginTop: 10, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E4E7EC', paddingHorizontal: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  infoLabel: { color: '#667085', fontSize: 13 },
  infoValue: { flexShrink: 1, color: '#101828', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  docText: { flex: 1, color: '#1D2939', fontSize: 13.5, fontWeight: '800' },
  filesEmpty: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD', backgroundColor: colors.white },
  filesEmptyText: { flex: 1, color: '#667085', fontSize: 12.5 },
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.orangeSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(217, 92, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 150 },
  statusCard: { minHeight: 68, padding: 14, borderRadius: 14, backgroundColor: colors.orangeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusEyebrow: { color: colors.brandOrangeText, fontSize: 10, fontWeight: '900' },
  statusText: { color: colors.brandBlack.main, fontSize: 17, fontWeight: '900', marginTop: 4 },
  projectTabs: { minHeight: 48, flexDirection: 'row', padding: 4, marginTop: 12, borderRadius: 12, backgroundColor: '#EEF0F3' },
  projectTab: { flex: 1, minHeight: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  projectTabActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC' },
  projectTabText: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '800' },
  projectTabTextActive: { color: colors.brandOrangeText, fontWeight: '900' },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 16, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  financialHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  importBtnText: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '800' },
  quoteLinkedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8F0', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.orangeSoft },
  quoteLinkedText: { color: colors.brandOrangeText, fontSize: 13 },
  financialPdfButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: colors.brandOrange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2, marginBottom: 8 },
  financialPdfButtonText: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '900' },
  sectionHelp: { color: colors.brandGrey[500], fontSize: 12, lineHeight: 18, marginTop: -5, marginBottom: 12 },
  costTabHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20, marginBottom: 12 },
  costTabIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  legacyCostNotice: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 11, marginBottom: 12, backgroundColor: '#FFFAEB', borderWidth: 1, borderColor: '#FEDF89' },
  legacyCostText: { flex: 1, color: '#92400E', fontSize: 10, lineHeight: 15 },
  costBreakdown: { borderRadius: 14, borderWidth: 1, borderColor: '#E7E9ED', backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 5, marginBottom: 12 },
  costBreakdownTitle: { color: colors.brandBlack.main, fontSize: 12, fontWeight: '900', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  costBreakdownRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  costBreakdownLabel: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '700' },
  costBreakdownValue: { color: colors.brandBlack.main, fontSize: 12, fontWeight: '900' },
  financialSummary: { backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: '#FED7AA', borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '700' },
  summaryValue: { color: colors.brandBlack.main, fontSize: 16, fontWeight: '900', marginTop: 5 },
  cashHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  cashActions: { flexDirection: 'row', gap: 6 },
  cashAddBtn: { minHeight: 38, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cashReceiptBtn: { backgroundColor: '#EAFBF1', borderColor: '#B7E8C8' },
  cashPaymentBtn: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  cashAddText: { fontSize: 12, fontWeight: '900' },
  cashTotals: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 13, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cashTotalLabel: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '700' },
  cashTotalValue: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  cashList: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  cashEmpty: { color: colors.brandGrey[500], fontSize: 12, textAlign: 'center', padding: 18 },
  cashItem: { minHeight: 66, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  cashIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cashItemTitle: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '900' },
  cashItemMeta: { color: colors.brandGrey[500], fontSize: 10, marginTop: 3 },
  cashItemAmount: { fontSize: 12, fontWeight: '900' },
  cashDeleteBtn: { width: 28, height: 24, borderRadius: 7, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  cashCategoryRow: { gap: 7, paddingVertical: 2 },
  cashCategoryChip: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3' },
  cashCategoryChipActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  cashCategoryText: { color: colors.brandGrey[500], fontSize: 12, fontWeight: '700' },
  cashCategoryTextActive: { color: colors.brandOrangeText, fontWeight: '900' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  methodBtnActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  methodText: { color: colors.brandGrey[500], fontWeight: '800' },
  methodTextActive: { color: colors.brandOrangeText },
  cashSaveBtn: { minHeight: 52, borderRadius: 14, backgroundColor: colors.brandOrange, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cashSaveText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  field: { marginBottom: 14 },
  fieldLabel: { color: colors.brandBlack.main, fontWeight: '700', marginBottom: 8, fontSize: 13 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 14, color: colors.brandBlack.main },
  detailsSectionTitle: { marginTop: 20, marginBottom: 10 },
  infoPanel: { backgroundColor: '#FAFAFB', borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 16, padding: 12 },
  compactField: { marginBottom: 10 },
  compactFieldLast: { marginBottom: 0 },
  fieldPair: { flexDirection: 'row', gap: 10 },
  fieldPairItem: { flex: 1, minWidth: 0 },
  compactInput: { minHeight: 44, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E7E9ED', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: colors.brandBlack.main, fontSize: 13 },
  compactSectionTitle: { marginTop: 18, marginBottom: 10 },
  projectTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  projectTypeChip: { width: '31%', minHeight: 44, paddingHorizontal: 6, borderRadius: 11, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E4E7EC', alignItems: 'center', justifyContent: 'center' },
  projectTypeText: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 12, textAlign: 'center' },
  currencyInputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 14, paddingRight: 14 },
  currencyInput: { flex: 1, minHeight: 48, paddingHorizontal: 14, color: colors.brandBlack.main, fontWeight: '700' },
  currencyInputAccent: { color: colors.brandOrangeText, fontWeight: '900' },
  currencySuffix: { color: colors.brandGrey[500], fontSize: 13, fontWeight: '800' },
  currencySuffixAccent: { color: colors.brandOrangeText },
  typeRadioGroup: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3' },
  radioBtnActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  radioDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#ccc' },
  radioDotActive: { borderColor: colors.brandOrange, backgroundColor: colors.brandOrange },
  radioText: { fontSize: 13, color: colors.brandGrey[500], fontWeight: '700' },
  radioTextActive: { color: colors.brandOrangeText, fontWeight: '800' },
  chipActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  chipTextActive: { color: colors.brandOrangeText, fontWeight: '800' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3' },
  tagActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  tagText: { color: colors.brandGrey[500], fontWeight: '700' },
  tagTextActive: { color: colors.brandOrangeText, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', padding: 16, borderRadius: 16, marginTop: 24 },
  switchTitle: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 15 },
  switchDesc: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  imageRow: { gap: 12, paddingBottom: 10 },
  addImageBtn: { width: 90, height: 90, borderRadius: 16, backgroundColor: '#F7F8FA', borderWidth: 2, borderColor: '#EEF0F3', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addImageText: { color: colors.brandGrey[500], fontSize: 12, fontWeight: '700' },
  imgWrapper: { position: 'relative' },
  previewImage: { width: 90, height: 90, borderRadius: 16 },
  removeImgBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, alignItems: 'center', marginTop: 32, marginBottom: 16 },
  saveText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 16 },
  completeBtn: { minHeight: 54, borderRadius: 999, backgroundColor: colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 },
  completeText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.brandBlack.main },
  closeBtn: { padding: 4 },
  quoteItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  quoteCode: { fontWeight: '900', color: colors.brandOrange, fontSize: 14 },
  quoteCustomer: { fontSize: 12, color: colors.brandGrey[500], marginTop: 2 },
  quoteAmount: { fontWeight: '900', color: colors.brandBlack.main, fontSize: 14 },
});
