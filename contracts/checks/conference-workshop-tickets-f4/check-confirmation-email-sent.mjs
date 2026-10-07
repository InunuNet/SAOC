// F4 (conference-workshop-tickets, M2) — A16 (kind: gws_inbox_check): the confirmation
// email actually sends for the early-bird sandbox purchase (A14) via the existing
// lib/confirmation-email.ts -> lib/tickets-notification.ts Resend path (the SAME path
// app/api/tickets/itn/route.ts already delegates to for every real payment — no new
// email code). The real send/receive/read proof is execution/gws_inbox_check.sh
// (HARNESS-owned, execution/ — see .claude/rules/athanor.md: never patched here, only
// called) against a manifest recording a REAL `gws mail read` lookup of
// brad@inunu.net's inbox, same recipient/shape convention as
// .agent/memory/project/specs/verification-triad-gate/goldens/fixtures/
// gws_manifest_good.json. This script does not perform the gws lookup itself (that is
// necessarily a live, human-or-agent-initiated step against a real inbox — the exact
// shape this project's verification triad calls Layer 3) — it locates this feature's
// manifest and relays execution/gws_inbox_check.sh's own verdict, failing loudly with
// instructions if the manifest was never produced (never a silent/accidental pass).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const MANIFEST_REL_PATH =
  '.agent/memory/project/specs/conference-workshop-tickets/goldens/fixtures/f4-a16-confirmation-email-manifest.json';
const manifestPath = path.join(REPO_ROOT, MANIFEST_REL_PATH);
const gwsScript = path.join(REPO_ROOT, 'execution/gws_inbox_check.sh');

if (!existsSync(manifestPath)) {
  console.error('FAIL: check-confirmation-email-sent.mjs');
  console.error(`  - no manifest at ${MANIFEST_REL_PATH}`);
  console.error(
    '  - this assertion requires a REAL gws lookup: after driving A14\'s early-bird ' +
      "sandbox purchase to a confirmed send (attendeeEmail: 'brad@inunu.net', not a " +
      "sentinel address, so the real send is readable), run `gws mail read <message_id>` " +
      'against the resulting confirmation email and write its result to the manifest ' +
      'path above in the shape of ' +
      '.agent/memory/project/specs/verification-triad-gate/goldens/fixtures/gws_manifest_good.json',
  );
  process.exit(1);
}

if (!existsSync(gwsScript)) {
  console.error('FAIL: check-confirmation-email-sent.mjs');
  console.error(`  - execution/gws_inbox_check.sh not found at ${gwsScript} — harness file missing or moved`);
  process.exit(1);
}

try {
  const output = execFileSync('bash', [gwsScript, manifestPath], { encoding: 'utf8' });
  process.stdout.write(output);
  console.log('PASS: execution/gws_inbox_check.sh verified the real gws inbox-read manifest for the early-bird confirmation email.');
  process.exit(0);
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  console.error('FAIL: check-confirmation-email-sent.mjs');
  console.error(`  - execution/gws_inbox_check.sh rejected the manifest (exit ${error.status})`);
  process.exit(1);
}
