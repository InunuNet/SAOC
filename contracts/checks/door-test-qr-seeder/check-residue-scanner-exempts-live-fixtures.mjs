// A5 — with fixtures seeded, the live residue scanner must exit 0 and report the
// deliberately-live door-test fixtures as INFO, not FAIL.

import { execFileSync } from 'node:child_process';

import { assert, deleteTicketByBookingRef, PROJECT_ROOT, runDoorSeedCli, runDoorTeardownCli } from './_shared.mjs';

function runScannerLive() {
  try {
    const stdout = execFileSync('node_modules/.bin/tsx', ['scripts/scan-firestore-residue.ts'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { exitCode: 0, stdout };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

async function main() {
  try {
    runDoorTeardownCli();
  } catch {
    // fine if nothing existed yet
  }
  runDoorSeedCli();

  const { exitCode, stdout } = runScannerLive();

  assert(exitCode === 0, `live residue scanner exited ${exitCode} with fixtures deliberately live:\n${stdout}`);
  assert(stdout.includes('INFO'), `expected an INFO line for the deliberately-live fixtures, got:\n${stdout}`);
  assert(
    stdout.includes('DOOR-QR-ADMIT-01'),
    `expected the scanner output to name DOOR-QR-ADMIT-01, got:\n${stdout}`,
  );
  assert(!stdout.includes('FAIL'), `scanner output must not contain FAIL while fixtures are deliberately live:\n${stdout}`);

  console.log('PASS: A5 the live residue scanner exempts this tool\'s deliberately-live fixtures as INFO, exits 0');
}

main()
  .catch((err) => {
    console.error(`FAIL: A5 — ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      runDoorTeardownCli();
    } catch {
      // best-effort; direct-delete fallback below still runs
    }
    await deleteTicketByBookingRef('DOOR-QR-ADMIT-01');
    await deleteTicketByBookingRef('DOOR-QR-UNPAID-01');
    await deleteTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  });
