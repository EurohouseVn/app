/** Kho kiến thức ngành nhôm của Bé Eu: chuẩn hoá chữ, xếp hạng truy xuất, dựng kiến thức từ danh mục Eurohouse, câu lệnh nghiên cứu. */
import { ASSISTANT_NAME, BASE_RULES } from './ai-policy';

export type KnowledgeEntry = {
  key: string;
  topic: string;
  title: string;
  content: string;
  /** Càng cao càng được đưa vào "mồi" (primer) nạp sẵn cho mọi phiên chat. */
  priority: number;
};

/** Dưới ngưỡng này (ví dụ chỉ trùng một từ thường trong nội dung) coi như không liên quan. */
const MIN_SCORE = 2.5;

const STOPWORDS = new Set([
  'la', 'co', 'khong', 'the', 'nao', 'gi', 'cua', 'va', 'voi', 'cho', 'nay', 'do', 'duoc', 'bi', 'thi', 'ma', 'o', 'tai', 'trong',
  'mot', 'cac', 'nhung', 'khi', 'nen', 'hay', 'nhu', 'de', 'ra', 'vao', 'em', 'anh', 'chi', 'minh', 'toi', 'ban', 'xin', 'oi', 'a', 'ak',
]);

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

export function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const words = (value: string) => normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);

/** Xếp hạng theo từ khoá: khớp tiêu đề nặng nhất, rồi chủ đề, rồi nội dung. Không có từ nào khớp thì trả rỗng. */
export function rankKnowledge(entries: KnowledgeEntry[], query: string, options: { limit: number; maxChars: number }): KnowledgeEntry[] {
  const tokens = [...new Set(words(query).filter((token) => token.length >= 2 && !STOPWORDS.has(token)))];
  if (!tokens.length) return [];
  const scored = entries.map((entry) => {
    const title = new Set(words(entry.title));
    const topic = new Set(words(entry.topic));
    const body = words(entry.content);
    const counts = new Map<string, number>();
    for (const word of body) counts.set(word, (counts.get(word) ?? 0) + 1);
    let score = 0;
    for (const token of tokens) {
      if (title.has(token)) score += 4;
      if (topic.has(token)) score += 2;
      const count = counts.get(token) ?? 0;
      // Mã thanh/số hiệu (có chữ số) là tín hiệu mạnh; từ thường trong nội dung chỉ là tín hiệu yếu.
      if (count) score += (/\d/.test(token) ? 4 : 1) + Math.min(count - 1, 2) * 0.5;
    }
    return { entry, score };
  }).filter((item) => item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority);

  const picked: KnowledgeEntry[] = [];
  let used = 0;
  for (const { entry } of scored) {
    if (picked.length >= options.limit) break;
    const remaining = options.maxChars - used;
    if (remaining < 200) break;
    const content = entry.content.length > remaining ? `${entry.content.slice(0, remaining - 1)}…` : entry.content;
    picked.push({ ...entry, content });
    used += content.length + entry.title.length;
  }
  return picked;
}

const decimal = (value: number) => String(Math.round(value * 1000) / 1000).replace('.', ',');
const thousands = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export type CatalogInput = {
  systems: Array<{
    code: string;
    name: string;
    description?: string | null;
    profiles: Array<{ code: string; name: string; thicknessMm?: string | null; kgPerMeter: number; barLengthMm: number }>;
  }>;
  colors: Array<{ code: string; name: string }>;
};

