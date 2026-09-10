// menu-system-layout4 M1/F1 -- proves the top-level NAV shape is exactly the seven approved
// items, in order, with the approved labels/hrefs/types -- not just "these hrefs exist
// somewhere" (that's check-nav-hrefs-golden.mjs's job). Reads
// goldens/f1-nav-config-target.json's `topLevel` array as the source of truth.
//
// Run via: node contracts/checks/menu-system-layout4-f1/check-nav-top-level-golden.mjs [navModulePath]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function main() {
  const targetArg = process.argv[2];
  const modulePath = targetArg
    ? path.resolve(process.cwd(), targetArg)
    : path.join(REPO_ROOT, 'components/chrome/nav-config.ts');
  const { NAV } = await import(modulePath);

  const goldenPath = path.join(
    REPO_ROOT,
    '.agent/memory/project/specs/menu-system-layout4/goldens/f1-nav-config-target.json',
  );
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
  const expected = golden.topLevel;

  const failures = [];

  if (NAV.length !== expected.length) {
    failures.push(`top-level item count: expected ${expected.length}, got ${NAV.length}`);
  }

  const n = Math.min(NAV.length, expected.length);
  for (let i = 0; i < n; i++) {
    const actual = NAV[i];
    const want = expected[i];
    if (actual.type !== want.type) {
      failures.push(`position ${i} (${want.id}): expected type '${want.type}', got '${actual.type}'`);
    }
    if (actual.label !== want.label) {
      failures.push(`position ${i} (${want.id}): expected label '${want.label}', got '${actual.label}'`);
    }
    if (actual.href !== want.href) {
      failures.push(`position ${i} (${want.id}): expected href '${want.href}', got '${actual.href}'`);
    }
  }

  // NEGATIVE CONTROL for the "Tickets in top row" unruled question (mission section 2):
  // Tickets must NOT appear as a top-level `link` item today. This is a reversible,
  // one-line-to-flip check -- if Brad rules Tickets back into the top row, this line (and
  // only this line) changes, and f1-nav-config-target.json's topLevel array grows by one.
  const hasTopLevelTickets = NAV.some(
    (item) => item.type === 'link' && /^tickets$/i.test(item.label),
  );
  if (hasTopLevelTickets) {
    failures.push(
      "Tickets appears as a top-level link item -- UNRULED per mission section 2. The golden " +
        'builds the nav with Tickets OUT of the top row; if this changed, it must be a deliberate, ' +
        'reported decision (Brad ruling), not a silent addition.',
    );
  }

  if (failures.length === 0) {
    console.log(`OK -- ${NAV.length} top-level NAV items match f1-nav-config-target.json's topLevel exactly.`);
    process.exit(0);
  }

  console.error('Top-level NAV shape does not match f1-nav-config-target.json:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
