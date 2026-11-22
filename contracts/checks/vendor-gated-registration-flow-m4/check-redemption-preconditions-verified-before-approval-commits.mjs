#!/usr/bin/env node
// LIMITS, stated plainly: this is a STRUCTURAL LINT, not a proof. It checks that both routes
// contain an unconditional-looking, returning refusal on the same secret read the same way. It
// cannot prove control flow: a dead condition (`if (false)`), an early exit before the guard, or
// a guard that returns the wrong response all pass here. The proof is the behavioural arms A
// (approve with the secret unset -> 503, nothing written) and D (redeem with the secret unset ->
// generic 403, no cookie, no Firestore access) in check-approval-redemption-behavioural.mjs.
// The comment/string masking below does not handle regex literals or backticks nested inside
// template-literal interpolations; neither route uses them today.
//
// vendor-gated-registration-flow M4 -- GENERAL, A42-style standing invariant (architect pass 5,
// team-lead review). Supersedes the narrower framing A50 shipped with, which only proved "the
// code is generated before the commit" -- a property that happened to be true of the OLD
// mechanism's shape and stayed true of the NEW one by coincidence, not by anything this check
// enforced. Codex found the real defect this left open: F24 moved the vendor's actual
// REDEMPTION dependency (VENDOR_REGISTRATION_TOKEN_SECRET, needed to mint the session cookie)
// from the approval route to a DIFFERENT file (the verify-code route), and nothing re-checked
// it at the new point of no return. Approval committed, the code was emailed, and every
// redemption attempt failed forever behind the (correctly) generic 403 -- the M1 dead-end
// reincarnated in a new file.
//
// The invariant this check enforces, mechanically, instead of by naming one instance of it:
// EVERY precondition the redemption path (POST /api/vendors/register/verify-code) depends on
// to succeed must ALSO be checked by the approval path (POST /api/admin/vendors/applications/
// [id]/review's 'approve' action) BEFORE its commit -- so a precondition that migrates to a
// different file, or a new one that's added later, is caught by construction rather than by
// someone remembering to update a per-instance check.
//
// Two classes of precondition are extracted, by STATIC ANALYSIS of the real redemption route,
// not hardcoded by name:
//
//   (A) ENVIRONMENT PRECONDITIONS -- every secret/env read in the redemption route, in either
//       shape (`process.env.NAME`, `process.env['NAME']`, or `getSecret('NAME')` from
//       lib/secrets.ts, which reads the secret bundles and falls back to process.env), that is
//       refused with a `return` INSIDE the guard's own block (`const X = ...; if (!X) { ...
//       return` or inline `if (!getSecret('NAME')) { ... return`). For each such NAME the
//       approval route's 'approve' block must contain a matching refusal that reads the secret
//       the SAME way (a bundle value wins over process.env in getSecret, so the two accessors
//       can disagree), before its ref.update() call. Comments and string literals are masked
//       first, and the approve block is bounded by its matching closing brace. A mention of
//       the name, or a log-only guard, does not count. Control flow proper (`if (false)
//       return`) is out of reach of a regex; check-approval-redemption-behavioural.mjs proves
//       it by running the real routes.
//   (B) MATCH-KEY PRECONDITIONS -- every Firestore `.where('field', '==', expr)` in the
//       redemption route's candidate lookup where `expr` is a VARIABLE (vendor-input-derived),
//       not a quoted string literal (a constant like `.where('status', '==', 'approved')` is
//       not vendor-input-derived and is excluded). For each such `field`, the approval route
//       must (1) write that same field name in its approval patch, and (2) guard the exact
//       expression it writes for that field with an `if (!expr)`-shaped truthiness refusal
//       before its ref.update() call -- catching the empty-slug dead end (a business name that
//       normalises to '' can never be matched by any vendor-typed input) the same way it would
//       catch a future field added to the same query.
//
// Both extraction rules are DATA, not the specific names VENDOR_REGISTRATION_TOKEN_SECRET /
// registrationCodeNameSlug -- a new env-gated precondition or a new variable-matched query
// field added to the redemption route later is picked up automatically, without touching this
// file.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m4/check-redemption-preconditions-verified-before-approval-commits.mjs

import { readFileSync } from 'node:fs';

const REDEMPTION_ROUTE = 'app/api/vendors/register/verify-code/route.ts';
const APPROVAL_ROUTE = 'app/api/admin/vendors/applications/[id]/review/route.ts';
const failures = [];

