// F8 / NV-1: every NOS route renders the same header nav, and in preview mode it includes "Past shows".
// Cause under test: a NOS page with no `revalidate` (e.g. /vendors/apply) is prerendered once at build,
// when withholdPlaceholderProse() sees the public env, so the withheld-route nav is baked in; sibling
// pages with `revalidate = 60` re-render at runtime, see the preview env, and show the leaf. This check
// reproduces the deployed shape: a PUBLIC build, then `next start` with preview env at runtime only.
// Round 1 warms every route, then it waits past the 60s revalidate window, round 2 triggers
// regeneration of the ISR pages, round 3 is judged. A page that never regenerates keeps the build-time nav.
// Run as: node contracts/checks/polish-wave-2026-10-25/f8-nos-nav-consistency.mjs   (needs a PUBLIC build, ~90s)
import { finish } from './_lib.mjs';
import { get, startServer } from './_server.mjs';

const failures = [];
const ROUTES = ['/vendors/apply', '/vendors', '/exhibitors', '/faq', '/programme', '/plan-your-visit', '/what-to-expect', '/contact', '/tickets'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const headerLabels = (html) => {
  const header = html.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? '';
  return [...header.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

// The not-found page has no <header> element; its chrome is read from every anchor in the body.
const anchorLabels = (html) => [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);

const srv = await startServer({ preview: true });
try {
  const round = async () => {
    const out = {};
    for (const path of ROUTES) {
      const r = await get(srv.port, path, 'nos.localhost');
      const expected = path.startsWith('/definitely') ? 404 : 200;
      if (r.status !== expected) failures.push(`${path}: HTTP ${r.status}, want ${expected}`);
      out[path] = path.startsWith('/definitely') ? anchorLabels(r.body) : headerLabels(r.body);
    }
    return out;
  };
  await round();
  await sleep(65_000);
  await round();
  await sleep(4_000);
  const final = await round();

  const reference = final['/vendors'] ?? [];
  if (!reference.includes('Past shows')) failures.push('reference /vendors header has no "Past shows" in preview mode (check cannot run)');
  if (reference.length < 5) failures.push(`reference nav has only ${reference.length} links (header not parsed)`);
  for (const path of ROUTES) {
    const labels = final[path] ?? [];
    if (!labels.includes('Past shows')) failures.push(`${path}: header lacks "Past shows" (${labels.length} links) in preview mode`);
    else if (!path.startsWith('/definitely') && labels.join('|') !== reference.join('|')) failures.push(`${path}: header links differ from /vendors (${labels.length} vs ${reference.length})`);
  }
} finally {
  srv.stop();
}
finish('f8-nos-nav-consistency', failures);
