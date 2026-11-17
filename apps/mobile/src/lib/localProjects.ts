import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelMedia, listMediaQueue, remapMediaEntity, syncMediaQueue, type MediaQueueItem } from './mediaQueue';
import { fixLegacyUtf8Mojibake } from '@eurohouse/types';
import { api, isNetworkError } from './api';
import { localProjectStorageKey } from './localProjectStorageState';
import { getInstallationIdentity } from './installationIdentity';

export type CategoryDetail = { id: string; name: string; items: unknown[] };

export type LocalProject = {
  id: string;
  code: string;
  name: string;
  customerName: string;
  customerPhone: string;
  address: string;
  projectType: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  isContractSigned: boolean;
  categories: string[];
  categoryDetails: Record<string, CategoryDetail>;
  estimatedAmount: number;
  additionalCosts: number;
  incurredType: 'INCREASE' | 'DECREASE';
  finalAmount: number;
  expectedProfit: number;
  images: string[];
  quotationId?: string;
  quotationCode?: string;
  costAluminum: number;
  costAccessory: number;
  costGlass: number;
  costLabor: number;
  costTransport: number;
  costInstallation: number;
  costOther: number;
  extraRevenue: number;
  /** Tổng phiếu thu do máy chủ tính; chưa có (công trình mới, API cũ) thì để trống. */
  receivedAmount?: number;
  createdAt: number;
  updatedAt: number;
  syncState?: 'SYNCED' | 'PENDING' | 'CONFLICT';
};

type ServerProject = {
  id: string;
  code: string;
  name: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  scale?: string;
  productsUsed?: string;
  status: LocalProject['status'];
  estimatedValue?: number;
  incurredValue?: number;
  incurredType?: LocalProject['incurredType'];
  settledValue?: number;
  contractValue?: number;
  costAluminum?: number;
  costAccessory?: number;
  costLockHinge?: number;
  costGlass?: number;
  costGasket?: number;
  costSilicone?: number;
  costScrew?: number;
  costLabor?: number;
  costTransport?: number;
  costInstallation?: number;
  costOther?: number;
  extraRevenue?: number;
  receivedAmount?: number;
  images?: string[];
  quotationId?: string;
  quotationCode?: string;
  createdAt: string;
  updatedAt: string;
};

type PendingMutation = {
  clientMutationId: string;
  deviceId: string;
  entityType: 'PROJECT' | 'OPENING' | 'SITE_NOTE' | 'QC_INSPECTION' | 'INSTALLATION' | 'WARRANTY_ASSET' | 'WARRANTY_TICKET';
  entityId?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'MEASURE' | 'COMPLETE' | 'STATUS' | 'CREATE_TICKET' | 'SERVICE_EVENT';
  payload: Record<string, unknown>;
  createdAt: number;
};

const STORAGE_KEY = '@eurohouse_project_replica_v2';
const LEGACY_STORAGE_KEY = '@eurohouse_local_projects';
const QUEUE_KEY = '@eurohouse_operations_mutation_queue';
const STORAGE_MIGRATION_KEY = '@eurohouse_project_storage_scope_migrated';
let storageScope: string | null = null;

function scopedKey(baseKey: string) {
  return localProjectStorageKey(baseKey, storageScope);
}

export async function configureLocalProjectsStorage(scope: string | null) {
  storageScope = scope;
  if (!scope) return;

  const migratedScope = await AsyncStorage.getItem(STORAGE_MIGRATION_KEY);
  if (migratedScope) return;

  const [currentReplica, legacyReplica, pendingQueue] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY),
    AsyncStorage.getItem(LEGACY_STORAGE_KEY),
    AsyncStorage.getItem(QUEUE_KEY),
  ]);
  const replica = currentReplica || legacyReplica;
  const writes: Promise<void>[] = [];
  if (replica) writes.push(AsyncStorage.setItem(scopedKey(STORAGE_KEY), replica));
  if (pendingQueue) writes.push(AsyncStorage.setItem(scopedKey(QUEUE_KEY), pendingQueue));
  writes.push(AsyncStorage.setItem(STORAGE_MIGRATION_KEY, scope));
  await Promise.all(writes);
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEY),
    AsyncStorage.removeItem(LEGACY_STORAGE_KEY),
    AsyncStorage.removeItem(QUEUE_KEY),
  ]);
}