// Comments are blanked (same length, newlines kept) and string/template literal CONTENTS are
// masked to `_` in a second view, so structure (braces, `return`) is matched on code only: a
// `return` or `}` inside a string or comment can never count. Both views keep identical
// offsets, so a name matched as `_____` in the masked view is read back from the clean view.
function loadSource(path) {
  const raw = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  const clean = [];
  const masked = [];
  let i = 0;
  const blank = (ch) => (ch === '\n' ? '\n' : ' ');
  while (i < raw.length) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (ch === '/' && next === '*') {
      const end = raw.indexOf('*/', i + 2);
      const stop = end === -1 ? raw.length : end + 2;
      for (; i < stop; i++) {
        clean.push(blank(raw[i]));
        masked.push(blank(raw[i]));
      }
    } else if (ch === '/' && next === '/') {
      for (; i < raw.length && raw[i] !== '\n'; i++) {
        clean.push(' ');
        masked.push(' ');
      }
    } else if (ch === "'" || ch === '"' || ch === '`') {
      clean.push(ch);
      masked.push(ch);
      i++;
      for (; i < raw.length && raw[i] !== ch; i++) {
        if (raw[i] === '\\' && i + 1 < raw.length) {
          clean.push(raw[i], raw[i + 1]);
          masked.push('_', '_');
          i++;
        } else {
          clean.push(raw[i]);
          masked.push(raw[i] === '\n' ? '\n' : '_');
        }
      }
      if (i < raw.length) {
        clean.push(ch);
        masked.push(ch);
        i++;
      }
    } else {
      clean.push(ch);
      masked.push(ch);
      i++;
    }
  }
  return { clean: clean.join(''), masked: masked.join('') };
}

