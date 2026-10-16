#!/usr/bin/env node
// F19-A14: the dev's self-critique loop left its evidence. (1) after/ holds 16 route shots (8 routes x 390/1280) and 8 hero-slide shots
// (4 slides x 390/1280) from capture-shots.mjs, each a real PNG newer than the newest changed source file. (2) The critique log names
// impeccable, mentions 390, 1280, every critique route, "scrim" and "slide", records >= 2 passes, shows findings fixed between them,
// and its FINAL pass reads P0: 0, P1: 0, P2: 0 and Score >= 36/40 (impeccable critique heuristic total).
// Usage: node contracts/checks/launch-weekend/f19/check-k-critique-artefacts.mjs   (BASE_REF=<sha> to pin)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, loadGolden } from './_lib.mjs';
import { CRITIQUE_ROUTES, routeSlug } from './_routes.mjs';

const AFTER = process.env.AFTER_DIR || `${ROOT}.tmp/sandbox/lw-f19/after`;
const LOG = `${ROOT}.agent/memory/project/specs/launch-weekend/f19-critique-log.md`;
const MIN_SCORE = loadGolden('tokens.json').critique.minScore;
const BASE_REF = process.env.BASE_REF || 'origin/main';
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8' });
const problems = [];

const changed = [...new Set([...git('diff', '--name-only', `${BASE_REF}...HEAD`).split('\n'), ...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean))]
  .filter((f) => /^(app|components)\//.test(f) && existsSync(`${ROOT}${f}`));
if (!changed.length) problems.push('no changed source file found under app/ or components/');
const newestSrc = Math.max(0, ...changed.map((f) => statSync(`${ROOT}${f}`).mtimeMs));
const need = [];
for (const vp of ['390', '1280']) { for (const r of CRITIQUE_ROUTES) need.push(`${vp}-${routeSlug(r)}.png`); for (let i = 1; i <= 4; i++) need.push(`${vp}-hero-slide${i}.png`); }
for (const f of need) {
  const p = `${AFTER}/${f}`;
  if (!existsSync(p)) { problems.push(`missing screenshot ${p}`); continue; }
  const buf = readFileSync(p);
  if (buf.length < 4000 || buf.readUInt32BE(0) !== 0x89504e47) problems.push(`${p} is not a real PNG`);
  if (statSync(p).mtimeMs < newestSrc) problems.push(`${p} is older than the latest source edit (re-shoot after the final change)`);
}
if (!existsSync(LOG)) problems.push(`missing critique log ${LOG}`);
else {
  const log = readFileSync(LOG, 'utf8'); const low = log.toLowerCase();
  const passes = log.split(/^## Pass \d+/m).slice(1);
  if (passes.length < 2) problems.push(`critique log needs at least 2 passes ("## Pass 1", "## Pass 2"...), found ${passes.length}`);
  for (const w of ['impeccable', '390', '1280', 'scrim', 'slide', ...CRITIQUE_ROUTES.map(routeSlug).filter((s) => s !== 'home'), 'home']) if (!low.includes(w)) problems.push(`critique log never mentions "${w}"`);
  const last = passes[passes.length - 1] || '';
  for (const sev of ['P0', 'P1', 'P2']) {
    const m = last.match(new RegExp(`${sev}\\s*:\\s*(\\d+)`));
    if (!m) problems.push(`final pass has no "${sev}: <count>" line`); else if (m[1] !== '0') problems.push(`final pass still has ${m[1]} ${sev} finding(s)`);
  }
  const sc = last.match(/Score\s*:\s*(\d+)\s*\/\s*40/i);
  if (!sc) problems.push('final pass has no "Score: NN/40" line'); else if (parseInt(sc[1], 10) < MIN_SCORE) problems.push(`final-pass score ${sc[1]}/40 < ${MIN_SCORE}`);
  if (passes.length >= 2 && !/P[0-2]\s*:\s*[1-9]/.test(passes.slice(0, -1).join('\n'))) problems.push('earlier passes record no findings: the loop must show something was found and fixed, or state "Pass 1 found nothing" with evidence');
}
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log(`PASS: ${need.length} fresh screenshots and a critique log with a clean final pass`);
