/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: isProd ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@nut-tree-fork/nut-js', '@nut-tree/nut-js', '@nut-tree-fork/libnut', 'libnut'],
  // Required for Electron to load static assets via file:// in prod
  assetPrefix: isProd ? './' : '',
};

export default nextConfig;
