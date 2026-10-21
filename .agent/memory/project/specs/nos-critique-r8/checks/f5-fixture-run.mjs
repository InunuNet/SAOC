// nos-critique-r8 f5 fixture runner (executed under the worktree's tsx by f5-fixture.mjs): props only, no CMS or env.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const comp = path.resolve(process.argv[3]);
const require = createRequire(path.join(root, 'package.json'));
const React = require('react');
globalThis.React = React; // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { renderToStaticMarkup } = require('react-dom/server');
const { VisitEmergency } = await import(comp);

const DIAL = [
  { _key: 'p', label: 'Police (national)', number: '10111' },
  { _key: 'a', label: 'Ambulance and fire (national)', number: '10177' },
  { _key: 'm', label: 'All emergencies, from a mobile phone', number: '112', note: 'MOBILE-NOTE-FROM-CMS' },
];
const ONSITE = { _key: 'o', label: 'ONSITE-LABEL-FROM-CMS', number: 'ONSITE-VALUE-FROM-CMS', note: 'FOOT-FROM-CMS' };
const render = (contacts, status) => renderToStaticMarkup(React.createElement('div', { id: 'root' }, React.createElement(VisitEmergency, {
  title: 'EMERGENCY-TITLE', label: 'Emergency contacts, to be confirmed by the show committee', contacts, status, pendingLabel: 'PENDING-FIX', researchLabel: 'RESEARCH-FIX',
})));
const out = {
  pending: render([...DIAL, ONSITE], 'pending'),
  research: render([...DIAL, ONSITE], 'research'),
  unset: render([...DIAL, ONSITE], undefined),
  confirmed: render([...DIAL, ONSITE], 'confirmed'),
  onsiteFirst: render([ONSITE, ...DIAL], 'pending'),
  dialOnlyPending: render(DIAL, 'pending'),
  empty: render([], 'pending'),
};
process.stdout.write(JSON.stringify(out));
