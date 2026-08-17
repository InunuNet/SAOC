// A7/A8 — F2: text-parse proof that withCleanup() in _shared.mjs calls its two pairs of
// crash-resilience functions in the required order. See
// contracts/golden/payfast-m1-lock-cleanup-fix/manifest-cleanup.golden.md.
//
// GREP CEILING (stated honestly, per the README's "grep ceilings" section): this proves
// the two calls appear in the right textual order inside the function body, not that the
// control flow between them can't be short-circuited by an early return — the
// behavioural kill-and-recover check (check-manifest-survives-kill.mjs) is what actually
// proves the runtime property.
//
// One script, two modes, so both ordering claims are proven against the exact same
// parsed withCleanup() function body — not two scripts that could silently drift on how
// they extract it.
//
// Usage: node check-withcleanup-ordering.mjs <preflight-before-lock|clear-after-residue>

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_shared.mjs');

const MODES = {
  'preflight-before-lock': { first: 'sweepManifestFromPriorRun', second: 'acquireSuiteLock' },
  'clear-after-residue': { first: 'assertNoResidue', second: 'clearManifestEntries' },
};

function extractWithCleanupBody(sourceText) {
  const signatureMatch = /export async function withCleanup\s*\([^)]*\)\s*\{/.exec(sourceText);
  if (!signatureMatch) {
    throw new Error('Could not locate the withCleanup() function signature in _shared.mjs.');
  }
  const bodyStart = signatureMatch.index + signatureMatch[0].length;
  // Walk brace depth from just after the opening `{` to find the matching closing brace
  // — withCleanup() itself contains nested braces (try/catch/finally, arrow functions),
  // so a naive "next closing brace" match would truncate the body early.
  let depth = 1;
  let i = bodyStart;
  for (; i < sourceText.length && depth > 0; i += 1) {
    if (sourceText[i] === '{') depth += 1;
    else if (sourceText[i] === '}') depth -= 1;
  }
  return sourceText.slice(bodyStart, i - 1);
}

const mode = process.argv[2];
const spec = MODES[mode];
if (!spec) {
  console.error(`FAIL: unknown mode '${mode}' — expected one of: ${Object.keys(MODES).join(', ')}`);
  process.exit(1);
}

const sourceText = readFileSync(SHARED_PATH, 'utf8');
const body = extractWithCleanupBody(sourceText);

const firstIndex = body.indexOf(spec.first);
const secondIndex = body.indexOf(spec.second);

if (firstIndex === -1 || secondIndex === -1) {
  console.error(
    `FAIL: ${mode} — withCleanup() body must call both ${spec.first}() and ${spec.second}() (found: ${spec.first}=${firstIndex !== -1}, ${spec.second}=${secondIndex !== -1})`
  );
  process.exit(1);
}

if (secondIndex < firstIndex) {
  console.error(`FAIL: ${mode} — withCleanup() must call ${spec.first}() before ${spec.second}(), but ${spec.second}() appears first`);
  process.exit(1);
}

console.log(`PASS: ${mode} — withCleanup() calls ${spec.first}() before ${spec.second}()`);
