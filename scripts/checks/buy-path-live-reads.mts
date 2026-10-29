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

function calleeName(call: ts.CallExpression): string | null {
  const expression = call.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  return null;
}

function isClientFetch(call: ts.CallExpression): boolean {
  const expression = call.expression;
  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === 'fetch' &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'client'
  );
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
  if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) return property.name.text;
  return null;
}

function findProperty(object: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => propertyName(property) === name);
}

function passesLive(property: ts.ObjectLiteralElementLike): boolean {
  if (ts.isShorthandPropertyAssignment(property)) return true;
  if (!ts.isPropertyAssignment(property)) return false;
  const initializer = property.initializer;
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
  return ts.isIdentifier(initializer) && initializer.text === 'live';
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

function judgeFetchCall(call: ts.CallExpression, allowedQueries: Set<string>): string | null {
  const [argument] = call.arguments;
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    return 'options argument is not an object literal';
  }
  if (argument.properties.some((property) => ts.isSpreadAssignment(property))) {
    return 'options object spreads an unknown value';
  }
  const query = queryIdentifier(argument);
  if (query && allowedQueries.has(query)) return null;
  const live = findProperty(argument, 'live');
  if (!live) return 'no live property';
  return passesLive(live) ? null : 'live is not true';
}

function judgeCallerCall(call: ts.CallExpression): string | null {
  const [argument] = call.arguments;
  if (!argument || !ts.isObjectLiteralExpression(argument)) return 'no options object, live: true not passed';
  const live = findProperty(argument, 'live');
  if (!live || !ts.isPropertyAssignment(live) || live.initializer.kind !== ts.SyntaxKind.TrueKeyword) {
    return 'live: true not passed';
  }
  return null;
}

function collectCalls(source: ts.SourceFile): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
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
  const violations: string[] = [];
  const sites: Record<string, number> = {};
  const report = (call: ts.CallExpression, callee: string, reason: string): void => {
    violations.push(`VIOLATION ${relFile}:${lineOf(source, call)} ${callee} ${reason}`);
  };
  for (const call of collectCalls(source)) {
    const callee = calleeName(call);
    if (callee === SANITY_FETCH) {
      sites[callee] = (sites[callee] ?? 0) + 1;
      const reason = judgeFetchCall(call, allowed);
      if (reason) report(call, callee, reason);
    } else if (callee && callers.has(callee)) {
      sites[callee] = (sites[callee] ?? 0) + 1;
      const reason = judgeCallerCall(call);
      if (reason) report(call, callee, reason);
    } else if (isClientFetch(call)) {
      report(call, 'client.fetch', 'direct client.fetch; page loaders must go through sanityFetch');
    }
  }
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
  if (setupProblems.length > 0) {
    for (const problem of setupProblems) console.error(`SETUP ${problem}`);
    return EXIT_SETUP;
  }
  if (violations.length > 0) {
    for (const line of violations) console.log(line);
    return EXIT_VIOLATION;
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
