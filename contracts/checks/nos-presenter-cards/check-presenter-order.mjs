// nos-presenter-cards F1 — presenter ordering rule (golden §4). Functional: imports
// lib/view-models/presenter-order.ts and runs it.
//   - any non-null Sanity `order` wins (ascending; 0 is a real order, not "unset");
//   - null-order presenters follow, in the code-side fallback sequence
//     Wijaya, Crous, Tibbs, Fuchs (matched on Sanity doc name), then unknown names by name;
//   - the input array is never mutated;
//   - hasProvisionalOrder() is true while ANY presenter has a null order.
//
// Run as: node contracts/checks/nos-presenter-cards/check-presenter-order.mjs
import { finish, loadRepoModule } from './_lib.mjs';

const REL = 'lib/view-models/presenter-order.ts';
const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};
const p = (name, order) => ({ id: `id-${name}`, name, order });
const names = (list) => list.map((x) => x.name).join(' | ');

let mod;
try {
  mod = await loadRepoModule(REL);
} catch (error) {
  finish('check-presenter-order.mjs', [`cannot import ${REL}: ${error.message}`]);
}

const { orderPresenters, hasProvisionalOrder, PRESENTER_FALLBACK_SEQUENCE } = mod;
expect(typeof orderPresenters === 'function', `${REL} must export function orderPresenters`);
expect(typeof hasProvisionalOrder === 'function', `${REL} must export function hasProvisionalOrder`);
expect(
  Array.isArray(PRESENTER_FALLBACK_SEQUENCE) &&
    PRESENTER_FALLBACK_SEQUENCE.join('|') === 'Elbert Wijaya|Hildegard Crous|Michael Tibbs|Robert Fuchs',
  `PRESENTER_FALLBACK_SEQUENCE must be exactly [Elbert Wijaya, Hildegard Crous, Michael Tibbs, Robert Fuchs], got ${JSON.stringify(PRESENTER_FALLBACK_SEQUENCE)}`,
);

if (typeof orderPresenters === 'function' && typeof hasProvisionalOrder === 'function') {
  const cases = [
    {
      label: 'all null, shuffled',
      input: [p('Robert Fuchs', null), p('Michael Tibbs', null), p('Elbert Wijaya', null), p('Hildegard Crous', null)],
      want: 'Elbert Wijaya | Hildegard Crous | Michael Tibbs | Robert Fuchs',
      provisional: true,
    },
    {
      label: 'unknown names after the sequence, by name',
      input: [p('Zed Unknown', null), p('Robert Fuchs', null), p('Anna Unknown', null), p('Elbert Wijaya', null)],
      want: 'Elbert Wijaya | Robert Fuchs | Anna Unknown | Zed Unknown',
      provisional: true,
    },
    {
      label: 'non-null order wins over the fallback',
      input: [p('Elbert Wijaya', null), p('Michael Tibbs', 2), p('Hildegard Crous', null), p('Robert Fuchs', 1)],
      want: 'Robert Fuchs | Michael Tibbs | Elbert Wijaya | Hildegard Crous',
      provisional: true,
    },
    {
      label: 'all ordered, ascending',
      input: [p('Elbert Wijaya', 4), p('Hildegard Crous', 3), p('Michael Tibbs', 2), p('Robert Fuchs', 1)],
      want: 'Robert Fuchs | Michael Tibbs | Hildegard Crous | Elbert Wijaya',
      provisional: false,
    },
    {
      label: 'order 0 is a real order, not "unset"',
      input: [p('Elbert Wijaya', null), p('Robert Fuchs', 0)],
      want: 'Robert Fuchs | Elbert Wijaya',
      provisional: true,
    },
    {
      label: 'equal orders tie-break by name',
      input: [p('Robert Fuchs', 1), p('Elbert Wijaya', 1)],
      want: 'Elbert Wijaya | Robert Fuchs',
      provisional: false,
    },
    { label: 'empty', input: [], want: '', provisional: false },
  ];
  for (const c of cases) {
    const before = names(c.input);
    let got;
    try {
      got = orderPresenters(c.input);
    } catch (error) {
      failures.push(`orderPresenters threw on "${c.label}": ${error.message}`);
      continue;
    }
    expect(Array.isArray(got) && names(got) === c.want, `"${c.label}": want [${c.want}], got [${Array.isArray(got) ? names(got) : got}]`);
    expect(names(c.input) === before, `"${c.label}": orderPresenters mutated its input`);
    expect(hasProvisionalOrder(c.input) === c.provisional, `"${c.label}": hasProvisionalOrder want ${c.provisional}`);
  }
}

finish(
  'check-presenter-order.mjs',
  failures,
  'presenter order: non-null Sanity order wins; nulls follow Wijaya, Crous, Tibbs, Fuchs then by name; note flag tracks any null.',
);
