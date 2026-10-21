// Shared helpers for the nos-critique-r9 checks (QA inputs written by @architect; @dev must not edit them, goldens/checks.sha256 locks them).
// The checks live with the spec, not in the worktree. They run against the worktree named by NOS_CR9_ROOT
// (default .tmp/sandbox/critique-r9). BASE is 812dbaa2, the r8 tip restacked on main 81490e7a (F18b merged; stacked: r8 is not merged yet - move BASE onto main when it lands).
//   NOS_CR9_ROOT   worktree to inspect
//   NOS_CR9_GIT    worktree whose git history supplies the BASE file contents (default: NOS_CR9_ROOT)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '812dbaa2';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '../../../../../..');
export const specDir = path.resolve(here, '..');
export const repoRoot = path.resolve(projectRoot, process.env.NOS_CR9_ROOT ?? '.tmp/sandbox/critique-r9');
export const gitRoot = path.resolve(projectRoot, process.env.NOS_CR9_GIT ?? process.env.NOS_CR9_ROOT ?? '.tmp/sandbox/critique-r9');

export const NS = 'app/(marketing)/national-show';
export const DOC = 'docs/nos-critique-r9.md';

export function readRepoFile(rel) {
  const abs = path.join(repoRoot, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

export function readBaseFile(rel) {
  try {
    return execFileSync('git', ['-C', gitRoot, 'show', `${BASE}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // new file since BASE
  }
}

export function git(...args) {
  return execFileSync('git', ['-C', gitRoot, ...args], { encoding: 'utf8' });
}

export const golden = (name) => readFileSync(path.join(specDir, 'goldens', name), 'utf8');

/** Source with comments removed. One pass, so a `/*` inside a line comment or a string never opens a block comment. */
export function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, str) => (str === undefined ? '' : str));
}

/** Human-readable copy: string literals and JSX text, minus imports and className/data-/href/id/key values. */
export function copyStrings(src) {
  const s = stripComments(src)
    .replace(/^\s*import[\s\S]*?from\s*'[^']*';/gm, '')
    .replace(/\b(className|data-[\w-]+|href|id|key|rel|target|as|query|path|aria-controls|aria-labelledby)=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})/g, '');
  const out = [];
  const lit = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = lit.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  const jsxText = />([^<>{}]+)(?=[<{])/g;
  while ((m = jsxText.exec(s)) !== null) out.push(m[1]);
  return out.map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => / /.test(t) && !/[;()]/.test(t) && (/^[A-Z]/.test(t) || t.split(' ').filter((w) => /^[A-Za-z][a-z’']*[.,;:!?]?$/.test(w)).length >= 3));
}

/**
 * Browser-evaluable (pass to page.evaluate; self-contained): the label spans of every chip under `sel`, as a viewport `w` px wide would show them, read from the
 * Tailwind display/sr-only utilities and their [@media(...)] variants (fixture markup carries no stylesheet). Base utilities first, media variants override (Tailwind's order).
 * painted = drawn on screen (displayed, not sr-only); at = exposed to assistive tech (displayed, not aria-hidden; sr-only counts). The ※ glyph is not a label.
 * `spans` = label spans in the DOM (1 = one plain label, no short tag rendered). Media conditions it cannot evaluate are returned in `unknown`, so a switch that is not a plain
 * width query fails loudly.
 */
export function chipFromClasses({ sel, w }) {
  const test = (q) => {
    let m;
    if ((m = q.match(/^max-width:([\d.]+)px$/))) return w <= Number(m[1]);
    if ((m = q.match(/^min-width:([\d.]+)px$/))) return w >= Number(m[1]);
    if ((m = q.match(/^width(<=|>=|<|>)([\d.]+)px$/))) { const b = Number(m[2]); return m[1] === '<' ? w < b : m[1] === '<=' ? w <= b : m[1] === '>' ? w > b : w >= b; }
    return null;
  };
  const UTIL = { hidden: ['display', false], inline: ['display', true], block: ['display', true], 'inline-block': ['display', true], 'sr-only': ['sr', true], 'not-sr-only': ['sr', false] };
  return [...document.querySelectorAll(sel)].map((chip) => {
    const unknown = [];
    const spans = [...chip.children].filter((c) => c.textContent.trim() !== '※').map((c) => {
      const st = { display: true, sr: false };
      const toks = (c.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      for (const t of toks) if (UTIL[t]) st[UTIL[t][0]] = UTIL[t][1];
      for (const t of toks) {
        const m = t.match(/^\[@media(.+)\]:([\w-]+)$/);
        if (!m || !UTIL[m[2]]) continue;
        const r = m[1].split('_and_').map((x) => test(x.replace(/^\(|\)$/g, '')));
        if (r.includes(null)) { unknown.push(t); continue; }
        if (r.every(Boolean)) st[UTIL[m[2]][0]] = UTIL[m[2]][1];
      }
      return { text: c.textContent.trim(), painted: st.display && !st.sr, at: st.display && c.getAttribute('aria-hidden') !== 'true' };
    });
    return { painted: spans.filter((s) => s.painted).map((s) => s.text), at: spans.filter((s) => s.at).map((s) => s.text), spans: spans.length, unknown };
  });
}

export function finish(name, failures, passMessage) {
  if (failures.length > 0) {
    console.error(`FAIL: ${name}`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS: ${passMessage}`);
}
