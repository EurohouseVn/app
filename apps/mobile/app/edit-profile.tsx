import { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { API_URL, authHeaders, assetUrl } from '../src/lib/api';
import { Image } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

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
      api.get<any>('/npp/profile').then(res => {
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
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể lưu cấu hình, vui lòng thử lại.');
    }
    setSaving(false);
  };

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('logo', {
          uri: asset.uri,
          name: asset.fileName || 'logo.jpg',
          type: asset.mimeType || 'image/jpeg',
        } as any);

        const res = await fetch(`${API_URL}/npp/profile/logo`, {
          method: 'POST',
          headers: {
            ...authHeaders(),
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });
        
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        if (data.url) {
          update('logoUrl', data.url);
          Alert.alert('Thành công', 'Đã tải ảnh lên.');
        }
      } catch (e) {
        Alert.alert('Lỗi', 'Không thể tải ảnh lên. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <View style={styles.container}>
      <AppHeader title="Cấu hình Tài khoản" />
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.brandGrey[500] }}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.card}>
            <Text style={styles.subtitle}>Thông tin này sẽ hiển thị trên tiêu đề báo giá PDF xuất ra.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Tên cơ sở / NPP</Text>
              <TextInput style={styles.input} value={form.productionName} onChangeText={t => update('productionName', t)} placeholder="NHÔM KÍNH TIẾN MẠNH" placeholderTextColor="#94A3B8" />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ảnh Logo (Tùy chọn)</Text>
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
