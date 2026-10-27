// F6(b) behaviour: buildHubCards keeps only ticket types whose `show` is the active show, the same rule as the
// shared on-sale predicate (ticketTypeMatchesActiveShow), so the tickets hub and the National Show JSON-LD offers
// can never list a ticket that /tickets/<slug> and checkout refuse as wrong-show.
// Fixtures use real product slugs (lib/data/ticket-card-view-models.ts SINGLE_SLUG_PRODUCTS):
//   vip + sunset-cocktails-single -> show-A (the active show)      expected: cards
//   saoc-symposium                -> show-B (another show)         expected: no card
//   wosa-conference               -> no `show` at all              expected: no card (as the predicate does)
// `workshops` is the hub's own synthetic product, not a CMS type, and is unaffected.
// Run as: pnpm exec tsx contracts/checks/polish-wave-2-2026-10-25/f6-hub-filter.mts   (POLISH_ROOT optional)
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://polish-check.example';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.polish-check.example';

const root = process.env.POLISH_ROOT ? resolve(process.env.POLISH_ROOT) : resolve(import.meta.dirname, '../../..');
const modPath = resolve(root, 'lib/data/ticket-hub-source.ts');
if (!existsSync(modPath)) {
  console.error('FAIL f6-hub-filter:\n - lib/data/ticket-hub-source.ts does not exist');
  process.exit(1);
}
const mod = (await import(pathToFileURL(modPath).href)) as {
  buildHubCards: (input: Record<string, unknown>) => { cards: Record<string, unknown> };
};

const type = (slug: string, show: string | null) => ({
  name: slug,
  slug,
  price: 500,
  capacity: 100,
  releasedQuantity: null,
  capacityPool: null,
  headcountPerUnit: 1,
  ...(show ? { show: { _ref: show } } : {}),
});
const cmsTypes = [
  type('vip', 'show-A'),
  type('sunset-cocktails-single', 'show-A'),
  type('saoc-symposium', 'show-B'),
  type('wosa-conference', null),
];
const base = { cmsTypes, salesOpen: true, soldByType: {}, soldByDay: null, stockKnown: true, now: new Date('2026-10-25T10:00:00Z'), showDays: [] };

const failures: string[] = [];
const keys = (input: Record<string, unknown>) => Object.keys(mod.buildHubCards(input).cards).sort().join(',');

const active = keys({ ...base, activeShowId: 'show-A' });
if (active !== 'sunset,vip,workshops') failures.push(`activeShowId show-A gave cards [${active}], want [sunset,vip,workshops]`);
const other = keys({ ...base, activeShowId: 'show-B' });
if (other !== 'symposium,workshops') failures.push(`activeShowId show-B gave cards [${other}], want [symposium,workshops]`);
const none = keys({ ...base, activeShowId: null });
if (none !== 'workshops') failures.push(`activeShowId null gave cards [${none}], want [workshops] (no active show lists no CMS ticket)`);

if (failures.length) {
  console.error(`FAIL f6-hub-filter:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS f6-hub-filter');