/** Kiến thức chính xác lấy từ danh mục Eurohouse trong CSDL (hệ nhôm, mã thanh, khối lượng, màu). */
export function buildCatalogKnowledge(input: CatalogInput): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];
  entries.push({
    key: 'catalog:overview',
    topic: 'Eurohouse',
    title: 'Các hệ nhôm Eurohouse',
    priority: 10,
    content: `Eurohouse có ${input.systems.length} hệ nhôm: ${input.systems.map((system) => `${system.name} (${system.code})`).join('; ')}. Mỗi hệ gồm nhiều mã thanh nhôm định hình, đơn vị tính theo cây tiêu chuẩn và khối lượng kg trên mét.`,
  });
  for (const system of input.systems) {
    const thicknesses = [...new Set(system.profiles.map((profile) => profile.thicknessMm).filter(Boolean))].slice(0, 8).join('; ');
    const lines = system.profiles.slice(0, 60).map((profile) => (
      `${profile.code} – ${profile.name}${profile.thicknessMm ? `, dày ${profile.thicknessMm} mm` : ''}, ${decimal(profile.kgPerMeter)} kg/m, cây ${thousands(profile.barLengthMm)} mm`
    ));
    entries.push({
      key: `catalog:system:${system.code.toLowerCase()}`,
      topic: 'Eurohouse',
      title: `Hệ ${system.name} (${system.code})`,
      priority: 3,
      content: [
        system.description?.trim() || `Hệ ${system.name} của Eurohouse.`,
        `Có ${system.profiles.length} mã thanh${thicknesses ? `, độ dày gồm ${thicknesses} mm` : ''}.`,
        ...lines,
        system.profiles.length > 60 ? `… và ${system.profiles.length - 60} mã thanh khác.` : '',
      ].filter(Boolean).join('\n'),
    });
  }
  if (input.colors.length) {
    entries.push({
      key: 'catalog:colors',
      topic: 'Eurohouse',
      title: 'Màu nhôm Eurohouse',
      priority: 6,
      content: `Các mã màu bề mặt nhôm hiện có: ${input.colors.map((color) => `${color.code} (${color.name})`).join('; ')}.`,
    });
  }
  return entries;
}

/** Tin "mồi": nạp sẵn quy tắc chung và kiến thức nền vào phiên chat trước khi người dùng hỏi. */
export function buildPrimer(entries: KnowledgeEntry[], maxChars = 6000): string {
  const header = [
    '[HỆ THỐNG - BÉ EU CỦA EUROHOUSE]',
    `Bạn tên là ${ASSISTANT_NAME}, trợ lý của Eurohouse cho các xưởng nhôm kính. Quy tắc chung:`,
    ...BASE_RULES.map((rule) => `- ${rule}`),
    '[KIẾN THỨC NỀN VỀ NGÀNH NHÔM VÀ EUROHOUSE] (dùng để trả lời ngay, không cần tìm kiếm trên mạng nếu đã đủ)',
  ];
  const footer = 'Mỗi xưởng sẽ gửi quy tắc riêng ở tin nhắn kế tiếp. Chỉ trả lời đúng một từ: SẴN SÀNG.';
  const sorted = [...entries].sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
  const blocks: string[] = [];
  let used = header.join('\n').length + footer.length;
  for (const entry of sorted) {
    const block = `### ${entry.title}\n${entry.content}`;
    if (used + block.length > maxChars) continue;
    blocks.push(block);
    used += block.length;
  }
  return [...header, ...blocks, footer].join('\n');
}

export function buildResearchPrompt(topic: string): string {
  return [
    '[NHIỆM VỤ NGHIÊN CỨU - EUROHOUSE]',
    `Hãy tìm hiểu kỹ trên nguồn đáng tin và viết một ghi chú kiến thức bằng tiếng Việt về chủ đề: "${topic}", dành cho xưởng nhôm kính tại Việt Nam.`,
    'Yêu cầu: tối đa 350 từ; ưu tiên thông số và con số thực tế; phân biệt rõ điều chắc chắn và điều chỉ là ước lượng; không quảng cáo; ghi chú phải tự đứng độc lập (người đọc không thấy câu hỏi này).',
    'Kết thúc bằng một dòng "NGUỒN:" rồi mỗi dòng một đường dẫn (URL) bạn đã dùng.',
  ].join('\n');
}

