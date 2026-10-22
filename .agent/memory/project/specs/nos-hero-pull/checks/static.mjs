// rPL static (QA input, hash-locked by goldens/checks.sha256). Codi 2026-10-22: ship trial126.
//   P1 footprint: against BASE only app/globals.css, docs/nos-hero-banding.md and this spec dir differ (untracked included).
//   P2 the bone pull carries exactly the golden stops (every rHB stop x1.5), once; the veil and diagonal are BASE's.
import { BASE, DOC, SPEC_PREFIX, finish, git, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
const G = goldenJson('pull.json');
const failures = [];
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const changed = new Set([...lines(git('diff', '--name-only', BASE)), ...lines(git('ls-files', '--others', '--exclude-standard'))]);
for (const p of changed) if (p !== 'app/globals.css' && p !== DOC && !p.startsWith(SPEC_PREFIX)) failures.push(`${p}: outside the rPL footprint (P1)`);
const css = readRepoFile('app/globals.css') ?? '';
const base = readBaseFile('app/globals.css') ?? '';
const block = (s, sel) => { const i = s.indexOf(sel); return i < 0 ? null : s.slice(i, s.indexOf('}', s.indexOf(');', i)) + 1); };
const pull = block(css, "[data-hero-scrim='bone'] {");
const want = `[data-hero-scrim='bone'] {\n  background-image: linear-gradient(\n    to top,\n    ${G.stops.join(',\n    ')}\n  );\n}`;
if (pull !== want) failures.push('app/globals.css: the bone pull is not exactly the golden stops (P2)');
if (css.split("[data-hero-scrim='bone'] {").length !== 2) failures.push('app/globals.css: the bone pull is not defined once (P2)');
for (const sel of ["[data-hero-scrim='diagonal'] {", "[data-hero-scrim='veil'] {"]) if (block(css, sel) !== block(base, sel)) failures.push(`app/globals.css: ${sel} changed (P2)`);
finish('static.mjs', failures, 'footprint is globals.css, the docs file and the spec; the pull is the golden 1.5x stops; veil and diagonal unchanged.');
