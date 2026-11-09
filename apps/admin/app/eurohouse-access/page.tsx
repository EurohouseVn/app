'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, BadgeCheck, Ban, History, RefreshCw, X } from 'lucide-react';
import type { EurohouseFeatureKey, OrgItem } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, apiGetQuery, apiSend } from '../../src/lib/api';
import { buildActivationPayload, buildEurohouseAccessQuery, buildFeatureRevokePayload, buildTransferPayload, rowPresentation, type AdminEurohouseAccessRow, type EurohouseAccessFilters } from '../../src/eurohouseAccessState';
import { eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const labels: Record<EurohouseFeatureKey, string> = { FORMULA_CUTTING: 'Công thức cắt', EUROHOUSE_ORDERING: 'Đặt hàng Eurohouse' };
const initialFilters: EurohouseAccessFilters = { featureKey: '', status: '', nppOrganizationId: '', province: '', page: 1, pageSize: 20 };
type AuditRow = { id: string; featureKey?: EurohouseFeatureKey; action: string; actorRole: string; metadata?: { reason?: string }; createdAt: string };
type Action = { mode: 'activate'; row?: AdminEurohouseAccessRow; featureKey?: EurohouseFeatureKey } | { mode: 'revoke'; row: AdminEurohouseAccessRow; featureKey: EurohouseFeatureKey } | { mode: 'transfer'; row: AdminEurohouseAccessRow } | { mode: 'audit'; row: AdminEurohouseAccessRow };

export default function EurohouseAccessPage() { return <AdminPage><Workspace /></AdminPage>; }

function Workspace() {
  const [rows, setRows] = useState<AdminEurohouseAccessRow[]>([]);
  const [npps, setNpps] = useState<OrgItem[]>([]);
  const [filters, setFilters] = useState<EurohouseAccessFilters>(initialFilters);
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('featureKey') === 'FORMULA_CUTTING') {
      setFilters((current) => ({ ...current, featureKey: 'FORMULA_CUTTING' }));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, organizations] = await Promise.all([apiGetQuery<AdminEurohouseAccessRow[]>('/admin/eurohouse-access', buildEurohouseAccessQuery(filters)), apiGet<OrgItem[]>('/admin/orgs')]);
      setRows(items); setNpps(organizations.filter((item) => item.type === 'NPP'));
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không tải được dữ liệu quyền.'); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);

  const cards = useMemo(() => rows.map(rowPresentation), [rows]);
  return <>
    <p style={eyebrowStyle}>QUẢN TRỊ QUYỀN EUROHOUSE</p>
    <header className="access-head"><div><h1 style={pageTitleStyle}>Quyền Công thức & Đặt hàng</h1><p style={subtitleStyle}>Mỗi cơ sở có hai quyền độc lập, một NPP phụ trách và lịch sử thay đổi được lưu riêng.</p></div><div className="head-actions"><button style={ghostButtonStyle} onClick={() => void load()}><RefreshCw size={16} /> Làm mới</button><button style={primaryButtonStyle} onClick={() => setAction({ mode: 'activate' })}><BadgeCheck size={16} /> Kích hoạt quyền</button></div></header>
    {notice ? <p className="notice">{notice}</p> : null}
    <section style={{ ...panelStyle, padding: 16, marginTop: 18 }} className="filters">
      <label style={labelStyle}>Quyền<select style={inputStyle} value={filters.featureKey} onChange={(e) => setFilters({ ...filters, featureKey: e.target.value as EurohouseAccessFilters['featureKey'], page: 1 })}><option value="">Cả hai quyền</option><option value="FORMULA_CUTTING">Công thức cắt</option><option value="EUROHOUSE_ORDERING">Đặt hàng</option></select></label>
      <label style={labelStyle}>Trạng thái<select style={inputStyle} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as EurohouseAccessFilters['status'], page: 1 })}><option value="">Tất cả</option><option value="LOCKED">Chưa kích hoạt</option><option value="ACTIVE">Đã kích hoạt</option><option value="REVOKED">Đã thu hồi</option></select></label>
      <label style={labelStyle}>NPP<select style={inputStyle} value={filters.nppOrganizationId} onChange={(e) => setFilters({ ...filters, nppOrganizationId: e.target.value, page: 1 })}><option value="">Tất cả NPP</option>{npps.map((npp) => <option key={npp.id} value={npp.id}>{npp.name}</option>)}</select></label>
      <label style={labelStyle}>Tỉnh/thành<input style={inputStyle} value={filters.province} onChange={(e) => setFilters({ ...filters, province: e.target.value, page: 1 })} /></label>
    </section>
    <section style={{ ...panelStyle, padding: 0, marginTop: 16, overflow: 'hidden' }}>
      <div className="desktop-table"><table><thead><tr>{['Cơ sở', 'NPP phụ trách', 'Công thức cắt', 'Đặt hàng', 'Thao tác'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.organizationId}><td style={tableCellStyle}><strong>{row.organizationName}</strong><small>{row.province || 'Chưa cập nhật'}</small></td><td style={tableCellStyle}>{row.nppOrganizationName || 'Chưa liên kết'}</td>{(['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const).map((key) => <td style={tableCellStyle} key={key}><FeatureCell row={row} featureKey={key} onAction={setAction} /></td>)}<td style={tableCellStyle}><div className="row-actions"><button style={ghostButtonStyle} onClick={() => setAction({ mode: 'transfer', row })}><ArrowRightLeft size={14} /> Chuyển NPP</button><button aria-label={`Lịch sử ${row.organizationName}`} style={ghostButtonStyle} onClick={() => setAction({ mode: 'audit', row })}><History size={14} /></button></div></td></tr>)}</tbody></table></div>
      <div className="mobile-cards">{cards.map((card) => { const row = rows.find((item) => item.organizationId === card.id)!; return <article key={card.id}><div className="card-head"><div><strong>{card.title}</strong><small>{card.province} · {card.npp}</small></div><button aria-label={`Lịch sử ${card.title}`} style={ghostButtonStyle} onClick={() => setAction({ mode: 'audit', row })}><History size={14} /></button></div>{(['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const).map((key) => <div className="card-feature" key={key}><span>{labels[key]}</span><FeatureCell row={row} featureKey={key} onAction={setAction} /></div>)}<button style={ghostButtonStyle} onClick={() => setAction({ mode: 'transfer', row })}><ArrowRightLeft size={14} /> Chuyển NPP</button></article>; })}</div>
      {loading ? <p className="empty">Đang tải dữ liệu…</p> : !rows.length ? <p className="empty">Không có cơ sở phù hợp.</p> : null}
    </section>
    {action ? <ActionDialog action={action} rows={rows} npps={npps} onClose={() => setAction(null)} onDone={(text) => { setAction(null); setNotice(text); void load(); }} /> : null}
    <style jsx>{`.access-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.head-actions,.row-actions{display:flex;gap:8px;flex-wrap:wrap}.filters{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px}.desktop-table{overflow-x:auto}.desktop-table table{width:100%;border-collapse:collapse}.desktop-table small{display:block;margin-top:4px;color:${ui.textMuted}}.mobile-cards{display:none;padding:12px;gap:10px}.mobile-cards article{border:1px solid ${ui.border};border-radius:15px;padding:14px}.card-head{display:flex;justify-content:space-between;gap:8px}.card-head small{display:block;margin-top:4px;color:${ui.textMuted}}.card-feature{display:grid;gap:7px;border-top:1px solid ${ui.border};padding:12px 0}.notice{padding:11px 14px;border-radius:10px;background:${ui.successSoft};color:${ui.success};font-weight:700}.empty{text-align:center;padding:34px;color:${ui.textMuted}}@media(max-width:900px){.filters{grid-template-columns:repeat(2,1fr)}}@media(max-width:800px){.desktop-table{display:none}.mobile-cards{display:grid}}@media(max-width:520px){.filters{grid-template-columns:1fr}.head-actions{display:grid;width:100%}.head-actions button{width:100%;justify-content:center}}`}</style>
  </>;
}

function FeatureCell({ row, featureKey, onAction }: { row: AdminEurohouseAccessRow; featureKey: EurohouseFeatureKey; onAction: (action: Action) => void }) {
  const feature = row.features[featureKey]; const active = feature?.status === 'ACTIVE';
  return <div className="feature"><span className={`pill ${active ? 'active' : feature?.status === 'REVOKED' ? 'revoked' : ''}`}>{active ? 'Đã kích hoạt' : feature?.status === 'REVOKED' ? 'Đã thu hồi' : 'Chưa kích hoạt'}</span><button style={ghostButtonStyle} onClick={() => onAction(active ? { mode: 'revoke', row, featureKey } : { mode: 'activate', row, featureKey })}>{active ? <Ban size={13} /> : <BadgeCheck size={13} />}{active ? 'Thu hồi' : 'Kích hoạt'}</button><style jsx>{`.feature{display:grid;gap:7px;justify-items:start}.pill{font-size:11px;font-weight:800;color:${ui.brandText};background:${ui.brandSoft};border-radius:999px;padding:5px 8px}.pill.active{color:${ui.success};background:${ui.successSoft}}.pill.revoked{color:${ui.danger};background:${ui.dangerSoft}}`}</style></div>;
}

function ActionDialog({ action, rows, npps, onClose, onDone }: { action: Action; rows: AdminEurohouseAccessRow[]; npps: OrgItem[]; onClose: () => void; onDone: (text: string) => void }) {
  const [organizationId, setOrganizationId] = useState('row' in action && action.row ? action.row.organizationId : '');
  const [featureKey, setFeatureKey] = useState<EurohouseFeatureKey>('featureKey' in action && action.featureKey ? action.featureKey : 'FORMULA_CUTTING');
  const target = rows.find((row) => row.organizationId === organizationId);
  const [nppId, setNppId] = useState(target?.nppOrganizationId || ''); const [reason, setReason] = useState(''); const [audit, setAudit] = useState<AuditRow[]>([]); const [error, setError] = useState('');
  useEffect(() => { if (action.mode === 'audit') void apiGet<AuditRow[]>(`/admin/eurohouse-access/${action.row.organizationId}/audit`).then(setAudit).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được lịch sử.')); }, [action]);
  async function submit() { try { if (action.mode === 'activate') { const payload = buildActivationPayload(organizationId, featureKey, nppId); await apiSend(`/admin/eurohouse-access/${payload.organizationId}/activate`, 'POST', { featureKey: payload.featureKey, nppOrganizationId: payload.nppOrganizationId }); onDone('Đã kích hoạt quyền Eurohouse.'); } else if (action.mode === 'revoke') { await apiSend(`/admin/eurohouse-access/${action.row.organizationId}/revoke`, 'POST', buildFeatureRevokePayload(action.featureKey, reason)); onDone('Đã thu hồi quyền Eurohouse.'); } else if (action.mode === 'transfer') { await apiSend(`/admin/eurohouse-access/${action.row.organizationId}/transfer-npp`, 'POST', buildTransferPayload(nppId, reason)); onDone('Đã chuyển NPP phụ trách.'); } } catch (e) { setError(e instanceof Error ? e.message : 'Không thực hiện được thao tác.'); } }
  return <div className="overlay" onClick={onClose}><section style={panelStyle} onClick={(e) => e.stopPropagation()}><header><h2>{action.mode === 'audit' ? 'Lịch sử thay đổi' : action.mode === 'transfer' ? 'Chuyển NPP' : action.mode === 'revoke' ? 'Thu hồi quyền' : 'Kích hoạt quyền'}</h2><button style={ghostButtonStyle} onClick={onClose}><X size={15} /></button></header><div className="body">{action.mode === 'activate' ? <><label style={labelStyle}>Cơ sở *<select style={inputStyle} value={organizationId} onChange={(e) => { setOrganizationId(e.target.value); setNppId(rows.find((row) => row.organizationId === e.target.value)?.nppOrganizationId || ''); }}><option value="">Chọn CSSX</option>{rows.map((row) => <option key={row.organizationId} value={row.organizationId}>{row.organizationName}</option>)}</select></label><label style={labelStyle}>Quyền *<select style={inputStyle} value={featureKey} onChange={(e) => setFeatureKey(e.target.value as EurohouseFeatureKey)}><option value="FORMULA_CUTTING">Công thức cắt</option><option value="EUROHOUSE_ORDERING">Đặt hàng</option></select></label></> : null}{action.mode === 'activate' || action.mode === 'transfer' ? <label style={labelStyle}>NPP *<select style={inputStyle} value={nppId} onChange={(e) => setNppId(e.target.value)}><option value="">Chọn NPP</option>{npps.map((npp) => <option key={npp.id} value={npp.id}>{npp.name}</option>)}</select></label> : null}{action.mode === 'revoke' || action.mode === 'transfer' ? <label style={labelStyle}>Lý do *<textarea style={{ ...inputStyle, minHeight: 90 }} value={reason} onChange={(e) => setReason(e.target.value)} /></label> : null}{action.mode === 'audit' ? <div>{audit.map((item) => <article className="audit" key={item.id}><strong>{item.featureKey ? labels[item.featureKey] : item.action}</strong><small>{item.action} · {new Date(item.createdAt).toLocaleString('vi-VN')}</small>{item.metadata?.reason ? <p>{item.metadata.reason}</p> : null}</article>)}</div> : null}{error ? <p className="error">{error}</p> : null}</div>{action.mode !== 'audit' ? <footer><button style={ghostButtonStyle} onClick={onClose}>Hủy</button><button style={primaryButtonStyle} onClick={() => void submit()}>Xác nhận</button></footer> : null}</section><style jsx>{`.overlay{position:fixed;inset:0;z-index:90;background:rgba(15,23,42,.45);display:grid;place-items:center;padding:15px}.overlay section{width:min(620px,100%);max-height:88vh;overflow:auto;padding:0}.overlay header,.overlay footer{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid ${ui.border}}.overlay header h2{margin:0;font-size:19px}.body{display:grid;gap:13px;padding:18px}.overlay footer{border-top:1px solid ${ui.border};border-bottom:0;justify-content:flex-end;gap:9px}.audit{display:grid;gap:4px;padding:11px;border:1px solid ${ui.border};border-radius:11px;margin-bottom:8px}.audit small{color:${ui.textMuted}}.audit p{margin:0}.error{color:${ui.danger};background:${ui.dangerSoft};padding:10px;border-radius:9px}`}</style></div>;
}
