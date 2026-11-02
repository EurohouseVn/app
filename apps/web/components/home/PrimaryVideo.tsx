'use client';

import Image from 'next/image';
import { Play } from 'lucide-react';
import { useState } from 'react';
import type { HomepageVideo } from '@/lib/homepage-content';
import { homepageCopy } from '@/lib/homepage-presentation';

const fallbackVideo: HomepageVideo = {
  id: 'factory-line-2026',
  slug: 'day-chuyen-nha-may-eurohouse',
  title: 'Bên trong dây chuyền sản xuất EUROHOUSE',
  summary: 'Tư liệu thực tế ghi lại một công đoạn trên dây chuyền xử lý profile tại nhà máy.',
  url: '/media/eurohouse-factory-line.mp4',
  posterUrl: '/media/eurohouse-factory-line-poster.webp',
  altText: 'Dây chuyền xử lý profile nhôm trong nhà máy EUROHOUSE',
  caption: 'Tư liệu nhà máy EUROHOUSE, cập nhật năm 2026.',
  transcript: homepageCopy.videoTranscript,
};

export function PrimaryVideo({ video = fallbackVideo }: { video?: HomepageVideo }) {
  const [ready, setReady] = useState(false);

  return (
    <section className="home-section video-section" id="video" data-home-chapter="video" aria-labelledby="video-heading">
      <div className="container video-layout" data-reveal-group>
        <div className="video-copy" data-reveal-item>
          <p className="home-eyebrow">{homepageCopy.video.eyebrow}</p>
          <h2 id="video-heading">{homepageCopy.video.title}</h2>
          <p>{homepageCopy.video.support}</p>
          <p className="video-title"><strong>{video.title}</strong> {video.summary}</p>
          <p className="video-transcript"><strong>Nội dung video:</strong> {video.transcript}</p>
        </div>
        <figure className="video-frame" data-reveal-item>
          {ready ? (
            <video controls autoPlay muted playsInline preload="metadata" poster={video.posterUrl} aria-label={video.altText}>
              <source src={video.url} type="video/mp4" />
              Trình duyệt của bạn chưa hỗ trợ video HTML5.
            </video>
          ) : (
            <button type="button" className="video-poster" onClick={() => setReady(true)} aria-label={`Phát video: ${video.title}`}>
              <Image src={video.posterUrl} alt={video.altText} fill unoptimized sizes="(max-width: 860px) 100vw, 58vw" />
              <span><Play size={24} fill="currentColor" aria-hidden="true" /></span>
            </button>
          )}
          <figcaption>{video.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}
