import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { getSecret, secretsEnv } from './secrets';

const VARS = ['SAOC_APP_SECRETS', 'SAOC_PAYMENT_SECRETS', 'SECRETS_TEST_KEY'] as const;

afterEach(() => {
  for (const name of VARS) delete process.env[name];
});

test('reads a key from the app bundle', () => {
  process.env.SAOC_APP_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: 'from-bundle' });
  assert.equal(getSecret('SECRETS_TEST_KEY'), 'from-bundle');
});

test('reads a key from the payment bundle', () => {
  process.env.SAOC_APP_SECRETS = JSON.stringify({ OTHER: 'x' });
  process.env.SAOC_PAYMENT_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: 'pay' });
  assert.equal(getSecret('SECRETS_TEST_KEY'), 'pay');
});

test('bundle wins over a plain env var', () => {
  process.env.SAOC_APP_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: 'bundle' });
  process.env.SECRETS_TEST_KEY = 'plain';
  assert.equal(getSecret('SECRETS_TEST_KEY'), 'bundle');
});

test('falls back to process.env when no bundle is set', () => {
  process.env.SECRETS_TEST_KEY = 'plain';
  assert.equal(getSecret('SECRETS_TEST_KEY'), 'plain');
});

test('falls back to process.env when the bundle lacks the key', () => {
  process.env.SAOC_APP_SECRETS = JSON.stringify({ OTHER: 'x' });
  process.env.SECRETS_TEST_KEY = 'plain';
  assert.equal(getSecret('SECRETS_TEST_KEY'), 'plain');
});

test('returns undefined when the key is nowhere', () => {
  assert.equal(getSecret('SECRETS_TEST_KEY'), undefined);
});

test('an empty-string bundle value is returned, not skipped', () => {
  process.env.SAOC_APP_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: '' });
  process.env.SECRETS_TEST_KEY = 'plain';
  assert.equal(getSecret('SECRETS_TEST_KEY'), '');
});

test('malformed JSON throws without echoing the bundle contents', () => {
  process.env.SAOC_APP_SECRETS = '{"SECRETS_TEST_KEY":"super-secret-value"';
  assert.throws(
    () => getSecret('SECRETS_TEST_KEY'),
    (err: Error) =>
      err.message.includes('SAOC_APP_SECRETS') && !err.message.includes('super-secret-value')
  );
});

test('a non-string value throws naming the key but not the value', () => {
  process.env.SAOC_PAYMENT_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: 12345678 });
  assert.throws(
    () => getSecret('SECRETS_TEST_KEY'),
    (err: Error) => err.message.includes('SECRETS_TEST_KEY') && !err.message.includes('12345678')
  );
});

test('a non-object bundle throws', () => {
  process.env.SAOC_APP_SECRETS = '["a"]';
  assert.throws(() => getSecret('SECRETS_TEST_KEY'), /JSON object/);
});

test('secretsEnv layers bundle keys over process.env', () => {
  process.env.SECRETS_TEST_KEY = 'plain';
  process.env.SAOC_APP_SECRETS = JSON.stringify({ SECRETS_TEST_KEY: 'bundle', EXTRA: 'e' });
  const env = secretsEnv();
  assert.equal(env.SECRETS_TEST_KEY, 'bundle');
  assert.equal(env.EXTRA, 'e');
  assert.equal(env.PATH, process.env.PATH);
});
