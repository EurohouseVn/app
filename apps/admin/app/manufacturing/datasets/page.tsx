'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CopyPlus, Database, FileCheck2, RefreshCw, Send, ShieldCheck, Upload } from 'lucide-react';
import { AdminPage } from '../../../src/AdminPage';
import { apiGet, apiPatch, apiPost } from '../../../src/lib/api';
import { chipStyle, ghostButtonStyle, inputStyle, pageTitleStyle, panelStyle, primaryButtonStyle, tableCellStyle, tableHeadStyle, ui } from '../../../src/ui';

type Revision = { id: string; revisionNumber: number; versionTag: string; status: string; verificationStatus: string; verificationCoverage?: Record<string, unknown>; validationHash: string; reviewedAt?: string; releasedAt?: string };
type Dataset = { id: string; stableKey: string; name: string; verificationStatus: string; manufacturer?: { name: string }; revisions: Revision[] };
type RevisionDetail = Revision & {
  systems: unknown[];
  technicalSources: Array<{ id: string; sourceDocument: string; sourceRevision: string; sourceType: string; reviewState: string }>;
  ruleDefinitions: Array<{ id: string; ruleId: string; ruleVersion: string; reviewState: string }>;
  validationReport?: { diagnostics?: Array<{ code: string; severity: string; message: string }> };
};

const defaultImport = JSON.stringify({
  source: { sourceType: 'OFFICIAL_CATALOGUE', sourceDocument: '', sourceRevision: '', sourcePage: '', notes: '' },
  systems: [],
  compatibilityRules: [],
  hardwareItems: [],
  gasketItems: [],
  glassRules: [],
  finishCompatibilities: [],
  assemblyRules: [],
}, null, 2);

function toneForStatus(status: string) {
  if (['RELEASED', 'VERIFIED', 'APPROVED'].includes(status)) return 'success' as const;
  if (['REVIEW', 'IN_REVIEW'].includes(status)) return 'warning' as const;
  return 'brandBlack' as const;
}

