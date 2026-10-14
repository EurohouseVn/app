'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, DatabaseZap, Download, FileCheck2, FlaskConical, GitCompareArrows, RefreshCw, ShieldAlert } from 'lucide-react';
import { AdminPage } from '../../../src/AdminPage';
import { apiGet, apiPatch, apiPost } from '../../../src/lib/api';
import { chipStyle, ghostButtonStyle, inputStyle, pageTitleStyle, panelStyle, primaryButtonStyle, tableCellStyle, tableHeadStyle, ui } from '../../../src/ui';

type ExpectedRevision = { id: string; revisionNumber: number; status: string; output: unknown; contentHash: string; technicalSourceId: string; datasetRevisionId: string };
type TechnicalSource = { id: string; sourceType: string; sourceDocument: string; sourceRevision: string; sourcePage: string; sourceHash: string; reviewState: string; reviewedAt?: string; technicalOwner: string };
type Difference = { id: string; field: string; classification: string; approvedExpected?: unknown; legacyValue?: unknown; v2Value?: unknown; reason: string; resolution: string; technicalIssue?: { status: string } };
type Comparison = { id: string; fixtureId?: string; kind: string; leftLabel: string; rightLabel: string; leftOutput: unknown; rightOutput: unknown; technicalTruthOutput?: unknown; status: string; createdAt: string; differences: Difference[] };
type Fixture = {
  id: string; fixtureId: string; name: string; systemStableKey: string; status: string; evidenceKind: string; approvalTimestamp?: string;
  datasetRevisionId?: string; technicalSourceId?: string; actualOutput?: unknown; reviewChecks?: Record<string, boolean>;
  datasetRevision?: { id: string; versionTag: string; status: string; verificationStatus: string };
  technicalSource?: TechnicalSource;
  expectedOutputRevisions: ExpectedRevision[];
  technicalIssues: Array<{ id: string; status: string; title: string }>;
  comparisons: Array<{ id: string; kind: string; status: string; createdAt: string }>;
};

const sourceTypes = ['OFFICIAL_CATALOGUE', 'PROFILE_DRAWING', 'SYSTEM_DRAWING', 'FABRICATION_DRAWING', 'CUTTING_FORMULA', 'HARDWARE_SPECIFICATION', 'GLASS_SPECIFICATION', 'PRODUCTION_CUTTING_SHEET', 'TECHNICAL_BULLETIN', 'ENGINEERING_CONFIRMATION', 'SIGNED_TECHNICAL_CONFIRMATION'];
const reviewChecks = ['topology', 'materialRoles', 'profileIdentity', 'profileQuantity', 'cutDimensions', 'cuttingAngles', 'machining', 'glass', 'gasket', 'hardware', 'bom', 'traceProvenance'];
const expectedSkeleton = JSON.stringify({
  topology: {},
  profiles: [], quantities: [], cuttingLengths: [], cuttingAngles: [], machining: [], glass: [], gaskets: [], hardware: [], accessories: [], bom: [], cuttingRequirements: [],
  applicability: { profiles: true, quantities: true, cuttingLengths: true, cuttingAngles: true, machining: true, glass: true, gaskets: true, hardware: true, accessories: true, bom: true, cuttingRequirements: true },
  notApplicableReasons: {},
}, null, 2);
const realFixtureSkeleton = JSON.stringify({
  fixtureId: '', name: '', doorDesignRevisionId: '', datasetRevisionId: '', technicalSourceId: '', evidenceKind: 'REAL_MANUFACTURED',
  doorWindowType: '', systemStableKey: '', dimensions: { widthMm: null, heightMm: null },
  openingTopology: { openingMechanism: '', leafCount: null, fixedPanels: [], mullionTransomArrangement: '', glassConfiguration: '', hardwareConfiguration: '' },
  referenceImageObjectId: '', profileRoleMapping: {}, expectedProfileIdentities: [], expectedCuttingLengths: [], expectedCuttingAngles: [], expectedGlass: [], expectedGasket: [], expectedHardware: [], expectedAccessories: [], expectedBom: [], expectedCuttingRequirements: [], candidateDesign: {}, notes: '',
}, null, 2);

