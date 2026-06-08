import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['sanity', 'next-sanity', '@sanity/vision'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
  webpack: (config) => {
    // sanity 5.x imports useEffectEvent from react directly (React 19.2 native API).
    // Webpack's static CJS-to-ESM export analysis can't find it because react/index.js
    // uses a conditional require webpack can't resolve at analysis time.
    // useEffectEvent IS in React 19.2.7 at runtime — the check is a false negative.
    config.module ??= {};
    config.module.parser ??= {};
    config.module.parser.javascript ??= {};
    config.module.parser.javascript.exportsPresence = false;
    return config;
  },
};

export default nextConfig;
