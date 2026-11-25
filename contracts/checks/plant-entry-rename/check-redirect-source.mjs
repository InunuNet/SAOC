// proxy.ts must 308 both retired award-entries spellings (and sub-paths) to /plant-entry on both
// hosts, and the page must live at /national-show/plant-entry.
import { existsSync, readFileSync } from 'node:fs';

const proxy = readFileSync('proxy.ts', 'utf8');
const need = [
  "'/award-entries', '/national-show/award-entries'",
  "const PLANT_ENTRY_PATH = '/plant-entry'",
  'function retiredEntryTarget',
  'pathname.slice(base.length)',
];
const missing = need.filter((s) => !proxy.includes(s));
if (missing.length > 0) {
  console.error(`FAIL: proxy.ts lacks: ${missing.join(' | ')}`);
  process.exit(1);
}
const uses = proxy.split('retiredEntryTarget(pathname)').length - 1;
if (uses !== 2) {
  console.error(`FAIL: retiredEntryTarget must run on both hosts (found ${uses})`);
  process.exit(1);
}
if (
  !existsSync('app/(nos)/national-show/plant-entry/page.tsx') ||
  existsSync('app/(nos)/national-show/award-entries')
) {
  console.error('FAIL: route directory not moved');
  process.exit(1);
}
console.log('PASS: redirect wired on both hosts, route moved');
