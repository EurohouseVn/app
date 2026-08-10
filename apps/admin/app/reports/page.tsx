'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

export default function ReportsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={pageTitleStyle}>Báo Cáo Tài Chính</h1>
        <p style={subtitleStyle}>Báo cáo kết quả hoạt động kinh doanh (P&L), cân đối kế toán</p>
      </div>
      <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Module đang được phát triển</h2>
        <p>Chúng ta sẽ đi sâu vào logic tổng hợp dữ liệu báo cáo sau.</p>
      </div>
    </div>
  );
}
