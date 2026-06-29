import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { Icon } from './Icon';
import { assetUrl } from '../lib/api';

// Thumbnail mặt cắt thanh nhôm. Nếu ảnh chưa có / lỗi tải -> fallback icon hộp.
export function ProfileThumb({ imageUrl, size = 48 }: { imageUrl?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {showImage ? (
        <Image
          source={{ uri: assetUrl(imageUrl) }}
          style={{ width: size - 4, height: size - 4 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="box" size={Math.round(size * 0.36)} color={colors.brandGrey} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, backgroundColor: '#F0F1F4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
