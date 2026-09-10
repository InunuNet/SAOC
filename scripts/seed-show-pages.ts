/**
 * F4 (national-show-ia-alignment, M1) — Seed the 17 National Show `showPage`
 * documents (spec entries 1-13, 15-18; entry 14 is a link, not a page — see
 * route-map.golden.md) and the `showPageSettings` singleton, from the committed
 * corpus at content/show-pages/*.json.
 *
 * See .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/seeding-reconciliation.golden.md
 * for the full decision table this script implements.
 *
 * The reconciliation decision — decideSectionAction() and hashBody() below — is PURE:
 * no Sanity client, no filesystem, no clock, no env. That is what lets the M1 verifier
 * drive every row of the decision table with no dataset and no network, and it is why
 * this module must be IMPORTABLE without Sanity credentials — the Sanity client is
 * constructed lazily inside main(), never at module load.
 *
 * This script never force-replaces a document wholesale (scripts/seed-page-singletons.ts
 * is this project's own cautionary tale — see its header and
 * scripts/seed-show-visitor-info.ts:6-9), never removes a document, and never mints a
 * random identifier — every _id and _key is derived. Assertion A34 greps this file for
 * the three literal patterns that would violate that.
 *
 * Run with: node --import tsx/esm scripts/seed-show-pages.ts
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package — its
 * banner writes to stdout and has corrupted captured values on this project before):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { SanityClient } from '@sanity/client';

// ---------------------------------------------------------------------------
// Pure decision logic — see file header. No I/O of any kind below this point until
// getClient()/readEnvLocal().
// ---------------------------------------------------------------------------

export type SeedProvenance = 'council-supplied' | 'council-draft' | 'research' | 'placeholder-ai';

export interface SeedSection {
  sectionKey: string;
  heading?: string | null;
  kind?: string;
  provenance: SeedProvenance;
  sourcePath?: string | null;
  body: unknown;
}

export interface SeedPage {
  pageKey: string;
  specNumber: number;
  title: string;
  summary?: string | null;
  sections: SeedSection[];
}

export type SectionAction =
  | 'skip-council' // existing section is council-supplied or council-draft — NEVER written, no hash consulted
  | 'create' // section absent from the dataset — write it
  | 'update' // stored seedHash matches a fresh hash of every seed-owned field — safe to overwrite
  | 'skip-edited' // stored seedHash does not match — a human edited a seed-owned field
  | 'skip-unknown-origin' // no seedHash at all — assume human-authored
  | 'leave-extra'; // in the dataset, absent from the seed source

/**
 * The section fields the SEED writes, and therefore the fields `seedHash` must cover.
 * `sectionKey` is excluded — it is the identity reconciliation keys on, not content.
 * `seedHash` itself is excluded — hashing a value into itself is not defined. See
 * .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/seed-write-narrowing.golden.md
 * Rule 2. A hash covering three of four fields is exactly how the original defect
 * survived review (M1's A39 finding) — `hashBody` used to hash `body` alone while the
 * write replaced the whole section.
 */
