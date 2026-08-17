#!/usr/bin/env node
// fictional-test-show — planActiveShowSwap() (lib/fictional-test-show-active-swap-plan.ts) is
// a GENERIC safety-invariant function: it must leave EXACTLY one show active in every case, or
// refuse (`safe:false`) when it cannot confirm the target exists at all. See golden README
// "The one human step this design cannot avoid, and why" and "Judgement calls made" item 5.
//
// DEFEATING MUTATION named up front: any implementation that (a) trusts the caller's claim
// that a target show exists instead of checking `shows` for it (would let a typo'd id silently
// "activate" a nonexistent document with no deactivation happening at all — `safe:true` on a
// no-op that looks like a real swap); (b) deactivates only ONE of several already-active shows
// in a pre-existing two-simultaneously-active state instead of ALL of them (would leave TWO
// shows active after "applying" a plan marked safe); or (c) special-cases FICTIONAL_SHOW_ID
// specifically (e.g. an `if (targetShowId === FICTIONAL_SHOW_ID)` branch) rather than staying
// a generic function of its `shows`/`targetShowId` arguments. The fixtures below use ARBITRARY
// show ids for every structural case, plus one case that swaps in FICTIONAL_SHOW_ID as an
// ordinary input alongside arbitrary others — proving genericity by using the same code path,
// not a fictional-show-specific one.
//
// Run as: node --import tsx/esm contracts/checks/fictional-test-show/check-active-swap-plan-safety.mjs

import { planActiveShowSwap } from '../../../lib/fictional-test-show-active-swap-plan.ts';
import { FICTIONAL_SHOW_ID } from '../../../lib/fictional-test-show.ts';

const failures = [];

function assertLeavesExactlyOneActive(plan, shows, targetShowId, label) {
  if (!plan.safe) {
    failures.push(`(${label}) expected safe:true, got safe:false (reason: ${plan.reason}).`);
    return;
  }
  // Simulate applying the plan against the input `shows` and confirm exactly one is active
  // afterward — the load-bearing invariant, checked by actually applying the plan rather than
  // trusting its shape alone.
  const applied = shows.map((s) => {
    if (s._id === plan.activate) return { ...s, active: true };
    if (plan.deactivate.includes(s._id)) return { ...s, active: false };
    return s;
  });
  const activeAfter = applied.filter((s) => s.active === true).map((s) => s._id);
  if (activeAfter.length !== 1 || activeAfter[0] !== targetShowId) {
    failures.push(
      `(${label}) applying the plan left active=${JSON.stringify(activeAfter)}, expected exactly [${JSON.stringify(targetShowId)}].`,
    );
  }
}

// --- (1) Zero shows currently active -> plans to activate only the target, deactivate empty. ---

{
  const shows = [
    { _id: 'show-alpha', active: false },
    { _id: 'show-beta', active: false },
  ];
  const plan = planActiveShowSwap(shows, 'show-beta');
  if (plan.safe && plan.deactivate.length !== 0) {
    failures.push(`(1) expected empty deactivate list with zero shows active, got ${JSON.stringify(plan.deactivate)}.`);
  }
  if (plan.safe && plan.activate !== 'show-beta') {
    failures.push(`(1) expected activate === 'show-beta', got ${JSON.stringify(plan.activate)}.`);
  }
  assertLeavesExactlyOneActive(plan, shows, 'show-beta', '1');
}

// --- (2) One different show active -> plans to deactivate exactly that one, activate target. ---

{
  const shows = [
    { _id: 'show-alpha', active: true },
    { _id: 'show-beta', active: false },
  ];
  const plan = planActiveShowSwap(shows, 'show-beta');
  if (plan.safe && JSON.stringify(plan.deactivate) !== JSON.stringify(['show-alpha'])) {
    failures.push(`(2) expected deactivate === ['show-alpha'], got ${JSON.stringify(plan.deactivate)}.`);
  }
  assertLeavesExactlyOneActive(plan, shows, 'show-beta', '2');
}

// --- (3) Target itself already the sole active show -> safe:true, deactivate: [] (no-op- ---
// --- shaped, not misreported as unsafe or as a deactivate-then-reactivate churn). ---

