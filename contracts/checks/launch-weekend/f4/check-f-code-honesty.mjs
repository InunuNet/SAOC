#!/usr/bin/env node
// A6 - static guards that no runtime check can prove: the static events module is gone with no importer,
// no static fallback code remains on any surface, the events page carries the standard marker for its empty
// state, and the seed script can no longer re-create the invented docs.
// Usage: node contracts/checks/launch-weekend/f4/check-f-code-honesty.mjs
import { existsSync, readFileSync } from 'node:fs';
import { report, walk } from './_lib.mjs';

const problems = [];
if (existsSync('lib/data/events.ts')) problems.push('lib/data/events.ts still exists');

const files = ['app', 'components', 'lib', 'scripts'].flatMap((d) => [...walk(d, '.ts'), ...walk(d, '.tsx'), ...walk(d, '.mjs')]);
const PATTERNS = [
  [/data\/events/, 'imports lib/data/events'],
  [/staticEvents/, 'references staticEvents'],
  [/from ['"]\.\/events['"]/, "re-exports './events'"],
  [/getFallbackEvents|getFallbackInputs|getFallbackEventsForSociety|FallbackEventRow/, 'keeps a static-fallback function'],
];
for (const f of files) {
  if (f === 'scripts/unpublish-invented-events.ts') continue; // names the invented ids by design
  const src = readFileSync(f, 'utf8');
  for (const [re, why] of PATTERNS) if (re.test(src)) problems.push(`${f}: ${why}`);
}

// SearchOverlay and EventsStrip must not take events from lib/data at all.
for (const f of ['components/chrome/SearchOverlay.tsx', 'components/home/EventsStrip.tsx']) {
  if (/import\s*\{[^}]*\bevents\b[^}]*\}\s*from\s*['"]@\/lib\/data['"]/.test(readFileSync(f, 'utf8'))) problems.push(`${f}: still imports events from @/lib/data`);
}

const page = ['app', '(marketing)', 'events', 'page.tsx'].join('/');
const src = readFileSync(page, 'utf8');
if (!/StatusMarker|ConfirmationBadge/.test(src)) problems.push(`${page}: no StatusMarker/ConfirmationBadge for the empty state`);

const seed = readFileSync('scripts/seed-sanity.ts', 'utf8');
if (/mapEvents|societyEvent/.test(seed)) problems.push('scripts/seed-sanity.ts can still seed societyEvent docs');

report(problems, 'static events module, fallbacks and seeding are gone; empty state uses the standard marker');
