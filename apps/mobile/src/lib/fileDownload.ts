import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeaders } from './api';

export const PDF_MIME = 'application/pdf';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Tải file từ API (kèm đăng nhập) rồi mở bảng chia sẻ; trên web thì tải thẳng về máy. */
export async function downloadAndShare(path: string, fileName: string, mimeType: string, dialogTitle: string): Promise<void> {
  const url = `${API_URL}${path}`;
  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) {
      let message = 'Không tải được file.';
      try { message = (await response.json()).message || message; } catch { /* không phải JSON */ }
      throw new Error(Array.isArray(message) ? message.join(' ') : message);
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
    return;
  }
  const result = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${fileName}`, { headers: authHeaders() });
  if (result.status >= 400) throw new Error('Không tải được file. Vui lòng thử lại.');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType, dialogTitle });
  } else {
    Alert.alert('Đã tải', `Đã lưu file tại: ${result.uri}`);
  }
}
