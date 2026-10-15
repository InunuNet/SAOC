/**
 * launch-weekend F4 — unpublish the 17 unsourced, seeded societyEvent documents.
 *
 * All societyEvent docs except the National Show were seeded 2026-06-30 from the (now deleted)
 * lib/data/events.ts scaffold and have no source. This turns each published copy into a draft:
 * no field is edited, the document stays recoverable in Studio and in the JSON backup.
 *
 * Usage: pnpm exec tsx scripts/unpublish-invented-events.ts --dry-run | --apply
 *
 * Safety:
 *  - Only the explicit seeded id list below is ever touched. Any other published societyEvent
 *    (possibly a real, newly added event) is printed as `UNLISTED <id>` and the script exits 3
 *    before anything is written. A missing National Show doc also exits 3.
 *  - --apply backs up every target doc to .tmp/sandbox/launch-weekend-f4-backup/<ISO>.json and
 *    re-reads the file to verify the count before the first write.
 *  - Each doc is moved in one transaction locked to the fetched revision (ifRevisionID), so a
 *    document edited since the fetch fails the transaction and the script stops.
 *
 * Env is parsed directly from .env.local (no dotenv: its banner has corrupted a value here
 * before). SANITY_API_TOKEN is only needed for --apply and is never printed.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const API_VERSION = '2024-01-01';
const BACKUP_DIR = '.tmp/sandbox/launch-weekend-f4-backup';
const EXIT_USAGE = 2;
const EXIT_UNEXPECTED_STATE = 3;

const KEEP_ID = 'societyEvent-15-19th-south-african-national-orchid-show';

const INVENTED_IDS: readonly string[] = [
  'societyEvent-0-cape-orchid-society-autumn-show',
  'societyEvent-1-transvaal-autumn-orchid-show',
  'societyEvent-2-judging-workshop-paphiopedilum',
  'societyEvent-1-cape-orchid-society-winter-show',
  'societyEvent-2-natal-winter-orchid-show',
  'societyEvent-3-saoc-council-agm-2026',
  'societyEvent-4-transvaal-spring-orchid-show',
  'societyEvent-5-judging-workshop-cattleya-alliance',
  'societyEvent-6-cape-spring-orchid-show',
  'societyEvent-7-northern-transvaal-spring-show',
  'societyEvent-8-eastern-province-spring-show',
  'societyEvent-9-lowveld-spring-orchid-show',
  'societyEvent-10-midlands-orchid-show',
  'societyEvent-11-east-rand-cymbidium-show',
  'societyEvent-12-hybridisation-symposium-2026',
  'societyEvent-13-summer-species-show',
  'societyEvent-14-judging-accreditation-exam-round-1',
];

const SYSTEM_FIELDS = ['_rev', '_createdAt', '_updatedAt'] as const;

type SanityDoc = { _id: string; _type: string; _rev: string } & Record<string, unknown>;

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

function parseMode(argv: string[]): 'dry-run' | 'apply' | null {
  const dry = argv.includes('--dry-run');
  const apply = argv.includes('--apply');
  if (dry === apply) return null;
  return apply ? 'apply' : 'dry-run';
}

function writeBackup(targets: SanityDoc[]): string {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(targets, null, 2));
  const reread: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(reread) || reread.length !== targets.length) {
    console.error(`BACKUP VERIFY FAILED: ${file} does not hold ${targets.length} docs`);
    process.exit(1);
  }
  return file;
}

function toDraft(doc: SanityDoc): Record<string, unknown> & { _id: string; _type: string } {
  const copy: Record<string, unknown> = { ...doc };
  for (const field of SYSTEM_FIELDS) delete copy[field];
  return { ...copy, _id: `drafts.${doc._id}`, _type: doc._type };
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  if (!mode) {
    console.error('Usage: pnpm exec tsx scripts/unpublish-invented-events.ts --dry-run | --apply');
    process.exit(EXIT_USAGE);
  }

  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const token = env.SANITY_API_TOKEN;
  if (!projectId) {
    console.error('NEXT_PUBLIC_SANITY_PROJECT_ID missing from .env.local');
    process.exit(1);
  }
  if (mode === 'apply' && !token) {
    console.error('SANITY_API_TOKEN missing from .env.local (required for --apply)');
    process.exit(1);
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    useCdn: false,
    token: mode === 'apply' ? token : undefined,
  });

  console.log(`MODE ${mode}`);
  const published = await client.fetch<SanityDoc[]>(
    '*[_type == "societyEvent" && !(_id in path("drafts.**"))]',
  );
  console.log(`FOUND ${published.length}`);

  const byId = new Map(published.map((d) => [d._id, d]));
  const unlisted = published.filter((d) => d._id !== KEEP_ID && !INVENTED_IDS.includes(d._id));
  for (const d of unlisted) console.log(`UNLISTED ${d._id}`);
  if (unlisted.length > 0) process.exit(EXIT_UNEXPECTED_STATE);
  if (!byId.has(KEEP_ID)) {
    console.error(`KEEP document missing: ${KEEP_ID}`);
    process.exit(EXIT_UNEXPECTED_STATE);
  }
  console.log(`KEEP ${KEEP_ID}`);

  const targets = INVENTED_IDS.map((id) => byId.get(id)).filter((d): d is SanityDoc => !!d);
  for (const d of targets) console.log(`UNPUBLISH ${d._id} rev=${d._rev}`);

  const backup = mode === 'apply' && targets.length > 0 ? writeBackup(targets) : null;
  console.log(`SUMMARY unpublish=${targets.length} keep=1 backup=${backup ?? 'none'}`);
  if (mode === 'dry-run') return;

  for (const d of targets) {
    await client
      .transaction()
      .patch(d._id, { ifRevisionID: d._rev })
      .createIfNotExists(toDraft(d))
      .delete(d._id)
      .commit();
  }
  console.log(`DONE unpublished=${targets.length}`);
}

main().catch((err: unknown) => {
  console.error('unpublish-invented-events failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
