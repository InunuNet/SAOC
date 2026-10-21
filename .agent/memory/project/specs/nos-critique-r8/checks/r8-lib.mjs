// nos-critique-r8 shared helpers for f1 (plan-your-visit chip variants) and f2 (NosHero lede text-wrap: pretty).
import { existsSync } from 'node:fs';

import { BASE, DOC, NS, git, golden } from './_lib.mjs';
import { assertFreshBuild, startServer } from './_server.mjs';

export { golden };
const fromJson = (name) => JSON.parse(golden(name));
export const FEATURE_PATHS = [1, 2, 3, 4, 5].map((n) => new Set(fromJson(`f${n}-footprint.json`)));
export const [F1_PATHS, F2_PATHS, F3_PATHS, F4_PATHS, F5_PATHS] = FEATURE_PATHS;

// Never touched by r8 (lead): the SAOC chrome and pages, tickets, catalogues, the other NOS routes, shared data, globals.css.
export const OFF_LIMITS = [
  `${NS}/tickets/`, 'app/(marketing)/tickets/', 'app/api/', `${NS}/workshops/`, `${NS}/conferences/`, 'lib/', 'app/globals.css',
  'components/chrome/', 'components/nos-chrome/', 'components/show/nos/', 'components/nos/LongFormPage.tsx', 'components/nos/ShowFacts.tsx',
];

/** Footprint guard against BASE: only the listed features' files (plus the docs file) may differ from main. `through` = 1..5 (stacked branch). */
export function footprintFailures(through) {
  const failures = [];
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
  const allowed = new Set([DOC, ...FEATURE_PATHS.slice(0, through).flatMap((p) => [...p])]);
  for (const p of changed) {
    if (allowed.has(p)) continue;
    failures.push(OFF_LIMITS.some((o) => p.startsWith(o)) ? `off-limits path changed: ${p}` : `path not on the r8 allowlist (f1..f${through} only): ${p}`);
  }
  try {
    git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim());
  } catch {
    failures.push(`HEAD does not descend from ${BASE}`);
  }
  return { failures, count: changed.size };
}

/** Origin for one render mode. preview = SHOW_PLACEHOLDER_PREVIEW=true (beta review, wall up), public = unset. Dry run: NOS_CR8_ORIGIN (public) / NOS_CR8_ORIGIN_PREVIEW. */
export async function openMode(mode, sourceFiles) {
  const fixed = mode === 'preview' ? process.env.NOS_CR8_ORIGIN_PREVIEW : process.env.NOS_CR8_ORIGIN;
  if (fixed) return { origin: fixed, stop: () => {} };
  const stale = assertFreshBuild(sourceFiles);
  if (stale.length > 0) return { stale };
  process.env.SHOW_PLACEHOLDER_PREVIEW = mode === 'preview' ? 'true' : ''; // the withhold switch matches 'true' exactly
  const srv = await startServer();
  return { origin: srv.origin, stop: srv.stop };
}

export const norm = (t) => t.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
export { existsSync };
