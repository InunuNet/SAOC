// nos-critique-r15 F2b static (QA input, hash-locked). BASE 7bb4064b, IN/OUT lists in goldens/f2b-edits.json.
//   S1  every IN file equals its BASE text with exactly `from` -> `to` on each listed line (each listed BASE line carries `from` once);
//       nothing else in the file changes: no new token, opacity, offset or class.
//   S2  every OUT file is byte-identical to BASE and keeps its ring-ink/40 count.
//   S3  inventory: under app/, components/ and lib/ the working tree carries ring-ink/40 only in the OUT files, at their counts (an
//       unlisted site, or one left behind on an IN line, fails).
//   S4  the --primary token is the handoff value: app/globals.css maps --color-primary to var(--primary) and --primary is #384138, both as at BASE.
//   S5  docs/nos-critique-r15.md keeps every BASE line and gains a "## F2b" section that names ring-primary, the basis citation
//       design/design_handoff_saoc/README.md:192 and the SaocLockup exclusion.
//   S6  footprint: the branch differs from BASE only in goldens/f2b-footprint.json, the docs file and this spec dir; HEAD descends from BASE.
import { execFileSync } from 'node:child_process';

import { BASE, DOC, SPEC_PREFIX, changedPaths, finish, git, goldenJson, readBaseFile, readRepoFile, repoRoot } from './_f2b.mjs';

const NAME = 'f2b-static.mjs';
const G = goldenJson('f2b-edits.json');
const failures = [];
const count = (s, sub) => s.split(sub).length - 1;

// S1
for (const e of G.in) {
  const base = readBaseFile(e.file);
  const head = readRepoFile(e.file);
  if (base === null || head === null) { failures.push(`${e.file}: missing at ${base === null ? 'BASE' : 'HEAD'} (S1)`); continue; }
  const lines = base.split('\n');
  for (const n of e.lines) if (count(lines[n - 1] ?? '', G.from) !== 1) failures.push(`${e.file}:${n}: BASE line does not carry "${G.from}" exactly once (S1)`);
  const want = lines.map((l, i) => (e.lines.includes(i + 1) ? l.replace(G.from, G.to) : l)).join('\n');
  if (head !== want) {
    const h = head.split('\n'); const w = want.split('\n');
    const diff = [];
    for (let i = 0; i < Math.max(h.length, w.length) && diff.length < 4; i++) {
      if (h[i] === w[i]) continue;
      const a = h[i] ?? '<eof>'; const b = w[i] ?? '<eof>';
      let k = 0; while (k < a.length && a[k] === b[k]) k++;
      const at = Math.max(0, k - 30);
      diff.push(`line ${i + 1} col ${k + 1}: got ${JSON.stringify(a.slice(at, at + 80))}, want ${JSON.stringify(b.slice(at, at + 80))}`);
    }
    failures.push(`${e.file}: not BASE + the ${e.lines.length} listed substitution(s): ${diff.join('; ')} (S1)`);
  }
}

// S2
for (const o of G.out) {
  const base = readBaseFile(o.file);
  const head = readRepoFile(o.file);
  if (head !== base) failures.push(`${o.file}: changed since BASE; it is OUT of F2b and must stay byte-identical (S2)`);
  else if (count(head, 'ring-ink/40') !== o.count) failures.push(`${o.file}: carries ring-ink/40 ${count(head, 'ring-ink/40')} time(s), want ${o.count} (S2)`);
}

// S3
let grep = '';
try {
  grep = execFileSync('git', ['-C', repoRoot, 'grep', '-c', '--untracked', '-F', 'ring-ink/40', '--', ...G.inventoryRoots], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  if (e.status !== 1) failures.push(`git grep failed: ${e.message} (S3)`);
}
const inventory = Object.fromEntries(grep.split('\n').filter(Boolean).map((l) => { const i = l.lastIndexOf(':'); return [l.slice(0, i), Number(l.slice(i + 1))]; }));
const expected = Object.fromEntries(G.out.map((o) => [o.file, o.count]));
for (const [f, n] of Object.entries(inventory)) if (expected[f] !== n) failures.push(`${f}: ring-ink/40 x${n} at HEAD, want ${expected[f] ?? 0} (S3)`);
for (const [f, n] of Object.entries(expected)) if (!(f in inventory)) failures.push(`${f}: ring-ink/40 x0 at HEAD, want ${n} (S3)`);

// S4
const css = readRepoFile('app/globals.css') ?? '';
if (css !== readBaseFile('app/globals.css')) failures.push('app/globals.css changed since BASE (S4)');
if (!/--color-primary:\s*var\(--primary\);/.test(css)) failures.push('app/globals.css: --color-primary is not var(--primary) (S4)');
if (!new RegExp(`--primary:\\s*${G.token.value};`, 'i').test(css)) failures.push(`app/globals.css: --primary is not ${G.token.value} (S4)`);

// S5
const doc = readRepoFile(DOC);
const docBase = readBaseFile(DOC);
if (doc === null || docBase === null) failures.push(`${DOC}: missing at ${doc === null ? 'HEAD' : 'BASE'} (S5)`);
else {
  const h = doc.split('\n'); let i = 0;
  for (const line of docBase.split('\n')) { while (i < h.length && h[i] !== line) i++; if (i === h.length) { failures.push(`${DOC}: BASE line dropped or reordered: ${JSON.stringify(line.slice(0, 100))} (S5)`); break; } i++; }
  const m = doc.match(/^## F2b\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!m) failures.push(`${DOC}: no "## F2b" section (S5)`);
  else for (const need of ['ring-primary', 'design/design_handoff_saoc/README.md:192', 'SaocLockup']) if (!m[0].includes(need)) failures.push(`${DOC}: the F2b section does not mention ${need} (S5)`);
}

// S6
const allowed = new Set([DOC, ...goldenJson('f2b-footprint.json')]);
const changed = changedPaths();
for (const p of changed) if (!allowed.has(p) && !p.startsWith(SPEC_PREFIX)) failures.push(`path outside the F2b footprint (goldens/f2b-footprint.json, ${DOC}, the spec dir): ${p} (S6)`);
try { git('merge-base', '--is-ancestor', BASE, git('rev-parse', 'HEAD').trim()); } catch { failures.push(`HEAD does not descend from ${BASE} (S6)`); }

const nIn = G.in.reduce((a, e) => a + e.lines.length, 0);
finish(NAME, failures, `${nIn} IN lines are BASE + ${G.from} -> ${G.to} only, ${G.out.length} OUT files byte-identical with their ring-ink/40, inventory exact, token handoff --primary, docs F2b section, ${changed.size} changed path(s) in the footprint.`);
