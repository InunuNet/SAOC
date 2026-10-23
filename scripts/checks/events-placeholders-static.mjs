// Mission nos-site-split — invented-events gate (static half). Brad keeps the invented events in on the beta
// preview only; they must never become machine-readable. Fails (exit 1) if any file that builds JSON-LD,
// the sitemap, an .ics feed, the event slug pages, the llms file or another events list imports
// lib/data/placeholder-events, or if anything but the /events page imports it at all.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const MODULE = 'placeholder-events';
const ALLOWED_IMPORTER = 'app/(marketing)/events/page.tsx';
const ROOTS = ['app', 'components', 'lib', 'sanity', 'scripts'];
const SOURCE = /\.(ts|tsx|mjs|js)$/;
const NEVER = [
  'components/seo/JsonLd.tsx',
  'app/sitemap.ts',
  'lib/ics.ts',
  'app/api/events.ics/route.ts',
  'app/(marketing)/events/[slug]/page.tsx',
  'scripts/refresh-llms.ts',
  'components/home/EventsStrip.tsx',
  'components/ui/EventRow.tsx',
];
const NEVER_DIRS = ['app/api/events'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (SOURCE.test(name)) yield full.split(path.sep).join('/');
  }
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) failures += 1;
}

const importers = [];
const neverFiles = new Set(NEVER);
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (file === 'lib/data/placeholder-events.ts' || file.includes('scripts/checks/events-placeholders-')) continue;
    if (NEVER_DIRS.some((dir) => file.startsWith(`${dir}/`))) neverFiles.add(file);
    if (readFileSync(file, 'utf8').includes(MODULE)) importers.push(file);
  }
}
for (const file of neverFiles) {
  check(`machine-readable surface does not read ${MODULE}: ${file}`, !importers.includes(file), 'imports it');
}
check(`only ${ALLOWED_IMPORTER} imports ${MODULE}`, importers.length === 1 && importers[0] === ALLOWED_IMPORTER, `importers: ${importers.join(', ') || 'none'}`);

process.exit(failures ? 1 : 0);
