// F6 (conference-workshop-tickets, M4) — A30 (added 2026-10-07, team-lead widened the
// residual gap flagged alongside A29 into scope): the SAME Codex finding that produced
// A29 (loadTicketCardViewModel never throws past its own boundary) applies to its two
// sibling loaders — lib/view-models/load-presenters.ts's loadPresenterViewModels() and
// lib/view-models/load-workshop-sessions.ts's loadWorkshopSessionViewModels() — both have
// their OWN unguarded top-level `client.fetch(...)` call with no try/catch, and both are
// called by the same three pages (symposium/wosa-conference/workshops). See golden's
// Addendum 4 (widened this pass to cover all three loaders).
//
// STRUCTURAL check, not DI-driven: neither loader takes a `deps` argument (confirmed by
// reading both files in full — no optional second parameter, no injectable fetch
// function), so there is no seam to force a failure through dynamically the way A29 does
// for loadTicketCardViewModel. Per team-lead's explicit fallback instruction, this checks
// by STRUCTURE instead: the fetch call must sit inside a try block whose immediately
// following catch block (a) calls console.error, (b) with a string literal starting with
// a bracketed `[module-tag]` prefix (the project's established convention — see
// app/api/tickets/checkout/route.ts's own `console.error('[tickets/checkout] ...', error)`
// calls; NOT pinned to one exact tag text, since @dev is choosing per call site), and
// (c) returns the same empty-array default (`return [];`) each function already uses for
// its own `!client` branch — never a rethrow, never a silent swallow with no log.
//
// Brace-depth scanning (findMatchingBrace below) is used to extract the exact try/catch
// block boundaries precisely — a plain regex cannot reliably find a matching closing
// brace, but a depth counter can, deterministically, as long as neither block's source
// contains a `{`/`}` inside a string/template literal (true for both files today; if that
// ever changes, this check would need the same care any other brace-counting tool does).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { finish } from './_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function checkLoaderWrapsFetchInTryCatch({ relPath, fetchCallSnippet }) {
  const failures = [];
  let source;
  try {
    source = readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  } catch (error) {
    failures.push(`${relPath}: could not read file: ${error.message}`);
    return failures;
  }

  const fetchIndex = source.indexOf(fetchCallSnippet);
  if (fetchIndex === -1) {
    failures.push(`${relPath}: could not find ${JSON.stringify(fetchCallSnippet)} in source — this check is stale against the real call site`);
    return failures;
  }

  // Nearest preceding `try {` before the fetch call.
  const tryPattern = /try\s*\{/g;
  let tryIndex = -1;
  let match;
  while ((match = tryPattern.exec(source)) !== null) {
    if (match.index < fetchIndex) tryIndex = match.index;
    else break;
  }
  if (tryIndex === -1) {
    failures.push(`${relPath}: the fetch call is not preceded by a 'try {' anywhere in the file — not wrapped in a try/catch`);
    return failures;
  }

  const tryOpenBraceIndex = source.indexOf('{', tryIndex);
  const tryCloseBraceIndex = findMatchingBrace(source, tryOpenBraceIndex);
  if (tryCloseBraceIndex === -1 || fetchIndex > tryCloseBraceIndex) {
    failures.push(`${relPath}: the fetch call falls outside the nearest preceding try block's braces — not actually wrapped`);
    return failures;
  }

  const afterTry = source.slice(tryCloseBraceIndex + 1);
  const catchMatch = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(afterTry);
  if (!catchMatch) {
    failures.push(`${relPath}: no catch clause immediately follows the try block wrapping the fetch call`);
    return failures;
  }
  const catchOpenBraceIndex = tryCloseBraceIndex + 1 + catchMatch[0].lastIndexOf('{');
  const catchCloseBraceIndex = findMatchingBrace(source, catchOpenBraceIndex);
  if (catchCloseBraceIndex === -1) {
    failures.push(`${relPath}: could not find the catch block's closing brace`);
    return failures;
  }
  const catchBody = source.slice(catchOpenBraceIndex + 1, catchCloseBraceIndex);

  if (!/console\.error\s*\(/.test(catchBody)) {
    failures.push(`${relPath}: the catch block does not call console.error(...) — a dependency failure must be logged, never swallowed silently`);
  } else if (!/console\.error\s*\(\s*['"`]\[[^\]]+\]/.test(catchBody)) {
    failures.push(`${relPath}: console.error is called but not with a string starting with a bracketed '[module-tag]' prefix — see app/api/tickets/checkout/route.ts's own convention`);
  }
  if (!/return\s*\[\s*\]\s*;/.test(catchBody)) {
    failures.push(`${relPath}: the catch block does not 'return [];' — expected the same empty-array default this function already uses for its '!client' branch`);
  }

  return failures;
}

const failures = [
  ...checkLoaderWrapsFetchInTryCatch({
    relPath: 'lib/view-models/load-presenters.ts',
    fetchCallSnippet: 'client.fetch(CONFERENCE_PRESENTERS_BY_EVENT_QUERY',
  }),
  ...checkLoaderWrapsFetchInTryCatch({
    relPath: 'lib/view-models/load-workshop-sessions.ts',
    fetchCallSnippet: 'client.fetch(WORKSHOP_SESSIONS_QUERY',
  }),
];

finish(
  'check-sibling-loaders-never-throw-on-failure.mjs',
  failures,
  'loadPresenterViewModels() and loadWorkshopSessionViewModels() each wrap their client.fetch() call in a try/catch that logs via console.error with a [module-tag] prefix and returns the same empty-array default used for their !client branch.',
);
