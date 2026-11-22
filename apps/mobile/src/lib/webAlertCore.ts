export type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
export type WindowLike = { alert: (text: string) => void; confirm: (text: string) => boolean };

/** react-native-web không hiện Alert.alert; hàm này đưa nó về hộp thoại của trình duyệt. */
export function runWebAlert(win: WindowLike, title: string, message?: string, buttons?: AlertButton[]) {
  const text = message ? `${title}\n\n${message}` : title;
  if (buttons && buttons.length > 1) {
    const cancel = buttons.find((button) => button.style === 'cancel');
    const action = buttons.find((button) => button !== cancel) ?? buttons[buttons.length - 1];
    if (win.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
    return;
  }
  win.alert(text);
  buttons?.[0]?.onPress?.();
}
