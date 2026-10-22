// nos-critique-r20 F1 static (QA input, hash-locked). Goldens: goldens/f1-edits.json, f1-footprint.json, f1-spec.md.
// F3 rebuilds the same footer on the SAOC grid, so F1 is pinned by its own markup and rules, not by BASE line numbers.
//   S1  components/nos-chrome/NosFooter.tsx: exactly one <label className="nf-head" htmlFor="nf-email">{FOOTER_BULLETIN.emailLabel}</label>,
//       after the bulletin blurb and before the sign-up form (outside it, so the 390 row stays input + button); the form's input carries
//       id="nf-email", type="email", name="email", autoComplete="email", placeholder and required, and no aria-label.
//   S2  components/nos-chrome/nos-chrome.css: the .nf-form input rule is BASE's with only the border alpha .36 -> .55; no 0.36 border is
//       left; one rule block .nf-col-touch label.nf-head { display: block; }.
//   S3  NO INVENTION: no new prose literal in the F1 files that is not already in BASE.
//   S4  docs/nos-critique-r20.md has a "## F1" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const FP = goldenJson('f1-footprint.json');
const failures = [];
const count = (text, needle) => text.split(needle).length - 1;

const tsx = readRepoFile(G.footer.file);
if (tsx === null) failures.push(`${G.footer.file}: missing (S1)`);
else {
  const label = '<label className="nf-head" htmlFor="nf-email">{FOOTER_BULLETIN.emailLabel}</label>';
  if (count(tsx, label) !== 1) failures.push(`${G.footer.file}: ${count(tsx, label)} copies of ${label}, want 1 (S1)`);
  const blurb = tsx.indexOf('{FOOTER_BULLETIN.blurb}');
  const at = tsx.indexOf(label);
  const form = tsx.indexOf('<form id="nf-form"');
  if (blurb < 0 || form < 0 || !(blurb < at && at < form)) failures.push(`${G.footer.file}: the label is not between the bulletin blurb and the sign-up form (S1)`);
  const input = tsx.slice(form).match(/<input\b[^>]*\/>/);
  if (!input) failures.push(`${G.footer.file}: no <input /> in the sign-up form (S1)`);
  else {
    for (const attr of ['id="nf-email"', 'type="email"', 'name="email"', 'autoComplete="email"', 'placeholder={FOOTER_BULLETIN.placeholder}', 'required']) if (!new RegExp(`\\s${attr.replace(/[.{}]/g, '\\$&')}(\\s|/>)`).test(input[0])) failures.push(`${G.footer.file}: the input lacks ${attr} (S1)`);
    if (/aria-label/.test(input[0])) failures.push(`${G.footer.file}: the input still has an aria-label (S1)`);
  }
  if (count(tsx, 'id="nf-email"') !== 1) failures.push(`${G.footer.file}: id="nf-email" is not unique in the footer (S1)`);
}

const css = readRepoFile(G.css.file);
if (css === null) failures.push(`${G.css.file}: missing (S2)`);
else {
  const rule = G.css.lineEdits.find((e) => e.line === 139).to;
  if (count(css, rule) !== 1) failures.push(`${G.css.file}: the .nf-form input rule is not exactly BASE's with border alpha 0.55 (S2)`);
  if (/rgba\(210, 203, 232, 0\.36\)/.test(css)) failures.push(`${G.css.file}: an rgba(210, 203, 232, 0.36) border is still there (S2)`);
  if (count(css, '.nf-col-touch label.nf-head { display: block; }') !== 1) failures.push(`${G.css.file}: no single .nf-col-touch label.nf-head { display: block; } rule block (S2)`);
}

for (const f of FP) failures.push(...newProse(f, [...FP, 'components/chrome/footer-data.ts'], { allow: G.allowCopy ?? [] }));
if (!/^## F1\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F1" section (S4)`);

finish(NAME, failures, 'F1 static: a visible nf-head label for nf-email outside the form, name/autocomplete email, no aria-label, border alpha .55, no new copy, docs F1.');
