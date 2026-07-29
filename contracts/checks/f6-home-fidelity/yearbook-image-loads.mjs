// A34 — D3: the swapped-in orchid-purple.jpg image must actually load
// (naturalWidth > 0), not just be present as a source string (A6 only
// greps the src attribute in source — a typo'd path or a 404'd asset
// would still satisfy that grep).
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 1200 }, async (page) => {
  const img = page.locator('img[src*="orchid-purple"]').first();
  if ((await img.count()) === 0) fail('no <img> with src containing "orchid-purple" found in rendered DOM');

  const naturalWidth = await img.evaluate((e) => e.naturalWidth);
  const complete = await img.evaluate((e) => e.complete);
  if (!complete || naturalWidth === 0) {
    fail(`yearbook image failed to load — complete=${complete} naturalWidth=${naturalWidth}`);
  }

  pass(`yearbook image loaded successfully — naturalWidth=${naturalWidth}`);
});
