import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Dimensions, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import type { Promotion, WorkforceDashboard, WorkshopReminder } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { Banner, BrandSectionHead, Card, DisplayTitle, Kicker, ListRow, Loading, Sheet, ws, wsStyles } from '../src/components/ws';
import { actionGroups, primaryActions, tileTone, type HomeAction } from '../src/lib/homeActions';
import { HOME_PRODUCTS, type HomeProduct } from '../src/lib/homeProducts';
import { compactMoney } from '../src/lib/invoiceState';
import { LocalProjectsApi, type LocalProject } from '../src/lib/localProjects';
import { homeProjects } from '../src/lib/projectListState';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { formulaUiState } from '../src/lib/formulaAccess';
import { featureUiState } from '../src/lib/eurohouseFeatureAccess';
import { fetchWeatherForecast, initialWeatherLocation, weatherIcon, weatherText } from '../src/lib/weather';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import heroImage from '../assets/brand/hero-ecento-70.jpg';
import assistantAvatar from '../assets/brand/assistant-avatar.png';
import logoLandscape from '../assets/brand/logo-landscape.png';
import productEcento70 from '../assets/brand/product-ecento-70.jpg';
import productEcentoPlus from '../assets/brand/product-ecento-plus.jpg';
import productHe55 from '../assets/brand/product-he-55-vat-canh.jpg';
import productPreco from '../assets/brand/product-preco.jpg';
import logo from '../assets/logo-mark.png';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PRODUCT_IMAGES: Record<HomeProduct['image'], ImageSourcePropType> = {
  ecento70: productEcento70,
  ecentoPlus: productEcentoPlus,
  he55: productHe55,
  preco: productPreco,
};

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

