// nos-critique-r6 F7 — static source check for R33 (/national-show/plan-your-visit: tel links and the venue map button;
// lead saoc-2b 2026-10-17, NOS Design R34/R33 sign-off 2026-10-17).
//   S1  plan-your-visit/page.tsx: each emergency number is wrapped in an <a href={`tel:...`}> whose digits come from
//       `contact.number` (non-digits other than + stripped), min-h-[44px] target; the dd keeps its large serif numeral;
//       the page passes mapAction="button" to VenueCard.
//   S2  VenueCard.tsx: an optional `mapAction` prop; 'button' renders the existing nos Button, variant ghost (the outlined
//       "secondary"; Button has no variant named secondary and none is added), as={'a'} href={venue.mapsUrl}, label
//       "Open in a map ↗" verbatim; the default branch keeps the current link (min-h-[44px] ... underline) so /contact is unchanged.
//   S3  no copy change in plan-your-visit/page.tsx or VenueCard.tsx; Button.tsx variants unchanged.
//   S4  docs cite R33 and the sign-off line.
// Run as: node check-static-f7.mjs   (NOS_CR6_ROOT selects the worktree)
import { DOC, NS, copyStrings, finish, readBaseFile, readRepoFile, stripComments } from './_lib.mjs';

const NAME = 'check-static-f7.mjs';
const failures = [];
const fail = (m) => failures.push(m);
const PAGE = `${NS}/plan-your-visit/page.tsx`;
const CARD = 'components/show/VenueCard.tsx';

const page = stripComments(readRepoFile(PAGE) ?? '');
const dd = (page.match(/<dd[\s\S]*?<\/dd>/) ?? [''])[0];
if (!/<a[\s\S]*?href=\{`tel:\$\{[^}]*contact\.number[^}]*\}`\}/.test(dd)) fail('the emergency <dd> must wrap the number in <a href={`tel:${...contact.number...}`}> (S1)');
if (!/replace\(\/\[\^\\d\+\]\/g,\s*''\)/.test(dd)) fail("the tel: value must strip every character except digits and + (replace(/[^\\d+]/g, '')) (S1)");
if (!/min-h-\[44px\]/.test(dd)) fail('the tel link needs a min-h-[44px] target (S1)');
if (!/font-serif/.test(dd)) fail('the emergency numeral keeps its large serif size (S1)');
if (!/<VenueCard[\s\S]*?mapAction="button"/.test(page)) fail('plan-your-visit must pass mapAction="button" to VenueCard (S1)');
if (!/<aside\b[^>]*>\s*<VenueCard/.test(page)) fail('plan-your-visit must wrap the VenueCard in an <aside> beside Getting there (v4 golden venue-card aside; VenueCard itself stays a section so /contact is unchanged) (S1)');

const card = stripComments(readRepoFile(CARD) ?? '');
if (!/mapAction\??:\s*'link'\s*\|\s*'button'/.test(card)) fail("VenueCard must declare mapAction?: 'link' | 'button' (S2)");
if (!/import \{ Button \} from '@\/components\/nos\/Button'/.test(card)) fail('VenueCard must reuse the nos Button (S2)');
if (!/<Button[\s\S]*?variant="ghost"[\s\S]*?href=\{venue\.mapsUrl\}|<Button[\s\S]*?href=\{venue\.mapsUrl\}[\s\S]*?variant="ghost"/.test(card)) fail('the map button must be a ghost nos Button on venue.mapsUrl (S2)');
if ((card.match(/Open in a map ↗/g) ?? []).length < 2) fail('the label "Open in a map ↗" must stay verbatim in both the link and the button branch (S2)');
if (!/min-h-\[44px\] items-center font-sans text-\[12px\] tracking-\[0\.16em\] text-ink underline underline-offset-4/.test(card)) fail('the default (link) branch must keep its current classes so /contact is unchanged (S2)');

for (const rel of [PAGE, CARD]) {
  const b = readBaseFile(rel); const n = readRepoFile(rel);
  if (b !== null && n !== null && [...new Set(copyStrings(b))].sort().join('\n') !== [...new Set(copyStrings(n))].sort().join('\n')) fail(`${rel}: copy strings changed; R33 adds no copy (S3)`);
}
const variants = (s) => (s.match(/const VARIANT_CLASSES[\s\S]*?\n\};/) ?? [''])[0];
if (variants(readRepoFile('components/nos/Button.tsx') ?? '') !== variants(readBaseFile('components/nos/Button.tsx') ?? '')) fail('Button.tsx variants must be unchanged; no new variant (S3)');

const doc = readRepoFile(DOC) ?? '';
if (!/R33/.test(doc) || !/NOS Design R34\/R33 sign-off 2026-10-17/.test(doc)) fail(`${DOC} must cite R33 and "NOS Design R34/R33 sign-off 2026-10-17" (S4)`);

finish(NAME, failures, 'R33: emergency numbers are 44px tel: links with the large numerals, the venue map link becomes a ghost nos Button on plan-your-visit only, copy and Button variants unchanged, docs cite R33.');
