// nos-critique-r15 f3 static (QA input, hash-locked). F3: two text colours fail WCAG 1.4.3 (4.5:1 for small text).
//   S1  components/ui/ProvisionalFigure.tsx and app/not-found.tsx equal BASE with exactly the goldens/f3-edits.json line replaced
//       (text-muted -> text-primary on the "provisional" sup; text-accent -> text-ivory on the 404 eyebrow), nothing else.
//   S2  both tokens are handoff tokens (design/design_handoff_saoc/colors_and_type.css) mirrored in app/globals.css @theme; neither file
//       changes.
//   S3  docs/nos-critique-r15.md records F3.
import { DOC, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'f3-static.mjs';
const failures = [];
const G = goldenJson('f3-edits.json');
for (const e of G.edits) {
  const base = readBaseFile(e.file);
  const head = readRepoFile(e.file);
  if (base === null || head === null) { failures.push(`${e.file} missing at HEAD or BASE (S1)`); continue; }
  const n = base.split('\n').filter((l) => l === e.from).length;
  if (n !== 1) { failures.push(`${e.file}: the golden BASE line occurs ${n} times, want 1; BASE moved, re-spec (S1)`); continue; }
  const want = base.split('\n').map((l) => (l === e.from ? e.to : l)).join('\n');
  if (head !== want) {
    const h = head.split('\n'); const w = want.split('\n');
    const i = h.findIndex((l, k) => l !== w[k]);
    failures.push(`${e.file}: differs from BASE + the ${e.id} line at line ${i + 1}: "${(h[i] ?? '<eof>').trim().slice(0, 110)}" (S1)`);
  }
}
const css = readRepoFile('design/design_handoff_saoc/colors_and_type.css') ?? '';
const theme = readRepoFile('app/globals.css') ?? '';
for (const [tok, val] of [['primary', '#384138'], ['ivory', '#f4f3ec']]) {
  if (!new RegExp(`--${tok}:\\s*${val}\\b`, 'i').test(css)) failures.push(`colors_and_type.css no longer defines --${tok}: ${val} (S2)`);
  if (!new RegExp(`--color-${tok}:\\s*var\\(--${tok}\\);`).test(theme)) failures.push(`app/globals.css @theme no longer maps --color-${tok} (S2)`);
}
for (const f of ['design/design_handoff_saoc/colors_and_type.css', 'app/globals.css']) if (readRepoFile(f) !== readBaseFile(f)) failures.push(`${f} must equal BASE: no new colour (S2)`);
const doc = readRepoFile(DOC);
if (doc === null || !/\bF3\b/.test(doc)) failures.push(`${DOC} must record F3 (S3)`);
finish(NAME, failures, 'the provisional sup takes --primary and the 404 eyebrow --ivory, one line each; no token added; docs record F3.');
