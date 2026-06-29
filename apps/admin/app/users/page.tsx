'use client';

import { useEffect, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { AdminUserItem, OrgItem, UserRole } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet } from '../../src/lib/api';
import {
  eyebrowStyle,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
} from '../../src/ui';

const roleMeta: Record<UserRole, { label: string; color: string }> = {
  ADMIN: { label: 'Quản trị', color: colors.brandRed },
  STAFF: { label: 'Nhân viên', color: colors.brandBlack },
  NPP: { label: 'Nhà phân phối', color: colors.success },
  DAILY: { label: 'Đại lý', color: colors.brandOrange },
  FACTORY: { label: 'Xưởng / Thợ', color: colors.warning },
};

const orgTypeLabel: Record<string, string> = {
  COMPANY: 'Công ty',
  FACTORY: 'Xưởng',
  NPP: 'Nhà phân phối',
  DEALER: 'Đại lý',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<AdminUserItem[]>('/admin/users').then(setUsers).catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải người dùng.'));
    apiGet<OrgItem[]>('/admin/orgs').then(setOrgs).catch(() => undefined);
  }, []);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>NGƯỜI DÙNG</p>
      <h1 style={pageTitleStyle}>Người dùng & tổ chức</h1>
      <p style={subtitleStyle}>{users.length} tài khoản · {orgs.length} đơn vị (công ty, xưởng, NPP, đại lý).</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      {/* Tổ chức */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, margin: '12px 0 24px' }}>
        {orgs.map((org) => (
          <div key={org.id} style={{ ...panelStyle, padding: 18 }}>
            <small style={{ color: colors.brandOrange, fontWeight: 900 }}>{orgTypeLabel[org.type] ?? org.type}</small>
            <strong style={{ display: 'block', fontSize: 17, margin: '6px 0 2px' }}>{org.name}</strong>
            <p style={{ margin: 0, color: colors.brandGrey, fontSize: 13 }}>{org.phone || '—'}</p>
            <p style={{ margin: '8px 0 0', color: colors.brandBlack, fontWeight: 800 }}>{org.userCount} người dùng</p>
          </div>
        ))}
      </div>

      {/* Người dùng */}
      <div style={panelStyle}>
        <h2 style={panelTitleStyle}>Danh sách tài khoản</h2>
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
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 800 }}>{user.displayName}</td>
                  <td style={tableCellStyle}>{user.email}</td>
                  <td style={tableCellStyle}>{user.phone || '—'}</td>
                  <td style={tableCellStyle}>
                    <span style={{ color: roleMeta[user.role]?.color ?? colors.brandBlack, fontWeight: 900 }}>
                      {roleMeta[user.role]?.label ?? user.role}
                    </span>
                  </td>
                  <td style={tableCellStyle}>{user.organizationName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPage>
  );
}
