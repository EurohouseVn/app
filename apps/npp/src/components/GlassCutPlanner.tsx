'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, Printer, Scissors, Trash2, XCircle } from 'lucide-react';
import type { CreateNppCutPlanInput, GlassCutPieceInput, NppBarcodeSchemeItem, NppCutPlanItem, NppCutPlanSheet } from '@eurohouse/types';
import { apiGet, apiSend } from '../lib/api';
import { chipStyle, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, panelStyle, primaryButtonStyle, ui } from '../ui';
import type { GlassLabelData } from './GlassLabels';

type Props = {
  schemes: NppBarcodeSchemeItem[];
  /** Gọi sau khi chốt cắt để trang tải lại kho (đã trừ tấm, đã cộng tấm dư). */
  onStockChanged: () => void;
  onPrint: (labels: GlassLabelData[]) => void;
  labelSizeValid: boolean;
};

const STATUS_LABEL: Record<NppCutPlanItem['status'], string> = { DRAFT: 'Nháp', CONFIRMED: 'Đã chốt', CANCELLED: 'Đã hủy' };
const STATUS_TONE: Record<NppCutPlanItem['status'], 'warning' | 'success' | 'danger'> = { DRAFT: 'warning', CONFIRMED: 'success', CANCELLED: 'danger' };

