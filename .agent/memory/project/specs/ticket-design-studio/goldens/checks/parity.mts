// ticket-design-studio parity: the shipped default design must render exactly what the renderers
// rendered before the studio existed. Run from the repo root:
//   pnpm exec tsx .agent/memory/project/specs/ticket-design-studio/goldens/checks/parity.mts
// Exits 0 when (a) the email HTML with the explicit default design equals the HTML with no design
// argument, and (b) the ticket PDF text with the default design equals the text with no design.
import { render } from '@react-email/components';
import { buildTicketTypeEmail } from '@/lib/ticket-type-email';
import { buildTicketPdf } from '@/lib/ticket-pdf';
import { DEFAULT_DESIGN } from '@/lib/ticket-design';

const values = {
  firstName: 'Thandi', visitorName: 'Thandi Nkosi', quantity: '1', bookingReference: 'NOS-SAMPLE-0004',
  amountPaid: 'R100.00', paymentStatus: 'Paid', visitDate: null,
};
const positions = [{ bookingRef: 'NOS-SAMPLE-0004', attendeeName: 'Thandi Nkosi', ticketTypeTitle: 'VIP Ticket', qrContentId: 'qr-0004' }];
const emailHtml = async (design?: unknown) =>
  render(buildTicketTypeEmail({ key: 'vip', values, positions, recoveryUrl: null, ...(design ? { design } : {}) } as never).react);

const pdfInput = {
  orderReference: null,
  positions: [{ bookingRef: 'NOS-SAMPLE-0004', attendeeName: 'Thandi Nkosi', ticketType: 'VIP Ticket', slug: 'vip',
    schedule: { eyebrow: null, numeral: null, dateText: 'Thursday, 23 September 2027', timeText: '16:30–19:00' } }],
  visit: { venueName: 'Sample Venue', venueAddress: null, venueParking: null, showDates: '23–26 September 2027',
    showUrl: 'nos.saoc.co.za', emergency: [], onSiteContact: null, organiser: null, showOffice: null,
    questionsEmail: 'info@saoc.co.za', openingTimes: null },
};

async function main(): Promise<number> {
  const a = await emailHtml();
  const b = await emailHtml(DEFAULT_DESIGN.vip ?? DEFAULT_DESIGN);
  if (a !== b) { console.error('FAIL email HTML differs between no design and the default design'); return 1; }
  const p1 = await buildTicketPdf(pdfInput as never);
  const p2 = await buildTicketPdf(pdfInput as never, (DEFAULT_DESIGN.vip ?? DEFAULT_DESIGN) as never);
  const norm = (u: Uint8Array) => Buffer.from(u).toString('latin1').replace(/\/(CreationDate|ModDate|ID)[^\n]*/g, '');
  if (norm(p1) !== norm(p2)) { console.error('FAIL ticket PDF bytes differ between no design and the default design'); return 1; }
  console.log('parity ok');
  return 0;
}
main().then((c) => process.exit(c));
