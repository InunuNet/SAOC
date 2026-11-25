// routeSaocHost must 308 /faq and /plant-entry to the NOS origin with the query string kept,
// the same way it does /tickets (SHOW_PREFIXES).
import { readFileSync } from 'node:fs';

const proxy = readFileSync('proxy.ts', 'utf8');
const line = proxy.split('\n').find((l) => l.startsWith('const SHOW_PREFIXES ='));
const need = ["'/faq'", 'PLANT_ENTRY_PATH', "'/tickets'"];
const missing = need.filter((s) => !(line ?? '').includes(s));
if (missing.length > 0) {
  console.error(`FAIL: SHOW_PREFIXES lacks: ${missing.join(' | ')}`);
  process.exit(1);
}
const redirect = 'if (isUnderAny(pathname, SHOW_PREFIXES)) return redirectTo(nosUrl(`${pathname}${search}`));';
if (!proxy.includes(redirect)) {
  console.error('FAIL: routeSaocHost no longer redirects SHOW_PREFIXES with the query string');
  process.exit(1);
}
console.log('PASS: /faq and /plant-entry 308 to NOS with query kept');