function SheetDiagram({ sheet }: { sheet: NppCutPlanSheet }) {
  const fontSize = Math.max(sheet.widthMm, sheet.heightMm) / 30;
  return (
    <svg viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`} style={{ width: '100%', maxWidth: 520, maxHeight: 640, display: 'block', background: '#fff', border: `1px solid ${ui.borderStrong}` }} role="img" aria-label={`Sơ đồ cắt tấm ${sheet.sheetNo}`}>
      {sheet.placements.map((p) => (
        <g key={p.pieceNo}>
          <rect x={p.x} y={p.y} width={p.widthMm} height={p.heightMm} fill={ui.brandSoft} stroke={ui.brand} strokeWidth={Math.max(sheet.widthMm, sheet.heightMm) / 500} />
          <text x={p.x + p.widthMm / 2} y={p.y + p.heightMm / 2} textAnchor="middle" fontSize={fontSize} fontWeight={800} fill={ui.brandText}>
            <tspan x={p.x + p.widthMm / 2} dy="-0.2em">{p.pieceNo}{p.rotated ? ' ↻' : ''}</tspan>
            <tspan x={p.x + p.widthMm / 2} dy="1.1em" fontSize={fontSize * 0.7} fontWeight={600}>{p.widthMm}×{p.heightMm}</tspan>
          </text>
        </g>
      ))}
      {sheet.remnants.map((r, index) => (
        <g key={`r${index}`}>
          <rect x={r.x} y={r.y} width={r.widthMm} height={r.heightMm} fill="#eef7ee" stroke={ui.success} strokeDasharray={`${fontSize / 2} ${fontSize / 3}`} strokeWidth={Math.max(sheet.widthMm, sheet.heightMm) / 600} />
          <text x={r.x + r.widthMm / 2} y={r.y + r.heightMm / 2} textAnchor="middle" fontSize={fontSize * 0.75} fill={ui.success} fontWeight={700}>
            <tspan x={r.x + r.widthMm / 2} dy="-0.2em">Tấm dư</tspan>
            <tspan x={r.x + r.widthMm / 2} dy="1.1em">{r.widthMm}×{r.heightMm}</tspan>
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GlassCutPlanner({ schemes, onStockChanged, onPrint, labelSizeValid }: Props) {
  const activeSchemes = useMemo(() => schemes.filter((s) => s.active), [schemes]);
  const [schemeId, setSchemeId] = useState('');
  const [pieces, setPieces] = useState<Array<{ widthMm: string; heightMm: string; quantity: string }>>([{ widthMm: '600', heightMm: '900', quantity: '1' }]);
  const [options, setOptions] = useState({ kerfMm: '3', trimMm: '0', minRemnantMm: '300', allowRotation: true });
  const [orderRef, setOrderRef] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<NppCutPlanItem | null>(null);
  const [history, setHistory] = useState<NppCutPlanItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadHistory = useCallback(() => {
    apiGet<NppCutPlanItem[]>('/npp/glass/cut-plans').then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (!schemeId && activeSchemes.length) setSchemeId(activeSchemes[0].id);
  }, [activeSchemes, schemeId]);

  const schemeById = useMemo(() => new Map(schemes.map((s) => [s.id, s])), [schemes]);

  function fail(e: unknown, fallback: string) {
    setMessage('');
    setError(e instanceof Error ? e.message : fallback);
  }

  function updatePiece(index: number, key: 'widthMm' | 'heightMm' | 'quantity', value: string) {
    setPieces((current) => current.map((piece, i) => (i === index ? { ...piece, [key]: value } : piece)));
  }

  async function calculate() {
    setError('');
    setMessage('');
    setBusy(true);
    const body: CreateNppCutPlanInput = {
      schemeId,
      pieces: pieces.map((p): GlassCutPieceInput => ({ widthMm: Number(p.widthMm), heightMm: Number(p.heightMm), quantity: Number(p.quantity) })),
      options: { kerfMm: Number(options.kerfMm), trimMm: Number(options.trimMm), minRemnantMm: Number(options.minRemnantMm), allowRotation: options.allowRotation },
      orderRef,
      note,
    };
    try {
      setPlan(await apiSend<NppCutPlanItem>('/npp/glass/cut-plans', 'POST', body));
      loadHistory();
    } catch (e) {
      fail(e, 'Không tính được phương án cắt.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!plan) return;
    setError('');
    setBusy(true);
    try {
      const done = await apiSend<NppCutPlanItem>(`/npp/glass/cut-plans/${plan.id}/confirm`, 'POST');
      setPlan(done);
      setMessage('Đã chốt cắt: kho đã trừ tấm đã dùng và cộng tấm dư, tấm cắt.');
      onStockChanged();
      loadHistory();
    } catch (e) {
      fail(e, 'Không chốt được phương án cắt.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!plan) return;
    setError('');
    setBusy(true);
    try {
      setPlan(await apiSend<NppCutPlanItem>(`/npp/glass/cut-plans/${plan.id}/cancel`, 'POST'));
      setMessage('Đã hủy phương án nháp.');
      loadHistory();
    } catch (e) {
      fail(e, 'Không hủy được phương án.');
    } finally {
      setBusy(false);
    }
  }

  function printEffects(kind: 'remnants' | 'pieces') {
    if (!plan?.result.effects) return;
    const scheme = schemeById.get(plan.schemeId);
    const labels: GlassLabelData[] = [];
    for (const line of plan.result.effects[kind]) {
      for (let i = 0; i < Math.min(line.quantity, 500); i++) {
        labels.push({
          barcode: line.barcode,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          glassType: scheme?.glassType || undefined,
          location: kind === 'pieces' ? plan.orderRef || line.location || undefined : line.location || undefined,
          kindLabel: kind === 'remnants' ? 'Tấm dư' : 'Tấm cắt',
        });
      }
    }
    if (labels.length) onPrint(labels);
  }

  const unplaced = plan?.result.unplaced ?? [];
  const canConfirm = plan?.status === 'DRAFT' && unplaced.length === 0 && plan.result.sheets.length > 0;
  const remnantCount = plan?.result.effects?.remnants.reduce((n, l) => n + l.quantity, 0) ?? 0;
  const pieceCount = plan?.result.effects?.pieces.reduce((n, l) => n + l.quantity, 0) ?? 0;

  return (
    <section style={{ ...panelStyle, marginTop: 20 }}>
      <p style={{ ...eyebrowStyle, marginBottom: 6 }}>Cắt kính</p>
      <h2 style={{ margin: '0 0 6px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Scissors size={18} color={ui.brand} /> Tính hướng cắt và chốt cắt</h2>
      <p style={{ margin: '0 0 14px', color: ui.textMuted, fontSize: 13, lineHeight: 1.5 }}>Hệ thống ưu tiên dùng tấm dư trước, rồi mới mở tấm nguyên. Tính xong chỉ là bản nháp; bấm <strong>Chốt cắt</strong> mới trừ kho, cộng tấm dư và tấm cắt vào kho.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>Loại kính (mã đầu)
            <select style={inputStyle} value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
              {activeSchemes.map((s) => <option key={s.id} value={s.id}>{s.prefix} — {s.label || s.glassType || 'chưa mô tả'}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>Mã đơn / công trình<input style={inputStyle} value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="Không bắt buộc" /></label>
            <label style={labelStyle}>Ghi chú<input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <label style={labelStyle}>Lề cắt (mm)<input style={inputStyle} type="number" min="0" value={options.kerfMm} onChange={(e) => setOptions({ ...options, kerfMm: e.target.value })} /></label>
            <label style={labelStyle}>Mép bỏ (mm)<input style={inputStyle} type="number" min="0" value={options.trimMm} onChange={(e) => setOptions({ ...options, trimMm: e.target.value })} /></label>
            <label style={labelStyle}>Dư tối thiểu (mm)<input style={inputStyle} type="number" min="1" value={options.minRemnantMm} onChange={(e) => setOptions({ ...options, minRemnantMm: e.target.value })} /></label>
          </div>
          <label style={{ ...labelStyle, flexDirection: 'row', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={options.allowRotation} onChange={(e) => setOptions({ ...options, allowRotation: e.target.checked })} /> Cho xoay 90° (bỏ chọn nếu kính có vân)
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            {pieces.map((piece, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 36px', gap: 8, alignItems: 'end' }}>
                <label style={labelStyle}>Rộng (mm)<input style={inputStyle} type="number" min="1" value={piece.widthMm} onChange={(e) => updatePiece(index, 'widthMm', e.target.value)} /></label>
                <label style={labelStyle}>Cao (mm)<input style={inputStyle} type="number" min="1" value={piece.heightMm} onChange={(e) => updatePiece(index, 'heightMm', e.target.value)} /></label>
                <label style={labelStyle}>Số tấm<input style={inputStyle} type="number" min="1" value={piece.quantity} onChange={(e) => updatePiece(index, 'quantity', e.target.value)} /></label>
                <button type="button" aria-label="Xóa dòng" disabled={pieces.length === 1} onClick={() => setPieces((c) => c.filter((_, i) => i !== index))} style={{ ...ghostButtonStyle, padding: 8, opacity: pieces.length === 1 ? 0.4 : 1 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => setPieces((c) => [...c, { widthMm: '500', heightMm: '800', quantity: '1' }])} style={ghostButtonStyle}><Plus size={14} /> Thêm kích thước</button>
          <button onClick={calculate} disabled={busy || !schemeId} style={{ ...primaryButtonStyle, opacity: busy || !schemeId ? 0.6 : 1 }}><Scissors size={15} /> Tính hướng cắt</button>
          {!activeSchemes.length ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Cần có mã đầu đang dùng và kính trong kho để tính.</p> : null}
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', color: ui.text, fontSize: 14 }}>Phương án gần đây</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {history.slice(0, 6).map((item) => (
              <button key={item.id} onClick={() => { setPlan(item); setMessage(''); setError(''); }} style={{ ...ghostButtonStyle, justifyContent: 'space-between', background: plan?.id === item.id ? ui.brandSoft : ui.surface, textAlign: 'left' }}>
                <span>{item.schemePrefix} · {item.result.totals.sheetsUsed} tấm · {item.result.totals.piecesPlaced} miếng{item.orderRef ? ` · ${item.orderRef}` : ''}</span>
                <span style={chipStyle(STATUS_TONE[item.status])}>{STATUS_LABEL[item.status]}</span>
              </button>
            ))}
            {history.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Chưa có phương án nào.</p> : null}
          </div>
        </div>
      </div>

      {plan ? (
        <div style={{ marginTop: 20, borderTop: `1px solid ${ui.border}`, paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={chipStyle(STATUS_TONE[plan.status])}>{STATUS_LABEL[plan.status]}</span>
            <span style={{ color: ui.textMuted, fontSize: 14 }}>
              Dùng <strong style={{ color: ui.text }}>{plan.result.totals.sheetsUsed} tấm</strong> · xếp được <strong style={{ color: ui.text }}>{plan.result.totals.piecesPlaced} miếng</strong> · hao hụt <strong style={{ color: ui.text }}>{plan.result.totals.wastePercent}%</strong>
            </span>
            <span style={{ flex: 1 }} />
            {plan.status === 'DRAFT' ? (
              <>
                <button onClick={confirm} disabled={busy || !canConfirm} style={{ ...primaryButtonStyle, opacity: busy || !canConfirm ? 0.5 : 1 }}><CheckCircle2 size={15} /> Chốt cắt</button>
                <button onClick={cancel} disabled={busy} style={ghostButtonStyle}><XCircle size={14} /> Hủy nháp</button>
              </>
            ) : null}
            {plan.status === 'CONFIRMED' ? (
              <>
                <button onClick={() => printEffects('remnants')} disabled={!labelSizeValid || remnantCount === 0} style={{ ...ghostButtonStyle, opacity: labelSizeValid && remnantCount ? 1 : 0.5 }}><Printer size={14} /> In nhãn tấm dư ({remnantCount})</button>
                <button onClick={() => printEffects('pieces')} disabled={!labelSizeValid || pieceCount === 0} style={{ ...ghostButtonStyle, opacity: labelSizeValid && pieceCount ? 1 : 0.5 }}><Printer size={14} /> In nhãn tấm cắt ({pieceCount})</button>
              </>
            ) : null}
          </div>

          {unplaced.length ? (
            <p role="alert" style={{ color: ui.danger, fontWeight: 700, fontSize: 14 }}>
              Còn {unplaced.length} miếng chưa xếp được ({[...new Set(unplaced.map((u) => `${u.widthMm}×${u.heightMm}`))].join(', ')}): quá lớn hoặc kho không đủ kính. Sửa danh sách hoặc nhập thêm kính rồi tính lại; chưa chốt cắt được.
            </p>
          ) : null}
          {plan.result.sheets.length === 0 && !unplaced.length ? <p style={{ color: ui.textFaint, fontSize: 13 }}>Phương án không dùng tấm nào.</p> : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {plan.result.sheets.map((sheet) => (
              <div key={sheet.sheetNo}>
                <div style={{ fontSize: 13, color: ui.textMuted, marginBottom: 6, lineHeight: 1.4 }}>
                  <strong style={{ color: ui.text }}>Tấm {sheet.sheetNo}</strong> · {sheet.sourceKind === 'REMNANT' ? 'Tấm dư' : 'Tấm nguyên'} <span style={{ fontFamily: 'Consolas, monospace' }}>{sheet.sourceBarcode}</span>{sheet.sourceLocation ? ` · ${sheet.sourceLocation}` : ''} · hao hụt {sheet.wastePercent}%
                </div>
                <SheetDiagram sheet={sheet} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
