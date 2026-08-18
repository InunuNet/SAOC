/* eslint-disable @typescript-eslint/no-require-imports -- CJS stub loaded via require() by design */
// Offline stand-in for next/image, wired in by check-grid-renders-fixture-data.mjs's
// resolver patch. Outside a running Next server, the real component throws on any
// remote src ("hostname not configured") because next.config.ts is never loaded —
// loader mechanics are Next's concern, not this contract's. The stub preserves what
// A2 actually asserts: the resolved src URL, alt text, and className reach the DOM.
const React = require('react');

function NextImageStub(props) {
  const { src, alt, width, height, className } = props;
  const resolved = typeof src === 'string' ? src : (src && src.src) || '';
  return React.createElement('img', { src: resolved, alt: alt ?? '', width, height, className });
}

module.exports = { __esModule: true, default: NextImageStub };
