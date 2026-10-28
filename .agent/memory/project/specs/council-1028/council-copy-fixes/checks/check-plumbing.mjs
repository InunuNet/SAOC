// council-copy-fixes A4 helper: the gate plumbing files (nos-content-standard/checks) may only be taught the council overrides. Each is normalised back to its
// origin/main form by exact, single-purpose rewrites and must then be BYTE-EQUAL to origin/main. A deleted assertion, a removed route, a changed regex or any
// other edit leaves a residue and fails. The override block in _lib.mjs is pinned to goldens/lib-override-block.txt (changing it is a spec change).
import { readFileSync } from 'node:fs';

const BLOCK = readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/lib-override-block.txt', 'utf8');
export const PLUMBING = [
  '.agent/memory/project/specs/nos-content-standard/checks/_lib.mjs',
  '.agent/memory/project/specs/nos-content-standard/checks/gate-standard.mjs',
  '.agent/memory/project/specs/nos-content-standard/checks/gate-verbatim.mjs',
];

/** readSource(X) -> readFileSync(X, 'utf8') with balanced parentheses, so X may itself contain calls. */
function unwrapReadSource(text) {
  let out = ''; let i = 0;
  for (;;) {
    const at = text.indexOf('readSource(', i);
    if (at < 0) return out + text.slice(i);
    if (/[\w$]/.test(text[at - 1] ?? '') || (text[at - 1] === '.' && text[at - 2] !== '.')) { out += text.slice(i, at + 11); i = at + 11; continue; }
    let depth = 1; let j = at + 11;
    while (j < text.length && depth > 0) { if (text[j] === '(') depth += 1; else if (text[j] === ')') depth -= 1; j += 1; }
    if (depth !== 0) return out + text.slice(i);
    out += `${text.slice(i, at)}readFileSync(${text.slice(at + 11, j - 1)}, 'utf8')`; i = j;
  }
}
const once = (text, from, to, what, fails) => { const n = text.split(from).length - 1; if (n !== 1) { fails.push(`${what}: expected exactly one occurrence, found ${n}`); return text; } return text.replace(from, () => to); };

const NORMALISE = {
  '.agent/memory/project/specs/nos-content-standard/checks/gate-standard.mjs': (t, fails) => once(unwrapReadSource(t), 'driveState, readSource, launchChromium', 'driveState, launchChromium', 'gate-standard import', fails),
  '.agent/memory/project/specs/nos-content-standard/checks/_lib.mjs': (t, fails) => {
    let x = once(t, 'readFileSync, readdirSync, writeFileSync', 'readFileSync, writeFileSync', '_lib fs import', fails);
    x = x.replace(/^const COUNCIL = JSON\.parse\(readFileSync\(`\$\{SPEC\}\/goldens\/council-overrides\.json`, 'utf8'\)\);\n/m, '');
    x = once(x, BLOCK, '', '_lib override block (must equal goldens/lib-override-block.txt)', fails);
    return once(x, "applyCouncil(buf.toString('utf8'), route.nos)", "buf.toString('utf8')", '_lib driveState wrapper', fails);
  },
};

/** @returns {string[]} problems; [] when head is base, or head normalises to base exactly. */
export function checkPlumbing(file, head, base) {
  if (head === base) return [];
  const fails = []; const norm = (NORMALISE[file] ?? ((t) => t))(head, fails);
  if (norm !== base) fails.push(`${file}: after removing the council override plumbing it still differs from origin/main (an assertion, route, regex or other line was changed)`);
  return fails;
}
