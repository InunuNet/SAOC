// F1a: footer newsletter error state on the dark footer (NOS Design ruling, option c). Token --status-error-on-dark #E8959D (6.62:1 on #22281f).
// A status summary on a dark ground is a 1px border plus the icon in the token, ivory text, and NO fill. The field in error takes the same border, aria-invalid and aria-describedby, and its focus ring stays ivory.
// Gate at 1440 and 390: summary text >=4.5:1, border and icon >=3:1 against the footer ground, no fill. The API is stubbed (page.route) to answer 400 {field:'email'}, so nothing is written anywhere.
import { withSite, openPage, check, finish, RGBA_FN, blend, ratio } from './lib.mjs';
const GROUND = [0x22, 0x28, 0x1f]; const TOKEN = [0xe8, 0x95, 0x9d]; const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);
const PROBE = `() => { const rgba = ${RGBA_FN}; const f = document.querySelector('footer'); const i = f.querySelector('input[type=email]'); const id = i.getAttribute('aria-describedby'); const box = id && document.getElementById(id);
  const side = (c, s) => ({ w: parseFloat(c['border' + s + 'Width']), st: c['border' + s + 'Style'], col: rgba(c['border' + s + 'Color']) });
  const out = { footer: rgba(getComputedStyle(f).backgroundColor), invalid: i.getAttribute('aria-invalid'), describedby: id, field: null, box: null };
  const ci = getComputedStyle(i); out.field = { top: side(ci, 'Top'), right: side(ci, 'Right'), bottom: side(ci, 'Bottom'), left: side(ci, 'Left') };
  if (box) { const c = getComputedStyle(box); const icon = box.querySelector('[aria-hidden="true"], svg'); const ic = icon && getComputedStyle(icon);
    out.box = { text: rgba(c.color), fill: rgba(c.backgroundColor), img: c.backgroundImage, sides: { top: side(c, 'Top'), right: side(c, 'Right'), bottom: side(c, 'Bottom'), left: side(c, 'Left') }, icon: ic ? rgba(ic.color) : null, iconFill: icon && icon.tagName.toLowerCase() === 'svg' ? rgba(ic.fill) : null, text_: box.textContent.trim().slice(0, 40) }; }
  return out; }`;
await withSite(async ({ base, browser, ctxOpts }) => {
  for (const width of [1440, 390]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width);
    await page.route('**/api/newsletter/subscribe', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Enter a valid email address.', field: 'email' }) }));
    const input = page.locator('footer input[type=email]'); const submit = page.locator('footer form button[type=submit]');
    await input.scrollIntoViewIfNeeded(); await page.waitForFunction(() => { const b = document.querySelector('footer form button[type=submit]'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
    await input.fill('not-an-email'); await submit.click(); await page.waitForTimeout(600);
    const r = await page.evaluate(`(${PROBE})()`); const w = `@${width}`;
    const ground = r.footer.slice(0, 3); check(same(ground, GROUND), `${w}: footer ground rgb(${ground.map(Math.round)}) is not the ruled #22281f the token was measured on`);
    check(r.invalid === 'true', `${w}: field in error has no aria-invalid="true"`);
    check(Boolean(r.box), `${w}: field in error has no aria-describedby pointing at the rendered error element (${r.describedby})`);
    const sides = Object.values(r.field);
    check(sides.every((s) => s.w >= 1 && s.st !== 'none' && same(s.col.slice(0, 3), TOKEN)), `${w}: field in error border is not 1px+ in #E8959D (${JSON.stringify(sides.map((s) => [s.w, s.st, s.col.slice(0, 3).map(Math.round)]))})`);
    if (r.box) {
      const b = r.box; const bs = Object.values(b.sides);
      check(bs.every((s) => s.w === 1 && s.st === 'solid' && same(s.col.slice(0, 3), TOKEN)), `${w}: summary border is not 1px solid #E8959D on every side (${JSON.stringify(bs.map((s) => [s.w, s.st, s.col.slice(0, 3).map(Math.round)]))})`);
      check(b.fill[3] === 0 && b.img === 'none', `${w}: summary has a fill (background ${b.fill}, image ${b.img}); on a dark ground it is border plus icon, never a filled panel`);
      const tx = ratio(blend(b.text, ground), ground); check(tx >= 4.5, `${w}: summary text ${tx.toFixed(2)}:1 on the footer, want >=4.5:1`);
      check(Math.min(b.text[0], b.text[1], b.text[2]) >= 220, `${w}: summary text rgb(${b.text.slice(0, 3).map(Math.round)}) is not ivory`);
      check(Boolean(b.icon), `${w}: summary has no aria-hidden icon element`);
      if (b.icon) { check(same(b.icon.slice(0, 3), TOKEN), `${w}: icon colour rgb(${b.icon.slice(0, 3).map(Math.round)}) is not #E8959D`); const ic = ratio(blend(b.icon, ground), ground); check(ic >= 3, `${w}: icon ${ic.toFixed(2)}:1 on the footer, want >=3:1`); }
      const bd = ratio(blend(bs[0].col, ground), ground); check(bd >= 3, `${w}: summary border ${bd.toFixed(2)}:1 on the footer, want >=3:1`);
    }
    // The field is focused after an error; its ring stays ivory (the one ring on a dark ground).
    const ring = await page.evaluate(`(() => { const rgba = ${RGBA_FN}; const i = document.querySelector('footer input[type=email]'); i.focus(); const c = getComputedStyle(i); return { w: c.outlineWidth, s: c.outlineStyle, o: c.outlineOffset, col: rgba(c.outlineColor) }; })()`);
    await page.keyboard.press('Shift');
    check(ring.s === 'solid' && ring.w === '2px' && ring.o === '3px' && Math.min(ring.col[0], ring.col[1], ring.col[2]) >= 220, `${w}: focus ring in the error state is ${ring.w} ${ring.s} offset ${ring.o} rgb(${ring.col.slice(0, 3).map(Math.round)}), want 2px solid offset 3px ivory`);
    await ctx.close();
  }
});
finish('newsletter-error');
