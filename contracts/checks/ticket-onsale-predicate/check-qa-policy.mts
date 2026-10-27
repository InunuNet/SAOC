// A2 -- qaFixturesAllowed(env, paymentsLive): demo products purchasable only outside production
// and only while payments are not live. Red on the baseline (module absent).
import { finish, golden } from './_golden.mts';

const mod = await import('../../../lib/ticket-on-sale.ts').catch((e: unknown) => {
  finish('A2 qa policy', [`lib/ticket-on-sale.ts cannot be imported: ${String(e).slice(0, 160)}`]);
});
const { qaFixturesAllowed } = mod as { qaFixturesAllowed: (env: { NODE_ENV?: string }, live: boolean) => boolean };
const table = golden('qa-policy-truth-table.json');
const failures: string[] = [];
if (typeof qaFixturesAllowed !== 'function') failures.push('qaFixturesAllowed is not exported');
else {
  for (const c of table.cases) {
    const env = c.NODE_ENV === null ? {} : { NODE_ENV: c.NODE_ENV };
    const got = qaFixturesAllowed(env, c.paymentsLive);
    if (got !== c.expect) failures.push(`NODE_ENV=${c.NODE_ENV} paymentsLive=${c.paymentsLive}: expected ${c.expect}, got ${got}`);
  }
}
finish(`A2 qa policy (${table.cases.length} cases)`, failures);
