/**
 * firestore-residue-guard — read-only recursive scanner for test-marker residue in
 * the live Firestore database.
 *
 * Closes the Firestore half of the 2026-08-15 residue-detection gap. The Sanity half
 * was closed by scripts/scan-dataset-residue.ts (its contract explicitly scoped
 * Firestore out). The identical risk class exists here:
 * contracts/checks/ticketing-hardening/_shared.mjs writes sentinel tickets into the
 * live `tickets` collection behind cleanup-only protection, and
 * contracts/checks/m2-next16-upgrade/check-routes.mjs POSTs a real ITN probe into
 * `m_payment_id`. Full design: contracts/golden/firestore-residue-guard/README.md.
 * Marker catalogue (5 regex families + 1 literal known-residue-ID allowlist, each
 * traced to file/line): contracts/golden/firestore-residue-guard/marker-catalogue.md.
 *
 * Two modes:
 *   - live (default): Firebase Admin SDK, credentials read directly from .env.local
 *     the same way scripts/admin-grant.ts and scripts/scan-dataset-residue.ts do it —
 *     no `dotenv` package (its startup banner has corrupted an env value on this
 *     project before; see scripts/seed-page-singletons.ts's header comment).
 *   - fixture (`--fixture <path>`): reads a local JSON array of
 *     `{ collection, id, data }` records. No Firebase Admin app is ever initialized in
 *     this mode, no credential is read, no network call is made.
 *
 * This client is read-only. It must never call a Firestore mutation method — never
 * set, never update, never delete, never add, never create, never batch, never run a
 * transaction.
 *
 * Run with: pnpm exec tsx scripts/scan-firestore-residue.ts [--fixture <path>]
 * (Do not run with `node --import tsx/esm` — that form is what broke the sibling
 * dataset-residue-guard's CI job on GitHub's Node 22 with ERR_REQUIRE_CYCLE_MODULE.)
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE_FLAG = '--fixture';

// ---------------------------------------------------------------------------
// Marker catalogue — see contracts/golden/firestore-residue-guard/marker-catalogue.md
// for the file:line trace behind each pattern. Do not invent new patterns; do not
// drop any of these five, and keep the known-residue allowlist in sync with it.
// ---------------------------------------------------------------------------

interface MarkerPattern {
  readonly name: string;
  readonly regex: RegExp;
}

const MARKER_PATTERNS: readonly MarkerPattern[] = [
  { name: 'SENTINEL-EMAIL-DOMAIN', regex: /@harden-check\.invalid\b/i },
  { name: 'HARDEN-BOOKING-REF', regex: /^HARDEN-/i },
  { name: 'HARDEN-ATTENDEE-NAME', regex: /^Harden (Check|Filler)$/i },
  { name: 'M2-CHECK-ITN-PROBE', regex: /^m2-check-itn-\d+-[a-z0-9]+$/i },
  { name: 'EPOCH-MS-NONCE (catch-all, heuristic)', regex: /(?<!\d)\d{13}(?!\d)/ },
  { name: 'D6-SENTINEL-EMAIL-DOMAIN', regex: /@d6-door-checkin-check\.invalid\b/i },
  { name: 'D6-BOOKING-REF', regex: /^D6-(NOAUTH|ADMIN|NONADMIN)-/i },
  { name: 'D6-ATTENDEE-NAME', regex: /^D6 Door Checkin Check$/i },
];

// Real `tickets` documents written by the live /api/tickets/checkout route during
// manual PayFast diagnostic testing on 2026-08-12 (not test-harness data — see
// marker-catalogue.md). No regex can distinguish these from a genuine booking ref, so
// they are matched literally. Do not generalise this into a pattern.
const KNOWN_RESIDUE_BOOKING_REFS: ReadonlySet<string> = new Set([
  'SAOC-2027-E8WND2SM4HTD',
  'SAOC-2027-JG6Q598FG0QD',
  'SAOC-2027-5H63FBAE8AHP',
  'SAOC-2027-C584G82Z7F6D',
]);

// 7 `tickets` documents left behind by the 2026-08-16 payfast-m1 gate run
// (attendeeName: 'Proof', no marker-shaped bookingRef — see
// contracts/golden/payfast-m1-residue-cleanup/leaked-docs-2026-08-16.md). Their origin
// is not fully explained by any committed source (see that file); they are matched
// literally against the Firestore document ID itself, not a field value, since no regex
// can distinguish a bare 'Proof' attendeeName from a real one. Deletion is out of scope
// here — awaiting Brad's decision, not made in this contract.
const KNOWN_RESIDUE_DOC_IDS: ReadonlySet<string> = new Set([
  'CrF2gcbRQCMPGRKSn8Da',
  'MbnMi9tAL7WiFXTMKufc',
  'HorxzPqpPWfo7sw1w3Hx',
  'diLuP0fkUEXhv9P2f21D',
  'kPxuUXcKF8jTw0IczYI4',
  'OXauVpRMw6CX2bPeYjrY',
  'W7yyX5eB63WYKxspuR5I',
]);

// ---------------------------------------------------------------------------
// Recursive walk
// ---------------------------------------------------------------------------

interface Hit {
  readonly collection: string;
  readonly docId: string;
  readonly fieldPath: string;
  readonly value: string;
}

function matchesAnyPattern(value: string): boolean {
  return (
    MARKER_PATTERNS.some((pattern) => pattern.regex.test(value)) ||
    KNOWN_RESIDUE_BOOKING_REFS.has(value) ||
    KNOWN_RESIDUE_DOC_IDS.has(value)
  );
}

/** Recursively walk a document value, collecting every leaf that matches a marker. */
function walk(
  value: unknown,
  path_: string,
  collection: string,
  docId: string,
  hits: Hit[],
): void {
  if (typeof value === 'string') {
    if (matchesAnyPattern(value)) {
      hits.push({ collection, docId, fieldPath: path_, value });
    }
    return;
  }
  if (typeof value === 'number') {
    const asString = String(value);
    if (matchesAnyPattern(asString)) {
      hits.push({ collection, docId, fieldPath: path_, value: asString });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path_}[${index}]`, collection, docId, hits));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path_ === '' ? key : `${path_}.${key}`;
      walk(nested, nextPath, collection, docId, hits);
    }
  }
}

/** Scan one document (no field is exempt — including the document id itself). */
function scanDocument(collection: string, id: string, data: Record<string, unknown>): Hit[] {
  const hits: Hit[] = [];
  walk(id, 'id', collection, id, hits);
  walk(data, '', collection, id, hits);
  return hits;
}

// ---------------------------------------------------------------------------
// Firestore-native value normalization (Timestamp / GeoPoint / DocumentReference)
// ---------------------------------------------------------------------------

function hasToDate(value: object): value is { toDate: () => Date } {
  return typeof (value as { toDate?: unknown }).toDate === 'function';
}

function isGeoPointShaped(value: object): value is { latitude: number; longitude: number } {
  const candidate = value as { latitude?: unknown; longitude?: unknown };
  return typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number';
}

function isDocumentReferenceShaped(value: object): value is { path: string } {
  const candidate = value as { path?: unknown; firestore?: unknown; parent?: unknown };
  return (
    typeof candidate.path === 'string' &&
    candidate.firestore !== undefined &&
    candidate.parent !== undefined
  );
}

/**
 * Duck-typed normalizer for Firestore-native values that do not survive
 * Object.entries() recursion meaningfully (Timestamp/GeoPoint/DocumentReference
 * instances). Exported so contracts/checks/firestore-residue-guard/
 * check_special_value_normalization.mjs can unit-test it directly — JSON fixtures
 * structurally cannot represent these types. Recurses through plain arrays/objects so
 * a special value nested inside an ordinary map is still normalized before walk().
 */
export function toPlainValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (hasToDate(value)) {
    return value.toDate().toISOString();
  }
  if (isDocumentReferenceShaped(value)) {
    return value.path;
  }
  if (isGeoPointShaped(value)) {
    return `${value.latitude},${value.longitude}`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toPlainValue(item));
  }
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    result[key] = toPlainValue(nested);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

/**
 * Normalises CRLF and lone-CR line endings to LF before any line-based parsing.
 * Without this, a CRLF `.env.local` (common when a file is edited or copied from a
 * Windows tool) leaves a trailing `\r` on every line, so `nextLine.endsWith(quoteChar)`
 * in the multi-line continuation loop below never matches the true closing line — the
 * loop then swallows every remaining line into the value AND the variables after it
 * silently disappear from the parsed result. This is a credential-corrupting parser
 * bug class; normalise once, up front, so no downstream comparison can be defeated by
 * a stray `\r`.
 */
function normalizeLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Parses .env.local by hand (no `dotenv` package — its startup banner has corrupted
 * an env value on this project before). A quoted value (e.g. FIREBASE_ADMIN_PRIVATE_KEY,
 * a PEM block) may legitimately span multiple physical lines with real embedded
 * newlines before its closing quote — a naive single-line-per-entry split truncates
 * the key at its first line and corrupts the credential. Continuation lines are
 * collected verbatim (not trimmed) until a line ending in the matching quote char.
 * Handles unquoted values, values containing `=` or `#`, trailing whitespace, and a
 * final line with no trailing newline. An unterminated quoted value (no closing quote
 * before EOF) throws rather than silently swallowing the rest of the file.
 */
export function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return {};
  }
  const raw = readFileSync(envPath, 'utf8');
  const lines = normalizeLineEndings(raw).split('\n');
  const out: Record<string, string> = {};

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i += 1;
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      i += 1;
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const valuePart = trimmed.slice(eq + 1).trim();
    const quoteChar = valuePart.startsWith('"') || valuePart.startsWith("'") ? valuePart[0] : undefined;
    i += 1;

    if (!quoteChar) {
      out[key] = valuePart;
      continue;
    }

    const body = valuePart.slice(1);
    if (body.endsWith(quoteChar)) {
      out[key] = body.slice(0, -1);
      continue;
    }

    const segments = [body];
    let closed = false;
    while (i < lines.length) {
      const nextLine = lines[i];
      i += 1;
      if (nextLine.endsWith(quoteChar)) {
        segments.push(nextLine.slice(0, -1));
        closed = true;
        break;
      }
      segments.push(nextLine);
    }
    if (!closed) {
      throw new Error(
        `.env.local: unterminated quoted value for ${key} — no closing ${quoteChar} found before EOF.`,
      );
    }
    out[key] = segments.join('\n');
  }
  return out;
}

