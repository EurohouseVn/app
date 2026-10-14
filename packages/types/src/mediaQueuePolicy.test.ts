import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaRetryDelayMs, recoverInterruptedMediaUploads } from './mediaQueuePolicy.js';

test('media queue recovers an interrupted upload after app restart', () => {
  const now = 1_000_000;
  const recovered = recoverInterruptedMediaUploads([
    { uploadState: 'UPLOADING', retryCount: 1, lastError: '', nextAttemptAt: now - 1 },
    { uploadState: 'UPLOADED', retryCount: 0, lastError: '', nextAttemptAt: 0 },
  ], now);
  assert.equal(recovered[0].uploadState, 'FAILED');
  assert.equal(recovered[0].nextAttemptAt, now);
  assert.match(recovered[0].lastError, /gián đoạn/);
  assert.equal(recovered[1].uploadState, 'UPLOADED');
});

test('media retry backoff is exponential and bounded', () => {
  assert.equal(mediaRetryDelayMs(1), 5_000);
  assert.equal(mediaRetryDelayMs(3), 20_000);
  assert.equal(mediaRetryDelayMs(99), 3_600_000);
});
