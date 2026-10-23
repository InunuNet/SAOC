/**
 * societies-content F1 — sync the affiliated societies from Lee-Ann's two Drive documents into
 * Sanity. Dry-run by default; --apply writes.
 *
 * Usage: pnpm sync:societies [--apply] [--fixture-docs <json>] [--fixture-out <json>]
 *                            [--backup-dir <dir>]
 *
 * Sources (read as-is from content/drive-source/, refreshed by execution/drive_docx_sync.py):
 *   A  "All Society data and history"  — 12 societies, wins field by field
 *   B  "Society Contact list - Word"   — 21 societies, fills only what A left empty
 *
 * Safety:
 *  - 21 societies are listed (matched by exact name: PATCH, else CREATE `society-<slug>`). The 16
 *    ids in HIDE_TARGETS get `listed: false` and nothing else. Nothing is ever deleted or
 *    unpublished. Any other society document prints `UNLISTED <id>` and exits 3 before a write.
 *  - --apply re-reads the store, rebuilds and re-validates the plan from that state (exit 3 on
 *    any unknown society), backs up every society document (published and drafts) under the
 *    backup dir and verifies the count, then commits every create, patch and hide in ONE
 *    transaction (all or nothing). Each patch is locked to its fetched revision
 *    (ifRevisionID); creates use `create`, so an id collision fails the transaction.
 *  - A second run over the result is a no-op.
 *
 * Env is parsed straight from .env.local (no dotenv). SANITY_API_TOKEN is only needed for
 * --apply against Sanity and is never printed. Exit: 0 ok, 2 usage, 3 unexpected state.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  DRIVE_SOURCE_TAGS,
  mergeSocieties,
  parseContactListMarkdown,
  parseSocietiesMarkdown,
  sourceTagFromManifest,
  toDocFields,
} from '../lib/societies/drive-parse';
import type { DriveManifest } from '../lib/societies/drive-parse';
import { planSync, planToWriteOp, UnexpectedStateError } from '../lib/societies/drive-sync-plan';
import type { DocStore, HideTarget, PlanItem } from '../lib/societies/drive-sync-plan';
import {
  createFixtureStore,
  createSanityStore,
  draftsShadowing,
} from '../lib/societies/drive-sync-store';

const EXIT_USAGE = 2;
const EXIT_UNEXPECTED_STATE = 3;
const DRAFT_ID_PREFIX = 'drafts.';
const DEFAULT_BACKUP_DIR = '.tmp/sandbox/societies-content/backup';
const SOURCE_DIR = 'content/drive-source/SAOC /3. Societies';
const SOURCE_A_DIR = `${SOURCE_DIR}/All Society data and history/v1.0`;
const SOURCE_B_DIR = `${SOURCE_DIR}/Society Contact list - Word/v1.0`;

/** Placeholders from our own seed that no Drive document supports. Hidden, never deleted. */
const HIDE_TARGETS: readonly HideTarget[] = [
  { _id: 'society-transvaal-orchid-society', name: 'Transvaal Orchid Society', reason: 'renamed-successor:witwatersrand-orchid-society' },
  { _id: 'society-northern-transvaal-orchid-society', name: 'Northern Transvaal Orchid Society', reason: 'renamed-successor:northern-gauteng-orchid-society' },
  { _id: 'society-west-rand-orchid-society', name: 'West Rand Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-lowveld-orchid-society', name: 'Lowveld Orchid Society', reason: 'superseded-near-match:lowveld-orchid-group' },
  { _id: 'society-highveld-orchid-society', name: 'Highveld Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-free-state-orchid-society', name: 'Free State Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-garden-route-orchid-society', name: 'Garden Route Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-overberg-orchid-society', name: 'Overberg Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-winelands-orchid-society', name: 'Winelands Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-midlands-orchid-society', name: 'Midlands Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-north-coast-orchid-society', name: 'North Coast Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-kalahari-orchid-society', name: 'Kalahari Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-limpopo-orchid-society', name: 'Limpopo Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-north-west-orchid-society', name: 'North West Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-vaal-triangle-orchid-society', name: 'Vaal Triangle Orchid Society', reason: 'no-drive-source' },
  { _id: 'society-south-cape-orchid-society', name: 'South Cape Orchid Society', reason: 'superseded-near-match:orchid-society-of-the-southern-cape' },
];

interface CliOptions {
  apply: boolean;
  fixtureDocs: string | null;
  fixtureOut: string | null;
  backupDir: string;
}

const USAGE =
  'Usage: pnpm sync:societies [--apply] [--fixture-docs <json>] [--fixture-out <json>] ' +
  '[--backup-dir <dir>]';

function parseArgs(argv: string[]): CliOptions | null {
  const options: CliOptions = {
    apply: false,
    fixtureDocs: null,
    fixtureOut: null,
    backupDir: DEFAULT_BACKUP_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) return null;
    if (arg === '--fixture-docs') options.fixtureDocs = value;
    else if (arg === '--fixture-out') options.fixtureOut = value;
    else if (arg === '--backup-dir') options.backupDir = value;
    else return null;
    i += 1;
  }
  if (options.fixtureOut && !options.fixtureDocs) return null;
  return options;
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

function openStore(options: CliOptions): DocStore {
  if (options.fixtureDocs) return createFixtureStore(options.fixtureDocs, options.fixtureOut);
  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID missing from .env.local');
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  if (options.apply && !env.SANITY_API_TOKEN) {
    throw new Error('SANITY_API_TOKEN missing from .env.local (required for --apply)');
  }
  return createSanityStore(projectId, dataset, options.apply ? env.SANITY_API_TOKEN : undefined);
}

