#!/usr/bin/env node
// F17-A11: the self-critique loop left its evidence. after/ holds the full screenshot set from capture-shots.mjs (hub, sponsors at 390/1280/1920, symposium at 390/1280, the footer link
// at 390/1280, the open mega at 1280 and the open mobile menu at 390), each a real PNG and none older than the newest F17 source file; the log records >=2 passes (implement, critique,
// iterate), names the viewports, and its FINAL pass reports P0 0, P1 0, P2 0 with Score >= 36/40 (impeccable critique heuristic total). @qa re-runs the critique independently.
// Usage: node contracts/checks/launch-weekend/f17/check-j-critique-artefacts.mjs   (cwd = implementation worktree)
import { existsSync, readFileSync, statSync } from 'node:fs';

const AFTER = process.env.AFTER_DIR || '.tmp/sandbox/lw-f17/after';
const LOG = '.agent/memory/project/specs/launch-weekend/f17-critique-log.md';
const MIN_SCORE = 36;
const SOURCES = ['components/chrome/nav-config.ts', 'components/chrome/footer-data.ts', 'components/tickets/AdmissionRows.tsx', 'lib/admission-rows.ts', 'app/(marketing)/national-show/tickets/page.tsx', 'components/show/nos/ShowContentState.tsx', 'app/(marketing)/national-show/page.tsx', 'app/(marketing)/national-show/sponsors/page.tsx', 'app/(marketing)/national-show/symposium/page.tsx', 'app/(marketing)/national-show/nos-structure.css'];
const NEED = ['390-hub.png', '1280-hub.png', '1920-hub.png', '390-sponsors.png', '1280-sponsors.png', '1920-sponsors.png', '390-symposium.png', '1280-symposium.png', '390-tickets.png', '1280-tickets.png', '1920-tickets.png', '1280-footer.png', '390-footer.png', '1280-mega.png', '390-menu.png'];
const problems = [];
const newestSrc = Math.max(...SOURCES.filter(existsSync).map((f) => statSync(f).mtimeMs));
for (const f of NEED) {
  const p = `${AFTER}/${f}`;
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
  for (const w of ['390', '1280', '1920', 'impeccable']) if (!log.toLowerCase().includes(w)) problems.push(`critique log never mentions "${w}"`);
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
console.log(`PASS: ${NEED.length} fresh screenshots and a critique log with a clean final pass`);
