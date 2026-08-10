import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, Modal, Dimensions } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { Promotion } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PromoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);

  useEffect(() => {
    const audience = user?.role === 'NPP' || user?.role === 'DAILY' ? 'NPP_DEALER' : 'WORKER';
    api.get<Promotion[]>(`/content/promotions?audience=${audience}`).then((list) => setPromos(list)).catch(() => undefined);
  }, [user]);

  const getGallery = (promo: Promotion | null): string[] => {
    if (!promo) return [];
    if (promo.gallery && Array.isArray(promo.gallery) && promo.gallery.length > 0) {
      return promo.gallery;
    }
    return promo.imageUrl ? [promo.imageUrl] : [];
  };

  const galleryImages = getGallery(selectedPromo);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
        <Text style={styles.topTitle}>Khuyến mãi</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {promos.length > 0 ? (
          promos.map((promo, index) => (
            <View key={promo.id || index.toString()} style={styles.promoCard}>
              {index === 0 && (
                <View style={styles.badge}>
                  <Icon name="zap" size={13} color={colors.brandBlack.main || '#000'} />
                  <Text style={styles.badgeText}>Đang diễn ra</Text>
                </View>
              )}
              <Text style={styles.title}>{promo.title}</Text>
              {!!promo.description && <Text style={styles.content}>{promo.description}</Text>}
              {promo.imageUrl && (
                <Pressable onPress={() => setSelectedPromo(promo)}>
                  <Image source={{ uri: assetUrl(promo.imageUrl) }} style={styles.poster} resizeMode="cover" />
                </Pressable>
              )}
            </View>
          ))
        ) : (
          <Text style={{ color: colors.brandGrey[500] || '#666' }}>Đang tải chương trình...</Text>
        )}
      </ScrollView>

      {/* Full Screen Image Modal */}
      <Modal visible={!!selectedPromo} transparent={true} animationType="slide" onRequestClose={() => setSelectedPromo(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.closeBtn} onPress={() => setSelectedPromo(null)}>
            <Icon name="x" size={24} color={colors.white} />
          </Pressable>
          {galleryImages.length > 0 && (
            <ScrollView 
              maximumZoomScale={4} 
              minimumZoomScale={1} 
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Pressable style={{ width: '100%' }} onPress={() => setSelectedPromo(null)}>
                {galleryImages.map((img, i) => (
                  <Image 
                    key={i}
                    source={{ uri: assetUrl(img) }} 
                    style={styles.fullScreenImage} 
                    resizeMode="contain" 
                  />
                ))}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.brandBlack.main || '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.white, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 40 },
  promoCard: { marginBottom: 30 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  badgeText: { color: colors.brandBlack.main || '#000', fontWeight: '800', fontSize: 12 },
  title: { color: colors.brandBlack.main || '#000', fontSize: 26, fontWeight: '900' },
  content: { color: colors.brandBlack.main || '#000', lineHeight: 22, marginTop: 12, marginBottom: 16 },
  poster: { width: '100%', height: 460, borderRadius: 18, backgroundColor: colors.orangeSoft || '#FFF5EB' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: SCREEN_WIDTH },
  fullScreenImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, alignSelf: 'center' },
});
