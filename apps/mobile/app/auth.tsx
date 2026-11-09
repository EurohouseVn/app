import { useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@eurohouse/ui';
import { useAuth } from '../src/lib/auth';
import { createRegistrationState, registrationReducer, validateRegistrationDraft, type RegistrationDraft } from '../src/lib/authRegistrationState';

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
        email: draft.email.trim() || undefined, phone: draft.phone.trim() || undefined,
        verificationChannel: draft.email.trim() && draft.phone.trim() ? draft.verificationChannel : undefined,
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

  return <ScrollView style={styles.page} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.brandMark}><Text style={styles.brandMarkText}>E</Text></View>
    <Text style={styles.title}>Eurohouse</Text>
    <Text style={styles.subtitle}>{isLogin ? 'Đăng nhập bằng email hoặc số điện thoại đã xác minh.' : isVerify ? `Nhập mã 6 số đã gửi tới ${registration.maskedTarget ?? 'định danh của bạn'}.` : 'Tạo tài khoản miễn phí cho cơ sở nhôm kính, cơ khí và xưởng sản xuất.'}</Text>

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
    </> : isVerify ? <View style={styles.verifyCard}>
      <Text style={styles.fieldLabel}>Mã xác minh</Text>
      <TextInput value={registration.code} onChangeText={(code) => dispatch({ type: 'SET_CODE', code })} style={styles.codeInput} placeholder="000000" placeholderTextColor="#94A3B8" keyboardType="number-pad" maxLength={6} />
      {registration.error ? <Text style={styles.error}>{registration.error}</Text> : null}
      <PrimaryButton loading={registrationLoading} label="Xác minh và vào ứng dụng" onPress={confirmCode} />
      <Pressable disabled={cooldownSeconds > 0 || registrationLoading} onPress={resendCode} style={styles.secondaryButton}><Text style={[styles.secondaryText, cooldownSeconds > 0 && styles.mutedText]}>{cooldownSeconds > 0 ? `Gửi lại mã sau ${cooldownSeconds}s` : 'Gửi lại mã xác minh'}</Text></Pressable>
      <Pressable onPress={() => dispatch({ type: 'BACK_TO_FORM' })}><Text style={styles.textAction}>Sửa thông tin đăng ký</Text></Pressable>
    </View> : <>
      <Field placeholder="Họ và tên" value={registration.draft.displayName} onChangeText={(value) => updateDraft('displayName', value)} />
      <Field placeholder="Tên cơ sở / xưởng" value={registration.draft.organizationName} onChangeText={(value) => updateDraft('organizationName', value)} />
      <Field placeholder="Email (không bắt buộc)" value={registration.draft.email} onChangeText={(value) => updateDraft('email', value)} keyboardType="email-address" />
      <Field placeholder="Số điện thoại (không bắt buộc)" value={registration.draft.phone} onChangeText={(value) => updateDraft('phone', value)} keyboardType="phone-pad" />
      {registration.draft.email.trim() && registration.draft.phone.trim() ? <View><Text style={styles.fieldLabel}>Nhận mã xác minh qua</Text><View style={styles.channelRow}>{(['EMAIL', 'PHONE'] as const).map((channel) => <Pressable key={channel} onPress={() => updateDraft('verificationChannel', channel)} style={[styles.channelButton, registration.draft.verificationChannel === channel && styles.channelActive]}><Text style={[styles.channelText, registration.draft.verificationChannel === channel && styles.channelTextActive]}>{channel === 'EMAIL' ? 'Email' : 'Điện thoại'}</Text></Pressable>)}</View></View> : null}
      <PasswordInput value={registration.draft.password} onChangeText={(value) => updateDraft('password', value)} visible={showPassword} onToggleVisible={() => setShowPassword((value) => !value)} />
      {registration.error ? <Text style={styles.error}>{registration.error}</Text> : null}
      <PrimaryButton loading={registrationLoading} label="Tạo tài khoản miễn phí" onPress={submitRegistration} />
      <Text style={styles.note}>Sau xác minh, bạn dùng ngay báo giá thủ công, công nợ, chấm công và quản lý công trình. Công thức Eurohouse được kích hoạt riêng bằng mã mời NPP.</Text>
    </>}
    <View style={styles.guestDivider}><View style={styles.guestLine} /><Text style={styles.guestDividerText}>hoặc</Text><View style={styles.guestLine} /></View>
    <Pressable style={styles.guestButton} onPress={() => void continueAsGuest()}>
      <Text style={styles.guestButtonTitle}>Dùng ngay</Text>
      <Text style={styles.guestButtonText}>Không cần tài khoản · Thời tiết, chấm công, báo giá và thư viện Eurohouse</Text>
    </Pressable>
  </ScrollView>;
}

