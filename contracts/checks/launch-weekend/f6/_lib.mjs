// Shared helpers for the launch-weekend F6 (archive honesty) checks.
// Runtime checks need a local production build already serving (BASE_URL, default http://localhost:3017;
// never 3000/3002; start with `pnpm start -p 3017`, stop by PID). Exit 2 = infrastructure, 1 = a real finding.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

export const BASE = (process.env.BASE_URL || 'http://localhost:3017').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f6';
export const golden = JSON.parse(readFileSync(`${GOLDEN_DIR}/invented-shows.json`, 'utf8'));
export const FORBIDDEN = golden.forbiddenLiterals;
// Hub-only (KwaZulu-Natal is a legitimate province elsewhere): invented cycle and stats blocks on /national-show.
export const HUB_FORBIDDEN = ['KwaZulu', 'Editions held', 'Entries — 2024', '1,240', 'Three-year cycle', 'Host province rotates', 'Edition XVIII', 'Edition XX', 'rotates across'];
export const YEARS = golden.archiveYearsMustNotRender;

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const headers = user && pass ? { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` } : {};

export async function get(route) {
  let res;
  try {
    res = await fetch(BASE + route, { headers, redirect: 'follow' });
  } catch (e) {
    console.error(`INFRA: cannot reach ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
  return { status: res.status, text: await res.text() };
}

export const stripTags = (html) => html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// Chrome (mega-menu, footer) is out of scope for stat/ordinal scans: only the page's own <main>.
export const mainOf = (html) => { const m = html.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : html; };

export const forbiddenIn = (body) => {
  const text = stripTags(body);
  return FORBIDDEN.filter((l) => body.includes(l) || text.includes(l));
};

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
