import { ImageBackground, Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { Icon } from './Icon';
// Logo (nền trong suốt) + ảnh nhà hiện đại cho header
import logo from '../../assets/logo.png';
import headerBg from '../../assets/header-house.jpg';

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <ImageBackground source={headerBg} style={styles.header} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <View style={styles.row}>
        <View style={styles.logoCircle}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.bell}>
          <Icon name="bell" size={18} color={colors.brandBlack} />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  bgImage: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(21,17,16,0.55)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoCircle: { width: 46, height: 46, borderRadius: 999, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 6 },
  logo: { width: 34, height: 34 },
  title: { color: colors.white, fontSize: 20, fontWeight: '900' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  bell: { width: 38, height: 38, borderRadius: 999, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' },
});
