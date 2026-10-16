/**
 * Launch-weekend F10 - read-only query of the live Sanity ticketType documents. Asserts that
 * no retired slug is active, that each logical product (day early-bird, weekend early-bird,
 * field trip) has exactly one active document, and that every active admission, workshop or
 * conference document maps to a live product slug in lib/provisional-figures.ts.
 * Credentials come from the environment, falling back to ./.env.local.
 * Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f10/check-catalogue.mts
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  RETIRED_ADMISSION_SLUGS,
  RETIRED_CONFERENCE_SLUGS,
  RETIRED_FIELD_TRIP_SLUGS,
  RETIRED_SUNSET_COCKTAILS_SLUGS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../../../../lib/provisional-figures';

const API_VERSION = '2024-01-01';
const LOGICAL_PRODUCTS: Record<string, string[]> = {
  'day early-bird': ['early-bird'],
  'weekend early-bird': ['weekend-pass-early-bird'],
  'field trip': ['field-trip'],
};
const CHECKED_CATEGORIES = ['admission', 'workshop-field-trip', 'conference'];
// Active by design, not public products: the QA fixture and the fictional test show.
const NON_PUBLIC_SLUGS = ['qa-fixture-ticket', 'fictional-test-show-general-admission'];

type TicketDoc = { _id: string; slug?: { current?: string }; active?: boolean; category?: string };

function readEnvLocal(): Record<string, string> {
  const file = path.resolve(process.cwd(), '.env.local');
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    out[t.slice(0, eq)] = t.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return out;
}

async function main(): Promise<void> {
  const env = { ...readEnvLocal(), ...process.env };
  const client = createClient({
    projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: API_VERSION,
    token: env.SANITY_API_TOKEN,
    useCdn: false,
    perspective: 'published',
  });
  const docs = await client.fetch<TicketDoc[]>(
    '*[_type=="ticketType"]{_id, slug, active, category}',
  );
  const active = docs.filter((d) => d.active === true);
  const activeSlugs = active.map((d) => d.slug?.current ?? '');
  const failures: string[] = [];

  const retired: readonly string[] = [
    ...RETIRED_ADMISSION_SLUGS,
    ...RETIRED_CONFERENCE_SLUGS,
    ...RETIRED_FIELD_TRIP_SLUGS,
    ...RETIRED_SUNSET_COCKTAILS_SLUGS,
  ];
  for (const d of active) {
    if (retired.includes(d.slug?.current ?? '')) failures.push(`retired slug active: ${d._id}`);
  }
  for (const [name, slugs] of Object.entries(LOGICAL_PRODUCTS)) {
    const n = active.filter((d) => slugs.includes(d.slug?.current ?? '')).length;
    if (n !== 1) failures.push(`${name}: expected 1 active document, found ${n}`);
  }
  const liveSlugs = [
    ...ADMISSION_PRODUCTS,
    ...CONFERENCE_PRODUCTS,
    ...WORKSHOP_FIELD_TRIP_PRODUCTS,
  ].map((p) => p.slug);
  for (const d of active) {
    const slug = d.slug?.current ?? '';
    const inScope = d.category == null || CHECKED_CATEGORIES.includes(d.category);
    if (inScope && !liveSlugs.includes(slug) && !NON_PUBLIC_SLUGS.includes(slug)) {
      failures.push(`active document has no live product: ${d._id}`);
    }
  }
  for (const slug of retired) {
    if (!docs.some((d) => d.slug?.current === slug && d.active === false)) {
      failures.push(`retired document missing or not active:false: ${slug}`);
    }
  }
  const dupes = new Set(activeSlugs.filter((s, i) => activeSlugs.indexOf(s) !== i));
  for (const s of dupes) failures.push(`duplicate active slug: ${s}`);

  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log(`OK: ${active.length} active ticketType documents, one per logical product`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
