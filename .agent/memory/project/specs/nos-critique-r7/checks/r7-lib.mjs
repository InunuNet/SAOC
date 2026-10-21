// nos-critique-r7 shared helpers for f1 (plan-your-visit chip variants) and f2 (NosHero lede text-wrap: pretty).
import { existsSync } from 'node:fs';

import { BASE, DOC, NS, git, golden } from './_lib.mjs';
import { assertFreshBuild, startServer } from './_server.mjs';

export { golden };
const fromJson = (name) => JSON.parse(golden(name));
export const F1_PATHS = new Set(fromJson('f1-footprint.json'));
export const F2_PATHS = new Set(fromJson('f2-footprint.json'));
export const F3_PATHS = new Set(fromJson('f3-footprint.json'));

// Never touched by r7 (lead): the SAOC chrome and pages, tickets, catalogues, the other NOS routes, shared data, globals.css.
export const OFF_LIMITS = [
  `${NS}/tickets/`, 'app/(marketing)/tickets/', 'app/api/', `${NS}/workshops/`, `${NS}/conferences/`, 'lib/', 'app/globals.css',
  'components/chrome/', 'components/nos-chrome/', 'components/show/nos/', 'components/nos/LongFormPage.tsx', 'components/nos/ShowFacts.tsx',
];

/** Footprint guard against BASE: only the listed features' files (plus the docs file) may differ from main. `through` = 1 or 2. */
export function footprintFailures(through) {
  const failures = [];
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  const allowed = new Set([DOC, ...F1_PATHS, ...(through >= 2 ? F2_PATHS : []), ...(through >= 3 ? F3_PATHS : [])]);
  for (const p of changed) {
    if (allowed.has(p)) continue;
    failures.push(OFF_LIMITS.some((o) => p.startsWith(o)) ? `off-limits path changed: ${p}` : `path not on the r7 allowlist (f1${through >= 2 ? ', f2' : ''}${through >= 3 ? ', f3' : ''} only): ${p}`);
  }
  try {
    git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE}`);
  }
  return { failures, count: changed.size };
}

/** Origin for one render mode. preview = SHOW_PLACEHOLDER_PREVIEW=true (beta review, wall up), public = unset. Dry run: NOS_CR7_ORIGIN (public) / NOS_CR7_ORIGIN_PREVIEW. */
export async function openMode(mode, sourceFiles) {
  const fixed = mode === 'preview' ? process.env.NOS_CR7_ORIGIN_PREVIEW : process.env.NOS_CR7_ORIGIN;
  if (fixed) return { origin: fixed, stop: () => {} };
  const stale = assertFreshBuild(sourceFiles);
  if (stale.length > 0) return { stale };
  process.env.SHOW_PLACEHOLDER_PREVIEW = mode === 'preview' ? 'true' : ''; // the withhold switch matches 'true' exactly
  const srv = await startServer();
  return { origin: srv.origin, stop: srv.stop };
}

export const norm = (t) => t.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
export { existsSync };
