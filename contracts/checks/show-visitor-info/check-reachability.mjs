#!/usr/bin/env node
// F5's first-class requirement: a page that returns 200 is not shipped — a page a visitor
// can CLICK TO is shipped. /national-show/archive is the standing cautionary example on this
// project: built, 200, linked from nothing.
//
// This check crawls real rendered HTML and asserts the edges in page-map.golden.md exist as
// actual href attributes. It deliberately does NOT accept "the URL responds 200" as evidence
// of anything — that is precisely the failure mode being guarded against.

import { runCheck, fetchOkPage, linksTo, extractHrefs, PATHS } from './_shared.mjs';

const EDGES = [
  [PATHS.landing, PATHS.plan],
  [PATHS.landing, PATHS.expect],
  [PATHS.landing, PATHS.faq],
  [PATHS.landing, PATHS.archive],

  [PATHS.plan, PATHS.landing],
  [PATHS.plan, PATHS.expect],
  [PATHS.plan, PATHS.faq],
  [PATHS.plan, PATHS.contact],

  [PATHS.expect, PATHS.landing],
  [PATHS.expect, PATHS.plan],
  [PATHS.expect, PATHS.faq],
  [PATHS.expect, PATHS.tickets],

  [PATHS.faq, PATHS.landing],
  [PATHS.faq, PATHS.plan],
  [PATHS.faq, PATHS.contact],

  [PATHS.contact, PATHS.landing],
];

await runCheck('check-reachability', async (r) => {
  const cache = new Map();
  async function bodyOf(pathname) {
    if (!cache.has(pathname)) cache.set(pathname, (await fetchOkPage(pathname)).body);
    return cache.get(pathname);
  }

  for (const [from, to] of EDGES) {
    const html = await bodyOf(from);
    r.check(linksTo(html, to), `${from} links to ${to}`);
  }

  // Two-hop proof: every new page is reachable from the site's own front door by following
  // links only — home -> national show -> the page. Nothing here types a URL.
  const home = await bodyOf('/');
  r.check(linksTo(home, PATHS.landing), `/ links to ${PATHS.landing} (entry point into the section)`);

  const landing = await bodyOf(PATHS.landing);
  const landingHrefs = extractHrefs(landing);
  for (const target of [PATHS.plan, PATHS.expect, PATHS.faq]) {
    r.check(
      landingHrefs.has(target),
      `${target} is reachable in two clicks from the home page`,
      `hrefs found on ${PATHS.landing}: ${JSON.stringify([...landingHrefs].filter((h) => h.startsWith('/national-show')))}`,
    );
  }

  // Site-wide search must surface the section too — it is the other way a visitor finds a page.
  const searchSourceLinks = ['/national-show/plan-your-visit', '/national-show/what-to-expect', '/national-show/faq'];
  const { readFileSync } = await import('node:fs');
  const overlay = readFileSync('components/chrome/SearchOverlay.tsx', 'utf8');
  for (const href of searchSourceLinks) {
    r.check(overlay.includes(href), `SearchOverlay offers ${href}`);
  }

  // The upcoming stub must still resolve rather than 404 — it is linked from old material.
  const upcoming = await fetchOkPage('/national-show/upcoming');
  r.check(upcoming.status === 200, '/national-show/upcoming still resolves (redirect followed)');
});