function projectCosts(project: ServerProject): number {
  return [project.costAluminum, project.costAccessory, project.costLockHinge, project.costGlass,
    project.costGasket, project.costSilicone, project.costScrew, project.costLabor,
    project.costTransport, project.costInstallation, project.costOther]
    .reduce<number>((sum, value) => sum + Number(value || 0), 0);
}

function fromServer(project: ServerProject): LocalProject {
  const revenue = Number(project.settledValue || project.estimatedValue || project.contractValue || 0);
  return normalizeProject({
    id: project.id,
    code: project.code,
    name: project.name,
    customerName: project.customerName || '',
    customerPhone: project.customerPhone || '',
    address: project.address || '',
    projectType: project.scale || '',
    status: project.status,
    isContractSigned: project.status !== 'OPEN',
    categories: project.productsUsed ? project.productsUsed.split(',').map((value) => value.trim()).filter(Boolean) : [],
    categoryDetails: {},
    estimatedAmount: Number(project.estimatedValue || 0),
    additionalCosts: Number(project.incurredValue || 0),
    incurredType: project.incurredType || 'INCREASE',
    finalAmount: Number(project.settledValue || 0),
    expectedProfit: revenue + Number(project.extraRevenue || 0) - projectCosts(project),
    images: project.images || [],
    quotationId: project.quotationId || '',
    quotationCode: project.quotationCode || project.quotationId || '',
    costAluminum: Number(project.costAluminum || 0),
    costAccessory: Number(project.costAccessory || 0),
    costGlass: Number(project.costGlass || 0),
    costLabor: Number(project.costLabor || 0),
    costTransport: Number(project.costTransport || 0),
    costInstallation: Number(project.costInstallation || 0),
    costOther: Number(project.costOther || 0),
    extraRevenue: Number(project.extraRevenue || 0),
    receivedAmount: typeof project.receivedAmount === 'number' ? project.receivedAmount : undefined,
    createdAt: new Date(project.createdAt).getTime(),
    updatedAt: new Date(project.updatedAt).getTime(),
    syncState: 'SYNCED',
  });
}

function normalizeProject(project: LocalProject): LocalProject {
  return {
    ...project,
    categoryDetails: project.categoryDetails || {},
    costAluminum: Number(project.costAluminum || 0),
    costAccessory: Number(project.costAccessory || 0),
    costGlass: Number(project.costGlass || 0),
    costLabor: Number(project.costLabor || 0),
    costTransport: Number(project.costTransport || 0),
    costInstallation: Number(project.costInstallation || 0),
    costOther: Number(project.costOther || 0),
    extraRevenue: Number(project.extraRevenue || 0),
    name: fixLegacyUtf8Mojibake(project.name),
    customerName: fixLegacyUtf8Mojibake(project.customerName),
    customerPhone: fixLegacyUtf8Mojibake(project.customerPhone),
    address: fixLegacyUtf8Mojibake(project.address),
    projectType: fixLegacyUtf8Mojibake(project.projectType),
    categories: (project.categories || []).map(fixLegacyUtf8Mojibake),
    quotationCode: project.quotationCode ? fixLegacyUtf8Mojibake(project.quotationCode) : project.quotationCode,
  };
}

function toServerPayload(project: Partial<LocalProject>): Record<string, unknown> {
  return {
    name: project.name,
    customerName: project.customerName,
    customerPhone: project.customerPhone,
    address: project.address,
    status: project.status,
    estimatedValue: project.estimatedAmount,
    incurredValue: project.additionalCosts,
    incurredType: project.incurredType,
    settledValue: project.finalAmount,
    quotationId: project.quotationId || null,
    images: project.images,
    scale: project.projectType,
    productsUsed: project.categories?.join(', '),
    costAluminum: project.costAluminum,
    costAccessory: project.costAccessory,
    costGlass: project.costGlass,
    costLabor: project.costLabor,
    costTransport: project.costTransport,
    costInstallation: project.costInstallation,
    costOther: project.costOther,
    extraRevenue: project.extraRevenue,
  };
}

async function readReplica(): Promise<LocalProject[]> {
  try {
    const current = await AsyncStorage.getItem(scopedKey(STORAGE_KEY));
    return (JSON.parse(current || '[]') as LocalProject[]).map(normalizeProject);
  } catch {
    return [];
  }
}

async function writeReplica(projects: LocalProject[]) {
  await AsyncStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(projects));
}

async function deviceId(): Promise<string> {
  return getInstallationIdentity(AsyncStorage);
}

