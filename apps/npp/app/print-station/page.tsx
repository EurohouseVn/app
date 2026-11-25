'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, Power } from 'lucide-react';
import type { NppPrintJobItem, NppPrintJobWithLabels } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiRequest } from '../../src/lib/api';
import { DEFAULT_LABEL_SIZE, GlassLabelPrintSheet, loadLabelSize, type LabelSize } from '../../src/components/GlassLabels';
import { chipStyle, eyebrowStyle, ghostButtonStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, ui } from '../../src/ui';

const RUNNING_KEY = 'eurohouse-npp-print-station-on';
const POLL_MS = 3000;
const PRINT_TIMEOUT_MS = 60_000;
const STATUS_LABEL = { QUEUED: 'Chờ', CLAIMED: 'Đang in', PRINTED: 'Đã in', FAILED: 'Lỗi' } as const;
const STATUS_TONE = { QUEUED: 'warning', CLAIMED: 'warning', PRINTED: 'success', FAILED: 'danger' } as const;

/**
 * Trạm in: máy tính nối máy in tem mở trang này và để đó. Điện thoại gửi lệnh in, trạm nhận và in ra.
 * Chrome chạy với tùy chọn --kiosk-printing thì in thẳng không hiện hộp thoại; không có tùy chọn đó vẫn in được nhưng phải bấm In mỗi lệnh.
 */
export default function NppPrintStationPage() {
  const [running, setRunning] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>(DEFAULT_LABEL_SIZE);
  const [current, setCurrent] = useState<NppPrintJobWithLabels | null>(null);
  const [jobs, setJobs] = useState<NppPrintJobItem[]>([]);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    setLabelSize(loadLabelSize());
    setRunning(window.localStorage.getItem(RUNNING_KEY) === '1');
  }, []);

  const loadJobs = useCallback(() => { apiGet<NppPrintJobItem[]>('/npp/print-jobs').then(setJobs).catch(() => undefined); }, []);

  useEffect(() => {
    if (!running) return undefined;
    const tick = async () => {
      if (busy.current) return;
      try {
        const result = await apiRequest<{ job: NppPrintJobWithLabels | null }>('/npp/print-station/poll', 'POST');
        setError(result.ok ? '' : `Trạm in không hỏi được lệnh (lỗi ${result.status}).`);
        if (result.ok && result.data?.job) {
          busy.current = true;
          setLabelSize(loadLabelSize());
          setCurrent(result.data.job);
        }
        loadJobs();
      } catch {
        setError('Mất kết nối tới máy chủ, trạm in sẽ thử lại.');
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [running, loadJobs]);

  // Có lệnh: vẽ nhãn rồi mở in, báo xong khi trình duyệt phát sự kiện afterprint (hoặc quá 60 giây thì báo lỗi).
  useEffect(() => {
    if (!current) return undefined;
    let finished = false;
    const finish = async (ok: boolean, message?: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(guard);
      await apiRequest(`/npp/print-jobs/${current.id}/complete`, 'POST', { ok, error: message }).catch(() => undefined);
      setCurrent(null);
      busy.current = false;
      loadJobs();
    };
    const onAfter = () => void finish(true);
    window.addEventListener('afterprint', onAfter, { once: true });
    const guard = window.setTimeout(() => void finish(false, 'Không nhận được xác nhận từ hộp thoại in'), PRINT_TIMEOUT_MS);
    const start = window.setTimeout(() => {
      try { window.print(); } catch { void finish(false, 'Trình duyệt không mở được hộp thoại in'); }
    }, 500);
    return () => { window.clearTimeout(start); window.clearTimeout(guard); window.removeEventListener('afterprint', onAfter); };
  }, [current, loadJobs]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  function toggle() {
    const next = !running;
    setRunning(next);
    window.localStorage.setItem(RUNNING_KEY, next ? '1' : '0');
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Trạm in</p>
      <h1 style={pageTitleStyle}>Trạm in nhãn mã vạch</h1>
      <p style={subtitleStyle}>Để trang này mở trên máy tính nối máy in tem. Điện thoại bấm in thì nhãn tự ra ở máy in này.</p>
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <section style={{ ...panelStyle, marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={toggle} style={running ? { ...ghostButtonStyle, color: ui.danger } : primaryButtonStyle}><Power size={16} /> {running ? 'Tắt trạm in' : 'Bật trạm in'}</button>
        <span style={chipStyle(running ? 'success' : 'warning')}>{running ? 'Đang trực, hỏi lệnh mỗi 3 giây' : 'Đang tắt'}</span>
        <span style={{ color: ui.textMuted, fontSize: 13 }}>Khổ tem {labelSize.widthMm} × {labelSize.heightMm} mm (đổi ở trang Kính)</span>
        {current ? <span style={{ color: ui.brandText, fontWeight: 700 }}><Printer size={14} style={{ verticalAlign: 'text-bottom' }} /> Đang in {current.labelCount} nhãn…</span> : null}
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={{ margin: '0 0 8px', color: ui.text, fontSize: 16 }}>Cài để in thẳng, không hiện hộp thoại</h2>
        <ol style={{ margin: 0, paddingLeft: 20, color: ui.textMuted, fontSize: 14, lineHeight: 1.7 }}>
          <li>Đặt máy in tem làm máy in mặc định của Windows, chọn đúng khổ giấy tem trong cài đặt máy in.</li>
          <li>Tạo lối tắt Chrome chạy với tùy chọn <code>--kiosk-printing</code>, ví dụ <code>chrome.exe --kiosk-printing --app=địa-chỉ-web-NPP/print-station</code>.</li>
          <li>Đăng nhập, bấm <strong>Bật trạm in</strong> và để cửa sổ đó mở, đừng thu nhỏ quá lâu (Chrome làm chậm trang bị ẩn).</li>
          <li>Không dùng tùy chọn trên thì vẫn in được, nhưng mỗi lệnh phải bấm In trong hộp thoại.</li>
        </ol>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={{ margin: '0 0 8px', color: ui.text, fontSize: 16 }}>Lệnh in gần đây</h2>
        <div style={{ display: 'grid', gap: 6 }}>
          {jobs.map((job) => (
            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, border: `1px solid ${ui.border}`, borderRadius: 10, padding: '8px 12px', fontSize: 14 }}>
              <span>{job.labelCount} nhãn · {new Date(job.createdAt).toLocaleString('vi-VN')}{job.error ? ` · ${job.error}` : ''}</span>
              <span style={chipStyle(STATUS_TONE[job.status])}>{STATUS_LABEL[job.status]}</span>
            </div>
          ))}
          {jobs.length === 0 ? <p style={{ color: ui.textFaint, margin: 0, fontSize: 13 }}>Chưa có lệnh in nào.</p> : null}
        </div>
      </section>

      <GlassLabelPrintSheet labels={current?.labels ?? []} size={labelSize} />
    </NppPage>
  );
}
