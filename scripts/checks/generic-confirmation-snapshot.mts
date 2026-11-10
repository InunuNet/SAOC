// ticket-email-samples: with the per-type switch off, sendConfirmationEmail must send the same
// generic email it sends today. Uses injected fakes only: no Resend, no Sanity, no Firestore.
//   pnpm exec tsx scripts/checks/generic-confirmation-snapshot.mts --compare <golden.json>
//   pnpm exec tsx scripts/checks/generic-confirmation-snapshot.mts --write <golden.json>
// The input is the PRE-mission SendConfirmationEmailInput shape (no new optional fields).
import { readFileSync, writeFileSync } from 'node:fs';

import { render } from '@react-email/components';

import { sendConfirmationEmail } from '../../lib/confirmation-email';

const EXIT_DIFF = 1;
const EXIT_SETUP = 2;

async function capture(): Promise<{ subject: string; html: string }> {
  let subject = '';
  let html = '';
  await sendConfirmationEmail(
    {
      orderId: 'order-fixture',
      buyerEmail: 'buyer@example.invalid',
      buyerName: 'Thandi Nkosi',
      positions: [{ bookingRef: 'NOS-SAMPLE-0001', attendeeName: 'Thandi Nkosi', ticketType: 'early-bird' }],
      recoveryToken: null,
      orderReference: 'ORDER-FIXTURE',
    },
    {
      mailer: {
        async send(args) {
          subject = args.subject;
          html = await render(args.react);
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
  return { subject, html };
}

async function main(): Promise<number> {
  const [mode, path] = process.argv.slice(2);
  if ((mode !== '--compare' && mode !== '--write') || !path) {
    console.error('usage: generic-confirmation-snapshot.mts --compare|--write <golden.json>');
    return EXIT_SETUP;
  }
  const got = await capture();
  if (mode === '--write') {
    writeFileSync(path, JSON.stringify(got, null, 2) + '\n');
    console.log('written', path);
    return 0;
  }
  const want = JSON.parse(readFileSync(path, 'utf8')) as { subject: string; html: string };
  if (want.subject !== got.subject || want.html !== got.html) {
    console.error('FAIL generic confirmation email differs from the frozen snapshot');
    return EXIT_DIFF;
  }
  console.log('generic email unchanged');
  return 0;
}

main().then((code) => process.exit(code));
