import type { ReactElement } from 'react';

import { generateBookingRefQrPngBuffer } from '@/lib/qr';
import { buildRecoveryUrl } from '@/lib/recovery-url';
import { buildTicketPdf as renderTicketPdf, type TicketPdfPosition } from '@/lib/ticket-pdf';
import { loadChosenDays, loadTicketPdfVisit, toPdfPositions } from '@/lib/ticket-pdf-data';
import { sendEmail, TICKETS_FROM_ADDRESS, type EmailAttachment } from '@/lib/email';
import OrderConfirmation, { type OrderConfirmationPosition } from '@/emails/OrderConfirmation';
import type { TicketType } from '@/types/index';

/**
 * F10/F11 (ticketing-foundation) — the post-purchase confirmation email.
 *
 * F10 owns the hookup call site (strictly after the order/position transaction commits, see
 * app/api/tickets/itn/route.ts step 5) and the input shape below. F11 replaced F10's original
 * minimal stub (which only logged the payload's shape and never called Resend) with the real
 * implementation: sendConfirmationEmail() below generates one QR per position via
 * `lib/qr.ts:generateBookingRefQrDataUri`, resolves the F6 recovery deep link, and sends one
 * real email per order through `lib/email.ts`'s `sendEmail` (Resend), rendering
 * `emails/OrderConfirmation.tsx`. See contracts/golden/ticketing-f10-itn-repin/README.md "The
 * F10/F11 boundary" for why the call site and input shape are pinned separately from the body.
 */

/** Site URL fallback, matching app/api/tickets/checkout/route.ts's own DEFAULT_SITE_URL
 *  convention — duplicated locally rather than imported (that fallback is private to a route
 *  handler module, and SITE_URL is only available at Firebase App Hosting runtime, not build
 *  time, so it must be read inside the function body, not hoisted to module scope). */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env['SITE_URL'] ?? DEFAULT_SITE_URL;
}

export interface ConfirmationEmailPosition {
  bookingRef: string;
  attendeeName: string;
  ticketType: TicketType;
}

export interface SendConfirmationEmailInput {
  orderId: string;
  buyerEmail: string;
  buyerName: string;
  positions: ConfirmationEmailPosition[];
  recoveryToken: string | null;
  /** Order reference (`m_payment_id`): names the PDF file and prints in its footer. Optional. */
  orderReference?: string;
}

export interface TicketPdfEmailInput {
  orderReference: string | null;
  positions: TicketPdfPosition[];
}

/** Deliberately narrow — matches only what lib/email.ts's real `sendEmail` already satisfies
 *  structurally, same injectable-fake pattern as F8/F10's `deps.db`, so a fixture mailer needs
 *  zero adapter code and never touches Resend. */
export interface ConfirmationEmailMailer {
  send(args: {
    to: string;
    subject: string;
    react: ReactElement;
    attachments?: EmailAttachment[];
  }): Promise<void>;
}

export interface SendConfirmationEmailDeps {
  mailer?: ConfirmationEmailMailer;
  generateQrPngBuffer?: (bookingRef: string) => Promise<Buffer>;
  siteUrl?: string;
  /** Injectable for tests; the default loads the visit info and renders the real PDF. */
  buildTicketPdf?: (input: TicketPdfEmailInput) => Promise<Uint8Array>;
}

async function defaultBuildTicketPdf(input: TicketPdfEmailInput): Promise<Uint8Array> {
  const [visit, chosenDays] = await Promise.all([
    loadTicketPdfVisit(),
    loadChosenDays(input.orderReference),
  ]);
  return renderTicketPdf({
    orderReference: input.orderReference,
    positions: toPdfPositions(input.positions, chosenDays, visit),
    visit,
  });
}

