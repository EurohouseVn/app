'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { galleryCategories, galleryPhotos, type GalleryCategory } from '@/lib/project-gallery';

export function ProjectGallery() {
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all');
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const photos = useMemo(
    () => (category === 'all' ? galleryPhotos : galleryPhotos.filter((photo) => photo.category === category)),
    [category],
  );
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: galleryPhotos.length };
    for (const photo of galleryPhotos) result[photo.category] = (result[photo.category] ?? 0) + 1;
    return result;
  }, []);

  const show = useCallback((index: number) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setOpen(index);
  }, []);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((current) => (current === null ? null : (current + delta + photos.length) % photos.length)),
    [photos.length],
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

  const current = open !== null ? photos[open] : null;

  return (
    <div className="pg">
      <div className="pg-filters" role="group" aria-label="Lọc ảnh công trình">
        {galleryCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            onClick={() => {
              setCategory(item.id);
              setOpen(null);
            }}
          >
            {item.label}
            <span>{counts[item.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <ul className="pg-grid" aria-live="polite">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button type="button" className="pg-item" onClick={() => show(index)} aria-label={`Xem lớn: ${photo.title}`}>
              <Image
                src={photo.src}
                alt={photo.title}
                width={photo.width}
                height={photo.height}
                unoptimized
                sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"
                loading={index < 8 ? 'eager' : 'lazy'}
              />
              <span className="pg-caption">
                <strong>{photo.title}</strong>
                {photo.finish ? <small>{photo.finish}</small> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="pg-dialog"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        aria-label={current?.title ?? 'Ảnh công trình'}
      >
        {current ? (
          <figure>
            <Image src={current.src} alt={current.title} width={current.width} height={current.height} unoptimized sizes="100vw" />
            <figcaption>
              <strong>{current.title}</strong>
              <span>
                {(open ?? 0) + 1} / {photos.length}
              </span>
            </figcaption>
          </figure>
        ) : null}
        <button type="button" className="pg-close" onClick={close} aria-label="Đóng">
          <X size={22} aria-hidden="true" />
        </button>
        <button type="button" className="pg-prev" onClick={() => step(-1)} aria-label="Ảnh trước">
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
        <button type="button" className="pg-next" onClick={() => step(1)} aria-label="Ảnh sau">
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      </dialog>
    </div>
  );
}
