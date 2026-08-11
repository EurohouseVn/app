import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@eurohouse/ui';
import { useAuth } from '../src/lib/auth';

type Mode = 'login' | 'register';

const REMEMBER_LOGIN_KEY = 'eurohouse-remember-login';
const DEFAULT_IDENTIFIER = 'tho@eurohouse.vn';
const DEFAULT_PASSWORD = 'Eurohouse@2026';

async function getRememberedLogin(): Promise<{ identifier: string; password: string } | null> {
  const raw = Platform.OS === 'web'
    ? (typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBER_LOGIN_KEY) : null)
    : await SecureStore.getItemAsync(REMEMBER_LOGIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.identifier === 'string' && typeof parsed.password === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function setRememberedLogin(value: { identifier: string; password: string } | null) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify(value));
    else localStorage.removeItem(REMEMBER_LOGIN_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(REMEMBER_LOGIN_KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(REMEMBER_LOGIN_KEY);
}

export default function AuthScreen() {
  const { login, registerFactory } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState(DEFAULT_IDENTIFIER);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [factoryCode, setFactoryCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);

  useEffect(() => {
    void (async () => {
      const saved = await getRememberedLogin();
      if (saved) {
        setIdentifier(saved.identifier);
        setPassword(saved.password);
        setRememberPassword(true);
      }
    })();
  }, []);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const cleanIdentifier = identifier.trim();
        await login(cleanIdentifier, password);
        await setRememberedLogin(rememberPassword ? { identifier: cleanIdentifier, password } : null);
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
          <TextInput placeholder="Email hoặc số điện thoại" autoCapitalize="none" keyboardType="email-address" value={identifier} onChangeText={setIdentifier} style={styles.input} placeholderTextColor="#94A3B8" selectTextOnFocus />
          <PasswordInput value={password} onChangeText={setPassword} visible={showPassword} onToggleVisible={() => setShowPassword((value) => !value)} />
          <Pressable style={styles.rememberRow} onPress={() => setRememberPassword((value) => !value)}>
            <View style={[styles.checkbox, rememberPassword && styles.checkboxActive]}>
              {rememberPassword ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Nhớ email và mật khẩu cho lần đăng nhập sau</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput placeholder="Tên người dùng" value={displayName} onChangeText={setDisplayName} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Email đăng nhập" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor="#94A3B8" />
          <TextInput placeholder="Số điện thoại" keyboardType="phone-pad" value={phone} onChangeText={setPhone} style={styles.input} placeholderTextColor="#94A3B8" />
          <PasswordInput value={password} onChangeText={setPassword} visible={showPassword} onToggleVisible={() => setShowPassword((value) => !value)} />
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

function PasswordInput({
  value,
  onChangeText,
  visible,
  onToggleVisible,
}: {
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <View style={styles.passwordRow}>
      <TextInput
        placeholder="Mật khẩu"
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        style={styles.passwordInput}
        placeholderTextColor="#94A3B8"
        selectTextOnFocus
      />
      <Pressable style={styles.passwordAction} onPress={onToggleVisible}>
        <Text style={styles.passwordActionText}>{visible ? 'Ẩn' : 'Hiện'}</Text>
      </Pressable>
      <Pressable style={styles.passwordAction} onPress={() => onChangeText('')}>
        <Text style={styles.passwordActionText}>Xóa</Text>
      </Pressable>
    </View>
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
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 16, backgroundColor: colors.white, overflow: 'hidden' },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: colors.brandBlack.main, minWidth: 0 },
  passwordAction: { minWidth: 54, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', borderLeftWidth: 1, borderLeftColor: colors.orangeSoft },
  passwordActionText: { color: colors.brandOrange, fontWeight: '900', fontSize: 13 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange },
  checkboxMark: { color: colors.brandBlack.main, fontWeight: '900', lineHeight: 18 },
  rememberText: { flex: 1, color: colors.brandGrey[600], fontWeight: '700', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: '700' },
  primaryButton: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, marginTop: 8, alignItems: 'center' },
  primaryText: { color: colors.brandBlack.main, textAlign: 'center', fontWeight: '900', fontSize: 16 },
  register: { textAlign: 'center', color: colors.brandGrey[500], marginTop: 8, lineHeight: 20 },
});
