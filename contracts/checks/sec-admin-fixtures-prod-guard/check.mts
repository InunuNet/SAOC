// Usage: pnpm exec tsx contracts/checks/sec-admin-fixtures-prod-guard/check.mts
// /admin-fixtures/[route] renders the admin shell with no auth, so it must 404 in the hosted
// runtime even when ADMIN_FIXTURES=1 is set. Locally the flag still opens it.
import * as pageModule from '../../../app/admin-fixtures/[route]/page.tsx';

type PageComponent = (props: { params: Promise<{ route: string }> }) => Promise<unknown>;
// tsx may wrap a CJS-style default export one level deeper.
const exported = pageModule.default as PageComponent | { default: PageComponent };
const AdminFixturePage = typeof exported === 'function' ? exported : exported.default;

const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
const params = Promise.resolve({ route: 'dashboard' });

async function isNotFound(env: Record<string, string | undefined>): Promise<boolean> {
  const saved = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await AdminFixturePage({ params });
    return false;
  } catch (error) {
    return (error as { digest?: string }).digest === NOT_FOUND_DIGEST;
  } finally {
    process.env = saved;
  }
}

const fails: string[] = [];
const expect = async (label: string, env: Record<string, string | undefined>, want: boolean) => {
  const got = await isNotFound(env);
  if (got !== want) fails.push(`${label}: notFound expected ${want}, got ${got}`);
};

await expect('hosted + flag on', { ADMIN_FIXTURES: '1', K_SERVICE: 'saoc-backend' }, true);
await expect('local + flag off', { ADMIN_FIXTURES: undefined, K_SERVICE: undefined }, true);
await expect('local + flag on', { ADMIN_FIXTURES: '1', K_SERVICE: undefined }, false);

if (fails.length > 0) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('PASS sec-admin-fixtures-prod-guard');
