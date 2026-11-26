/**
 * Ghép dòng đọc được từ ảnh phiếu (chữ viết tay của thợ hoặc hóa đơn in) với danh mục thanh nhôm của Eurohouse.
 * Đây là phần "hiểu nghiệp vụ" nằm sau bước đọc chữ (OCR / mô hình thị giác), nên đổi mô hình đọc chữ không đổi phần này.
 * Hàm thuần: không đụng cơ sở dữ liệu, cùng đầu vào luôn cho cùng kết quả (docs/design/NPP_OCR_EVALUATION.md mục 6).
 *
 * Nguyên tắc: mã trong chữ (ECS01, E70KT...) đáng tin hơn mô tả viết tay; mô tả chỉ đủ để GỢI Ý, người dùng xác nhận;
 * dòng nào không chắc thì để trống thay vì đoán, vì đoán sai làm sai đơn hàng và tồn kho.
 */

export type CatalogProfile = { id: string; code: string; name: string; systemCode: string; systemName: string; barsPerBundle: number };
export type GlossaryEntry = { term: string; profileId?: string; colorCode?: string };
export type QuantityUnit = 'BUNDLE' | 'BAR' | 'SET' | null;
export type MatchInput = { text: string; quantity: number | null; unit: string | null; colorHint?: string; systemHint?: string };
export type CandidateReason = 'CODE' | 'GLOSSARY' | 'NAME';
export type Candidate = { profileId: string; code: string; name: string; systemCode: string; score: number; reason: CandidateReason };
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type MatchedLine = {
  text: string;
  quantity: number | null;
  unit: QuantityUnit;
  bars: number | null;
  colorCode: string | null;
  profileId: string | null;
  candidates: Candidate[];
  confidence: Confidence;
  warnings: string[];
};

const REASON_PRIORITY: Record<CandidateReason, number> = { CODE: 3, GLOSSARY: 2, NAME: 1 };
const NAME_SCORE_CAP = 0.89;
const NAME_MIN_SCORE = 0.45;
const SELECT_MIN = 0.7;
const SELECT_GAP = 0.12;
const SAME_CODE_GAP = 0.04;
const MAX_CANDIDATES = 5;

