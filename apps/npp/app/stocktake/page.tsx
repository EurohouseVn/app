'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, RefreshCw, XCircle } from 'lucide-react';
import type { NppGlassStockKind, NppStocktakeItem, NppStocktakeSummary } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { chipStyle, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const KIND_LABEL: Record<NppGlassStockKind, string> = { SHEET: 'Tấm nguyên', REMNANT: 'Tấm dư', CUT_PIECE: 'Tấm cắt' };
const STATUS_LABEL = { OPEN: 'Đang đếm', APPLIED: 'Đã áp dụng', CANCELLED: 'Đã hủy' } as const;
const STATUS_TONE = { OPEN: 'warning', APPLIED: 'success', CANCELLED: 'danger' } as const;
const POLL_MS = 3000;

export default function NppStocktakePage() {
  const [list, setList] = useState<NppStocktakeItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [summary, setSummary] = useState<NppStocktakeSummary | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [zeroUnscanned, setZeroUnscanned] = useState(false);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadList = useCallback(() => {
    apiGet<NppStocktakeItem[]>('/npp/glass/stocktakes').then((items) => {
      setList(items);
      setSelectedId((current) => current || items.find((i) => i.status === 'OPEN')?.id || items[0]?.id || '');
    }).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được danh sách đợt kiểm kê.'));
  }, []);

  const loadSummary = useCallback((id: string) => {
    apiGet<NppStocktakeSummary>(`/npp/glass/stocktakes/${id}`).then(setSummary).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được đợt kiểm kê.'));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // Đợt đang mở: làm mới số đếm mỗi 3 giây để thấy các điện thoại quét gần như tức thì.
  useEffect(() => {
    if (!selectedId) { setSummary(null); return undefined; }
    loadSummary(selectedId);
    const timer = window.setInterval(() => { if (!document.hidden) loadSummary(selectedId); }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [selectedId, loadSummary]);

  function fail(e: unknown, fallback: string) {
    setMessage('');
    setError(e instanceof Error ? e.message : fallback);
  }

  async function create() {
    setError('');
    setBusy(true);
    try {
      const created = await apiSend<NppStocktakeItem>('/npp/glass/stocktakes', 'POST', { name: name.trim() || `Kiểm kê ${new Date().toLocaleDateString('vi-VN')}`, location: location.trim() });
      setMessage('Đã mở đợt kiểm kê. Mở trang Quét mã trên điện thoại, chọn tab Kiểm kê và đợt này để bắt đầu đếm.');
      setName('');
      setSelectedId(created.id);
      loadList();
    } catch (e) { fail(e, 'Không mở được đợt kiểm kê.'); } finally { setBusy(false); }
  }

  async function apply() {
    if (!summary) return;
    setError('');
    setBusy(true);
    try {
      setSummary(await apiSend<NppStocktakeSummary>(`/npp/glass/stocktakes/${summary.id}/apply`, 'POST', { zeroUnscanned }));
      setMessage('Đã áp dụng: kho đã được đưa về số đã đếm.');
      loadList();
    } catch (e) { fail(e, 'Không áp dụng được đợt kiểm kê.'); } finally { setBusy(false); }
  }

  async function cancel() {
    if (!summary) return;
    setError('');
    setBusy(true);
    try {
      await apiSend(`/npp/glass/stocktakes/${summary.id}/cancel`, 'POST');
      setMessage('Đã hủy đợt kiểm kê, kho không thay đổi.');
      loadList();
      loadSummary(summary.id);
    } catch (e) { fail(e, 'Không hủy được đợt kiểm kê.'); } finally { setBusy(false); }
  }

  const lines = (summary?.lines ?? []).filter((line) => !onlyDifferences || (line.scanned ? line.delta !== 0 : zeroUnscanned && line.system !== 0));
  const unscannedCount = summary?.lines.filter((l) => !l.scanned && l.system > 0).length ?? 0;
  const open = summary?.status === 'OPEN';

  return (
    <NppPage>
      <p style={eyebrowStyle}>Kiểm kê</p>
      <h1 style={pageTitleStyle}>Kiểm kê kính bằng điện thoại</h1>
      <p style={subtitleStyle}>Mở một đợt, nhiều điện thoại cùng quét nhãn mã vạch, số đếm hiện ở đây gần như tức thì. Kho chỉ đổi khi anh bấm Áp dụng.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Plus size={18} color={ui.brand} /> Mở đợt kiểm kê</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Tên đợt<input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Kiểm kê ${new Date().toLocaleDateString('vi-VN')}`} /></label>
            <label style={labelStyle}>Vị trí (để trống: cả kho)<input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kệ A1" /></label>
            <button onClick={() => void create()} disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.6 : 1 }}><ClipboardCheck size={15} /> Mở đợt</button>
          </div>
          <h3 style={{ margin: '18px 0 8px', color: ui.text, fontSize: 14 }}>Các đợt gần đây</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {list.map((item) => (
              <button key={item.id} onClick={() => { setSelectedId(item.id); setMessage(''); setError(''); }} style={{ ...ghostButtonStyle, justifyContent: 'space-between', textAlign: 'left', background: selectedId === item.id ? ui.brandSoft : ui.surface }}>
                <span>{item.name || 'Đợt kiểm kê'}{item.location ? ` · ${item.location}` : ' · cả kho'}</span>
                <span style={chipStyle(STATUS_TONE[item.status])}>{STATUS_LABEL[item.status]}</span>
              </button>
            ))}
            {list.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Chưa có đợt kiểm kê nào.</p> : null}
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0 }}>
          {summary ? (
            <>
              <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: ui.text, fontSize: 16 }}>{summary.name || 'Đợt kiểm kê'}{summary.location ? ` · ${summary.location}` : ' · cả kho'}</strong>
                <span style={chipStyle(STATUS_TONE[summary.status])}>{STATUS_LABEL[summary.status]}</span>
                <span style={{ color: ui.textMuted, fontSize: 13 }}>{summary.scanCount} lần quét · {summary.deviceCount} điện thoại · {summary.differenceCount} dòng lệch</span>
                {open ? <span style={{ color: ui.textFaint, fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}><RefreshCw size={12} /> tự cập nhật mỗi 3 giây</span> : null}
              </div>
              <div style={{ padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', borderBottom: `1px solid ${ui.border}` }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: ui.textMuted }}><input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} /> Chỉ hiện dòng lệch</label>
                {open ? (
                  <>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: ui.textMuted }}>
                      <input type="checkbox" checked={zeroUnscanned} onChange={(e) => setZeroUnscanned(e.target.checked)} /> Dòng chưa quét coi như 0 ({unscannedCount} dòng)
                    </label>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => void apply()} disabled={busy || summary.scanCount === 0} style={{ ...primaryButtonStyle, opacity: busy || summary.scanCount === 0 ? 0.5 : 1 }}><CheckCircle2 size={15} /> Áp dụng vào kho</button>
                    <button onClick={() => void cancel()} disabled={busy} style={ghostButtonStyle}><XCircle size={14} /> Hủy đợt</button>
                  </>
                ) : null}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Mã vạch', 'Loại', 'Vị trí', 'Hệ thống', 'Đã đếm', 'Chênh lệch'].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={`${line.barcode}|${line.kind}|${line.location}`} style={{ background: line.scanned && line.delta !== 0 ? ui.warningSoft : undefined }}>
                        <td style={{ ...tableCellStyle, fontWeight: 800, fontFamily: 'Consolas, monospace' }}>{line.barcode}</td>
                        <td style={tableCellStyle}>{KIND_LABEL[line.kind]}</td>
                        <td style={tableCellStyle}>{line.location || '-'}</td>
                        <td style={tableCellStyle}>{line.system}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 700 }}>{line.scanned ? line.counted : <span style={{ color: ui.textFaint }}>chưa quét</span>}</td>
                        <td style={tableCellStyle}>{line.scanned ? <span style={{ color: line.delta === 0 ? ui.success : ui.danger, fontWeight: 800 }}>{line.delta > 0 ? `+${line.delta}` : line.delta}</span> : '-'}</td>
                      </tr>
                    ))}
                    {lines.length === 0 ? <tr><td colSpan={6} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>{summary.scanCount === 0 ? 'Chưa có lần quét nào. Dùng điện thoại quét nhãn để bắt đầu.' : 'Không có dòng nào.'}</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p style={{ color: ui.textFaint, padding: 20, margin: 0, fontSize: 14 }}>Chọn hoặc mở một đợt kiểm kê.</p>
          )}
        </section>
      </div>
    </NppPage>
  );
}
