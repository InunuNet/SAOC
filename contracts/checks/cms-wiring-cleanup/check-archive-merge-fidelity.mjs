#!/usr/bin/env node
// A2 — F2 merge fidelity, read-only, non-mutating.
//
// The `show` schema has no `edition`, `month`, `host`, `days`, `visitors`, `trophies`
// or `note` field; lib/data/shows carries all seven. So "wire the archive to Sanity"
// must NOT mean "replace static with Sanity" — that loses data. The archive LIST page
// already made exactly that mistake: because Sanity `show` documents exist, it takes
// the Sanity branch wholesale and hardcodes `edition: 0, month: 'September'`, mapping
// `host` and `venue` both to `location` and Sanity's `exhibitors` onto the `visitors`
// slot. Confirmed live 2026-08-11: the list renders bare years where it should render
// "Edition XVIII", and the detail page (still static) renders "XVIII" correctly — the
// two pages disagree about the same show today.
//
// This check pins the merged outcome on BOTH pages at once, so @dev cannot fix the
// detail page by copying the list page's lossy mapping, and cannot fix the list page
// by dropping Sanity.
//
// Non-vacuity confirmed live 2026-08-11 BEFORE implementation:
//   - "Edition XVIII" on /national-show/archive  -> 0 occurrences (this check FAILS today)
//   - "XVIII" on /national-show/archive/2024     -> 1 occurrence  (regression guard, passes today)
// So one half fails and one half passes right now: it is neither vacuous nor a
// pass-by-default.

import { fetchPage, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-archive-merge-fidelity');

await assertDevServerUp();

const failures = [];

// --- The 2024 show: Sanity holds year/location/entries, static holds edition 18 ---
// A correct merge shows the Roman edition from static AND the entry count Sanity owns.
const detail = await fetchPage('/national-show/archive/2024');
if (detail.status !== 200) {
  failures.push(`/national-show/archive/2024 returned ${detail.status}, expected 200`);
} else {
  if (!detail.html.includes('XVIII')) {
    failures.push(
      '/national-show/archive/2024 no longer renders the Roman edition "XVIII" — the static-only ' +
        'fields (edition/month/host/days/visitors/trophies) were dropped by the merge instead of ' +
        'filling the gaps the `show` schema cannot express.'
    );
  }
  // Separator-agnostic on purpose. The page formats with toLocaleString(), which on this
  // server renders 1240 as "1 240" (a space group separator), not "1,240" — confirmed
  // live 2026-08-11. Asserting a comma here would be a false RED that survives any
  // correct implementation.
  if (!/1[\s  ,.]?240/.test(detail.html)) {
    failures.push(
      '/national-show/archive/2024 does not render the 1240 entry count that both sources agree ' +
        'on — the merge dropped it.'
    );
  }
}

// --- The archive LIST must agree with the detail page about the same show ---
const list = await fetchPage('/national-show/archive');
if (list.status !== 200) {
  failures.push(`/national-show/archive returned ${list.status}, expected 200`);
} else if (!list.html.includes('Edition XVIII')) {
  failures.push(
    '/national-show/archive still renders a bare year instead of "Edition XVIII" for the 2024 ' +
      'show. The list is taking the Sanity branch wholesale and hardcoding `edition: 0`, so it ' +
      'contradicts the detail page about the same show. Both pages must read the same merge.'
  );
}

// --- Neither page may keep a hardcoded month for Sanity-sourced rows ---
// lib/data/shows says 2021 was October; the list's Sanity branch hardcodes September.
if (list.status === 200 && /2021\s*(&mdash;|—|-)\s*September/.test(list.html)) {
  failures.push(
    '/national-show/archive renders "2021 — September" but lib/data/shows records October for ' +
      'that edition — the hardcoded `month: \'September\'` in the Sanity branch is still there.'
  );
}

if (failures.length > 0) {
  fail(`archive merge fidelity — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass('the archive list and detail page agree, and the merge preserves both static and Sanity fields.');
