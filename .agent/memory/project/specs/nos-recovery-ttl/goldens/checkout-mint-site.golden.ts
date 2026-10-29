// Golden for the two checkout regions (mission nos-recovery-ttl, spec D5, D6). Frozen by @architect.
// Run: pnpm exec tsx .agent/memory/project/specs/nos-recovery-ttl/goldens/checkout-mint-site.golden.ts
// app/api/tickets/checkout/route.ts cannot be imported (Next server module, Sanity, Firestore). So this golden
// EXTRACTS the real source of two regions by their `// anchor:` comments, compiles them with the TypeScript
// compiler and EXECUTES them against the real lib modules. The effect is pinned, not the text:
//   region 1 (POST, between the secret guard and reserveTicket): refuses with HTTP 500 and the existing copy, before
//            any write, when the show window is missing or the expiry cannot be set; otherwise yields the show-based expiry.
//   region 2 (reserveTicket transaction): mints a token whose signed expiry is input.recoveryExpiresAt, whatever `now` is.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '../../../../../..');
const ROUTE = readFileSync(path.join(ROOT, 'app/api/tickets/checkout/route.ts'), 'utf8').split('\n');
const SECRET_VALUE = 'golden-secret-value-9f3';
process.env.RECOVERY_TOKEN_SECRET = SECRET_VALUE; // a log line that reads the env would now leak it
const EXISTING_COPY = 'Ticket recovery is not configured. Please try again later.';

function lineAfterAnchor(name: string): number {
  const at = ROUTE.findIndex((line) => line.includes(`// anchor: ${name}`));
  assert.ok(at >= 0 && at + 1 < ROUTE.length, `anchor ${name} present in route.ts`);
  return at + 1;
}

/** Source lines from `first` through the first later line equal to `closer` (inclusive). */
function region(first: number, closer: string): string {
  for (let index = first; index < ROUTE.length; index += 1) {
    if (index > first && ROUTE[index] === closer) return ROUTE.slice(first, index + 1).join('\n');
  }
  throw new Error(`no closing line ${JSON.stringify(closer)} after line ${first + 1}`);
}

function compile(params: string[], body: string): (...args: unknown[]) => Promise<unknown> {
  const source = `(async function (${params.join(', ')}) {\n${body}\n})`;
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  // eslint-disable-next-line no-eval -- executing the extracted route region is the whole point of this golden
  return (0, eval)(js) as (...args: unknown[]) => Promise<unknown>;
}

async function main(): Promise<void> {
  const { resolveRecoveryExpiry } = await import(path.join(ROOT, 'lib/recovery-expiry.ts'));
  const { mintRecoveryToken, verifyRecoveryToken } = await import(path.join(ROOT, 'lib/recovery-token.ts'));

  // ---- region 1: the pre-write guard in POST --------------------------------------------------------------
  const resolveLine = lineAfterAnchor('rx-resolve');
  const guard = region(resolveLine, '  }');
  assert.ok(lineAfterAnchor('rx-refuse') > resolveLine, 'rx-refuse follows rx-resolve');
  const logged: unknown[][] = [];
  const stubConsole = { error: (...args: unknown[]) => logged.push(args), log: () => undefined, warn: () => undefined };
  const stubResponse = { json: (body: unknown, init: { status: number }) => ({ stub: true, body, status: init.status }) };
  const runGuard = compile(['showWindow', 'resolveRecoveryExpiry', 'NextResponse', 'console'], `${guard}\nreturn { stub: false, expiresAt: recoveryExpiry.expiresAt };`);

  const farFuture = { startDate: new Date('2099-09-24T00:00:00+02:00'), endDate: new Date('2099-09-26T12:00:00+02:00') };
  const accepted = (await runGuard(farFuture, resolveRecoveryExpiry, stubResponse, stubConsole)) as { stub: boolean; expiresAt: Date };
  assert.equal(accepted.stub, false, 'a usable show window lets the purchase continue');
  assert.equal(accepted.expiresAt.toISOString(), '2099-10-03T22:00:00.000Z', 'the continuing path carries the show-based expiry');
  assert.equal(logged.length, 0, 'nothing is logged on the happy path');

  for (const [label, showWindow] of [
    ['no usable show window (no active show, or an unparseable date)', null],
    ['an end date that is not a date', { startDate: new Date('2099-01-01T00:00:00Z'), endDate: new Date('nope') }],
    ['a show that ended more than 7 days ago', { startDate: new Date('2019-01-01T00:00:00Z'), endDate: new Date('2019-01-03T00:00:00Z') }],
  ] as const) {
    logged.length = 0;
    const refused = (await runGuard(showWindow, resolveRecoveryExpiry, stubResponse, stubConsole)) as { stub: boolean; status: number; body: Record<string, unknown> };
    assert.equal(refused.stub, true, `${label}: the purchase is refused before any write`);
    assert.equal(refused.status, 500, `${label}: HTTP 500`);
    assert.deepEqual(refused.body, { error: EXISTING_COPY }, `${label}: reuses the existing copy exactly, no new user-facing string`);
    assert.equal(logged.length, 1, `${label}: exactly one server log line`);
    const serialised = JSON.stringify(logged[0]);
    assert.match(serialised, /no-active-show|invalid-show-end|already-expired/, `${label}: the log names the refusal code`);
    assert.ok(!serialised.includes(SECRET_VALUE) && !/secret|token/i.test(serialised), `${label}: the log carries no secret or token`);
    assert.deepEqual(Object.keys((logged[0][1] ?? {}) as object), ['code'], `${label}: the log context is exactly { code }`);
  }

  // ---- region 2: the mint inside the reservation transaction ----------------------------------------------
  const mintLine = ROUTE.findIndex((line) => line.includes('const minted = mintRecoveryToken({'));
  assert.ok(mintLine >= 0, 'the mint call exists in route.ts');
  const mintBody = region(mintLine, ROUTE[mintLine].replace('const minted = mintRecoveryToken({', '});'));
  const runMint = compile(['mintRecoveryToken', 'orderRef', 'input', 'now'], `${mintBody}\nreturn minted;`);
  const recoveryExpiresAt = new Date('2027-10-03T22:00:00.000Z');
  const input = { recoveryTokenSecret: 'golden-secret', recoveryExpiresAt };
  for (const nowIso of ['2026-10-29T08:00:00.000Z', '2027-09-26T09:00:00.000Z']) {
    const minted = (await runMint(mintRecoveryToken, { id: 'order-9' }, input, new Date(nowIso))) as { token: string; expiresAt: Date };
    assert.equal(minted.expiresAt.getTime(), recoveryExpiresAt.getTime(), `minted expiry is the show-based instant (mint time ${nowIso})`);
    const last = verifyRecoveryToken({ token: minted.token, secret: 'golden-secret', now: new Date(recoveryExpiresAt.getTime() - 1) });
    assert.equal(last.ok, true, 'valid 1 ms before the expiry');
    assert.equal(last.orderId, 'order-9');
    const gone = verifyRecoveryToken({ token: minted.token, secret: 'golden-secret', now: recoveryExpiresAt });
    assert.equal(gone.ok, false, 'expired at the expiry');
  }
  // A transaction retry that lands after the window closed must throw (no born-expired token is written).
  await assert.rejects(() => runMint(mintRecoveryToken, { id: 'order-9' }, input, new Date('2027-10-04T00:00:00.000Z')), RangeError);

  console.log('checkout-mint-site golden: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
