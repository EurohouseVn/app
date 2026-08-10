'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, primaryButtonStyle } from '../../../src/ui';

interface WorkOrderStep {
  id: string;
  stepName: string;
  status: string;
  inputKg: number;
  outputKg: number;
  scrapKg: number;
  workOrder: {
    code: string;
    profile: { code: string; name: string };
  };
}

export default function ShopFloorPage() {
  const [currentStepName, setCurrentStepName] = useState('EXTRUSION');
  const [steps, setSteps] = useState<WorkOrderStep[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states for completion
  const [showModal, setShowModal] = useState<string | null>(null);
  const [inputKg, setInputKg] = useState('');
  const [outputKg, setOutputKg] = useState('');
  const [scrapKg, setScrapKg] = useState('');

  useEffect(() => {
    fetchSteps(currentStepName);
  }, [currentStepName]);

  async function fetchSteps(s: string) {
    setLoading(true);
    try {
      const data = await apiGet<WorkOrderStep[]>(`/admin/production/shop-floor?stepName=${s}`);
      setSteps(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(id: string) {
    try {
      await apiSend(`/admin/production/shop-floor/start/${id}`, 'PATCH', { machineCode: 'M01', workerName: 'Kiosk User' });
      await fetchSteps(currentStepName);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!showModal) return;
    try {
      await apiSend(`/admin/production/shop-floor/complete/${showModal}`, 'PATCH', {
        inputKg: Number(inputKg),
        outputKg: Number(outputKg),
        scrapKg: Number(scrapKg)
      });
      setShowModal(null);
      setInputKg('');
      setOutputKg('');
      setScrapKg('');
      await fetchSteps(currentStepName);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const stepLabels: Record<string, string> = {
    EXTRUSION: '1. Đùn ép',
    AGING: '2. Hóa già',
    COATING: '3. Sơn/Mạ',
    PACKING: '4. Đóng gói'
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ ...pageTitleStyle, fontSize: 32 }}>Màn Hình Phân Xưởng (Kiosk)</h1>
        <p style={{ color: ui.textMuted, fontSize: 18 }}>Cập nhật tiến độ sản xuất theo thời gian thực</p>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
        {Object.entries(stepLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCurrentStepName(key)}
            style={{
              padding: '16px 32px',
              fontSize: 18,
              fontWeight: 700,
              borderRadius: 12,
              border: `2px solid ${currentStepName === key ? ui.brand : ui.border}`,
              background: currentStepName === key ? ui.brandSoft : ui.bg,
              color: currentStepName === key ? ui.brandText : ui.text,
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1' }}>Đang tải...</div>
        ) : steps.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1', color: ui.textMuted, fontSize: 18 }}>
            Không có lệnh nào đang chờ ở công đoạn này.
          </div>
        ) : steps.map(s => (
          <div key={s.id} style={{ ...panelStyle, padding: 24, borderLeft: `6px solid ${s.status === 'IN_PROGRESS' ? ui.warning : ui.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: ui.brandText }}>{s.workOrder.code}</span>
              <span style={{ padding: '4px 12px', borderRadius: 20, background: s.status === 'IN_PROGRESS' ? ui.warning : ui.surfaceMuted, color: s.status === 'IN_PROGRESS' ? '#fff' : ui.text, fontWeight: 700 }}>
                {s.status === 'IN_PROGRESS' ? 'Đang chạy' : 'Chờ làm'}
              </span>
            </div>
            
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Mã: {s.workOrder.profile.code}</div>
            <div style={{ fontSize: 16, color: ui.textMuted, marginBottom: 24 }}>{s.workOrder.profile.name}</div>

            {s.status === 'PENDING' ? (
              <button onClick={() => handleStart(s.id)} style={{ ...primaryButtonStyle, width: '100%', padding: '16px 0', fontSize: 20 }}>
                ▶ Bắt Đầu
              </button>
            ) : (
              <button onClick={() => setShowModal(s.id)} style={{ width: '100%', padding: '16px 0', fontSize: 20, background: ui.success, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                ✔ Báo Cáo Hoàn Thành
              </button>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ ...panelStyle, width: 600, padding: 32 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, textAlign: 'center' }}>Nhập Số Liệu ({stepLabels[currentStepName]})</h2>
            <form onSubmit={handleComplete} style={{ display: 'grid', gap: 24 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 18 }}>Nguyên liệu đầu vào (Kg)</label>
                <input type="number" required value={inputKg} onChange={e => setInputKg(e.target.value)} style={{ width: '100%', padding: 16, fontSize: 24, borderRadius: 12, border: `2px solid ${ui.border}`, textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 18, color: ui.success }}>Thành phẩm đạt QC (Kg)</label>
                <input type="number" required value={outputKg} onChange={e => setOutputKg(e.target.value)} style={{ width: '100%', padding: 16, fontSize: 24, borderRadius: 12, border: `2px solid ${ui.success}`, textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 18, color: ui.danger }}>Phế phẩm / Hao hụt (Kg)</label>
                <input type="number" required value={scrapKg} onChange={e => setScrapKg(e.target.value)} style={{ width: '100%', padding: 16, fontSize: 24, borderRadius: 12, border: `2px solid ${ui.danger}`, textAlign: 'center' }} />
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(null)} style={{ flex: 1, padding: 20, fontSize: 20, background: ui.surfaceMuted, border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
                <button type="submit" style={{ flex: 1, padding: 20, fontSize: 20, background: ui.success, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Xác nhận Xong</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
