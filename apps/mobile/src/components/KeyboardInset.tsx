import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * Android 15+ vẽ app tràn mép (edge-to-edge) nên cửa sổ không còn tự co lại khi bàn phím hiện lên,
 * ô đang gõ bị bàn phím che. Bọc cả app và chừa chỗ ở đáy cho tới đỉnh bàn phím.
 *
 * Không tin chiều cao bàn phím do hệ thống báo (nhiều máy trừ đi thanh điều hướng nên thiếu vài chục điểm ảnh,
 * khiến ô gõ vẫn nằm sau bàn phím). Thay vào đó đo vị trí đáy thật của app và vị trí đỉnh bàn phím trên màn hình.
 * Trên iOS và web, hệ điều hành hay từng màn đã tự lo nên bỏ qua.
 */
/**
 * Chừa thêm chỗ cho một khung cụ thể (ví dụ ô gõ cố định ở đáy) cho tới khi nó nằm hẳn trên bàn phím.
 * Đo thẳng đáy của khung so với đỉnh bàn phím nên đúng dù cửa sổ đã tự co hay chưa, và dù lớp bọc ngoài đã chừa bao nhiêu.
 * Gắn `ref` vào khung (kèm `collapsable={false}`) và cộng `extra` vào paddingBottom của chính khung đó.
 */
export function useKeyboardClearance(ref: RefObject<View | null>) {
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    let current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (top: number, pass: number) => {
      ref.current?.measureInWindow((_x, y, _w, height) => {
        const overlap = Math.round(y + height - top);
        if (Math.abs(overlap) <= 2) return;
        current = Math.max(0, current + overlap);
        setExtra(current);
        // Bố cục cập nhật chậm vài khung hình, đo lại để chốt (tối đa 3 lượt).
        if (pass < 3) timer = setTimeout(() => settle(top, pass + 1), 120);
      });
    };
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const top = event.endCoordinates?.screenY;
      if (typeof top !== 'number') return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => settle(top, 1), 150);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      if (timer) clearTimeout(timer);
      current = 0;
      setExtra(0);
    });
    return () => { if (timer) clearTimeout(timer); show.remove(); hide.remove(); };
  }, [ref]);

  return extra;
}

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
