// nos-critique-r8 f1 static (R11 chip, one line at narrow widths; Codi FINAL).
//   S1  ShowStatusLine.tsx and VisitDisclosure.tsx tighten the chip with the INCLUSIVE spelled-out media query (max-width:700px): 0.06em tracking, 10px inline padding
//   S2  both add the <=419px step (0.02em tracking; max-width:419px or F18b's 375..419 band) and the <=374px step (0 tracking), and neither ever sets a chip font-size below 12px
//   S3  no bare max-[700px] utility is left under components/show, components/nos or the national-show tree (it compiles to width < 700px: the same class of bug)
//   S4  copy unchanged vs BASE in both files (no new strings)
//   S5  docs/nos-critique-r8.md exists
//   S6  the <=359px short tag: StatusMarker.tsx renders both strings (shortOnNarrow) and switches them with [@media(max-width:359px)] utilities (F18b: full sr-only, short shown), from its own existing
//       FALLBACK_PENDING_LABEL constant (no new literal); ConfirmationBadge forwards the prop; ShowStatusLine and EVERY ConfirmationBadge in VisitDisclosure pass it; the short tag
//       string is typed nowhere else
import { DOC, NS, copyStrings, finish, git, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const failures = [];
const fail = (m) => failures.push(m);
const FILES = ['components/show/ShowStatusLine.tsx', 'components/show/VisitDisclosure.tsx'];

for (const rel of FILES) {
  const raw = readRepoFile(rel);
  if (raw === null) { fail(`${rel} is missing`); continue; }
  const code = stripComments(raw);
  const name = rel.split('/').pop();
  if (!/\[@media\(max-width:700px\)\]/.test(code)) fail(`${name}: the <=700px chip rule must use [@media(max-width:700px)] (inclusive) (S1)`);
  if (!/tracking-\[0\.06em\]/.test(code) || !/!px-\[10px\]/.test(code)) fail(`${name}: the <=700px chip rule needs 0.06em tracking and 10px inline padding (S1)`);
  if (!/\[@media\(max-width:374px\)\][^'"`\s]*!tracking-(\[0(em|px)?\]|0|normal)/.test(code)) fail(`${name}: needs a [@media(max-width:374px)] zero-tracking step for the chip (S2)`);
  if (!/\[@media\((?:min-width:375px\)_and_\()?max-width:419px\)\][^'"`\s]*tracking-\[0\.02em\]/.test(code)) fail(`${name}: needs a [@media(max-width:419px)] (or F18b's (min-width:375px)_and_(max-width:419px)) 0.02em tracking step for the chip (S2)`);
  for (const m of code.matchAll(/!text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) fail(`${name}: chip font-size ${m[1]}px is below the 12px floor (S2)`);
  const base = readBaseFile(rel);
  if (base !== null && copyStrings(raw).sort().join('\n') !== copyStrings(base).sort().join('\n')) fail(`${name}: copy differs from BASE (S4)`);
}
const list = git('ls-files', '--cached', '--others', '--exclude-standard', '--', 'components/show', 'components/nos', NS).split('\n').filter((f) => /\.(tsx?|css)$/.test(f));
for (const rel of list) {
  const raw = readRepoFile(rel);
  if (raw !== null && /max-\[700px\]/.test(stripComments(raw).replace(/\/\*[\s\S]*?\*\//g, ''))) fail(`${rel}: bare max-[700px] utility (compiles to < 700px); spell the inclusive media query (S3)`);
}
const marker = readRepoFile('components/show/_shared/StatusMarker.tsx');
if (marker === null) fail('components/show/_shared/StatusMarker.tsx is missing (S6)');
else {
  const mc = stripComments(marker);
  if (!/shortOnNarrow/.test(mc)) fail('StatusMarker.tsx needs the opt-in shortOnNarrow prop (S6)');
  if (!/\[@media\(max-width:359px\)\]/.test(mc)) fail('StatusMarker.tsx must switch the full and short strings with an [@media(max-width:359px)] display rule (S6)');
  if (!/\bhidden\b/.test(mc)) fail('StatusMarker.tsx must switch the two strings with CSS utilities (the short tag hidden above 359px), not JS (S6)');
  if ((mc.match(/'To be confirmed'/g) ?? []).length !== 1) fail("StatusMarker.tsx must hold 'To be confirmed' exactly once (its existing FALLBACK_PENDING_LABEL), reused for the short tag (S6)");
  const mb = readBaseFile('components/show/_shared/StatusMarker.tsx');
  if (mb !== null) { const was = new Set(copyStrings(mb)); for (const x of copyStrings(marker)) if (!was.has(x)) fail(`StatusMarker.tsx adds a copy string not in BASE: "${x.slice(0, 60)}" (S6)`); }
}
const cb = readRepoFile('components/show/ConfirmationBadge.tsx');
if (cb === null || !/shortOnNarrow/.test(stripComments(cb))) fail('ConfirmationBadge.tsx must accept and forward shortOnNarrow (S6)');
const ssl = readRepoFile('components/show/ShowStatusLine.tsx');
if (ssl === null || !/shortOnNarrow/.test(stripComments(ssl))) fail('ShowStatusLine.tsx must pass shortOnNarrow to its marker (S6)');
const vdc = readRepoFile('components/show/VisitDisclosure.tsx');
if (vdc !== null) {
  const v = stripComments(vdc);
  const badges = (v.match(/<ConfirmationBadge\b/g) ?? []).length;
  const withProp = (v.match(/<ConfirmationBadge\b[^>]*shortOnNarrow/g) ?? []).length;
  if (badges < 1 || withProp !== badges) fail(`every ConfirmationBadge in VisitDisclosure.tsx must pass shortOnNarrow (${withProp} of ${badges}) (S6)`);
}
for (const rel of FILES) { const c = readRepoFile(rel); if (c !== null && /['"`]To be confirmed['"`]/.test(stripComments(c))) fail(`${rel.split('/').pop()}: the short tag string must not be typed here (S6)`); }
if (readRepoFile(DOC) === null) fail(`${DOC} is missing (S5)`);

finish('f1-static.mjs', failures, 'disclosure chips use the inclusive <=700px rule (0.06em / 10px), a <=419px 0.02em step, a <=374px zero-tracking step and the <=359px short tag, never below 12px; no bare max-[700px] left; copy unchanged.');
