// Runs Lighthouse (mobile preset: simulated Slow 4G, 4x CPU) against one URL and prints LCP in ms and the LCP element.
// Usage: node lib-lcp-lighthouse.mjs <url>. Basic-auth credentials (beta wall) are read from BETA_BASIC_AUTH_USER/PASSWORD
// inside this script and never printed. Exit 0 always on a measurement; the caller decides pass/fail.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

// chrome-launcher finds no system Chrome on the dev machine: reuse Playwright's chromium (an explicit CHROME_PATH wins).
process.env.CHROME_PATH ??= chromium.executablePath();
const url = process.argv[2];
if (!url) { console.error('usage: lib-lcp-lighthouse.mjs <url>'); process.exit(2); }
// In-project scratch (sandbox rule): never the system temp dir.
const tmpRoot = process.env.LH_TMP ?? '.tmp/sandbox/sdc-lh'; mkdirSync(tmpRoot, { recursive: true });
const out = join(mkdtempSync(join(tmpRoot, 'lh-')), 'r.json');
const args = ['dlx', 'lighthouse@12.8.2', url, '--only-categories=performance', '--output=json', `--output-path=${out}`, '--quiet',
  '--chrome-flags=--headless=new --no-sandbox'];
const user = process.env.BETA_BASIC_AUTH_USER; const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
if (user && pass) args.push(`--extra-headers=${JSON.stringify({ Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') })}`);
const r = spawnSync('pnpm', args, { encoding: 'utf8', timeout: 240000 });
if (r.status !== 0) { console.error('lighthouse failed', (r.stderr || '').slice(-300).replaceAll(pass ?? '\u0000', '***')); process.exit(3); }
const j = JSON.parse(readFileSync(out, 'utf8'));
const lcp = j.audits['largest-contentful-paint'];
const fcp = j.audits['first-contentful-paint'];
console.log(JSON.stringify({ url, lcpMs: Math.round(lcp.numericValue), fcpMs: Math.round(fcp.numericValue), lcpElement: j.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120) ?? null, finalUrl: j.finalDisplayedUrl }));
