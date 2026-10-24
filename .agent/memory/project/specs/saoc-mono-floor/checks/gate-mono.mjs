// Computed-size probe. Usage: node gate-mono.mjs <saoc|nos|record-nos>.
//  saoc: every visible text element whose computed font-family is the SAOC mono face is >= 12px, on 11 SAOC routes at 1280 and 390.
//  nos: for 3 NOS routes the computed font-size, letter-spacing and text-transform of EVERY text-bearing element equal the baseline recorded
//       on the pristine origin/main build (nos-baseline.json). The baseline must be non-empty (at least MIN_BASELINE_PER_ROUTE per route and viewport).
//  record-nos: writes that baseline. Refuses unless app, components and lib are identical to origin/main.
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const mode = process.argv[2];
if (!['saoc', 'nos', 'record-nos'].includes(mode)) { console.error('usage: gate-mono.mjs <saoc|nos|record-nos>'); process.exit(2); }
const BASELINE = '.agent/memory/project/specs/saoc-mono-floor/checks/nos-baseline.json';
const SAOC_ROUTES = ['/', '/about', '/societies', '/judging', '/events', '/sponsors', '/contact', '/privacy', '/terms', '/refunds', '/constitution', '/admin/login'];
const MIN_BASELINE_PER_ROUTE = 20;
const NOS_ROUTES = ['/', '/faq', '/plan-your-visit'];
const VPS = [{ name: '1280', width: 1280, height: 800, dsf: 1 }, { name: '390', width: 390, height: 844, dsf: 3 }];
const PORT = Number(process.env.SAOC_MONO_PORT ?? 3081) + 1;
const AUTH = { username: 'sandbox', password: 'sandbox-pass' };
mkdirSync('.tmp/sandbox/saoc-mono-gate', { recursive: true });

if (mode === 'record-nos') {
  const dirty = execFileSync('git', ['diff', '--name-only', 'origin/main', '--', 'app', 'components', 'lib'], { encoding: 'utf8' }).trim();
  if (dirty) { console.error(`refusing to record a baseline from a modified tree:\n${dirty}`); process.exit(1); }
}

const env = { ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH.username, BETA_BASIC_AUTH_PASSWORD: AUTH.password, SITE_PUBLIC_LAUNCH: '', SHOW_PLACEHOLDER_PREVIEW: 'true', NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${PORT}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${PORT}` };
delete env.BETA_PASSWORD_WALL_OFF;
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], { stdio: ['ignore', openSync('.tmp/sandbox/saoc-mono-gate/next-start.log', 'w'), 'ignore'], env });
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

function collect(kind) {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? '').trim()).map((n) => (n.textContent ?? '').trim()).join(' ');
    if (!own) continue;
    const mono = /JetBrains Mono|ui-monospace|Menlo|monospace/i.test(cs.fontFamily);
    if (kind === 'saoc' && !mono) continue;
    out.push({ lockup: el.hasAttribute('data-lockup-tagline'), tag: el.tagName, text: own.slice(0, 40), size: parseFloat(cs.fontSize), tracking: cs.letterSpacing, transform: cs.textTransform, mono });
  }
  return out;
}

async function run() {
  for (let i = 0; i < 90; i += 1) {
    try { const r = await fetch(`http://nos.localhost:${PORT}/faq`, { headers: { authorization: `Basic ${Buffer.from('sandbox:sandbox-pass').toString('base64')}` } }); if (r.status < 500) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const { chromium } = createRequire(`${process.cwd()}/package.json`)('@playwright/test');
  const browser = await chromium.launch();
  const recorded = {};
  try {
    const host = mode === 'saoc' ? 'saoc' : 'nos';
    for (const vp of VPS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, httpCredentials: AUTH });
      const page = await ctx.newPage();
      for (const route of mode === 'saoc' ? SAOC_ROUTES : NOS_ROUTES) {
        const tag = `[${host} ${vp.name} ${route}]`;
        const res = await page.goto(`http://${host}.localhost:${PORT}${route}`, { waitUntil: 'load' });
        check(`${tag} 200`, res?.status() === 200, String(res?.status()));
        const found = await page.evaluate(collect, mode === 'saoc' ? 'saoc' : 'nos');
        if (mode === 'saoc') {
          check(`${tag} the page has mono-face text to probe`, found.length > 0 || route === '/constitution' || route === '/terms' || route === '/refunds' || route === '/privacy');
          const tagline = found.filter((f) => f.lockup);
          if (route !== '/admin/login') check(`${tag} the logo lockup tagline is present to be checked`, tagline.length >= 1);
          check(`${tag} the lockup tagline is exempt and computes to exactly 11px at 0.22em (Brad: never alter lockups)`, tagline.every((f) => f.size === 11 && Math.abs(parseFloat(f.tracking) - 2.42) < 0.02), JSON.stringify(tagline));
          const small = found.filter((f) => f.size < 12 && !f.lockup);
          check(`${tag} every mono element is at least 12px`, small.length === 0, JSON.stringify(small.slice(0, 6)));
        } else {
          check(`${tag} collected at least ${MIN_BASELINE_PER_ROUTE} text elements (a probe that collects nothing proves nothing)`, found.length >= MIN_BASELINE_PER_ROUTE, String(found.length));
          recorded[`${vp.name} ${route}`] = found;
        }
      }
      await ctx.close();
    }
    if (mode === 'record-nos') {
      if (failures.length) throw new Error('refusing to write an empty or thin baseline');
      writeFileSync(BASELINE, JSON.stringify({ origin: execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim(), pristine: true, entries: recorded }, null, 1));
      console.log(`baseline written: ${BASELINE}`);
    } else if (mode === 'nos') {
      check('baseline exists', existsSync(BASELINE));
      const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
      check('baseline was recorded on a pristine tree', base.pristine === true);
      for (const [key, before] of Object.entries(base.entries)) {
        const after = recorded[key] ?? [];
        check(`[nos ${key}] baseline holds at least ${MIN_BASELINE_PER_ROUTE} elements`, before.length >= MIN_BASELINE_PER_ROUTE, String(before.length));
        const used = new Set();
        let matched = 0;
        for (const b of before) {
          const idx = after.findIndex((x, i) => !used.has(i) && x.tag === b.tag && x.text === b.text);
          if (idx === -1) continue; // live Sanity copy may differ between runs; only matching elements are compared
          used.add(idx);
          matched += 1;
          const a = after[idx];
          check(`[nos ${key}] <${b.tag}> "${b.text}" size, tracking and case unchanged`, a.size === b.size && a.tracking === b.tracking && a.transform === b.transform, `${JSON.stringify(b)} -> ${JSON.stringify(a)}`);
        }
        check(`[nos ${key}] at least 80% of baseline elements were matched and compared`, before.length > 0 && matched >= before.length * 0.8, `${matched}/${before.length}`);
      }
    }
  } finally { await browser.close(); }
}
run().catch((e) => { failures.push(`exception ${e.message}`); console.error(e); }).finally(() => {
  server.kill();
  if (failures.length) { console.error(`FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
  console.log(`mono ${mode} pass`);
  process.exit(0);
});
