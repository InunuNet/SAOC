// rHB2 check-of-the-check on Brad's own capture (QA input, hash-locked). goldens/fixtures/brad-slide3.png is his beta screenshot
// (preview, slide 3 of 4, 2000 CSS px at DPR 1, copy visible), the hero's last row at `brad.lastHeroRow`. The P1 metrics of
// rendered.mjs (_metrics.mjs fullWidthKink) must FLAG it: the full-width slope break > `coherentKink` and the seam slope > `seamSlope`.
// Columns under the pager and CTAs (`brad.skipX`, CSS px) are painted out with the column blocks either side so copy does not count.
// PASS means the metric sees the banding Brad saw; the rHB row-mean step (which passed it) is printed for the record.
import path from 'node:path';
import { finish, goldenJson, specDir } from './_lib.mjs';
import { decode, fullWidthKink, rowMeans } from './_metrics.mjs';

const NAME = 'brad.mjs';
const T = goldenJson('pull.json');
const B = T.brad;
const img = await decode(path.join(specDir, 'goldens', 'fixtures', B.file));
const failures = [];
if (img.W !== B.size[0] || img.H !== B.size[1]) failures.push(`fixture is ${img.W}x${img.H}, want ${B.size.join('x')}`);
// Drop the copy's columns: keep only the column ranges outside skipX.
const keep = [];
for (let x = 0; x < img.W; x++) if (!B.skipX.some(([a, b]) => x >= a * B.dpr && x < b * B.dpr)) keep.push(x);
const data = Buffer.alloc(keep.length * img.H * 3);
for (let y = 0; y < img.H; y++) keep.forEach((x, j) => { for (let c = 0; c < 3; c++) data[(y * keep.length + j) * 3 + c] = img.data[(y * img.W + x) * 3 + c]; });
const cut = { data, W: keep.length, H: img.H };
const heroRows = B.lastHeroRow + 1;
const q = fullWidthKink(cut, heroRows, B.dpr, B.pullHeight + 16, 8);
const rm = rowMeans(cut, heroRows - Math.round(160 * B.dpr), heroRows + 8);
let step = 0; for (let k = 2; k < rm.length; k++) step = Math.max(step, ...rm[k].map((v, c) => Math.abs(v - rm[k - 2][c]) / 2));
if (!(q.coherentKink > T.coherentKink)) failures.push(`full-width slope break ${q.coherentKink} L*/px at ${q.kinkAt}px, not over ${T.coherentKink}: the metric misses Brad's banding`);
if (!(q.seamSlope > T.seamSlope)) failures.push(`seam slope ${q.seamSlope} L*/px, not over ${T.seamSlope}: the metric misses the seam line`);
finish(NAME, failures, `Brad's capture flagged: full-width slope break ${q.coherentKink} L*/px at ${q.kinkAt}px above the seam (max ${T.coherentKink}), seam slope ${q.seamSlope} (max ${T.seamSlope}); the rHB row-mean smoothed step reads ${step.toFixed(2)} (its limit 4.3), which is why rHB passed it.`);
