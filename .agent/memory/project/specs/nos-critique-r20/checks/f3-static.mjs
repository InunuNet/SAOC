// nos-critique-r20 F3 static (QA input, hash-locked). Goldens: goldens/f3-edits.json, f3-footprint.json, f3-spec.md.
//   S1  components/chrome/footer-data.ts equals BASE plus exactly the FOOTER_LAYOUT block (SAOC's five layout class strings, verbatim).
//   S2  components/chrome/Footer.tsx equals BASE with exactly its five layout class literals replaced by the FOOTER_LAYOUT keys (a pure
//       refactor: same strings, same DOM) and FOOTER_LAYOUT imported.
//       r20 F4 (footer rhythm, goldens/f4-edits.json) edits both files on other BASE lines: S1/S2 accept BASE + F3, or BASE + F3 + F4;
//       r20 F5 (footer parity, goldens/f5-edits.json) edits Footer.tsx on two more, so S2 also accepts BASE + F3 + F4 + F5.
//   S3  components/nos-chrome/NosFooter.tsx imports FOOTER_LAYOUT and uses each key exactly once in a className; the columns run brand,
//       Explore, Partners, Stay in touch (with the WOSA block) in source order; the lockup's density box is 248; no .nf-wrap / .nf-grid.
//   S4  components/nos-chrome/nos-chrome.css drops the r17 brand layout and the NOS grid (golden `nosRetired`) and sets the lockup at
//       248px.
//   S5  NO INVENTION: no new prose literal in the F3 files that is not already in BASE.
//   S6  docs/nos-critique-r20.md has a "## F3" section.
import { DOC, finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f3-static.mjs';
const G = goldenJson('f3-edits.json');
const G4 = goldenJson('f4-edits.json');
const G5 = goldenJson('f5-edits.json');
const FP = goldenJson('f3-footprint.json');
const failures = [];
const count = (text, needle) => text.split(needle).length - 1;

// BASE + F3 alone, else BASE + F3 plus each later amendment in order; when none matches, the F3-alone diff is reported.
const f3OrLater = (f3, later, tag) => {
  const alone = exactEdits(f3.file, f3.lineEdits, f3.drops, tag);
  if (alone.length === 0) return alone;
  for (let k = 1; k <= later.length; k += 1) {
    const parts = [f3, ...later.slice(0, k)];
    if (exactEdits(f3.file, parts.flatMap((p) => p.lineEdits), parts.flatMap((p) => p.drops), tag).length === 0) return [];
  }
  return alone;
};
failures.push(...f3OrLater(G.footerData, [G4.footerData], 'S1'));
failures.push(...f3OrLater(G.saocFooter, [G4.saocFooter, G5.saocFooter], 'S2'));

const NOS = 'components/nos-chrome/NosFooter.tsx';
const tsx = readRepoFile(NOS);
if (tsx === null) failures.push(`${NOS}: missing (S3)`);
else {
  if (!/import \{[^}]*\bFOOTER_LAYOUT\b[^}]*\} from '@\/components\/chrome\/footer-data';/.test(tsx)) failures.push(`${NOS}: FOOTER_LAYOUT is not imported from @/components/chrome/footer-data (S3)`);
  for (const k of G.layoutKeys) {
    const uses = (tsx.match(new RegExp(`className=\\{(?:\`[^\`]*\\$\\{FOOTER_LAYOUT\\.${k}\\}[^\`]*\`|FOOTER_LAYOUT\\.${k})\\}`, 'g')) ?? []).length;
    if (uses !== 1) failures.push(`${NOS}: FOOTER_LAYOUT.${k} is used in ${uses} classNames, want 1 (S3)`);
  }
  const order = ['className="nf-lockup"', '{FOOTER_HEADINGS.explore}', '{FOOTER_HEADINGS.partners}', '{FOOTER_HEADINGS.touch}', '{FOOTER_WOSA.heading}', '{FOOTER_COPYRIGHT_TAIL}'].map((n) => tsx.indexOf(n));
  if (order.some((i) => i < 0) || !order.every((i, k) => k === 0 || order[k - 1] < i)) failures.push(`${NOS}: the columns are not brand, Explore, Partners, Stay in touch + WOSA, then the bottom bar, in source order (S3)`);
  if (!/const LOCKUP_BOX = 248;/.test(tsx)) failures.push(`${NOS}: LOCKUP_BOX is not 248 (S3)`);
  for (const gone of ['nf-wrap', 'nf-grid']) if (tsx.includes(gone)) failures.push(`${NOS}: still uses ${gone} (S3)`);
  if (count(tsx, 'src={LOCKUP_SRC}') + count(tsx, 'src: LOCKUP_SRC') !== 1 || !tsx.includes(`'${G.lockup.src}'`)) failures.push(`${NOS}: the brand slot is not the one ${G.lockup.src} lockup (S3)`);
}
const CSS = 'components/nos-chrome/nos-chrome.css';
const css = readRepoFile(CSS);
if (css === null) failures.push(`${CSS}: missing (S4)`);
else {
  for (const gone of G.nosRetired) if (css.includes(gone)) failures.push(`${CSS}: still carries ${JSON.stringify(gone)} (S4)`);
  if (!/\.nf-lockup \{[^}]*\bwidth: 248px;/.test(css)) failures.push(`${CSS}: the .nf-lockup rule does not set width: 248px (S4)`);
}
for (const f of FP) failures.push(...newProse(f, [...FP], { allow: G.allowCopy ?? [] }));
if (!/^## F3\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F3" section (S6)`);

finish(NAME, failures, 'F3 static: FOOTER_LAYOUT shared by both footers (SAOC a pure refactor), the NOS footer on it in SAOC column order with the 248px lockup, the r17 brand layout retired, no new copy, docs F3.');
