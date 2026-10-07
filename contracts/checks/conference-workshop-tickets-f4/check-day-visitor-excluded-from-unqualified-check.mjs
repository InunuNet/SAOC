// F4 (conference-workshop-tickets, M2) — A24: structural pins on
// app/api/tickets/checkout/route.ts's UNQUALIFIED planPooledCapacity() call, binding
// this check to the REAL source the same way A23 does — not a hand-typed fixture that
// would keep failing after @dev's fix (or, symmetrically, a hand-typed fixture
// asserting the FIXED shape that would pass without ever looking at route.ts.
//
// Codex found (2026-10-07, verified by team-lead against source): the unqualified
// check's requestedQtyByType/capacityByType/poolConfigByType construction included
// day-visitor's own slug unconditionally, with capacityByType['day-visitor'] = 1000
// read from getSoldCountsByTicketType() — an AGGREGATE count across ALL days. Golden §2
// is explicit that day-visitor has NO unqualified pool at all; its ONLY ceiling is the
// per-day-qualified check. Three structures must exclude it for the fix to actually
// work (golden §2's "Unqualified-check product list" addendum):
//   1. capacityByType — day-visitor's own ceiling must never be written into it.
//   2. poolConfigByType — same.
//   3. requestedQtyByType — EVEN IF (1)/(2) exclude it, if day-visitor still appears as
//      a key here, planPooledCapacity() resolves its pool to itself with NO entry in
//      capacityByType, defaulting to capacity 0 — WORSE than the original bug, since
//      every day-visitor purchase would then be refused outright. All three or none.
//
// Pins 1 and 2 against the per-slug construction loop (route.ts:605-629ish, anchored on
// `for (const slug of distinctTicketTypes)`), pin 3 against the requestedQtyByType call
// site (anchored on `aggregateRequestedQuantities(`). Each pin is proven to bite against
// an in-memory mutated copy reverting to the exact pre-fix shape — route.ts itself is
// never written to.
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
  console.error('FAIL: check-day-visitor-excluded-from-unqualified-check.mjs');
  console.error(`  - could not read ${REL_PATH}: ${error.message}`);
  process.exit(1);
}

/** Same balanced-brace block extractor as A23's check-day-cap-route-structural-pins.mjs. */
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

/** Extracts a single statement starting at `anchorRegex`'s match, through the matching
 * close of the first `(` found after it plus the trailing `;` — for a `const x = fn(...)`
 * call site, not a `{ ... }` block. */
function extractCallStatementAfter(text, anchorRegex) {
  const anchorMatch = text.match(anchorRegex);
  if (!anchorMatch) return null;
  const anchorIdx = anchorMatch.index;
  const parenOpenIdx = text.indexOf('(', anchorIdx);
  if (parenOpenIdx === -1) return null;
  let depth = 0;
  let closeIdx = -1;
  for (let i = parenOpenIdx; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx === -1) return null;
  const semiIdx = text.indexOf(';', closeIdx);
  if (semiIdx === -1) return null;
  return text.slice(anchorIdx, semiIdx + 1);
}

