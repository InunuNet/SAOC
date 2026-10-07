// F4 (conference-workshop-tickets, M2) — A23: structural pins on
// app/api/tickets/checkout/route.ts's day-cap construction — QA found (2026-10-07) that
// no standing check pinned either of these two real fixes, so reverting them would
// leave the local gate fully green:
//
//   1. the sibling-registration loop (~line 800) that registers EVERY
//      DAY_VISITOR_SHAPED_SLUGS slug into dayCapPoolConfigByType for a line item's
//      chosenDay — not just that line item's own ticketType. Reverting this to a
//      cart-only assignment reproduces the exact cross-slug oversell A4/A12 cover at
//      the planPooledCapacity() level, but one layer up, at the route's own
//      construction site.
//   2. the legacy-no-chosenDay carve-out (~line 1109-1133) that sums every
//      DAY_VISITOR_SHAPED_SLUGS slug's UNQUALIFIED sold count (pre-dates early-bird's
//      requiresDaySelection flip, commit cbac259c) and adds it into every day-cap pool
//      key actually in play — dropping this silently undercounts the day cap by
//      however many such legacy positions exist.
//
// Same pattern as A18 (regex against extracted real source, never executing route.ts —
// it is a Next.js route with Firestore transactions, out of scope for a pure lib-level
// check). UNLIKE A18, this check additionally proves it bites: both regex pairs are run
// a SECOND time against an IN-MEMORY MUTATED COPY of the extracted block text that
// reverts each fix to the shape QA warned about, and must fail there. The mutation only
// ever touches a local string — route.ts on disk is read-only throughout.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REL_PATH = 'app/api/tickets/checkout/route.ts';
const absPath = path.join(__dirname, '../../../', REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(absPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-day-cap-route-structural-pins.mjs');
  console.error(`  - could not read ${REL_PATH}: ${error.message}`);
  process.exit(1);
}

/** Extracts the balanced `{ ... }` block starting at the first `{` after `anchor`'s
 * match index, by brace-depth counting. Returns null if the anchor or a balanced close
 * isn't found — never throws, so a caller can turn that into a clear failure message. */
function extractBlockAfter(text, anchorRegex) {
  const anchorMatch = text.match(anchorRegex);
  if (!anchorMatch) return null;
  const anchorIdx = anchorMatch.index;
  const braceOpenIdx = text.indexOf('{', anchorIdx);
  if (braceOpenIdx === -1) return null;
  let depth = 0;
  for (let i = braceOpenIdx; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(anchorIdx, i + 1);
    }
  }
  return null;
}

// --- Pin 1: the sibling-registration loop, inside the dayCapLineItems loop ---
const lineItemLoop = extractBlockAfter(source, /for\s*\(\s*const\s+lineItem\s+of\s+dayCapLineItems\s*\)/);
if (!lineItemLoop) {
  failures.push('could not find/balance the "for (const lineItem of dayCapLineItems)" block — route.ts structure changed; this pin needs re-authoring, not silent skip');
} else {
  const checkSiblingLoop = (text) => {
    const siblingLoopMatch = text.match(/for\s*\(\s*const\s+slug\s+of\s+DAY_VISITOR_SHAPED_SLUGS\s*\)/);
    if (!siblingLoopMatch) {
      return 'no "for (const slug of DAY_VISITOR_SHAPED_SLUGS)" loop inside the dayCapLineItems block — every sibling slug must be registered for this chosenDay, not just the cart\'s own ticketType (see A4\'s cross-slug CONTROL/FIX pair for the oversell this produces)';
    }
    const afterLoop = text.slice(siblingLoopMatch.index);
    if (!/dayCapPoolConfigByType\s*\[\s*siblingKey\s*\]\s*=/.test(afterLoop)) {
      return 'the DAY_VISITOR_SHAPED_SLUGS loop never assigns dayCapPoolConfigByType[siblingKey] — registering the slug alone, with no pool-config write, closes nothing';
    }
    return null;
  };

  const realFailure = checkSiblingLoop(lineItemLoop);
  if (realFailure) failures.push(`PIN 1 (sibling loop), real source: ${realFailure}`);

  // BITE PROOF: mutate an in-memory copy back to the cart-only shape QA warned about —
  // register only the current line item's own requestKey/poolKey, drop the sibling loop
  // entirely — and confirm the SAME assertion now correctly fails. Pure string surgery
  // on a local variable; route.ts on disk is never touched.
  const siblingLoopBlock = extractBlockAfter(lineItemLoop, /for\s*\(\s*const\s+slug\s+of\s+DAY_VISITOR_SHAPED_SLUGS\s*\)/);
  if (!siblingLoopBlock) {
    failures.push('BITE PROOF (sibling loop): could not extract the real sibling loop block to mutate — cannot prove this pin bites');
  } else {
    const mutatedLineItemLoop = lineItemLoop.replace(
      siblingLoopBlock,
      'dayCapPoolConfigByType[requestKey] = { pool: poolKey, headcountPerUnit: 1 };',
    );
    const mutatedFailure = checkSiblingLoop(mutatedLineItemLoop);
    if (!mutatedFailure) {
      failures.push('BITE PROOF (sibling loop): reverting to the cart-only assignment did NOT trip PIN 1 — this check proves nothing about the regression QA warned about');
    }
  }
}

