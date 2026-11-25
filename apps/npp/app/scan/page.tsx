'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, ClipboardCheck, CloudOff, Keyboard, PackageMinus, PackagePlus, Search, Undo2 } from 'lucide-react';
import type { NppGlassSheetItem, NppGlassStockKind, NppStocktakeItem, ScanGlassStockInput, StocktakeScanInput, StocktakeScanResult } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiRequest } from '../../src/lib/api';
import { parseGlassBarcode } from '../../src/lib/glassBarcode';
import { DEFAULT_SCAN_PATH, ScanQueue } from '../../src/lib/scanQueue';
import { BarcodeScanner } from '../../src/components/BarcodeScanner';
import { eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, ui } from '../../src/ui';

type Mode = 'LOOKUP' | 'RECEIVE' | 'ISSUE' | 'COUNT';
type FeedItem = { id: number; tone: 'ok' | 'error' | 'pending'; text: string; at: string };
type Body = { idempotencyKey: string } & Record<string, unknown>;
type StockChoice = { path: string; body: Body; options: Array<{ kind: NppGlassStockKind; location: string; quantity: number }> };
type KindChoice = { path: string; body: Body; kinds: NppGlassStockKind[] };
type ApiPayload = Record<string, unknown> & { code?: string; message?: string; options?: StockChoice['options']; kinds?: NppGlassStockKind[] };

