// F1c A0 companion: the set of files under checks/ must EQUAL the set pinned in goldens/checks.sha256 (an unpinned file and a missing pinned file both fail), and every relative import or checks/<file> path a
// check references must itself be a pinned file. `shasum -a 256 -c` (A0's first half) proves the pinned bytes; this proves nothing unpinned can run beside them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
const ROOT = process.cwd(); const SPEC = '.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency';
const DIR = `${SPEC}/checks`; const PIN = `${SPEC}/goldens/checks.sha256`;
const fails = [];
const pinned = new Set(readFileSync(PIN, 'utf8').split('\n').filter(Boolean).map((l) => l.trim().split(/\s+/).slice(1).join(' ')));
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((n) => { const p = `${d}/${n}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const present = new Set(walk(DIR));
for (const f of present) if (!pinned.has(f)) fails.push(`unpinned file under checks/: ${f}`);
for (const f of pinned) if (f.startsWith(`${DIR}/`) && !present.has(f)) fails.push(`pinned file missing from checks/: ${f}`);
for (const f of present) {
  if (!f.endsWith('.mjs')) continue; const src = readFileSync(join(ROOT, f), 'utf8');
  for (const m of src.matchAll(/(?:from|import\s{0,3}\()\s{0,3}['"](\.{1,2}\/[^'"]+)['"]/g)) { const t = relative(ROOT, resolve(dirname(join(ROOT, f)), m[1])); if (!pinned.has(t)) fails.push(`${f} imports ${m[1]} (${t}), which is not pinned`); }
  for (const m of src.matchAll(/checks\/([\w.-]+\.mjs)/g)) if (!pinned.has(`${DIR}/${m[1]}`)) fails.push(`${f} references checks/${m[1]}, which is not pinned`);
}

// Contract commands: the contract itself is pinned, and every script any assertion command executes (node/bash/python path, --import/-r/--require target) must be a pinned file, wherever it lives.
const CONTRACT = `${SPEC}/f1c-headings-heroes/contract.yaml`; const EXECS = new Set(['node', 'shasum']); const CODE_EXT = /\.(mjs|cjs|js|ts|mts|py|sh)$/; const LOADERS = new Set(['--import', '-r', '--require', '--loader', '--experimental-loader']);
const norm = (t) => relative(ROOT, resolve(ROOT, t));
if (!pinned.has(CONTRACT)) fails.push(`contract not pinned: ${CONTRACT}`);
for (const [i, line] of readFileSync(join(ROOT, CONTRACT), 'utf8').split('\n').entries()) {
  const m = line.match(/^\s*(?:-\s+)?command:\s*(.*)$/); if (!m) continue;
  let cmd = m[1].trim(); if (/^[|>]/.test(cmd) || !cmd) { fails.push(`contract line ${i + 1}: block-scalar or empty command is not analysable`); continue; }
  if (/^(['"]).*\1$/.test(cmd)) cmd = cmd.slice(1, -1);
  for (const seg of cmd.split(/&&|\|\||[;|]/)) {
    const toks = seg.trim().split(/\s+/).filter(Boolean).filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)); if (!toks.length) continue;
    if (!EXECS.has(toks[0])) { fails.push(`contract line ${i + 1}: executable '${toks[0]}' is not in the allowed set (${[...EXECS]})`); continue; }
    if (toks[0] === 'node' && toks.some((t) => /^(-e|-p|--eval|--print|-pe)$/.test(t))) fails.push(`contract line ${i + 1}: inline node code is not pinned`);
    if (toks[0] === 'node' && !toks.slice(1).some((t) => CODE_EXT.test(t))) fails.push(`contract line ${i + 1}: node command names no script`);
    toks.forEach((t, j) => {
      const v = t.replace(/^--(?:import|require|loader)=/, '');
      if (CODE_EXT.test(v) && !pinned.has(norm(v))) fails.push(`contract line ${i + 1}: runs ${v}, which is not pinned`);
      if (LOADERS.has(t) && toks[j + 1] && !pinned.has(norm(toks[j + 1]))) fails.push(`contract line ${i + 1}: loads ${toks[j + 1]}, which is not pinned`);
      if (/^--(?:import|require|loader)=/.test(t) && !pinned.has(norm(v))) fails.push(`contract line ${i + 1}: loads ${v}, which is not pinned`);
    });
  }
}
if (fails.length) { console.error(`FAIL verify-pins: ${fails.length} problem(s)`); for (const x of fails) console.error('  - ' + x); process.exit(1); }
console.log(`PASS verify-pins (${present.size} files under checks/, all pinned)`);
