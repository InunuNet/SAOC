// nos-critique-r15 f2 static (QA input, hash-locked). F2: the header focus ring fails WCAG 1.4.11 at 2.49:1 (ink at 40% on parchment).
//   S1  Header.tsx and MegaMenu.tsx equal BASE with exactly the goldens/f2-edits.json substitution (focus-visible:ring-ink/40 ->
//       focus-visible:ring-primary) on the listed lines (all 5 Header.tsx lines; MegaMenu.tsx's header-bar trigger only), nothing else.
//   S2  the ring token is the handoff's --primary (design/design_handoff_saoc/colors_and_type.css) mirrored in app/globals.css @theme as
//       --color-primary; neither file changes (no new colour, no opacity).
//   S3  docs/nos-critique-r15.md records F2.
import { DOC, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';

const NAME = 'f2-static.mjs';
const failures = [];
const G = goldenJson('f2-edits.json');

for (const e of G.edits) {
  const base = readBaseFile(e.file);
  const head = readRepoFile(e.file);
  if (base === null || head === null) { failures.push(`${e.file} missing at HEAD or BASE (S1)`); continue; }
  let n = 0;
  const want = base.split('\n').map((l) => {
    if (!l.includes(G.from) || (e.match && !l.includes(e.match))) return l;
    n += 1;
    return l.split(G.from).join(G.to);
  }).join('\n');
  if (n !== e.count) failures.push(`${e.file}: ${n} BASE line(s) match, the golden expects ${e.count}; BASE moved, re-spec (S1)`);
  if (head !== want) {
    const h = head.split('\n'); const w = want.split('\n');
    const i = h.findIndex((l, k) => l !== w[k]);
    failures.push(`${e.file}: differs from BASE + the one substitution at line ${i + 1}: "${(h[i] ?? '<eof>').trim().slice(0, 110)}" (S1)`);
  }
}
const css = readRepoFile('design/design_handoff_saoc/colors_and_type.css') ?? '';
if (!new RegExp(`${G.token.name}:\\s*${G.token.value}\\b`, 'i').test(css)) failures.push(`handoff colors_and_type.css no longer defines ${G.token.name}: ${G.token.value} (S2)`);
const theme = readRepoFile('app/globals.css') ?? '';
if (!/--color-primary:\s*var\(--primary\);/.test(theme)) failures.push('app/globals.css @theme no longer maps --color-primary to var(--primary) (S2)');
for (const f of ['design/design_handoff_saoc/colors_and_type.css', 'app/globals.css']) if (readRepoFile(f) !== readBaseFile(f)) failures.push(`${f} must equal BASE: no new colour or opacity token (S2)`);
const doc = readRepoFile(DOC);
if (doc === null || !/\bF2\b/.test(doc)) failures.push(`${DOC} must record F2 (S3)`);

finish(NAME, failures, 'the header focus ring uses the handoff --primary token (one substitution on the 6 header-bar lines); no token added; docs record F2.');
