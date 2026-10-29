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

// NAV-1: link lists show an underline on focus, not a ring. The indicator is read from real computed
// style, in the shapes the header actually draws: a 2px bar on the label's ::after (triggers and plain
// links), a 2px text underline (panel rows, drawer rows), or an outline/box-shadow (controls). A bar or
// underline must be non-transparent and reach 3:1 (WCAG 1.4.11) against the ground it sits on, so
// removing the indicator, thinning it below 2px or making it invisible fails the test.
const MIN_INDICATOR_PX = 2;
const MIN_INDICATOR_CONTRAST = 3;

async function hasVisibleFocusIndicator(locator: import('@playwright/test').Locator) {
  const style = await locator.evaluate((el, minPx) => {
    const parse = (value: string) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ground = (node: Element) => {
      for (let n: Element | null = node; n; n = n.parentElement) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg && bg.a > 0) return bg;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const contrast = (fg: string, node: Element) => {
      const f = parse(fg);
      if (!f || f.a === 0) return 0;
      const [hi, lo] = [lum(f), lum(ground(node))].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const own = getComputedStyle(el);
    const outline =
      own.outlineStyle !== 'none' && own.outlineWidth !== '0px' ? { kind: 'outline', width: own.outlineWidth } : null;
    const shadow = own.boxShadow !== 'none' ? { kind: 'box-shadow', value: own.boxShadow } : null;
    let bar: Record<string, string | number> | null = null;
    let underline: Record<string, string | number> | null = null;
    for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
      const after = getComputedStyle(node, '::after');
      if (!bar && after.content !== 'none' && parseFloat(after.height) >= minPx) {
        const ratio = contrast(after.backgroundColor, node);
        if (ratio > 0) bar = { kind: 'bar', height: after.height, colour: after.backgroundColor, contrast: ratio };
      }
      const s = getComputedStyle(node);
      if (!underline && s.textDecorationLine.includes('underline') && parseFloat(s.textDecorationThickness) >= minPx) {
        const ratio = contrast(s.textDecorationColor, node);
        if (ratio > 0) underline = { kind: 'underline', thickness: s.textDecorationThickness, colour: s.textDecorationColor, contrast: ratio };
      }
    }
    return { outline, shadow, bar, underline };
  }, MIN_INDICATOR_PX);
  const drawn = [style.bar, style.underline].filter(
    (d): d is Record<string, string | number> => d !== null && Number(d.contrast) >= MIN_INDICATOR_CONTRAST,
  );
  return { style, visible: style.outline !== null || style.shadow !== null || drawn.length > 0 };
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
    const { style, visible } = await hasVisibleFocusIndicator(trigger);

    expect(
      visible,
      `expected a real focus indicator via getComputedStyle, got ${JSON.stringify(style)}`,
    ).toBe(true);

    // Negative control: the indicator is the focus state, not a standing mark (this trigger is not current).
    const stable = page.getByRole('button', { name: TRIGGER_NAME, exact: true });
    await stable.blur();
    expect((await hasVisibleFocusIndicator(stable)).visible, 'the indicator persists after blur').toBe(false);
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

    const { style, visible } = await hasVisibleFocusIndicator(itemInPanel);
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

      const { style, visible } = await hasVisibleFocusIndicator(link);
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
