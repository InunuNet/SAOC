import type { MetadataRoute } from 'next';

import { isPubliclyLaunched } from '@/lib/beta-public-launch';

// Mission beta-password-wall F1 — force-dynamic, never statically generated:
// this must re-read SITE_PUBLIC_LAUNCH on every request, not bake in whatever
// value was present at build time. HOST-AGNOSTIC (team-lead override,
// 2026-10-06): disallow-all applies on every host — beta.saoc.co.za, any
// *.hosted.app preview origin, and the real saoc.co.za apex alike — until
// lib/beta-public-launch.ts's SITE_PUBLIC_LAUNCH flag is explicitly set to the
// exact string 'true'. See that file's header comment for why this is no
// longer keyed off the Host header.
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://saoc.co.za';

// AI / LLM crawlers explicitly welcomed to index SAOC content.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
] as const;

export default function robots(): MetadataRoute.Robots {
  if (!isPubliclyLaunched(process.env.SITE_PUBLIC_LAUNCH)) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
      })),
      {
        // Bytespider ignores robots directives and violates site TOS — disallow.
        userAgent: 'Bytespider',
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
