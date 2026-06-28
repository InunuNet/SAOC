import type { MetadataRoute } from 'next';

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