// --- Pin 2: the legacy-no-chosenDay carve-out, inside the day-cap capacity check ---
const dayCapIfBlock = extractBlockAfter(
  source,
  /if\s*\(\s*Object\.keys\(input\.dayCapRequestedQtyByType\)\.length\s*>\s*0\s*\)/,
);
if (!dayCapIfBlock) {
  failures.push('could not find/balance the day-cap "if (Object.keys(input.dayCapRequestedQtyByType).length > 0)" block — route.ts structure changed; this pin needs re-authoring, not silent skip');
} else {
  const checkLegacyCarveOut = (text) => {
    if (!/DAY_VISITOR_SHAPED_SLUGS\.reduce\s*\(/.test(text)) {
      return 'no DAY_VISITOR_SHAPED_SLUGS.reduce( — the legacy no-chosenDay carve-out (pre-dates early-bird\'s requiresDaySelection flip, commit cbac259c) is not being summed at all';
    }
    if (!/soldCountsByTypeAndDayWithLegacy\s*\[\s*poolKey\s*\]\s*=\s*\(\s*soldCountsByTypeAndDayWithLegacy\s*\[\s*poolKey\s*\]\s*\?\?\s*0\s*\)\s*\+\s*legacyNoChosenDayHeads/.test(text)) {
      return 'legacyNoChosenDayHeads is computed but never added into soldCountsByTypeAndDayWithLegacy[poolKey] — the legacy sum is dead code, not wired into any day-cap pool';
    }
    if (!/planPooledCapacity\s*\(\s*\{[\s\S]*?soldCountsByType:\s*soldCountsByTypeAndDayWithLegacy/.test(text)) {
      return 'planPooledCapacity() for the day cap is not called with soldCountsByType: soldCountsByTypeAndDayWithLegacy — the legacy-adjusted totals are computed but never actually fed into the capacity decision';
    }
    return null;
  };

  const realFailure = checkLegacyCarveOut(dayCapIfBlock);
  if (realFailure) failures.push(`PIN 2 (legacy carve-out), real source: ${realFailure}`);

  // BITE PROOF: mutate an in-memory copy to drop the legacy addition — keep
  // soldCountsByTypeAndDayWithLegacy as a bare spread of soldCountsByTypeAndDay, with
  // no legacy heads ever added — and confirm the SAME assertion now fails.
  const legacyIfBlock = extractBlockAfter(dayCapIfBlock, /if\s*\(\s*legacyNoChosenDayHeads\s*>\s*0\s*\)/);
  if (!legacyIfBlock) {
    failures.push('BITE PROOF (legacy carve-out): could not extract the real "if (legacyNoChosenDayHeads > 0)" block to mutate — cannot prove this pin bites');
  } else {
    const mutatedDayCapIfBlock = dayCapIfBlock.replace(legacyIfBlock, '/* legacy carve-out removed by mutation */');
    const mutatedFailure = checkLegacyCarveOut(mutatedDayCapIfBlock);
    if (!mutatedFailure) {
      failures.push('BITE PROOF (legacy carve-out): dropping the legacy addition did NOT trip PIN 2 — this check proves nothing about the regression QA warned about');
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-day-cap-route-structural-pins.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: route.ts registers every DAY_VISITOR_SHAPED_SLUGS slug into dayCapPoolConfigByType for each line item\'s chosenDay, and sums the legacy no-chosenDay carve-out into the day-cap pools actually fed to planPooledCapacity() — both pins proven to bite against an in-memory mutated copy, route.ts itself never touched.',
);
