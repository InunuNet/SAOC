#!/usr/bin/env node
// A5: the Ozow test-mode strip is for verified admins only. (1) Runtime, public: even with the status API mocked enabled:true, and with a
// forged session cookie, no "TEST MODE" / "R0.01" text renders (DOM and raw server HTML) on every ticket route. (2) Decision: the
// lib/admin-viewer.ts wrapper returns true only for { ok:true } from the injected session resolver and false for every refusal reason and
// for a throw (fail closed). (3) Static: the only admin authority used is getAdminSession (no cookie parsing, no firebase-admin/auth,
// no allowlist read in ticket files); the hub and TicketPurchaseForm render the banner only behind the admin flag; the banner box is
// in-flow inside its container (no w-screen / left-1/2 / translate / fixed / absolute / sticky) so it is no longer clipped at x=-7.
// The admin-positive render cannot be driven without a real admin session; (2) and (3) are its proof, and QA verifies once on beta.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-e-testmode.mts
import { readFileSync } from 'node:fs';
import { BASE, VIEWPORTS, httpCredentials, launch, newPage, loadGolden, report } from './_lib.mjs';

const T = loadGolden('tokens.json').banner;
const ROUTES = ['/national-show/tickets', '/national-show/conferences', '/national-show/workshops', '/tickets', '/tickets/day-visitor', '/tickets/early-bird'];
const problems: string[] = [];
const STRIP = /TEST MODE|Ozow charges|R0\.01/i;

const browser = await launch();
for (const route of ROUTES) {
  for (const vp of [VIEWPORTS[1], VIEWPORTS[0]]) {
    for (const forged of [false, true]) {
      const { ctx, page } = await newPage(browser, vp);
      if (forged) await ctx.addCookies([{ name: 'session', value: 'forged.invalid.session', url: BASE }]);
      await page.route('**/api/tickets/ozow-sandbox-test-mode', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true }) }));
      const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => null);
      const tag = `${route} @${vp.name}${forged ? ' (forged session)' : ''}`;
      if (!res || res.status() >= 400) { problems.push(`${tag}: HTTP ${res ? res.status() : 'none'}`); await ctx.close(); continue; }
      await page.waitForTimeout(500);
      if (STRIP.test(await page.evaluate(() => document.body.innerText))) problems.push(`${tag}: the test-mode strip renders for a non-admin`);
      if (!forged && vp.name === '1280') {
        const raw = await (await fetch(`${BASE}${route}`, { headers: httpCredentials ? { authorization: `Basic ${Buffer.from(`${httpCredentials.username}:${httpCredentials.password}`).toString('base64')}` } : {} })).text();
        if (STRIP.test(raw)) problems.push(`${route}: the strip text is in the raw server HTML`);
      }
      await ctx.close();
    }
  }
}
await browser.close();

// (2) decision
try {
  const { viewerIsVerifiedAdmin } = await import('../../../../lib/admin-viewer.ts');
  const ok = { ok: true, decodedToken: {} };
  if ((await viewerIsVerifiedAdmin(async () => ok as never)) !== true) problems.push('admin-viewer: { ok:true } did not resolve to true');
  for (const reason of ['no-session', 'invalid-session', 'no-claim', 'email-unverified', 'not-allowlisted']) {
    if ((await viewerIsVerifiedAdmin(async () => ({ ok: false, reason }) as never)) !== false) problems.push(`admin-viewer: refusal "${reason}" resolved to true`);
  }
  if ((await viewerIsVerifiedAdmin(async () => { throw new Error('boom'); })) !== false) problems.push('admin-viewer: a throwing resolver did not fail closed');
} catch (e) {
  problems.push(`lib/admin-viewer.ts is missing or does not load: ${(e as Error).message.split('\n')[0]}`);
}

// (3) static
const read = (f: string) => { try { return readFileSync(f, 'utf8'); } catch { problems.push(`missing file ${f}`); return ''; } };
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const viewer = strip(read('lib/admin-viewer.ts'));
if (!/getAdminSession/.test(viewer) || !/from '\.\/admin-auth'/.test(viewer)) problems.push('lib/admin-viewer.ts must delegate to getAdminSession from lib/admin-auth');
for (const f of ['lib/admin-viewer.ts', 'app/(marketing)/national-show/tickets/page.tsx', 'components/tickets/CategoryTicketsPage.tsx', 'components/tickets/TicketPurchaseForm.tsx', 'components/tickets/OzowSandboxTestModeBanner.tsx']) {
  const t = strip(read(f));
  if (/firebase-admin\/auth|verifySessionCookie|verifyIdToken|cookies\(|ADMIN_EMAIL_ALLOWLIST|isAdminToken/.test(t)) problems.push(`${f}: a second admin auth path (cookie, token or allowlist read) was added`);
}
const hub = strip(read('app/(marketing)/national-show/tickets/page.tsx'));
if (!/viewerIsVerifiedAdmin/.test(hub) || !/isAdmin\s*\?\s*<OzowSandboxTestModeBanner/.test(hub)) problems.push('hub: the banner must render only behind the verified-admin flag');
const form = strip(read('components/tickets/TicketPurchaseForm.tsx'));
if (!/showTestModeBanner\s*=\s*false/.test(form) || !/showTestModeBanner\s*\?\s*<OzowSandboxTestModeBanner/.test(form)) problems.push('TicketPurchaseForm: the banner must default off and render only when showTestModeBanner is true');
for (const f of ['components/tickets/CategoryTicketsPage.tsx', 'app/(marketing)/tickets/[slug]/page.tsx']) if (!/showTestModeBanner=\{/.test(read(f)) || !/viewerIsVerifiedAdmin/.test(read(f))) problems.push(`${f}: must pass showTestModeBanner from viewerIsVerifiedAdmin()`);
const ban = read('components/tickets/OzowSandboxTestModeBanner.tsx');
const cls: string = (ban.match(/className="([^"]*)"/) || [])[1] || '';
for (const bad of T.forbiddenClasses) if (cls.includes(bad)) problems.push(`banner className still has "${bad}" (breaks out of its container)`);
if (!/\bw-full\b|\bblock\b/.test(cls)) problems.push('banner className needs w-full or block (fill its container)');
if (!/enabled\s*===\s*true/.test(ban) || !/ozow-sandbox-test-mode/.test(ban)) problems.push('banner must still be driven by the status API with enabled === true (F3 static guard)');
if (/OzowSandboxTestModeBanner/.test(read('components/vendors/VendorStandPaymentForm.tsx')) === false) problems.push('vendor form was altered (out of scope)');

report(problems, 'no strip for any non-admin on six ticket routes, fail-closed admin decision, single auth path, in-container banner');
