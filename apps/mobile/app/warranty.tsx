import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '@eurohouse/ui';
import type { ActivateWarrantyInput, ActivateWarrantyResult } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

export default function WarrantyScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [serial, setSerial] = useState('');
  const [productName, setProductName] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActivateWarrantyResult | null>(null);

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera để quét mã QR, hoặc nhập mã bằng tay.');
        return;
      }
    }
    setScanning(true);
  }

  function onScanned(data: string) {
    setScanning(false);
    setSerial(data.trim());
  }

  async function activate() {
    const code = serial.trim();
    if (!code) {
      Alert.alert('Thiếu mã', 'Vui lòng quét hoặc nhập mã sản phẩm.');
      return;
    }
    setBusy(true);
    try {
      const payload: ActivateWarrantyInput = {
        serialCode: code,
        productName: productName || undefined,
        customerName: customer || undefined,
        customerPhone: phone || undefined,
        customerAddress: address || undefined,
        projectName: project || undefined,
      };
      const res = await api.post<ActivateWarrantyResult>('/warranties/activate', payload);
      setResult(res);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không kích hoạt được bảo hành.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setSerial('');
    setProductName('');
    setCustomer('');
    setPhone('');
    setAddress('');
    setProject('');
  }

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.brandBlack.main }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScanned(data)}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanBox} />
          <Text style={styles.scanOverlayText}>Đưa mã QR vào khung</Text>
          <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
            <Text style={styles.cancelScanText}>Hủy</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.brandOrangeText} /></Pressable>
        <Text style={styles.topTitle}>Kích hoạt bảo hành</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {result ? (
          <View style={styles.resultBox}>
            <Icon name="check-circle" size={40} color={colors.success} />
            <Text style={styles.resultTitle}>Đã kích hoạt bảo hành</Text>
            <Text style={styles.resultCode}>{result.warranty.code}</Text>
            <View style={styles.resultRow}><Text style={styles.resultLabel}>Mã sản phẩm</Text><Text style={styles.resultVal}>{result.warranty.serialCode}</Text></View>
            <View style={styles.resultRow}><Text style={styles.resultLabel}>Bảo hành</Text><Text style={styles.resultVal}>{result.warranty.warrantyMonths} tháng</Text></View>
            {result.warranty.expiresAt ? (
              <View style={styles.resultRow}><Text style={styles.resultLabel}>Hết hạn</Text><Text style={styles.resultVal}>{new Date(result.warranty.expiresAt).toLocaleDateString('vi-VN')}</Text></View>
            ) : null}
            {result.pointsAwarded > 0 ? (
              <View style={styles.pointsPill}>
                <Icon name="star" size={14} color={colors.brandOrange} />
                <Text style={styles.pointsPillText}>+{result.pointsAwarded} điểm · số dư {result.pointsBalance.toLocaleString('vi-VN')}</Text>
              </View>
            ) : null}
            <Pressable style={styles.activateButton} onPress={reset}>
              <Text style={styles.activateText}>Kích hoạt mã khác</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.scanCard} onPress={openScanner}>
              <View style={styles.scanIconWrap}><Icon name="maximize" size={40} color={colors.brandOrange} /></View>
              <Text style={styles.scanCardTitle}>Quét mã QR bảo hành</Text>
              <Text style={styles.scanCardHint}>Bấm để mở camera quét mã trên sản phẩm</Text>
            </Pressable>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Thông tin kích hoạt</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Mã sản phẩm (serial/QR)</Text>
                <TextInput value={serial} onChangeText={setSerial} placeholder="Quét QR hoặc nhập tay" autoCapitalize="characters" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tên sản phẩm</Text>
                <TextInput value={productName} onChangeText={setProductName} placeholder="VD: Cửa đi 4 cánh hệ 55" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tên khách</Text>
                <TextInput value={customer} onChangeText={setCustomer} placeholder="Nhập tên khách hàng" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Số điện thoại khách</Text>
                <TextInput value={phone} onChangeText={setPhone} placeholder="Nhập số điện thoại" keyboardType="phone-pad" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Địa chỉ khách hàng</Text>
                <TextInput value={address} onChangeText={setAddress} placeholder="Nhập địa chỉ" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Công trình</Text>
                <TextInput value={project} onChangeText={setProject} placeholder="Nhập tên công trình" style={styles.input} placeholderTextColor="#94A3B8" />
              </View>
            </View>

            <Pressable style={[styles.activateButton, busy && { opacity: 0.6 }]} disabled={busy} onPress={activate}>
              <Icon name="check-circle" size={18} color={colors.brandBlack.main} />
              <Text style={styles.activateText}>{busy ? 'Đang kích hoạt...' : 'Kích hoạt & nhận điểm'}</Text>
            </Pressable>
            <View style={styles.noteRow}>
              <Icon name="star" size={13} color={colors.brandOrange} />
              <Text style={styles.note}>Mỗi lần kích hoạt bảo hành được cộng điểm tích lũy</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.orangeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(217, 92, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 110 },
  scanCard: { alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 24, paddingVertical: 28, marginBottom: 18, borderWidth: 2, borderColor: colors.orangeSoft, borderStyle: 'dashed' },
  scanIconWrap: { width: 80, height: 80, borderRadius: 28, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  scanCardTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 16 },
  scanCardHint: { color: colors.brandGrey[500], textAlign: 'center', paddingHorizontal: 30, fontSize: 13 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 20 },
  scanBox: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: colors.brandOrange },
  scanOverlayText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  cancelScan: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, marginTop: 10 },
  cancelScanText: { color: colors.brandBlack.main, fontWeight: '900' },
  panel: { backgroundColor: colors.white, borderRadius: 20, padding: 18, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  panelTitle: { color: colors.brandBlack.main, fontWeight: '900', marginBottom: 14, fontSize: 15 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.brandBlack.main, fontWeight: '700', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 14, color: colors.brandBlack.main },
  activateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, marginTop: 18 },
  activateText: { color: colors.brandBlack.main, fontWeight: '900' },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  note: { color: colors.brandGrey[500] },
  resultBox: { alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 24, padding: 24 },
  resultTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 18, marginTop: 6 },
  resultCode: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 15, marginBottom: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  resultLabel: { color: colors.brandGrey[500], fontWeight: '700' },
  resultVal: { color: colors.brandBlack.main, fontWeight: '800' },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, marginTop: 14 },
  pointsPillText: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 13 },
});
