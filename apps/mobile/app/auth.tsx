import { useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@eurohouse/ui';
import { useAuth } from '../src/lib/auth';
import { DisplayTitle, Kicker } from '../src/components/ws';
import { createRegistrationState, registrationReducer, validateRegistrationDraft, type RegistrationDraft } from '../src/lib/authRegistrationState';
import heroImage from '../assets/brand/hero-ecento-70.jpg';
import logo from '../assets/logo-mark.png';

type Mode = 'login' | 'register';
const REMEMBER_LOGIN_KEY = 'eurohouse-remember-login';

async function getRememberedLogin(): Promise<{ identifier: string; password?: string } | null> {
  const raw = Platform.OS === 'web' ? (typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBER_LOGIN_KEY) : null) : await SecureStore.getItemAsync(REMEMBER_LOGIN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.identifier === 'string' ? { identifier: parsed.identifier, password: typeof parsed.password === 'string' ? parsed.password : undefined } : null;
  } catch { return null; }
}

async function setRememberedLogin(value: { identifier: string; password?: string } | null) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ identifier: value.identifier }));
    else localStorage.removeItem(REMEMBER_LOGIN_KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(REMEMBER_LOGIN_KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(REMEMBER_LOGIN_KEY);
}

function readableError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  const map: Record<string, string> = {
    IDENTIFIER_ALREADY_USED: 'Email hoặc số điện thoại này đã được đăng ký.',
    VERIFICATION_CODE_INVALID: 'Mã xác minh chưa đúng. Vui lòng kiểm tra lại.',
    VERIFICATION_CODE_EXPIRED: 'Mã xác minh đã hết hạn. Hãy gửi lại mã mới.',
    VERIFICATION_RESEND_COOLDOWN: 'Vui lòng chờ đủ 60 giây trước khi gửi lại mã.',
  };
  return map[message] ?? message ?? fallback;
}

