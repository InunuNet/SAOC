// F3 price teaser: the hub's "{title} from R{min}" may advertise only a price checkout would accept now
// (lib/checkout-reservation.ts resolveEffectivePrice). Pure unit check, no server.
//   (a) expired early bird WITH a standard price -> the standard price is shown
//   (b) expired early bird with NO standard price -> that product is excluded
//   (c) nothing priceable -> no teaser (null)
import { cheapestAdmission } from '../../../../components/nos/cheapest-admission.ts';

const NOW = new Date('2026-10-16T00:00:00Z');
const PAST = '2026-01-01';
const FUTURE = '2099-01-01';
const failures = [];
const expect = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) failures.push(name);
};
const view = (r) => (r ? { name: r.type.name, price: r.price } : null);

expect(
  '(a) expired early bird with a standard price shows the standard price',
  view(cheapestAdmission([{ name: 'Early Bird', price: 80, regularPrice: 120, earlyBirdCutoff: PAST }], NOW)),
  { name: 'Early Bird', price: 120 }
);
expect(
  '(a2) expired early bird never undercuts a live product',
  view(
    cheapestAdmission(
      [
        { name: 'Early Bird', price: 80, regularPrice: 120, earlyBirdCutoff: PAST },
        { name: 'Day', price: 100 },
      ],
      NOW
    )
  ),
  { name: 'Day', price: 100 }
);
expect(
  '(b) expired early bird with a null standard price is excluded',
  view(
    cheapestAdmission(
      [
        { name: 'Early Bird', price: 44, regularPrice: null, earlyBirdCutoff: PAST },
        { name: 'Day', price: 150 },
      ],
      NOW
    )
  ),
  { name: 'Day', price: 150 }
);
expect(
  '(b2) open early-bird window still advertises the early-bird price',
  view(cheapestAdmission([{ name: 'Early Bird', price: 80, regularPrice: 120, earlyBirdCutoff: FUTURE }], NOW)),
  { name: 'Early Bird', price: 80 }
);
expect(
  '(c) nothing priceable renders no teaser',
  cheapestAdmission([{ name: 'Early Bird', price: 44, regularPrice: null, earlyBirdCutoff: PAST }], NOW),
  null
);
expect('(c2) empty list renders no teaser', cheapestAdmission([], NOW), null);

if (failures.length) {
  console.error(`FAIL F3 cheapest-admission: ${failures.length} case(s)`);
  process.exit(1);
}
console.log('PASS F3 cheapest-admission');
