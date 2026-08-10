'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

export default function CashflowPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={pageTitleStyle}>Sổ Quỹ Thu Chi</h1>
        <p style={subtitleStyle}>Quản lý dòng tiền, lập phiếu thu, phiếu chi nội bộ</p>
      </div>
      <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💸</div>
        <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Module đang được phát triển</h2>
        <p>Chúng ta sẽ đi sâu vào logic duyệt phiếu chi và liên kết quỹ sau.</p>
      </div>
    </div>
  );
}
