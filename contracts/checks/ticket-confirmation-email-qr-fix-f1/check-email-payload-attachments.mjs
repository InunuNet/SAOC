#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — proves lib/email.ts's buildEmailPayload threads
// `attachments` through UNCHANGED into the exact object shape sendEmail hands to
// getResend().emails.send() — the real Resend API call — without needing a live network call or
// a Resend API key. This is the strongest available proxy for "what the actual email payload
// Resend would send contains" per the mission's explicit instruction not to rely on the
// rendered-HTML string alone.
//
// buildEmailPayload is a pure function (no Resend client construction happens inside it — see
// lib/email.ts: getResend() is only called inside sendEmail), so this check imports and calls it
// DIRECTLY, with zero mocking of the Resend SDK required.
//
// DEFEATING MUTATIONS this check kills:
//   - attachments silently dropped/renamed on the way into the built payload.
//   - attachment field names diverging from Resend's own Attachment interface
//     (content/filename/contentType/contentId) — a renamed field would compile (TS checks that
//     separately in A2) but this proves the RUNTIME object also carries the right keys.
//   - an `attachments: []` empty array being injected for callers that omit it entirely (every
//     existing non-QR email caller must see byte-identical payloads to before this fix).
//   - the attachments array being cloned/mutated (e.g. stripping the Buffer down to a string)
//     rather than passed through as-is.
//
// Run as: npx tsx contracts/checks/ticket-confirmation-email-qr-fix-f1/check-email-payload-attachments.mjs

import { buildEmailPayload } from '../../../lib/email.ts';

const failures = [];

const fakeReact = { type: 'div', props: {}, key: null };
const attachment = {
  content: Buffer.from('fake-png-bytes'),
  filename: 'qr-SAOC-2027-PAYLOAD01.png',
  contentType: 'image/png',
  contentId: 'qr-SAOC-2027-PAYLOAD01',
};

// Case 1: attachments provided — must appear verbatim in the built payload.
{
  const payload = buildEmailPayload({
    to: 'buyer@example.test',
    subject: 'Test subject',
    react: fakeReact,
    from: 'SAOC Tickets <tickets@tickets.saoc.co.za>',
    attachments: [attachment],
  });

  if (!Array.isArray(payload.attachments) || payload.attachments.length !== 1) {
    failures.push('buildEmailPayload with attachments did not return a 1-element attachments array.');
  } else {
    const got = payload.attachments[0];
    if (got.content !== attachment.content) failures.push('attachment.content was not passed through as the SAME Buffer reference.');
    if (got.filename !== attachment.filename) failures.push(`attachment.filename mismatch: got "${got.filename}".`);
    if (got.contentType !== attachment.contentType) failures.push(`attachment.contentType mismatch: got "${got.contentType}".`);
    if (got.contentId !== attachment.contentId) failures.push(`attachment.contentId mismatch: got "${got.contentId}".`);
  }

  if (payload.to !== 'buyer@example.test' || payload.subject !== 'Test subject') {
    failures.push('buildEmailPayload with attachments altered unrelated to/subject fields.');
  }
}

// Case 2: attachments omitted — every existing non-QR caller (ContactConfirmation,
// VendorApprovalConfirmation, etc.) must see an IDENTICAL payload shape to before this fix, no
// injected empty array.
{
  const payload = buildEmailPayload({
    to: 'someone@example.test',
    subject: 'No attachments here',
    react: fakeReact,
    from: 'SAOC <noreply@forms.saoc.co.za>',
  });

  if ('attachments' in payload && payload.attachments !== undefined) {
    failures.push(`buildEmailPayload without attachments injected a non-undefined attachments field: ${JSON.stringify(payload.attachments)}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: buildEmailPayload threads attachments verbatim into the payload Resend receives, and injects nothing when omitted.');
process.exit(0);
