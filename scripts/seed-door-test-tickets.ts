/**
 * door-test-qr-seeder (F6, mission admin-auth-hardening, milestone M3) — seeds four
 * real Firestore fixture tickets covering four of lib/checkin.ts's five door-admission
 * outcomes, and renders a self-contained, printable/scannable HTML QR sheet so Brad can
 * prove the check-in decision table end to end at a real device without PayFast.
 *
 * Golden: contracts/golden/door-test-qr-seeder/README.md,
 * contracts/golden/door-test-qr-seeder/fixtures.golden.json.
 *
 * Usage: pnpm exec tsx scripts/seed-door-test-tickets.ts seed | teardown
 * (or the package.json wrappers `pnpm door:seed` / `pnpm door:teardown`)
 *
 * PayFast is not involved — fixtures are written directly via the Admin SDK, exactly
 * like contracts/checks/ticketing-hardening/_shared.mjs's createTicketDoc() does.
 * app/api/tickets/itn/route.ts is never touched.
 *
 * seed is idempotent: each bookingRef is looked up first; an existing doc is
 * overwritten back to its exact fixture shape (this is what resets ADMIT from
 * 'checked-in' back to 'paid' for a repeat test at the door), a missing one is created.
 *
 * teardown deletes ONLY the three fixture bookingRefs, by exact match — never a
 * marker-domain sweep — because these fixtures are meant to outlive the seeding
 * process across however many scans Brad performs. See the golden README's "Why
 * teardown does NOT reuse sweepSentinels()" section.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import QRCode from 'qrcode';

import { readEnvLocal } from './scan-firestore-residue';

const TICKETS_COLLECTION = 'tickets';
const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'output/door-test-qr',
);

// ---------------------------------------------------------------------------
// Marker scheme — see contracts/golden/door-test-qr-seeder/fixtures.golden.json
// ---------------------------------------------------------------------------

const MARKER_EMAIL = 'fixture@door-qr-check.invalid';
const MARKER_NAME = 'Door QR Fixture';
const NATIONAL_SHOW_ID = 'nationalShow';
const WRONG_SHOW_ID = 'door-qr-check-wrong-show';
const TICKET_TYPE = 'exhibitor';

interface FixtureDoc {
  readonly bookingRef: string;
  readonly showId: string;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly ticketType: string;
  readonly status: string;
  readonly amount: number;
  readonly purchasedAtServerNow: boolean;
}

interface ScanExpectation {
  readonly ordinal: number;
  readonly expect: {
    readonly ok: boolean;
    readonly code?: string;
    readonly httpStatus?: number;
    readonly error?: string;
    readonly resultingStatus?: string;
  };
  readonly qrCardOutcome: string;
  readonly expectedScreenMessage: string;
}

interface Fixture {
  readonly label: string;
  readonly bookingRef: string;
  readonly seededInFirestore: boolean;
  readonly doc: FixtureDoc | null;
  readonly scans: readonly ScanExpectation[];
}

const FIXTURES: readonly Fixture[] = [
  {
    label: 'ADMIT',
    bookingRef: 'DOOR-QR-ADMIT-01',
    seededInFirestore: true,
    doc: {
      bookingRef: 'DOOR-QR-ADMIT-01',
      showId: NATIONAL_SHOW_ID,
      attendeeName: MARKER_NAME,
      attendeeEmail: MARKER_EMAIL,
      ticketType: TICKET_TYPE,
      status: 'paid',
      amount: 0,
      purchasedAtServerNow: true,
    },
    scans: [
      {
        ordinal: 1,
        expect: { ok: true, resultingStatus: 'checked-in' },
        qrCardOutcome: 'ADMIT',
        expectedScreenMessage: '✓ Checked in — Door QR Fixture — exhibitor — DOOR-QR-ADMIT-01',
      },
      {
        ordinal: 2,
        expect: { ok: false, code: 'already-checked-in', httpStatus: 409, error: 'Already checked in' },
        qrCardOutcome: 'already-checked-in (scan the SAME code again)',
        expectedScreenMessage: '✕ Not checked in — Already checked in',
      },
    ],
  },
  {
    label: 'UNPAID',
    bookingRef: 'DOOR-QR-UNPAID-01',
    seededInFirestore: true,
    doc: {
      bookingRef: 'DOOR-QR-UNPAID-01',
      showId: NATIONAL_SHOW_ID,
      attendeeName: MARKER_NAME,
      attendeeEmail: MARKER_EMAIL,
      ticketType: TICKET_TYPE,
      status: 'reserved',
      amount: 0,
      purchasedAtServerNow: false,
    },
    scans: [
      {
        ordinal: 1,
        expect: { ok: false, code: 'unpaid', httpStatus: 403, error: 'This ticket has not been paid for.' },
        qrCardOutcome: 'unpaid',
        expectedScreenMessage: '✕ Not checked in — This ticket has not been paid for.',
      },
    ],
  },
  {
    label: 'WRONGSHOW',
    bookingRef: 'DOOR-QR-WRONGSHOW-01',
    seededInFirestore: true,
    doc: {
      bookingRef: 'DOOR-QR-WRONGSHOW-01',
      showId: WRONG_SHOW_ID,
      attendeeName: MARKER_NAME,
      attendeeEmail: MARKER_EMAIL,
      ticketType: TICKET_TYPE,
      status: 'paid',
      amount: 0,
      purchasedAtServerNow: true,
    },
    scans: [
      {
        ordinal: 1,
        expect: { ok: false, code: 'wrong-show', httpStatus: 403, error: 'This ticket is not for this show.' },
        qrCardOutcome: 'wrong-show',
        expectedScreenMessage: '✕ Not checked in — This ticket is not for this show.',
      },
    ],
  },
  {
    label: 'MISSING',
    bookingRef: 'DOOR-QR-MISSING-01',
    seededInFirestore: false,
    doc: null,
    scans: [
      {
        ordinal: 1,
        expect: { ok: false, code: 'not-found', httpStatus: 404, error: 'Ticket not found' },
        qrCardOutcome: 'not-found',
        expectedScreenMessage: '✕ Not checked in — Ticket not found',
      },
    ],
  },
];

const SEEDED_BOOKING_REFS: readonly string[] = FIXTURES.filter((f) => f.seededInFirestore).map(
  (f) => f.bookingRef,
);

// ---------------------------------------------------------------------------
// Admin SDK
// ---------------------------------------------------------------------------

let adminAppInitialized = false;

function admin() {
  if (!adminAppInitialized && getApps().length === 0) {
    const envLocal = readEnvLocal();
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? envLocal['FIREBASE_ADMIN_PROJECT_ID'];
    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? envLocal['FIREBASE_ADMIN_CLIENT_EMAIL'];
    const privateKeyRaw =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? envLocal['FIREBASE_ADMIN_PRIVATE_KEY'];
    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error(
        'Firebase admin credentials missing from .env.local (FIREBASE_ADMIN_PROJECT_ID / ' +
          '_CLIENT_EMAIL / _PRIVATE_KEY). Cannot seed door test tickets.',
      );
    }
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  adminAppInitialized = true;
  return getApps()[0]!;
}

function db() {
  return getFirestore(admin());
}

/**
 * Refuses to write any fixture doc whose marker fields do not match exactly — mirrors
 * createTicketDoc()'s isSentinelEmail guard in
 * contracts/checks/ticketing-hardening/_shared.mjs, so a future edit cannot silently
 * drop the marker and write an unmarked-looking fixture into the live `tickets`
 * collection.
 */