async function readMutationQueue(): Promise<PendingMutation[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(scopedKey(QUEUE_KEY))) || '[]') as PendingMutation[];
  } catch {
    return [];
  }
}

async function writeMutationQueue(queue: PendingMutation[]) {
  await AsyncStorage.setItem(scopedKey(QUEUE_KEY), JSON.stringify(queue));
}

async function updatePendingProjectCreate(entityId: string, payload: Record<string, unknown>) {
  const queue = await readMutationQueue();
  await writeMutationQueue(queue.map((mutation) => (
    mutation.entityType === 'PROJECT' && mutation.entityId === entityId && mutation.operation === 'CREATE'
      ? { ...mutation, payload }
      : mutation
  )));
}

async function removePendingEntityMutations(entityType: PendingMutation['entityType'], entityId: string) {
  const queue = await readMutationQueue();
  await writeMutationQueue(queue.filter((mutation) => mutation.entityType !== entityType || mutation.entityId !== entityId));
}

export async function enqueueOperationsMutation(mutation: Omit<PendingMutation, 'clientMutationId' | 'deviceId' | 'createdAt'>) {
  const queue = await readMutationQueue();
  const queued = { ...mutation, clientMutationId: `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`, deviceId: await deviceId(), createdAt: Date.now() };
  queue.push(queued);
  await writeMutationQueue(queue);
  return queued;
}

function mediaForMutation(mutation: PendingMutation, media: MediaQueueItem[]) {
  const selectedIds = Array.isArray(mutation.payload.mediaLocalIds) ? mutation.payload.mediaLocalIds.map(String) : null;
  return media.filter((item) => item.entityType === mutation.entityType && item.entityId === mutation.entityId && item.uploadState !== 'CANCELLED' && (!selectedIds || selectedIds.includes(item.localId)));
}

function mediaKey(value: unknown) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function mutationWithUploadedMedia(mutation: PendingMutation, media: MediaQueueItem[]): PendingMutation | null {
  const related = mediaForMutation(mutation, media);
  if (related.some((item) => item.required && item.uploadState !== 'UPLOADED')) return null;
  const uploaded = related.filter((item) => item.uploadState === 'UPLOADED' && item.remoteObjectId);
  if (!uploaded.length) return mutation;
  const payload = { ...mutation.payload };
  if (mutation.entityType === 'INSTALLATION') {
    payload.photoObjectIds = uploaded.filter((item) => !item.fileName.startsWith('signature-')).map((item) => item.remoteObjectId);
    payload.customerSignatureObjectId = uploaded.find((item) => item.fileName.startsWith('signature-'))?.remoteObjectId;
  } else {
    payload.photoObjectIds = uploaded.map((item) => item.remoteObjectId);
    if (mutation.entityType === 'QC_INSPECTION' && Array.isArray(payload.results)) {
      payload.results = (payload.results as Array<Record<string, unknown>>).map((result) => ({
        ...result,
        photoObjectIds: uploaded
          .filter((item) => item.fileName.includes(`-${mediaKey(result.checkKey)}-`))
          .map((item) => item.remoteObjectId),
      }));
    }
  }
  return { ...mutation, payload };
}

export async function syncOperationsQueue() {
  await syncMediaQueue();
  const queue = await readMutationQueue();
  if (!queue.length) return;
  const media = await listMediaQueue();
  const remaining: PendingMutation[] = [];
  for (const mutation of queue) {
    const readyMutation = mutationWithUploadedMedia(mutation, media);
    if (!readyMutation) {
      remaining.push(mutation);
      continue;
    }
    try {
      const response = await api.post<{ status: string; result?: { entityId?: string; code?: string } }>('/workshop/v2/sync/mutations', readyMutation);
      if (response.status === 'CONFLICT') remaining.push(mutation);
      else if (Array.isArray(mutation.payload.mediaLocalIds)) await Promise.all(mutation.payload.mediaLocalIds.map((id) => cancelMedia(String(id))));
      if (mutation.operation === 'CREATE' && mutation.entityId && response.result?.entityId) {
        await remapMediaEntity(mutation.entityType, mutation.entityId, response.result.entityId);
        const replica = await readReplica();
        const index = replica.findIndex((project) => project.id === mutation.entityId);
        if (index >= 0) {
          replica[index] = { ...replica[index], id: response.result.entityId, code: response.result.code || replica[index].code, syncState: 'SYNCED' };
          await writeReplica(replica);
        }
      }
    } catch {
      remaining.push(mutation);
    }
  }
  await writeMutationQueue(remaining);
}

