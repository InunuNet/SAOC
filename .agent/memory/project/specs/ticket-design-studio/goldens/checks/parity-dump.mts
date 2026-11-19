// Helper for parity.mts: renders every per-type email and one ticket PDF with whichever renderer
// is in the current working tree, and writes a normalised JSON snapshot to argv[2].
//   argv[3] "base"    = the pre-studio signature buildTicketPdf(input, { testMode })
//   argv[3] "new"     = the studio signature, design omitted
//   argv[3] "design"  = the studio signature, DEFAULT_DESIGN passed explicitly
// The PDF snapshot is the decoded page content streams (every drawing op, text string, colour and
// coordinate) plus the page count: those are deterministic, unlike the raw bytes (font subset
// tags, ID, dates).
import { writeFileSync } from 'node:fs';
import { render } from '@react-email/components';
import { PDFArray, PDFDocument, decodePDFRawStream, type PDFRawStream } from 'pdf-lib';
import { buildTicketPdf } from '@/lib/ticket-pdf';
import { buildTicketTypeEmail } from '@/lib/ticket-type-email';
import { TICKET_EMAIL_COPY } from '@/lib/ticket-email-copy';

const [, , outPath, mode] = process.argv;
if (!outPath || !['base', 'new', 'design'].includes(mode)) {
  console.error('usage: parity-dump.mts <out.json> <base|new|design>');
  process.exit(2);
}

const values = {
  firstName: 'Thandi', visitorName: 'Thandi Nkosi', quantity: '1', bookingReference: 'NOS-SAMPLE-0004',
  amountPaid: 'R100.00', paymentStatus: 'Paid', visitDate: null,
};
const positions = [{ bookingRef: 'NOS-SAMPLE-0004', attendeeName: 'Thandi Nkosi', ticketTypeTitle: 'VIP Ticket', qrContentId: 'qr-0004' }];
const pdfInput = {
  orderReference: null,
  positions: [{ bookingRef: 'NOS-SAMPLE-0004', attendeeName: 'Thandi Nkosi', ticketType: 'VIP Ticket', slug: 'vip',
    schedule: { eyebrow: null, numeral: null, dateText: 'Thursday, 23 September 2027', timeText: '16:30–19:00' } }],
  visit: { venueName: 'Sample Venue', venueAddress: null, venueParking: null, showDates: '23–26 September 2027',
    showUrl: 'nos.saoc.co.za', emergency: [], onSiteContact: null, organiser: null, showOffice: null,
    questionsEmail: 'info@saoc.co.za', openingTimes: null },
};

async function loadDesign(): Promise<unknown> {
  if (mode !== 'design') return undefined;
  const { DEFAULT_DESIGN } = await import('@/lib/ticket-design');
  return DEFAULT_DESIGN;
}

async function pdfOps(design: unknown): Promise<string> {
  const build = buildTicketPdf as (...args: unknown[]) => Promise<Uint8Array>;
  const bytes = mode === 'base'
    ? await build(pdfInput, { testMode: false })
    : await build(pdfInput, design, { testMode: false });
  const doc = await PDFDocument.load(bytes);
  let ops = `pages=${doc.getPageCount()}\n`;
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
    for (const ref of refs) {
      const stream = doc.context.lookup(ref as never) as PDFRawStream;
      ops += Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1') + '\n';
    }
  }
  return ops;
}

async function main(): Promise<void> {
  const design = await loadDesign();
  const html: Record<string, string> = {};
  for (const key of Object.keys(TICKET_EMAIL_COPY)) {
    for (const recoveryUrl of [null, 'https://example.test/recover']) {
      const input = { key, values, positions, recoveryUrl, ...(design ? { design } : {}) };
      html[`${key}|${recoveryUrl}`] = await render(buildTicketTypeEmail(input as never).react);
    }
  }
  writeFileSync(outPath, JSON.stringify({ html, ops: await pdfOps(design) }));
}
main().catch((error: unknown) => {
  console.error(error);
  process.exit(2);
});
