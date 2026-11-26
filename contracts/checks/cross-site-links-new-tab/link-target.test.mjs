// Unit tests for lib/link-target.ts and the anchor scan's rules.
// Run: node --experimental-strip-types --no-warnings --test contracts/checks/cross-site-links-new-tab/link-target.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { opensInNewTabFor } from '../../../lib/link-target.ts';
import { checkSource } from './scan-anchors.mjs';

const PROD = { saoc: 'https://saoc.co.za', nos: 'https://nationalorchidshow.co.za' };
const PREVIEW = { saoc: 'http://dev.saoc.co.za', nos: 'http://dev.saoc.co.za' };

const opens = (href, own, origins) => opensInNewTabFor(href, own, origins);

test('production: the other site and external origins open in a new tab', () => {
  assert.equal(opens('https://nationalorchidshow.co.za/tickets', 'saoc', PROD), true);
  assert.equal(opens('https://saoc.co.za/societies', 'nos', PROD), true);
  assert.equal(opens('https://example.com/', 'saoc', PROD), true);
  assert.equal(opens('https://example.com/', 'nos', PROD), true);
  assert.equal(opens('//example.com/x', 'saoc', PROD), true);
});

test('production: same-site links stay in the same tab', () => {
  assert.equal(opens('https://saoc.co.za/societies', 'saoc', PROD), false);
  assert.equal(opens('https://nationalorchidshow.co.za/tickets', 'nos', PROD), false);
  assert.equal(opens('/societies', 'saoc', PROD), false);
  assert.equal(opens('/tickets', 'nos', PROD), false);
});

test('relative show paths on the SAOC site go to the National Orchid Show', () => {
  assert.equal(opens('/national-show/vendors/apply', 'saoc', PROD), true);
  assert.equal(opens('/national-show/vendors/apply', 'nos', PROD), false);
  assert.equal(opens('/societies', 'nos', PROD), true);
});

test('mailto, tel and hash links never open a new tab', () => {
  for (const href of ['mailto:a@b.co', 'tel:+27110000000', '#section', '']) {
    assert.equal(opens(href, 'saoc', PROD), false, href);
  }
});

test('malformed absolute URLs are treated as external', () => {
  assert.equal(opens('http://', 'saoc', PROD), true);
  assert.equal(opens('https://', 'nos', PROD), true);
});

test('one-origin preview: judged by path, external still external', () => {
  assert.equal(opens('http://dev.saoc.co.za/national-show/plan-your-visit', 'saoc', PREVIEW), true);
  assert.equal(opens('http://dev.saoc.co.za/national-show/plan-your-visit', 'nos', PREVIEW), false);
  assert.equal(opens('http://dev.saoc.co.za/societies', 'saoc', PREVIEW), false);
  assert.equal(opens('http://dev.saoc.co.za/societies', 'nos', PREVIEW), true);
  assert.equal(opens('https://example.com/', 'saoc', PREVIEW), true);
});

test('scan: cross-site anchor without target/rel fails, with them and a cue passes', () => {
  const bad = `<a href="https://example.com/x">x</a>`;
  assert.equal(checkSource(bad, 'x.tsx', new Set()).length, 1);
  const bare = `<a href={nosUrl('/tickets')}>x</a>`;
  assert.equal(checkSource(bare, 'x.tsx', new Set()).length, 1);
  const good = `<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">x<span className="sr-only"> (opens in a new tab)</span></a>`;
  assert.deepEqual(checkSource(good, 'x.tsx', new Set()), []);
});

test('scan: PortableText without portableLinkMarks fails; <Link> to an external URL fails', () => {
  assert.equal(checkSource('<PortableText value={v} />', 'x.tsx', new Set()).length, 1);
  assert.equal(checkSource('<Link href="https://example.com">x</Link>', 'x.tsx', new Set()).length, 1);
  assert.deepEqual(checkSource('<Link href="/societies">x</Link>', 'x.tsx', new Set()), []);
});
