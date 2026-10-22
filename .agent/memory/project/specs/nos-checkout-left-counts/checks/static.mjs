// nos-checkout-left-counts (rLC) static check. QA input, hash-locked. Golden: goldens/edits.json.
//   S1  DayCount.tsx exists and exports DayCount; the count format, the nk-of/nk-left pair and the nk-unconfirmed note are each defined once
//       across the three keepsake/form files (the hub card and the checkout share one definition, no copy), and TicketCard no longer holds them.
//   S2  TicketCard.tsx renders DayCount in its picker and still holds the hub's own cell wrapper (data-ticket-day, is-out, is-low, disabled).
//   S3  page.tsx gets the numbers from the hub's loader (loadTicketCardViewModels) with the hub's showProvisional, only for the Day Pass
//       (productId day) with requiresDaySelection, and passes them to TicketPurchaseForm; no second data source is imported.
//   S4  TicketPurchaseForm.tsx takes the counts as props, renders DayCount per option with aria-describedby, fetches nothing, and keeps
//       every r45 line (no default day, required-day alert, aria-invalid).
//   S5  no new copy (existing strings only), no CSS: stylesheets, the hub page and the data/view-model modules equal BASE.
//   S6  docs/nos-checkout-left-counts.md records rLC.
import { finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { newProse } from './_edits.mjs';

const NAME = 'static.mjs';
const G = goldenJson('edits.json');
const F = G.files;
const failures = [];
const count = (s, sub) => s.split(sub).length - 1;
const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, readRepoFile(f)]));
for (const [k, s] of Object.entries(src)) if (s === null) failures.push(`${F[k]}: missing (S1)`);
const dayCount = src.dayCount ?? '';
const card = src.card ?? '';
const form = src.form ?? '';
const page = src.page ?? '';
const all3 = dayCount + card + form;

// S1
if (!/export\s+(function|const)\s+DayCount\b/.test(dayCount)) failures.push(`${F.dayCount}: does not export DayCount (S1)`);
if (/^\s*['"]use client['"]/m.test(dayCount)) failures.push(`${F.dayCount}: has its own 'use client' (its callers are client components already) (S1)`);
const leftRe = new RegExp(G.leftFormatRegex, 'g');
if ((all3.match(leftRe) ?? []).length !== 1 || !leftRe.test(dayCount)) failures.push(`the format ${G.leftFormat} must occur once, in DayCount.tsx; found ${(all3.match(leftRe) ?? []).length} across the three files (S1)`);
for (const cls of [G.classes.of, G.classes.left, G.classes.unconfirmed]) {
  if (count(all3, cls) !== 1) failures.push(`class ${cls} occurs ${count(all3, cls)} times across DayCount.tsx, TicketCard.tsx and TicketPurchaseForm.tsx, want 1 (S1)`);
}
if (card.includes(G.classes.left) || card.includes(G.classes.of)) failures.push(`${F.card}: still holds the count markup itself (S1)`);
if (!/from '\.\/days'/.test(dayCount) || !dayCount.includes('daySubline')) failures.push(`${F.dayCount}: does not build the line from days.ts daySubline (S1)`);

// S2
if (!card.includes('<DayCount')) failures.push(`${F.card}: does not render <DayCount (S2)`);
for (const must of ['data-ticket-day', 'is-out', 'is-low', 'disabled={closed}', 'isDayClosed']) {
  if (!card.includes(must)) failures.push(`${F.card}: lost ${must} (S2)`);
}

// S3
if (!page.includes(G.hubLoader.import) || !page.includes(G.hubLoader.from)) failures.push(`${F.page}: does not import ${G.hubLoader.import} from ${G.hubLoader.from} (S3)`);
if (!page.includes(G.hubLoader.showProvisional)) failures.push(`${F.page}: showProvisional is not ${G.hubLoader.showProvisional}, the hub's own expression (S3)`);
if (!page.includes('withholdPlaceholderProse')) failures.push(`${F.page}: never uses withholdPlaceholderProse (S3)`);
if (!/<TicketPurchaseForm[\s\S]{0,600}?dayCounts=/.test(page)) failures.push(`${F.page}: TicketPurchaseForm gets no dayCounts prop (S3)`);
if (!/<TicketPurchaseForm[\s\S]{0,600}?showProvisional=/.test(page)) failures.push(`${F.page}: TicketPurchaseForm gets no showProvisional prop (S3)`);
if (!/productId\s*===\s*'day'/.test(page)) failures.push(`${F.page}: the counts are not limited to the Day Pass (productId === 'day') (S3)`);
if (!page.includes('requiresDaySelection')) failures.push(`${F.page}: the counts are not limited to a day-selection product (S3)`);
if (!/\.cards\.day\b|cards\?*\.day\b/.test(page)) failures.push(`${F.page}: does not read the hub's Day Pass card (cards.day) (S3)`);
for (const bad of G.forbiddenInPage) if (page.includes(bad) && !(readBaseFile(F.page) ?? '').includes(bad)) failures.push(`${F.page}: holds ${bad}: a second data source (S3)`);
const baseImports = new Set((readBaseFile(F.page) ?? '').split('\n').filter((l) => /^\s*(import|\} from)/.test(l)));
const newImports = page.split('\n').filter((l) => /^\s*(import|\} from)/.test(l) && !baseImports.has(l));
for (const l of newImports) if (!/admission-availability|show-pages|keepsake/.test(l)) failures.push(`${F.page}: new import ${JSON.stringify(l.trim())} is not the hub loader, withholdPlaceholderProse or a keepsake type (S3)`);

