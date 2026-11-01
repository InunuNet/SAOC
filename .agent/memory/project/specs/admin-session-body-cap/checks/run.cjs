// Golden: drives the REAL route handler. Exit 0 only if every scenario passes.
require('tsx/cjs');
const path = require('path');
const { runScenarios } = require('./lib-harness.cjs');
const route = require(path.resolve('app/api/admin/session/route.ts'));
// Optional filter: `run.cjs S8 S9 S10` runs only scenarios whose id starts with one of the prefixes.
const only = process.argv.slice(2);
runScenarios(route.POST).then((all) => {
  const r = only.length ? all.filter((x) => only.some((o) => x.id.startsWith(o + '-'))) : all;
  if (only.length && !r.length) { console.error('no scenario matched'); process.exit(2); }
  let bad = 0;
  for (const x of r) { if (!x.ok) bad++; console.log(`${x.ok ? 'PASS' : 'FAIL'} ${x.id} (${x.detail})`); }
  process.exit(bad ? 1 : 0);
}).catch((e) => { console.error('harness error', e); process.exit(2); });
