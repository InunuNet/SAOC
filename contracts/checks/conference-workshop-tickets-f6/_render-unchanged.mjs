// Shared proof for F6's A9/A10/A11-sibling "existing JSX output is byte-for-byte
// unchanged" requirement (golden §3): the page gains exactly one additive server-side
// loader call, passed as a prop into the EXISTING render tree, never touching a line that
// was already there.
//
// A line-based diff against HEAD is the right tool for this, not an AST comparison: if a
// diff contains ZERO removed/changed lines for this file (only insertions), then by
// definition every pre-existing line — including every pre-existing JSX line — is
// byte-for-byte unchanged. This also tolerates the realistic implementation shape: Prettier
// formats multi-prop JSX one prop per line, so adding a new prop to an existing component
// call is itself a pure line INSERTION, not a modification of an existing line, provided
// the component call was already multi-line before this diff.
//
// Deliberately does not special-case `git diff`'s own `@@ -a,b +c,d @@` hunk-header line —
// callers only look at lines beginning with a literal '-' that aren't the `---` file-header
// line, which this helper already filters.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');

/**
 * Returns { diffExists, removedLines, addedLines } for `relPath`'s working-tree diff
 * against HEAD. `addedLines`/`removedLines` are the real content lines (the leading
 * +/- stripped), excluding the `+++`/`---` file-header lines.
 */
export function diffAgainstHead(relPath) {
  let raw;
  try {
    raw = execFileSync('git', ['diff', 'HEAD', '--', relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (error) {
    throw new Error(`git diff HEAD -- ${relPath} failed: ${error.message}`);
  }

  if (raw.trim().length === 0) {
    return { diffExists: false, removedLines: [], addedLines: [] };
  }

  const removedLines = [];
  const addedLines = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
    if (line.startsWith('-')) removedLines.push(line.slice(1));
    else if (line.startsWith('+')) addedLines.push(line.slice(1));
  }
  return { diffExists: true, removedLines, addedLines };
}

/**
 * Runs the full A9/A10-shape assertion for one page file: it must have an additive-only
 * diff against HEAD (no removed/changed lines) that includes a call to `loaderCallPattern`
 * somewhere among the added lines. Returns a list of failure strings (empty = pass).
 */
export function checkAdditiveLoaderWiring({ relPath, loaderCallPattern, loaderImportPattern }) {
  const failures = [];
  const { diffExists, removedLines, addedLines } = diffAgainstHead(relPath);

  if (!diffExists) {
    failures.push(`${relPath} has no diff against HEAD yet — expected an additive loader call to have been wired in`);
    return failures;
  }

  if (removedLines.length > 0) {
    failures.push(
      `${relPath}'s diff against HEAD removes/modifies ${removedLines.length} existing line(s) — expected a purely additive diff so the existing render tree is provably byte-for-byte unchanged. First removed line: ${JSON.stringify(removedLines[0])}`,
    );
  }

  const addedText = addedLines.join('\n');
  if (!loaderImportPattern.test(addedText)) {
    failures.push(`${relPath}'s added lines do not import the expected loader (pattern: ${loaderImportPattern})`);
  }
  if (!loaderCallPattern.test(addedText)) {
    failures.push(`${relPath}'s added lines do not call the expected loader (pattern: ${loaderCallPattern})`);
  }

  return failures;
}
