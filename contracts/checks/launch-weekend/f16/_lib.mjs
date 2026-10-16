// Shared helpers for the launch-weekend F16 (tickets hub R31-A2) checks.
// Runtime checks need a server already running (BASE_URL, default http://localhost:3620; a local production build,
// `pnpm build && pnpm exec next start -p 3620`, is the reference). Exit 2 = cannot reach the server (infrastructure),
// exit 1 = a real finding. cwd = the tree under test (.env.local read from it). Run with `node --import tsx/esm`.
import { chromium } from 'playwright';
import { config as loadDotenv } from 'dotenv';
import { readFileSync } from 'node:fs';

loadDotenv({ path: '.env.local', quiet: true });

export const BASE = (process.env.BASE_URL || 'http://localhost:3620').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f16';
export const HUB = '/national-show/tickets';
export const VIEWPORTS = [
  { name: '390', width: 390, height: 844, isMobile: true },
  { name: '1280', width: 1280, height: 900, isMobile: false },
  { name: '1920', width: 1920, height: 1080, isMobile: false },
];

// Hooks the dev adds (f16-spec.md section 8).
export const SEL = {
  index: '[data-ticket-index]',
  indexLink: '[data-ticket-index] a',
  rows: '[data-ticket-rows]',
  row: '[data-ticket-row]',
  rowName: '[data-ticket-row-name]',
  prices: '[data-ticket-prices]',
  tier: '[data-ticket-tier]',
  price: '[data-ticket-price]',
  action: '[data-ticket-row-action]',
  dayNote: '[data-ticket-day-note]',
  closed: '[data-ticket-closed]',
};

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
export const httpCredentials = user && pass ? { username: user, password: pass } : undefined;

export const loadGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const launch = () => chromium.launch();

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

export async function openPath(page, path) {
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
    if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`);
    return res;
  } catch (e) {
    console.error(`INFRA: cannot load ${BASE}${path} (${e.message})`);
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

// Read-only Sanity query (never a mutation): the active admission ticket types and the tickets-page singleton.
export async function readCms() {
  const { createClient } = await import('@sanity/client');
  const c = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_API_TOKEN,
    useCdn: false,
    perspective: 'published',
  });
  const types = await c.fetch('*[_type=="ticketType" && active==true && (category=="admission"||!defined(category)) && demo!=true]|order(order asc){name,"slug":slug.current,price,regularPrice,earlyBirdCutoff,order,requiresDaySelection,provisional}');
  const page = await c.fetch('*[_type=="ticketsPage"][0]{buyButtonLabel,soldOutMessage,salesClosedMessage}');
  const show = await c.fetch('*[_type=="nationalShow"][0]{salesOpen}');
  return { types, page: page ?? {}, salesOpen: show?.salesOpen === true };
}

// In-page: every visible text node under <main> plus the hero (trimmed, de-duplicated).
export const TEXT_NODES_SRC = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const out = new Set();
  const w = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement; const t = n.textContent.replace(/\\s+/g, ' ').trim();
    if (!t || !p || p.closest('script, style, noscript, template')) continue;
    if (!vis(p) && !p.closest('.sr-only')) continue;
    out.add(t);
  }
  return [...out];
})()`;

export const SETTLE_MS = 450;
export const durationsMs = (v) => v.split(',').map((s) => { s = s.trim(); return s.endsWith('ms') ? parseFloat(s) : parseFloat(s) * 1000; });
