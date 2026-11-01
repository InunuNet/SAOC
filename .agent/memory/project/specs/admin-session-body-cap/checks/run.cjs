// Golden: drives the REAL route handler. Exit 0 only if every scenario passes.
require('tsx/cjs');
const path = require('path');
const { runScenarios } = require('./lib-harness.cjs');
const route = require(path.resolve('app/api/admin/session/route.ts'));
runScenarios(route.POST).then((r) => {
  let bad = 0;
  for (const x of r) { if (!x.ok) bad++; console.log(`${x.ok ? 'PASS' : 'FAIL'} ${x.id} (${x.detail})`); }
  process.exit(bad ? 1 : 0);
}).catch((e) => { console.error('harness error', e); process.exit(2); });
