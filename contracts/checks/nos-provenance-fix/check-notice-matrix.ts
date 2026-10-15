/**
 * nos-provenance-fix F3 — lead condition 3: no NOS section with a recovered council source
 * shows the placeholder notice, and every genuinely unsourced section still does.
 *
 * Usage (from the worktree root, so process.cwd() is the repo the gate resolves against):
 *   pnpm --dir <worktree> exec tsx contracts/checks/nos-provenance-fix/check-notice-matrix.ts           # seed corpus
 *   pnpm --dir <worktree> exec tsx contracts/checks/nos-provenance-fix/check-notice-matrix.ts --live    # published Sanity, anonymous
 *
 * Runs every section through the REAL resolveNotice() (classifySection underneath) and compares
 * the notice kind to the pinned matrix in goldens/f3-notice-matrix.md. Refuses to run while
 * content/drive-source/ exists in the worktree: beta has no such tree, and a pass that relied on
 * it would prove nothing. Exit 0 = pass, 1 = fail, 2 = could not run.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

import {
  FALLBACK_DRAFT_LABEL,
  FALLBACK_PLACEHOLDER_LABEL,
  FALLBACK_RESEARCH_LABEL,
  resolveNotice,
  type SectionProvenanceInput,
} from '@/lib/data/show-pages';

type Kind = 'none' | 'placeholder' | 'research' | 'draft';

const R = 'content/drive-recovered';
// pageKey -> sectionKey -> expected notice kind. Mirrors goldens/f3-notice-matrix.md.
const EXPECTED: Record<string, Record<string, Kind>> = {
  '01-national-show-landing': { welcome: 'placeholder', 'what-is-on': 'placeholder', 'getting-here': 'research' },
  '02-about-the-national-show': { overview: 'none' },
  '03-what-to-expect': { overview: 'none', 'visitor-logistics': 'placeholder' },
  '04-south-african-exhibitors': { overview: 'none', 'directory-coming': 'placeholder' },
  '05-international-guests-and-exhibitors': { intro: 'placeholder', 'who-will-appear': 'placeholder' },
  '06-saoc-symposium': { theme: 'none', 'about-the-symposium': 'placeholder', attending: 'placeholder' },
  '07-wosa-conference': { 'about-the-conference': 'placeholder', attending: 'placeholder', 'about-wosa': 'placeholder' },
  '11-programme': { intro: 'placeholder', 'how-the-programme-will-work': 'placeholder' },
  '12-workshops': { intro: 'placeholder', 'what-to-expect': 'placeholder', booking: 'placeholder' },
  '13-booking-tickets': { categories: 'placeholder' },
  '15-sponsors': { intro: 'placeholder', listing: 'placeholder' },
  '16-plan-your-visit': { intro: 'placeholder', 'getting-here': 'research', 'staying-nearby': 'placeholder' },
  '17-faq': { 'faq-q1-symposium-date': 'draft', faq: 'none', 'more-questions-coming': 'placeholder' },
};

// The six routes that render showPage sections through the gate (loadShowPageOrFallback).
const GATED_ROUTES: Record<string, string> = {
  'international-guests': '05-international-guests-and-exhibitors',
  programme: '11-programme',
  'sa-exhibitors': '04-south-african-exhibitors',
  sponsors: '15-sponsors',
  symposium: '06-saoc-symposium',
  'wosa-conference': '07-wosa-conference',
};

type Section = SectionProvenanceInput & { sectionKey: string };
type Page = { pageKey: string; sections: Section[] };

function kindOf(input: SectionProvenanceInput): Kind {
  const n = resolveNotice(input, null);
  if (n === null) return 'none';
  if (n.label === FALLBACK_PLACEHOLDER_LABEL) return 'placeholder';
  if (n.label === FALLBACK_RESEARCH_LABEL) return 'research';
  if (n.label === FALLBACK_DRAFT_LABEL) return 'draft';
  throw new Error(`unrecognised notice label: ${n.label}`);
}

function loadSeedPages(): Page[] {
  const dir = path.resolve(process.cwd(), 'content/show-pages');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Page);
}

async function loadLivePages(): Promise<Page[]> {
  // Public, non-secret identifiers — read from apphosting.yaml exactly as the deployed app gets them.
  const hosting = readFileSync(path.resolve(process.cwd(), 'apphosting.yaml'), 'utf8');
  const pick = (name: string) => new RegExp(`variable: ${name}\\s+value: "([^"]+)"`).exec(hosting)?.[1];
  const projectId = pick('NEXT_PUBLIC_SANITY_PROJECT_ID');
  const dataset = pick('NEXT_PUBLIC_SANITY_DATASET');
  if (!projectId || !dataset) throw new Error('apphosting.yaml lacks the public Sanity ids');
  // Anonymous + published — the same view the site's sanityFetch() gets (no token).
  const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', useCdn: false, perspective: 'published' });
  return client.fetch<Page[]>('*[_type == "showPage"]{pageKey, sections[]{sectionKey, kind, provenance, sourcePath, body}}');
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  if (existsSync(path.resolve(process.cwd(), 'content/drive-source'))) {
    console.error('check-notice-matrix: content/drive-source/ exists here — beta has none; refusing to prove anything');
    process.exit(2);
  }
  const failures: string[] = [];

  for (const [route, pageKey] of Object.entries(GATED_ROUTES)) {
    const src = readFileSync(path.resolve(process.cwd(), 'app/(marketing)/national-show', route, 'page.tsx'), 'utf8');
    if (!src.includes(`loadShowPageOrFallback('${pageKey}'`)) failures.push(`route /national-show/${route} no longer renders ${pageKey} through the gate`);
  }

  const pages = live ? await loadLivePages() : loadSeedPages();
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.pageKey)) failures.push(`${page.pageKey}: duplicate document visible (loadShowPage would throw)`);
    seen.add(page.pageKey);
    const want = EXPECTED[page.pageKey];
    if (!want) { failures.push(`${page.pageKey}: not in the pinned matrix`); continue; }
    const keys = (page.sections ?? []).map((s) => s.sectionKey);
    if (JSON.stringify([...keys].sort()) !== JSON.stringify(Object.keys(want).sort())) failures.push(`${page.pageKey}: sections ${keys.join(',')} != pinned`);
    for (const s of page.sections ?? []) {
      const got = kindOf(s);
      const exp = want[s.sectionKey];
      if (exp && got !== exp) failures.push(`${page.pageKey}/${s.sectionKey}: notice ${got}, expected ${exp}`);
      // The condition-3 rule itself, independent of the pinned table.
      const recovered = typeof s.sourcePath === 'string' && s.sourcePath.startsWith(`${R}/`);
      if (recovered && s.provenance === 'council-supplied' && got !== 'none') failures.push(`${page.pageKey}/${s.sectionKey}: council source recovered but notice is ${got}`);
      if (recovered && s.provenance === 'council-draft' && got !== 'draft') failures.push(`${page.pageKey}/${s.sectionKey}: council draft recovered but notice is ${got}`);
      if (s.provenance === 'placeholder-ai' && got !== 'placeholder') failures.push(`${page.pageKey}/${s.sectionKey}: placeholder-ai section lost its notice`);
    }
  }
  for (const pageKey of Object.keys(EXPECTED)) if (!seen.has(pageKey)) failures.push(`${pageKey}: missing`);

  // Negative cases — the notice must survive every way a council claim can be unsupported.
  const sa = pages.find((p) => p.pageKey === '04-south-african-exhibitors')?.sections.find((s) => s.sectionKey === 'overview');
  if (!sa) failures.push('negatives: 04/overview not found');
  else {
    const altered = JSON.parse(JSON.stringify(sa.body)) as Array<{ children: Array<{ text: string }> }>;
    altered[0].children[0].text += ' This sentence was never written by the council in any document.';
    const NEG: Array<[string, SectionProvenanceInput, Kind]> = [
      ['old gitignored drive-source path', { provenance: 'council-supplied', sourcePath: 'content/drive-source/National Show/4. South African Exhibitors/1.1 Exhibitors - South African Exhibitors/v1.0/content.md', body: sa.body }, 'placeholder'],
      ['recovered path, one invented sentence', { provenance: 'council-supplied', sourcePath: sa.sourcePath, body: altered }, 'placeholder'],
      ['recovered path, linked body, provenance placeholder-ai', { provenance: 'placeholder-ai', sourcePath: sa.sourcePath, body: sa.body }, 'placeholder'],
      ['council-supplied, no sourcePath', { provenance: 'council-supplied', sourcePath: null, body: sa.body }, 'placeholder'],
      ['recovered path, linked body, council-draft', { provenance: 'council-draft', sourcePath: sa.sourcePath, body: sa.body }, 'draft'],
      ['another page\'s recovered source', { provenance: 'council-supplied', sourcePath: `${R}/02-about-the-national-show/about/content.md`, body: sa.body }, 'placeholder'],
    ];
    for (const [label, input, exp] of NEG) {
      const got = kindOf(input);
      if (got !== exp) failures.push(`negative "${label}": notice ${got}, expected ${exp}`);
    }
  }

  const mode = live ? 'live (published, anonymous)' : 'seed corpus';
  if (failures.length) {
    failures.forEach((f) => console.log(`FAIL ${f}`));
    process.exit(1);
  }
  console.log(`PASS [${mode}]: ${seen.size} pages match the pinned notice matrix; 6 gated routes covered; 6 negative cases hold`);
}

main().catch((err: unknown) => {
  console.error('check-notice-matrix failed to run:', err instanceof Error ? err.message : err);
  process.exit(2);
});
