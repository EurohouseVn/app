export type RecoverableMediaUpload = {
  uploadState: string;
  retryCount: number;
  lastError: string;
  nextAttemptAt: number;
};

export function mediaRetryDelayMs(retryCount: number): number;

export function recoverInterruptedMediaUploads<T extends RecoverableMediaUpload>(
  items: T[],
  now?: number,
): T[];
