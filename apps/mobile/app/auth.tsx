import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { useAuth } from '../src/lib/auth';

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const { login, registerFactory } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('tho@eurohouse.vn');
  const [password, setPassword] = useState('Eurohouse@2026');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [factoryCode, setFactoryCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(identifier.trim(), password);
      } else {
        await registerFactory({
          displayName: displayName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          factoryCode: factoryCode.trim(),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : mode === 'login' ? 'Đăng nhập thất bại.' : 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === 'login';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Eurohouse</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Đăng nhập bằng email hoặc số điện thoại đã đăng ký.' : 'Nhập mã CSSX do NPP cung cấp để kích hoạt tài khoản xưởng.'}</Text>

      <View style={styles.segment}>
        <Pressable onPress={() => setMode('login')} style={[styles.segmentItem, isLogin && styles.segmentActive]}>
          <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>Đăng nhập</Text>
        </Pressable>
        <Pressable onPress={() => setMode('register')} style={[styles.segmentItem, !isLogin && styles.segmentActive]}>
          <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>Đăng ký CSSX</Text>
        </Pressable>
      </View>

      {isLogin ? (
        <>
          <TextInput placeholder="Email hoặc số điện thoại" autoCapitalize="none" keyboardType="email-address" value={identifier} onChangeText={setIdentifier} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholderTextColor="#94A3B8" />
        </>
      ) : (
        <>
          <TextInput placeholder="Tên người dùng" value={displayName} onChangeText={setDisplayName} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Email đăng nhập" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Số điện thoại" keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Mật khẩu" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Mã CSSX do NPP cung cấp" autoCapitalize="characters" value={factoryCode} onChangeText={setFactoryCode} style={styles.input} placeholderTextColor="#94A3B8" />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.primaryButton, loading && { opacity: 0.6 }]} disabled={loading} onPress={submit}>
        {loading ? <ActivityIndicator color={colors.brandBlack.main} /> : <Text style={styles.primaryText}>{isLogin ? 'Đăng nhập' : 'Tạo tài khoản CSSX'}</Text>}
      </Pressable>
      <Text style={styles.register}>Mã CSSX được NPP tạo trên Web NPP và gửi riêng cho từng cơ sở sản xuất.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.white, gap: 14 },
  title: { color: colors.brandBlack.main, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.brandGrey[500], fontSize: 15, lineHeight: 22, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: colors.brandGrey[100], borderRadius: 14, padding: 4, marginBottom: 4 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.white },
  segmentText: { color: colors.brandGrey[500], fontWeight: '800' },
  segmentTextActive: { color: colors.brandBlack.main },
  input: { borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 16, padding: 16, fontSize: 16, color: colors.brandBlack.main, backgroundColor: colors.white },
  error: { color: colors.danger, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, marginTop: 8, alignItems: 'center' },
  primaryText: { color: colors.brandBlack.main, textAlign: 'center', fontWeight: '900', fontSize: 16 },
  register: { textAlign: 'center', color: colors.brandGrey[500], marginTop: 8, lineHeight: 20 },
});
