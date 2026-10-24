// nav-focus-underline -- lib/nav-current.ts against goldens/aria-current-fixtures.json. Run: npx tsx <this file>
import { readFileSync } from 'node:fs';
import { isNavCurrent, navAriaCurrent, anyNavCurrent } from '../../../../../../lib/nav-current.ts';
import { NAV, CONTACT_LINK } from '../../../../../../components/chrome/nav-config.ts';
import { NOS_NAV } from '../../../../../../components/nos-chrome/nos-nav.ts';
import { NOS_CONTACT_PATH, NOS_INTERNAL_PREFIX } from '../../../../../../lib/nos-paths.ts';

const fixtures = JSON.parse(readFileSync(new URL('../goldens/aria-current-fixtures.json', import.meta.url), 'utf8'));
const failures = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const sorted = (xs) => [...xs].sort();

// Pure matcher.
for (const row of fixtures.matcher) {
  eq(`isNavCurrent(${JSON.stringify(row.pathname)}, ${JSON.stringify(row.href)})`, isNavCurrent(row.pathname, row.href), row.expected);
}

// navAriaCurrent maps true to 'page' and false to undefined (the attribute is omitted, never "false"); crossSite is never current.
eq("navAriaCurrent current => 'page'", navAriaCurrent('/about', '/about'), 'page');
eq('navAriaCurrent not current => undefined', navAriaCurrent('/events', '/about'), undefined);
eq('navAriaCurrent crossSite => undefined', navAriaCurrent('/', '/', { crossSite: true }), undefined);
eq('anyNavCurrent true', anyNavCurrent('/vendors/apply', ['/national-show/faq', '/national-show/vendors']), true);
eq('anyNavCurrent false', anyNavCurrent('/privacy', ['/national-show/faq']), false);
eq('anyNavCurrent empty', anyNavCurrent('/faq', []), false);

// SAOC: the real nav data.
const saocItems = [...NAV, { ...CONTACT_LINK, type: 'link' }].filter((n) => !n.disabled);
for (const { pathname, current } of fixtures.saoc.routes) {
  const got = saocItems.filter((n) => navAriaCurrent(pathname, n.href, { crossSite: n.crossSite }) === 'page').map((n) => n.id);
  eq(`saoc ${pathname}`, sorted(got), sorted(current));
}

// NOS: the real nav data. Leaves = lead links + column links + hub + contact; groups = columns.
const mega = NOS_NAV.find((n) => n.type === 'mega');
const nosLeaves = [
  { id: 'hub', href: NOS_INTERNAL_PREFIX },
  ...mega.lead.theShow.links,
  ...mega.columns.flatMap((c) => c.links),
  { id: 'contact', href: NOS_CONTACT_PATH },
];
for (const { pathname, leaves, groups } of fixtures.nos.routes) {
  const gotLeaves = nosLeaves.filter((l) => navAriaCurrent(pathname, l.href) === 'page').map((l) => l.id);
  const gotGroups = mega.columns.filter((c) => anyNavCurrent(pathname, c.links.map((l) => l.href))).map((c) => c.id);
  eq(`nos leaves ${pathname}`, sorted(gotLeaves), sorted(leaves));
  eq(`nos groups ${pathname}`, sorted(gotGroups), sorted(groups));
}

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log(`nav-current checks pass (${fixtures.matcher.length} matcher rows, ${fixtures.saoc.routes.length} saoc routes, ${fixtures.nos.routes.length} nos routes)`);
