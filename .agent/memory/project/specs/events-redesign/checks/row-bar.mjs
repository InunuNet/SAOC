// events-redesign row hover/focus check (added by @dev after QA found the accent bar never rendered; static.mjs only reads class strings).
// A real linked row needs a live non-show event, which neither dataset gives, so this takes the ROW/BAR/title class strings
// straight from components/events/EventCard.tsx, builds `<a class="group ...">` in the built preview page (the compiled CSS is the
// real one) and measures the computed result:
//   R1  ::before opacity is 0 at rest, 1 on hover, 1 on keyboard focus (:focus-visible)
//   R2  the bar colour against the page background is >= 3:1 (WCAG 1.4.11 non-text contrast)
//   R3  the title underlines on hover and on focus-visible, at 2px thickness
//   R4  no outline ring and no background tint on the row at hover or focus
import { finish, readRepoFile } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const WIDTHS = [1280, 768, 390];
const MIN_BAR_CONTRAST = 3;
const SETTLE_TIMEOUT_MS = 3000;
const POLL_MS = 100;
const failures = [];
let checks = 0;

const source = readRepoFile('components/events/EventCard.tsx') ?? '';
const classesOf = (name) => {
  const body = (source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]\\.join`)) ?? [])[1] ?? '';
  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]).join(' ');
};
const rowClasses = classesOf('ROW_CLASSES');
const barClasses = classesOf('BAR_CLASSES');
const titleClasses = (source.match(/linked \? ' ([^']*)'/) ?? [])[1] ?? '';
if (!rowClasses || !barClasses || !titleClasses) failures.push('could not read ROW_CLASSES / BAR_CLASSES / the linked title classes from EventCard.tsx');

const luminance = (rgb) => {
  const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Polls until the 150ms bar transition lands (or the timeout passes), so a cold first page load cannot read a mid-transition 0.
const settled = async (locator) => {
  for (let waited = 0; waited < SETTLE_TIMEOUT_MS; waited += POLL_MS) {
    if ((await locator.evaluate(probe)).barOpacity === '1') break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return locator.evaluate(probe);
};

const probe = (el) => {
  const row = getComputedStyle(el);
  const title = getComputedStyle(el.querySelector('span'));
  return {
    barOpacity: getComputedStyle(el, '::before').opacity,
    barColor: getComputedStyle(el, '::before').backgroundColor,
    underline: title.textDecorationLine,
    thickness: title.textDecorationThickness,
    outline: row.outlineStyle,
    rowBg: row.backgroundColor,
    pageBg: getComputedStyle(document.body).backgroundColor,
  };
};

if (!failures.length) {
  const srv = await serve(MODES[1]);
  if (srv.failures) failures.push(...srv.failures);
  else {
    const browser = await chromium.launch();
    try {
      for (const width of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
        const page = await ctx.newPage();
        await page.goto(`${srv.origin}/events`, { waitUntil: 'networkidle' });
        const injected = await page.evaluate(([row, bar, title]) => {
          const anchor = document.querySelector('[data-event-row]');
          if (!anchor) return false;
          const a = document.createElement('a');
          a.href = '#row-bar-probe';
          a.id = 'row-bar-probe';
          a.className = `group ${row} ${bar}`;
          a.innerHTML = `<span class="${title}">Probe</span>`;
          anchor.parentElement.prepend(a);
          return true;
        }, [rowClasses, barClasses, titleClasses]);
        checks += 1;
        const at = (m) => `@${width}: ${m}`;
        if (!injected) { failures.push(at('no [data-event-row] on /events to anchor the probe (preview shows placeholder rows)')); await ctx.close(); continue; }
        const probeRow = page.locator('#row-bar-probe');
        const rest = await probeRow.evaluate(probe);
        if (rest.barOpacity !== '0') failures.push(at(`R1 bar opacity at rest is ${rest.barOpacity}, want 0`));
        await probeRow.hover();
        const hover = await settled(probeRow);
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await probeRow.focus();
        const focus = await settled(probeRow);
        focus.focusVisible = await probeRow.evaluate((el) => el.matches(':focus-visible'));
        checks += 3;
        if (hover.barOpacity !== '1') failures.push(at(`R1 bar opacity on hover is ${hover.barOpacity}, want 1`));
        if (!focus.focusVisible) failures.push(at('R1 probe row is not :focus-visible after keyboard focus'));
        if (focus.barOpacity !== '1') failures.push(at(`R1 bar opacity on focus-visible is ${focus.barOpacity}, want 1`));
        const ratio = contrast(hover.barColor, hover.pageBg);
        if (ratio < MIN_BAR_CONTRAST) failures.push(at(`R2 bar ${hover.barColor} on ${hover.pageBg} is ${ratio.toFixed(2)}:1, want >= ${MIN_BAR_CONTRAST}:1`));
        for (const [state, s] of [['hover', hover], ['focus-visible', focus]]) {
          if (!s.underline.includes('underline')) failures.push(at(`R3 title is not underlined on ${state}`));
          if (s.thickness !== '2px') failures.push(at(`R3 title underline thickness on ${state} is ${s.thickness}, want 2px`));
          if (s.outline !== 'none') failures.push(at(`R4 row has an outline (${s.outline}) on ${state}`));
          if (s.rowBg !== 'rgba(0, 0, 0, 0)') failures.push(at(`R4 row has a background tint (${s.rowBg}) on ${state}`));
        }
        if (width === WIDTHS[0]) console.log(`bar ${hover.barColor} on ${hover.pageBg}: ${ratio.toFixed(2)}:1`);
        await ctx.close();
      }
    } finally {
      await browser.close();
      await srv.stop();
    }
  }
}
finish('row-bar.mjs', failures, `row bar/focus checks green (${checks} measurements, ${WIDTHS.join('/')}).`);
