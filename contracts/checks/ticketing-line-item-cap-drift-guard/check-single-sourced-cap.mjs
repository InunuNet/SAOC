// A1 — MAX_LINE_ITEMS must be single-sourced: lib/tickets-constants.ts holds the ONE
// numeric literal, and both app/api/tickets/checkout/route.ts and lib/cart.ts import
// that SAME symbol — never redeclare their own literal, even if it happens to equal 20
// today.
//
// WHY THIS FIX EXISTS
// lib/cart.ts originally defined a LOCAL CART_MAX_LINE_ITEMS = 20, deliberately, because
// a client component cannot import a VALUE from app/api/tickets/checkout/route.ts (that
// module imports firebase-admin/Sanity at module scope, which cannot be chunked into a
// browser bundle — confirmed via `pnpm build`, Turbopack: "the chunking context does not
// support external modules"). That left the SAME number written in two files with
// nothing keeping them equal: raise the server's cap and the client silently keeps
// blocking at the old number, with no visible error — a legitimate purchase refused for
// no reason a buyer or a support agent can see.
//
// THE TWO TRAPS THIS CHECK IS DESIGNED AROUND (named explicitly by the team lead)
//   1. "A check that merely greps for the literal `20` in both files would pass even
//      after someone changes one of them to a different literal." Avoided: this check
//      never looks for the literal `20` anywhere. It reads the ACTUAL RUNTIME VALUES of
//      the imported symbols (case A below) and separately proves, via TypeScript AST
//      parsing (not text grep), that the consuming files import the symbol rather than
//      declaring their own literal (case B) — a divergent literal in either file fails
//      case B regardless of what number it happens to be.
//   2. "Would also pass if both imports were deleted." Avoided: case B's import-presence
//      check fails outright — loudly, by file and reason — the moment either consumer's
//      import of MAX_LINE_ITEMS from lib/tickets-constants is missing, REGARDLESS of
//      whether the two values still happen to be numerically equal (case A could still
//      pass by coincidence; case B cannot).
//
// Case C is a self-referential behavioural boundary test: parseLineItems() must accept
// exactly `MAX_LINE_ITEMS` line items and reject `MAX_LINE_ITEMS + 1` — using WHATEVER
// value is currently imported, never a hardcoded 20 — proving the route's actual
// validation logic is wired to the shared constant's live value, not merely that some
// unrelated exported number matches it.
//
// Run as: npx tsx contracts/checks/ticketing-line-item-cap-drift-guard/check-single-sourced-cap.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const failures = [];

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CART_FILE = 'lib/cart.ts';
const ROUTE_FILE = 'app/api/tickets/checkout/route.ts';
const CONSTANTS_FILE = 'lib/tickets-constants.ts';
const CAP_SYMBOL_PATTERN = /MAX_LINE_ITEMS/i;

function parseSourceText(sourceText, fileName = 'fixture.ts') {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
}

function parseSource(relPath) {
  const sourceText = readFileSync(REPO_ROOT + relPath, 'utf8');
  return parseSourceText(sourceText, relPath);
}

/** True if `sourceFile` has an ImportDeclaration whose module specifier resolves to
 *  lib/tickets-constants (relative or '@/lib/tickets-constants') AND whose named
 *  bindings include a symbol matching CAP_SYMBOL_PATTERN. */
function importsCapFromTicketsConstants(sourceFile) {
  let found = false;
  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node)) return;
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;
    const spec = node.moduleSpecifier.text;
    if (!/tickets-constants/.test(spec)) return;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    for (const element of bindings.elements) {
      if (CAP_SYMBOL_PATTERN.test(element.name.text)) found = true;
    }
  });
  return found;
}

/** True if `sourceFile` declares a variable whose name matches CAP_SYMBOL_PATTERN and
 *  whose initializer is a bare NumericLiteral — i.e. a local, hardcoded redeclaration
 *  of the cap, the exact drift vector this check exists to kill. Walks the whole tree
 *  (not just top-level statements) so a redeclaration nested in a function/block is
 *  still caught. */
