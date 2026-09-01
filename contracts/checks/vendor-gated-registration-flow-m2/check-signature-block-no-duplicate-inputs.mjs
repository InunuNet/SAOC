#!/usr/bin/env node
// F20 (vendor-gated-registration-flow, M2) -- A37: the signature block renders Full Name
// (signatureFullName, a real editable input), Position and Business Name as READ-ONLY
// reflections of contactPosition/businessName (no second editable input for either), and Date
// as a read-only "submitted on" string, never an editable date input -- per the M2 golden
// README's "The signature block" (Position/Business Name are not re-collected as new fields;
// Date is not submitter-editable, since the form has no reason to let a vendor backdate or
// postdate their own signature).
//
// FILE LOCATION (flagged, not guessed silently): no signature-block content exists anywhere in
// the codebase today (confirmed directly -- grepped components/vendors/ for
// "signature"/"Signature", zero matches), so this check does not assume a filename @dev has
// not chosen yet. Instead it locates fieldKey="signatureFullName" wherever it lands, then
// scopes every other assertion to a bounded window AROUND that anchor, in the SAME FILE only
// -- never the whole components/vendors/ directory. This is deliberate, not incidental: an
// earlier draft of this check searched the whole directory for any fieldKey containing
// "position" or "business name" and immediately produced false positives against genuinely
// unrelated pre-existing fields elsewhere in the form (boothPositionRequest, the registration
// code-entry form's own business-name field) -- exactly the "assertion satisfiable by/broken
// by something that isn't the real property" defect class this mission has been burned by
// before (see A17/A18/A25/A40's own rewrite notes). Scoping to a window around the real
// signature-block anchor is what makes this check test the actual property (no duplicate
// input WITHIN the signature block) instead of an unrelated one (no field anywhere in the
// entire form happens to contain the word "position").
//
// FAILS ON: signatureFullName missing or not wired to onChange; within its surrounding window,
// contactPosition/businessName not referenced as a displayed value, a second editable
// Position/Business-Name-shaped input, or an editable Date input (htmlType="date" or a
// fieldKey naming a signature date).
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-signature-block-no-duplicate-inputs.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const VENDORS_DIR = path.join(ROOT, 'components/vendors');
const WINDOW_RADIUS = 2000; // chars each side of the signatureFullName anchor, same file only

function collectTsxFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];
const files = collectTsxFiles(VENDORS_DIR);

let anchorFile = null;
let anchorWindow = null;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const idx = source.indexOf('fieldKey="signatureFullName"');
  if (idx !== -1) {
    anchorFile = file;
    anchorWindow = source.slice(Math.max(0, idx - WINDOW_RADIUS), idx + WINDOW_RADIUS);
    break;
  }
}

if (anchorFile === null) {
  failures.push('fieldKey="signatureFullName" is not rendered anywhere in components/vendors/.');
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

// (1) signatureFullName itself must be a real editable input.
{
  const anchorIdx = anchorWindow.indexOf('fieldKey="signatureFullName"');
  const localWindow = anchorWindow.slice(anchorIdx, anchorIdx + 400);
  if (!/onChange=\{/.test(localWindow)) {
    failures.push(
      `fieldKey="signatureFullName" (in ${path.relative(ROOT, anchorFile)}) has no onChange ` +
        'handler nearby -- it must be a real editable input, unlike Position/Business Name/Date.',
    );
  }
}

// (2) Position and Business Name must be REFERENCED (displayed) in the window, as read-only
// reflections -- state.contactPosition / state.businessName (or an equivalent destructured
// access) must appear as a rendered VALUE, not re-collected via a fresh input.
if (!/contactPosition/.test(anchorWindow)) {
  failures.push(
    `contactPosition is not referenced anywhere near the signature block (in ` +
      `${path.relative(ROOT, anchorFile)}) -- the golden README requires it displayed read-only there.`,
  );
}
if (!/businessName/.test(anchorWindow)) {
  failures.push(
    `businessName is not referenced anywhere near the signature block (in ` +
      `${path.relative(ROOT, anchorFile)}) -- the golden README requires it displayed read-only there.`,
  );
}

// (3) No SECOND editable Position/Business-Name-shaped input within the window -- any
// fieldKey other than the known-legitimate 'contactPosition'/'businessName'/'signatureFullName'
// that also looks position- or business-name-shaped, AND is wired to onChange, is a duplicate
// answer to the same question.
const KNOWN_LEGITIMATE_FIELD_KEYS = new Set(['contactPosition', 'businessName', 'signatureFullName']);
for (const m of anchorWindow.matchAll(/fieldKey="([^"]+)"/g)) {
  const key = m[1];
  if (KNOWN_LEGITIMATE_FIELD_KEYS.has(key)) continue;
  if (!/position|business.?name/i.test(key)) continue;
  const localIdx = anchorWindow.indexOf(`fieldKey="${key}"`);
  const localWindow = anchorWindow.slice(localIdx, localIdx + 400);
  if (/onChange=\{/.test(localWindow)) {
    failures.push(
      `a second editable Position/Business-Name-shaped input was found inside the signature ` +
        `block window: fieldKey="${key}" (in ${path.relative(ROOT, anchorFile)}) -- Position ` +
        'and Business Name must be read-only reflections there, never re-collected.',
    );
  }
}

// (4) No editable Date input within the window.
if (/htmlType="date"/.test(anchorWindow)) {
  failures.push(
    `an htmlType="date" input was found inside the signature block window (in ` +
      `${path.relative(ROOT, anchorFile)}) -- Date must be a read-only "submitted on" string, ` +
      'never an editable date input.',
  );
}
for (const m of anchorWindow.matchAll(/fieldKey="([^"]*[Ss]ignature[^"]*[Dd]ate[^"]*)"/g)) {
  const localIdx = anchorWindow.indexOf(`fieldKey="${m[1]}"`);
  const localWindow = anchorWindow.slice(localIdx, localIdx + 400);
  if (/onChange=\{/.test(localWindow)) {
    failures.push(`an editable signature-date field was found: fieldKey="${m[1]}" -- Date must be read-only.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: signatureFullName (in ${path.relative(ROOT, anchorFile)}) is a real editable input; ` +
    'contactPosition/businessName are referenced as read-only reflections nearby; no second ' +
    'editable Position/Business Name input or editable Date input exists inside the signature ' +
    'block window.',
);
process.exit(0);
