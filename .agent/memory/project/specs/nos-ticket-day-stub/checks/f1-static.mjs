// nos-ticket-day-stub (r45) F1 static. QA input, hash-locked. Golden: goldens/f1-edits.json.
//   S1  TicketMini.tsx, TicketCard.tsx, BuyBlock.tsx and days.ts each equal BASE with exactly the golden line edits and drops.
//   S2  the fan: TicketMini reads product.numeral / product.caption only, and neither showDayStub nor firstSelectableDay.
//   S3  no default day: firstSelectableDay is gone from components/, lib/ and app/; the card's day state starts at the summary's day or
//       null; its stub is a day's only when a day is chosen.
//   S4  the error reuses what exists: its text is TICKET_COPY.chooseDay (the picker's legend, still "Choose a day" in
//       lib/data/ticket-presentation.ts), its class is TicketFormField's role="alert" class (plus mt-1.5, that field's space-y-1.5 gap),
//       aria-invalid sits on the fieldset, and no new prose appears in the four files (NO INVENTION).
//   S5  out of scope and untouched: ticket-presentation, the fan, the masthead and the server path. (Amended for F2, r45b: the checkout
//       form and the checkout page are F2's, pinned by f2-static.mjs S1.)
//   S6  docs/nos-ticket-day-stub.md exists and records the root cause and the server check.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f1-static.mjs';
const G = goldenJson('f1-edits.json');
const failures = [];
const KEYS = ['mini', 'card', 'buy', 'days'];
const PRESENTATION = 'lib/data/ticket-presentation.ts';
const FIELD = 'components/tickets/TicketFormField.tsx';
const UNTOUCHED = [
  PRESENTATION,
  FIELD,
  'components/tickets/keepsake/TicketFan.tsx',
  'components/tickets/keepsake/TicketsMasthead.tsx',
  'components/tickets/keepsake/checkout-day.ts',
  'components/tickets/keepsake/parts.tsx',
  'components/tickets/useTicketCart.ts',
  'lib/cart.ts',
  'lib/checkout-reservation.ts',
  'app/api/tickets/checkout/route.ts',
];

// S1
for (const k of KEYS) failures.push(...exactEdits(G[k].file, G[k].lineEdits, G[k].drops, 'S1'));

// S2
const mini = readRepoFile(G.mini.file) ?? '';
if (!/numeral=\{product\.numeral\}/.test(mini) || !/caption=\{product\.caption\}/.test(mini)) failures.push(`${G.mini.file}: the stub is not product.numeral / product.caption (S2)`);
for (const banned of ['showDayStub', 'firstSelectableDay', 'vm.days']) if (mini.includes(banned)) failures.push(`${G.mini.file}: still reads ${banned} (S2)`);

// S3
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs|js)$/.test(n) ? [p] : []; });
for (const top of ['components', 'lib', 'app']) for (const f of walk(path.join(repoRoot, top))) {
  const rel = path.relative(repoRoot, f);
  if ((readRepoFile(rel) ?? '').includes('firstSelectableDay')) failures.push(`${rel}: still names firstSelectableDay, the default-day helper (S3)`);
}
const card = readRepoFile(G.card.file) ?? '';
if (!card.includes('useState<string | null>(summary ? summaryDay : null)')) failures.push(`${G.card.file}: the day state does not start at the summary's day or null (S3)`);
if (!card.includes('const dayStub = day ? showDayStub(day) : null;')) failures.push(`${G.card.file}: the stub is not a day's only when one is chosen (S3)`);

// S4
const pres = readRepoFile(PRESENTATION) ?? '';
if (!pres.includes(`chooseDay: '${G.copy.chooseDay}'`)) failures.push(`${PRESENTATION}: TICKET_COPY.chooseDay is no longer "${G.copy.chooseDay}" (S4)`);
const field = readRepoFile(FIELD) ?? '';
if (!field.includes(`className="${G.patternSource.className}"`) || !field.includes(G.patternSource.wrapperGap)) failures.push(`${FIELD}: the required-field pattern this error reuses has changed (S4)`);
if (G.errorClass !== `mt-1.5 ${G.patternSource.className}`) failures.push('goldens: errorClass is not the pattern class plus mt-1.5 (S4)');
const alert = card.match(/<p\s+role="alert"\s+className="([^"]+)"\s*>\s*\{([^}]+)\}\s*<\/p>/);
if (!alert) failures.push(`${G.card.file}: no role="alert" <p> in the picker (S4)`);
else {
  if (alert[1] !== G.errorClass) failures.push(`${G.card.file}: the alert class is ${JSON.stringify(alert[1])}, want ${JSON.stringify(G.errorClass)} (S4)`);
  if (alert[2].trim() !== 'TICKET_COPY.chooseDay') failures.push(`${G.card.file}: the alert reads {${alert[2].trim()}}, want {TICKET_COPY.chooseDay} (S4)`);
}
if (!card.includes('<fieldset ref={groupRef} className="nk-days" aria-invalid={invalid}>')) failures.push(`${G.card.file}: aria-invalid is not on the picker's fieldset (S4)`);
const corpus = [PRESENTATION, FIELD, 'components/tickets/TicketPurchaseForm.tsx', ...KEYS.map((k) => G[k].file)];
for (const k of KEYS) failures.push(...newProse(G[k].file, corpus));

// S5
for (const rel of UNTOUCHED) if (readRepoFile(rel) !== readBaseFile(rel)) failures.push(`${rel}: changed since BASE, but it is out of r45's scope (S5)`);

// S6
const doc = readRepoFile('docs/nos-ticket-day-stub.md');
if (doc === null) failures.push('docs/nos-ticket-day-stub.md is missing (S6)');
else for (const must of ['TicketMini.tsx', 'requiresDaySelection', 'f1-server.mjs']) if (!doc.includes(must)) failures.push(`docs/nos-ticket-day-stub.md never mentions ${must} (S6)`);

finish(NAME, failures, 'the fan stub is the product\'s own, the Day Pass card starts with no day and shows the reused required-field error, exact edits only, nothing out of scope touched, docs present.');
