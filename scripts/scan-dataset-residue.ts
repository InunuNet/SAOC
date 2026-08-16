/**
 * dataset-residue-guard — read-only recursive scanner for test-marker residue in
 * the live Sanity dataset.
 *
 * Closes the standing risk behind the 2026-08-15 incident: a contract check wrote
 * sentinel values (`F3-TITLE-SENTINEL-...`, a 2098 countdown) into the LIVE Sanity
 * dataset to prove a CMS round trip, and its cleanup half-failed — the residue sat
 * on `/national-show` for ~3 days. Hardening that check's cleanup path further is
 * not the fix; this scanner is an always-on detector independent of any single
 * check's cleanup logic. Full design: contracts/golden/dataset-residue-guard/README.md.
 * Marker catalogue (9 patterns, each traced to file:line): see
 * contracts/golden/dataset-residue-guard/marker-catalogue.md.
 *
 * Two modes:
 *   - live (default): fetches every document from the real Sanity dataset via
 *     `client.fetch('*[]')`, using NEXT_PUBLIC_SANITY_PROJECT_ID /
 *     NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN, read the same way
 *     scripts/seed-page-singletons.ts reads them: directly from .env.local, no
 *     `dotenv` package (its startup banner has corrupted an env value on this
 *     project before).
 *   - fixture (`--fixture <path>`): reads a local JSON array of plain document
 *     objects from <path>. No credentials are read, constructed, or required in
 *     this mode, and no Sanity client is ever constructed. This is what the
 *     contract's A1/A2 assertions exercise.
 *
 * This client is fetch-only. It must never call a Sanity mutation method — never
 * patch, never create-or-replace, never create-if-not-exists, never delete, never
 * mutate, never transact, never create a document.
 *
 * Run with: node --import tsx/esm scripts/scan-dataset-residue.ts [--fixture <path>]
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

const FIXTURE_FLAG = '--fixture';
const SANITY_API_VERSION = '2024-01-01';

// ---------------------------------------------------------------------------
// Marker catalogue — see contracts/golden/dataset-residue-guard/marker-catalogue.md
// for the file:line trace behind each pattern. Do not invent new patterns; do not
// drop any of these nine.
// ---------------------------------------------------------------------------

interface MarkerPattern {
  readonly name: string;
  readonly regex: RegExp;
}

const MARKER_PATTERNS: readonly MarkerPattern[] = [
  { name: 'SVI-SENTINEL', regex: /SVI-[A-Z0-9-]*SENTINEL-\d+/i },
  { name: 'EXH-SENTINEL', regex: /EXH-[A-Z0-9-]*SENTINEL-\d+/i },
  { name: 'NOT-A-REAL-STATUS', regex: /not-a-real-status-\d+/i },
  { name: 'F3-SENTINEL', regex: /F3-[A-Z]+-SENTINEL-\d+/i },
  { name: 'FAR-FUTURE-YEAR', regex: /20(9[0-9])-\d{2}-\d{2}/ },
  { name: 'ZZCHECK-SENTINEL', regex: /ZZCHECK-[A-Z0-9]+-[A-Z0-9]+/i },
  { name: 'F6-LOOP-PROOF', regex: /F6-LOOP-PROOF-\d+-[a-f0-9]+/i },
  { name: 'SENTINEL (catch-all)', regex: /SENTINEL/i },
  { name: 'EPOCH-MS-NONCE (catch-all, heuristic)', regex: /(?<!\d)\d{13}(?!\d)/ },
];

// ---------------------------------------------------------------------------
// Recursive walk
// ---------------------------------------------------------------------------

interface Hit {
  readonly docId: string;
  readonly docType: string;
  readonly fieldPath: string;
  readonly value: string;
}

// No field is exempt from any marker pattern, including the loose SENTINEL catch-all
// — see the comment on `scanDocument` below. A planted sentinel value found in
// `_id`/`_type`/`_rev` is real production residue (e.g. a document created directly
// from a fixture/test payload) and must be reported like any other field.
function matchesAnyPattern(value: string): boolean {
  return MARKER_PATTERNS.some((pattern) => pattern.regex.test(value));
}

/**
 * Portable Text stores rich text as a `block` whose `children[]` are individually
 * marked spans (bold, links, etc split editor content into adjacent spans). A
 * sentinel marker can straddle a mark boundary and land split across two or more
 * spans, where no single span matches any catalogued pattern on its own — only the
 * concatenated block text does. This is normal CMS editing fallout, not an exotic
 * case, so it must be detected unconditionally, not as a fixture-only special case.
 */
function isPortableTextBlock(
  value: unknown,
): value is Record<string, unknown> & { children: unknown[] } {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record._type === 'block' && Array.isArray(record.children);
}

function collectSpanTexts(children: unknown[]): string[] {
  return children
    .filter((child): child is Record<string, unknown> => child !== null && typeof child === 'object')
    .map((child) => child.text)
    .filter((text): text is string => typeof text === 'string');
}

/**
 * Test a Portable Text block's span texts concatenated together, IN ADDITION TO the
 * per-span testing `walk()` already does for each span's `text` leaf. Only reports a
 * hit when the matched marker is not fully contained within any single span — a
 * marker a single span already matched is left to the per-span report so the block
 * hit line never falsely implies the whole marker sat in one span, and no marker is
 * double-reported.
 */
