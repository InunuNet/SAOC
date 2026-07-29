// A33 — D8: the footer's "Judging & Awards" Explore-nav link must be
// VISIBLE (A16/A17 only grep source text, which a CSS-hiding or dead-code
// bug — the same class of defect QA found in A14 — would still satisfy).
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 900 }, async (page) => {
  const link = page.locator('footer').getByRole('link', { name: 'Judging & Awards', exact: true }).first();
  if ((await link.count()) === 0) fail('"Judging & Awards" link not found inside <footer> in rendered DOM');

  const display = await link.evaluate((e) => getComputedStyle(e).display);
  if (display === 'none') fail('footer "Judging & Awards" link computed display is "none"');

  const box = await link.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    fail(`footer "Judging & Awards" link bounding box is zero/null: ${JSON.stringify(box)}`);
  }

  const href = await link.getAttribute('href');
  if (href !== '/judging') fail(`footer "Judging & Awards" link points to unexpected href: ${href}`);

  pass(`footer "Judging & Awards" link is visible — box=${JSON.stringify(box)} href=${href}`);
});