export default function AuthScreen() {
  const { login, registerWorkshop, confirmVerification, resendVerification, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registration, dispatch] = useReducer(registrationReducer, undefined, createRegistrationState);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { void (async () => {
    const saved = await getRememberedLogin();
    if (saved) { setIdentifier(saved.identifier); if (saved.password) setLoginPassword(saved.password); setRememberPassword(true); }
  })(); }, []);

  useEffect(() => {
    if (registration.status !== 'VERIFY' && registration.recoverTo !== 'VERIFY') return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [registration.status, registration.recoverTo]);

  function updateDraft(field: keyof RegistrationDraft, value: string) {
    dispatch({ type: 'UPDATE_DRAFT', value: { ...registration.draft, [field]: value } });
  }

  async function submitLogin() {
    setLoginError(''); setLoginLoading(true);
    try {
      const cleanIdentifier = identifier.trim();
      await login(cleanIdentifier, loginPassword);
      await setRememberedLogin(rememberPassword ? { identifier: cleanIdentifier, password: Platform.OS === 'web' ? undefined : loginPassword } : null);
    } catch (error) { setLoginError(readableError(error, 'Đăng nhập thất bại.')); }
    finally { setLoginLoading(false); }
  }

  async function submitRegistration() {
    const validationError = validateRegistrationDraft(registration.draft);
    if (validationError) { dispatch({ type: 'FAILED', message: validationError, recoverTo: 'FORM' }); return; }
    dispatch({ type: 'SUBMIT_REGISTRATION' });
    try {
      const draft = registration.draft;
      const result = await registerWorkshop({
        displayName: draft.displayName.trim(), organizationName: draft.organizationName.trim(), password: draft.password,
        email: draft.email.trim(), phone: draft.phone.trim() || undefined,
      });
      dispatch({ type: 'REGISTRATION_ACCEPTED', ...result, now: Date.now() });
    } catch (error) { dispatch({ type: 'FAILED', message: readableError(error, 'Chưa thể tạo tài khoản.'), recoverTo: 'FORM' }); }
  }

  async function confirmCode() {
    if (!registration.pendingVerificationId || registration.code.length !== 6) {
      dispatch({ type: 'FAILED', message: 'Vui lòng nhập đủ mã xác minh 6 số.', recoverTo: 'VERIFY' }); return;
    }
    dispatch({ type: 'CONFIRM_STARTED' });
    try { await confirmVerification({ pendingVerificationId: registration.pendingVerificationId, code: registration.code }); }
    catch (error) { dispatch({ type: 'FAILED', message: readableError(error, 'Xác minh chưa thành công.'), recoverTo: 'VERIFY' }); }
  }

  async function resendCode() {
    if (!registration.pendingVerificationId || now < registration.resendAvailableAt) return;
    dispatch({ type: 'RESEND_STARTED', now });
    try { await resendVerification(registration.pendingVerificationId); dispatch({ type: 'RESEND_SUCCEEDED', now: Date.now() }); }
    catch (error) { dispatch({ type: 'FAILED', message: readableError(error, 'Chưa thể gửi lại mã.'), recoverTo: 'VERIFY' }); }
  }

  const isLogin = mode === 'login';
  const registrationStage = registration.status === 'ERROR' ? registration.recoverTo : registration.status;
  const isVerify = !isLogin && registrationStage === 'VERIFY';
  const registrationLoading = registration.status === 'SUBMITTING';
  const cooldownSeconds = Math.max(0, Math.ceil((registration.resendAvailableAt - now) / 1_000));
  const heroKicker = isLogin ? 'Chào mừng trở lại' : isVerify ? 'Xác minh email' : 'Đăng ký cơ sở';
  const heroTitle = isLogin ? 'Đăng nhập xưởng' : isVerify ? 'Nhập mã 6 số' : 'Tạo tài khoản miễn phí';
  const heroLead = isLogin
    ? 'Đăng nhập bằng email hoặc số điện thoại đã xác minh.'
    : isVerify ? `Mã đã gửi tới ${registration.maskedTarget ?? 'email của bạn'}.`
    : 'Cho cơ sở nhôm kính, cơ khí và xưởng sản xuất.';

  return <ScrollView style={styles.page} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <Image source={heroImage} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={styles.heroShade} />
      <View style={styles.heroTop}>
        <View style={styles.logoFrame}><Image source={logo} style={styles.logo} resizeMode="contain" /></View>
        <View>
          <Text style={styles.wordmark}>EUROHOUSE</Text>
          <Text style={styles.wordmarkSub}>WORKSHOP OS</Text>
        </View>
      </View>
      <View style={styles.heroCopy}>
        <Kicker text={heroKicker} light />
        <View style={{ marginTop: 6 }}><DisplayTitle text={heroTitle} size={24} light lines={2} /></View>
        <Text style={styles.heroLead}>{heroLead}</Text>
      </View>
    </View>

    <View style={styles.sheet}>
      {!isVerify ? <View style={styles.segment}>
        <Pressable onPress={() => setMode('login')} style={[styles.segmentItem, isLogin && styles.segmentActive]}><Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>Đăng nhập</Text></Pressable>
        <Pressable onPress={() => setMode('register')} style={[styles.segmentItem, !isLogin && styles.segmentActive]}><Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>Đăng ký cơ sở</Text></Pressable>
      </View> : null}

      {isLogin ? <>
        <Field placeholder="Email hoặc số điện thoại" value={identifier} onChangeText={setIdentifier} keyboardType="email-address" />
        <PasswordInput value={loginPassword} onChangeText={setLoginPassword} visible={showPassword} onToggleVisible={() => setShowPassword((value) => !value)} />
        <Pressable style={styles.rememberRow} onPress={() => setRememberPassword((value) => !value)}><View style={[styles.checkbox, rememberPassword && styles.checkboxActive]}>{rememberPassword ? <Text style={styles.checkboxMark}>✓</Text> : null}</View><Text style={styles.rememberText}>{Platform.OS === 'web' ? 'Nhớ email trên thiết bị này' : 'Nhớ đăng nhập an toàn trên thiết bị'}</Text></Pressable>
        {loginError ? <Text style={styles.error}>{loginError}</Text> : null}
        <PrimaryButton loading={loginLoading} label="Đăng nhập" onPress={submitLogin} />
      </> : isVerify ? <>
        <Text style={styles.fieldLabel}>Mã xác minh</Text>
        <TextInput value={registration.code} onChangeText={(code) => dispatch({ type: 'SET_CODE', code })} style={styles.codeInput} placeholder="000000" placeholderTextColor="#98A2B3" keyboardType="number-pad" maxLength={6} />
        {registration.error ? <Text style={styles.error}>{registration.error}</Text> : null}
        <PrimaryButton loading={registrationLoading} label="Xác minh và vào ứng dụng" onPress={confirmCode} />
        <Pressable disabled={cooldownSeconds > 0 || registrationLoading} onPress={resendCode} style={styles.secondaryButton}><Text style={[styles.secondaryText, cooldownSeconds > 0 && styles.mutedText]}>{cooldownSeconds > 0 ? `Gửi lại mã sau ${cooldownSeconds}s` : 'Gửi lại mã xác minh'}</Text></Pressable>
        <Pressable onPress={() => dispatch({ type: 'BACK_TO_FORM' })}><Text style={styles.textAction}>Sửa thông tin đăng ký</Text></Pressable>
      </> : <>
        <Field placeholder="Họ và tên" value={registration.draft.displayName} onChangeText={(value) => updateDraft('displayName', value)} />
        <Field placeholder="Tên cơ sở / xưởng" value={registration.draft.organizationName} onChangeText={(value) => updateDraft('organizationName', value)} />
        <Field placeholder="Email (nhận mã xác minh)" value={registration.draft.email} onChangeText={(value) => updateDraft('email', value)} keyboardType="email-address" />
        <Field placeholder="Số điện thoại (không bắt buộc)" value={registration.draft.phone} onChangeText={(value) => updateDraft('phone', value)} keyboardType="phone-pad" />
        <PasswordInput value={registration.draft.password} onChangeText={(value) => updateDraft('password', value)} visible={showPassword} onToggleVisible={() => setShowPassword((value) => !value)} />
        {registration.error ? <Text style={styles.error}>{registration.error}</Text> : null}
        <PrimaryButton loading={registrationLoading} label="Tạo tài khoản miễn phí" onPress={submitRegistration} />
        <Text style={styles.note}>Sau xác minh, bạn dùng ngay báo giá thủ công, công nợ, chấm công và quản lý công trình. Công thức Eurohouse được kích hoạt riêng bằng mã mời NPP.</Text>
      </>}

      <View style={styles.guestDivider}><View style={styles.guestLine} /><Text style={styles.guestDividerText}>HOẶC</Text><View style={styles.guestLine} /></View>
      <Pressable style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]} onPress={() => void continueAsGuest()}>
        <Text style={styles.guestButtonTitle}>Dùng ngay</Text>
        <Text style={styles.guestButtonText}>Không cần tài khoản · Thời tiết, chấm công, báo giá và thư viện Eurohouse</Text>
      </Pressable>
      <Text style={styles.slogan}>NHÔM CỦA SỰ THỊNH VƯỢNG</Text>
    </View>
  </ScrollView>;
}

