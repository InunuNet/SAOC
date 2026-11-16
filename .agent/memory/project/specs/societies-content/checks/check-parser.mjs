// societies-content F1 — parser + mapper must reproduce the goldens exactly, and must fail loud on a doc shape it does not know.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { parseSocietiesMarkdown, parseContactListMarkdown, mergeSocieties, toDocFields, DRIVE_SOURCE_TAGS } from '@/lib/societies/drive-parse';

const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const SRC = 'content/drive-source/SAOC /3. Societies/All Society data and history/v1.0/content.md';
const SRC_B = 'content/drive-source/SAOC /3. Societies/Society Contact list - Word/v1.0/content.md';
const md = readFileSync(SRC, 'utf8');
const mdB = readFileSync(SRC_B, 'utf8');
const json = (x) => JSON.parse(JSON.stringify(x));
const wantParsed = JSON.parse(readFileSync(`${SPEC}/parsed-societies.json`, 'utf8'));
const wantContacts = JSON.parse(readFileSync(`${SPEC}/parsed-contact-list.json`, 'utf8'));
const wantReport = JSON.parse(readFileSync(`${SPEC}/merge-report.json`, 'utf8'));
const wantDocs = JSON.parse(readFileSync(`${SPEC}/sanity-docs.json`, 'utf8'));

// (a) the detailed doc: 12 societies
const got = parseSocietiesMarkdown(md);
assert.deepEqual(json(got), wantParsed, 'detailed parser output differs from goldens/parsed-societies.json');
assert.equal(got.societies.length, 12);

// (b) the contact list: exactly 21 entries, field for field
const contacts = parseContactListMarkdown(mdB);
assert.deepEqual(json(contacts), wantContacts, 'contact-list parser output differs from goldens/parsed-contact-list.json');
assert.equal(contacts.entries.length, 21, 'the contact list must hold exactly 21 societies');

// merge: every detailed society matches exactly one contact-list entry; 9 are contact-list only; (a) wins field by field
const merged = mergeSocieties(got.societies, contacts.entries);
assert.deepEqual(json(merged.report), wantReport, 'merge report differs from goldens/merge-report.json');
assert.equal(merged.societies.length, 21);
const docs = merged.societies.map((m) => toDocFields(m, DRIVE_SOURCE_TAGS));
assert.deepEqual(json(docs), wantDocs, 'toDocFields output differs from goldens/sanity-docs.json');
assert.equal(new Set(docs.map((d) => d.slug.current)).size, 21, 'duplicate slug in the merged set');
for (const d of docs) for (const k of Object.keys(d)) assert.notEqual(d[k], undefined, `undefined own-property ${k} on ${d.name}`);
const gonubie = docs.find((d) => d.name === 'Gonubie Orchid Society');
assert.equal(gonubie.contactEmail, 'annettebrown100@gmail.com', 'the detailed doc must win over the contact list');
assert.equal(docs.find((d) => d.name === 'Plantae Orchid Group').contactEmail, 'info@plantae.co.za');
assert.equal(docs.find((d) => d.name === 'Zululand Orchid Society').meets, 'Every 4th Sunday of the month except December, 10:00 AM', 'Zululand meets comes from the detailed doc');
// the contact list only fills a field the detailed doc left empty
const holey = json(got.societies);
holey.find((s) => s.name === 'Highway Orchid Society').venue = null;
const filled = mergeSocieties(holey, contacts.entries).societies.find((s) => s.name === 'Highway Orchid Society');
assert.equal(filled.venue, 'Pinetown Methodist Church Hall, Church Lane Pinetown.');
// an unmatched detailed society is a loud mismatch, never papered over
const renamed = json(got.societies);
renamed[0].name = 'Zululand Orchid Societyy';
assert.throws(() => mergeSocieties(renamed, contacts.entries), /Zululand Orchid Societyy/);

// "Not supplied" and its siblings never survive into a value.
const blob = JSON.stringify([got, contacts, docs]);
assert.ok(!/not supplied/i.test(blob), 'a "Not supplied" sentinel leaked into the output');
assert.ok(!/was not supplied in the form/i.test(blob), 'the history sentinel leaked into the output');
// Lee-Ann's spellings are kept exactly (the detailed doc's name wins where the two docs spell one society differently).
for (const name of ['Pietermaritzberg Orchid Society', 'Vlakte Orgideevereniging', "Ronald O’Donoghu", 'Lowveld Orchid Group', 'Plantae Orchid Group']) {
  assert.ok(blob.includes(name), `lost verbatim text: ${name}`);
}
assert.ok(!docs.some((d) => d.name === 'Pietermaritzburg Orchid Society' || d.name === 'Die Vlakte Orchid Society'), 'a contact-list spelling replaced the detailed doc name');
// Markdown escapes are undone, the doc's own text is not.
assert.ok(blob.includes('orchid_society_southern_cape') && !blob.includes('\\_'));

// Fail fast on an unknown label, an unknown section, a duplicate slug, a contact list without a table.
assert.throws(() => parseSocietiesMarkdown(md.replace('**Treasurer:**', '**Vice-chair:**')), /Vice-chair/);
assert.throws(() => parseSocietiesMarkdown(md.replace('## Committee', '## Board')), /Board/);
assert.throws(() => parseSocietiesMarkdown(`${md}\n# Cape Orchid Society\n`), /duplicate/i);
assert.throws(() => parseContactListMarkdown('Affiliated Societies\n'), /table|entries|societies/i);
console.log('PASS parsers + merge + mapper match goldens (12 detailed, 21 contact-list, 21 merged, 4 warnings, 5 email conflicts)');