export interface SeedOwnedFields {
  heading: string | null;
  body: unknown;
  provenance: SeedProvenance;
  sourcePath: string | null;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * sha256 of the canonical (sorted-key) JSON of every seed-owned field, truncated to 16
 * hex chars. Covers heading, body, provenance AND sourcePath — a change to any one of
 * them changes the hash (SW2). Superseded `hashBody`, which hashed `body` alone.
 */
export function hashSeedOwnedFields(fields: SeedOwnedFields): string {
  const canonical = JSON.stringify(
    sortKeysDeep({
      heading: fields.heading,
      body: fields.body,
      provenance: fields.provenance,
      sourcePath: fields.sourcePath,
    }),
  );
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/** @deprecated superseded by hashSeedOwnedFields — kept only for the M1 verifier's probe. */
export function hashBody(body: unknown): string {
  return hashSeedOwnedFields({ heading: null, body, provenance: 'placeholder-ai', sourcePath: null });
}

/**
 * The reconciliation decision. Pure — see the decision table in
 * goldens/m4/seed-write-narrowing.golden.md, which supersedes the six-row table in
 * seeding-reconciliation.golden.md. `existing` is the section currently in the dataset
 * for this sectionKey (or null if none).
 *
 * Rule 1, checked FIRST and unconditionally: if the section currently in the dataset is
 * `council-supplied` or `council-draft`, it is never written — no hash comparison, no
 * exception for a perfectly matching seedHash. That value is the council declaring the
 * words are theirs (or, for council-draft, still theirs even if unfinished); nothing
 * generated has standing to overwrite it.
 */
export function decideSectionAction(
  seedSection: SeedSection | null,
  existing: {
    heading?: string | null;
    body: unknown;
    provenance?: SeedProvenance | null;
    sourcePath?: string | null;
    seedHash?: string | null;
  } | null,
): SectionAction {
  if (existing && (existing.provenance === 'council-supplied' || existing.provenance === 'council-draft')) {
    return 'skip-council';
  }
  if (seedSection && !existing) return 'create';
  if (!seedSection) return 'leave-extra';
  if (!existing) return 'leave-extra';

  const seedHash = existing.seedHash;
  if (!seedHash) return 'skip-unknown-origin';

  const currentHash = hashSeedOwnedFields({
    heading: existing.heading ?? null,
    body: existing.body,
    provenance: existing.provenance ?? 'placeholder-ai',
    sourcePath: existing.sourcePath ?? null,
  });
  return currentHash === seedHash ? 'update' : 'skip-edited';
}

// ---------------------------------------------------------------------------
// I/O half — everything below touches the filesystem, the clock or the network. It
// calls the pure functions above; it never re-implements the decision inline.
// ---------------------------------------------------------------------------

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

async function getClient(): Promise<SanityClient> {
  const { createClient } = await import('@sanity/client');
  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error(
      'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
        'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
    );
  }
  return createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });
}

const SHOW_PAGES_DIR = path.resolve(process.cwd(), 'content/show-pages');
const SHOW_PAGE_SETTINGS_ID = 'showPageSettings';

// Fixed wording — must match provenance-gate.golden.md and lib/data/show-pages.ts's
// hardcoded fallback constants verbatim.
export const SHOW_PAGE_SETTINGS_DEFAULTS = {
  placeholderLabel: 'Placeholder copy',
  placeholderNotice:
    'This text is an AI-generated placeholder. It has not been written or approved by the ' +
    'South African Orchid Council, and it may be inaccurate. Final copy is still to be ' +
    'supplied by the Council.',
  researchLabel: 'Not yet confirmed',
  researchNotice:
    'This information was researched by the web team and has not yet been confirmed by the ' +
    'South African Orchid Council.',
};

function loadSeedPages(): SeedPage[] {
  const files = readdirSync(SHOW_PAGES_DIR).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const raw = readFileSync(path.join(SHOW_PAGES_DIR, file), 'utf8');
    return JSON.parse(raw) as SeedPage;
  });
}

type SanitySection = {
  _key: string;
  _type: 'showPageSection';
  sectionKey: string;
  heading?: string;
  kind: string;
  body: unknown;
  provenance: SeedProvenance;
  sourcePath?: string;
  seedHash: string;
};

function toSanitySection(pageKey: string, seed: SeedSection): SanitySection {
  return {
    _key: `${pageKey}--${seed.sectionKey}`,
    _type: 'showPageSection',
    sectionKey: seed.sectionKey,
    heading: seed.heading ?? undefined,
    kind: seed.kind ?? 'prose',
    body: seed.body,
    provenance: seed.provenance,
    sourcePath: seed.sourcePath ?? undefined,
    seedHash: hashSeedOwnedFields({
      heading: seed.heading ?? null,
      body: seed.body,
      provenance: seed.provenance,
      sourcePath: seed.sourcePath ?? null,
    }),
  };
}

