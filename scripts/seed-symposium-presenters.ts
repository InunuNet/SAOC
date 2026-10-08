/**
 * Seeds the three SAOC Symposium speakers as `conferencePresenter` documents, with each
 * bio taken verbatim from Lee-Ann's Drive docs (mirrored locally by
 * execution/drive_docx_sync.py under content/drive-source/, which is gitignored).
 *
 * Cleared by the SAOC lead 2026-10-08: content only, no rendering. The symposium page
 * loads these via lib/view-models/load-presenters.ts but renders nothing until the NOS
 * design handoff (F7) lands.
 *
 * Verbatim rules (docs/rules/no-invention.md):
 *   - Words are copied as written, including the source's own typos and drafting
 *     notes. Only formatting is normalised for a plain-text field: markdown emphasis
 *     markers are dropped and list markers become "• ".
 *   - `role` is set only where the source carries one (Wijaya's "Position").
 *   - `photo` and `order` are left unset: gaps for Lee-Ann.
 *   - `provenance` is 'council-draft': the source docs read as drafts (a third-party
 *     first-person passage in the Tibbs doc, an editorial aside in the Wijaya doc).
 *
 * Deterministic _ids + createOrReplace, so a re-run converges instead of duplicating.
 *
 * Required env (read from .env.local, same as scripts/update-about-judging-copy.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 *
 * Run with: node --import tsx/esm scripts/seed-symposium-presenters.ts [--dry-run] [--source-root <dir>]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

const SPEAKERS_DIR = path.join('National Show', '6. SAOC Symposium', 'Speakers');
const EVENT = 'saoc-symposium';
const PROVENANCE = 'council-draft';

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

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

const sourceRoot = path.resolve(argValue('--source-root') ?? 'content/drive-source');
const dryRun = process.argv.includes('--dry-run');

function readSource(docFolder: string): string {
  return readFileSync(path.join(sourceRoot, SPEAKERS_DIR, docFolder, 'v1.0', 'content.md'), 'utf8');
}

function stripEmphasis(text: string): string {
  return text.replace(/\*+/g, '');
}

// Paragraphs and list items from a flowing-prose doc, one per non-empty line.
function proseToPlainText(md: string): string {
  return md
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const bullet = line.match(/^(?:\*|·)\s+(.*)$/);
      return bullet ? `• ${stripEmphasis(bullet[1])}` : stripEmphasis(line);
    })
    .join('\n\n');
}

// One labelled cell from the Wijaya CV table, e.g. "| **Short Bio** | text |".
function tableCell(md: string, label: string): string {
  const row = md.split('\n').find((line) => line.includes(`**${label}**`));
  if (!row) throw new Error(`Source table has no "${label}" row`);
  const cells = row.split('|').map((cell) => cell.trim());
  const value = cells[2];
  if (!value) throw new Error(`Source table "${label}" row is empty`);
  return stripEmphasis(value);
}

interface PresenterSeed {
  _id: string;
  name: string;
  role?: string;
  bio: string;
}

function buildSeeds(): PresenterSeed[] {
  const wijaya = readSource('Copy of 2026-08-14 - Elbert 2026 CV Template');
  const tibbs = readSource('Copy of 2026-08-19 - Michaael Tibbs');
  const crous = readSource('Copy of 202608-26 - Hildagard Crous_biograhy');
  return [
    {
      _id: 'conferencePresenter-elbert-wijaya',
      name: 'Elbert Wijaya',
      role: tableCell(wijaya, 'Position'),
      bio: tableCell(wijaya, 'Short Bio'),
    },
    {
      _id: 'conferencePresenter-michael-tibbs',
      name: 'Michael Tibbs',
      bio: proseToPlainText(tibbs),
    },
    {
      _id: 'conferencePresenter-hildegard-crous',
      name: 'Hildegard Crous',
      bio: proseToPlainText(crous),
    },
  ];
}

async function main(): Promise<void> {
  const seeds = buildSeeds();
  const docs = seeds.map((seed) => ({
    _type: 'conferencePresenter',
    ...seed,
    event: EVENT,
    provenance: PROVENANCE,
  }));

  if (dryRun) {
    console.log(JSON.stringify(docs, null, 2));
    return;
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

  const tx = client.transaction();
  for (const doc of docs) tx.createOrReplace(doc);
  await tx.commit();

  const written = await client.fetch<{ _id: string; name: string }[]>(
    '*[_type == "conferencePresenter" && _id in $ids]{_id, name}',
    { ids: docs.map((doc) => doc._id) },
  );
  console.log(`Wrote ${written.length}/${docs.length} conferencePresenter docs to ${dataset}:`);
  for (const doc of written) console.log(`  ${doc._id}  ${doc.name}`);
  if (written.length !== docs.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[seed-symposium-presenters] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
