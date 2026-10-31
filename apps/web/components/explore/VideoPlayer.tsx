'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import { useState } from 'react';
import type { PublicVideo } from '@/lib/explore-data';

export function VideoPlayer({ video }: { video: PublicVideo }) {
  const [ready, setReady] = useState(false);
  return <figure className={`library-video-frame is-${video.orientation}`}>
    {ready ? <video controls autoPlay muted playsInline preload="metadata" poster={video.posterUrl} aria-label={video.title}><source src={video.url} type="video/mp4" />Trình duyệt chưa hỗ trợ video HTML5.</video> : <button type="button" onClick={() => setReady(true)} aria-label={`Phát video: ${video.title}`}><Image src={video.posterUrl} alt="" fill unoptimized sizes="(max-width: 800px) 100vw, 70vw" /><span><Play size={24} fill="currentColor" aria-hidden="true" /></span></button>}
    <figcaption>{video.caption}</figcaption>
  </figure>;
}
