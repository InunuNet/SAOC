import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Local dev is reached at https://dev.saoc.co.za (see scripts/install-dev-domain.sh and
  // the `dev:secure` script). Without this, Next refuses that origin's dev requests because
  // it is not localhost. Dev-only — it has no effect on a production build.
  allowedDevOrigins: ['dev.saoc.co.za'],
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
  async redirects() {
    return [
      {
        source: '/events.ics',
        destination: '/api/events.ics',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
