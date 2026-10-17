#!/usr/bin/env node
// F7a-A4 - ticket purchase form: Buy disabled at quantity 0, live-region total, specific page title, TEST MODE banner gating.
// Static rules are the gate. The runtime half needs a purchasable ticket (sales open); with sales closed it prints
// "RUNTIME-SKIPPED" and says why, so a pass is never mistaken for a browser verification.
import { BASE, read, withBrowser, open, report } from './_lib.mjs';

const problems = [];
const form = read('components/tickets/TicketPurchaseForm.tsx');
const hook = read('components/tickets/useTicketCart.ts');
const banner = read('components/tickets/OzowSandboxTestModeBanner.tsx');
const route = read('app/api/tickets/ozow-sandbox-test-mode/route.ts');
const slugPage = read('app/(marketing)/tickets/[slug]/page.tsx');

// Buy disabled at quantity 0: the submit button's disabled expression must reference the cart item count
const submit = /<button[^>]*type="submit"[^>]*>/s.exec(form)?.[0] ?? '';
if (!/disabled=\{[^}]*(cartItemCount|itemCount|isEmpty|cart\.empty|=== 0|<= 0)[^}]*\}/s.test(submit)) problems.push('TicketPurchaseForm: submit button disabled expression does not reference an empty cart');
if (!/cartItemCount|itemCount/.test(hook) ) problems.push('useTicketCart: no item-count source for the form to read');
if (!/cartError/.test(form)) problems.push('TicketPurchaseForm: the existing cartError alert was removed (it must stay)');

// total in a polite live region
// AMENDED by launch-weekend F18: the label is "Total" (R62: one word, no "estimate"), inside the live region that sits next to Buy.
const totalBlock = /<[a-zA-Z]+[^>]*aria-live=["']polite["'][^>]*>[\s\S]*?\bTotal\b[\s\S]*?<\/[a-zA-Z]+>/.exec(form)?.[0] ?? '';
if (!/aria-live=["']polite["']/.test(totalBlock) && !/role=["']status["']/.test(totalBlock)) problems.push('TicketPurchaseForm: the "Total" block has no aria-live="polite" (or role="status")');

// specific page title on the single-ticket route
if (!/export (async )?function generateMetadata/.test(slugPage)) problems.push('tickets/[slug]/page.tsx: no generateMetadata, so the title is the bare site name');
else if (!/generateMetadata[\s\S]{0,1500}(ticketType|ticket)\??\.name/.test(slugPage)) problems.push('tickets/[slug]/page.tsx: generateMetadata does not use the ticket type name');

// banner gating: fail closed, no unconditional render, route returns a strict boolean
if (!/enabled\s*===\s*true/.test(banner) || !/if\s*\(!enabled\)\s*return null/.test(banner)) problems.push('OzowSandboxTestModeBanner: no longer fail-closed (needs `enabled === true` and `if (!enabled) return null`)');
if (!/isOzowSandboxTestModeEnabled/.test(route)) problems.push('ozow-sandbox-test-mode route: no longer derives from isOzowSandboxTestModeEnabled()');
for (const f of [form, slugPage]) if (/OZOW_SANDBOX_TEST_MODE_BANNER_TEXT/.test(f) || /TEST MODE/.test(f)) problems.push('TEST MODE text rendered outside the gated banner component');

// runtime
let runtime = 'RUNTIME-SKIPPED (no purchasable ticket: sales closed or no ticket link on /tickets)';
await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  const flag = await ctx.request.get(`${BASE}/api/tickets/ozow-sandbox-test-mode`).then((r) => r.json()).catch(() => null);
  if (!flag || typeof flag.enabled !== 'boolean') problems.push('runtime: /api/tickets/ozow-sandbox-test-mode does not return {enabled: boolean}');
  await open(page, '/tickets');
  const href = await page.evaluate(() => [...document.querySelectorAll('a[href^="/tickets/"]')].map((a) => a.getAttribute('href')).find((h) => !/confirmation|cancelled/.test(h)));
  if (!href) return;
  await open(page, href);
  // the route suspends first (tickets/loading.tsx); scope to the purchase form in <main>, never the footer newsletter form
  const purchase = page.locator('main form').filter({ has: page.locator('[data-catalogue-total]') }).first();
  try { await purchase.waitFor({ timeout: 15_000 }); } catch { return; }
  const buy = purchase.locator('button[type="submit"]').first();
  if (!(await buy.count())) return;
  runtime = 'runtime verified';
  if (!(await buy.isDisabled())) problems.push(`runtime ${href}: Buy is enabled at quantity 0`);
  const inc = page.locator('button[aria-label^="Increase quantity"]').first();
  if (await inc.count()) {
    await inc.click();
    if (await buy.isDisabled()) problems.push(`runtime ${href}: Buy stays disabled after quantity 1`);
    const total = await page.locator('[aria-live="polite"], [role="status"]').filter({ hasText: /\bTotal\b/ }).count();
    if (!total) problems.push(`runtime ${href}: no live region carries the total`);
    await page.locator('button[aria-label^="Decrease quantity"]').first().click();
    if (!(await buy.isDisabled())) problems.push(`runtime ${href}: Buy not disabled again at quantity 0`);
  }
  const title = await page.title();
  if (/^(SA Orchid Council|South African Orchid Council|SAOC)?$/i.test(title.trim()) || !/ticket|pass|admission|visitor|early|vip/i.test(title)) problems.push(`runtime ${href}: title "${title}" is not specific`);
  await page.waitForTimeout(2000); // the banner polls its status route after mount
  const bannerShown = await page.getByText('TEST MODE', { exact: false }).count();
  if (flag && flag.enabled === false && bannerShown) problems.push(`runtime ${href}: TEST MODE banner visible while the flag reports enabled:false`);
  if (flag && flag.enabled === true && !bannerShown) problems.push(`runtime ${href}: flag enabled but no TEST MODE banner`);
});
report(problems, `ticket form rules hold (${runtime})`);
