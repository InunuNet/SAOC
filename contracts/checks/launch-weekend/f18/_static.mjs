// Static helpers for the launch-weekend F18 checks: golden reads, git, file reads. No dependency on the F17/NOS F3 runtime lib,
// so the static checks (scope, availability, naming sweep) load even when that lib's nav-config import cannot. _lib.mjs re-exports all of it.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const GOLDEN_DIR = '.agent/memory/project/specs/launch-weekend/goldens/f18';
export const readGolden = (name) => JSON.parse(readFileSync(`${GOLDEN_DIR}/${name}`, 'utf8'));
export const T = readGolden('tokens.json');

// A10's scope base. Main moves on (NOS batches, F19) and the dev merges it in; those files are not F18 work. The scope base is merge-base(HEAD, main), so only what this branch added beyond the main it has merged is judged. F18_MAIN_REF overrides 'main' (then origin/main is tried); the result is never older than F18_BASE_REF, and with no resolvable main ref it falls back to F18_BASE_REF.
export function scopeBase() {
  const base = baseRef();
  for (const ref of [process.env.F18_MAIN_REF, 'main', 'origin/main'].filter(Boolean)) {
    try {
      const mb = execFileSync('git', ['merge-base', 'HEAD', ref], { encoding: 'utf8' }).trim();
      execFileSync('git', ['merge-base', '--is-ancestor', base, mb], { stdio: 'ignore' });
      return mb;
    } catch {
      // ref missing, or its merge-base predates F18_BASE_REF: try the next ref
    }
  }
  return base;
}
export const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
export const gitLines = (...a) => git(...a).split('\n').filter(Boolean);
export const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);

// The diff base: F18_BASE_REF pins the commit the dev branched from (main bcf8684b, NOS batch 2 merged, plus this spec branch merged in).
export function baseRef() {
  if (process.env.F18_BASE_REF) return process.env.F18_BASE_REF;
  console.error('INFRA: set F18_BASE_REF to the commit the F18 dev branched from (the spec records main bcf8684b)');
  process.exit(2);
}

// Typographic normalisation for copy comparison: straight and curly quotes and all whitespace compare equal, the words may not differ.
export const flat = (t) => (t ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
