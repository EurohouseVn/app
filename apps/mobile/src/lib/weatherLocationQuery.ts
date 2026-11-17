// Turns a Vietnamese workshop address/province into geocoder-friendly queries.
// Pure (no React Native imports) so it is unit-tested with node --test.

export type LocationCandidate = { name: string; province?: string };
export type GeocodedPlace = { name: string; admin1?: string };

const PROVINCE_ALIASES: Record<string, string> = {
  hcm: 'Hồ Chí Minh',
  tphcm: 'Hồ Chí Minh',
  hochiminh: 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  sg: 'Hồ Chí Minh',
  hn: 'Hà Nội',
};

// Administrative prefixes the geocoder does not understand. "Quận" is kept
// because urban districts are named by number ("Quận 7").
const PREFIX = /^(tỉnh|thành phố|tp\.?|thị xã|tx\.?|huyện|phường|p\.|xã|thị trấn|tt\.?)\s*/iu;

export function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanSegment(raw: string): string | null {
  let value = raw.trim();
  if (!value || /^\d/.test(value)) return null; // house number / street line
  for (let i = 0; i < 2; i += 1) value = value.replace(PREFIX, '').trim();
  if (!value) return null;
  const alias = PROVINCE_ALIASES[foldVietnamese(value)];
  return alias ?? value;
}

export function sameProvince(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const strip = (value: string) => foldVietnamese(value).replace(/^(thanhpho|tinh|tp)/, '');
  return strip(a) === strip(b);
}

export function locationCandidates(province?: string | null, address?: string | null): LocationCandidate[] {
  const segments = (address ?? '')
    .split(/[,\-–/]/)
    .map(cleanSegment)
    .filter((value): value is string => Boolean(value));
  const savedProvince = province ? cleanSegment(province) : null;

  let resolvedProvince = savedProvince;
  let district: string | undefined;
  if (savedProvince) {
    const last = segments[segments.length - 1];
    if (last && sameProvince(last, savedProvince)) district = segments[segments.length - 2];
  } else if (segments.length) {
    resolvedProvince = segments[segments.length - 1];
    district = segments[segments.length - 2];
  }

  if (!resolvedProvince) return [];
  const candidates: LocationCandidate[] = [];
  if (district) candidates.push({ name: district, province: resolvedProvince });
  candidates.push({ name: resolvedProvince });
  return candidates;
}

export function pickProvinceMatch<T extends GeocodedPlace>(results: T[], expectedProvince?: string): T | undefined {
  if (!expectedProvince) return results[0];
  return results.find((place) => sameProvince(place.admin1, expectedProvince));
}
