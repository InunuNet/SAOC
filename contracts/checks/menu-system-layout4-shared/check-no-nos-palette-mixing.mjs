// menu-system-layout4 -- shared guard used by F1/F2/F3/F4's contracts: SAOC and NOS
// palettes never mix. NOS redeclares the same CSS custom-property NAMES to different
// values -- confirmed distinct on origin/nos-site's app/(marketing)/national-show/
// nos-theme.css: --primary is #211a57 there vs SAOC's #384138 in
// design/design_handoff_saoc/colors_and_type.css. A token-name match proves nothing; only
// the literal hex values distinguish the two palettes, so this scans for hex literals.
//
// Two checks, both must hold for every file passed on argv:
//   1. every 6-digit hex literal present is EITHER one of SAOC's own approved palette
//      values (read live from design/design_handoff_saoc/colors_and_type.css) OR not a
//      colour at all that this script can misjudge -- so literals outside the SAOC set are
//      flagged, not silently allowed.
//   2. none of NOS's own known-distinct values (hardcoded below, sourced from
//      nos-theme.css on origin/nos-site) appear, as an explicit belt-and-braces check even
//      if SAOC's palette ever grows to accidentally include a near-miss.
//
// Run via: node contracts/checks/menu-system-layout4-shared/check-no-nos-palette-mixing.mjs <file> [<file> ...]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Known-distinct NOS values, captured 2026-09-10 from
// origin/nos-site:app/(marketing)/national-show/nos-theme.css. If NOS's palette changes,
// this list is stale by design (a snapshot, not a live read of a branch that may not exist
// locally) -- update it deliberately, in the same commit as reading the new values, not as
// a silent drift.
const KNOWN_NOS_HEX = new Set(['#211a57']);

function loadSaocPalette() {
  const cssPath = path.join(REPO_ROOT, 'design/design_handoff_saoc/colors_and_type.css');
  const css = readFileSync(cssPath, 'utf8');
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
  return new Set((css.match(hexPattern) ?? []).map((h) => h.toLowerCase()));
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: check-no-nos-palette-mixing.mjs <file> [<file> ...]');
    process.exit(2);
  }

  const saocPalette = loadSaocPalette();
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
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
    const found = new Set((content.match(hexPattern) ?? []).map((h) => h.toLowerCase()));
    for (const hex of found) {
      if (KNOWN_NOS_HEX.has(hex)) {
        failures.push(`${rel}: contains known NOS palette value ${hex} -- SAOC/NOS palettes never mix`);
      } else if (!saocPalette.has(hex)) {
        failures.push(
          `${rel}: contains hex literal ${hex} not present in design/design_handoff_saoc/` +
            `colors_and_type.css's approved palette`,
        );
      }
    }
  }

  if (failures.length === 0) {
    console.log(`OK -- no unsourced or NOS-palette hex literals in ${files.length} file(s).`);
    process.exit(0);
  }

  console.error('Palette guard failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main();
