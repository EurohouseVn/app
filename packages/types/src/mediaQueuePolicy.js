export function mediaRetryDelayMs(retryCount) {
  const normalized = Math.max(1, Math.floor(retryCount));
  return Math.min(60 * 60_000, 5_000 * (2 ** Math.max(0, normalized - 1)));
}

export function recoverInterruptedMediaUploads(items, now = Date.now()) {
  return items.map((item) => item.uploadState === 'UPLOADING'
    ? {
        ...item,
        uploadState: 'FAILED',
        lastError: 'L\u1ea7n t\u1ea3i tr\u01b0\u1edbc b\u1ecb gi\u00e1n \u0111o\u1ea1n. \u1ea2nh s\u1ebd \u0111\u01b0\u1ee3c th\u1eed l\u1ea1i.',
        nextAttemptAt: now,
      }
    : item);
}
