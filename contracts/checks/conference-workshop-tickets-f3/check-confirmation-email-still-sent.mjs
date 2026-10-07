// F3 (conference-workshop-tickets, M2) — A30 (kind: gws_inbox_check): the confirmation
// email still sends for the day-visitor sandbox purchase above (A29) via the existing
// lib/confirmation-email.ts -> lib/tickets-notification.ts Resend path (the SAME path
// app/api/tickets/itn/route.ts already delegates to for every real payment — no new
// email code) — proving this feature's new excludedDays rejection branch in
// app/api/tickets/checkout/route.ts did not regress the pre-existing ACCEPTED-day email
// path. Real, sourced purpose per team-lead's own framing, not a fabricated check: F3 adds
// a new early-return branch immediately after the existing isValidChosenDay() call (A21),
// and a careless implementation of that branch is exactly the kind of change that could
// silently break the accepted-day flow for everyone, not just excluded days.
//
// Same relay convention as F4's check-confirmation-email-sent.mjs (A16): this script does
// not perform the gws lookup itself (necessarily a live, human-or-agent-initiated step
// against a real inbox) — it locates this feature's manifest and relays
// execution/gws_inbox_check.sh's own verdict, failing loudly with instructions if the
// manifest was never produced.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const MANIFEST_REL_PATH =
  '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f3-a30-confirmation-email-manifest.json';
const manifestPath = path.join(REPO_ROOT, MANIFEST_REL_PATH);
const gwsScript = path.join(REPO_ROOT, 'execution/gws_inbox_check.sh');

if (!existsSync(manifestPath)) {
  console.error('FAIL: check-confirmation-email-still-sent.mjs');
  console.error(`  - no manifest at ${MANIFEST_REL_PATH}`);
  console.error(
    '  - this assertion requires a REAL gws lookup: after driving A29\'s day-visitor ' +
      "sandbox purchase (Friday, included day) to a confirmed send (attendeeEmail: " +
      "'brad@inunu.net', not a sentinel address, so the real send is readable), run " +
      '`gws mail read <message_id>` against the resulting confirmation email and write ' +
      'its result to the manifest path above in the shape of ' +
      '.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/gws_manifest_good.json',
  );
  process.exit(1);
}

if (!existsSync(gwsScript)) {
  console.error('FAIL: check-confirmation-email-still-sent.mjs');
  console.error(`  - execution/gws_inbox_check.sh not found at ${gwsScript} — harness file missing or moved`);
  process.exit(1);
}

try {
  const output = execFileSync('bash', [gwsScript, manifestPath], { encoding: 'utf8' });
  process.stdout.write(output);
  console.log('PASS: execution/gws_inbox_check.sh verified the real gws inbox-read manifest for the day-visitor confirmation email, post-excludedDays-check.');
  process.exit(0);
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  console.error('FAIL: check-confirmation-email-still-sent.mjs');
  console.error(`  - execution/gws_inbox_check.sh rejected the manifest (exit ${error.status})`);
  process.exit(1);
}
