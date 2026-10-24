// Offline harness for the ticket-onsale-predicate checks. Preload with
//   node --require <this file> --import tsx <check>
// The repo's .ts files are CommonJS (package.json has no "type"), so tsx loads them through
// require() and module-loader hooks never see their imports. Patching Module._resolveFilename
// does. tsx maps the "@/" alias to an absolute path before delegating to us, so a stub is picked
// by package specifier OR by the resolved file path. It swaps the network-touching modules for
// the stubs beside this file; no live Sanity, Firestore or gateway call is possible under it.
const Module = require('node:module');
const path = require('node:path');

const BY_SPECIFIER = {
  'firebase-admin/firestore': 'stub-firestore.cjs',
  'firebase-admin/auth': 'stub-firestore.cjs',
  'firebase-admin/app': 'stub-firestore.cjs',
};
const BY_PATH_SUFFIX = [
  [/[\\/]sanity[\\/]lib[\\/]client(\.ts)?$/, 'stub-sanity-client.cjs'],
  [/[\\/]lib[\\/]payments[\\/]active-gateway(\.ts)?$/, 'stub-active-gateway.cjs'],
  [/[\\/]lib[\\/]firebase-admin(\.ts)?$/, 'stub-firebase-admin.cjs'],
];

const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  const bySpecifier = BY_SPECIFIER[request];
  if (bySpecifier) return path.join(__dirname, bySpecifier);
  // Relative requests (sanity/lib/fetch.ts imports './client') are made absolute first.
  const candidate =
    request.startsWith('.') && parent && parent.filename
      ? path.resolve(path.dirname(parent.filename), request)
      : request;
  for (const [pattern, stub] of BY_PATH_SUFFIX) {
    if (pattern.test(candidate)) return path.join(__dirname, stub);
  }
  return original.call(this, request, parent, ...rest);
};

// Belt and braces: any real network attempt is recorded and refused, so a stub that is
// bypassed shows up as a failed check instead of a live call.
globalThis.__networkAttempts = [];
globalThis.fetch = async function offlineFetch(input) {
  globalThis.__networkAttempts.push(String(input && input.url ? input.url : input));
  throw new Error('offline harness: network call refused');
};
