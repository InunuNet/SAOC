// ticket-email-samples: with the per-type switch injected ON, sendConfirmationEmail sends each of
// Lee-Ann's 8 emails (subject plus body) and falls back to the generic email for an unmapped
// ticket type. Fakes only: no Resend, no Sanity, no Firestore.
//   pnpm exec tsx scripts/checks/per-type-confirmation-send.mts <goldens-dir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render } from '@react-email/components';

import { sendConfirmationEmail } from '../../lib/confirmation-email';

const EXIT_FAIL = 1;
const EXIT_SETUP = 2;
const MARKERS_HEAD = '## MARKERS';
const GENERIC_SUBJECT_TAIL = 'Your National Orchid Show order is confirmed';

interface Fixture {
  first_name: string;
  amount_paid: string;
  payment_status: string;
  types: Record<
    string,
    { slug: string; visitor_name: string; quantity: number; booking_reference: string; selected_visit_date?: string }
  >;
}

const norm = (text: string): string =>
  text.normalize('NFKC').replace(/•/g, ' ').replace(/\s+/g, ' ').trim();

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function send(input: Parameters<typeof sendConfirmationEmail>[0]): Promise<{ subject: string; text: string }> {
  let subject = '';
  let text = '';
  await sendConfirmationEmail(input, {
    perTypeEmails: true,
    mailer: {
      async send(args) {
        subject = args.subject;
        text = htmlToText(await render(args.react));
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
  });
  return { subject, text };
}

async function main(): Promise<number> {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: per-type-confirmation-send.mts <goldens-dir>');
    return EXIT_SETUP;
  }
  const fx = JSON.parse(readFileSync(join(dir, 'fixtures.json'), 'utf8')) as Fixture;
  let failures = 0;
  for (const [key, v] of Object.entries(fx.types)) {
    const lines = readFileSync(join(dir, 'emails', `${key}.txt`), 'utf8').split('\n').filter(Boolean);
    const cut = lines.indexOf(MARKERS_HEAD);
    const body = lines.slice(0, cut);
    const markers = lines.slice(cut + 1);
    const { subject, text } = await send({
      orderId: `order-${key}`,
      buyerEmail: 'buyer@example.invalid',
      buyerName: v.visitor_name,
      firstName: fx.first_name,
      quantity: v.quantity,
      amountPaid: fx.amount_paid,
      paymentStatus: fx.payment_status,
      visitDate: v.selected_visit_date,
      positions: [{ bookingRef: v.booking_reference, attendeeName: v.visitor_name, ticketType: v.slug }],
      recoveryToken: null,
      orderReference: `ORDER-${key}`,
    });
    const hay = norm(text);
    let cursor = 0;
    for (const raw of body) {
      const line = raw.startsWith('Subject: ') ? raw.slice('Subject: '.length) : raw.replace(/^- /, '');
      const needle = norm(line);
      if (raw.startsWith('Subject: ')) {
        if (!subject.includes(line)) {
          console.error(`FAIL ${key}: subject "${subject}" lacks "${line}"`);
          failures++;
        }
        continue;
      }
      const at = hay.indexOf(needle, cursor);
      if (at < 0) {
        console.error(`FAIL ${key}: not found in order: ${line}`);
        failures++;
        break;
      }
      cursor = at + needle.length;
    }
    for (const marker of markers) {
      if (!hay.includes(norm(marker))) {
        console.error(`FAIL ${key}: marker missing: ${marker}`);
        failures++;
      }
    }
  }
  const fallback = await send({
    orderId: 'order-unmapped',
    buyerEmail: 'buyer@example.invalid',
    buyerName: 'Thandi Nkosi',
    firstName: fx.first_name,
    positions: [{ bookingRef: 'NOS-SAMPLE-0099', attendeeName: 'Thandi Nkosi', ticketType: 'workshops' }],
    recoveryToken: null,
  });
  if (!fallback.subject.endsWith(GENERIC_SUBJECT_TAIL)) {
    console.error(`FAIL unmapped ticket type did not fall back to the generic subject: ${fallback.subject}`);
    failures++;
  }
  console.log(failures ? `per-type send FAIL (${failures})` : 'per-type send ok');
  return failures ? EXIT_FAIL : 0;
}

main().then((code) => process.exit(code));
