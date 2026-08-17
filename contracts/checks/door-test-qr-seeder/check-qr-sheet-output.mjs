// A7 — `pnpm door:seed` generates a manifest that deep-equals the golden fixture table,
// and a sheet.html that visibly names every bookingRef and expected error string plus
// exactly 4 base64 PNG QR images, one of which decodes to the exact literal bookingRef
// string 'DOOR-QR-ADMIT-01' — proving the sheet encodes exactly what
// app/admin/door/page.tsx passes as bookingRef, not an approximation.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import jsQR from 'jsqr';
import { PNG } from 'pngjs';

import { deleteTicketByBookingRef, PROJECT_ROOT, assert, runDoorSeedCli, runDoorTeardownCli } from './_shared.mjs';

const OUTPUT_DIR = path.join(PROJECT_ROOT, 'scripts/output/door-test-qr');
const GOLDEN_PATH = path.join(
  PROJECT_ROOT,
  'contracts/golden/door-test-qr-seeder/fixtures.golden.json',
);
const BASE64_PNG_PREFIX = 'data:image/png;base64,';

function loadGoldenExpected() {
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
  return golden.fixtures.map((fixture) => ({
    label: fixture.label,
    bookingRef: fixture.bookingRef,
    scans: fixture.scans.map((scan) => ({ ordinal: scan.ordinal, expect: scan.expect })),
  }));
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function extractAdmitQrDataUrl(html) {
  const admitSectionIndex = html.indexOf('DOOR-QR-ADMIT-01');
  assert(admitSectionIndex !== -1, 'sheet.html does not mention DOOR-QR-ADMIT-01 as visible text');
  const imgMatch = html.slice(admitSectionIndex).match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
  assert(imgMatch !== null, 'could not find a base64 PNG <img> src near the ADMIT card');
  return imgMatch[0];
}

function decodeQrPayload(dataUrl) {
  const base64 = dataUrl.slice(BASE64_PNG_PREFIX.length);
  const buffer = Buffer.from(base64, 'base64');
  const png = PNG.sync.read(buffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert(decoded !== null, 'jsqr could not decode any QR code from the ADMIT card PNG');
  return decoded.data;
}

async function main() {
  try {
    runDoorTeardownCli();
  } catch {
    // fine if nothing existed yet
  }
  runDoorSeedCli();

  const manifest = JSON.parse(readFileSync(path.join(OUTPUT_DIR, 'manifest.json'), 'utf8'));
  const expected = loadGoldenExpected();
  assert(
    JSON.stringify(manifest) === JSON.stringify(expected),
    `manifest.json does not deep-equal the golden fixture table.\nGot: ${JSON.stringify(manifest)}\nExpected: ${JSON.stringify(expected)}`,
  );

  const html = readFileSync(path.join(OUTPUT_DIR, 'sheet.html'), 'utf8');

  for (const fixture of expected) {
    assert(html.includes(fixture.bookingRef), `sheet.html is missing the bookingRef ${fixture.bookingRef}`);
    for (const scan of fixture.scans) {
      if (scan.expect.error) {
        assert(
          html.includes(scan.expect.error),
          `sheet.html is missing the expected error string "${scan.expect.error}" for ${fixture.bookingRef}`,
        );
      }
    }
  }

  const pngCount = countOccurrences(html, BASE64_PNG_PREFIX);
  assert(pngCount === 4, `sheet.html contains ${pngCount} base64 PNG images, expected exactly 4`);

  const admitDataUrl = extractAdmitQrDataUrl(html);
  const decodedPayload = decodeQrPayload(admitDataUrl);
  assert(
    decodedPayload === 'DOOR-QR-ADMIT-01',
    `decoded QR payload is "${decodedPayload}", expected the literal string "DOOR-QR-ADMIT-01" with no wrapper`,
  );

  console.log('PASS: A7 the QR sheet and manifest match the golden fixture table and the ADMIT QR decodes exactly');
}

main()
  .catch((err) => {
    console.error(`FAIL: A7 — ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteTicketByBookingRef('DOOR-QR-ADMIT-01');
    await deleteTicketByBookingRef('DOOR-QR-UNPAID-01');
    await deleteTicketByBookingRef('DOOR-QR-WRONGSHOW-01');
  });
