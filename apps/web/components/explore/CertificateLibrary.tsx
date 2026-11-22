'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { certificateGroups, certificates } from '@/lib/certificates';

export function CertificateLibrary() {
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const show = useCallback((index: number) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen(index);
  }, []);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((current) => (current === null ? null : (current + delta + certificates.length) % certificates.length)),
    [],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open !== null && !dialog.open) dialog.showModal();
    if (open === null && dialog.open) {
      dialog.close();
      lastFocus.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const current = open !== null ? certificates[open] : null;

  return (
    <div className="cl">
      <nav className="cl-nav" aria-label="Nhóm chứng nhận">
        {certificateGroups.map((group) => (
          <a key={group.id} href={`#cn-${group.id}`}>
            {group.title}
            <span>{certificates.filter((c) => c.group === group.id).length}</span>
          </a>
        ))}
      </nav>
      {certificateGroups.map((group) => (
        <section key={group.id} id={`cn-${group.id}`} className="cl-group" aria-labelledby={`cn-h-${group.id}`}>
          <header>
            <h3 id={`cn-h-${group.id}`}>{group.title}</h3>
            <p>{group.summary}</p>
          </header>
          <ul className="cl-grid">
            {certificates.map((item, index) =>
              item.group !== group.id ? null : (
                <li key={item.id} className="cl-card">
                  <button type="button" className="cl-thumb" onClick={() => show(index)} aria-label={`Xem lớn: ${item.title}`}>
                    <Image src={item.image} alt={item.title} width={923} height={1336} unoptimized sizes="(max-width: 700px) 90vw, (max-width: 1100px) 33vw, 22vw" loading="lazy" />
                  </button>
                  <div className="cl-body">
                    <h4>{item.title}</h4>
                    <p className="cl-issuer">{item.issuer}</p>
                    <dl>
                      {item.facts.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <a className="cl-download" href={item.image} download={`eurohouse-${item.id}.webp`}>
                      <Download size={16} aria-hidden="true" /> Tải ảnh giấy chứng nhận
                    </a>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
      <dialog
        ref={dialogRef}
        className="pg-dialog"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        aria-label={current?.title ?? 'Giấy chứng nhận'}
      >
        {current ? (
          <figure>
            <Image src={current.image} alt={current.title} width={923} height={1336} unoptimized sizes="100vw" />
            <figcaption>
              <strong>{current.title}</strong>
              <span>
                {(open ?? 0) + 1} / {certificates.length}
              </span>
            </figcaption>
          </figure>
        ) : null}
        <button type="button" className="pg-close" onClick={close} aria-label="Đóng">
          <X size={22} aria-hidden="true" />
        </button>
        <button type="button" className="pg-prev" onClick={() => step(-1)} aria-label="Giấy trước">
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <button type="button" className="pg-next" onClick={() => step(1)} aria-label="Giấy sau">
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      </dialog>
    </div>
  );
}
