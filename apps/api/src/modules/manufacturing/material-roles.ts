export type MaterialCategory =
  | 'ALUMINIUM'
  | 'GLASS'
  | 'HARDWARE'
  | 'GASKET'
  | 'FASTENER'
  | 'SEALANT'
  | 'ACCESSORY'
  | 'PACKAGING'
  | 'OTHER';

export interface MaterialRoleDefinition {
  code: string;
  category: MaterialCategory;
  description: string;
  aliases: string[];
}

export const MATERIAL_ROLES: readonly MaterialRoleDefinition[] = [
  { code: 'FRAME_OUTER', category: 'ALUMINIUM', description: 'Khung bao ngoài', aliases: ['khung bao', 'khung chính', 'khung cửa'] },
  { code: 'FRAME_INNER', category: 'ALUMINIUM', description: 'Khung phụ hoặc khung trong', aliases: ['khung phụ', 'khung trong'] },
  { code: 'SASH', category: 'ALUMINIUM', description: 'Cánh cửa hoặc cửa sổ', aliases: ['cánh cửa', 'cánh cửa sổ', 'cánh'] },
  { code: 'MULLION', category: 'ALUMINIUM', description: 'Đố đứng', aliases: ['đố đứng', 'đố khung'] },
  { code: 'TRANSOM', category: 'ALUMINIUM', description: 'Đố ngang', aliases: ['đố ngang', 'thanh ngang'] },
  { code: 'GLAZING_BEAD', category: 'ALUMINIUM', description: 'Nẹp hoặc sập giữ kính', aliases: ['nẹp kính', 'sập kính', 'nẹp vách'] },
  { code: 'INTERLOCK', category: 'ALUMINIUM', description: 'Nẹp móc hoặc thanh đối đầu cửa trượt', aliases: ['nẹp móc', 'đối đầu'] },
  { code: 'TRACK', category: 'ALUMINIUM', description: 'Ray trượt', aliases: ['ray', 'ray dưới', 'ray khung'] },
  { code: 'THRESHOLD', category: 'ALUMINIUM', description: 'Ngưỡng hoặc chân cánh', aliases: ['ngưỡng', 'chân cánh'] },
  { code: 'CLADDING', category: 'ALUMINIUM', description: 'Ốp hoặc phào bề mặt', aliases: ['ốp', 'phào'] },
  { code: 'PANEL', category: 'ALUMINIUM', description: 'Pano hoặc tấm nhôm', aliases: ['pano'] },
  { code: 'LOUVER', category: 'ALUMINIUM', description: 'Lá chớp', aliases: ['lá chớp'] },
  { code: 'DECORATIVE', category: 'ALUMINIUM', description: 'Thanh trang trí', aliases: ['trang trí', 'chấn song'] },
  { code: 'CONNECTOR', category: 'ALUMINIUM', description: 'Thanh hoặc chi tiết liên kết', aliases: ['nối', 'chuyển góc', 'liên kết'] },
  { code: 'GLASS', category: 'GLASS', description: 'Kính theo từng ô', aliases: ['kính'] },
  { code: 'GASKET', category: 'GASKET', description: 'Gioăng làm kín', aliases: ['gioăng', 'zoăng'] },
  { code: 'HINGE', category: 'HARDWARE', description: 'Bản lề', aliases: ['bản lề'] },
  { code: 'LOCK', category: 'HARDWARE', description: 'Khóa và bộ truyền động khóa', aliases: ['khóa', 'khoá'] },
  { code: 'ROLLER', category: 'HARDWARE', description: 'Bánh xe hoặc bộ con lăn', aliases: ['bánh xe', 'con lăn'] },
  { code: 'FASTENER', category: 'FASTENER', description: 'Vít, bu lông, ke và liên kết cơ khí', aliases: ['vít', 'ke', 'bu lông'] },
  { code: 'SEALANT', category: 'SEALANT', description: 'Silicone hoặc vật liệu trám kín', aliases: ['silicone', 'keo'] },
  { code: 'PACKAGING', category: 'PACKAGING', description: 'Tem nhãn và vật liệu đóng gói', aliases: ['tem', 'bao bì'] },
  { code: 'OTHER', category: 'OTHER', description: 'Vai trò chưa được chuẩn hóa', aliases: [] },
] as const;

export const MATERIAL_ROLE_BY_CODE = Object.fromEntries(MATERIAL_ROLES.map((role) => [role.code, role])) as Record<string, MaterialRoleDefinition>;

const rolesByCode = new Map(MATERIAL_ROLES.map((role) => [role.code, role]));

export function getMaterialRole(code: string): MaterialRoleDefinition | undefined {
  return rolesByCode.get(code.trim().toUpperCase());
}

export function assertMaterialRole(code: string): MaterialRoleDefinition {
  const role = getMaterialRole(code);
  if (!role) throw new Error(`Unknown material role: ${code}`);
  return role;
}
