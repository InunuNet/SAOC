#!/usr/bin/env node
// One h1 per NOS route, from source. Root cause being pinned: a Next `loading.tsx` renders into the
// Suspense fallback, and the streamed HTML keeps the fallback beside the resolved page, so a
// loading.tsx that emits an h1 doubles the page's own h1 for every non-JS reader.
// Rule: a loading.tsx under app/(nos) emits no h1 (NosHero must be given titleAs="p"). The pages
// keep their own h1; "exactly one in the served HTML" is proved by live-probe.mjs, because several
// pages take their h1 from ShowContentState or from branches a source count cannot follow.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'app/(nos)';
const problems = [];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/^(page|loading|not-found)\.tsx$/.test(entry.name)) yield full;
  }
}

/** Heading-1 sources in a file: literal <h1, and each <NosHero that is not given titleAs="p". */
function h1Sources(source) {
  const literal = (source.match(/<h1[\s>]/g) ?? []).length;
  const windows = source.split('<NosHero').slice(1).map((rest) => rest.slice(0, 600));
  const heroH1 = windows.filter((tag) => !/titleAs=["{']*p["}']*/.test(tag.split('\n      />')[0])).length;
  return literal + heroH1;
}

const hero = readFileSync('components/nos/NosHero.tsx', 'utf8');
if (!/titleAs/.test(hero)) problems.push('components/nos/NosHero.tsx has no titleAs prop');

for (const file of walk(ROOT)) {
  const count = h1Sources(readFileSync(file, 'utf8'));
  const name = path.basename(file);
  if (name === 'loading.tsx' && count > 0) problems.push(`${file}: loading emits ${count} h1 (must be 0)`);
}

if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('ok: no loading fallback under app/(nos) emits an h1');
