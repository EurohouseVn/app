import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * Android 15+ vẽ app tràn mép (edge-to-edge) nên cửa sổ không còn tự co lại khi bàn phím hiện lên,
 * ô đang gõ bị bàn phím che. Bọc cả app và chừa chỗ ở đáy đúng bằng chiều cao bàn phím.
 * Trên iOS và web, hệ điều hành hay từng màn đã tự lo nên bỏ qua.
 */
export function KeyboardInset({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => setHeight(event.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return <View style={{ flex: 1, paddingBottom: height }}>{children}</View>;
}
