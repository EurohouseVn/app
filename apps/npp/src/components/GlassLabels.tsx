'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export type LabelSize = { widthMm: number; heightMm: number };

export type GlassLabelData = {
  barcode: string;
  widthMm: number;
  heightMm: number;
  glassType?: string;
  location?: string;
  kindLabel?: string;
};

export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 50, heightMm: 30 };
const LABEL_SIZE_KEY = 'eurohouse-npp-label-size';

export function loadLabelSize(): LabelSize {
  if (typeof window === 'undefined') return DEFAULT_LABEL_SIZE;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LABEL_SIZE_KEY) ?? 'null') as Partial<LabelSize> | null;
    const widthMm = Number(parsed?.widthMm);
    const heightMm = Number(parsed?.heightMm);
    if (widthMm >= 20 && widthMm <= 200 && heightMm >= 15 && heightMm <= 200) return { widthMm, heightMm };
  } catch {
    // dùng khổ mặc định nếu dữ liệu lưu bị hỏng
  }
  return DEFAULT_LABEL_SIZE;
}

export function saveLabelSize(size: LabelSize) {
  if (typeof window !== 'undefined') window.localStorage.setItem(LABEL_SIZE_KEY, JSON.stringify(size));
}

/** Mã vạch Code 128 dạng SVG: nét sắc ở mọi cỡ in, không phụ thuộc phông. */
export function BarcodeSvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2 });
      ref.current.removeAttribute('width');
      ref.current.removeAttribute('height');
      ref.current.setAttribute('preserveAspectRatio', 'none');
    } catch {
      // giá trị không mã hóa được thì để trống, giao diện đã chặn dữ liệu sai trước đó
    }
  }, [value]);
  return <svg ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} aria-label={`Mã vạch ${value}`} />;
}

/** Một nhãn: mã vạch, mã bằng chữ, kích thước chữ lớn, loại kính và vị trí. Đơn vị mm để in đúng khổ tem. */
export function GlassLabel({ data, size }: { data: GlassLabelData; size: LabelSize }) {
  const unit = Math.min(size.widthMm, size.heightMm);
  const dimsText = `${data.widthMm} × ${data.heightMm} mm`;
  // Cỡ chữ theo chiều cao tem nhưng thu nhỏ khi dòng quá dài so với bề rộng tem, để không bị cắt chữ khi in.
  const innerWidth = size.widthMm - unit * 0.14;
  const fit = (ratio: number, text: string, charWidth: number) => Math.min(unit * ratio, innerWidth / (Math.max(text.length, 1) * charWidth));
  // Hệ số bề rộng chữ lấy theo đo thực tế trên trình duyệt (phông thay thế rộng hơn Arial), chừa dư để máy khác không bị cắt chữ.
  const dimsFont = fit(0.24, dimsText, 0.7);
  const codeFont = fit(0.15, data.barcode, 0.66);
  const sub = [data.glassType, data.kindLabel, data.location].filter(Boolean).join(' · ');
  return (
    <div
      className="eh-label"
      style={{
        width: `${size.widthMm}mm`,
        height: `${size.heightMm}mm`,
        boxSizing: 'border-box',
        padding: `${unit * 0.05}mm ${unit * 0.07}mm`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${unit * 0.02}mm`,
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div style={{ flex: '1 1 52%', minHeight: 0 }}><BarcodeSvg value={data.barcode} /></div>
      <div style={{ fontFamily: 'Consolas, "Courier New", monospace', fontSize: `${codeFont}mm`, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap' }}>{data.barcode}</div>
      <div style={{ fontSize: `${dimsFont}mm`, fontWeight: 800, lineHeight: 1.05, textAlign: 'center', whiteSpace: 'nowrap' }}>{dimsText}</div>
      {sub ? <div style={{ fontSize: `${unit * 0.12}mm`, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div> : null}
    </div>
  );
}

/**
 * Vùng in: ẩn trên màn hình, khi bấm in chỉ vùng này hiện và mỗi nhãn là một trang đúng khổ tem.
 * Khổ giấy lấy từ cài đặt khổ tem của NPP.
 */
export function GlassLabelPrintSheet({ labels, size }: { labels: GlassLabelData[]; size: LabelSize }) {
  return (
    <>
      <style>{`
        #eh-label-print-root { display: none; }
        @media print {
          @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #eh-label-print-root, #eh-label-print-root * { visibility: visible !important; }
          #eh-label-print-root { display: block; position: absolute; left: 0; top: 0; }
          #eh-label-print-root .eh-label { break-after: page; page-break-after: always; }
          #eh-label-print-root .eh-label:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <div id="eh-label-print-root" aria-hidden="true">
        {labels.map((label, index) => <GlassLabel key={`${label.barcode}-${index}`} data={label} size={size} />)}
      </div>
    </>
  );
}
