#!/usr/bin/env node
// ticket-confirmation-email-qr-fix F1 — the new lib/qr.ts export
// generateBookingRefQrPngBuffer must produce a genuinely decodable QR (same "real decoder, not
// PNG byte presence" bar F11's A3 already set for generateBookingRefQrDataUri), decoding the
// raw Buffer directly — no data-URI unwrap, since this function never produces one.
//
// DIMENSION THAT VARIES: the bookingRef value itself, same three-case shape as F11's A3, so a
// mutation that hardcodes/truncates the encoded payload rather than genuinely encoding whatever
// string it is given is caught the same way.
//
// DEFEATING MUTATIONS this check kills:
//   - encoding a DIFFERENT string than the one passed in (JSON-wrapped, truncated, hardcoded).
//   - returning a non-PNG buffer, or a data-URI-prefixed string mistakenly cast to Buffer.
//   - silently succeeding on an empty bookingRef instead of refusing.
//
// Run as: node --import tsx/esm contracts/checks/ticket-confirmation-email-qr-fix-f1/check-qr-png-buffer-roundtrip.mjs

import { PNG } from 'pngjs';
import jsQR from 'jsqr';

import { generateBookingRefQrPngBuffer } from '../../../lib/qr.ts';
import { generateBookingRef } from '../../../lib/booking-ref.ts';

const failures = [];

function decodeQrBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return { ok: false, reason: `not a Buffer (got ${typeof buffer})` };
  }
  let png;
  try {
    png = PNG.sync.read(buffer);
  } catch {
    return { ok: false, reason: 'not a valid PNG buffer' };
  }
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) return { ok: false, reason: 'jsQR could not locate/decode a QR symbol' };
  return { ok: true, decoded: result.data };
}

const cases = [
  { label: 'real generated booking ref #1', bookingRef: generateBookingRef() },
  { label: 'real generated booking ref #2 (must differ from #1)', bookingRef: generateBookingRef() },
  { label: 'short fixed test ref', bookingRef: 'SAOC-2027-TESTFIXED02' },
];

if (cases[0].bookingRef === cases[1].bookingRef) {
  failures.push('the two generateBookingRef() calls produced the SAME value — cannot prove per-value encoding with identical inputs.');
}

for (const { label, bookingRef } of cases) {
  const buffer = await generateBookingRefQrPngBuffer(bookingRef);
  const decodeResult = decodeQrBuffer(buffer);

  if (!decodeResult.ok) {
    failures.push(`[${label}] QR PNG buffer did not decode: ${decodeResult.reason}`);
    continue;
  }
  if (decodeResult.decoded !== bookingRef) {
    failures.push(
      `[${label}] decoded QR payload did not exactly match the input bookingRef ` +
        '(decoded=' + JSON.stringify(decodeResult.decoded) + ', expected=' + JSON.stringify(bookingRef) + ').'
    );
  }
}

// Negative control: an empty bookingRef must be REFUSED, not silently encoded.
{
  let threw = false;
  try {
    await generateBookingRefQrPngBuffer('');
  } catch {
    threw = true;
  }
  if (!threw) failures.push('generateBookingRefQrPngBuffer("") did not throw — an empty bookingRef must be refused, not silently encoded.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: generateBookingRefQrPngBuffer() produces a raw PNG Buffer that jsQR decodes back to ' +
    'the EXACT original bookingRef string, for multiple distinct real booking references, and ' +
    'refuses an empty bookingRef rather than silently encoding it.'
);
process.exit(0);
