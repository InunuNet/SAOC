// Pure decision for the --live-reads positive control (m3-f4 Codex finding P2): a cached read must
// be SEEN on request one and ABSENT on request two. Absent on both means the read is missing or
// renamed, and would otherwise pass vacuously.
import { readFileSync } from 'node:fs';

import ts from 'typescript';

import { normaliseGroq } from './groq-fingerprint.mjs';

const DEFINE_QUERY = 'defineQuery';

// Returns the failure messages for one control read; an empty list is a pass.
export function judgeCachedControl(name, firstCount, secondCount) {
  const failures = [];
  if (firstCount < 1) {
    failures.push(`positive control ${name} never appeared on the first request (read missing or renamed; control is vacuous)`);
  }
  if (secondCount !== 0) {
    failures.push(`second request serves ${name} from cache (got ${secondCount} request(s))`);
  }
  return failures;
}

function isExported(statement) {
  return (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

// The GROQ text of `export const <name> = defineQuery(`...`)` in a query module, read off the
// syntax tree so a renamed, removed or interpolated query is a setup error, never a silent match.
export function exportedQueryText(sourcePath, name) {
  const source = ts.createSourceFile(sourcePath, readFileSync(sourcePath, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const call = declaration.initializer;
      const literal = call && ts.isCallExpression(call) && ts.isIdentifier(call.expression) &&
        call.expression.text === DEFINE_QUERY && call.arguments.length === 1 ? call.arguments[0] : null;
      if (!literal || !(ts.isNoSubstitutionTemplateLiteral(literal) || ts.isStringLiteral(literal))) {
        throw new Error(`${name} in ${sourcePath} is not defineQuery() of one plain string`);
      }
      return literal.text;
    }
  }
  throw new Error(`no exported ${name} in ${sourcePath}`);
}

// The exact GROQ text a golden read names, checked against the golden's readable fingerprint so a
// golden that drifts from the source query fails loudly.
export function goldenReadQuery(sourcePath, read) {
  const text = exportedQueryText(sourcePath, read.name);
  if (!normaliseGroq(text).includes(read.fingerprint)) {
    throw new Error(`${read.name} no longer contains the golden fingerprint ${JSON.stringify(read.fingerprint)}`);
  }
  return text;
}
