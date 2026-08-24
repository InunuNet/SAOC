// ticket-confirmation-email-qr-fix F1 — compiler-driven (not source-grep) proof of the new and
// extended exported shapes lib/qr.ts, lib/email.ts, lib/confirmation-email.ts and
// emails/OrderConfirmation.tsx must carry after the CID-attachment fix. Run via its own scoped
// tsconfig (see that file) because the root tsconfig.json excludes `contracts/` from
// `pnpm type-check`.
//
// Proven here, not reachable by the runtime checks:
//   1. generateBookingRefQrPngBuffer's signature is (bookingRef: string) => Promise<Buffer> —
//      distinct from, and additional to, generateBookingRefQrDataUri (still string-returning,
//      still present, still the default for non-email QR consumers).
//   2. lib/email.ts's EmailAttachment shape (content: Buffer, filename: string,
//      contentType: string, contentId: string) and that both buildEmailPayload and sendEmail
//      accept an optional `attachments` param without one being required (every existing
//      non-QR caller must still compile with zero changes).
//   3. SendConfirmationEmailDeps carries generateQrPngBuffer alongside the pre-existing mailer/
//      siteUrl members (generateQrDataUri is intentionally GONE from this interface — the email
//      path no longer generates a data URI at all, only a PNG buffer).
//   4. ConfirmationEmailMailer.send's argument shape accepts an optional `attachments` array,
//      still satisfied by a fake object with zero lib/email.ts involvement.
//   5. OrderConfirmationProps requires `qrContentId` (not `qrDataUri`) on every position — a
//      template or call site that still plumbs qrDataUri through would fail to compile here.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticket-confirmation-email-qr-fix-f1/tsconfig.typecheck.json

import { generateBookingRefQrPngBuffer, generateBookingRefQrDataUri } from '../../../../lib/qr';
import type { EmailAttachment } from '../../../../lib/email';
import { buildEmailPayload, sendEmail } from '../../../../lib/email';

import type {
  ConfirmationEmailMailer,
  SendConfirmationEmailDeps,
  SendConfirmationEmailInput,
} from '../../../../lib/confirmation-email';
import { sendConfirmationEmail } from '../../../../lib/confirmation-email';

import type { OrderConfirmationProps } from '../../../../emails/OrderConfirmation';
import OrderConfirmation from '../../../../emails/OrderConfirmation';

// --- lib/qr.ts ---

async function callGenerateQrPngBuffer(): Promise<Buffer> {
  const buffer: Buffer = await generateBookingRefQrPngBuffer('SAOC-2027-TYPECHECK01');
  return buffer;
}
void callGenerateQrPngBuffer;

// generateBookingRefQrDataUri must still exist, still string-returning — non-email consumers
// (lib/orders.ts, the confirmation page) are untouched by this feature.
async function callGenerateQrDataUri(): Promise<string> {
  const dataUri: string = await generateBookingRefQrDataUri('SAOC-2027-TYPECHECK01');
  return dataUri;
}
void callGenerateQrDataUri;

// --- lib/email.ts ---

const fakeAttachment: EmailAttachment = {
  content: Buffer.from('fake-png-bytes'),
  filename: 'qr-SAOC-2027-TYPECHECK01.png',
  contentType: 'image/png',
  contentId: 'qr-SAOC-2027-TYPECHECK01',
};

const payloadWithAttachments = buildEmailPayload({
  to: 'buyer@example.test',
  subject: 'Test',
  react: OrderConfirmation({
    buyerName: 'Test Buyer',
    positions: [],
    recoveryUrl: null,
  }),
  from: 'SAOC Tickets <tickets@tickets.saoc.co.za>',
  attachments: [fakeAttachment],
});
void payloadWithAttachments;

// Omitting attachments entirely must still compile — every existing non-QR email caller.
const payloadWithoutAttachments = buildEmailPayload({
  to: 'buyer@example.test',
  subject: 'Test',
  react: OrderConfirmation({ buyerName: 'Test Buyer', positions: [], recoveryUrl: null }),
  from: 'SAOC Tickets <tickets@tickets.saoc.co.za>',
});
void payloadWithoutAttachments;

async function callSendEmailWithAttachments(): Promise<void> {
  return sendEmail({
    to: 'buyer@example.test',
    subject: 'Test',
    react: OrderConfirmation({ buyerName: 'Test Buyer', positions: [], recoveryUrl: null }),
    from: 'SAOC Tickets <tickets@tickets.saoc.co.za>',
    attachments: [fakeAttachment],
  });
}
void callSendEmailWithAttachments;

// --- lib/confirmation-email.ts ---

const emailInput: SendConfirmationEmailInput = {
  orderId: 'order-typecheck-01',
  buyerEmail: 'buyer@example.com',
  buyerName: 'Test Buyer',
  recoveryToken: null,
  positions: [
    { bookingRef: 'SAOC-2027-TYPECHECK01', attendeeName: 'Attendee One', ticketType: 'general-admission' },
    { bookingRef: 'SAOC-2027-TYPECHECK02', attendeeName: 'Attendee Two', ticketType: 'general-admission' },
  ],
};

// A ConfirmationEmailMailer-shaped fake, satisfying deps.mailer without touching lib/email.ts.
const fakeMailer: ConfirmationEmailMailer = {
  send: async (_args: {
    to: string;
    subject: string;
    react: import('react').ReactElement;
    attachments?: EmailAttachment[];
  }) => {
    /* no-op — type-shape proof only */
  },
};

const deps: SendConfirmationEmailDeps = {
  mailer: fakeMailer,
  generateQrPngBuffer: async (bookingRef: string) => Buffer.from(`FAKE-${bookingRef}`),
  siteUrl: 'https://example.test',
};

async function callSendConfirmation() {
  return sendConfirmationEmail(emailInput, deps);
}
void callSendConfirmation;

async function callSendConfirmationWithDefaults() {
  // Omitting deps entirely must still compile — the pinned ITN route calls it this way.
  return sendConfirmationEmail(emailInput);
}
void callSendConfirmationWithDefaults;

// --- emails/OrderConfirmation.tsx ---

const props: OrderConfirmationProps = {
  buyerName: 'Test Buyer',
  positions: [
    {
      bookingRef: 'SAOC-2027-TYPECHECK01',
      attendeeName: 'Attendee One',
      ticketType: 'general-admission',
      qrContentId: 'qr-SAOC-2027-TYPECHECK01',
    },
  ],
  recoveryUrl: null,
};

function renderElement() {
  return OrderConfirmation(props);
}
void renderElement;
