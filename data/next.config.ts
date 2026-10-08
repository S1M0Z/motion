import type { NextConfig } from 'next';
const config: NextConfig = {
  turbopack: { root: __dirname },
  serverExternalPackages: ['sharp', 'tsx', '@remotion/renderer', '@remotion/bundler'],
  experimental: { proxyClientMaxBodySize: '32mb' },
};
export default config;
