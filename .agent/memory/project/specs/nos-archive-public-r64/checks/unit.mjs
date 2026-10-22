// nos-archive-public-r64 unit: the pure half of the "records exist" predicate and the nav filter, run with `pnpm exec tsx`. QA input, hash-locked.
// lib/data/past-shows.ts must stay pure (no next/*, no sanity client): this script imports it directly. The live Sanity dataset has no past show
// at all today, so the "records exist" branch cannot be exercised by the rendered check; these fixtures are what prove it.
import { finish, repoRoot } from './_lib.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const failures = [];
const load = (rel) => import(pathToFileURL(path.join(repoRoot, rel)).href);
const ps = await load('lib/data/past-shows.ts');
const { NAV } = await load('components/chrome/nav-config.ts');
const href = ps.PAST_SHOWS_HREF;
if (href !== '/national-show/archive') failures.push(`PAST_SHOWS_HREF is ${href}`);
if (typeof ps.hasPastShowRecords !== 'function' || typeof ps.navWithoutHref !== 'function') failures.push('hasPastShowRecords and navWithoutHref must be exported');
else {
  const has = ps.hasPastShowRecords;
  const cases = [
    ['null', null, false],
    ['empty', [], false],
    ['the live shape today: upcoming 2027 + a cancelled test show with no year', [{ _id: 'a', title: 'National Show 19 (2027)', year: 2027, status: 'upcoming', location: 'The Hangar' }, { _id: 'b', title: 'Fictional', year: null, status: 'cancelled', location: null }], false],
    ['a past show with only a year and a title', [{ _id: 'c', title: 'Show 2024', year: 2024, status: 'past' }], false],
    ['a past show whose numbers are 0', [{ _id: 'd', year: 2024, status: 'past', entries: 0, exhibitors: 0, awards: 0, location: '' }], false],
    ['a past show with a venue', [{ _id: 'e', year: 2024, status: 'past', location: 'A venue' }], true],
    ['a past show with entries', [{ _id: 'f', year: 2021, status: 'past', entries: 120 }], true],
    ['one empty past show and one with exhibitors', [{ _id: 'g', year: 2018, status: 'past' }, { _id: 'h', year: 2021, status: 'past', exhibitors: 40 }], true],
    ['an upcoming show with a venue and entries', [{ _id: 'i', year: 2027, status: 'upcoming', location: 'X', entries: 5 }], false],
  ];
  for (const [name, input, want] of cases) if (has(input) !== want) failures.push(`hasPastShowRecords(${name}) is ${has(input)}, needs ${want}`);

  const before = JSON.stringify(NAV);
  const leaves = (n) => { const out = []; (function walk(x) { if (!x || typeof x !== 'object') return; if (typeof x.href === 'string' && typeof x.label === 'string') out.push(x.href); for (const v of Object.values(x)) walk(v); })(n); return out; };
  const trimmed = ps.navWithoutHref(NAV, href);
  if (JSON.stringify(NAV) !== before) failures.push('navWithoutHref mutated NAV');
  const had = leaves(NAV).filter((h) => h === href).length;
  if (had < 1) failures.push('INFRA: nav-config no longer carries the archive leaf');
  if (leaves(trimmed).includes(href)) failures.push('navWithoutHref left the archive leaf in the result');
  if (JSON.stringify(trimmed).includes(href)) failures.push('navWithoutHref left the archive href somewhere in the result (a descriptor, a rail destination, a lead)');
  if (leaves(trimmed).length !== leaves(NAV).length - had) failures.push(`navWithoutHref removed ${leaves(NAV).length - leaves(trimmed).length} leaves, needs exactly ${had}`);
  const other = ps.navWithoutHref(NAV, '/not-a-route');
  if (JSON.stringify(other) !== before) failures.push('navWithoutHref with an absent href must return an equal nav');
  const mega = (nav) => nav.find((i) => i.type === 'mega');
  if (!mega(trimmed) || mega(trimmed).lead.theShow.links.length !== mega(NAV).lead.theShow.links.length - 1) failures.push('the National Show "The show" column must lose exactly the one link');
}
finish('unit.mjs', failures, 'hasPastShowRecords (9 fixtures) and navWithoutHref hold.');
