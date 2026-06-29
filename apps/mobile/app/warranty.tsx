import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';

export default function WarrantyScreen() {
  const router = useRouter();
  const [customer, setCustomer] = useState('');
  const [project, setProject] = useState('');
  const [done, setDone] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
        <Text style={styles.topTitle}>Kích hoạt bảo hành</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.scanner}>
          <View style={styles.scanFrame}>
            <Icon name="maximize" size={54} color={colors.brandOrange} />
          </View>
          <Text style={styles.scanHint}>Đưa mã QR trên sản phẩm vào khung để quét</Text>
          <Pressable style={styles.scanBtn}>
            <Icon name="camera" size={16} color={colors.brandBlack} />
            <Text style={styles.scanBtnText}>Mở camera quét</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Thông tin khách hàng</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Tên khách</Text>
            <TextInput value={customer} onChangeText={setCustomer} placeholder="Nhập tên khách hàng" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Công trình</Text>
            <TextInput value={project} onChangeText={setProject} placeholder="Nhập tên công trình" style={styles.input} />
          </View>
        </View>

        <Pressable style={styles.activateButton} onPress={() => setDone(true)}>
          <Icon name="check-circle" size={18} color={colors.brandBlack} />
          <Text style={styles.activateText}>Kích hoạt & nhận điểm</Text>
        </Pressable>
        <View style={styles.noteRow}>
          <Icon name="star" size={13} color={colors.brandOrange} />
          <Text style={styles.note}>+50 điểm tích lũy mỗi lần kích hoạt</Text>
        </View>
        {done ? (
          <View style={styles.successBox}>
            <Icon name="check-circle" size={18} color={colors.success} />
            <Text style={styles.success}>Đã kích hoạt bảo hành cho {customer || 'khách hàng'}!</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.brandBlack, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.white, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 110 },
  scanner: { alignItems: 'center', gap: 14, marginVertical: 16 },
  scanFrame: { width: 180, height: 180, borderRadius: 28, borderWidth: 3, borderColor: colors.brandOrange, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  scanHint: { color: colors.brandGrey, textAlign: 'center', paddingHorizontal: 30 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  scanBtnText: { color: colors.brandBlack, fontWeight: '800' },
  panel: { backgroundColor: colors.white, borderRadius: 20, padding: 18, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  panelTitle: { color: colors.brandBlack, fontWeight: '900', marginBottom: 14, fontSize: 15 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.brandBlack, fontWeight: '700', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 14, color: colors.brandBlack },
  activateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 16, marginTop: 18 },
  activateText: { color: colors.brandBlack, fontWeight: '900' },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  note: { color: colors.brandGrey },
  successBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, backgroundColor: '#E9F8EE', borderRadius: 14, padding: 14 },
  success: { color: colors.success, fontWeight: '800' },
});
