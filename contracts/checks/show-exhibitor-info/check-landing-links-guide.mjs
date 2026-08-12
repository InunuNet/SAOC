#!/usr/bin/env node
// F4 / M3 — the show landing page links to the exhibitor guide.
//
// WHY THIS IS ITS OWN ASSERTION, AND WHY IT IS ALLOWED TO BE RED
// -------------------------------------------------------------
// "Built and unreachable is not built." This project has already shipped that mistake once with
// /national-show/archive, and it was booked as a follow-up then too. A booked follow-up with no
// assertion behind it is how the last one survived to be found by QA.
//
// The guide is not literally orphaned — the home-page ShowBand links to it and the search overlay
// suggests it, and check-reachability.mjs proves both. But an exhibitor does not start at the home
// page. They start at /national-show, because that is the show, and from there they cannot get
// here: the landing page links to the archive, the FAQ, plan-your-visit and what-to-expect —
// every visitor-stream page and not this one. The mission's own words are "link the exhibitor
// guide from the show landing page and site nav", and half of that is unmet.
//
// app/(marketing)/national-show/page.tsx belongs to the visitor stream, which is editing it right
// now, so this contract cannot make the change. It can refuse to call the feature done. The
// assertion goes red until one line lands in that file — see FU-1 in
// contracts/golden/show-exhibitor-info/exhibitorStages-reconciliation.golden.md.
//
// A 200 is not accepted as evidence of anything here: the check crawls real href attributes out
// of the rendered HTML, the same primitive check-detects-absence.mjs proves can report absence.

import { runCheck, fetchOkPage, linksTo, extractHrefs, PATHS } from './_shared.mjs';

await runCheck('check-landing-links-guide', async (r) => {
  const landing = await fetchOkPage(PATHS.landing);

  const links = linksTo(landing.body, PATHS.exhibitors);
  r.check(
    links,
    `${PATHS.landing} links to ${PATHS.exhibitors}`,
    `no href on the show landing page points at the exhibitor guide. Hrefs found there: ` +
      `${JSON.stringify([...extractHrefs(landing.body)].filter((h) => h.startsWith('/')).sort())}. ` +
      'An exhibitor looking for entry information starts at the show, not at the home page. ' +
      'This is FU-1 and it is one additive link in app/(marketing)/national-show/page.tsx.',
  );

  // The reverse direction is already required by check-reachability, but assert it here too so a
  // failure of this assertion can never be "fixed" by breaking the link back.
  const guide = await fetchOkPage(PATHS.exhibitors);
  r.check(
    linksTo(guide.body, PATHS.landing),
    `${PATHS.exhibitors} still links back to ${PATHS.landing}`,
  );
});
