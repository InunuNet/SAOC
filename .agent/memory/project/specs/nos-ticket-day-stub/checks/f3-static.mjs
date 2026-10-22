// nos-ticket-day-stub F3 (Codi on f090281f: the required-field alert reads as an error) static. QA input, hash-locked.
// Golden: goldens/f3-edits.json.
//   S1  TicketFormField.tsx and nos-structure.css equal BASE with exactly the F3 substitutions; TicketCard.tsx, BuyBlock.tsx and
//       TicketPurchaseForm.tsx equal BASE with the F1 / F2 line edits and then the F3 substitutions. app/globals.css is S3's.
//   S2  defined once: the alert class string appears in exactly one source file under components/ and app/ (TicketFormField.tsx), once;
//       the card and the checkout form hold no role="alert" of their own and render TicketFieldAlert (the two day pickers spaced, the
//       checkout's cart error plain); the old outlined class is gone from all three ticket files.
//   S3  the token: app/globals.css defines --color-error: #9b2c2c once, inside @theme, and nothing else under app/ or components/
//       defines it; apart from that line (and goldens/f3-edits.json tokenEdit's comment) globals.css equals BASE or origin/main, so
//       either our edit or admin-redesign #28's identical line passes (team-lead, 2026-10-22). The invalid day group rule reads
//       var(--color-error).
//   S7  modified clicks pass through (Codex P2 on BuyBlock.tsx:158): the missing-day handler returns before preventDefault unless the
//       click is a plain primary one (button 0, no meta, ctrl, shift or alt).
//   S4  contrast: #9b2c2c against every bone, parchment, ivory and gold surface the two themes define is at least 4.5:1.
//   S5  out of scope and untouched since BASE: the SAOC contact and suggestion forms, the ticket download notice, the vendor banner,
//       the admin table, CartAttendeeFields and nos-theme.css. No new prose in the three ticket files (NO INVENTION).
//   S6  docs/nos-ticket-day-stub.md records F3.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { finish, git, goldenJson, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f3-static.mjs';
const G = goldenJson('f3-edits.json');
const G1 = goldenJson('f1-edits.json');
const G2 = goldenJson('f2-edits.json');
const failures = [];
const FIELD = 'components/tickets/TicketFormField.tsx';
const FORM = G2.form.file;
const CARD = G1.card.file;
const BUY = G1.buy.file;
const GLOBALS = 'app/globals.css';
const NOS = 'app/(marketing)/national-show/nos-structure.css';
const THEMES = [GLOBALS, 'app/(marketing)/national-show/nos-theme.css'];
const SURFACES = /^\s*--(bone|parchment|ivory|gold|gold-100|nos-pale-gold):\s*(#[0-9a-fA-F]{6})\b/;
const count = (s, sub) => s.split(sub).length - 1;

// S1
for (const f of [FIELD, NOS]) failures.push(...exactEdits(f, [], [], 'S1'));
failures.push(...exactEdits(BUY, G1.buy.lineEdits, G1.buy.drops, 'S1'));
failures.push(...exactEdits(CARD, G1.card.lineEdits, G1.card.drops, 'S1'));
failures.push(...exactEdits(FORM, G2.form.lineEdits, G2.form.drops, 'S1'));

// S2
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(n) ? [p] : []; });
const holders = [];
for (const top of ['components', 'app']) for (const f of walk(path.join(repoRoot, top))) {
  const rel = path.relative(repoRoot, f);
  const n = count(readRepoFile(rel) ?? '', G.alertClass);
  if (n) holders.push(`${rel} x${n}`);
}
if (holders.length !== 1 || holders[0] !== `${FIELD} x1`) failures.push(`the alert class is defined in ${JSON.stringify(holders)}, want only ${FIELD}, once (S2)`);
const field = readRepoFile(FIELD) ?? '';
const card = readRepoFile(CARD) ?? '';
const form = readRepoFile(FORM) ?? '';
if (count(field, 'role="alert"') !== 1) failures.push(`${FIELD}: want exactly one role="alert", in TicketFieldAlert (S2)`);
if (!field.includes(G.uses.field)) failures.push(`${FIELD}: the field error is not ${G.uses.field} (S2)`);
for (const [f, src, uses] of [[CARD, card, [G.uses.cardDay]], [FORM, form, [G.uses.formDay, G.uses.formCart]]]) {
  if (src.includes('role="alert"')) failures.push(`${f}: still renders its own role="alert" (S2)`);
  for (const u of uses) if (!src.includes(u)) failures.push(`${f}: does not render ${u} (S2)`);
  if (!src.includes("import { TicketFieldAlert } from '@/components/tickets/TicketFormField';")) failures.push(`${f}: does not import TicketFieldAlert from TicketFormField (S2)`);
}
for (const [f, src] of [[FIELD, field], [CARD, card], [FORM, form]]) if (src.includes(G.oldClass)) failures.push(`${f}: the outlined alert class is still here (S2)`);

