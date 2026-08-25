'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, UserCog, X } from 'lucide-react';
import {
  ADMIN_MODULES,
  type AdjustPointsInput,
  type AdminUserItem,
  type CreateNppInput,
  type CreateUserInput,
  type Department,
  type UpdateUserInput,
  type UserPoints,
  type UserRole,
} from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, apiSend } from '../../src/lib/api';
import {
  eyebrowStyle,
  inputStyle,
  labelStyle,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  primaryButtonStyle,
  ghostButtonStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
  ui,
} from '../../src/ui';

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Quản trị' },
  { value: 'STAFF', label: 'Nhân viên' },
  { value: 'NPP', label: 'Nhà phân phối' },
  { value: 'DAILY', label: 'Đại lý' },
  { value: 'FACTORY', label: 'Xưởng / Thợ' },
];

type FormState = {
  id?: string;
  email: string;
  displayName: string;
  phone: string;
  role: UserRole;
  departmentId: string;
  jobTitle: string;
  isCeo: boolean;
  modules: string[];
  password: string;
};

const emptyForm: FormState = {
  email: '',
  displayName: '',
  phone: '',
  role: 'STAFF',
  departmentId: '',
  jobTitle: '',
  isCeo: false,
  modules: [],
  password: '',
};

const emptyNppForm: CreateNppInput = {
  name: '',
  code: '',
  shortLabel: '',
  province: '',
  phone: '',
  address: '',
  email: '',
  displayName: '',
  password: '',
};

export default function UsersPage() {
  return (
    <AdminPage>
      <UsersRbac />
    </AdminPage>
  );
}

