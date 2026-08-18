/**
 * Contract assertion for reply-to-header-fix/contract-f1.yaml (A4).
 *
 * Proves lib/email.ts actually populates a reply-to header on the payload it hands to Resend
 * -- not that the string "info@saoc.co.za" merely appears somewhere in the file (that grep
 * would also pass on a comment or a dead variable; see the golden's "Why not a grep-only
 * assertion" section). Imports ONLY the pure payload-building functions -- no Resend client
 * construction, no network call -- so this is safe to run in CI/contract gates with no
 * RESEND_API_KEY present.
 *
 * Run: node_modules/.bin/tsx execution/checks/verify_reply_to.ts
 * Exit 0 on all cases passing, exit 1 with a message naming the failing case otherwise.
 */

const DEFAULT_REPLY_TO = 'info@saoc.co.za';

const failures: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function main() {
  // Imported once. resolveReplyTo()/buildEmailPayload() are required (see the golden) to read
  // process.env.RESEND_REPLY_TO at CALL time, not at module-load time -- TICKETS_FROM_ADDRESS/
  // FORMS_FROM_ADDRESS are the only module-load-time-resolved constants in lib/email.ts, and
  // the reply-to path is deliberately NOT built the same way, precisely so a single module
  // import can be reused across every env-var scenario below.
  const { resolveReplyTo, buildEmailPayload, TICKETS_FROM_ADDRESS, FORMS_FROM_ADDRESS } =
    await import('../../lib/email');

  // Fixture args matching sendEmail's real external signature -- react is never inspected by
  // buildEmailPayload's reply-to logic, so a minimal stand-in is fine.
  const fixtureArgs = {
    to: 'buyer@example.test',
    subject: 'Test subject',
    react: null as unknown as import('react').JSX.Element,
  };

  // --- Scenario 1: RESEND_REPLY_TO unset ---
  delete process.env.RESEND_REPLY_TO;
  check('resolveReplyTo() with unset env', resolveReplyTo(), DEFAULT_REPLY_TO);
  check(
    'buildEmailPayload().replyTo with unset env',
    buildEmailPayload({ ...fixtureArgs, from: TICKETS_FROM_ADDRESS }).replyTo,
    DEFAULT_REPLY_TO
  );

  // --- Scenario 2: RESEND_REPLY_TO empty string ---
  process.env.RESEND_REPLY_TO = '';
  check('resolveReplyTo() with empty-string env', resolveReplyTo(), DEFAULT_REPLY_TO);

  // --- Scenario 3: RESEND_REPLY_TO whitespace only ---
  process.env.RESEND_REPLY_TO = '   ';
  check('resolveReplyTo() with whitespace-only env', resolveReplyTo(), DEFAULT_REPLY_TO);

  // --- Scenario 4: RESEND_REPLY_TO explicitly set ---
  process.env.RESEND_REPLY_TO = 'ops@example.test';
  check('resolveReplyTo() with explicit env override', resolveReplyTo(), 'ops@example.test');
  check(
    'buildEmailPayload().replyTo with explicit env override',
    buildEmailPayload({ ...fixtureArgs, from: TICKETS_FROM_ADDRESS }).replyTo,
    'ops@example.test'
  );
  delete process.env.RESEND_REPLY_TO;

  // --- Scenario 5: tickets AND forms categories both get a non-empty, matching replyTo ---
  {
    const ticketsPayload = buildEmailPayload({ ...fixtureArgs, from: TICKETS_FROM_ADDRESS });
    const formsPayload = buildEmailPayload({ ...fixtureArgs, from: FORMS_FROM_ADDRESS });
    if (!ticketsPayload.replyTo) {
      failures.push('tickets-category payload: replyTo is falsy, forms mail is not the only category affected');
    }
    if (!formsPayload.replyTo) {
      failures.push('forms-category payload: replyTo is falsy -- forms mail was excluded');
    }
    check('tickets vs forms replyTo consistency', ticketsPayload.replyTo, formsPayload.replyTo);
  }

  if (failures.length > 0) {
    console.error('verify_reply_to FAILED:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log('verify_reply_to PASSED: all 5 scenarios confirm a real, env-aware reply-to header.');
  process.exit(0);
}

main().catch((error) => {
  console.error('verify_reply_to CRASHED:', error);
  process.exit(1);
});
