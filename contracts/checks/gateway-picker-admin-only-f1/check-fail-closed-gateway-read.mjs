// Behavioural fail-closed check for resolveActiveGateway() (contracts/golden/
// gateway-picker-admin-only-f1/active-gateway-lib.golden.md). Mirrors the shape of
// ozow-sandbox-toggle-f1/check-fail-closed-flag-read.mjs: exercises the pure/deps-injectable
// function against fake Firestore doc shapes without a live Firestore connection.
import { resolveActiveGateway } from '../../../lib/payments/active-gateway.ts';

function fakeDb(docData) {
  return {
    collection() {
      return {
        doc() {
          return {
            async get() {
              if (docData === 'throw') throw new Error('simulated read failure');
              return {
                exists: docData !== null,
                data: () => docData,
              };
            },
          };
        },
      };
    },
  };
}

const cases = [
  { name: 'missing doc', docData: null, expect: null },
  { name: 'missing gateway field', docData: {}, expect: null },
  { name: 'invalid gateway value', docData: { gateway: 'stripe' }, expect: null },
  { name: 'non-string gateway value', docData: { gateway: 1 }, expect: null },
  { name: 'read throws', docData: 'throw', expect: null },
  { name: 'valid ozow', docData: { gateway: 'ozow' }, expect: 'ozow' },
  { name: 'valid payfast', docData: { gateway: 'payfast' }, expect: 'payfast' },
];

let failed = false;
for (const testCase of cases) {
  const result = await resolveActiveGateway({ db: fakeDb(testCase.docData) });
  if (result !== testCase.expect) {
    failed = true;
    console.error(`FAIL: ${testCase.name} — expected ${testCase.expect}, got ${result}`);
  }
}

if (failed) {
  console.error('resolveActiveGateway is not fail-closed for every non-valid case.');
  process.exit(1);
}
console.log('PASS: resolveActiveGateway fail-closed for all cases.');
