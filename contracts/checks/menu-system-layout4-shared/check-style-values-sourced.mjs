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
// and fails on any value not present in the two handoff CSS files OR a provenanced golden
// (see EXTENSION below).
//
// EXTENSION (mission menu-system-layout4 M2/F7, 2026-09-10 -- "two sourcing authorities
// disagree about 23px"): F7's own golden file
// (.agent/memory/project/specs/menu-system-layout4/goldens/f7-layout4-visual-fidelity.json)
// declares text-[23px] (.dd-lead font-size) with an explicit provenance statement --
// re-grepped verbatim from the approved Layout 4 artifact (b9eadbd4-e165-4de9-884d-86acc9fbf2a2)
// on 2026-09-10 -- but that value is absent from both handoff CSS files above, which predate
// the artifact and don't know it exists. docs/rules/no-invention.md names the approved design
// handoff as a source in its own right, so the golden's citation is a legitimate second
// authority, not an invented value -- the checker's allowlist was under-scoped, not the value.
//
// This does NOT mean "any value found anywhere in GOLDEN_PROVENANCE_SOURCES is allowed" --
// that would turn the checker into a rubber stamp any future golden could exploit to silence
// a real invented-value finding. Two deliberate narrowings:
//   1. Only the `fontSizePx` key shape is read (not every number in the file) -- so a shadow
//      blur radius or a spacing value elsewhere in the same JSON can never leak into the
//      font-size allowlist just because it shares a key-adjacent number.
//   2. A golden is only consulted if its top-level `source` field is a non-empty string that
//      mentions "artifact" -- a golden authored without an explicit provenance citation is
//      never treated as authoritative, even if it happens to contain a `fontSizePx` field.
//
// WHAT THIS DOES NOT PROVE, STATED PLAINLY: nothing stops a future author from adding an
// arbitrary fontSizePx value to a golden file alongside a `source` string that merely mentions
// the word "artifact" without the value actually being re-verified against it -- the check on
// (2) is a presence/shape check on the golden's own self-declared citation, not a live
// cross-check against the artifact's actual published HTML. The golden is a human/agent-
// reviewed declaration, not an automated re-derivation from the artifact each run. Closing that
// gap for real would mean this checker (or a sibling) fetching/diffing the live artifact HTML
// on every run -- not implemented here. Until then, a value's trustworthiness rests on whoever
// wrote the golden having actually re-grepped the artifact, same as any other human-reviewed
// citation in this codebase.
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

// Golden files whose declared `fontSizePx` values are treated as sourced, PROVIDED the
// golden's own top-level `source` field explicitly cites the approved design artifact.
// See EXTENSION comment above for what this does and does not prove.
const GOLDEN_PROVENANCE_SOURCES = [
  '.agent/memory/project/specs/menu-system-layout4/goldens/f7-layout4-visual-fidelity.json',
];

// Recursively collects every numeric value found under a `fontSizePx` key, anywhere in the
// golden's object tree. Deliberately narrow key match (see EXTENSION note 1 above) -- does
// NOT collect offsetYPx/blurPx/spreadPx or any other *Px-suffixed key, since those are shadow
// or spacing measurements, not font-size literals, and Property 3 only covers font-size.
function collectFontSizePx(node, out) {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectFontSizePx(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'fontSizePx' && typeof value === 'number') {
      out.add(String(value));
    } else {
      collectFontSizePx(value, out);
    }
  }
}

function loadGoldenProvenancedPx() {
  const allowed = new Set();
  for (const rel of GOLDEN_PROVENANCE_SOURCES) {
    const fullPath = path.join(REPO_ROOT, rel);
    let json;
    try {
      json = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (error) {
      throw new Error(`${rel}: could not read/parse golden provenance source (${error.message})`);
    }
    if (typeof json.source !== 'string' || json.source.trim() === '' || !/artifact/i.test(json.source)) {
      throw new Error(
        `${rel}: golden lacks an explicit "source" field citing the approved design artifact -- ` +
          'refusing to treat its fontSizePx values as sourced',
      );
    }
    collectFontSizePx(json, allowed);
  }
  return allowed;
}

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
  for (const px of loadGoldenProvenancedPx()) allowedPx.add(px);
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
          `${rel}: font-size literal text-[${m[1]}px] not present in the handoff CSS files or a provenanced golden`,
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
