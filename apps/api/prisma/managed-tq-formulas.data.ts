export type ManagedInputField = {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  type?: 'number' | 'boolean';
  defaultValue?: number;
};

export type ManagedCutRule = {
  profileSystemCode?: string;
  profileCode: string;
  profileName: string;
  lengthFormula: string;
  quantityFormula: string;
  cutAngle: string;
  note: string;
};

export type ManagedGlassRule = {
  name: string;
  widthFormula: string;
  heightFormula: string;
  quantityFormula: string;
  note: string;
};

export type ManagedTqFormulaDefinition = {
  stableKey: string;
  revision: number;
  name: string;
  type: string;
  description: string;
  sourceRef: string;
  verificationStatus: 'CANDIDATE' | 'SOURCE_VERIFIED';
  inputFields: ManagedInputField[];
  cutRules: ManagedCutRule[];
  glassRules: ManagedGlassRule[];
};

const inputFields: ManagedInputField[] = [
  { key: 'W', label: 'Chiều rộng phủ bì', unit: 'mm', required: true },
  { key: 'H', label: 'Tổng chiều cao phủ bì', unit: 'mm', required: true },
  { key: 'HAS_TOP_FIX', label: 'Có ô fix phía trên', unit: '', required: false, type: 'boolean', defaultValue: 0 },
  { key: 'FIX_H', label: 'Chiều cao ô fix', unit: 'mm', required: false, type: 'number', defaultValue: 0 },
  { key: 'Q', label: 'Số lượng bộ', unit: 'bộ', required: true, defaultValue: 1 },
];

// Cấu tạo ô fix ba khoang L1 - L2 - L1 theo bảng "Vách kính trên" trong workbook nguồn.
// HAS_TOP_FIX = 0 làm số lượng bằng 0; evaluator sẽ bỏ các dòng tùy chọn này.
const topFixFrameCutRules: ManagedCutRule[] = [
  { profileSystemCode: 'EU-55', profileCode: 'LH5110', profileName: 'Khung vách fix - ngang', lengthFormula: 'W', quantityFormula: '2*HAS_TOP_FIX*Q', cutAngle: '45-45', note: 'Khung ngang ô fix phía trên' },
  { profileSystemCode: 'EU-55', profileCode: 'LH5110', profileName: 'Khung vách fix - đứng', lengthFormula: 'FIX_H', quantityFormula: '2*HAS_TOP_FIX*Q', cutAngle: '45-45', note: 'Khung đứng ô fix phía trên' },
  { profileSystemCode: 'EU-55', profileCode: 'DAT55', profileName: 'Đố đứng ô fix', lengthFormula: 'FIX_H-48', quantityFormula: '2*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Hai đố đứng chia ô fix thành ba khoang' },
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - đứng', lengthFormula: 'FIX_H-110', quantityFormula: '6*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Nẹp đứng cho ba khoang kính' },
  { profileSystemCode: 'EU-55', profileCode: 'C3300', profileName: 'Xập ghép khung', lengthFormula: 'W', quantityFormula: '1*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Nối khung cửa chính với ô fix' },
];

// Workbook chỉ có bảng ô fix cho bộ 4 cánh. Bộ 2 cánh dùng ba khoang đều,
// giữ nguyên tổng khe/đố 262 mm và quy cách nẹp/kính của bảng nguồn.
const equalThreeBayTopFixCutRules: ManagedCutRule[] = [
  ...topFixFrameCutRules,
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - ngang ba khoang', lengthFormula: '(W-148)/3', quantityFormula: '6*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Ba khoang đều; hai nẹp ngang cho mỗi khoang' },
];

const equalThreeBayTopFixGlassRules: ManagedGlassRule[] = [
  { name: 'Kính ô fix - 3 khoang đều', widthFormula: '(W-175)/3', heightFormula: 'FIX_H-81', quantityFormula: '3*HAS_TOP_FIX*Q', note: 'Ba tấm kính bằng nhau; phương án bộ 2 cánh cần nghiệm thu thực tế' },
];

const inwardFourLeafTopFixCutRules: ManagedCutRule[] = [
  ...topFixFrameCutRules,
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - ngang khoang L1', lengthFormula: 'W/4-26', quantityFormula: '4*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Hai khoang biên L1, mỗi khoang hai nẹp' },
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - ngang khoang L2', lengthFormula: 'W/2-96', quantityFormula: '2*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Khoang giữa L2, hai nẹp' },
];

