// Shared helpers for the launch-weekend F4 (events honesty) checks.
// Runtime checks: they need a server already running (BASE_URL, default http://localhost:3002;
// a local production build, `pnpm build && pnpm start -p 3002`, is the reference). Exit 2 = cannot
// reach the server (infrastructure), exit 1 = a real finding. Plain fetch, no browser.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

export const BASE = (process.env.BASE_URL || 'http://localhost:3002').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f4';
export const golden = JSON.parse(readFileSync(`${GOLDEN_DIR}/invented-events.json`, 'utf8'));
export const INVENTED = golden.invented; // [{ id, title, slug }] - the 17 seeded, unsourced societyEvent docs
export const KEEP = golden.keep; // the one partly sourced event: the 19th National Show

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const headers = user && pass ? { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` } : {};

export async function get(route, { allowStatus = [] } = {}) {
  let res;
  try {
    res = await fetch(BASE + route, { headers, redirect: 'follow' });
  } catch (e) {
    console.error(`INFRA: cannot reach ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
  const text = await res.text();
  if (res.status >= 400 && !allowStatus.includes(res.status)) {
    console.error(`INFRA: ${BASE}${route} answered HTTP ${res.status}`);
    process.exit(2);
  }
  return { status: res.status, text };
}

export const stripTags = (html) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// Every invented title or slug found in a body (raw markup, tag-stripped text, and slugged hrefs).
export function inventedIn(body) {
  const text = stripTags(body);
  const hits = [];
  for (const e of INVENTED) if (body.includes(e.title) || text.includes(e.title) || body.includes(e.slug)) hits.push(e.title);
  return hits;
}

export function walk(dir, ext) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = `${dir}/${n}`;
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (n.endsWith(ext)) out.push(p);
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
