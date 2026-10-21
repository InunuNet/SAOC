// nos-critique-r9 fixture runner (executed under the worktree's tsx by f2-fixture.mjs and f4-fixture.mjs): props only, no CMS or env.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const React = require('react');
globalThis.React = React; // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { renderToStaticMarkup } = require('react-dom/server');
const { StatusMarker } = await import(path.join(root, 'components/show/_shared/StatusMarker.tsx'));
const { ShowStatusLine } = await import(path.join(root, 'components/show/ShowStatusLine.tsx'));
const { VisitGettingThere, VisitAttractions, VisitEmergency } = await import(path.join(root, 'components/show/VisitDisclosure.tsx'));

const h = React.createElement;
const r = (el) => renderToStaticMarkup(h('div', { id: 'root' }, el));
const fix = { pendingLabel: 'PENDING-FIX', researchLabel: 'RESEARCH-FIX' };
const items = [{ heading: 'Parking', body: 'PARKING-BODY', status: 'research' }, { heading: 'Public transport', body: 'TRANSPORT-BODY', status: 'research' }];
const attractions = [{ _key: 'a', name: 'ATTRACTION-ONE', note: 'N1' }, { _key: 'b', name: 'ATTRACTION-TWO' }];
const DIAL = [{ _key: 'p', label: 'Police (national)', number: '10111' }];
const ONSITE = { _key: 'o', label: 'ONSITE-LABEL-FROM-CMS', number: 'ONSITE-VALUE-FROM-CMS', note: 'FOOT-FROM-CMS' };
const em = (contacts, status) => r(h(VisitEmergency, { title: 'EMERGENCY-TITLE', label: 'LABEL-FROM-PAGE', contacts, status, ...fix }));
const out = {
  markerResearchShort: r(h(StatusMarker, { kind: 'confirmation', status: 'research', shortResearch: true, ...fix })),
  markerResearchShortExhibitor: r(h(StatusMarker, { kind: 'exhibitor', status: 'research', shortResearch: true, ...fix })),
  markerResearchPlain: r(h(StatusMarker, { kind: 'confirmation', status: 'research', ...fix })),
  markerPendingShort: r(h(StatusMarker, { kind: 'confirmation', status: 'pending', shortOnNarrow: true, shortResearch: true, ...fix })),
  markerExhibitorPendingShort: r(h(StatusMarker, { kind: 'exhibitor', status: 'pending', shortOnNarrow: true, ...fix })),
  markerExhibitorPendingPlain: r(h(StatusMarker, { kind: 'exhibitor', status: 'pending', ...fix })),
  lineResearchItems: r(h(ShowStatusLine, { kind: 'confirmation', status: 'research', items: ['A', 'B'], ...fix })),
  lineResearchNoLabel: r(h(ShowStatusLine, { kind: 'confirmation', status: 'research', items: ['A', 'B'], pendingLabel: 'PENDING-FIX' })),
  lineResearchBare: r(h(ShowStatusLine, { kind: 'confirmation', status: 'research', ...fix })),
  linePendingItems: r(h(ShowStatusLine, { kind: 'confirmation', status: 'pending', items: ['A', 'B'], ...fix })),
  gtResearch: r(h(VisitGettingThere, { items, ...fix })),
  gtPending: r(h(VisitGettingThere, { items: items.map((i) => ({ ...i, status: 'pending' })), ...fix })),
  gtMixed: r(h(VisitGettingThere, { items: [{ ...items[0], status: 'pending' }, items[1]], ...fix })),
  attrResearch: r(h(VisitAttractions, { title: 'WHILE', attractions, status: 'research', ...fix })),
  attrPending: r(h(VisitAttractions, { title: 'WHILE', attractions, status: 'pending', ...fix })),
  emResearch: em([...DIAL, ONSITE], 'research'),
  emPending: em([...DIAL, ONSITE], 'pending'),
  // F4: the component owns the label filter
  emUnlabelled: em([null, undefined, { _key: 'x', label: '', number: '999' }, { _key: 'y', number: '998' }, { _key: 'z', label: null, number: '997' }, ...DIAL, ONSITE], 'pending'),
  emAllUnlabelled: em([null, { _key: 'x', label: '', number: '999' }, { _key: 'y', number: '998' }], 'pending'),
  emEmpty: em([], 'pending'),
};
process.stdout.write(JSON.stringify(out));
