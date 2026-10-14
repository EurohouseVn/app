'use client';

import { useCallback, useEffect, useState } from 'react';
import { Braces, RefreshCw, ScanSearch } from 'lucide-react';
import { AdminPage } from '../../../src/AdminPage';
import { apiGet } from '../../../src/lib/api';
import { ghostButtonStyle, pageTitleStyle, panelStyle, tableCellStyle, tableHeadStyle, ui } from '../../../src/ui';

type TraceRow = { id: string; executionId: string; engineVersion: string; rulePackVersion: string; completedAt: string; doorDesignRevision: { doorDesign: { code: string; name: string }; revisionNumber: number }; datasetRevision: { versionTag: string; status: string; dataset: { name: string } }; _count: { steps: number; bomRevisions: number } };
type TraceDetail = TraceRow & { input: unknown; output: unknown; warnings?: unknown; steps: Array<{ id: string; sequence: number; stage: string; sourceRule?: string; input?: unknown; output?: unknown; diagnostics?: unknown }>; datasetRevision: TraceRow['datasetRevision'] & { technicalSources: unknown[]; ruleDefinitions: unknown[] }; bomRevisions: unknown[] };

export default function TraceInspectorPage() {
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [selected, setSelected] = useState<TraceDetail | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try { const data = await apiGet<TraceRow[]>('/manufacturing/v2/traces'); setRows(data); setMessage(''); if (!selected && data[0]) setSelected(await apiGet<TraceDetail>(`/manufacturing/v2/traces/${data[0].id}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được trace.'); }
  }, [selected]);
  useEffect(() => { void load(); }, [load]);
  async function select(id: string) { try { setSelected(await apiGet<TraceDetail>(`/manufacturing/v2/traces/${id}`)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Không tải được trace.'); } }

  return <AdminPage><div style={{ display: 'grid', gap: 20 }}>
    <header><p style={{ margin: 0, color: ui.brandText, fontWeight: 800, fontSize: 12 }}>CALCULATION LINEAGE</p><h1 style={pageTitleStyle}>Trace Inspector</h1><p style={{ margin: 0, color: ui.textMuted }}>Theo dõi từng bước từ thiết kế, rule, dataset, BOM đến phương án cắt.</p></header>
    {message && <div style={{ padding: 12, border: `1px solid ${ui.border}`, borderRadius: 8, background: ui.surface }}>{message}</div>}
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,0.8fr) minmax(520px,1.2fr)', gap: 20, alignItems: 'start' }}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 19 }}><ScanSearch size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Lần tính</h2><button style={ghostButtonStyle} title="Tải lại" onClick={() => void load()}><RefreshCw size={16} /></button></div>
        <div style={{ overflowX: 'auto', marginTop: 14 }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={tableHeadStyle}>Thiết kế</th><th style={tableHeadStyle}>Dataset</th><th style={tableHeadStyle}>Bước</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => void select(row.id)} style={{ cursor: 'pointer', background: selected?.id === row.id ? ui.brandSoft : undefined }}><td style={tableCellStyle}><strong>{row.doorDesignRevision.doorDesign.code}</strong><div style={{ color: ui.textMuted, fontSize: 11 }}>R{row.doorDesignRevision.revisionNumber}</div></td><td style={tableCellStyle}>{row.datasetRevision.versionTag}</td><td style={tableCellStyle}>{row._count.steps}</td></tr>)}{!rows.length && <tr><td colSpan={3} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textMuted }}>Chưa có trace.</td></tr>}</tbody></table></div>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={panelStyle}><h2 style={{ marginTop: 0, fontSize: 19 }}>{selected ? selected.executionId : 'Chọn một trace'}</h2>{selected && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, color: ui.textMuted, fontSize: 13 }}><div><strong style={{ color: ui.text }}>Engine</strong><br />{selected.engineVersion}</div><div><strong style={{ color: ui.text }}>Rule pack</strong><br />{selected.rulePackVersion}</div><div><strong style={{ color: ui.text }}>Dataset</strong><br />{selected.datasetRevision.dataset.name} · {selected.datasetRevision.versionTag}</div><div><strong style={{ color: ui.text }}>BOM revisions</strong><br />{selected.bomRevisions.length}</div></div>}</div>
        {selected?.steps.map((step) => <article key={step.id} style={panelStyle}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3 style={{ margin: 0, fontSize: 16 }}>{step.sequence}. {step.stage}</h3>{step.sourceRule && <code style={{ color: ui.brandText, fontSize: 11 }}>{step.sourceRule}</code>}</div><details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', color: ui.textMuted }}><Braces size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Dữ liệu bước tính</summary><pre style={{ marginTop: 10, padding: 12, overflow: 'auto', maxHeight: 360, background: ui.surfaceMuted, borderRadius: 8, fontSize: 12 }}>{JSON.stringify({ input: step.input, output: step.output, diagnostics: step.diagnostics }, null, 2)}</pre></details></article>)}
      </div>
    </section>
  </div></AdminPage>;
}
