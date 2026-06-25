import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@eurohouse/ui', '@eurohouse/types'],
};

export default nextConfig;
