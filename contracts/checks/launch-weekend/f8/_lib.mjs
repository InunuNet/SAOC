// Shared helpers for the launch-weekend F8 (no AI placeholder prose in public) checks.
// Runtime checks need a server already serving (BASE_URL, default http://localhost:3028; never 3000/3002; stop by PID)
// started with the beta basic-auth credentials EMPTY and SITE_PUBLIC_LAUNCH and SHOW_PLACEHOLDER_PREVIEW unset.
// Static and scope checks read the implementation tree named by F8_ROOT (default: the cwd).
// Exit 2 = infrastructure, 1 = a real finding.
import { readFileSync, existsSync } from 'node:fs';

export const BASE = (process.env.BASE_URL || 'http://localhost:3028').replace(/\/$/, '');
export const ROOT = (process.env.F8_ROOT || '.').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f8';
export const golden = JSON.parse(readFileSync(`${GOLDEN_DIR}/placeholder-sections.json`, 'utf8'));

// The 17 listed /national-show routes (content/national-show-routes.json, indexable, non-dynamic, in the nav).
export const ROUTES = golden.routes17;
// The six routes that render showPage sections through ShowContentState.
export const GAP_ROUTES = Object.keys(golden.sections);

export const PENDING_LABEL = 'To be confirmed by the show committee';
export const GAP_SENTENCE = 'The South African Orchid Council has not yet supplied the content for this page.';

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const headers = user && pass ? { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` } : {};

export async function get(route) {
  let res;
  try {
    res = await fetch(BASE + route, { headers, redirect: 'follow', signal: AbortSignal.timeout(120000) });
  } catch (e) {
    console.error(`INFRA: cannot reach ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
  return { status: res.status, text: await res.text() };
}

export const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&');
export const stripTags = (html) => decode(html.replace(/<!--.*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
export const mainOf = (html) => { const m = html.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : html; };

export function report(problems, okMsg) {
  if (problems.length) {
    console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`PASS: ${okMsg}`);
}

export const read = (rel) => {
  const p = `${ROOT}/${rel}`;
  if (!existsSync(p)) { console.error(`INFRA: ${p} not found`); process.exit(2); }
  return readFileSync(p, 'utf8');
};
