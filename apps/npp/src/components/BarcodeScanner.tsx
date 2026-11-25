'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Bật hoặc tắt camera. Tắt thì giải phóng hẳn camera của điện thoại. */
  active: boolean;
  onDetect: (text: string) => void;
};

type DetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (options: { formats: string[] }) => DetectorLike;

const REPEAT_BLOCK_MS = 1500;

/**
 * Quét mã vạch Code 128 bằng camera điện thoại.
 * Dùng BarcodeDetector có sẵn của trình duyệt (Chrome trên Android); nơi nào không có (Safari trên iPhone) thì
 * mới tải thư viện ZXing. Cùng một mã quét liên tiếp trong 1,5 giây chỉ tính một lần.
 */
export function BarcodeScanner({ active, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopZxing: (() => void) | undefined;
    let last = { text: '', at: 0 };

    const emit = (text: string) => {
      const now = Date.now();
      if (text === last.text && now - last.at < REPEAT_BLOCK_MS) return;
      last = { text, at: now };
      onDetectRef.current(text);
    };

    async function start() {
      setStatus('starting');
      setError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setError('Trình duyệt không cho dùng camera. Cần mở trang bằng HTTPS (hoặc localhost) và cho phép camera.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        setStatus('error');
        const name = (e as { name?: string }).name;
        setError(name === 'NotAllowedError' ? 'Chưa được cấp quyền camera. Hãy cho phép camera cho trang này rồi bật lại.' : 'Không mở được camera.');
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play().catch(() => undefined);
      setStatus('running');

      const Detector = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (Detector) {
        const detector = new Detector({ formats: ['code_128'] });
        timer = window.setInterval(async () => {
          if (video.readyState < 2) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) emit(codes[0].rawValue);
          } catch {
            // khung hình lỗi thì bỏ qua, thử lại ở lần sau
          }
        }, 180);
        return;
      }
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
      const controls = await reader.decodeFromStream(stream, video, (result) => { if (result) emit(result.getText()); });
      stopZxing = () => controls.stop();
    }

    void start();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active]);

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#10151c', aspectRatio: '4 / 3', display: 'grid', placeItems: 'center' }}>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: status === 'running' ? 'block' : 'none' }} />
      {status === 'running' ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: '30% 8%', border: '2px solid rgba(247,144,9,0.95)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.28)' }} />
      ) : (
        <p style={{ color: '#c9d1dc', fontSize: 14, textAlign: 'center', margin: 0, padding: 18, lineHeight: 1.5 }}>
          {status === 'starting' ? 'Đang mở camera…' : status === 'error' ? error : 'Camera đang tắt. Bấm "Bật camera" để quét mã.'}
        </p>
      )}
    </div>
  );
}
