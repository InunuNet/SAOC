// Negative control: every check script must work when the project path contains a space (the real root is "SAOC NOS Site").
// Runs gen-today-stub.mjs from a copy under a spaced directory, and statically bans an undecoded `.pathname` on import.meta.url.
import { cpSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function selftest(srcDir, sandboxRoot) {
  const bad = [];
  const here = fileURLToPath(new URL('.', import.meta.url));
  for (const f of readdirSync(here).filter((n) => /\.(mjs|cjs)$/.test(n) && n !== 'spaced-path-control.mjs')) {
    const text = readFileSync(`${here}${f}`, 'utf8');
    if (/new URL\([^)]*import\.meta\.url\)\.pathname/.test(text)) bad.push(`${f}: reads new URL(..., import.meta.url).pathname undecoded; use fileURLToPath`);
  }
  const base = `${sandboxRoot}/space control/spec`;
  mkdirSync(`${base}/checks`, { recursive: true });
  mkdirSync(`${base}/goldens`, { recursive: true });
  mkdirSync(`${base}/out`, { recursive: true });
  cpSync(`${here}gen-today-stub.mjs`, `${base}/checks/gen-today-stub.mjs`);
  cpSync(`${here}../goldens/sweep-routes.json`, `${base}/goldens/sweep-routes.json`);
  const r = spawnSync('node', [`${base}/checks/gen-today-stub.mjs`, srcDir, `${base}/out`], { encoding: 'utf8' });
  if (r.status !== 0 || !/unknown-slug stubs written/.test(r.stdout)) bad.push(`gen-today-stub.mjs failed from a path containing a space: ${(r.stderr || r.stdout).split('\n')[0]}`);
  if (!existsSync(`${base}/goldens/sweep-routes.json`)) bad.push('control setup failed');
  return bad;
}
