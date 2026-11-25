'use client';

import { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { apiGet, apiSend } from '../lib/api';
import { chipStyle, ghostButtonStyle, panelStyle, ui } from '../ui';

type Device = { id: string; kind: 'DESKTOP' | 'PHONE'; label: string; createdAt: string; lastSeenAt: string; current: boolean };

const LIMITS = { DESKTOP: 2, PHONE: 3 } as const;

/** Thiết bị đang đăng nhập của NPP: tối đa 2 máy tính và 3 điện thoại; đăng xuất từ xa một máy để nhường chỗ. */
export function DeviceSessionsPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    apiGet<Device[]>('/npp/devices').then((items) => { setDevices(items); setError(''); }).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được danh sách thiết bị.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(device: Device) {
    setBusyId(device.id);
    try {
      await apiSend(`/npp/devices/${device.id}`, 'DELETE');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đăng xuất được thiết bị.');
    } finally {
      setBusyId('');
    }
  }

  const count = (kind: Device['kind']) => devices.filter((d) => d.kind === kind).length;

  return (
    <section style={{ ...panelStyle, marginTop: 24 }} aria-label="Thiết bị đang đăng nhập">
      <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 18 }}>Thiết bị đang đăng nhập</h2>
      <p style={{ margin: '0 0 14px', color: ui.textMuted, fontSize: 13, lineHeight: 1.5 }}>
        Mỗi nhà phân phối đăng nhập song song tối đa 2 máy tính và 3 điện thoại. Máy tính {count('DESKTOP')}/{LIMITS.DESKTOP}, điện thoại {count('PHONE')}/{LIMITS.PHONE}. Đăng xuất một máy ở đây để nhường chỗ cho máy khác.
      </p>
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700, fontSize: 13 }}>{error}</p> : null}
      <div style={{ display: 'grid', gap: 8 }}>
        {devices.map((device) => (
          <div key={device.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${ui.border}`, borderRadius: 12, padding: '10px 14px' }}>
            {device.kind === 'PHONE' ? <Smartphone size={20} color={ui.brand} /> : <Laptop size={20} color={ui.brand} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ color: ui.text, fontSize: 14 }}>{device.label || (device.kind === 'PHONE' ? 'Điện thoại' : 'Máy tính')}</strong>{' '}
              {device.current ? <span style={chipStyle('success')}>Máy này</span> : null}
              <div style={{ color: ui.textMuted, fontSize: 12 }}>Đăng nhập {new Date(device.createdAt).toLocaleString('vi-VN')} · dùng lần cuối {new Date(device.lastSeenAt).toLocaleString('vi-VN')}</div>
            </div>
            <button onClick={() => void revoke(device)} disabled={busyId === device.id} style={ghostButtonStyle} title={device.current ? 'Đăng xuất máy này' : 'Đăng xuất từ xa'}>
              <LogOut size={14} /> {device.current ? 'Đăng xuất' : 'Gỡ'}
            </button>
          </div>
        ))}
        {devices.length === 0 && !error ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Chưa có thiết bị nào (token đăng nhập cũ không gắn thiết bị; đăng nhập lại để được theo dõi).</p> : null}
      </div>
    </section>
  );
}
