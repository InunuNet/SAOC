// Shared helpers for the nos-audit-fixes check scripts (QA inputs, written by @architect;
// @dev must not edit them). Static source checks only: no tsx, no network, no Sanity.
//
// NOS_AF_ROOT overrides the repo root, so each check can be run against an exported copy of
// the base (047d610e at authoring, 5ae1f3cf since the rebase) to prove it fails there (mutation proof). Unset in the gate.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = process.env.NOS_AF_ROOT
  ? path.resolve(process.env.NOS_AF_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** File text, or null when the file does not exist. */
export function readRepoFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

/** File text with // line comments and block comments removed (JSX comments included). */
export function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/**
 * Every JSX opening tag `<tag ...>` in `src`, as { text, start, end, className, tokens }.
 * Scans to the closing `>` while respecting quotes, template literals and `{}` nesting.
 * `className` is the literal value of className="..." / className={`...`} /
 * className={'...'} (null when absent or not a literal).
 */
export function openingTags(src, tag) {
  const out = [];
  const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = m.index + tag.length + 1;
    let depth = 0;
    let quote = null;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (quote) {
        if (c === '\\') { i += 1; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    const text = src.slice(m.index, i + 1);
    const cm =
      text.match(/className="([^"]*)"/) ||
      text.match(/className=\{`([^`]*)`\}/) ||
      text.match(/className=\{'([^']*)'\}/);
    const className = cm ? cm[1] : null;
    out.push({
      text,
      start: m.index,
      end: i + 1,
      className,
      tokens: className ? className.split(/\s+/).filter(Boolean) : [],
    });
  }
  return out;
}

/** Prints FAIL + bullet list and exits 1 if `failures` is non-empty; otherwise prints PASS. */
export function finish(scriptName, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${scriptName}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
