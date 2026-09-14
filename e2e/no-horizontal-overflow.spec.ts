// =============================================================
// SAOC — e2e/no-horizontal-overflow.spec.ts
// Mission ticketing-complete M1/F7 — no page should ever cause horizontal page
// scroll. Measures REAL rendered geometry (document.documentElement.scrollWidth
// against the viewport width) — never a class-name proxy (matching against a
// component's own Tailwind class string) — that would be the component reading
// back its own claim as if that were verification.
//
// Widths: 390 and 1280 per the mission's own stated breakpoints; 1024 and 1050
// because that is the exact range where a REAL, LIVE defect was found when this
// spec was first written — the footer Subscribe button caused horizontal scroll
// at 1024-1050px (SAOC chrome). Team lead's own framing at the time: "a test
// suite that goes green on first run against a known-broken page is a suite that
// isn't looking." That footer bug has SINCE BEEN FIXED (components/chrome/
// Footer.tsx — a `min-w-0` added to the flex-1 email input, landed by the feature
// that owns that file; see contract-f7.yaml A8's description for the fix record)
// — all four widths below pass today. The 1024/1050 cases stay in the matrix
// deliberately, as regression cover for that specific defect class, not because
// they're still expected to fail.
import { expect, test } from '@playwright/test';

const WIDTHS = [390, 1024, 1050, 1280] as const;
const VIEWPORT_HEIGHT = 900;

// Chrome (Header/Footer) renders on every route via the root layout, so "/" is
// sufficient to exercise the shared shell this spec targets.
const PAGE_UNDER_TEST = '/';

async function measureOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });
}

test.describe('no horizontal overflow', () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto(PAGE_UNDER_TEST);
      await page.waitForLoadState('networkidle');

      const { scrollWidth, clientWidth } = await measureOverflow(page);

      expect(
        scrollWidth,
        `document.documentElement.scrollWidth (${scrollWidth}) exceeds the ${width}px ` +
          `viewport's clientWidth (${clientWidth}) — the page causes horizontal scroll`,
      ).toBeLessThanOrEqual(clientWidth);
    });
  }
});
