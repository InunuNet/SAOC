#!/usr/bin/env node
// PROPERTY (F8a, file integrity + exact filename) -- RE-GROUNDED 2026-09-21
// after NOS Design withdrew R22 (the "serving resolution" / 2x-Retina width
// floor) in full, commit 0a79280, and Brad's standing instruction that
// supplied branding assets are placed as-is, never processed. See
// .agent/memory/project/specs/menu-system-layout4/contract-f8.yaml A12 for
// the full withdrawal record. This script no longer checks source width at
// all, on any authority -- if a width-related concern resurfaces later it
// needs its own new ruling, not a revival of this one.
//
// What survives, re-grounded on its own merits (never on R22): this script
// catches a bad HAND-COPY of the master -- a truncated or interrupted file
// transfer, a non-PNG file, a file with no pixel data -- plus a mis-cased
// filename that resolves fine on this dev machine's case-insensitive
// macOS/APFS filesystem and 404s on Firebase App Hosting's case-sensitive
// Linux. Brad's "place it, don't process it" policy still requires a human
// to copy the file correctly; a partial/corrupt copy is exactly the failure
// mode this checks for, and there is no build step downstream that would
// otherwise ever notice one.
//
// Deliberately vacuous-pass on a missing file: A10 already owns "does the
// asset exist" as an informational (required: false) precondition, and
// that check is expected to fail until the team lead/Brad places the file.
// This script must NOT also red the gate for the same reason -- it exists
// to catch a *present but corrupt/mis-named* file, not a missing one.
//
// Usage: node check-logo-source-resolution.mjs <pngPath>

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const [, , pngPath] = process.argv;

if (!pngPath) {
  console.error('usage: check-logo-source-resolution.mjs <pngPath>');
  process.exit(2);
}

if (!existsSync(pngPath)) {
  console.log(
    `PASS (vacuous): ${pngPath} not present yet -- A10 already tracks asset placement as an ` +
      'informational precondition; this check has nothing to verify until the file exists.'
  );
  process.exit(0);
}

// Case-sensitivity check: the dev machine (macOS/APFS) resolves paths
// case-insensitively, so the `existsSync` call above proves the path
// resolves HERE and nothing more -- it is silent about whether the on-disk
// filename actually matches byte-for-byte. Production (Firebase App
// Hosting) runs on Linux, which is case-sensitive: a file placed as
// `NOS-2027-Logo-Full-Colour-Vertical.png` when the expected name is
// `nos-2027-logo-full-colour-vertical.png` passes `existsSync` cleanly on
// this machine and then 404s in production, with no assertion ever having
// seen the mismatch. So the on-disk directory listing, not path
// resolution, is what this check trusts for "does the file with this exact
// name exist".
const expectedBasename = basename(pngPath);
const dir = dirname(pngPath);

let dirEntries;
try {
  dirEntries = readdirSync(dir);
} catch {
  // Containing directory doesn't exist -- true absence, same as the
  // existsSync branch above.
  dirEntries = [];
}

if (!dirEntries.includes(expectedBasename)) {
  const caseVariant = dirEntries.find(
    (name) => name.toLowerCase() === expectedBasename.toLowerCase()
  );

  if (caseVariant) {
    console.error(
      `FAIL: expected exact filename "${expectedBasename}" but found "${caseVariant}" in ${dir} -- ` +
        'the names differ only in case, which resolves fine on this case-insensitive macOS/APFS ' +
        'dev machine but will 404 in production (Firebase App Hosting runs on case-sensitive ' +
        `Linux). Rename the file to exactly "${expectedBasename}" (all lowercase, matching the ` +
        'contract) and re-run this check.'
    );
    process.exit(1);
  }

  // Neither an exact match nor a case-variant -- true absence (existsSync
  // above only found it via a resolution quirk that a directory listing
  // doesn't reproduce, e.g. a race). Same vacuous-pass reasoning as above.
  console.log(
    `PASS (vacuous): ${pngPath} not present yet -- A10 already tracks asset placement as an ` +
      'informational precondition; this check has nothing to verify until the file exists.'
  );
  process.exit(0);
}

const buf = readFileSync(pngPath);