export function normalizeText(value: string): string {
  return (value ?? '')
    .replace(/[φΦ]/g, 'phi')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Số lượng và đơn vị viết tắt kiểu thợ: "4 bó", "8b.", "2c", "3 cây", "1 bộ", hoặc chỉ một con số. */
export function parseQuantityUnit(text: string): { quantity: number | null; unit: QuantityUnit } {
  const withUnit = /(\d+)\s*(bó|bộ|cây|bo|cay|b|c)(?![\p{L}])/iu.exec((text ?? '').trim());
  if (withUnit) {
    const word = withUnit[2].toLowerCase();
    const unit: QuantityUnit = word === 'bộ' ? 'SET' : word === 'cây' || word === 'cay' || word === 'c' ? 'BAR' : 'BUNDLE';
    return { quantity: Number(withUnit[1]), unit };
  }
  const bare = /^\D*(\d+)\D*$/.exec((text ?? '').trim());
  return bare ? { quantity: Number(bare[1]), unit: null } : { quantity: null, unit: null };
}

/** Đổi sang số cây. Bó cần quy cách bó của thanh; đơn vị chưa rõ hoặc là bộ thì chưa tính được. */
export function convertToBars(quantity: number | null, unit: QuantityUnit | string | null, barsPerBundle: number): number | null {
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (unit === 'BAR') return quantity;
  if (unit === 'BUNDLE') return barsPerBundle > 0 ? quantity * barsPerBundle : null;
  return null;
}

const COLOR_SYNONYMS: Array<{ colorCode: string; terms: string[] }> = [
  { colorCode: 'CAFE_METALIC', terms: ['cafe metalic', 'ca phe metalic', 'cafe metallic', 'ca phe metallic'] },
  { colorCode: 'CAFE_THUONG', terms: ['cafe thuong', 'ca phe thuong', 'cafe', 'ca phe'] },
  { colorCode: 'XAM_NGOC_TRAI', terms: ['xam ngoc trai', 'ngoc trai'] },
  { colorCode: 'VAN_GO_CAM_LAI', terms: ['van go cam lai', 'cam lai'] },
  { colorCode: 'VAN_GO_OLAK', terms: ['van go olak', 'olak'] },
  { colorCode: 'XAM_RITA', terms: ['xam rita', 'rita'] },
];
const COLOR_TERMS = COLOR_SYNONYMS.flatMap((c) => c.terms.map((term) => ({ colorCode: c.colorCode, term, words: term.split(' ') })))
  .sort((a, b) => b.words.length - a.words.length || b.term.length - a.term.length);

/** Tên màu nhôm trong chữ (tiêu đề nhóm hoặc trong dòng), chịu được sai chính tả nhẹ do chữ viết tay. */
export function matchColor(text: string): { colorCode: string; score: number } | null {
  const words = normalizeText(text).split(' ').filter(Boolean);
  if (words.length === 0) return null;
  const joined = ` ${words.join(' ')} `;
  for (const entry of COLOR_TERMS) {
    if (joined.includes(` ${entry.term} `)) return { colorCode: entry.colorCode, score: 1 };
  }
  for (const entry of COLOR_TERMS) {
    const size = entry.words.length;
    for (let i = 0; i + size <= words.length; i++) {
      const window = words.slice(i, i + size).join(' ');
      const tolerance = entry.term.length >= 8 ? 2 : entry.term.length >= 4 ? 1 : 0;
      if (tolerance > 0 && levenshtein(window, entry.term) <= tolerance && words.slice(i, i + size).every((w, k) => levenshtein(w, entry.words[k]) <= 1)) {
        return { colorCode: entry.colorCode, score: 0.85 };
      }
    }
  }
  return null;
}

const EXPANSIONS: Array<[RegExp, string]> = [
  [/\bk bao\b/g, 'khung bao'],
  [/\bkbao\b/g, 'khung bao'],
  [/\bkb\b/g, 'khung bao'],
];
const STOP_WORDS = new Set(['ma', 'la', 'cho', 'lai', 'bo', 'cay', 'cai']);

function stripTrailingQuantity(text: string): string {
  return text.replace(/\s*[=:]?\s*\d+\s*(bó|bộ|cây|bo|cay|b|c)?\s*[.,]?\s*$/iu, (match) => (/\d+\s*(bó|bộ|cây|bo|cay|b|c)\s*[.,]?\s*$/iu.test(match) ? '' : match));
}

function tokenize(normalized: string): string[] {
  return normalized.split(' ').flatMap((word) => word.match(/\d+|[a-z]+/g) ?? []);
}

/** Từ khóa học được từ một dòng đã xác nhận: bỏ số lượng và đơn vị ở cuối, chuẩn hóa chữ. Quá ngắn hoặc không có chữ thì bỏ. */
export function learnTermFromLine(text: string): string | null {
  const term = normalizeText(stripTrailingQuantity((text ?? '').trim()));
  return term.length >= 3 && /[a-z]/.test(term) ? term : null;
}

function normalizeUnit(unit: string | null): QuantityUnit {
  return unit === 'BUNDLE' || unit === 'BAR' || unit === 'SET' ? unit : null;
}

const codeKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function codeTokens(text: string): string[] {
  return (text.match(/[A-Za-z0-9][A-Za-z0-9-]{2,}/g) ?? []).map(codeKey).filter((t) => /[A-Z]/.test(t) && /\d/.test(t) && t.length >= 3);
}

/** Cách người ta gọi một hệ nhôm trong chữ: "EU-70" -> 70, e70; "EU-ECPLUS" -> ecplus, plus. */
function systemKeys(systemCode: string): string[] {
  const last = normalizeText(systemCode).split(' ').pop() ?? '';
  const keys = new Set<string>([last]);
  if (/^\d+$/.test(last)) keys.add(`e${last}`);
  if (last.endsWith('plus')) keys.add('plus');
  return [...keys].filter(Boolean);
}

/** Chỉ chịu lỗi một ký tự với từ từ 5 chữ trở lên: từ ngắn ("lưới"/"dưới") đổi nghĩa chỉ với một ký tự. */
const FUZZY_MIN_LENGTH = 5;

type Scored = Candidate & { rank: number; systemMatch: boolean };

export function matchLine(input: MatchInput, catalog: CatalogProfile[], glossary: GlossaryEntry[]): MatchedLine {
  const rawText = (input.text ?? '').trim();
  const cleaned = stripTrailingQuantity(rawText);
  const normalized = normalizeText(cleaned);
  const expanded = EXPANSIONS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), normalized);
  const hintTokens = new Set(tokenize(normalizeText(input.systemHint ?? '')));
  // "hệ 55" viết ngay trong dòng cũng là gợi ý hệ nhôm.
  for (const match of expanded.matchAll(/\bhe (\d+)\b/g)) hintTokens.add(match[1]);
  const isSystemMatch = (profile: CatalogProfile) => systemKeys(profile.systemCode).some((key) => hintTokens.has(key));
  const warnings: string[] = [];
  const scored = new Map<string, Scored>();
  const offer = (profile: CatalogProfile, rank: number, reason: CandidateReason) => {
    const systemMatch = isSystemMatch(profile);
    const current = scored.get(profile.id);
    if (current && REASON_PRIORITY[current.reason] >= REASON_PRIORITY[reason]) {
      // Lý do mạnh hơn (mã, từ điển đã học) được giữ nguyên; chỉ nâng điểm nếu lý do yếu hơn cho điểm cao hơn.
      if (rank > current.rank) { current.rank = rank; current.score = Math.min(rank, 1); }
      return;
    }
    scored.set(profile.id, {
      profileId: profile.id, code: profile.code, name: profile.name, systemCode: profile.systemCode,
      score: Math.min(rank, reason === 'NAME' ? NAME_SCORE_CAP : 1), reason, rank, systemMatch,
    });
  };

  // Điểm theo tên: so các từ và các con số kích thước. Từ lệch chữ chỉ cho GỢI Ý, không bao giờ đủ để tự chọn.
  const rawTokens = [...new Set(tokenize(expanded).filter((t) => !STOP_WORDS.has(t)))];
  const rawNums = rawTokens.filter((t) => /^\d+$/.test(t));
  const nameScores = new Map<string, { rank: number; fuzzy: boolean }>();
  if (rawTokens.length > 0) {
    for (const profile of catalog) {
      const nameTokens = [...new Set(tokenize(normalizeText(profile.name)))];
      if (nameTokens.length === 0) continue;
      const compare = (a: string, b: string): 'EXACT' | 'FUZZY' | null => {
        if (a === b) return 'EXACT';
        if (a.length >= FUZZY_MIN_LENGTH && b.length >= FUZZY_MIN_LENGTH && !/^\d+$/.test(a) && levenshtein(a, b) <= 1) return 'FUZZY';
        return null;
      };
      const matchedName = nameTokens.filter((n) => rawTokens.some((r) => compare(r, n) !== null)).length;
      const matchedRaw = rawTokens.filter((r) => nameTokens.some((n) => compare(r, n) !== null)).length;
      if (matchedName === 0) continue;
      const fuzzy = nameTokens.some((n) => !rawTokens.includes(n) && rawTokens.some((r) => compare(r, n) === 'FUZZY'));
      let rank = 0.6 * (matchedName / nameTokens.length) + 0.4 * (matchedRaw / rawTokens.length);
      const nameNums = nameTokens.filter((t) => /^\d+$/.test(t));
      if (rawNums.some((n) => nameNums.includes(n))) rank += 0.12;
      else if (rawNums.length > 0 && nameNums.length > 0) rank -= 0.15;
      if (isSystemMatch(profile)) rank += 0.08;
      if (fuzzy) rank = Math.min(rank, 0.69);
      nameScores.set(profile.id, { rank, fuzzy });
    }
  }

  // 1) Mã trong chữ: khớp hoàn toàn, chứa trong mã dài, hoặc sai một hai ký tự do chữ viết tay.
  //    Hai dòng danh mục cùng mã (ở hai hệ nhôm khác nhau) được phân biệt bằng mức khớp của phần mô tả.
  for (const token of codeTokens(cleaned)) {
    for (const profile of catalog) {
      const code = codeKey(profile.code);
      const bonus = 0.1 * Math.min(1, Math.max(0, nameScores.get(profile.id)?.rank ?? 0));
      if (token === code) offer(profile, 1 + bonus, 'CODE');
      else if (token.length >= 4 && code.includes(token)) offer(profile, 0.85 + bonus, 'CODE');
      else if (token.length >= 5 && levenshtein(token, code) <= 1) offer(profile, 0.8 + bonus, 'CODE');
      else if (token.length >= 6 && levenshtein(token, code) <= 2) offer(profile, 0.7 + bonus, 'CODE');
    }
  }

  // 2) Từ điển viết tắt đã học của NPP.
  const joined = ` ${normalized} `;
  for (const entry of glossary) {
    if (!entry.profileId || !entry.term) continue;
    const profile = catalog.find((c) => c.id === entry.profileId);
    if (profile && joined.includes(` ${entry.term} `)) offer(profile, 0.95, 'GLOSSARY');
  }

  // 3) Tên.
  for (const profile of catalog) {
    const named = nameScores.get(profile.id);
    if (named && named.rank >= NAME_MIN_SCORE) offer(profile, named.rank, 'NAME');
  }

  const ranked = [...scored.values()].sort((a, b) => b.rank - a.rank || Number(b.systemMatch) - Number(a.systemMatch) || a.code.localeCompare(b.code) || a.profileId.localeCompare(b.profileId));
  const candidates: Candidate[] = ranked.slice(0, MAX_CANDIDATES).map(({ rank: _rank, systemMatch: _systemMatch, ...candidate }) => candidate);

  // Chọn tự động chỉ khi nổi bật rõ so với ứng viên thứ hai (hoặc phân định được bằng hệ nhôm ở tiêu đề).
  // Chỉ mã hoặc từ điển đã học mới đủ để "chắc"; ghép theo tên tối đa là "nên xem lại".
  let profile: CatalogProfile | null = null;
  let confidence: Confidence = 'NONE';
  const top = ranked[0];
  if (top) {
    const second = ranked[1];
    // Hệ nhôm nêu ở tiêu đề hoặc trong dòng phân định những ứng viên gần nhau (không cần hòa tuyệt đối).
    const decidedBySystem = !!second && top.systemMatch && !second.systemMatch;
    const requiredGap = top.reason === 'CODE' && second?.reason === 'CODE' ? SAME_CODE_GAP : SELECT_GAP;
    const gapOk = !second || top.rank - second.rank >= requiredGap || decidedBySystem;
    if (top.rank >= SELECT_MIN && gapOk) {
      profile = catalog.find((c) => c.id === top.profileId) ?? null;
      confidence = top.reason !== 'NAME' && top.rank >= 0.9 ? 'HIGH' : 'MEDIUM';
    } else {
      confidence = 'LOW';
    }
  }

  const unit = normalizeUnit(input.unit);
  const quantity = input.quantity !== null && Number.isFinite(input.quantity) ? input.quantity : null;
  if (quantity === null || quantity <= 0) warnings.push('Chưa đọc được số lượng.');
  if (quantity !== null && quantity > 0 && unit === null) warnings.push('Chưa rõ đơn vị (bó hay cây).');
  if (unit === 'SET') warnings.push('Đơn vị "bộ" chưa quy đổi được sang cây.');
  const bars = profile ? convertToBars(quantity, unit, profile.barsPerBundle) : null;
  if (profile && unit === 'BUNDLE' && quantity !== null && quantity > 0 && profile.barsPerBundle <= 0) warnings.push(`Thanh ${profile.code} chưa có quy cách bó nên chưa đổi được sang cây.`);

  const color = matchColor(cleaned) ?? (input.colorHint ? matchColor(input.colorHint) : null);
  return { text: rawText, quantity, unit, bars, colorCode: color?.colorCode ?? null, profileId: profile?.id ?? null, candidates, confidence, warnings };
}
