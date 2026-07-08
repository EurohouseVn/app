import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@eurohouse/ui', '@eurohouse/types'],
  images: { unoptimized: true },
};

export default nextConfig;
