// m3-f4-gate-hardening F4a: every sanityFetch on the ticket buy path must bypass the data cache.
//   pnpm exec tsx scripts/checks/buy-path-live-reads.mts [--root <dir>] [--manifest <path>]
// Parses with the TypeScript compiler API, so reformatting, comments and multi-line calls cannot
// hide a call. Static and offline: no network, no build. Exit 0 clean, 1 violations, 2 setup.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_MANIFEST = resolve(
  REPO_ROOT,
  '.agent/memory/project/specs/backlog-wave-1028/m3-f4-gate-hardening/goldens/buy-path-live-reads.json',
);
const EXIT_VIOLATION = 1;
const EXIT_SETUP = 2;
const SANITY_FETCH = 'sanityFetch';
const FETCH_MODULE_SUFFIX = 'sanity/lib/fetch';
const CLIENT_MODULE_SUFFIX = 'sanity/lib/client';
const QUERIES_MODULE = 'sanity/queries';
const QUERIES_MODULE_EXTENSIONS = ['', '.ts', '.js'];
const ROOT_ALIAS = '@/';
const CREATE_CLIENT = 'createClient';

interface AllowEntry {
  file: string;
  query_identifier: string;
  reason: string;
}
interface CallerEntry {
  file: string;
  callee: string;
}
interface Manifest {
  files_every_sanityfetch_must_be_live: string[];
  allow_not_live: AllowEntry[];
  callers_must_pass_live_true: CallerEntry[];
  minimum_sites_found: Record<string, Record<string, number>>;
}

class SetupError extends Error {}

function optionValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value) throw new SetupError(`${flag} needs a value`);
  return value;
}