const inwardFourLeafTopFixGlassRules: ManagedGlassRule[] = [
  { name: 'Kính ô fix - khoang biên L1', widthFormula: 'W/4-35', heightFormula: 'FIX_H-81', quantityFormula: '2*HAS_TOP_FIX*Q', note: 'Hai tấm kính khoang biên theo workbook mở trong' },
  { name: 'Kính ô fix - khoang giữa L2', widthFormula: 'W/2-105', heightFormula: 'FIX_H-81', quantityFormula: '1*HAS_TOP_FIX*Q', note: 'Một tấm kính khoang giữa theo workbook mở trong' },
];

const outwardFourLeafTopFixCutRules: ManagedCutRule[] = [
  ...topFixFrameCutRules,
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - ngang khoang L1', lengthFormula: 'W/4-70', quantityFormula: '4*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Hai khoang biên L1, mỗi khoang hai nẹp' },
  { profileSystemCode: 'EU-55', profileCode: 'DAS14', profileName: 'Nẹp vách - ngang khoang L2', lengthFormula: 'W/2-8', quantityFormula: '2*HAS_TOP_FIX*Q', cutAngle: '90-90', note: 'Khoang giữa L2, hai nẹp' },
];

const outwardFourLeafTopFixGlassRules: ManagedGlassRule[] = [
  { name: 'Kính ô fix - khoang biên L1', widthFormula: 'W/4-79', heightFormula: 'FIX_H-81', quantityFormula: '2*HAS_TOP_FIX*Q', note: 'Hai tấm kính khoang biên theo workbook mở ngoài' },
  { name: 'Kính ô fix - khoang giữa L2', widthFormula: 'W/2-17', heightFormula: 'FIX_H-81', quantityFormula: '1*HAS_TOP_FIX*Q', note: 'Một tấm kính khoang giữa theo workbook mở ngoài' },
];

const inwardSource =
  'BANG TINH CẮT NHÔM  (MỞ TRONG)- giảm chấn.xlsx | SHA256 A29BC25C2F43DF298B21F6D0117DB6812060F872EC5C6F5C16442249081953DE';
const outwardSource =
  'BANG TINH CẮT NHÔM (MỞ NGOÀI) - giảm chấn.xlsx | SHA256 21DFFEBFE61D65D767CCC225DF1830199737CE3D9AF47846080FD16D4A1919A0';

