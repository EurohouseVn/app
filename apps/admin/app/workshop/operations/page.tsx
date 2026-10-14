'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ClipboardCheck, ClipboardList, Factory, PackageSearch, Plus, Power, RefreshCw, ShieldCheck, Truck, Users, Wrench } from 'lucide-react';
import type { OrgItem } from '@eurohouse/types';
import { AdminShell } from '../../../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../../../src/auth';
import { apiGet, apiSend } from '../../../src/lib/api';
import { inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, ui } from '../../../src/ui';
import { OperationsMasterForms, type OperationsProject } from './OperationsMasterForms';

type Flags = { survey: boolean; inventory: boolean; shopFloor: boolean; quality: boolean; installation: boolean; warranty: boolean; source?: string; version?: number };
type Dashboard = { newQuotes: number; openOrders: number; workOrdersToday: number; inProduction: number; installationsToday: number; warrantyTickets: number; pendingEvents: number };
type WorkOrder = { id: string; code: string; type: string; status: string; title: string; project?: { code: string; name: string } };
type StockItem = { id: string; code: string; name: string; unit: string; onHand: number; reserved: number; available: number };
type AdminContext = {
  warehouses: Array<{ id: string; code: string; name: string; active: boolean; activeRemnants: number; receivedQuantity: number; issuedQuantity: number; locations: Array<{ id: string; code: string; name: string }> }>;
  machines: Array<{ id: string; code: string; name: string; machineType: string; kerfMm?: number; minimumCutMm?: number; maximumStockMm?: number; active: boolean; note: string }>;
  suppliers: Array<{ id: string; code: string; name: string; leadTimeDays?: number; status: string; materials: unknown[] }>;
  teams: Array<{ id: string; code: string; name: string; teamType: string; active: boolean; members: unknown[] }>;
  workers: Array<{ id: string; code: string; name: string; roleName: string; active: boolean }>;
  priceBooks: Array<{ id: string; code: string; name: string; versions: unknown[] }>;
  qcTemplates: Array<{ id: string; code: string; name: string; appliesTo: string; active: boolean; items: unknown[] }>;
  installations: Array<{ id: string; code: string; status: string; scheduledStart?: string; project: { code: string; name: string; address: string } }>;
  warrantyAssets: Array<{ id: string; assetCode: string; status: string; project: { code: string; name: string }; tickets: Array<{ id: string; status: string }> }>;
};
type EventHealth = { workerEnabled: boolean; pending: number; failed: number; deadLetter: number; oldestPendingAgeMs: number; averageProcessingLatencyMs: number };
type Telemetry = { periodDays: number; dailyActiveUsers: number; surveyCompletionCount: number; averageSurveyDurationMs: number; qcInspections: number; reworkCount: number; installationCompletion: number; offlineQueueFailures: number; syncConflicts: number; mediaUploadFailures: number; applicationErrors: number; funnel: { assigned: number; opened: number; started: number; completed: number; closedSuccessfully: number } };

const workOrderTypes = ['MEASUREMENT', 'MATERIAL_PREP', 'CUTTING', 'MACHINING', 'ASSEMBLY', 'GLAZING', 'QC', 'PACKING', 'DELIVERY', 'INSTALLATION'];

