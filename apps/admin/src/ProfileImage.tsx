'use client';

import { useState } from 'react';
import { ui } from './ui';
import { assetUrl } from './lib/api';

// Ảnh mặt cắt thanh nhôm cho bảng danh mục. Thiếu ảnh / lỗi tải -> ô fallback.
export function ProfileImage({ imageUrl, size = 46 }: { imageUrl?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(imageUrl);
  const show = src && !failed;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: ui.surfaceMuted,
        border: `1px solid ${ui.border}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {show ? (
        <img
          src={src}
          alt=""
          width={size - 4}
          height={size - 4}
          style={{ objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ color: ui.textFaint, fontSize: 10, fontWeight: 700 }}>N/A</span>
      )}
    </span>
  );
}
