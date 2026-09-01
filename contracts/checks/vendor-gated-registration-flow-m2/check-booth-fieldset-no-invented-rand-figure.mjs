#!/usr/bin/env node
// F17 (vendor-gated-registration-flow, M2) -- A31: VendorBoothFieldset.tsx renders the
// boothSize radio group (3 fixed values: single, double, triple -- source doc: "1 Single Booth
// - 2.5m x 3m", "2 Booths (Double) - 5m x 3m", "3 Booths (Triple) - 7m x 3m") instead of the
// deprecated-in-place free numeric boothCount input, AND renders no invented rand-figure table/
// chair charge -- proving the council-blocked figure (M2 golden README "Table/chair rate:
// council-blocked, not provisional") was never made up. Source-scoped, not a whole-file grep
// (see A23/A25's own fix on this mission for why an unscoped grep is the wrong tool here):
// the boothSize check reads only the options array's own block; the rand-figure check reads
// only JSX string literals that themselves mention "table" or "chair", so a rand figure
// elsewhere in the file (e.g. an unrelated field's placeholder) cannot trip it.
//
// FAILS ON: boothSize options missing any of 'single'/'double'/'triple' (or having more than
// those 3, or a 4th 'other'-shaped value), fieldKey="boothCount" still rendered (the deprecated
// free-numeric input not actually removed from the UI, even though it correctly stays on the
// TYPE per deprecate-in-place -- A28 covers the type side, this covers the UI side), or a
// digit-only currency figure ("R" followed by digits) appearing in any JSX string literal that
// also mentions "table" or "chair".
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-booth-fieldset-no-invented-rand-figure.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGET_PATH = path.join(ROOT, 'components/vendors/VendorBoothFieldset.tsx');

const failures = [];

let source;
try {
  source = readFileSync(TARGET_PATH, 'utf8');
} catch (err) {
  failures.push(`SETUP FAILURE: could not read ${TARGET_PATH} -- ${err.message}`);
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}

// --- (1) boothSize renders exactly {single, double, triple}, no more, no fewer. ---
{
  const fieldKeyIdx = source.indexOf('fieldKey="boothSize"');
  if (fieldKeyIdx === -1) {
    failures.push('fieldKey="boothSize" is not rendered anywhere in VendorBoothFieldset.tsx.');
  } else {
    // Walk backwards to the nearest preceding `const <NAME>_OPTIONS = [ ... ]` or inline
    // `options={[ ... ]}` block feeding this fieldKey, then forward to its closing bracket.
    // Search for the options array either as a named const (referenced via `options={NAME}`)
    // or an inline array literal, by scanning the 400 chars around the fieldKey for an
    // `options={` reference and resolving it either way.
    const windowStart = Math.max(0, fieldKeyIdx - 600);
    const windowEnd = Math.min(source.length, fieldKeyIdx + 200);
    const window = source.slice(windowStart, windowEnd);
    const optionsRefMatch = window.match(/options=\{(\w+)\}/) ?? window.match(/options=\{(\[[\s\S]*?\])\}/);
    let optionsBlock = null;
    if (optionsRefMatch && /^[A-Z_]+$/.test(optionsRefMatch[1])) {
      // Named constant -- resolve it in the full file.
      const constName = optionsRefMatch[1];
      const constStart = source.indexOf(`const ${constName} = [`);
      if (constStart !== -1) {
        const constEnd = source.indexOf('\n];', constStart);
        optionsBlock = source.slice(constStart, constEnd === -1 ? undefined : constEnd);
      }
    } else if (optionsRefMatch) {
      optionsBlock = optionsRefMatch[1];
    }
    if (!optionsBlock) {
      failures.push(
        'could not locate the options array feeding fieldKey="boothSize" -- expected either ' +
          '`options={SOME_CONSTANT}` resolving to a `const SOME_CONSTANT = [...]` block, or an ' +
          'inline `options={[...]}` array, within 600 characters before the fieldKey.',
      );
    } else {
      const values = new Set(Array.from(optionsBlock.matchAll(/value:\s*'([a-z]+)'/g), (m) => m[1]));
      const expected = new Set(['single', 'double', 'triple']);
      const missing = [...expected].filter((v) => !values.has(v));
      const extra = [...values].filter((v) => !expected.has(v));
      if (missing.length > 0) {
        failures.push(`boothSize options are missing: ${JSON.stringify(missing)}.`);
      }
      if (extra.length > 0) {
        failures.push(`boothSize options contain unexpected extra value(s): ${JSON.stringify(extra)}.`);
      }
    }
  }
}

// --- (2) boothCount is no longer rendered (deprecated-in-place: stays on the TYPE, A28; must
// no longer appear in the UI). ---
if (source.includes('fieldKey="boothCount"')) {
  failures.push(
    'fieldKey="boothCount" is still rendered -- the deprecated free-numeric booth-count input ' +
      'must be replaced by the boothSize radio group, not rendered alongside it.',
  );
}

// --- (3) no invented rand figure adjacent to "table"/"chair" copy. ---
// Extract every JSX string literal (label=".."/placeholder=".."/quoted children text) so the
// scan is scoped to actual rendered copy, not arbitrary source code containing the words
// "table" or "chair" as substrings of an unrelated identifier.
const stringLiterals = Array.from(source.matchAll(/"([^"\n]{3,300})"/g), (m) => m[1]);
const CURRENCY_FIGURE_PATTERN = /R\s?\d/;
for (const literal of stringLiterals) {
  if (/table|chair/i.test(literal) && CURRENCY_FIGURE_PATTERN.test(literal)) {
    failures.push(
      `a digit-only currency figure appears in table/chair copy: "${literal}" -- the rand ` +
        'rate is council-blocked (M2 golden README) and must never be invented in the UI.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: VendorBoothFieldset.tsx renders boothSize as exactly {single, double, triple}, no ' +
    'longer renders boothCount, and no invented rand figure appears near table/chair copy.',
);
process.exit(0);
