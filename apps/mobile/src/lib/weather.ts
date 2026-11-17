import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../components/Icon';

const LOCATION_STORAGE_KEY = 'eurohouse-weather-location-v1';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
  detail?: string;
  source: 'device' | 'search' | 'organization' | 'default';
};

export type CurrentWeather = {
  temperature: number;
  humidity: number;
  wind: number;
  code: number;
};

export type InstallationWeatherRisk = 'GOOD' | 'CAUTION' | 'RAIN';

export type DailyWeather = {
  date: string;
  code: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  precipitationSum: number;
  windMax: number;
  sunrise?: string;
  sunset?: string;
  risk: InstallationWeatherRisk;
};

export type WeatherForecast = {
  location: WeatherLocation;
  current: CurrentWeather;
  daily: DailyWeather[];
  fetchedAt: string;
};

type ForecastPayload = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
};

type GeocodingPayload = {
  results?: GeocodingResult[];
};

export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  latitude: 10.8231,
  longitude: 106.6297,
  label: 'TP. Hồ Chí Minh',
  detail: 'Việt Nam',
  source: 'default',
};

export function weatherText(code: number): string {
  if (code === 0) return 'Trời quang';
  if (code <= 3) return 'Có mây';
  if (code <= 48) return 'Có sương';
  if (code <= 57) return 'Mưa phùn';
  if (code <= 67) return 'Có mưa';
  if (code <= 77) return 'Mưa tuyết';
  if (code <= 82) return 'Mưa rào';
  if (code <= 86) return 'Tuyết rào';
  if (code >= 95) return 'Mưa dông';
  return 'Nhiều mây';
}

export function weatherIcon(code: number): IconName {
  if (code === 0) return 'sun';
  if (code <= 48) return 'cloud';
  return 'cloud-rain';
}

export function installationRisk(probability: number, precipitation: number, code: number): InstallationWeatherRisk {
  const substantialRainCode = (code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const lightRainCode = code >= 51 && code <= 57;
  if (probability >= 60 || precipitation >= 5 || substantialRainCode) return 'RAIN';
  if (probability >= 35 || precipitation >= 1 || lightRainCode) return 'CAUTION';
  return 'GOOD';
}

export function installationRiskText(risk: InstallationWeatherRisk): string {
  if (risk === 'GOOD') return 'Thuận lợi';
  if (risk === 'CAUTION') return 'Cân nhắc';
  return 'Dễ mưa';
}

export async function loadWeatherLocation(): Promise<WeatherLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const location = JSON.parse(raw) as Partial<WeatherLocation>;
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number' || !location.label) return null;
    return location as WeatherLocation;
  } catch {
    return null;
  }
}

export async function saveWeatherLocation(location: WeatherLocation): Promise<void> {
  await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
}

export async function searchWeatherLocations(query: string): Promise<WeatherLocation[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const response = await fetch(`${GEOCODING_URL}?name=${encodeURIComponent(name)}&count=8&language=vi&format=json&countryCode=VN`);
  if (!response.ok) throw new Error('Không tìm được địa điểm. Vui lòng thử lại.');
  const payload = (await response.json()) as GeocodingPayload;
  return (payload.results ?? []).map((item) => {
    const detailParts = [item.admin2, item.admin1, item.country].filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index);
    return {
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.name,
      detail: detailParts.join(', '),
      source: 'search' as const,
    };
  });
}

export async function resolveOrganizationLocation(province?: string | null): Promise<WeatherLocation> {
  const query = province?.trim();
  if (!query) return DEFAULT_WEATHER_LOCATION;
  try {
    const [match] = await searchWeatherLocations(query);
    if (!match) return DEFAULT_WEATHER_LOCATION;
    return { ...match, source: 'organization' };
  } catch {
    return DEFAULT_WEATHER_LOCATION;
  }
}

export async function fetchWeatherForecast(location: WeatherLocation): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  });
  const response = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('Không tải được dự báo thời tiết.');
  const payload = (await response.json()) as ForecastPayload;
  const current = payload.current;
  const daily = payload.daily;
  if (!current || current.temperature_2m === undefined || !daily?.time?.length) {
    throw new Error('Dữ liệu thời tiết chưa sẵn sàng.');
  }

  return {
    location,
    current: {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m ?? 0,
      wind: current.wind_speed_10m ?? 0,
      code: current.weather_code ?? 0,
    },
    daily: daily.time.slice(0, 7).map((date, index) => {
      const probability = daily.precipitation_probability_max?.[index] ?? 0;
      const precipitation = daily.precipitation_sum?.[index] ?? 0;
      const code = daily.weather_code?.[index] ?? 0;
      return {
        date,
        code,
        tempMax: daily.temperature_2m_max?.[index] ?? 0,
        tempMin: daily.temperature_2m_min?.[index] ?? 0,
        precipitationProbability: probability,
        precipitationSum: precipitation,
        windMax: daily.wind_speed_10m_max?.[index] ?? 0,
        sunrise: daily.sunrise?.[index],
        sunset: daily.sunset?.[index],
        risk: installationRisk(probability, precipitation, code),
      };
    }),
    fetchedAt: new Date().toISOString(),
  };
}
