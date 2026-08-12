#!/usr/bin/env node
// Built and unreachable is not built. /national-show/archive is this project's standing
// cautionary example: built, returns 200, linked from nothing.
//
// A 200 response is NOT accepted here as evidence of anything. The check crawls real rendered
// HTML and asserts the edges exist as actual href attributes.
//
// THE REGRESSION THIS GUARDS: /national-show/exhibitors is already linked from the home page via
// components/home/ShowBand.tsx. A rebuild that silently drops that inbound edge would orphan a
// page that was reachable before — a regression dressed as a rewrite. The home -> exhibitors edge
// is asserted first, before anything this mission adds.

import { readFileSync } from 'node:fs';

import { runCheck, fetchOkPage, linksTo, extractHrefs, PATHS } from './_shared.mjs';

await runCheck('check-reachability', async (r) => {
  const cache = new Map();
  async function bodyOf(pathname) {
    if (!cache.has(pathname)) cache.set(pathname, (await fetchOkPage(pathname)).body);
    return cache.get(pathname);
  }

  // --- the pre-existing inbound edge that must survive the rebuild ---
  const home = await bodyOf(PATHS.home);
  r.check(
    linksTo(home, PATHS.exhibitors),
    `${PATHS.home} still links to ${PATHS.exhibitors} (the ShowBand edge that existed before this mission)`,
    'the rebuild orphaned a page that was reachable before. See components/home/ShowBand.tsx.',
  );

  // --- outbound edges the mission requires ---
  const page = await bodyOf(PATHS.exhibitors);
  const required = [
    [PATHS.landing, 'back to the show overview'],
    [PATHS.judging, 'SAOC judging standards — cross-link, never duplicate'],
    [PATHS.contact, 'contact the council'],
  ];
  for (const [target, why] of required) {
    r.check(linksTo(page, target), `${PATHS.exhibitors} links to ${target} (${why})`);
  }

  // The classes block must point at the page that actually holds the class list.
  r.check(
    linksTo(page, PATHS.landing),
    `${PATHS.exhibitors} links to ${PATHS.landing} for the class list rather than restating it`,
  );

  // WOSA: wild orchids are out of SAOC's scope. If the page mentions them at all, it must link
  // out rather than describe them.
  const hrefs = [...extractHrefs(page)];
  const mentionsWild = /wildorchids\.co\.za/i.test(page);
  r.check(
    !mentionsWild || hrefs.some((h) => /wildorchids\.co\.za/i.test(h)),
    'any wild-orchid mention is a link to wildorchids.co.za, not a description',
  );

  // --- site-wide search ---
  const overlay = readFileSync('components/chrome/SearchOverlay.tsx', 'utf8');
  r.check(
    overlay.includes(PATHS.exhibitors),
    `SearchOverlay offers ${PATHS.exhibitors}`,
    'search is the other way a visitor finds a page',
  );

  // --- the header nav is deliberately NOT expanded ---
  const header = readFileSync('components/chrome/Header.tsx', 'utf8');
  r.check(
    !header.includes(PATHS.exhibitors),
    'the primary header nav was NOT expanded — a six-item bar stays a six-item bar',
    'see exhibitor-page-map.golden.md; reachability comes from the home band and search',
  );

  // --- FU-1, reported not asserted ---
  // The /national-show landing page link is a booked follow-up gated on the visitor stream (see
  // exhibitorStages-reconciliation.golden.md). It is printed as a NOTE, never as a pass, so it
  // cannot be mistaken for done.
  const landing = await bodyOf(PATHS.landing);
  if (linksTo(landing, PATHS.exhibitors)) {
    console.log(`  NOTE  FU-1 has landed: ${PATHS.landing} now links to ${PATHS.exhibitors}.`);
  } else {
    console.log(
      `  NOTE  FU-1 still open: ${PATHS.landing} does not link to ${PATHS.exhibitors}. This is a ` +
        'known gap gated on the show-visitor-info stream, which owns that file. Not asserted here ' +
        'because this contract must not contract edits to a file another stream is editing.',
    );
  }
});
