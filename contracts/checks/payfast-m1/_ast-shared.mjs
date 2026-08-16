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

/** Collect every `transaction.get(docRef)` call in the given subtree (or whole source if
 * `root` is a SourceFile). */
export function findTransactionGetDocRef(root) {
  const found = [];
  function visit(node) {
    if (
      node &&
      isNamedPropertyCall(node, 'transaction', 'get') &&
      firstArgIsIdentifier(node, 'docRef')
    ) {
      found.push(node);
    }
    if (node) ts.forEachChild(node, visit);
  }
  if (root) visit(root);
  return found;
}

/** Collect every `transaction.update(docRef, ...)` call in the given subtree. */
export function findTransactionUpdateDocRef(root) {
  const found = [];
  function visit(node) {
    if (
      node &&
      isNamedPropertyCall(node, 'transaction', 'update') &&
      firstArgIsIdentifier(node, 'docRef')
    ) {
      found.push(node);
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

export function isDescendantOf(node, ancestor) {
  if (!node || !ancestor) return false;
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}
