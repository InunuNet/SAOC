// menu-system-layout4 M1/F1 -- self-check for goldens/f1-nav-hrefs.json.
//
// Run via: node contracts/checks/menu-system-layout4-f1/check-nav-hrefs-golden.mjs [navModulePath]
//
// Mirrors contracts/checks/ticketing-complete-f7/check-nav-targets-golden.mjs's established
// pattern exactly (import the REAL NAV export at runtime, flatten every href, diff against
// the golden in both directions -- never a hand-typed list that could silently drift) but
// extends flattenNavHrefs for the Layout 4 mega shape: a `lead` block (its own leadHref, plus
// lead.theShow's headingHref/links), `columns` (headingHref/links per column, no longer a
// single flat `columns` array meaning "the whole mega"), and a `featureRail` (ctaHref).
//
// Accepts an optional CLI argument pointing at an alternate module exporting `NAV`, purely so
// this same script can be pointed at a negative fixture to prove it actually fails -- see
// goldens/fixtures/f1-negative-fixtures/*.mjs and the commands recorded in contract-f1.yaml.
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
      if (item.lead) {
        hrefs.add(item.lead.leadHref);
        if (item.lead.theShow) {
          if (item.lead.theShow.headingHref) hrefs.add(item.lead.theShow.headingHref);
          for (const link of item.lead.theShow.links) hrefs.add(link.href);
        }
      }
      for (const column of item.columns) {
        if (column.headingHref) hrefs.add(column.headingHref);
        for (const link of column.links) hrefs.add(link.href);
      }
      if (item.featureRail) hrefs.add(item.featureRail.ctaHref);
    }
  }
  return hrefs;
}

async function main() {
  const targetArg = process.argv[2];
  const modulePath = targetArg
    ? path.resolve(process.cwd(), targetArg)
    : path.join(REPO_ROOT, 'components/chrome/nav-config.ts');
  const { NAV } = await import(modulePath);
  const liveHrefs = flattenNavHrefs(NAV);

  const goldenPath = path.join(
    REPO_ROOT,
    '.agent/memory/project/specs/menu-system-layout4/goldens/f1-nav-hrefs.json',
  );
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const expectedHrefs = new Set(golden.expectedHrefs);

  const missingFromGolden = [...liveHrefs].filter((h) => !expectedHrefs.has(h)).sort();
  const extraInGolden = [...expectedHrefs].filter((h) => !liveHrefs.has(h)).sort();

  if (missingFromGolden.length === 0 && extraInGolden.length === 0) {
    console.log(`OK -- ${liveHrefs.size} hrefs in NAV match f1-nav-hrefs.json exactly.`);
    process.exit(0);
  }

  console.error('f1-nav-hrefs.json has drifted from the real NAV export in components/chrome/nav-config.ts:');
  if (missingFromGolden.length > 0) {
    console.error('  IN NAV BUT NOT IN THE GOLDEN:');
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