export const MANAGED_TQ_FORMULAS: ManagedTqFormulaDefinition[] = [
  {
    stableKey: 'EU-TQ-INWARD-2-LEAF-DAMPER-V1',
    revision: 3,
    name: 'Trượt quay mở trong 2 cánh - giảm chấn',
    type: 'Cửa đi trượt quay',
    description: 'Bộ cửa trượt quay 2 cánh mở trong, ray giảm chấn; hỗ trợ ô fix ba khoang phía trên.',
    sourceRef: `${inwardSource} | Sheet: cửa 2 cánh`,
    verificationStatus: 'CANDIDATE',
    inputFields,
    cutRules: [
      { profileCode: 'KH-TQ01A', profileName: 'Ray khung giảm chấn', lengthFormula: 'W-(((W-36*2-4-11)/2+98/2+12)-12)-72-4-29', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray khung' },
      { profileCode: 'KH-TQ02A', profileName: 'Ray cánh giảm chấn', lengthFormula: '((W-36*2-4-11)/2+98/2+12)-12', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray cánh' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'W', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Khung ngang trên' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'H-FIX_H', quantityFormula: '2*Q', cutAngle: '45-90', note: 'Khung đứng phần cửa chính' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '(W-36*2-4-11)/2+98/2+12', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh trên' },
      { profileCode: 'KH-TQ05', profileName: 'Cánh đứng móc', lengthFormula: '(H-FIX_H)-8-4-37-36-3', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh đứng móc' },
      { profileCode: 'KH-TQ06', profileName: 'Cánh bản lề', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh bản lề' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-4-11)/2+98/2+12)-12', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh dưới' },
      { profileCode: 'KH-TQ08', profileName: 'Cánh ngoài', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh đứng ngoài' },
      { profileCode: 'KH-TQ09', profileName: 'Sập nối cánh', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Sập nối cánh' },
      ...equalThreeBayTopFixCutRules,
    ],
    glassRules: [
      { name: 'Kính cánh', widthFormula: '(((W-36*2-4-11)/2+98/2+12)-12)-170', heightFormula: '((H-FIX_H)-8-4-37-36-3)-170', quantityFormula: '2*Q', note: 'Kích thước thành phẩm theo bảng tính nguồn' },
      ...equalThreeBayTopFixGlassRules,
    ],
  },
  {
    stableKey: 'EU-TQ-INWARD-4-LEAF-DAMPER-V1',
    revision: 3,
    name: 'Trượt quay mở trong 4 cánh - giảm chấn',
    type: 'Cửa đi trượt quay',
    description: 'Bộ cửa trượt quay 4 cánh mở trong, ray giảm chấn; ô fix ba khoang L1 - L2 - L1 theo workbook.',
    sourceRef: `${inwardSource} | Sheet: cửa 4 cánh | Scope: main door rows 8-20`,
    verificationStatus: 'CANDIDATE',
    inputFields,
    cutRules: [
      { profileCode: 'KH-TQ01A', profileName: 'Ray khung giảm chấn', lengthFormula: 'W-((((W-36*2-16)/4+98/2+12)-12)*2)-72-8-58', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray khung' },
      { profileCode: 'KH-TQ02A', profileName: 'Ray cánh giảm chấn', lengthFormula: '((W-36*2-16)/4+98/2+12)-12', quantityFormula: '2*Q', cutAngle: '90-90', note: 'Ray cánh' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'W', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Khung ngang trên' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'H-FIX_H', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Khung đứng phần cửa chính' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '(W-36*2-16)/4+98/2+12', quantityFormula: '4*Q', cutAngle: '45-45', note: 'Cánh trên' },
      { profileCode: 'KH-TQ05', profileName: 'Cánh đứng móc', lengthFormula: '(H-FIX_H)-8-4-37-36-3', quantityFormula: '4*Q', cutAngle: '45-45', note: 'Cánh đứng móc' },
      { profileCode: 'KH-TQ06', profileName: 'Cánh bản lề', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh bản lề' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-16)/4+98/2+12)-12', quantityFormula: '4*Q', cutAngle: '45-45', note: 'Cánh dưới' },
      { profileCode: 'KH-TQ08', profileName: 'Cánh ngoài', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh đứng ngoài' },
      { profileCode: 'KH-TQ09', profileName: 'Sập nối cánh', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Sập nối cánh' },
      ...inwardFourLeafTopFixCutRules,
    ],
    glassRules: [
      { name: 'Kính cánh', widthFormula: '(((W-36*2-16)/4+98/2+12)-12)-170', heightFormula: '((H-FIX_H)-8-4-37-36-3)-170', quantityFormula: '4*Q', note: 'Kích thước thành phẩm theo bảng tính nguồn' },
      ...inwardFourLeafTopFixGlassRules,
    ],
  },
  {
    stableKey: 'EU-TQ-OUTWARD-2-LEAF-DAMPER-V1',
    revision: 3,
    name: 'Trượt quay mở ngoài 2 cánh - giảm chấn',
    type: 'Cửa đi trượt quay',
    description: 'Bộ cửa trượt quay 2 cánh mở ngoài theo workbook giảm chấn Eurohouse; hỗ trợ ô fix ba khoang phía trên.',
    sourceRef: `${outwardSource} | Sheet: cửa 2 cánh`,
    verificationStatus: 'CANDIDATE',
    inputFields,
    cutRules: [
      { profileCode: 'KH-TQ01', profileName: 'Ray khung', lengthFormula: 'W-36*2-4-(((W-36*2-4-11)/2+98/2+12-49+5)+98-10-12)-29', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray khung' },
      { profileCode: 'KH-TQ02', profileName: 'Ray cánh', lengthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)+98-10-12', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray cánh' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'W', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Khung ngang trên' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'H-FIX_H', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Khung đứng phần cửa chính' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '(W-36*2-4-11)/2+98/2+12-49+5', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh quay' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)+98-10', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh trượt' },
      { profileCode: 'KH-TQ05', profileName: 'Cánh đứng móc', lengthFormula: '(H-FIX_H)-8-4-37-36', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh đứng móc' },
      { profileCode: 'KH-TQ06', profileName: 'Cánh bản lề', lengthFormula: '(H-FIX_H)-85', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh bản lề' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)-12', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh quay' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)+98-10-12', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh trượt' },
      { profileCode: 'KH-TQ08', profileName: 'Cánh ngoài', lengthFormula: '(H-FIX_H)-85', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Cánh đứng ngoài' },
      { profileCode: 'KH-TQ09', profileName: 'Sập nối cánh', lengthFormula: '(H-FIX_H)-85', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Sập nối cánh' },
      ...equalThreeBayTopFixCutRules,
    ],
    glassRules: [
      { name: 'Kính cánh quay', widthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)-182', heightFormula: '((H-FIX_H)-8-4-37-36)-170', quantityFormula: '1*Q', note: 'Kính cánh quay' },
      { name: 'Kính cánh trượt', widthFormula: '((W-36*2-4-11)/2+98/2+12-49+5)+98-10-182', heightFormula: '((H-FIX_H)-8-4-37-36)-170', quantityFormula: '1*Q', note: 'Kính cánh trượt' },
      ...equalThreeBayTopFixGlassRules,
    ],
  },
  {
    stableKey: 'EU-TQ-OUTWARD-4-LEAF-DAMPER-V1',
    revision: 3,
    name: 'Trượt quay mở ngoài 4 cánh - ray giảm chấn',
    type: 'Cửa đi trượt quay',
    description: 'Bộ cửa trượt quay 4 cánh mở ngoài, ray giảm chấn; ô fix ba khoang L1 - L2 - L1 theo workbook.',
    sourceRef: `${outwardSource} | Sheet: cửa 4 cánh (ray giảm chấn)`,
    verificationStatus: 'CANDIDATE',
    inputFields,
    cutRules: [
      { profileCode: 'KH-TQ01', profileName: 'Ray khung', lengthFormula: 'W-36*2-4*2-29*2-((((W-36*2-16)/4+98/2+12-49+5)+98-10)-12)*2', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Ray khung' },
      { profileCode: 'KH-TQ02', profileName: 'Ray cánh', lengthFormula: '((W-36*2-16)/4+98/2+12-49+5)+98-10-12', quantityFormula: '2*Q', cutAngle: '90-90', note: 'Ray cánh' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'W', quantityFormula: '1*Q', cutAngle: '45-45', note: 'Khung ngang trên' },
      { profileCode: 'KH-TQ03', profileName: 'Khung', lengthFormula: 'H-FIX_H', quantityFormula: '2*Q', cutAngle: '45-90', note: 'Khung đứng phần cửa chính' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '(W-36*2-16)/4+98/2+12-49+5', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh quay' },
      { profileCode: 'KH-TQ04', profileName: 'Cánh trên', lengthFormula: '((W-36*2-16)/4+98/2+12-49+5)+98-10', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh trượt' },
      { profileCode: 'KH-TQ05', profileName: 'Cánh đứng móc', lengthFormula: '(H-FIX_H)-8-4-37-36-3', quantityFormula: '4*Q', cutAngle: '45-45', note: 'Cánh đứng móc' },
      { profileCode: 'KH-TQ06', profileName: 'Cánh bản lề', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh bản lề' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-16)/4+98/2+12-49+5)-12', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh quay' },
      { profileCode: 'KH-TQ07', profileName: 'Cánh dưới', lengthFormula: '((W-36*2-16)/4+98/2+12-49+5)+98-10-12', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh trượt' },
      { profileCode: 'KH-TQ08', profileName: 'Cánh ngoài', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '2*Q', cutAngle: '45-45', note: 'Cánh đứng ngoài' },
      { profileCode: 'KH-TQ09', profileName: 'Sập nối cánh', lengthFormula: '(H-FIX_H)-85-3', quantityFormula: '1*Q', cutAngle: '90-90', note: 'Sập nối cánh' },
      ...outwardFourLeafTopFixCutRules,
    ],
    glassRules: [
      { name: 'Kính cánh quay', widthFormula: '((W-36*2-16)/4+98/2+12-49+5)-182', heightFormula: '((H-FIX_H)-8-4-37-36-3)-170', quantityFormula: '2*Q', note: 'Kính cánh quay' },
      { name: 'Kính cánh trượt', widthFormula: '((W-36*2-16)/4+98/2+12-49+5)+98-10-182', heightFormula: '((H-FIX_H)-8-4-37-36-3)-170', quantityFormula: '2*Q', note: 'Kính cánh trượt' },
      ...outwardFourLeafTopFixGlassRules,
    ],
  },
];