function collectJoinedBlockHits(
  block: Record<string, unknown> & { children: unknown[] },
  path_: string,
  docId: string,
  docType: string,
  hits: Hit[],
): void {
  const spanTexts = collectSpanTexts(block.children);
  if (spanTexts.length === 0) {
    return;
  }
  const joinedText = spanTexts.join('');
  const reportedMarkers = new Set<string>();
  for (const pattern of MARKER_PATTERNS) {
    // Clone with the /g flag so exec() advances via lastIndex instead of always
    // returning the leftmost match — the shared pattern object's own lastIndex is
    // never touched, so no state leaks between documents or patterns.
    const globalRegex = new RegExp(pattern.regex.source, `${pattern.regex.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = globalRegex.exec(joinedText)) !== null) {
      const matchedText = match[0];
      if (reportedMarkers.has(matchedText)) {
        continue;
      }
      const alreadyCaughtBySingleSpan = spanTexts.some((text) => text.includes(matchedText));
      if (alreadyCaughtBySingleSpan) {
        continue;
      }
      reportedMarkers.add(matchedText);
      hits.push({ docId, docType, fieldPath: path_, value: joinedText });
      // Avoid an infinite loop on a zero-width match.
      if (match[0].length === 0) {
        globalRegex.lastIndex += 1;
      }
    }
  }
}

/** Recursively walk a document value, collecting every leaf that matches a marker. */
function walk(value: unknown, path_: string, docId: string, docType: string, hits: Hit[]): void {
  if (typeof value === 'string') {
    if (matchesAnyPattern(value)) {
      hits.push({ docId, docType, fieldPath: path_, value });
    }
    return;
  }
  if (typeof value === 'number') {
    const asString = String(value);
    if (matchesAnyPattern(asString)) {
      hits.push({ docId, docType, fieldPath: path_, value: asString });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path_}[${index}]`, docId, docType, hits));
    return;
  }
  if (value !== null && typeof value === 'object') {
    if (isPortableTextBlock(value)) {
      collectJoinedBlockHits(value, path_, docId, docType, hits);
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path_ === '' ? key : `${path_}.${key}`;
      walk(nested, nextPath, docId, docType, hits);
    }
  }
}

/** Scan one document (no field is exempt — including _id/_type/_rev). */
function scanDocument(doc: Record<string, unknown>): Hit[] {
  const docId = typeof doc._id === 'string' ? doc._id : '<unknown-id>';
  const docType = typeof doc._type === 'string' ? doc._type : '<unknown-type>';
  const hits: Hit[] = [];
  walk(doc, '', docId, docType, hits);
  return hits;
}

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    return {};
  }
  const raw = readFileSync(envPath, 'utf8');
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

/** Prefer a value already present in process.env (e.g. CI secrets) over .env.local. */
function resolveEnvVar(name: string, envLocal: Record<string, string>): string | undefined {
  return process.env[name] ?? envLocal[name];
}

// ---------------------------------------------------------------------------
// Document sources
// ---------------------------------------------------------------------------

function loadFixtureDocuments(fixturePath: string): Record<string, unknown>[] {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const raw = readFileSync(resolved, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Fixture at ${fixturePath} must be a JSON array of documents.`);
  }
  return parsed as Record<string, unknown>[];
}

async function fetchLiveDocuments(): Promise<Record<string, unknown>[]> {
  const envLocal = readEnvLocal();
  const projectId = resolveEnvVar('NEXT_PUBLIC_SANITY_PROJECT_ID', envLocal);
  const dataset = resolveEnvVar('NEXT_PUBLIC_SANITY_DATASET', envLocal);
  const token = resolveEnvVar('SANITY_API_TOKEN', envLocal);

  if (!projectId) {
    console.error(
      'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID — cannot run live-mode residue scan. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }
  if (!dataset || !token) {
    console.error(
      'FAIL: missing NEXT_PUBLIC_SANITY_DATASET or SANITY_API_TOKEN — cannot run live-mode ' +
        'residue scan. Set them in .env.local or the environment, or run with --fixture <path>.',
    );
    process.exit(1);
  }

  const client: SanityClient = createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    token,
    useCdn: false,
  });

  const documents: unknown = await client.fetch('*[]');
  if (!Array.isArray(documents)) {
    throw new Error('Unexpected response shape from Sanity: expected an array of documents.');
  }
  return documents as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function formatHitLine(hit: Hit): string {
  return `${hit.docId} (${hit.docType}) . ${hit.fieldPath} = ${hit.value}`;
}

function report(documents: Record<string, unknown>[]): number {
  const allHits = documents.flatMap((doc) => scanDocument(doc));

  if (allHits.length === 0) {
    console.log(`ALL CLEAR — scanned ${documents.length} document(s), no residue found.`);
    return 0;
  }

  for (const hit of allHits) {
    console.log(formatHitLine(hit));
  }
  console.log(`FAIL: found ${allHits.length} residue hit(s) across ${documents.length} document(s).`);
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

main().catch((err: unknown) => {
  console.error('Residue scan failed:', err);
  process.exit(1);
});