/** Never throws: any failure (sync or async) is logged and yields null so the email still sends. */
async function buildPdfAttachment(
  input: SendConfirmationEmailInput,
  build: (pdfInput: TicketPdfEmailInput) => Promise<Uint8Array>
): Promise<EmailAttachment | null> {
  try {
    const bytes = await build({
      orderReference: input.orderReference ?? null,
      positions: input.positions.map(({ bookingRef, attendeeName, ticketType }) => ({
        bookingRef,
        attendeeName,
        ticketType,
      })),
    });
    const stem = (input.orderReference ?? input.positions[0].bookingRef).replace(/[^A-Za-z0-9-]/g, '-');
    return {
      content: Buffer.from(bytes),
      filename: `saoc-ticket-${stem}.pdf`,
      contentType: 'application/pdf',
    };
  } catch (error) {
    console.error('[confirmation-email] ticket PDF generation failed; sending without attachment', {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * F11 — generates one QR per position (keyed on that position's OWN bookingRef), resolves the
 * F6 recovery deep link, and sends exactly ONE email per order to the buyer.
 *
 * Refuses synchronously, before any QR generation or mailer call, when `positions` is empty —
 * a defensive guard for spec §6's forward-compatible multi-position design, not reachable via
 * F10's real call site today (see the golden README's A5 section).
 *
 * Does NOT catch/swallow a failure from `generateQrDataUri` or `mailer.send` — propagates the
 * original error unchanged. Isolation from the payment path is exclusively
 * `deliverConfirmationEmailAfterCommit`'s job (already proven by F10's A7).
 *
 * The ticket PDF is best-effort (ticket-pdf D3): generation has its own try/catch, a failure is
 * logged by operation and error type only, and the email still sends without the attachment.
 *
 * NEVER log recoveryToken's value, a signature, a passphrase, a booking reference or any
 * credential — this project has an absolute rule against credential exposure in logs.
 */
export async function sendConfirmationEmail(
  input: SendConfirmationEmailInput,
  deps: SendConfirmationEmailDeps = {}
): Promise<void> {
  if (input.positions.length === 0) {
    throw new Error('sendConfirmationEmail: an order must have at least one position');
  }

  const mailer = deps.mailer ?? { send: sendEmail };
  const generateQrPngBuffer = deps.generateQrPngBuffer ?? generateBookingRefQrPngBuffer;
  const siteUrl = deps.siteUrl ?? resolveSiteUrl();

  const positions: OrderConfirmationPosition[] = [];
  const attachments: EmailAttachment[] = [];
  for (const position of input.positions) {
    const buffer = await generateQrPngBuffer(position.bookingRef);
    const contentId = `qr-${position.bookingRef}`;
    attachments.push({
      content: buffer,
      filename: `qr-${position.bookingRef}.png`,
      contentType: 'image/png',
      contentId,
    });
    positions.push({
      bookingRef: position.bookingRef,
      attendeeName: position.attendeeName,
      ticketType: position.ticketType,
      qrContentId: contentId,
    });
  }

  const pdfAttachment = await buildPdfAttachment(input, deps.buildTicketPdf ?? defaultBuildTicketPdf);
  if (pdfAttachment) attachments.push(pdfAttachment);

  const recoveryUrl = buildRecoveryUrl(input.recoveryToken, siteUrl);

  await mailer.send({
    to: input.buyerEmail,
    subject: 'Your National Orchid Show order is confirmed',
    react: OrderConfirmation({ buyerName: input.buyerName, positions, recoveryUrl }),
    from: TICKETS_FROM_ADDRESS,
    attachments,
  });
}

/**
 * Isolation wrapper the pinned ITN route calls strictly AFTER its order/position transaction
 * commits. Awaits `send()`; on ANY failure — a synchronous throw or an async rejection —
 * reports the real error to `onError` and resolves normally. NEVER rethrows.
 *
 * This is the load-bearing "money is more important than a delivery receipt" property: a
 * failed confirmation email must never roll back, retry, or put an already-committed payment
 * at risk.
 */
export async function deliverConfirmationEmailAfterCommit(
  send: () => Promise<void>,
  onError: (error: unknown) => void
): Promise<void> {
  try {
    await send();
  } catch (error) {
    onError(error);
  }
}
