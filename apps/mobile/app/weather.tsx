import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { useAuth } from '../src/lib/auth';
import {
  fetchWeatherForecast,
  initialWeatherLocation,
  installationRiskText,
  saveWeatherLocation,
  searchWeatherLocations,
  weatherIcon,
  weatherText,
  type DailyWeather,
  type InstallationWeatherRisk,
  type WeatherForecast,
  type WeatherLocation,
} from '../src/lib/weather';

const riskColors: Record<InstallationWeatherRisk, { background: string; text: string; border: string }> = {
  GOOD: { background: '#EAF8F3', text: '#087F6A', border: '#B7E4D7' },
  CAUTION: { background: '#FFF6DE', text: '#A15C00', border: '#F3D58A' },
  RAIN: { background: '#EAF1FF', text: '#1D4ED8', border: '#BFD1FF' },
};

function formatDay(date: string, index: number): { day: string; date: string } {
  const value = new Date(`${date}T12:00:00`);
  return {
    day: index === 0 ? 'Hôm nay' : value.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', ''),
    date: value.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace(/-/g, '/'),
  };
}

function WeekStrip({ days }: { days: DailyWeather[] }) {
  return (
    <View style={styles.weekStrip} accessibilityLabel="Tóm tắt 7 ngày">
      {days.slice(0, 7).map((item, index) => {
        const date = formatDay(item.date, index);
        const tone = riskColors[item.risk];
        return (
          <View key={item.date} style={[styles.weekDay, index === 0 && styles.weekDayToday]}>
            <Text style={styles.weekDayName} numberOfLines={1}>{index === 0 ? 'Nay' : date.day}</Text>
            <Icon name={weatherIcon(item.code)} size={18} color={item.risk === 'RAIN' ? '#2563EB' : '#C45513'} />
            <Text style={styles.weekTemp}>{Math.round(item.tempMax)}°</Text>
            <Text style={styles.weekTempMin}>{Math.round(item.tempMin)}°</Text>
            <View style={[styles.weekRiskDot, { backgroundColor: tone.text }]} />
          </View>
        );
      })}
    </View>
  );
}

