// Offline checks for ics-folding. Usage: tsx check.mjs <case>. SAOC_ROOT overrides the repo root.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SAOC_ROOT ?? process.cwd();
const ics = await import(pathToFileURL(join(root, 'lib/ics.ts')).href);
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exit(1); };
const enc = new TextEncoder();
const strict = new TextDecoder('utf-8', { fatal: true });
const event = (over) => ({ slug: 'spring-show', title: 'Spring Show', start: '2027-12-01T08:00:00Z', ...over });
const physical = (text) => text.split('\r\n');
const unfold = (text) => text.replace(/\r\n[ \t]/g, '');

function assertFolded(out, label) {
  for (const line of physical(out)) {
    const bytes = enc.encode(line);
    if (bytes.length > 75) fail(`${label}: physical line of ${bytes.length} octets > 75: ${line.slice(0, 40)}...`);
    try { strict.decode(bytes); } catch { fail(`${label}: line is not valid UTF-8 (split mid-codepoint)`); }
  }
}

const cases = {
  'fold-ascii-75'() {
    const description = 'word '.repeat(80).trim();
    const out = ics.buildVEvent(event({ description }));
    assertFolded(out, 'ascii');
    if (!/\r\n [^\r\n]/.test(out)) fail('long line must be continued with CRLF + single space');
    if (!unfold(out).includes(`DESCRIPTION:${description}`)) fail('unfolding must restore the original DESCRIPTION line');
  },
  'fold-utf8-safe'() {
    const description = 'Orchidée café 🌸🌺 '.repeat(25).trim();
    const title = 'Ünïcödé '.repeat(20).trim();
    const out = ics.buildVEvent(event({ description, title, venue: 'Hôtel 🌺'.repeat(12) }));
    assertFolded(out, 'utf8');
    const flat = unfold(out);
    if (!flat.includes(`DESCRIPTION:${description}`)) fail('unfolded multibyte DESCRIPTION differs from the original');
    if (!flat.includes(`SUMMARY:${title}`)) fail('unfolded multibyte SUMMARY differs from the original');
  },
  'fold-calendar-wrapper'() {
    const out = ics.buildVCalendar([event({ description: 'x'.repeat(300) })]);
    assertFolded(out, 'calendar');
    if (!out.endsWith('END:VCALENDAR\r\n')) fail('calendar must still end with END:VCALENDAR + CRLF');
  },
  'escape-bare-cr'() {
    const out = ics.buildVEvent(event({ description: 'line one\rline two\r\nline three\nline four' }));
    if (/\r(?!\n)/.test(out)) fail('output contains a bare CR');
    const expected = 'DESCRIPTION:line one\\nline two\\nline three\\nline four';
    if (!unfold(out).includes(expected)) fail(`bare CR must escape to \\n; expected ${expected}`);
    if (ics.escapeIcsText('a\rb') !== 'a\\nb') fail(`escapeIcsText('a\\rb') = ${JSON.stringify(ics.escapeIcsText('a\rb'))}`);
  },
  'guard-short-lines-unchanged'() {
    const out = ics.buildVEvent(event({ description: 'Short; with, escapes', venue: 'The Hangar', location: 'Stellenbosch Flying Club' }));
    if (/\r\n /.test(out)) fail('lines of <= 75 octets must not be folded');
    for (const want of ['SUMMARY:Spring Show', 'DESCRIPTION:Short\\; with\\, escapes', 'LOCATION:The Hangar\\, Stellenbosch Flying Club']) {
      if (!out.includes(want)) fail(`missing ${want}`);
    }
  },
  'guard-allday-dtend'() {
    const out = ics.buildVEvent(event({ slug: 'nos', title: 'Show', start: '2027-09-23', end: '2027-09-26' }));
    for (const want of ['DTSTART;VALUE=DATE:20270923', 'DTEND;VALUE=DATE:20270927']) {
      if (!out.includes(want)) fail(`all-day range must contain ${want}`);
    }
    const sast = ics.buildVEvent(event({ start: '2027-09-22T22:00:00Z', end: '2027-09-25T22:00:00Z' }));
    if (!sast.includes('DTSTART;VALUE=DATE:20270923') || !sast.includes('DTEND;VALUE=DATE:20270927')) fail('SAST-midnight all-day range regressed');
  },
};

const name = process.argv[2];
if (!cases[name]) fail(`unknown case ${name}`);
await cases[name]();
console.log(`ok ${name}`);
