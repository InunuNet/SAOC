/**
 * Test-data purge CLI (mission go-live-prep, F1). Dry-run by default; --apply is guarded.
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/purge-test-data.mts                      # live dry-run (read-only)
 *   PURGE_CONFIRM=<token> pnpm exec tsx scripts/ops/purge-test-data.mts \
 *     --apply --manifest <path>                                        # Brad only
 *   ... --fixture <snapshot.json> [--now <iso>] [--fixture-out <path>] # no Firestore at all
 *
 * Exit codes: 0 ok, 2 usage/refusal, 3 apply gate failed, 4 hard guard tripped,
 * 5 backup failure. Selection logic lives in purge-select.mts (pure, no write API).
 * Never prints, logs or writes an environment value. Output stays inside .tmp/sandbox.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  digestOf,
  digestOfClasses,
  hardGuard,
  isTestEvidence,
  selectPurge,
  type PurgeCollection,
  type PurgeDoc,
  type Selection,
  type SelectedDoc,
  type Snapshot,
} from './purge-select.mts';

export const BATCH_LIMIT = 400;
const MAX_MANIFEST_AGE_MS = 60 * 60 * 1000;
const SCHEMA_VERSION = 1;
const TOKEN_LENGTH = 12;
const ENV_FILE = '.env.local';
const DEFAULT_OUT_DIR = '.tmp/sandbox/purge';
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const SANDBOX_ROOT = path.join(PROJECT_ROOT, '.tmp', 'sandbox');
const FIRESTORE_FAILED_PRECONDITION = 9;
const FIRESTORE_NOT_FOUND = 5;
const COLLECTIONS: readonly PurgeCollection[] = ['orders', 'tickets', 'vendorStandOrders'];
const DELETE_ORDER: readonly PurgeCollection[] = ['tickets', 'orders', 'vendorStandOrders'];
const NANOS_WIDTH = 9;

type Source = 'live' | 'fixture';

interface Options {
  apply: boolean;
  manifest: string | null;
  outDir: string;
  fixture: string | null;
  fixtureOut: string | null;
  now: string | null;
}

interface Manifest {
  schemaVersion: number;
  mode: string;
  source: Source;
  projectId: string;
  now: string;
  generatedAt: string;
  classes: Selection['classes'];
  heldBack: Selection['heldBack'];
  stockDelta: Selection['stockDelta'];
  totals: Selection['totals'];
  selectionDigest: string;
  confirmToken: string;
}

interface ApplyEvent {
  t: string;
  kind: 'backup-written' | 'batch-commit';
  size?: number;
}

interface DeleteTarget extends SelectedDoc {
  body: PurgeDoc;
}

class ExitError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function say(line: string): void {
  process.stdout.write(line + '\n');
}

function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolveInsideSandbox(raw: string, label: string): string {
  const resolved = path.resolve(PROJECT_ROOT, raw);
  if (!isInside(SANDBOX_ROOT, resolved)) {
    throw new ExitError(2, `${label} must resolve inside .tmp/sandbox`);
  }
  return resolved;
}

function parseOptions(argv: string[]): Options {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        apply: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        manifest: { type: 'string' },
        'out-dir': { type: 'string' },
        fixture: { type: 'string' },
        'fixture-out': { type: 'string' },
        now: { type: 'string' },
      },
      allowPositionals: false,
    });
  } catch (err) {
    throw new ExitError(2, `usage error: ${err instanceof Error ? err.message : 'bad arguments'}`);
  }
  const v = parsed.values;
  const opts: Options = {
    apply: v.apply === true,
    manifest: v.manifest ?? null,
    outDir: v['out-dir'] ?? DEFAULT_OUT_DIR,
    fixture: v.fixture ?? null,
    fixtureOut: v['fixture-out'] ?? null,
    now: v.now ?? null,
  };
  if (opts.apply && v['dry-run'] === true) throw new ExitError(2, '--apply and --dry-run are exclusive');
  if (opts.apply && !opts.manifest) throw new ExitError(2, '--apply requires --manifest <path>');
  if (!opts.apply && opts.manifest) throw new ExitError(2, '--manifest is only valid with --apply');
  if (opts.now && !opts.fixture) throw new ExitError(2, '--now is only valid with --fixture');
  if (opts.now && Number.isNaN(Date.parse(opts.now))) throw new ExitError(2, '--now is not a valid ISO date');
  if (opts.fixtureOut && !(opts.fixture && opts.apply)) {
    throw new ExitError(2, '--fixture-out requires --fixture and --apply');
  }
  return opts;
}

// ---- snapshot sources -------------------------------------------------------------------------

function readFixture(file: string, nowOverride: string | null): { snapshot: Snapshot; now: string } {
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot; // trusted local fixture shape
  for (const name of COLLECTIONS) snapshot.collections[name] ??= {};
  return { snapshot, now: nowOverride ?? snapshot.now };
}

function loadEnv(): void {
  if (fs.existsSync(path.join(PROJECT_ROOT, ENV_FILE))) {
    process.loadEnvFile(path.join(PROJECT_ROOT, ENV_FILE));
  }
}

function plainValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plainValue);
  if (value === null || typeof value !== 'object') return value === undefined ? null : value;
  const obj = value as Record<string, unknown>;
  if (typeof obj.toDate === 'function') return (obj.toDate as () => Date).call(obj).toISOString();
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) out[key] = plainValue(obj[key]);
  return out;
}

function revisionOf(time: { seconds: number; nanoseconds: number }): string {
  return `${time.seconds}.${String(time.nanoseconds).padStart(NANOS_WIDTH, '0')}`;
}

async function readLive(): Promise<{ snapshot: Snapshot; now: string }> {
  loadEnv();
  const { initAdmin } = await import('../../lib/firebase-admin.ts');
  const { getFirestore } = await import('firebase-admin/firestore');
  initAdmin();
  const db = getFirestore();
  const collections = { orders: {}, tickets: {}, vendorStandOrders: {} } as Snapshot['collections'];
  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    for (const doc of snap.docs) {
      collections[name][doc.id] = {
        ...(plainValue(doc.data()) as PurgeDoc),
        _updateTime: revisionOf(doc.updateTime),
      };
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? '';
  return { snapshot: { now: '', projectId, collections }, now: new Date().toISOString() };
}

async function readSource(opts: Options): Promise<{ snapshot: Snapshot; now: string; source: Source }> {
  if (opts.fixture) return { ...readFixture(opts.fixture, opts.now), source: 'fixture' };
  return { ...(await readLive()), source: 'live' };
}

// ---- dry-run ---------------------------------------------------------------------------------

function stamp(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

function buildManifest(
  selection: Selection,
  source: Source,
  projectId: string,
  now: string,
): Manifest {
  const selectionDigest = digestOf(selection);
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: 'dry-run',
    source,
    projectId,
    now,
    generatedAt: now,
    classes: selection.classes,
    heldBack: selection.heldBack,
    stockDelta: selection.stockDelta,
    totals: selection.totals,
    selectionDigest,
    confirmToken: selectionDigest.slice(0, TOKEN_LENGTH),
  };
}

function reportDryRun(manifest: Manifest, file: string): void {
  say(`DRY RUN (${manifest.source}, project ${manifest.projectId}) at ${manifest.now}`);
  for (const [id, cls] of Object.entries(manifest.classes)) say(`  select ${id} (${cls.rule}): ${cls.count}`);
  for (const [id, list] of Object.entries(manifest.heldBack)) say(`  held   ${id}: ${list.length}`);
  for (const row of manifest.stockDelta.rows) {
    say(`  stock  ${row.showId} / ${row.ticketType}: ${row.before} -> ${row.after}`);
  }
  say(`totals: selected ${manifest.totals.selected}, held ${manifest.totals.heldBack}`);
  say(`manifest: ${path.relative(PROJECT_ROOT, file)}`);
  say(`confirm token: ${manifest.confirmToken}`);
}

async function runDry(opts: Options): Promise<void> {
  const outDir = resolveInsideSandbox(opts.outDir, '--out-dir');
  const { snapshot, now, source } = await readSource(opts);
  const selection = selectPurge(snapshot, now);
  const manifest = buildManifest(selection, source, snapshot.projectId, now);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `manifest-${stamp(manifest.generatedAt)}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  reportDryRun(manifest, file);
}

// ---- apply: gates ----------------------------------------------------------------------------

function gateFail(message: string): never {
  throw new ExitError(3, `apply gate failed: ${message}`);
}

function loadManifest(file: string): Manifest {
  let manifest: Manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, file), 'utf8')) as Manifest; // validated below
  } catch {
    return gateFail('manifest missing or not valid JSON');
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) gateFail('unsupported manifest schemaVersion');
  if (manifest.mode !== 'dry-run') gateFail('manifest is not a dry-run manifest');
  if (!manifest.classes || digestOfClasses(manifest.classes) !== manifest.selectionDigest) {
    gateFail('manifest selectionDigest does not match its classes');
  }
  return manifest;
}

function checkAge(manifest: Manifest, clock: number): void {
  const age = clock - Date.parse(manifest.generatedAt);
  if (Number.isNaN(age) || age < 0) gateFail('manifest generatedAt is invalid or in the future');
  if (age > MAX_MANIFEST_AGE_MS) gateFail('manifest is older than 60 minutes');
}

function checkSource(manifest: Manifest, source: Source, projectId: string): void {
  if (manifest.source !== source) gateFail(`a ${manifest.source} manifest cannot apply to ${source}`);
  if (source === 'live' && (!projectId || manifest.projectId !== projectId)) {
    gateFail('manifest projectId is not the configured project');
  }
}

// ---- apply: backup + delete ------------------------------------------------------------------

function collectTargets(selection: Selection, snapshot: Snapshot, now: string): DeleteTarget[] {
  const targets: DeleteTarget[] = [];
  for (const cls of Object.values(selection.classes)) {
    for (const ref of cls.docs) {
      const body = snapshot.collections[ref.collection][ref.id];
      const parentId = typeof body.orderId === 'string' ? body.orderId : null;
      const parent = parentId ? snapshot.collections.orders[parentId] : undefined;
      const guard = hardGuard(ref.collection, body, now, {
        parentIsTest: ref.collection === 'tickets' && parent !== undefined && isTestEvidence(parent),
      });
      if (!guard.ok) throw new ExitError(4, `hard guard refused ${ref.collection}/${ref.id}: ${guard.reason}`);
      targets.push({ ...ref, body });
    }
  }
  return DELETE_ORDER.flatMap((name) => targets.filter((t) => t.collection === name));
}

function writeBackup(file: string, manifest: Manifest, targets: DeleteTarget[], when: string): string {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: when,
    projectId: manifest.projectId,
    source: manifest.source,
    manifestDigest: manifest.selectionDigest,
    docs: targets.map((t) => ({
      collection: t.collection,
      id: t.id,
      path: `${t.collection}/${t.id}`,
      data: t.body,
    })),
  };
  const raw = JSON.stringify(payload, null, 2) + '\n';
  const fd = fs.openSync(file, 'w');
  try {
    fs.writeSync(fd, raw);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  const reread = fs.readFileSync(file, 'utf8');
  const count = (JSON.parse(reread) as { docs: unknown[] }).docs.length;
  if (reread !== raw || count !== manifest.totals.selected) {
    throw new ExitError(5, 'backup verification failed: nothing was deleted');
  }
  return createHash('sha256').update(reread).digest('hex');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function timestampFromRevision(revision: string, TimestampCtor: typeof import('firebase-admin/firestore').Timestamp) {
  const [seconds, nanos] = revision.split('.');
  return new TimestampCtor(Number(seconds), Number(nanos));
}

function errorCode(err: unknown): number | null {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : null;
}

async function liveDeleter(): Promise<(batch: DeleteTarget[]) => Promise<string[]>> {
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const refOf = (t: DeleteTarget) => db.collection(t.collection).doc(t.id);
  const pre = (t: DeleteTarget) => ({
    lastUpdateTime: timestampFromRevision(t.updateTime ?? '0.0', Timestamp),
  });
  return async (batch) => {
    const writer = db.batch();
    for (const t of batch) writer.delete(refOf(t), pre(t));
    try {
      await writer.commit();
      return [];
    } catch (err) {
      if (errorCode(err) !== FIRESTORE_FAILED_PRECONDITION) throw err;
    }
    const skipped: string[] = [];
    for (const t of batch) {
      try {
        await refOf(t).delete(pre(t));
      } catch (err) {
        const code = errorCode(err);
        if (code !== FIRESTORE_FAILED_PRECONDITION && code !== FIRESTORE_NOT_FOUND) throw err;
        skipped.push(`${t.collection}/${t.id}`);
      }
    }
    return skipped;
  };
}

function fixtureDeleter(snapshot: Snapshot): (batch: DeleteTarget[]) => Promise<string[]> {
  return async (batch) => {
    for (const t of batch) delete snapshot.collections[t.collection][t.id];
    return [];
  };
}

async function deleteAll(
  targets: DeleteTarget[],
  deleter: (batch: DeleteTarget[]) => Promise<string[]>,
  events: ApplyEvent[],
  clock: () => string,
): Promise<{ deleted: number; skipped: string[] }> {
  let deleted = 0;
  const skipped: string[] = [];
  for (const name of DELETE_ORDER) {
    for (const batch of chunk(targets.filter((t) => t.collection === name), BATCH_LIMIT)) {
      const skippedHere = await deleter(batch);
      events.push({ t: clock(), kind: 'batch-commit', size: batch.length });
      skipped.push(...skippedHere);
      deleted += batch.length - skippedHere.length;
    }
  }
  return { deleted, skipped };
}

async function runApply(opts: Options): Promise<void> {
  const outDir = resolveInsideSandbox(opts.outDir, '--out-dir');
  const fixtureOut = opts.fixtureOut ? resolveInsideSandbox(opts.fixtureOut, '--fixture-out') : null;
  const manifest = loadManifest(opts.manifest ?? '');
  const source: Source = opts.fixture ? 'fixture' : 'live';
  const clockNow = opts.fixture && opts.now ? opts.now : new Date().toISOString();
  checkAge(manifest, Date.parse(clockNow));
  if (!process.env.PURGE_CONFIRM || process.env.PURGE_CONFIRM !== manifest.confirmToken) {
    gateFail('PURGE_CONFIRM does not match the manifest confirm token');
  }
  const read = await readSource({ ...opts, now: opts.fixture ? (opts.now ?? null) : null });
  checkSource(manifest, source, read.snapshot.projectId);
  // Re-select as of the dry-run clock so reservations that lapse later never join the selection.
  const fresh = selectPurge(read.snapshot, manifest.now);
  if (digestOf(fresh) !== manifest.selectionDigest) {
    gateFail('selection drifted since the dry-run (a doc was added, removed or edited)');
  }
  const targets = collectTargets(fresh, read.snapshot, manifest.now);

  fs.mkdirSync(outDir, { recursive: true });
  const ts = stamp(clockNow);
  const backupPath = path.join(outDir, `backup-${ts}.json`);
  const events: ApplyEvent[] = [];
  const backupSha256 = writeBackup(backupPath, manifest, targets, clockNow);
  events.push({ t: clockNow, kind: 'backup-written' });

  const deleter = opts.fixture ? fixtureDeleter(read.snapshot) : await liveDeleter();
  const { deleted, skipped } = await deleteAll(targets, deleter, events, () => clockNow);
  const result = {
    events,
    deleted,
    skipped,
    backupPath: path.relative(PROJECT_ROOT, backupPath),
    backupSha256,
  };
  fs.writeFileSync(path.join(outDir, `apply-result-${ts}.json`), JSON.stringify(result, null, 2) + '\n');
  if (fixtureOut) fs.writeFileSync(fixtureOut, JSON.stringify(read.snapshot, null, 2) + '\n');
  say(`APPLY complete (${source}): deleted ${deleted}, skipped ${skipped.length}`);
  say(`backup: ${result.backupPath} sha256 ${backupSha256}`);
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  if (opts.apply) await runApply(opts);
  else await runDry(opts);
}

main().catch((err: unknown) => {
  if (err instanceof ExitError) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = err.code;
    return;
  }
  const detail = err instanceof Error ? err.name : 'unknown error';
  process.stderr.write(`purge failed unexpectedly (${detail})\n`);
  process.exitCode = 1;
});
