export type CertificateGroupId = 'he-thong' | 'doc-quyen' | 'nhan-hieu' | 'son' | 'thu-nghiem';

export type Certificate = {
  id: string;
  group: CertificateGroupId;
  title: string;
  /** Cơ quan hoặc đơn vị cấp, đúng như ghi trên giấy. */
  issuer: string;
  /** Các dòng thông tin đọc được trên giấy: [nhãn, giá trị]. */
  facts: readonly (readonly [string, string])[];
  image: string;
};

export type CertificateGroup = { id: CertificateGroupId; title: string; summary: string };

export const certificateGroups: readonly CertificateGroup[] = [
  { id: 'he-thong', title: 'Hệ thống quản lý và hợp chuẩn', summary: 'ISO 9001:2015 cho sản xuất, kinh doanh thanh nhôm định hình và chứng nhận hợp chuẩn TCVN 12513-1:2018.' },
  { id: 'doc-quyen', title: 'Bằng độc quyền kiểu dáng công nghiệp', summary: 'Bảy kiểu dáng thanh nhôm định hình do Cục Sở hữu trí tuệ cấp cho EUROHOUSE.' },
  { id: 'nhan-hieu', title: 'Giấy chứng nhận đăng ký nhãn hiệu', summary: 'Năm giấy chứng nhận nhãn hiệu của EUROHOUSE, mỗi giấy có hiệu lực 10 năm tính từ ngày nộp đơn.' },
  { id: 'son', title: 'Sơn tĩnh điện và bảo hành bề mặt', summary: 'Xác nhận bảo hành sơn 15 năm theo AAMA 2603 của AkzoNobel cùng các báo cáo thử nghiệm và chứng nhận phân tích lô sơn.' },
  { id: 'thu-nghiem', title: 'Thử nghiệm vật liệu và nguồn phôi', summary: 'Kết quả thử nghiệm mác nhôm 6063-T5, độ dày và độ bám dính lớp phủ, chứng chỉ phôi nhập khẩu và hợp tác với nhà cung cấp sơn Ý.' },
];

const SHV = 'Cục Sở hữu trí tuệ, Bộ Khoa học và Công nghệ';
const ISSQ = 'Viện Nghiên cứu Phát triển Tiêu chuẩn Chất lượng (ISSQ)';
const AKZO = 'AkzoNobel (Interpon) Việt Nam';

function patent(no: string, suffix: string, shape: string, application: string, filed: string, decision: string, decided: string): Certificate {
  return {
    id: `bdq-${no}`,
    group: 'doc-quyen',
    title: `Bằng độc quyền số ${no}: ${shape}`,
    issuer: SHV,
    facts: [
      ['Kiểu dáng', 'Thanh nhôm định hình'],
      ['Số đơn', application],
      ['Ngày nộp đơn', filed],
      ['Quyết định cấp', `${decision}, ngày ${decided}`],
      ['Hiệu lực', 'Đến hết 5 năm tính từ ngày nộp đơn, có thể gia hạn'],
    ],
    image: `/images/chung-nhan/bdq-${suffix}.webp`,
  };
}

function trademark(no: string, application: string, filed: string, decision: string, decided: string): Certificate {
  return {
    id: `nh-${no}`,
    group: 'nhan-hieu',
    title: `Giấy chứng nhận đăng ký nhãn hiệu số ${no}`,
    issuer: SHV,
    facts: [
      ['Chủ giấy chứng nhận', 'Công ty cổ phần EUROHOUSE Việt Nam'],
      ['Số đơn', application],
      ['Ngày nộp đơn', filed],
      ['Quyết định cấp', `${decision}, ngày ${decided}`],
      ['Hiệu lực', 'Đến hết 10 năm tính từ ngày nộp đơn, có thể gia hạn'],
    ],
    image: `/images/chung-nhan/nh-${no}.webp`,
  };
}

function paint(id: string, color: string, code: string, letter: string): Certificate {
  return {
    id,
    group: 'son',
    title: `Xác nhận bảo hành sơn 15 năm, màu ${color}`,
    issuer: AKZO,
    facts: [
      ['Mã màu', code],
      ['Tiêu chuẩn', 'AAMA 2603, bảo hành 15 năm'],
      ['Nhãn hiệu áp dụng', 'KOLLHAM TITANIUM và ECENTO'],
      ['Ngày cấp', '13/11/2023'],
      ['Số xác nhận', letter],
    ],
    image: `/images/chung-nhan/${id}.webp`,
  };
}

