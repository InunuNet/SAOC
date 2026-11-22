import assert from 'node:assert/strict';
import test from 'node:test';

import { clientIpFromHeaders, rateLimitKeyForIp, rateLimitKeyFromHeaders } from './client-ip';

function headersOf(values: Record<string, string>) {
  return { get: (name: string): string | null => values[name.toLowerCase()] ?? null };
}

function resolve(xff?: string, fah?: string): string | null {
  const values: Record<string, string> = {};
  if (xff !== undefined) values['x-forwarded-for'] = xff;
  if (fah !== undefined) values['x-fah-client-ip'] = fah;
  return clientIpFromHeaders(headersOf(values));
}

test('IPv4 is returned unchanged (trimmed)', () => {
  assert.equal(rateLimitKeyForIp('203.0.113.7'), '203.0.113.7');
  assert.equal(rateLimitKeyForIp('  203.0.113.7 '), '203.0.113.7');
});

test('addresses in the same /64 share a key, adjacent /64s do not', () => {
  const a = rateLimitKeyForIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
  const b = rateLimitKeyForIp('2001:db8:1:2::1');
  assert.equal(a, b);
  assert.equal(a, '2001:db8:1:2::/64');
  assert.notEqual(a, rateLimitKeyForIp('2001:db8:1:3::1'));
});

test(':: compression at start, middle and end', () => {
  assert.equal(rateLimitKeyForIp('::1'), '0:0:0:0::/64');
  assert.equal(rateLimitKeyForIp('::'), '0:0:0:0::/64');
  assert.equal(rateLimitKeyForIp('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(rateLimitKeyForIp('2001:db8:1:2::'), '2001:db8:1:2::/64');
  assert.equal(rateLimitKeyForIp('2001:db8:1:2:3:4:5:6'), '2001:db8:1:2::/64');
});

test('spellings of one prefix agree: case, leading zeros, zone, brackets, port', () => {
  const want = '2001:db8:0:1::/64';
  for (const spelling of [
    '2001:DB8:0:1::5',
    '2001:0db8:0000:0001:0:0:0:5',
    '2001:db8:0:1::9%eth0',
    '[2001:db8:0:1::5]',
    '[2001:db8:0:1::5]:443',
  ]) {
    assert.equal(rateLimitKeyForIp(spelling), want, spelling);
  }
});

test('IPv4-mapped IPv6 yields the plain IPv4 key in both forms', () => {
  assert.equal(rateLimitKeyForIp('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(rateLimitKeyForIp('::FFFF:0102:0304'), '1.2.3.4');
  assert.equal(rateLimitKeyForIp('[::ffff:1.2.3.4]:80'), '1.2.3.4');
});

test('unparseable input is returned trimmed and unchanged', () => {
  for (const garbage of ['garbage', '1:2:3', '2001:db8::1::2', 'gggg::1', '::ffff:1.2.3.999']) {
    assert.equal(rateLimitKeyForIp(` ${garbage} `), garbage);
  }
});

test('null and empty give null', () => {
  assert.equal(rateLimitKeyForIp(null), null);
  assert.equal(rateLimitKeyForIp(undefined), null);
  assert.equal(rateLimitKeyForIp('   '), null);
});

test('x-fah-client-ip wins when it is a valid literal', () => {
  assert.equal(resolve('6.6.6.6, 9.9.9.9, 10.0.0.1, 10.0.0.2', '9.9.9.9'), '9.9.9.9');
  assert.equal(resolve(undefined, '2001:db8::1'), '2001:db8::1');
  assert.equal(resolve('1.1.1.1', ' 203.0.113.5 '), '203.0.113.5');
});

test('garbage x-fah-client-ip falls back to the chain', () => {
  for (const fah of ['not-an-ip', '999.999.999.999', '203.0.113.5:8080', '[2001:db8::1]', ':', '']) {
    assert.equal(resolve('6.6.6.6, 9.9.9.9, 10.0.0.1, 10.0.0.2', fah), '9.9.9.9', fah);
  }
});

test('three or more chain entries give the third from the end', () => {
  assert.equal(resolve('9.9.9.9, 10.0.0.1, 10.0.0.2'), '9.9.9.9');
  assert.equal(resolve('6.6.6.6, 9.9.9.9, 10.0.0.1, 10.0.0.2'), '9.9.9.9');
  assert.equal(resolve('1.1.1.1, 2.2.2.2, 3.3.3.3, 9.9.9.9, 10.0.0.1, 10.0.0.2'), '9.9.9.9');
  assert.equal(resolve(' 6.6.6.6 ,, 9.9.9.9 , 10.0.0.1 , 10.0.0.2 '), '9.9.9.9');
});

test('one or two chain entries give the last entry (off-platform only)', () => {
  assert.equal(resolve('198.51.100.4'), '198.51.100.4');
  assert.equal(resolve('9.9.9.9, 10.0.0.1'), '10.0.0.1');
});

test('no usable chain and no fah gives null', () => {
  assert.equal(resolve(), null);
  assert.equal(resolve(''), null);
  assert.equal(resolve(' , ,'), null);
});

test('key helper uses the same resolution and groups IPv6 to /64', () => {
  const chain = '6.6.6.6, 2001:db8:0:1::7, 35.1.1.1, 35.1.1.2';
  assert.equal(rateLimitKeyFromHeaders(headersOf({ 'x-forwarded-for': chain })), '2001:db8:0:1::/64');
  assert.equal(
    rateLimitKeyFromHeaders(headersOf({ 'x-fah-client-ip': '2001:db8:0:1:aaaa::9' })),
    '2001:db8:0:1::/64',
  );
  assert.equal(rateLimitKeyFromHeaders(headersOf({ 'x-forwarded-for': '198.51.100.4' })), '198.51.100.4');
  assert.equal(rateLimitKeyFromHeaders(headersOf({})), null);
});
