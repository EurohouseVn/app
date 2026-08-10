import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export type CategoryDetail = {
  id: string;
  name: string; // VD: "Nhôm kính"
  items: any[]; // Lưu động các options
};

export type LocalProject = {
  id: string;
  code: string;
  name: string;
  customerName: string;
  customerPhone: string;
  address: string;
  projectType: string; // VD: Nhà ống, Biệt thự...
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  isContractSigned: boolean;
  categories: string[]; // ['nhom_kinh', 'sat_thep']
  categoryDetails: Record<string, CategoryDetail>;
  estimatedAmount: number;
  additionalCosts: number; // Phát sinh
  incurredType: 'INCREASE' | 'DECREASE';
  finalAmount: number;
  expectedProfit: number;
  images: string[];
  quotationCode?: string;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = '@eurohouse_local_projects';

const mojibakePattern = /(?:Ã|Ä|áº|á»|Â|Æ)/;

function fixMojibake(value: string) {
  if (!mojibakePattern.test(value)) return value;
  try {
    const encoded = Array.from(value, (char) => {
      const code = char.charCodeAt(0);
      if (code > 255) return '';
      return `%${code.toString(16).padStart(2, '0')}`;
    }).join('');
    if (!encoded) return value;
    const fixed = decodeURIComponent(encoded);
    return fixed.includes('�') ? value : fixed;
  } catch {
    return value;
  }
}

function normalizeProject(project: LocalProject): LocalProject {
  return {
    ...project,
    name: fixMojibake(project.name),
    customerName: fixMojibake(project.customerName),
    customerPhone: fixMojibake(project.customerPhone),
    address: fixMojibake(project.address),
    projectType: fixMojibake(project.projectType),
    categories: (project.categories || []).map(fixMojibake),
    quotationCode: project.quotationCode ? fixMojibake(project.quotationCode) : project.quotationCode,
  };
}

export const LocalProjectsApi = {
  async getAll(): Promise<LocalProject[]> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (!json) return [];
      const projects = JSON.parse(json) as LocalProject[];
      const normalized = projects.map(normalizeProject);
      if (JSON.stringify(normalized) !== json) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return [];
    }
  },

  async getOne(id: string): Promise<LocalProject | null> {
    const all = await this.getAll();
    return all.find(p => p.id === id) || null;
  },

  async create(data: Partial<LocalProject>): Promise<LocalProject> {
    const all = await this.getAll();
    const now = Date.now();
    const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const countStr = String(all.length + 1).padStart(2, '0');
    
    const newProject: LocalProject = {
      id: Math.random().toString(36).substring(2, 15),
      code: `CT-${ymd}-${countStr}`,
      name: data.name || 'Công trình mới',
      customerName: data.customerName || '',
      customerPhone: data.customerPhone || '',
      address: data.address || '',
      projectType: data.projectType || '',
      status: data.status || 'OPEN',
      isContractSigned: data.isContractSigned || false,
      categories: data.categories || [],
      categoryDetails: data.categoryDetails || {},
      estimatedAmount: data.estimatedAmount || 0,
      additionalCosts: data.additionalCosts || 0,
      incurredType: data.incurredType || 'INCREASE',
      finalAmount: data.finalAmount || 0,
      expectedProfit: data.expectedProfit || 0,
      images: data.images || [],
      quotationCode: data.quotationCode || '',
      createdAt: now,
      updatedAt: now,
    };

    all.unshift(newProject);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return newProject;
  },

  async update(id: string, data: Partial<LocalProject>): Promise<LocalProject> {
    const all = await this.getAll();
    const index = all.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Không tìm thấy công trình');
    
    const updated = {
      ...all[index],
      ...data,
      updatedAt: Date.now(),
    };
    all[index] = updated;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return updated;
  },

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter(p => p.id !== id && p.code !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
};
