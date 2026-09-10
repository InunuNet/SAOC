// menu-system-layout4 -- shared guard for PROPERTY 3 (mission section 6): "No unsourced
// visual value. No colour, font-family or font-size literal in the four chrome components
// that is absent from colors_and_type.css." Mission section 5 additionally cites
// design/design_handoff_saoc/src/styles.css for "every colour, face, size, spacing value" --
// a broader claim than Property 3's own narrower prose. This checker resolves that in favour
// of the broader, section-5 reading: BOTH files together are the source of truth, because
// section 5's own worked examples (mobile drawer's 17px link size) live only in styles.css,
// not colors_and_type.css, and section 3 F3 cites styles.css lines 371-419 by name as
// authoritative for that exact value. Treating colors_and_type.css alone as authoritative
// would make F3's own cited constraint unsourced by this checker's own rule -- clearly not
// the intent. Extends the sha256-whole-file-freeze pattern from
// contracts/checks/ticketing-complete-f6/check-style-freeze.mjs into a literal-value
// allowlist instead, since these components are EXPECTED to change (that's the mission).
//
// Scans each file passed on argv for two literal shapes:
//   - Tailwind arbitrary font-size, e.g. text-[14px]  (font-size literals only -- NOT
//     padding/margin/gap arbitrary values, which are spacing, not covered by Property 3's
//     "font-size literal" wording)
//   - 6-digit hex colours, e.g. #384138
// and fails on any value not present in the two handoff CSS files.
//
// Run via: node contracts/checks/menu-system-layout4-shared/check-style-values-sourced.mjs <file> [<file> ...]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const SOURCE_FILES = [
  'design/design_handoff_saoc/colors_and_type.css',
  'design/design_handoff_saoc/src/styles.css',
];

function loadAllowedValues() {
  const allowedPx = new Set();
  const allowedHex = new Set();
  for (const rel of SOURCE_FILES) {
    const css = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    // Font-size context ONLY -- `font-size: Npx` declarations and the --body-*/--mono-*/
    // --display-* custom-property type-scale tokens (colors_and_type.css declares its scale
    // as custom properties, not literal `font-size:` lines). Deliberately narrower than "any
    // px number anywhere in the file" -- that would also allow spacing/radius/border values
    // that happen to share a digit with an unrelated font size, defeating the point of the
    // check (caught during authoring: a stray padding value made an invented text size look
    // sourced).
    for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) allowedPx.add(m[1]);
    for (const m of css.matchAll(/--(?:body|mono|display)-[\w-]+:\s*(\d+(?:\.\d+)?)px/g)) {
      allowedPx.add(m[1]);
    }
    for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b/g)) allowedHex.add(m[0].toLowerCase());
  }
  return { allowedPx, allowedHex };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: check-style-values-sourced.mjs <file> [<file> ...]');
    process.exit(2);
  }

  const { allowedPx, allowedHex } = loadAllowedValues();
  const failures = [];

  for (const rel of files) {
    const fullPath = path.resolve(process.cwd(), rel);
    let content;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch (error) {
      failures.push(`${rel}: could not read (${error.message})`);
      continue;
    }

    for (const m of content.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (!allowedPx.has(m[1])) {
        failures.push(
          `${rel}: font-size literal text-[${m[1]}px] not present in either handoff CSS file`,
        );
      }
    }
    for (const m of content.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      if (!allowedHex.has(hex)) {
        failures.push(`${rel}: colour literal ${hex} not present in either handoff CSS file`);
      }
    }
  }

  if (failures.length === 0) {
    console.log(`OK -- no unsourced font-size/colour literals in ${files.length} file(s).`);
    process.exit(0);
  }

  console.error('Style-value provenance failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main();
