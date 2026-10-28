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
  // TOPIC error (interim treatment while NEWSLETTER_COPY.genericError is unsourced placeholder copy, withheld under no-invention): the sr-only role=alert (announced) plus a 1px --status-error-on-dark outline on the
  // invalid checkbox, which carries aria-invalid and aria-describedby the alert. No visible summary, no fill. Uncheck the only topic and submit; no request is made (client-side), nothing is written.
  const TOPIC = `() => { const rgba = ${RGBA_FN}; const f = document.querySelector('footer'); const cb = f.querySelector('input[type=checkbox]'); const id = cb.getAttribute('aria-describedby'); const al = id && document.getElementById(id); const c = getComputedStyle(cb);
    const out = { footer: rgba(getComputedStyle(f).backgroundColor), invalid: cb.getAttribute('aria-invalid'), describedby: id, checked: cb.checked, out: { w: c.outlineWidth, s: c.outlineStyle, col: rgba(c.outlineColor) }, cbFill: rgba(c.backgroundColor), alert: null };
    if (al) { const a = getComputedStyle(al), r = al.getBoundingClientRect(); out.alert = { role: al.getAttribute('role'), text: al.textContent.trim(), hiddenAttr: al.hidden || al.closest('[aria-hidden="true"]') !== null, display: a.display, visibility: a.visibility, srOnly: r.width <= 1 && r.height <= 1, fill: rgba(a.backgroundColor), img: a.backgroundImage, borderW: parseFloat(a.borderTopWidth) + parseFloat(a.borderLeftWidth) }; }
    return out; }`;
  for (const width of [1440, 390]) {
    const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width); const w = `topic @${width}`;
    const cb = page.locator('footer input[type=checkbox]').first(); const submit = page.locator('footer form button[type=submit]');
    await cb.scrollIntoViewIfNeeded(); await page.waitForFunction(() => { const b = document.querySelector('footer form button[type=submit]'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
    await cb.uncheck(); await submit.click(); await page.waitForTimeout(600);
    await page.evaluate(() => document.activeElement && document.activeElement.blur()); // resting state: the outline must show without focus
    const r = await page.evaluate(`(${TOPIC})()`); const ground = r.footer.slice(0, 3);
    check(!r.checked, `${w}: the topic checkbox is still checked, the empty-topics path was not reached`);
    check(r.invalid === 'true', `${w}: invalid topic checkbox has no aria-invalid="true"`);
    check(Boolean(r.alert), `${w}: topic checkbox aria-describedby (${r.describedby}) does not point at a rendered alert`);
    check(r.out.s === 'solid' && parseFloat(r.out.w) === 1 && same(r.out.col.slice(0, 3), TOKEN), `${w}: invalid topic checkbox outline is ${r.out.w} ${r.out.s} rgb(${r.out.col.slice(0, 3).map(Math.round)}), want 1px solid #E8959D`);
    check(ratio(blend(r.out.col, ground), ground) >= 3, `${w}: topic outline ${ratio(blend(r.out.col, ground), ground).toFixed(2)}:1 on the footer, want >=3:1`);
    check(r.cbFill[3] === 0, `${w}: invalid topic checkbox has a fill (background ${r.cbFill})`);
    if (r.alert) {
      const a = r.alert; check(a.role === 'alert', `${w}: topic error role is "${a.role}", want alert (announced)`);
      check(a.text.length > 0 && !a.hiddenAttr && a.display !== 'none' && a.visibility !== 'hidden', `${w}: topic alert is empty, aria-hidden or display:none, so it is not announced (text "${a.text.slice(0, 30)}", display ${a.display})`);
      check(a.srOnly, `${w}: while the copy is withheld the topic alert must be sr-only (1px box); a visible summary needs sourced copy`);
      check(a.fill[3] === 0 && a.img === 'none', `${w}: topic alert has a fill (${a.fill}, ${a.img})`);
    }
    await ctx.close();
  }
  // SEQUENTIAL cases (Codex A7 finding at b69f13c2): the topic-error branch left emailInvalid set, so the email field kept aria-invalid="true" with no aria-describedby target. A fresh page cannot see that, so each
  // order is driven on one page: (1) invalid email, then the only topic unchecked; (2) the only topic unchecked, then an invalid email with a topic checked. Neither field may keep a stale invalid state or a dangling describedby.
  const STATE = `() => { const f = document.querySelector('footer'); const st = (el) => { const id = el.getAttribute('aria-describedby'); const t = id && document.getElementById(id); return { invalid: el.getAttribute('aria-invalid') === 'true', describedby: id, target: Boolean(t), text: t ? t.textContent.trim().slice(0, 30) : '' }; };
    return { email: st(f.querySelector('input[type=email]')), topic: st(f.querySelector('input[type=checkbox]')) }; }`;
  for (const width of [1440, 390]) {
    for (const order of ['email-then-topic', 'topic-then-email']) {
      const { page, ctx } = await openPage(browser, ctxOpts, base, '/about', width); const w = `${order} @${width}`;
      await page.route('**/api/newsletter/subscribe', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Enter a valid email address.', field: 'email' }) }));
      const input = page.locator('footer input[type=email]'); const cb = page.locator('footer input[type=checkbox]').first(); const submit = page.locator('footer form button[type=submit]');
      await input.scrollIntoViewIfNeeded(); await page.waitForFunction(() => { const b = document.querySelector('footer form button[type=submit]'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
      const emailError = async () => { await input.fill('not-an-email'); await submit.click(); await page.waitForTimeout(500); };
      const topicError = async () => { if (await cb.isChecked()) await cb.uncheck(); await submit.click(); await page.waitForTimeout(500); };
      const read = async () => page.evaluate(`(${STATE})()`);
      if (order === 'email-then-topic') {
        await emailError(); const a = await read(); check(a.email.invalid && a.email.target, `${w}: precondition, the invalid email did not produce an email error state (${JSON.stringify(a.email)})`);
        await topicError(); const r = await read();
        check(!r.email.invalid && !(r.email.describedby && !r.email.target), `${w}: after the topic error the email field keeps a stale state: aria-invalid=${r.email.invalid}, aria-describedby=${r.email.describedby} (target rendered: ${r.email.target})`);
        check(r.topic.invalid && r.topic.target, `${w}: topic error state is not present (${JSON.stringify(r.topic)})`);
      } else {
        await topicError(); const a = await read(); check(a.topic.invalid && a.topic.target, `${w}: precondition, unchecking the only topic did not produce a topic error state (${JSON.stringify(a.topic)})`);
        await cb.check(); await emailError(); const r = await read();
        check(r.email.invalid && r.email.target, `${w}: the invalid email did not produce an email error state after a topic error (${JSON.stringify(r.email)})`);
        check(!r.topic.invalid && !(r.topic.describedby && !r.topic.target) && !(await page.locator('footer [role=alert]').count()), `${w}: the topic error state did not clear: aria-invalid=${r.topic.invalid}, aria-describedby=${r.topic.describedby}, alerts left=${await page.locator('footer [role=alert]').count()}`);
      }
      await ctx.close();
    }
  }
});
finish('newsletter-error');
