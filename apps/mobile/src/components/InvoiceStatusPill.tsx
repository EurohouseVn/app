import { StyleSheet, Text, View } from 'react-native';
import type { StatusTone } from '../lib/invoiceState';
import { ws } from './ws';

const TONE_STYLE: Record<StatusTone, { bg: string; fg: string }> = {
  ok: { bg: ws.successBg, fg: ws.success },
  test: { bg: '#F4F3FF', fg: '#5925DC' },
  draft: { bg: '#F2F4F7', fg: '#475467' },
  cancel: { bg: ws.dangerBg, fg: ws.dangerText },
};

export function InvoiceStatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <View style={[s.pill, { backgroundColor: TONE_STYLE[tone].bg }]}><Text style={[s.text, { color: TONE_STYLE[tone].fg }]}>{label}</Text></View>;
}

const s = StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  text: { fontSize: 10.5, fontWeight: '800' },
});
