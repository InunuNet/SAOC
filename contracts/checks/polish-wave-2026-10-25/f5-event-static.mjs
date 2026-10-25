// F5 static: the event detail page renders ShowBand only for National Show events (title match via
// isNationalShowEvent), below the meta table, with the show identity from nationalShowQuery; the kind chip carries
// data-event-kind; the back link has min-h-11; nothing else about ShowBand is changed.
// Run as: node contracts/checks/polish-wave-2026-10-25/f5-event-static.mjs   (POLISH_ROOT optional)
import { finish, read, tags } from './_lib.mjs';

const failures = [];
const page = read('app/(marketing)/events/[slug]/page.tsx');
if (!/import \{ ShowBand \} from '@\/components\/home'/.test(page)) failures.push("page does not import { ShowBand } from '@/components/home'");
if (!/isNationalShowEvent\(event\)/.test(page)) failures.push('page does not gate the band on isNationalShowEvent(event)');
if (!/nationalShowQuery/.test(page)) failures.push('page does not fetch nationalShowQuery for the band');
const gate = page.indexOf('isNationalShowEvent(event)');
const band = page.indexOf('<ShowBand');
const dlEnd = page.indexOf('</dl>');
if (band < 0 || dlEnd < 0 || band < dlEnd) failures.push('<ShowBand is not after the closing </dl> of the meta table');
if (gate > -1 && band > -1 && gate > band) failures.push('the isNationalShowEvent gate does not precede <ShowBand');
if (/detailsHref=/.test(page)) failures.push('the band must not override detailsHref on its own event page (secondary CTA stays the NOS root)');
const back = tags(page, 'Link').find((t) => /href="\/events"/.test(t)) ?? '';
if (!/\bmin-h-11\b|\bmin-h-\[44px\]/.test(back)) failures.push('the "All events" back link has no min-h-11');
if (!/data-event-kind/.test(page)) failures.push('the kind chip has no data-event-kind attribute');
const bandSrc = read('components/home/ShowBand.tsx');
for (const need of ['Book tickets', 'Show details', "nosUrl('/tickets')", "nosUrl('/')"]) {
  if (!bandSrc.includes(need)) failures.push(`ShowBand lost ${need} (this feature must not edit the band)`);
}
finish('f5-event-static', failures);
