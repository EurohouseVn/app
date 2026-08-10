'use client';
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, subtitleStyle } from '../../../src/ui';

interface DashboardStats {
  yieldRate: number;
  totalActual: number;
  totalScrap: number;
  activeWosCount: number;
  diesRequiringMaintenance: number;
}

export default function ProductionDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiGet<DashboardStats>('/admin/production/dashboard')
      .then(setStats)
      .catch(e => alert(e.message));
  }, []);

  if (!stats) return <div style={{ padding: 40, textAlign: 'center' }}>Đang tải báo cáo...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={pageTitleStyle}>Báo Cáo Hiệu Suất Sản Xuất (OEE)</h1>
        <p style={subtitleStyle}>Chỉ số thống kê dựa trên các lệnh sản xuất đã hoàn thành toàn trình</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 24 }}>
        
        {/* Thẻ 1: Tỷ lệ Yield */}
        <div style={{ ...panelStyle, padding: 24, background: `linear-gradient(135deg, ${ui.brandSoft} 0%, ${ui.bg} 100%)`, border: `1px solid ${ui.brand}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.brandText, textTransform: 'uppercase', marginBottom: 8 }}>
            Tỷ lệ thành phẩm (Yield)
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: ui.brandText }}>
            {stats.yieldRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: 13, color: ui.textMuted, marginTop: 8 }}>
            Mục tiêu: {'>'} 80%
          </div>
        </div>

        {/* Thẻ 2: Sản lượng đạt */}
        <div style={{ ...panelStyle, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
            Tổng thành phẩm
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: ui.success }}>
            {stats.totalActual.toLocaleString('vi-VN')} <span style={{ fontSize: 16 }}>kg</span>
          </div>
          <div style={{ fontSize: 13, color: ui.textMuted, marginTop: 8 }}>
            Đã nhập kho an toàn
          </div>
        </div>

        {/* Thẻ 3: Phế thải */}
        <div style={{ ...panelStyle, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
            Hao hụt (Scrap)
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: ui.danger }}>
            {stats.totalScrap.toLocaleString('vi-VN')} <span style={{ fontSize: 16 }}>kg</span>
          </div>
          <div style={{ fontSize: 13, color: ui.textMuted, marginTop: 8 }}>
            Cần đem đun lại
          </div>
        </div>

        {/* Thẻ 4: Cảnh báo */}
        <div style={{ ...panelStyle, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
            Lệnh đang chạy
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: ui.text }}>
            {stats.activeWosCount}
          </div>
          <div style={{ fontSize: 13, color: stats.diesRequiringMaintenance > 0 ? ui.danger : ui.textMuted, marginTop: 8, fontWeight: stats.diesRequiringMaintenance > 0 ? 600 : 400 }}>
            {stats.diesRequiringMaintenance} khuôn cần bảo trì
          </div>
        </div>

      </div>
    </div>
  );
}
