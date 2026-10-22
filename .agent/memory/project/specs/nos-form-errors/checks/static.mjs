// nos-form-errors (rFE) static check. QA input, hash-locked. Golden: goldens/edits.json.
//   S1  components/tickets/TicketFormField.tsx and app/globals.css equal BASE + exactly the golden substitutions (TicketFieldAlert takes an
//       optional id; the --color-error comment becomes the shared-use comment, the value untouched).
//   S2  the alert class is defined once (TicketFormField.tsx) and only one source file holds role="alert" among the three components;
//       ContactForm and SuggestionForm import TicketFieldAlert, render it, hold no role="alert" or old outlined class of their own.
//   S3  per-field wiring present in both forms: every field's error id, the message hint id, aria-invalid and aria-describedby, a
//       focus call, the form-level alert id; the shared inputs stay (rounded-sm prefix, noValidate, honeypot, fetch and body lines BASE).
//   S4  copy: only existing strings (goldens/edits.json strings, each with its BASE source), the API's email regex; no new prose.
//   S5  nothing else: e2e/contact-form-mocked.spec.ts, the API route and the two pages equal BASE (the footprint allows no others).
//   S6  docs/nos-form-errors.md records rFE.
import { finish, goldenJson, readBaseFile, readRepoFile } from './_lib.mjs';
import { exactSubstitutions, newProse } from './_edits.mjs';

const NAME = 'static.mjs';
const G = goldenJson('edits.json');
const failures = [];
const count = (s, sub) => s.split(sub).length - 1;

// S1
failures.push(...exactSubstitutions(G.ticketFormField.file, G.ticketFormField.substitutions, 'S1'));
failures.push(...exactSubstitutions(G.globals.file, G.globals.substitutions, 'S1'));
if (!(readRepoFile(G.globals.file) ?? '').includes('--color-error: #9b2c2c;')) failures.push(`${G.globals.file}: the --color-error value changed (S1)`);

// S2-S4 per form
const corpus = [G.forms.contact.file, G.forms.suggestion.file, 'app/api/contact/route.ts', 'components/tickets/TicketFormField.tsx', 'lib/data/ticket-presentation.ts'];
for (const [key, f] of Object.entries(G.forms)) {
  const src = readRepoFile(f.file) ?? '';
  const base = readBaseFile(f.file) ?? '';
  const at = (s) => `${f.file}: ${s}`;
  if (!src.includes(G.import)) failures.push(at(`does not import TicketFieldAlert from TicketFormField (S2)`));
  if (!src.includes('<TicketFieldAlert')) failures.push(at('never renders <TicketFieldAlert (S2)'));
  if (src.includes('role="alert"')) failures.push(at('still holds its own role="alert" (S2)'));
  if (src.includes(G.oldClass) || src.includes('border-primary-800')) failures.push(at('still holds the old outlined alert class (S2)'));
  if (src.includes(G.alertClass)) failures.push(at('copies the shared alert class instead of rendering TicketFieldAlert (S2)'));
  for (const fld of f.fields) {
    if (!src.includes(fld.errorId)) failures.push(at(`no error id ${fld.errorId} (S3)`));
    if (fld.hintId && !src.includes(fld.hintId)) failures.push(at(`no hint id ${fld.hintId} (S3)`));
  }
  if (!src.includes(f.formErrorId)) failures.push(at(`no form-level alert id ${f.formErrorId} (S3)`));
  if (count(src, 'aria-invalid') < f.fields.length) failures.push(at(`${count(src, 'aria-invalid')} aria-invalid uses for ${f.fields.length} fields (S3)`));
  if (count(src, 'aria-describedby') < f.fields.length) failures.push(at(`${count(src, 'aria-describedby')} aria-describedby uses for ${f.fields.length} fields (S3)`));
  if (!/\.focus\(/.test(src)) failures.push(at('never calls .focus( (S3)'));
  if (!src.includes('noValidate')) failures.push(at('noValidate is gone (S3)'));
  if (!src.includes(G.unchangedLiterals.inputClassPrefix)) failures.push(at('the shared input class prefix changed: radius and field styling are out of scope (S3)'));
  if (!src.includes(G.unchangedLiterals.fetch)) failures.push(at('the fetch call changed (S3)'));
  if (!src.includes(key === 'contact' ? G.unchangedLiterals.contactBody : G.unchangedLiterals.suggestionBody)) failures.push(at('the request body line changed: it must still omit _hp (S3)'));
  if (!src.includes('hp.trim() !== \'\'')) failures.push(at('the honeypot guard is gone (S3)'));
  for (const s of [G.strings.required.text, G.strings.invalidEmail.text, key === 'contact' ? G.strings.contactMessage.text : G.strings.suggestionMessage.text]) {
    if (!src.includes(s)) failures.push(at(`missing the existing string ${JSON.stringify(s)} (S4)`));
  }
  if (!src.includes(G.emailRegex)) failures.push(at(`does not use the API's email regex ${G.emailRegex} (S4)`));
  if (key === 'suggestion' && src.includes(G.strings.contactMessage.text)) failures.push(at('uses the ContactForm message string (S4)'));
  failures.push(...newProse(f.file, corpus));
  if (!base) failures.push(at('missing at BASE (INFRA)'));
}
// S2 (cross-file): the alert class is defined once.
const holders = [G.ticketFormField.file, G.forms.contact.file, G.forms.suggestion.file].filter((f) => (readRepoFile(f) ?? '').includes(G.alertClass));
if (holders.length !== 1 || holders[0] !== G.ticketFormField.file) failures.push(`the alert class is held by ${JSON.stringify(holders)}, want only ${G.ticketFormField.file} (S2)`);

// S5
for (const rel of ['e2e/contact-form-mocked.spec.ts', 'app/api/contact/route.ts', 'app/(marketing)/contact/page.tsx', 'app/(marketing)/members/page.tsx']) {
  if (readRepoFile(rel) !== readBaseFile(rel)) failures.push(`${rel}: changed since BASE, but it is out of scope (S5)`);
}

// S6
const doc = readRepoFile('docs/nos-form-errors.md');
if (doc === null) failures.push('docs/nos-form-errors.md is missing (S6)');
else for (const must of ['rFE', 'TicketFieldAlert', 'aria-invalid', 'aria-describedby', '--color-error', 'All fields are required.', 'Invalid email address.']) if (!doc.includes(must)) failures.push(`docs/nos-form-errors.md never mentions ${must} (S6)`);

finish(NAME, failures, 'TicketFieldAlert takes an id and is the only alert class holder, both SAOC forms render it per field with ids, aria-invalid, aria-describedby and focus, copy is existing strings only, --color-error comment is the shared-use one, nothing out of scope touched, docs present.');
