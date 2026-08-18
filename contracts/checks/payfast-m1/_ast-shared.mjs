// Shared TypeScript-AST helpers for the two structural checks in this directory
// (check-paid-write-inside-transaction-scope.mjs and
// check-server-confirm-fetch-outside-transaction-scope.mjs).
//
// WHY AST, NOT GREP
// The audit's finding on A30/A31/A32 was precisely that grep/line-number checks can be
// satisfied by a decoy: an unrelated no-op db.runTransaction() elsewhere, or a fetch()
// call that merely appears earlier in the file than a runTransaction call it has nothing
// to do with. Both checks below instead parse the route with the TypeScript compiler API
// (already a devDependency — no new dependency added) and reason about lexical scope:
// is this specific CallExpression a descendant of that specific callback body.
//
// `typescript` ships as a devDependency of this project (package.json) — used here only
// for parsing, never emitted/compiled.

import ts from 'typescript';

export function parseSource(sourceText, fileName = 'route.ts') {
  return ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
}

function isPropertyAccessCall(node, propertyName) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === propertyName
  );
}

/** True if `node` is `<objectName>.<propertyName>(...)` where objectName is a plain
 * identifier (e.g. `transaction.get`, `db.runTransaction`). */
function isNamedPropertyCall(node, objectName, propertyName) {
  return (
    isPropertyAccessCall(node, propertyName) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === objectName
  );
}

function firstArgIsIdentifier(node, identifierName) {
  const arg = node.arguments[0];
  return Boolean(arg) && ts.isIdentifier(arg) && arg.text === identifierName;
}

/** The first argument's identifier text, or null if the first argument isn't a plain
 * identifier. Used where the caller must discriminate BY the identifier's name (e.g.
 * 'orderRef' vs 'positionRef'), rather than test against one hardcoded name. */
function firstArgIdentifierName(node) {
  const arg = node.arguments[0];
  return arg && ts.isIdentifier(arg) ? arg.text : null;
}

/**
 * F4 (production-blockers) — locates a NAMED top-level function declaration's body,
 * so callers can scope a subsequent `findRunTransactionCallback` search to it rather
 * than the whole file.
 *
 * WHY THIS IS NEEDED (bug this fixes)
 * `findRunTransactionCallback` (below) walks whatever root it is given and returns the
 * FIRST `db.runTransaction(...)` call it finds. That was safe while route.ts had only
 * one such call, but post-F10 `lib/orders.ts` has TWO: `createOrderWithPosition`'s
 * (F8's comp-ticket write, appears earlier in the file) and
 * `markOrderAndPositionPaidByPaymentId`'s (the paid-write these checks actually care
 * about, appears later). Scoping to the named function's body FIRST means "first in the
 * given root" and "correct one" are the same call again, regardless of source order.
 *
 * Only matches a top-level `export (async) function <name>(...) { ... }` declaration —
 * arrow-function/const assignments are out of scope, since both functions this helper
 * needs to resolve (`createOrderWithPosition`, `markOrderAndPositionPaidByPaymentId`)
 * are declared this way.
 */
export function findFunctionDeclarationBody(sourceFile, functionName) {
  let body = null;
  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === functionName &&
      node.body
    ) {
      body = node.body;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return body;
}

// --- self-test: scoping resolves by NAME, not by position in source order ---------
//
// A decoy fixture with two SIBLING function declarations, each containing its own
// db.runTransaction call: one shaped like createOrderWithPosition (appears FIRST in
// source order) and one shaped like markOrderAndPositionPaidByPaymentId (appears
// SECOND). Without this decoy, a regression that silently reverts
// findFunctionDeclarationBody to "first in file" would pass unnoticed — this proves
// resolution genuinely discriminates by name.
const SIBLING_DECOY_SOURCE = `
  export async function createOrderWithPosition(input) {
    await db.runTransaction(async (transaction) => {
      transaction.set(orderRef, order);
      transaction.set(positionRef, position);
    });
  }

  export async function markOrderAndPositionPaidByPaymentId(input) {
    await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      const positionDoc = await transaction.get(positionRef);
      transaction.update(orderRef, { status: 'paid' });
      transaction.update(positionRef, { status: 'paid' });
    });
  }
`;

