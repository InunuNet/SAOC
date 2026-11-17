import assert from 'node:assert/strict';
import * as requireCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MODULE = 'lib/recovery-token.ts';

function loadRecoveryToken() {
  const source = readFileSync(path.join(ROOT, MODULE), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module: loaded,
      exports: loaded.exports,
      require: (name) => {
        assert.equal(name, 'node:crypto');
        return requireCrypto;
      },
      Buffer,
    },
    { filename: MODULE, timeout: 5000 },
  );
  return loaded.exports;
}

test('recovery token stays valid through seven days after the show ends', () => {
  const { mintRecoveryToken, recoveryTokenTtlMs, verifyRecoveryToken } = loadRecoveryToken();
  const now = new Date('2026-12-01T00:00:00Z');
  const showEnd = new Date('2027-09-26T21:59:59Z');
  const secret = 'regression-secret';
  const minted = mintRecoveryToken({
    orderId: 'show-order', secret, now, ttlMs: recoveryTokenTtlMs(now, showEnd),
  });

  assert.equal(minted.expiresAt.toISOString(), '2027-10-03T21:59:59.000Z');
  assert.equal(verifyRecoveryToken({ token: minted.token, secret, now: new Date('2027-09-30T00:00:00Z') }).ok, true);
  assert.equal(verifyRecoveryToken({ token: minted.token, secret, now: new Date('2027-10-04T00:00:00Z') }).reason, 'expired');
});

test('recovery token uses a one-day floor or 180-day fallback', () => {
  const { recoveryTokenTtlMs, RECOVERY_TOKEN_DEFAULT_TTL_MS } = loadRecoveryToken();
  const now = new Date('2027-11-01T00:00:00Z');
  const oldShowEnd = new Date('2027-09-26T21:59:59Z');

  assert.equal(recoveryTokenTtlMs(now, oldShowEnd), 24 * 60 * 60 * 1000);
  assert.equal(recoveryTokenTtlMs(now, null), RECOVERY_TOKEN_DEFAULT_TTL_MS);
});
