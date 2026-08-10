'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle, primaryButtonStyle } from '../../../src/ui';
import { Search, PieChart, Activity, Factory } from 'lucide-react';

const mockFactories = [
  { id: '1', name: 'Xưởng Nhôm Kính Đức Thiện', province: 'Hà Nội', npp: 'NPP Minh Tuấn', 
    power: { Euroqueen: 70, Kollham: 20, Ecento: 10 }, totalScore: 85, status: 'Active' },
  { id: '2', name: 'Xưởng Hoàng Nam', province: 'Hải Phòng', npp: 'NPP Hùng Dũng', 
    power: { Euroqueen: 40, Kollham: 10, Ecento: 50 }, totalScore: 60, status: 'At Risk' },
  { id: '3', name: 'Xưởng Tiến Đạt', province: 'Quảng Ninh', npp: 'NPP Hoàng Gia', 
    power: { Euroqueen: 90, Kollham: 10, Ecento: 0 }, totalScore: 92, status: 'Loyal' },
];

export default function FactoriesPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Phân Tích Xưởng Sản Xuất</h1>
          <p style={subtitleStyle}>Đo lường sức mua, thị hiếu hệ nhôm và mức độ trung thành của thợ</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 24 }}>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.brand }}>
            <Factory size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.textMuted, marginBottom: 4 }}>Tổng Số Xưởng Đang Mua</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>1,245</div>
          </div>
        </div>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308' }}>
            <PieChart size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.textMuted, marginBottom: 4 }}>Dòng Nhôm Chuộng Nhất</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>Euroqueen <span style={{fontSize: 14, fontWeight: 400}}>(65%)</span></div>
          </div>
        </div>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.danger }}>
            <Activity size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.danger, marginBottom: 4 }}>Xưởng Giảm Sức Mua</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>42 <span style={{fontSize: 12, fontWeight: 400}}>(Cần chăm sóc)</span></div>
          </div>
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 16, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color={ui.textFaint} style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              placeholder="Tìm kiếm xưởng..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                background: ui.bg,
                border: `1px solid ${ui.border}`,
                color: ui.text,
                borderRadius: 8,
                outline: 'none',
                fontSize: 14,
              }}
            />
          </div>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)', color: ui.textMuted, fontSize: 12, textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Tên Xưởng & NPP Quản lý</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Phân Tích Sức Mua (Dòng Hàng)</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'center' }}>Điểm Tiềm Năng</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            {mockFactories.map((fac) => (
              <tr key={fac.id} style={{ borderBottom: `1px solid ${ui.border}` }}>
                <td style={{ padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, color: ui.text, marginBottom: 4 }}>{fac.name}</div>
                  <div style={{ fontSize: 12, color: ui.textMuted }}>Nhập qua: <span style={{color: ui.brandText}}>{fac.npp}</span></div>
                </td>
                <td style={{ padding: '16px 20px', width: '40%' }}>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${fac.power.Euroqueen}%`, background: '#FFD700' }} title={`Euroqueen: ${fac.power.Euroqueen}%`} />
                    <div style={{ width: `${fac.power.Kollham}%`, background: '#C0C0C0' }} title={`Kollham: ${fac.power.Kollham}%`} />
                    <div style={{ width: `${fac.power.Ecento}%`, background: '#38BDF8' }} title={`Ecento: ${fac.power.Ecento}%`} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: ui.textFaint }}>
                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><div style={{width:8,height:8,borderRadius:4,background:'#FFD700'}}/> EQ ({fac.power.Euroqueen}%)</span>
                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><div style={{width:8,height:8,borderRadius:4,background:'#C0C0C0'}}/> Kol ({fac.power.Kollham}%)</span>
                    <span style={{display: 'flex', alignItems: 'center', gap: 4}}><div style={{width:8,height:8,borderRadius:4,background:'#38BDF8'}}/> Ecento ({fac.power.Ecento}%)</span>
                  </div>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 20, 
                    border: `2px solid ${fac.totalScore > 80 ? ui.success : (fac.totalScore > 60 ? '#eab308' : ui.danger)}`,
                    fontWeight: 700, fontSize: 13,
                    color: fac.totalScore > 80 ? ui.success : (fac.totalScore > 60 ? '#eab308' : ui.danger)
                  }}>
                    {fac.totalScore}
                  </div>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                  <span style={{ 
                    padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                    background: fac.status === 'Loyal' ? 'rgba(34,197,94,0.1)' : (fac.status === 'At Risk' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'),
                    color: fac.status === 'Loyal' ? ui.success : (fac.status === 'At Risk' ? ui.danger : ui.textMuted)
                  }}>
                    {fac.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
