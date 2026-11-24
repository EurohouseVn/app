import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EurohouseAccessView } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { Card, IconButton, ListRow, SectionHead, ws, wsStyles } from '../src/components/ws';
import { confirmAction } from '../src/lib/alert';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { featureUiState } from '../src/lib/eurohouseFeatureAccess';
import { compactMoney } from '../src/lib/invoiceState';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { profileToolGroups, type ProfileToolDefinition } from '../src/lib/profileToolGroups';
import { summarizeProfileProjects } from '../src/lib/profileProjectStats';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';

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

function initials(name: string): string {
  const letters = name.split(/\s+/).map((part) => part.match(/[A-Za-zÀ-ỹ]/)?.[0] ?? '').filter(Boolean);
  return (letters.slice(0, 2).join('') || 'EH').toUpperCase();
}

function inviteError(message: string): string {
  if (message.includes('EXPIRED')) return 'Mã mời đã hết hạn. Liên hệ NPP để nhận mã mới.';
  if (message.includes('INVALID')) return 'Mã mời không hợp lệ hoặc đã được dùng.';
  return message || 'Chưa kích hoạt được mã mời.';
}

export default function ProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  const [accessResult, setAccessResult] = useState<EurohouseAccessView | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
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
  const featureRows = [
    { label: 'Đặt hàng nhôm Eurohouse', hint: 'Đặt theo hệ, màu, gửi NPP', state: featureUiState(accessView?.features.EUROHOUSE_ORDERING) },
    { label: 'Công thức cắt Eurohouse', hint: 'NPP mở cho từng cơ sở', state: featureUiState(accessView?.features.FORMULA_CUTTING) },
  ];
  const hasInactiveFeature = featureRows.some((row) => !row.state.active);
  const name = profile?.productionName || user?.organizationName || user?.displayName || 'Người dùng';
  const contact = [profile?.email || user?.email, profile?.phone].filter(Boolean).join(' · ');

  async function redeem() {
    if (inviteCode.trim().length < 8) { setInviteMessage('Nhập mã mời hợp lệ do NPP cấp.'); return; }
    setRedeeming(true);
    setInviteMessage('');
    try {
      setAccessResult(await api.post<EurohouseAccessView>('/eurohouse-access/redeem', { code: inviteCode.trim() }));
      setInviteCode('');
      await refreshUser();
    } catch (error) {
      setInviteMessage(inviteError(error instanceof Error ? error.message : ''));
    } finally {
      setRedeeming(false);
    }
  }

  function openTool(tool: ProfileToolDefinition) {
    if (tool.external) void Linking.openURL(tool.href);
    else router.push(tool.href as Href);
  }

  return (
    <View style={wsStyles.screen}>
      <AppHeader title="Tài khoản" subtitle={roleLabel || 'Eurohouse'} />
      <ScrollView ref={scrollRef} contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card padded={false}>
          <View style={styles.who}>
            <Pressable accessibilityLabel="Sửa hồ sơ cơ sở" onPress={() => router.push('/edit-profile')} style={styles.avatar}>
              {profile?.logoUrl ? <Image source={{ uri: assetUrl(profile.logoUrl) || profile.logoUrl }} style={styles.avatarImage} resizeMode="cover" /> : <Text style={styles.avatarText}>{initials(name)}</Text>}
            </Pressable>
            <View style={wsStyles.grow}>
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              {contact ? <Text style={wsStyles.rowMeta} numberOfLines={1}>{contact}</Text> : null}
              {profile?.address ? <Text style={wsStyles.rowMeta} numberOfLines={1}>{profile.address}</Text> : null}
            </View>
            <IconButton icon="edit-2" label="Sửa hồ sơ cơ sở" onPress={() => router.push('/edit-profile')} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Đổi quà" onPress={() => router.push('/loyalty')} style={({ pressed }) => [styles.points, pressed && { opacity: 0.85 }]}>
            <Icon name="gift" size={18} color={ws.orangeText} />
            <View style={wsStyles.grow}>
              <Text style={styles.pointsLabel}>Điểm thưởng</Text>
              <Text style={styles.pointsValue}>{(user?.points ?? 0).toLocaleString('vi-VN')} điểm</Text>
            </View>
            <View style={styles.softButton}><Text style={styles.softButtonText}>Đổi quà</Text></View>
          </Pressable>
        </Card>

        <View style={[wsStyles.row, styles.gapTop]}>
          <Card style={styles.kpi}><Text style={styles.kpiLabel}>Công trình</Text><Text style={styles.kpiValue}>{projectCount}</Text></Card>
          <Card style={styles.kpi}><Text style={styles.kpiLabel}>Doanh thu</Text><Text style={styles.kpiValue}>{compactMoney(totalRevenue)}</Text></Card>
          <Card style={styles.kpi}><Text style={styles.kpiLabel}>Lãi · {margin.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</Text><Text style={styles.kpiValue}>{compactMoney(totalProfit)}</Text></Card>
        </View>

        <SectionHead title="Quyền Eurohouse" sub={accessView?.nppOrganizationName ? `NPP phụ trách: ${accessView.nppOrganizationName}` : 'Chưa liên kết NPP'} />
        <Card padded={false}>
          {featureRows.map((row, index) => (
            <View key={row.label} style={[styles.accessRow, index > 0 && styles.divider]}>
              <View style={wsStyles.grow}>
                <Text style={styles.accessTitle}>{row.label}</Text>
                <Text style={wsStyles.rowMeta}>{row.state.active ? row.hint : row.state.message}</Text>
              </View>
              <View style={[styles.pill, row.state.active && styles.pillOn]}><Text style={[styles.pillText, row.state.active && styles.pillTextOn]}>{row.state.statusLabel}</Text></View>
            </View>
          ))}
          {hasInactiveFeature ? (
            <View style={[styles.invite, styles.divider]}>
              <View style={styles.inviteRow}>
                <TextInput value={inviteCode} onChangeText={setInviteCode} autoCapitalize="characters" placeholder="Nhập mã mời NPP" placeholderTextColor={ws.faint} style={styles.inviteInput} />
                <Pressable accessibilityRole="button" disabled={redeeming} onPress={() => void redeem()} style={({ pressed }) => [styles.inviteButton, (pressed || redeeming) && { opacity: 0.8 }]}>
                  <Text style={styles.inviteButtonText}>{redeeming ? 'Đang xử lý' : 'Kích hoạt'}</Text>
                </Pressable>
              </View>
              <Text style={[wsStyles.hint, inviteMessage ? { color: ws.dangerText } : null]}>{inviteMessage || 'Mã mời do NPP khu vực cấp, chỉ mở các quyền NPP đã chọn.'}</Text>
            </View>
          ) : null}
        </Card>

        {profileToolGroups.map((group) => (
          <View key={group.title}>
            <SectionHead title={group.title} />
            <Card padded={false}>
              {group.tools.map((tool, index) => (
                <ListRow key={tool.label} first={index === 0} onPress={() => openTool(tool)} label={tool.label}>
                  <View style={[styles.toolIcon, { backgroundColor: tool.bg }]}><Icon name={tool.icon as IconName} size={17} color={tool.fg} /></View>
                  <View style={wsStyles.grow}>
                    <Text style={wsStyles.rowTitle}>{tool.label}</Text>
                    <Text style={wsStyles.rowMeta}>{tool.desc}</Text>
                  </View>
                  <Icon name={tool.external ? 'external-link' : 'chevron-right'} size={17} color={ws.faint} />
                </ListRow>
              ))}
            </Card>
          </View>
        ))}

        <Pressable accessibilityRole="button" onPress={() => confirmAction('Đăng xuất', 'Đăng xuất khỏi tài khoản trên thiết bị này?', logout, 'Đăng xuất')} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}>
          <Icon name="log-out" size={16} color={ws.danger} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
        {user && (user.role === 'FACTORY' || user.role === 'DAILY') ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Xoá tài khoản" onPress={() => router.push('/delete-account')} style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.7 }]}>
            <Text style={styles.deleteLinkText}>Xoá tài khoản</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#FCB042', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  name: { color: ws.ink, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  points: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: ws.lineSoft, backgroundColor: '#FFFBF7' },
  pointsLabel: { color: ws.muted, fontSize: 11.5, fontWeight: '700' },
  pointsValue: { color: ws.orangeText, fontSize: 16, fontWeight: '900' },
  softButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: ws.orangeSoft },
  softButtonText: { color: ws.orangeText, fontSize: 12.5, fontWeight: '800' },
  kpi: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9 },
  kpiLabel: { color: ws.muted, fontSize: 10.5, fontWeight: '700' },
  kpiValue: { color: ws.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: ws.lineSoft },
  accessTitle: { color: ws.ink, fontSize: 13.5, fontWeight: '800' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F2F4F7' },
  pillOn: { backgroundColor: ws.successBg },
  pillText: { color: '#475467', fontSize: 10.5, fontWeight: '800' },
  pillTextOn: { color: ws.success },
  invite: { padding: 12 },
  inviteRow: { flexDirection: 'row', gap: 8 },
  inviteInput: { flex: 1, minWidth: 0, height: 42, borderWidth: 1, borderColor: ws.field, borderRadius: 10, paddingHorizontal: 12, color: ws.ink, fontSize: 13.5, backgroundColor: ws.surface },
  inviteButton: { height: 42, paddingHorizontal: 14, borderRadius: 10, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  inviteButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  toolIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logout: { marginTop: 16, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: ws.surface },
  logoutText: { color: ws.danger, fontSize: 14, fontWeight: '800' },
  deleteLink: { marginTop: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteLinkText: { color: ws.muted, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
