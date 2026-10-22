// nos-hero-banding-2 (rHB2) F1 static check (QA input, hash-locked; @dev must not edit).
//   S1  footprint vs BASE c6702259: only app/globals.css, docs/nos-hero-banding.md and this spec dir differ; HEAD descends from BASE.
//   S2  app/globals.css holds exactly one [data-hero-scrim='bone'] rule, equal to goldens/pull.css (whitespace-normalised).
//   S3  the diagonal, the veil and the >=768px veil rule are byte-identical to BASE.
//   S4  the golden itself (Codi's REQUIRED, 2026-10-22): >= 12 stops; alpha = 1 - smootherstep(p) at every stop within 5e-5; the
//       segment slopes rise then fall (unimodal) and no adjacent pair differs by more than `staticSlopeChange` x the peak slope; the
//       first stop is var(--parchment) at 0% and the last alpha 0 at 100%; every other colour is rgb(244 243 236 / a) (no new
//       colour); background-size is 100% <height.css>, anchored bottom, no-repeat; goldens/pull.json lists the same stops.
import { finish, footprintFailures, golden, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'static.mjs';
const T = goldenJson('pull.json');
const failures = [];
const norm = (s) => s.replace(/\s+/g, ' ').replace(/\s*([{}:;,()])\s*/g, '$1').trim();
const rules = (css, selector) => {
  const out = []; let from = 0;
  for (;;) {
    const i = css.indexOf(`${selector} {`, from); if (i < 0) return out;
    const j = css.indexOf('\n}', i); out.push(css.slice(i, j + 2)); from = j + 2;
  }
};

// S1
const fp = footprintFailures();
failures.push(...fp.failures.map((f) => `${f} (S1)`));

// S2
const css = readRepoFile('app/globals.css');
const base = readBaseFile('app/globals.css');
if (!css || !base) failures.push('app/globals.css missing in the checkout or at BASE (S2)');
else {
  const bone = rules(css, "[data-hero-scrim='bone']");
  if (bone.length !== 1) failures.push(`${bone.length} [data-hero-scrim='bone'] rules in app/globals.css, want exactly 1 (S2)`);
  else if (norm(bone[0]) !== norm(golden('pull.css'))) failures.push("the [data-hero-scrim='bone'] rule differs from goldens/pull.css (S2)");
  // S3: the diagonal and both veil rules (the second sits inside the >=768px media block).
  for (const sel of ["[data-hero-scrim='diagonal']", "[data-hero-scrim='veil']", "  [data-hero-scrim='veil']"]) {
    const a = rules(css, sel).map(norm); const b = rules(base, sel).map(norm);
    if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(`${sel.trim()} changed from BASE (S3)`);
  }
}

// S4
const g = golden('pull.css');
const stopRe = /(var\(--parchment\)|rgb\(244 243 236 \/ ([0-9.]+)\))\s+([0-9.]+)%/g;
const stops = [...g.matchAll(stopRe)].map((m) => ({ at: Number(m[3]), alpha: m[2] === undefined ? 1 : Number(m[2]), parchment: m[2] === undefined }));
const colours = [...g.matchAll(/(?:rgb|rgba|hsl|oklch|oklab|#)[^,;\n]*/g)].map((m) => m[0]);
if (colours.some((c) => !/^rgb\(244 243 236 \/ [0-9.]+\)/.test(c))) failures.push(`a colour other than parchment in the golden: ${colours.filter((c) => !/^rgb\(244 243 236 /.test(c)).join(', ')} (S4)`);
if (stops.length < 12) failures.push(`${stops.length} stops, Codi requires >= 12 (S4)`);
if (!stops[0] || !stops[0].parchment || stops[0].at !== 0) failures.push('the first stop is not var(--parchment) 0% (S4)');
if (!stops.length || stops[stops.length - 1].at !== 100 || stops[stops.length - 1].alpha !== 0) failures.push('the last stop is not alpha 0 at 100% (S4)');
const ease = (p) => 6 * p ** 5 - 15 * p ** 4 + 10 * p ** 3;
for (const s of stops) if (Math.abs(s.alpha - (1 - ease(s.at / 100))) > 5e-5) failures.push(`stop ${s.at}%: alpha ${s.alpha}, smootherstep gives ${(1 - ease(s.at / 100)).toFixed(5)} (S4)`);
const slope = []; for (let k = 1; k < stops.length; k++) slope.push((stops[k - 1].alpha - stops[k].alpha) / (stops[k].at - stops[k - 1].at));
const peak = Math.max(...slope); const top = slope.indexOf(peak);
if (slope.some((v, k) => (k > 0 && k <= top && v < slope[k - 1] - 1e-9) || (k > top && v > slope[k - 1] + 1e-9))) failures.push(`segment slopes not unimodal: ${slope.map((v) => v.toFixed(4)).join(' ')} (S4)`);
for (let k = 1; k < slope.length; k++) { const d = Math.abs(slope[k] - slope[k - 1]) / peak; if (d > T.staticSlopeChange) failures.push(`segments ${k}/${k + 1} change slope by ${d.toFixed(3)} x peak, max ${T.staticSlopeChange} (S4)`); }
if (!norm(g).includes(norm(`background-size: 100% ${T.height.css};`))) failures.push(`background-size is not 100% ${T.height.css} (S4)`);
if (!/background-position:\s*bottom;/.test(g) || !/background-repeat:\s*no-repeat;/.test(g)) failures.push('the tile is not anchored bottom with no-repeat (S4)');
if (JSON.stringify(stops.map(({ at, alpha }) => ({ at, alpha }))) !== JSON.stringify(T.stops)) failures.push('goldens/pull.css and pull.json list different stops (S4)');

finish(NAME, failures, `footprint ${fp.count} paths; one bone rule equal to the golden (${stops.length} smootherstep stops, max adjacent slope change ${Math.max(...slope.slice(1).map((v, k) => Math.abs(v - slope[k]) / peak)).toFixed(3)} x peak, height ${T.height.css}); diagonal and veil unchanged.`);
