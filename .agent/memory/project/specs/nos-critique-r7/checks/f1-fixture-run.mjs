// nos-critique-r7 f1 fixture runner (executed under the worktree's tsx by f1-fixture.mjs). Renders VisitGettingThere with props, no env or CMS involved,
// so the status split is exercised without any test hook in production code. Prints {case: html} as JSON.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const comp = path.resolve(process.argv[3]);
const require = createRequire(path.join(root, 'package.json'));
const React = require('react');
globalThis.React = React; // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { renderToStaticMarkup } = require('react-dom/server');
const { VisitGettingThere, VisitAttractions } = await import(comp);

const item = (heading, status) => ({ heading, body: `${heading} body from the CMS`, status });
const set = (a, b, c) => [item('Parking', a), item('Public transport', b), item('Where to stay', c)];
const CASES = {
  allConfirmed: set('confirmed', 'confirmed', 'confirmed'),
  mixed: set('confirmed', 'pending', 'research'),
  allPending: set('pending', 'pending', 'pending'),
  allResearch: set('research', 'research', 'research'),
  confirmedAndResearch: set('confirmed', 'research', 'confirmed'),
  unsetStatus: set(undefined, null, undefined),
};
const out = {};
for (const [name, items] of Object.entries(CASES)) {
  out[name] = renderToStaticMarkup(React.createElement('div', { id: 'root' }, React.createElement(VisitGettingThere, { items, pendingLabel: 'PENDING-FIX', researchLabel: 'RESEARCH-FIX' })));
}
const ATTR = [{ name: 'Alpha Garden', note: 'Alpha note from the CMS', url: 'https://example.org/alpha' }, { name: 'Beta Winery', note: 'Beta note from the CMS' }];
const attr = (items, status) => renderToStaticMarkup(React.createElement('div', { id: 'root' }, React.createElement(VisitAttractions, { title: 'ATTR-TITLE', attractions: items, status, pendingLabel: 'PENDING-FIX', researchLabel: 'RESEARCH-FIX' })));
out.attrConfirmed = attr(ATTR, 'confirmed');
out.attrPending = attr(ATTR, 'pending');
out.attrResearch = attr(ATTR, 'research');
out.attrUnset = attr(ATTR, undefined);
out.attrEmpty = attr([], 'pending');
process.stdout.write(JSON.stringify(out));
