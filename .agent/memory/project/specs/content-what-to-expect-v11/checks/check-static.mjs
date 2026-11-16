// Static gate for content-what-to-expect-v11 (no build). Run from the repo root.
//  1. every golden string is a verbatim passage of Lee-Ann's v1.2 content.md, and no "absent" string is
//  2. every golden string is in the page source it belongs to; no old string remains in any of the three page files
//  3. the Day Pass admission row is wired (slug day-visitor, her name, after the Early-Bird Exhibition row)
//  4. no price literal (R followed by digits) in the code of the three page files or in the goldens
import { readFileSync } from 'node:fs';

const SPEC = '.agent/memory/project/specs/content-what-to-expect-v11';
const G = JSON.parse(readFileSync(`${SPEC}/goldens/strings.json`, 'utf8'));
const norm = (t) => t.replace(/[\s ]+/g, ' ').trim();
const unmd = (t) => norm(t.replace(/\*\*\*|\*\*|\*/g, '').replace(/\\([.\-_*#>()[\]!])/g, '$1'));
const unescapeJs = (t) => t.replace(/\\(['"`])/g, '$1');
const source = unmd(readFileSync(G.source, 'utf8'));
const files = { wte: G.wte.file, home: G.home.file, programme: G.programme.file };
const code = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, norm(unescapeJs(readFileSync(f, 'utf8')))]));
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`); };

const wte = G.wte; const home = G.home; const prog = G.programme;
const texts = [
  ...wte.paragraphs.map((p) => ['wte', p.id, p.text]),
  ...home.paragraphs.map((p) => ['home', p.id, p.text]),
  ...wte.hours_rows.map((r) => ['wte', `hours ${r.line}`, r.line]),
  ...prog.thursday_hours_spans_in_order.map((s) => ['programme', `thursday ${s.text}`, s.text]),
];
for (const [, id, text] of texts) check(`golden ${id} is a verbatim passage of v1.2`, source.includes(norm(text)));
for (const a of G.absent_everywhere) check(`v1.2 does not contain "${a}" (golden sanity)`, !source.toLowerCase().includes(a.toLowerCase()));

// 2. page source carries each string (the theme sentence is composed from two constants: lead + quoted theme)
const splitTheme = (t) => { const i = t.indexOf('theme - '); return [t.slice(0, i + 'theme - '.length), t.slice(i + 'theme - '.length)]; };
for (const p of wte.paragraphs) {
  const parts = p.id.includes('THEME') ? splitTheme(p.text) : [p.text];
  for (const part of parts) check(`wte source has ${p.id}${parts.length > 1 ? ' (part)' : ''}`, code.wte.includes(norm(part)));
}
for (const p of home.paragraphs) check(`home source has ${p.id}`, code.home.includes(norm(p.text)));
check('wte source has the VIP hours line', code.wte.includes(norm(wte.hours_rows[0].line)));
check('wte source has the Sunset words (label and time)', wte.hours_rows[1].parts.every((x) => code.wte.includes(x)));
check('wte source keeps Friday & Saturday and Sunday lines', code.wte.includes(wte.hours_rows[2].line) && code.wte.includes(wte.hours_rows[3].line));
check('home source has 16.00 to 18.00 and the Sunset words (label and time)', code.home.includes('16.00 to 18.00') && home.hours_rows[1].parts.every((x) => code.home.includes(x)));
for (const s of prog.thursday_hours_spans_in_order) check(`programme source has "${s.text}"`, code.programme.includes(s.text));
for (const [k, c] of Object.entries(code)) for (const a of G.absent_everywhere) check(`${k} source no longer contains "${a}"`, !c.toLowerCase().includes(a.toLowerCase()));

// 3. Day Pass admission row, after the Early-Bird Exhibition row
const row = wte.day_pass_row;
const iEarly = code.wte.indexOf("slug: 'early-bird'"); const iDay = code.wte.indexOf(`slug: '${row.slug}'`);
check(`wte ADMISSION_ROWS has ${row.id} with slug ${row.slug} and name "${row.name}"`, code.wte.includes(`id: '${row.id}'`) && iDay > -1 && code.wte.includes(`name: '${row.name}'`));
check('Day Pass row comes after the Early-Bird Exhibition row (her order)', iEarly > -1 && iDay > iEarly);
check('Day Pass row was not given a hand-typed price (price still comes from the ticket card)', !/day-visitor[^}]*price\s*:/.test(code.wte));

// 4. no price literal in code (comments stripped) or goldens
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
const PRICE = /(?<![A-Za-z0-9_])R\s?\d{2,}/;
for (const [k, f] of Object.entries(files)) check(`${k} code carries no price literal (${f})`, !PRICE.test(stripComments(readFileSync(f, 'utf8'))));
check('goldens carry no price literal', !PRICE.test(readFileSync(`${SPEC}/goldens/strings.json`, 'utf8')));

if (failures.length) { console.error(`check-static FAILED (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`check-static pass (${texts.length} golden strings)`);
