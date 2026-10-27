// A6 -- the /national-show page passes resolveActiveShow(...) into buildShowOffers. Comments are stripped before
// matching, so a commented-out copy of the call cannot satisfy it. Usage: node check-page-call-site.mjs [page-path]
import { readFileSync } from 'node:fs';

const PAGE = process.argv[2] ?? 'app/(nos)/national-show/page.tsx';
const CALL = /\bbuildShowOffers\(\s*hubTicketTypes\s*,\s*new Date\(\)\s*,\s*resolveActiveShow\(\s*shows\s*\?\?\s*\[\]\s*\)\s*\)/;
// Block comments first, then line comments (a `//` after `:` is a URL scheme and is kept).
const code = readFileSync(PAGE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
if (!CALL.test(code)) { console.error(`FAIL A6 ${PAGE} has no live buildShowOffers(hubTicketTypes, new Date(), resolveActiveShow(shows ?? [])) call`); process.exit(1); }
console.log('PASS A6 page call site passes resolveActiveShow');
