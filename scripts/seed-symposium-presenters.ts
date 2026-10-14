/**
 * Seeds the SAOC Symposium speakers as `conferencePresenter` documents, with each bio
 * taken verbatim from Lee-Ann's Drive docs (mirrored locally by
 * execution/drive_docx_sync.py under content/drive-source/, which is gitignored). Robert
 * Fuchs's bio is a PDF, which that sync skips, so it is read from the PDF itself.
 *
 * Cleared by the SAOC lead 2026-10-08: content only, no rendering. The symposium page
 * loads these via lib/view-models/load-presenters.ts but renders nothing until the NOS
 * design handoff (F7) lands.
 *
 * Verbatim rules (docs/rules/no-invention.md):
 *   - Words are copied as written, including drafting notes. Only formatting is
 *     normalised for a plain-text field (markdown emphasis markers dropped, list markers
 *     become "• "), and obvious typos/US spellings are corrected to SA/UK English from
 *     the explicit SPELLING_FIXES list below.
 *   - `role` is set only where the source carries one (Wijaya's "Position").
 *   - `photo` is each speaker's own Drive photograph, uploaded unedited (no crop, no
 *     hotspot), when --photos-dir is given. `order` is left unset: a gap for Lee-Ann.
 *   - The Fuchs PDF prints the whole bio twice; one copy is used, and the extraction is
 *     checked word for word against a second extraction mode before anything is written.
 *   - `provenance` is 'council-draft': the source docs read as drafts (a third-party
 *     first-person passage in the Tibbs doc, an editorial aside in the Wijaya doc).
 *
 * Deterministic _ids + createOrReplace, so a re-run converges instead of duplicating.
 * --drafts writes `drafts.<id>` documents instead of published ones, so Studio shows the
 * change for review while the published documents stay as they are.
 *
 * Required env (read from .env.local, same as scripts/update-about-judging-copy.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 *
 * Run with: node --import tsx/esm scripts/seed-symposium-presenters.ts [--dry-run] [--drafts]
 *   [--source-root <dir>] [--fuchs-pdf <file>] [--photos-dir <dir>]
 * --photos-dir holds <slug>-photo.<ext> files: wijaya, tibbs, crous, fuchs.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

const SPEAKERS_DIR = path.join('National Show', '6. SAOC Symposium', 'Speakers');
const EVENT = 'saoc-symposium';
const PROVENANCE = 'council-draft';
const FUCHS_PDF_HEADER = ['Biographical Information', 'Robert Fuchs'];

// Brad, 2026-10-13: "Use the correct spelling ... always use English SA/UK speclling".
// Obvious typos and US spellings are corrected; wording and meaning stay verbatim.
// Each pair must match exactly once in that speaker's source text, or the run aborts.
const SPELLING_FIXES: Record<string, [string, string][]> = {
  wijaya: [
    ['form and color', 'form and colour'],
    ['projects center on', 'projects centre on'],
    ['distribution centered in', 'distribution centred in'],
  ],
  tibbs: [
    ['Arnie LInsman', 'Arnie Linsman'],
    ['Cultivation,\'', 'Cultivation,"'],
    ['worked fulltime', 'worked full-time'],
  ],
  crous: [],
  fuchs: [
    ['Selby Botantical', 'Selby Botanical'],
    ['in honor of', 'in honour of'],
    ['a breeding program at', 'a breeding programme at'],
    ['lectures and programs to', 'lectures and programmes to'],
    ['orchid hybridizing', 'orchid hybridising'],
    ['this prestigious honor.', 'this prestigious honour.'],
  ],
};

function correctSpelling(slug: string, text: string): string {
  let out = text;
  for (const [from, to] of SPELLING_FIXES[slug] ?? []) {
    const count = out.split(from).length - 1;
    if (count !== 1) throw new Error(`Spelling fix "${from}" matched ${count} times in ${slug}`);
    out = out.replace(from, to);
  }
  return out;
}

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
const asDrafts = process.argv.includes('--drafts');
const fuchsPdf = argValue('--fuchs-pdf');
const photosDir = argValue('--photos-dir');

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

function pdfText(file: string, mode: '-layout' | '-raw'): string {
  return execFileSync('pdftotext', [mode, file, '-'], { encoding: 'utf8' });
}

// The PDF repeats its whole bio; keep the text up to the second header.
function firstCopy(text: string): string {
  const first = text.indexOf(FUCHS_PDF_HEADER[0]);
  if (first === -1) throw new Error('Fuchs PDF has no "Biographical Information" header');
  const second = text.indexOf(FUCHS_PDF_HEADER[0], first + 1);
  return second === -1 ? text.slice(first) : text.slice(first, second);
}

// -layout keeps blank lines between paragraphs; wrapped lines inside one are joined.
function fuchsBio(file: string): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of firstCopy(pdfText(file, '-layout')).replace(/\f/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (trimmed) {
      current.push(trimmed);
    } else if (current.length) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) paragraphs.push(current.join(' '));
  if (paragraphs[0] !== FUCHS_PDF_HEADER[0] || paragraphs[1] !== FUCHS_PDF_HEADER[1]) {
    throw new Error('Fuchs PDF header is not "Biographical Information / Robert Fuchs"');
  }
  const bio = paragraphs.slice(2).join('\n\n');
  const headerWordCount = FUCHS_PDF_HEADER.join(' ').split(' ').length;
  const rawWords = firstCopy(pdfText(file, '-raw')).split(/\s+/).filter(Boolean).slice(headerWordCount);
  if (bio.split(/\s+/).join(' ') !== rawWords.join(' ')) {
    throw new Error('Fuchs PDF -layout and -raw extractions disagree; refusing to write');
  }
  return bio;
}

interface PresenterSeed {
  _id: string;
  slug: string;
  name: string;
  role?: string;
  bio: string;
}

function buildSeeds(): PresenterSeed[] {
  return rawSeeds().map((seed) => ({ ...seed, bio: correctSpelling(seed.slug, seed.bio) }));
}

function rawSeeds(): PresenterSeed[] {
  const wijaya = readSource('Copy of 2026-08-14 - Elbert 2026 CV Template');
  const tibbs = readSource('Copy of 2026-08-19 - Michaael Tibbs');
  const crous = readSource('Copy of 202608-26 - Hildagard Crous_biograhy');
  return [
    {
      _id: 'conferencePresenter-elbert-wijaya',
      slug: 'wijaya',
      name: 'Elbert Wijaya',
      role: tableCell(wijaya, 'Position'),
      bio: tableCell(wijaya, 'Short Bio'),
    },
    {
      _id: 'conferencePresenter-michael-tibbs',
      slug: 'tibbs',
      name: 'Michael Tibbs',
      bio: proseToPlainText(tibbs),
    },
    {
      _id: 'conferencePresenter-hildegard-crous',
      slug: 'crous',
      name: 'Hildegard Crous',
      bio: proseToPlainText(crous),
    },
    ...(fuchsPdf
      ? [
          {
            _id: 'conferencePresenter-robert-fuchs',
            slug: 'fuchs',
            name: 'Robert Fuchs',
            bio: fuchsBio(fuchsPdf),
          },
        ]
      : []),
  ];
}

function photoFile(slug: string): string | undefined {
  if (!photosDir) return undefined;
  const match = readdirSync(photosDir).find((file) => file.startsWith(`${slug}-photo.`));
  if (!match) throw new Error(`No ${slug}-photo file in ${photosDir}`);
  return path.join(photosDir, match);
}

async function main(): Promise<void> {
  const seeds = buildSeeds();
  const photos = new Map(seeds.map((seed) => [seed._id, photoFile(seed.slug)]));

  if (dryRun) {
    console.log(
      JSON.stringify(
        seeds.map((seed) => ({ ...seed, photo: photos.get(seed._id) ?? null })),
        null,
        2,
      ),
    );
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

  const docs = [];
  for (const { slug, ...seed } of seeds) {
    const file = photos.get(seed._id);
    // Sanity dedupes identical uploads by content hash, so a re-run reuses the asset.
    const asset = file
      ? await client.assets.upload('image', readFileSync(file), { filename: path.basename(file) })
      : undefined;
    if (asset && file) console.log(`  asset ${asset._id}  <- ${slug} ${path.basename(file)}`);
    docs.push({
      _type: 'conferencePresenter',
      ...seed,
      _id: asDrafts ? `drafts.${seed._id}` : seed._id,
      event: EVENT,
      provenance: PROVENANCE,
      ...(asset
        ? { photo: { _type: 'image', asset: { _type: 'reference', _ref: asset._id } } }
        : {}),
    });
  }

  const tx = client.transaction();
  for (const doc of docs) tx.createOrReplace(doc);
  await tx.commit();

  const written = await client.fetch<{ _id: string; name: string; photo: string | null }[]>(
    '*[_type == "conferencePresenter" && _id in $ids]{_id, name, "photo": photo.asset._ref}',
    { ids: docs.map((doc) => doc._id) },
  );
  console.log(`Wrote ${written.length}/${docs.length} conferencePresenter docs to ${dataset}:`);
  for (const doc of written) console.log(`  ${doc._id}  ${doc.name}  photo=${doc.photo ?? 'none'}`);
  if (written.length !== docs.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[seed-symposium-presenters] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
