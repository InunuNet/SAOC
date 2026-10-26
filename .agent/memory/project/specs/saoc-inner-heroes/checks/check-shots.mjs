// By-eye evidence exists: gate-geometry.mjs writes a hero shot per inner route at 2056 and 390, gate-contrast.mjs home writes one per
// carousel slide at every contrast viewport. This check only verifies the files are there and are not empty; the eye is the reviewer's.
import { existsSync, statSync } from 'node:fs';
import { GOLDEN, SHOT_DIR } from './_lib.mjs';

const missing = [];
const want = (f) => { if (!existsSync(f) || statSync(f).size < 2000) missing.push(f); };
for (const r of GOLDEN.heroRoutes) {
  if (r.conditional || r.discover) continue;
  for (const vp of GOLDEN.viewports.shots) want(`${SHOT_DIR}/${r.path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}-${vp}.png`);
}
for (const s of GOLDEN.home.slides) for (const vp of GOLDEN.viewports.shots) want(`${SHOT_DIR}/home-${s.key}-${vp}.png`);
if (missing.length) { console.error(`check-shots FAILED, missing or empty:\n- ${missing.join('\n- ')}`); process.exit(1); }
console.log('check-shots pass');
