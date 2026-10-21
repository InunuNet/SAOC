/**
 * Sandbox test-send for the email-shell mission (contract email-shell, assertions A14/A15,
 * A21-A23).
 *
 *   pnpm exec tsx scripts/email-shell-test-send.ts A|B|C|D|order
 *
 * Sends ONE fictional-fixture email through lib/email.ts sendEmail(), to TEST_RECIPIENT only
 * (a hard-coded constant with no override: any other recipient is unreachable) and refuses to
 * run without RESEND_API_KEY. Run only after Codi has approved the renders.
 *
 *   A      VendorPaymentConfirmation        family A
 *   B      VendorApplicationConfirmation    family B
 *   C      VendorApplicationAdminNotice     family C
 *   D      ContactConfirmation              family D (held until the D lockups ship)
 *   order  OrderConfirmation                family A, with real QR attachments, so the venue,
 *                                           dates and ticket cards can be reviewed
 */
import { config } from 'dotenv';

import { FIXTURES } from '../contracts/checks/email-shell/fixtures.mts';
import {
  FORMS_FROM_ADDRESS,
  sendEmail,
  TICKETS_FROM_ADDRESS,
  type EmailAttachment,
} from '../lib/email';
import { generateBookingRefQrPngBuffer } from '../lib/qr';

const TEST_RECIPIENT = 'brad@inunu.net';
const SUBJECT_PREFIX = '[TEST] ';

interface SendPick {
  fixtureName: string;
  subject: string;
  from: string;
  withQrAttachments?: boolean;
}

// Subjects are the templates' real production subjects.
const PICKS: Record<string, SendPick> = {
  A: {
    fixtureName: 'VendorPaymentConfirmation',
    subject: 'Your National Orchid Show stand payment is confirmed',
    from: FORMS_FROM_ADDRESS,
  },
  B: {
    fixtureName: 'VendorApplicationConfirmation',
    subject: 'We received your vendor application — SAOC',
    from: FORMS_FROM_ADDRESS,
  },
  C: {
    fixtureName: 'VendorApplicationAdminNotice',
    subject: 'New vendor application submitted — SAOC',
    from: FORMS_FROM_ADDRESS,
  },
  D: {
    fixtureName: 'ContactConfirmation',
    subject: 'We received your message — SAOC',
    from: FORMS_FROM_ADDRESS,
  },
  order: {
    fixtureName: 'OrderConfirmation',
    subject: 'Your National Orchid Show order is confirmed',
    from: TICKETS_FROM_ADDRESS,
    withQrAttachments: true,
  },
};

interface QrPosition {
  bookingRef: string;
  qrContentId: string;
}

function isQrPositionList(value: unknown): value is QrPosition[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).bookingRef === 'string' &&
        typeof (item as Record<string, unknown>).qrContentId === 'string',
    )
  );
}

function fail(message: string): never {
  console.error(`email-shell-test-send: ${message}`);
  process.exit(1);
}

async function buildQrAttachments(positions: QrPosition[]): Promise<EmailAttachment[]> {
  return Promise.all(
    positions.map(async (position) => ({
      content: await generateBookingRefQrPngBuffer(position.bookingRef),
      filename: `${position.qrContentId}.png`,
      contentType: 'image/png',
      contentId: position.qrContentId,
    })),
  );
}

async function main(): Promise<void> {
  config({ path: '.env.local' });

  const mode = process.argv[2];
  const pick = mode ? PICKS[mode] : undefined;
  if (!pick) fail('usage: email-shell-test-send.ts A|B|C|D|order');
  if (!process.env.RESEND_API_KEY) fail('RESEND_API_KEY is not set; refusing to send');

  const fixture = FIXTURES.find((f) => f.name === pick.fixtureName);
  if (!fixture) fail(`no fixture named ${pick.fixtureName}`);

  let attachments: EmailAttachment[] | undefined;
  if (pick.withQrAttachments) {
    const props = fixture.element.props as { positions?: unknown }; // ReactElement props are unknown
    if (!isQrPositionList(props.positions)) fail('fixture has no QR positions');
    attachments = await buildQrAttachments(props.positions);
  }

  await sendEmail({
    to: TEST_RECIPIENT,
    subject: `${SUBJECT_PREFIX}${pick.subject}`,
    react: fixture.element,
    from: pick.from,
    attachments,
  });
  console.log(`sent ${mode} (${pick.fixtureName}) to ${TEST_RECIPIENT}`);
}

main().catch((error: unknown) => {
  const type = error instanceof Error ? error.constructor.name : typeof error;
  fail(`send failed (${type})`);
});
