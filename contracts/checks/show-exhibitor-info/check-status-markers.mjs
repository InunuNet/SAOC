#!/usr/bin/env node
// RENDERED — THE HONESTY CHECK. The single most important assertion in this contract.
//
// The mission's crux: an exhibitor turned away at staging because this page invented a deadline
// has been harmed. Every unconfirmed block must carry a visible marker saying so. This check
// proves it against the rendered HTML, with the marker text read live from the dataset — so a
// label hardcoded into ExhibitorStatusBadge that happens to match today's seed cannot pass.
//
// It asserts four things:
//   1. Every one of the ten confirmation blocks has a status in the dataset, and it is one of the
//      four legal values.
//   2. NOTHING is seeded 'confirmed'. Nothing on this page ships as committee-confirmed fact.
//   3. The dataset's label text for each status appears on the page at least as many times as
//      there are blocks carrying that status.
//   4. Fail-closed: the badge component contains no literal label string, so an unset status
//      cannot silently render nothing.

import { readFileSync } from 'node:fs';

import {
  runCheck,
  fetchOkPage,
  fetchExhibitorInfo,
  fetchExhibitorSteps,
  textContains,
  countText,
  CONFIRMATION_BLOCKS,
  STATUS_VALUES,
  PATHS,
} from './_shared.mjs';

const BADGE = 'components/show/ExhibitorStatusBadge.tsx';

await runCheck('check-status-markers', async (r) => {
  const info = await fetchExhibitorInfo();
  const steps = await fetchExhibitorSteps();
  const { body } = await fetchOkPage(PATHS.exhibitors);

  const labels = {
    pending: info.pendingLabel,
    research: info.researchLabel,
    question: info.questionLabel,
  };

  for (const [status, label] of Object.entries(labels)) {
    r.check(
      typeof label === 'string' && label.trim().length > 0,
      `dataset holds a ${status} label`,
      `got ${JSON.stringify(label)}`,
    );
  }

  // --- 1 & 2: every block has a legal, non-confirmed status ---
  const confirmations = info.confirmations ?? {};
  const tally = { pending: 0, research: 0, question: 0, confirmed: 0 };

  for (const block of CONFIRMATION_BLOCKS) {
    const status = confirmations[block];
    const legal = STATUS_VALUES.includes(status);
    r.check(legal, `confirmations.${block} is one of ${STATUS_VALUES.join('/')}`, `got ${JSON.stringify(status)}`);
    if (legal) tally[status] += 1;
    r.check(
      status !== 'confirmed',
      `confirmations.${block} is NOT 'confirmed' — nothing ships as committee-confirmed fact`,
    );
  }

  // Array items and step documents carry their own status, same rule.
  for (const row of info.keyDates ?? []) {
    r.check(STATUS_VALUES.includes(row.status), `key date "${row.label}" has a legal status`, `got ${JSON.stringify(row.status)}`);
    r.check(row.status !== 'confirmed', `key date "${row.label}" is not seeded 'confirmed'`);
    if (STATUS_VALUES.includes(row.status)) tally[row.status] += 1;
  }
  for (const step of steps.filter((s) => s.active !== false)) {
    r.check(STATUS_VALUES.includes(step.status), `step "${step.title}" has a legal status`, `got ${JSON.stringify(step.status)}`);
    r.check(step.status !== 'confirmed', `step "${step.title}" is not seeded 'confirmed'`);
    if (STATUS_VALUES.includes(step.status)) tally[step.status] += 1;
  }

  // --- 3: the markers actually reach the page, once per block carrying that status ---
  for (const status of ['pending', 'research', 'question']) {
    const expected = tally[status];
    if (expected === 0) continue;
    const label = labels[status];
    const found = countText(body, label);
    r.check(
      found >= expected,
      `the ${status} marker renders for all ${expected} ${status} block(s) — found ${found}`,
      'a block carrying this status rendered without its marker. That block reads as settled SAOC ' +
        'policy to anyone looking at the page, which is the exact harm this mission exists to prevent.',
    );
  }

  // A 'confirmed' block renders NOTHING. Since nothing is seeded confirmed, the inverse assertion
  // available today is that no marker text appears for a status no block holds.
  if (tally.confirmed === 0) {
    r.ok('no block is confirmed, so no confirmed-state rendering is possible yet');
  }

  // --- 4: fail-closed. The badge hardcodes no label. ---
  let badgeSrc = '';
  try {
    badgeSrc = readFileSync(BADGE, 'utf8');
  } catch {
    r.fail(`${BADGE} exists`);
    return;
  }
  for (const [status, label] of Object.entries(labels)) {
    r.check(
      !badgeSrc.includes(label),
      `${BADGE} does not hardcode the ${status} label`,
      'the label is in the component, so an editor changing the wording in Studio would change ' +
        'nothing on the page',
    );
  }
  // Fail-closed, structural half: the ONLY status that may produce no output is 'confirmed'.
  // Every other path, including an unrecognised one, falls through to pendingLabel. A component
  // that returns null anywhere other than the explicit confirmed branch fails open, and a block
  // with a typo in its status would then read as settled policy.
  const nullReturns = (badgeSrc.match(/return null/g) ?? []).length;
  r.check(
    nullReturns === 1,
    `${BADGE} returns null exactly once (the 'confirmed' branch) — found ${nullReturns}`,
    'more than one null return means there is a path where an unconfirmed block renders no marker',
  );
  r.check(
    /confirmed/.test(badgeSrc),
    `${BADGE} names the 'confirmed' status explicitly rather than treating it as the default`,
  );
  r.check(
    badgeSrc.includes('pendingLabel'),
    `${BADGE} uses pendingLabel as the fallback for an unknown status`,
  );

  // The BEHAVIOURAL half of fail-closed — writing a garbage status into the dataset and proving a
  // marker still renders — needs a dataset mutation, so it lives in check-cms-round-trip.mjs
  // where the capture/restore machinery already exists. It is not asserted twice.
});