interface ExistingShowPageDoc {
  _id: string;
  _rev: string;
  sections?: Array<{
    _key: string;
    sectionKey: string;
    heading?: string | null;
    body: unknown;
    provenance?: SeedProvenance | null;
    sourcePath?: string | null;
    seedHash?: string | null;
  }>;
}

// The exact four fields an 'update' action is entitled to overwrite — the same four
// hashSeedOwnedFields() covers (goldens/m4/seed-write-narrowing.golden.md Rules 2/3). A
// section reaching 'update' has already cleared decideSectionAction's Rule 1 check (not
// council-supplied/council-draft) and its hash comparison (no seed-owned field changed
// since this script last wrote it) — so writing all four here, rather than a narrower
// subset, is what closes M1's A39 finding: a hash covering three of four fields (the
// pre-M4 shape excluded `heading`) passed a single-field test while a Studio heading
// edit was silently reverted on the next run. `kind` stays excluded — this script never
// implements a kind other than 'prose' and never seeds one.
type SectionUpdateFields = {
  heading?: string;
  body: unknown;
  provenance: SeedProvenance;
  sourcePath?: string;
  seedHash: string;
};

function sectionUpdateFields(seed: SeedSection): SectionUpdateFields {
  return {
    heading: seed.heading ?? undefined,
    body: seed.body,
    provenance: seed.provenance,
    sourcePath: seed.sourcePath ?? undefined,
    seedHash: hashSeedOwnedFields({
      heading: seed.heading ?? null,
      body: seed.body,
      provenance: seed.provenance,
      sourcePath: seed.sourcePath ?? null,
    }),
  };
}

async function seedShowPageSettings(client: SanityClient): Promise<void> {
  console.log('  showPageSettings:');
  const created = await client.createIfNotExists({
    _id: SHOW_PAGE_SETTINGS_ID,
    _type: 'showPageSettings',
    ...SHOW_PAGE_SETTINGS_DEFAULTS,
  });
  console.log(`    createIfNotExists (${created ? 'written or already present' : 'no-op'})`);
}

