#!/usr/bin/env node
// A-K: the self-critique loop left its evidence. (1) after/ holds the full screenshot set from capture-shots.mjs - 4 sections x
// 390/1280/1920, the 4 hover shots and the nav-cards focus shot - each a real PNG, none older than the newest F14 component
// file (so stale shots from before the last edit fail). (2) The critique log records >=2 passes (implement, critique, iterate),
// names the viewports and states it examined, and its FINAL pass reports zero P0, P1 and P2 findings with a score >= 36/40
// (impeccable critique heuristic total). The log is the dev's own account; @qa re-runs the critique independently.
// Usage: node contracts/checks/launch-weekend/f14/check-k-critique-artefacts.mjs   (cwd = implementation worktree)
import { existsSync, readFileSync, statSync } from 'node:fs';

const AFTER = process.env.AFTER_DIR || '.tmp/sandbox/lw-f14/after';
const LOG = '.agent/memory/project/specs/launch-weekend/f14-critique-log.md';
const MIN_SCORE = 36;
const COMPONENTS = ['components/home/NavCards.tsx', 'components/home/ShowBand.tsx', 'components/home/YearbookStrip.tsx', 'components/home/PartnersSection.tsx'];
const SECTIONS = ['nav-cards', 'show-band', 'yearbook', 'partners'];
const problems = [];

const newestSrc = Math.max(...COMPONENTS.filter(existsSync).map((f) => statSync(f).mtimeMs));
const need = [];
for (const vp of ['390', '1280', '1920']) for (const s of SECTIONS) need.push(`${vp}-${s}.png`);
for (const h of ['nav-cards', 'show-band-cta', 'yearbook-cta', 'partners-row']) need.push(`1280-${h}-hover.png`);
need.push('1280-nav-cards-focus.png');
for (const f of need) {
  const p = `${AFTER}/${f}`;
  if (!existsSync(p)) { problems.push(`missing screenshot ${p}`); continue; }
  const buf = readFileSync(p);
  if (buf.length < 4000 || buf.readUInt32BE(0) !== 0x89504e47) problems.push(`${p} is not a real PNG`);
  if (statSync(p).mtimeMs < newestSrc) problems.push(`${p} is older than the latest component edit (re-shoot after the final change)`);
}

if (!existsSync(LOG)) problems.push(`missing critique log ${LOG}`);
else {
  const log = readFileSync(LOG, 'utf8');
  const passes = log.split(/^## Pass \d+/m).slice(1);
  if (passes.length < 2) problems.push(`critique log needs at least 2 passes ("## Pass 1", "## Pass 2"...), found ${passes.length}`);
  for (const w of ['390', '1280', '1920', 'hover', 'focus', 'reduced']) if (!log.toLowerCase().includes(w)) problems.push(`critique log never mentions "${w}"`);
  const last = passes[passes.length - 1] || '';
  for (const sev of ['P0', 'P1', 'P2']) {
    const m = last.match(new RegExp(`${sev}\\s*:\\s*(\\d+)`));
    if (!m) problems.push(`final pass has no "${sev}: <count>" line`);
    else if (m[1] !== '0') problems.push(`final pass still has ${m[1]} ${sev} finding(s)`);
  }
  const sc = last.match(/Score\s*:\s*(\d+)\s*\/\s*40/i);
  if (!sc) problems.push('final pass has no "Score: NN/40" line');
  else if (parseInt(sc[1], 10) < MIN_SCORE) problems.push(`final-pass score ${sc[1]}/40 < ${MIN_SCORE}`);
  if (passes.length >= 2 && !/P[0-2]\s*:\s*[1-9]/.test(passes.slice(0, -1).join('\n'))) problems.push('earlier passes record no findings: the loop must show something was found and fixed, or state "Pass 1 found nothing" with evidence');
}
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${need.length} fresh screenshots and a critique log with a clean final pass`);
