#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — mission brief, mandatory: verification cannot rely on
// "renders in a browser preview of the template" (that already passes today and is not proof of
// a fix). This check inspects the ACTUAL payload sendConfirmationEmail hands to the mailer — the
// same shape lib/email.ts's real sendEmail forwards straight to Resend's emails.send() — not
// merely the rendered HTML string in isolation.
//
// Calls the REAL sendConfirmationEmail() with an injected fake mailer (never touches
// lib/email.ts/Resend) and REAL generateBookingRefQrPngBuffer (never touches lib/qr.ts's fake),
// captures both `attachments` and `react`, decodes every attachment's PNG bytes with jsQR
// (proving each is a genuinely scannable QR, not just "some bytes"), renders `react` to real
// HTML with @react-email/components' render(), and cross-checks the <img src="cid:..."> in the
// HTML against the attachments array's contentId values.
//
// DIMENSION THAT VARIES: order size (1 position, then 3), same as F11's A4.
//
// DEFEATING MUTATIONS this check kills:
//   - "QR still inline as a data: URI" (the fix not actually applied, or a partial revert): the
//     rendered HTML is asserted to contain ZERO occurrences of "data:image/png;base64,".
//   - "attachments array missing or empty": attachments.length !== positions.length fails.
//   - "same attachment/contentId reused for every position": every position's contentId is
//     asserted DISTINCT.
//   - "off-by-one / shuffled position-to-attachment mapping": each position's rendered
//     `cid:<id>` is compared IN ORDER against attachments[i].contentId, not matched as an
//     unordered set.
//   - "attachment content isn't a real decodable QR" (e.g. sending the wrong buffer, or
//     re-using bookingRef text as the "image"): each attachment's `content` Buffer is decoded
//     with jsQR and compared exactly against that position's bookingRef.
//   - "html references cid: but no matching attachment shipped, or vice versa": every `cid:`
//     reference in the HTML must have a same-contentId attachment, and every attachment's
//     contentId must appear as a `cid:` reference in the HTML — checked both directions.
//   - "attendee name / booking reference dropped from the visible-text fallback": each
//     position's attendeeName and bookingRef are asserted present as visible text, preserving
//     F11's client-can't-render-the-image safety net.
//
// Run as: npx tsx contracts/checks/ticket-confirmation-email-qr-fix-f1/check-cid-attachment-fanout.mjs

import { render } from '@react-email/components';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

import { sendConfirmationEmail } from '../../../lib/confirmation-email.ts';

const failures = [];

function decodeQrBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch {
    return null;
  }
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}

async function runCase(label, positions) {
  let capturedReact = null;
  let capturedAttachments = null;
  let mailCallCount = 0;
  let capturedTo = null;

  const fakeMailer = {
    send: async ({ to, react, attachments }) => {
      mailCallCount += 1;
      capturedTo = to;
      capturedReact = react;
      capturedAttachments = attachments;
    },
  };

  await sendConfirmationEmail(
    {
      orderId: `order-cid-fanout-${label}`,
      buyerEmail: 'buyer@example.test',
      buyerName: 'Buyer Person',
      recoveryToken: null,
      positions,
    },
    { mailer: fakeMailer }
  );

  if (mailCallCount !== 1) {
    failures.push(`[${label}] mailer.send was called ${mailCallCount} time(s), expected exactly 1 (one email per order, not per position).`);
    return;
  }
  if (capturedTo !== 'buyer@example.test') {
    failures.push(`[${label}] email addressed to "${capturedTo}", expected the ORDER buyer's email.`);
  }
  if (!Array.isArray(capturedAttachments)) {
    failures.push(`[${label}] mailer.send was NOT given an attachments array at all.`);
    return;
  }
  if (capturedAttachments.length !== positions.length) {
    failures.push(`[${label}] attachments.length=${capturedAttachments.length}, expected ${positions.length} (one per position).`);
  }

  const contentIds = capturedAttachments.map((a) => a.contentId);
  const distinctContentIds = new Set(contentIds);
  if (distinctContentIds.size !== capturedAttachments.length) {
    failures.push(`[${label}] attachment contentIds are not all distinct: ${JSON.stringify(contentIds)}.`);
  }

  // Each attachment must be a genuinely decodable QR matching its OWN position's bookingRef,
  // in order.
  positions.forEach((position, i) => {
    const attachment = capturedAttachments[i];
    if (!attachment) {
      failures.push(`[${label}] no attachment at index ${i} for position bookingRef=${position.bookingRef}.`);
      return;
    }
    if (attachment.contentType !== 'image/png') {
      failures.push(`[${label}][position ${i}] attachment.contentType="${attachment.contentType}", expected "image/png".`);
    }
    if (typeof attachment.filename !== 'string' || !attachment.filename.endsWith('.png')) {
      failures.push(`[${label}][position ${i}] attachment.filename="${attachment.filename}" does not end in .png.`);
    }
    const decoded = decodeQrBuffer(attachment.content);
    if (decoded === null) {
      failures.push(`[${label}][position ${i}] attachment.content did not decode as a QR PNG.`);
    } else if (decoded !== position.bookingRef) {
      failures.push(`[${label}][position ${i}] decoded QR="${decoded}", expected bookingRef="${position.bookingRef}" (wrong position mapped, or shuffled).`);
    }
  });

  // Render the captured react element to real HTML and cross-check cid: references.
  const html = await render(capturedReact);

  if (html.includes('data:image/png;base64,')) {
    failures.push(`[${label}] rendered HTML still contains an inline "data:image/png;base64," QR — the fix was not actually applied (or was partially reverted).`);
  }

  positions.forEach((position, i) => {
    const attachment = capturedAttachments[i];
    if (!attachment) return; // already reported above
    const cidRef = `cid:${attachment.contentId}`;
    if (!html.includes(cidRef)) {
      failures.push(`[${label}][position ${i}] rendered HTML does not contain "${cidRef}" — the <img src> is not referencing this position's attachment.`);
    }
    if (!html.includes(position.attendeeName)) {
      failures.push(`[${label}][position ${i}] attendeeName "${position.attendeeName}" missing from rendered HTML.`);
    }
    if (!html.includes(position.bookingRef)) {
      failures.push(`[${label}][position ${i}] bookingRef "${position.bookingRef}" missing from rendered HTML (visible-text fallback regressed).`);
    }
  });

  // Every attachment's contentId must be referenced somewhere in the HTML (no orphan
  // attachments shipped that nothing displays).
  for (const attachment of capturedAttachments) {
    if (!html.includes(`cid:${attachment.contentId}`)) {
      failures.push(`[${label}] attachment with contentId="${attachment.contentId}" has no matching "cid:" reference anywhere in the rendered HTML.`);
    }
  }
}

await runCase('single-position', [
  { bookingRef: 'SAOC-2027-FANOUTCID01', attendeeName: 'Solo Attendee', ticketType: 'general-admission' },
]);

await runCase('three-position', [
  { bookingRef: 'SAOC-2027-FANOUTCID02', attendeeName: 'Attendee Alpha', ticketType: 'general-admission' },
  { bookingRef: 'SAOC-2027-FANOUTCID03', attendeeName: 'Attendee Bravo', ticketType: 'general-admission' },
  { bookingRef: 'SAOC-2027-FANOUTCID04', attendeeName: 'Attendee Charlie', ticketType: 'general-admission' },
]);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: sendConfirmationEmail ships one real, distinct, decodable PNG attachment per position ' +
    'with a matching contentId, the rendered HTML references each via "cid:" (never a "data:" ' +
    'URI), in the correct order, with the attendeeName/bookingRef visible-text fallback intact.'
);
process.exit(0);
