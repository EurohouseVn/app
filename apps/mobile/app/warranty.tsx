import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { ActivateWarrantyInput, ActivateWarrantyResult } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Button, Card, Field, Input, SectionHead, SubHeader, ValueLine, ws, wsStyles } from '../src/components/ws';

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
      Alert.alert('Chưa kích hoạt được', e instanceof Error ? e.message : 'Vui lòng thử lại.');
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
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
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
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Bảo hành QR" subtitle="Kích hoạt bảo hành cho khách" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={wsStyles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {result ? (
          <>
            <Card style={styles.resultCard}>
              <View style={styles.resultIcon}><Icon name="check-circle" size={28} color={ws.success} /></View>
              <Text style={styles.resultTitle}>Đã kích hoạt bảo hành</Text>
              <Text style={styles.resultCode}>{result.warranty.code}</Text>
            </Card>
            <Card padded={false} style={styles.gapTop}>
              <ValueLine first label="Mã sản phẩm" value={result.warranty.serialCode} />
              <ValueLine label="Thời hạn" value={`${result.warranty.warrantyMonths} tháng`} />
              {result.warranty.expiresAt ? <ValueLine label="Hết hạn" value={dateText(result.warranty.expiresAt)} /> : null}
              {result.pointsAwarded > 0 ? <ValueLine label="Điểm thưởng" value={`+${result.pointsAwarded} · số dư ${result.pointsBalance.toLocaleString('vi-VN')}`} tone="success" /> : null}
            </Card>
            <View style={styles.gapTop}><Button label="Kích hoạt mã khác" icon="maximize" onPress={reset} /></View>
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" onPress={() => void openScanner()} style={({ pressed }) => [styles.scanCard, pressed && { opacity: 0.85 }]}>
              <View style={styles.scanIcon}><Icon name="maximize" size={28} color={ws.orangeText} /></View>
              <View style={wsStyles.grow}>
                <Text style={styles.scanTitle}>Quét mã QR trên sản phẩm</Text>
                <Text style={wsStyles.rowMeta}>Mở camera, hoặc nhập mã ở dưới</Text>
              </View>
              <Icon name="chevron-right" size={18} color={ws.orangeText} />
            </Pressable>

            <SectionHead title="Sản phẩm" />
            <Card>
              <Field label="Mã sản phẩm (serial/QR)"><Input value={serial} onChangeText={setSerial} placeholder="Quét QR hoặc nhập tay" autoCapitalize="characters" /></Field>
              <Field label="Tên sản phẩm"><Input value={productName} onChangeText={setProductName} placeholder="Ví dụ: Cửa đi 4 cánh hệ 55" /></Field>
              <Field label="Công trình"><Input value={project} onChangeText={setProject} placeholder="Tên công trình" /></Field>
            </Card>

            <SectionHead title="Khách hàng" />
            <Card>
              <Field label="Tên khách"><Input value={customer} onChangeText={setCustomer} placeholder="Họ tên khách hàng" /></Field>
              <Field label="Số điện thoại"><Input value={phone} onChangeText={setPhone} placeholder="09xx xxx xxx" keyboardType="phone-pad" /></Field>
              <Field label="Địa chỉ"><Input value={address} onChangeText={setAddress} placeholder="Địa chỉ lắp đặt" /></Field>
            </Card>

            <View style={styles.gapTop}><Button label={busy ? 'Đang kích hoạt...' : 'Kích hoạt bảo hành'} icon="check-circle" loading={busy} disabled={busy} onPress={() => void activate()} /></View>
            <Text style={wsStyles.hint}>Khách tra cứu bảo hành bằng mã sản phẩm. Điểm thưởng Eurohouse tích theo đơn đặt nhôm qua NPP.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function dateText(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  scanCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: ws.orangeLine, backgroundColor: ws.orangeSoft },
  scanIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: ws.surface, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: ws.ink, fontSize: 14.5, fontWeight: '900' },
  resultCard: { alignItems: 'center' },
  resultIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: ws.successBg, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: ws.ink, fontSize: 17, fontWeight: '900', marginTop: 10 },
  resultCode: { color: ws.orangeText, fontSize: 14, fontWeight: '900', marginTop: 2 },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 20 },
  scanBox: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: ws.orange },
  scanOverlayText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelScan: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, marginTop: 10 },
  cancelScanText: { color: ws.ink, fontWeight: '900' },
});
