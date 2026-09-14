// menu-system-layout4 M2/F3 -- Brad's hard constraint from the earlier round: "the mobile
// menu font was way too big." The handoff's mobile drawer link size is 17px
// (design/design_handoff_saoc/src/styles.css lines 371-419, .mobile-menu__link). Nothing in
// components/chrome/MobileMenu.tsx may render text larger than that -- group leaves sit
// below it, not at or above it.
//
// Scans for every Tailwind arbitrary font-size (`text-[Npx]`) in the file and fails if any
// exceeds MAX_PX. A coarse proxy (doesn't distinguish "the top-level link" from "a group
// leaf" structurally) but a deliberately strict one: since group leaves must sit BELOW the
// top-level size, and the top-level size itself must not EXCEED 17px, no text-[Npx] in the
// whole file should ever exceed 17 regardless of which element it's on.
//
// Run via: node contracts/checks/menu-system-layout4-f3/check-mobile-drawer-max-font-size.mjs <file> [<file> ...]
import { readFileSync } from 'node:fs';

const MAX_PX = 17;

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: check-mobile-drawer-max-font-size.mjs <file> [<file> ...]');
    process.exit(2);
  }

  const failures = [];
  for (const rel of files) {
    let content;
    try {
      content = readFileSync(rel, 'utf8');
    } catch (error) {
      failures.push(`${rel}: could not read (${error.message})`);
      continue;
    }
    for (const m of content.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      const px = Number(m[1]);
      if (px > MAX_PX) {
        failures.push(`${rel}: text-[${m[1]}px] exceeds the handoff's ${MAX_PX}px mobile drawer link cap`);
      }
    }
  }

  if (failures.length === 0) {
    console.log(`OK -- no font-size literal exceeds ${MAX_PX}px in ${files.length} file(s).`);
    process.exit(0);
  }

  console.error('Mobile drawer font-size cap failures:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main();