export default function DatasetStudioPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [revision, setRevision] = useState<RevisionDetail | null>(null);
  const [importText, setImportText] = useState(defaultImport);
  const [notes, setNotes] = useState('');
  const [datasetForm, setDatasetForm] = useState({ stableKey: '', name: '', manufacturerCode: 'EUROHOUSE', manufacturerName: 'Eurohouse' });
  const [ruleForm, setRuleForm] = useState({ ruleId: '', ruleVersion: '1.0.0', systemStableKey: '', purpose: '', technicalJustification: '', effectiveRevision: '', sourceReference: '', constants: '{}', inputs: '{}', outputSemantics: '{}', implementation: '{}' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selected = useMemo(() => datasets.flatMap((dataset) => dataset.revisions.map((item) => ({ ...item, dataset }))).find((item) => item.id === selectedId), [datasets, selectedId]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const rows = await apiGet<Dataset[]>('/manufacturing/v2/dataset-studio/datasets');
      setDatasets(rows);
      setSelectedId((current) => current || rows[0]?.revisions[0]?.id || '');
      setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được dataset.'); }
    finally { setBusy(false); }
  }, []);

  const loadRevision = useCallback(async (id: string) => {
    if (!id) return setRevision(null);
    try { setRevision(await apiGet<RevisionDetail>(`/manufacturing/v2/dataset-studio/revisions/${id}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được revision.'); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadRevision(selectedId); }, [selectedId, loadRevision]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await action(); setMessage(success); await load(); await loadRevision(selectedId); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Thao tác thất bại.'); }
    finally { setBusy(false); }
  }

  return <AdminPage>
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <p style={{ margin: 0, color: ui.brandText, fontWeight: 800, fontSize: 12 }}>WORKSHOP OS V2.1</p>
        <h1 style={pageTitleStyle}>Dataset Studio</h1>
        <p style={{ margin: 0, color: ui.textMuted }}>Luồng kỹ thuật có kiểm soát: tạo revision, nhập dữ liệu, kiểm tra, review và release bất biến.</p>
      </header>

      {message && <div style={{ padding: 12, border: `1px solid ${ui.border}`, background: ui.surface, color: message.includes('thất bại') || message.includes('Lỗi') ? ui.danger : ui.text, borderRadius: 8 }}>{message}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 0.8fr) minmax(520px, 1.4fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
        <div style={panelStyle}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Tạo dataset</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <input style={inputStyle} placeholder="Stable key, ví dụ eurohouse-r18" value={datasetForm.stableKey} onChange={(event) => setDatasetForm({ ...datasetForm, stableKey: event.target.value })} />
            <input style={inputStyle} placeholder="Tên dataset" value={datasetForm.name} onChange={(event) => setDatasetForm({ ...datasetForm, name: event.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input style={inputStyle} placeholder="Mã hãng" value={datasetForm.manufacturerCode} onChange={(event) => setDatasetForm({ ...datasetForm, manufacturerCode: event.target.value })} />
              <input style={inputStyle} placeholder="Tên hãng" value={datasetForm.manufacturerName} onChange={(event) => setDatasetForm({ ...datasetForm, manufacturerName: event.target.value })} />
            </div>
            <button style={primaryButtonStyle} disabled={busy || !datasetForm.stableKey.trim() || !datasetForm.name.trim()} onClick={() => void run(() => apiPost('/manufacturing/v2/dataset-studio/datasets', datasetForm), 'Đã tạo dataset và DRAFT revision đầu tiên.')}><Database size={16} />Tạo dataset</button>
          </div>
        </div>
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}><Database size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Dataset</h2>
            <button title="Tải lại" style={ghostButtonStyle} onClick={() => void load()} disabled={busy}><RefreshCw size={16} /></button>
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {datasets.map((dataset) => <div key={dataset.id} style={{ borderTop: `1px solid ${ui.border}`, paddingTop: 12 }}>
              <strong>{dataset.name}</strong>
              <div style={{ color: ui.textMuted, fontSize: 12, margin: '4px 0 8px' }}>{dataset.manufacturer?.name || 'Chưa gán hãng'} · {dataset.stableKey}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {dataset.revisions.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ ...ghostButtonStyle, justifyContent: 'space-between', background: selectedId === item.id ? ui.brandSoft : ui.surface }}>
                  <span>R{item.revisionNumber} · {item.versionTag}</span><span style={chipStyle(toneForStatus(item.status))}>{item.status}</span>
                </button>)}
              </div>
            </div>)}
          </div>
        </div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div><h2 style={{ margin: 0, fontSize: 20 }}>{selected?.dataset.name || 'Chọn revision'}</h2><p style={{ margin: '6px 0 0', color: ui.textMuted }}>{selected ? `${selected.versionTag} · ${selected.status} · ${selected.verificationStatus}` : 'Chưa có dữ liệu'}</p></div>
              {selected && <button style={ghostButtonStyle} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/datasets/${selected.dataset.id}/revisions`, { versionTag: `draft-${Date.now()}`, fromRevisionId: selected.id }), 'Đã tạo DRAFT mới từ revision đang chọn.')}><CopyPlus size={16} />Tạo DRAFT</button>}
            </div>
            {revision && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, marginTop: 18 }}>
              {[['Hệ nhôm', revision.systems.length], ['Nguồn kỹ thuật', revision.technicalSources.length], ['Quy tắc', revision.ruleDefinitions.length]].map(([label, value]) => <div key={String(label)} style={{ padding: 14, background: ui.surfaceMuted, borderRadius: 8 }}><div style={{ color: ui.textMuted, fontSize: 12 }}>{label}</div><strong style={{ fontSize: 22 }}>{value}</strong></div>)}
            </div>}
          </div>

          {revision?.status === 'DRAFT' && <div style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Import dữ liệu có nguồn</h2>
            <textarea aria-label="JSON import" value={importText} onChange={(event) => setImportText(event.target.value)} style={{ ...inputStyle, minHeight: 260, fontFamily: 'Consolas, monospace', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={primaryButtonStyle} disabled={busy} onClick={() => void run(() => apiPatch(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/import`, JSON.parse(importText)), 'Đã nhập dữ liệu vào DRAFT.')}><Upload size={16} />Import</button>
              <button style={ghostButtonStyle} disabled={busy} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/validate`), 'Đã chạy validation.')}><FileCheck2 size={16} />Validate</button>
              <button style={ghostButtonStyle} disabled={busy} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/submit-review`, { notes }), 'Revision đã chuyển sang REVIEW.')}><Send size={16} />Gửi review</button>
            </div>
          </div>}

          {revision && ['DRAFT', 'REVIEW'].includes(revision.status) && revision.technicalSources.length > 0 && <div style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Rule provenance</h2>
            <p style={{ marginTop: -6, color: ui.textMuted, fontSize: 13 }}>Nguồn: {revision.technicalSources[0].sourceDocument} · {revision.technicalSources[0].sourceRevision || revision.technicalSources[0].sourceType}</p>
            {revision.status === 'DRAFT' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input style={inputStyle} placeholder="Rule ID" value={ruleForm.ruleId} onChange={(event) => setRuleForm({ ...ruleForm, ruleId: event.target.value })} />
              <input style={inputStyle} placeholder="Rule version" value={ruleForm.ruleVersion} onChange={(event) => setRuleForm({ ...ruleForm, ruleVersion: event.target.value })} />
            </div>
            <input style={{ ...inputStyle, marginTop: 10 }} placeholder="Mục đích rule" value={ruleForm.purpose} onChange={(event) => setRuleForm({ ...ruleForm, purpose: event.target.value })} />
            <input style={{ ...inputStyle, marginTop: 10 }} placeholder="Cơ sở kỹ thuật" value={ruleForm.technicalJustification} onChange={(event) => setRuleForm({ ...ruleForm, technicalJustification: event.target.value })} />
            <input style={{ ...inputStyle, marginTop: 10 }} placeholder="Revision hiệu lực" value={ruleForm.effectiveRevision} onChange={(event) => setRuleForm({ ...ruleForm, effectiveRevision: event.target.value })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <input style={inputStyle} placeholder="System stable key" value={ruleForm.systemStableKey} onChange={(event) => setRuleForm({ ...ruleForm, systemStableKey: event.target.value })} />
              <input style={inputStyle} placeholder="Nguồn: trang/mục/bản vẽ" value={ruleForm.sourceReference} onChange={(event) => setRuleForm({ ...ruleForm, sourceReference: event.target.value })} />
            </div>
            <textarea aria-label="Constants JSON" value={ruleForm.constants} onChange={(event) => setRuleForm({ ...ruleForm, constants: event.target.value })} style={{ ...inputStyle, minHeight: 80, marginTop: 10, fontFamily: 'Consolas, monospace' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 10 }}>
              {([['inputs', 'Inputs JSON'], ['outputSemantics', 'Output JSON'], ['implementation', 'Implementation JSON']] as const).map(([key, label]) => <textarea key={key} aria-label={label} value={ruleForm[key]} onChange={(event) => setRuleForm({ ...ruleForm, [key]: event.target.value })} style={{ ...inputStyle, minHeight: 110, fontFamily: 'Consolas, monospace' }} />)}
            </div>
            <button style={primaryButtonStyle} disabled={busy} onClick={() => void run(() => apiPost('/manufacturing/v2/rules', {
              datasetRevisionId: revision.id,
              technicalSourceId: revision.technicalSources[0].id,
              ruleId: ruleForm.ruleId,
              ruleVersion: ruleForm.ruleVersion,
              purpose: ruleForm.purpose,
              technicalJustification: ruleForm.technicalJustification,
              effectiveRevision: ruleForm.effectiveRevision,
              systemStableKey: ruleForm.systemStableKey,
              sourceReference: ruleForm.sourceReference,
              constants: JSON.parse(ruleForm.constants),
              inputs: JSON.parse(ruleForm.inputs),
              outputSemantics: JSON.parse(ruleForm.outputSemantics),
              implementation: JSON.parse(ruleForm.implementation),
            }), 'Đã tạo rule ở trạng thái UNREVIEWED.')}><FileCheck2 size={16} />Lưu rule</button>
            </>}
            {revision.ruleDefinitions.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
              {revision.ruleDefinitions.map((rule) => <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12, borderTop: `1px solid ${ui.border}` }}>
                <div><strong>{rule.ruleId}</strong><div style={{ color: ui.textMuted, fontSize: 12 }}>v{rule.ruleVersion} · {rule.reviewState}</div></div>
                {revision.status === 'REVIEW' && rule.reviewState !== 'APPROVED' && <button style={ghostButtonStyle} onClick={() => void run(() => apiPatch(`/manufacturing/v2/rules/${rule.id}/review`, { state: rule.reviewState === 'UNREVIEWED' ? 'IN_REVIEW' : 'APPROVED', notes }), rule.reviewState === 'UNREVIEWED' ? 'Rule đã vào IN_REVIEW.' : 'Rule đã được APPROVED.')}>
                  <ShieldCheck size={16} />{rule.reviewState === 'UNREVIEWED' ? 'Bắt đầu review' : 'Phê duyệt rule'}
                </button>}
              </div>)}
            </div>}
          </div>}

          {revision && ['REVIEW'].includes(revision.status) && <div style={panelStyle}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Review và phát hành</h2>
            <textarea placeholder="Ghi chú kỹ thuật bắt buộc" value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...inputStyle, minHeight: 90 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={ghostButtonStyle} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/review`, { notes }), 'Đã ghi nhận review kỹ thuật.')}><CheckCircle2 size={16} />Xác nhận review</button>
              <button style={primaryButtonStyle} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/release`, { notes }), 'Dataset revision đã RELEASED.')}><ShieldCheck size={16} />Release</button>
            </div>
          </div>}

          {revision && ['RELEASED', 'RETIRED'].includes(revision.status) && <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div><h2 style={{ margin: 0, fontSize: 18 }}>Dataset verification coverage</h2><p style={{ margin: '6px 0 0', color: ui.textMuted, fontSize: 13 }}>RELEASED không đồng nghĩa toàn hệ đã VERIFIED. Coverage cần đủ nguồn, mapping, rule và fixture thật.</p></div>
              <button style={primaryButtonStyle} onClick={() => void run(() => apiPost(`/manufacturing/v2/dataset-studio/revisions/${revision.id}/coverage`), 'Đã tính lại verification coverage.')}><FileCheck2 size={16} />Tính coverage</button>
            </div>
            <pre style={{ margin: '14px 0 0', padding: 12, background: ui.surfaceMuted, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(revision.verificationCoverage ?? { status: revision.verificationStatus, message: 'Chưa tính coverage.' }, null, 2)}</pre>
          </div>}

          {revision?.validationReport?.diagnostics?.length ? <div style={panelStyle}><h2 style={{ marginTop: 0, fontSize: 18 }}>Diagnostics</h2><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={tableHeadStyle}>Mã</th><th style={tableHeadStyle}>Mức</th><th style={tableHeadStyle}>Nội dung</th></tr></thead><tbody>{revision.validationReport.diagnostics.map((item, index) => <tr key={`${item.code}-${index}`}><td style={tableCellStyle}>{item.code}</td><td style={tableCellStyle}>{item.severity}</td><td style={tableCellStyle}>{item.message}</td></tr>)}</tbody></table></div> : null}
        </div>
      </section>
    </div>
  </AdminPage>;
}
