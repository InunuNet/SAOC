// A6 -- the /national-show page passes resolveActiveShow(...) into buildShowOffers, and that buildShowOffers is the one
// imported from '@/lib/data/national-show-offers': no local function/const/let/var of that name, and no import of the name
// from anywhere else. Comments are stripped before matching, so a commented-out copy cannot satisfy any of it. Usage: node check-page-call-site.mjs [page-path]
import { readFileSync } from 'node:fs';

const PAGE = process.argv[2] ?? 'app/(nos)/national-show/page.tsx';
const CALL = /\bbuildShowOffers\(\s*hubTicketTypes\s*,\s*new Date\(\)\s*,\s*resolveActiveShow\(\s*shows\s*\?\?\s*\[\]\s*\)\s*\)/;
// Block comments first, then line comments (a `//` after `:` is a URL scheme and is kept).
const code = readFileSync(PAGE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const failures = [];
if (!CALL.test(code)) failures.push('no live buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? [])) call');
if (/\b(?:function|const|let|var)\s+buildShowOffers\b/.test(code)) failures.push('a local buildShowOffers declaration shadows the shared module');
const imports = [...code.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)].filter((m) => /\bbuildShowOffers\b/.test(m[1]));
const SHARED = '@/lib/data/national-show-offers';
if (!imports.some((m) => m[2] === SHARED && !/\btype\s+buildShowOffers\b/.test(m[1]) && !/\bbuildShowOffers\s+as\b/.test(m[1]))) failures.push(`buildShowOffers is not imported by name from '${SHARED}'`);
if (imports.some((m) => m[2] !== SHARED)) failures.push(`buildShowOffers is also imported from ${imports.filter((m) => m[2] !== SHARED).map((m) => m[2]).join(', ')}`);
if (failures.length) { for (const f of failures) console.error(`FAIL A6 ${PAGE}: ${f}`); process.exit(1); }
console.log('PASS A6 page imports the shared buildShowOffers and calls it with resolveActiveShow');
