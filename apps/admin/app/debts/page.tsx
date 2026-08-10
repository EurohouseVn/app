'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

export default function DebtsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={pageTitleStyle}>Quản Lý Công Nợ</h1>
        <p style={subtitleStyle}>Theo dõi công nợ Phải Thu (Đại lý, NPP) và Phải Trả (Nhà cung cấp)</p>
      </div>
      <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📒</div>
        <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Module đang được phát triển</h2>
        <p>Chúng ta sẽ đi sâu vào logic đối soát công nợ, gạch nợ sau.</p>
      </div>
    </div>
  );
}
