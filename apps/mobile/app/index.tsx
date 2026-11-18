import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useFocusEffect, useRouter, type Href } from 'expo-router';
import { Dimensions, Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import type { Promotion, WorkforceDashboard, WorkshopReminder } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { Banner, Card, ListRow, Loading, SectionHead, Sheet, ws, wsStyles } from '../src/components/ws';
import { actionGroups, isActionLocked, primaryActions, type HomeAction } from '../src/lib/homeActions';
import { compactMoney } from '../src/lib/invoiceState';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { homeProjects } from '../src/lib/projectListState';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { formulaUiState } from '../src/lib/formulaAccess';
import { featureUiState } from '../src/lib/eurohouseFeatureAccess';
import { fetchWeatherForecast, initialWeatherLocation, weatherIcon, weatherText } from '../src/lib/weather';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import headerWorkshop from '../assets/header-workshop-focus-v2.jpg';
import logo from '../assets/logo-mark.png';
import houseBg from '../assets/header-house.jpg';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Workspace = {
  role: 'OWNER' | 'WORKSHOP_MANAGER' | 'SUPERVISOR' | 'WORKER' | 'INSTALLER' | 'ADMIN';
  primarySurface: string;
  capabilities: string[];
};

const workspaceCopy: Record<Workspace['role'], { title: string; detail: string }> = {
  OWNER: { title: 'Tổng quan vận hành', detail: 'Theo dõi xưởng, phân công và tiến độ hôm nay' },
  WORKSHOP_MANAGER: { title: 'Điều hành xưởng', detail: 'Việc đang chạy, QC và lịch lắp đặt' },
  SUPERVISOR: { title: 'Trạng thái xưởng', detail: 'Phân công và xử lý điểm nghẽn' },
  WORKER: { title: 'Việc của tôi hôm nay', detail: 'Mở lệnh việc, làm và xác nhận hoàn tất' },
  INSTALLER: { title: 'Lắp đặt hôm nay', detail: 'Lịch đi công trình, ảnh và nghiệm thu' },
  ADMIN: { title: 'Bảng điều hành', detail: 'Sức khỏe pilot và hoạt động các xưởng' },
};

type WeatherData = {
  temperature: number;
  humidity: number;
  wind: number;
  code: number;
  label: string;
};

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function todayLabel(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function formatDue(reminder: WorkshopReminder): string {
  const due = new Date(reminder.dueAt);
  const sameDay = due.toDateString() === new Date().toDateString();
  return `${sameDay ? 'Hôm nay' : due.toLocaleDateString('vi-VN')} · ${due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function HomeScreen() {
  const { sessionTier } = useAuth();
  return sessionTier === 'GUEST' ? <GuestHome /> : <AuthenticatedHomeScreen />;
}

function GuestHome() {
  const insets = useSafeAreaInsets();
  const { leaveGuestMode } = useAuth();
  const freeTools: Array<{ label: string; detail: string; icon: IconName; href: Href }> = [
    { label: 'Thời tiết', detail: 'Theo dõi thời tiết thi công', icon: 'cloud', href: '/weather' },
    { label: 'Chấm công', detail: 'Lưu trực tiếp trên thiết bị', icon: 'clock', href: '/workforce' },
    { label: 'Lập báo giá', detail: 'Tính và lưu báo giá thủ công', icon: 'file-text', href: '/quote' },
  ];
  const discovery: Array<{ label: string; icon: IconName; href: Href }> = [
    { label: 'Catalog hệ nhôm', icon: 'layout', href: '/catalog' },
    { label: 'Thư viện hình ảnh', icon: 'image', href: '/library' },
    { label: 'Kiến thức ngành', icon: 'book-open', href: '/knowledge' },
    { label: 'Chương trình Eurohouse', icon: 'gift', href: '/promo' },
  ];
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.guestContent, { paddingTop: insets.top + 12 }]}>
    <ImageBackground source={headerWorkshop} style={styles.guestHero} imageStyle={styles.guestHeroImage}>
      <View style={styles.guestHeroShade} />
      <View style={styles.guestBrandRow}><Image source={logo} style={styles.guestLogo} /><View><Text style={styles.guestBrand}>EUROHOUSE</Text><Text style={styles.guestBrandSub}>Trợ lý nghề nhôm kính</Text></View></View>
      <View><Text style={styles.guestHeadline}>Làm việc gọn hơn.{`\n`}Hiểu nhôm sâu hơn.</Text><Text style={styles.guestLead}>Dùng ngay các tiện ích cơ bản, không cần tạo tài khoản.</Text></View>
    </ImageBackground>

    <Text style={styles.guestEyebrow}>Dùng miễn phí</Text>
    <Text style={styles.guestSectionTitle}>Công cụ cần thiết mỗi ngày</Text>
    <View style={styles.guestToolGrid}>{freeTools.map((tool) => <Link key={tool.label} href={tool.href} asChild><Pressable style={styles.guestToolCard}><View style={styles.guestToolIcon}><Icon name={tool.icon} size={21} color={colors.brandOrangeText} /></View><Text style={styles.guestToolTitle}>{tool.label}</Text><Text style={styles.guestToolText}>{tool.detail}</Text></Pressable></Link>)}</View>

    <Text style={styles.guestEyebrow}>Khám phá Eurohouse</Text>
    <Text style={styles.guestSectionTitle}>Nhôm hệ cao cấp cho công trình và sản xuất</Text>
    <View style={styles.guestDiscovery}>{discovery.map((item) => <Link key={item.label} href={item.href} asChild><Pressable style={styles.guestDiscoveryRow}><View style={styles.guestDiscoveryIcon}><Icon name={item.icon} size={20} color="#9A3E08" /></View><Text style={styles.guestDiscoveryText}>{item.label}</Text><Icon name="chevron-right" size={18} color="#98A2B3" /></Pressable></Link>)}</View>

    <View style={styles.guestUpgrade}>
      <Text style={styles.guestUpgradeTitle}>Mở thêm tính năng quản lý</Text>
      <Text style={styles.guestUpgradeText}>Tạo tài khoản miễn phí để quản lý công trình, khách hàng, thu–chi, công nợ và bảng lương trên nhiều phiên sử dụng.</Text>
      <Pressable onPress={() => void leaveGuestMode()} style={styles.guestUpgradeButton}><Text style={styles.guestUpgradeButtonText}>Đăng nhập / Đăng ký</Text></Pressable>
    </View>
  </ScrollView>;
}

function AuthenticatedHomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const promoGalleryRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceDashboard | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const router = useRouter();

  useResetScrollOnFocus(mainScrollRef);

  const loadWeather = useCallback(async () => {
    try {
      const location = await initialWeatherLocation(user?.organizationProvince);
      const forecast = await fetchWeatherForecast(location);
      setWeather({
        temperature: forecast.current.temperature,
        humidity: forecast.current.humidity,
        wind: forecast.current.wind,
        code: forecast.current.code,
        label: location.label,
      });
    } catch {
      setWeather(null);
    }
  }, [user?.organizationProvince]);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const audience = user?.role === 'NPP' || user?.role === 'DAILY' ? 'NPP_DEALER' : 'WORKER';
      const calls = [api.get<Promotion[]>(`/content/promotions?audience=${audience}`), LocalProjectsApi.getAll(), user?.role === 'FACTORY' || user?.role === 'DAILY' ? api.get<WorkforceDashboard>('/workforce/dashboard') : Promise.resolve(null), loadWeather(), api.get<Workspace>('/workshop/v2/workspace')] as const;
      const [promoResult, projectResult, workforceResult, , workspaceResult] = await Promise.allSettled(calls);
      const failures: string[] = [];
      if (promoResult.status === 'fulfilled') {
        setPromos(promoResult.value);
        setPromoIndex(0);
      } else failures.push('khuyến mại');
      if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
      else failures.push('công trình');
      if (workforceResult.status === 'fulfilled') setWorkforce(workforceResult.value);
      else failures.push('vận hành xưởng');
      if (workspaceResult.status === 'fulfilled') setWorkspace(workspaceResult.value);
      if (failures.length) setError(`Chưa tải được ${failures.join(', ')}. Kéo xuống để thử lại.`);
      setLoading(false);
      setRefreshing(false);
    },
    [loadWeather, user?.role],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (promos.length <= 1) return undefined;
    const timer = setInterval(() => setPromoIndex((current) => (current + 1) % promos.length), 5000);
    return () => clearInterval(timer);
  }, [promos.length]);

  const promo = promos[promoIndex] ?? null;
  const modalImages = useMemo(() => {
    if (!selectedPromo) return [];
    const gallery = Array.isArray(selectedPromo.gallery) ? selectedPromo.gallery : [];
    return gallery.length ? gallery : selectedPromo.imageUrl ? [selectedPromo.imageUrl] : [];
  }, [selectedPromo]);

  const focus = useMemo(() => homeProjects(projects, Date.now()), [projects]);
  const formulaState = formulaUiState(user?.capabilities.eurohouse.features.FORMULA_CUTTING ?? user?.capabilities.formulas);
  const orderingState = featureUiState(user?.capabilities.eurohouse.features.EUROHOUSE_ORDERING);

  function changeModalImage(delta: number) {
    if (modalImages.length === 0) return;
    const next = (selectedImageIndex + delta + modalImages.length) % modalImages.length;
    setSelectedImageIndex(next);
    promoGalleryRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }

  const reminders = workforce?.reminders ?? [];
  const access = { ordering: orderingState.active, formulas: !formulaState.showLockedScreen };
  const tiles = primaryActions();
  const todaySub = workforce
    ? `${workforce.workerCount} thợ · tháng ${Number(workforce.month.slice(5, 7))} ${workforce.monthClosed ? 'đã chốt lương' : 'chưa chốt lương'}`
    : workspace ? workspaceCopy[workspace.role].detail : 'Nhân sự và việc trong ngày';

  const renderTile = (action: HomeAction, onPress?: () => void) => {
    const locked = isActionLocked(action, access);
    const body = (
      <Pressable accessibilityRole="button" accessibilityLabel={locked ? `${action.label} (chưa kích hoạt)` : action.label} onPress={onPress ?? (() => { setActionsOpen(false); router.push(action.href as Href); })} style={({ pressed }) => [hs.tile, pressed && { opacity: 0.8 }]}>
        <View style={[hs.tileIcon, { backgroundColor: locked ? '#EEF0F3' : action.bg }]}>
          <Icon name={action.icon as IconName} size={21} color={locked ? '#667085' : action.color} />
        </View>
        <Text style={hs.tileLabel} numberOfLines={2}>{action.label}</Text>
        {locked ? <View style={hs.tileLock}><Icon name="lock" size={10} color="#667085" /></View> : null}
      </Pressable>
    );
    return <View key={action.key} style={hs.tileWrap}>{body}</View>;
  };

  return (
    <View style={hs.screen}>
      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={ws.orange} />} contentContainerStyle={hs.scrollContent}>
        <ImageBackground source={houseBg} style={[hs.hero, { paddingTop: Math.max(46, insets.top + 14) }]} imageStyle={hs.heroImage} resizeMode="cover">
          <View style={hs.heroShade} />
          <View style={hs.heroRow}>
            <View style={hs.logoFrame}><Image source={logo} style={hs.logo} resizeMode="contain" /></View>
            <View style={wsStyles.grow}>
              <Text style={hs.greeting}>{greeting()},</Text>
              <Text style={hs.orgName} numberOfLines={2}>{user?.organizationName ?? 'Cơ sở sản xuất Eurohouse'}</Text>
            </View>
            <Link href="/reminders" asChild>
              <Pressable accessibilityLabel="Mở nhắc việc" style={hs.heroButton}>
                <Icon name="bell" size={19} color="#FFFFFF" />
                {reminders.length > 0 ? <View style={hs.dot} /> : null}
              </Pressable>
            </Link>
          </View>
          <View style={hs.chips}>
            <View style={hs.chip}>
              <Icon name="calendar" size={14} color="#FFFFFF" />
              <Text style={hs.chipText}>{todayLabel()}</Text>
            </View>
            <Link href="/weather" asChild>
              <Pressable accessibilityLabel="Xem dự báo thời tiết" style={hs.chip}>
                <Icon name={weather ? weatherIcon(weather.code) : 'cloud'} size={14} color="#FFFFFF" />
                {weather ? <Text style={hs.chipStrong}>{Math.round(weather.temperature)}°</Text> : null}
                <Text style={hs.chipText} numberOfLines={1}>{weather ? weatherText(weather.code) : 'Thời tiết'}</Text>
                <Icon name="chevron-right" size={13} color="#FFFFFF" />
              </Pressable>
            </Link>
          </View>
        </ImageBackground>

        <View style={hs.body}>
          {error ? <View style={hs.gapBottom}><Banner tone="error" title="Chưa tải đủ dữ liệu" text={error} onPress={() => void loadDashboard(true)} /></View> : null}

          <Card padded={false}>
            <View style={hs.todayHead}>
              <View style={wsStyles.grow}>
                <Text style={hs.todayTitle}>Hôm nay</Text>
                <Text style={wsStyles.rowMeta} numberOfLines={1}>{todaySub}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => router.push('/workforce')} style={({ pressed }) => [hs.smallButton, pressed && { opacity: 0.85 }]}>
                <Icon name="user-check" size={15} color="#FFFFFF" />
                <Text style={hs.smallButtonText}>Chấm công</Text>
              </Pressable>
            </View>
            <Pressable accessibilityLabel="Mở Quản lý xưởng" onPress={() => router.push('/workforce')} style={hs.kpis}>
                <View style={hs.kpi}><Text style={hs.kpiValue}>{workforce ? `${workforce.presentCount}/${workforce.workerCount}` : '–'}</Text><Text style={hs.kpiLabel}>Có mặt</Text></View>
                <View style={[hs.kpi, hs.kpiDivider]}><Text style={hs.kpiValue}>{workforce ? `${workforce.overtimeHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} g` : '–'}</Text><Text style={hs.kpiLabel}>Tăng ca</Text></View>
                <View style={[hs.kpi, hs.kpiDivider]}><Text style={hs.kpiValue}>{workforce ? compactMoney(workforce.estimatedPayroll) : '–'}</Text><Text style={hs.kpiLabel}>Lương dự tính</Text></View>
            </Pressable>
            {reminders.length ? reminders.slice(0, 2).map((reminder) => (
              <Pressable key={reminder.id} onPress={() => router.push('/reminders')} style={({ pressed }) => [hs.reminder, pressed && { backgroundColor: '#F9FAFB' }]}>
                  <Icon name="calendar" size={16} color={reminder.priority === 'HIGH' ? ws.danger : ws.warning} />
                  <View style={wsStyles.grow}>
                    <Text style={hs.reminderTitle} numberOfLines={1}>{reminder.title}</Text>
                    <Text style={wsStyles.rowMeta}>{formatDue(reminder)}</Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={ws.faint} />
              </Pressable>
            )) : (
              <Pressable onPress={() => router.push('/reminders')} style={({ pressed }) => [hs.reminder, pressed && { backgroundColor: '#F9FAFB' }]}>
                  <Icon name="check-circle" size={16} color={ws.success} />
                  <View style={wsStyles.grow}>
                    <Text style={hs.reminderTitle}>Không có việc cần nhắc</Text>
                    <Text style={wsStyles.rowMeta}>Bấm để thêm nhắc việc</Text>
                  </View>
                  <Icon name="plus" size={16} color={ws.orangeText} />
              </Pressable>
            )}
          </Card>

          <SectionHead title="Tiện ích" />
          <Card padded={false}>
            <View style={hs.tiles}>
              {tiles.map((action) => (action.key === 'all' ? renderTile(action, () => setActionsOpen(true)) : renderTile(action)))}
            </View>
          </Card>

          <SectionHead
            title="Công trình cần chú ý"
            sub={focus.running || focus.totalDue ? `${focus.running} đang thi công · còn phải thu ${compactMoney(focus.totalDue)}` : undefined}
            action={<Link href="/projects" style={hs.seeAll}>Xem tất cả</Link>}
          />
          {loading && !projects.length ? <Loading text="Đang tải công trình..." /> : focus.items.length === 0 ? (
            <Card padded={false}>
              <ListRow first onPress={() => router.push('/projects')} label="Mở Công trình">
                <View style={wsStyles.avatar}><Icon name="briefcase" size={17} color={ws.orangeText} /></View>
                <View style={wsStyles.grow}><Text style={wsStyles.rowTitle}>Chưa có công trình đang chạy</Text><Text style={wsStyles.rowMeta}>Tạo công trình từ báo giá để theo dõi tiến độ và tiền thu</Text></View>
                <Icon name="chevron-right" size={18} color={ws.faint} />
              </ListRow>
            </Card>
          ) : (
            <Card padded={false}>
              {focus.items.map(({ project, reason, tone }, index) => (
                <ListRow key={project.id} first={index === 0} onPress={() => router.push(`/project/${project.id}` as Href)} label={`Mở công trình ${project.name}`}>
                  <View style={wsStyles.avatar}><Icon name="briefcase" size={17} color={ws.orangeText} /></View>
                  <View style={wsStyles.grow}>
                    <Text style={wsStyles.rowTitle} numberOfLines={1}>{project.name}</Text>
                    <Text style={wsStyles.rowMeta} numberOfLines={1}>{[project.customerName, project.code].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={[hs.reason, tone === 'danger' && { color: ws.dangerText }, tone === 'warning' && { color: ws.warning }]} numberOfLines={2}>{reason}</Text>
                </ListRow>
              ))}
            </Card>
          )}

          {promo ? (
            <>
              <SectionHead title="Tin Eurohouse" action={promos.length > 1 ? <Text style={hs.seeAll}>{promoIndex + 1}/{promos.length}</Text> : undefined} />
              <Pressable accessibilityLabel="Xem tin Eurohouse" style={hs.poster} onPress={() => { setSelectedPromo(promo); setSelectedImageIndex(0); }}>
                {promo.imageUrl ? <Image source={{ uri: assetUrl(promo.imageUrl) }} style={hs.posterImage} resizeMode="cover" /> : null}
                <View style={hs.posterTag}><Text style={hs.posterTagText}>Khuyến mại</Text></View>
              </Pressable>
              {promos.length > 1 ? <View style={hs.dots}>{promos.map((p, i) => <View key={p.id ?? i} style={[hs.dotItem, i === promoIndex && hs.dotOn]} />)}</View> : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Tất cả tiện ích">
        {actionGroups().map((group) => (
          <View key={group.title} style={hs.sheetGroup}>
            <Text style={hs.sheetGroupTitle}>{group.title.toUpperCase()}</Text>
            <View style={hs.tiles}>{group.actions.map((action) => renderTile(action))}</View>
          </View>
        ))}
      </Sheet>

      <Modal visible={!!selectedPromo} transparent animationType="fade" onRequestClose={() => setSelectedPromo(null)}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Đóng ảnh khuyến mại" style={[styles.modalClose, { top: Math.max(24, insets.top + 8) }]} onPress={() => setSelectedPromo(null)}>
            <Icon name="x" size={22} color={colors.white} />
          </Pressable>
          {modalImages.length > 0 ? (
            <View style={styles.modalBody}>
              <ScrollView ref={promoGalleryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setSelectedImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH))}>
                {modalImages.map((image) => (
                  <Image key={image} source={{ uri: assetUrl(image) }} style={styles.modalImage} resizeMode="contain" />
                ))}
              </ScrollView>
              {modalImages.length > 1 ? (
                <View style={styles.modalControls}>
                  <Pressable style={styles.modalArrow} onPress={() => changeModalImage(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.white} />
                  </Pressable>
                  <Text style={styles.modalCount}>
                    {selectedImageIndex + 1}/{modalImages.length}
                  </Text>
                  <Pressable style={styles.modalArrow} onPress={() => changeModalImage(1)}>
                    <Icon name="chevron-right" size={22} color={colors.white} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  guestContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  guestHero: { minHeight: 270, borderRadius: 24, overflow: 'hidden', padding: 22, justifyContent: 'space-between', marginBottom: 16 }, guestHeroImage: { borderRadius: 24 }, guestHeroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,22,38,0.58)' },
  guestBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, guestLogo: { width: 44, height: 44, borderRadius: 12 }, guestBrand: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.8 }, guestBrandSub: { color: '#E5EDF5', fontSize: 11, marginTop: 2 },
  guestHeadline: { color: colors.white, fontSize: 32, lineHeight: 37, fontWeight: '900', maxWidth: 520 }, guestLead: { color: '#E5EDF5', fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 480 },
  guestEyebrow: { color: colors.brandOrangeText, fontSize: 11, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 }, guestSectionTitle: { color: '#172033', fontSize: 21, lineHeight: 27, fontWeight: '900', marginBottom: 3 },
  guestToolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, guestToolCard: { flexGrow: 1, flexBasis: 180, minHeight: 150, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E6E8EC', padding: 16 }, guestToolIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF1E7', alignItems: 'center', justifyContent: 'center' }, guestToolTitle: { color: '#1D2939', fontSize: 15, fontWeight: '900', marginTop: 13 }, guestToolText: { color: '#667085', fontSize: 12, lineHeight: 18, marginTop: 4 },
  guestDiscovery: { borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E6E8EC', overflow: 'hidden' }, guestDiscoveryRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' }, guestDiscoveryIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF1E7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, guestDiscoveryText: { flex: 1, color: '#344054', fontSize: 13, fontWeight: '800' },
  guestUpgrade: { marginTop: 14, borderRadius: 22, backgroundColor: '#FFF4E9', borderWidth: 1, borderColor: '#FFD7B5', padding: 20 }, guestUpgradeTitle: { color: '#7A3108', fontSize: 20, lineHeight: 26, fontWeight: '900' }, guestUpgradeText: { color: '#75472C', fontSize: 13, lineHeight: 20, marginTop: 7 }, guestUpgradeButton: { minHeight: 48, borderRadius: 14, backgroundColor: colors.brandOrange, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, guestUpgradeButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  modalClose: {
    position: 'absolute',
    right: 18,
    zIndex: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: { flex: 1, justifyContent: 'center' },
  modalImage: { width: SCREEN_WIDTH, height: '78%' },
  modalControls: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  modalArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCount: { color: colors.white, fontWeight: '800', minWidth: 54, textAlign: 'center' }
});

const hs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ws.bg },
  scrollContent: { paddingBottom: 130 },
  hero: { paddingHorizontal: 16, paddingBottom: 14, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroImage: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(21,17,16,0.6)' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoFrame: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFB43F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 42, height: 42 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  orgName: { color: '#FFFFFF', fontSize: 19, lineHeight: 23, fontWeight: '900', marginTop: 1 },
  heroButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F04438', borderWidth: 2, borderColor: '#FFFFFF' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', maxWidth: 200 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  chipStrong: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  body: { paddingHorizontal: 14, paddingTop: 12 },
  gapBottom: { marginBottom: 10 },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: ws.lineSoft },
  todayTitle: { color: ws.ink, fontSize: 15, fontWeight: '900' },
  smallButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 10, backgroundColor: ws.orange },
  smallButtonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  kpis: { flexDirection: 'row' },
  kpi: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  kpiDivider: { borderLeftWidth: 1, borderLeftColor: ws.lineSoft },
  kpiValue: { color: ws.ink, fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  kpiLabel: { color: ws.muted, fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  reminderTitle: { color: ws.ink, fontSize: 13, fontWeight: '800' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingHorizontal: 4 },
  tileWrap: { width: '25%' },
  tile: { alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 2 },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: ws.text, fontSize: 11.5, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  tileLock: { position: 'absolute', top: 2, right: '20%', width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: ws.line, alignItems: 'center', justifyContent: 'center' },
  seeAll: { color: ws.orangeText, fontSize: 12.5, fontWeight: '800' },
  reason: { maxWidth: 120, textAlign: 'right', color: ws.muted, fontSize: 11.5, fontWeight: '800' },
  poster: { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E4E7EC' },
  posterImage: { width: '100%', height: '100%' },
  posterTag: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FCB042' },
  posterTagText: { color: '#1D2939', fontSize: 10.5, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  dotItem: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D0D5DD' },
  dotOn: { width: 16, backgroundColor: ws.orange },
  sheetGroup: { marginBottom: 8 },
  sheetGroupTitle: { color: ws.muted, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, marginTop: 4, marginHorizontal: 4 },
});
