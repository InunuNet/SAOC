// =============================================================
// SAOC — e2e/nos-hub-tablet-order.spec.ts
// NOS Design H-a (P2): the NOS hub stacks the same way from 390 to 1023 — the photograph first,
// then the copy. At 768-1023 the photograph is a 2/1 band (the inner-page G2 ratio); below 768 it
// is the fixed 300px band. Measures bounding boxes on the rendered DOM, never a class name.
// =============================================================
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { nosBase } from './utils/site-urls';

const TABLET_WIDTHS = [768, 1023];
const PHONE_WIDTH = 390;
const VIEWPORT_HEIGHT = 900;
const BAND_ASPECT = 2;
const ASPECT_TOLERANCE = 0.01;
const SLOP_PX = 1;

async function heroBoxes(page: Page, baseURL: string, width: number) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto(`${nosBase(baseURL)}/`);
  const hero = page.locator('[data-nos-hero="hub"]');
  const media = hero.locator('[data-nos-hero-media]');
  const h1 = hero.locator('h1');
  await expect(media).toBeVisible();
  const [heroBox, mediaBox, h1Box] = await Promise.all([
    hero.boundingBox(),
    media.boundingBox(),
    h1.boundingBox(),
  ]);
  if (!heroBox || !mediaBox || !h1Box) throw new Error('hub hero, photo or h1 has no box');
  return { heroBox, mediaBox, h1Box };
}

test.describe('NOS hub — photo first below 1024px', () => {
  for (const width of TABLET_WIDTHS) {
    test(`at ${width}px the photo is a full-width 2/1 band above the h1`, async ({
      page,
      baseURL,
    }) => {
      const { heroBox, mediaBox, h1Box } = await heroBoxes(page, baseURL!, width);

      expect(mediaBox.y + mediaBox.height).toBeLessThanOrEqual(h1Box.y);
      expect(Math.abs(mediaBox.y - heroBox.y)).toBeLessThanOrEqual(SLOP_PX);
      expect(Math.abs(mediaBox.width - width)).toBeLessThanOrEqual(SLOP_PX);
      const aspect = mediaBox.width / mediaBox.height;
      expect(Math.abs(aspect - BAND_ASPECT) / BAND_ASPECT).toBeLessThanOrEqual(ASPECT_TOLERANCE);
    });
  }

  test(`at ${PHONE_WIDTH}px the photo is still above the h1`, async ({ page, baseURL }) => {
    const { heroBox, mediaBox, h1Box } = await heroBoxes(page, baseURL!, PHONE_WIDTH);

    expect(mediaBox.y + mediaBox.height).toBeLessThanOrEqual(h1Box.y);
    expect(Math.abs(mediaBox.y - heroBox.y)).toBeLessThanOrEqual(SLOP_PX);
  });
});
