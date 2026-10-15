// Shared helpers for the launch-weekend F5 (perf and headers) checks.
// Runtime checks need a local production build already serving on BASE_URL (default
// http://localhost:3411): SITE_PUBLIC_LAUNCH=true pnpm build && SITE_PUBLIC_LAUNCH=true pnpm start -p 3411.
// Never 3000 or 3002. Exit 2 = cannot reach the server (infrastructure), exit 1 = a real finding.
export const BASE = (process.env.BASE_URL || 'http://localhost:3411').replace(/\/$/, '');
export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f5';
export const CANONICAL_ORIGIN = 'https://saoc.co.za';

export async function fetchRaw(route, init = {}) {
  try {
    return await fetch(BASE + route, { redirect: 'manual', ...init });
  } catch (e) {
    console.error(`INFRA: cannot reach ${BASE}${route} (${e.message})`);
    process.exit(2);
  }
}

export async function getPage(route) {
  const res = await fetchRaw(route, { redirect: 'follow' });
  const text = await res.text();
  if (res.status >= 500) {
    console.error(`INFRA: ${BASE}${route} answered HTTP ${res.status}`);
    process.exit(2);
  }
  return { status: res.status, text, headers: res.headers };
}

export function report(problems, okMessage) {
  if (problems.length) {
    for (const p of problems) console.error(`FAIL: ${p}`);
    process.exit(1);
  }
  console.log(`OK: ${okMessage}`);
}
