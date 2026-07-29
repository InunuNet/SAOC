// A30 — D2: PartnersSection must render exactly 6 partner cells in a
// SINGLE ROW at 1440px (A1 only greps for the `lg:grid-cols-6` class name
// in source — a class typo, a CSS specificity conflict, or the class not
// compiling at all, as happened with A14/UtilityBar, would still satisfy
// that grep while rendering 2 or 3 rows instead of 1).
import { withPage, fail, pass } from './_shared.mjs';

const PARTNER_NAMES = [
  'Wild Orchids of Southern Africa',
  'South African National Biodiversity Institute',
  'Kirstenbosch NBG',
  'American Orchid Society',
  'Royal Horticultural Society',
  'World Orchid Conference',
];

await withPage({ width: 1440, height: 900 }, async (page) => {
  const eyebrow = page.getByText('In collaboration with', { exact: true }).first();
  if ((await eyebrow.count()) === 0) fail('"In collaboration with" eyebrow not found');

  const boxes = [];
  for (const name of PARTNER_NAMES) {
    const cell = page.getByText(name, { exact: true }).first();
    if ((await cell.count()) === 0) fail(`partner cell "${name}" not found in rendered DOM`);
    const box = await cell.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      fail(`partner cell "${name}" has a zero/null bounding box: ${JSON.stringify(box)}`);
    }
    boxes.push({ name, box });
  }

  // Single row => all 6 cells share (approximately) the same top y-coordinate.
  const tops = boxes.map((b) => b.box.y);
  const minTop = Math.min(...tops);
  const maxTop = Math.max(...tops);
  if (maxTop - minTop > 8) {
    fail(
      `partner cells are NOT in a single row at 1440px (top-y spread=${(maxTop - minTop).toFixed(1)}px, tolerance=8px): ${JSON.stringify(boxes)}`
    );
  }

  pass(`all 6 partner cells render in a single row at 1440px (top-y spread=${(maxTop - minTop).toFixed(1)}px)`);
});
