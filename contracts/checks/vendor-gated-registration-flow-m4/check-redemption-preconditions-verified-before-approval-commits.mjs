#!/usr/bin/env node
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
//   (A) ENVIRONMENT PRECONDITIONS -- every `process.env.NAME` read in the redemption route that
//       is guarded by an `if (!ident) { ... return ... }` refusal. For each NAME found there,
//       the approval route's 'approve' branch must ALSO reference that same env var name,
//       somewhere before its ref.update() call.
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

function readSource(path) {
  const raw = readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
  // Strip comments -- this mission's own check/route headers narrate these exact identifiers
  // in prose (see this file's own header above), which would make a naive grep pass or fail
  // for the wrong reason.
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

let redemptionSource;
let approvalSource;
try {
  redemptionSource = readSource(REDEMPTION_ROUTE);
} catch {
  failures.push(`${REDEMPTION_ROUTE} does not exist.`);
}
try {
  approvalSource = readSource(APPROVAL_ROUTE);
} catch {
  failures.push(`${APPROVAL_ROUTE} does not exist.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}

// The approval route's 'approve' branch, and specifically the portion of it BEFORE the single
// commit -- everything this check requires must be checked strictly before that point. Scoped
// the same way A50's ordering check scopes it: from the start of the `if (body.action ===
// 'approve')` block to the first `ref.update(`.
const approveBlockAt = approvalSource.indexOf("if (body.action === 'approve')");
const firstUpdateAt = approvalSource.indexOf('ref.update(');
if (approveBlockAt === -1) {
  failures.push(`${APPROVAL_ROUTE}: could not locate the 'approve' action branch (if (body.action === 'approve') not found) -- extraction below cannot run.`);
}
if (firstUpdateAt === -1) {
  failures.push(`${APPROVAL_ROUTE}: no ref.update(...) call found -- cannot bound "before the commit".`);
}
const preCommitApproval =
  approveBlockAt !== -1 && firstUpdateAt !== -1 ? approvalSource.slice(approveBlockAt, firstUpdateAt) : '';

// -------------------------------------------------------------------------------------------
// (A) Environment preconditions: `process.env.NAME` (or `process.env['NAME']`) assigned to an
// identifier that is then guarded by `if (!ident) { ... return`.
// -------------------------------------------------------------------------------------------
const envGuardPattern =
  /const\s+(\w+)\s*=\s*process\.env(?:\.(\w+)|\[['"](\w+)['"]\])\s*;[\s\S]{0,300}?if\s*\(\s*!\s*\1\s*\)\s*\{[\s\S]{0,300}?return/g;

const envPreconditions = new Set();
for (const match of redemptionSource.matchAll(envGuardPattern)) {
  const name = match[2] || match[3];
  if (name) envPreconditions.add(name);
}

if (envPreconditions.size === 0) {
  failures.push(
    `${REDEMPTION_ROUTE}: found ZERO env-var refusal guards -- either this route no longer has ` +
      'one (fine, update this check\'s expectation), or the extraction pattern above no longer ' +
      'matches its current shape (a silent false negative, which this check must not report as ' +
      'green). Given the redemption route is known to read VENDOR_REGISTRATION_TOKEN_SECRET as ' +
      'of this check\'s authoring, treat an empty result as a FAIL until confirmed otherwise.',
  );
} else {
  for (const name of envPreconditions) {
    if (!preCommitApproval.includes(name)) {
      failures.push(
        `Environment precondition "${name}" is checked (with a refusal) by the redemption route ` +
          `(${REDEMPTION_ROUTE}) but is NOT referenced anywhere in the approval route's 'approve' ` +
          `branch before its commit (${APPROVAL_ROUTE}) -- an approval can commit while this ` +
          'precondition is unmet, leaving the vendor permanently unable to redeem the credential.',
      );
    }
  }
}

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