export const certificates: readonly Certificate[] = [
  {
    id: 'iso-9001-2015',
    group: 'he-thong',
    title: 'ISO 9001:2015: sản xuất và kinh doanh thanh nhôm định hình',
    issuer: ISSQ,
    facts: [
      ['Số giấy chứng nhận', 'HT 2194, mã số 2194-25-01/00'],
      ['Phạm vi', 'Sản xuất và kinh doanh thanh hợp kim nhôm dạng profile'],
      ['Hiệu lực', '07/08/2025 đến 06/08/2028'],
      ['Đánh giá giám sát', 'Lần 1 trước 06/08/2026, lần 2 trước 06/08/2027'],
    ],
    image: '/images/chung-nhan/iso-9001-2015.webp',
  },
  {
    id: 'hop-chuan-tcvn-12513',
    group: 'he-thong',
    title: 'Chứng nhận hợp chuẩn TCVN 12513-1:2018 cho thanh nhôm định hình',
    issuer: ISSQ,
    facts: [
      ['Sản phẩm', 'Thanh định hình nhôm và hợp kim nhôm, mác 6063-T5, độ dày 0,8 đến 3 mm'],
      ['Tiêu chuẩn', 'TCVN 12513-1:2018'],
      ['Số giấy chứng nhận', 'SP 3101, mã số 3101-25-01/00'],
      ['Phương thức', 'Phương thức 5 theo Thông tư 28/2012/TT-BKHCN'],
      ['Hiệu lực', '05/09/2025 đến 04/09/2028'],
    ],
    image: '/images/chung-nhan/hop-chuan-tcvn-12513.webp',
  },
  patent('33411', '33411', 'cánh cửa hệ thủy lực', '3-2020-01350', '10/06/2020', '13905w/QĐ-SHTT', '31/08/2021'),
  patent('33412', '33412', 'khung liền phào mở quay ngoài', '3-2020-01408', '16/06/2020', '13906w/QĐ-SHTT', '31/08/2021'),
  patent('37135', '37135', 'thanh nhôm định hình', '3-2022-01874', '05/09/2022', '67019/QĐ-SHTT', '07/09/2023'),
  patent('37220', '37220', 'thanh nhôm định hình', '3-2022-00199', '24/01/2022', '71540/QĐ-SHTT', '22/09/2023'),
  patent('37529', '37529', 'thanh nhôm định hình', '3-2022-01802', '24/08/2022', '97827/QĐ-SHTT', '14/11/2023'),
  patent('36903', '36903', 'thanh nhôm định hình', '3-2022-01241', '22/06/2022', '54828/QĐ-SHTT', '18/07/2023'),
  patent('36785', '36785', 'thanh nhôm định hình', '3-2022-00200', '24/01/2022', '46600/QĐ-SHTT', '27/06/2023'),
  trademark('340999', '4-2018-07299', '14/03/2018', '117811/QĐ-SHTT', '30/12/2019'),
  trademark('385431', '4-2019-16531', '15/05/2019', '33736/QĐ-SHTT', '26/04/2021'),
  trademark('394851', '4-2019-43844', '04/11/2019', '65127/QĐ-SHTT', '04/08/2021'),
  trademark('394850', '4-2019-43845', '04/11/2019', '65126/QĐ-SHTT', '04/08/2021'),
  trademark('380988', '4-2019-15505', '08/05/2019', '18870/QĐ-SHTT', '08/03/2021'),
  paint('son-cam-lai', 'vân gỗ Cẩm Lai', 'GZ302V', 'VN C1006-23'),
  paint('son-cafe-metallic', 'Cafe Metallic', 'S2310V', 'VN C1004-23'),
  paint('son-xam-ngoc-trai', 'xám ngọc trai', 'S2312V', 'VN C1005-23'),
  {
    id: 'son-bao-cao-d1000',
    group: 'son',
    title: 'Báo cáo thử nghiệm dòng sơn Interpon D1000',
    issuer: AKZO,
    facts: [
      ['Mã dự án', 'ATS200330052'],
      ['Ngày báo cáo', '12/06/2020'],
      ['Chiều dày màng sơn khô', '60 đến 90 µm'],
      ['Hạng mục đạt', 'Kháng muối, độ ẩm, kháng dung môi, độ bám dính, thấm thấu, tác động ngược'],
      ['Phương pháp', 'AAMA 2603-13'],
    ],
    image: '/images/chung-nhan/son-bao-cao-d1000.webp',
  },
  {
    id: 'son-coa-j5310v',
    group: 'son',
    title: 'Chứng nhận phân tích lô sơn J5310V',
    issuer: AKZO,
    facts: [
      ['Mã sản phẩm', 'J5310V'],
      ['Ngày', '01/07/2019'],
      ['Số hạng mục thử', '12 hạng mục, tất cả đạt'],
      ['Chiều dày màng', '60 đến 80 µm'],
    ],
    image: '/images/chung-nhan/son-coa-j5310v.webp',
  },
  {
    id: 'son-coa-ja136v',
    group: 'son',
    title: 'Chứng nhận phân tích lô sơn JA136V',
    issuer: AKZO,
    facts: [
      ['Mã sản phẩm', 'JA136V'],
      ['Ngày', '01/07/2019'],
      ['Số hạng mục thử', '12 hạng mục, tất cả đạt'],
      ['Chiều dày màng', '60 đến 80 µm'],
    ],
    image: '/images/chung-nhan/son-coa-ja136v.webp',
  },
  {
    id: 'quatest-lhs110',
    group: 'thu-nghiem',
    title: 'Kết quả thử nghiệm mẫu nhôm LHS 110',
    issuer: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 1 (Quatest 1)',
    facts: [
      ['Ngày thử nghiệm', '21/11/2019'],
      ['Độ cứng', 'HV5: 84'],
      ['Giới hạn chảy', '215 MPa'],
      ['Độ bền kéo đứt', '234 MPa'],
      ['Kết luận', 'Cơ tính và thành phần hóa học tương đương mác nhôm 6063-T5 theo ASTM B221'],
    ],
    image: '/images/chung-nhan/quatest-lhs110.webp',
  },
  {
    id: 'quatest-lh11801',
    group: 'thu-nghiem',
    title: 'Kết quả thử nghiệm mẫu nhôm LH 11801',
    issuer: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 1 (Quatest 1)',
    facts: [
      ['Ngày thử nghiệm', '21/11/2019'],
      ['Độ cứng', 'HV5: 70'],
      ['Giới hạn chảy', '165 MPa'],
      ['Độ bền kéo đứt', '187 MPa'],
      ['Kết luận', 'Cơ tính và thành phần hóa học tương đương mác nhôm 6063-T5 theo ASTM B221'],
    ],
    image: '/images/chung-nhan/quatest-lh11801.webp',
  },
  {
    id: 'vibm-lop-ma',
    group: 'thu-nghiem',
    title: 'Phiếu kết quả thử nghiệm lớp phủ trên thanh nhôm EUROHOUSE',
    issuer: 'Viện Vật liệu Xây dựng, Bộ Xây dựng (VIBM)',
    facts: [
      ['Ngày nhận mẫu', '21/02/2020'],
      ['Chiều dày lớp phủ', '71,0 µm (TCVN 9406:2012)'],
      ['Độ bám dính lớp phủ', 'Loại 0 (TCVN 2097:2015)'],
    ],
    image: '/images/chung-nhan/vibm-lop-ma.webp',
  },
  {
    id: 'phoi-mill-test',
    group: 'thu-nghiem',
    title: 'Chứng chỉ chất lượng phôi nhôm 6063 nhập khẩu',
    issuer: 'Global Vietnam Aluminium Company Limited (GVA)',
    facts: [
      ['Loại phôi', 'Billet nhôm 6063, đường kính 5 inch (127 mm), dài 5.800 mm'],
      ['Ngày chứng chỉ', '14/11/2019'],
      ['Kết luận', 'Thành phần các lô đạt yêu cầu hợp đồng'],
    ],
    image: '/images/chung-nhan/phoi-mill-test.webp',
  },
  {
    id: 'decoral-open-letter',
    group: 'thu-nghiem',
    title: 'Thư hợp tác với Decoral System (Ý) về dòng sơn Materico-017',
    issuer: 'Decoral System S.r.l (Ý)',
    facts: [
      ['Nội dung', 'Hợp tác phát triển dòng sơn Materico-017 áp dụng cho nhôm thương hiệu ECENTO'],
      ['Chứng nhận chất lượng sơn', 'Qualicoat Class 1, mã P-0683'],
    ],
    image: '/images/chung-nhan/decoral-open-letter.webp',
  },
  {
    id: 'gicolor-tds',
    group: 'thu-nghiem',
    title: 'Bảng thông số kỹ thuật sơn Materico-017 (Gicolor)',
    issuer: 'Gicolor (Ý)',
    facts: [
      ['Mã sản phẩm', 'Materico-017, Qualicoat P-0683'],
      ['Loại', 'Sơn bột polyester không TGIC, dùng ngoài trời, cho nhôm định hình'],
      ['Ngày phát hành', '18/02/2023'],
    ],
    image: '/images/chung-nhan/gicolor-tds.webp',
  },
];