{
  const shows = [
    { _id: 'show-alpha', active: false },
    { _id: 'show-beta', active: true },
  ];
  const plan = planActiveShowSwap(shows, 'show-beta');
  if (!plan.safe) {
    failures.push(`(3) target already sole active show: expected safe:true, got safe:false (reason: ${plan.reason}).`);
  } else {
    if (plan.deactivate.length !== 0) {
      failures.push(`(3) expected deactivate: [] (no-op-shaped), got ${JSON.stringify(plan.deactivate)}.`);
    }
    if (plan.activate !== 'show-beta') {
      failures.push(`(3) expected activate === 'show-beta', got ${JSON.stringify(plan.activate)}.`);
    }
  }
  assertLeavesExactlyOneActive(plan, shows, 'show-beta', '3');
}

// --- (4) Two shows simultaneously active already (pre-existing ambiguous state) -> plans to ---
// --- deactivate BOTH, not just one, leaving exactly the target active. ---

{
  const shows = [
    { _id: 'show-alpha', active: true },
    { _id: 'show-beta', active: true },
    { _id: 'show-gamma', active: false },
  ];
  const plan = planActiveShowSwap(shows, 'show-gamma');
  if (plan.safe && JSON.stringify(plan.deactivate) !== JSON.stringify(['show-alpha', 'show-beta'])) {
    failures.push(
      `(4) expected deactivate === ['show-alpha', 'show-beta'] (sorted, both currently-active ` +
        `non-target shows), got ${JSON.stringify(plan.deactivate)} — a plan that deactivates ` +
        `only one of two already-active shows would leave two shows active after applying it.`,
    );
  }
  assertLeavesExactlyOneActive(plan, shows, 'show-gamma', '4');
}

// --- (5) Target id absent from the input shows array entirely -> safe:false, reason names ---
// --- the missing id, never a plan that silently activates an unconfirmed show. ---

{
  const shows = [
    { _id: 'show-alpha', active: true },
    { _id: 'show-beta', active: false },
  ];
  const plan = planActiveShowSwap(shows, 'show-does-not-exist');
  if (plan.safe !== false) {
    failures.push('(5) target absent from shows array: expected safe:false, got safe:true — a typo\'d target id must never silently succeed.');
  } else if (typeof plan.reason !== 'string' || !plan.reason.includes('show-does-not-exist')) {
    failures.push(`(5) expected plan.reason to name the missing id 'show-does-not-exist', got ${JSON.stringify(plan.reason)}.`);
  }
}

// --- (6) Genericity: FICTIONAL_SHOW_ID used as an ORDINARY input alongside arbitrary others, ---
// --- proving no fictional-show-specific branch exists in this "generic" function. ---

{
  const shows = [
    { _id: 'show-19-2027', active: true },
    { _id: FICTIONAL_SHOW_ID, active: false },
  ];
  const plan = planActiveShowSwap(shows, FICTIONAL_SHOW_ID);
  if (plan.safe && JSON.stringify(plan.deactivate) !== JSON.stringify(['show-19-2027'])) {
    failures.push(`(6a) swapping to FICTIONAL_SHOW_ID: expected deactivate === ['show-19-2027'], got ${JSON.stringify(plan.deactivate)}.`);
  }
  assertLeavesExactlyOneActive(plan, shows, FICTIONAL_SHOW_ID, '6a');

  // The reverse direction — swapping AWAY from the fictional show back to the real one —
  // must behave identically to any other two-show swap, confirming there's no asymmetric
  // special case for "the fictional show as source" either.
  const showsReverse = [
    { _id: 'show-19-2027', active: false },
    { _id: FICTIONAL_SHOW_ID, active: true },
  ];
  const planReverse = planActiveShowSwap(showsReverse, 'show-19-2027');
  if (planReverse.safe && JSON.stringify(planReverse.deactivate) !== JSON.stringify([FICTIONAL_SHOW_ID])) {
    failures.push(`(6b) swapping away from FICTIONAL_SHOW_ID: expected deactivate === ['${FICTIONAL_SHOW_ID}'], got ${JSON.stringify(planReverse.deactivate)}.`);
  }
  assertLeavesExactlyOneActive(planReverse, showsReverse, 'show-19-2027', '6b');
}

if (failures.length > 0) {
  console.error('FAIL: check-active-swap-plan-safety\n' + failures.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}

console.log(
  'PASS: planActiveShowSwap() leaves exactly one show active in every fixture (zero active, ' +
    'one different active, target already sole active, two simultaneously active), refuses a ' +
    'target absent from the input, and behaves identically whether FICTIONAL_SHOW_ID or an ' +
    'arbitrary id is the target or the source — proving genericity.',
);
process.exit(0);
