import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Switch, Alert, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import { LocalProjectsApi, type LocalProject } from '../../src/lib/localProjects';
import { Icon } from '../../src/components/Icon';
import { api, API_URL, authHeaders } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/alert';

const PROJECT_TYPES = ['Nhà ống', 'Biệt thự', 'Dân dụng', 'Cải tạo', 'Khác'];
const CATEGORIES = ['Nhôm kính', 'Sắt thép', 'Inox', 'Mái tôn', 'Cầu thang', 'Lan can', 'Năng lượng mặt trời'];

function num(v: string): number {
  return Number(v.replace(/[^\d.-]/g, '')) || 0;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<LocalProject | null>(null);

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
  const [expectedProfit, setExpectedProfit] = useState('');
  const [quotationCode, setQuotationCode] = useState('');

  // Images
  const [images, setImages] = useState<string[]>([]);

  // Modal & state
  const [saved, setSaved] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quotesList, setQuotesList] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await LocalProjectsApi.getOne(id);
    if (!p) {
      Alert.alert('Lỗi', 'Không tìm thấy công trình này');
      router.back();
      return;
    }
    setProject(p);
    setName(p.name);
    setAddress(p.address);
    setCustomerName(p.customerName || '');
    setCustomerPhone(p.customerPhone || '');
    setProjectType(p.projectType);
    setIsContractSigned(p.isContractSigned);
    setCategories(p.categories || []);
    setEstimatedAmount(String(p.estimatedAmount || 0));
    setAdditionalCosts(String(p.additionalCosts || 0));
    setIncurredType(p.incurredType || 'INCREASE');
    setFinalAmount(String(p.finalAmount || 0));
    setExpectedProfit(String(p.expectedProfit || 0));
    setQuotationCode(p.quotationCode || '');
    setImages(p.images || []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleCategory = (cat: string) => {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleIncurredTypeChange = (type: 'INCREASE' | 'DECREASE') => {
    setIncurredType(type);
    const est = num(estimatedAmount);
    const inc = num(additionalCosts);
    const calculated = type === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(String(calculated > 0 ? calculated : 0));
  };

  const handleAdditionalCostsChange = (val: string) => {
    setAdditionalCosts(val);
    const est = num(estimatedAmount);
    const inc = num(val);
    const calculated = incurredType === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(String(calculated > 0 ? calculated : 0));
  };

  const handleEstimatedAmountChange = (val: string) => {
    setEstimatedAmount(val);
    const est = num(val);
    const inc = num(additionalCosts);
    const calculated = incurredType === 'INCREASE' ? est + inc : est - inc;
    setFinalAmount(String(calculated > 0 ? calculated : 0));
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
    setEstimatedAmount(String(total));
    setQuotationCode(q.code);
    if (q.customerName) setCustomerName(q.customerName);
    if (q.customerPhone) setCustomerPhone(q.customerPhone);
    const inc = num(additionalCosts);
    const calculated = incurredType === 'INCREASE' ? total + inc : total - inc;
    setFinalAmount(String(calculated > 0 ? calculated : 0));
    setQuoteModalOpen(false);
    Alert.alert('Đã import', `Đã lấy dữ liệu từ báo giá ${q.code} (${total.toLocaleString('vi-VN')} đ)`);
  };

  const handlePreviewQuotation = async () => {
    if (!quotationCode) return;
    try {
      const q = await api.get<any>(`/quotations/${quotationCode}`);
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
    if (!quotationCode) return;
    try {
      const q = await api.get<any>(`/quotations/${quotationCode}`);
      if (!q || !q.id) throw new Error('Không tìm thấy báo giá');
      const order = await api.post<any>('/orders/convert-from-quotation', {
        quotationId: q.id,
        note: `Đặt nhôm cho công trình ${name || project?.code}`,
        submitToNpp: true,
      });
      Alert.alert('Thành công', `Đã tạo Đơn hàng ${order.code} gửi tới NPP!`, [
        { text: 'Xem đơn hàng', onPress: () => router.push('/orders' as any) },
        { text: 'Ở lại', style: 'cancel' }
      ]);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể tạo đơn hàng từ công trình này.');
    }
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
    const profit = num(expectedProfit);

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
      images,
      status: isContractSigned ? 'IN_PROGRESS' : 'OPEN',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.brandOrangeText} /></Pressable>
        <Text style={styles.topTitle}>{project?.code ?? 'Chi tiết công trình'}</Text>
        <Pressable onPress={handleDelete} style={[styles.backBtn, { backgroundColor: '#FEE2E2' }]}>
          <Icon name="trash-2" size={18} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Thông tin chung</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tên công trình</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Tên công trình" placeholderTextColor="#94a3b8" />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Tên khách hàng</Text>
          <TextInput value={customerName} onChangeText={setCustomerName} style={styles.input} placeholder="Tên chủ nhà / Khách hàng" placeholderTextColor="#94a3b8" />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Số điện thoại khách hàng</Text>
          <TextInput value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={styles.input} placeholder="SĐT khách hàng" placeholderTextColor="#94a3b8" />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Địa chỉ thi công</Text>
          <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="Địa chỉ công trình" placeholderTextColor="#94a3b8" />
        </View>

        <Text style={styles.sectionTitle}>Thể loại công trình</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PROJECT_TYPES.map(pt => (
            <Pressable key={pt} onPress={() => setProjectType(pt)} style={[styles.chip, projectType === pt && styles.chipActive]}>
              <Text style={[styles.chipText, projectType === pt && styles.chipTextActive]}>{pt}</Text>
            </Pressable>
          ))}
        </ScrollView>

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
          <TextInput value={estimatedAmount} onChangeText={handleEstimatedAmountChange} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor="#94a3b8" />
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
          <TextInput value={additionalCosts} onChangeText={handleAdditionalCostsChange} keyboardType="numeric" style={styles.input} placeholder="Nhập số tiền phát sinh" placeholderTextColor="#94a3b8" />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Giá trị quyết toán (Tự động hoặc tự nhập)</Text>
          <TextInput value={finalAmount} onChangeText={setFinalAmount} keyboardType="numeric" style={[styles.input, { fontWeight: '900', color: colors.brandOrangeText }]} placeholder="0" placeholderTextColor="#94a3b8" />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Lợi nhuận dự kiến</Text>
          <TextInput value={expectedProfit} onChangeText={setExpectedProfit} keyboardType="numeric" style={styles.input} placeholder="0" placeholderTextColor="#94a3b8" />
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

        <Pressable style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>{saved ? '✓ Đã lưu thành công' : 'Lưu công trình'}</Text>
        </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.orangeSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(217, 92, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 150 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 16, fontWeight: '900', marginTop: 24, marginBottom: 12 },
  financialHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  importBtnText: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '800' },
  quoteLinkedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF8F0', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.orangeSoft },
  quoteLinkedText: { color: colors.brandOrangeText, fontSize: 13 },
  field: { marginBottom: 14 },
  fieldLabel: { color: colors.brandBlack.main, fontWeight: '700', marginBottom: 8, fontSize: 13 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 14, color: colors.brandBlack.main },
  typeRadioGroup: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3' },
  radioBtnActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  radioDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#ccc' },
  radioDotActive: { borderColor: colors.brandOrange, backgroundColor: colors.brandOrange },
  radioText: { fontSize: 13, color: colors.brandGrey[500], fontWeight: '700' },
  radioTextActive: { color: colors.brandOrangeText, fontWeight: '800' },
  chipRow: { gap: 10, paddingBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#EEF0F3' },
  chipActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  chipText: { color: colors.brandGrey[500], fontWeight: '700' },
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
