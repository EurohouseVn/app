import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import type { Promotion, WorkforceDashboard, WorkshopReminder } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { statusText, statusTone } from '../src/lib/orderStatus';
import headerHouse from '../assets/header-house.jpg';
import logo from '../assets/logo.png';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ACTIVE_STATUSES = [
  'NEW', 'NPP_REVIEWING', 'CONFIRMED', 'RESERVED', 'PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED',
  'RECEIVED_BY_NPP', 'SENT_TO_ADMIN', 'PROCESSING', 'PARTIAL',
];

const quickActions: { label: string; icon: IconName; href: Href; color: string; bg: string }[] = [
  { label: 'Đặt nhôm', icon: 'shopping-bag', href: '/orders', color: '#C54E09', bg: '#FFF0E5' },
  { label: 'Báo giá', icon: 'file-text', href: '/quote', color: '#2563EB', bg: '#EAF1FF' },
  { label: 'Công thức', icon: 'layout', href: '/formulas', color: '#0F766E', bg: '#E6F6F3' },
  { label: 'Công trình', icon: 'briefcase', href: '/projects', color: '#7C3AED', bg: '#F1EAFF' },
  { label: 'Việc xưởng', icon: 'clipboard', href: '/shop-floor' as Href, color: '#334155', bg: '#E9EDF2' },
  { label: 'Kiểm tra QC', icon: 'check-square', href: '/qc' as Href, color: '#047857', bg: '#E5F7EF' },
  { label: 'Lắp đặt', icon: 'tool', href: '/installations' as Href, color: '#B54708', bg: '#FFF1E8' },
  { label: 'Chấm công', icon: 'user-check', href: '/workforce', color: '#047857', bg: '#E5F7EF' },
  { label: 'Nhắc việc', icon: 'calendar', href: '/reminders', color: '#B45309', bg: '#FFF4D8' },
  { label: 'Công nợ', icon: 'credit-card', href: '/debts', color: '#BE123C', bg: '#FDE8EF' },
  { label: 'Bảo hành', icon: 'maximize', href: '/service-warranty' as Href, color: '#0369A1', bg: '#E5F3FA' },
  { label: 'Ảnh chờ gửi', icon: 'cloud', href: '/media-sync' as Href, color: '#475467', bg: '#F2F4F7' },
];

type Workspace = { role: 'OWNER' | 'WORKSHOP_MANAGER' | 'SUPERVISOR' | 'WORKER' | 'INSTALLER' | 'ADMIN'; primarySurface: string; capabilities: string[] };

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
  actualTotalKg?: number;
};

type WeatherData = {
  temperature: number;
  humidity: number;
  wind: number;
  code: number;
  label: string;
};

const provinceCoordinates: Record<string, { latitude: number; longitude: number; label: string }> = {
  'hồ chí minh': { latitude: 10.8231, longitude: 106.6297, label: 'TP.HCM' },
  'ho chi minh': { latitude: 10.8231, longitude: 106.6297, label: 'TP.HCM' },
  'hà nội': { latitude: 21.0285, longitude: 105.8542, label: 'Hà Nội' },
  'ha noi': { latitude: 21.0285, longitude: 105.8542, label: 'Hà Nội' },
  'đà nẵng': { latitude: 16.0544, longitude: 108.2022, label: 'Đà Nẵng' },
  'da nang': { latitude: 16.0544, longitude: 108.2022, label: 'Đà Nẵng' },
  'bình dương': { latitude: 10.9804, longitude: 106.6519, label: 'Bình Dương' },
  'đồng nai': { latitude: 10.9574, longitude: 106.8426, label: 'Đồng Nai' },
  'dong nai': { latitude: 10.9574, longitude: 106.8426, label: 'Đồng Nai' },
};

function weatherText(code: number): string {
  if (code === 0) return 'Trời quang';
  if (code <= 3) return 'Có mây';
  if (code <= 48) return 'Sương nhẹ';
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Có mưa';
  if (code >= 95) return 'Mưa dông';
  return 'Nhiều mây';
}

