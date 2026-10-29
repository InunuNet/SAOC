import type { NextConfig } from 'next';

import imageWidths from './lib/image-widths.json';

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

// Report-only: violations log to the browser console, nothing is blocked. Verbatim from the F5
// golden (csp-report-only.txt). No enforcing CSP and no COOP (it breaks Firebase Auth popups).
const CONTENT_SECURITY_POLICY_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://cdn.sanity.io https://firebasestorage.googleapis.com; connect-src 'self' https://*.sanity.io https://*.apicdn.sanity.io https://*.googleapis.com https://*.firebaseapp.com wss://*.sanity.io; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.sanity.io; form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za https://pay.ozow.com https://stagingpay.ozow.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

const SECURITY_HEADERS = [
  // No includeSubDomains or preload: old cPanel subdomains still exist.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // camera=(self) is required: the /admin/door scanner uses getUserMedia.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  // Inlined as '' when unset: Next only substitutes NEXT_PUBLIC_* variables that exist at build
  // time, and an unsubstituted read would stop lib/app-check-client.ts's build-key ternary from
  // folding, shipping the App Check SDK in a flag-off bundle (sec-abuse-controls D7).
  env: {
    NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_APP_CHECK_RECAPTCHA_SITE_KEY ?? '',
  },
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    '/**': NEVER_SHIP,
  },
  outputFileTracingIncludes: {
    '/national-show/*': ['content/drive-recovered/**/content.md'],
    // ticket-pdf: fonts and logos are read from disk at runtime by lib/ticket-pdf.ts (the route and
    // the ITN email attachment); an untraced file would crash on App Hosting.
    '/api/tickets/**': ['lib/ticket-pdf-assets/**'],
    // firebase-admin/auth reaches semver through jsonwebtoken; the trace kept semver/index.js
    // but dropped most of semver/functions/*, so those routes crashed with
    // "Cannot find module './functions/valid'" on App Hosting.
    '/**': ['node_modules/.pnpm/semver@*/node_modules/semver/**/*.js'],
  },
  // Local dev is reached at https://dev.saoc.co.za (see scripts/install-dev-domain.sh and
  // the `dev:secure` script); the NOS site is reached at http://nos.localhost:<port>. Without this, Next refuses that origin's dev requests because
  // it is not localhost. Dev-only — it has no effect on a production build.
  allowedDevOrigins: ['dev.saoc.co.za', 'nos.localhost'],
  // `next dev` writes an agent-rules block into AGENTS.md when it detects an AI agent, and
  // AGENTS.md is the harness clone source. Dev-only — build and deploy are unaffected.
  agentRules: false,
  images: {
    // Custom loader, not the optimiser: App Hosting's adapter disables the optimiser unless a
    // loader is set (docs/image-delivery.md). Widths are capped at 2048.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: imageWidths.deviceSizes,
    imageSizes: imageWidths.imageSizes,
    // Next 16 allows only quality 75 unless listed: 88 is the home hero's (rHB).
    qualities: [75, 88],
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
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
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