export const LocalProjectsApi = {
  async getAll(): Promise<LocalProject[]> {
    await syncOperationsQueue();
    const replica = await readReplica();
    try {
      const server = await api.get<ServerProject[]>('/workshop/v2/projects');
      const pending = replica.filter((project) => project.syncState === 'PENDING');
      const synced = server.map(fromServer);
      const merged = [...pending.filter((project) => !synced.some((item) => item.id === project.id)), ...synced];
      await writeReplica(merged);
      return merged;
    } catch {
      return replica;
    }
  },

  async getOne(id: string): Promise<LocalProject | null> {
    const all = await this.getAll();
    return all.find((project) => project.id === id || project.code === id) || null;
  },

  async create(data: Partial<LocalProject>): Promise<LocalProject> {
    const now = Date.now();
    try {
      const created = await api.post<ServerProject>('/workshop/v2/projects', toServerPayload({ ...data, name: data.name || 'Công trình mới' }));
      const project = fromServer(created);
      await writeReplica([project, ...(await readReplica()).filter((item) => item.id !== project.id)]);
      return project;
    } catch {
      const temporaryId = `local-${now}-${Math.random().toString(36).slice(2)}`;
      const project: LocalProject = normalizeProject({
        id: temporaryId, code: `OFFLINE-${String(now).slice(-6)}`, name: data.name || 'Công trình mới',
        customerName: data.customerName || '', customerPhone: data.customerPhone || '', address: data.address || '',
        projectType: data.projectType || '', status: data.status || 'OPEN', isContractSigned: data.isContractSigned || false,
        categories: data.categories || [], categoryDetails: data.categoryDetails || {}, estimatedAmount: data.estimatedAmount || 0,
        additionalCosts: data.additionalCosts || 0, incurredType: data.incurredType || 'INCREASE', finalAmount: data.finalAmount || 0,
        expectedProfit: data.expectedProfit || 0, images: data.images || [], quotationId: data.quotationId || '', quotationCode: data.quotationCode || '',
        costAluminum: data.costAluminum || 0, costAccessory: data.costAccessory || 0, costGlass: data.costGlass || 0,
        costLabor: data.costLabor || 0, costTransport: data.costTransport || 0, costInstallation: data.costInstallation || 0,
        costOther: data.costOther || 0, extraRevenue: data.extraRevenue || 0,
        createdAt: now, updatedAt: now, syncState: 'PENDING',
      });
      await writeReplica([project, ...(await readReplica())]);
      await enqueueOperationsMutation({ entityType: 'PROJECT', entityId: temporaryId, operation: 'CREATE', payload: toServerPayload(project) });
      return project;
    }
  },

  async update(id: string, data: Partial<LocalProject>): Promise<LocalProject> {
    const replica = await readReplica();
    const index = replica.findIndex((project) => project.id === id || project.code === id);
    if (index === -1) throw new Error('Không tìm thấy công trình');
    const optimistic = normalizeProject({ ...replica[index], ...data, updatedAt: Date.now(), syncState: 'PENDING' });
    replica[index] = optimistic;
    await writeReplica(replica);
    if (id.startsWith('local-')) {
      await updatePendingProjectCreate(id, toServerPayload(optimistic));
      return optimistic;
    }
    try {
      const updated = await api.patch<ServerProject>(`/workshop/v2/projects/${id}`, toServerPayload(data));
      const synced = fromServer(updated);
      replica[index] = synced;
      await writeReplica(replica);
      return synced;
    } catch {
      await enqueueOperationsMutation({ entityType: 'PROJECT', entityId: id, operation: 'UPDATE', payload: toServerPayload(data) });
      return optimistic;
    }
  },

  async delete(id: string): Promise<void> {
    const replica = await readReplica();
    if (id.startsWith('local-')) {
      await writeReplica(replica.filter((project) => project.id !== id && project.code !== id));
      await removePendingEntityMutations('PROJECT', id);
      return;
    }
    try {
      await api.delete(`/workshop/v2/projects/${id}`);
      await writeReplica(replica.filter((project) => project.id !== id && project.code !== id));
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await writeReplica(replica.filter((project) => project.id !== id && project.code !== id));
      await enqueueOperationsMutation({ entityType: 'PROJECT', entityId: id, operation: 'DELETE', payload: {} });
    }
  },

  syncPending: syncOperationsQueue,
};
