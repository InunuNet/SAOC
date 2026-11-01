// Golden for proxy.ts host routing of /tickets/recover (mission nos-order-recovery). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/proxy-routing.golden.ts
// proxy.ts is NOT edited by this mission. This golden proves the emailed URL reaches the new route as it
// is: on the NOS host the request passes through untouched (a rewrite to /national-show/tickets/recover
// would miss the route), and on the SAOC host it 308s to the NOS origin with the query intact.
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
process.env.SITE_PUBLIC_LAUNCH = 'true';
process.env.NEXT_PUBLIC_SAOC_SITE_URL = 'https://saoc.example.test';
process.env.NEXT_PUBLIC_NOS_SITE_URL = 'https://nos.example.test';
delete process.env.BETA_BASIC_AUTH_USER;
delete process.env.BETA_BASIC_AUTH_PASSWORD;

async function main() {
  const { NextRequest } = await import('next/server');
  const { proxy } = await import(path.join(ROOT, 'proxy.ts'));

  const TOKEN = 'eyJvIjoib3JkZXItQSJ9.' + 'a'.repeat(64);
  const call = (host: string, pathAndQuery: string) =>
    proxy(new NextRequest(`https://${host}${pathAndQuery}`, { headers: { host } }));

  // NOS host: pass-through, no rewrite, no redirect.
  for (const target of [`/tickets/recover?token=${TOKEN}`, '/tickets/recover', '/tickets/recover?token=bogus']) {
    const response: Response = await call('nos.example.test', target);
    assert.equal(response.status, 200, `nos ${target}: not redirected`);
    assert.equal(response.headers.get('location'), null, `nos ${target}: no Location`);
    assert.equal(response.headers.get('x-middleware-next'), '1', `nos ${target}: passed through`);
    assert.equal(response.headers.get('x-middleware-rewrite'), null, `nos ${target}: not rewritten onto /national-show`);
    assert.equal(response.headers.get('x-site'), 'nos');
  }

  // SAOC host: one 308 hop to the NOS origin, path and query preserved byte for byte.
  {
    const target = `/tickets/recover?token=${TOKEN}`;
    const response: Response = await call('saoc.example.test', target);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `https://nos.example.test${target}`);
  }
  {
    const response: Response = await call('saoc.example.test', '/tickets/recover');
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://nos.example.test/tickets/recover');
  }

  process.stdout.write('proxy-routing.golden: PASS\n');
}

main().catch((error) => {
  process.stderr.write(`proxy-routing.golden: FAIL ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
