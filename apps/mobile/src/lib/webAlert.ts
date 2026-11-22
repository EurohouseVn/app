import { Alert, Platform } from 'react-native';
import { runWebAlert, type AlertButton } from './webAlertCore';

/** Trên web, đưa Alert.alert về hộp thoại trình duyệt để lỗi không bị nuốt mất. */
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons) => runWebAlert(window, title, message, buttons as AlertButton[] | undefined);
}
