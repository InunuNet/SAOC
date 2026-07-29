// A28 — UtilityBar tagline must be HIDDEN at 375px (below the md
// breakpoint) — the mirror check to A27. Scoped the same way, to the
// utility bar specifically, so a stray always-visible fix elsewhere
// (Header/Footer) can't make this pass by accident.
import { withPage, fail, pass } from './_shared.mjs';

await withPage({ width: 375, height: 300 }, async (page) => {
  const bar = page.locator('xpath=//a[starts-with(@href,"mailto:")]/parent::*').first();
  const tagline = bar.getByText('Making a difference since 1968', { exact: false });

  const count = await tagline.count();
  if (count === 0) {
    pass('utility-bar tagline not present in DOM at 375px (equivalent to hidden)');
  }

  const el = tagline.first();
  const display = await el.evaluate((e) => getComputedStyle(e).display);
  if (display !== 'none') {
    fail(`utility-bar tagline is visible (display=${display}) at 375px — should be hidden below the md breakpoint`);
  }

  pass(`utility-bar tagline correctly hidden at 375px — display=${display}`);
});
