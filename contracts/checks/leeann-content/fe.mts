// leeann-content-build F2 (FE): ticket PDF and confirmation email fixes from Lee-Ann's 24 Oct 2026 answers.
// Usage: pnpm exec tsx contracts/checks/leeann-content/fe.mts <cmd>
//   products | pdf-dates | show-office | questions-email | email-constant | no-organiser | email-parking | pdf-parking
// Exit 0 on pass, 1 on fail (each failure printed), 2 on an unknown command or a missing tool.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fail, finish, readText } from './lib.mts';

const SANDBOX = '.tmp/sandbox/leeann-content';
const FIXTURE = '.agent/memory/project/specs/ticket-pdf/goldens/fixture-order.json';
const SHOW_CONTACT = 'lib/show-contact.ts';
const SHOW_OFFICE = '073 428 4398';
const PARKING_ANSWER = 'Yes, secure parking is available at the show and the symposium.';

// The resolvers read these; a developer's shell must not leak a reply-to into the comparison.
delete process.env.RESEND_REPLY_TO;
delete process.env.RESEND_REPLY_TO_NOS;

type Position = Record<string, unknown> & { bookingRef: string; slug: string };
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { orderReference: string; positions: Position[]; visit: Record<string, unknown> };

function tool(bin: string, args: string[]): string {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`missing tool: ${bin} (install poppler)`);
      process.exit(2);
    }
    throw error;
  }
}

async function pdfText(name: string, input: unknown): Promise<string> {
  const { buildTicketPdf } = await import('../../../lib/ticket-pdf.ts');
  mkdirSync(SANDBOX, { recursive: true });
  const path = `${SANDBOX}/${name}.pdf`;
  writeFileSync(path, await buildTicketPdf(input as never));
  return tool('pdftotext', ['-raw', path, '-']).replace(/\s+/g, ' ');
}

/** A real position built the way production builds it, so the check reads the code and not the fixture. */
async function productionPosition(ticketType: string, slug: string, bookingRef: string) {
  const data = await import('../../../lib/ticket-pdf-data.ts');
  const visit = data.buildTicketPdfVisit(null, null);
  const traits = new Map([[slug, { slug, name: ticketType, requiresDaySelection: false }]]);
  const [position] = data.toPdfPositions([{ bookingRef, attendeeName: 'Thandiwe Mokoena', ticketType: slug }], new Map(), visit, traits);
  return { position, visit };
}

const cmd = process.argv[2];

