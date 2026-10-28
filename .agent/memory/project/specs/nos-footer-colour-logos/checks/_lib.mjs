// Shared helpers for the nos-footer-colour-logos gates: golden values, the pure measurement functions the self-test also
// exercises, a `next start` server on the build.sh output (replay only, pidfile, exact-PID kill) and a failure collector.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';

export const SPEC = '.agent/memory/project/specs/nos-footer-colour-logos';
export const VALUES = JSON.parse(readFileSync(`${SPEC}/goldens/values.json`, 'utf8'));
export const BASE_PORT = Number(process.env.NOS_FCL_PORT ?? 3141);
export const AUTH_USER = 'sandbox';
export const AUTH_PASS = 'sandbox-pass';
export const OUT = '.tmp/sandbox/nos-footer-colour-logos-gate';
mkdirSync(OUT, { recursive: true });

/** Pure: the first family of a computed font-family list, lower-cased, without quotes, next/font hash or fallback suffix. */
export function firstFamily(fontFamily) {
  const first = fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  return first.replace(/^_+/, '').replace(/_fallback(_[0-9a-f]+)?$/, '').replace(/_[0-9a-f]{6,}$/, '');
}

/** Pure: device pixels a drawn width needs (object-fit aware, as in the nos-logo-3x gate). */
export function requiredPx({ fit, boxW, boxH, srcW, srcH, dpr }) {
  const aspect = srcW / srcH;
  const drawn = fit === 'cover' ? Math.max(boxW, boxH * aspect) : fit === 'contain' || fit === 'scale-down' ? Math.min(boxW, boxH * aspect) : boxW;
  return { drawn, required: Math.ceil(drawn * dpr - 0.5) };
}

/** Start `next start` on BASE_PORT + offset: Sanity replay only, no network allowance, beta wall up. */
export function startServer(offset) {
  const port = BASE_PORT + offset;
  const env = {
    ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: AUTH_USER, BETA_BASIC_AUTH_PASSWORD: AUTH_PASS, SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}`, NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`,
    SANITY_FIXTURE_MODE: 'replay',
    SANITY_FIXTURE_DIR: process.env.SANITY_FIXTURE_DIR ?? `${process.cwd()}/.agent/memory/project/specs/nos-content-standard/fixtures/sanity`,
  };
  delete env.BETA_PASSWORD_WALL_OFF;
  delete env.SANITY_NET_ALLOW;
  const log = openSync(`${OUT}/next-start-${port}.log`, 'w');
  const proc = spawn('node_modules/.bin/next', ['start', '-p', String(port)], { stdio: ['ignore', log, log], env });
  writeFileSync(`${OUT}/next-start-${port}.pid`, String(proc.pid));
  return { port, proc, nos: `http://nos.localhost:${port}`, saoc: `http://saoc.localhost:${port}` };
}

export async function waitReady(server) {
  const auth = `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}`;
  for (let i = 0; i < 90; i += 1) {
    try {
      const r = await fetch(`${server.nos}/faq`, { headers: { authorization: auth } });
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

export function playwright() {
  return createRequire(`${process.cwd()}/package.json`)('@playwright/test');
}

export async function launchChromium() {
  return playwright().chromium.launch();
}

export function newContext(browser, vp, dsf = 1) {
  return browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: dsf, httpCredentials: { username: AUTH_USER, password: AUTH_PASS } });
}

export function collector(label) {
  const failures = [];
  return {
    check: (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); },
    note: (line) => console.log(line),
    finish(server) {
      if (server) process.kill(server.proc.pid);
      if (failures.length) { console.error(`${label} FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
      console.log(`${label} pass`);
      process.exit(0);
    },
    fail: (e) => failures.push(`exception ${e.message}`),
  };
}

export async function withServer(offset, label, body) {
  const c = collector(label);
  const server = startServer(offset);
  try { await waitReady(server); await body(server, c); } catch (e) { c.fail(e); console.error(e); }
  c.finish(server);
}

// Browser-side census walk (serialised into the page by page.evaluate): every rendered text node with its parent's computed font-family.
export const WALK_TEXT_NODES = () => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim() ?? '';
    const el = n.parentElement;
    if (!text || !el || el.closest('script,style,noscript,template')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
    out.push({ text: text.slice(0, 40), fontFamily: cs.fontFamily, inFooter: Boolean(el.closest('footer')) });
  }
  return out;
};