function weatherIcon(code: number): IconName {
  if (code === 0) return 'sun';
  if (code <= 3) return 'cloud';
  return 'cloud-rain';
}

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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const promoGalleryRef = useRef<ScrollView>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceDashboard | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  const loadWeather = useCallback(async () => {
    const province = user?.organizationProvince?.trim().toLocaleLowerCase('vi-VN') ?? '';
    const location = Object.entries(provinceCoordinates).find(([key]) => province.includes(key))?.[1]
      ?? provinceCoordinates['hồ chí minh'];
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FBangkok&forecast_days=1`,
      );
      if (!response.ok) throw new Error('Không tải được thời tiết');
      const payload = await response.json() as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
      };
      const current = payload.current;
      if (!current || current.temperature_2m === undefined) throw new Error('Dữ liệu thời tiết chưa sẵn sàng');
      setWeather({
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m ?? 0,
        wind: current.wind_speed_10m ?? 0,
        code: current.weather_code ?? 0,
        label: location.label,
      });
    } catch {
      setWeather(null);
    }
  }, [user?.organizationProvince]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const audience = user?.role === 'NPP' || user?.role === 'DAILY' ? 'NPP_DEALER' : 'WORKER';
    const calls = [
      api.get<Promotion[]>(`/content/promotions?audience=${audience}`),
      api.get<OrderRow[]>('/orders'),
      user?.role === 'FACTORY' || user?.role === 'DAILY'
        ? api.get<WorkforceDashboard>('/workforce/dashboard')
        : Promise.resolve(null),
      loadWeather(),
      api.get<Workspace>('/workshop/v2/workspace'),
    ] as const;
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
  }, [loadWeather, user?.role]);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

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
      const ai = order.indexOf(a.label); const bi = order.indexOf(b.label);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
  }, [workspace?.role]);

  function changeModalImage(delta: number) {
    if (modalImages.length === 0) return;
    const next = (selectedImageIndex + delta + modalImages.length) % modalImages.length;
    setSelectedImageIndex(next);
    promoGalleryRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={colors.brandOrange} />}
        contentContainerStyle={styles.scrollContent}
      >
        <ImageBackground source={headerHouse} style={[styles.hero, { paddingTop: Math.max(18, insets.top + 6) }]} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          <View style={styles.heroTop}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <View style={styles.heroBrand}>
              <Text style={styles.brandName}>EUROHOUSE</Text>
              <Text style={styles.organization} numberOfLines={1}>{user?.organizationName ?? 'Cơ sở sản xuất'}</Text>
            </View>
            <Link href="/reminders" asChild>
              <Pressable accessibilityLabel="Mở nhắc việc" style={styles.heroIconButton}>
                <Icon name="bell" size={20} color={colors.white} />
                {(workforce?.reminders.length ?? 0) > 0 ? <View style={styles.notificationDot} /> : null}
              </Pressable>
            </Link>
          </View>

          <View style={styles.heroGreeting}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName} numberOfLines={1}>{user?.displayName ?? 'anh em xưởng'}</Text>
            <Text style={styles.today}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}</Text>
          </View>

          <View style={styles.weatherBar}>
            {weather ? (
              <>
                <Icon name={weatherIcon(weather.code)} size={26} color="#FFD28A" />
                <Text style={styles.temperature}>{Math.round(weather.temperature)}°</Text>
                <View style={styles.weatherCopy}>
                  <Text style={styles.weatherTitle}>{weatherText(weather.code)}</Text>
                  <Text style={styles.weatherMeta}>{weather.label} · Ẩm {weather.humidity}% · Gió {Math.round(weather.wind)} km/h</Text>
                </View>
              </>
            ) : (
              <>
                <Icon name="cloud" size={24} color="#FFD28A" />
                <Text style={styles.weatherUnavailable}>Thời tiết đang cập nhật</Text>
              </>
            )}
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

          {workspace ? <View style={styles.workspaceBand}><View style={styles.workspaceIcon}><Icon name={workspace.role === 'INSTALLER' ? 'tool' : workspace.role === 'WORKER' ? 'clipboard' : 'grid'} color="#175CD3" /></View><View style={{ flex: 1 }}><Text style={styles.workspaceTitle}>{workspaceCopy[workspace.role].title}</Text><Text style={styles.workspaceDetail}>{workspaceCopy[workspace.role].detail}</Text></View></View> : null}

          <View style={styles.dailyPanel}>
            <Link href="/workforce" asChild><Pressable style={styles.dailyMetric}>
              <Icon name="users" size={19} color="#0F766E" />
              <Text style={styles.dailyValue}>{workforce?.presentCount ?? 0}/{workforce?.workerCount ?? 0}</Text>
              <Text style={styles.dailyLabel}>Có mặt</Text>
            </Pressable></Link>
            <View style={styles.metricDivider} />
            <Link href="/workforce" asChild><Pressable style={styles.dailyMetric}>
              <Icon name="clock" size={19} color="#C45A13" />
              <Text style={styles.dailyValue}>{(workforce?.overtimeHours ?? 0).toFixed(1)}h</Text>
              <Text style={styles.dailyLabel}>Tăng ca</Text>
            </Pressable></Link>
            <View style={styles.metricDivider} />
            <Link href="/workforce" asChild><Pressable style={styles.dailyMetric}>
              <Icon name="dollar-sign" size={19} color="#2563EB" />
              <Text style={styles.dailyValue}>{formatMoney(workforce?.estimatedPayroll ?? 0)}</Text>
              <Text style={styles.dailyLabel}>Lương dự tính</Text>
            </Pressable></Link>
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Việc hôm nay</Text><Text style={styles.sectionCaption}>Những việc cần xử lý trước</Text></View>
            <Link href="/reminders" asChild><Pressable accessibilityLabel="Thêm nhắc việc" style={styles.addButton}><Icon name="plus" size={20} color={colors.brandOrangeText} /></Pressable></Link>
          </View>

          {(workforce?.reminders.length ?? 0) > 0 ? (
            <View style={styles.reminderList}>
              {workforce?.reminders.slice(0, 3).map((reminder) => (
                <Link key={reminder.id} href="/reminders" asChild><Pressable style={styles.reminderRow}>
                  <View style={[styles.priorityMark, reminder.priority === 'HIGH' && styles.priorityHigh]} />
                  <View style={styles.reminderCopy}><Text style={styles.reminderTitle} numberOfLines={1}>{reminder.title}</Text><Text style={styles.reminderDue}>{formatDue(reminder)}</Text></View>
                  <Icon name="chevron-right" size={18} color="#98A2B3" />
                </Pressable></Link>
              ))}
            </View>
          ) : (
            <Link href="/reminders" asChild><Pressable style={styles.noReminder}>
              <View style={styles.noReminderIcon}><Icon name="check-circle" size={20} color="#047857" /></View>
              <View style={styles.reminderCopy}><Text style={styles.noReminderTitle}>Hôm nay chưa có việc cần nhắc</Text><Text style={styles.noReminderText}>Tạo lịch giao hàng, gọi khách hoặc mua vật tư.</Text></View>
            </Pressable></Link>
          )}

          <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Tiện ích xưởng</Text><Text style={styles.sectionCaption}>Thao tác nhanh trong ngày</Text></View></View>
          <View style={styles.actionGrid}>
            {workspaceActions.map((action) => (
              <Link key={action.label} href={action.href} asChild><Pressable style={styles.actionItem}>
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}><Icon name={action.icon} size={21} color={action.color} /></View>
                <Text style={styles.actionLabel} numberOfLines={2}>{action.label}</Text>
              </Pressable></Link>
            ))}
          </View>

          {promo ? (
            <>
              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Tin mới từ Eurohouse</Text><Text style={styles.sectionCaption}>Chạm ảnh để xem đầy đủ</Text></View>
                {promos.length > 1 ? <Text style={styles.carouselCount}>{promoIndex + 1}/{promos.length}</Text> : null}
              </View>
              <Pressable style={styles.poster} onPress={() => { setSelectedPromo(promo); setSelectedImageIndex(0); }}>
                {promo.imageUrl ? <Image source={{ uri: assetUrl(promo.imageUrl) }} style={styles.posterImage} resizeMode="cover" /> : null}
                <View style={styles.posterLabel}><Icon name="zap" size={13} color={colors.brandBlack.main} /><Text style={styles.posterLabelText}>Khuyến mại</Text></View>
              </Pressable>
            </>
          ) : null}

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Đơn hàng gần đây</Text><Text style={styles.sectionCaption}>{activeCount} đơn đang xử lý · {actualKg.toFixed(1)} kg đã cân giao</Text></View>
            <Link href="/my-orders" style={styles.seeAll}>Xem tất cả</Link>
          </View>

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={colors.brandOrange} /><Text style={styles.loadingText}>Đang tải dữ liệu xưởng...</Text></View>
          ) : orders.length === 0 ? (
            <Link href="/orders" asChild><Pressable style={styles.emptyOrders}>
              <View style={styles.emptyOrderIcon}><Icon name="package" size={24} color={colors.brandOrangeText} /></View>
              <View style={styles.reminderCopy}><Text style={styles.emptyOrderTitle}>Chưa có đơn hàng</Text><Text style={styles.emptyOrderText}>Bắt đầu tạo đơn nhôm đầu tiên cho công trình.</Text></View>
              <Icon name="chevron-right" size={19} color="#98A2B3" />
            </Pressable></Link>
          ) : (
            orders.slice(0, 4).map((order) => {
              const deliveredKg = order.actualTotalKg ?? (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status) ? order.totalKg : undefined);
              return (
                <Link key={order.id} href={`/order/${order.id}` as Href} asChild><Pressable style={styles.orderRow}>
                  <View style={styles.orderIcon}><Icon name="box" size={18} color={colors.brandOrangeText} /></View>
                  <View style={styles.orderCopy}><Text style={styles.orderCode}>{order.code}</Text><Text style={styles.orderMeta}>{deliveredKg !== undefined ? `${deliveredKg.toFixed(1)} kg thực tế` : 'Chờ NPP cân giao'} · {formatMoney(order.totalAmount)}</Text></View>
                  <View style={[styles.statusPill, { backgroundColor: `${statusTone[order.status] ?? '#667085'}18` }]}><Text style={[styles.statusText, { color: statusTone[order.status] ?? '#344054' }]} numberOfLines={1}>{statusText[order.status] ?? order.status}</Text></View>
                </Pressable></Link>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={!!selectedPromo} transparent animationType="fade" onRequestClose={() => setSelectedPromo(null)}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Đóng ảnh khuyến mại" style={[styles.modalClose, { top: Math.max(24, insets.top + 8) }]} onPress={() => setSelectedPromo(null)}><Icon name="x" size={22} color={colors.white} /></Pressable>
          {modalImages.length > 0 ? (
            <View style={styles.modalBody}>
              <ScrollView ref={promoGalleryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setSelectedImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH))}>
                {modalImages.map((image) => <Image key={image} source={{ uri: assetUrl(image) }} style={styles.modalImage} resizeMode="contain" />)}
              </ScrollView>
              {modalImages.length > 1 ? <View style={styles.modalControls}>
                <Pressable style={styles.modalArrow} onPress={() => changeModalImage(-1)}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
                <Text style={styles.modalCount}>{selectedImageIndex + 1}/{modalImages.length}</Text>
                <Pressable style={styles.modalArrow} onPress={() => changeModalImage(1)}><Icon name="chevron-right" size={22} color={colors.white} /></Pressable>
              </View> : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6F8' },
  scrollContent: { paddingBottom: 112 },
  hero: { minHeight: 278, paddingHorizontal: 20, paddingBottom: 18, justifyContent: 'space-between', overflow: 'hidden', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroImage: { borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 20, 28, 0.66)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  logo: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.white },
  heroBrand: { flex: 1, marginLeft: 11 },
  brandName: { color: colors.white, fontSize: 15, fontWeight: '900' },
  organization: { color: '#D7DEE7', fontSize: 11, marginTop: 2, maxWidth: 220 },
  heroIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)' },
  notificationDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF7A1A', borderWidth: 1.5, borderColor: colors.white },
  heroGreeting: { marginTop: 20, marginBottom: 18 },
  greeting: { color: '#E8EDF3', fontSize: 14, fontWeight: '600' },
  userName: { color: colors.white, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 2, maxWidth: '90%' },
  today: { color: '#FFD28A', fontSize: 12, fontWeight: '700', marginTop: 6, textTransform: 'capitalize' },
  weatherBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(10, 17, 24, 0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  temperature: { color: colors.white, fontSize: 27, fontWeight: '900', marginLeft: 9 },
  weatherCopy: { flex: 1, marginLeft: 12 },
  weatherTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  weatherMeta: { color: '#CFD6DE', fontSize: 10, marginTop: 3 },
  weatherUnavailable: { color: colors.white, fontWeight: '700', marginLeft: 10 },
  content: { paddingHorizontal: 16 },
  errorBanner: { marginTop: 14, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, color: '#B42318', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  workspaceBand: { marginTop: 14, minHeight: 72, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#B2DDFF', backgroundColor: '#EFF8FF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  workspaceIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  workspaceTitle: { color: '#1849A9', fontSize: 14, fontWeight: '900' },
  workspaceDetail: { color: '#475467', fontSize: 10, lineHeight: 15, marginTop: 3 },
  dailyPanel: { marginTop: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E7E9ED', borderRadius: 14, minHeight: 96, flexDirection: 'row', alignItems: 'center' },
  dailyMetric: { flex: 1, minHeight: 94, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dailyValue: { color: '#172033', fontWeight: '900', fontSize: 17, marginTop: 5 },
  dailyLabel: { color: '#667085', fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  metricDivider: { width: 1, height: 48, backgroundColor: '#E7E9ED' },
  sectionHeader: { marginTop: 24, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172033', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sectionCaption: { color: '#667085', fontSize: 11, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  reminderList: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED', overflow: 'hidden' },
  reminderRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  priorityMark: { width: 4, height: 32, borderRadius: 2, backgroundColor: '#F59E0B', marginRight: 11 },
  priorityHigh: { backgroundColor: '#E5484D' },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  reminderDue: { color: '#667085', fontSize: 10, marginTop: 4 },
  noReminder: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, backgroundColor: '#EFFAF5', borderWidth: 1, borderColor: '#CBEBDD', borderRadius: 12 },
  noReminderIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  noReminderTitle: { color: '#065F46', fontSize: 13, fontWeight: '800' },
  noReminderText: { color: '#477565', fontSize: 10, marginTop: 3, lineHeight: 15 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: '#E7E9ED', paddingVertical: 12 },
  actionItem: { width: '25%', minHeight: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  actionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#344054', fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center', marginTop: 7, minHeight: 26 },
  carouselCount: { color: '#667085', fontSize: 11, fontWeight: '700' },
  poster: { height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E9ECF1' },
  posterImage: { width: '100%', height: '100%' },
  posterLabel: { position: 'absolute', left: 10, top: 10, minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FFB15C' },
  posterLabelText: { color: '#172033', fontSize: 11, fontWeight: '900' },
  seeAll: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 12 },
  loading: { minHeight: 100, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadingText: { color: '#667085', fontSize: 11 },
  emptyOrders: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E7E9ED' },
  emptyOrderIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  emptyOrderTitle: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  emptyOrderText: { color: '#667085', fontSize: 10, lineHeight: 15, marginTop: 3 },
  orderRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E7E9ED', borderRadius: 12 },
  orderIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#FFF0E5', alignItems: 'center', justifyContent: 'center' },
  orderCopy: { flex: 1, minWidth: 0 },
  orderCode: { color: '#1D2939', fontSize: 12, fontWeight: '900' },
  orderMeta: { color: '#667085', fontSize: 10, marginTop: 4 },
  statusPill: { maxWidth: 88, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' },
  modalClose: { position: 'absolute', right: 18, zIndex: 5, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { flex: 1, justifyContent: 'center' },
  modalImage: { width: SCREEN_WIDTH, height: '78%' },
  modalControls: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  modalArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  modalCount: { color: colors.white, fontWeight: '800', minWidth: 54, textAlign: 'center' },
});
