// Quy tắc thuế hộ kinh doanh theo năm. Quy định đổi nhiều lần trong 2026, nên mọi con số nằm ở bảng này,
// logic tính chỉ đọc bảng. Năm mới: thêm một dòng. Xem docs/hoa-don-dien-tu/NGHIEN_CUU_MODULE_HOA_DON.md.

export type TaxBusinessLine = 'MANUFACTURING' | 'CONSTRUCTION_WITH_MATERIALS' | 'TRADING';
export type TaxPitMethod = 'REVENUE_RATE' | 'INCOME';
export type TaxEntityType = 'HKD' | 'DN';

export interface TaxIncomeBracket {
  /** Doanh thu năm tới mức này (đồng) thì áp `pct`. `null` = không giới hạn. */
  revenueUpTo: number | null;
  pct: number;
}

export interface TaxYearRule {
  year: number;
  /** Doanh thu năm từ mức này trở xuống: không nộp GTGT, TNCN. */
  exemptThreshold: number;
  /** Trên mức này bắt buộc tính TNCN theo thu nhập (doanh thu − chi phí). */
  incomeMethodRequiredAbove: number;
  lines: Record<TaxBusinessLine, { vatPct: number; pitPct: number; label: string }>;
  incomeBrackets: TaxIncomeBracket[];
  /** Tỷ lệ theo ngành đã được kế toán xác nhận cho năm này chưa. */
  confirmed: boolean;
  source: string;
}

export const TAX_YEAR_RULES: TaxYearRule[] = [
  {
    year: 2026,
    exemptThreshold: 1_000_000_000,
    incomeMethodRequiredAbove: 3_000_000_000,
    lines: {
      MANUFACTURING: { vatPct: 3, pitPct: 1.5, label: 'Sản xuất, gia công nhôm kính' },
      CONSTRUCTION_WITH_MATERIALS: { vatPct: 3, pitPct: 1.5, label: 'Xây lắp có bao thầu vật tư' },
      TRADING: { vatPct: 1, pitPct: 0.5, label: 'Phân phối, bán buôn nhôm kính, phụ kiện' },
    },
    incomeBrackets: [
      { revenueUpTo: 3_000_000_000, pct: 15 },
      { revenueUpTo: 50_000_000_000, pct: 17 },
      { revenueUpTo: null, pct: 20 },
    ],
    confirmed: false,
    source: 'Nghị định 141/2026/NĐ-CP (ngưỡng 1 tỷ); tỷ lệ theo ngành theo mức quen dùng, chưa xác nhận cho 2026.',
  },
];

export function taxRuleForYear(year: number): TaxYearRule {
  const sorted = [...TAX_YEAR_RULES].sort((a, b) => b.year - a.year);
  return sorted.find((rule) => rule.year <= year) ?? sorted[sorted.length - 1];
}

export const BUSINESS_LINE_LABELS: Record<TaxBusinessLine, string> = {
  MANUFACTURING: 'Sản xuất, gia công nhôm kính',
  CONSTRUCTION_WITH_MATERIALS: 'Xây lắp có bao thầu vật tư',
  TRADING: 'Phân phối, bán buôn nhôm kính, phụ kiện',
};
