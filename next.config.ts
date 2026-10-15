import type { NextConfig } from 'next';

// Server traces must carry only what the server reads. lib/data/show-pages.ts is the one
// runtime fs reader (content/drive-recovered); everything below is private, tooling, or
// client source documents and must never reach the App Hosting image.
const NEVER_SHIP = [
  'content/drive-source/**',
  'content/drive-watch/**',
  'documents/**',
  'docs/**',
  'execution/**',
  'contracts/**',
  'template/**',
  'scripts/**',
  'design/**',
  'design spec/**',
  'branding/**',
  'Plans/**',
  'MEMORY/**',
  'e2e/**',
  'functions/**',
  'test-results/**',
  '.agent/**',
  '.claude/**',
  '.gemini/**',
  '.grok/**',
  '.golden/**',
  '.github/**',
  '.tmp/**',
  '.anti/**',
  '.scratch-render/**',
  '.vscode/**',
  '.firebaserc',
  '*.md',
  '*.sh',
  'contract*.yaml',
  'apphosting*.yaml',
  'issues.json',
  'WORKSPACE',
  'Makefile',
  '**/*.docx',
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '.sops.yaml',
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    '/**': NEVER_SHIP,
  },
  outputFileTracingIncludes: {
    '/national-show/*': ['content/drive-recovered/**/content.md'],
  },
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
