// Shared helpers for the launch-weekend F1 (a11y basics) checks.
// Runtime checks: they need a server already running (BASE_URL, default http://localhost:3002;
// a local production build, `pnpm build && pnpm start -p 3002`, is the reference). Exit 2 = cannot
// reach the server (infrastructure), exit 1 = a real finding. Never greps source for behaviour.
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';
import { readFileSync } from 'node:fs';

loadDotenv({ path: '.env.local' });

export const BASE = (process.env.BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f1';
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '1280', width: 1280, height: 900, isMobile: false },
];
// SAOC-chrome route types. `/societies/[slug]` is resolved at run time from the golden's recorded slug.
export const SAOC_ROUTES = ['/', '/societies', '/societies/[slug]', '/events', '/judging', '/about', '/contact'];
// NOS route types: hub, transactional hub, content page, vendor showcase.
export const NOS_ROUTES = ['/national-show', '/national-show/tickets', '/national-show/faq', '/national-show/vendors'];

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const httpCredentials = user && pass ? { username: user, password: pass } : undefined;

export function loadGolden(name) {
  return JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
}

export function resolveRoute(route, societySlug) {
  return route === '/societies/[slug]' ? `/societies/${societySlug}` : route;
}

export async function launch() {
  return chromium.launch();
}

export async function newPage(browser, vp, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    httpCredentials,
    ...extra,
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function open(page, route) {
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
}

export function report(problems, okMsg) {
  if (problems.length) {
    console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${okMsg}`);
}

// In-page: every visible interactive target with its box. Runs inside page.evaluate.
export function collectTargetsInPage() {
  const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[tabindex]:not([tabindex="-1"])';
  const all = [...document.querySelectorAll(SEL)];
  const out = [];
  for (const el of all) {
    if (el.closest('[inert],nextjs-portal,[data-nextjs-toast]')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) continue; // sr-only clip boxes
    if (r.right <= 0 || r.bottom <= 0) continue; // parked off-screen (e.g. an unfocused skip link)
    const cs = getComputedStyle(el);
    const parentText = el.parentElement ? el.parentElement.textContent.replace(el.textContent, '').trim() : '';
    out.push({
      el,
      x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height,
      inline: el.tagName === 'A' && cs.display === 'inline' && parentText.length >= 20,
    });
  }
  return out;
}

// In-page: the distinct type+colour signatures of text-bearing elements (skip link excluded), plus page
// geometry. Layout properties are deliberately NOT part of a signature: target sizing may change them.
export function identityInPage() {
  const sigs = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('a[href="#main-content"],nextjs-portal,script,style,noscript')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    sigs.add([cs.fontFamily, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.letterSpacing, cs.textTransform, cs.color, cs.backgroundColor].join(' | '));
  }
  const de = document.documentElement;
  return { signatures: [...sigs].sort(), scrollHeight: de.scrollHeight, scrollWidth: de.scrollWidth, innerWidth: window.innerWidth };
}

export function motionInPage() {
  const secs = (v) => v.split(',').map((s) => { s = s.trim(); return s.endsWith('ms') ? parseFloat(s) / 1000 : parseFloat(s) || 0; });
  let transitioning = 0;
  const smooth = [];
  for (const el of [document.documentElement, ...document.querySelectorAll('body, body *')]) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (Math.max(...secs(cs.transitionDuration)) > 0.001 && cs.transitionProperty !== 'none') transitioning++;
      if (!pseudo && cs.scrollBehavior === 'smooth') smooth.push(el.tagName.toLowerCase());
    }
  }
  return { transitioning, smooth };
}
