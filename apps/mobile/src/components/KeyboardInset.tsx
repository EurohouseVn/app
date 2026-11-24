import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * Android 15+ vẽ app tràn mép (edge-to-edge) nên cửa sổ không còn tự co lại khi bàn phím hiện lên,
 * ô đang gõ bị bàn phím che. Bọc cả app và chừa chỗ ở đáy cho tới đỉnh bàn phím.
 *
 * Không tin chiều cao bàn phím do hệ thống báo (nhiều máy trừ đi thanh điều hướng nên thiếu vài chục điểm ảnh,
 * khiến ô gõ vẫn nằm sau bàn phím). Thay vào đó đo vị trí đáy thật của app và vị trí đỉnh bàn phím trên màn hình.
 * Trên iOS và web, hệ điều hành hay từng màn đã tự lo nên bỏ qua.
 */
export function KeyboardInset({ children }: { children: ReactNode }) {
  const [inset, setInset] = useState(0);
  const frame = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const top = event.endCoordinates?.screenY;
      const reported = event.endCoordinates?.height ?? 0;
      const node = frame.current;
      if (!node || typeof top !== 'number') { setInset(reported); return; }
      node.measureInWindow((_x, y, _w, height) => {
        const measured = Math.round(y + height - top);
        // Đo được thì dùng số đo; không hợp lý (âm hoặc quá lớn) thì quay về số hệ thống báo.
        setInset(measured > 0 && measured <= reported + 200 ? measured : reported);
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return <View ref={frame} collapsable={false} style={{ flex: 1, paddingBottom: inset }}>{children}</View>;
}
