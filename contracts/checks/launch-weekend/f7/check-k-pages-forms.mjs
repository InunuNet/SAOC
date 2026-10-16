#!/usr/bin/env node
// F7c-C1 - R45 /societies, R46 /judging, R47 footer newsletter, R48 /members form. Copy is existing strings only:
// the checks assert structure, not new wording. Needs Sanity-backed societies and awards (else exit 2, not a pass).
import { BASE, firstSocietyHref, withBrowser, open, report } from './_lib.mjs';

const problems = [];
const MIN_BODY_PX = 15;
const rgb = (c) => c.match(/[\d.]+/g).map(Number);

await withBrowser(async (ctx) => {
  const page = await ctx.newPage();

  // ---- R45 /societies ----
  await open(page, '/societies');
  try { await page.waitForSelector('a[href^="/societies/"]', { timeout: 10_000 }); } catch { console.error('INFRA: no societies rendered'); process.exit(2); }
  const search = page.getByRole('searchbox').or(page.locator('input[aria-label="Search societies"]')).first();
  const sid = await search.getAttribute('id');
  const placeholder = await search.getAttribute('placeholder');
  const labelText = sid ? await page.evaluate((id) => { const l = document.querySelector(`label[for="${id}"]`); return l && l.getClientRects().length ? l.textContent.trim() : null; }, sid) : null;
  if (!labelText) problems.push('/societies: search input has no visible <label for>');
  else if (placeholder && labelText !== placeholder.trim()) problems.push(`/societies: visible label "${labelText}" does not reuse the placeholder string "${placeholder}"`);
  const bc = await search.evaluate((e) => { const cs = getComputedStyle(e); const bg = cs.backgroundColor; return [cs.borderTopColor, bg, cs.borderTopWidth]; });
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const [a, b] = [L(rgb(bc[0])), L(rgb(bc[1]))];
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  if (ratio < 3 || parseFloat(bc[2]) < 1) problems.push(`/societies: search border ${ratio.toFixed(2)}:1 (needs >= 3:1, WCAG 1.4.11)`);
  const live = page.locator('[aria-live="polite"], [role="status"]').filter({ hasText: /\d/ }).first();
  if (!(await live.count())) problems.push('/societies: no polite live region carrying a result count');
  else {
    const before = (await live.innerText()).trim();
    await search.fill('zzzz-no-such-society');
    await page.waitForTimeout(600);
    const after = (await page.locator('[aria-live="polite"], [role="status"]').allInnerTexts()).join(' ').trim();
    if (!after || after === before) problems.push('/societies: live region text did not change when the filter changed');
    if (!/No societies match your filters/.test(await page.locator('main').innerText())) problems.push('/societies: the existing no-results copy is missing');
    await search.fill('');
  }
  if (/\best\.\s*\d{4}/i.test(await page.locator('main').innerText())) problems.push('/societies: "est. YYYY" still displayed (render "Founded YYYY")');
  const slug = await firstSocietyHref(page);
  if (slug) { await open(page, slug); if (/\best\.\s*\d{4}/i.test(await page.locator('main').innerText())) problems.push(`${slug}: "est. YYYY" still displayed`); }

  // province chips: full names >= 481px, abbreviations <= 480px
  const chips = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Filter by province"] button')].map((b) => ({ text: b.innerText.trim(), name: b.getAttribute('aria-label') || '' })));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/societies'); await page.waitForSelector('[aria-label="Filter by province"] button');
  for (const c of await chips()) if (c.name && c.text !== c.name) problems.push(`/societies at 1280: chip shows "${c.text}", want the full name "${c.name}"`);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/societies'); await page.waitForSelector('[aria-label="Filter by province"] button');
  const small = await chips();
  if (!small.some((c) => c.name && c.text !== c.name)) problems.push('/societies at 390: no chip shows an abbreviation (abbreviations stay at <= 480px)');
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- R46 /judging ----
  await open(page, '/judging');
  const order = await page.evaluate(() => {
    const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => ({ l: Number(h.tagName[1]), t: h.textContent.trim() }));
    const codes = [...document.querySelectorAll('main p')].map((p) => p.textContent.trim()).filter((t) => /^(FCC|AM|HCC|CCM|CBR|JC)\b/.test(t)).map((t) => t.split(/\s/)[0]);
    return { hs, codes };
  });
  let prev = 0;
  for (const h of order.hs) { if (prev && h.l > prev + 1) problems.push(`/judging: heading jumps h${prev} -> h${h.l} ("${h.t}")`); prev = h.l; }
  for (const t of ['Overview', 'How judging works', 'SAOC awards']) if (!order.hs.some((h) => h.l === 2 && h.t.toLowerCase() === t.toLowerCase())) problems.push(`/judging: "${t}" is not a real h2`);
  if (!order.codes.length) { console.error('INFRA: no award codes rendered on /judging'); process.exit(2); }
  const rank = ['FCC', 'AM', 'HCC'];
  const firstOther = order.codes.findIndex((c) => !rank.includes(c));
  const top = order.codes.slice(0, firstOther < 0 ? undefined : firstOther);
  if (top.join() !== rank.filter((c) => order.codes.includes(c)).join()) problems.push(`/judging: ranked awards are ${top.join(', ')} (want FCC, AM, HCC by points)`);
  if (order.codes.some((c) => !rank.includes(c)) && !/Other awards/i.test(await page.locator('main').innerText())) problems.push('/judging: CCM/CBR/JC are not under an "Other awards" group label');
  if (!(await page.locator('main table caption, main dl').filter({ hasText: /FCC|Fellow|Certificate|Award of Merit/i }).count())) problems.push('/judging: award ladder is not a captioned table or definition list');
  const small2 = await page.evaluate((min) => [...document.querySelectorAll('main p')].filter((p) => p.textContent.trim().length >= 60 && parseFloat(getComputedStyle(p).fontSize) < min).map((p) => p.textContent.trim().slice(0, 40)), MIN_BODY_PX);
  if (small2.length) problems.push(`/judging: ${small2.length} prose block(s) under ${MIN_BODY_PX}px: ${small2.join(' | ')}`);

  // ---- R47 footer newsletter ----
  await open(page, '/');
  const nl = page.locator('footer input[type="email"]').first();
  if (!(await nl.count())) problems.push('footer: newsletter email input not found');
  else {
    if ((await nl.getAttribute('autocomplete')) !== 'email') problems.push('footer newsletter: autocomplete="email" missing (1.3.5)');
    const nid = await nl.getAttribute('id');
    const vis = nid ? await page.evaluate((id) => { const l = document.querySelector(`label[for="${id}"]`); return l && l.getClientRects().length ? l.textContent.trim() : null; }, nid) : null;
    if (!vis) problems.push('footer newsletter: no visible <label for>');
    else if (vis !== (await nl.getAttribute('placeholder') || '').trim()) problems.push(`footer newsletter: visible label "${vis}" does not reuse the placeholder string`);
  }

  // ---- R48 /members ----
  await open(page, '/members');
  for (const [n, want] of [['name', 'name'], ['email', 'email']]) {
    const f = page.locator(`form input[name="${n}"]`).first();
    if (!(await f.count())) problems.push(`/members: input[name="${n}"] not found`);
    else if ((await f.getAttribute('autocomplete')) !== want) problems.push(`/members: ${n} field autocomplete="${await f.getAttribute('autocomplete')}" (want ${want}, 1.3.5)`);
  }
});
report(problems, `R45-R48 page and form items hold at ${BASE}`);
