// A27 — UtilityBar tagline must be VISIBLE (not display:none) with a
// non-zero bounding box at 1440px. Scoped specifically to the utility bar
// (the div containing the mailto link), because the identical text
// "Making a difference since 1968" also appears in the Header subtitle
// and the Footer — an unscoped locator would pass even if the UtilityBar
// copy stayed display:none, as it did with the original `hidden
// md:inline-flex` bug (that Tailwind v4 class combination silently failed
// to compile in this project).
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 1440, height: 300 }, async (page) => {
  const bar = page.locator('xpath=//a[starts-with(@href,"mailto:")]/parent::*').first();
  const tagline = bar.getByText('Making a difference since 1968', { exact: false });

  const count = await tagline.count();
  if (count === 0) fail('utility-bar tagline element not found in DOM at 1440px');

  const el = tagline.first();
  const display = await el.evaluate((e) => getComputedStyle(e).display);
  if (display === 'none') {
    fail(`utility-bar tagline computed display is "none" at 1440px (class=${await el.getAttribute('class')})`);
  }

  const box = await el.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    fail(`utility-bar tagline bounding box is zero/null at 1440px: ${JSON.stringify(box)}`);
  }

  pass(`utility-bar tagline visible at 1440px — display=${display}, box=${JSON.stringify(box)}`);
});
