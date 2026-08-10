'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle, primaryButtonStyle } from '../../../src/ui';
import { Search, Plus, Trophy, MapPin, TrendingUp, AlertCircle } from 'lucide-react';

const mockDistributors = [
  { id: '1', name: 'NPP Minh Tuấn', province: 'Hà Nội', tier: 'Vàng', revenue: 15000000000, target: 15000000000, factories: 45 },
  { id: '2', name: 'NPP Hùng Dũng', province: 'Hải Phòng', tier: 'Bạc', revenue: 7500000000, target: 10000000000, factories: 28 },
  { id: '3', name: 'Đại Lý Cấp 1 Trường Thành', province: 'Thái Bình', tier: 'Đồng', revenue: 2000000000, target: 5000000000, factories: 12 },
  { id: '4', name: 'NPP Hoàng Gia', province: 'Quảng Ninh', tier: 'Bạc', revenue: 8000000000, target: 8000000000, factories: 30 },
];

function getTierColor(tier: string) {
  switch(tier) {
    case 'Vàng': return '#FFD700';
    case 'Bạc': return '#C0C0C0';
    case 'Đồng': return '#CD7F32';
    default: return ui.textMuted;
  }
}

export default function DistributorsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Quản Lý Nhà Phân Phối</h1>
          <p style={subtitleStyle}>Theo dõi doanh số, xếp hạng và kích cầu đại lý</p>
        </div>
        <button style={primaryButtonStyle}><Plus size={16} /> Thêm NPP Mới</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 24 }}>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700' }}>
            <Trophy size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.textMuted, marginBottom: 4 }}>Tổng NPP Hạng Vàng</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>1 / 4</div>
          </div>
        </div>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.brand }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.textMuted, marginBottom: 4 }}>Trung bình Đạt KPI</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>75%</div>
          </div>
        </div>
        <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 16, border: `1px solid ${ui.danger}` }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ui.danger }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: ui.danger, marginBottom: 4 }}>Cần Kích Cầu Ngay</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: ui.text }}>1 NPP <span style={{fontSize: 12, fontWeight: 400}}>(Dưới 50% KPI)</span></div>
          </div>
        </div>
      </div>

      <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 16, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color={ui.textFaint} style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              placeholder="Tìm kiếm NPP..."
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
          <select
            style={{
              padding: '8px 16px',
              background: ui.bg,
              border: `1px solid ${ui.border}`,
              color: ui.text,
              borderRadius: 8,
              outline: 'none',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="">Lọc theo Xếp hạng</option>
            <option value="Vàng">Hạng Vàng</option>
            <option value="Bạc">Hạng Bạc</option>
            <option value="Đồng">Hạng Đồng</option>
          </select>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)', color: ui.textMuted, fontSize: 12, textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Tên NPP</th>
              <th style={{ padding: '16px 20px', fontWeight: 600 }}>Xếp hạng</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Xưởng Trực Thuộc</th>
              <th style={{ padding: '16px 20px', fontWeight: 600, width: '35%' }}>Tiến Độ KPI Doanh Số</th>
            </tr>
          </thead>
          <tbody>
            {mockDistributors.map((npp) => {
              const percent = Math.min(100, Math.round((npp.revenue / npp.target) * 100));
              const isWarning = percent < 60;
              
              return (
                <tr key={npp.id} style={{ borderBottom: `1px solid ${ui.border}` }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, color: ui.text, marginBottom: 4 }}>{npp.name}</div>
                    <div style={{ fontSize: 12, color: ui.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} /> {npp.province}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ 
                      display: 'inline-block', 
                      padding: '4px 12px', 
                      borderRadius: 12, 
                      fontSize: 12, 
                      fontWeight: 700, 
                      color: '#000',
                      background: getTierColor(npp.tier) 
                    }}>
                      Hạng {npp.tier}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600 }}>
                    {npp.factories} xưởng
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: isWarning ? ui.danger : ui.textMuted }}>{(npp.revenue / 1000000000).toFixed(1)} Tỷ</span>
                      <span style={{ color: ui.textFaint }}>Mục tiêu: {(npp.target / 1000000000).toFixed(1)} Tỷ</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: isWarning ? ui.danger : (percent >= 100 ? ui.success : ui.brand),
                        borderRadius: 3 
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: isWarning ? ui.danger : ui.textFaint, marginTop: 4, textAlign: 'right' }}>
                      {percent}% {isWarning && '- Gợi ý Kích Cầu'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
