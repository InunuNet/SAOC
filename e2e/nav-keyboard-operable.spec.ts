// =============================================================
// SAOC — e2e/nav-keyboard-operable.spec.ts
// Mission ticketing-complete M3/F6 — keyboard operability, not hover-only. Per
// this repo's own coding.md accessibility rule ("every interactive element needs
// a label, role, and keyboard handler"), a dropdown that only opens on `:hover`
// is broken for keyboard and touch users. Exercises components/chrome/MegaMenu.tsx
// (reused for the Visit / Programme / Exhibit & Trade group triggers) via a real
// keyboard press — never `.hover()` as the only way the panel opens — and checks
// for a REAL visible-focus computed-style change (getComputedStyle), never a
// class-name proxy, matching F7's own A7 standard: "real geometry, not a
// class-name standing in for verification."
import { expect, test } from '@playwright/test';

import { NAV, type NavItem } from '@/components/chrome/nav-config';

// Mission menu-system-layout4 M2/F2: retargeted from the pre-Layout-4 three-mega
// shape's old trigger name to the single National Show mega trigger — see
// contract-f2.yaml's A5/A6. Tab order into the open panel runs lead -> groups ->
// feature rail (mission section 6 property 4) because that's the panel's real DOM
// order in components/chrome/MegaMenu.tsx; nothing here needs to special-case it.
const TRIGGER_NAME = 'National Show';

// Codex cross-model review, 2026-09-10: the original version of this spec Tabbed
// once after opening the panel and asserted a focus ring existed, but never
// proved the focused element was actually INSIDE the open panel. An empty or
// unreachable panel would let Tab move straight to the next header control
// (e.g. Contact), that control has its own focus ring, and the old assertion
// would pass — the exact "satisfiable by something that isn't the real
// property" defect class this repo audits for.
//
// Fixed by asserting two things instead: (1) the focused element is a
// descendant of the open `role="menu"` panel, and (2) it is specifically the
// FIRST focusable leaf in the panel's real DOM order. That order is derived
// from NAV here (mirroring MegaMenu.tsx's render order exactly: lead.leadHref
// is always a <Link>; lead.theShow.headingHref and each column's headingHref
// render as a <Link> only when non-null, else a plain <span>; every leaf link
// is always a <Link>; featureRail.ctaHref is always a <Link>), not hardcoded —
// @qa independently drove this by hand and recorded the same order: lead ->
// theShow -> Visit -> Programme -> Exhibit & Trade -> feature rail. Today that
// resolves to lead.leadHref ('/national-show'), since theShow.headingHref is
// null and lead.leadHref is the panel's first rendered anchor.
function focusableHrefsInPanelOrder(item: Extract<NavItem, { type: 'mega' }>): string[] {
  const hrefs: string[] = [];
  if (item.lead) {
    hrefs.push(item.lead.leadHref);
    if (item.lead.theShow.headingHref) hrefs.push(item.lead.theShow.headingHref);
    for (const link of item.lead.theShow.links) hrefs.push(link.href);
  }
  for (const column of item.columns) {
    if (column.headingHref) hrefs.push(column.headingHref);
    for (const link of column.links) hrefs.push(link.href);
  }
  if (item.featureRail) hrefs.push(item.featureRail.ctaHref);
  return hrefs;
}

const NATIONAL_SHOW_ITEM = NAV.find(
  (item): item is Extract<NavItem, { type: 'mega' }> =>
    item.type === 'mega' && item.label === TRIGGER_NAME,
);
if (!NATIONAL_SHOW_ITEM) {
  throw new Error(`nav-config.ts has no mega item labelled "${TRIGGER_NAME}" — update TRIGGER_NAME`);
}
const FIRST_PANEL_HREF = focusableHrefsInPanelOrder(NATIONAL_SHOW_ITEM)[0];
if (!FIRST_PANEL_HREF) {
  throw new Error(`"${TRIGGER_NAME}" mega has no focusable leaf at all — nothing for Tab to reach`);
}

// Tabs forward from the top of the document until an element with the given
// accessible name is focused, or the attempt budget runs out. Avoids hardcoding
// a fixed tab-index count, which would break the moment an earlier focusable
// element is added or removed.
async function tabToAccessibleName(page: import('@playwright/test').Page, name: string) {
  await page.locator('body').click({ position: { x: 0, y: 0 } });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const accessibleName = await focused.evaluate((el) => el.textContent?.trim() ?? '');
    if (accessibleName === name) {
      return focused;
    }
  }
  throw new Error(`could not reach an element named "${name}" by tabbing`);
}

test.describe('nav keyboard operability', () => {
  test('National Show group dropdown opens via Enter on its trigger (not hover-only)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('menu', { name: TRIGGER_NAME });
    await expect(panel).toBeVisible();
  });

  test('National Show group dropdown opens via Space on its trigger (not hover-only)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press(' ');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByRole('menu', { name: TRIGGER_NAME });
    await expect(panel).toBeVisible();
  });

  test('the trigger shows a visible focus indicator via real computed style', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);

    const focusedStyle = await trigger.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    });

    const hasVisibleFocusRing =
      (focusedStyle.outlineStyle !== 'none' && focusedStyle.outlineWidth !== '0px') ||
      focusedStyle.boxShadow !== 'none';

    expect(
      hasVisibleFocusRing,
      `expected a real focus indicator via getComputedStyle, got ${JSON.stringify(focusedStyle)}`,
    ).toBe(true);
  });

  test('an item inside the open dropdown shows a visible focus indicator via real computed style', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Tab once more, into the now-open panel, onto its first link.
    await page.keyboard.press('Tab');

    // Assert the focused element is actually a descendant of the OPEN panel —
    // not merely that something focusable exists somewhere. An empty panel
    // would let this Tab land on the next header control instead; that
    // control lying outside `panel` is exactly what this catches.
    const panel = page.getByRole('menu', { name: TRIGGER_NAME });
    const itemInPanel = panel.locator(':focus');
    await expect(
      itemInPanel,
      'after opening the "National Show" panel and pressing Tab, focus did not land inside it — ' +
        'an empty or unreachable panel would let Tab skip straight to the next header control',
    ).toHaveCount(1);

    // Assert WHICH link — the first focusable leaf in the panel's real DOM
    // order, derived from NAV above, not hardcoded.
    const focusedHref = await itemInPanel.getAttribute('href');
    expect(
      focusedHref,
      `expected Tab to land on the first focusable leaf in DOM order (${FIRST_PANEL_HREF}), got href=${focusedHref}`,
    ).toBe(FIRST_PANEL_HREF);

    const focusedStyle = await itemInPanel.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    });

    const hasVisibleFocusRing =
      (focusedStyle.outlineStyle !== 'none' && focusedStyle.outlineWidth !== '0px') ||
      focusedStyle.boxShadow !== 'none';

    expect(
      hasVisibleFocusRing,
      `expected a real focus indicator via getComputedStyle, got ${JSON.stringify(focusedStyle)}`,
    ).toBe(true);
  });

  test('Escape closes the dropdown and returns focus to the trigger', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
});
