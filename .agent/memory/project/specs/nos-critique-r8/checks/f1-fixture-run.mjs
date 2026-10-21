// nos-critique-r8 f1 fixture runner (executed under the worktree's tsx by f1-fixture.mjs): StatusMarker props only.
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const require = createRequire(path.join(root, 'package.json'));
const React = require('react');
globalThis.React = React; // the repo tsconfig keeps jsx: preserve, so tsx falls back to the classic runtime
const { renderToStaticMarkup } = require('react-dom/server');
const { StatusMarker } = await import(path.join(root, 'components/show/_shared/StatusMarker.tsx'));
const { ConfirmationBadge } = await import(path.join(root, 'components/show/ConfirmationBadge.tsx'));

const r = (el) => renderToStaticMarkup(React.createElement('div', { id: 'root' }, el));
const base = { pendingLabel: 'FULL-PENDING-FIX', researchLabel: 'FULL-RESEARCH-FIX' };
const out = {
  confirmationPending: r(React.createElement(StatusMarker, { kind: 'confirmation', status: 'pending', shortOnNarrow: true, ...base })),
  exhibitorPending: r(React.createElement(StatusMarker, { kind: 'exhibitor', status: 'pending', shortOnNarrow: true, ...base })),
  unsetPending: r(React.createElement(StatusMarker, { kind: 'confirmation', status: undefined, shortOnNarrow: true, ...base })),
  viaBadge: r(React.createElement(ConfirmationBadge, { status: 'pending', shortOnNarrow: true, ...base })),
  research: r(React.createElement(StatusMarker, { kind: 'confirmation', status: 'research', shortOnNarrow: true, ...base })),
  optedOut: r(React.createElement(StatusMarker, { kind: 'confirmation', status: 'pending', ...base })),
  fallbackLabel: r(React.createElement(StatusMarker, { kind: 'confirmation', status: 'pending', shortOnNarrow: true })),
  confirmed: r(React.createElement(StatusMarker, { kind: 'confirmation', status: 'confirmed', shortOnNarrow: true, ...base })),
};
process.stdout.write(JSON.stringify(out));
