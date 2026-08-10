import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable, Dimensions } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';

const SYSTEMS = ['EUROQUEEN Hệ 55', 'EUROQUEEN Hệ 93 (Lùa)'];
const DOOR_TYPES = ['Cửa đi 1 cánh mở quay', 'Cửa sổ lùa 2 cánh'];

export default function EstimateScreen() {
  const [system, setSystem] = useState(SYSTEMS[0]);
  const [doorType, setDoorType] = useState(DOOR_TYPES[0]);
  const [width, setWidth] = useState('900');
  const [height, setHeight] = useState('2200');
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const W = parseFloat(width);
    const H = parseFloat(height);

    if (doorType === 'Cửa đi 1 cánh mở quay') {
      setResult({
        formulas: [
          { name: 'Khung bao đứng', formula: 'H - 50', value: H - 50, qty: 2, angle: '45-45' },
          { name: 'Khung bao ngang', formula: 'W', value: W, qty: 1, angle: '45-45' },
          { name: 'Cánh đứng', formula: 'H - 45', value: H - 45, qty: 2, angle: '45-45' },
          { name: 'Cánh ngang', formula: 'W - 84', value: W - 84, qty: 2, angle: '45-45' },
          { name: 'Nẹp kính đứng', formula: 'H - 170', value: H - 170, qty: 2, angle: '90-90' },
          { name: 'Nẹp kính ngang', formula: 'W - 198', value: W - 198, qty: 2, angle: '90-90' },
        ],
        materials: {
          aluBars: 3,
          glassM2: ((W - 198) * (H - 170) / 1000000).toFixed(2),
          accessories: ['3 Bản lề 3D', '1 Bộ khoá đa điểm', 'Ke ép góc']
        },
        costs: {
          alu: 1250000,
          glass: 450000,
          accessory: 650000,
          total: 2350000
        }
      });
    } else {
      setResult({
        formulas: [
          { name: 'Khung bao đứng', formula: 'H', value: H, qty: 2, angle: '90-90' },
          { name: 'Khung bao ngang', formula: 'W', value: W, qty: 2, angle: '90-90' },
          { name: 'Cánh móc', formula: 'H - 65', value: H - 65, qty: 2, angle: '90-90' },
          { name: 'Cánh trơn', formula: 'H - 65', value: H - 65, qty: 2, angle: '90-90' },
          { name: 'Cánh ngang trên/dưới', formula: 'W/2 - 10', value: (W/2) - 10, qty: 4, angle: '90-90' },
        ],
        materials: {
          aluBars: 4,
          glassM2: (((W/2) - 100) * (H - 180) / 1000000).toFixed(2),
          accessories: ['4 Bánh xe lùa', '2 Khoá chốt sập', 'Đệm chống nhấc']
        },
        costs: {
          alu: 1800000,
          glass: 600000,
          accessory: 350000,
          total: 2750000
        }
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Công Thức & Dự Toán" subtitle="Tính toán vật tư tự động" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Nhập liệu */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông số cửa</Text>
          
          <Text style={styles.label}>Hệ nhôm</Text>
          <View style={styles.rowChoices}>
            {SYSTEMS.map(sys => (
              <Pressable key={sys} style={[styles.choiceBtn, system === sys && styles.choiceActive]} onPress={() => setSystem(sys)}>
                <Text style={[styles.choiceText, system === sys && styles.choiceTextActive]}>{sys}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Kiểu dáng</Text>
          <View style={styles.rowChoices}>
            {DOOR_TYPES.map(type => (
              <Pressable key={type} style={[styles.choiceBtn, doorType === type && styles.choiceActive]} onPress={() => setDoorType(type)}>
                <Text style={[styles.choiceText, doorType === type && styles.choiceTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Rộng (W) mm</Text>
              <TextInput style={styles.input} value={width} onChangeText={setWidth} keyboardType="numeric" placeholderTextColor="#94A3B8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cao (H) mm</Text>
              <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholderTextColor="#94A3B8" />
            </View>
          </View>

          <Pressable style={styles.calcBtn} onPress={calculate}>
            <Icon name="zap" size={18} color={colors.white} />
            <Text style={styles.calcText}>Bóc tách vật tư</Text>
          </Pressable>
        </View>

        {/* Kết quả */}
        {result && (
          <View style={styles.resultContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Dự toán giá vốn</Text>
              <Text style={styles.summaryTotal}>{result.costs.total.toLocaleString('vi-VN')} đ</Text>
              <View style={styles.divider} />
              <View style={styles.costRow}><Text style={styles.costLabel}>Nhôm (ước tính {result.materials.aluBars} cây)</Text><Text style={styles.costValue}>{result.costs.alu.toLocaleString()} đ</Text></View>
              <View style={styles.costRow}><Text style={styles.costLabel}>Kính (ước tính {result.materials.glassM2} m²)</Text><Text style={styles.costValue}>{result.costs.glass.toLocaleString()} đ</Text></View>
              <View style={styles.costRow}><Text style={styles.costLabel}>Phụ kiện (khoá, bản lề...)</Text><Text style={styles.costValue}>{result.costs.accessory.toLocaleString()} đ</Text></View>
              
              <Pressable style={styles.editAccBtn}>
                <Text style={styles.editAccText}>Chỉnh sửa giá phụ kiện của xưởng</Text>
                <Icon name="chevron-right" size={14} color={colors.brandOrangeText} />
              </Pressable>
            </View>

            <Text style={styles.formulaTitle}>Công thức cắt chi tiết</Text>
            {result.formulas.map((f: any, idx: number) => (
              <View key={idx} style={styles.formulaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fName}>{f.name}</Text>
                  <Text style={styles.fFormula}>{f.formula}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.fValue}>{f.value} <Text style={{fontSize:12, fontWeight:'400'}}>mm</Text></Text>
                  <Text style={styles.fMeta}>SL: {f.qty} | Góc: {f.angle}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 20, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.brandBlack.main, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.brandGrey[500], marginBottom: 8, marginTop: 12 },
  rowChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#F0F2F5', borderWidth: 1, borderColor: 'transparent' },
  choiceActive: { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange },
  choiceText: { fontSize: 14, fontWeight: '600', color: colors.brandGrey[500] },
  choiceTextActive: { color: colors.brandOrangeText, fontWeight: '800' },
  input: { backgroundColor: '#F0F2F5', borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '700', color: colors.brandBlack.main },
  calcBtn: { backgroundColor: colors.brandBlack.main, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  calcText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  
  resultContainer: { marginTop: 20 },
  summaryCard: { backgroundColor: colors.brandBlack.main, borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: colors.brandOrange, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  summaryTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  summaryTotal: { color: colors.brandOrange, fontSize: 32, fontWeight: '900', marginVertical: 8 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  costLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  costValue: { color: colors.white, fontSize: 14, fontWeight: '700' },
  editAccBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, borderRadius: 8 },
  editAccText: { color: colors.brandOrangeText, fontSize: 13, fontWeight: '700' },

  formulaTitle: { fontSize: 18, fontWeight: '900', color: colors.brandBlack.main, marginBottom: 12, marginLeft: 4 },
  formulaRow: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: colors.brandBlack.main, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  fName: { fontSize: 15, fontWeight: '800', color: colors.brandBlack.main, marginBottom: 4 },
  fFormula: { fontSize: 13, color: colors.brandOrangeText, fontWeight: '600' },
  fValue: { fontSize: 18, fontWeight: '900', color: colors.brandBlack.main, marginBottom: 2 },
  fMeta: { fontSize: 12, color: colors.brandGrey[500], fontWeight: '600' },
});
