import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { DashboardMetric } from '@eurohouse/types';

const metrics: DashboardMetric[] = [
  { label: 'Công trình', value: '12', trend: '+2 tháng này' },
  { label: 'Doanh số', value: '420tr', trend: '+18%' },
  { label: 'Lời/lỗ', value: '86tr', trend: 'Năm 2026' },
  { label: 'Điểm', value: '8.450', trend: 'Có thể đổi quà' },
];

const features = [
  { title: 'Tính & Báo giá', href: '/quote', description: 'Wizard tính cắt, kg nhôm và báo giá.' },
  { title: 'Bảo hành QR', href: '/quote', description: 'Placeholder quét QR kích hoạt bảo hành.' },
  { title: 'Đổi quà', href: '/quote', description: 'Placeholder ví điểm và quà tặng.' },
];

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>EUROHOUSE APP</Text>
        <Text style={styles.title}>Không gian làm việc cho thợ, đại lý và NPP</Text>
        <Text style={styles.subtitle}>Theo dõi công trình, tính báo giá, kích hoạt bảo hành và tích điểm.</Text>
        <Link href="/auth" style={styles.primaryButton}>Đăng nhập / Đăng ký</Link>
      </View>

      <View style={styles.grid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricTrend}>{metric.trend}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Tính năng chính</Text>
      {features.map((feature) => (
        <Link key={feature.title} href={feature.href} style={styles.featureCard}>
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: colors.white },
  hero: { backgroundColor: colors.orangeSoft, borderRadius: 24, padding: 24, gap: 12 },
  eyebrow: { color: colors.brandOrange, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.brandBlack, fontSize: 30, fontWeight: '900', lineHeight: 36 },
  subtitle: { color: colors.brandBlack, opacity: 0.72, fontSize: 16, lineHeight: 24 },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.brandOrange,
    color: colors.brandBlack,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  metricCard: { width: '48%', backgroundColor: colors.white, borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 18, padding: 16 },
  metricValue: { color: colors.brandBlack, fontSize: 24, fontWeight: '900' },
  metricLabel: { color: colors.brandGrey, fontWeight: '700', marginTop: 4 },
  metricTrend: { color: colors.success, fontSize: 12, marginTop: 6 },
  sectionTitle: { color: colors.brandBlack, fontSize: 22, fontWeight: '900', marginTop: 28, marginBottom: 12 },
  featureCard: { backgroundColor: colors.brandBlack, borderRadius: 18, padding: 18, marginBottom: 12, textDecorationLine: 'none' },
  featureTitle: { color: colors.brandOrange, fontSize: 18, fontWeight: '900' },
  featureDescription: { color: colors.white, opacity: 0.84, marginTop: 6, lineHeight: 20 },
});
