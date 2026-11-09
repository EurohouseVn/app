import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CatalogSystem } from '@eurohouse/types';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

export default function CatalogScreen() {
  const router = useRouter();
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { setSystems(await api.get<CatalogSystem[]>('/catalog/systems')); }
    catch { setError('Chưa tải được catalog. Kiểm tra kết nối và thử lại.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandOrange} />}>
    <Pressable style={styles.back} onPress={() => router.back()}><Icon name="arrow-left" size={20} color="#344054" /><Text style={styles.backText}>Trang chủ</Text></Pressable>
    <Text style={styles.kicker}>CATALOG EUROHOUSE</Text>
    <Text style={styles.title}>Hệ nhôm và mã thanh</Text>
    <Text style={styles.description}>Thông tin trình bày sản phẩm công khai; không bao gồm giá, tồn kho hoặc dữ liệu thương mại nội bộ.</Text>
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.brandOrange} /><Text style={styles.stateText}>Đang tải catalog…</Text></View> : error ? <View style={styles.state}><Icon name="alert-circle" size={22} color="#B42318" /><Text style={[styles.stateText, { color: '#B42318' }]}>{error}</Text></View> : systems.length === 0 ? <View style={styles.state}><Text style={styles.stateText}>Catalog đang được cập nhật.</Text></View> : systems.map((system) => <View key={system.id || system.code} style={styles.systemCard}><View style={styles.systemHeading}><View><Text style={styles.systemCode}>{system.code}</Text><Text style={styles.systemName}>{system.name}</Text></View><Text style={styles.count}>{system.profiles.length} mã thanh</Text></View>{system.description ? <Text style={styles.systemDescription}>{system.description}</Text> : null}<View style={styles.profileGrid}>{system.profiles.map((profile) => <View key={profile.id || profile.code} style={styles.profileCard}>{profile.imageUrl ? <Image source={{ uri: assetUrl(profile.imageUrl) }} style={styles.profileImage} resizeMode="contain" /> : <View style={styles.profileImageEmpty}><Icon name="maximize" size={24} color="#98A2B3" /></View>}<Text numberOfLines={1} style={styles.profileCode}>{profile.code}</Text><Text numberOfLines={2} style={styles.profileName}>{profile.name}</Text></View>)}</View></View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' }, content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, paddingBottom: 100 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: '#344054', fontSize: 13, fontWeight: '800' }, kicker: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 18 }, title: { color: '#172033', fontSize: 29, lineHeight: 36, fontWeight: '900', marginTop: 7 }, description: { color: '#667085', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20, maxWidth: 680 },
  state: { minHeight: 150, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }, stateText: { color: '#667085', fontSize: 13, textAlign: 'center' },
  systemCard: { marginBottom: 14, padding: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC' }, systemHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, systemCode: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900' }, systemName: { color: '#172033', fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 3 }, count: { color: '#667085', fontSize: 10, fontWeight: '800', backgroundColor: '#F2F4F7', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, systemDescription: { color: '#667085', fontSize: 12, lineHeight: 18, marginTop: 8 },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 }, profileCard: { flexGrow: 1, flexBasis: 140, maxWidth: 210, minHeight: 175, borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', padding: 10 }, profileImage: { width: '100%', height: 96 }, profileImageEmpty: { width: '100%', height: 96, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' }, profileCode: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900', marginTop: 9 }, profileName: { color: '#344054', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 3 },
});
