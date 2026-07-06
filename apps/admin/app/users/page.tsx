'use client';

import { useEffect, useState } from 'react';
import { Building, Factory, ShieldCheck, Store, Truck, UserCog } from 'lucide-react';
import type { AdminUserItem, OrgItem, UserRole } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, inputStyle, pageTitleStyle, panelStyle, panelTitleStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const roleMeta: Record<UserRole, { label: string; fg: string; soft: string }> = {
  ADMIN: { label: 'Quản trị', fg: ui.danger, soft: ui.dangerSoft },
  STAFF: { label: 'Nhân viên', fg: ui.text, soft: ui.surfaceMuted },
  NPP: { label: 'Nhà phân phối', fg: ui.success, soft: ui.successSoft },
  DAILY: { label: 'Đại lý', fg: ui.brand, soft: ui.brandSoft },
  FACTORY: { label: 'Xưởng / Thợ', fg: ui.warning, soft: ui.warningSoft },
};

const orgTypeMeta: Record<string, { label: string; icon: typeof Building }> = {
  COMPANY: { label: 'Công ty', icon: Building },
  FACTORY: { label: 'Xưởng', icon: Factory },
  NPP: { label: 'Nhà phân phối', icon: Truck },
  DEALER: { label: 'Đại lý', icon: Store },
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [error, setError] = useState('');
  const [shortLabelDraft, setShortLabelDraft] = useState<Record<string, string>>({});

  function loadOrgs() {
    apiGet<OrgItem[]>('/admin/orgs').then(setOrgs).catch(() => undefined);
  }

  useEffect(() => {
    apiGet<AdminUserItem[]>('/admin/users').then(setUsers).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải người dùng.'));
    loadOrgs();
  }, []);

  const nppOrgs = orgs.filter((o) => o.type === 'NPP');

  async function assignNpp(orgId: string, managedByNppId: string) {
    try {
      await apiSend(`/admin/orgs/${orgId}`, 'PATCH', { managedByNppId: managedByNppId || null });
      loadOrgs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gán được NPP quản lý.');
    }
  }

  async function saveShortLabel(orgId: string) {
    const value = shortLabelDraft[orgId];
    if (value === undefined) return;
    try {
      await apiSend(`/admin/orgs/${orgId}`, 'PATCH', { shortLabel: value.trim() || null });
      loadOrgs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được ký hiệu xưởng.');
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>NGƯỜI DÙNG</p>
      <h1 style={pageTitleStyle}>Người dùng & tổ chức</h1>
      <p style={subtitleStyle}>{users.length} tài khoản · {orgs.length} đơn vị (công ty, xưởng, NPP, đại lý).</p>
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      {/* Tổ chức */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, margin: '12px 0 24px' }}>
        {orgs.map((org) => {
          const meta = orgTypeMeta[org.type] ?? { label: org.type, icon: Building };
          const Icon = meta.icon;
          return (
            <div key={org.id} style={{ ...panelStyle, padding: 18 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: ui.tealSoft,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} color={ui.teal} />
              </span>
              <small style={{ display: 'block', color: ui.brandText, fontWeight: 700, marginTop: 12, fontSize: 12 }}>{meta.label}</small>
              <strong style={{ display: 'block', fontSize: 16, margin: '4px 0 2px', color: ui.text }}>{org.name}</strong>
              <p style={{ margin: 0, color: ui.textFaint, fontSize: 13 }}>{org.phone || '—'}</p>
              <p style={{ margin: '10px 0 0', color: ui.text, fontWeight: 700, fontSize: 13 }}>{org.userCount} người dùng</p>
              {org.type === 'FACTORY' ? (
                <>
                  <label style={{ display: 'block', marginTop: 12 }}>
                    <span style={{ display: 'block', color: ui.textFaint, fontSize: 11, marginBottom: 4 }}>NPP quản lý</span>
                    <select
                      style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
                      value={org.managedByNppId ?? ''}
                      onChange={(e) => assignNpp(org.id, e.target.value)}
                    >
                      <option value="">— Chưa gán —</option>
                      {nppOrgs.map((npp) => (
                        <option key={npp.id} value={npp.id}>{npp.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'block', marginTop: 10 }}>
                    <span style={{ display: 'block', color: ui.textFaint, fontSize: 11, marginBottom: 4 }}>Ký hiệu xưởng (dùng để sinh mã đơn)</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        style={{ ...inputStyle, fontSize: 12, padding: '6px 8px', flex: 1 }}
                        placeholder="ví dụ: X.MinhViet"
                        value={shortLabelDraft[org.id] ?? org.shortLabel ?? ''}
                        onChange={(e) => setShortLabelDraft((cur) => ({ ...cur, [org.id]: e.target.value }))}
                        onBlur={() => saveShortLabel(org.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveShortLabel(org.id); }}
                      />
                    </div>
                  </label>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Người dùng */}
      <div style={{ ...panelStyle, padding: 0 }}>
        <h2 style={{ ...panelTitleStyle, padding: '20px 20px 0' }}>
          <UserCog size={17} style={{ verticalAlign: -3, marginRight: 8 }} color={ui.textMuted} />
          Danh sách tài khoản
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tên hiển thị', 'Email', 'Điện thoại', 'Vai trò', 'Đơn vị'].map((head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const meta = roleMeta[user.role];
                return (
                  <tr key={user.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 700 }}>{user.displayName}</td>
                    <td style={tableCellStyle}>{user.email}</td>
                    <td style={tableCellStyle}>{user.phone || '—'}</td>
                    <td style={tableCellStyle}>
                      <span style={{ background: meta?.soft, color: meta?.fg, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {user.role === 'ADMIN' ? <ShieldCheck size={12} /> : null}
                        {meta?.label ?? user.role}
                      </span>
                    </td>
                    <td style={tableCellStyle}>{user.organizationName ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
