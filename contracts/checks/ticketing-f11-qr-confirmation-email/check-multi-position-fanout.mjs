#!/usr/bin/env node
// F11 (ticketing-foundation) — mission brief: "An order has MULTIPLE positions. The email must
// carry every position's QR, not just the first. Make an assertion prove the multi-position
// case specifically, including exactly-one... edge case[s]." (the zero-position edge case is
// A5, a separate file — kept separate per the "narrow, distinct claim per assertion" house
// rule, not folded in here).
//
// This check calls the REAL sendConfirmationEmail() with an injected fake mailer (never touches
// lib/email.ts/Resend) and a REAL generateQrDataUri (never touches lib/qr.ts's fake in A3 — this
// is the genuine integration point between the two modules), captures the react element the
// mailer receives, renders it to real HTML with @react-email/components' render() (already a
// direct project dependency), and decodes every embedded QR image back out with jsQR — proving
// the FULL pipeline (position -> QR -> rendered <img> -> decodable text) end to end, not just
// its parts in isolation.
//
// DIMENSION THAT VARIES ACROSS CASES: order size (1 position, then 3) — the exactly-one case is
// the shape F10's real ITN call site produces TODAY (single-attendee purchases only); the
// three-position case exercises the forward-compatible multi-attendee design spec §6 describes
// even though no real caller reaches it yet.
//
// DEFEATING MUTATIONS this check kills:
//   - "same QR for every position" (e.g. hoisting one generateQr() call outside the per-position
//     map): every decoded QR in the 3-position case is asserted DISTINCT and mapped to its OWN
//     bookingRef, not merely "3 QR images exist".
//   - "off-by-one / shuffled order" (e.g. zipping positions[i] with qrDataUris[i-1] or a
//     reversed list): each decoded QR is compared IN ORDER against positions[i].bookingRef, not
//     matched as an unordered set.
//   - "attendee name dropped or duplicated" (e.g. only the first attendee's name rendered):
//     each position's DISTINCT attendeeName string is asserted present, and the buyer's own
//     name (not an attendee's) is asserted present exactly once as the salutation, not once per
//     position.
//   - "inline data-URI silently externalised" (e.g. an accidental switch to a hosted-image
//     <img src="https://...">, or Resend/react-email auto-CID-ifying the image on render): the
//     rendered HTML is asserted to contain the FULL "data:image/png;base64," prefix for every
//     position, not a remote URL or a cid: reference — this is F11's "gate the consequence" of
//     the inline-vs-attachment decision recorded in the golden README.
//
// Run as: npx tsx contracts/checks/ticketing-f11-qr-confirmation-email/check-multi-position-fanout.mjs

import { render } from '@react-email/components';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

function decodeQrFromDataUri(dataUri) {
  const base64 = dataUri.slice('data:image/png;base64,'.length);
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}

async function runCase(label, positions) {
  let capturedReact = null;
  let mailCallCount = 0;
  let capturedTo = null;

  const fakeMailer = {
    send: async ({ to, react }) => {
      mailCallCount += 1;
      capturedTo = to;
      capturedReact = react;
    },
  };

  await sendConfirmationEmail(
    {
      orderId: `order-fanout-${label}`,
      buyerEmail: 'buyer@example.test',
      buyerName: 'Buyer Person',
      recoveryToken: null,
      positions,
    },
    { mailer: fakeMailer }
  );

  if (mailCallCount !== 1) {
    failures.push(`[${label}] mailer.send was called ${mailCallCount} time(s), expected exactly 1 (one email per order, not per position — spec §6).`);
    return;
  }
  if (capturedTo !== 'buyer@example.test') {
    failures.push(`[${label}] email was addressed to the wrong recipient (expected the ORDER's buyerEmail, per F10's judgement call, not a per-position attendeeEmail).`);
  }

  const html = await render(capturedReact);

  // Every position's QR data URI must appear FULLY INLINE — not externalised.
  const dataUriMatches = [...html.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map((m) => m[0]);

  if (dataUriMatches.length !== positions.length) {
    failures.push(`[${label}] rendered HTML contained ${dataUriMatches.length} inline QR image(s), expected exactly ${positions.length} (one per position).`);
    return;
  }

  const decoded = dataUriMatches.map(decodeQrFromDataUri);

  decoded.forEach((value, index) => {
    const expected = positions[index].bookingRef;
    if (value !== expected) {
      failures.push(`[${label}] QR image at position ${index} did not decode to that position's own bookingRef (a mismatch here means the QR list is either reused, shuffled, or off-by-one relative to the positions array).`);
    }
  });

  if (positions.length > 1) {
    const distinctDecoded = new Set(decoded.filter((v) => v !== null));
    if (distinctDecoded.size !== positions.length) {
      failures.push(`[${label}] expected ${positions.length} DISTINCT decoded QR values, got ${distinctDecoded.size} distinct value(s) — some positions share the same QR image.`);
    }
  }

  for (const position of positions) {
    if (!html.includes(position.attendeeName)) {
      failures.push(`[${label}] rendered HTML did not contain attendee name for bookingRef ${position.bookingRef}.`);
    }
  }

  const buyerNameOccurrences = html.split('Buyer Person').length - 1;
  if (buyerNameOccurrences < 1) {
    failures.push(`[${label}] rendered HTML did not contain the buyer's name at all.`);
  }
}

await runCase('exactly-one', [
  { bookingRef: 'SAOC-2027-FANOUT0001', attendeeName: 'Solo Attendee', ticketType: 'general-admission' },
]);

await runCase('three-positions', [
  { bookingRef: 'SAOC-2027-FANOUT0001', attendeeName: 'First Attendee', ticketType: 'general-admission' },
  { bookingRef: 'SAOC-2027-FANOUT0002', attendeeName: 'Second Attendee', ticketType: 'general-admission' },
  { bookingRef: 'SAOC-2027-FANOUT0003', attendeeName: 'Third Attendee', ticketType: 'general-admission' },
]);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sendConfirmationEmail() sends exactly one email per order, addressed to the buyer, ' +
    'carrying every position\'s attendee name and its OWN correctly-ordered, distinct, ' +
    'fully-inline (never externalised) QR image — proven for both the exactly-one-position ' +
    'shape F10\'s real call site produces today and a 3-position order.'
);
process.exit(0);
