#!/usr/bin/env node
// A4 - /societies has a reserved-space Suspense fallback and layout shift stays under the budget at
// phone and desktop widths (static + runtime via Playwright chromium, BASE_URL).
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { BASE, report } from './_lib.mjs';

const problems = [];
const page_src = readFileSync('app/(marketing)/societies/page.tsx', 'utf8');
if (/<Suspense\s+fallback=\{null\}/.test(page_src)) problems.push('societies/page.tsx still has Suspense fallback={null}');
if (!/<Suspense\s+fallback=\{\s*</.test(page_src)) problems.push('societies/page.tsx Suspense has no element fallback');

const BUDGET = 0.05;
let browser;
try { browser = await chromium.launch(); } catch (e) { console.error(`INFRA: chromium unavailable (${e.message})`); process.exit(2); }
try {
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    try { await page.goto(`${BASE}/societies`, { waitUntil: 'commit' }); } catch (e) { console.error(`INFRA: ${e.message}`); process.exit(2); }
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const cls = await page.evaluate(() => window.__cls);
    if (cls > BUDGET) problems.push(`${name}: CLS ${cls.toFixed(3)} exceeds ${BUDGET}`);
    await ctx.close();
  }
} finally { await browser.close(); }
report(problems, 'societies fallback reserves space; CLS within budget at phone and desktop');
