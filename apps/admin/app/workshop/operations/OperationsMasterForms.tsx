'use client';

import { useMemo, useState } from 'react';
import { Boxes, ClipboardCheck, Factory, HandCoins, MapPin, PackagePlus, ShieldPlus, Users, Wrench } from 'lucide-react';
import { apiSend } from '../../../src/lib/api';
import { ghostButtonStyle, inputStyle, labelStyle, panelStyle, primaryButtonStyle, ui } from '../../../src/ui';

export type OperationsContext = {
  warehouses: Array<{ id: string; code: string; name: string; locations: Array<{ id: string; code: string; name: string }> }>;
  machines: Array<{ id: string; code: string; name: string }>;
  suppliers: Array<{ id: string; code: string; name: string }>;
  teams: Array<{ id: string; code: string; name: string }>;
  workers: Array<{ id: string; code?: string; name: string; active: boolean }>;
  priceBooks: Array<{ id: string; code?: string; name: string }>;
  qcTemplates: Array<{ id: string; code: string; name: string }>;
};

export type OperationsProject = { id: string; code: string; name: string; address?: string };

type Mode = 'warehouse' | 'machine' | 'supplier' | 'team' | 'priceBook' | 'qc' | 'installation' | 'warranty';
type FormState = Record<string, string | boolean>;

const modes: Array<{ id: Mode; label: string; icon: typeof Boxes }> = [
  { id: 'warehouse', label: 'Kho & vị trí', icon: Boxes },
  { id: 'machine', label: 'Máy', icon: Wrench },
  { id: 'supplier', label: 'Nhà cung cấp', icon: Factory },
  { id: 'team', label: 'Đội & thành viên', icon: Users },
  { id: 'priceBook', label: 'Bảng giá', icon: HandCoins },
  { id: 'qc', label: 'Mẫu QC', icon: ClipboardCheck },
  { id: 'installation', label: 'Lắp đặt', icon: MapPin },
  { id: 'warranty', label: 'Bảo hành', icon: ShieldPlus },
];

const defaults: Record<Mode, FormState> = {
  warehouse: { code: '', name: '', address: '', warehouseId: '', locationCode: '', locationName: '', locationType: 'RACK' },
  machine: { code: '', name: '', machineType: 'DOUBLE_HEAD_SAW', kerfMm: '4.5', minimumCutMm: '300', maximumStockMm: '6000', angles: '45, 90', note: '' },
  supplier: { code: '', name: '', phone: '', email: '', address: '', leadTimeDays: '3', paymentTerms: '', deliveryNotes: '' },
  team: { code: '', name: '', teamType: 'INSTALLATION', teamId: '', workerId: '', roleName: 'INSTALLER' },
  priceBook: { name: '', context: 'WORKSHOP_COST', currency: 'VND' },
  qc: { code: '', name: '', appliesTo: 'WORK_ORDER', criteria: 'Kiểm tra kích thước\nKiểm tra bề mặt\nKiểm tra vận hành' },
  installation: { code: '', projectId: '', teamId: '', scheduledStart: '', vehicleRef: '', requiredQcTemplateId: '', requiredPhotoCount: '2', customerName: '', materials: 'Nhôm và phụ kiện\nKính\nVật tư lắp đặt', tools: 'Máy khoan\nThước đo\nDụng cụ bảo hộ', requiresCustomerSignature: true, note: '' },
  warranty: { assetCode: '', projectId: '', installerTeamId: '', installedAt: '', warrantyMonths: '12' },
};

