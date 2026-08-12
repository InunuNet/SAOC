#!/usr/bin/env node
// F3 — the entry form must never be a dead link.
//
// The failure mode: an anchor rendered with an empty, "#", or "undefined" href. It looks
// clickable, it is clickable, and it goes nowhere — worse than no link at all, because an
// exhibitor concludes the site is broken rather than that the form is not out yet.
//
// The check branches on what the dataset actually holds, so it is correct both before and after
// the committee uploads a form. Today it will exercise the pending branch; the day a PDF is
// uploaded it silently starts exercising the other one.

import { readFileSync } from 'node:fs';

import {
  runCheck,
  fetchOkPage,
  fetchExhibitorInfo,
  textContains,
  needleFrom,
  PATHS,
} from './_shared.mjs';

const COMPONENT = 'components/show/EntryFormLink.tsx';

await runCheck('check-entry-form-state', async (r) => {
  const info = await fetchExhibitorInfo();
  const { body } = await fetchOkPage(PATHS.exhibitors);

  const hasFile = Boolean(info.entryFormFile?.asset?._ref ?? info.entryFormFile?.asset?.url);
  const hasUrl = typeof info.entryFormUrl === 'string' && info.entryFormUrl.trim().length > 0;

  r.check(
    typeof info.entryFormPendingNote === 'string' && info.entryFormPendingNote.trim().length > 0,
    'the dataset holds an entryFormPendingNote (the honest empty state)',
    'without it there is nothing to render when no form exists, and the page will fall back to ' +
      'either silence or a dead link',
  );

  if (hasFile || hasUrl) {
    console.log(`  NOTE  an entry form IS present (file: ${hasFile}, url: ${hasUrl}) — asserting the link branch.`);
    const target = hasUrl ? info.entryFormUrl : null;
    if (target) {
      r.check(body.includes(target), 'the entry-form URL from the dataset is rendered as an href');
    } else {
      r.check(
        /href="[^"]*cdn\.sanity\.io[^"]*"/.test(body),
        'the uploaded entry-form asset is rendered as a real Sanity CDN href',
      );
    }
  } else {
    console.log('  NOTE  no entry form in the dataset — asserting the honest pending branch.');

    r.check(
      textContains(body, needleFrom(info.entryFormPendingNote, 60)),
      'the pending note renders as visible text',
    );

    // The heading must still render, so the block does not simply vanish and leave the exhibitor
    // wondering whether there is an entry form at all.
    r.check(
      textContains(body, needleFrom(info.entryFormHeading, 30)),
      'the entry-form heading still renders in the pending state',
    );

    // No anchor may wrap the pending note. Isolate the surrounding markup and check it.
    const marker = String(info.entryFormPendingNote).slice(0, 40);
    const idx = body.indexOf(marker.slice(0, 25));
    if (idx === -1) {
      // The note rendered (asserted above) but with entity escaping; fall back to a whole-page
      // check for the dead-link patterns instead of a windowed one.
      console.log('  NOTE  could not window the markup around the pending note; checking the whole page.');
    } else {
      const window = body.slice(Math.max(0, idx - 600), idx + 600);
      r.check(
        !/<a\s/i.test(window),
        'the pending note is NOT wrapped in an anchor — nothing clickable where there is nothing to click',
        'a link to a form that does not exist is worse than no link',
      );
    }
  }

  // Dead-link patterns must not appear anywhere on the page, in either branch.
  for (const pattern of ['href="#"', 'href=""', 'href="undefined"', 'href="null"']) {
    r.check(!body.includes(pattern), `no ${pattern} anywhere on ${PATHS.exhibitors}`);
  }

  // STRUCTURAL — the component itself must never emit a placeholder href.
  let src = '';
  try {
    src = readFileSync(COMPONENT, 'utf8');
  } catch {
    r.fail(`${COMPONENT} exists`);
    return;
  }
  r.check(
    !/href=\{?["'`]#["'`]\}?/.test(src),
    `${COMPONENT} never emits href="#"`,
  );
  r.check(
    src.includes('entryFormPendingNote'),
    `${COMPONENT} renders the dataset's pending note rather than a hardcoded fallback string`,
  );
});