function ForecastRow({ item, index }: { item: DailyWeather; index: number }) {
  const date = formatDay(item.date, index);
  const tone = riskColors[item.risk];
  return (
    <View style={styles.forecastRow}>
      <View style={styles.forecastDate}>
        <Text style={styles.forecastDay}>{date.day}</Text>
        <Text style={styles.forecastDateText}>{date.date}</Text>
      </View>
      <View style={styles.conditionIcon}>
        <Icon name={weatherIcon(item.code)} size={21} color={item.risk === 'RAIN' ? '#2563EB' : '#C45513'} />
      </View>
      <View style={styles.forecastMain}>
        <Text style={styles.forecastCondition} numberOfLines={1}>{weatherText(item.code)}</Text>
        <View style={styles.forecastMetrics}>
          <Text style={styles.forecastMetric}>Mưa {Math.round(item.precipitationProbability)}%</Text>
          <Text style={styles.metricDot}>·</Text>
          <Text style={styles.forecastMetric}>{item.precipitationSum.toFixed(1)} mm</Text>
          <Text style={styles.metricDot}>·</Text>
          <Text style={styles.forecastMetric}>{Math.round(item.windMax)} km/h</Text>
        </View>
      </View>
      <View style={styles.forecastRight}>
        <Text style={styles.temperatureRange}>{Math.round(item.tempMax)}° / {Math.round(item.tempMin)}°</Text>
        <View style={[styles.riskBadge, { backgroundColor: tone.background, borderColor: tone.border }]}>
          <Text style={[styles.riskText, { color: tone.text }]}>{installationRiskText(item.risk)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function WeatherScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);

  const loadForecast = useCallback(async (location: WeatherLocation, persist = false) => {
    setLoading(true);
    setError('');
    try {
      const nextForecast = await fetchWeatherForecast(location);
      if (persist) await saveWeatherLocation(location);
      setForecast(nextForecast);
      setNeedsLocation(false);
      setResults([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dự báo thời tiết.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const initial = await initialWeatherLocation(user?.organizationProvince, Boolean(user));
      if (initial.source === 'default') {
        // Không đoán bừa TP.HCM: hỏi người dùng khu vực xưởng ngay lần đầu.
        setNeedsLocation(true);
        setLoading(false);
        return;
      }
      await loadForecast(initial);
    })();
  }, [loadForecast, user]);

  async function handleSearch() {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError('Nhập ít nhất 2 ký tự để tìm địa điểm.');
      return;
    }
    Keyboard.dismiss();
    setSearching(true);
    setError('');
    try {
      const matches = await searchWeatherLocations(normalized);
      setResults(matches);
      if (!matches.length) setError('Không tìm thấy địa điểm phù hợp tại Việt Nam.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tìm được địa điểm.');
    } finally {
      setSearching(false);
    }
  }

  async function handleCurrentLocation() {
    setLocating(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Chưa có quyền vị trí', 'Hãy cho phép Eurohouse truy cập vị trí khi dùng ứng dụng, hoặc nhập địa điểm cần xem.');
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 3000 });
      const position = lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = position.coords;
      let label = 'Vị trí hiện tại';
      let detail = '';
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        label = address?.district || address?.city || address?.subregion || label;
        detail = [address?.region, address?.country].filter(Boolean).join(', ');
      } catch {
        // Tọa độ vẫn đủ để tải thời tiết nếu dịch vụ đổi ngược địa chỉ tạm thời lỗi.
      }
      await loadForecast({ latitude, longitude, label, detail, source: 'device' }, true);
      setQuery('');
    } catch {
      setError('Không xác định được vị trí. Hãy bật định vị hoặc nhập địa điểm cần xem.');
    } finally {
      setLocating(false);
    }
  }

  const current = forecast?.current;
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: Math.max(12, insets.top + 2) }]}>
        <Pressable accessibilityLabel="Quay lại" style={styles.headerButton} onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color="#172033" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Thời tiết lắp đặt</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{forecast?.location.label ?? 'Đang xác định khu vực'}</Text>
        </View>
        <Pressable accessibilityLabel="Tải lại dự báo" style={styles.headerButton} disabled={!forecast || loading} onPress={() => forecast && void loadForecast(forecast.location)}>
          <Icon name="refresh-cw" size={19} color={loading ? '#98A2B3' : '#172033'} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 112 + insets.bottom }]}>
        {needsLocation ? (
          <View style={styles.askCard}>
            <View style={styles.askIcon}><Icon name="map-pin" size={22} color={colors.brandOrangeText} /></View>
            <Text style={styles.askTitle}>Xưởng của bạn ở khu vực nào?</Text>
            <Text style={styles.askText}>Chọn một lần để xem đúng thời tiết 7 ngày nơi lắp đặt. Bạn có thể đổi lại bất cứ lúc nào.</Text>
          </View>
        ) : null}

        <View style={styles.locationPanel}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Icon name="search" size={18} color="#667085" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void handleSearch()}
                returnKeyType="search"
                placeholder="Nhập quận/huyện, tỉnh hoặc địa điểm"
                placeholderTextColor="#98A2B3"
                style={styles.searchInput}
              />
            </View>
            <Pressable accessibilityLabel="Tìm địa điểm" style={styles.searchButton} disabled={searching} onPress={() => void handleSearch()}>
              {searching ? <ActivityIndicator size="small" color={colors.white} /> : <Icon name="arrow-right" size={19} color={colors.white} />}
            </Pressable>
          </View>
          <Pressable style={styles.locationButton} disabled={locating} onPress={() => void handleCurrentLocation()}>
            {locating ? <ActivityIndicator size="small" color={colors.brandOrangeText} /> : <Icon name="map-pin" size={18} color={colors.brandOrangeText} />}
            <Text style={styles.locationButtonText}>{locating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}</Text>
          </Pressable>

          {results.length ? (
            <View style={styles.searchResults}>
              {results.map((item) => (
                <Pressable key={`${item.latitude}-${item.longitude}`} style={styles.searchResult} onPress={() => void loadForecast(item, true)}>
                  <View style={styles.resultIcon}><Icon name="map-pin" size={17} color={colors.brandOrangeText} /></View>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultTitle}>{item.label}</Text>
                    <Text style={styles.resultDetail} numberOfLines={1}>{item.detail || 'Việt Nam'}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color="#98A2B3" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {error ? (
          <Pressable style={styles.errorBanner} onPress={() => forecast && void loadForecast(forecast.location)}>
            <Icon name="alert-circle" size={18} color="#B42318" />
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        {loading && !forecast ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.brandOrange} />
            <Text style={styles.loadingText}>Đang tải dự báo 7 ngày...</Text>
          </View>
        ) : current && forecast ? (
          <>
            <View style={styles.currentPanel}>
              <View style={styles.currentTop}>
                <View style={styles.currentIcon}>
                  <Icon name={weatherIcon(current.code)} size={31} color="#C45513" />
                </View>
                <View style={styles.currentCopy}>
                  <Text style={styles.currentLocation}>{forecast.location.label}</Text>
                  <Text style={styles.currentCondition}>{weatherText(current.code)}</Text>
                </View>
                <Text style={styles.currentTemperature}>{Math.round(current.temperature)}°</Text>
              </View>
              <View style={styles.currentMetrics}>
                <View style={styles.currentMetric}>
                  <Icon name="cloud-rain" size={17} color="#2563EB" />
                  <Text style={styles.currentMetricValue}>{Math.round(forecast.daily[0]?.precipitationProbability ?? 0)}%</Text>
                  <Text style={styles.currentMetricLabel}>Khả năng mưa</Text>
                </View>
                <View style={styles.currentDivider} />
                <View style={styles.currentMetric}>
                  <Icon name="cloud" size={17} color="#0F766E" />
                  <Text style={styles.currentMetricValue}>{Math.round(current.humidity)}%</Text>
                  <Text style={styles.currentMetricLabel}>Độ ẩm</Text>
                </View>
                <View style={styles.currentDivider} />
                <View style={styles.currentMetric}>
                  <Icon name="wind" size={17} color="#C45513" />
                  <Text style={styles.currentMetricValue}>{Math.round(current.wind)}</Text>
                  <Text style={styles.currentMetricLabel}>Gió km/h</Text>
                </View>
              </View>
            </View>

            <WeekStrip days={forecast.daily} />

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Chi tiết 7 ngày</Text>
                <Text style={styles.sectionSubtitle}>Đánh giá nhanh điều kiện lắp đặt</Text>
              </View>
              {loading ? <ActivityIndicator size="small" color={colors.brandOrange} /> : null}
            </View>
            <View style={styles.forecastList}>
              {forecast.daily.map((item, index) => <ForecastRow key={item.date} item={item} index={index} />)}
            </View>

            <View style={styles.note}>
              <Icon name="info" size={17} color="#475467" />
              <Text style={styles.noteText}>Dự báo có thể thay đổi. Kiểm tra lại trước ngày lắp đặt, nhất là các ngày được đánh dấu “Cân nhắc” hoặc “Dễ mưa”.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  header: { minHeight: 78, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E4E7EC' },
  headerButton: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: '#172033', fontSize: 19, lineHeight: 24, fontWeight: '900' },
  subtitle: { color: '#667085', fontSize: 11, marginTop: 2 },
  content: { padding: 16 },
  locationPanel: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E3E7EC', backgroundColor: colors.white },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInputWrap: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F4F6F8', borderWidth: 1, borderColor: '#E4E7EC' },
  searchInput: { flex: 1, minWidth: 0, color: '#172033', fontSize: 13, paddingVertical: 0 },
  searchButton: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandOrange },
  locationButton: { minHeight: 42, marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, backgroundColor: '#FFF2E8' },
  locationButtonText: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '900' },
  searchResults: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#EAECF0' },
  searchResult: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  resultIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2E8' },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { color: '#1D2939', fontSize: 13, fontWeight: '800' },
  resultDetail: { color: '#667085', fontSize: 10, marginTop: 3 },
  errorBanner: { minHeight: 48, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 10, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2' },
  errorText: { flex: 1, color: '#B42318', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  loadingBox: { minHeight: 180, marginTop: 14, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E3E7EC' },
  loadingText: { color: '#667085', fontSize: 12 },
  currentPanel: { marginTop: 14, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#E3E7EC', backgroundColor: colors.white },
  currentTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  currentIcon: { width: 52, height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2E8' },
  currentCopy: { flex: 1, minWidth: 0 },
  currentLocation: { color: '#172033', fontSize: 15, fontWeight: '900' },
  currentCondition: { color: '#667085', fontSize: 11, marginTop: 4 },
  currentTemperature: { color: '#172033', fontSize: 34, fontWeight: '900' },
  currentMetrics: { minHeight: 74, marginTop: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: '#F7F8FA' },
  currentMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  currentMetricValue: { color: '#172033', fontSize: 14, fontWeight: '900', marginTop: 3 },
  currentMetricLabel: { color: '#667085', fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  currentDivider: { width: 1, height: 38, backgroundColor: '#E2E6EB' },
  sectionHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#172033', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#667085', fontSize: 10, marginTop: 3 },
  forecastList: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E3E7EC', backgroundColor: colors.white },
  forecastRow: { minHeight: 82, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  forecastDate: { width: 50 },
  forecastDay: { color: '#1D2939', fontSize: 11, fontWeight: '900' },
  forecastDateText: { color: '#667085', fontSize: 9, marginTop: 4 },
  conditionIcon: { width: 36, height: 36, marginRight: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  forecastMain: { flex: 1, minWidth: 0 },
  forecastCondition: { color: '#344054', fontSize: 11, fontWeight: '800' },
  forecastMetrics: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  forecastMetric: { color: '#667085', fontSize: 8.5, fontWeight: '600' },
  metricDot: { color: '#98A2B3', fontSize: 8.5, marginHorizontal: 3 },
  forecastRight: { width: 74, alignItems: 'flex-end' },
  temperatureRange: { color: '#172033', fontSize: 11, fontWeight: '900' },
  riskBadge: { minWidth: 66, minHeight: 24, marginTop: 7, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1 },
  riskText: { fontSize: 9, fontWeight: '900' },
  askCard: { marginBottom: 12, padding: 16, borderRadius: 14, backgroundColor: '#FFF4E9', borderWidth: 1, borderColor: '#FFD7B5' },
  askIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  askTitle: { color: '#7A3108', fontSize: 16, fontWeight: '900', marginTop: 10 },
  askText: { color: '#75472C', fontSize: 12, lineHeight: 18, marginTop: 4 },
  weekStrip: { marginTop: 12, flexDirection: 'row', gap: 4, padding: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E3E7EC', backgroundColor: colors.white },
  weekDay: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 10 },
  weekDayToday: { backgroundColor: '#FFF2E8' },
  weekDayName: { color: '#344054', fontSize: 10, fontWeight: '900' },
  weekTemp: { color: '#172033', fontSize: 13, fontWeight: '900' },
  weekTempMin: { color: '#98A2B3', fontSize: 10, fontWeight: '700', marginTop: -3 },
  weekRiskDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  note: { marginTop: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 10, backgroundColor: '#EEF1F4' },
  noteText: { flex: 1, color: '#475467', fontSize: 10, lineHeight: 15, fontWeight: '600' },
});
