// nos-critique-r8 f4 fixture runner (executed under the worktree's tsx by f4-fixture.mjs): props only, no CMS or env.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const React = require('react');
globalThis.React = React; // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { renderToStaticMarkup } = require('react-dom/server');
const { VisitAttractions } = await import(path.join(root, 'components/show/VisitDisclosure.tsx'));
const { TravelRoutes } = await import(path.join(root, 'components/show/TravelRoutes.tsx'));

// Keys chosen to break a naive `_key ?? index` id: duplicates, a key equal to another item's index, whitespace, quotes and markup characters, a missing key.
const ATTR = [
  { _key: 'dup', name: 'One', note: 'n1', url: 'https://example.org/1' },
  { _key: 'dup', name: 'Two', note: 'n2', url: 'https://example.org/2' },
  { _key: '1', name: 'Three', url: 'https://example.org/3' },
  { name: 'Four', url: 'https://example.org/4' },
  { _key: ' a b\n', name: 'Five', url: 'https://example.org/5' },
  { _key: 'x/y"z<q>', name: 'Six', url: 'https://example.org/6' },
  { _key: '', name: 'Seven', url: 'https://example.org/7' },
];
const attr = (status) => renderToStaticMarkup(React.createElement('div', { id: 'root' }, React.createElement(VisitAttractions, { title: 'ATTR-TITLE', attractions: ATTR, status, pendingLabel: 'P', researchLabel: 'R' })));
const ROUTES = [
  { _key: 'r1', origin: 'Origin A', distance: '10 km', duration: '10 min', directions: 'Go.', transportOptions: ['Taxi'] },
  { _key: 'r2', origin: 'Origin B' },
];
const travel = renderToStaticMarkup(React.createElement('div', { id: 'root' }, React.createElement('h2', null, 'H2-ABOVE'), React.createElement(TravelRoutes, { routes: ROUTES })));
process.stdout.write(JSON.stringify({ attrPending: attr('pending'), attrConfirmed: attr('confirmed'), travel }));