function readManifest(dir: string): DriveManifest {
  const parsed: unknown = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
  return parsed as DriveManifest; // written by execution/drive_docx_sync.py
}

function describeItem(item: PlanItem): string | null {
  switch (item.kind) {
    case 'create':
      return `CREATE ${item.id}`;
    case 'patch': {
      const unset = item.unset.length > 0 ? ` unset=${item.unset.join(',')}` : '';
      return `PATCH ${item.id} ifRevisionID=${item.rev} set=${Object.keys(item.set).sort().join(',')}${unset}`;
    }
    case 'hide':
      return `HIDE ${item.id} ifRevisionID=${item.rev}`;
    case 'noop':
      return null;
  }
}

function writeBackup(dir: string, docs: unknown[]): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(docs, null, 2));
  const reread: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(reread) || reread.length !== docs.length) {
    throw new UnexpectedStateError(`backup verify failed: ${file} does not hold ${docs.length} docs`);
  }
  return file;
}

async function run(options: CliOptions): Promise<void> {
  const manifestA = readManifest(SOURCE_A_DIR);
  const manifestB = readManifest(SOURCE_B_DIR);
  const detailed = parseSocietiesMarkdown(readFileSync(`${SOURCE_A_DIR}/content.md`, 'utf8'));
  const contacts = parseContactListMarkdown(readFileSync(`${SOURCE_B_DIR}/content.md`, 'utf8'));
  const merged = mergeSocieties(detailed.societies, contacts.entries);
  const tags = {
    detailed: sourceTagFromManifest(manifestA),
    contactList: sourceTagFromManifest(manifestB),
  };
  if (tags.detailed !== DRIVE_SOURCE_TAGS.detailed || tags.contactList !== DRIVE_SOURCE_TAGS.contactList) {
    console.log('NOTE source versions differ from DRIVE_SOURCE_TAGS; stamping the manifest versions');
  }
  const docs = merged.societies.map((s) => toDocFields(s, tags));

  const store = openStore(options);
  const mode = options.apply ? 'APPLY' : 'DRY-RUN';
  console.log(`societies-sync mode=${mode} store=${store.kind}`);
  console.log(`source A=${SOURCE_A_DIR}/content.md md5=${manifestA.md5_checksum}`);
  console.log(`source B=${SOURCE_B_DIR}/content.md md5=${manifestB.md5_checksum}`);
  console.log(
    `parsed detailed=${detailed.societies.length} contactList=${contacts.entries.length} ` +
      `merged=${merged.societies.length} warnings=${detailed.warnings.length} ` +
      `conflicts=${merged.report.emailConflicts.length}`,
  );
  for (const w of detailed.warnings) {
    console.log(`WARN ${w.slug} ${w.field} ${w.reason} ${JSON.stringify(w.value)}`);
  }
  for (const c of merged.report.emailConflicts) {
    console.log(
      `CONFLICT ${c.slug} ${c.field} A=${JSON.stringify(c.detailed)} B=${JSON.stringify(c.contactList)}`,
    );
  }

  const plan = planSync(docs, await store.listPublished(), HIDE_TARGETS);
  if (plan.unlisted.length > 0) {
    for (const id of plan.unlisted) console.log(`UNLISTED ${id}`);
    throw new UnexpectedStateError(`${plan.unlisted.length} society document(s) not in the plan`);
  }
  for (const item of plan.items) {
    const line = describeItem(item);
    if (line) console.log(line);
  }
  const { create, patch, hide, noop } = plan.counts;
  console.log(`SUMMARY create=${create} patch=${patch} hide=${hide} noop=${noop}`);
  if (!options.apply) {
    console.log('DRY-RUN nothing written; re-run with --apply to write');
    return;
  }

  // Re-read at write time and rebuild the plan from exactly that state: whatever changed since
  // the plan above (a society added in Studio, an edit) is caught here, before any write.
  const everything = await store.listAllForBackup();
  const published = everything.filter((d) => !d._id.startsWith(DRAFT_ID_PREFIX));
  const writePlan = planSync(docs, published, HIDE_TARGETS);
  if (writePlan.unlisted.length > 0) {
    for (const id of writePlan.unlisted) console.log(`UNLISTED ${id}`);
    throw new UnexpectedStateError(`${writePlan.unlisted.length} society document(s) not in the plan`);
  }
  if (JSON.stringify(writePlan.items) !== JSON.stringify(plan.items)) {
    throw new UnexpectedStateError('society documents changed since the plan was shown; re-run');
  }
  const touched = new Set(writePlan.items.filter((i) => i.kind !== 'noop').map((i) => i.id));
  for (const id of draftsShadowing(everything, touched)) console.log(`WARN draft exists for ${id}`);
  const backup = writeBackup(options.backupDir, everything);
  console.log(`BACKUP ${backup} docs=${everything.length}`);
  const ops = writePlan.items.flatMap((item) => {
    const op = planToWriteOp(item);
    return op ? [op] : [];
  });
  await store.commitAll(ops);
  await store.finish();
  console.log(`APPLIED create=${create} patch=${patch} hide=${hide} transaction=single`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    console.error(USAGE);
    process.exit(EXIT_USAGE);
  }
  try {
    await run(options);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`sync-societies-from-drive failed: ${message}`);
    process.exit(err instanceof UnexpectedStateError ? EXIT_UNEXPECTED_STATE : 1);
  }
}

void main();
