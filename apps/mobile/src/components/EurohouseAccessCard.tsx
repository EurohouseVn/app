import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const statusLabel = { ACTIVE: 'Đã kích hoạt', LOCKED: 'Chưa kích hoạt', REVOKED: 'Đã thu hồi' } as const;

export function EurohouseAccessCard() {
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const access = user?.capabilities.eurohouse;

  async function redeem() {
    if (!code.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      await api.post('/eurohouse-access/redeem', { code: code.trim() });
      await refreshUser();
      setCode('');
      setMessage('Đã cập nhật quyền Eurohouse.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không kích hoạt được mã mời.');
    } finally {
      setLoading(false);
    }
  }

  return <View style={styles.card}>
    <Text style={styles.title}>Quyền Eurohouse</Text>
    {access?.nppOrganizationName ? <Text style={styles.npp}>NPP phụ trách: {access.nppOrganizationName}</Text> : null}
    <View style={styles.row}><Text style={styles.label}>Công thức cắt</Text><Text style={styles.value}>{statusLabel[access?.features.FORMULA_CUTTING.status ?? 'LOCKED']}</Text></View>
    <View style={styles.row}><Text style={styles.label}>Đặt hàng Eurohouse</Text><Text style={styles.value}>{statusLabel[access?.features.EUROHOUSE_ORDERING.status ?? 'LOCKED']}</Text></View>
    <View style={styles.codeRow}>
      <TextInput value={code} onChangeText={setCode} placeholder="Nhập mã mời NPP" autoCapitalize="characters" style={styles.input} placeholderTextColor="#98A2B3" />
      <Pressable disabled={loading || !code.trim()} onPress={redeem} style={[styles.button, (loading || !code.trim()) && styles.disabled]}><Text style={styles.buttonText}>{loading ? 'Đang xử lý' : 'Kích hoạt'}</Text></Pressable>
    </View>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: colors.white },
  title: { color: colors.brandBlack.main, fontSize: 16, fontWeight: '900' },
  npp: { marginTop: 5, color: colors.brandGrey[500], fontSize: 12 },
  row: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.brandGrey[500], fontSize: 13 },
  value: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '800' },
  codeRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.brandBlack.main },
  button: { justifyContent: 'center', borderRadius: 12, paddingHorizontal: 13, backgroundColor: colors.brandOrange },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 12 },
  message: { marginTop: 8, color: colors.brandGrey[500], fontSize: 12 },
});