function Field({ placeholder, value, onChangeText, keyboardType }: { placeholder: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'email-address' | 'phone-pad' }) {
  return <TextInput placeholder={placeholder} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} keyboardType={keyboardType} value={value} onChangeText={onChangeText} style={styles.input} placeholderTextColor="#94A3B8" />;
}

function PrimaryButton({ loading, label, onPress }: { loading: boolean; label: string; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]} disabled={loading} onPress={onPress}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{label}</Text>}</Pressable>;
}

function PasswordInput({ value, onChangeText, visible, onToggleVisible }: { value: string; onChangeText: (value: string) => void; visible: boolean; onToggleVisible: () => void }) {
  return <View style={styles.passwordRow}><TextInput placeholder="Mật khẩu (tối thiểu 6 ký tự)" secureTextEntry={!visible} value={value} onChangeText={onChangeText} style={styles.passwordInput} placeholderTextColor="#94A3B8" /><Pressable style={styles.passwordAction} onPress={onToggleVisible}><Text style={styles.passwordActionText}>{visible ? 'Ẩn' : 'Hiện'}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFF9F3' }, container: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center', gap: 14 },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.white, fontSize: 24, fontWeight: '900' },
  title: { color: colors.brandBlack.main, fontSize: 32, lineHeight: 38, fontWeight: '900' }, subtitle: { color: colors.brandGrey[600], fontSize: 15, lineHeight: 22, marginBottom: 6 },
  guestDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }, guestLine: { flex: 1, height: 1, backgroundColor: '#E7D8CA' }, guestDividerText: { color: colors.brandGrey[500], fontSize: 12, fontWeight: '700' },
  guestButton: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: '#F2A45F', backgroundColor: '#FFF7EF', paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' }, guestButtonTitle: { color: colors.brandOrangeText, fontSize: 16, fontWeight: '900' }, guestButtonText: { color: colors.brandGrey[600], fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 3 },
  segment: { flexDirection: 'row', backgroundColor: colors.brandGrey[100], borderRadius: 16, padding: 4 }, segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, segmentActive: { backgroundColor: colors.white }, segmentText: { color: colors.brandGrey[500], fontWeight: '800' }, segmentTextActive: { color: colors.brandBlack.main },
  input: { minHeight: 54, borderColor: '#E7D8CA', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 16, color: colors.brandBlack.main, backgroundColor: colors.white },
  passwordRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderColor: '#E7D8CA', borderWidth: 1, borderRadius: 14, backgroundColor: colors.white, overflow: 'hidden' }, passwordInput: { flex: 1, paddingHorizontal: 16, fontSize: 16, color: colors.brandBlack.main, minWidth: 0 }, passwordAction: { minWidth: 62, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }, passwordActionText: { color: colors.brandOrange, fontWeight: '800', fontSize: 13 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }, checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#D4BDA8', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, checkboxActive: { backgroundColor: colors.brandOrange, borderColor: colors.brandOrange }, checkboxMark: { color: colors.white, fontWeight: '900' }, rememberText: { flex: 1, color: colors.brandGrey[600], fontWeight: '600', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: '700', lineHeight: 20 }, primaryButton: { minHeight: 52, backgroundColor: colors.brandOrange, borderRadius: 14, marginTop: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, primaryText: { color: colors.white, textAlign: 'center', fontWeight: '900', fontSize: 16 }, disabled: { opacity: 0.6 }, pressed: { opacity: 0.86 }, note: { textAlign: 'center', color: colors.brandGrey[500], marginTop: 4, fontSize: 13, lineHeight: 19 },
  verifyCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: '#F1E4D8' }, fieldLabel: { color: colors.brandGrey[700], fontWeight: '800', fontSize: 13, marginBottom: 8 }, codeInput: { minHeight: 62, borderColor: '#E7D8CA', borderWidth: 1, borderRadius: 14, backgroundColor: '#FFFDFC', color: colors.brandBlack.main, fontSize: 28, fontWeight: '900', letterSpacing: 10, textAlign: 'center' }, secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.brandOrange, fontWeight: '800' }, mutedText: { color: colors.brandGrey[400] }, textAction: { color: colors.brandGrey[600], textAlign: 'center', fontWeight: '700', paddingVertical: 6 },
  channelRow: { flexDirection: 'row', gap: 10 }, channelButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E7D8CA', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, channelActive: { borderColor: colors.brandOrange, backgroundColor: '#FFF1E4' }, channelText: { color: colors.brandGrey[600], fontWeight: '700' }, channelTextActive: { color: colors.brandOrange, fontWeight: '900' },
});
