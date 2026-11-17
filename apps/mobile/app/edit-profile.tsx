import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert, TouchableOpacity, Platform, Image } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { assetUrl, ApiError } from '../src/lib/api';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

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
      Alert.alert('Thành công', 'Lưu cấu hình thành công!');
      router.back();
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu cấu hình, vui lòng thử lại.');
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
    <View style={styles.container}>
      <AppHeader title="Hồ sơ cơ sở sản xuất" />
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.brandGrey[500] }}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.card}>
            <Text style={styles.subtitle}>Thông tin và ảnh đại diện này chỉ thuộc cơ sở đang đăng nhập, được đồng bộ trên tài khoản, báo giá, hợp đồng và báo cáo PDF.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Tên cơ sở / NPP</Text>
              <TextInput style={styles.input} value={form.productionName} onChangeText={t => update('productionName', t)} placeholder="NHÔM KÍNH TIẾN MẠNH" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ảnh đại diện / Logo cơ sở (Tùy chọn)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {form.logoUrl ? (
                  <Image source={{ uri: assetUrl(form.logoUrl) || form.logoUrl }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0' }} resizeMode="contain" />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.brandGrey[100], alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="image" size={24} color={colors.brandGrey[400]} />
                  </View>
                )}
                <TouchableOpacity onPress={handlePickImage} style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.brandGrey[100], borderRadius: 8 }}>
                  <Text style={{ fontWeight: '600', color: colors.brandBlack.main }}>Chọn ảnh từ máy</Text>
                </TouchableOpacity>
                {form.logoUrl ? (
                  <TouchableOpacity onPress={() => update('logoUrl', '')} style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF1F2', borderRadius: 8 }}>
                    <Text style={{ fontWeight: '700', color: '#B42318' }}>Gỡ ảnh</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Hạng mục thi công</Text>
              <TextInput style={styles.input} value={form.mainCategories} onChangeText={t => update('mainCategories', t)} placeholder="Thiết kế, thi công nhôm kính..." placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput style={styles.input} value={form.address} onChangeText={t => update('address', t)} placeholder="Địa chỉ cơ sở" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput style={styles.input} value={form.phone} onChangeText={t => update('phone', t)} placeholder="09xxxx" keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={form.email} onChangeText={t => update('email', t)} placeholder="lienhe@..." keyboardType="email-address" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Fanpage / Website</Text>
              <TextInput style={styles.input} value={form.fanpage} onChangeText={t => update('fanpage', t)} placeholder="fb.com/..." placeholderTextColor="#94A3B8" />
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={saving || loading}>
          <Icon name="check" size={20} color="#fff" />
          <Text style={styles.btnSaveText}>{saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brandGrey[50],
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.brandGrey[500],
    marginBottom: 20,
    lineHeight: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brandGrey[800],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.brandGrey[200],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.brandBlack.main,
    backgroundColor: colors.brandGrey[50],
  },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32, // Add padding for bottom safe area
    borderTopWidth: 1,
    borderTopColor: colors.brandGrey[100],
  },
  btnSave: {
    backgroundColor: '#2F6FED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  }
});
