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

// Mission menu-system-layout4 M2/F2: retargeted from the pre-Layout-4 three-mega
// shape's old trigger name to the single National Show mega trigger — see
// contract-f2.yaml's A5/A6. Tab order into the open panel runs lead -> groups ->
// feature rail (mission section 6 property 4) because that's the panel's real DOM
// order in components/chrome/MegaMenu.tsx; nothing here needs to special-case it.
const TRIGGER_NAME = 'National Show';

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
    const itemInPanel = page.locator(':focus');

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
