'use client';
import React from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle, primaryButtonStyle } from '../../../src/ui';

export default function ProjectsPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={pageTitleStyle}>Quản Lý Mảng Dự Án (B2B)</h1>
          <p style={subtitleStyle}>Danh sách dự án tham gia, tiến độ, quy mô và NVKD phụ trách</p>
        </div>
        <button style={primaryButtonStyle}>+ Tạo Dự Án Mới</button>
      </div>
      <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
        <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Màn hình đang được hoàn thiện</h2>
        <p>Giao diện chi tiết cho việc quản lý các dự án (Quy mô, Tiềm năng, Doanh thu, Dòng hàng...) sẽ được cập nhật tại đây.</p>
      </div>
    </div>
  );
}
