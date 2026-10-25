// F6(b) regression (Codex review): the sold-out verdict the hub shows must be computed from the
// ACTIVE show's ticket types only. A ticket type of another show that shares a capacity pool with an
// active-show type must not lower the pool's ceiling and make the active card read as sold out.
//   vip           -> show-A (active), pool "shared-pool", capacity 100, 2 sold   expected: not sold out
//   saoc-symposium-> show-B (wrong show), same pool, capacity 1                  expected: no card, no effect
// Run as: node --require ./contracts/checks/polish-wave-2-2026-10-25/_f6-stock-register.cjs --import tsx \
//           contracts/checks/polish-wave-2-2026-10-25/f6-stock-pool.mts
process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://polish-check.example';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.polish-check.example';

const POOL = 'shared-pool';
const ticketType = (slug: string, show: string, capacity: number) => ({
  _id: `ticketType-${slug}`,
  name: slug,
  slug,
  price: 500,
  capacity,
  releasedQuantity: null,
  capacityPool: POOL,
  headcountPerUnit: 1,
  category: 'admission',
  active: true,
  show: { _ref: show },
});

(globalThis as Record<string, unknown>).__f6Scenario = {
  shows: [
    { _id: 'show-A', active: true },
    { _id: 'show-B', active: false },
  ],
  ticketTypes: [ticketType('vip', 'show-A', 100), ticketType('saoc-symposium', 'show-B', 1)],
  sold: { vip: 2 },
};

const failures: string[] = [];
const mod = await import('../../../lib/data/admission-availability.ts').catch((e: unknown) => {
  console.error(`FAIL f6-stock-pool:\n - lib/data/admission-availability.ts cannot be imported: ${String(e).slice(0, 200)}`);
  process.exit(1);
});
const result = await (mod as { loadTicketCardViewModels: () => Promise<{ cards: Record<string, { state: string } | undefined>; stockKnown: boolean }> }).loadTicketCardViewModels();

if (!result.stockKnown) failures.push('stock was not read (stockKnown false): the harness did not serve the sold counts');
const vip = result.cards.vip;
if (!vip) failures.push('no vip card');
else if (vip.state === 'soldOut') failures.push(`vip reads soldOut: the wrong-show type's capacity of 1 lowered the shared pool's ceiling (capacity 100, 2 sold)`);
if (result.cards.symposium) failures.push('the wrong-show symposium card is listed');

if (failures.length) {
  console.error(`FAIL f6-stock-pool:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS f6-stock-pool');