function Field({ label, value, onChange, type = 'text', placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label style={labelStyle}>{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}

function SelectField({ label, value, onChange, children, required = false }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode; required?: boolean }) {
  return <label style={labelStyle}>{label}<select required={required} value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>{children}</select></label>;
}

export function OperationsMasterForms({ organizationId, context, projects, onChanged, onError }: {
  organizationId: string;
  context: OperationsContext | null;
  projects: OperationsProject[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('warehouse');
  const [form, setForm] = useState<FormState>({ ...defaults.warehouse });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const activeWorkers = useMemo(() => context?.workers.filter((worker) => worker.active) ?? [], [context]);

  function selectMode(next: Mode) {
    setMode(next);
    setForm({ ...defaults[next] });
    setMessage('');
  }

  function value(key: string) { return String(form[key] ?? ''); }
  function setValue(key: string, next: string | boolean) { setForm((current) => ({ ...current, [key]: next })); }
  function list(valueToSplit: string) { return valueToSplit.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!organizationId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'warehouse') {
        if (value('locationName')) {
          if (!value('warehouseId')) throw new Error('Chọn kho trước khi thêm vị trí.');
          await apiSend(`/workshop/v2/warehouses/${value('warehouseId')}/locations`, 'POST', { organizationId, code: value('locationCode'), name: value('locationName'), locationType: value('locationType') });
        } else {
          await apiSend('/workshop/v2/warehouses', 'POST', { organizationId, code: value('code'), name: value('name'), address: value('address') });
        }
      } else if (mode === 'machine') {
        await apiSend('/workshop/v2/machines', 'POST', { organizationId, code: value('code'), name: value('name'), machineType: value('machineType'), kerfMm: Number(value('kerfMm')), minimumCutMm: Number(value('minimumCutMm')), maximumStockMm: Number(value('maximumStockMm')), angleCapabilities: value('angles').split(',').map(Number).filter(Number.isFinite), note: value('note') });
      } else if (mode === 'supplier') {
        await apiSend('/workshop/v2/suppliers', 'POST', { organizationId, code: value('code'), name: value('name'), phone: value('phone'), email: value('email'), address: value('address'), leadTimeDays: Number(value('leadTimeDays')), paymentTerms: value('paymentTerms'), deliveryNotes: value('deliveryNotes') });
      } else if (mode === 'team') {
        if (value('workerId')) {
          if (!value('teamId')) throw new Error('Chọn đội trước khi thêm thành viên.');
          await apiSend(`/workshop/v2/teams/${value('teamId')}/members`, 'POST', { organizationId, workerId: value('workerId'), roleName: value('roleName') });
        } else {
          await apiSend('/workshop/v2/teams', 'POST', { organizationId, code: value('code'), name: value('name'), teamType: value('teamType') });
        }
      } else if (mode === 'priceBook') {
        await apiSend('/workshop/v2/price-books', 'POST', { organizationId, name: value('name'), context: value('context'), currency: value('currency') });
      } else if (mode === 'qc') {
        const criteria = list(value('criteria'));
        await apiSend('/workshop/v2/qc/templates', 'POST', { organizationId, code: value('code'), name: value('name'), appliesTo: value('appliesTo'), items: criteria.map((label, index) => ({ checkKey: `CHECK_${index + 1}`, label, required: true })) });
      } else if (mode === 'installation') {
        await apiSend('/workshop/v2/installations', 'POST', {
          organizationId, code: value('code'), projectId: value('projectId'), teamId: value('teamId') || undefined,
          scheduledStart: value('scheduledStart') || undefined, vehicleRef: value('vehicleRef'), requiredQcTemplateId: value('requiredQcTemplateId') || undefined,
          requiredPhotoCount: Number(value('requiredPhotoCount')), customerName: value('customerName'), requiresCustomerSignature: form.requiresCustomerSignature !== false,
          materialsChecklist: list(value('materials')).map((label) => ({ label, required: true, checked: false })),
          toolsChecklist: list(value('tools')).map((label) => ({ label, required: true, checked: false })), note: value('note'),
        });
      } else {
        await apiSend('/workshop/v2/warranty/assets', 'POST', { organizationId, assetCode: value('assetCode'), projectId: value('projectId'), installerTeamId: value('installerTeamId') || undefined, installedAt: value('installedAt') || undefined, warrantyMonths: Number(value('warrantyMonths')) });
      }
      setMessage('Đã lưu dữ liệu vận hành.');
      setForm({ ...defaults[mode] });
      await onChanged();
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : 'Không lưu được dữ liệu vận hành.';
      onError(text);
    } finally {
      setBusy(false);
    }
  }

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))', gap: 14 } as const;

  return <section style={{ ...panelStyle, padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
      <div><h2 style={{ margin: 0, color: ui.text, fontSize: 19 }}>Thiết lập vận hành pilot</h2><p style={{ margin: '5px 0 0', color: ui.textMuted, fontSize: 13 }}>Tạo dữ liệu theo đúng công việc thực tế của CSSX đang chọn.</p></div>
      {message ? <span style={{ color: ui.success, fontWeight: 700, fontSize: 13 }}>{message}</span> : null}
    </div>
    <div role="tablist" aria-label="Nhóm dữ liệu vận hành" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 16, borderBottom: `1px solid ${ui.border}` }}>
      {modes.map((item) => { const Icon = item.icon; const selected = item.id === mode; return <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => selectMode(item.id)} style={{ ...ghostButtonStyle, color: selected ? ui.brandText : ui.textMuted, borderColor: selected ? ui.brand : ui.border, background: selected ? ui.brandSoft : ui.surface }}><Icon size={16} />{item.label}</button>; })}
    </div>
    <form onSubmit={submit} style={{ marginTop: 18, display: 'grid', gap: 14 }}>
      {mode === 'warehouse' ? <><div style={grid}><Field label="Mã kho" value={value('code')} onChange={(next) => setValue('code', next)} placeholder="PILOT-WH" /><Field label="Tên kho" value={value('name')} onChange={(next) => setValue('name', next)} placeholder="Kho nhôm chính" /><Field label="Địa chỉ kho" value={value('address')} onChange={(next) => setValue('address', next)} placeholder="Địa chỉ vận hành" /><SelectField label="Thêm vị trí vào kho" value={value('warehouseId')} onChange={(next) => setValue('warehouseId', next)}><option value="">Không thêm vị trí</option>{context?.warehouses.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><Field label="Mã vị trí" value={value('locationCode')} onChange={(next) => setValue('locationCode', next)} placeholder="RACK-A1" /><Field label="Tên vị trí" value={value('locationName')} onChange={(next) => setValue('locationName', next)} placeholder="Kệ A1" /></div><p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>Để trống “Tên vị trí” khi tạo kho mới. Khi thêm vị trí, chọn kho và nhập tên vị trí.</p></> : null}
      {mode === 'machine' ? <div style={grid}><Field label="Mã máy" value={value('code')} onChange={(next) => setValue('code', next)} /><Field required label="Tên máy" value={value('name')} onChange={(next) => setValue('name', next)} /><SelectField label="Loại máy" value={value('machineType')} onChange={(next) => setValue('machineType', next)}><option value="DOUBLE_HEAD_SAW">Máy cắt hai đầu</option><option value="SINGLE_HEAD_SAW">Máy cắt một đầu</option><option value="CNC">Máy CNC</option><option value="CRIMPING">Máy ép góc</option><option value="OTHER">Khác</option></SelectField><Field label="Kerf (mm)" type="number" value={value('kerfMm')} onChange={(next) => setValue('kerfMm', next)} /><Field label="Chiều cắt tối thiểu (mm)" type="number" value={value('minimumCutMm')} onChange={(next) => setValue('minimumCutMm', next)} /><Field label="Chiều thanh tối đa (mm)" type="number" value={value('maximumStockMm')} onChange={(next) => setValue('maximumStockMm', next)} /><Field label="Góc hỗ trợ" value={value('angles')} onChange={(next) => setValue('angles', next)} placeholder="45, 90" /><Field label="Ghi chú bảo trì" value={value('note')} onChange={(next) => setValue('note', next)} /></div> : null}
      {mode === 'supplier' ? <div style={grid}><Field label="Mã nhà cung cấp" value={value('code')} onChange={(next) => setValue('code', next)} /><Field required label="Tên nhà cung cấp" value={value('name')} onChange={(next) => setValue('name', next)} /><Field label="Điện thoại" value={value('phone')} onChange={(next) => setValue('phone', next)} /><Field label="Email" type="email" value={value('email')} onChange={(next) => setValue('email', next)} /><Field label="Địa chỉ" value={value('address')} onChange={(next) => setValue('address', next)} /><Field label="Lead time (ngày)" type="number" value={value('leadTimeDays')} onChange={(next) => setValue('leadTimeDays', next)} /><Field label="Điều khoản thanh toán" value={value('paymentTerms')} onChange={(next) => setValue('paymentTerms', next)} /><Field label="Lưu ý giao hàng" value={value('deliveryNotes')} onChange={(next) => setValue('deliveryNotes', next)} /></div> : null}
      {mode === 'team' ? <><div style={grid}><Field label="Mã đội" value={value('code')} onChange={(next) => setValue('code', next)} /><Field label="Tên đội" value={value('name')} onChange={(next) => setValue('name', next)} /><SelectField label="Loại đội" value={value('teamType')} onChange={(next) => setValue('teamType', next)}><option value="PRODUCTION">Sản xuất</option><option value="INSTALLATION">Lắp đặt</option><option value="SERVICE">Bảo hành</option><option value="DELIVERY">Giao hàng</option></SelectField><SelectField label="Thêm thành viên vào đội" value={value('teamId')} onChange={(next) => setValue('teamId', next)}><option value="">Không thêm thành viên</option>{context?.teams.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><SelectField label="Nhân sự" value={value('workerId')} onChange={(next) => setValue('workerId', next)}><option value="">Chọn nhân sự</option>{activeWorkers.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>)}</SelectField><Field label="Vai trò trong đội" value={value('roleName')} onChange={(next) => setValue('roleName', next)} /></div><p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>Để trống “Nhân sự” khi tạo đội mới. Khi thêm thành viên, chọn đội và nhân sự.</p></> : null}
      {mode === 'priceBook' ? <div style={grid}><Field required label="Tên bảng giá" value={value('name')} onChange={(next) => setValue('name', next)} placeholder="Chi phí xưởng 2026" /><SelectField label="Ngữ cảnh" value={value('context')} onChange={(next) => setValue('context', next)}><option value="WORKSHOP_COST">Chi phí xưởng</option><option value="INSTALLATION">Lắp đặt</option><option value="SERVICE">Bảo hành</option></SelectField><SelectField label="Tiền tệ" value={value('currency')} onChange={(next) => setValue('currency', next)}><option value="VND">VND</option></SelectField></div> : null}
      {mode === 'qc' ? <><div style={grid}><Field label="Mã mẫu" value={value('code')} onChange={(next) => setValue('code', next)} /><Field required label="Tên mẫu QC" value={value('name')} onChange={(next) => setValue('name', next)} /><SelectField label="Áp dụng cho" value={value('appliesTo')} onChange={(next) => setValue('appliesTo', next)}><option value="WORK_ORDER">Lệnh việc</option><option value="INSTALLATION">Lắp đặt</option></SelectField></div><label style={labelStyle}>Tiêu chí bắt buộc, mỗi dòng một tiêu chí<textarea value={value('criteria')} onChange={(event) => setValue('criteria', event.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} /></label></> : null}
      {mode === 'installation' ? <><div style={grid}><Field label="Mã lịch lắp đặt" value={value('code')} onChange={(next) => setValue('code', next)} /><SelectField required label="Công trình" value={value('projectId')} onChange={(next) => setValue('projectId', next)}><option value="">Chọn công trình</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><SelectField label="Đội lắp đặt" value={value('teamId')} onChange={(next) => setValue('teamId', next)}><option value="">Chưa phân đội</option>{context?.teams.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><Field label="Thời gian bắt đầu" type="datetime-local" value={value('scheduledStart')} onChange={(next) => setValue('scheduledStart', next)} /><Field label="Phương tiện" value={value('vehicleRef')} onChange={(next) => setValue('vehicleRef', next)} /><SelectField label="Mẫu QC bắt buộc" value={value('requiredQcTemplateId')} onChange={(next) => setValue('requiredQcTemplateId', next)}><option value="">Không yêu cầu mẫu riêng</option>{context?.qcTemplates.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><Field label="Số ảnh bắt buộc" type="number" value={value('requiredPhotoCount')} onChange={(next) => setValue('requiredPhotoCount', next)} /><Field label="Khách hàng nhận" value={value('customerName')} onChange={(next) => setValue('customerName', next)} /></div><div style={grid}><label style={labelStyle}>Vật tư cần xác nhận<textarea value={value('materials')} onChange={(event) => setValue('materials', event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></label><label style={labelStyle}>Dụng cụ cần xác nhận<textarea value={value('tools')} onChange={(event) => setValue('tools', event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></label></div><label style={{ ...labelStyle, display: 'flex', gridTemplateColumns: undefined, alignItems: 'center' }}><input type="checkbox" checked={form.requiresCustomerSignature !== false} onChange={(event) => setValue('requiresCustomerSignature', event.target.checked)} /> Yêu cầu chữ ký khách hàng khi hoàn tất</label></> : null}
      {mode === 'warranty' ? <div style={grid}><Field label="Mã tài sản" value={value('assetCode')} onChange={(next) => setValue('assetCode', next)} placeholder="PILOT-WA-001" /><SelectField required label="Công trình" value={value('projectId')} onChange={(next) => setValue('projectId', next)}><option value="">Chọn công trình</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><SelectField label="Đội lắp đặt" value={value('installerTeamId')} onChange={(next) => setValue('installerTeamId', next)}><option value="">Chưa xác định</option>{context?.teams.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</SelectField><Field label="Ngày lắp đặt" type="date" value={value('installedAt')} onChange={(next) => setValue('installedAt', next)} /><Field label="Thời hạn bảo hành (tháng)" type="number" value={value('warrantyMonths')} onChange={(next) => setValue('warrantyMonths', next)} /></div> : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}><button disabled={busy} type="submit" style={{ ...primaryButtonStyle, opacity: busy ? .6 : 1 }}><PackagePlus size={17} />{busy ? 'Đang lưu...' : 'Lưu dữ liệu vận hành'}</button></div>
    </form>
  </section>;
}
