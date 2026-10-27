// Contract-f2 helpers: the f1 helpers unchanged (_lib.mjs) plus the f2 golden merged over the f1 golden. A local export shadows the star
// export, so every f2 gate that imports GOLDEN or T from here sees the f2 thresholds and the f2 route variants without touching f1's files.
import { readFileSync } from 'node:fs';
import { GOLDEN as F1_GOLDEN } from './_lib.mjs';

export * from './_lib.mjs';

export const F2 = JSON.parse(readFileSync('.agent/memory/project/specs/saoc-inner-heroes/goldens/f2.json', 'utf8'));
export const T = { ...F1_GOLDEN.thresholds, ...F2.thresholdOverrides };
export const GOLDEN = {
  ...F1_GOLDEN,
  thresholds: T,
  // HM-7: /404 and /events/submit are typographic from f2 on.
  heroRoutes: F1_GOLDEN.heroRoutes.map((r) => (F2.typographicNow.includes(r.path) ? { ...r, image: null, position: null, variant: 'type' } : r)),
};
