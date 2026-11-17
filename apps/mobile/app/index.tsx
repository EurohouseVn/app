import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { ActivityIndicator, Dimensions, Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import type { Promotion, WorkforceDashboard, WorkshopReminder } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { formulaUiState } from '../src/lib/formulaAccess';
import { featureUiState } from '../src/lib/eurohouseFeatureAccess';
import { statusText, statusTone } from '../src/lib/orderStatus';
import { fetchWeatherForecast, initialWeatherLocation, weatherIcon, weatherText } from '../src/lib/weather';
import { useResetScrollOnFocus } from '../src/hooks/useResetScrollOnFocus';
import headerWorkshop from '../assets/header-workshop-focus-v2.jpg';
import logo from '../assets/logo-mark.png';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ACTIVE_STATUSES = ['NEW', 'NPP_REVIEWING', 'CONFIRMED', 'RESERVED', 'PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED', 'RECEIVED_BY_NPP', 'SENT_TO_ADMIN', 'PROCESSING', 'PARTIAL'];

const quickActions: { label: string; icon: IconName; href: Href; color: string; bg: string }[] = [
  { label: 'Đặt nhôm', icon: 'shopping-bag', href: '/orders', color: '#C54E09', bg: '#FFF0E5' },
  { label: 'Báo giá', icon: 'file-text', href: '/quote', color: '#2563EB', bg: '#EAF1FF' },
  { label: 'Công thức', icon: 'layout', href: '/formulas', color: '#0F766E', bg: '#E6F6F3' },
  { label: 'Công trình', icon: 'briefcase', href: '/projects', color: '#C54E09', bg: '#FFF0E5' },
  {
    label: 'Việc xưởng',
    icon: 'clipboard',
    href: '/shop-floor' as Href,
    color: '#334155',
    bg: '#E9EDF2',
  },
  {
    label: 'Kiểm tra QC',
    icon: 'check-square',
    href: '/qc' as Href,
    color: '#047857',
    bg: '#E5F7EF',
  },
  {
    label: 'Lắp đặt',
    icon: 'tool',
    href: '/installations' as Href,
    color: '#B54708',
    bg: '#FFF1E8',
  },
  { label: 'Chấm công', icon: 'user-check', href: '/workforce', color: '#047857', bg: '#E5F7EF' },
  { label: 'Nhắc việc', icon: 'calendar', href: '/reminders', color: '#B45309', bg: '#FFF4D8' },
  { label: 'Công nợ', icon: 'credit-card', href: '/debts', color: '#BE123C', bg: '#FDE8EF' },
  {
    label: 'Bảo hành',
    icon: 'maximize',
    href: '/service-warranty' as Href,
    color: '#0369A1',
    bg: '#E5F3FA',
  },
  {
    label: 'Ảnh chờ gửi',
    icon: 'cloud',
    href: '/media-sync' as Href,
    color: '#475467',
    bg: '#F2F4F7',
  },
];

const primaryActionLabels = ['Công trình', 'Việc xưởng', 'Đặt nhôm', 'Báo giá', 'Công thức', 'Chấm công'];

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

type OrderRow = {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  totalKg: number;
  theoreticalTotalKg: number;
  actualTotalKg?: number;
  pricingStatus: 'PENDING_NPP' | 'FINALIZED' | 'ESTIMATED_COMPANY';
};

type WeatherData = {
  temperature: number;
  humidity: number;
  wind: number;
  code: number;
  label: string;
};

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} tr`;
  return `${Math.round(value / 1_000)}k`;
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
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceDashboard | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);

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
      const calls = [api.get<Promotion[]>(`/content/promotions?audience=${audience}`), api.get<OrderRow[]>('/orders'), user?.role === 'FACTORY' || user?.role === 'DAILY' ? api.get<WorkforceDashboard>('/workforce/dashboard') : Promise.resolve(null), loadWeather(), api.get<Workspace>('/workshop/v2/workspace')] as const;
      const [promoResult, orderResult, workforceResult, , workspaceResult] = await Promise.allSettled(calls);
      const failures: string[] = [];
      if (promoResult.status === 'fulfilled') {
        setPromos(promoResult.value);
        setPromoIndex(0);
      } else failures.push('khuyến mại');
      if (orderResult.status === 'fulfilled') setOrders(orderResult.value);
      else failures.push('đơn hàng');
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

  const activeCount = orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length;
  const actualKg = orders.reduce((sum, order) => {
    if (order.actualTotalKg !== undefined) return sum + order.actualTotalKg;
    return ['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) ? sum + order.totalKg : sum;
  }, 0);
  const workspaceActions = useMemo(() => {
    const preferred: Record<string, string[]> = {
      WORKER: ['Việc xưởng', 'Kiểm tra QC', 'Chấm công'],
      INSTALLER: ['Lắp đặt', 'Bảo hành', 'Ảnh chờ gửi'],
      SUPERVISOR: ['Việc xưởng', 'Kiểm tra QC', 'Lắp đặt'],
      OWNER: ['Công trình', 'Việc xưởng', 'Đơn hàng'],
      WORKSHOP_MANAGER: ['Việc xưởng', 'Kiểm tra QC', 'Lắp đặt'],
      ADMIN: ['Công trình', 'Việc xưởng', 'Ảnh chờ gửi'],
    };
    const order = preferred[workspace?.role || 'OWNER'] || [];
    return [...quickActions].sort((a, b) => {
      const ai = order.indexOf(a.label);
      const bi = order.indexOf(b.label);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [workspace?.role]);
  const primaryActions = useMemo(() => primaryActionLabels.flatMap((label) => quickActions.filter((action) => action.label === label)), []);
  const visibleActions = showAllActions ? workspaceActions : primaryActions;
  const formulaState = formulaUiState(user?.capabilities.eurohouse.features.FORMULA_CUTTING ?? user?.capabilities.formulas);
  const orderingState = featureUiState(user?.capabilities.eurohouse.features.EUROHOUSE_ORDERING);

  function changeModalImage(delta: number) {
    if (modalImages.length === 0) return;
    const next = (selectedImageIndex + delta + modalImages.length) % modalImages.length;
    setSelectedImageIndex(next);
    promoGalleryRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }

  return (
    <View style={styles.screen}>
      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={colors.brandOrange} />} contentContainerStyle={styles.scrollContent}>
        <ImageBackground source={headerWorkshop} style={[styles.hero, { paddingTop: Math.max(16, insets.top + 4) }]} imageStyle={styles.heroImage} resizeMode="cover">
          <View style={styles.heroShade} />
          <View style={styles.heroTop}>
            <View style={styles.logoFrame}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.heroBrand}>
              <Text style={styles.brandName}>EUROHOUSE</Text>
              <Text style={styles.organization}>WORKSHOP OS</Text>
            </View>
            <Link href="/reminders" asChild>
              <Pressable accessibilityLabel="Mở nhắc việc" style={styles.heroIconButton}>
                <Icon name="bell" size={20} color={colors.white} />
                {(workforce?.reminders.length ?? 0) > 0 ? <View style={styles.notificationDot} /> : null}
              </Pressable>
            </Link>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.heroGreeting}>
              <Text style={styles.greeting}>{greeting()},</Text>
              <Text style={styles.userName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {user?.organizationName ?? 'Cơ sở sản xuất Eurohouse'}
              </Text>
            </View>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaChip}>
                <Icon name="calendar" size={15} color="#FFD28A" />
                <Text style={styles.today}>
                  {new Date().toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </Text>
              </View>
              <Link href="/weather" asChild>
                <Pressable accessibilityLabel="Xem dự báo thời tiết 7 ngày" style={StyleSheet.flatten([styles.heroMetaChip, styles.weatherChip])}>
                  {weather ? (
                    <>
                      <Icon name={weatherIcon(weather.code)} size={17} color="#FFD28A" />
                      <Text style={styles.temperature}>{Math.round(weather.temperature)}°</Text>
                      <Text style={styles.weatherTitle} numberOfLines={1}>
                        {weatherText(weather.code)}
                      </Text>
                      <Icon name="chevron-right" size={14} color="#D0D5DD" />
                    </>
                  ) : (
                    <>
                      <Icon name="cloud" size={16} color="#FFD28A" />
                      <Text style={styles.weatherUnavailable}>Đang cập nhật</Text>
                      <Icon name="chevron-right" size={14} color="#D0D5DD" />
                    </>
                  )}
                </Pressable>
              </Link>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          {error ? (
            <Pressable style={styles.errorBanner} onPress={() => void loadDashboard(true)}>
              <Icon name="alert-circle" size={18} color="#B42318" />
              <Text style={styles.errorText}>{error}</Text>
              <Icon name="refresh-cw" size={16} color="#B42318" />
            </Pressable>
          ) : null}

          <View style={styles.todayPanel}>
            <View style={styles.todayHeader}>
              <View style={styles.todayHeading}>
                <Text style={styles.sectionTitle}>Hôm nay</Text>
                <Text style={styles.sectionCaption}>{workspace ? workspaceCopy[workspace.role].detail : 'Theo dõi công việc và nhân sự trong ngày'}</Text>
              </View>
              <Link href="/workforce" asChild>
                <Pressable style={styles.attendanceButton}>
                  <Icon name="user-check" size={17} color={colors.white} />
                  <Text style={styles.attendanceButtonText}>Chấm công</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.dailyMetrics}>
              <Link href="/workforce" asChild>
                <Pressable style={styles.dailyMetric}>
                  <Icon name="users" size={18} color="#087F6A" />
                  <Text style={styles.dailyValue}>
                    {workforce?.presentCount ?? 0}/{workforce?.workerCount ?? 0}
                  </Text>
                  <Text style={styles.dailyLabel}>Có mặt</Text>
                </Pressable>
              </Link>
              <View style={styles.metricDivider} />
              <Link href="/workforce" asChild>
                <Pressable style={styles.dailyMetric}>
                  <Icon name="clock" size={18} color={colors.brandOrangeText} />
                  <Text style={styles.dailyValue}>{(workforce?.overtimeHours ?? 0).toFixed(1)}h</Text>
                  <Text style={styles.dailyLabel}>Tăng ca</Text>
                </Pressable>
              </Link>
              <View style={styles.metricDivider} />
              <Link href="/workforce" asChild>
                <Pressable style={styles.dailyMetric}>
                  <Icon name="dollar-sign" size={18} color="#2563EB" />
                  <Text style={styles.dailyValue}>{formatMoney(workforce?.estimatedPayroll ?? 0)}</Text>
                  <Text style={styles.dailyLabel}>Lương dự tính</Text>
                </Pressable>
              </Link>
            </View>

            <View style={styles.todayDivider} />
            <View style={styles.reminderHeading}>
              <View style={styles.reminderHeadingCopy}>
                <Icon name="calendar" size={16} color={colors.brandOrangeText} />
                <Text style={styles.reminderHeadingText}>Việc cần xử lý</Text>
              </View>
              <Link href="/reminders" asChild>
                <Pressable accessibilityLabel="Thêm nhắc việc" style={styles.addReminderButton}>
                  <Icon name="plus" size={18} color={colors.brandOrangeText} />
                </Pressable>
              </Link>
            </View>
            {(workforce?.reminders.length ?? 0) > 0 ? (
              <View style={styles.reminderList}>
                {workforce?.reminders.slice(0, 2).map((reminder) => (
                  <Link key={reminder.id} href="/reminders" asChild>
                    <Pressable style={styles.reminderRow}>
                      <View style={[styles.priorityMark, reminder.priority === 'HIGH' && styles.priorityHigh]} />
                      <View style={styles.reminderCopy}>
                        <Text style={styles.reminderTitle} numberOfLines={1}>
                          {reminder.title}
                        </Text>
                        <Text style={styles.reminderDue}>{formatDue(reminder)}</Text>
                      </View>
                      <Icon name="chevron-right" size={17} color="#98A2B3" />
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : (
              <Link href="/reminders" asChild>
                <Pressable style={styles.noReminder}>
                  <View style={styles.noReminderIcon}>
                    <Icon name="check-circle" size={18} color="#087F6A" />
                  </View>
                  <View style={styles.reminderCopy}>
                    <Text style={styles.noReminderTitle}>Không có việc cần nhắc</Text>
                    <Text style={styles.noReminderText}>Lịch làm việc hôm nay đang thông thoáng.</Text>
                  </View>
                  <Icon name="chevron-right" size={17} color="#98A2B3" />
                </Pressable>
              </Link>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Tiện ích xưởng</Text>
              <Text style={styles.sectionCaption}>Sáu thao tác dùng nhiều nhất</Text>
            </View>
            <Pressable accessibilityLabel={showAllActions ? 'Thu gọn tiện ích' : 'Xem tất cả tiện ích'} style={styles.seeAllActions} onPress={() => setShowAllActions((current) => !current)}>
              <Text style={styles.seeAllActionsText}>{showAllActions ? 'Thu gọn' : 'Tất cả'}</Text>
              <Icon name={showAllActions ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brandOrangeText} />
            </Pressable>
          </View>
          <View style={styles.actionGrid}>
            {visibleActions.map((action) => (
              <Link key={action.label} href={action.href} asChild>
                <Pressable style={styles.actionItem}>
                  {action.label === 'Công thức' && formulaState.showLockedScreen ? <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>{formulaState.statusLabel}</Text></View> : null}
                  {action.label === 'Đặt nhôm' && !orderingState.active ? <View style={styles.lockedBadge}><Text style={styles.lockedBadgeText}>{orderingState.statusLabel}</Text></View> : null}
                  <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                    <Icon name={action.icon} size={21} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel} numberOfLines={2}>
                    {action.label}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>

          {promo ? (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Tin mới từ Eurohouse</Text>
                  <Text style={styles.sectionCaption}>Chạm ảnh để xem đầy đủ</Text>
                </View>
                {promos.length > 1 ? (
                  <Text style={styles.carouselCount}>
                    {promoIndex + 1}/{promos.length}
                  </Text>
                ) : null}
              </View>
              <Pressable
                style={styles.poster}
                onPress={() => {
                  setSelectedPromo(promo);
                  setSelectedImageIndex(0);
                }}
              >
                {promo.imageUrl ? <Image source={{ uri: assetUrl(promo.imageUrl) }} style={styles.posterImage} resizeMode="cover" /> : null}
                <View style={styles.posterLabel}>
                  <Icon name="zap" size={13} color={colors.brandBlack.main} />
                  <Text style={styles.posterLabelText}>Khuyến mại</Text>
                </View>
              </Pressable>
            </>
          ) : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
              <Text style={styles.sectionCaption}>
                {activeCount} đơn đang xử lý · {actualKg.toFixed(1)} kg đã cân giao
              </Text>
            </View>
            <Link href="/my-orders" style={styles.seeAll}>
              Xem tất cả
            </Link>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brandOrange} />
              <Text style={styles.loadingText}>Đang tải dữ liệu xưởng...</Text>
            </View>
          ) : orders.length === 0 ? (
            <Link href="/orders" asChild>
              <Pressable style={styles.emptyOrders}>
                <View style={styles.emptyOrderIcon}>
                  <Icon name="package" size={24} color={colors.brandOrangeText} />
                </View>
                <View style={styles.reminderCopy}>
                  <Text style={styles.emptyOrderTitle}>Chưa có đơn hàng</Text>
                  <Text style={styles.emptyOrderText}>Bắt đầu tạo đơn nhôm đầu tiên cho công trình.</Text>
                </View>
                <Icon name="chevron-right" size={19} color="#98A2B3" />
              </Pressable>
            </Link>
          ) : (
            orders.slice(0, 4).map((order) => {
              const deliveredKg = order.actualTotalKg ?? (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) ? order.totalKg : undefined);
              return (
                <Link key={order.id} href={`/order/${order.id}` as Href} asChild>
                  <Pressable style={styles.orderRow}>
                    <View style={styles.orderIcon}>
                      <Icon name="box" size={18} color={colors.brandOrangeText} />
                    </View>
                    <View style={styles.orderCopy}>
                      <Text style={styles.orderCode}>{order.code}</Text>
                      <Text style={styles.orderMeta}>
                        {deliveredKg !== undefined ? `${deliveredKg.toFixed(1)} kg thực tế` : `${(order.theoreticalTotalKg || order.totalKg).toFixed(1)} kg dự tính`} · {order.pricingStatus === 'FINALIZED' ? formatMoney(order.totalAmount) : 'Chờ chốt giá'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${statusTone[order.status] ?? '#667085'}18` }]}>
                      <Text style={[styles.statusText, { color: statusTone[order.status] ?? '#344054' }]} numberOfLines={1}>
                        {statusText[order.status] ?? order.status}
                      </Text>
                    </View>
                  </Pressable>
                </Link>
              );
            })
          )}
        </View>
      </ScrollView>

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
  scrollContent: { paddingBottom: 124 },
  hero: {
    minHeight: 222,
    paddingHorizontal: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 15, 27, 0.46)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  logoFrame: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFB43F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 46, height: 46 },
  heroBrand: { flex: 1, marginLeft: 11 },
  brandName: { color: colors.white, fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  organization: { color: '#F1F5F9', fontSize: 11, fontWeight: '700', marginTop: 2, maxWidth: 230, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  heroIconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(5,12,22,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF7A1A',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  heroBottom: { marginTop: 24 },
  heroGreeting: { marginBottom: 12 },
  greeting: { color: '#F1F5F9', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  userName: {
    color: colors.white,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 1,
    maxWidth: '100%',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMetaChip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(5,12,22,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  weatherChip: { flex: 1, minWidth: 0 },
  today: { color: colors.white, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  temperature: { color: colors.white, fontSize: 15, fontWeight: '900' },
  weatherTitle: { flexShrink: 1, color: '#E2E8F0', fontSize: 10, fontWeight: '700' },
  weatherUnavailable: { color: '#E2E8F0', fontSize: 10, fontWeight: '700' },
  content: { paddingHorizontal: 16 },
  errorBanner: {
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  errorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  todayPanel: {
    marginTop: 14,
    padding: 15,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E3E7EC',
    borderRadius: 14,
  },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayHeading: { flex: 1, minWidth: 0 },
  attendanceButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: colors.brandOrange,
  },
  attendanceButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  dailyMetrics: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F7F8FA',
  },
  dailyMetric: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  dailyValue: { color: '#172033', fontWeight: '900', fontSize: 16, marginTop: 4 },
  dailyLabel: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
  },
  metricDivider: { width: 1, height: 42, backgroundColor: '#E2E6EB' },
  todayDivider: { height: 1, marginTop: 14, backgroundColor: '#E8EBEF' },
  reminderHeading: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderHeadingCopy: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reminderHeadingText: { color: '#344054', fontSize: 12, fontWeight: '900' },
  addReminderButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FFF2E8',
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: '#172033', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sectionCaption: { color: '#667085', fontSize: 11, marginTop: 2 },
  reminderList: { overflow: 'hidden' },
  reminderRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F3',
  },
  priorityMark: {
    width: 4,
    height: 32,
    borderRadius: 2,
    backgroundColor: '#F59E0B',
    marginRight: 11,
  },
  priorityHigh: { backgroundColor: '#E5484D' },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  reminderDue: { color: '#667085', fontSize: 10, marginTop: 4 },
  noReminder: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    backgroundColor: '#EEF9F5',
    borderRadius: 10,
  },
  noReminderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  noReminderTitle: { color: '#066B57', fontSize: 12, fontWeight: '800' },
  noReminderText: { color: '#52756B', fontSize: 9, marginTop: 2, lineHeight: 13 },
  seeAllActions: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFF2E8',
  },
  seeAllActionsText: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900' },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E7EC',
    paddingVertical: 8,
  },
  actionItem: {
    width: '33.333%',
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    position: 'relative',
  },
  lockedBadge: { position: 'absolute', top: 4, right: 4, zIndex: 2, minHeight: 18, borderRadius: 7, backgroundColor: '#FFF1E8', paddingHorizontal: 5, justifyContent: 'center', borderWidth: 1, borderColor: '#FFD6B8' },
  lockedBadgeText: { color: colors.brandOrangeText, fontSize: 7.5, fontWeight: '900' },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#344054',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 7,
    minHeight: 16,
  },
  carouselCount: { color: '#667085', fontSize: 11, fontWeight: '700' },
  poster: { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E9ECF1' },
  posterImage: { width: '100%', height: '100%' },
  posterLabel: {
    position: 'absolute',
    left: 10,
    top: 10,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFB15C',
  },
  posterLabelText: { color: '#172033', fontSize: 11, fontWeight: '900' },
  seeAll: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 12 },
  loading: {
    minHeight: 100,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: { color: '#667085', fontSize: 11 },
  emptyOrders: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E7E9ED',
  },
  emptyOrderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOrderTitle: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  emptyOrderText: { color: '#667085', fontSize: 10, lineHeight: 15, marginTop: 3 },
  orderRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E7E9ED',
    borderRadius: 12,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCopy: { flex: 1, minWidth: 0 },
  orderCode: { color: '#1D2939', fontSize: 12, fontWeight: '900' },
  orderMeta: { color: '#667085', fontSize: 10, marginTop: 4 },
  statusPill: { maxWidth: 88, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
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
  modalCount: { color: colors.white, fontWeight: '800', minWidth: 54, textAlign: 'center' },
});
