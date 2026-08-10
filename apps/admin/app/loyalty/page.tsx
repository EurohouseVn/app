'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle } from '../../src/ui';

export default function LoyaltyPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={pageTitleStyle}>Tích Điểm Đổi Quà (Loyalty)</h1>
        <p style={subtitleStyle}>Chương trình chăm sóc NPP, Đại lý, và Thợ nhôm</p>
      </div>
      <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
        <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Module đang được phát triển</h2>
        <p>Chúng ta sẽ đi sâu vào logic tính điểm và xét duyệt trả thưởng sau.</p>
      </div>
    </div>
  );
}
