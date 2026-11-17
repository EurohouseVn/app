import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { Icon } from './Icon';
import { assetUrl } from '../lib/api';

// Thumbnail mặt cắt thanh nhôm. Nếu ảnh chưa có / lỗi tải -> fallback icon hộp.
export function ProfileThumb({ imageUrl, size = 48 }: { imageUrl?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const showImage = imageUrl && !failed;
  return (
    <>
      <Pressable
        style={[styles.wrap, { width: size, height: size }]}
        disabled={!showImage}
        onPress={() => setOpen(true)}
        accessibilityRole={showImage ? 'button' : undefined}
        accessibilityLabel={showImage ? 'Phóng to ảnh mặt cắt' : undefined}
      >
        {showImage ? (
        <Image
          source={{ uri: assetUrl(imageUrl) }}
          style={{ width: size - 4, height: size - 4 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="box" size={Math.round(size * 0.36)} color={colors.brandGrey[500]} />
      )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.closeButton} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Đóng ảnh">
            <Icon name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <Image source={{ uri: assetUrl(imageUrl) }} style={styles.fullImage} resizeMode="contain" />
          <Text style={styles.hint}>Ảnh mặt cắt sản phẩm</Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9, 14, 25, 0.94)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 60 },
  fullImage: { width: '100%', height: '78%', backgroundColor: '#FFFFFF', borderRadius: 8 },
  closeButton: { position: 'absolute', top: 42, right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  hint: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginTop: 14 },
});
