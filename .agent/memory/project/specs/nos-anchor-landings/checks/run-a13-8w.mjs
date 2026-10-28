// Gate wrapper for the vendored A13 survey (check-nos-anchor-landings.mjs, byte-identical copy, see PROVENANCE.md).
// The vendored script is report-only (always exits 0) and surveys six widths. This wrapper derives a runnable copy that
// surveys the eight widths NOS Design named (390, 767, 768, 779, 780, 1024, 1440, 2056), runs it against NOS_BASE_URL,
// parses its rows and fails unless every landing is 24 +/-2 px below the pinned chrome. The vendored file is never edited.
// Usage: NOS_BASE_URL=http://nos.localhost:<port> node run-a13-8w.mjs   (exit 0 pass, 1 fail, 2 setup error)
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, 'check-nos-anchor-landings.mjs');
const OUT_DIR = join(here, '..', '..', '..', '..', '..', '..', '.tmp', 'sandbox', 'nos-anchor-landings-run');
const WIDTHS = [[390, 844], [767, 1024], [768, 1024], [779, 1024], [780, 1024], [1024, 768], [1440, 900], [2056, 1200]];
const TARGET = 24; const TOL = 2;
// Asserted: every faq, plan-your-visit and sponsors target (NOS Design). Other surveyed targets (tickets, under the committee-testing bar) are printed, not asserted.
const ASSERTED = /^\/(faq|plan-your-visit|sponsors)#/;
if (!process.env.NOS_BASE_URL) { console.error('NOS_BASE_URL is required'); process.exit(2); }
const src = readFileSync(SRC, 'utf8');
const re = /const VIEWPORTS = \[[^\n]*\];/;
if (!re.test(src)) { console.error('VIEWPORTS line not found in vendored script'); process.exit(2); }
// Second derivation: a sticky bar stuck directly under the pinned header (the doc index, top == header bottom) is pinned chrome too
// (NOS Design 2026-10-28: "pinned-chrome bottom + 24", "plus any pinned sub-nav"). The vendored test only counts elements at top <= 1.
// A sub-nav bar is at most 64px tall; chrome is never over 200px tall. The sticky aside card (the >=1024 index, 500px+) is not chrome,
// and at the page end it scrolls up past the top, where the vendored test would otherwise count it as 588px of pinned chrome.
const PIN_OLD = 'r.top <= 1 &&';
if (src.split(PIN_OLD).length !== 2) { console.error('pinned-chrome condition not found exactly once in vendored script'); process.exit(2); }
const body = src.replace(PIN_OLD, 'r.height <= 200 && (r.top <= 1 || (r.height <= 64 && r.top <= chromeBottom + 1)) &&').replace(re, `const VIEWPORTS = [${WIDTHS.map(([w, h]) => `{ w: ${w}, h: ${h} }`).join(', ')}];`);
mkdirSync(OUT_DIR, { recursive: true });
// the derived copy sits next to the vendored one so 'playwright' resolves from the project's node_modules
const derived = join(here, '.a13-8w.derived.mjs');
writeFileSync(derived, body);
const res = spawnSync('node', [derived], { env: process.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
unlinkSync(derived);
const out = res.stdout ?? '';
writeFileSync(join(OUT_DIR, 'a13-8w.out'), out);
const rows = out.split('\n').map((l) => l.match(/^(\S+)\s+(\d+)\s+(-?[\d.]+|-)\s+(-?\d+|-)\s+(\S+)\s+(.*)$/)).filter(Boolean)
  .filter((m) => ['ok', 'OUT', 'SHORT', 'NO-ID', 'NO-ELEMENT'].includes(m[1]) || m[1].startsWith('ERROR'));
if (!rows.length) { console.error('no landing rows parsed; stdout head:\n' + out.slice(0, 600)); process.exit(2); }
const seen = new Set(rows.map((m) => Number(m[2])));
const missingW = WIDTHS.map(([w]) => w).filter((w) => !seen.has(w));
let bad = 0;
for (const m of rows.filter((r) => ASSERTED.test(r[6]))) {
  const gap = m[3] === '-' ? NaN : Number(m[3]);
  // SHORT = the target is too near the page end to scroll to 24 (the survey proves atEnd); it cannot land lower than the page allows, so it is not a CSS fault.
  const pass = m[1] === 'SHORT' || (Number.isFinite(gap) && Math.abs(gap - TARGET) <= TOL);
  if (!pass) { bad++; console.log(`FAIL ${m[2].padStart(4)}  gap=${m[3]}  pinned=${m[4]}  verdict=${m[1]}  ${m[6]}`); }
}
console.log(`rows=${rows.length} asserted=${rows.filter((r) => ASSERTED.test(r[6])).length} widths_seen=${[...seen].join(',')} fail=${bad} missing_widths=${missingW.join(',') || 'none'}`);
process.exit(bad === 0 && missingW.length === 0 ? 0 : 1);
