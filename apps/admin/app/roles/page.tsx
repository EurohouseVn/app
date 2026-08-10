'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, primaryButtonStyle, ghostButtonStyle, subtitleStyle } from '../../src/ui';
import { ADMIN_MODULES } from '@eurohouse/types';

interface RoleItem {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
}

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  async function fetchRoles() {
    setLoading(true);
    try {
      const data = await apiGet<RoleItem[]>('/admin/roles');
      setRoles(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingId(null);
    setName('');
    setDescription('');
    setPermissions([]);
    setShowModal(true);
  }

  function handleEdit(role: RoleItem) {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description);
    setPermissions(role.permissions || []);
    setShowModal(true);
  }

  async function handleDelete(role: RoleItem) {
    if (role.userCount > 0) {
      alert('Không thể xóa chức danh đang có người dùng.');
      return;
    }
    if (!confirm(`Xóa chức danh ${role.name}?`)) return;
    try {
      await apiSend(`/admin/roles/${role.id}`, 'DELETE');
      await fetchRoles();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiSend(`/admin/roles/${editingId}`, 'PATCH', { name, description, permissions });
      } else {
        await apiSend('/admin/roles', 'POST', { name, description, permissions });
      }
      setShowModal(false);
      await fetchRoles();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(key: string) {
    if (permissions.includes(key)) {
      setPermissions(permissions.filter((p) => p !== key));
    } else {
      setPermissions([...permissions, key]);
    }
  }

  if (loading && roles.length === 0) {
    return <div style={{ padding: 24 }}>Đang tải...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Quản lý Chức danh</h1>
          <p style={subtitleStyle}>Phân quyền động (Dynamic RBAC) cho người dùng hệ thống</p>
        </div>
        <button onClick={handleCreate} style={primaryButtonStyle}>+ Thêm Chức danh</button>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Tên chức danh</th>
              <th style={tableHeadStyle}>Mô tả</th>
              <th style={tableHeadStyle}>Quyền hạn (Modules)</th>
              <th style={tableHeadStyle}>Nhân sự</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.brandText }}>{r.name}</td>
                <td style={tableCellStyle}>{r.description || '-'}</td>
                <td style={{ ...tableCellStyle, fontSize: 13, color: ui.textMuted }}>
                  {r.permissions.length === 0 ? 'Chưa có quyền' : r.permissions.map(p => {
                    const m = ADMIN_MODULES.find(m => m.key === p);
                    return m ? m.label : p;
                  }).join(', ')}
                </td>
                <td style={tableCellStyle}>{r.userCount} người</td>
                <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                  <button onClick={() => handleEdit(r)} style={{ ...ghostButtonStyle, marginRight: 8, padding: '6px 12px', fontSize: 12 }}>Sửa</button>
                  <button onClick={() => handleDelete(r)} style={{ ...ghostButtonStyle, padding: '6px 12px', fontSize: 12, color: ui.danger, background: 'rgba(239, 68, 68, 0.05)' }}>Xóa</button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint, padding: 40 }}>
                  Chưa có dữ liệu chức danh.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...panelStyle, width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: ui.text }}>
              {editingId ? 'Cập nhật Chức danh' : 'Thêm Chức danh'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Tên chức danh <span style={{color: ui.danger}}>*</span></label>
                <input
                  autoFocus
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}
                  placeholder="VD: Kế toán trưởng"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Mô tả</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${ui.border}`, background: ui.bg, outline: 'none' }}
                  placeholder="Mô tả công việc chung..."
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 14 }}>Cấp quyền truy cập (Modules)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, border: `1px solid ${ui.border}`, borderRadius: 8, background: ui.bg }}>
                  {ADMIN_MODULES.map((m) => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: ui.text }}>
                      <input 
                        type="checkbox" 
                        checked={permissions.includes(m.key)}
                        onChange={() => togglePermission(m.key)}
                        style={{ width: 16, height: 16, accentColor: ui.brand }}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} style={ghostButtonStyle}>Hủy</button>
                <button type="submit" disabled={saving} style={primaryButtonStyle}>{saving ? 'Đang lưu...' : 'Lưu lại'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
