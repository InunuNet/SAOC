// Shared helpers for the launch-weekend F7 (accessibility and form quality) checks.
// Runtime checks need a local production build already serving (BASE_URL, default http://localhost:3019;
// never 3000/3002; start with `pnpm start -p 3019`, stop by exact PID). Exit 2 = infrastructure, 1 = a real finding.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

export const BASE = (process.env.BASE_URL || 'http://localhost:3019').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f7';
// axe-core is not a direct dependency; resolve it directly, else from the pnpm store (same lookup the journeys spec uses).
function resolveAxe() {
  try {
    return createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  } catch {
    const store = 'node_modules/.pnpm';
    const dir = existsSync(store) ? readdirSync(store).filter((n) => n.startsWith('axe-core@')).sort().pop() : undefined;
    if (!dir) {
      console.error('INFRA: axe-core not found (direct or in node_modules/.pnpm)');
      process.exit(2);
    }
    return `${store}/${dir}/node_modules/axe-core/axe.min.js`;
  }
}
export const AXE_SRC = resolveAxe();

export const read = (p) => readFileSync(p, 'utf8');
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function walk(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.next') continue;
    const p = `${dir}/${n}`;
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => n.endsWith(e))) out.push(p);
  }
  return out;
}

export function report(problems, okMsg) {
  if (problems.length) {
    console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${okMsg}`);
}

// Open a chromium context. Beta Basic-auth credentials are optional and come from the environment only.
export async function withBrowser(fn, viewport = { width: 1440, height: 900 }, contextOptions = {}) {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error(`INFRA: cannot launch chromium (${e.message})`);
    process.exit(2);
  }
  const user = process.env.BETA_BASIC_AUTH_USER;
  const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
  const context = await browser.newContext({
    viewport,
    ...(user && pass ? { httpCredentials: { username: user, password: pass } } : {}),
    ...contextOptions,
  });
  try {
    return await fn(context);
  } finally {
    await browser.close();
  }
}

export async function open(page, route) {
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 45_000 });
    return res ? res.status() : 0;
  } catch (e) {
    console.error(`INFRA: cannot reach ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
}

// Run axe-core with its default rule set (WCAG + best-practice, so `region` and `heading-order` are included,
// matching the journeys spec that produced the J8 evidence); returns violations with node targets.
// target-size (WCAG 2.5.8) is a wcag22aa rule that is off by default, so it is switched on explicitly.
export async function runAxe(page) {
  await page.addScriptTag({ path: AXE_SRC });
  return page.evaluate(async () => {
    // axe is injected globally by the script tag above
    const r = await window.axe.run(document, { rules: { 'target-size': { enabled: true } } });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: (n.any[0] || n.all[0] || n.none[0] || {}).message || '' })),
    }));
  });
}

// First society detail link on /societies (the list mounts client-side, so wait for it); undefined if none appears.
export async function firstSocietyHref(page) {
  await open(page, '/societies');
  try {
    await page.waitForSelector('a[href^="/societies/"]', { timeout: 10_000 });
  } catch {
    return undefined;
  }
  return page.evaluate(() => document.querySelector('a[href^="/societies/"]').getAttribute('href'));
}
