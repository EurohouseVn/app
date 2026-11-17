import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { EurohouseAccessCard } from '../src/components/EurohouseAccessCard';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { profileToolGroups } from '../src/lib/profileToolGroups';
import { summarizeProfileProjects } from '../src/lib/profileProjectStats';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import type { EurohouseAccessView } from '@eurohouse/types';
import { featureUiState } from '../src/lib/eurohouseFeatureAccess';

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  NPP: 'Nhà phân phối',
  DAILY: 'Đại lý',
  FACTORY: 'Thợ / Xưởng sản xuất',
};

type WorkshopProfile = {
  productionName?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  email?: string;
};

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [accessResult, setAccessResult] = useState<EurohouseAccessView | null>(null);
  const [formulaMessage, setFormulaMessage] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useResetScrollOnFocus(scrollRef);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([
        LocalProjectsApi.getAll().then(setProjects).catch(() => setProjects([])),
        api.get<WorkshopProfile>('/npp/profile').then(setProfile).catch(() => setProfile(null)),
        api.get<EurohouseAccessView>('/eurohouse-access/me').then(setAccessResult).catch(() => setAccessResult(null)),
      ]);
    }, []),
  );

  const { projectCount, totalRevenue, totalProfit, margin } = summarizeProfileProjects(projects);
  const roleLabel = user ? roleLabels[user.role] ?? user.role : '';
  const accessView = accessResult ?? user?.capabilities.eurohouse;
  const formulaState = featureUiState(accessView?.features.FORMULA_CUTTING);
  const orderingState = featureUiState(accessView?.features.EUROHOUSE_ORDERING);
  const featureRows = [
    { label: 'Công thức cắt Eurohouse', state: formulaState },
    { label: 'Đặt hàng Nhôm Eurohouse', state: orderingState },
  ];
  const hasInactiveFeature = featureRows.some((row) => !row.state.active);

  async function redeemEurohouseInvite() {
    if (inviteCode.trim().length < 8) { setFormulaMessage('Vui lòng nhập mã mời hợp lệ từ NPP.'); return; }
    setRedeeming(true); setFormulaMessage('');
    try {
      const result = await api.post<EurohouseAccessView>('/eurohouse-access/redeem', { code: inviteCode.trim() });
      setAccessResult(result);
      setInviteCode('');
      await refreshUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setFormulaMessage(message.includes('EXPIRED') ? 'Mã mời đã hết hạn. Vui lòng liên hệ NPP để nhận mã mới.' : message.includes('INVALID') ? 'Mã mời không hợp lệ hoặc đã được sử dụng.' : message || 'Chưa thể kích hoạt quyền Eurohouse.');
    } finally { setRedeeming(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.brandGrey[50] || '#FAFAFA' }}>
      <AppHeader title="Khu làm việc" subtitle={roleLabel || 'Eurohouse'} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <Pressable style={styles.avatar} onPress={() => router.push('/edit-profile')}>
            {profile?.logoUrl ? <Image source={{ uri: assetUrl(profile.logoUrl) || profile.logoUrl }} style={styles.avatarImage} resizeMode="cover" /> : <Icon name="user" size={24} color={colors.brandOrange} />}
          </Pressable>
          <View style={styles.profileCopy}>
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
              {profile?.productionName || user?.displayName || 'Người dùng'}
            </Text>
            <Text style={styles.area}>{profile?.phone || profile?.email || user?.email || ''}</Text>
            {profile?.address ? <Text style={styles.address} numberOfLines={1}>{profile.address}</Text> : null}
          </View>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/edit-profile')}><Icon name="edit-2" size={18} color={colors.brandGrey[500]} /></Pressable>
        </View>

        <View style={styles.formulaCard}>
          <View style={styles.formulaHeading}>
            <View style={styles.formulaIcon}><Icon name="lock" size={20} color={colors.brandOrangeText} /></View>
            <View style={styles.formulaHeadingCopy}>
              <Text style={styles.formulaTitle}>Quyền sử dụng Eurohouse</Text>
              <Text style={styles.formulaStatus}>{accessView?.nppOrganizationName ? `NPP phụ trách: ${accessView.nppOrganizationName}` : 'Chưa liên kết NPP'}</Text>
            </View>
          </View>
          <View style={styles.featureRows}>
            {featureRows.map((row) => <View key={row.label} style={styles.featureRow}>
              <View style={styles.featureCopy}><Text style={styles.featureLabel}>{row.label}</Text><Text style={styles.featureMessage}>{row.state.message}</Text></View>
              <View style={[styles.featureStatusPill, row.state.active && styles.featureStatusActive]}><Text style={[styles.featureStatusText, row.state.active && styles.featureStatusTextActive]}>{row.state.statusLabel}</Text></View>
            </View>)}
          </View>
          {hasInactiveFeature ? <>
            <Text style={styles.formulaCopy}>Nhập mã mời do NPP khu vực cấp. Mã mời sẽ liên kết cơ sở với NPP phát hành và chỉ mở các quyền đã được cấp.</Text>
            <TextInput value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" placeholder="Nhập mã mời NPP" placeholderTextColor="#98A2B3" style={styles.inviteInput} />
            {formulaMessage ? <Text style={styles.formulaError}>{formulaMessage}</Text> : null}
            <Pressable disabled={redeeming} style={({ pressed }) => [styles.activateButton, pressed && { opacity: 0.86 }, redeeming && { opacity: 0.6 }]} onPress={redeemEurohouseInvite}>{redeeming ? <ActivityIndicator color={colors.white} /> : <Text style={styles.activateButtonText}>Kích hoạt mã mời</Text>}</Pressable>
          </> : <View style={styles.formulaSuccess}><Text style={styles.formulaSuccessTitle}>Các quyền Eurohouse đã sẵn sàng</Text><Text style={styles.formulaSuccessMeta}>Bạn có thể dùng từng module theo trạng thái hiển thị ở trên.</Text></View>}
        </View>

        <EurohouseAccessCard />

        <Pressable accessibilityRole="button" onPress={() => router.push('/loyalty')} style={({ pressed }) => [styles.pointsCard, pressed && { opacity: 0.88 }]}>
            <View style={styles.pointsIcon}><Icon name="gift" size={20} color={colors.brandOrangeText} /></View>
            <View style={styles.pointsCopy}>
              <Text style={styles.pointsLabel}>Điểm thưởng Eurohouse</Text>
              <Text style={styles.pointsValue}>{(user?.points ?? 0).toLocaleString('vi-VN')} điểm</Text>
              <Text style={styles.pointsHint}>Tích 5 điểm cho mỗi 100 kg nhôm Eurohouse đặt qua NPP</Text>
            </View>
            <Text style={styles.pointsAction}>Đổi quà</Text>
        </Pressable>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Icon name="layers" size={18} color={colors.brandOrange} />
            <Text style={styles.kpiValue}>{projectCount}</Text>
            <Text style={styles.kpiLabel}>Công trình</Text>
          </View>
          <View style={styles.kpiCard}>
            <Icon name="trending-up" size={18} color="#2F6FED" />
            <Text style={styles.kpiValue}>{(totalRevenue / 1000000).toFixed(0)}tr</Text>
            <Text style={styles.kpiLabel}>Doanh thu</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.white }]}>
            <Icon name="award" size={18} color={colors.brandOrangeText} />
            <Text style={[styles.kpiValue, { color: colors.brandOrangeText }]}>{(totalProfit / 1000000).toFixed(0)}tr</Text>
            <Text style={[styles.kpiLabel, { color: colors.brandGrey[500] }]}>Lãi · {margin.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={styles.workspaceSections}>
          {profileToolGroups.map((group) => (
            <View key={group.title} style={styles.toolGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.toolGroupCard}>
                {group.tools.map((tool, index) => (
                  <View key={tool.label}>
                    <Link href={tool.href as Href} asChild>
                      <Pressable style={styles.toolItem}>
                        <View style={styles.toolIcon}>
                          <Icon name={tool.icon as IconName} size={20} color={tool.fg} />
                        </View>
                        <View style={styles.toolCopy}>
                          <Text style={styles.toolLabel}>{tool.label}</Text>
                          <Text style={styles.toolDesc}>{tool.desc}</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color={colors.brandGrey[400]} />
                      </Pressable>
                    </Link>
                    {index < group.tools.length - 1 ? <View style={styles.toolItemDivider} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 22, padding: 14, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  formulaCard: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#F0DFD0', gap: 12 },
  formulaHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  formulaIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  formulaHeadingCopy: { flex: 1, minWidth: 0 }, formulaTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 }, formulaStatus: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 12, marginTop: 3 },
  featureRows: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 14, overflow: 'hidden' },
  featureRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  featureCopy: { flex: 1, minWidth: 0 },
  featureLabel: { color: colors.brandBlack.main, fontSize: 13, fontWeight: '900' },
  featureMessage: { color: colors.brandGrey[500], fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  featureStatusPill: { borderRadius: 999, backgroundColor: '#F2F4F7', paddingHorizontal: 9, paddingVertical: 6 },
  featureStatusActive: { backgroundColor: '#E8F7F2' },
  featureStatusText: { color: colors.brandGrey[600], fontSize: 10.5, fontWeight: '900' },
  featureStatusTextActive: { color: '#087F6A' },
  formulaCopy: { color: colors.brandGrey[600], fontSize: 13, lineHeight: 19 },
  inviteInput: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#E7D8CA', backgroundColor: '#FFFDFC', paddingHorizontal: 14, color: colors.brandBlack.main, fontSize: 15, fontWeight: '700' },
  formulaError: { color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  activateButton: { minHeight: 48, borderRadius: 13, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center' }, activateButtonText: { color: colors.white, fontWeight: '900', fontSize: 14 },
  formulaSuccess: { borderRadius: 13, backgroundColor: '#EEF9F5', padding: 13 }, formulaSuccessTitle: { color: '#066B57', fontWeight: '900', fontSize: 13 }, formulaSuccessMeta: { color: '#52756B', fontSize: 12, marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImage: { width: 48, height: 48, borderRadius: 16 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15, lineHeight: 20 },
  area: { color: colors.brandGrey[500], marginTop: 2, fontSize: 12 },
  address: { color: colors.brandGrey[500], marginTop: 2, fontSize: 12 },
  settingsBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 16, borderRadius: 20, backgroundColor: colors.orangeSoft, borderWidth: 1, borderColor: '#FED7AA' },
  pointsIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pointsCopy: { flex: 1 },
  pointsLabel: { color: colors.brandGrey[600], fontSize: 12, fontWeight: '700' },
  pointsValue: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900', marginTop: 2 },
  pointsHint: { color: colors.brandGrey[500], fontSize: 11, lineHeight: 15, marginTop: 3 },
  pointsAction: { color: colors.brandOrangeText, fontSize: 13, fontWeight: '900' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 6, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  kpiValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 20 },
  kpiLabel: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 11 },
  workspaceSections: { marginTop: 24, gap: 22 },
  toolGroup: { gap: 10 },
  groupTitle: { color: colors.brandBlack.main, fontSize: 15, fontWeight: '900', paddingHorizontal: 2 },
  toolGroupCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E7E9ED', overflow: 'hidden' },
  toolItem: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  toolItemDivider: { height: 1, backgroundColor: '#EEF0F3', marginLeft: 66 },
  toolIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toolCopy: { flex: 1, minWidth: 0 },
  toolLabel: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  toolDesc: { color: colors.brandGrey[500], fontSize: 11.5, marginTop: 2 },
});
