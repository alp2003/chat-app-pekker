import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  eslint: {
    // Disable ESLint during builds - we handle linting separately in CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We handle TypeScript checking separately in CI
    ignoreBuildErrors: false, // Keep TypeScript errors visible
  },
};

export default nextConfig;
