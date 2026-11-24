import { useState, useCallback } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { assetUrl, ApiError } from '../src/lib/api';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Button, Card, Field, Input, Loading, SectionHead, SubHeader, ws, wsStyles } from '../src/components/ws';

type LogoUploadResponse = {
  url: string;
};

type WorkshopProfileResponse = {
  name?: string;
  productionName?: string;
  logoUrl?: string;
  mainCategories?: string;
  address?: string;
  phone?: string;
  email?: string;
  fanpage?: string;
};

const allowedLogoTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

function uploadFileName(asset: ImagePicker.ImagePickerAsset, mime: string) {
  if (asset.fileName) return asset.fileName;
  if (mime === 'image/png') return 'logo.png';
  if (mime === 'image/webp') return 'logo.webp';
  return 'logo.jpg';
}

async function appendLogo(formData: FormData, asset: ImagePicker.ImagePickerAsset) {
  if (Platform.OS === 'web') {
    const webFile = (asset as ImagePicker.ImagePickerAsset & { file?: File }).file;
    if (webFile) {
      const mime = webFile.type || asset.mimeType || 'image/jpeg';
      if (!allowedLogoTypes.has(mime)) throw new Error('Ảnh phải có định dạng PNG, JPEG hoặc WebP.');
      formData.append('logo', webFile, uploadFileName(asset, mime));
      return;
    }

    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Không đọc được ảnh đã chọn.');
    const blob = await response.blob();
    const mime = blob.type || asset.mimeType || 'image/jpeg';
    if (!allowedLogoTypes.has(mime)) throw new Error('Ảnh phải có định dạng PNG, JPEG hoặc WebP.');
    formData.append('logo', blob, uploadFileName(asset, mime));
    return;
  }

  const mime = asset.mimeType || 'image/jpeg';
  if (!allowedLogoTypes.has(mime)) throw new Error('Ảnh phải có định dạng PNG, JPEG hoặc WebP.');
  const nativeFile = {
    uri: asset.uri,
    name: uploadFileName(asset, mime),
    type: mime,
  } as unknown as Blob;
  formData.append('logo', nativeFile);
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    productionName: '',
    logoUrl: '',
    mainCategories: '',
    address: '',
    phone: '',
    email: '',
    fanpage: ''
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api.get<WorkshopProfileResponse>('/npp/profile').then(res => {
        if (!active) return;
        setForm({
          productionName: res.productionName || res.name || '',
          logoUrl: res.logoUrl || '',
          address: res.address || '',
          phone: res.phone || '',
          email: res.email || '',
          fanpage: res.fanpage || '',
          mainCategories: res.mainCategories || ''
        });
        setLoading(false);
      }).catch(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }, [])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/npp/profile', form);
      Alert.alert('Đã lưu', 'Hồ sơ cơ sở đã được cập nhật.');
      router.back();
    } catch {
      Alert.alert('Chưa lưu được', 'Vui lòng thử lại.');
    }
    setSaving(false);
  };

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handlePickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép Eurohouse truy cập thư viện ảnh để thay ảnh đại diện.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const formData = new FormData();
      await appendLogo(formData, result.assets[0]);
      const data = await api.upload<LogoUploadResponse>('/npp/profile/logo', formData);
      if (!data.url) throw new Error('Máy chủ chưa trả về đường dẫn ảnh.');
      update('logoUrl', data.url);
      Alert.alert('Thành công', 'Ảnh đại diện đã được tải lên và đồng bộ với hồ sơ cơ sở.');
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : 'Không thể tải ảnh lên. Vui lòng thử lại.';
      Alert.alert('Không tải được ảnh', message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Hồ sơ cơ sở" subtitle="In trên báo giá, hợp đồng và PDF" onBack={() => router.back()} />
      {loading && !form.productionName ? <Loading /> : (
        <ScrollView contentContainerStyle={[wsStyles.content, styles.contentPad]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.logoRow}>
              {form.logoUrl ? (
                <Image source={{ uri: assetUrl(form.logoUrl) || form.logoUrl }} style={styles.logo} resizeMode="contain" />
              ) : (
                <View style={[styles.logo, styles.logoEmpty]}><Icon name="image" size={22} color={ws.faint} /></View>
              )}
              <View style={wsStyles.grow}>
                <Text style={styles.logoTitle}>Logo cơ sở</Text>
                <Text style={wsStyles.rowMeta}>Ảnh vuông PNG, JPEG hoặc WebP</Text>
              </View>
              <Button label={form.logoUrl ? 'Đổi ảnh' : 'Chọn ảnh'} variant="soft" loading={loading} onPress={() => void handlePickImage()} />
            </View>
            {form.logoUrl ? <Pressable accessibilityRole="button" onPress={() => update('logoUrl', '')} style={styles.removeLogo}><Text style={styles.removeLogoText}>Gỡ logo</Text></Pressable> : null}
            <Field label="Tên cơ sở"><Input value={form.productionName} onChangeText={(t) => update('productionName', t)} placeholder="Ví dụ: Nhôm Kính Tiến Mạnh" /></Field>
            <Field label="Hạng mục thi công"><Input value={form.mainCategories} onChangeText={(t) => update('mainCategories', t)} placeholder="Thiết kế, thi công nhôm kính..." /></Field>
          </Card>

          <SectionHead title="Liên hệ" />
          <Card>
            <Field label="Số điện thoại"><Input value={form.phone} onChangeText={(t) => update('phone', t)} placeholder="09xx xxx xxx" keyboardType="phone-pad" /></Field>
            <Field label="Địa chỉ"><Input value={form.address} onChangeText={(t) => update('address', t)} placeholder="Địa chỉ cơ sở" /></Field>
            <Field label="Email"><Input value={form.email} onChangeText={(t) => update('email', t)} placeholder="lienhe@..." keyboardType="email-address" autoCapitalize="none" /></Field>
            <Field label="Fanpage / website"><Input value={form.fanpage} onChangeText={(t) => update('fanpage', t)} placeholder="facebook.com/..." autoCapitalize="none" /></Field>
          </Card>
          <Text style={wsStyles.hint}>Thông tin và logo chỉ thuộc cơ sở đang đăng nhập.</Text>
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Button label={saving ? 'Đang lưu...' : 'Lưu thay đổi'} icon="save" loading={saving} disabled={saving || loading} onPress={() => void handleSave()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentPad: { paddingBottom: 180 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#F2F4F7' },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  logoTitle: { color: ws.ink, fontSize: 13.5, fontWeight: '800' },
  removeLogo: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  removeLogoText: { color: ws.dangerText, fontSize: 12.5, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: ws.surface, borderTopWidth: 1, borderTopColor: ws.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
});