export function parseResearchReply(reply: string): { content: string; sources: string[] } {
  const text = reply.trim();
  if (!text) return { content: '', sources: [] };
  const split = text.search(/^\s*NGUỒN\s*:?/im);
  const content = (split >= 0 ? text.slice(0, split) : text).trim();
  const tail = split >= 0 ? text.slice(split) : '';
  const sources = [...new Set((tail.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map((url) => url.replace(/[.,;]+$/, '')))];
  return { content, sources };
}

export const RESEARCH_TOPICS: string[] = [
  'Hợp kim nhôm 6063 và 6061 dùng làm cửa: tính chất, trạng thái T5 và T6',
  'Quy trình đùn ép nhôm định hình và các lỗi thường gặp trên thanh nhôm',
  'Sơn tĩnh điện cho nhôm: quy trình, độ dày lớp sơn, độ bền màu',
  'Anod hoá nhôm và khác biệt với sơn tĩnh điện',
  'Nhôm phủ vân gỗ và ứng dụng trong cửa',
  'Cầu cách nhiệt trong hệ cửa nhôm: nguyên lý và lợi ích',
  'Cửa đi mở quay, mở trượt, xếp trượt: so sánh và khi nào dùng',
  'Cửa sổ mở quay, mở hất, mở trượt: kết cấu và phụ kiện',
  'Phụ kiện kim khí cửa nhôm: bản lề, khoá đa điểm, tay nắm, bánh xe',
  'Gioăng EPDM và ron kính, cách chống thấm cho cửa nhôm',
  'Kính cho cửa nhôm: cường lực, kính hộp, kính dán an toàn, Low-E',
  'Độ dày kính và kích thước tối đa theo ứng dụng',
  'Vách kính mặt dựng nhôm kính: hệ stick và unitized',
  'Quy trình đo đạc và khảo sát công trình lắp cửa nhôm kính',
  'Cắt nhôm: góc cắt 45 và 90 độ, tối ưu thanh dài 6 mét, giảm hao hụt',
  'Quản lý tồn kho nhôm: thanh nguyên, đầu thừa tái sử dụng, phế liệu',
  'Cách báo giá cửa nhôm kính: theo m2, theo kg nhôm, các yếu tố ảnh hưởng giá',
  'Cách tính khối lượng nhôm theo kg/m và chiều dài cây',
  'Lỗi thường gặp khi lắp đặt cửa nhôm và cách khắc phục',
  'Bảo trì, vệ sinh cửa nhôm kính và chế độ bảo hành thông thường',
  'Chống thấm, kín khí, cách âm cho cửa nhôm: chỉ số và giải pháp',
  'Tiêu chuẩn và thử nghiệm cửa nhôm kính tại Việt Nam: chịu gió, kín nước',
  'Các dòng hệ nhôm phổ biến tại Việt Nam: Xingfa, Việt Pháp và đặc điểm',
  'Chọn hệ nhôm cho nhà ở theo ngân sách và nhu cầu',
  'Cửa nhôm kính cho nhà xưởng, showroom và công trình công nghiệp',
  'Thiết kế thoát nước và chống thấm chân cửa, khung bao',
  'Đặt nhôm theo cây với nhà phân phối: màu, quy cách, tồn kho đại lý',
  'Chấm công, lương khoán và quản lý nhân công xưởng nhôm kính',
  'An toàn lao động trong xưởng gia công nhôm kính',
  'Quản lý công nợ và thu chi theo công trình cho xưởng cửa nhôm',
];

/** Vài kiến thức nền cơ bản, chắc chắn, nạp sẵn trước khi bộ tự nghiên cứu bổ sung chiều sâu. */
export const GENERAL_KNOWLEDGE: KnowledgeEntry[] = [
  {
    key: 'general:nhom-6063', topic: 'Vật liệu', title: 'Nhôm định hình 6063', priority: 8,
    content: 'Thanh nhôm làm cửa thường là hợp kim 6063 (nhôm – magiê – silic), dễ đùn ép thành tiết diện phức tạp, bề mặt đẹp để sơn hoặc anod. Trạng thái T5 là làm nguội sau đùn rồi hoá già nhân tạo; T6 cứng hơn T5. Cây tiêu chuẩn thường dài 6 mét.',
  },
  {
    key: 'general:xu-ly-be-mat', topic: 'Bề mặt', title: 'Xử lý bề mặt nhôm: sơn tĩnh điện, anod, vân gỗ', priority: 7,
    content: 'Sơn tĩnh điện phủ lớp bột sơn rồi nung, nhiều màu, giá hợp lý, dùng phổ biến cho cửa. Anod hoá tạo lớp oxit trên chính bề mặt nhôm, bền màu, ít màu hơn. Vân gỗ là lớp phủ in vân lên bề mặt sơn. Chọn theo môi trường (gần biển cần lớp phủ tốt hơn) và ngân sách.',
  },
  {
    key: 'general:cau-cach-nhiet', topic: 'Kết cấu', title: 'Cầu cách nhiệt trong hệ cửa nhôm', priority: 6,
    content: 'Nhôm dẫn nhiệt tốt nên hệ cao cấp chèn thanh nhựa cách nhiệt (cầu cách nhiệt) vào giữa phần trong và ngoài của thanh nhôm để giảm truyền nhiệt, giảm đọng sương và tăng cách âm khi kết hợp kính hộp.',
  },
  {
    key: 'general:kieu-mo-cua', topic: 'Sản phẩm', title: 'Các kiểu mở cửa nhôm kính', priority: 6,
    content: 'Mở quay: kín khít, cách âm và chống thấm tốt, cần không gian mở cánh. Mở trượt (lùa): tiết kiệm không gian, độ kín kém hơn mở quay. Xếp trượt: mở rộng khẩu độ lớn. Mở hất: thông gió khi mưa. Chọn theo vị trí, khẩu độ và yêu cầu kín nước.',
  },
  {
    key: 'general:tinh-khoi-luong', topic: 'Tính toán', title: 'Tính khối lượng nhôm', priority: 7,
    content: 'Khối lượng một thanh = khối lượng trên mét (kg/m) × chiều dài (m). Một cây 6 mét nặng bằng kg/m nhân 6. Báo giá theo kg nhân đơn giá, hoặc theo m2 cửa thành phẩm đã tính nhôm, kính, phụ kiện, nhân công.',
  },
  {
    key: 'general:dau-thua', topic: 'Sản xuất', title: 'Đầu thừa và hao hụt khi cắt nhôm', priority: 8,
    content: 'Khi cắt cây nhôm 6 mét thành các đoạn theo bản vẽ, phần còn lại là đầu thừa. Đầu thừa đủ dài có thể giữ lại làm đoạn tái sử dụng cho lần cắt sau; quá ngắn thì thành phế liệu bán theo kg. Tối ưu cách cắt (ghép các đoạn vào cùng một cây) giúp giảm hao hụt và tiết kiệm nhôm.',
  },
  {
    key: 'general:ton-kho', topic: 'Quản lý', title: 'Quản lý tồn kho nhôm', priority: 7,
    content: 'Nên theo dõi tồn theo mã thanh và màu: số cây nguyên, các đầu thừa còn dùng được và phế liệu. Đặt ngưỡng cảnh báo tồn thấp để đặt hàng kịp thời, ghi mọi lần nhập xuất để đối chiếu cuối tháng.',
  },
  {
    key: 'general:kinh-cua-nhom', topic: 'Vật liệu', title: 'Kính dùng cho cửa nhôm', priority: 5,
    content: 'Kính cường lực chịu lực và va đập tốt hơn kính thường, khi vỡ thành hạt nhỏ ít sắc. Kính dán gồm hai lớp kính liên kết bằng màng, vỡ vẫn dính, tăng an toàn. Kính hộp có khoảng không giữa hai lớp để cách nhiệt, cách âm. Độ dày chọn theo kích thước ô kính và vị trí lắp.',
  },
];