const KIND_LABEL: Record<NppGlassStockKind, string> = { SHEET: 'Tấm nguyên', REMNANT: 'Tấm dư', CUT_PIECE: 'Tấm cắt' };
const MODE_META: Record<Mode, { label: string; icon: typeof Search }> = {
  LOOKUP: { label: 'Tra cứu', icon: Search },
  RECEIVE: { label: 'Nhập', icon: PackagePlus },
  ISSUE: { label: 'Xuất', icon: PackageMinus },
  COUNT: { label: 'Kiểm kê', icon: ClipboardCheck },
};
const LOCATION_KEY = 'eurohouse-npp-scan-location';
const COUNT_KEY = 'eurohouse-npp-scan-stocktake';
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
  const [choice, setChoice] = useState<StockChoice | null>(null);
  const [kindChoice, setKindChoice] = useState<KindChoice | null>(null);
  const [pending, setPending] = useState(0);
  const [session, setSession] = useState({ received: 0, issued: 0, counted: 0 });
  const [stocktakes, setStocktakes] = useState<NppStocktakeItem[]>([]);
  const [stocktakeId, setStocktakeId] = useState('');
  const feedId = useRef(0);
  const queue = useRef<ScanQueue | null>(null);
  const flushing = useRef(false);
  const lastCount = useRef<{ stocktakeId: string; barcode: string; kind: NppGlassStockKind; location: string } | null>(null);
  const modeRef = useRef(mode);
  const optionsRef = useRef({ kind, location, quantity, reason, stocktakeId });

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { optionsRef.current = { kind, location, quantity, reason, stocktakeId }; }, [kind, location, quantity, reason, stocktakeId]);

  const push = useCallback((tone: FeedItem['tone'], text: string) => {
    feedId.current += 1;
    setFeed((current) => [{ id: feedId.current, tone, text, at: new Date().toLocaleTimeString('vi-VN') }, ...current].slice(0, 30));
  }, []);

  const describe = useCallback((path: string, body: Body, data: unknown): { text: string; kind: 'received' | 'issued' | 'counted' } => {
    if (path === DEFAULT_SCAN_PATH) {
      const input = body as unknown as ScanGlassStockInput;
      const item = data as NppGlassSheetItem;
      const sign = input.mode === 'RECEIVE' ? '+' : '−';
      return {
        text: `${sign}${input.quantity ?? 1} ${item.barcode} · tồn ${item.quantity}${item.location ? ` · ${item.location}` : ''}${item.kind && item.kind !== 'SHEET' ? ` · ${KIND_LABEL[item.kind]}` : ''}`,
        kind: input.mode === 'RECEIVE' ? 'received' : 'issued',
      };
    }
    const result = data as StocktakeScanResult;
    const input = body as unknown as StocktakeScanInput;
    const undo = (input.quantity ?? 1) < 0;
    return { text: `${undo ? 'Hoàn tác · ' : 'Đếm '}${result.barcode} → ${result.counted}${result.location ? ` · ${result.location}` : ''}${result.kind !== 'SHEET' ? ` · ${KIND_LABEL[result.kind]}` : ''}`, kind: 'counted' };
  }, []);

  /** Gửi một lần quét. Mất mạng thì cất vào hàng đợi (cùng khóa chống trùng) để gửi lại sau mà không bị cộng/trừ hai lần. */
  const send = useCallback(async (path: string, body: Body, fromQueue = false): Promise<'done' | 'queued' | 'failed'> => {
    const code = String(body.barcode ?? '');
    let result;
    try {
      result = await apiRequest<ApiPayload>(path, 'POST', body);
    } catch {
      if (!fromQueue) {
        queue.current?.add(body, path);
        setPending(queue.current?.size ?? 0);
        push('pending', `Chưa có mạng, đã lưu chờ gửi: ${code}`);
        beep(false);
      }
      return 'queued';
    }
    if (result.ok && result.data) {
      const info = describe(path, body, result.data);
      push('ok', info.text);
      const qty = Math.abs(Number(body.quantity ?? 1));
      setSession((s) => ({
        received: s.received + (info.kind === 'received' ? qty : 0),
        issued: s.issued + (info.kind === 'issued' ? qty : 0),
        counted: s.counted + (info.kind === 'counted' ? (Number(body.quantity ?? 1) < 0 ? -qty : qty) : 0),
      }));
      if (info.kind === 'counted') {
        const r = result.data as unknown as StocktakeScanResult;
        const id = path.split('/')[4] ?? '';
        lastCount.current = { stocktakeId: id, barcode: r.barcode, kind: r.kind, location: r.location };
      }
      if (!fromQueue) beep(true);
      return 'done';
    }
    if (result.status === 409 && result.data?.code === 'AMBIGUOUS_STOCK' && result.data.options && !fromQueue) {
      setChoice({ path, body, options: result.data.options });
      push('error', `${code} có ở nhiều chỗ, hãy chọn dòng cần xuất.`);
      beep(false);
      return 'failed';
    }
    if (result.status === 409 && result.data?.code === 'AMBIGUOUS_KIND' && result.data.kinds && !fromQueue) {
      setKindChoice({ path, body, kinds: result.data.kinds });
      push('error', `${code} có nhiều loại hàng, hãy chọn loại.`);
      beep(false);
      return 'failed';
    }
    push('error', `${code}: ${result.data?.message ?? `lỗi ${result.status}`}`);
    if (!fromQueue) beep(false);
    return 'failed';
  }, [describe, push]);

  const flushQueue = useCallback(async () => {
    if (flushing.current || !queue.current) return;
    flushing.current = true;
    try {
      for (const entry of queue.current.list()) {
        const outcome = await send(entry.path, entry.input as Body, true);
        if (outcome === 'queued') break; // vẫn chưa có mạng
        queue.current.remove(entry.id); // đã xong hoặc bị từ chối (gửi lại cũng không khác)
        setPending(queue.current.size);
      }
    } finally {
      flushing.current = false;
    }
  }, [send]);

  const loadStocktakes = useCallback(async () => {
    try {
      const items = await apiGet<NppStocktakeItem[]>('/npp/glass/stocktakes');
      const open = items.filter((item) => item.status === 'OPEN');
      setStocktakes(open);
      setStocktakeId((current) => (open.some((item) => item.id === current) ? current : window.localStorage.getItem(COUNT_KEY) && open.some((item) => item.id === window.localStorage.getItem(COUNT_KEY)) ? window.localStorage.getItem(COUNT_KEY)! : open[0]?.id ?? ''));
    } catch {
      setStocktakes([]);
    }
  }, []);

  useEffect(() => {
    queue.current = new ScanQueue(window.localStorage);
    setPending(queue.current.size);
    setLocation(window.localStorage.getItem(LOCATION_KEY) ?? '');
    const onOnline = () => void flushQueue();
    window.addEventListener('online', onOnline);
    void flushQueue();
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  useEffect(() => { if (mode === 'COUNT') void loadStocktakes(); }, [mode, loadStocktakes]);

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
    setKindChoice(null);
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
    if (current === 'COUNT') {
      if (!opts.stocktakeId) {
        push('error', 'Chọn một đợt kiểm kê trước khi quét.');
        beep(false);
        return;
      }
      const body: StocktakeScanInput = { barcode: code, quantity: 1, idempotencyKey: newKey(), ...(opts.location.trim() ? { location: opts.location.trim() } : {}) };
      await send(`/npp/glass/stocktakes/${opts.stocktakeId}/scans`, body as unknown as Body);
      return;
    }
    const qty = Math.max(1, Math.floor(Number(opts.quantity) || 1));
    const body: ScanGlassStockInput = {
      mode: current,
      barcode: code,
      quantity: qty,
      idempotencyKey: newKey(),
      ...(current === 'RECEIVE' ? { kind: opts.kind, location: opts.location.trim() } : {}),
      ...(current === 'ISSUE' && opts.reason.trim() ? { reason: opts.reason.trim() } : {}),
    };
    await send(DEFAULT_SCAN_PATH, body as unknown as Body);
  }, [push, send]);

  async function chooseStock(option: StockChoice['options'][number]) {
    if (!choice) return;
    const body = { ...choice.body, kind: option.kind, location: option.location, idempotencyKey: newKey() };
    setChoice(null);
    await send(choice.path, body);
  }

  async function chooseKind(picked: NppGlassStockKind) {
    if (!kindChoice) return;
    const body = { ...kindChoice.body, kind: picked, idempotencyKey: newKey() };
    setKindChoice(null);
    await send(kindChoice.path, body);
  }

  async function undoLastCount() {
    const last = lastCount.current;
    if (!last) return;
    const body: StocktakeScanInput = { barcode: last.barcode, quantity: -1, kind: last.kind, location: last.location, idempotencyKey: newKey() };
    await send(`/npp/glass/stocktakes/${last.stocktakeId}/scans`, body as unknown as Body);
  }

  async function startStocktake() {
    const name = `Kiểm kê ${new Date().toLocaleDateString('vi-VN')}`;
    const result = await apiRequest<NppStocktakeItem & { message?: string }>('/npp/glass/stocktakes', 'POST', { name, location: location.trim() }).catch(() => null);
    if (!result?.ok || !result.data) {
      push('error', result?.data?.message ?? 'Không mở được đợt kiểm kê.');
      return;
    }
    push('ok', `Đã mở đợt "${name}"${location.trim() ? ` cho ${location.trim()}` : ' cho cả kho'}.`);
    setStocktakeId(result.data.id);
    await loadStocktakes();
  }

  function selectStocktake(id: string) {
    setStocktakeId(id);
    window.localStorage.setItem(COUNT_KEY, id);
  }

  function updateLocation(value: string) {
    setLocation(value);
    window.localStorage.setItem(LOCATION_KEY, value);
  }

  const totals = useMemo(() => `${session.received} đã nhập · ${session.issued} đã xuất · ${session.counted} đã đếm trong lần quét này`, [session]);
  const compact = { ...inputStyle, padding: '12px 14px', fontSize: 16 };

  return (
    <NppPage>
      <p style={eyebrowStyle}>Quét mã</p>
      <h1 style={{ ...pageTitleStyle, fontSize: 26 }}>Quét mã kính bằng điện thoại</h1>
      <p style={subtitleStyle}>Hướng camera vào nhãn mã vạch: mỗi lần quét tự cộng, trừ hoặc đếm kho. Mất mạng vẫn quét tiếp, hệ thống tự gửi lại khi có mạng.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '14px 0' }} role="tablist" aria-label="Chế độ quét">
        {(Object.keys(MODE_META) as Mode[]).map((m) => {
          const Icon = MODE_META[m].icon;
          const on = mode === m;
          return (
            <button key={m} role="tab" aria-selected={on} onClick={() => { setMode(m); setChoice(null); setKindChoice(null); setLookup(null); }} style={{ ...ghostButtonStyle, justifyContent: 'center', padding: '12px 4px', fontSize: 14, fontWeight: 800, background: on ? ui.brandSoft : ui.surface, color: on ? ui.brandText : ui.text, borderColor: on ? ui.brand : ui.borderStrong }}>
              <Icon size={16} /> {MODE_META[m].label}
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
            {mode === 'COUNT' ? (
              <>
                <label style={labelStyle}>Đợt kiểm kê đang mở
                  <select style={compact} value={stocktakeId} onChange={(e) => selectStocktake(e.target.value)}>
                    {stocktakes.length === 0 ? <option value="">Chưa có đợt nào</option> : null}
                    {stocktakes.map((st) => <option key={st.id} value={st.id}>{st.name || 'Đợt kiểm kê'}{st.location ? ` · ${st.location}` : ' · cả kho'}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>Vị trí đang kiểm (để trống: theo đợt)<input style={compact} value={location} onChange={(e) => updateLocation(e.target.value)} placeholder="Kệ A1" /></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={() => void startStocktake()} style={{ ...ghostButtonStyle, justifyContent: 'center', padding: '12px 8px' }}>Mở đợt mới</button>
                  <button onClick={() => void undoLastCount()} disabled={!lastCount.current} style={{ ...ghostButtonStyle, justifyContent: 'center', padding: '12px 8px' }}><Undo2 size={15} /> Hoàn tác</button>
                </div>
              </>
            ) : null}
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
            {mode === 'RECEIVE' || mode === 'ISSUE' ? <label style={labelStyle}>Số tấm mỗi lần quét<input style={compact} type="number" inputMode="numeric" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label> : null}
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
              <strong style={{ color: ui.text, fontSize: 14 }}>{String(choice.body.barcode)} có ở nhiều chỗ. Xuất từ dòng nào?</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {choice.options.map((option) => (
                  <button key={`${option.kind}|${option.location}`} onClick={() => void chooseStock(option)} style={{ ...ghostButtonStyle, justifyContent: 'space-between', padding: '12px 14px', fontSize: 15 }}>
                    <span>{KIND_LABEL[option.kind]} · {option.location || 'chưa có vị trí'}</span>
                    <strong>tồn {option.quantity}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {kindChoice ? (
            <div style={{ marginBottom: 12, border: `1px solid ${ui.brand}`, borderRadius: 12, padding: 12 }}>
              <strong style={{ color: ui.text, fontSize: 14 }}>{String(kindChoice.body.barcode)} là loại hàng nào?</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {kindChoice.kinds.map((k) => (
                  <button key={k} onClick={() => void chooseKind(k)} style={{ ...ghostButtonStyle, justifyContent: 'center', padding: '12px 14px', fontSize: 15 }}>{KIND_LABEL[k]}</button>
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
