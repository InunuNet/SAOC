// nos-critique-r20 F1 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Golden: goldens/f1-edits.json. Both modes, 1280 and 390, on NOS routes (golden `routes`); the NOS footer (#nf) is
// shared by every NOS page.
//   R1  WCAG 1.4.11: the email input's computed border colour is rgba(210, 203, 232, 0.55) on all four sides, still 1px solid with a 10px
//       radius (only the alpha changed); the border as drawn (composited over the input's own ground when its background is clipped to the
//       border box, then over the footer) has >= 3:1 contrast against the footer's computed background.
//   R2  WCAG 1.3.5 / 4.1.2: the input has type=email, name=email, autocomplete=email, required, no aria-label; exactly one <label> labels it,
//       reading the golden "Email address", and the textbox's accessible name (role lookup, exact) is that text.
//   R3  the label is visible, above the input, on the input's left edge, and its computed type equals the footer's label role (the
//       "Stay in touch" .nf-head): family, size, weight, line-height, letter-spacing, transform, colour; and it sits 6px (+-1) above the
//       input, SAOC's label mb-1.5 (Codi FINAL 2026-10-22: the NOS column gaps take SAOC Footer.tsx's exact values).
//   R4  at 1280 and 390 the input and the button share one row (same top +-1px, button right of the input; r20 F5 item 1 retired the
//       >=701px stacked form). The footer's grid and boxes are F3's (f3-rendered.mjs).
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const G = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const LABEL_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color'];
const LABEL_GAP = 6;
const failures = [];
let checks = 0;
const near = (a, b) => Math.abs(a - b) <= 1;
const BORDER = { borderWidth: '1px', borderStyle: 'solid', radius: '10px' };

const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
const lum = (c) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const measure = (page) => page.evaluate(({ LABEL_PROPS }) => {
  const nf = document.querySelector('footer#nf');
  if (!nf) return null;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
  const input = nf.querySelector('.nf-form input');
  const button = nf.querySelector('.nf-form button');
  const heads = [...nf.querySelectorAll('.nf-col-touch > .nf-head')];
  const roleHead = heads.find((h) => h.tagName !== 'LABEL') ?? null;
  const cs = (el, list) => (el ? Object.fromEntries(list.map((p) => [p, getComputedStyle(el).getPropertyValue(p)])) : null);
  const ics = input ? getComputedStyle(input) : null;
  const labels = input && input.labels ? [...input.labels] : [];
  const label = labels[0] ?? null;
  return {
    footerBg: getComputedStyle(nf).backgroundColor,
    input: input ? {
      ...box(input), type: input.getAttribute('type'), name: input.getAttribute('name'), autocomplete: input.getAttribute('autocomplete'),
      required: input.required, ariaLabel: input.getAttribute('aria-label'), id: input.id,
      border: ['top', 'right', 'bottom', 'left'].map((s) => ics.getPropertyValue(`border-${s}-color`)),
      borderWidth: ics.borderTopWidth, borderStyle: ics.borderTopStyle, radius: ics.borderTopLeftRadius, bg: ics.backgroundColor, clip: ics.backgroundClip,
    } : null,
    button: box(button),
    labels: labels.map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
    label: label ? { ...box(label), style: cs(label, LABEL_PROPS), visible: getComputedStyle(label).visibility !== 'hidden' && getComputedStyle(label).display !== 'none' } : null,
    roleStyle: cs(roleHead, LABEL_PROPS),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, { LABEL_PROPS });

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const route of G.routes) {
        checks += 1;
        const at = `${mode} ${route} @${width}`;
        const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); continue; }
        await page.evaluate(async () => { await document.fonts.ready; });
        const m = await measure(page);
        if (!m || !m.input) { failures.push(`${at}: no NOS footer sign-up input (INFRA)`); continue; }
        const i = m.input;

        // R1
        for (const [k, c] of i.border.entries()) if (c !== G.borderColor) failures.push(`${at}: input border ${['top', 'right', 'bottom', 'left'][k]} colour ${c}, want ${G.borderColor} (R1)`);
        for (const k of Object.keys(BORDER)) if (i[k] !== BORDER[k]) failures.push(`${at}: input ${k} ${i[k]}, want ${BORDER[k]} as at BASE (R1)`);
        const ground = rgba(m.footerBg);
        const border = rgba(i.border[0]);
        if (!ground || ground.a !== 1 || !border) failures.push(`${at}: footer background ${m.footerBg} / border ${i.border[0]} not measurable (R1)`);
        else {
          const under = i.clip === 'border-box' ? over(rgba(i.bg), ground) : ground;
          const drawn = over(border, under);
          const cr = ratio(drawn, ground);
          if (cr < 3) failures.push(`${at}: input border ${cr.toFixed(2)}:1 against the footer ${m.footerBg}, want >= 3:1 (R1)`);
        }

        // R2
        if (i.type !== 'email' || i.name !== 'email' || i.autocomplete !== 'email' || !i.required) failures.push(`${at}: input type=${i.type} name=${i.name} autocomplete=${i.autocomplete} required=${i.required}, want email/email/email/required (R2)`);
        if (i.ariaLabel !== null) failures.push(`${at}: the input still has aria-label ${JSON.stringify(i.ariaLabel)} (R2)`);
        if (m.labels.length !== 1 || m.labels[0] !== G.label) failures.push(`${at}: input labels ${JSON.stringify(m.labels)}, want exactly ["${G.label}"] (R2)`);
        const named = await page.locator('footer#nf').getByRole('textbox', { name: G.label, exact: true }).count();
        if (named !== 1) failures.push(`${at}: ${named} textboxes in the footer named exactly "${G.label}", want 1 (R2)`);

        // R3
        if (!m.label || !m.label.visible || m.label.w < 1 || m.label.h < 1) failures.push(`${at}: the label is not visible (R3)`);
        else {
          if (m.label.y + m.label.h > i.y + 0.5) failures.push(`${at}: the label (bottom ${Math.round(m.label.y + m.label.h)}) is not above the input (top ${Math.round(i.y)}) (R3)`);
          if (!near(i.y - (m.label.y + m.label.h), LABEL_GAP)) failures.push(`${at}: the label sits ${(i.y - (m.label.y + m.label.h)).toFixed(1)}px above the input, want ${LABEL_GAP} (R3)`);
          if (!near(m.label.x, i.x)) failures.push(`${at}: label left ${Math.round(m.label.x)}px, input left ${Math.round(i.x)}px (R3)`);
          if (!m.roleStyle) failures.push(`${at}: no "Stay in touch" .nf-head to compare with (R3)`);
          else for (const p of LABEL_PROPS) if (m.label.style[p] !== m.roleStyle[p]) failures.push(`${at}: label ${p} ${m.label.style[p]}, the label role (.nf-head) ${m.roleStyle[p]} (R3)`);
        }

        // R4
        if (!m.button) failures.push(`${at}: no submit button (R4)`);
        else if (!near(m.button.y, i.y) || m.button.x < i.x + i.w - 0.5) failures.push(`${at}: input (${Math.round(i.x)},${Math.round(i.y)}) and button (${Math.round(m.button.x)},${Math.round(m.button.y)}) are not side by side (R4)`);

        if (m.overflow > 0) failures.push(`${at}: scrolls horizontally by ${m.overflow}px (R4)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${checks} NOS footer captures (${MODES.join('/')}, ${WIDTHS.join('/')}): border alpha .55 at >= 3:1, name/autocomplete email, a visible nf-head label names the input, side by side at 1280 and 390.`);
