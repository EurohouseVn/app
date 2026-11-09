'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Link2, Loader2, Search, ShieldAlert, Unlink } from 'lucide-react';
import type { EurohouseAccessView, EurohouseFeatureKey, EurohouseInviteView } from '@eurohouse/types';
import { apiGet, apiGetQuery, apiSend } from '../lib/api';
import {
  createEurohouseAccessState,
  eurohouseAccessErrorMessage,
  inviteStatusLabel,
  patchFeatureStatus,
  selectedFeatureKeys,
  selectWorkshop,
  setCreatedInvite,
  setSearchResults,
  statusLabel,
  toggleInviteFeature,
  type WorkshopSearchResult,
} from '../lib/eurohouseAccessState';
import { chipStyle, ghostButtonStyle, inputStyle, primaryButtonStyle, ui } from '../ui';

const featureLabels: Record<EurohouseFeatureKey, string> = {
  FORMULA_CUTTING: 'Công thức cắt Eurohouse',
  EUROHOUSE_ORDERING: 'Đặt hàng Nhôm Eurohouse',
};
type CreateInviteResponse = { invite: EurohouseInviteView; plainCode: string };

export function EurohouseAccessPanel() {
  const [state, setState] = useState(createEurohouseAccessState);
  const [search, setSearch] = useState('');
  const [invites, setInvites] = useState<EurohouseInviteView[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [revokeReasons, setRevokeReasons] = useState<Partial<Record<EurohouseFeatureKey, string>>>({});

  useEffect(() => { void apiGet<EurohouseInviteView[]>('/npp/eurohouse-invites').then(setInvites).catch(() => setInvites([])); }, []);
  const selectedInvites = useMemo(() => invites.filter((invite) => invite.targetOrganizationId === state.selected?.organizationId), [invites, state.selected?.organizationId]);

  async function runSearch() {
    setError(''); setMessage(''); setBusy('search');
    try {
      const rows = await apiGetQuery<WorkshopSearchResult[]>('/npp/eurohouse-access/accounts', { search: search.trim() });
      setState((current) => setSearchResults(current, rows));
      if (rows.length === 1) setState((current) => selectWorkshop(current, rows[0].organizationId));
      if (!rows.length) setMessage('Không tìm thấy cơ sở đã xác minh với thông tin này.');
    } catch (cause) { setError(eurohouseAccessErrorMessage(cause)); }
    finally { setBusy(''); }
  }

  async function mutateFeature(featureKey: EurohouseFeatureKey, action: 'activate' | 'revoke') {
    if (!state.selected) return;
    const reason = revokeReasons[featureKey]?.trim() || '';
    if (action === 'revoke' && reason.length < 3) { setError('Vui lòng ghi lý do thu hồi quyền.'); return; }
    setBusy(`${action}:${featureKey}`); setError(''); setMessage('');
    try {
      await apiSend<EurohouseAccessView>(`/npp/eurohouse-access/${state.selected.organizationId}/${action}`, 'POST', action === 'revoke' ? { featureKey, reason } : { featureKey });
      setState((current) => patchFeatureStatus(current, state.selected!.organizationId, featureKey, action === 'activate' ? 'ACTIVE' : 'REVOKED', 'MANAGED'));
      setRevokeReasons((current) => ({ ...current, [featureKey]: '' }));
      setMessage(`${action === 'activate' ? 'Đã kích hoạt' : 'Đã thu hồi'} ${featureLabels[featureKey]}.`);
    } catch (cause) { setError(eurohouseAccessErrorMessage(cause)); }
    finally { setBusy(''); }
  }

  async function createInvite() {
    if (!state.selected) return;
    const featureKeys = selectedFeatureKeys(state);
    setBusy('invite'); setError(''); setMessage('');
    try {
      const result = await apiSend<CreateInviteResponse>('/npp/eurohouse-invites', 'POST', { targetOrganizationId: state.selected.organizationId, featureKeys });
      setState((current) => setCreatedInvite(current, { plainCode: result.plainCode, expiresAt: result.invite.expiresAt }));
      setInvites((current) => [result.invite, ...current]);
      setMessage('Mã mời đã được tạo. Mã rõ chỉ hiển thị trong lần này.');
    } catch (cause) { setError(eurohouseAccessErrorMessage(cause)); }
    finally { setBusy(''); }
  }

  async function copyCode() {
    if (!state.oneTimeCode) return;
    await navigator.clipboard?.writeText(state.oneTimeCode);
    setMessage('Đã sao chép mã mời.');
  }

  const selected = state.selected;
  const blockedByOtherNpp = selected?.relationship === 'OTHER_NPP';

  return <section className="eurohouse-workspace">
    <div className="panel search-panel">
      <div className="heading"><div><p className="kicker">TÌM CƠ SỞ</p><h2>Điện thoại hoặc email</h2></div><Search size={20} color={ui.brandText} /></div>
      <p className="helper">Tìm chính xác tài khoản đã xác minh. Kết quả chỉ hiển thị thông tin liên hệ đã che.</p>
      <div className="search-row"><input aria-label="Điện thoại hoặc email cơ sở" style={inputStyle} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }} /><button style={primaryButtonStyle} disabled={busy === 'search'} onClick={runSearch}>{busy === 'search' ? <Loader2 className="spin" size={16} /> : <Search size={16} />} Tìm</button></div>
      <div className="results">{state.results.map((row) => <button className={`result ${selected?.organizationId === row.organizationId ? 'selected' : ''}`} key={row.organizationId} onClick={() => { setState((current) => selectWorkshop(current, row.organizationId)); setMessage(''); setError(''); }}><span><strong>{row.organizationName}</strong><small>{row.province || 'Chưa cập nhật khu vực'} · {row.maskedPhone || row.maskedEmail || 'Liên hệ đã xác minh'}</small></span><span>{Object.values(row.features).filter((feature) => feature.status === 'ACTIVE').length}/2 quyền</span></button>)}</div>
    </div>

    <div className="panel detail-panel">{!selected ? <div className="empty"><KeyRound size={28} /><strong>Chọn một cơ sở để quản lý quyền</strong></div> : <>
      <div className="heading"><div><p className="kicker">QUYỀN EUROHOUSE</p><h2>{selected.organizationName}</h2><p className="helper">{selected.maskedPhone || selected.maskedEmail || 'Liên hệ đã xác minh'}</p></div></div>
      {blockedByOtherNpp ? <div className="warning"><ShieldAlert size={20} /><div><strong>Cơ sở đang thuộc NPP khác</strong><p>Chỉ Admin Eurohouse có thể chuyển NPP quản lý.</p></div></div> : <>
        <div className="feature-list">{(['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const).map((featureKey) => { const feature = selected.features[featureKey]; const active = feature.status === 'ACTIVE'; return <div className="feature-card" key={featureKey}><div className="feature-head"><div><strong>{featureLabels[featureKey]}</strong><p>{feature.message}</p></div><span style={chipStyle(active ? 'success' : feature.status === 'REVOKED' ? 'danger' : 'warning')}>{statusLabel(feature.status)}</span></div>{active ? <div className="revoke-row"><input aria-label={`Lý do thu hồi ${featureLabels[featureKey]}`} style={inputStyle} value={revokeReasons[featureKey] || ''} onChange={(event) => setRevokeReasons((current) => ({ ...current, [featureKey]: event.target.value }))} placeholder="Lý do thu hồi (bắt buộc)" /><button className="danger" disabled={Boolean(busy)} onClick={() => void mutateFeature(featureKey, 'revoke')}><Unlink size={15} /> Thu hồi</button></div> : <button style={primaryButtonStyle} disabled={Boolean(busy)} onClick={() => void mutateFeature(featureKey, 'activate')}><Link2 size={16} /> Kích hoạt quyền này</button>}</div>; })}</div>
        <div className="invite-box"><h3>Tạo mã mời dùng một lần</h3><div className="feature-checks">{(['FORMULA_CUTTING', 'EUROHOUSE_ORDERING'] as const).map((featureKey) => <label key={featureKey}><input type="checkbox" checked={state.inviteSelection[featureKey]} onChange={(event) => setState((current) => toggleInviteFeature(current, featureKey, event.target.checked))} /> {featureLabels[featureKey]}</label>)}</div><button style={ghostButtonStyle} disabled={Boolean(busy)} onClick={createInvite}><KeyRound size={16} /> Tạo mã cho quyền đã chọn</button></div>
        {state.oneTimeCode ? <div className="code-box"><div><span>CHỈ HIỂN THỊ LẦN NÀY</span><strong>{state.oneTimeCode}</strong></div><button style={ghostButtonStyle} onClick={copyCode}><Copy size={15} /> Sao chép</button></div> : null}
        {message ? <div className="notice success"><Check size={17} />{message}</div> : null}{error ? <div className="notice error"><ShieldAlert size={17} />{error}</div> : null}
        <div className="history"><h3>Mã mời gần đây</h3>{selectedInvites.map((invite) => <div className="history-row" key={invite.id}><span><strong>{invite.codePrefix}••••{invite.codeLast4}</strong><small>{invite.featureKeys.map((key) => featureLabels[key]).join(' · ')}</small></span><span>{inviteStatusLabel(invite.status)}</span></div>)}</div>
      </>}
    </>}</div>
    <style jsx>{`
      .eurohouse-workspace{display:grid;grid-template-columns:minmax(300px,.85fr) minmax(500px,1.3fr);gap:18px;align-items:start;margin-top:20px}.panel{background:${ui.surface};border:1px solid ${ui.border};border-radius:18px;padding:20px;min-width:0}.heading{display:flex;justify-content:space-between;gap:12px}.heading h2{margin:3px 0;color:${ui.text};font-size:19px;overflow-wrap:anywhere}.kicker{margin:0;color:${ui.brandText};font-size:11px;font-weight:800}.helper{color:${ui.textMuted};font-size:13px;line-height:1.5}.search-row{display:grid;grid-template-columns:1fr auto;gap:9px}.results,.feature-list{display:grid;gap:10px;margin-top:16px}.result{display:flex;justify-content:space-between;gap:10px;text-align:left;border:1px solid ${ui.border};border-radius:13px;background:${ui.surface};padding:12px}.result.selected{border-color:${ui.brand};background:${ui.brandSoft}}.result>span:first-child{display:grid;gap:4px;min-width:0}.result small{color:${ui.textMuted}}.empty{min-height:260px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:${ui.textMuted}}.warning,.notice{display:flex;gap:10px;border-radius:13px;padding:13px;margin-top:14px}.warning{background:${ui.warningSoft};color:#8A5700}.feature-card{border:1px solid ${ui.border};border-radius:15px;padding:14px}.feature-head{display:flex;justify-content:space-between;gap:12px}.feature-head p{margin:5px 0 0;color:${ui.textMuted};font-size:12px}.revoke-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:12px}.danger{border:1px solid #F0B7B9;background:${ui.dangerSoft};color:${ui.danger};border-radius:10px;padding:0 13px;font-weight:800;display:flex;align-items:center;gap:6px}.invite-box,.history{border-top:1px solid ${ui.border};margin-top:18px;padding-top:16px}.invite-box h3,.history h3{margin:0 0 10px}.feature-checks{display:grid;gap:8px;margin-bottom:12px}.code-box{margin-top:14px;background:#1C2430;color:#fff;border-radius:15px;padding:15px;display:flex;justify-content:space-between;gap:12px}.code-box>div{display:grid;gap:4px}.code-box span{font-size:10px;color:#FBC98C}.code-box strong{font-size:20px}.notice.success{background:${ui.successSoft};color:${ui.success}}.notice.error{background:${ui.dangerSoft};color:${ui.danger}}.history-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid ${ui.border}}.history-row>span:first-child{display:grid;gap:3px}.history-row small{color:${ui.textMuted}}@media(max-width:1024px){.eurohouse-workspace{grid-template-columns:1fr}.empty{min-height:160px}}@media(max-width:560px){.eurohouse-workspace{margin-top:14px}.panel{padding:15px}.search-row,.revoke-row{grid-template-columns:1fr}.search-row button,.danger{width:100%;min-height:42px;justify-content:center}.result,.feature-head,.code-box{flex-direction:column}.feature-card button{width:100%;justify-content:center}.code-box{align-items:flex-start}}
    `}</style>
  </section>;
}
