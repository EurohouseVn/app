import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { api, ApiError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { Button, Card, Field, Input, SubHeader, ws, wsStyles } from '../src/components/ws';

const CONSEQUENCES = [
  'Tài khoản bị khoá ngay, không đăng nhập lại được và không khôi phục được.',
  'Tên, số điện thoại, email, địa chỉ và logo của cơ sở được xoá khỏi hệ thống.',
  'Một số chứng từ, hoá đơn, đơn hàng và lịch sử giao dịch được giữ ẩn danh theo nghĩa vụ kế toán, pháp luật.',
  'Điểm thưởng chưa đổi sẽ mất.',
];

function deleteError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('INVALID_PASSWORD')) return 'Mật khẩu chưa đúng.';
  if (message.includes('ACCOUNT_DELETE_NOT_ALLOWED')) return 'Tài khoản này do công ty quản lý. Vui lòng liên hệ Eurohouse để được hỗ trợ.';
  if (error instanceof ApiError && error.status === 429) return 'Thử quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.';
  return message || 'Chưa xoá được tài khoản. Vui lòng thử lại.';
}

export default function DeleteAccountScreen() {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!password) { setError('Nhập mật khẩu để xác nhận.'); return; }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/delete-account', { password });
      logout();
      Alert.alert('Đã xoá tài khoản', 'Tài khoản và dữ liệu cá nhân của bạn đã được xoá.');
    } catch (cause) {
      setError(deleteError(cause));
      setBusy(false);
    }
  }

  function confirm() {
    const title = 'Xoá vĩnh viễn tài khoản?';
    const message = 'Thao tác này không thể hoàn tác.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) void submit();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá tài khoản', style: 'destructive', onPress: () => void submit() },
    ]);
  }

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Xoá tài khoản" subtitle={user?.displayName} onBack={() => router.back()} />
      <KeyboardAvoidingView style={wsStyles.grow} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[wsStyles.content, styles.pad]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Card>
            <Text style={styles.title}>Khi xoá tài khoản</Text>
            {CONSEQUENCES.map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.gap}>
            <Field label="Mật khẩu hiện tại">
              <Input
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Nhập mật khẩu để xác nhận"
                invalid={Boolean(error)}
              />
            </Field>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Card>
          <Button label={busy ? 'Đang xoá...' : 'Xoá tài khoản vĩnh viễn'} icon="trash-2" variant="danger" loading={busy} disabled={busy || !password} onPress={confirm} style={styles.gap} />
          <Button label="Giữ lại tài khoản" variant="secondary" onPress={() => router.back()} style={styles.gapSmall} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingBottom: 40 },
  gap: { marginTop: 12 },
  gapSmall: { marginTop: 8 },
  title: { color: ws.ink, fontSize: 14.5, fontWeight: '900', marginBottom: 6 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bullet: { color: ws.muted, fontSize: 13.5, lineHeight: 19 },
  bulletText: { flex: 1, color: ws.text, fontSize: 13.5, lineHeight: 19 },
  error: { color: ws.dangerText, fontSize: 12.5, fontWeight: '700', marginTop: 4 },
});
