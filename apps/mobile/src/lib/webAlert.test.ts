import test from 'node:test';
import assert from 'node:assert/strict';
import { runWebAlert } from './webAlertCore.ts';

function fakeWindow(confirmResult = true) {
  const calls: string[] = [];
  return {
    calls,
    alert: (text: string) => { calls.push(`alert:${text}`); },
    confirm: (text: string) => { calls.push(`confirm:${text}`); return confirmResult; },
  };
}

test('a plain alert shows title and message, then runs the only button', () => {
  const win = fakeWindow();
  let pressed = 0;
  runWebAlert(win, 'Lỗi', 'Không lưu được', [{ text: 'OK', onPress: () => { pressed += 1; } }]);
  assert.deepEqual(win.calls, ['alert:Lỗi\n\nKhông lưu được']);
  assert.equal(pressed, 1);
});

test('alert without buttons or message still shows the title', () => {
  const win = fakeWindow();
  runWebAlert(win, 'Đã lưu');
  assert.deepEqual(win.calls, ['alert:Đã lưu']);
});

test('two buttons use confirm: OK runs the action button, cancel runs the cancel button', () => {
  const run = (answer: boolean) => {
    const win = fakeWindow(answer);
    const pressed: string[] = [];
    runWebAlert(win, 'Xoá', 'Chắc chắn?', [
      { text: 'Huỷ', style: 'cancel', onPress: () => pressed.push('cancel') },
      { text: 'Xoá', style: 'destructive', onPress: () => pressed.push('action') },
    ]);
    return { calls: win.calls, pressed };
  };
  assert.deepEqual(run(true), { calls: ['confirm:Xoá\n\nChắc chắn?'], pressed: ['action'] });
  assert.deepEqual(run(false), { calls: ['confirm:Xoá\n\nChắc chắn?'], pressed: ['cancel'] });
});
