// F11 (ticketing-foundation) — compiler-driven (not source-grep) proof of the new and extended
// exported shapes lib/qr.ts, lib/recovery-url.ts, lib/confirmation-email.ts and
// emails/OrderConfirmation.tsx must carry. Run via its own scoped tsconfig (see that file)
// because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Three things proven here that the runtime checks (A3-A8) cannot see:
//   1. generateBookingRefQrDataUri's signature is (bookingRef: string) => Promise<string> — the
//      exact shape sendConfirmationEmail's default deps.generateQrDataUri must satisfy, and the
//      exact shape a caller may substitute a fake for.
//   2. SendConfirmationEmailDeps's three optional members (mailer, generateQrDataUri, siteUrl)
//      are all independently overridable — a ConfirmationEmailMailer-shaped fake object is
//      accepted as deps.mailer without needing to satisfy anything from lib/email.ts.
//   3. OrderConfirmation's props type requires `positions` to carry `qrDataUri` alongside the
//      existing bookingRef/attendeeName/ticketType fields — a template that forgot to plumb the
//      QR through would fail to compile here, before any runtime check ever renders it.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f11-qr-confirmation-email/tsconfig.typecheck.json

import { generateBookingRefQrDataUri } from '../../../../lib/qr';
import { buildRecoveryUrl } from '../../../../lib/recovery-url';

import type {
  ConfirmationEmailMailer,
  SendConfirmationEmailDeps,
  SendConfirmationEmailInput,
} from '../../../../lib/confirmation-email';
import { sendConfirmationEmail } from '../../../../lib/confirmation-email';

import type { OrderConfirmationProps } from '../../../../emails/OrderConfirmation';
import OrderConfirmation from '../../../../emails/OrderConfirmation';

// --- lib/qr.ts ---

async function callGenerateQr(): Promise<string> {
  const dataUri: string = await generateBookingRefQrDataUri('SAOC-2027-TYPECHECK01');
  return dataUri;
}
void callGenerateQr;

// --- lib/recovery-url.ts ---

const withToken: string | null = buildRecoveryUrl('fake-payload.fake-signature', 'https://example.test');
const withoutToken: string | null = buildRecoveryUrl(null, 'https://example.test');
void withToken;
void withoutToken;

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
  send: async (_args: { to: string; subject: string; react: import('react').ReactElement }) => {
    /* no-op — type-shape proof only */
  },
};

const deps: SendConfirmationEmailDeps = {
  mailer: fakeMailer,
  generateQrDataUri: async (bookingRef: string) => `data:image/png;base64,FAKE-${bookingRef}`,
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
      qrDataUri: 'data:image/png;base64,FAKE',
    },
  ],
  recoveryUrl: null,
};

function renderElement() {
  return OrderConfirmation(props);
}
void renderElement;
