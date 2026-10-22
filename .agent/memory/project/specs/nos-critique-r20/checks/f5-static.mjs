// nos-critique-r20 F5 static (QA input, hash-locked). Goldens: goldens/f5-edits.json, f5-footprint.json, f3-edits.json, f4-edits.json, f5-spec.md.
// F5 (footer parity, Codi FINAL 2026-10-22, six items). F3, F4 and F5 edit components/chrome/Footer.tsx on different BASE lines, so S1 pins
// it as BASE plus exactly F3's, F4's and F5's line edits together.
//   S1  components/chrome/Footer.tsx equals BASE plus exactly F3's, F4's and F5's edits: the SAOC label reads FOOTER_BULLETIN.emailLabel
//       and the input gains inputMode="email" and spellCheck={false} after autoComplete="email" (items 2 and 3).
//   S2  components/nos-chrome/NosFooter.tsx: the sign-up input carries each golden attribute exactly once (item 3).
//   S3  components/nos-chrome/nos-chrome.css carries each golden rule exactly once (row letter-spacing 0, the WOSA link without an
//       underline at rest and with it on hover/focus-visible, REG/NPO at SAOC's weight and tracking in NOS gold), the F4 forms they
//       replace are gone, and the stacked-form rule is retired (items 1, 4, 5 and 6).
//   S4  the submit behaviour is untouched (footer-newsletter-subscribe owns it): each footer's BASE form line once, no action, formAction
//       or FormData.
//   S5  NO INVENTION: no new prose literal in the F5 files that is not already in BASE.
//   S6  docs/nos-critique-r20.md has a "## F5" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f5-static.mjs';
const G = goldenJson('f5-edits.json');
const G3 = goldenJson('f3-edits.json');
const G4 = goldenJson('f4-edits.json');
const FP = goldenJson('f5-footprint.json');
const failures = [];
const count = (text, needle) => text.split(needle).length - 1;

const parts = [G3.saocFooter, G4.saocFooter, G.saocFooter];
failures.push(...exactEdits(G.saocFooter.file, parts.flatMap((p) => p.lineEdits), parts.flatMap((p) => p.drops), 'S1'));

const N = G.nosFooter;
const tsx = readRepoFile(N.file);
if (tsx === null) failures.push(`${N.file}: missing (S2)`);
else {
  const input = tsx.match(/<input\b[^>]*\/>/);
  if (!input) failures.push(`${N.file}: no sign-up <input /> (S2)`);
  else for (const a of N.inputAttrs) if (count(input[0], a) !== 1) failures.push(`${N.file}: the sign-up input carries ${a} ${count(input[0], a)} times, want 1 (S2)`);
}

const C = G.nosCss;
const css = readRepoFile(C.file);
if (css === null) failures.push(`${C.file}: missing (S3)`);
else {
  for (const r of C.rules) if (count(css, r) !== 1) failures.push(`${C.file}: ${count(css, r)} copies of ${JSON.stringify(r)}, want 1 (S3)`);
  for (const old of Object.keys(C.replaces)) if (css.includes(old)) failures.push(`${C.file}: still carries the F4 rule F5 replaces: ${JSON.stringify(old)} (S3)`);
  for (const gone of C.retired) if (css.includes(gone)) failures.push(`${C.file}: still carries ${JSON.stringify(gone)} (S3)`);
}

for (const [file, form] of [[G4.saocFooter.file, G4.submit.saoc], [N.file, G4.submit.nos]]) {
  const src = readRepoFile(file) ?? '';
  if (count(src, form) !== 1) failures.push(`${file}: the BASE form line ${JSON.stringify(form)} appears ${count(src, form)} times, want 1 (S4)`);
  if (/<form\b[^>]*\baction=|formAction|new FormData/.test(src)) failures.push(`${file}: the sign-up form gained submit wiring (S4: footer-newsletter-subscribe owns it)`);
}

for (const f of FP) failures.push(...newProse(f, [...FP, 'components/chrome/footer-data.ts'], { allow: G.allowCopy ?? [] }));
if (!/^## F5\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F5" section (S6)`);

finish(NAME, failures, 'F5 static: SAOC label "Email address" and inputMode/spellCheck on both inputs, the form inline, row tracking 0, WOSA underline on hover/focus only, REG/NPO at SAOC weight and tracking, forms untouched, no new copy, docs F5.');