function formatDue(reminder: WorkshopReminder): string {
  const due = new Date(reminder.dueAt);
  const sameDay = due.toDateString() === new Date().toDateString();
  return `${sameDay ? 'Hôm nay' : due.toLocaleDateString('vi-VN')} · ${due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function HomeScreen() {
  const { sessionTier } = useAuth();
  return sessionTier === 'GUEST' ? <GuestHome /> : <AuthenticatedHomeScreen />;
}

/** Đầu trang ảnh thương hiệu dùng chung cho khách và CSSX. */
function BrandHero({ kicker, title, children, right, topInset }: { kicker: string; title: string; children?: React.ReactNode; right?: React.ReactNode; topInset: number }) {
  return (
    <View style={[hs.hero, { paddingTop: Math.max(46, topInset + 14) }]}>
      <Image source={heroImage} style={hs.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={hs.heroShade} />
      <View style={hs.heroTop}>
        <View style={hs.logoFrame}><Image source={logo} style={hs.logo} resizeMode="contain" /></View>
        <View style={wsStyles.grow}>
          <Text style={hs.wordmark}>EUROHOUSE</Text>
          <Text style={hs.wordmarkSub}>WORKSHOP OS</Text>
        </View>
        {right}
      </View>
      <View style={hs.heroCopy}>
        <Kicker text={kicker} light />
        <View style={{ marginTop: 6 }}><DisplayTitle text={title} size={24} light lines={2} /></View>
        {children}
      </View>
    </View>
  );
}

function ProductStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hs.productStrip} snapToInterval={222} decelerationRate="fast">
      {HOME_PRODUCTS.map((product) => (
        <Pressable key={product.key} accessibilityRole="button" accessibilityLabel={`Xem ${product.name} trong catalog`} onPress={onOpen} style={({ pressed }) => [hs.product, pressed && { opacity: 0.9 }]}>
          <View style={hs.productImageWrap}><Image source={PRODUCT_IMAGES[product.image]} style={hs.productImage} resizeMode="contain" /></View>
          <View style={hs.productBody}>
            <View style={wsStyles.grow}>
              <Text style={hs.productName} numberOfLines={1}>{product.name.toUpperCase()}</Text>
              <Text style={wsStyles.rowMeta} numberOfLines={1}>{product.detail}</Text>
            </View>
            <View style={hs.arrow}><Icon name="arrow-right" size={15} color="#FFFFFF" /></View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function BrandFooter() {
  return (
    <View style={hs.footer}>
      <Image source={logoLandscape} style={hs.footerLogo} resizeMode="contain" accessibilityLabel="Eurohouse" />
      <Text style={hs.footerText}>NHÔM CỦA SỰ THỊNH VƯỢNG</Text>
    </View>
  );
}

function GuestHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { leaveGuestMode } = useAuth();
  const freeTools: Array<{ label: string; detail: string; icon: IconName; href: Href; primary?: boolean }> = [
    { label: 'Lập báo giá', detail: 'Tính và lưu báo giá thủ công', icon: 'file-text', href: '/quote', primary: true },
    { label: 'Chấm công', detail: 'Lưu trực tiếp trên thiết bị', icon: 'clock', href: '/workforce' },
    { label: 'Thời tiết', detail: 'Dự báo 7 ngày cho thi công', icon: 'cloud', href: '/weather' },
  ];
  const discovery: Array<{ label: string; icon: IconName; href: Href }> = [
    { label: 'Catalog hệ nhôm', icon: 'layout', href: '/catalog' },
    { label: 'Thư viện hình ảnh', icon: 'image', href: '/library' },
    { label: 'Kiến thức ngành', icon: 'book-open', href: '/knowledge' },
    { label: 'Chương trình Eurohouse', icon: 'gift', href: '/promo' },
  ];
  return (
    <ScrollView style={hs.screen} contentContainerStyle={hs.scrollContent} showsVerticalScrollIndicator={false}>
      <BrandHero kicker="Nhôm kiến trúc Eurohouse" title="Làm việc gọn hơn. Hiểu nhôm sâu hơn." topInset={insets.top}>
        <Text style={hs.heroLead}>Dùng ngay các tiện ích cơ bản, không cần tạo tài khoản.</Text>
      </BrandHero>

      <View style={hs.body}>
        <BrandSectionHead kicker="Dùng miễn phí" title="Công cụ mỗi ngày" />
        <Card padded={false}>
          {freeTools.map((tool, index) => (
            <ListRow key={tool.label} first={index === 0} onPress={() => router.push(tool.href)} label={tool.label}>
              <View style={[hs.toolIcon, tool.primary && hs.toolIconPrimary]}><Icon name={tool.icon} size={19} color={tool.primary ? '#FFFFFF' : SLATE} /></View>
              <View style={wsStyles.grow}><Text style={wsStyles.rowTitle}>{tool.label}</Text><Text style={wsStyles.rowMeta}>{tool.detail}</Text></View>
              <Icon name="chevron-right" size={18} color={ws.faint} />
            </ListRow>
          ))}
        </Card>

        <BrandSectionHead kicker="Khám phá Eurohouse" title="Bốn dòng nhôm chủ lực" action={<Pressable onPress={() => router.push('/catalog')}><Text style={hs.seeAll}>Catalog</Text></Pressable>} />
      </View>
      <ProductStrip onOpen={() => router.push('/catalog')} />
      <View style={hs.body}>
        <Card padded={false} style={{ marginTop: 12 }}>
          {discovery.map((item, index) => (
            <ListRow key={item.label} first={index === 0} onPress={() => router.push(item.href)} label={item.label}>
              <View style={hs.toolIcon}><Icon name={item.icon} size={18} color={SLATE} /></View>
              <Text style={[wsStyles.rowTitle, wsStyles.grow]}>{item.label}</Text>
              <Icon name="chevron-right" size={18} color={ws.faint} />
            </ListRow>
          ))}
        </Card>

        <View style={hs.upgrade}>
          <Kicker text="Tài khoản miễn phí" />
          <Text style={hs.upgradeTitle}>Mở thêm tính năng quản lý</Text>
          <Text style={hs.upgradeText}>Quản lý công trình, khách hàng, thu–chi, công nợ, hoá đơn và bảng lương trên nhiều thiết bị.</Text>
          <Pressable onPress={() => void leaveGuestMode()} style={({ pressed }) => [hs.upgradeButton, pressed && { opacity: 0.88 }]}>
            <Text style={hs.upgradeButtonText}>Đăng nhập / Đăng ký</Text>
            <Icon name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        <BrandFooter />
      </View>
    </ScrollView>
  );
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
    const tone = tileTone(action, access);
    const locked = tone === 'locked';
    return (
      <View key={action.key} style={hs.tileWrap}>
        <Pressable accessibilityRole="button" accessibilityLabel={locked ? `${action.label} (chưa kích hoạt)` : action.label} onPress={onPress ?? (() => { setActionsOpen(false); router.push(action.href as Href); })} style={({ pressed }) => [hs.tile, pressed && { opacity: 0.8 }]}>
          <View style={[hs.tileIcon, tone === 'primary' && hs.tileIconPrimary, locked && hs.tileIconLocked]}>
            <Icon name={action.icon as IconName} size={21} color={tone === 'primary' ? '#FFFFFF' : locked ? ws.faint : SLATE} />
          </View>
          <Text style={[hs.tileLabel, locked && { color: ws.muted }]} numberOfLines={2}>{action.label}</Text>
          {locked ? <View style={hs.tileLock}><Icon name="lock" size={10} color={ws.muted} /></View> : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={hs.screen}>
      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={ws.orange} />} contentContainerStyle={hs.scrollContent}>
        <BrandHero
          kicker="Xưởng đối tác Eurohouse"
          title={user?.organizationName ?? 'Cơ sở sản xuất Eurohouse'}
          topInset={insets.top}
          right={(
            <Pressable accessibilityLabel="Mở nhắc việc" onPress={() => router.push('/reminders')} style={hs.heroButton}>
              <Icon name="bell" size={19} color="#FFFFFF" />
              {reminders.length > 0 ? <View style={hs.dot} /> : null}
            </Pressable>
          )}
        >
          <View style={hs.chips}>
            <View style={hs.chip}>
              <Icon name="calendar" size={14} color="#FFFFFF" />
              <Text style={hs.chipText}>{todayLabel()}</Text>
            </View>
            <Pressable accessibilityLabel="Xem dự báo thời tiết" onPress={() => router.push('/weather')} style={hs.chip}>
              <Icon name={weather ? weatherIcon(weather.code) : 'cloud'} size={14} color="#FFFFFF" />
              {weather ? <Text style={hs.chipStrong}>{Math.round(weather.temperature)}°</Text> : null}
              <Text style={hs.chipText} numberOfLines={1}>{weather ? weatherText(weather.code) : 'Thời tiết'}</Text>
              <Icon name="chevron-right" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        </BrandHero>

        <View style={hs.body}>
          <Card padded={false} style={hs.todayCard}>
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
              <View style={[hs.kpi, hs.kpiDivider]}><Text style={[hs.kpiValue, focus.totalDue > 0 && { color: ws.dangerText }]} numberOfLines={1} adjustsFontSizeToFit>{compactMoney(focus.totalDue)}</Text><Text style={hs.kpiLabel}>Còn phải thu</Text></View>
            </Pressable>
            {reminders.length ? reminders.slice(0, 2).map((reminder) => (
              <Pressable key={reminder.id} onPress={() => router.push('/reminders')} style={({ pressed }) => [hs.reminder, pressed && { backgroundColor: '#F9FAFB' }]}>
                <Icon name="bell" size={16} color={reminder.priority === 'HIGH' ? ws.danger : '#C65309'} />
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở Bé Eu, trợ lý AI của xưởng"
            onPress={() => router.push('/assistant' as Href)}
            style={({ pressed }) => [hs.beEu, pressed && { opacity: 0.9 }]}
          >
            <Image source={assistantAvatar} style={hs.beEuAvatar} />
            <View style={wsStyles.grow}>
              <Text style={hs.beEuTitle}>Hỏi Bé Eu</Text>
              <Text style={hs.beEuSub} numberOfLines={2}>Trợ lý AI riêng của xưởng: giải đáp nhôm kính, báo giá, công trình và tạo ảnh.</Text>
            </View>
            <View style={hs.beEuGo}><Icon name="message-circle" size={18} color="#FFFFFF" /></View>
          </Pressable>

          {error ? <View style={{ marginTop: 10 }}><Banner tone="error" title="Chưa tải đủ dữ liệu" text={error} onPress={() => void loadDashboard(true)} /></View> : null}

          <BrandSectionHead kicker="Công cụ" action={<Pressable onPress={() => setActionsOpen(true)}><Text style={hs.seeAll}>Tất cả</Text></Pressable>} />
          <Card padded={false}>
            <View style={hs.tiles}>
              {tiles.map((action) => (action.key === 'all' ? renderTile(action, () => setActionsOpen(true)) : renderTile(action)))}
            </View>
          </Card>

          <BrandSectionHead
            kicker="Cần chú ý"
            title={focus.items.length ? `${focus.items.length} công trình` : 'Công trình'}
            action={<Pressable onPress={() => router.push('/projects')}><Text style={hs.seeAll}>Xem tất cả</Text></Pressable>}
          />
          {loading && !projects.length ? <Loading text="Đang tải công trình..." /> : focus.items.length === 0 ? (
            <Card padded={false}>
              <ListRow first onPress={() => router.push('/projects')} label="Mở Công trình">
                <View style={wsStyles.avatar}><Icon name="briefcase" size={17} color={ws.orangeText} /></View>
                <View style={wsStyles.grow}><Text style={wsStyles.rowTitle}>Không có công trình cần chú ý</Text><Text style={wsStyles.rowMeta}>Tạo công trình từ báo giá để theo dõi tiến độ và tiền thu</Text></View>
                <Icon name="chevron-right" size={18} color={ws.faint} />
              </ListRow>
            </Card>
          ) : (
            <Card padded={false}>
              {focus.items.map(({ project, reason, tone }, index) => (
                <ListRow key={project.id} first={index === 0} onPress={() => router.push(`/project/${project.id}` as Href)} label={`Mở công trình ${project.name}`}>
                  <View style={[wsStyles.avatar, tone === 'warning' && { backgroundColor: ws.warningBg }]}><Icon name={tone === 'warning' ? 'clock' : 'briefcase'} size={17} color={tone === 'warning' ? ws.warning : ws.orangeText} /></View>
                  <View style={wsStyles.grow}>
                    <Text style={wsStyles.rowTitle} numberOfLines={1}>{project.name}</Text>
                    <Text style={wsStyles.rowMeta} numberOfLines={1}>{[project.customerName, project.code].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={[hs.reason, tone === 'danger' && { color: ws.dangerText }, tone === 'warning' && { color: ws.warning }]} numberOfLines={2}>{reason}</Text>
                </ListRow>
              ))}
            </Card>
          )}

          <BrandSectionHead kicker="Sản phẩm Eurohouse" title="Bốn dòng nhôm chủ lực" action={<Pressable onPress={() => router.push('/catalog')}><Text style={hs.seeAll}>Catalog</Text></Pressable>} />
        </View>
        <ProductStrip onOpen={() => router.push('/catalog')} />

        <View style={hs.body}>
          {promo ? (
            <>
              <BrandSectionHead kicker="Tin & ưu đãi" action={promos.length > 1 ? <Text style={hs.seeAll}>{promoIndex + 1}/{promos.length}</Text> : undefined} />
              <Pressable accessibilityLabel="Xem tin Eurohouse" style={hs.poster} onPress={() => { setSelectedPromo(promo); setSelectedImageIndex(0); }}>
                {promo.imageUrl ? <Image source={{ uri: assetUrl(promo.imageUrl) }} style={hs.posterImage} resizeMode="cover" /> : null}
                <View style={hs.posterShade} />
                <View style={hs.posterCopy}>
                  <Kicker text="Khuyến mại" light />
                  {promo.title ? <Text style={hs.posterTitle} numberOfLines={2}>{promo.title}</Text> : null}
                </View>
              </Pressable>
              {promos.length > 1 ? <View style={hs.dots}>{promos.map((p, i) => <View key={p.id ?? i} style={[hs.dotItem, i === promoIndex && hs.dotOn]} />)}</View> : null}
            </>
          ) : null}
          <BrandFooter />
        </View>
      </ScrollView>

      <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Tất cả tiện ích">
        {actionGroups().map((group) => (
          <View key={group.title} style={hs.sheetGroup}>
            <Kicker text={group.title} />
            <View style={hs.tiles}>{group.actions.map((action) => renderTile(action))}</View>
          </View>
        ))}
      </Sheet>

      <Modal visible={!!selectedPromo} transparent animationType="fade" onRequestClose={() => setSelectedPromo(null)}>
        <View style={hs.modalOverlay}>
          <Pressable accessibilityLabel="Đóng ảnh khuyến mại" style={[hs.modalClose, { top: Math.max(24, insets.top + 8) }]} onPress={() => setSelectedPromo(null)}>
            <Icon name="x" size={22} color={colors.white} />
          </Pressable>
          {modalImages.length > 0 ? (
            <View style={hs.modalBody}>
              <ScrollView ref={promoGalleryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setSelectedImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH))}>
                {modalImages.map((image) => (
                  <Image key={image} source={{ uri: assetUrl(image) }} style={hs.modalImage} resizeMode="contain" />
                ))}
              </ScrollView>
              {modalImages.length > 1 ? (
                <View style={hs.modalControls}>
                  <Pressable style={hs.modalArrow} onPress={() => changeModalImage(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.white} />
                  </Pressable>
                  <Text style={hs.modalCount}>{selectedImageIndex + 1}/{modalImages.length}</Text>
                  <Pressable style={hs.modalArrow} onPress={() => changeModalImage(1)}>
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

/** Xanh than của website, dùng cho icon trung tính. */
const SLATE = '#202A37';

const hs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F7' },
  scrollContent: { paddingBottom: 130 },
  hero: { minHeight: 296, paddingHorizontal: 16, paddingBottom: 58, overflow: 'hidden', backgroundColor: '#202A37' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(21,26,34,0.58)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoFrame: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F9A82F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 40, height: 40 },
  wordmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.6 },
  wordmarkSub: { color: '#FFD09C', fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginTop: 1 },
  heroButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: '#F04438', borderWidth: 2, borderColor: '#FFFFFF' },
  heroCopy: { marginTop: 26 },
  heroLead: { color: '#F3F5F7', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 420 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', maxWidth: 210 },
  chipText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  chipStrong: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  body: { paddingHorizontal: 14 },
  beEu: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: '#FFF2E8', borderWidth: 1, borderColor: '#FED7AA' },
  beEuAvatar: { width: 58, height: 58 },
  beEuTitle: { color: '#C65309', fontSize: 15, fontWeight: '900' },
  beEuSub: { color: '#475467', fontSize: 12, lineHeight: 17, marginTop: 2 },
  beEuGo: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F47C20', alignItems: 'center', justifyContent: 'center' },
  todayCard: { marginTop: -42, shadowColor: '#101828', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  todayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: ws.lineSoft },
  todayTitle: { color: '#151A22', fontSize: 15, fontWeight: '900' },
  smallButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: ws.orange },
  smallButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  kpis: { flexDirection: 'row' },
  kpi: { flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 10 },
  kpiDivider: { borderLeftWidth: 1, borderLeftColor: ws.lineSoft },
  kpiValue: { color: '#151A22', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  kpiLabel: { color: ws.muted, fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  reminderTitle: { color: '#151A22', fontSize: 13, fontWeight: '800' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8, paddingHorizontal: 4 },
  tileWrap: { width: '25%' },
  tile: { alignItems: 'center', gap: 7, paddingVertical: 8, paddingHorizontal: 2 },
  tileIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  tileIconPrimary: { backgroundColor: ws.orange },
  tileIconLocked: { backgroundColor: '#F2F4F7', opacity: 0.7 },
  tileLabel: { color: '#151A22', fontSize: 11.5, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  tileLock: { position: 'absolute', top: 3, right: '18%', width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: ws.line, alignItems: 'center', justifyContent: 'center' },
  seeAll: { color: '#C65309', fontSize: 12.5, fontWeight: '800', paddingVertical: 4 },
  reason: { maxWidth: 120, textAlign: 'right', color: ws.muted, fontSize: 11.5, fontWeight: '800' },
  toolIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  toolIconPrimary: { backgroundColor: ws.orange },
  productStrip: { gap: 12, paddingHorizontal: 14, paddingBottom: 4 },
  product: { width: 210, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#DFE3E8', overflow: 'hidden' },
  productImageWrap: { height: 132, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: ws.lineSoft },
  productImage: { width: '100%', height: '100%' },
  productBody: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  productName: { color: '#151A22', fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  arrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: ws.orange, alignItems: 'center', justifyContent: 'center' },
  poster: { height: 150, borderRadius: 10, overflow: 'hidden', backgroundColor: '#DFE3E8' },
  posterImage: { width: '100%', height: '100%' },
  posterShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(21,26,34,0.35)' },
  posterCopy: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  posterTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '900', marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 8 },
  dotItem: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D0D5DD' },
  dotOn: { width: 16, backgroundColor: ws.orange },
  upgrade: { marginTop: 22, padding: 16, borderRadius: 10, backgroundColor: '#FFF1E6', borderWidth: 1, borderColor: '#FED7AA' },
  upgradeTitle: { color: '#151A22', fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 6 },
  upgradeText: { color: '#5E6875', fontSize: 13, lineHeight: 19, marginTop: 4 },
  upgradeButton: { minHeight: 46, marginTop: 14, borderRadius: 8, backgroundColor: ws.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  upgradeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  footer: { alignItems: 'center', marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#DFE3E8' },
  footerLogo: { width: 132, height: 50, borderRadius: 4 },
  footerText: { color: ws.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 2, marginTop: 8 },
  sheetGroup: { marginBottom: 10, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  modalClose: { position: 'absolute', right: 18, zIndex: 5, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { flex: 1, justifyContent: 'center' },
  modalImage: { width: SCREEN_WIDTH, height: '78%' },
  modalControls: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  modalArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  modalCount: { color: colors.white, fontWeight: '800', minWidth: 54, textAlign: 'center' },
});
