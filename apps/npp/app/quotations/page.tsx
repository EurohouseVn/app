'use client';

// Quotations List Page

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, Search, Trash2, Download, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import type { QuotationRecord } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiBlob, apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';
import { useRouter } from 'next/navigation';

type PaginatedQuotations = { items: QuotationRecord[]; total: number; page: number; pageSize: number };

export default function NppQuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const pageSize = 10;

  const load = useCallback((targetPage: number, query: string = '') => {
    const q = `?page=${targetPage}&pageSize=${pageSize}${query ? `&q=${query}` : ''}`;
    apiGet<PaginatedQuotations>(`/quotations${q}`)
      .then((res) => {
        setQuotations(res.items);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Không tải được báo giá.'));
  }, []);

  useEffect(() => { load(1, search); }, [load, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xoá báo giá này?')) return;
    try {
      await apiSend(`/quotations/${id}`, 'DELETE');
      load(page, search);
    } catch (e) {
      alert('Lỗi khi xoá báo giá');
    }
  };

  const handleDownloadExcel = async (id: string, code: string) => {
    try {
      const rec = await apiGet<QuotationRecord>(`/quotations/${id}`);
      const rows: any[] = [];
      rows.push(['STT', 'Ký hiệu', 'Loại cửa - Quy cách', 'Rộng', 'Cao', 'Diện tích', 'SL', 'Đơn giá', 'Thành tiền']);
      
      rec.items.forEach((it, idx) => {
        let quyCach = it.doorType;
        if (it.system) quyCach += `\n- Hệ: ${it.system}`;
        if (it.color) quyCach += `\n- Màu: ${it.color}`;
        
        rows.push([idx + 1, it.name, quyCach, it.widthMm, it.heightMm, it.areaM2, it.quantity, it.pricePerM2, it.totalPrice]);
        
        const phaoName = (it.dynamicInputs as any)?.phaoDinhName;
        if (phaoName && phaoName !== 'Không' && (!rec.extraProducts || !rec.extraProducts.some(e => e.name === phaoName))) {
          rows.push(['', '', `+ ${phaoName}`, '', '', `${(it.dynamicInputs as any).phaoDinhLength} md`, '', Number((it.dynamicInputs as any).phaoDinhPrice), Number((it.dynamicInputs as any).phaoDinhAmount || 0)]);
        }
      });

      if (rec.extraProducts && rec.extraProducts.length > 0) {
        rows.push(['', '', 'SẢN PHẨM GIA TĂNG & PHỤ KIỆN', '', '', '', '', '', '']);
        rec.extraProducts.forEach(ep => {
          rows.push(['', ep.name, `+ ${ep.name}`, '', '', `${ep.quantity} ${ep.unit || 'md'}`, '', ep.unitPrice, ep.totalPrice || (ep.quantity * ep.unitPrice)]);
        });
      }

      rows.push(['', '', '', '', '', '', '', 'Tổng cộng:', rec.totalAmount]);
      
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BaoGia');
      XLSX.writeFile(wb, `BaoGia_${code}.xlsx`);
    } catch (e) {
      alert('Lỗi xuất Excel');
    }
  };

  const handleDownloadPdf = async (id: string, code: string) => {
    try {
      const blob = await apiBlob(`/quotations/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoGia_${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Lỗi tải PDF');
    }
  };

  return (
    <NppPage>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={eyebrowStyle}>BÁO GIÁ</p>
          <h1 style={pageTitleStyle}>Quản lý Báo giá</h1>
          <p style={subtitleStyle}>Tạo và quản lý các báo giá dự toán gửi khách hàng.</p>
        </div>
        <button 
          onClick={() => router.push('/quotations/create')}
          style={{ background: ui.brand, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Plus size={16} /> Tạo Báo Giá
        </button>
      </div>

      {message ? (
        <p style={{ color: ui.danger, fontWeight: 700, background: ui.dangerSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>
          {message}
        </p>
      ) : null}

      <div style={{ ...panelStyle, marginTop: 24, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: ui.surfaceMuted, borderRadius: 8, padding: '0 12px', flex: 1, maxWidth: 300 }}>
            <Search size={16} color={ui.textMuted} />
            <input 
              placeholder="Tìm theo mã hoặc tên KH..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', padding: '10px 8px', fontSize: 14, width: '100%' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Mã Báo Giá</th>
              <th style={tableHeadStyle}>Khách hàng</th>
              <th style={tableHeadStyle}>Ngày tạo</th>
              <th style={tableHeadStyle}>Số hạng mục</th>
              <th style={tableHeadStyle}>Tổng giá trị</th>
              <th style={tableHeadStyle}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map(q => (
              <tr key={q.id} style={{ transition: 'background 0.2s' }}>
                <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                  <Link href={`/quotations/${q.id}`} style={{ color: ui.brand, textDecoration: 'none' }}>
                    {q.code}
                  </Link>
                </td>
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: 600 }}>{q.customerName}</div>
                  {q.customerPhone && <div style={{ fontSize: 12, color: ui.textMuted }}>{q.customerPhone}</div>}
                </td>
                <td style={tableCellStyle}>{new Date(q.createdAt).toLocaleDateString('vi-VN')}</td>
                <td style={tableCellStyle}>{q.items?.length || 0} mục</td>
                <td style={{ ...tableCellStyle, color: ui.danger, fontWeight: 700 }}>{currency(q.totalAmount)}</td>
                <td style={tableCellStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => {
                      try {
                        const proj = await apiSend<any>(`/quotations/${q.id}/convert-to-project`, 'POST');
                        alert(`Đã chuyển Báo giá ${q.code} thành Công trình ${proj.code}!`);
                        router.push('/projects');
                      } catch (e) {
                        alert('Lỗi chuyển thành công trình');
                      }
                    }} style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <FileText size={14} /> Công trình
                    </button>
                    <button onClick={() => handleDownloadExcel(q.id, q.code)} style={{ background: ui.successSoft, color: ui.success, border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Table size={14} /> Excel
                    </button>
                    <button onClick={() => handleDownloadPdf(q.id, q.code)} style={{ background: ui.blueSoft, color: ui.blue, border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Download size={14} /> PDF
                    </button>
                    <button onClick={() => handleDelete(q.id)} style={{ background: ui.dangerSoft, color: ui.danger, border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {quotations.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: ui.textMuted }}>Chưa có báo giá nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </NppPage>
  );
}
