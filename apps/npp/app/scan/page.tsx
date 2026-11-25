'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, CloudOff, Keyboard, PackageMinus, PackagePlus, Search } from 'lucide-react';
import type { NppGlassSheetItem, NppGlassStockKind, ScanGlassStockInput } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiRequest } from '../../src/lib/api';
import { parseGlassBarcode } from '../../src/lib/glassBarcode';
import { ScanQueue } from '../../src/lib/scanQueue';
import { BarcodeScanner } from '../../src/components/BarcodeScanner';
import { eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, ui } from '../../src/ui';

type Mode = 'LOOKUP' | 'RECEIVE' | 'ISSUE';
type FeedItem = { id: number; tone: 'ok' | 'error' | 'pending'; text: string; at: string };
type Choice = { input: ScanGlassStockInput; options: Array<{ kind: NppGlassStockKind; location: string; quantity: number }> };

const KIND_LABEL: Record<NppGlassStockKind, string> = { SHEET: 'Tấm nguyên', REMNANT: 'Tấm dư', CUT_PIECE: 'Tấm cắt' };
const MODE_META: Record<Mode, { label: string; icon: typeof Search }> = {
  LOOKUP: { label: 'Tra cứu', icon: Search },
  RECEIVE: { label: 'Nhập kho', icon: PackagePlus },
  ISSUE: { label: 'Xuất kho', icon: PackageMinus },
};
const LOCATION_KEY = 'eurohouse-npp-scan-location';
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

let audio: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    audio = audio ?? new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (ok ? 0.08 : 0.25));
  } catch {
    // máy không cho phát âm thanh thì thôi
  }
  if (typeof navigator !== 'undefined') navigator.vibrate?.(ok ? 40 : [80, 40, 80]);
}

