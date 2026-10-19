// F30-A5 - VendorGrid renders the new bio field with the same markup idiom and prints nothing for an absent one.
// Run from the repo root: pnpm exec tsx contracts/checks/launch-weekend/f30/check-e-render.mts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VendorGrid } from '../../../../components/vendors/VendorGrid.tsx';
import { makeChecker } from './_lib.mts';

const { ok, finish } = makeChecker('F30-A5 render');
const base = { logo: null, country: null, owner: null, history: null, specialisation: null, plantsBrought: null, website: null, socialMedia: null, availableAtShow: null };
const html = renderToStaticMarkup(
  createElement(VendorGrid, {
    nurseries: [
      { ...base, _id: 'a', name: 'FIXTURE-Nursery-A', bio: 'FIXTURE-bio-text-A' },
      { ...base, _id: 'b', name: 'FIXTURE-Nursery-B', bio: null },
    ] as never,
  }),
);
ok('bio text rendered', html.includes('FIXTURE-bio-text-A'));
ok('both names rendered', html.includes('FIXTURE-Nursery-A') && html.includes('FIXTURE-Nursery-B'));
ok('bio uses the neighbouring paragraph idiom', /<p class="mt-2 font-sans[^"]*">FIXTURE-bio-text-A<\/p>/.test(html));
ok('absent bio prints no null/undefined', !/>(null|undefined)</.test(html) && !html.includes('undefined'));
finish();
