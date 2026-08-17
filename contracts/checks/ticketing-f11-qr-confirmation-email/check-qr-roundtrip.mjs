#!/usr/bin/env node
// F11 (ticketing-foundation) — QR generation must be genuinely decodable, not merely "a PNG
// exists". The mission Done criterion is "QR generation produces valid 2D codes decodable by a
// standard barcode scanner" — this check decodes the real output with jsQR (a real, standard
// QR decoder, not a stub) rather than asserting anything about PNG byte presence or length.
//
// pngjs is used ONLY here, to turn the generated PNG buffer into raw pixel data jsQR can read —
// it is a transitive dependency of the already-declared `qrcode` package (verified resolvable
// from the project root at architect time: `node -e "require.resolve('pngjs')"`). If pnpm's
// hoisting ever changes and this stops resolving, `pnpm add -D pngjs` makes it a direct
// devDependency; that is a one-line fix, not a redesign.
//
// DIMENSION THAT VARIES ACROSS CASES: the bookingRef value itself — three shapes are tried (a
// real generateBookingRef() output, a short fixed string, and a second real generated ref,
// distinct from the first) to catch a mutation that hardcodes or truncates the encoded payload
// rather than genuinely encoding whatever string it is given.
//
// DEFEATING MUTATION this check kills: encoding a DIFFERENT string than the one passed in (e.g.
// a JSON-wrapped `{bookingRef: "..."}` object, a truncated prefix, or a swapped/hardcoded test
// value) — every case's decoded text is compared EXACTLY against the original input, not
// merely checked for "some non-empty string decoded".
//
// WHAT THIS DOES NOT PROVE, named explicitly: that every real-world phone camera or dedicated
// barcode scanner app can read the rendered PNG at whatever physical size an email client
// displays it — jsQR is a software decoder operating on the exact pixel buffer this module
// produces, which is the strongest offline proxy available, not a physical-device test. That is
// F12's job (human purchase-and-scan proof on the deployed host), not F11's.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f11-qr-confirmation-email/check-qr-roundtrip.mjs

import { PNG } from 'pngjs';
import jsQR from 'jsqr';

import { generateBookingRefQrDataUri } from '../../../lib/qr.ts';
import { generateBookingRef } from '../../../lib/booking-ref.ts';

const failures = [];

function decodeDataUri(dataUri) {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/png;base64,')) {
    return { ok: false, reason: 'not a data:image/png;base64, URI' };
  }
  const base64 = dataUri.slice('data:image/png;base64,'.length);
  let buf;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    return { ok: false, reason: 'base64 segment did not decode' };
  }
  let png;
  try {
    png = PNG.sync.read(buf);
  } catch {
    return { ok: false, reason: 'not a valid PNG' };
  }
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) return { ok: false, reason: 'jsQR could not locate/decode a QR symbol' };
  return { ok: true, decoded: result.data };
}

const cases = [
  { label: 'real generated booking ref #1', bookingRef: generateBookingRef() },
  { label: 'real generated booking ref #2 (must differ from #1)', bookingRef: generateBookingRef() },
  { label: 'short fixed test ref', bookingRef: 'SAOC-2027-TESTFIXED01' },
];

if (cases[0].bookingRef === cases[1].bookingRef) {
  failures.push('the two generateBookingRef() calls produced the SAME value — cannot prove per-value encoding with identical inputs; this indicates generateBookingRef() itself is broken, not this check.');
}

for (const { label, bookingRef } of cases) {
  const dataUri = await generateBookingRefQrDataUri(bookingRef);
  const decodeResult = decodeDataUri(dataUri);

  if (!decodeResult.ok) {
    failures.push(`[${label}] QR did not decode: ${decodeResult.reason}`);
    continue;
  }
  if (decodeResult.decoded !== bookingRef) {
    failures.push(
      `[${label}] decoded QR payload did not exactly match the input bookingRef ` +
        '(lengths: decoded=' + decodeResult.decoded.length + ', expected=' + bookingRef.length + ').'
    );
  }
}

// Negative control: an empty bookingRef must be REFUSED, not silently encoded as an empty QR
// (an empty/garbage QR at the door is worse than a clear failure at email-build time).
{
  let threw = false;
  try {
    await generateBookingRefQrDataUri('');
  } catch {
    threw = true;
  }
  if (!threw) failures.push('generateBookingRefQrDataUri("") did not throw — an empty bookingRef must be refused, not silently encoded.');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: generateBookingRefQrDataUri() produces a PNG data URI that jsQR (a real, independent ' +
    'QR decoder) decodes back to the EXACT original bookingRef string, for multiple distinct ' +
    'real booking references, and refuses an empty bookingRef rather than silently encoding it.'
);
process.exit(0);