function assertMarkerIntact(doc: FixtureDoc): void {
  if (doc.attendeeEmail !== MARKER_EMAIL) {
    throw new Error(
      `Refusing to write ${doc.bookingRef}: attendeeEmail "${doc.attendeeEmail}" does not match the ` +
        `required marker "${MARKER_EMAIL}".`,
    );
  }
  if (doc.attendeeName !== MARKER_NAME) {
    throw new Error(
      `Refusing to write ${doc.bookingRef}: attendeeName "${doc.attendeeName}" does not match the ` +
        `required marker "${MARKER_NAME}".`,
    );
  }
  if (!doc.bookingRef.startsWith('DOOR-QR-')) {
    throw new Error(
      `Refusing to write ${doc.bookingRef}: bookingRef does not carry the required "DOOR-QR-" prefix.`,
    );
  }
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seedFixtureDoc(fixture: Fixture): Promise<void> {
  if (!fixture.doc) return;
  assertMarkerIntact(fixture.doc);

  const database = db();
  const existing = await database
    .collection(TICKETS_COLLECTION)
    .where('bookingRef', '==', fixture.bookingRef)
    .limit(1)
    .get();

  const fields = {
    bookingRef: fixture.doc.bookingRef,
    showId: fixture.doc.showId,
    attendeeName: fixture.doc.attendeeName,
    attendeeEmail: fixture.doc.attendeeEmail,
    ticketType: fixture.doc.ticketType,
    status: fixture.doc.status,
    amount: fixture.doc.amount,
    purchasedAt: fixture.doc.purchasedAtServerNow ? Timestamp.now() : null,
    checkedInAt: null,
    m_payment_id: fixture.doc.bookingRef,
    pf_payment_id: null,
  };

  if (existing.empty) {
    await database.collection(TICKETS_COLLECTION).add(fields);
  } else {
    // Overwrite back to the exact fixture shape — this is what resets ADMIT from
    // 'checked-in' back to 'paid' for a repeat test at the door.
    await existing.docs[0]!.ref.set(fields);
  }
}

// ---------------------------------------------------------------------------
// teardown
// ---------------------------------------------------------------------------

async function teardown(): Promise<void> {
  const database = db();
  for (const bookingRef of SEEDED_BOOKING_REFS) {
    const snapshot = await database
      .collection(TICKETS_COLLECTION)
      .where('bookingRef', '==', bookingRef)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      await snapshot.docs[0]!.ref.delete();
    }
  }
  console.log(`Tore down ${SEEDED_BOOKING_REFS.length} door test ticket(s): ${SEEDED_BOOKING_REFS.join(', ')}`);
}