export default function NppScanPage() {
  const [mode, setMode] = useState<Mode>('RECEIVE');
  const [cameraOn, setCameraOn] = useState(false);
  const [kind, setKind] = useState<NppGlassStockKind>('SHEET');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [manual, setManual] = useState('');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [lookup, setLookup] = useState<NppGlassSheetItem[] | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [pending, setPending] = useState(0);
  const [session, setSession] = useState({ received: 0, issued: 0 });
  const feedId = useRef(0);
  const queue = useRef<ScanQueue | null>(null);
  const flushing = useRef(false);
  const modeRef = useRef(mode);
  const optionsRef = useRef({ kind, location, quantity, reason });

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { optionsRef.current = { kind, location, quantity, reason }; }, [kind, location, quantity, reason]);

  const push = useCallback((tone: FeedItem['tone'], text: string) => {
    feedId.current += 1;
    setFeed((current) => [{ id: feedId.current, tone, text, at: new Date().toLocaleTimeString('vi-VN') }, ...current].slice(0, 30));
  }, []);

  const describe = useCallback((input: ScanGlassStockInput, item: NppGlassSheetItem) => {
    const sign = input.mode === 'RECEIVE' ? '+' : '−';
    return `${sign}${input.quantity ?? 1} ${item.barcode} · tồn ${item.quantity}${item.location ? ` · ${item.location}` : ''}${item.kind && item.kind !== 'SHEET' ? ` · ${KIND_LABEL[item.kind]}` : ''}`;
  }, []);

  /** Gửi một lần quét. Mất mạng thì cất vào hàng đợi (cùng khóa chống trùng) để gửi lại sau mà không bị cộng/trừ hai lần. */
  const send = useCallback(async (input: ScanGlassStockInput, fromQueue = false): Promise<'done' | 'queued' | 'failed'> => {
    let result;
    try {
      result = await apiRequest<NppGlassSheetItem & { code?: string; message?: string; options?: Choice['options'] }>('/npp/glass/stock/scan', 'POST', input);
    } catch {
      if (!fromQueue) {
        queue.current?.add(input);
        setPending(queue.current?.size ?? 0);
        push('pending', `Chưa có mạng, đã lưu chờ gửi: ${input.mode === 'RECEIVE' ? 'nhập' : 'xuất'} ${input.barcode}`);
        beep(false);
      }
      return 'queued';
    }
    if (result.ok && result.data) {
      push('ok', describe(input, result.data));
      setSession((s) => (input.mode === 'RECEIVE' ? { ...s, received: s.received + (input.quantity ?? 1) } : { ...s, issued: s.issued + (input.quantity ?? 1) }));
      if (!fromQueue) beep(true);
      return 'done';
    }
    if (result.status === 409 && result.data?.code === 'AMBIGUOUS_STOCK' && result.data.options && !fromQueue) {
      setChoice({ input, options: result.data.options });
      push('error', `${input.barcode} có ở nhiều chỗ, hãy chọn dòng cần xuất.`);
      beep(false);
      return 'failed';
    }
    push('error', `${input.barcode}: ${result.data?.message ?? `lỗi ${result.status}`}`);
    if (!fromQueue) beep(false);
    return 'failed';
  }, [describe, push]);

  const flushQueue = useCallback(async () => {
    if (flushing.current || !queue.current) return;
    flushing.current = true;
    try {
      for (const entry of queue.current.list()) {
        const outcome = await send(entry.input, true);
        if (outcome === 'queued') break; // vẫn chưa có mạng
        queue.current.remove(entry.id); // đã xong hoặc bị từ chối (gửi lại cũng không khác)
        setPending(queue.current.size);
      }
    } finally {
      flushing.current = false;
    }
  }, [send]);

  useEffect(() => {
    queue.current = new ScanQueue(window.localStorage);
    setPending(queue.current.size);
    setLocation(window.localStorage.getItem(LOCATION_KEY) ?? '');
    const onOnline = () => void flushQueue();
    window.addEventListener('online', onOnline);
    void flushQueue();
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  const handleCode = useCallback(async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const parsed = parseGlassBarcode(code);
    if (!parsed) {
      push('error', `Không đúng dạng mã kính: ${code}`);
      beep(false);
      return;
    }
    setChoice(null);
    const current = modeRef.current;
    const opts = optionsRef.current;
    if (current === 'LOOKUP') {
      try {
        const rows = await apiGet<NppGlassSheetItem[]>(`/npp/glass/stock/lookup?code=${encodeURIComponent(code)}`);
        setLookup(rows);
        push(rows.length ? 'ok' : 'error', rows.length ? `${code}: tồn ${rows.reduce((n, r) => n + r.quantity, 0)} tấm` : `${code}: không có trong kho`);
        beep(rows.length > 0);
      } catch (e) {
        push('error', e instanceof Error ? e.message : 'Không tra được mã.');
        beep(false);
      }
      return;
    }
    const qty = Math.max(1, Math.floor(Number(opts.quantity) || 1));
    await send({
      mode: current,
      barcode: code,
      quantity: qty,
      idempotencyKey: newKey(),
      ...(current === 'RECEIVE' ? { kind: opts.kind, location: opts.location.trim() } : {}),
      ...(current === 'ISSUE' && opts.reason.trim() ? { reason: opts.reason.trim() } : {}),
    });
  }, [push, send]);

  async function chooseOption(option: Choice['options'][number]) {
    if (!choice) return;
    const input: ScanGlassStockInput = { ...choice.input, kind: option.kind, location: option.location, idempotencyKey: newKey() };
    setChoice(null);
    await send(input);
  }

  function updateLocation(value: string) {
    setLocation(value);
    window.localStorage.setItem(LOCATION_KEY, value);
  }

  const totals = useMemo(() => `${session.received} đã nhập · ${session.issued} đã xuất trong lần quét này`, [session]);
  const compact = { ...inputStyle, padding: '12px 14px', fontSize: 16 };

  return (
    <NppPage>
      <p style={eyebrowStyle}>Quét mã</p>
      <h1 style={{ ...pageTitleStyle, fontSize: 26 }}>Quét mã kính bằng điện thoại</h1>
      <p style={subtitleStyle}>Hướng camera vào nhãn mã vạch: mỗi lần quét tự cộng hoặc trừ kho. Mất mạng vẫn quét tiếp, hệ thống tự gửi lại khi có mạng.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '14px 0' }} role="tablist" aria-label="Chế độ quét">
        {(Object.keys(MODE_META) as Mode[]).map((m) => {
          const Icon = MODE_META[m].icon;
          const on = mode === m;
          return (
            <button key={m} role="tab" aria-selected={on} onClick={() => { setMode(m); setChoice(null); setLookup(null); }} style={{ ...ghostButtonStyle, justifyContent: 'center', padding: '12px 6px', fontSize: 15, fontWeight: 800, background: on ? ui.brandSoft : ui.surface, color: on ? ui.brandText : ui.text, borderColor: on ? ui.brand : ui.borderStrong }}>
              <Icon size={17} /> {MODE_META[m].label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section style={{ ...panelStyle, padding: 14 }}>
          <BarcodeScanner active={cameraOn} onDetect={(text) => void handleCode(text)} />
          <button onClick={() => setCameraOn((on) => !on)} style={{ ...primaryButtonStyle, width: '100%', marginTop: 12, justifyContent: 'center', padding: '14px 16px', fontSize: 16 }}>
            {cameraOn ? <><CameraOff size={18} /> Tắt camera</> : <><Camera size={18} /> Bật camera</>}
          </button>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            {mode === 'RECEIVE' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>Loại hàng
                  <select style={compact} value={kind} onChange={(e) => setKind(e.target.value as NppGlassStockKind)}>
                    {(Object.keys(KIND_LABEL) as NppGlassStockKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>Vị trí kệ<input style={compact} value={location} onChange={(e) => updateLocation(e.target.value)} placeholder="Kệ A1" /></label>
              </div>
            ) : null}
            {mode === 'ISSUE' ? <label style={labelStyle}>Lý do / mã đơn (không bắt buộc)<input style={compact} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Giao đơn 12" /></label> : null}
            {mode !== 'LOOKUP' ? <label style={labelStyle}>Số tấm mỗi lần quét<input style={compact} type="number" inputMode="numeric" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label> : null}
            <form onSubmit={(e) => { e.preventDefault(); void handleCode(manual); setManual(''); }} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
              <label style={labelStyle}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Keyboard size={14} /> Gõ mã (khi camera không đọc được)</span>
                <input style={compact} value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="CL8-0600-0900" autoCapitalize="characters" autoCorrect="off" />
              </label>
              <button type="submit" disabled={!manual.trim()} style={{ ...ghostButtonStyle, padding: '12px 16px', fontSize: 15, opacity: manual.trim() ? 1 : 0.5 }}>Gửi</button>
            </form>
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 14 }}>
          {pending > 0 ? (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, background: ui.warningSoft, color: ui.warning, borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontWeight: 700, fontSize: 14 }}>
              <CloudOff size={18} /> {pending} lần quét đang chờ mạng
              <button onClick={() => void flushQueue()} style={{ ...ghostButtonStyle, marginLeft: 'auto', padding: '6px 10px' }}>Gửi lại</button>
            </div>
          ) : null}

          {choice ? (
            <div style={{ marginBottom: 12, border: `1px solid ${ui.brand}`, borderRadius: 12, padding: 12 }}>
              <strong style={{ color: ui.text, fontSize: 14 }}>{choice.input.barcode} có ở nhiều chỗ. Xuất từ dòng nào?</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {choice.options.map((option) => (
                  <button key={`${option.kind}|${option.location}`} onClick={() => void chooseOption(option)} style={{ ...ghostButtonStyle, justifyContent: 'space-between', padding: '12px 14px', fontSize: 15 }}>
                    <span>{KIND_LABEL[option.kind]} · {option.location || 'chưa có vị trí'}</span>
                    <strong>tồn {option.quantity}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {lookup ? (
            <div style={{ marginBottom: 12, display: 'grid', gap: 6 }}>
              {lookup.map((row) => (
                <div key={row.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: ui.text, fontSize: 14 }}><strong style={{ fontFamily: 'Consolas, monospace' }}>{row.barcode}</strong><br />{row.widthMm} × {row.heightMm} mm · {KIND_LABEL[row.kind ?? 'SHEET']}{row.location ? ` · ${row.location}` : ''}</span>
                  <strong style={{ color: ui.text, fontSize: 18 }}>{row.quantity}</strong>
                </div>
              ))}
              {lookup.length === 0 ? <p style={{ color: ui.textFaint, margin: 0, fontSize: 14 }}>Mã này chưa có trong kho.</p> : null}
            </div>
          ) : null}

          <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 16 }}>Lần quét gần đây</h2>
          <p style={{ margin: '0 0 10px', color: ui.textMuted, fontSize: 12 }}>{totals}</p>
          <div style={{ display: 'grid', gap: 6 }} aria-live="polite">
            {feed.map((item) => (
              <div key={item.id} style={{ borderRadius: 10, padding: '9px 12px', fontSize: 14, display: 'flex', justifyContent: 'space-between', gap: 10, background: item.tone === 'ok' ? ui.successSoft : item.tone === 'error' ? ui.dangerSoft : ui.warningSoft, color: item.tone === 'ok' ? ui.success : item.tone === 'error' ? ui.danger : ui.warning, fontWeight: 600 }}>
                <span>{item.text}</span><span style={{ opacity: 0.7, fontSize: 12, whiteSpace: 'nowrap' }}>{item.at}</span>
              </div>
            ))}
            {feed.length === 0 ? <p style={{ color: ui.textFaint, margin: 0, fontSize: 14 }}>Chưa quét mã nào.</p> : null}
          </div>
        </section>
      </div>
    </NppPage>
  );
}
