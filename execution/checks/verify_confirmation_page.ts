/**
 * Contract assertion for confirmation-page-qr-and-download/contract-f1.yaml (A6).
 *
 * The load-bearing behavioral proof for this feature: a Playwright-driven run against a real
 * built-and-served instance of the app, using a real paid booking ref, a bogus/nonexistent ref,
 * and (best-effort) a real ref that is genuinely still 'reserved', proving in one script:
 *   1. the paid page's rendered QR <img>, decoded with jsqr+pngjs, yields EXACTLY the paid
 *      ref's bookingRef string;
 *   2. the paid page's rendered text contains that ref's real attendeeName and ticketType,
 *      looked up independently via _fetch_ticket_fields.py (NOT hardcoded — see the golden's
 *      "Independent fixture lookup");
 *   3. clicking the page's download control produces a downloaded PNG whose OWN embedded QR,
 *      independently decoded, ALSO equals the exact bookingRef;
 *   4. the bogus-ref page renders no QR image and no buyer-detail text (fail-closed on an
 *      ABSENT document);
 *   5. the reserved-ref page ALSO renders no QR image and no buyer-detail text (fail-closed on
 *      a document that genuinely EXISTS, with real attendeeName/ticketType/amount on it, but is
 *      not yet 'paid'/'checked-in') — this is the case #4 does not cover: a status-gate
 *      regression (e.g. someone loosens getConfirmedTicketForDisplay to key off field presence
 *      instead of status) would still pass case #4 (no document at all) while leaking a paid
 *      page and buyer PII for an unpaid reservation. See --reserved-ref below for how this
 *      fixture is resolved and what happens when none is available.
 *
 * Every sub-case failure exits non-zero and names exactly which case failed, matching
 * verify_reply_to.ts's per-case failure-reporting convention. A setup failure (server never
 * came up, Firestore lookup failed) exits non-zero with a DISTINCT "SETUP FAILURE" message so
 * it is never confused with a real behavioral failure. The reserved-ref sub-case is the one
 * exception to "every failure is fatal": if no genuinely-reserved document can be found (see
 * below), it SKIPs with an explicit, loud message rather than either failing the whole run over
 * missing test data or — worse — silently reporting an overall PASS that never actually
 * exercised the status gate.
 *
 * --reserved-ref <REF> (optional): a real booking ref expected to still be in 'reserved' status.
 * Its status is re-verified against live Firestore before use (a fixture can flip to 'paid'
 * between when it was picked and when this runs), because hardcoding a ref that might no longer
 * be reserved would make this sub-case pass for the wrong reason. If omitted, or if the
 * supplied ref is no longer 'reserved', this falls back to discovering ANY document currently
 * in 'reserved' status via a live query. If that also finds nothing, the reserved-ref sub-case
 * is SKIPPED (loudly) rather than passed by default.
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_confirmation_page.ts \
 *        --paid-ref <REF> --bad-ref <REF> [--reserved-ref <REF>]
 */

import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { chromium, type Browser } from 'playwright';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_START_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 500;

interface Args {
  paidRef: string;
  badRef: string;
  reservedRef: string | undefined;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const paidRef = get('--paid-ref');
  const badRef = get('--bad-ref');
  const reservedRef = get('--reserved-ref');
  if (!paidRef || !badRef) {
    console.error('SETUP FAILURE: --paid-ref and --bad-ref are both required');
    process.exit(2);
  }
  return { paidRef, badRef, reservedRef };
}

function setupFailure(message: string): never {
  console.error(`SETUP FAILURE: ${message}`);
  process.exit(2);
}

function failCase(caseName: string, message: string): never {
  console.error(`FAIL [${caseName}]: ${message}`);
  process.exit(1);
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('could not determine a free port'));
      }
    });
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl);
      if (res.status < 500) return;
    } catch {
      // Not up yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
  }
  throw new Error(`server did not become ready within ${SERVER_START_TIMEOUT_MS}ms at ${baseUrl}`);
}