// --- Pin 1 & 2: capacityByType/poolConfigByType excluded inside the per-slug loop ---
const perSlugLoop = extractBlockAfter(source, /for\s*\(\s*const\s+slug\s+of\s+distinctTicketTypes\s*\)/);
if (!perSlugLoop) {
  failures.push('could not find/balance the "for (const slug of distinctTicketTypes)" block — route.ts structure changed; this pin needs re-authoring, not silent skip');
} else {
  const checkPerSlugExclusion = (text) => {
    const guardMatch = text.match(/if\s*\(\s*slug\s*===\s*DAY_VISITOR_DAY_CAP_POOL_KEY\s*\)/);
    if (!guardMatch) {
      return 'no "if (slug === DAY_VISITOR_DAY_CAP_POOL_KEY)" branch in the per-slug loop — day-visitor is not distinguished from any other slug before capacityByType/poolConfigByType are written';
    }
    const afterGuard = text.slice(guardMatch.index);
    const elseMatch = afterGuard.match(/\}\s*else\s*\{/);
    if (!elseMatch) {
      return 'the DAY_VISITOR_DAY_CAP_POOL_KEY branch has no "} else {" — capacityByType/poolConfigByType writes must live in the ELSE branch, never run for day-visitor';
    }
    const elseBody = afterGuard.slice(elseMatch.index);
    if (!/capacityByType\s*\[\s*poolKey\s*\]\s*=/.test(elseBody)) {
      return 'capacityByType[poolKey] = ... does not appear inside the else branch — day-visitor exclusion is not actually wired to this write';
    }
    if (!/poolConfigByType\s*\[\s*slug\s*\]\s*=/.test(elseBody)) {
      return 'poolConfigByType[slug] = ... does not appear inside the else branch — day-visitor exclusion is not actually wired to this write';
    }
    return null;
  };

  const realFailure = checkPerSlugExclusion(perSlugLoop);
  if (realFailure) failures.push(`PIN 1/2 (per-slug construction), real source: ${realFailure}`);

  // BITE PROOF: mutate an in-memory copy back to the exact pre-fix shape — the
  // unconditional assignment, no day-visitor branch at all — and confirm the SAME
  // assertion now correctly fails.
  const ifBlock = extractBlockAfter(perSlugLoop, /if\s*\(\s*slug\s*===\s*DAY_VISITOR_DAY_CAP_POOL_KEY\s*\)/);
  if (!ifBlock) {
    failures.push('BITE PROOF (per-slug construction): could not extract the real if block to mutate — cannot prove this pin bites');
  } else {
    // ifBlock only captures `if (...) { ... }` — the trailing `else { ... }` is a separate
    // balanced block immediately after it; locate and append it by index, not string
    // slicing tricks, so the mutation target covers the WHOLE if/else, not just the if.
    const ifStartIdx = perSlugLoop.indexOf(ifBlock);
    const ifEndIdx = ifStartIdx + ifBlock.length;
    const afterIf = perSlugLoop.slice(ifEndIdx);
    const elseBlock = extractBlockAfter(afterIf, /else/);
    const fullIfElse = elseBlock
      ? perSlugLoop.slice(ifStartIdx, ifEndIdx + afterIf.indexOf(elseBlock) + elseBlock.length)
      : ifBlock;
    const preFixUnconditional =
      'const poolKey = capacityPool ?? slug;\n' +
      '    const thisTypeCeiling = effectiveCapacity(capacity, releasedQuantity);\n' +
      '    capacityByType[poolKey] =\n' +
      '      poolKey in capacityByType\n' +
      '        ? Math.min(capacityByType[poolKey], thisTypeCeiling)\n' +
      '        : thisTypeCeiling;\n' +
      '    poolConfigByType[slug] = { pool: capacityPool ?? null, headcountPerUnit: headcountPerUnit ?? 1 };';
    const mutatedLoop = perSlugLoop.replace(fullIfElse, preFixUnconditional);
    if (mutatedLoop === perSlugLoop) {
      failures.push('BITE PROOF (per-slug construction): mutation did not change the extracted text — the if/else span was not located precisely enough to mutate');
    } else {
      const mutatedFailure = checkPerSlugExclusion(mutatedLoop);
      if (!mutatedFailure) {
        failures.push('BITE PROOF (per-slug construction): reverting to the pre-fix unconditional assignment did NOT trip PIN 1/2 — this check proves nothing about the regression Codex found');
      }
    }
  }
}

// --- Pin 3: requestedQtyByType excludes day-visitor at the unqualified call site ---
const requestedQtyStatement = extractCallStatementAfter(
  source,
  /const\s+requestedQtyByType\s*=\s*aggregateRequestedQuantities\s*\(/,
);
if (!requestedQtyStatement) {
  failures.push('could not find/balance the "const requestedQtyByType = aggregateRequestedQuantities(...)" statement — route.ts structure changed; this pin needs re-authoring, not silent skip');
} else {
  const checkRequestedQtyExclusion = (text) =>
    /\.filter\s*\(\s*\([^)]*\)\s*=>[^)]*!==\s*DAY_VISITOR_DAY_CAP_POOL_KEY/.test(text) ||
    /\.filter\s*\(\s*\([^)]*\)\s*=>[^)]*DAY_VISITOR_DAY_CAP_POOL_KEY\s*!==/.test(text)
      ? null
      : 'aggregateRequestedQuantities(...) is not called against a .filter(...) excluding DAY_VISITOR_DAY_CAP_POOL_KEY — day-visitor can still appear as a requestedQtyByType key, which (even with PIN 1/2 fixed) would default its capacity to 0 and wrongly refuse every day-visitor purchase';

  const realFailure = checkRequestedQtyExclusion(requestedQtyStatement);
  if (realFailure) failures.push(`PIN 3 (requestedQtyByType), real source: ${realFailure}`);

  // BITE PROOF: mutate an in-memory copy back to the pre-fix shape — the bare,
  // unfiltered input.lineItems — and confirm the SAME assertion now fails.
  const mutatedStatement = requestedQtyStatement.replace(
    /input\.lineItems\.filter\s*\([^)]*\)\s*=>[\s\S]*?\)/,
    'input.lineItems',
  );
  if (mutatedStatement === requestedQtyStatement) {
    failures.push('BITE PROOF (requestedQtyByType): mutation did not change the extracted text — the .filter(...) call was not located precisely enough to mutate');
  } else {
    const mutatedFailure = checkRequestedQtyExclusion(mutatedStatement);
    if (!mutatedFailure) {
      failures.push('BITE PROOF (requestedQtyByType): reverting to the unfiltered input.lineItems did NOT trip PIN 3 — this check proves nothing about the regression Codex found');
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-day-visitor-excluded-from-unqualified-check.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: route.ts excludes day-visitor\'s own slug from the unqualified check\'s capacityByType, poolConfigByType, AND requestedQtyByType — all three pins proven to bite against in-memory mutated copies reverting to the pre-fix shape, route.ts itself never touched.',
);
