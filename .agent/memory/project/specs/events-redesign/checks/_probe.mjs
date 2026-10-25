// nos-critique-r16 shared in-page measurement helpers (QA input, hash-locked). Colours are resolved by the browser itself (canvas), and
// painted measurements use viewport-coordinate clips (a viewport screenshot's clip is viewport-relative; nos-critique-r15 F2 R3 fix).
import { IN_PAGE_PIXELS, IN_PAGE_RESOLVE, ratio } from './_color.mjs';

export const resolve = (page, css, under) => page.evaluate(`(${IN_PAGE_RESOLVE})(${JSON.stringify(css)}, ${JSON.stringify(under)})`);

/** The opaque colour an element paints over: every ancestor background composited from the root down (white canvas first). */
export async function groundOf(page, locator) {
  const chain = await locator.evaluate((e) => { const out = []; for (let p = e.parentElement; p; p = p.parentElement) out.push(getComputedStyle(p).backgroundColor); return out.reverse(); });
  let bg = [255, 255, 255];
  for (const c of chain) bg = await resolve(page, c, bg);
  return bg;
}

/** The element's own background composited over its ground, and its text colour composited over that. */
export async function fillOf(page, locator) {
  const ground = await groundOf(page, locator);
  const s = await locator.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, fg: c.color }; });
  const bg = await resolve(page, s.bg, ground);
  const fg = await resolve(page, s.fg, bg);
  return { ground, bg, fg, css: s };
}

async function shot(page, box, pad) {
  const clip = { x: Math.max(0, Math.floor(box.x) - pad), y: Math.max(0, Math.floor(box.y) - pad), width: Math.ceil(box.width) + 2 * pad, height: Math.ceil(box.height) + 2 * pad };
  const png = await page.screenshot({ clip });
  return page.evaluate(`(${IN_PAGE_PIXELS})(${JSON.stringify(png.toString('base64'))})`);
}

/**
 * Keyboard focus indicator, as painted: the element is scrolled into view and captured unfocused, then focused in keyboard modality and
 * captured again (same viewport clip, `pad` px around it). Returns whether it matches :focus-visible, how many pixels changed OUTSIDE the
 * element's own box, and the best contrast of a changed outside pixel against the ground (the indicator must stand off the surface).
 */
export async function focusIndicator(page, locator, ground, pad = 6) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
  const box = await locator.boundingBox();
  const before = await shot(page, box, pad);
  await page.keyboard.press('Shift');
  await locator.evaluate((e) => e.focus({ preventScroll: true }));
  await page.waitForTimeout(250);
  const fv = await locator.evaluate((e) => e.matches(':focus-visible'));
  const box2 = await locator.boundingBox();
  const after = await shot(page, box2, pad);
  let changed = 0; let best = 1;
  if (after.w === before.w && after.h === before.h) {
    for (let y = 0; y < after.h; y++) for (let x = 0; x < after.w; x++) {
      const inside = x >= pad && x < after.w - pad && y >= pad && y < after.h - pad;
      if (inside) continue;
      const i = y * after.w + x; const a = after.px[i]; const b = before.px[i];
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
      changed += 1;
      best = Math.max(best, ratio(a, ground));
    }
  }
  await page.evaluate(() => document.activeElement?.blur());
  return { fv, changed, best, sameSize: after.w === before.w && after.h === before.h };
}