function loadManifest(path: string): Manifest {
  if (!existsSync(path)) throw new SetupError(`manifest not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest; // trusted repo golden, shape checked below
}

interface Bindings {
  fetchNames: Set<string>; // local names bound to sanityFetch
  namespaceNames: Set<string>; // local names bound to the whole fetch module
  clientNames: Set<string>; // local names bound to a Sanity client
}

function importBindings(source: ts.SourceFile): Bindings {
  const bindings: Bindings = { fetchNames: new Set([SANITY_FETCH]), namespaceNames: new Set(), clientNames: new Set(['client']) };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause) {
      const specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      const isFetchModule = specifier.endsWith(FETCH_MODULE_SUFFIX);
      const isClientModule = specifier.endsWith(CLIENT_MODULE_SUFFIX);
      const named = clause.namedBindings;
      if (isClientModule && clause.name) bindings.clientNames.add(clause.name.text);
      if (named && ts.isNamespaceImport(named)) {
        if (isFetchModule) bindings.namespaceNames.add(named.name.text);
        if (isClientModule) bindings.clientNames.add(named.name.text);
      } else if (named) {
        for (const element of named.elements) {
          if (isFetchModule && (element.propertyName ?? element.name).text === SANITY_FETCH) bindings.fetchNames.add(element.name.text);
          if (isClientModule) bindings.clientNames.add(element.name.text);
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === CREATE_CLIENT
    ) {
      bindings.clientNames.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return bindings;
}

// True when the call is sanityFetch(...) under any imported name, or ns.sanityFetch(...).
function isSanityFetchCall(call: ts.CallExpression, bindings: Bindings): boolean {
  const expression = call.expression;
  if (ts.isIdentifier(expression)) return bindings.fetchNames.has(expression.text);
  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    bindings.namespaceNames.has(expression.expression.text) &&
    expression.name.text === SANITY_FETCH
  );
}

function plainCalleeName(call: ts.CallExpression): string | null {
  return ts.isIdentifier(call.expression) ? call.expression.text : null;
}

function rootIdentifier(expression: ts.Expression): string | null {
  let current: ts.Expression = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = current.expression;
  return ts.isIdentifier(current) ? current.text : null;
}

function isClientFetch(call: ts.CallExpression, bindings: Bindings): boolean {
  const expression = call.expression;
  if (!ts.isPropertyAccessExpression(expression) || expression.name.text !== 'fetch') return false;
  const root = rootIdentifier(expression.expression);
  return root !== null && bindings.clientNames.has(root);
}

// A reference the checker cannot follow: sanityFetch (or the fetch module namespace) used anywhere
// except as the callee of a direct call.
function isUnfollowableReference(node: ts.Node, bindings: Bindings): boolean {
  if (!ts.isIdentifier(node)) return false;
  const parent = node.parent;
  const watched = bindings.fetchNames.has(node.text) || bindings.namespaceNames.has(node.text);
  if (!watched) return false;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isCallExpression(parent) && parent.expression === node) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node && bindings.namespaceNames.has(node.text)) {
    const grand = parent.parent;
    return !(parent.name.text === SANITY_FETCH && ts.isCallExpression(grand) && grand.expression === parent);
  }
  return true;
}

function bindsName(name: ts.BindingName, wanted: string): boolean {
  if (ts.isIdentifier(name)) return name.text === wanted;
  return name.elements.some((element) => !ts.isOmittedExpression(element) && bindsName(element.name, wanted));
}

function declaresLocal(body: ts.Node, wanted: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && bindsName(node.name, wanted)) found = true;
    if (!found) ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

// `live` is trustworthy only as a PARAMETER of an enclosing function; a local const, an outer
// variable or an import of that name is not.
function liveIsParameter(node: ts.Node): boolean {
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isFunctionLike(current)) continue;
    if (current.parameters.some((parameter) => bindsName(parameter.name, 'live'))) return true;
    if (current.body && declaresLocal(current.body, 'live')) return false;
  }
  return false;
}

// The static name of a plain property, or null for a computed key or a non-property member.
function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
  if (!ts.isPropertyAssignment(property)) return null;
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

// Options-object shapes whose runtime `live`/`query` value the checker cannot read off the syntax:
// a spread, a method or accessor member, a computed key (`["li" + "ve"]: false` overwrites `live`),
// or a repeated `live`/`query` key (the last one wins at runtime).
function unreadableOptionsReason(object: ts.ObjectLiteralExpression): string | null {
  const seen = new Map<string, number>();
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) return 'options object spreads an unknown value';
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      return 'options object has a method or accessor member';
    }
    if (ts.isComputedPropertyName(property.name)) return 'options object has a computed property key';
    const name = propertyName(property);
    if (name !== null) seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  for (const guarded of ['live', 'query']) {
    if ((seen.get(guarded) ?? 0) > 1) return `options object repeats the ${guarded} key`;
  }
  return null;
}

function findProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => propertyName(property) === name);
}

function passesLive(property: ts.ObjectLiteralElementLike): boolean {
  if (ts.isShorthandPropertyAssignment(property)) return liveIsParameter(property);
  if (!ts.isPropertyAssignment(property)) return false;
  const initializer = property.initializer;
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
  return ts.isIdentifier(initializer) && initializer.text === 'live' && liveIsParameter(initializer);
}

function queryIdentifier(object: ts.ObjectLiteralExpression): string | null {
  const property = findProperty(object, 'query');
  if (!property) return null;
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
  if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
    return property.initializer.text;
  }
  return null;
}

// Every declaration in the file that binds `name`: imports, parameters, variables (destructured
// too), catch variables, and function, class, enum and namespace names.
function declarationsOf(source: ts.SourceFile, name: string): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    const named =
      ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node) ||
      ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) ||
      ts.isClassExpression(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node) ||
      ts.isImportClause(node) || ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node);
    // Every kind matched above carries an optional `name`; the union has no common declared type.
    const declared = named ? (node as { name?: ts.Node }).name : undefined;
    if (declared && ts.isIdentifier(declared) && declared.text === name) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// True only when `specifier` resolves to <root>/sanity/queries itself: `@/` is the root (tsconfig
// paths), a relative specifier resolves from the importing file. A suffix match would let a barrel
// such as `@/evil/sanity/queries` re-export any query under an allowlisted name, so a bare package,
// any other alias, or a directory form (trailing `/`, which resolves to an index) is rejected.
function resolvesToQueriesModule(specifier: string, importer: string, root: string): boolean {
  if (specifier.endsWith('/')) return false;
  let target: string;
  if (specifier.startsWith(ROOT_ALIAS)) {
    target = resolve(root, specifier.slice(ROOT_ALIAS.length));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    target = resolve(dirname(importer), specifier);
  } else {
    return false;
  }
  const queriesModule = resolve(root, QUERIES_MODULE);
  return QUERIES_MODULE_EXTENSIONS.some((extension) => target === queriesModule + extension);
}

// An allowlist entry names the query exported by sanity/queries, not any identifier spelled the
// same: the name must be bound exactly once in the file, by an unaliased value import from that
// module. A parameter, local or alias of that name could hold any query, so it fails closed.
function isQueriesImport(source: ts.SourceFile, name: string, root: string): boolean {
  const declarations = declarationsOf(source, name);
  if (declarations.length !== 1) return false;
  const [specifier] = declarations;
  if (!ts.isImportSpecifier(specifier) || specifier.isTypeOnly) return false;
  if ((specifier.propertyName ?? specifier.name).text !== name) return false;
  const clause = specifier.parent.parent;
  const declaration = clause.parent;
  return (
    !clause.isTypeOnly &&
    ts.isStringLiteral(declaration.moduleSpecifier) &&
    resolvesToQueriesModule(declaration.moduleSpecifier.text, source.fileName, root)
  );
}

function judgeFetchCall(
  call: ts.CallExpression,
  allowedQueries: Set<string>,
  source: ts.SourceFile,
  root: string,
): string | null {
  const [argument] = call.arguments;
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    return 'options argument is not an object literal';
  }
  // Checked before the allowlist: a spread or computed key can replace an allowlisted `query` at
  // runtime (`...opts`, `["qu" + "ery"]: other`), so an unreadable object is never exempt.
  const unreadable = unreadableOptionsReason(argument);
  if (unreadable) return unreadable;
  const query = queryIdentifier(argument);
  if (query && allowedQueries.has(query)) {
    return isQueriesImport(source, query, root) ? null : `allowlisted ${query} is not bound only by its sanity/queries import`;
  }
  const live = findProperty(argument, 'live');
  if (!live) return 'no live property';
  return passesLive(live) ? null : 'live is not true';
}

function judgeCallerCall(call: ts.CallExpression): string | null {
  const [argument] = call.arguments;
  if (!argument || !ts.isObjectLiteralExpression(argument)) return 'no options object, live: true not passed';
  const unreadable = unreadableOptionsReason(argument);
  if (unreadable) return unreadable;
  const live = findProperty(argument, 'live');
  if (!live || !ts.isPropertyAssignment(live) || live.initializer.kind !== ts.SyntaxKind.TrueKeyword) {
    return 'live: true not passed';
  }
  return null;
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function checkFile(manifest: Manifest, root: string, relFile: string): { violations: string[]; sites: Record<string, number> } {
  const absolute = resolve(root, relFile);
  if (!existsSync(absolute)) throw new SetupError(`covered file missing: ${relFile}`);
  const source = ts.createSourceFile(absolute, readFileSync(absolute, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const allowed = new Set(manifest.allow_not_live.filter((entry) => entry.file === relFile).map((entry) => entry.query_identifier));
  const callers = new Set(manifest.callers_must_pass_live_true.filter((entry) => entry.file === relFile).map((entry) => entry.callee));
  const bindings = importBindings(source);
  const violations: string[] = [];
  const sites: Record<string, number> = {};
  const report = (node: ts.Node, callee: string, reason: string): void => {
    violations.push(`VIOLATION ${relFile}:${lineOf(source, node)} ${callee} ${reason}`);
  };
  const visit = (node: ts.Node): void => {
    if (isUnfollowableReference(node, bindings)) {
      report(node, SANITY_FETCH, 'non-call reference to sanityFetch; the checker cannot follow it');
    }
    if (ts.isCallExpression(node)) {
      const callee = plainCalleeName(node);
      if (isSanityFetchCall(node, bindings)) {
        sites[SANITY_FETCH] = (sites[SANITY_FETCH] ?? 0) + 1;
        const reason = judgeFetchCall(node, allowed, source, root);
        if (reason) report(node, SANITY_FETCH, reason);
      } else if (callee && callers.has(callee)) {
        sites[callee] = (sites[callee] ?? 0) + 1;
        const reason = judgeCallerCall(node);
        if (reason) report(node, callee, reason);
      } else if (isClientFetch(node, bindings)) {
        report(node, 'client.fetch', 'direct Sanity client fetch; page loaders must go through sanityFetch');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { violations, sites };
}

function main(): number {
  const root = resolve(optionValue('--root') ?? REPO_ROOT);
  const manifest = loadManifest(resolve(optionValue('--manifest') ?? DEFAULT_MANIFEST));
  const violations: string[] = [];
  const setupProblems: string[] = [];
  let total = 0;
  for (const relFile of manifest.files_every_sanityfetch_must_be_live) {
    const result = checkFile(manifest, root, relFile);
    violations.push(...result.violations);
    for (const [kind, minimum] of Object.entries(manifest.minimum_sites_found[relFile] ?? {})) {
      const found = result.sites[kind] ?? 0;
      total += found;
      if (found < minimum) setupProblems.push(`${relFile}: found ${found} ${kind} call(s), manifest needs at least ${minimum}`);
    }
  }
  if (violations.length > 0) {
    for (const line of violations) console.log(line);
    return EXIT_VIOLATION;
  }
  if (setupProblems.length > 0) {
    for (const problem of setupProblems) console.error(`SETUP ${problem}`);
    return EXIT_SETUP;
  }
  console.log(`ok ${total} sites`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error('buy-path-live-reads failed:', error instanceof Error ? error.message : error);
  process.exit(EXIT_SETUP);
}
