import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { useAuth } from '../src/lib/auth';

export default function AuthScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('tho@eurohouse.vn');
  const [password, setPassword] = useState('Eurohouse@2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chào mừng đến Eurohouse</Text>
      <Text style={styles.subtitle}>Đăng nhập bằng email hoặc số điện thoại đã đăng ký.</Text>
      <TextInput
        placeholder="Email hoặc số điện thoại"
        autoCapitalize="none"
        keyboardType="email-address"
        value={identifier}
        onChangeText={setIdentifier}
        style={styles.input}
      />
      <TextInput
        placeholder="Mật khẩu"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.primaryButton, loading && { opacity: 0.6 }]} disabled={loading} onPress={handleLogin}>
        {loading ? <ActivityIndicator color={colors.brandBlack} /> : <Text style={styles.primaryText}>Đăng nhập</Text>}
      </Pressable>
      <Text style={styles.register}>Chưa có tài khoản? Liên hệ Eurohouse để đăng ký Đại lý hoặc NPP.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.white, gap: 14 },
  title: { color: colors.brandBlack, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.brandGrey, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  input: { borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 16, padding: 16, fontSize: 16, color: colors.brandBlack },
  error: { color: colors.danger, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, marginTop: 8, alignItems: 'center' },
  primaryText: { color: colors.brandBlack, textAlign: 'center', fontWeight: '900', fontSize: 16 },
  register: { textAlign: 'center', color: colors.brandGrey, marginTop: 8 },
});