{
  const decoySourceFile = parseSource(SIBLING_DECOY_SOURCE, 'orders-decoy.ts');
  const targetBody = findFunctionDeclarationBody(decoySourceFile, 'markOrderAndPositionPaidByPaymentId');
  const decoyBody = findFunctionDeclarationBody(decoySourceFile, 'createOrderWithPosition');
  if (!targetBody || !decoyBody) {
    throw new Error(
      '_ast-shared.mjs self-test: findFunctionDeclarationBody failed to resolve one of the two sibling decoy functions'
    );
  }
  const { callbackBody: scopedToTarget } = findRunTransactionCallback(targetBody);
  const { callbackBody: scopedToDecoy } = findRunTransactionCallback(decoyBody);
  if (!scopedToTarget || !isDescendantOf(scopedToTarget, targetBody)) {
    throw new Error(
      '_ast-shared.mjs self-test: scoping by name did not resolve markOrderAndPositionPaidByPaymentId to its OWN db.runTransaction — resolution is not discriminating by name'
    );
  }
  if (scopedToTarget === scopedToDecoy) {
    throw new Error(
      '_ast-shared.mjs self-test: markOrderAndPositionPaidByPaymentId and createOrderWithPosition resolved to the SAME runTransaction callback — scoping fell back to first-in-file (the exact regression this helper defends against)'
    );
  }
}

/** Find the first `<anything>.runTransaction(async (transaction) => { ... })` call in
 * the source. Returns both the CallExpression node (for position comparisons) and the
 * callback's body node (for descendant/scope checks). Deliberately does not require the
 * receiver to be named `db` — only that the method is `runTransaction` with a
 * function-typed first argument, since the receiver name is not a security property. */
export function findRunTransactionCallback(sourceFile) {
  let callExprNode = null;
  let callbackBody = null;
  function visit(node) {
    if (isPropertyAccessCall(node, 'runTransaction')) {
      const [callback] = node.arguments;
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        callExprNode = node;
        callbackBody = callback.body;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { callExprNode, callbackBody };
}

/**
 * Collect every `transaction.get(<identifier>)` call in the given subtree (or whole
 * source if `root` is a SourceFile), tagged with the identifier's own text.
 *
 * F4 (production-blockers) — generalised from a single hardcoded 'docRef' name:
 * `lib/orders.ts`'s `markOrderAndPositionPaidByPaymentId` updates TWO distinct refs
 * (`orderRef`, `positionRef`) in the same transaction, so get-before-update must be
 * checked PER IDENTIFIER, not against one literal name.
 */
export function findTransactionGetRefs(root) {
  const found = [];
  function visit(node) {
    if (node && isNamedPropertyCall(node, 'transaction', 'get')) {
      const refName = firstArgIdentifierName(node);
      if (refName) found.push({ node, refName });
    }
    if (node) ts.forEachChild(node, visit);
  }
  if (root) visit(root);
  return found;
}

/** Collect every `transaction.update(<identifier>, ...)` call in the given subtree,
 * tagged with the identifier's own text. See findTransactionGetRefs for why this is
 * per-identifier rather than one hardcoded name. */
export function findTransactionUpdateRefs(root) {
  const found = [];
  function visit(node) {
    if (node && isNamedPropertyCall(node, 'transaction', 'update')) {
      const refName = firstArgIdentifierName(node);
      if (refName) found.push({ node, refName });
    }
    if (node) ts.forEachChild(node, visit);
  }
  if (root) visit(root);
  return found;
}

/** Collect every `fetch(PAYFAST_SANDBOX_VALIDATE_URL, ...)` call anywhere in the source
 * (bare-identifier `fetch`, matching the real global-fetch usage in route.ts — never
 * `something.fetch(...)`). */
export function findValidateFetchCalls(sourceFile) {
  const found = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'fetch' &&
      firstArgIsIdentifier(node, 'PAYFAST_SANDBOX_VALIDATE_URL')
    ) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

/**
 * F4 (production-blockers) — locates the first CallExpression anywhere in the source
 * whose callee is the bare identifier `name` (e.g. `markOrderAndPositionPaidByPaymentId(`)
 * or a property access ending in `.name` (e.g. `orders.markOrderAndPositionPaidByPaymentId(`).
 * Used by A32's route.ts claim to find the call site that hands off to the
 * now-relocated (lib/orders.ts) transactional paid-write, without needing any knowledge
 * of what module it was imported from.
 */
export function findFirstCallExpressionByCalleeName(sourceFile, name) {
  let found = null;
  function visit(node) {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === name) ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name))
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

export function isDescendantOf(node, ancestor) {
  if (!node || !ancestor) return false;
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}
