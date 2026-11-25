// No "award-entr" / "award entr" / "awardEntr" in rendered sources. The only allowlisted file is
// proxy.ts (the 308 redirect from the retired URL).
import { execFileSync } from 'node:child_process';

const ALLOWED = new Set(['proxy.ts']);
const SCANNED_ROOTS = ['app', 'components', 'lib', 'content', 'emails', 'sanity', 'scripts'];
const PATTERN = 'award[- _]?entr|awardEntr';
// One-off historical Sanity patch whose `from` value is the old wording by design.
const HISTORICAL = new Set(['scripts/sanity-leeann-quick-fixes-1111.mjs']);

let out = '';
try {
  out = execFileSync('git', ['grep', '-liE', PATTERN, '--', ...SCANNED_ROOTS], { encoding: 'utf8' });
} catch (error) {
  if (error.status !== 1) throw error; // 1 = no match
}
const offenders = out.split('\n').filter((f) => f && !ALLOWED.has(f) && !HISTORICAL.has(f));
if (offenders.length > 0) {
  console.error(`FAIL: award-entr found in rendered sources:\n${offenders.join('\n')}`);
  process.exit(1);
}
console.log('PASS: no award-entr outside the proxy.ts redirect');
