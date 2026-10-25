/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS require hook for offline checks */
// Offline harness for f6-stock-pool.mts. Preload with
//   node --require <this file> --import tsx contracts/checks/polish-wave-2-2026-10-25/f6-stock-pool.mts
// It loads the ticket-onsale-predicate harness (no live Sanity, Firestore or gateway), then points the
// Sanity client and the sold-count reader at the two stubs below, which serve the scenario the check
// puts in globalThis.__f6Scenario.
const Module = require('node:module');
const path = require('node:path');

require('../ticket-onsale-predicate/_mocks/register.cjs');

const STUBS = [
  [/[\\/]sanity[\\/]lib[\\/]client(\.ts)?$/, 'f6-stock-stub-sanity.cjs'],
  [/[\\/]lib[\\/]data[\\/]tickets(\.ts)?$/, 'f6-stock-stub-tickets.cjs'],
];

const previous = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const candidate =
    request.startsWith('.') && parent && parent.filename
      ? path.resolve(path.dirname(parent.filename), request)
      : request;
  for (const [pattern, stub] of STUBS) {
    if (pattern.test(candidate)) return path.join(__dirname, stub);
  }
  return previous.call(this, request, parent, ...rest);
};
