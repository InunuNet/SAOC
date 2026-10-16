#!/usr/bin/env node
// F18-A11: the dev's impeccable self-critique loop left its evidence. AFTER_DIR holds a real PNG for every critique route at 390 and 1280 and for the keepsake ticket routes at 390, 701, 960, 1280 and 1920 (capture-shots.mjs), none older than the newest
// changed F18 source file; .agent/memory/project/specs/launch-weekend/f18-critique-log.md records >=2 passes, names impeccable and both viewports, and its FINAL pass reports P0: 0, P1: 0, P2: 0
// and Score: NN/40 >= goldens/f18/tokens.json critique.minScore. @qa re-runs the critique independently.
// Usage: node contracts/checks/launch-weekend/f18/check-k-critique-artefacts.mjs   (cwd = implementation worktree)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { T, baseRef, gitLines, critiquePairs } from './_lib.mjs';

const AFTER = process.env.AFTER_DIR || '.tmp/sandbox/lw-f18/after';
const LOG = '.agent/memory/project/specs/launch-weekend/f18-critique-log.md';
const problems = [];
const BASE = baseRef();
const sources = [...new Set([...gitLines('diff', '--name-only', `${BASE}...HEAD`), ...gitLines('diff', '--name-only', 'HEAD')])].filter((f) => /^(app|components|lib)\//.test(f) && existsSync(f));
const newestSrc = Math.max(0, ...sources.map((f) => statSync(f).mtimeMs));
if (!sources.length) problems.push('no F18 source change found to date the screenshots against');
for (const { route, w } of critiquePairs()) {
  const p = `${AFTER}/${w}-${route.split('/').pop()}.png`;
  if (!existsSync(p)) { problems.push(`missing screenshot ${p}`); continue; }
  const buf = readFileSync(p);
  if (buf.length < 4000 || buf.readUInt32BE(0) !== 0x89504e47) problems.push(`${p} is not a real PNG`);
  if (statSync(p).mtimeMs < newestSrc) problems.push(`${p} is older than the latest source edit (re-shoot after the final change)`);
}
if (!existsSync(LOG)) problems.push(`missing critique log ${LOG}`);
else {
  const log = readFileSync(LOG, 'utf8');
  const passes = log.split(/^## Pass \d+/m).slice(1);
  if (passes.length < 2) problems.push(`critique log needs at least 2 passes ("## Pass 1", "## Pass 2"...), found ${passes.length}`);
  for (const w of ['390', '1280', 'impeccable']) if (!log.toLowerCase().includes(w)) problems.push(`critique log never mentions "${w}"`);
  const last = passes[passes.length - 1] || '';
  for (const sev of ['P0', 'P1', 'P2']) {
    const m = last.match(new RegExp(`${sev}\\s*:\\s*(\\d+)`));
    if (!m) problems.push(`final pass has no "${sev}: <count>" line`);
    else if (m[1] !== '0') problems.push(`final pass still has ${m[1]} ${sev} finding(s)`);
  }
  const sc = last.match(/Score\s*:\s*(\d+)\s*\/\s*40/i);
  if (!sc) problems.push('final pass has no "Score: NN/40" line');
  else if (parseInt(sc[1], 10) < T.critique.minScore) problems.push(`final-pass score ${sc[1]}/40 < ${T.critique.minScore}`);
  if (passes.length >= 2 && !/P[0-2]\s*:\s*[1-9]/.test(passes.slice(0, -1).join('\n'))) problems.push('earlier passes record no findings: the loop must show something was found and fixed');
}
if (problems.length) { console.error(`FAIL F18-A11 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS F18-A11: ${critiquePairs().length} fresh screenshots and a critique log with a clean final pass`);
