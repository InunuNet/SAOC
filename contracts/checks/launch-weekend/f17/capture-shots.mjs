#!/usr/bin/env node
// Screenshots for the F17 self-critique loop. Names are fixed (check-j-critique-artefacts.mjs requires exactly this set).
// Usage: OUT=.tmp/sandbox/lw-f17/after NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3662 node --import tsx/esm contracts/checks/launch-weekend/f17/capture-shots.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = (process.env.NOS_BASE || 'http://localhost:3662').replace(/\/$/, '');
const OUT = process.env.OUT || '.tmp/sandbox/lw-f17/shots';
mkdirSync(OUT, { recursive: true });
const VPS = [['390', 390, 844, true], ['1280', 1280, 800, false], ['1920', 1920, 1080, false]];
const user = process.env.BETA_BASIC_AUTH_USER, pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const browser = await chromium.launch();
const shot = async (page, route, file, opts = {}) => {
  const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
  if (!res || res.status() >= 400) { console.error(`INFRA: ${route} HTTP ${res?.status()}`); process.exit(2); }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}`, ...opts });
};
for (const [name, width, height, mobile] of VPS) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, httpCredentials: user && pass ? { username: user, password: pass } : undefined });
  const page = await ctx.newPage();
  await shot(page, '/national-show', `${name}-hub.png`, { fullPage: true });
  await shot(page, '/national-show/sponsors', `${name}-sponsors.png`, { fullPage: true });
  await shot(page, '/national-show/tickets', `${name}-tickets.png`, { fullPage: true });
  if (name !== '1920') await shot(page, '/national-show/symposium', `${name}-symposium.png`, { fullPage: true });
  if (name === '1280') {
    await page.goto(`${BASE}/national-show`, { waitUntil: 'networkidle' });
    await page.locator('footer a[href="https://wildorchids.co.za"], #nf a[href="https://wildorchids.co.za"]').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/1280-footer.png` });
    const trigger = page.locator('.nh-nav button, .nh-nav [aria-haspopup]').filter({ hasText: /National Show/i }).first();
    if (await trigger.count()) { await trigger.hover(); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/1280-mega.png` }); }
  }
  if (name === '390') {
    await page.goto(`${BASE}/national-show`, { waitUntil: 'networkidle' });
    await page.locator('button[aria-controls="nd"]').first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/390-menu.png` });
    await page.goto(`${BASE}/national-show`, { waitUntil: 'networkidle' });
    await page.locator('footer a[href="https://wildorchids.co.za"], #nf a[href="https://wildorchids.co.za"]').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/390-footer.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(`shots written to ${OUT}`);
