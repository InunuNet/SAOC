// ticket-email-samples: the order facts the payment notification passes to sendConfirmationEmail
// (amount paid, payment status, chosen visit day) reach the per-type email, and the real caller
// (lib/tickets-notification.ts) passes them. Fakes only: no Resend, no Sanity, no Firestore.
//   pnpm exec tsx scripts/checks/confirmation-order-fields.mts
import { readFileSync } from 'node:fs';

import { render } from '@react-email/components';

import { sendConfirmationEmail } from '../../lib/confirmation-email';
import { buildOrderEmailFields } from '../../lib/ticket-order-fields';

const EXIT_FAIL = 1;
const CALLER = 'lib/tickets-notification.ts';

const norm = (text: string): string => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function emailText(fields: ReturnType<typeof buildOrderEmailFields>): Promise<string> {
  let text = '';
  await sendConfirmationEmail(
    {
      orderId: 'order-fixture',
      buyerEmail: 'buyer@example.invalid',
      buyerName: 'Thandi Nkosi',
      positions: [{ bookingRef: 'NOS-SAMPLE-0001', attendeeName: 'Thandi Nkosi', ticketType: 'early-bird' }],
      recoveryToken: null,
      ...fields,
    },
    {
      perTypeEmails: true,
      mailer: {
        async send(args) {
          text = norm(await render(args.react));
        },
      },
      generateQrPngBuffer: async () => Buffer.from('qr'),
      siteUrl: 'https://nos.example.invalid',
      loadVisit: async () => ({
        pendingLabel: null,
        venueName: null,
        venueAddress: null,
        showDates: null,
        parking: null,
        openingTimes: null,
      }),
      loadTicketTypeTraits: async () => new Map(),
      buildTicketPdf: async () => new Uint8Array([1]),
    },
  );
  return text;
}

function expect(failures: string[], ok: boolean, message: string): void {
  if (!ok) failures.push(message);
}

async function main(): Promise<number> {
  const failures: string[] = [];

  const withDay = await emailText(buildOrderEmailFields(100, '2027-09-25'));
  expect(failures, withDay.includes('Amount paid: R100.00'), 'amount paid not printed as R100.00');
  expect(failures, withDay.includes('Payment status: Paid'), 'payment status not printed as Paid');
  expect(
    failures,
    withDay.includes('Valid for: Saturday, 25 September 2027'),
    'chosen day not printed as Saturday, 25 September 2027',
  );

  const noDay = await emailText(buildOrderEmailFields(100, null));
  expect(failures, noDay.includes('Valid for: [To be confirmed]'), 'no chosen day must print [To be confirmed]');

  const caller = readFileSync(CALLER, 'utf8');
  expect(failures, caller.includes('buildOrderEmailFields(lookup.amount'), 'caller does not pass the order amount');
  expect(failures, caller.includes('loadChosenDays(reference)'), 'caller does not read the chosen day');

  for (const message of failures) console.error(`FAIL ${message}`);
  console.log(failures.length ? `order fields FAIL (${failures.length})` : 'order fields ok');
  return failures.length ? EXIT_FAIL : 0;
}

main().then((code) => process.exit(code));
