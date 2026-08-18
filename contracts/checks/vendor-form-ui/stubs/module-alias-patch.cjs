/* eslint-disable @typescript-eslint/no-require-imports -- CJS stub loaded via require() by design */
// Shared @/ alias resolution patch for checks that import real .tsx component files under
// `npx tsx` (CJS hook — this repo has no "type": "module" in package.json, so .tsx files load
// via require(), whose resolver does not read tsconfig.json's `paths` map the way tsx's ESM
// hook does). Mirrors contracts/checks/vendor-f3-showcase-page/check-grid-renders-fixture-data.mjs's
// own inline patch exactly, factored out here since two checks in this contract need it.
const Module = require('node:module');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  const mapped = request.startsWith('@/') ? path.join(REPO_ROOT, request.slice(2)) : request;
  return originalResolveFilename.call(this, mapped, ...rest);
};

module.exports = {};