// S4
if (!/dayCounts\??:/.test(form)) failures.push(`${F.form}: no dayCounts prop (S4)`);
if (!/showProvisional\??:/.test(form)) failures.push(`${F.form}: no showProvisional prop (S4)`);
if (!form.includes('<DayCount')) failures.push(`${F.form}: does not render <DayCount (S4)`);
if (!/keepsake\/DayCount/.test(form)) failures.push(`${F.form}: does not import DayCount from keepsake/DayCount (S4)`);
if (!/aria-describedby=\{[^}]*\}/.test(form.slice(form.indexOf('type="radio"'), form.indexOf('type="radio"') + 700))) failures.push(`${F.form}: the day radio has no aria-describedby to its count (S4)`);
for (const bad of G.forbiddenInForm) if (form.includes(bad) && !(readBaseFile(F.form) ?? '').includes(bad)) failures.push(`${F.form}: new ${bad}: counts come from the server as props, never client-fetched (S4)`);
for (const line of G.baseLinesKept.form) {
  if (!(readBaseFile(F.form) ?? '').includes(line)) failures.push(`golden line missing at BASE (INFRA): ${line}`);
  if (!form.includes(line)) failures.push(`${F.form}: r45 line gone: ${line} (S4)`);
}
if (/useState\(\s*(showDays|dayCounts)/.test(form) || /cart\.setDay\(\s*showDays\[0\]/.test(form)) failures.push(`${F.form}: a default day is set (r45: no default day) (S4)`);

// S5
for (const f of [F.dayCount, F.card, F.form, F.page]) failures.push(...newProse(f, G.proseCorpus));
for (const rel of G.unchangedFiles) if (readRepoFile(rel) !== readBaseFile(rel)) failures.push(`${rel}: changed since BASE, but it is out of scope: no new style, data source or hub change (S5)`);

// S6
const doc = readRepoFile('docs/nos-checkout-left-counts.md');
if (doc === null) failures.push('docs/nos-checkout-left-counts.md is missing (S6)');
else for (const must of G.docMust) if (!doc.includes(must)) failures.push(`docs/nos-checkout-left-counts.md never mentions ${must} (S6)`);

finish(NAME, failures, 'one DayCount holds the count format, nk-of/nk-left and the unconfirmed note for the hub card and the checkout picker; the page reads the hub loader (cards.day, hub showProvisional) for the Day Pass only; the form takes props, fetches nothing and keeps every r45 line; no CSS, no second source, no new copy; docs present.');
