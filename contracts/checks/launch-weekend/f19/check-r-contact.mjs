#!/usr/bin/env node
// F19-A24 (R55 /contact): ContactForm autofill and accessibility. name and email carry autocomplete="name" / "email" (a tel field would take
// "tel"; the form has none and F19 adds no field); every text field and the textarea have a boundary of >= 3:1 against the surface behind
// it (WCAG 1.4.11, the hairline --rule is too faint for an input); the submit button is >= 44px tall; a short message gives an error
// element (role="alert", with an id) that the textarea names in aria-describedby together with its "Minimum 10 characters" hint and
// aria-invalid="true"; a polite status region (role="status") exists in the DOM BEFORE submit and carries the success message after a
// mocked 200. The shared VenueCard is not edited (check-j) and the contact list holds sourced mailboxes only (check-n). Mocks /api/contact.
// Usage: BASE_URL=http://localhost:3619 node contracts/checks/launch-weekend/f19/check-r-contact.mjs
import { VIEWPORTS, COLOR_SRC, launch, newPage, open, report, loadGolden } from './_lib.mjs';

const T = loadGolden('tokens.json').contact;
const problems = [];
const browser = await launch();
for (const vp of VIEWPORTS) {
  const { ctx, page } = await newPage(browser, vp);
  await open(page, '/contact');
  const m = await page.evaluate(`(() => {
    ${COLOR_SRC}
    const effBg = (el) => { const st = []; for (let n = el; n; n = n.parentElement) { const c = norm(getComputedStyle(n).backgroundColor); if (c.a > 0) { st.push(c); if (c.a >= 0.99) break; } } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (let i = st.length - 1; i >= 0; i--) acc = over(st[i], acc); return acc; };
    const form = document.querySelector('form'); const fields = [...form.querySelectorAll('input:not([name="_hp"]), textarea')];
    const btn = form.querySelector('button[type="submit"]');
    return { ac: Object.fromEntries(fields.map((f) => [f.name, f.getAttribute('autocomplete')])),
      boundary: fields.map((f) => { const cs = getComputedStyle(f); const surround = effBg(f.parentElement); const bc = over(norm(cs.borderTopColor), surround); return { name: f.name, w: parseFloat(cs.borderTopWidth), ratio: Math.round(ratio(bc, surround) * 100) / 100 }; }),
      btnH: btn.getBoundingClientRect().height, statusBefore: !!document.querySelector('main [role="status"]') };
  })()`);
  const tag = vp.name;
  if (m.ac.name !== 'name') problems.push(`${tag}: name field autocomplete is ${m.ac.name}, want "name"`);
  if (m.ac.email !== 'email') problems.push(`${tag}: email field autocomplete is ${m.ac.email}, want "email"`);
  for (const b of m.boundary) if (b.w < 1 || b.ratio < T.minBoundaryContrast) problems.push(`${tag}: ${b.name} boundary is ${b.ratio}:1 (${b.w}px), need ${T.minBoundaryContrast}:1`);
  if (m.btnH < T.buttonMinPx - 0.5) problems.push(`${tag}: submit button is ${Math.round(m.btnH)}px tall, want ${T.buttonMinPx}`);
  if (!m.statusBefore) problems.push(`${tag}: no role="status" live region in the DOM before submit`);
  await page.fill('#cf-name', 'Test Person'); await page.fill('#cf-email', 'test@example.com'); await page.fill('#cf-subject', 'Test'); await page.fill('#cf-message', 'short');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]', { timeout: 5000 }).catch(() => {});
  const err = await page.evaluate(() => { const a = document.querySelector('form [role="alert"]'); const t = document.querySelector('#cf-message'); return { alertId: a ? a.id : null, desc: t.getAttribute('aria-describedby'), invalid: t.getAttribute('aria-invalid'), hint: [...document.querySelectorAll('form p')].find((p) => /Minimum 10/.test(p.textContent))?.id || null }; });
  if (!err.alertId) problems.push(`${tag}: the error element has no id`);
  const ids = (err.desc || '').split(/\s+/);
  if (!err.alertId || !ids.includes(err.alertId)) problems.push(`${tag}: the message field's aria-describedby (${err.desc}) does not name the error element`);
  if (!err.hint || !ids.includes(err.hint)) problems.push(`${tag}: the message field's aria-describedby does not name the "Minimum 10 characters" hint`);
  if (err.invalid !== 'true') problems.push(`${tag}: the message field is not aria-invalid="true" after the error`);
  await page.route('**/api/contact', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.fill('#cf-message', 'A long enough message for the guard.');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
  const ok = await page.evaluate(() => { const s = document.querySelector('main [role="status"]'); return s ? s.textContent.replace(/\s+/g, ' ').trim() : null; });
  if (!ok || !/Thank you|reached/i.test(ok)) problems.push(`${tag}: the success message is not inside the role="status" region (${ok ? ok.slice(0, 40) : 'no region'})`);
  await ctx.close();
}
await browser.close();
report(problems, 'contact form has autocomplete, 3:1 field boundaries, a 44px button, describedby errors and a persistent status region');