function UsersRbac() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [nppForm, setNppForm] = useState<CreateNppInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pointsTarget, setPointsTarget] = useState<AdminUserItem | null>(null);

  function loadAll() {
    apiGet<AdminUserItem[]>('/admin/users').then(setUsers).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải người dùng.'));
    apiGet<Department[]>('/admin/departments').then(setDepartments).catch(() => undefined);
  }

  useEffect(loadAll, []);

  const deptName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  function openCreate() {
    setForm({ ...emptyForm });
  }

  function openCreateNpp() {
    setNppForm({ ...emptyNppForm });
  }

  function openEdit(u: AdminUserItem) {
    setForm({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      phone: u.phone,
      role: u.role,
      departmentId: u.departmentId ?? '',
      jobTitle: u.jobTitle,
      isCeo: u.isCeo,
      modules: [...u.modules],
      password: '',
    });
  }

  async function submitForm() {
    if (!form) return;
    if (!form.displayName.trim()) { setError('Vui lòng nhập tên hiển thị.'); return; }
    if (!form.id && !form.email.trim()) { setError('Vui lòng nhập email.'); return; }
    if (!form.id && form.password.trim().length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setSaving(true);
    setError('');
    try {
      if (form.id) {
        const body: UpdateUserInput = {
          displayName: form.displayName,
          phone: form.phone,
          role: form.role,
          departmentId: form.departmentId || null,
          jobTitle: form.jobTitle,
          isCeo: form.isCeo,
          modules: form.modules,
        };
        if (form.password.trim()) body.password = form.password.trim();
        await apiSend(`/admin/users/${form.id}`, 'PATCH', body);
      } else {
        const body: CreateUserInput = {
          email: form.email,
          displayName: form.displayName,
          phone: form.phone || undefined,
          role: form.role,
          departmentId: form.departmentId || undefined,
          jobTitle: form.jobTitle,
          isCeo: form.isCeo,
          modules: form.modules,
          password: form.password.trim() || undefined,
        };
        await apiSend('/admin/users', 'POST', body);
      }
      setForm(null);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được người dùng.');
    } finally {
      setSaving(false);
    }
  }

  async function submitNppForm() {
    if (!nppForm) return;
    if (!nppForm.name.trim()) { setError('Vui lòng nhập tên NPP.'); return; }
    if (!nppForm.email.trim()) { setError('Vui lòng nhập email đăng nhập NPP.'); return; }
    if (nppForm.password?.trim() && nppForm.password.trim().length < 8) { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const created = await apiSend<{ organization: { code: string; name: string }; user: AdminUserItem; password: string }>('/admin/npps', 'POST', {
        ...nppForm,
        password: nppForm.password?.trim() || undefined,
      });
      setNppForm(null);
      setMessage(`Đã tạo NPP ${created.organization.name} (${created.organization.code}). Tài khoản: ${created.user.email}. Mật khẩu bàn giao một lần: ${created.password}`);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được tài khoản NPP.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p style={eyebrowStyle}>PHÂN QUYỀN</p>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={pageTitleStyle}>Người dùng & phân quyền</h1>
          <p style={subtitleStyle}>{users.length} tài khoản · {departments.length} phòng ban. Cấp quyền truy cập từng module cho nhân sự.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
        <button style={ghostButtonStyle} onClick={openCreateNpp}>
          <Plus size={16} style={{ verticalAlign: -3, marginRight: 6 }} /> Tạo NPP
        </button>
        <button style={primaryButtonStyle} onClick={openCreate}>
          <Plus size={16} style={{ verticalAlign: -3, marginRight: 6 }} /> Thêm người dùng
        </button>
        </div>
      </div>
      {message ? <p style={{ color: ui.success, background: ui.successSoft, padding: '10px 14px', borderRadius: 10, fontWeight: 700 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, background: ui.dangerSoft, padding: '10px 14px', borderRadius: 10 }}>{error}</p> : null}

      <UsersTable users={users} deptName={deptName} onEdit={openEdit} onAdjustPoints={setPointsTarget} />

      {form ? (
        <UserFormModal
          form={form}
          setForm={setForm}
          departments={departments}
          saving={saving}
          onClose={() => setForm(null)}
          onSubmit={submitForm}
        />
      ) : null}

      {nppForm ? (
        <NppFormModal
          form={nppForm}
          setForm={setNppForm}
          saving={saving}
          onClose={() => setNppForm(null)}
          onSubmit={submitNppForm}
        />
      ) : null}

      {pointsTarget ? (
        <AdjustPointsModal
          user={pointsTarget}
          onClose={() => setPointsTarget(null)}
          onDone={() => { setPointsTarget(null); loadAll(); }}
        />
      ) : null}
    </>
  );
}
function UsersTable({
  users,
  deptName,
  onEdit,
  onAdjustPoints,
}: {
  users: AdminUserItem[];
  deptName: Map<string, string>;
  onEdit: (u: AdminUserItem) => void;
  onAdjustPoints: (u: AdminUserItem) => void;
}) {
  return (
    <div style={{ ...panelStyle, padding: 0, marginTop: 20 }}>
      <h2 style={{ ...panelTitleStyle, padding: '20px 20px 0' }}>
        <UserCog size={17} style={{ verticalAlign: -3, marginRight: 8 }} color={ui.textMuted} />
        Danh sách tài khoản
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tên hiển thị', 'Email', 'Phòng ban', 'Chức danh', 'Quyền truy cập', 'Điểm', ''].map((head) => (
                <th key={head} style={tableHeadStyle}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={{ ...tableCellStyle, fontWeight: 700 }}>
                  {user.displayName}
                  {user.isCeo ? (
                    <span style={{ marginLeft: 8, background: ui.dangerSoft, color: ui.danger, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      <ShieldCheck size={11} style={{ verticalAlign: -2, marginRight: 3 }} />CEO
                    </span>
                  ) : null}
                </td>
                <td style={tableCellStyle}>{user.email}</td>
                <td style={tableCellStyle}>{user.departmentName ?? (user.departmentId ? deptName.get(user.departmentId) : null) ?? '—'}</td>
                <td style={tableCellStyle}>{user.jobTitle || '—'}</td>
                <td style={tableCellStyle}>
                  {user.isCeo ? (
                    <span style={{ color: ui.danger, fontWeight: 700, fontSize: 12 }}>Toàn quyền</span>
                  ) : user.modules.length === 0 ? (
                    <span style={{ color: ui.textFaint, fontSize: 12 }}>Chưa cấp</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 320 }}>
                      {user.modules.map((key) => {
                        const m = ADMIN_MODULES.find((x) => x.key === key);
                        return (
                          <span key={key} style={{ background: ui.tealSoft, color: ui.teal, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                            {m?.label ?? key}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.brandText }}>
                  {user.points.toLocaleString('vi-VN')}
                </td>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...ghostButtonStyle, padding: '6px 12px', fontSize: 13 }} onClick={() => onEdit(user)}>
                      Sửa
                    </button>
                    <button style={{ ...ghostButtonStyle, padding: '6px 12px', fontSize: 13 }} onClick={() => onAdjustPoints(user)}>
                      Điểm
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NppFormModal({
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}: {
  form: CreateNppInput;
  setForm: (f: CreateNppInput) => void;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,32,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        overflowY: 'auto',
        zIndex: 50,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: '100%', maxWidth: 620, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${ui.border}` }}>
          <h2 style={{ ...panelTitleStyle, margin: 0 }}>
            <UserCog size={18} style={{ verticalAlign: -3, marginRight: 8 }} color={ui.brand} />
            Tạo nhà phân phối
          </h2>
          <button onClick={onClose} style={{ ...ghostButtonStyle, padding: 8, lineHeight: 0 }} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Tên NPP *
              <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: NPP Miền Nam" />
            </label>
            <label style={labelStyle}>
              Mã NPP (có thể để trống)
              <input style={inputStyle} value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VD: NPP-MIENNAM" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Email đăng nhập *
              <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="npp@eurohouse.vn" />
            </label>
            <label style={labelStyle}>
              Tên người phụ trách
              <input style={inputStyle} value={form.displayName || ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Để trống sẽ lấy tên NPP" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Số điện thoại
              <input style={inputStyle} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx xxx xxx" />
            </label>
            <label style={labelStyle}>
              Tỉnh/Thành
              <input style={inputStyle} value={form.province || ''} onChange={(e) => setForm({ ...form, province: e.target.value })} placeholder="VD: Hà Nội" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Ký hiệu ngắn
              <input style={inputStyle} value={form.shortLabel || ''} onChange={(e) => setForm({ ...form, shortLabel: e.target.value })} placeholder="VD: MN" />
            </label>
            <label style={labelStyle}>
              Mật khẩu (để trống để sinh tự động)
              <input style={inputStyle} type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 8 ký tự" />
            </label>
          </div>

          <label style={labelStyle}>
            Địa chỉ
            <input style={inputStyle} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Địa chỉ nhà phân phối" />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${ui.border}` }}>
          <button style={ghostButtonStyle} onClick={onClose} disabled={saving}>Hủy</button>
          <button style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }} onClick={onSubmit} disabled={saving}>
            {saving ? 'Đang tạo...' : 'Tạo NPP và tài khoản'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserFormModal({
  form,
  setForm,
  departments,
  saving,
  onClose,
  onSubmit,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  departments: Department[];
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isEdit = Boolean(form.id);

  function toggleModule(key: string) {
    const has = form.modules.includes(key);
    setForm({ ...form, modules: has ? form.modules.filter((m) => m !== key) : [...form.modules, key] });
  }

  function selectAllModules() {
    setForm({ ...form, modules: ADMIN_MODULES.map((m) => m.key) });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,32,0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
        overflowY: 'auto',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...panelStyle, width: '100%', maxWidth: 560, padding: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${ui.border}` }}>
          <h2 style={{ ...panelTitleStyle, margin: 0 }}>
            <UserCog size={18} style={{ verticalAlign: -3, marginRight: 8 }} color={ui.brand} />
            {isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}
          </h2>
          <button onClick={onClose} style={{ ...ghostButtonStyle, padding: 8, lineHeight: 0 }} aria-label="Đóng">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Email {isEdit ? '(không đổi)' : '*'}
              <input
                style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
                value={form.email}
                disabled={isEdit}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nhanvien@eurohouse.vn"
              />
            </label>
            <label style={labelStyle}>
              Tên hiển thị *
              <input style={inputStyle} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Nguyễn Văn A" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Số điện thoại
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xx xxx xxx" />
            </label>
            <label style={labelStyle}>
              Vai trò hệ thống
              <select style={inputStyle} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={labelStyle}>
              Phòng ban
              <select style={inputStyle} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">— Không thuộc phòng ban —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Chức danh
              <input style={inputStyle} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Kế toán trưởng, Nhân viên kinh doanh..." />
            </label>
          </div>

          <label style={labelStyle}>
            {isEdit ? 'Đặt lại mật khẩu (để trống nếu giữ nguyên)' : 'Mật khẩu (tối thiểu 8 ký tự)'}
            <input style={inputStyle} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${form.isCeo ? ui.brand : ui.border}`,
              background: form.isCeo ? ui.brandSoft : ui.surface,
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={form.isCeo} onChange={(e) => setForm({ ...form, isCeo: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span>
              <strong style={{ color: ui.text, fontSize: 14 }}>CEO — toàn quyền</strong>
              <span style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Bỏ qua mọi kiểm tra quyền module. Chỉ cấp cho lãnh đạo.</span>
            </span>
          </label>

          {!form.isCeo ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ ...labelStyle, margin: 0 }}>Quyền truy cập module</span>
                <button type="button" style={{ ...ghostButtonStyle, padding: '4px 10px', fontSize: 12 }} onClick={selectAllModules}>
                  Chọn tất cả
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ADMIN_MODULES.map((m) => {
                  const checked = form.modules.includes(m.key);
                  return (
                    <label
                      key={m.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: `1px solid ${checked ? ui.teal : ui.border}`,
                        background: checked ? ui.tealSoft : ui.surface,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: ui.text,
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleModule(m.key)} />
                      {m.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${ui.border}` }}>
          <button style={ghostButtonStyle} onClick={onClose} disabled={saving}>Huỷ</button>
          <button style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }} onClick={onSubmit} disabled={saving}>
            {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo người dùng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustPointsModal({ user, onClose, onDone }: { user: AdminUserItem; onClose: () => void; onDone: () => void }) {
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!delta) { setError('Số điểm điều chỉnh phải khác 0.'); return; }
    setSaving(true);
    setError('');
    try {
      const body: AdjustPointsInput = { delta, note: note.trim() || undefined };
      await apiSend<UserPoints>(`/admin/users/${user.id}/points`, 'PATCH', body);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không điều chỉnh được điểm.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,32,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto', zIndex: 50 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ ...panelStyle, width: '100%', maxWidth: 440, padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${ui.border}` }}>
          <h2 style={{ ...panelTitleStyle, margin: 0 }}>Điều chỉnh điểm</h2>
          <button onClick={onClose} style={{ ...ghostButtonStyle, padding: 8, lineHeight: 0 }} aria-label="Đóng"><X size={16} /></button>
        </div>

        <div style={{ padding: 22, display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, color: ui.textMuted, fontSize: 14 }}>
            {user.displayName} · số dư hiện tại <strong style={{ color: ui.brandText }}>{user.points.toLocaleString('vi-VN')}</strong> điểm
          </p>
          <label style={labelStyle}>
            Số điểm cộng (+) hoặc trừ (−)
            <input style={inputStyle} type="number" value={delta} onChange={(e) => setDelta(Math.trunc(Number(e.target.value)))} placeholder="Ví dụ: 100 hoặc -50" />
          </label>
          <label style={labelStyle}>
            Ghi chú (lý do)
            <input style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thưởng chương trình, điều chỉnh sai sót..." />
          </label>
          {delta ? (
            <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>
              Số dư sau điều chỉnh: <strong style={{ color: ui.text }}>{(user.points + delta).toLocaleString('vi-VN')}</strong> điểm
            </p>
          ) : null}
          {error ? <p style={{ color: ui.danger, background: ui.dangerSoft, padding: '10px 14px', borderRadius: 10, margin: 0 }}>{error}</p> : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: `1px solid ${ui.border}` }}>
          <button style={ghostButtonStyle} onClick={onClose} disabled={saving}>Huỷ</button>
          <button style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }} onClick={submit} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu điều chỉnh'}
          </button>
        </div>
      </div>
    </div>
  );
}
