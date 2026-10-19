#!/usr/bin/env node
// A3 — the SAOC header's "National Show" item carries aria-current="page" on /national-show/* and not elsewhere.
// Applies only where the SAOC chrome renders (1280, inline nav). Once the NOS chrome owns /national-show/* (its own
// header class .nh) those routes are reported as SKIP, not failed: the NOS header sets its own aria-current.
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f2/check-c-aria-current.mjs
import { BASE, launch, newPage, open, report } from './_lib.mjs';

const ON = ['/national-show', '/national-show/tickets', '/national-show/faq', '/national-show/vendors'];
const OFF = ['/', '/societies', '/about', '/contact', '/events'];
const problems = [];
const browser = await launch();
let checkedOn = 0;
for (const route of [...ON, ...OFF]) {
  const { ctx, page } = await newPage(browser, { width: 1280, height: 900, isMobile: false });
  await open(page, route);
  const r = await page.evaluate(() => {
    if (document.querySelector('.nh')) return { nos: true };
    const trigger = [...document.querySelectorAll('header nav[aria-label="Primary"] button')].find((b) => b.textContent.trim() === 'National Show');
    const others = [...document.querySelectorAll('header nav[aria-label="Primary"] a,header nav[aria-label="Primary"] button')].filter((e) => e !== trigger && e.getAttribute('aria-current') === 'page').map((e) => e.textContent.trim());
    return { nos: false, found: !!trigger, current: trigger ? trigger.getAttribute('aria-current') : null, others };
  });
  if (r.nos) { console.log(`SKIP ${route}: NOS chrome renders here`); await ctx.close(); continue; }
  if (!r.found) { problems.push(`${route}: no "National Show" trigger in the primary nav`); await ctx.close(); continue; }
  if (ON.includes(route)) {
    checkedOn++;
    if (r.current !== 'page') problems.push(`${route}: National Show trigger aria-current is ${JSON.stringify(r.current)}, expected "page"`);
  } else if (r.current) problems.push(`${route}: National Show trigger has aria-current=${r.current} outside /national-show/*`);
  if (r.others.length) problems.push(`${route}: other primary-nav items gained aria-current (${r.others.join(', ')}) - out of F2's scope`);
  await ctx.close();
}
await browser.close();
report(problems, `National Show aria-current correct (${checkedOn} show routes checked, SAOC chrome) at ${BASE}`);
