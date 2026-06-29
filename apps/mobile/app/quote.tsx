import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';

const doorTypes: { id: string; label: string; icon: IconName }[] = [
  { id: 'mo-quay-2', label: 'Mở quay 2 cánh', icon: 'square' },
  { id: 'mat-tien', label: 'Mặt tiền thủy lực', icon: 'columns' },
  { id: 'mo-quay-4', label: 'Mở quay 4 cánh', icon: 'grid' },
  { id: 'truot', label: 'Cửa trượt', icon: 'sidebar' },
  { id: 'truot-quay', label: 'Trượt quay', icon: 'repeat' },
  { id: 'cua-so', label: 'Cửa sổ', icon: 'maximize-2' },
];

const cutItems = [
  { label: 'Khung trên/dưới', value: '1150mm × 4' },
  { label: 'Khung trái/phải', value: '2150mm × 4' },
  { label: 'Cánh đứng', value: '2050mm × 8' },
  { label: 'Cánh ngang', value: '520mm × 8' },
  { label: 'Nẹp kính', value: 'tự tính ×16' },
];

const priceRows = [
  { label: 'Nhôm (đ/kg)', value: '92.000' },
  { label: 'Kính (đ/m²)', value: '320.000' },
  { label: 'Bản lề', value: '4 × 85.000' },
  { label: 'Khóa', value: '1 × 450.000' },
  { label: 'Ke góc / gioăng', value: '180.000' },
];

export default function QuoteScreen() {
  const [step, setStep] = useState(0);
  const [doorType, setDoorType] = useState('mo-quay-2');

  const stepTitle = useMemo(() => ['Chọn loại cửa', 'Bảng cắt tự động', 'Báo giá & đơn giá'][step], [step]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công thức cắt" subtitle={stepTitle} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.stepBar}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.stepDot, { backgroundColor: index <= step ? colors.brandOrange : '#E4E6EA' }]} />
          ))}
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.label}>Chọn loại cửa · Hệ Xingfa 55</Text>
            <View style={styles.grid}>
              {doorTypes.map((door) => {
                const active = doorType === door.id;
                return (
                  <Pressable key={door.id} onPress={() => setDoorType(door.id)} style={[styles.doorCard, active && styles.doorActive]}>
                    <View style={[styles.doorIconWrap, active && { backgroundColor: colors.brandOrange }]}>
                      <Icon name={door.icon} size={24} color={active ? colors.brandBlack : colors.brandOrange} />
                    </View>
                    <Text style={styles.doorLabel}>{door.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <View style={styles.panel}>
            <View style={styles.sizeChip}>
              <Icon name="maximize" size={14} color={colors.brandBlack} />
              <Text style={styles.sizeText}>R 1200 × C 2200 mm · 2 bộ</Text>
            </View>
            <Text style={styles.panelTitle}>Thanh profile cần cắt</Text>
            {cutItems.map((item) => (
              <View key={item.label} style={styles.row}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.totalBox}>
              <Text style={styles.totalCaption}>TỔNG NHÔM CẦN THIẾT</Text>
              <Text style={styles.totalValue}>38,6 kg</Text>
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Nhập đơn giá</Text>
            {priceRows.map((item) => (
              <View key={item.label} style={styles.row}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowValue}>{item.value}</Text>
              </View>
            ))}
            <View style={styles.totalBox}>
              <Text style={styles.totalCaption}>TỔNG BÁO GIÁ · 2 BỘ</Text>
              <Text style={styles.totalValue}>12.480.000đ</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.darkButton}><Icon name="save" size={16} color={colors.white} /><Text style={styles.darkButtonText}>Lưu</Text></Pressable>
              <Pressable style={styles.orangeButton}><Icon name="file-text" size={16} color={colors.brandBlack} /><Text style={styles.orangeButtonText}>Xuất PDF</Text></Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.navRow}>
          {step > 0 ? (
            <Pressable style={styles.backButton} onPress={() => setStep((value) => value - 1)}><Icon name="arrow-left" size={16} color={colors.brandOrange} /><Text style={styles.backText}>Quay lại</Text></Pressable>
          ) : <View style={{ flex: 1 }} />}
          {step < 2 ? (
            <Pressable style={styles.nextButton} onPress={() => setStep((value) => value + 1)}><Text style={styles.nextText}>Tiếp tục</Text><Icon name="arrow-right" size={16} color={colors.brandBlack} /></Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  stepBar: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  stepDot: { flex: 1, height: 6, borderRadius: 999 },
  label: { color: colors.brandBlack, fontWeight: '800', fontSize: 16, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  doorCard: { width: '48%', backgroundColor: colors.white, borderRadius: 20, paddingVertical: 22, alignItems: 'center', gap: 10, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  doorActive: { borderWidth: 2, borderColor: colors.brandOrange },
  doorIconWrap: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  doorLabel: { color: colors.brandBlack, fontWeight: '700', fontSize: 13 },
  panel: { backgroundColor: colors.white, borderRadius: 20, padding: 18, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sizeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.orangeSoft, borderRadius: 14, padding: 12, marginBottom: 14 },
  sizeText: { color: colors.brandBlack, fontWeight: '700' },
  panelTitle: { color: colors.brandBlack, fontWeight: '900', fontSize: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomColor: '#EEF0F3', borderBottomWidth: 1 },
  rowLabel: { color: colors.brandBlack, fontWeight: '600' },
  rowValue: { color: colors.brandGrey, fontWeight: '700' },
  totalBox: { backgroundColor: colors.brandOrange, borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 16 },
  totalCaption: { color: colors.brandBlack, fontWeight: '700', fontSize: 12, opacity: 0.8 },
  totalValue: { color: colors.brandBlack, fontWeight: '900', fontSize: 26, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  darkButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack, borderRadius: 14, paddingVertical: 14 },
  darkButtonText: { color: colors.white, fontWeight: '800' },
  orangeButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 14 },
  orangeButtonText: { color: colors.brandBlack, fontWeight: '800' },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  backButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, borderColor: colors.brandOrange, borderWidth: 1.5, borderRadius: 999, paddingVertical: 14 },
  backText: { color: colors.brandOrange, fontWeight: '800' },
  nextButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: colors.brandOrange, borderRadius: 999, paddingVertical: 14 },
  nextText: { color: colors.brandBlack, fontWeight: '900' },
});
