// official-title-sweep follow-ups: env header-injection guard, PDF ticket-type fallback, NOS og:title.
// Run as: pnpm exec tsx contracts/checks/official-title-sweep/check-email-and-title-guards.mts
import { buildPageMetadata } from '../../../lib/seo.ts';
import { toPdfPositions } from '../../../lib/ticket-pdf-data.ts';

const failures: string[] = [];
const check = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
};

process.env.RESEND_REPLY_TO_NOS = 'a@b.test\r\nBcc: x@y.test';
process.env.RESEND_REPLY_TO = 'c@d.test\nBcc: x@y.test';
process.env.RESEND_FROM_TICKETS_NOS = 'Show <t@b.test>\nBcc: x@y.test';
const email = await import('../../../lib/email.ts');
check('nos reply-to with CRLF falls back', email.resolveReplyTo('nos'), 'show@saoc.co.za');
check('saoc reply-to with LF falls back', email.resolveReplyTo('saoc'), 'info@saoc.co.za');
check(
  'nos from with LF falls back',
  email.NOS_TICKETS_FROM_ADDRESS,
  'The National Orchid Show <tickets@tickets.saoc.co.za>',
);

const visit = {} as Parameters<typeof toPdfPositions>[2];
const pdf = toPdfPositions(
  [
    { bookingRef: 'R1', attendeeName: 'A', ticketType: 'vip' },
    { bookingRef: 'R2', attendeeName: 'B', ticketType: 'zz-unmapped' },
  ],
  new Map(),
  visit,
  new Map(),
);
check('pdf vip fallback', pdf[0]?.ticketType, 'VIP Ticket');
check('pdf unknown fallback', pdf[1]?.ticketType, 'Ticket');

const og = buildPageMetadata({ title: 'Tickets', description: 'x'.repeat(80), path: '/tickets/vip' });
check('tickets og title', (og.openGraph as { title?: string }).title, 'Tickets | The National Orchid Show');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('PASS official-title-sweep guards');
