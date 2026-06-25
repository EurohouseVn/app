import { Link } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';

export default function AuthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chào mừng đến Eurohouse</Text>
      <Text style={styles.subtitle}>Đăng nhập bằng số điện thoại. Token sẽ dùng SecureStore khi kết nối API thật.</Text>
      <TextInput placeholder="Số điện thoại" keyboardType="phone-pad" style={styles.input} />
      <TextInput placeholder="Mật khẩu" secureTextEntry style={styles.input} />
      <Link href="/" style={styles.primaryButton}>Đăng nhập</Link>
      <Text style={styles.register}>Chưa có tài khoản? Đăng ký Đại lý hoặc NPP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.white, gap: 14 },
  title: { color: colors.brandBlack, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.brandGrey, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  input: { borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 16, padding: 16, fontSize: 16, color: colors.brandBlack },
  primaryButton: { backgroundColor: colors.brandOrange, color: colors.brandBlack, textAlign: 'center', fontWeight: '900', paddingVertical: 16, borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  register: { textAlign: 'center', color: colors.brandGrey, marginTop: 8 },
});
