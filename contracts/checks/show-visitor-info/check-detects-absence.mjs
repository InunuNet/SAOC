#!/usr/bin/env node
// META-CHECK — proves this contract's checks can actually FAIL.
//
// Three false greens last session came from assertions that could not distinguish a working
// feature from a missing one. Before trusting a green from the checks in this directory, this
// script exercises their primitives against inputs where the correct answer is "no", and fails
// if any of them says "yes" anyway.
//
// It touches no dataset and mutates nothing.

import { runCheck, fetchPage, linksTo, textContains, visibleText, extractHrefs, PATHS } from './_shared.mjs';

const UNLINKED_PAGE = `
<html><body>
  <h1>National Show</h1>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
  <script>var payload = {"planIntro":"Everything you need to get to the National Orchid Show"}</script>
  <style>.x { content: "plan-your-visit"; }</style>
</body></html>`;

const LINKED_PAGE = `
<html><body>
  <a href="/national-show/plan-your-visit">Plan your visit</a>
  <a href="/national-show/faq/">FAQ</a>
</body></html>`;

await runCheck('check-detects-absence', async (r) => {
  // 1. The reachability primitive must say NO for a page that does not link onward — this is
  //    the /national-show/archive failure mode: the URL exists, nothing points at it.
  r.check(
    linksTo(UNLINKED_PAGE, PATHS.plan) === false,
    'linksTo() reports absence when a page does not link to the target',
  );
  r.check(linksTo(LINKED_PAGE, PATHS.plan) === true, 'linksTo() reports presence when the link exists');
  r.check(
    linksTo(LINKED_PAGE, PATHS.faq) === true,
    'linksTo() normalises a trailing slash rather than missing the link',
  );
  r.check(
    extractHrefs(UNLINKED_PAGE).has('/national-show/plan-your-visit') === false,
    'extractHrefs() does not invent links',
  );

  // 2. Content that exists ONLY inside a script or style block is not rendered content. If
  //    textContains matched it, every "the page shows X" assertion in this directory would be
  //    satisfiable by data that never reaches a visitor's eyes.
  r.check(
    textContains(UNLINKED_PAGE, 'Everything you need to get to the National Orchid Show') === false,
    'textContains() ignores copy that appears only inside a <script> payload',
  );
  r.check(
    textContains(UNLINKED_PAGE, 'plan-your-visit') === false,
    'textContains() ignores content that appears only inside a <style> block',
  );
  r.check(textContains(UNLINKED_PAGE, 'National Show') === true, 'textContains() finds real visible text');
  r.check(
    textContains('<p>a long\n   sentence</p>', 'a long sentence') === true,
    'textContains() matches across a line break in the markup',
  );
  r.check(
    visibleText('<p>Tom &amp; Jerry&#39;s</p>') === "Tom & Jerry's",
    'visibleText() decodes the entities Next.js emits',
    JSON.stringify(visibleText('<p>Tom &amp; Jerry&#39;s</p>')),
  );

  // 3. A route that genuinely does not exist must produce a non-200, and fetchPage must not
  //    quietly swallow it. (Next dev serves a 404 page body with status 404.)
  const absent = await fetchPage('/national-show/definitely-not-a-real-page-svi');
  r.check(
    absent.status !== 200,
    'fetchPage() surfaces a non-200 for a route that does not exist',
    `got ${absent.status}`,
  );

  // 4. An unreachable origin must be a hard error, never a silent skip.
  let threw = false;
  try {
    const badBase = process.env.SVI_BASE_URL;
    process.env.SVI_BASE_URL = 'http://127.0.0.1:9';
    const mod = await import(`./_shared.mjs?bust=${Date.now()}`);
    await mod.fetchPage('/');
    process.env.SVI_BASE_URL = badBase;
  } catch (err) {
    threw = /could not reach/i.test(err.message);
  }
  r.check(threw, 'an unreachable dev server raises a hard failure rather than skipping');
});
