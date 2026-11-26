'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, FilePlus2, ImageUp, Plus, Save, Trash2, XCircle } from 'lucide-react';
import type {
  CatalogSystem,
  CreateOrderInput,
  DocumentDraftItem,
  DocumentDraftKind,
  DocumentDraftLine,
  DocumentDraftLineInput,
  DocumentServiceStatus,
  NppFactoryItem,
} from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiBlob, apiGet, apiSend } from '../../src/lib/api';
import { fileToJpegBase64 } from '../../src/lib/image';
import { chipStyle, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const COLORS = [
  { code: 'CAFE_METALIC', name: 'Cafe Metalic' },
  { code: 'CAFE_THUONG', name: 'Cafe thường' },
  { code: 'XAM_NGOC_TRAI', name: 'Xám Ngọc Trai' },
  { code: 'VAN_GO_CAM_LAI', name: 'Vân gỗ Cẩm Lai' },
  { code: 'VAN_GO_OLAK', name: 'Vân gỗ Olak' },
  { code: 'XAM_RITA', name: 'Xám Rita' },
];
const UNITS: Array<{ value: string; label: string }> = [{ value: '', label: '—' }, { value: 'BUNDLE', label: 'bó' }, { value: 'BAR', label: 'cây' }, { value: 'SET', label: 'bộ' }];
const KIND_LABEL: Record<DocumentDraftKind, string> = { ORDER: 'Đơn của thợ (viết tay)', RECEIPT: 'Phiếu nhập hàng (hóa đơn in)' };
const STATUS_LABEL = { DRAFT: 'Nháp', CONFIRMED: 'Đã chốt', REJECTED: 'Đã bỏ' } as const;
const STATUS_TONE = { DRAFT: 'warning', CONFIRMED: 'success', REJECTED: 'danger' } as const;
const CONF_TONE = { HIGH: 'success', MEDIUM: 'warning', LOW: 'danger', NONE: 'danger' } as const;
const CONF_LABEL = { HIGH: 'Chắc', MEDIUM: 'Nên xem lại', LOW: 'Chưa chắc', NONE: 'Chưa ghép' } as const;

type PickerProfile = { id: string; code: string; name: string; system: string };
type EditLine = DocumentDraftLine;

const optionLabel = (p: PickerProfile) => `${p.code} · ${p.name} (${p.system})`;

export default function NppDocumentsPage() {
  const [status, setStatus] = useState<DocumentServiceStatus | null>(null);
  const [drafts, setDrafts] = useState<DocumentDraftItem[]>([]);
  const [factories, setFactories] = useState<NppFactoryItem[]>([]);
  const [catalog, setCatalog] = useState<PickerProfile[]>([]);
  const [kind, setKind] = useState<DocumentDraftKind>('ORDER');
  const [factoryId, setFactoryId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<DocumentDraftItem | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const loadDrafts = useCallback(() => { apiGet<DocumentDraftItem[]>('/npp/documents').then(setDrafts).catch(() => setDrafts([])); }, []);

  useEffect(() => {
    apiGet<DocumentServiceStatus>('/npp/documents/status').then(setStatus).catch(() => setStatus(null));
    apiGet<NppFactoryItem[]>('/npp/factories').then((items) => { setFactories(items); setFactoryId((c) => c || items[0]?.id || ''); }).catch(() => setFactories([]));
    apiGet<CatalogSystem[]>('/catalog/systems').then((systems) => setCatalog(systems.flatMap((s) => s.profiles.map((p) => ({ id: p.id, code: p.code, name: p.name, system: s.code }))))).catch(() => setCatalog([]));
    loadDrafts();
  }, [loadDrafts]);

  const open = useCallback(async (id: string) => {
    setSelectedId(id);
    setError('');
    try {
      const item = await apiGet<DocumentDraftItem>(`/npp/documents/${id}`);
      setDraft(item);
      setLines(item.lines);
      setDirty(false);
      if (item.factoryOrgId) setFactoryId(item.factoryOrgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không mở được phiếu.');
    }
  }, []);

  useEffect(() => {
    let url = '';
    let cancelled = false;
    setImageUrl('');
    if (draft?.hasImage) {
      apiBlob(`/npp/documents/${draft.id}/image`).then((blob) => { if (!cancelled) { url = URL.createObjectURL(blob); setImageUrl(url); } }).catch(() => undefined);
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [draft?.id, draft?.hasImage]);

  function fail(e: unknown, fallback: string) {
    setMessage('');
    setError(e instanceof Error ? e.message : fallback);
  }

  async function createFromFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const image = await fileToJpegBase64(file);
      const created = await apiSend<DocumentDraftItem>('/npp/documents', 'POST', { kind, imageBase64: image.base64, mime: image.mime, ...(kind === 'ORDER' && factoryId ? { factoryOrgId: factoryId } : {}) });
      setMessage(created.lines.length ? `Đã đọc ${created.lines.length} dòng. Hãy xem lại từng dòng trước khi chốt.` : (created.note || 'Chưa đọc được dòng nào. Hãy nhập các dòng bằng tay.'));
      loadDrafts();
      await open(created.id);
    } catch (e) { fail(e, 'Không tạo được phiếu từ ảnh.'); } finally { setBusy(false); }
  }

  async function createBlank() {
    setError('');
    setBusy(true);
    try {
      const created = await apiSend<DocumentDraftItem>('/npp/documents', 'POST', { kind, groups: [{ heading: '', lines: [{ text: '', quantity: 1, unit: 'BUNDLE' }] }], ...(kind === 'ORDER' && factoryId ? { factoryOrgId: factoryId } : {}) });
      loadDrafts();
      await open(created.id);
    } catch (e) { fail(e, 'Không tạo được phiếu.'); } finally { setBusy(false); }
  }

  function patchLine(id: string, patch: Partial<EditLine>) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setDirty(true);
  }

  function pickProfile(id: string, text: string) {
    const match = catalog.find((p) => optionLabel(p) === text);
    if (match) patchLine(id, { profileId: match.id, profileCode: match.code, profileName: match.name, userChosen: true });
  }

  function addLine() {
    setLines((current) => [...current, { id: `new-${Date.now()}-${current.length}`, group: current[current.length - 1]?.group ?? '', text: '', quantity: 1, unit: 'BUNDLE', bars: null, colorCode: current[current.length - 1]?.colorCode ?? null, profileId: null, confidence: 'NONE', candidates: [], warnings: [], userChosen: false, removed: false }]);
    setDirty(true);
  }

  const toInput = (l: EditLine): DocumentDraftLineInput => ({
    id: l.id.startsWith('new-') ? undefined : l.id,
    group: l.group,
    text: l.text,
    quantity: l.quantity,
    unit: l.unit,
    removed: l.removed,
    colorCode: l.colorCode,
    ...(l.userChosen ? { profileId: l.profileId } : {}),
  });

  async function save(): Promise<DocumentDraftItem | null> {
    if (!draft) return null;
    setError('');
    setBusy(true);
    try {
      const updated = await apiSend<DocumentDraftItem>(`/npp/documents/${draft.id}/lines`, 'PUT', { lines: lines.map(toInput), factoryOrgId: draft.kind === 'ORDER' ? factoryId || null : undefined });
      setDraft(updated);
      setLines(updated.lines);
      setDirty(false);
      setMessage('Đã lưu và ghép lại. Các lựa chọn của anh được ghi nhớ cho lần sau.');
      loadDrafts();
      return updated;
    } catch (e) { fail(e, 'Không lưu được phiếu.'); return null; } finally { setBusy(false); }
  }

  async function confirmOrder() {
    const saved = dirty ? await save() : draft;
    if (!saved) return;
    setBusy(true);
    setError('');
    try {
      const input = await apiSend<CreateOrderInput>(`/npp/documents/${saved.id}/order-input`, 'POST');
      const order = await apiSend<{ code: string }>('/orders', 'POST', input);
      const done = await apiSend<DocumentDraftItem>(`/npp/documents/${saved.id}/confirm-order`, 'POST', { resultRef: order.code });
      setDraft(done);
      setMessage(`Đã tạo đơn ${order.code} cho thợ.`);
      loadDrafts();
    } catch (e) { fail(e, 'Không tạo được đơn.'); } finally { setBusy(false); }
  }

  async function confirmReceipt() {
    const saved = dirty ? await save() : draft;
    if (!saved) return;
    setBusy(true);
    setError('');
    try {
      const done = await apiSend<DocumentDraftItem>(`/npp/documents/${saved.id}/confirm-receipt`, 'POST');
      setDraft(done);
      setMessage(`${done.resultRef}. Kho nhôm của NPP đã được cộng.`);
      loadDrafts();
    } catch (e) { fail(e, 'Không nhập được kho.'); } finally { setBusy(false); }
  }

  async function reject() {
    if (!draft) return;
    setBusy(true);
    try {
      setDraft(await apiSend<DocumentDraftItem>(`/npp/documents/${draft.id}/reject`, 'POST'));
      setMessage('Đã bỏ phiếu này, kho và đơn hàng không thay đổi.');
      loadDrafts();
    } catch (e) { fail(e, 'Không bỏ được phiếu.'); } finally { setBusy(false); }
  }

  const editable = draft?.status === 'DRAFT';
  const activeCount = useMemo(() => lines.filter((l) => !l.removed).length, [lines]);
  const compact = { ...inputStyle, padding: '8px 10px', fontSize: 14 };

  return (
    <NppPage>
      <p style={eyebrowStyle}>Đọc phiếu</p>
      <h1 style={pageTitleStyle}>Đọc phiếu từ ảnh</h1>
      <p style={subtitleStyle}>Chụp đơn viết tay của thợ hoặc hóa đơn nhà cung cấp. Hệ thống đọc và gợi ý thanh nhôm; anh xem lại từng dòng, chốt thì mới tạo đơn hoặc nhập kho.</p>
      {status && !status.ocrConfigured ? (
        <p role="status" style={{ background: ui.warningSoft, color: ui.warning, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
          Chưa cài dịch vụ đọc ảnh tự động. Ảnh vẫn được lưu kèm phiếu; anh nhập các dòng bằng tay và hệ thống gợi ý thanh nhôm, ghi nhớ cách viết tắt của anh cho lần sau.
        </p>
      ) : null}
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><ImageUp size={18} color={ui.brand} /> Phiếu mới</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Loại phiếu
              <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as DocumentDraftKind)}>
                {(Object.keys(KIND_LABEL) as DocumentDraftKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            {kind === 'ORDER' ? (
              <label style={labelStyle}>Xưởng thợ gửi đơn
                <select style={inputStyle} value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
                  <option value="">Chọn xưởng thợ</option>
                  {factories.map((f) => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}
                </select>
              </label>
            ) : null}
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void createFromFile(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { void createFromFile(e.target.files?.[0]); e.target.value = ''; }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => cameraInput.current?.click()} disabled={busy} style={{ ...primaryButtonStyle, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}><Camera size={16} /> Chụp ảnh</button>
              <button onClick={() => fileInput.current?.click()} disabled={busy} style={{ ...ghostButtonStyle, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}><ImageUp size={15} /> Chọn ảnh</button>
            </div>
            <button onClick={() => void createBlank()} disabled={busy} style={{ ...ghostButtonStyle, justifyContent: 'center' }}><FilePlus2 size={15} /> Nhập tay (không ảnh)</button>
          </div>
          <h3 style={{ margin: '18px 0 8px', color: ui.text, fontSize: 14 }}>Phiếu gần đây</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {drafts.map((d) => (
              <button key={d.id} onClick={() => void open(d.id)} style={{ ...ghostButtonStyle, justifyContent: 'space-between', textAlign: 'left', background: selectedId === d.id ? ui.brandSoft : ui.surface }}>
                <span>{d.kind === 'ORDER' ? 'Đơn thợ' : 'Nhập hàng'} · {d.lines.filter((l) => !l.removed).length} dòng · {new Date(d.createdAt).toLocaleDateString('vi-VN')}{d.resultRef ? ` · ${d.resultRef}` : ''}</span>
                <span style={chipStyle(STATUS_TONE[d.status])}>{STATUS_LABEL[d.status]}</span>
              </button>
            ))}
            {drafts.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Chưa có phiếu nào.</p> : null}
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0, minWidth: 0 }}>
          {draft ? (
            <>
              <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong style={{ color: ui.text, fontSize: 16 }}>{KIND_LABEL[draft.kind]}</strong>
                <span style={chipStyle(STATUS_TONE[draft.status])}>{STATUS_LABEL[draft.status]}</span>
                <span style={{ color: ui.textMuted, fontSize: 13 }}>{draft.engine === 'manual' ? 'nhập tay' : `đọc bằng ${draft.engine}`} · {activeCount} dòng</span>
                {draft.resultRef ? <span style={{ color: ui.success, fontWeight: 700, fontSize: 13 }}>{draft.resultRef}</span> : null}
              </div>
              {draft.note ? <p style={{ margin: 0, padding: '10px 16px', background: ui.warningSoft, color: ui.warning, fontSize: 13, whiteSpace: 'pre-line' }}>{draft.note}</p> : null}

              <div style={{ display: 'grid', gridTemplateColumns: imageUrl ? 'minmax(160px, 240px) 1fr' : '1fr', gap: 0 }}>
                {imageUrl ? (
                  <div style={{ padding: 12, borderRight: `1px solid ${ui.border}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={imageUrl} target="_blank" rel="noreferrer"><img src={imageUrl} alt="Ảnh phiếu" style={{ width: '100%', borderRadius: 8, border: `1px solid ${ui.border}` }} /></a>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: ui.textFaint }}>Bấm vào ảnh để xem lớn và đối chiếu.</p>
                  </div>
                ) : null}
                <div style={{ overflowX: 'auto' }}>
                  <datalist id="catalog-options">{catalog.map((p) => <option key={p.id} value={optionLabel(p)} />)}</datalist>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead><tr>{['#', 'Chữ đọc được', 'SL', 'Đơn vị', 'Thanh nhôm', 'Màu', 'Số cây', ''].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.id} style={{ opacity: line.removed ? 0.45 : 1, background: !line.removed && !line.profileId ? ui.warningSoft : undefined }}>
                          <td style={tableCellStyle}>{index + 1}</td>
                          <td style={{ ...tableCellStyle, minWidth: 180 }}>
                            <input aria-label={`Dòng ${index + 1} chữ`} style={compact} disabled={!editable || line.removed} value={line.text} onChange={(e) => patchLine(line.id, { text: e.target.value, ...(line.userChosen ? {} : { profileId: line.profileId }) })} />
                            {line.group ? <div style={{ fontSize: 11, color: ui.textFaint, marginTop: 2 }}>Nhóm: {line.group}</div> : null}
                          </td>
                          <td style={tableCellStyle}><input aria-label={`Dòng ${index + 1} số lượng`} style={{ ...compact, width: 64 }} type="number" min="1" disabled={!editable || line.removed} value={line.quantity ?? ''} onChange={(e) => patchLine(line.id, { quantity: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                          <td style={tableCellStyle}>
                            <select aria-label={`Dòng ${index + 1} đơn vị`} style={{ ...compact, width: 76 }} disabled={!editable || line.removed} value={line.unit ?? ''} onChange={(e) => patchLine(line.id, { unit: (e.target.value || null) as EditLine['unit'] })}>
                              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </td>
                          <td style={{ ...tableCellStyle, minWidth: 220 }}>
                            <input aria-label={`Dòng ${index + 1} thanh nhôm`} list="catalog-options" style={compact} disabled={!editable || line.removed} placeholder="Gõ mã hoặc tên thanh…"
                              defaultValue={line.profileCode ? `${line.profileCode} · ${line.profileName}` : ''} key={`${line.id}-${line.profileId ?? 'none'}`}
                              onChange={(e) => { if (e.target.value === '') patchLine(line.id, { profileId: null, profileCode: undefined, profileName: undefined, userChosen: true }); else pickProfile(line.id, e.target.value); }} />
                            <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <span style={chipStyle(CONF_TONE[line.confidence])}>{line.userChosen ? 'Anh đã chọn' : CONF_LABEL[line.confidence]}</span>
                              {editable && !line.removed && line.profileId && !line.userChosen && line.confidence !== 'HIGH' ? (
                                <button type="button" onClick={() => patchLine(line.id, { userChosen: true })} style={{ ...ghostButtonStyle, padding: '2px 8px', fontSize: 12, color: ui.success, borderColor: ui.success }} title="Xác nhận đúng thanh này">Đúng</button>
                              ) : null}
                              {editable && !line.removed && !line.profileId ? line.candidates.slice(0, 3).map((c) => (
                                <button key={c.profileId} type="button" onClick={() => patchLine(line.id, { profileId: c.profileId, profileCode: c.code, profileName: c.name, userChosen: true })} style={{ ...ghostButtonStyle, padding: '2px 8px', fontSize: 12 }} title={`${c.name} (${c.systemCode})`}>{c.code} · {c.systemCode.replace('EU-', '')}</button>
                              )) : null}
                            </div>
                            {line.warnings.map((w) => <div key={w} style={{ fontSize: 11, color: ui.danger, marginTop: 2 }}>{w}</div>)}
                          </td>
                          <td style={tableCellStyle}>
                            <select aria-label={`Dòng ${index + 1} màu`} style={{ ...compact, width: 150 }} disabled={!editable || line.removed} value={line.colorCode ?? ''} onChange={(e) => patchLine(line.id, { colorCode: e.target.value || null })}>
                              <option value="">Chọn màu</option>
                              {COLORS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                          </td>
                          <td style={{ ...tableCellStyle, fontWeight: 800 }}>{line.bars ?? '—'}</td>
                          <td style={tableCellStyle}>
                            {editable ? <button aria-label={line.removed ? 'Khôi phục dòng' : 'Bỏ dòng'} onClick={() => patchLine(line.id, { removed: !line.removed })} style={{ ...ghostButtonStyle, padding: 6 }} title={line.removed ? 'Khôi phục dòng' : 'Bỏ dòng này'}>{line.removed ? <Plus size={14} /> : <Trash2 size={14} />}</button> : null}
                          </td>
                        </tr>
                      ))}
                      {lines.length === 0 ? <tr><td colSpan={8} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chưa có dòng nào. Bấm "Thêm dòng" để nhập.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {editable ? (
                <div style={{ padding: 16, borderTop: `1px solid ${ui.border}`, display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
                  <button onClick={addLine} style={ghostButtonStyle}><Plus size={14} /> Thêm dòng</button>
                  <button onClick={() => void save()} disabled={busy || !dirty} style={{ ...ghostButtonStyle, opacity: busy || !dirty ? 0.5 : 1 }}><Save size={14} /> Lưu và ghép lại</button>
                  <span style={{ flex: 1 }} />
                  {draft.kind === 'ORDER' ? (
                    <>
                      <label style={{ ...labelStyle, fontSize: 12 }}>Xưởng thợ
                        <select style={{ ...inputStyle, width: 220 }} value={factoryId} onChange={(e) => { setFactoryId(e.target.value); setDirty(true); }}>
                          <option value="">Chọn xưởng thợ</option>
                          {factories.map((f) => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}
                        </select>
                      </label>
                      <button onClick={() => void confirmOrder()} disabled={busy || !factoryId} style={{ ...primaryButtonStyle, opacity: busy || !factoryId ? 0.5 : 1 }}><CheckCircle2 size={15} /> Tạo đơn cho thợ</button>
                    </>
                  ) : (
                    <button onClick={() => void confirmReceipt()} disabled={busy} style={{ ...primaryButtonStyle, opacity: busy ? 0.5 : 1 }}><CheckCircle2 size={15} /> Nhập vào kho</button>
                  )}
                  <button onClick={() => void reject()} disabled={busy} style={ghostButtonStyle}><XCircle size={14} /> Bỏ phiếu</button>
                </div>
              ) : null}
            </>
          ) : (
            <p style={{ color: ui.textFaint, padding: 20, margin: 0, fontSize: 14 }}>Chụp ảnh hoặc chọn một phiếu gần đây để bắt đầu.</p>
          )}
        </section>
      </div>
    </NppPage>
  );
}
