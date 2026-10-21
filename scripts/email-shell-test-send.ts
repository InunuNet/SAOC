/**
 * Sandbox test-send for the email-shell mission (contract email-shell, assertions A14/A15).
 *
 *   pnpm exec tsx scripts/email-shell-test-send.ts A|B|C|D
 *
 * Sends ONE fictional-fixture email per family through lib/email.ts sendEmail(), to
 * TEST_RECIPIENT only. Hard-wired: it refuses any other recipient and refuses to run without
 * RESEND_API_KEY. Run only after Codi has approved the per-family renders.
 */
import { config } from 'dotenv';

import { FIXTURES } from '../contracts/checks/email-shell/fixtures.mts';
import { FORMS_FROM_ADDRESS, sendEmail } from '../lib/email';

const TEST_RECIPIENT = 'brad@inunu.net';
const SUBJECT_PREFIX = '[TEST] ';

interface FamilyPick {
  fixtureName: string;
  subject: string;
}

// Subjects are the templates' real production subjects.
const FAMILY_PICKS: Record<string, FamilyPick> = {
  A: { fixtureName: 'VendorPaymentConfirmation', subject: 'Your National Orchid Show stand payment is confirmed' },
  B: { fixtureName: 'VendorApplicationConfirmation', subject: 'We received your vendor application — SAOC' },
  C: { fixtureName: 'VendorApplicationAdminNotice', subject: 'New vendor application submitted — SAOC' },
  D: { fixtureName: 'ContactConfirmation', subject: 'We received your message — SAOC' },
};

function fail(message: string): never {
  console.error(`email-shell-test-send: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  config({ path: '.env.local' });

  const family = process.argv[2];
  const pick = family ? FAMILY_PICKS[family] : undefined;
  if (!pick) fail('usage: email-shell-test-send.ts A|B|C|D');
  if (!process.env.RESEND_API_KEY) fail('RESEND_API_KEY is not set; refusing to send');

  const fixture = FIXTURES.find((f) => f.name === pick.fixtureName);
  if (!fixture) fail(`no fixture named ${pick.fixtureName}`);

  await sendEmail({
    to: TEST_RECIPIENT,
    subject: `${SUBJECT_PREFIX}${pick.subject}`,
    react: fixture.element,
    from: FORMS_FROM_ADDRESS,
  });
  console.log(`sent family ${family} (${pick.fixtureName}) to ${TEST_RECIPIENT}`);
}

main().catch((error: unknown) => {
  const type = error instanceof Error ? error.constructor.name : typeof error;
  fail(`send failed (${type})`);
});