// PNG signature is the fixed 8-byte magic `89 50 4E 47 0D 0A 1A 0A`; IHDR
// chunk data starts at byte 16 (after the 8-byte signature + 4-byte length
// + 4-byte "IHDR" tag): width is a big-endian uint32 at offset 16, height
// at offset 20. Both the signature AND the IHDR tag are checked -- IHDR is
// required by spec to be the first chunk, so the combination is what makes
// trusting the width/height offsets below safe. Checking IHDR alone is not
// enough: any non-PNG file that happens to carry the ASCII bytes "IHDR" at
// offset 12 would otherwise pass and have arbitrary bytes at offsets 16-23
// read as width/height.
//
// Also checked: the IHDR chunk length (bytes 8-11, must be exactly 13 per
// spec) and the presence of a terminating IEND chunk at end-of-file. The
// IEND check exists for a specific, realistic failure mode for a
// hand-copied asset (this file is placed by Brad from a known master, not
// supplied by an attacker): a partially-copied or interrupted PNG keeps a
// valid signature, a valid IHDR tag/length, and correct width/height --
// everything this script reads is inside the first 24 bytes -- while the
// actual image data past the header is missing or truncated. That file
// still renders an <img> element in the DOM (broken), so it would pass
// A1-A3/A11 as well as every check above this comment.
//
// Also checked: the presence of at least one IDAT chunk between IHDR and
// IEND. A syntactically well-formed header followed directly by IEND with
// no IDAT carries no pixel data at all and is not a decodable PNG,
// regardless of how plausible its declared width is -- a gap the checks
// above this comment do not close on their own. NOTE: this remains a
// structural completeness check only -- it does NOT validate chunk CRCs or
// decode pixel data. Pixel-data *presence* is checked (via the IDAT tag);
// pixel-data *validity* is not. A file with a correct signature/IHDR/IDAT/
// IEND but corrupt data in between (bad CRCs, malformed intermediate
// chunks, garbage IDAT payload) is not detected. That is an accepted
// limitation: full validation would require a real PNG decoder, which is
// out of proportion for a fast, dependency-free gate check.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IEND_TERMINATOR = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
  console.error(`FAIL: ${pngPath} does not look like a valid PNG (missing the 8-byte PNG signature)`);
  process.exit(1);
}

if (buf.toString('ascii', 12, 16) !== 'IHDR') {
  console.error(`FAIL: ${pngPath} does not look like a valid PNG (IHDR is not the first chunk)`);
  process.exit(1);
}

const ihdrLength = buf.readUInt32BE(8);
if (ihdrLength !== 13) {
  console.error(
    `FAIL: ${pngPath} does not look like a valid PNG (IHDR chunk length is ${ihdrLength}, must be 13)`
  );
  process.exit(1);
}

if (buf.length < 12 || !buf.subarray(buf.length - 12).equals(IEND_TERMINATOR)) {
  console.error(
    `FAIL: ${pngPath} appears truncated or incomplete (missing IEND terminator) -- the header ` +
      'is well-formed but the file does not end with a valid zero-length IEND chunk, consistent ' +
      'with a partially-copied or interrupted file transfer.'
  );
  process.exit(1);
}

const IDAT_TAG = Buffer.from('IDAT', 'ascii');
if (buf.indexOf(IDAT_TAG) === -1) {
  console.error(
    `FAIL: ${pngPath} contains no image data (no IDAT chunk) and is not a decodable PNG -- the ` +
      'header is well-formed but the file carries no pixel data at all.'
  );
  process.exit(1);
}

const sourceWidth = buf.readUInt32BE(16);
const sourceHeight = buf.readUInt32BE(20);

// No width floor: R22 (the rule that required a minimum source width) has
// been withdrawn in full -- see the header comment. sourceWidth/sourceHeight
// are still read and reported below as useful diagnostics, not compared
// against anything.
console.log(
  `PASS: ${pngPath} is a structurally valid PNG (${sourceWidth}x${sourceHeight}px) with the ` +
    'expected exact filename -- signature, IHDR, IDAT, and IEND all verified present and ' +
    'well-formed.'
);
process.exit(0);