let redemption;
let approval;
try {
  redemption = loadSource(REDEMPTION_ROUTE);
} catch {
  failures.push(`${REDEMPTION_ROUTE} does not exist.`);
}
try {
  approval = loadSource(APPROVAL_ROUTE);
} catch {
  failures.push(`${APPROVAL_ROUTE} does not exist.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}

const redemptionSource = redemption.clean;
const approvalSource = approval.clean;

// Index of the `}` matching the `{` at `open`, on the literal-masked source; -1 if unbalanced.
function matchingBrace(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{') depth++;
    else if (masked[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

// The approval route's 'approve' branch, bounded to the block itself (matching closing brace)
// and to the first ref.update() after it opens: everything this check requires must sit inside
// the approve block, strictly before the single commit.
const approveHeadPattern = /if\s*\(\s*body\.action\s*===\s*'approve'\s*\)\s*\{/g;
let approveOpenAt = -1;
for (const m of approvalSource.matchAll(approveHeadPattern)) {
  if (approval.masked.startsWith('if', m.index)) {
    approveOpenAt = m.index + m[0].length - 1;
    break;
  }
}
let approveRange = null;
if (approveOpenAt === -1) {
  failures.push(`${APPROVAL_ROUTE}: could not locate the 'approve' action branch (if (body.action === 'approve') { not found) -- extraction below cannot run.`);
} else {
  const closeAt = matchingBrace(approval.masked, approveOpenAt);
  const updateAt = approval.masked.indexOf('ref.update(', approveOpenAt);
  if (closeAt === -1) {
    failures.push(`${APPROVAL_ROUTE}: the 'approve' block has no matching closing brace.`);
  } else if (updateAt === -1) {
    failures.push(`${APPROVAL_ROUTE}: no ref.update(...) call found after the 'approve' branch -- cannot bound "before the commit".`);
  } else {
    approveRange = [approveOpenAt, Math.min(closeAt, updateAt)];
  }
}
const preCommitApproval = approveRange ? approval.masked.slice(...approveRange) : '';

// -------------------------------------------------------------------------------------------
// (A) Environment preconditions. A guard is a refusal on a secret/env read, in either shape:
//   const X = ACCESSOR('NAME'); ... if (!X) { ... return ... }
//   if (!ACCESSOR('NAME')) { ... return ... }
// where ACCESSOR is process.env.NAME, process.env['NAME'] or getSecret('NAME'). Two structural
// rules, both measured with brace depth on the literal-masked source:
//   - the guard must be UNCONDITIONAL: it sits at the top level of the approve block (approval)
//     or of the POST handler body (redemption), not wrapped in an `if`/loop/callback that could
//     skip it. Neither real route wraps its guard in a try or any other block.
//   - the guard block must contain a `return` at ITS OWN top level (nested blocks and object
//     literals before it are fine; a return that lives only in a nested `if` or callback does
//     not count), so a log-only guard followed by an unrelated later `return` is rejected.
// Each guard is recorded as "accessor:NAME": both routes must read a secret the SAME way,
// because getSecret() lets a bundle value win over process.env, so a process.env guard and a
// getSecret guard can disagree.
// -------------------------------------------------------------------------------------------
const ACCESSOR =
  /(?:process\.env\.(\w+)|process\.env\[\s*['"](_+)['"]\s*\]|getSecret\(\s*['"](_+)['"]\s*\))/
    .source;
const guardAfterConst = new RegExp(
  `const\\s+(\\w+)\\s*=\\s*${ACCESSOR}\\s*;[\\s\\S]{0,300}?if\\s*\\(\\s*!\\s*\\1\\s*\\)\\s*\\{`,
  'dg',
);
const guardInline = new RegExp(`if\\s*\\(\\s*!\\s*${ACCESSOR}\\s*\\)\\s*\\{`, 'dg');

// depth[i] = number of `{` still open (relative to the start of `masked`) before character i.
function braceDepths(masked) {
  const depth = new Int32Array(masked.length + 1);
  let open = 0;
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === '}') open--;
    depth[i] = open;
    if (masked[i] === '{') open++;
  }
  return depth;
}

// `masked` with everything inside a nested { } blanked, so only top-level text remains.
function topLevelText(masked) {
  const depth = braceDepths(masked);
  let out = '';
  for (let i = 0; i < masked.length; i++) out += depth[i] === 0 ? masked[i] : ' ';
  return out;
}

// Reads "accessor:NAME" out of a match whose accessor groups start at `first` (1-based).
function guardKey(match, clean, first) {
  if (match[first]) return `process.env:${match[first]}`;
  const dotted = match.indices[first + 1];
  if (dotted) return `process.env:${clean.slice(dotted[0], dotted[1])}`;
  const bundled = match.indices[first + 2];
  return `getSecret:${clean.slice(bundled[0], bundled[1])}`;
}

// Guards in the region [from, to) of `source` that sit at the region's top level and whose own
// block contains a top-level `return`.
function findGuards(source, from, to) {
  const masked = source.masked.slice(from, to);
  const clean = source.clean.slice(from, to);
  const depth = braceDepths(masked);
  const keys = new Set();
  const consider = (m, first, startAt) => {
    const open = m.index + m[0].length - 1;
    if (depth[startAt] !== 0 || depth[open] !== 0) return;
    const close = matchingBrace(masked, open);
    if (close === -1) return;
    if (/\breturn\b/.test(topLevelText(masked.slice(open + 1, close)))) {
      keys.add(guardKey(m, clean, first));
    }
  };
  for (const m of masked.matchAll(guardAfterConst)) consider(m, 2, m.index);
  for (const m of masked.matchAll(guardInline)) consider(m, 1, m.index);
  return keys;
}

// The body of the route's `export async function POST(...) { ... }`, as [from, to).
function handlerBody(source) {
  const head = /export\s+async\s+function\s+POST\s*\([^)]*\)[^{]*\{/.exec(source.masked);
  if (!head) return null;
  const open = head.index + head[0].length - 1;
  const close = matchingBrace(source.masked, open);
  return close === -1 ? null : [open + 1, close];
}

const redemptionBody = handlerBody(redemption);
if (!redemptionBody) {
  failures.push(`${REDEMPTION_ROUTE}: could not locate the body of \`export async function POST\`.`);
}
const redemptionGuards = redemptionBody ? findGuards(redemption, ...redemptionBody) : new Set();
const approvalGuards = approveRange
  ? findGuards(approval, approveRange[0] + 1, approveRange[1])
  : new Set();

if (redemptionGuards.size === 0) {
  failures.push(
    `${REDEMPTION_ROUTE}: found ZERO env-var/secret refusal guards -- either this route no ` +
      'longer has one (fine, update this check\'s expectation), or the extraction pattern above ' +
      'no longer matches its current shape (a silent false negative, which this check must not ' +
      'report as green), or its guard no longer returns at its own top level or is no longer unconditional. Given the ' +
      'redemption route is known to read VENDOR_REGISTRATION_TOKEN_SECRET as of this check\'s ' +
      'authoring, treat an empty result as a FAIL until confirmed otherwise.',
  );
} else if (approveRange) {
  for (const key of redemptionGuards) {
    if (!approvalGuards.has(key)) {
      const [accessor, name] = key.split(':');
      failures.push(
        `Environment precondition "${name}" is refused (read via ${accessor}) by the redemption ` +
          `route (${REDEMPTION_ROUTE}) but the approval route's 'approve' block has no matching ` +
          `refusal -- an \`if (!${accessor === 'getSecret' ? `getSecret('${name}')` : `process.env.${name}`}) ` +
          `{ ... return }\` using the SAME accessor, inside the approve block, before its commit ` +
          `(${APPROVAL_ROUTE}) -- so an approval can commit while this precondition is unmet, ` +
          'leaving the vendor permanently unable to redeem the credential.',
      );
    }
  }
}
const envPreconditions = new Set([...redemptionGuards].map((k) => k.split(':')[1]));

// -------------------------------------------------------------------------------------------
// (B) Match-key preconditions: `.where('field', '==', expr)` where `expr` is NOT a quoted
// string literal (i.e. it varies with vendor-typed input, unlike a constant such as 'approved').
// -------------------------------------------------------------------------------------------
const whereClausePattern = /\.where\(\s*['"](\w+)['"]\s*,\s*['"]==['"]\s*,\s*([^)]+?)\s*\)/g;

const matchKeyFields = [];
for (const match of redemptionSource.matchAll(whereClausePattern)) {
  const [, field, exprRaw] = match;
  const expr = exprRaw.trim();
  const isQuotedLiteral = /^(['"]).*\1$/.test(expr);
  if (!isQuotedLiteral) {
    matchKeyFields.push(field);
  }
}

if (matchKeyFields.length === 0) {
  failures.push(
    `${REDEMPTION_ROUTE}: found ZERO vendor-input-derived .where(...) match keys in the ` +
      'candidate lookup -- either the lookup no longer matches on any vendor-typed value (fine, ' +
      'update this check\'s expectation), or the extraction pattern no longer matches its ' +
      'current shape. Treat as a FAIL until confirmed, same rationale as the env-precondition ' +
      'vacuous-scan guard above.',
  );
} else {
  for (const field of matchKeyFields) {
    // Find where the approval route writes this same field name in its patch (e.g.
    // `registrationCodeNameSlug: minted.nameSlug,`) and extract the expression assigned to it.
    const writeMatch = approvalSource.match(new RegExp(`${field}\\s*:\\s*([\\w.]+)\\s*,`));
    if (!writeMatch) {
      failures.push(
        `Match-key field "${field}" is used by the redemption route to look up an application ` +
          `by vendor-typed input, but the approval route (${APPROVAL_ROUTE}) does not write this ` +
          'field in its approval patch at all -- redemption can never find a match.',
      );
      continue;
    }
    const writtenExpr = writeMatch[1];
    // The written expression must be guarded by an `if (!expr)`-shaped truthiness refusal
    // somewhere in the pre-commit portion of the approve branch.
    const guardPattern = new RegExp(`if\\s*\\(\\s*!\\s*${writtenExpr.replace(/\./g, '\\.')}\\s*\\)`);
    if (!guardPattern.test(preCommitApproval)) {
      failures.push(
        `Match-key field "${field}" is written from the expression "${writtenExpr}" in the ` +
          `approval patch, but nothing in ${APPROVAL_ROUTE}'s 'approve' branch guards ` +
          `"${writtenExpr}" for truthiness before the commit -- an approval can commit a value ` +
          `for "${field}" (e.g. an empty string) that no vendor-typed input could ever match, ` +
          'the same permanent dead end as the missing-secret defect this check generalises.',
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every precondition the redemption route (verify-code) depends on -- ' +
    `${envPreconditions.size} environment guard(s) [${[...envPreconditions].join(', ')}] and ` +
    `${matchKeyFields.length} vendor-input-derived match-key field(s) [${matchKeyFields.join(', ')}] ` +
    "-- is also checked by the approval route's 'approve' branch before its commit, extracted by " +
    'static analysis of the real redemption route rather than hardcoded by name.',
);
process.exit(0);
