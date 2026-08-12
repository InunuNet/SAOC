#!/usr/bin/env node
// The mission's cross-link rule: link to /judging and to the show classes on the landing page,
// NEVER duplicate either. Duplicated content is content that drifts — the committee updates the
// class list in one place and the exhibitor page keeps showing last year's.
//
// The class-code needles are read LIVE from the showClass documents. The check does not know what
// a class code looks like until it asks Sanity, so it cannot be satisfied by a page that invents
// its own codes in a format the check happened not to guess.
//
// WHY THE CODE MATCH IS NOT A SUBSTRING MATCH
// -------------------------------------------
// The first version of this check did `!textContains(body, cls.code)` — a case-insensitive
// substring search. The live codes are C, Cy, D, m, N, O, P, Ph, S, V. Searching English prose for
// the substring "m" matches every page ever written, so that assertion failed against ANY page and
// discriminated nothing. It was noise, not evidence.
//
// What actually constitutes duplication is a restated class SCHEDULE, not an incidental letter.
// So the codes are matched three ways, all case-SENSITIVE (a class code is a proper token — `m`
// and `M` are not the same code) and all anchored on non-alphanumeric boundaries:
//
//   1. SCHEDULE CONTEXT — "Class C", "(C)", "C — Cattleya…". The shapes a pasted schedule takes.
//   2. CODE + ITS OWN NAME, adjacent — "C — Cattleya Alliance". The copy-paste signature itself,
//      and near-impossible to hit by accident.
//   3. AGGREGATE BARE TOKENS — a page carrying three or more of the live codes as standalone
//      tokens is listing codes, whatever punctuation it chose. This is the backstop that catches a
//      paste in a layout none of the shapes above anticipated. A single stray "C" in prose does
//      not trip it; the whole schedule does.
//
// Verified adversarially both ways: green against the current page, red against a fixture that
// pastes the class schedule in (a) a table, (b) a bullet list, and (c) an inline comma list.

import {
  runCheck,
  fetchOkPage,
  fetchShowClassCodes,
  getSanityClient,
  textContains,
  visibleText,
  PATHS,
} from './_shared.mjs';

