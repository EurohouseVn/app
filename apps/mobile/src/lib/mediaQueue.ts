import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { mediaRetryDelayMs, recoverInterruptedMediaUploads } from '@eurohouse/types';
import { API_URL, authHeaders } from './api';

const MEDIA_QUEUE_KEY = 'eurohouse.workshop.media.queue.v1';
const DEVICE_KEY = 'eurohouse.workshop.device.v2';

export type MediaUploadState = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED' | 'CANCELLED';

export type MediaQueueItem = {
  localId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  localPath: string;
  fileName: string;
  mime: string;
  size: number;
  checksum: string;
  required: boolean;
  retryCount: number;
  lastError: string;
  remoteObjectId?: string;
  uploadState: MediaUploadState;
  nextAttemptAt: number;
  createdAt: number;
  uploadedAt?: number;
};

let recoveredAfterStartup = false;

async function readQueue() {
  const shouldRecover = !recoveredAfterStartup;
  recoveredAfterStartup = true;
  try {
    const queue = JSON.parse((await AsyncStorage.getItem(MEDIA_QUEUE_KEY)) || '[]') as MediaQueueItem[];
    if (!shouldRecover) return queue;
    const recovered = recoverInterruptedMediaUploads(queue);
    if (recovered.some((item, index) => item.uploadState !== queue[index]?.uploadState)) await writeQueue(recovered);
    return recovered;
  } catch {
    return [];
  }
}

async function writeQueue(queue: MediaQueueItem[]) {
  await AsyncStorage.setItem(MEDIA_QUEUE_KEY, JSON.stringify(queue));
}

async function getDeviceId() {
  const current = await AsyncStorage.getItem(DEVICE_KEY);
  if (current) return current;
  const value = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_KEY, value);
  return value;
}

function extension(fileName: string, uri: string) {
  const source = fileName || uri.split('?')[0];
  const match = source.match(/\.[a-zA-Z0-9]{1,8}$/);
  return match?.[0]?.toLowerCase() || '.jpg';
}

async function persistLocalFile(uri: string, localId: string, fileName: string) {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return uri;
  const directory = `${FileSystem.documentDirectory}workshop-media/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${localId}${extension(fileName, uri)}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

export async function enqueueMedia(input: {
  entityType: string;
  entityId: string;
  uri: string;
  fileName?: string;
  mime?: string;
  required?: boolean;
}) {
  const localId = `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fileName = input.fileName || `workshop-${Date.now()}.jpg`;
  const localPath = await persistLocalFile(input.uri, localId, fileName);
  const info = await FileSystem.getInfoAsync(localPath, { md5: true });
  const item: MediaQueueItem = {
    localId,
    deviceId: await getDeviceId(),
    entityType: input.entityType.toUpperCase(),
    entityId: input.entityId,
    localPath,
    fileName,
    mime: input.mime || 'image/jpeg',
    size: info.exists && 'size' in info ? Number(info.size || 0) : 0,
    checksum: info.exists && 'md5' in info ? String(info.md5 || '') : '',
    required: input.required === true,
    retryCount: 0,
    lastError: '',
    uploadState: 'PENDING',
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  };
  await writeQueue([item, ...(await readQueue())]);
  void syncMediaQueue();
  return item;
}

export async function listMediaQueue() {
  return readQueue();
}

export async function remapMediaEntity(entityType: string, oldEntityId: string, newEntityId: string) {
  const queue = await readQueue();
  await writeQueue(queue.map((item) => item.entityType === entityType.toUpperCase() && item.entityId === oldEntityId
    ? { ...item, entityId: newEntityId, uploadState: item.uploadState === 'CANCELLED' ? item.uploadState : 'PENDING', nextAttemptAt: Date.now() }
    : item));
}

export async function retryMedia(localId: string) {
  const queue = await readQueue();
  await writeQueue(queue.map((item) => item.localId === localId ? { ...item, uploadState: 'PENDING', lastError: '', nextAttemptAt: Date.now() } : item));
  return syncMediaQueue();
}

export async function cancelMedia(localId: string) {
  const queue = await readQueue();
  const target = queue.find((item) => item.localId === localId);
  await writeQueue(queue.map((item) => item.localId === localId ? { ...item, uploadState: 'CANCELLED', lastError: '' } : item));
  if (target?.remoteObjectId) return;
  if (target && Platform.OS !== 'web' && target.localPath.startsWith(FileSystem.documentDirectory || '')) {
    await FileSystem.deleteAsync(target.localPath, { idempotent: true }).catch(() => undefined);
  }
}

let syncing = false;
export async function syncMediaQueue() {
  if (syncing) return;
  syncing = true;
  try {
    let queue = await readQueue();
    for (const candidate of queue.filter((item) => ['PENDING', 'FAILED'].includes(item.uploadState) && item.nextAttemptAt <= Date.now() && item.retryCount < 8)) {
      queue = queue.map((item) => item.localId === candidate.localId ? { ...item, uploadState: 'UPLOADING' } : item);
      await writeQueue(queue);
      try {
        const form = new FormData();
        form.append('localId', candidate.localId);
        form.append('deviceId', candidate.deviceId);
        form.append('entityType', candidate.entityType);
        form.append('entityId', candidate.entityId);
        form.append('required', String(candidate.required));
        form.append('file', { uri: candidate.localPath, name: candidate.fileName, type: candidate.mime } as unknown as Blob);
        const response = await fetch(`${API_URL}/workshop/v2/media`, { method: 'POST', headers: authHeaders(), body: form });
        const payload = await response.json().catch(() => null) as { storageObjectId?: string; message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || 'Chưa gửi được ảnh.');
        queue = (await readQueue()).map((item) => item.localId === candidate.localId ? {
          ...item, uploadState: 'UPLOADED', remoteObjectId: payload?.storageObjectId, uploadedAt: Date.now(), lastError: '',
        } : item);
      } catch (error) {
        const retryCount = candidate.retryCount + 1;
        queue = (await readQueue()).map((item) => item.localId === candidate.localId ? {
          ...item,
          uploadState: 'FAILED',
          retryCount,
          lastError: error instanceof Error ? error.message : 'Chưa gửi được ảnh.',
          nextAttemptAt: Date.now() + mediaRetryDelayMs(retryCount),
        } : item);
      }
      await writeQueue(queue);
    }
  } finally {
    syncing = false;
  }
}
