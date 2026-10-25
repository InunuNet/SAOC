// F2 rendered (vendor application form, /vendors/apply on the NOS host) at 390@3, 768@1, 1280@1 and
// 1440@2. For every checkbox on the form:
//   TARGET   the control box is >=24 x 24 CSS px (WCAG 2.5.8) and its label row is >=44px tall
//   KEYBOARD after keyboard use, focus-visible draws a solid outline >=2px whose colour clears 3:1
//            against the ground (WCAG 1.4.11)
//   MOUSE    after a pointer click (focus without focus-visible) any box-shadow ring is also >=3:1
//            against the ground, or there is none (the weak ring-ink/40 shows here on baseline)
// Run as: node contracts/checks/polish-wave-2026-10-25/f2-a11y-rendered.mjs   (needs a current build)
import { contrast, finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['components/vendors/VendorCheckboxField.tsx', 'components/vendors/VendorCheckboxGroupField.tsx']);
if (stale.length) finish('f2-a11y-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];

const measure = (el) => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  };
  let ground = { r: 255, g: 255, b: 255 };
  for (let n = el.parentElement; n; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) { ground = c; break; }
  }
  const cs = getComputedStyle(el);
  const box = el.getBoundingClientRect();
  const row = (el.closest('label') ?? el).getBoundingClientRect();
  const shadow = cs.boxShadow === 'none' ? null : parse(cs.boxShadow.match(/rgba?\([^)]+\)/)?.[0] ?? '');
  return {
    w: box.width, h: box.height, rowH: row.height, ground,
    outline: { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: parse(cs.outlineColor) },
    shadow,
    focusVisible: el.matches(':focus-visible'),
  };
};
const over = (fg, bg) => ({
  r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
  g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
  b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
});

const srv = await startServer();
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(`http://nos.localhost:${srv.port}/vendors/apply`, { waitUntil: 'load', timeout: 30000 });
    const boxes = page.locator('input[type=checkbox]');
    const n = await boxes.count();
    if (n < 5) { failures.push(`${tag}: only ${n} checkboxes found on /vendors/apply (check cannot run)`); await ctx.close(); continue; }
    const worst = { size: 0, row: 0, kb: 0, mouse: 0 };
    for (let i = 0; i < n; i++) {
      const el = boxes.nth(i);
      await el.scrollIntoViewIfNeeded();
      await page.keyboard.press('Shift');
      await el.focus();
      const kb = await el.evaluate(measure);
      if (kb.w < 24 || kb.h < 24) worst.size += 1;
      if (kb.rowH < 44) worst.row += 1;
      const outlineOk = kb.focusVisible && kb.outline.style === 'solid' && kb.outline.width >= 2 && kb.outline.color
        && contrast(kb.outline.color, kb.ground) >= 3;
      if (!outlineOk) worst.kb += 1;
      await el.blur();
      await el.click({ position: { x: 2, y: 2 }, force: true });
      const mouse = await el.evaluate(measure);
      if (mouse.shadow && contrast(over(mouse.shadow, mouse.ground), mouse.ground) < 3) worst.mouse += 1;
    }
    if (worst.size) failures.push(`${tag}: ${worst.size}/${n} checkboxes are under 24x24`);
    if (worst.row) failures.push(`${tag}: ${worst.row}/${n} checkbox label rows are under 44px tall`);
    if (worst.kb) failures.push(`${tag}: ${worst.kb}/${n} checkboxes lack a >=3:1 solid keyboard focus outline`);
    if (worst.mouse) failures.push(`${tag}: ${worst.mouse}/${n} checkboxes show a pointer-focus ring under 3:1`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f2-a11y-rendered', failures);
