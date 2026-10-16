#!/usr/bin/env node
// F18-A30 (F18b): retired ticket URLs redirect, nothing 404s. goldens/f18b/v13-tokens.json lists the retired URLs (the bare /tickets listing, replaced by /national-show/tickets). Each answers a permanent
// redirect (308, or 301) whose Location is the new route, and following it ends on a 200 that carries the NOS chrome (header#nh). /tickets/cancelled keeps answering (not 404; /tickets/confirmation needs an order and is not probed),
// and no source file outside the redirect page links the bare /tickets (hrefs, nav-config, footer-data, sitemap), so nothing depends on the redirect.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-u-redirects.mjs   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { main, BASE, httpAuth } from './_lib.mjs';

const K = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-tokens.json', 'utf8'));

await main('F18-A30 retired ticket URLs redirect', async (r) => {
  for (const path of K.retired) {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual', headers: httpAuth() });
    if (![301, 308].includes(res.status)) r.fail(`${path}: HTTP ${res.status}, want a permanent redirect (308 or 301)`);
    const loc = res.headers.get('location') ?? '';
    if (!new URL(loc, BASE).pathname.startsWith(K.redirectTarget)) r.fail(`${path}: Location "${loc}" does not point at ${K.redirectTarget}`);
    const end = await fetch(`${BASE}${path}`, { redirect: 'follow', headers: httpAuth() });
    const html = await end.text();
    if (end.status !== 200) r.fail(`${path}: following the redirect ends on HTTP ${end.status}`);
    if (!html.includes('id="nh"')) r.fail(`${path}: the destination has no NOS header`);
  }
  for (const path of ['/tickets/cancelled']) {
    const res = await fetch(`${BASE}${path}`, { redirect: 'manual', headers: httpAuth() });
    if (res.status !== 200) r.fail(`${path}: HTTP ${res.status}, want 200 (the payment return page stays)`);
  }
  const files = execFileSync('git', ['ls-files', 'app', 'components', 'lib'], { encoding: 'utf8' }).split('\n').filter((f) => /\.(tsx?|json)$/.test(f) && f !== 'app/(marketing)/tickets/page.tsx');
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/href=\{?["'`]\/tickets["'`]\}?|\bhref:\s*['"]\/tickets['"]|url:\s*['"]\/tickets['"]|path:\s*['"]\/tickets['"]/.test(src)) r.fail(`${f}: still links the retired bare /tickets (link to ${K.redirectTarget})`);
  }
});
