/**
 * Nhận diện thiết bị của web NPP để gửi kèm lúc đăng nhập: mỗi NPP tối đa 2 máy tính và 3 điện thoại cùng lúc.
 * Máy chủ vẫn tự đoán lại theo User-Agent nếu không có tiêu đề này.
 */
export type DeviceKind = 'DESKTOP' | 'PHONE';

export function detectDeviceKind(userAgent: string): DeviceKind {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ? 'PHONE' : 'DESKTOP';
}

function browserName(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return '';
}

function systemName(ua: string): string {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return '';
}

export function describeDevice(userAgent: string): string {
  const parts = [browserName(userAgent), systemName(userAgent)].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Thiết bị';
}

/** Tiêu đề HTTP chỉ cho ký tự ASCII nên tên thiết bị được mã hóa URL; máy chủ giải mã lại. */
export function deviceHeaders(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): Record<string, string> {
  return {
    'X-Device-Kind': detectDeviceKind(userAgent),
    'X-Device-Label': encodeURIComponent(describeDevice(userAgent)),
  };
}