export default function WorkshopOperationsPage() {
  const { user, ready, login, logout } = useDemoAuth();
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [flags, setFlags] = useState<Flags | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('MATERIAL_PREP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<AdminContext | null>(null);
  const [eventHealth, setEventHealth] = useState<EventHealth | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [projects, setProjects] = useState<OperationsProject[]>([]);

  useEffect(() => {
    if (!user) return;
    apiGet<OrgItem[]>('/admin/orgs')
      .then((items) => {
        const workshops = items.filter((item) => item.type === 'FACTORY' || item.type === 'DEALER');
        setOrgs(workshops);
        setOrganizationId((current) => current || workshops[0]?.id || '');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được cấu hình vận hành.'));
  }, [user]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try {
      const query = `?organizationId=${encodeURIComponent(organizationId)}`;
      const [summary, jobs, inventory, featureFlags, operations, health, pilotTelemetry, projectItems] = await Promise.all([
        apiGet<Dashboard>(`/workshop/v2/dashboard${query}`),
        apiGet<WorkOrder[]>(`/workshop/v2/work-orders${query}`),
        apiGet<StockItem[]>(`/workshop/v2/inventory/items${query}`),
        apiGet<Flags>(`/workshop/v2/flags${query}`),
        apiGet<AdminContext>(`/workshop/v2/admin/context${query}`),
        apiGet<EventHealth>(`/workshop/v2/events/health${query}`),
        apiGet<Telemetry>(`/workshop/v2/telemetry/summary${query}&days=7`),
        apiGet<OperationsProject[]>(`/workshop/v2/projects${query}`),
      ]);
      setDashboard(summary);
      setWorkOrders(jobs);
      setStock(inventory);
      setFlags(featureFlags);
      setContext(operations);
      setEventHealth(health);
      setTelemetry(pilotTelemetry);
      setProjects(projectItems);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu vận hành.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  async function createWorkOrder() {
    if (!title.trim() || !organizationId) return;
    try {
      await apiSend('/workshop/v2/work-orders', 'POST', { organizationId, title: title.trim(), type });
      setTitle('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tạo được lệnh việc.');
    }
  }

  async function savePilot(nextActive: boolean) {
    if (!organizationId) return;
    try {
      await apiSend('/workshop/v2/pilot/config', 'PATCH', { organizationId, active: nextActive, survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được pilot.'); }
  }

  async function updateMaster(entity: string, id: string, body: Record<string, unknown>) {
    if (!organizationId) return;
    try {
      setError('');
      await apiSend(`/workshop/v2/admin/master/${entity}/${id}`, 'PATCH', { organizationId, ...body });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được trạng thái vận hành.');
    }
  }

  const statusButton = (active: boolean) => ({
    border: `1px solid ${active ? ui.border : ui.success}`,
    background: active ? ui.surface : ui.successSoft,
    color: active ? ui.textMuted : ui.success,
    borderRadius: 6,
    padding: '6px 9px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  } as const);

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  const metrics = [
    ['Báo giá mới', dashboard?.newQuotes || 0], ['Đơn đang mở', dashboard?.openOrders || 0],
    ['Việc hôm nay', dashboard?.workOrdersToday || 0], ['Đang sản xuất', dashboard?.inProduction || 0],
    ['Lắp đặt hôm nay', dashboard?.installationsToday || 0], ['Phiếu bảo hành', dashboard?.warrantyTickets || 0],
  ];

  return (
    <AdminShell user={user} onLogout={logout}>
      <div style={{ display: 'grid', gap: 20 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <div><p style={{ margin: 0, color: ui.brand, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Workshop Operations</p><h1 style={pageTitleStyle}>Điều hành xưởng</h1><p style={subtitleStyle}>Khảo sát, kho, lệnh việc, QC, lắp đặt và bảo hành theo từng CSSX.</p></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} style={{ ...inputStyle, minWidth: 280 }}>
              {orgs.map((org) => <option key={org.id} value={org.id}>{org.code} · {org.name}</option>)}
            </select>
            <button onClick={() => void load()} aria-label="Tải lại" title="Tải lại" style={{ ...primaryButtonStyle, width: 46, padding: 0, height: 46 }}><RefreshCw size={18} /></button>
          </div>
        </header>

        {error ? <div style={{ padding: 12, border: `1px solid ${ui.danger}`, color: ui.danger, background: ui.dangerSoft, borderRadius: 8 }}>{error}</div> : null}

        <section style={{ ...panelStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <ShieldCheck size={22} color={ui.brand} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {flags ? Object.entries(flags).filter(([, value]) => typeof value === 'boolean').map(([key, enabled]) => <span key={key} style={{ padding: '6px 9px', borderRadius: 6, border: `1px solid ${enabled ? ui.success : ui.border}`, color: enabled ? ui.success : ui.textMuted, fontSize: 12, fontWeight: 700 }}>{key}: {enabled ? 'ON' : 'OFF'}</span>) : null}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button onClick={() => void savePilot(true)} style={primaryButtonStyle}>Bật cho CSSX này</button><button onClick={() => void savePilot(false)} style={{ ...primaryButtonStyle, background: ui.danger }}>Rollback</button></div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
          <article style={{ ...panelStyle, padding: 16 }}><Activity size={20} color={ui.brand} /><p style={{ margin: '10px 0 4px', color: ui.textMuted, fontSize: 12 }}>Event worker</p><strong style={{ color: eventHealth?.failed || eventHealth?.deadLetter ? ui.danger : ui.success }}>{eventHealth?.workerEnabled ? 'Đang chạy' : 'Đã tắt'}</strong><p style={{ color: ui.textMuted, fontSize: 12 }}>{eventHealth?.pending || 0} chờ · {eventHealth?.failed || 0} lỗi · {eventHealth?.deadLetter || 0} dead-letter</p></article>
          <article style={{ ...panelStyle, padding: 16 }}><Users size={20} color={ui.brand} /><p style={{ margin: '10px 0 4px', color: ui.textMuted, fontSize: 12 }}>Người dùng hoạt động / 7 ngày</p><strong style={{ color: ui.text, fontSize: 24 }}>{telemetry?.dailyActiveUsers || 0}</strong><p style={{ color: ui.textMuted, fontSize: 12 }}>{telemetry?.surveyCompletionCount || 0} khảo sát hoàn tất</p></article>
          <article style={{ ...panelStyle, padding: 16 }}><ClipboardCheck size={20} color={ui.brand} /><p style={{ margin: '10px 0 4px', color: ui.textMuted, fontSize: 12 }}>QC pilot</p><strong style={{ color: ui.text, fontSize: 24 }}>{telemetry?.qcInspections || 0}</strong><p style={{ color: ui.textMuted, fontSize: 12 }}>{telemetry?.reworkCount || 0} yêu cầu làm lại</p></article>
          <article style={{ ...panelStyle, padding: 16 }}><Truck size={20} color={ui.brand} /><p style={{ margin: '10px 0 4px', color: ui.textMuted, fontSize: 12 }}>Lắp đặt hoàn tất</p><strong style={{ color: ui.text, fontSize: 24 }}>{telemetry?.installationCompletion || 0}</strong><p style={{ color: ui.textMuted, fontSize: 12 }}>{telemetry?.syncConflicts || 0} xung đột sync · {telemetry?.mediaUploadFailures || 0} media lỗi</p></article>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(280px, 1fr))', gap: 14 }}>
          <article style={{ ...panelStyle, padding: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PackageSearch size={19} color={ui.brand} /><h2 style={{ margin: 0, fontSize: 17 }}>Kho & vị trí</h2></div>{context?.warehouses.map((item) => <div key={item.id} style={{ padding: '11px 0', borderTop: `1px solid ${ui.border}`, marginTop: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{item.code} · {item.name}</strong><button type="button" onClick={() => void updateMaster('warehouse', item.id, { active: !item.active })} style={statusButton(item.active)}><Power size={13} />{item.active ? 'Tạm dừng' : 'Kích hoạt'}</button></div><p style={{ margin: '5px 0 0', color: ui.textMuted, fontSize: 12 }}>{item.locations.length} vị trí · {item.activeRemnants} đầu mẩu · nhập {item.receivedQuantity} / xuất {item.issuedQuantity}</p></div>)}</article>
          <article style={{ ...panelStyle, padding: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wrench size={19} color={ui.brand} /><h2 style={{ margin: 0, fontSize: 17 }}>Máy & năng lực</h2></div>{context?.machines.map((item) => <div key={item.id} style={{ padding: '11px 0', borderTop: `1px solid ${ui.border}`, marginTop: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{item.code} · {item.name}</strong><button type="button" onClick={() => void updateMaster('machine', item.id, { active: !item.active })} style={statusButton(item.active)}><Power size={13} />{item.active ? 'Tạm dừng' : 'Kích hoạt'}</button></div><p style={{ margin: '5px 0 0', color: ui.textMuted, fontSize: 12 }}>{item.machineType} · kerf {item.kerfMm ?? '—'} mm · cắt {item.minimumCutMm ?? '—'}–{item.maximumStockMm ?? '—'} mm · {item.active ? 'hoạt động' : 'tạm dừng'}</p></div>)}</article>
          <article style={{ ...panelStyle, padding: 18 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Factory size={19} color={ui.brand} /><h2 style={{ margin: 0, fontSize: 17 }}>Nhà cung cấp</h2></div>{context?.suppliers.map((item) => { const active = item.status === 'ACTIVE'; return <div key={item.id} style={{ padding: '11px 0', borderTop: `1px solid ${ui.border}`, marginTop: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{item.code} · {item.name}</strong><button type="button" onClick={() => void updateMaster('supplier', item.id, { status: active ? 'INACTIVE' : 'ACTIVE' })} style={statusButton(active)}><Power size={13} />{active ? 'Tạm dừng' : 'Kích hoạt'}</button></div><p style={{ margin: '5px 0 0', color: ui.textMuted, fontSize: 12 }}>{item.materials.length} vật tư · lead time {item.leadTimeDays ?? '—'} ngày · {item.status}</p></div>; })}</article>
          <article style={{ ...panelStyle, padding: 18 }}><h2 style={{ margin: 0, fontSize: 17 }}>Đội & nhân sự</h2><p style={{ color: ui.textMuted, fontSize: 12 }}>{context?.teams.length || 0} đội · {context?.workers.filter((item) => item.active).length || 0} người đang hoạt động</p>{context?.teams.map((item) => <div key={item.id} style={{ paddingTop: 8, borderTop: `1px solid ${ui.border}` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{item.code} · {item.name}</strong><button type="button" onClick={() => void updateMaster('team', item.id, { active: !item.active })} style={statusButton(item.active)}><Power size={13} />{item.active ? 'Tạm dừng' : 'Kích hoạt'}</button></div><p style={{ margin: '4px 0 10px', color: ui.textMuted, fontSize: 12 }}>{item.teamType} · {item.members.length} thành viên</p></div>)}</article>
          <article style={{ ...panelStyle, padding: 18 }}><h2 style={{ margin: 0, fontSize: 17 }}>Mẫu QC & bảng giá</h2><p style={{ color: ui.textMuted, fontSize: 12 }}>{context?.qcTemplates.length || 0} mẫu QC · {context?.priceBooks.length || 0} bảng giá</p>{context?.qcTemplates.map((item) => <div key={item.id} style={{ paddingTop: 8, borderTop: `1px solid ${ui.border}` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><strong>{item.code} · {item.name}</strong><button type="button" onClick={() => void updateMaster('qc-template', item.id, { active: !item.active })} style={statusButton(item.active)}><Power size={13} />{item.active ? 'Tạm dừng' : 'Kích hoạt'}</button></div><p style={{ margin: '4px 0 10px', color: ui.textMuted, fontSize: 12 }}>{item.appliesTo} · {item.items.length} tiêu chí</p></div>)}</article>
          <article style={{ ...panelStyle, padding: 18 }}><h2 style={{ margin: 0, fontSize: 17 }}>Lắp đặt & bảo hành</h2><p style={{ color: ui.textMuted, fontSize: 12 }}>{context?.installations.filter((item) => item.status !== 'COMPLETED').length || 0} lịch đang mở · {context?.warrantyAssets.reduce((sum, item) => sum + item.tickets.filter((ticket) => !['CLOSED', 'CANCELLED'].includes(ticket.status)).length, 0) || 0} phiếu dịch vụ</p>{context?.installations.slice(0, 5).map((item) => <p key={item.id} style={{ paddingTop: 8, borderTop: `1px solid ${ui.border}` }}><strong>{item.code} · {item.project.name}</strong><br /><span style={{ color: ui.textMuted, fontSize: 12 }}>{item.status} · {item.project.address}</span></p>)}</article>
        </section>

        <OperationsMasterForms organizationId={organizationId} context={context} projects={projects} onChanged={load} onError={setError} />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(130px, 1fr))', gap: 12 }}>
          {metrics.map(([label, value]) => <article key={String(label)} style={{ ...panelStyle, padding: 16 }}><p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>{label}</p><strong style={{ display: 'block', marginTop: 8, color: ui.text, fontSize: 26 }}>{value}</strong></article>)}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, .6fr)', gap: 18 }}>
          <div style={{ ...panelStyle, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><ClipboardList size={20} color={ui.brand} /><h2 style={{ margin: 0, color: ui.text, fontSize: 18 }}>Lệnh việc vận hành</h2></div>
            <div style={{ display: 'grid', gap: 8 }}>
              {workOrders.map((job) => <div key={job.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 130px', gap: 12, alignItems: 'center', padding: 12, borderTop: `1px solid ${ui.border}` }}><strong style={{ color: ui.brand }}>{job.code}</strong><div><strong style={{ color: ui.text }}>{job.title}</strong><p style={{ margin: '3px 0 0', color: ui.textMuted, fontSize: 12 }}>{job.project ? `${job.project.code} · ${job.project.name}` : job.type}</p></div><span style={{ color: ui.textMuted, fontSize: 12, fontWeight: 700 }}>{job.status}</span></div>)}
              {!workOrders.length && !loading ? <p style={{ color: ui.textMuted }}>Chưa có lệnh việc.</p> : null}
            </div>
          </div>

          <aside style={{ ...panelStyle, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><Plus size={20} color={ui.brand} /><h2 style={{ margin: 0, color: ui.text, fontSize: 18 }}>Tạo việc nhanh</h2></div>
            <label style={labelStyle}>Loại công việc</label>
            <select value={type} onChange={(event) => setType(event.target.value)} style={{ ...inputStyle, width: '100%' }}>{workOrderTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <label style={{ ...labelStyle, marginTop: 14 }}>Tên công việc</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chuẩn bị vật tư công trình..." style={{ ...inputStyle, width: '100%' }} />
            <button onClick={createWorkOrder} style={{ ...primaryButtonStyle, width: '100%', marginTop: 16 }}><Factory size={17} /> Tạo lệnh việc</button>
          </aside>
        </section>

        <section style={{ ...panelStyle, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><PackageSearch size={20} color={ui.brand} /><h2 style={{ margin: 0, color: ui.text, fontSize: 18 }}>Tồn kho giao dịch</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 120px', gap: 10, color: ui.textMuted, fontSize: 12, fontWeight: 800, padding: '0 10px 10px' }}><span>Mã</span><span>Vật tư</span><span>Tồn</span><span>Đã giữ</span><span>Khả dụng</span></div>
          {stock.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px 120px 120px', gap: 10, padding: 10, borderTop: `1px solid ${ui.border}`, color: ui.text }}><strong>{item.code}</strong><span>{item.name}</span><span>{item.onHand} {item.unit}</span><span>{item.reserved} {item.unit}</span><strong>{item.available} {item.unit}</strong></div>)}
        </section>
      </div>
    </AdminShell>
  );
}