interface FetchedTicketFields {
  attendeeName: string;
  ticketType: string;
  bookingRef: string | null;
  amount: number | null;
  status: string | null;
}

/** Independently looks up a ticket's real fields via the shared Python Firestore REST helper —
 *  never hardcoded, so this check stays correct if the fixture ticket is ever edited. Returns
 *  null (not a thrown error) when the helper reports "not found" (its exit code 1) — that is a
 *  real, expected outcome for --status discovery when nothing currently matches, and callers
 *  need to distinguish it from a genuine setup failure (exit code 2 / any other crash). */
async function fetchTicketFieldsBy(
  mode: { bookingRef: string } | { status: string }
): Promise<FetchedTicketFields | null> {
  const flagArgs = 'bookingRef' in mode ? ['--booking-ref', mode.bookingRef] : ['--status', mode.status];
  try {
    const { stdout } = await execFileAsync('python3', [
      path.join(REPO_ROOT, 'execution', 'checks', '_fetch_ticket_fields.py'),
      ...flagArgs,
    ]);
    return JSON.parse(stdout.trim());
  } catch (error) {
    const execError = error as { code?: number; stderr?: string };
    if (execError.code === 1) {
      return null; // genuine "not found" — not a setup failure.
    }
    const describedMode = 'bookingRef' in mode ? mode.bookingRef : `status=${mode.status}`;
    throw new Error(`independent Firestore fixture lookup for ${describedMode} failed: ${error}`);
  }
}

/** Resolves a fixture the reserved-ref sub-case can safely test against, or a skip reason.
 *
 * Order: (1) if --reserved-ref was given, re-verify it live and use it if it's still 'reserved'
 * (a fixture picked earlier can flip to 'paid' by the time this runs); (2) otherwise, or if that
 * ref is no longer reserved, discover ANY document currently 'reserved' via a live query;
 * (3) if neither yields a usable fixture, return a skip reason — never silently proceed as if
 * the sub-case passed.
 */
async function resolveReservedFixture(
  explicitRef: string | undefined
): Promise<{ ref: string; fields: FetchedTicketFields } | { skip: string }> {
  if (explicitRef) {
    const fields = await fetchTicketFieldsBy({ bookingRef: explicitRef });
    if (fields && fields.status === 'reserved') {
      return { ref: explicitRef, fields };
    }
    console.warn(
      fields
        ? `--reserved-ref ${explicitRef} is no longer 'reserved' (status=${JSON.stringify(fields.status)}) — ` +
          'falling back to discovering another reserved document.'
        : `--reserved-ref ${explicitRef} no longer exists — falling back to discovering another reserved document.`
    );
  }

  // _fetch_ticket_fields.py resolves bookingRef from the document's own field, falling back to
  // the Firestore document id (via _firestore_rest.py's query_by_field "_id") when the field
  // itself is unset on an older fixture — so `discovered.bookingRef` is always navigable when
  // `discovered` is non-null.
  const discovered = await fetchTicketFieldsBy({ status: 'reserved' });
  if (discovered && discovered.bookingRef) {
    return { ref: discovered.bookingRef, fields: discovered };
  }

  return { skip: 'no document currently in status=reserved was found (explicit ref, if given, was also unusable)' };
}

/** Decodes a data:image/png;base64,... URI or a raw PNG file buffer with jsqr, returning the
 *  decoded text or null if no QR was found. */
function decodeQrFromPngBuffer(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}

function decodeQrFromDataUri(dataUri: string): string | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUri.trim());
  if (!match) return null;
  return decodeQrFromPngBuffer(Buffer.from(match[1], 'base64'));
}

