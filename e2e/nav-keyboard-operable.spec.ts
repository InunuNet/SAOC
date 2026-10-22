// =============================================================
// SAOC — e2e/nav-keyboard-operable.spec.ts
// Mission ticketing-complete M3/F6 — keyboard operability, not hover-only. Per
// this repo's own coding.md accessibility rule ("every interactive element needs
// a label, role, and keyboard handler"), a dropdown that only opens on `:hover`
// is broken for keyboard and touch users. Exercises the National Orchid Show
// header's three disclosure groups (Visit / Programme / Exhibit & trade, NOS Design R1.2) via a
// real keyboard press — never `.hover()` as the only way a panel opens — and checks for a REAL
// visible-focus computed-style change (getComputedStyle), never a class-name proxy, matching F7's
// own A7 standard: "real geometry, not a class-name standing in for verification."
//
// Mission nos-site-split F3: the show is its own site (the NOS host), and its header's dropdowns
// are click-only disclosure list panels (aria-expanded on the trigger, Escape closes and returns
// focus). The SAOC header no longer has a dropdown to test.
//
// Codex cross-model review, 2026-09-10: the original version of this spec Tabbed once after
// opening the panel and asserted a focus ring existed, but never proved the focused element was
// actually INSIDE the open panel. An empty or unreachable panel would let Tab move straight to the
// next header control, that control has its own focus ring, and the assertion would pass — the
// "satisfiable by something that isn't the real property" defect class this repo audits for. So
// the focused element is asserted to be inside the open panel, and to be its FIRST link in DOM
// order, derived from NOS_NAV, not hardcoded.
import { expect, test } from '@playwright/test';

import { NOS_GROUPS, cleanHref } from './utils/nos-nav-hrefs';
import { nosBase } from './utils/site-urls';

const GROUP = NOS_GROUPS[0];
const TRIGGER_NAME = GROUP.heading;
const PANEL_HREFS = GROUP.links.map(cleanHref);
const FIRST_PANEL_HREF = PANEL_HREFS[0];

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

async function openNosHome(page: import('@playwright/test').Page, baseURL: string) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${nosBase(baseURL)}/`);
}

const panelLocator = (page: import('@playwright/test').Page) =>
  page.locator(`#nh-panel-${GROUP.id}`);

async function hasVisibleFocusRing(locator: import('@playwright/test').Locator) {
  const style = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
  });
  return {
    style,
    visible:
      (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none',
  };
}

test.describe('nav keyboard operability (NOS header)', () => {
  test('a group dropdown opens via Enter on its trigger (not hover-only)', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panelLocator(page)).toBeVisible();
  });

  test('a group dropdown opens via Space on its trigger (not hover-only)', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press(' ');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panelLocator(page)).toBeVisible();
  });

  test('hovering does not open a dropdown (click and keyboard only)', async ({ page, baseURL }) => {
    await openNosHome(page, baseURL!);

    await page.getByRole('button', { name: TRIGGER_NAME, exact: true }).hover();

    await expect(panelLocator(page)).toBeHidden();
  });

  test('the trigger shows a visible focus indicator via real computed style', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    const { style, visible } = await hasVisibleFocusRing(trigger);

    expect(
      visible,
      `expected a real focus indicator via getComputedStyle, got ${JSON.stringify(style)}`,
    ).toBe(true);
  });

  test('an item inside the open dropdown shows a visible focus indicator via real computed style', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Tab once more, into the now-open panel, onto its first link.
    await page.keyboard.press('Tab');

    const itemInPanel = panelLocator(page).locator(':focus');
    await expect(
      itemInPanel,
      `after opening the "${TRIGGER_NAME}" panel and pressing Tab, focus did not land inside it — ` +
        'an empty or unreachable panel would let Tab skip straight to the next header control',
    ).toHaveCount(1);

    const focusedHref = await itemInPanel.getAttribute('href');
    expect(
      focusedHref,
      `expected Tab to land on the first link in DOM order (${FIRST_PANEL_HREF}), got href=${focusedHref}`,
    ).toBe(FIRST_PANEL_HREF);

    const { style, visible } = await hasVisibleFocusRing(itemInPanel);
    expect(
      visible,
      `expected a real focus indicator via getComputedStyle, got ${JSON.stringify(style)}`,
    ).toBe(true);
  });

  test('Escape closes the dropdown and returns focus to the trigger', async ({ page, baseURL }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Tab'); // into the panel, so Escape must pull focus back out
    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('every link in the open panel shows a visible focus indicator, not just the first', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    expect(PANEL_HREFS.length).toBeGreaterThan(1);

    // Iterate the DOM anchors themselves, by position. Asserting the DOM anchor count equals the
    // NAV-derived count means this test cannot pass by rendering fewer anchors than the nav declares.
    const panelLinks = panelLocator(page).locator('a[href]');
    await expect(
      panelLinks,
      `panel DOM anchor count must equal the NAV-derived expected count (${PANEL_HREFS.length}) — ` +
        'a mismatch means this test is not walking every rendered anchor.',
    ).toHaveCount(PANEL_HREFS.length);

    const linkCount = await panelLinks.count();
    for (let i = 0; i < linkCount; i++) {
      const link = panelLinks.nth(i);
      const href = await link.getAttribute('href');
      await link.evaluate((el) => (el as HTMLElement).focus());
      await expect(link).toBeFocused();

      const { style, visible } = await hasVisibleFocusRing(link);
      expect(
        visible,
        `panel anchor #${i} (href=${href}) has no real focus indicator via getComputedStyle: ${JSON.stringify(style)}`,
      ).toBe(true);
    }
  });

  test('Tab past the last link leaves the panel (no focus trap) and closes it', async ({
    page,
    baseURL,
  }) => {
    await openNosHome(page, baseURL!);

    const trigger = await tabToAccessibleName(page, TRIGGER_NAME);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const panel = panelLocator(page);
    const lastLink = panel.locator('a[href]').last();
    await lastLink.evaluate((el) => (el as HTMLElement).focus());
    await expect(lastLink).toBeFocused();

    await page.keyboard.press('Tab');

    await expect(
      panel.locator(':focus'),
      'focus is still inside the open panel after tabbing past its last link — this is a focus trap',
    ).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening one group closes the one before it', async ({ page, baseURL }) => {
    await openNosHome(page, baseURL!);

    const first = page.getByRole('button', { name: NOS_GROUPS[0].heading, exact: true });
    const second = page.getByRole('button', { name: NOS_GROUPS[1].heading, exact: true });
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');

    await second.click();

    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
  });
});
