// nos-critique-r16 F2 static (QA input, hash-locked). Goldens: goldens/f2-edits.json, f2-footprint.json.
//   S1  /sponsors: app/(marketing)/sponsors/page.tsx equals BASE with exactly the golden CTA class line (bg-ink -> handoff primary,
//       radius --radius-1, hover primary-800); nothing else in the file changes.
//   S2  app/not-found.tsx: the two labels read "Go home" / "Find a society" (the old title-case labels are gone), the r15 eyebrow line
//       (text-ivory) is unchanged, and the root 404 imports the SAOC chrome (SkipLink, UtilityBar, Header, Footer from @/components/chrome).
//   S3  NO INVENTION: no new prose literal in the F2 files that is not already in BASE.
//   S4  docs/nos-critique-r16.md has a "## F2" section.
import { DOC, finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f2-static.mjs';
const G = goldenJson('f2-edits.json');
const FP = goldenJson('f2-footprint.json');
const failures = [];

// S1
const sp = G.sponsors;
failures.push(...exactEdits(sp.file, [{ line: sp.line, from: sp.from, to: sp.to }], [], 'S1'));

// S2
const nf = G.notFound;
const head = readRepoFile(nf.file) ?? '';
const base = readBaseFile(nf.file) ?? '';
for (const l of nf.labels.after) if (!new RegExp(`>\\s*${l}\\s*<`).test(head)) failures.push(`${nf.file}: no "${l}" label (S2)`);
for (const l of nf.labels.before) if (head.includes(l)) failures.push(`${nf.file}: still carries "${l}" (S2)`);
const eyebrow = base.split('\n').find((l) => l.includes('text-ivory') && l.includes('<p'));
if (!eyebrow || !head.split('\n').includes(eyebrow)) failures.push(`${nf.file}: the r15 eyebrow line (text-ivory) changed (S2)`);
const chromeImport = head.match(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/chrome'/);
for (const c of ['SkipLink', 'UtilityBar', 'Header', 'Footer']) if (!chromeImport || !new RegExp(`\\b${c}\\b`).test(chromeImport[1])) failures.push(`${nf.file}: does not import ${c} from @/components/chrome (S2)`);

// S3
for (const f of FP) failures.push(...newProse(f, [...FP, 'app/(marketing)/layout.tsx', 'components/chrome/Header.tsx', 'components/chrome/Footer.tsx'], { caseOnly: true }));

// S4
if (!/^## F2\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F2" section (S4)`);

finish(NAME, failures, 'F2 static: sponsors CTA is BASE + the golden class line, root 404 labels sentence case with the SAOC chrome imported and the eyebrow kept, no new copy, docs F2.');