async function reconcilePage(client: SanityClient, seedPage: SeedPage): Promise<string[]> {
  const docId = `showPage.${seedPage.pageKey}`;
  const existingDoc = await client.getDocument<ExistingShowPageDoc>(docId);
  const skips: string[] = [];

  if (!existingDoc) {
    const sections = seedPage.sections.map((s) => toSanitySection(seedPage.pageKey, s));
    await client.createIfNotExists({
      _id: docId,
      _type: 'showPage',
      pageKey: seedPage.pageKey,
      specNumber: seedPage.specNumber,
      title: seedPage.title,
      summary: seedPage.summary ?? undefined,
      sections,
    });
    console.log(`  ${seedPage.pageKey}: created (${sections.length} sections)`);
    return skips;
  }

  const existingSections = existingDoc.sections ?? [];
  const existingByKey = new Map(existingSections.map((s) => [s.sectionKey, s]));
  const seedByKey = new Map(seedPage.sections.map((s) => [s.sectionKey, s]));

  const patch = client.patch(docId).ifRevisionId(existingDoc._rev);
  let hasWrite = false;

  for (const seedSection of seedPage.sections) {
    const existing = existingByKey.get(seedSection.sectionKey) ?? null;
    const action = decideSectionAction(
      seedSection,
      existing
        ? {
            heading: existing.heading,
            body: existing.body,
            provenance: existing.provenance,
            sourcePath: existing.sourcePath,
            seedHash: existing.seedHash,
          }
        : null,
    );

    if (action === 'skip-council') {
      // Rule 1 — never written, no hash consulted, no exception for a matching hash.
      // These are the council's words (finished or, for council-draft, not yet).
      console.log(`  KEEP ${seedPage.pageKey}/${seedSection.sectionKey} — council-authored, seed never writes it`);
    } else if (action === 'create') {
      patch.append('sections', [toSanitySection(seedPage.pageKey, seedSection)]);
      hasWrite = true;
    } else if (action === 'update' && existing) {
      // Selects by the EXISTING array element's own `_key` — never a freshly derived
      // one. A section this script itself created always has `_key` === the derived
      // form, so this is a no-op change for the common case; it matters for a section
      // that reached the dataset some other way (a Studio-authored addition, an
      // ndjson import) but happens to carry a matching sectionKey and a spoofable
      // readOnly seedHash field — Codex's cross-model review found that selecting by a
      // freshly-derived _key there matches nothing, so the patch silently no-ops while
      // the script still reports "patched".
      //
      // Sets ONLY the fields sectionUpdateFields() names — never the whole section
      // object (Rule 3). `kind` stays excluded — this script never seeds anything but
      // 'prose'. `heading` IS included here, unlike the pre-M4 shape: decideSectionAction
      // already reached 'update' only because a fresh hash over all four seed-owned
      // fields — heading included — matched the stored one, so no Studio heading edit
      // can be in flight here; if one were, the hash mismatch would have routed this to
      // 'skip-edited' instead. See goldens/m4/seed-write-narrowing.golden.md Rules 2/3.
      const fields = sectionUpdateFields(seedSection);
      const setPayload: Record<string, unknown> = {};
      for (const [field, value] of Object.entries(fields)) {
        setPayload[`sections[_key=="${existing._key}"].${field}`] = value;
      }
      patch.set(setPayload);
      hasWrite = true;
    } else if (action === 'skip-edited' || action === 'skip-unknown-origin') {
      const line = `SKIP ${seedPage.pageKey}/${seedSection.sectionKey} — edited in Studio, seed not applied`;
      skips.push(line);
      console.log(`  ${line}`);
    }
  }

  for (const existing of existingSections) {
    if (!seedByKey.has(existing.sectionKey)) {
      console.log(`  KEEP ${seedPage.pageKey}/${existing.sectionKey} — not in seed source, left alone`);
    }
  }

  if (hasWrite) {
    try {
      // .ifRevisionId() makes this commit fail, rather than silently overwrite, if the
      // document changed underneath us between getDocument() and here — closing the
      // read/commit race Codex's cross-model review found: a council editor saving a
      // body edit in that window used to be clobbered by this unconditional commit
      // despite the reconciliation's stated promise never to do that.
      await patch.commit({ autoGenerateArrayKeys: false });
      console.log(`  ${seedPage.pageKey}: patched`);
    } catch (err) {
      const line = `SKIP ${seedPage.pageKey} — concurrent edit detected during commit (revision changed since read), seed not applied this run`;
      skips.push(line);
      console.log(`  ${line}`);
      console.error(`  ${seedPage.pageKey}: commit rejected —`, err instanceof Error ? err.message : err);
    }
  } else if (skips.length === 0) {
    console.log(`  ${seedPage.pageKey}: already up to date — no write issued`);
  }

  return skips;
}

async function main(): Promise<void> {
  const client = await getClient();
  const seedPages = loadSeedPages();
  console.log(`Seeding ${seedPages.length} show pages...`);

  await seedShowPageSettings(client);

  const allSkips: string[] = [];
  for (const seedPage of seedPages.sort((a, b) => a.specNumber - b.specNumber)) {
    const skips = await reconcilePage(client, seedPage);
    allSkips.push(...skips);
  }

  console.log('Seed complete.');
  if (allSkips.length > 0) {
    console.log(`\n${allSkips.length} section(s) skipped — a human edited them in Studio:`);
    for (const skip of allSkips) console.log(`  ${skip}`);
    process.exitCode = 3;
  }
}

// Only run when executed directly — never as a side effect of importing this module
// for its pure exports (decideSectionAction, hashBody). The M1 verifier imports this
// module with no Sanity credentials present; it must not trigger main().
const isDirectlyExecuted =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`;

if (isDirectlyExecuted) {
  main().catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  });
}
