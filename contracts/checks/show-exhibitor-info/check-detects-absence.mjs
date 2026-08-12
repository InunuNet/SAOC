#!/usr/bin/env node
// META — proves this contract's checks can actually FAIL.
//
// A green gate is worth nothing if the checks are incapable of going red. This project has been
// burned by exactly that: assertions that passed because they were structurally unable to detect
// the thing they claimed to test. So each primitive the other checks depend on is exercised here
// against a case where the correct answer is "no".
//
// If this check ever passes trivially, the rest of the contract's greens are meaningless.

import {
  runCheck,
  fetchPage,
  linksTo,
  textContains,
  countText,
  visibleText,
  portableTextToPlain,
  needleFrom,
  BASE_URL,
  PATHS,
} from './_shared.mjs';

await runCheck('check-detects-absence', async (r) => {
  // --- the link primitive reports absence ---
  const html = '<a href="/national-show">Show</a><a href="/contact">Contact</a>';
  r.check(linksTo(html, '/national-show'), 'linksTo finds a link that is present');
  r.check(
    !linksTo(html, '/national-show/exhibitors'),
    'linksTo reports ABSENCE for a page that is not linked',
    'if this fails, every reachability assertion in this contract is meaningless',
  );
  // Trailing-slash and absolute forms must not be treated as different pages.
  r.check(linksTo('<a href="/contact/">x</a>', '/contact'), 'linksTo normalises a trailing slash');
  r.check(linksTo(`<a href="${BASE_URL}/contact">x</a>`, '/contact'), 'linksTo accepts an absolute URL');

  // --- the text primitive ignores script and style content ---
  const scripted = '<script>var x = "SECRET-NEEDLE";</script><style>.a{content:"SECRET-NEEDLE"}</style><p>visible</p>';
  r.check(
    !textContains(scripted, 'SECRET-NEEDLE'),
    'textContains ignores copy that exists only in a script or style block',
    'the RSC flight payload is serialised into a script tag; without this, a field that never ' +
      'rendered would still appear to be on the page',
  );
  r.check(textContains(scripted, 'visible'), 'textContains finds genuinely visible copy');

  // Whitespace and entity handling — a needle spanning a JSX line break must still match.
  r.check(
    textContains('<p>To be confirmed by\n   the show committee</p>', 'To be confirmed by the show committee'),
    'textContains matches across a line break',
  );
  r.check(
    textContains('<p>SAOC&#x27;s committee</p>', "SAOC's committee"),
    'textContains decodes HTML entities',
  );
  r.check(
    !textContains('<p>something else entirely</p>', 'To be confirmed by the show committee'),
    'textContains reports ABSENCE for copy that is not there',
  );

  // --- the counting primitive ---
  r.check(countText('<p>mark mark mark</p>', 'mark') === 3, 'countText counts repeats');
  r.check(countText('<p>nothing here</p>', 'mark') === 0, 'countText returns zero for an absent needle');

  // --- visibleText strips markup rather than matching inside a tag attribute ---
  r.check(
    !textContains('<div data-note="hidden-needle"></div>', 'hidden-needle'),
    'textContains does not match text hiding in an attribute',
  );

  // --- portable text extraction ---
  const pt = [{ _type: 'block', children: [{ text: 'Hello ' }, { text: 'world' }] }];
  r.check(portableTextToPlain(pt) === 'Hello world', 'portableTextToPlain joins spans');
  r.check(portableTextToPlain(null) === '', 'portableTextToPlain survives a null body');
  r.check(portableTextToPlain([{ _type: 'image' }]) === '', 'portableTextToPlain ignores non-block content');
  r.check(needleFrom('  a  b  ', 10) === 'a b', 'needleFrom collapses whitespace');

  // --- a non-existent route is surfaced as non-200, not silently tolerated ---
  const missing = await fetchPage('/national-show/definitely-not-a-real-route-xyz');
  r.check(
    missing.status !== 200,
    'a non-existent route is reported as non-200',
    `got ${missing.status} — if a 404 reads as 200, every page-exists assertion is worthless`,
  );

  // --- the real page is reachable, so the suite is testing something ---
  const real = await fetchPage(PATHS.exhibitors);
  r.check(real.status === 200, `${PATHS.exhibitors} returns 200 (the suite has a live target)`);
  r.check(visibleText(real.body).length > 500, `${PATHS.exhibitors} rendered real content, not an empty shell`);

  // --- an unreachable dev server is a hard failure, never a silent skip ---
  let threw = false;
  try {
    const saved = process.env.EXH_BASE_URL;
    process.env.EXH_BASE_URL = 'http://127.0.0.1:1';
    const mod = await import(`./_shared.mjs?nocache=${Date.now()}`);
    await mod.fetchPage('/');
    process.env.EXH_BASE_URL = saved;
  } catch (err) {
    threw = /could not reach|ECONNREFUSED/i.test(err.message);
  }
  r.check(
    threw,
    'an unreachable dev server throws rather than passing quietly',
    'a check that treats an unreachable server as "nothing to test" is the worst false green of all',
  );
});