// ---------------------------------------------------------------------------
// QR sheet + manifest output
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderScanBlock(scan: ScanExpectation): string {
  const outcomeLabel = scan.expect.ok ? 'ADMIT' : (scan.expect.code ?? 'unknown');
  const httpStatus = scan.expect.ok ? 200 : (scan.expect.httpStatus ?? '');
  const messageLine = scan.expect.ok
    ? `${MARKER_NAME} / ${TICKET_TYPE} / ${scan.expect.resultingStatus ?? ''}`
    : (scan.expect.error ?? '');
  return `
      <div class="scan">
        <p class="scan-ordinal">Scan ${scan.ordinal}${scan.ordinal > 1 ? ' (scan again for this outcome)' : ''}</p>
        <p class="scan-outcome">Outcome: <code>${escapeHtml(String(outcomeLabel))}</code> (HTTP ${escapeHtml(String(httpStatus))})</p>
        <p class="scan-message">${escapeHtml(messageLine)}</p>
      </div>`;
}

async function renderFixtureCard(fixture: Fixture): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(fixture.bookingRef, { margin: 1, width: 220 });
  const scanBlocks = fixture.scans.map(renderScanBlock).join('\n');
  return `
    <section class="card">
      <h2>${escapeHtml(fixture.label)}</h2>
      <p class="booking-ref">${escapeHtml(fixture.bookingRef)}</p>
      <img src="${qrDataUrl}" alt="QR code for ${escapeHtml(fixture.bookingRef)}" width="220" height="220" />
      ${scanBlocks}
    </section>`;
}

async function buildSheetHtml(): Promise<string> {
  const cards = await Promise.all(FIXTURES.map(renderFixtureCard));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Door test-ticket QR sheet</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
  h1 { font-size: 1.25rem; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
  .card { border: 1px solid #999; border-radius: 8px; padding: 1rem; page-break-inside: avoid; }
  .card h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
  .booking-ref { font-family: monospace; font-size: 1rem; margin: 0 0 0.5rem; }
  .scan { margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px dashed #ccc; }
  .scan-ordinal { font-weight: bold; margin: 0 0 0.25rem; }
  .scan-outcome, .scan-message { margin: 0.15rem 0; }
  @media print { body { margin: 0.5in; } }
</style>
</head>
<body>
  <h1>Door test-ticket QR sheet (F6) &mdash; generated by scripts/seed-door-test-tickets.ts</h1>
  <p>Scan each code with the /admin/door camera. No network round trip is required to view or print this page.</p>
  <div class="grid">
${cards.join('\n')}
  </div>
</body>
</html>
`;
}

function buildManifest(): unknown {
  return FIXTURES.map((fixture) => ({
    label: fixture.label,
    bookingRef: fixture.bookingRef,
    scans: fixture.scans.map((scan) => ({ ordinal: scan.ordinal, expect: scan.expect })),
  }));
}

function writeOutputSheetSync(html: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, 'sheet.html'), html, 'utf8');
  writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(buildManifest(), null, 2), 'utf8');
}

async function generateOutput(): Promise<void> {
  const html = await buildSheetHtml();
  writeOutputSheetSync(html);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'seed') {
    for (const fixture of FIXTURES) {
      await seedFixtureDoc(fixture);
    }
    await generateOutput();
    console.log(`Seeded ${SEEDED_BOOKING_REFS.length} door test ticket(s): ${SEEDED_BOOKING_REFS.join(', ')}`);
    console.log(`QR sheet written to ${path.join(OUTPUT_DIR, 'sheet.html')}`);
    return;
  }
  if (command === 'teardown') {
    await teardown();
    return;
  }
  console.error('Usage: tsx scripts/seed-door-test-tickets.ts seed|teardown');
  process.exit(1);
}

// Guard against running main() as a side effect of import — check scripts under
// contracts/checks/door-test-qr-seeder/ import FIXTURES/seedFixtureDoc/teardown/
// generateOutput directly and must not trigger a CLI run by doing so. Only run when
// this file is the actual entry point (same pattern as scripts/scan-firestore-residue.ts).
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('door-test-qr-seeder failed:', err);
    process.exit(1);
  });
}

export { FIXTURES, SEEDED_BOOKING_REFS, seedFixtureDoc, teardown, generateOutput };
