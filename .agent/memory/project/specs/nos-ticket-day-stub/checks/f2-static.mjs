// nos-ticket-day-stub (r45b) F2 static. QA input, hash-locked. Golden: goldens/f2-edits.json.
//   S1  TicketPurchaseForm.tsx and app/(marketing)/tickets/[slug]/page.tsx each equal BASE with exactly the golden line edits.
//   S2  no default day at checkout: neither file falls back to showDays[0]; startDay returns the requested day or null; the summary's day
//       is the URL's day or null.
//   S3  the error is r45's: the same class as F1's hub error (goldens/f1-edits.json errorClass, TicketFormField's alert class plus
//       mt-1.5), text {TICKET_COPY.chooseDay}, aria-invalid on the fieldset; the submit button's only disabled condition is still
//       `submitting`; no new prose (NO INVENTION).
//   S4  docs/nos-ticket-day-stub.md records r45b.
import { finish, goldenJson, readRepoFile } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f2-static.mjs';
const G = goldenJson('f2-edits.json');
const G1 = goldenJson('f1-edits.json');
const failures = [];

// S1
for (const k of ['form', 'page']) failures.push(...exactEdits(G[k].file, G[k].lineEdits, G[k].drops, 'S1'));

// S2
const form = readRepoFile(G.form.file) ?? '';
const page = readRepoFile(G.page.file) ?? '';
for (const [f, src] of [[G.form.file, form], [G.page.file, page]]) if (/showDays\[0\]/.test(src)) failures.push(`${f}: still falls back to showDays[0] (S2)`);
if (!form.includes('return requested && showDays.includes(requested) ? requested : null;')) failures.push(`${G.form.file}: startDay does not return the requested day or null (S2)`);
if (!page.includes('const summaryDay = cardData.requiresDaySelection ? day : null;')) failures.push(`${G.page.file}: the summary day is not the URL's day or null (S2)`);

// S3
if (G.errorClass !== G1.errorClass) failures.push('goldens: the checkout error class differs from the hub error class (S3)');
const alert = form.match(/<p\s+role="alert"\s+className="(mt-1\.5[^"]*)"\s*>\s*\{([^}]+)\}\s*<\/p>/);
if (!alert) failures.push(`${G.form.file}: no role="alert" day error <p> (S3)`);
else if (alert[1] !== G1.errorClass || alert[2].trim() !== 'TICKET_COPY.chooseDay') failures.push(`${G.form.file}: day error <p class="${alert[1]}">{${alert[2].trim()}}, want class "${G1.errorClass}" and {TICKET_COPY.chooseDay} (S3)`);
if (!form.includes('<fieldset ref={dayGroupRef} className="days nk-days" aria-invalid={dayInvalid}>')) failures.push(`${G.form.file}: aria-invalid is not on the day fieldset (S3)`);
const submit = form.match(/<button\s+type="submit"[\s\S]*?>/);
if (!submit || !/disabled=\{submitting\}/.test(submit[0])) failures.push(`${G.form.file}: the submit button's disabled condition is no longer just {submitting} (S3)`);
const corpus = ['lib/data/ticket-presentation.ts', 'components/tickets/TicketFormField.tsx', G.form.file, G.page.file];
for (const k of ['form', 'page']) failures.push(...newProse(G[k].file, corpus));

// S4
const doc = readRepoFile('docs/nos-ticket-day-stub.md');
if (doc === null) failures.push('docs/nos-ticket-day-stub.md is missing (S4)');
else for (const must of ['r45b', 'TicketPurchaseForm.tsx', 'summaryDay']) if (!doc.includes(must)) failures.push(`docs/nos-ticket-day-stub.md never mentions ${must} (S4)`);

finish(NAME, failures, 'the checkout has no default day, the summary keeps the product stub without ?day, Continue to payment reuses the r45 error, exact edits only, docs present.');