function tone(status: string) {
  if (['VERIFIED', 'MATCH', 'APPROVED', 'V2_MATCH_TECHNICAL', 'BOTH_MATCH', 'RESOLVED'].includes(status)) return 'success' as const;
  if (['REJECTED', 'UNEXPLAINED_DIFFERENCE', 'NOT_COMPARABLE', 'BOTH_DIFFER', 'LEGACY_MATCH_TECHNICAL', 'MISSING_TECHNICAL_TRUTH', 'OPEN'].includes(status)) return 'danger' as const;
  if (['TECHNICAL_REVIEW', 'CALCULATED', 'REVIEW', 'IN_REVIEW', 'PARTIALLY_VERIFIED'].includes(status)) return 'warning' as const;
  return 'brandBlack' as const;
}

function jsonText(value: unknown) { return value === undefined ? 'Chưa có dữ liệu' : JSON.stringify(value, null, 2); }

export default function VerificationPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [sources, setSources] = useState<TechnicalSource[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [expectedJson, setExpectedJson] = useState(expectedSkeleton);
  const [realFixtureJson, setRealFixtureJson] = useState(realFixtureSkeleton);
  const [legacyJson, setLegacyJson] = useState('{}');
  const [resolution, setResolution] = useState('');
  const [resolutionSourceId, setResolutionSourceId] = useState('');
  const [sourceForm, setSourceForm] = useState({ sourceType: 'OFFICIAL_CATALOGUE', sourceDocument: '', sourceRevision: '', sourcePage: '', sourceHash: '', technicalOwner: '', notes: '' });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [fixtureRows, comparisonRows, sourceRows] = await Promise.all([
        apiGet<Fixture[]>('/manufacturing/v2/verification/fixtures'),
        apiGet<Comparison[]>('/manufacturing/v2/verification/comparisons'),
        apiGet<TechnicalSource[]>('/manufacturing/v2/technical-sources'),
      ]);
      setFixtures(fixtureRows); setComparisons(comparisonRows); setSources(sourceRows);
      setSelectedId((current) => current || fixtureRows[0]?.id || ''); setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được dữ liệu xác minh.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selected = fixtures.find((item) => item.id === selectedId);
  const approvedExpected = selected?.expectedOutputRevisions.find((item) => item.status === 'APPROVED');
  const selectedComparison = comparisons.find((item) => item.fixtureId === selectedId && item.kind === 'TECHNICAL_TRUTH_THREE_WAY');
  const stats = useMemo(() => ({
    total: fixtures.length,
    real: fixtures.filter((item) => item.evidenceKind === 'REAL_MANUFACTURED').length,
    verified: fixtures.filter((item) => item.status === 'VERIFIED').length,
    unresolved: comparisons.filter((item) => ['UNEXPLAINED_DIFFERENCE', 'NOT_COMPARABLE'].includes(item.status)).length,
  }), [fixtures, comparisons]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await action(); setMessage(success); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Thao tác thất bại.'); }
    finally { setBusy(false); }
  }

  function bootstrap() { return run(() => apiPost('/manufacturing/v2/verification/fixtures/bootstrap-candidates'), 'Đã đồng bộ candidate tổng hợp. Các candidate này không đủ điều kiện VERIFIED.'); }
  function createSource() { return run(() => apiPost('/manufacturing/v2/technical-sources', sourceForm), 'Đã ghi nhận nguồn kỹ thuật ở trạng thái UNREVIEWED.'); }
  function reviewSource(id: string, state: string) { return run(() => apiPatch(`/manufacturing/v2/technical-sources/${id}/review`, { state, notes: notes || `Technical source ${state}.` }), `Đã chuyển nguồn sang ${state}.`); }
  function createExpected() {
    if (!selected) return;
    const sourceId = resolutionSourceId || selected.technicalSourceId || sources.find((item) => item.reviewState === 'APPROVED')?.id || '';
    return run(() => apiPost(`/manufacturing/v2/verification/fixtures/${selected.id}/expected-output-revisions`, { output: JSON.parse(expectedJson), technicalSourceId: sourceId, datasetRevisionId: selected.datasetRevisionId, technicalNotes: notes, ruleRecordIds: [] }), 'Đã tạo expected output DRAFT từ dữ liệu nhập thủ công.');
  }
  function createRealFixture() { return run(() => apiPost('/manufacturing/v2/verification/fixtures', JSON.parse(realFixtureJson)), 'Đã tạo fixture thực ở trạng thái CANDIDATE. Expected output vẫn phải nhập độc lập.'); }
  function expectedAction(id: string, action: 'submit-review' | 'approve') { return run(() => apiPost(`/manufacturing/v2/verification/expected-output-revisions/${id}/${action}`, { notes }), `Expected output đã ${action === 'approve' ? 'được duyệt' : 'chuyển review'}.`); }
  function calculate() { if (selected) return run(() => apiPost(`/manufacturing/v2/verification/fixtures/${selected.id}/calculate`), 'Đã tính V2 và lưu trace.'); }
  function compareTechnical() {
    if (!selected || !approvedExpected || !selected.actualOutput) return;
    return run(() => apiPost('/manufacturing/v2/verification/comparisons/technical-truth', { fixtureId: selected.id, expectedOutputRevisionId: approvedExpected.id, legacyOutput: JSON.parse(legacyJson), v2Output: selected.actualOutput }), 'Đã so sánh Technical Truth, Legacy và V2.');
  }
  function submitFixture() { if (selected) return run(() => apiPost(`/manufacturing/v2/verification/fixtures/${selected.id}/submit-review`, { reviewChecks: checks, notes }), 'Fixture đã chuyển vào technical review.'); }
  function approveFixture() { if (selected) return run(() => apiPost(`/manufacturing/v2/verification/fixtures/${selected.id}/approve`, { notes }), 'Fixture đã được đóng băng thành VERIFIED.'); }
  function rejectFixture() { if (selected) return run(() => apiPost(`/manufacturing/v2/verification/fixtures/${selected.id}/reject`, { reason: notes }), 'Fixture đã bị từ chối.'); }
  function resolveDifference(id: string) { return run(() => apiPatch(`/manufacturing/v2/verification/differences/${id}/resolve-technical`, { resolution, technicalSourceId: resolutionSourceId, resolved: true }), 'Đã ghi nhận phương án xử lý. Cần sửa rule/data và chạy lại comparison trước khi VERIFY.'); }

  return <AdminPage><div style={{ display: 'grid', gap: 18 }}>
    <header><p style={{ margin: 0, color: ui.brandText, fontWeight: 800, fontSize: 12 }}>PHASE 1.1 TECHNICAL TRUTH</p><h1 style={pageTitleStyle}>Xác minh kỹ thuật Eurohouse</h1><p style={{ margin: 0, color: ui.textMuted }}>Expected output phải do kỹ thuật nhập và duyệt độc lập. V2 không được tự tạo đáp án chuẩn cho chính nó.</p><a href="/templates/EUROHOUSE_TECHNICAL_INPUT_TEMPLATES.xlsx" download style={{ ...ghostButtonStyle, display: 'inline-flex', marginTop: 10, textDecoration: 'none' }}><Download size={16} />Tải biểu mẫu kỹ thuật</a></header>
    {message && <div style={{ padding: 12, border: `1px solid ${ui.border}`, borderRadius: 8, background: ui.surface, color: message.includes('lỗi') || message.includes('thất bại') ? ui.danger : ui.text }}>{message}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
      {[['Tổng fixture', stats.total], ['Fixture thực', stats.real], ['VERIFIED', stats.verified], ['Comparison bị chặn', stats.unresolved]].map(([label, value]) => <div key={String(label)} style={{ ...panelStyle, padding: 16 }}><div style={{ color: ui.textMuted, fontSize: 12 }}>{label}</div><strong style={{ fontSize: 26 }}>{value}</strong></div>)}
    </div>

    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 18 }}><FileCheck2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Nguồn kỹ thuật</h2><button style={ghostButtonStyle} title="Tải lại" onClick={() => void load()}><RefreshCw size={16} /></button></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <select style={inputStyle} value={sourceForm.sourceType} onChange={(event) => setSourceForm({ ...sourceForm, sourceType: event.target.value })}>{sourceTypes.map((item) => <option key={item}>{item}</option>)}</select>
        <input style={inputStyle} placeholder="Tên tài liệu bắt buộc" value={sourceForm.sourceDocument} onChange={(event) => setSourceForm({ ...sourceForm, sourceDocument: event.target.value })} />
        <input style={inputStyle} placeholder="Revision/ngày" value={sourceForm.sourceRevision} onChange={(event) => setSourceForm({ ...sourceForm, sourceRevision: event.target.value })} />
        <input style={inputStyle} placeholder="Trang/tham chiếu" value={sourceForm.sourcePage} onChange={(event) => setSourceForm({ ...sourceForm, sourcePage: event.target.value })} />
        <input style={{ ...inputStyle, gridColumn: 'span 2' }} placeholder="SHA-256 file" value={sourceForm.sourceHash} onChange={(event) => setSourceForm({ ...sourceForm, sourceHash: event.target.value })} />
        <input style={inputStyle} placeholder="Chủ sở hữu kỹ thuật" value={sourceForm.technicalOwner} onChange={(event) => setSourceForm({ ...sourceForm, technicalOwner: event.target.value })} />
        <button style={primaryButtonStyle} disabled={busy || !sourceForm.sourceDocument.trim()} onClick={() => void createSource()}><DatabaseZap size={16} />Ghi nhận nguồn</button>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={tableHeadStyle}>Tài liệu</th><th style={tableHeadStyle}>Loại</th><th style={tableHeadStyle}>Revision / trang</th><th style={tableHeadStyle}>Hash</th><th style={tableHeadStyle}>Trạng thái</th><th style={tableHeadStyle}>Duyệt</th></tr></thead><tbody>{sources.map((source) => <tr key={source.id}><td style={tableCellStyle}><strong>{source.sourceDocument}</strong><div style={{ fontSize: 11, color: ui.textMuted }}>{source.technicalOwner || 'Chưa gán technical owner'}</div></td><td style={tableCellStyle}>{source.sourceType}</td><td style={tableCellStyle}>{source.sourceRevision || '-'} / {source.sourcePage || '-'}</td><td style={{ ...tableCellStyle, fontFamily: 'monospace', fontSize: 11 }}>{source.sourceHash ? `${source.sourceHash.slice(0, 12)}...` : 'Chưa có'}</td><td style={tableCellStyle}><span style={chipStyle(tone(source.reviewState))}>{source.reviewState}</span></td><td style={tableCellStyle}><div style={{ display: 'flex', gap: 6 }}><button style={ghostButtonStyle} onClick={() => void reviewSource(source.id, 'IN_REVIEW')}>Review</button><button style={ghostButtonStyle} onClick={() => void reviewSource(source.id, 'APPROVED')}>Approve</button></div></td></tr>)}</tbody></table></div>
    </section>

    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><h2 style={{ margin: 0, fontSize: 18 }}><FlaskConical size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Fixture thực và candidate</h2><button style={primaryButtonStyle} disabled={busy} onClick={() => void bootstrap()}><BadgeCheck size={16} />Đồng bộ 12 candidate</button></div>
      <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Nhập fixture sản xuất thực</summary><textarea aria-label="Real fixture JSON" style={{ ...inputStyle, width: '100%', minHeight: 230, marginTop: 10, fontFamily: 'monospace', fontSize: 12 }} value={realFixtureJson} onChange={(event) => setRealFixtureJson(event.target.value)} /><button style={{ ...primaryButtonStyle, marginTop: 8 }} onClick={() => void createRealFixture()}>Tạo fixture thực</button></details>
      <div style={{ overflowX: 'auto', marginTop: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={tableHeadStyle}>Fixture</th><th style={tableHeadStyle}>Nguồn gốc</th><th style={tableHeadStyle}>Hệ</th><th style={tableHeadStyle}>Dataset</th><th style={tableHeadStyle}>Expected</th><th style={tableHeadStyle}>Trạng thái</th></tr></thead><tbody>{fixtures.map((item) => <tr key={item.id} onClick={() => { setSelectedId(item.id); setChecks(item.reviewChecks ?? {}); }} style={{ cursor: 'pointer', background: selectedId === item.id ? ui.surfaceMuted : undefined }}><td style={tableCellStyle}><strong>{item.name}</strong><div style={{ color: ui.textMuted, fontSize: 11 }}>{item.fixtureId}</div></td><td style={tableCellStyle}>{item.evidenceKind}</td><td style={tableCellStyle}>{item.systemStableKey}</td><td style={tableCellStyle}>{item.datasetRevision ? `${item.datasetRevision.versionTag} · ${item.datasetRevision.status}` : 'Chưa gắn'}</td><td style={tableCellStyle}>{item.expectedOutputRevisions[0] ? `R${item.expectedOutputRevisions[0].revisionNumber} · ${item.expectedOutputRevisions[0].status}` : 'Chưa nhập'}</td><td style={tableCellStyle}><span style={chipStyle(tone(item.status))}>{item.status}</span></td></tr>)}</tbody></table></div>
    </section>

    {selected && <>
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{selected.name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={{ fontWeight: 700, fontSize: 13 }}>Expected output nhập thủ công</label><textarea style={{ ...inputStyle, width: '100%', minHeight: 280, marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} value={expectedJson} onChange={(event) => setExpectedJson(event.target.value)} /><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}><select style={inputStyle} value={resolutionSourceId} onChange={(event) => setResolutionSourceId(event.target.value)}><option value="">Chọn nguồn kỹ thuật</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.sourceDocument} · {source.reviewState}</option>)}</select><button style={primaryButtonStyle} disabled={busy || selected.evidenceKind !== 'REAL_MANUFACTURED'} onClick={() => void createExpected()}>Tạo expected revision</button></div></div>
          <div><label style={{ fontWeight: 700, fontSize: 13 }}>Ghi chú/reason bắt buộc</label><textarea style={{ ...inputStyle, width: '100%', minHeight: 94, marginTop: 6 }} value={notes} onChange={(event) => setNotes(event.target.value)} /><div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{selected.expectedOutputRevisions[0]?.status === 'DRAFT' && <button style={ghostButtonStyle} onClick={() => void expectedAction(selected.expectedOutputRevisions[0].id, 'submit-review')}>Chuyển expected sang review</button>}{selected.expectedOutputRevisions[0]?.status === 'REVIEW' && <button style={primaryButtonStyle} onClick={() => void expectedAction(selected.expectedOutputRevisions[0].id, 'approve')}>Duyệt expected output</button>}<button style={ghostButtonStyle} onClick={() => void calculate()}>Tính V2</button></div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>{reviewChecks.map((key) => <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}><input type="checkbox" checked={Boolean(checks[key])} onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })} />{key}</label>)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><button style={ghostButtonStyle} onClick={() => void submitFixture()}>Gửi technical review</button><button style={primaryButtonStyle} onClick={() => void approveFixture()}><BadgeCheck size={16} />VERIFY fixture</button><button style={ghostButtonStyle} onClick={() => void rejectFixture()}>Từ chối</button></div>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}><GitCompareArrows size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Technical Truth vs Legacy vs V2</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
          <div><strong>APPROVED TECHNICAL EXPECTED</strong><pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 340, padding: 10, background: ui.surfaceMuted, fontSize: 11 }}>{jsonText(approvedExpected?.output)}</pre></div>
          <div><strong>LEGACY</strong><textarea style={{ ...inputStyle, width: '100%', minHeight: 340, marginTop: 8, fontFamily: 'monospace', fontSize: 11 }} value={legacyJson} onChange={(event) => setLegacyJson(event.target.value)} /></div>
          <div><strong>V2</strong><pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 340, padding: 10, background: ui.surfaceMuted, fontSize: 11 }}>{jsonText(selected.actualOutput)}</pre></div>
        </div>
        <button style={{ ...primaryButtonStyle, marginTop: 10 }} disabled={!approvedExpected || !selected.actualOutput} onClick={() => void compareTechnical()}><GitCompareArrows size={16} />Chạy so sánh ba phía</button>
        {selectedComparison && <div style={{ marginTop: 14 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong>Kết quả mới nhất</strong><span style={chipStyle(tone(selectedComparison.status))}>{selectedComparison.status}</span></div><div style={{ overflowX: 'auto', marginTop: 8 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={tableHeadStyle}>Trường</th><th style={tableHeadStyle}>Expected</th><th style={tableHeadStyle}>Legacy</th><th style={tableHeadStyle}>V2</th><th style={tableHeadStyle}>Phân loại</th><th style={tableHeadStyle}>Xử lý</th></tr></thead><tbody>{selectedComparison.differences.map((difference) => <tr key={difference.id}><td style={tableCellStyle}>{difference.field}</td><td style={tableCellStyle}>{jsonText(difference.approvedExpected)}</td><td style={tableCellStyle}>{jsonText(difference.legacyValue)}</td><td style={tableCellStyle}>{jsonText(difference.v2Value)}</td><td style={tableCellStyle}><span style={chipStyle(tone(difference.classification))}>{difference.classification}</span></td><td style={tableCellStyle}>{['BOTH_MATCH', 'V2_MATCH_TECHNICAL'].includes(difference.classification) ? 'Không cần' : <button style={ghostButtonStyle} onClick={() => void resolveDifference(difference.id)}>Ghi nhận resolution</button>}</td></tr>)}</tbody></table></div></div>}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginTop: 12 }}><input style={inputStyle} placeholder="Mô tả resolution; sau đó phải sửa rule/data và chạy lại" value={resolution} onChange={(event) => setResolution(event.target.value)} /><div style={{ display: 'flex', alignItems: 'center', gap: 7, color: ui.danger, fontSize: 12 }}><ShieldAlert size={16} />Không được đổi classification thủ công</div></div>
      </section>
    </>}
  </div></AdminPage>;
}
