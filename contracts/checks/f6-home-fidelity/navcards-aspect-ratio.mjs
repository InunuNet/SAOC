// A31 — D9: NavCards card images must actually RENDER at a portrait
// ~4:5 ratio (A20/A21 only check the `aspect-[4/5]` class string in
// source). Measures the live bounding box of each card image.
import { withPage, fail, pass } from './_shared.mjs';

const TARGET_RATIO = 4 / 5; // width / height
const TOLERANCE = 0.05;

await withPage({ width: 1440, height: 1400 }, async (page) => {
  const images = page.locator('a[href="/societies"] img, a[href="/national-show"] img, a[href="/judging"] img, a[href="/about"] img');
  const count = await images.count();
  if (count === 0) fail('no NavCards images found in rendered DOM');

  const ratios = [];
  for (let i = 0; i < count; i++) {
    const box = await images.nth(i).boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      fail(`NavCards image ${i} has a zero/null bounding box: ${JSON.stringify(box)}`);
    }
    const ratio = box.width / box.height;
    ratios.push(ratio);
    if (Math.abs(ratio - TARGET_RATIO) > TOLERANCE) {
      fail(
        `NavCards image ${i} does not render at ~4:5 (target=${TARGET_RATIO.toFixed(3)}, actual=${ratio.toFixed(3)}, box=${JSON.stringify(box)})`
      );
    }
  }

  pass(`all ${count} NavCards images render at ~4:5 aspect ratio — ratios=${ratios.map((r) => r.toFixed(3)).join(', ')}`);
});
