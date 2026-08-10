'use client';
import React, { useState } from 'react';
import { ui, pageTitleStyle, panelStyle, subtitleStyle, primaryButtonStyle, ghostButtonStyle } from '../../../src/ui';
import { Plus, Edit2, Download, Search, CheckCircle2 } from 'lucide-react';

const mockPrices = [
  { id: '1', brand: 'EUROQUEEN', color: 'CAFE', retail: 148900, dealer: 145900, npp: 142400 },
  { id: '2', brand: 'EUROQUEEN', color: 'TRẮNG SỨ', retail: 149900, dealer: 146900, npp: 143400 },
  { id: '3', brand: 'EUROQUEEN', color: 'HỆ THỦY LỰC', retail: 172900, dealer: 167400, npp: 162400 },
  { id: '4', brand: 'KOLLHAM TITANIUM', color: 'CAFE METALIC', retail: 149900, dealer: 147400, npp: 143900 },
  { id: '5', brand: 'KOLLHAM TITANIUM', color: 'XÁM NGỌC TRAI', retail: 149900, dealer: 147400, npp: 143900 },
];

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<'PRICE_LIST' | 'QUOTATION'>('PRICE_LIST');

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Bảng Giá & Báo Giá (B2B)</h1>
          <p style={subtitleStyle}>Quản lý giá bán sỉ/lẻ theo kg và xuất báo giá nhôm + phụ kiện</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={ghostButtonStyle}><Download size={16} /> Xuất Excel</button>
          <button style={primaryButtonStyle}><Plus size={16} /> Thêm Cấu Hình Giá</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1px solid ${ui.border}` }}>
        <button
          onClick={() => setActiveTab('PRICE_LIST')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'PRICE_LIST' ? `2px solid ${ui.brand}` : '2px solid transparent',
            color: activeTab === 'PRICE_LIST' ? ui.brandText : ui.textMuted,
            fontWeight: activeTab === 'PRICE_LIST' ? 700 : 600,
            cursor: 'pointer',
            fontSize: 15,
            transition: 'all 0.2s',
          }}
        >
          Bảng Giá Bán (VND/kg)
        </button>
        <button
          onClick={() => setActiveTab('QUOTATION')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'QUOTATION' ? `2px solid ${ui.brand}` : '2px solid transparent',
            color: activeTab === 'QUOTATION' ? ui.brandText : ui.textMuted,
            fontWeight: activeTab === 'QUOTATION' ? 700 : 600,
            cursor: 'pointer',
            fontSize: 15,
            transition: 'all 0.2s',
          }}
        >
          Tạo Báo Giá Khách Hàng
        </button>
      </div>

      {activeTab === 'PRICE_LIST' ? (
        <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 16, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} color={ui.textFaint} style={{ position: 'absolute', left: 12, top: 10 }} />
              <input
                type="text"
                placeholder="Tìm nhãn hiệu, màu sắc..."
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
              <option value="">Tất cả Nhãn hiệu</option>
              <option value="EUROQUEEN">EUROQUEEN</option>
              <option value="KOLLHAM TITANIUM">KOLLHAM TITANIUM</option>
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead style={{ background: 'rgba(255,255,255,0.03)', color: ui.textMuted, fontSize: 12, textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Nhãn Hiệu</th>
                <th style={{ padding: '16px 20px', fontWeight: 600 }}>Màu Sắc</th>
                <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Giá NPP (VNĐ)</th>
                <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Giá Đại Lý (VNĐ)</th>
                <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>Giá Bán Lẻ (VNĐ)</th>
                <th style={{ padding: '16px 20px', fontWeight: 600, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {mockPrices.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${ui.border}`, transition: 'background 0.2s' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{item.brand}</td>
                  <td style={{ padding: '16px 20px', color: ui.textMuted }}>{item.color}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: ui.success }}>{item.npp.toLocaleString()} đ</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: ui.brand }}>{item.dealer.toLocaleString()} đ</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', color: ui.textMuted }}>{item.retail.toLocaleString()} đ</td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', color: ui.textFaint, cursor: 'pointer' }}>
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '16px 20px', color: ui.textFaint, fontSize: 13, background: 'rgba(255,255,255,0.01)' }}>
            Lưu ý: Bảng giá đã bao gồm VAT 10%. Sản lượng cam kết tính từ thời điểm NPP/Đại lý ký hợp đồng.
          </div>
        </div>
      ) : (
        <div style={{ ...panelStyle, padding: 40, textAlign: 'center', color: ui.textMuted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📑</div>
          <h2 style={{ fontSize: 20, color: ui.text, marginBottom: 8 }}>Công Cụ Tạo Báo Giá Đang Xây Dựng</h2>
          <p>Khu vực này sẽ cho phép bạn chọn Khách hàng, chọn Nhôm (kg), Phụ kiện, tự động tính tổng tiền VND và xuất PDF gửi cho NPP/Đại lý.</p>
        </div>
      )}
    </div>
  );
}
