import assert from 'node:assert/strict';
import test from 'node:test';

import { rateLimitKeyForIp, rateLimitKeyFromForwardedFor } from './client-ip';

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

test('forwarded-for helper keeps the second-to-last hop and groups IPv6', () => {
  assert.equal(rateLimitKeyFromForwardedFor('6.6.6.6, 2001:db8:0:1::7, 35.1.1.1'), '2001:db8:0:1::/64');
  assert.equal(rateLimitKeyFromForwardedFor('198.51.100.4'), '198.51.100.4');
  assert.equal(rateLimitKeyFromForwardedFor(null), null);
});
