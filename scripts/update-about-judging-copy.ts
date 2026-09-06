/**
 * Site-build (about-judging deepen pass) — patches the thin single-sentence
 * copy `scripts/seed-page-singletons.ts` originally seeded into `aboutPage`
 * (`pillars`, `timelineNodes`) and `judgingPage` (`intro`, `howItWorks`,
 * `becomingAJudge`) with deeper, factual copy.
 *
 * Every fact used here is already established elsewhere in the codebase
 * (Home's stat band, NavCards' "1990" / registration-number copy) — no new
 * invented specifics are introduced, so none of this needs `data-placeholder`
 * marking. Content that IS invented (illustrative panel sizes, a training
 * pathway) lives only in the page components' code fallbacks, which render
 * when these Sanity fields are empty, and is marked `data-placeholder` there.
 *
 * Uses `patch().set()` rather than `createOrReplace` so unrelated fields on
 * these singletons (title, boardIntroText, stats, judges, showPublicDirectory,
 * images) are left untouched.
 *
 * Required env (read directly from .env.local — see seed-page-singletons.ts
 * for why not the `dotenv` package):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/update-about-judging-copy.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
const token = env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

function paragraphs(...texts: string[]) {
  return texts.map((text) => ({
    _type: 'block' as const,
    _key: randomUUID(),
    style: 'normal' as const,
    markDefs: [],
    children: [{ _type: 'span' as const, _key: randomUUID(), text, marks: [] }],
  }));
}

async function updateAboutPage(): Promise<void> {
  console.log('  aboutPage:');
  await client
    .patch('aboutPage')
    .set({
      pillars: paragraphs(
        'SAOC exists to promote the culture, hybridisation and appreciation of orchids in cultivation across South Africa. We do this through a federated network of 21 affiliated societies, a nationally accredited judging system standardised in 1990, and our annual publication Orchids South Africa.',
        'Our remit is orchids in cultivation — on the show bench, in the greenhouse, and in the community. For indigenous species in the wild, our partner organisation Wild Orchids of Southern Africa leads that work.',
      ),
      timelineNodes: paragraphs(
        'Four societies met in Bloemfontein on 29 July 1968 and agreed to form the South African Orchid Council, giving the country’s growers a single federated body for the first time.',
        'SAOC was formally incorporated as a non-profit body in 1978 (registration number 1978/004040/08), putting the young council on a permanent legal footing as more societies affiliated across the provinces.',
        'In 1990, SAOC standardised its judging system nationally, replacing regional variation with a single set of published criteria used by accredited judges at every affiliated show.',
        'Today SAOC coordinates 21 affiliated societies across all nine provinces and has hosted 18 national shows, continuing the work its founders began in 1968.',
      ),
    })
    .commit();
  console.log('    patched pillars, timelineNodes');
}

async function updateJudgingPage(): Promise<void> {
  console.log('  judgingPage:');
  await client
    .patch('judgingPage')
    .set({
      intro: paragraphs(
        'SAOC operates a national orchid judging system, standardised in 1990 to replace regional variation with a single set of published criteria. Accredited judges assess plants on form, colour, size, and cultural condition at affiliated shows across the country.',
      ),
      howItWorks: paragraphs(
        'Plants are assessed by panels of accredited judges against SAOC’s published judging criteria. Awards are conferred when a plant meets the required point threshold for its class, from a first Highly Commended Certificate through to a Certificate of Cultural Merit.',
      ),
      becomingAJudge: paragraphs(
        'Judging accreditation is earned through a structured training programme run by SAOC. Speak to your affiliated society to begin the pathway toward becoming an accredited judge.',
      ),
    })
    .commit();
  console.log('    patched intro, howItWorks, becomingAJudge');
}

async function main(): Promise<void> {
  console.log(`Patching about/judging copy in Sanity dataset "${dataset}" (project ${projectId})`);
  await updateAboutPage();
  await updateJudgingPage();
  console.log('Patch complete.');
}

main().catch((err: unknown) => {
  console.error('Patch failed:', err);
  process.exit(1);
});
