/**
 * Temporary verification helper (not part of the app) — sets the four
 * portable-text array fields under test to `[]` so the empty-array-is-
 * truthy regression (Codex finding, site-build/_about-judging) can be
 * exercised against a real empty array, not just read from source.
 * Deleted after verification; scripts/update-about-judging-copy.ts is the
 * real content patch and is re-run afterward to restore the real copy.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvLocal();
const client: SanityClient = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token: env.SANITY_API_TOKEN,
  useCdn: false,
});

async function main(): Promise<void> {
  await client.patch('aboutPage').set({ pillars: [], timelineNodes: [] }).commit();
  await client
    .patch('judgingPage')
    .set({ intro: [], howItWorks: [], becomingAJudge: [] })
    .commit();
  console.log('Set aboutPage.pillars/timelineNodes and judgingPage.intro/howItWorks/becomingAJudge to []');
}

main().catch((err: unknown) => {
  console.error('Failed:', err);
  process.exit(1);
});
