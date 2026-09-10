// ticketing-complete M3/F7 -- self-check for goldens/f7-nav-targets.json.
//
// Run via: node --import tsx/esm contracts/checks/ticketing-complete-f7/check-nav-targets-golden.mjs
//
// The golden file exists as an independent audit-trail cross-check on components/chrome/
// nav-config.ts's NAV export (the spec itself, e2e/nav-links-200.spec.ts, must import NAV
// directly per A5 -- this file is not its source of truth). Prose alone drifts silently: the
// golden went stale after the F6 nav restructure and nothing failed until a Codex GPT-5.5
// review caught it by hand. This script converts that prose into an enforced invariant --
// it imports the REAL NAV export at runtime, flattens every href in it (top-level item
// hrefs, then each mega item's own column headingHrefs, then each column's leaf link
// hrefs), dedupes, and diffs the result against goldens/f7-nav-targets.json's expectedHrefs
// in both directions. Any divergence -- a route added to NAV and not to the golden, or vice
// versa -- is a failure, not a silent pass.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function flattenNavHrefs(nav) {
  const hrefs = new Set();
  for (const item of nav) {
    hrefs.add(item.href);
    if (item.type === 'mega') {
      for (const column of item.columns) {
        if (column.headingHref) hrefs.add(column.headingHref);
        for (const link of column.links) hrefs.add(link.href);
      }
    }
  }
  return hrefs;
}

async function main() {
  const { NAV } = await import(path.join(REPO_ROOT, 'components/chrome/nav-config.ts'));
  const liveHrefs = flattenNavHrefs(NAV);

  const goldenPath = path.join(
    REPO_ROOT,
    '.agent/memory/project/specs/ticketing-complete/goldens/f7-nav-targets.json',
  );
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const expectedHrefs = new Set(golden.expectedHrefs);

  const missingFromGolden = [...liveHrefs].filter((h) => !expectedHrefs.has(h)).sort();
  const extraInGolden = [...expectedHrefs].filter((h) => !liveHrefs.has(h)).sort();

  if (missingFromGolden.length === 0 && extraInGolden.length === 0) {
    console.log(`OK -- ${liveHrefs.size} hrefs in NAV match f7-nav-targets.json exactly.`);
    process.exit(0);
  }

  console.error('f7-nav-targets.json has drifted from the real NAV export in components/chrome/nav-config.ts:');
  if (missingFromGolden.length > 0) {
    console.error('  IN NAV BUT NOT IN THE GOLDEN (golden needs these added):');
    for (const h of missingFromGolden) console.error(`    + ${h}`);
  }
  if (extraInGolden.length > 0) {
    console.error('  IN THE GOLDEN BUT NOT IN NAV (golden needs these removed, or NAV is missing a route):');
    for (const h of extraInGolden) console.error(`    - ${h}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