/** Prefer a value already present in process.env (e.g. CI secrets) over .env.local. */
function resolveEnvVar(name: string, envLocal: Record<string, string>): string | undefined {
  return process.env[name] ?? envLocal[name];
}

// ---------------------------------------------------------------------------
// Document sources
// ---------------------------------------------------------------------------

interface ScannableDocument {
  readonly collection: string;
  readonly id: string;
  readonly data: Record<string, unknown>;
}

function loadFixtureDocuments(fixturePath: string): ScannableDocument[] {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const raw = readFileSync(resolved, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture at ${fixturePath} must be a JSON array of documents.`);
  }
  return parsed as ScannableDocument[];
}

async function fetchLiveDocuments(): Promise<ScannableDocument[]> {
  const envLocal = readEnvLocal();
  const projectId = resolveEnvVar('FIREBASE_ADMIN_PROJECT_ID', envLocal);
  const clientEmail = resolveEnvVar('FIREBASE_ADMIN_CLIENT_EMAIL', envLocal);
  const privateKeyRaw = resolveEnvVar('FIREBASE_ADMIN_PRIVATE_KEY', envLocal);

  if (!projectId) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_PROJECT_ID — cannot run live-mode residue scan. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }
  if (!clientEmail) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_CLIENT_EMAIL — cannot run live-mode residue scan. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }
  if (!privateKeyRaw) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_PRIVATE_KEY — cannot run live-mode residue scan. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  const app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);

  const collections = await db.listCollections();
  const documents: ScannableDocument[] = [];
  for (const collectionRef of collections) {
    const snapshot = await collectionRef.get();
    for (const doc of snapshot.docs) {
      const normalized = toPlainValue(doc.data()) as Record<string, unknown>;
      documents.push({ collection: collectionRef.id, id: doc.id, data: normalized });
    }
  }
  return documents;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function formatHitLine(hit: Hit): string {
  return `${hit.collection}/${hit.docId} . ${hit.fieldPath} = ${hit.value}`;
}

function report(documents: ScannableDocument[]): number {
  const allHits = documents.flatMap((doc) => scanDocument(doc.collection, doc.id, doc.data));

  if (allHits.length === 0) {
    console.log(`ALL CLEAR — scanned ${documents.length} document(s), no residue found.`);
    return 0;
  }

  for (const hit of allHits) {
    console.log(formatHitLine(hit));
  }
  console.log(
    `FAIL: found ${allHits.length} residue hit(s) across ${documents.length} document(s).`,
  );
  return 1;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function parseFixtureArg(argv: string[]): string | undefined {
  const flagIndex = argv.indexOf(FIXTURE_FLAG);
  if (flagIndex === -1) {
    return undefined;
  }
  const value = argv[flagIndex + 1];
  if (!value) {
    throw new Error(`${FIXTURE_FLAG} requires a path argument.`);
  }
  return value;
}

async function main(): Promise<void> {
  const fixturePath = parseFixtureArg(process.argv.slice(2));

  const documents = fixturePath
    ? loadFixtureDocuments(fixturePath)
    : await fetchLiveDocuments();

  const exitCode = report(documents);
  process.exit(exitCode);
}

// Guard against running main() as a side effect of import — A13
// (check_special_value_normalization.mjs) imports this module directly for its
// exported toPlainValue() and must not trigger a live-mode scan / process.exit() by
// doing so. Only run when this file is the actual entry point.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('Residue scan failed:', err);
    process.exit(1);
  });
}