function Field({ placeholder, value, onChangeText, keyboardType }: { placeholder: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'email-address' | 'phone-pad' }) {
  return <TextInput placeholder={placeholder} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} keyboardType={keyboardType} value={value} onChangeText={onChangeText} style={styles.input} placeholderTextColor="#98A2B3" />;
}

function PrimaryButton({ loading, label, onPress }: { loading: boolean; label: string; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]} disabled={loading} onPress={onPress}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{label}</Text>}</Pressable>;
}

function PasswordInput({ value, onChangeText, visible, onToggleVisible }: { value: string; onChangeText: (value: string) => void; visible: boolean; onToggleVisible: () => void }) {
  return <View style={styles.passwordRow}><TextInput placeholder="Mật khẩu (tối thiểu 6 ký tự)" secureTextEntry={!visible} value={value} onChangeText={onChangeText} style={styles.passwordInput} placeholderTextColor="#98A2B3" /><Pressable style={styles.passwordAction} onPress={onToggleVisible}><Text style={styles.passwordActionText}>{visible ? 'Ẩn' : 'Hiện'}</Text></Pressable></View>;
}

const INK = '#151A22';
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F6F7' },
  container: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: '#F5F6F7', paddingBottom: 32 },
  hero: { minHeight: 250, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 56, overflow: 'hidden', backgroundColor: '#202A37' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(21,26,34,0.62)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoFrame: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F9A82F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 40, height: 40 },
  wordmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.6 },
  wordmarkSub: { color: '#FFD09C', fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginTop: 1 },
  heroCopy: { marginTop: 26 },
  heroLead: { color: '#F3F5F7', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 420 },
  sheet: { marginTop: -28, marginHorizontal: 14, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#DFE3E8', padding: 16, gap: 12, shadowColor: '#151A22', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  segment: { flexDirection: 'row', backgroundColor: '#F2F4F7', borderRadius: 8, padding: 3 },
  segmentItem: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE3E8' },
  segmentText: { color: '#667085', fontWeight: '800', fontSize: 14 },
  segmentTextActive: { color: INK },
  input: { minHeight: 52, borderColor: '#D0D5DD', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, fontSize: 16, color: INK, backgroundColor: '#FFFFFF' },
  passwordRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderColor: '#D0D5DD', borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  passwordInput: { flex: 1, paddingHorizontal: 14, fontSize: 16, color: INK, minWidth: 0 },
  passwordAction: { minWidth: 62, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  passwordActionText: { color: '#C65309', fontWeight: '800', fontSize: 13 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxActive: { backgroundColor: '#F47C20', borderColor: '#F47C20' },
  checkboxMark: { color: '#FFFFFF', fontWeight: '900' },
  rememberText: { flex: 1, color: '#475467', fontWeight: '600', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: '700', lineHeight: 20 },
  primaryButton: { minHeight: 52, backgroundColor: '#F47C20', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.86 },
  note: { textAlign: 'center', color: '#667085', fontSize: 12.5, lineHeight: 18 },
  fieldLabel: { color: '#344054', fontWeight: '800', fontSize: 13 },
  codeInput: { minHeight: 62, borderColor: '#D0D5DD', borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF', color: INK, fontSize: 28, fontWeight: '900', letterSpacing: 10, textAlign: 'center' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#C65309', fontWeight: '800' },
  mutedText: { color: '#98A2B3' },
  textAction: { color: '#475467', textAlign: 'center', fontWeight: '700', paddingVertical: 6 },
  guestDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  guestLine: { flex: 1, height: 1, backgroundColor: '#DFE3E8' },
  guestDividerText: { color: '#98A2B3', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  guestButton: { minHeight: 60, borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA', backgroundColor: '#FFF2E8', paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  guestButtonTitle: { color: '#C65309', fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  guestButtonText: { color: '#667085', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 3 },
  slogan: { textAlign: 'center', color: '#98A2B3', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginTop: 4 },
});
