// menu-system-layout4 M1/F5 -- the dead nav target is fixed:
// /national-show/exhibitors/international becomes /national-show/international-guests
// (manifest is the authority for the new path; the WOSA entry needs no change per R3).
//
// Run via: node contracts/checks/menu-system-layout4-f1/check-dead-link-fixed.mjs [navModulePath]
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const OLD_HREF = '/national-show/exhibitors/international';
const NEW_HREF = '/national-show/international-guests';

function collectHrefs(nav) {
  const hrefs = new Set();
  for (const item of nav) {
    hrefs.add(item.href);
    if (item.type === 'mega') {
      if (item.lead?.theShow) {
        if (item.lead.theShow.headingHref) hrefs.add(item.lead.theShow.headingHref);
        for (const link of item.lead.theShow.links) hrefs.add(link.href);
      }
      for (const column of item.columns) {
        if (column.headingHref) hrefs.add(column.headingHref);
        for (const link of column.links) hrefs.add(link.href);
      }
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
  const hrefs = collectHrefs(NAV);

  const failures = [];
  if (hrefs.has(OLD_HREF)) {
    failures.push(`the old dead href ${OLD_HREF} is still present in NAV`);
  }
  if (!hrefs.has(NEW_HREF)) {
    failures.push(`the corrected href ${NEW_HREF} is not present in NAV`);
  }

  if (failures.length === 0) {
    console.log(`OK -- ${OLD_HREF} is gone and ${NEW_HREF} is present.`);
    process.exit(0);
  }

  console.error('F5 dead-link fix not verified:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
