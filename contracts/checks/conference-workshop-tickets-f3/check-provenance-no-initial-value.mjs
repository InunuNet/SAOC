// F3 (conference-workshop-tickets, M2) — A8/A9: a document schema's `provenance` field has
// no `initialValue` — same safety property sanity/schemas/objects/showPageSection.ts's own
// `provenance` field already enforces ("NO initialValue. See the file header — this is the
// whole safety property."). A default-looking value here would silently mislabel content
// nobody has actually reviewed, so this is proven by inspecting the SOURCE TEXT of the
// field's own defineField({...}) block directly — never by importing the Sanity schema
// module (which pulls in the full 'sanity' package and its own build-time dependencies,
// not needed for a structural check like this one).
//
// Generic across both conferencePresenter.ts and workshopSession.ts — the schema file path
// is argv[2], relative to the repo root.
//
// Run as: node contracts/checks/conference-workshop-tickets-f3/check-provenance-no-initial-value.mjs <path>

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const relPath = process.argv[2];

if (!relPath) {
  console.error('FAIL: check-provenance-no-initial-value.mjs');
  console.error('  - usage: node check-provenance-no-initial-value.mjs <path/to/schema.ts>');
  process.exit(2);
}

const absPath = path.join(__dirname, '../../../', relPath);
const failures = [];

let source;
try {
  source = readFileSync(absPath, 'utf8');
} catch (error) {
  finish([`could not read ${relPath}: ${error.message}`]);
}

function finish(fails) {
  if (fails.length > 0) {
    console.error('FAIL: check-provenance-no-initial-value.mjs');
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${relPath}'s provenance field has no initialValue.`);
  process.exit(0);
}

const marker = "name: 'provenance'";
const markerIndex = source.indexOf(marker);

if (markerIndex === -1) {
  finish([`no field named 'provenance' found in ${relPath}`]);
}

// Find the nearest preceding 'defineField({' that opens THIS field's object literal, then
// balanced-brace-scan forward to find ONLY this field's own closing brace — a sibling field
// legitimately using initialValue elsewhere must not cause a false failure here.
const fieldOpenMarker = 'defineField({';
const fieldOpenIndex = source.lastIndexOf(fieldOpenMarker, markerIndex);

if (fieldOpenIndex === -1) {
  finish([`'provenance' field at offset ${markerIndex} in ${relPath} is not inside a defineField({...}) call`]);
}

const braceStart = fieldOpenIndex + fieldOpenMarker.length - 1; // index of the '{' itself
let depth = 0;
let closeIndex = -1;
for (let i = braceStart; i < source.length; i++) {
  if (source[i] === '{') depth++;
  else if (source[i] === '}') {
    depth--;
    if (depth === 0) {
      closeIndex = i;
      break;
    }
  }
}

if (closeIndex === -1) {
  finish([`could not find the closing brace of the provenance defineField({...}) block in ${relPath} (unbalanced braces?)`]);
}

const fieldBlock = source.slice(braceStart, closeIndex + 1);
// Strip `//`-style line comments before testing — a comment MENTIONING "initialValue" to
// explain its deliberate absence (exactly what showPageSection.ts's own provenance field
// does: "// NO initialValue. See the file header...") must not itself trip this check. Only
// a real `initialValue:` key assignment counts as a violation.
const fieldBlockNoComments = fieldBlock
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');
if (/initialValue\s*:/.test(fieldBlockNoComments)) {
  finish([
    `the provenance field's defineField({...}) block in ${relPath} assigns an 'initialValue:' key — a default value here is unsafe (see sanity/schemas/objects/showPageSection.ts's own header comment)`,
  ]);
}

finish([]);