// S3
const globals = readRepoFile(GLOBALS) ?? '';
const decl = `${G.token.name}: ${G.token.value};`;
const theme = globals.match(/@theme\s*\{([\s\S]*?)\n\}/);
if (count(globals, `${G.token.name}:`) !== 1 || !theme || !theme[1].includes(decl)) failures.push(`${GLOBALS}: want "${decl}" once, inside @theme (S3)`);
const ours = new Set(G.tokenEdit.to.split('\n').filter((l) => l.trim() && !G.tokenEdit.from.split('\n').includes(l)));
const strip = (s) => s.split('\n').filter((l) => l.trim() !== decl && !ours.has(l)).join('\n').replace(/\n{3,}/g, '\n\n');
let mainGlobals = null;
try { mainGlobals = git('show', `origin/main:${GLOBALS}`); } catch { mainGlobals = null; }
const bare = strip(globals);
if (bare !== strip(readBaseFile(GLOBALS) ?? '') && (mainGlobals === null || bare !== strip(mainGlobals))) failures.push(`${GLOBALS}: changes something besides the ${G.token.name} line (compared with BASE and origin/main) (S3)`);
for (const top of ['components', 'app']) for (const f of walk(path.join(repoRoot, top))) {
  const rel = path.relative(repoRoot, f);
  if (rel !== GLOBALS && (readRepoFile(rel) ?? '').includes(`${G.token.name}:`)) failures.push(`${rel}: defines ${G.token.name} too (S3)`);
}
if (!(readRepoFile(NOS) ?? '').includes(".nos-theme .nk-days[aria-invalid='true'] .nk-day {\n  border-color: var(--color-error);\n}")) failures.push(`${NOS}: the invalid day group rule does not read var(--color-error) (S3)`);

// S7
if (!(readRepoFile(BUY) ?? '').includes(G.modifiedClick.use)) failures.push(`${BUY}: the missing-day handler does not let modified clicks through (S7)`);

// S4
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let surfaces = 0;
for (const f of THEMES) for (const line of (readRepoFile(f) ?? '').split('\n')) {
  const m = line.match(SURFACES);
  if (!m) continue;
  surfaces += 1;
  const r = ratio(G.token.value, m[2]);
  if (r < G.minContrast) failures.push(`${f}: ${G.token.value} on --${m[1]} ${m[2]} is ${r.toFixed(2)}:1, want ${G.minContrast}:1 (S4)`);
}
if (surfaces < 5) failures.push(`only ${surfaces} bone/parchment/ivory/gold surfaces found in ${THEMES.join(', ')} (S4)`);

// S5
for (const rel of G.outOfScope) if (readRepoFile(rel) !== readBaseFile(rel)) failures.push(`${rel}: changed since BASE, but it is out of F3's scope (S5)`);
const corpus = ['lib/data/ticket-presentation.ts', FIELD, FORM, CARD];
for (const f of [FIELD, CARD, FORM]) failures.push(...newProse(f, corpus));

// S6
const doc = readRepoFile('docs/nos-ticket-day-stub.md');
if (doc === null) failures.push('docs/nos-ticket-day-stub.md is missing (S6)');
else for (const must of ['F3', 'TicketFieldAlert', '--color-error', '#9b2c2c', 'isPlainClick']) if (!doc.includes(must)) failures.push(`docs/nos-ticket-day-stub.md never mentions ${must} (S6)`);

finish(NAME, failures, `the alert class is defined once in TicketFormField (error-colour text, 2px left border, aria-hidden sign), the card and checkout render TicketFieldAlert, --color-error ${G.token.value} is the one new token and clears ${G.minContrast}:1 on ${surfaces} surfaces, exact edits only, nothing out of scope touched, docs present.`);