// How many distinct live class codes may appear as standalone tokens before the page is judged to
// be listing codes. Two is within reach of ordinary prose ("plan B", "vitamin C"); three is a list.
const MAX_BARE_CODE_TOKENS = 2;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A standalone occurrence of the code: bounded by non-alphanumerics, case-sensitive so `m` does
// not match the M in "Milestone" and `S` does not match every capitalised word.
function bareTokenMatches(text, code) {
  const re = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRe(code)}(?=[^A-Za-z0-9]|$)`, 'g');
  return [...text.matchAll(re)];
}

// The shapes a restated schedule takes. Each returns [label, RegExp].
function scheduleContexts(code) {
  const c = escapeRe(code);
  return [
    [`"Class ${code}"`, new RegExp(`[Cc]lass(?:es)?\\s+${c}(?=[^A-Za-z0-9]|$)`, 'g')],
    [`"(${code})"`, new RegExp(`\\(\\s*${c}\\s*\\)`, 'g')],
    // "C — Cattleya", "C: Cattleya", "C. Cattleya", "C - Cattleya": a code, a separator, then the
    // start of a name. The lookahead for a capital is what keeps this off ordinary sentences.
    [`"${code} — …"`, new RegExp(`(?:^|[^A-Za-z0-9])${c}\\s*[—–:.)\\-]\\s+(?=[A-Z])`, 'g')],
  ];
}

const snippet = (text, index, before = 40, after = 60) =>
  JSON.stringify(text.slice(Math.max(0, index - before), index + after));

await runCheck('check-no-duplication', async (r) => {
  const { body } = await fetchOkPage(PATHS.exhibitors);
  const text = visibleText(body);

  // --- show classes: linked, never listed ---
  const classes = await fetchShowClassCodes();
  if (classes.length === 0) {
    console.log('  NOTE  no showClass documents in the dataset — the class-code half of this check is vacuous today.');
  }

  const bareCodesPresent = [];
  for (const cls of classes) {
    // 1. schedule context
    const contextHits = [];
    for (const [label, re] of scheduleContexts(cls.code)) {
      for (const m of text.matchAll(re)) contextHits.push(`${label} at ${snippet(text, m.index)}`);
    }
    r.check(
      contextHits.length === 0,
      `class code "${cls.code}" is not presented in a schedule context on the exhibitor page`,
      `found ${contextHits.length} occurrence(s): ${contextHits.slice(0, 3).join(' | ')} — ` +
        `the class schedule belongs to the showClass documents rendered on ${PATHS.landing}`,
    );

    // 2. the code sitting next to its own class name — the copy-paste signature
    if (typeof cls.name === 'string' && cls.name.trim().length >= 4) {
      const adjacent = new RegExp(
        `(?:^|[^A-Za-z0-9])${escapeRe(cls.code)}[^A-Za-z0-9]{0,4}${escapeRe(cls.name.trim())}`,
        'g',
      );
      const m = adjacent.exec(text);
      r.check(
        m === null,
        `class code "${cls.code}" does not appear next to its class name "${cls.name}"`,
        m ? `found ${snippet(text, m.index)} — that is the class schedule pasted in` : '',
      );
    }

    if (bareTokenMatches(text, cls.code).length > 0) bareCodesPresent.push(cls.code);
  }

  // 3. aggregate backstop — a page carrying most of the code set is listing codes, in whatever
  // layout. Runs only when there are enough codes for the threshold to mean anything.
  if (classes.length > MAX_BARE_CODE_TOKENS) {
    r.check(
      bareCodesPresent.length <= MAX_BARE_CODE_TOKENS,
      `fewer than ${MAX_BARE_CODE_TOKENS + 1} live class codes appear as standalone tokens ` +
        `(found ${bareCodesPresent.length} of ${classes.length})`,
      `codes present: ${JSON.stringify(bareCodesPresent)} — a page carrying this many of the live ` +
        'codes is restating the class list, which is exactly what must live in one place only',
    );
  }
  // Class NAMES on their own are a softer signal — "Cymbidium" legitimately appears in prose. Only
  // codes, and names sitting next to their code, are asserted.

  // --- judging: linked, criteria never restated ---
  const client = getSanityClient();
  const judging = await client.fetch('*[_type == "judgingPage"][0]');
  if (judging) {
    // Any long verbatim run lifted from the judging page is duplication. Sample the judging
    // page's own string fields and require none of them appear here wholesale.
    const strings = [];
    const walk = (node) => {
      if (typeof node === 'string') {
        if (node.trim().length >= 80) strings.push(node.trim());
      } else if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        Object.values(node).forEach(walk);
      }
    };
    walk(judging);
    for (const s of strings) {
      r.check(
        !textContains(body, s.slice(0, 80)),
        `judging-page copy is not duplicated here: "${s.slice(0, 50)}…"`,
        `${PATHS.judging} is the single source for judging standards`,
      );
    }
    if (strings.length === 0) {
      console.log('  NOTE  judgingPage holds no long copy to compare against.');
    }
  } else {
    console.log('  NOTE  no judgingPage document — the judging half of this check is vacuous today.');
  }

  // --- show dates and venue: held on nationalShow, not restated here ---
  const show = await client.fetch('*[_type == "nationalShow"][0]{ location, showDate, venue }');
  if (show?.location && typeof show.location === 'string' && show.location.trim().length >= 6) {
    r.check(
      !textContains(body, show.location),
      'the show location is NOT restated on the exhibitor page',
      'the venue lives on nationalShow and renders on the show pages; a second copy drifts',
    );
  }
  if (show?.venue?.name && typeof show.venue.name === 'string') {
    r.check(
      !textContains(body, show.venue.name),
      'the venue name is NOT restated on the exhibitor page',
    );
  }

  // A bare four-digit year plus a month is how an invented show date sneaks in. The public show
  // dates live on nationalShow; this page must point at them, not repeat them.
  const dateLike = text.match(
    /\b\d{1,2}\s*[–-]\s*\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/gi,
  );
  r.check(
    dateLike === null,
    'no explicit date range is printed on the exhibitor page',
    `found ${JSON.stringify(dateLike)} — every date on this page must be an honest placeholder, ` +
      'and the public show dates belong to the show record',
  );
});