async function main(): Promise<void> {
  const { paidRef, badRef, reservedRef: explicitReservedRef } = parseArgs();

  // --- Independent fixture lookup, before touching the browser ---
  let expected: FetchedTicketFields;
  try {
    const fetched = await fetchTicketFieldsBy({ bookingRef: paidRef });
    if (!fetched) {
      throw new Error(`no document found at tickets/${paidRef} — --paid-ref must be a real, existing ticket`);
    }
    expected = fetched;
  } catch (error) {
    setupFailure(String(error));
  }

  // --- Resolve the reserved-ref fixture (best-effort; may SKIP, never silently passes) ---
  const reservedFixture = await resolveReservedFixture(explicitReservedRef).catch((error) => {
    setupFailure(`reserved-ref resolution failed: ${error}`);
  });

  // --- Build + start a real production server on an ephemeral port ---
  const port = await findFreePort().catch((error) => setupFailure(String(error)));
  const baseUrl = `http://localhost:${port}`;

  console.log('Building the app (next build)...');
  await new Promise<void>((resolve, reject) => {
    const build = spawn('node_modules/.bin/next', ['build'], { cwd: REPO_ROOT, stdio: 'inherit' });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`next build exited ${code}`))));
    build.on('error', reject);
  }).catch((error) => setupFailure(`next build failed: ${error}`));

  console.log(`Starting the app (next start -p ${port})...`);
  let server: ChildProcess;
  try {
    server = spawn('node_modules/.bin/next', ['start', '-p', String(port)], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  } catch (error) {
    setupFailure(`failed to spawn next start: ${error}`);
  }

  const killServer = () => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
    }
  };
  process.on('exit', killServer);
  process.on('SIGINT', () => {
    killServer();
    process.exit(1);
  });

  try {
    await waitForServer(baseUrl);
  } catch (error) {
    killServer();
    setupFailure(String(error));
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();

    // --- Case 1: paid-ref page renders a QR decoding to exactly the paid ref ---
    await page.goto(`${baseUrl}/tickets/confirmation?ref=${encodeURIComponent(paidRef)}`, {
      waitUntil: 'networkidle',
    });

    const qrImg = page.locator('img[alt*="QR code"]');
    const qrCount = await qrImg.count();
    if (qrCount === 0) {
      failCase('paid-ref-qr-rendered', 'no QR <img> found on the paid confirmation page');
    }
    const qrSrc = await qrImg.first().getAttribute('src');
    if (!qrSrc) {
      failCase('paid-ref-qr-rendered', 'QR <img> has no src attribute');
    }
    const decodedPageQr = decodeQrFromDataUri(qrSrc!);
    if (decodedPageQr !== paidRef) {
      failCase(
        'paid-ref-qr-decodes-to-booking-ref',
        `decoded QR text was ${JSON.stringify(decodedPageQr)}, expected exactly ${JSON.stringify(paidRef)}`
      );
    }

    // --- Case 2: buyer details (attendeeName, ticketType) appear in the rendered text ---
    const bodyText = (await page.textContent('body')) ?? '';
    if (!bodyText.includes(expected.attendeeName)) {
      failCase(
        'paid-ref-attendee-name-rendered',
        `page text did not contain independently-looked-up attendeeName ${JSON.stringify(expected.attendeeName)}`
      );
    }
    if (!bodyText.includes(expected.ticketType)) {
      failCase(
        'paid-ref-ticket-type-rendered',
        `page text did not contain independently-looked-up ticketType ${JSON.stringify(expected.ticketType)}`
      );
    }

    // --- Case 3: the download control produces a re-scannable PNG ---
    const downloadButton = page.getByRole('button', { name: /download/i });
    if ((await downloadButton.count()) === 0) {
      failCase('download-control-present', 'no download button found on the paid confirmation page');
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.first().click(),
    ]);
    const tmpPath = path.join(os.tmpdir(), `saoc-ticket-download-${Date.now()}.png`);
    await download.saveAs(tmpPath);
    let downloadedBuffer: Buffer;
    try {
      downloadedBuffer = await fs.readFile(tmpPath);
    } finally {
      await fs.rm(tmpPath, { force: true });
    }
    const decodedDownloadQr = decodeQrFromPngBuffer(downloadedBuffer);
    if (decodedDownloadQr !== paidRef) {
      failCase(
        'downloaded-png-qr-decodes-to-booking-ref',
        `downloaded PNG's decoded QR text was ${JSON.stringify(decodedDownloadQr)}, expected exactly ${JSON.stringify(paidRef)}`
      );
    }

    // --- Case 4: bogus ref renders no QR and no buyer-detail text (fail closed) ---
    await page.goto(`${baseUrl}/tickets/confirmation?ref=${encodeURIComponent(badRef)}`, {
      waitUntil: 'networkidle',
    });
    const badRefQrCount = await page.locator('img[alt*="QR code"]').count();
    if (badRefQrCount !== 0) {
      failCase('bad-ref-no-qr-rendered', `expected no QR <img> for a bogus ref, found ${badRefQrCount}`);
    }
    const badRefBodyText = (await page.textContent('body')) ?? '';
    if (badRefBodyText.includes(expected.attendeeName) || badRefBodyText.includes(expected.ticketType)) {
      failCase(
        'bad-ref-no-buyer-details-leaked',
        'bogus-ref page rendered text matching the PAID ref\'s attendeeName/ticketType — stale/leaked data'
      );
    }

    // --- Case 5: a REAL, existing-but-'reserved' document also fails closed (status gate,
    // not mere document presence) ---
    if ('skip' in reservedFixture) {
      console.warn(`SKIP [reserved-ref]: ${reservedFixture.skip}`);
    } else {
      const { ref: reservedRef, fields: reservedFields } = reservedFixture;
      // NOT 'networkidle' here: a 'reserved' ticket renders <ConfirmationPoller>, which polls
      // /api/tickets/status on a recurring 3s interval FOREVER (the ticket never becomes paid),
      // so the network never satisfies "idle" and page.goto would hang until its own timeout.
      // 'load' is correct and sufficient — the assertions below only need the DOM present, not
      // network silence.
      await page.goto(`${baseUrl}/tickets/confirmation?ref=${encodeURIComponent(reservedRef)}`, {
        waitUntil: 'load',
      });
      const reservedQrCount = await page.locator('img[alt*="QR code"]').count();
      if (reservedQrCount !== 0) {
        failCase(
          'reserved-ref-no-qr-rendered',
          `expected no QR <img> for a real but still-'reserved' ref (${reservedRef}), found ` +
            `${reservedQrCount} — the status gate in getConfirmedTicketForDisplay has been loosened`
        );
      }
      const reservedBodyText = (await page.textContent('body')) ?? '';
      const reservedAmountText =
        typeof reservedFields.amount === 'number' ? `R${reservedFields.amount.toFixed(2)}` : null;
      const leaked =
        reservedBodyText.includes(reservedFields.attendeeName) ||
        reservedBodyText.includes(reservedFields.ticketType) ||
        (reservedAmountText !== null && reservedBodyText.includes(reservedAmountText));
      if (leaked) {
        failCase(
          'reserved-ref-no-buyer-details-leaked',
          `a real but still-'reserved' ref (${reservedRef}) rendered its own attendeeName/` +
            'ticketType/amount on the page — the status gate in getConfirmedTicketForDisplay has ' +
            'been loosened to key off field presence instead of paid/checked-in status'
        );
      }
    }

    console.log(
      'verify_confirmation_page PASSED: QR, buyer details, download, fail-closed bogus-ref, and ' +
        (('skip' in reservedFixture) ? 'SKIPPED reserved-ref' : 'fail-closed reserved-ref') +
        ' all verified.'
    );
  } catch (error) {
    // Any unexpected exception here is a real failure of the run itself, not a named
    // sub-case — surface it loudly rather than letting it look like a clean exit.
    console.error('FAIL [unexpected-error]:', error);
    process.exitCode = 1;
    return;
  } finally {
    await browser?.close();
    killServer();
  }
}

main();
