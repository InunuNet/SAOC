/**
 * checkin-audit-write-verifier — read-only live cross-reference between checked-in
 * tickets and the `checkinAttempts` audit trail.
 *
 * Mission checkin-attempts-write-verification F1
 * (contracts/golden/checkin-attempts-write-verification-f1/README.md). Closes the gap
 * F7 (ticketing-foundation) left open: F7's own assertions run offline against a
 * fabricated store, so none of them prove a `checkinAttempts` document actually lands
 * in live Firestore on a real door scan. This script answers that empirically without
 * queuing a human scan or writing anything.
 *
 * Method: lib/checkin.ts sets `status: 'checked-in'` + `checkedInAt` on a `tickets`
 * document in the same transaction as the admission decision, independent of whether
 * the audit write succeeds. Every such document is cross-referenced against
 * `checkinAttempts` for a matching `outcome === 'admit'` record, joined primarily on
 * `bookingRef` — the unique, ~60-bit-entropy identifier of a single ticket position
 * (lib/orders.ts:97; also the tickets document ID itself, app/api/tickets/checkout/
 * route.ts:986) and the exact key check-in itself scans against
 * (checkInByBookingRef(), app/api/admin/checkin/route.ts:87) — falling back to
 * `orderId` only for a legacy/malformed document with no `bookingRef` at all.
 * `orderId` is NOT safe as the primary key: it is shared across every sibling
 * position in the same multi-line-item order (lib/checkout-reservation.ts:284,297),
 * so joining on it first would report a ticket as "verified" merely because some
 * OTHER position in the same order had a genuine admit record — masking exactly the
 * class of failure this script exists to detect.
 *
 * Two modes, mirroring scripts/scan-firestore-residue.ts:
 *   - live (default): Firebase Admin SDK, credentials read directly from .env.local
 *     (no `dotenv` package — see that script's header comment on a prior
 *     credential-corruption incident; project_secret_corruption_class memory).
 *   - fixture (`--fixture <path>`): reads a local JSON file shaped
 *     `{ tickets: [...], checkinAttempts: [...] }`. No Firebase Admin app is
 *     initialized in this mode, no credential is read, no network call is made.
 *     See scripts/fixtures/verify-checkin-audit-write/ for examples.
 *
 * This script is READ-ONLY BY CONSTRUCTION. It must never call a Firestore mutation
 * method — never set, never update, never delete, never add, never commit, never
 * batch, never run a transaction. Only get/where reads.
 *
 * Run with: pnpm exec tsx scripts/verify-checkin-audit-write.ts [--fixture <path>]
 * (Do not run with `node --import tsx/esm` — see scan-firestore-residue.ts's header
 * comment on why that form breaks on GitHub's Node 22.)
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FIXTURE_FLAG = '--fixture';
const TICKETS_COLLECTION = 'tickets';
const CHECKIN_ATTEMPTS_COLLECTION = 'checkinAttempts';

interface CheckedInTicket {
  readonly id: string;
  readonly bookingRef: string | null;
  readonly orderId: string | null;
  readonly checkedInAt: string | null;
}

interface AdmitAttempt {
  readonly id: string;
  readonly bookingRef: string | null;
  readonly orderId: string | null;
  readonly outcome: string;
}

interface FixtureShape {
  readonly tickets: CheckedInTicket[];
  readonly checkinAttempts: AdmitAttempt[];
}

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

/**
 * Normalises CRLF and lone-CR line endings to LF before any line-based parsing, same
 * as scripts/scan-firestore-residue.ts's own readEnvLocal() — a CRLF `.env.local`
 * otherwise leaves a stray `\r` that silently defeats the multi-line quote-close check
 * below.
 */
function normalizeLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Hand-rolled `.env.local` parser mirroring scan-firestore-residue.ts's readEnvLocal(). */
function readEnvLocal(): Record<string, string> {
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

function resolveEnvVar(name: string, envLocal: Record<string, string>): string | undefined {
  return process.env[name] ?? envLocal[name];
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function loadFixture(fixturePath: string): FixtureShape {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const raw = readFileSync(resolved, 'utf8');
  const parsed = JSON.parse(raw) as Partial<FixtureShape>;
  if (!Array.isArray(parsed.tickets) || !Array.isArray(parsed.checkinAttempts)) {
    throw new Error(
      `Fixture at ${fixturePath} must be a JSON object shaped { tickets: [...], checkinAttempts: [...] }.`,
    );
  }
  return { tickets: parsed.tickets, checkinAttempts: parsed.checkinAttempts };
}

async function loadLive(): Promise<FixtureShape> {
  const envLocal = readEnvLocal();
  const projectId = resolveEnvVar('FIREBASE_ADMIN_PROJECT_ID', envLocal);
  const clientEmail = resolveEnvVar('FIREBASE_ADMIN_CLIENT_EMAIL', envLocal);
  const privateKeyRaw = resolveEnvVar('FIREBASE_ADMIN_PRIVATE_KEY', envLocal);

  if (!projectId) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_PROJECT_ID — cannot run live-mode verification. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }
  if (!clientEmail) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_CLIENT_EMAIL — cannot run live-mode verification. ' +
        'Set it in .env.local or the environment, or run with --fixture <path> instead.',
    );
    process.exit(1);
  }
  if (!privateKeyRaw) {
    console.error(
      'FAIL: missing FIREBASE_ADMIN_PRIVATE_KEY — cannot run live-mode verification. ' +
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

  const ticketsSnapshot = await db
    .collection(TICKETS_COLLECTION)
    .where('status', '==', 'checked-in')
    .get();
  const tickets: CheckedInTicket[] = ticketsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const checkedInAt = data['checkedInAt'] as FirebaseFirestore.Timestamp | undefined;
    return {
      id: doc.id,
      bookingRef: (data['bookingRef'] as string) ?? null,
      orderId: (data['orderId'] as string) ?? null,
      checkedInAt: checkedInAt ? checkedInAt.toDate().toISOString() : null,
    };
  });

  const attemptsSnapshot = await db
    .collection(CHECKIN_ATTEMPTS_COLLECTION)
    .where('outcome', '==', 'admit')
    .get();
  const checkinAttempts: AdmitAttempt[] = attemptsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      bookingRef: (data['bookingRef'] as string) ?? null,
      orderId: (data['orderId'] as string) ?? null,
      outcome: data['outcome'] as string,
    };
  });

  return { tickets, checkinAttempts };
}

// ---------------------------------------------------------------------------
// Cross-reference + reporting
// ---------------------------------------------------------------------------

/**
 * Joins on `bookingRef` first — the unique identifier of the exact ticket position
 * check-in itself keys on (checkInByBookingRef(), app/api/admin/checkin/route.ts:87) —
 * falling back to `orderId` only when a ticket document has no `bookingRef` at all.
 * `bookingRef` is a required, non-nullable field on every real ticket document
 * (types/index.ts, `bookingRef: string`) and doubles as its Firestore document ID
 * (app/api/tickets/checkout/route.ts:986), so this fallback is not known to be
 * reachable against real data — it exists only as a defensive guard for a
 * malformed/legacy document.
 *
 * `orderId` is never used as the primary key: it is shared across every sibling
 * position in the same multi-line-item order (lib/checkout-reservation.ts:284,297),
 * so an orderId-first join would report a ticket as "verified" merely because some
 * OTHER position in the same order had a genuine admit record — masking exactly the
 * class of failure this script exists to detect.
 *
 * Filters on `attempt.outcome === 'admit'` itself rather than relying on the caller
 * to have pre-filtered (live mode's Firestore query does, via `.where('outcome', '==',
 * 'admit')`, but fixture mode reads raw JSON with no such pre-filter) — otherwise a
 * fixture's non-admit record (e.g. 'unpaid', 'already-checked-in') sharing an
 * orderId/bookingRef with a checked-in ticket would be wrongly counted as proof the
 * admit write succeeded.
 */
function hasMatchingAudit(ticket: CheckedInTicket, attempts: readonly AdmitAttempt[]): boolean {
  const admitAttempts = attempts.filter((attempt) => attempt.outcome === 'admit');
  if (ticket.bookingRef) {
    return admitAttempts.some((attempt) => attempt.bookingRef === ticket.bookingRef);
  }
  if (ticket.orderId) {
    return admitAttempts.some((attempt) => attempt.orderId === ticket.orderId);
  }
  return false;
}

function report(data: FixtureShape): number {
  const { tickets, checkinAttempts } = data;

  if (tickets.length === 0) {
    console.log('ALL CLEAR — 0 checked-in tickets found; nothing to cross-reference.');
    return 0;
  }

  const orphans = tickets.filter((ticket) => !hasMatchingAudit(ticket, checkinAttempts));

  console.log(
    `Checked-in tickets scanned: ${tickets.length}. Matched to an 'admit' audit record: ${
      tickets.length - orphans.length
    }.`,
  );

  if (orphans.length === 0) {
    console.log(
      `ALL CLEAR — every checked-in ticket has a matching checkinAttempts 'admit' record.`,
    );
    return 0;
  }

  console.log(`FAIL: found ${orphans.length} checked-in ticket(s) with NO matching audit record:`);
  for (const orphan of orphans) {
    console.log(
      `  ticket=${orphan.id} bookingRef=${orphan.bookingRef ?? '(none)'} orderId=${
        orphan.orderId ?? '(none)'
      } checkedInAt=${orphan.checkedInAt ?? '(none)'}`,
    );
  }
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

  const data = fixturePath ? loadFixture(fixturePath) : await loadLive();

  const exitCode = report(data);
  process.exit(exitCode);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('Checkin-audit write verification failed:', err);
    process.exit(1);
  });
}