if (cmd === 'products') {
  // 19c / 19d: the cards and the PDF read TICKET_PRODUCTS; it must hold her dates and hours.
  const { TICKET_PRODUCTS } = await import('../../../lib/data/ticket-presentation.ts');
  const want: Array<[string, string, string | null]> = [
    ['symposium', 'Friday 24 September', '9am to 5pm'],
    ['wosa', 'Saturday 25 September', '9am to 5pm'],
    ['workshops', 'Schedule to follow', TICKET_PRODUCTS.workshops.meta], // 19e: "TBA", the pill stays right (only `when` is pinned)
    ['vip', 'Thursday 23 September', TICKET_PRODUCTS.vip.meta],
    ['sunset', 'Thursday 23 September', TICKET_PRODUCTS.sunset.meta],
  ];
  for (const [id, when, meta] of want) {
    const product = (TICKET_PRODUCTS as Record<string, { when: string; meta: string | null }>)[id];
    if (!product) fail(`TICKET_PRODUCTS.${id} missing`);
    else if (product.when !== when || product.meta !== meta) fail(`${id}: want "${when}" / ${JSON.stringify(meta)}, got "${product.when}" / ${JSON.stringify(product.meta)}`);
  }
  const text = readText('lib/ticket-pdf-schedule.ts');
  if (!/DATED_PRODUCT_KINDS[^=]*=\s*\[[^\]]*'programme'/.test(text)) fail("lib/ticket-pdf-schedule.ts: DATED_PRODUCT_KINDS must include 'programme'");
  finish('fe products');
} else if (cmd === 'pdf-dates') {
  // The rendered stub, through the production path (toPdfPositions), prints her date and hours.
  const base = { orderReference: fixture.orderReference, visit: (await import('../../../lib/ticket-pdf-data.ts')).buildTicketPdfVisit(null, null) };
  const cases: Array<[string, string, string, string, string]> = [
    ['symposium', 'National Orchid Show Symposium', 'saoc-symposium', 'SAOC-2027-S5YH8R2N6TBC', 'Friday 24 September'],
    ['wosa', 'WOSA Conference', 'wosa-conference', 'SAOC-2027-W0SA8R2N6TBC', 'Saturday 25 September'],
  ];
  for (const [name, type, slug, ref, date] of cases) {
    const { position } = await productionPosition(type, slug, ref);
    const text = await pdfText(`dates-${name}`, { ...base, positions: [position] });
    if (!text.includes(date)) fail(`${name}: the ticket must print "${date}"`);
    if (!text.includes('9am to 5pm')) fail(`${name}: the ticket must print "9am to 5pm"`);
    if (/Dates to follow/i.test(text)) fail(`${name}: "Dates to follow" must not reach the ticket`);
  }
  const { position: workshop } = await productionPosition('Workshop', 'workshops', 'SAOC-2027-W0RK8R2N6TBC');
  if (workshop?.schedule !== null) fail(`workshops must stay unconfirmed (the pill), got ${JSON.stringify(workshop?.schedule)}`);
  finish('fe pdf-dates');
} else if (cmd === 'show-office') {
  // 19h: the show office line carries her number, from one named constant.
  const contact = await import('../../../lib/show-contact.ts').catch(() => null);
  if (!contact) fail(`${SHOW_CONTACT} does not exist`);
  else if ((contact as { SHOW_OFFICE_PHONE?: string }).SHOW_OFFICE_PHONE !== SHOW_OFFICE) fail(`SHOW_OFFICE_PHONE must be "${SHOW_OFFICE}"`);
  const { buildTicketPdfVisit } = await import('../../../lib/ticket-pdf-data.ts');
  const visit = buildTicketPdfVisit(null, null);
  if (visit.showOffice !== SHOW_OFFICE) fail(`buildTicketPdfVisit().showOffice must be "${SHOW_OFFICE}", got ${JSON.stringify(visit.showOffice)}`);
  const text = await pdfText('show-office', { ...fixture, positions: [fixture.positions[0]], visit });
  if (!text.includes(`Show office ${SHOW_OFFICE}`)) fail(`the footer must read "Show office ${SHOW_OFFICE}"`);
  finish('fe show-office');
} else if (cmd === 'questions-email') {
  // 19h / Q-D11: the Questions line asks one named constant which address to print. Today's default
  // keeps the current address; flipping the constant to true prints the NOS address, nothing else changes.
  const contact = (await import('../../../lib/show-contact.ts').catch(() => null)) as
    | { SHOW_EMAIL_CONFIRMED?: boolean; resolveShowQuestionsEmail?: (confirmed?: boolean) => string }
    | null;
  if (!contact || typeof contact.resolveShowQuestionsEmail !== 'function') {
    fail(`${SHOW_CONTACT} must export resolveShowQuestionsEmail(confirmed?: boolean) and SHOW_EMAIL_CONFIRMED`);
  } else {
    const resolve = contact.resolveShowQuestionsEmail;
    if (resolve(false) !== 'info@saoc.co.za') fail(`resolveShowQuestionsEmail(false) must be info@saoc.co.za, got ${resolve(false)}`);
    if (resolve(true) !== 'show@saoc.co.za') fail(`resolveShowQuestionsEmail(true) must be show@saoc.co.za, got ${resolve(true)}`);
    if (resolve() !== resolve(contact.SHOW_EMAIL_CONFIRMED === true)) fail('resolveShowQuestionsEmail() must follow SHOW_EMAIL_CONFIRMED');
    const { buildTicketPdfVisit } = await import('../../../lib/ticket-pdf-data.ts');
    if (buildTicketPdfVisit(null, null).questionsEmail !== resolve()) fail('the ticket Questions line must come from resolveShowQuestionsEmail()');
  }
  const data = readText('lib/ticket-pdf-data.ts');
  if (/resolveReplyTo\s*\(/.test(data)) fail('lib/ticket-pdf-data.ts must not call resolveReplyTo() directly (it printed info@ by omitting the site)');
  if ((data.match(/resolveShowQuestionsEmail\s*\(/g) ?? []).length < 2) fail('both the loaded visit and the load-failure visit must use resolveShowQuestionsEmail()');
  finish('fe questions-email');
} else if (cmd === 'email-constant') {
  // Q-D11 default: the show address is not printed until the mailbox is confirmed.
  const text = readText(SHOW_CONTACT);
  if (!/export const SHOW_EMAIL_CONFIRMED\s*(?::\s*boolean\s*)?=\s*false\b/.test(text)) fail('SHOW_EMAIL_CONFIRMED must be exported and false until Q-D11 is answered (flip it with the answer)');
  if ((text.match(/SHOW_EMAIL_CONFIRMED\s*(?::\s*boolean\s*)?=/g) ?? []).length !== 1) fail('exactly one SHOW_EMAIL_CONFIRMED definition');
  finish('fe email-constant');
} else if (cmd === 'no-organiser') {
  // Q-D12 default: no organiser line is printed on the ticket.
  const text = await pdfText('no-organiser', fixture);
  if (/organiser/i.test(text)) fail('the ticket must not print an organiser line until Q-D12 is answered');
  // The visit's organiser value must not be drawn either: a sentinel in that field must not reach the page.
  const sentinel = 'Zzyzx Sentinel Organiser Value';
  const sentinelText = await pdfText('no-organiser-sentinel', { ...fixture, visit: { ...fixture.visit, organiser: sentinel } });
  if (sentinelText.includes('Zzyzx')) fail('the visit organiser value is drawn on the ticket (Q-D12 default: not printed)');
  finish('fe no-organiser');
} else if (cmd === 'email-parking') {
  // 19f: the order email carries a Parking row, filled only from a confirmed parking block.
  const { buildOrderVisit, EMPTY_ORDER_VISIT } = await import('../../../lib/order-visit-info.ts');
  const confirmed = buildOrderVisit(null, { parking: PARKING_ANSWER, confirmations: { parking: 'confirmed' } } as never) as unknown as Record<string, unknown>;
  const pending = buildOrderVisit(null, { parking: PARKING_ANSWER, confirmations: { parking: 'pending' } } as never) as unknown as Record<string, unknown>;
  if (confirmed.parking !== PARKING_ANSWER) fail(`a confirmed parking block must reach OrderConfirmationVisit.parking, got ${JSON.stringify(confirmed.parking)}`);
  if (pending.parking !== null) fail(`an unconfirmed parking block must stay null, got ${JSON.stringify(pending.parking)}`);
  if ((EMPTY_ORDER_VISIT as unknown as Record<string, unknown>).parking !== null) fail('EMPTY_ORDER_VISIT.parking must be null');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: OrderConfirmation } = await import('../../../emails/OrderConfirmation.tsx');
  const props = { buyerName: 'Thandiwe', positions: [{ bookingRef: 'SAOC-2027-S5YH8R2N6TBC', attendeeName: 'Thandiwe Mokoena', ticketTypeTitle: 'Weekend Pass', qrContentId: 'qr-1' }], recoveryUrl: null, testMode: false };
  const withParking = renderToStaticMarkup(React.createElement(OrderConfirmation, { ...props, visit: confirmed as never })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!/Parking/.test(withParking) || !withParking.includes(PARKING_ANSWER)) fail('the email must show a "Parking" row with the confirmed text');
  const withPill = renderToStaticMarkup(React.createElement(OrderConfirmation, { ...props, visit: pending as never })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!/Parking\s*:?\s*To be confirmed/.test(withPill)) fail('an unconfirmed parking block must print the "To be confirmed" pill in the Parking row');
  finish('fe email-parking');
} else if (cmd === 'pdf-parking') {
  // 19f: her parking sentence fits the PDF Parking cell (62 mm): every word is printed.
  const visit = { ...fixture.visit, venueParking: PARKING_ANSWER };
  const text = await pdfText('parking', { ...fixture, positions: [fixture.positions[0]], visit });
  for (const word of PARKING_ANSWER.split(' ')) if (!text.includes(word.replace(/[.,]$/, ''))) fail(`parking text lost "${word}"`);
  finish('fe pdf-parking');
} else {
  console.error('usage: fe.mts products|pdf-dates|show-office|questions-email|email-constant|no-organiser|email-parking|pdf-parking');
  process.exit(2);
}
