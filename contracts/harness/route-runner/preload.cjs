/* eslint-disable @typescript-eslint/no-require-imports -- this file is loaded by node's own
   --require, before any ESM machinery exists, and its whole purpose is to intercept CommonJS
   require(). It cannot be written as an ES module. */
// The route .ts files are transpiled to CJS by tsx, so their imports go through require() and
// never reach an ESM resolve hook. Intercept Module._load instead.
const Module = require('node:module');
const path = require('node:path');

const HERE = __dirname;
const OVERRIDES = {
  '@/lib/admin-auth': 'fixture-admin-auth.mjs',
  '@/lib/firebase-admin': 'fixture-firebase-admin.mjs',
  '@/lib/show-window-lookup': 'fixture-show-window-lookup.mjs',
  '@/lib/vendor-approval-confirmation': 'fixture-approval-email.mjs',
  'firebase-admin/firestore': 'fixture-firestore.mjs',
  'next/headers': 'fixture-next-headers.mjs',
  // M3 (vendor-gated-registration-flow) additions.
  '@/lib/payments': 'fixture-payments.mjs',
  '@/lib/payments/payfast': 'fixture-payments.mjs',
  '@/lib/payments/ozow': 'fixture-payments.mjs',
  '@/lib/payments/active-gateway': 'fixture-active-gateway.mjs',
  '@/lib/vendor-stand-payment-notice': 'fixture-vendor-stand-payment-notice.mjs',
  // vendor-payment-confirmation mission additions.
  '@/lib/vendor-payment-confirmation': 'fixture-vendor-payment-confirmation.mjs',
  '@/lib/vendor-payment-admin-notice': 'fixture-vendor-payment-admin-notice.mjs',
};

const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  const target = OVERRIDES[request];
  if (target) {
    if (process.env.LOADER_DEBUG) console.error('[override]', request);
    return require(path.join(HERE, target));
  }
  return originalLoad.call(this, request, ...rest);
};