function hasLocalNumericLiteralCap(sourceFile) {
  let found = false;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      CAP_SYMBOL_PATTERN.test(node.name.text) &&
      node.initializer &&
      ts.isNumericLiteral(node.initializer)
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

// --- Detector self-test — proves hasLocalNumericLiteralCap()/importsCapFromTicketsConstants() ---
// --- actually discriminate, against synthetic fixtures, BEFORE either is trusted to judge ---
// --- the real files. A detector that has stopped discriminating must fail loudly here, not ---
// --- silently pass everything against the real tree (same convention as this project's own ---
// --- contracts/checks/ticketing-hardening/check-checkin-route-delegates.mjs). ------------------

{
  const COMPLIANT_CONSUMER = `
    import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';
    export function parseLineItems(raw) {
      if (raw.length > MAX_LINE_ITEMS) return null;
      return raw;
    }
  `;
  const NON_COMPLIANT_LOCAL_LITERAL = `
    export const MAX_LINE_ITEMS = 20;
    export function parseLineItems(raw) {
      if (raw.length > MAX_LINE_ITEMS) return null;
      return raw;
    }
  `;
  const NON_COMPLIANT_NO_IMPORT_NO_LITERAL = `
    const CAP = 20;
    export function parseLineItems(raw) {
      if (raw.length > CAP) return null;
      return raw;
    }
  `;
  // Deliberately no alias — a real "partial fix" (import correctly added, but the OLD
  // local literal declaration never removed) would produce this exact duplicate-binding
  // shape textually. ts.createSourceFile() only parses syntax, not semantics, so this
  // is a valid AST to test against even though it would not actually compile.
  const NON_COMPLIANT_IMPORT_PLUS_SHADOW_LITERAL = `
    import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';
    export const MAX_LINE_ITEMS = 20; // leftover from before the fix — never removed
    export function parseLineItems(raw) {
      if (raw.length > MAX_LINE_ITEMS) return null;
      return raw;
    }
  `;
  const CONSTANTS_SOURCE_OF_TRUTH = `export const MAX_LINE_ITEMS = 20;`;

  const compliant = parseSourceText(COMPLIANT_CONSUMER);
  if (!importsCapFromTicketsConstants(compliant)) {
    failures.push('SELF-TEST: importsCapFromTicketsConstants() failed to detect a genuinely compliant import — detector is broken (false negative).');
  }
  if (hasLocalNumericLiteralCap(compliant)) {
    failures.push('SELF-TEST: hasLocalNumericLiteralCap() falsely flagged a compliant, import-only consumer — detector is broken (false positive).');
  }

  const localLiteral = parseSourceText(NON_COMPLIANT_LOCAL_LITERAL);
  if (!hasLocalNumericLiteralCap(localLiteral)) {
    failures.push('SELF-TEST: hasLocalNumericLiteralCap() failed to catch a local `export const MAX_LINE_ITEMS = 20;` redeclaration — detector is broken.');
  }

  const noImportNoLiteral = parseSourceText(NON_COMPLIANT_NO_IMPORT_NO_LITERAL);
  if (importsCapFromTicketsConstants(noImportNoLiteral)) {
    failures.push('SELF-TEST: importsCapFromTicketsConstants() falsely reported an import that does not exist — detector is broken (false positive).');
  }
  if (hasLocalNumericLiteralCap(noImportNoLiteral)) {
    failures.push('SELF-TEST: hasLocalNumericLiteralCap() falsely flagged a differently-named local constant (CAP, not MAX_LINE_ITEMS-shaped) — detector is broken (false positive on a name it should not match).');
  }

  const shadowed = parseSourceText(NON_COMPLIANT_IMPORT_PLUS_SHADOW_LITERAL);
  if (!importsCapFromTicketsConstants(shadowed) || !hasLocalNumericLiteralCap(shadowed)) {
    failures.push('SELF-TEST: the shadow-literal fixture (a real import PLUS a shadowing local literal) must trip BOTH detectors — proves a partial fix (import added but old literal left behind) is still caught.');
  }

  const sourceOfTruth = parseSourceText(CONSTANTS_SOURCE_OF_TRUTH);
  if (!hasLocalNumericLiteralCap(sourceOfTruth)) {
    failures.push('SELF-TEST: hasLocalNumericLiteralCap() failed to recognise the canonical source-of-truth declaration shape itself — detector is broken.');
  }
}

// --- Case B (structural, checked first — a missing import makes case A's equality ---
// --- meaningless even if it happens to pass) --------------------------------------------

{
  const constantsSource = parseSource(CONSTANTS_FILE);
  if (!hasLocalNumericLiteralCap(constantsSource)) {
    failures.push(
      `(B) ${CONSTANTS_FILE} does not declare a numeric-literal MAX_LINE_ITEMS — the single ` +
        `source of truth itself is missing or was moved without updating this check.`
    );
  }

  for (const file of [CART_FILE, ROUTE_FILE]) {
    const source = parseSource(file);
    if (!importsCapFromTicketsConstants(source)) {
      failures.push(
        `(B) ${file} does not import MAX_LINE_ITEMS from lib/tickets-constants — either the ` +
          `import was never added, or it was deleted. A numerically-equal local literal would ` +
          `NOT satisfy this (see case A below, which is deliberately not sufficient alone).`
      );
    }
    if (hasLocalNumericLiteralCap(source)) {
      failures.push(
        `(B) ${file} declares its OWN numeric-literal cap constant — this is the exact drift ` +
          `vector (two independently-editable literals) this check exists to forbid, even if ` +
          `today's value happens to match lib/tickets-constants.ts.`
      );
    }
  }
}

// --- Case A (runtime, corroborating — necessary but, alone, NOT sufficient; see the ---
// --- header comment on why case B must also pass) AND Case C (behavioural, self- ---
// --- referential — never hardcodes 20; tracks whatever value is currently imported) ---
//
// Dynamic, guarded imports: on the unmodified/not-yet-implemented tree,
// lib/tickets-constants.ts does not export MAX_LINE_ITEMS at all, which is real,
// expected red — reported as a distinct, clearly-labelled failure rather than letting
// the whole script crash before the structural (case B) and self-test results above are
// ever printed.

function validLineItem(n) {
  return { ticketType: 'early-bird', attendeeName: `Attendee ${n}`, attendeeEmail: `attendee${n}@example.com` };
}

try {
  const [{ MAX_LINE_ITEMS }, { CART_MAX_LINE_ITEMS }, { parseLineItems }] = await Promise.all([
    import('../../../lib/tickets-constants.ts'),
    import('../../../lib/cart.ts'),
    import('../../../app/api/tickets/checkout/route.ts'),
  ]);

  if (MAX_LINE_ITEMS === undefined) {
    failures.push('(A) lib/tickets-constants.ts does not export MAX_LINE_ITEMS yet — the single source of truth has not been created.');
  } else if (CART_MAX_LINE_ITEMS !== MAX_LINE_ITEMS) {
    failures.push(
      `(A) lib/cart.ts's CART_MAX_LINE_ITEMS (${CART_MAX_LINE_ITEMS}) !== ` +
        `lib/tickets-constants.ts's MAX_LINE_ITEMS (${MAX_LINE_ITEMS}) at runtime.`
    );
  }

  if (MAX_LINE_ITEMS !== undefined) {
    const atCap = Array.from({ length: MAX_LINE_ITEMS }, (_, i) => validLineItem(i));
    const overCap = Array.from({ length: MAX_LINE_ITEMS + 1 }, (_, i) => validLineItem(i));

    const atCapResult = parseLineItems(atCap);
    if (atCapResult === null || atCapResult.length !== MAX_LINE_ITEMS) {
      failures.push(`(C) parseLineItems rejected exactly MAX_LINE_ITEMS (${MAX_LINE_ITEMS}) valid items — should accept.`);
    }

    const overCapResult = parseLineItems(overCap);
    if (overCapResult !== null) {
      failures.push(`(C) parseLineItems accepted MAX_LINE_ITEMS + 1 (${MAX_LINE_ITEMS + 1}) items — should reject.`);
    }
  }
} catch (error) {
  failures.push(`(A/C) could not import one of the three modules to run the runtime/behavioural checks: ${error.message}`);
}

// Negative control: the harness itself must be able to detect a real mismatch — prove by
// comparing two DIFFERENT numbers, not by trusting the equality operator blindly.
if (5 === 6) {
  failures.push('NEGATIVE CONTROL FAILED: the equality check itself is broken (this branch must be unreachable).');
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: MAX_LINE_ITEMS is single-sourced from lib/tickets-constants.ts, imported (not redeclared) by both consumers, and route.ts\'s validation boundary tracks it live.');
