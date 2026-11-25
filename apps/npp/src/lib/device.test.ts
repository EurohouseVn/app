import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceHeaders, describeDevice, detectDeviceKind } from './device';

const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WIN_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';

test('phones and tablets count as phones, everything else as a computer', () => {
  assert.equal(detectDeviceKind(ANDROID_CHROME), 'PHONE');
  assert.equal(detectDeviceKind(IPHONE_SAFARI), 'PHONE');
  assert.equal(detectDeviceKind(IPAD), 'PHONE');
  assert.equal(detectDeviceKind(WIN_CHROME), 'DESKTOP');
  assert.equal(detectDeviceKind(MAC_SAFARI), 'DESKTOP');
  assert.equal(detectDeviceKind(''), 'DESKTOP');
});

test('the device description names the browser and the system', () => {
  assert.equal(describeDevice(WIN_CHROME), 'Chrome · Windows');
  assert.equal(describeDevice(WIN_EDGE), 'Edge · Windows');
  assert.equal(describeDevice(ANDROID_CHROME), 'Chrome · Android');
  assert.equal(describeDevice(IPHONE_SAFARI), 'Safari · iPhone');
  assert.equal(describeDevice(IPAD), 'Safari · iPad');
  assert.equal(describeDevice(MAC_SAFARI), 'Safari · macOS');
  assert.equal(describeDevice(''), 'Thiết bị');
});

test('headers are ASCII-safe even though the label has Vietnamese text', () => {
  const headers = deviceHeaders(IPHONE_SAFARI);
  assert.equal(headers['X-Device-Kind'], 'PHONE');
  assert.match(headers['X-Device-Label'], /^[\x20-\x7e]+$/);
  assert.equal(decodeURIComponent(headers['X-Device-Label']), 'Safari · iPhone');
});
