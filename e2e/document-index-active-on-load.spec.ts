// =============================================================
// SAOC — e2e/document-index-active-on-load.spec.ts
// DocumentIndex marks a row as being read from the first paint: before any h2 has scrolled up to
// the spy line the first entry carries aria-current="location", and scrolling a later h2 past the
// line moves the mark to it. /privacy is a long legal document with a sticky index.
// =============================================================
import { expect, test } from '@playwright/test';

const ACTIVE = '[data-doc-index-link][aria-current="location"]';

test.describe('DocumentIndex active row', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the first entry is active on load', async ({ page }) => {
    await page.goto('/privacy');
    const links = page.locator('[data-doc-index-link]');
    await expect(links.first()).toHaveAttribute('aria-current', 'location');
    await expect(page.locator(ACTIVE)).toHaveCount(1);
  });

  test('scrolling a later section past the line moves the active row', async ({ page }) => {
    await page.goto('/privacy');
    // The on-load mark proves the index has hydrated and its scroll listener is attached.
    await expect(page.locator('[data-doc-index-link]').first()).toHaveAttribute('aria-current', 'location');
    const second = page.locator('[data-doc-index-link]').nth(1);
    const target = (await second.getAttribute('href'))?.slice(1);
    expect(target).toBeTruthy();
    // Put the heading just above the 140px spy line.
    await page.evaluate((id) => {
      const heading = document.getElementById(id as string);
      if (heading) window.scrollBy(0, heading.getBoundingClientRect().top - 100);
    }, target);
    await expect(second).toHaveAttribute('aria-current', 'location');
    await expect(page.locator(ACTIVE)).toHaveCount(1);
  });
});

// A click on a row lands its heading where the spy counts it as read, clear of the sticky chrome,
// with no further scrolling (html scroll-padding and the h2 scroll-margin must not stack).
for (const { name, viewport, chromeBottom } of [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, chromeBottom: 97 },
  { name: 'index bar below 1024', viewport: { width: 390, height: 844 }, chromeBottom: 97 + 48 },
]) {
  test.describe(`DocumentIndex click (${name})`, () => {
    test.use({ viewport });

    test('clicking the 3rd row makes it active straight away', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.locator('[data-doc-index-link]').first()).toHaveAttribute('aria-current', 'location');
      const third = page.locator('[data-doc-index-link]').nth(2);
      const id = (await third.getAttribute('href'))?.slice(1) as string;
      await third.click();
      await expect(third).toHaveAttribute('aria-current', 'location');
      await expect(page.locator(ACTIVE)).toHaveCount(1);
      const top = await page.evaluate((h) => document.getElementById(h)?.getBoundingClientRect().top ?? -1, id);
      expect(top).toBeGreaterThanOrEqual(chromeBottom);
    });
  });
}
