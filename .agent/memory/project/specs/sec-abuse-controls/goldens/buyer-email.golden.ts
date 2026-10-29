// Golden for lib/buyer-email.ts: the one canonical buyer identity used for BOTH the per-buyer
// request limit and the held-seat buyerKey stamp (Codex QA 2026-10-29: plus-addressed variants
// a+x@d / a+y@d were separate buyers, so one person got unlimited requests and seat budgets).
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/buyer-email.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');

async function main() {
  const { normalizeBuyerEmail, buyerPairKey } = await import(path.join(ROOT, 'lib/buyer-email.ts'));
  const n = (value: string): string => normalizeBuyerEmail(value);

  assert.equal(n('  Person@Example.ORG '), 'person@example.org', 'trim and lowercase');

  // Plus-addressing: everything from the first + in the local part is a tag, never identity.
  assert.equal(n('a+x@d.org'), 'a@d.org');
  assert.equal(n('a+y@d.org'), n('a+x@d.org'), 'two tags, one buyer');
  assert.equal(n('A+x+y@D.org'), 'a@d.org', 'only the first + matters');
  assert.equal(n('a+@d.org'), 'a@d.org', 'an empty tag is still a tag');
  assert.equal(n('+x@d.org'), '+x@d.org', 'an empty local part after stripping is not collapsed to @d.org');

  // Gmail ignores dots in the local part and treats googlemail.com as gmail.com; other domains do not.
  assert.equal(n('A.B.C+t@gmail.com'), 'abc@gmail.com');
  assert.equal(n('a.b.c@googlemail.com'), 'abc@gmail.com');
  assert.equal(n('a.b@d.org'), 'a.b@d.org', 'dots are identity everywhere except gmail');
  assert.notEqual(n('a.b@d.org'), n('ab@d.org'));
  assert.equal(n('a.b@mail.gmail.com'), 'a.b@mail.gmail.com', 'only the exact gmail domains');

  // Different mailboxes stay different.
  assert.notEqual(n('a@d.org'), n('b@d.org'));
  assert.notEqual(n('a@d.org'), n('a@e.org'));

  // Malformed input never throws and is only trimmed and lowercased (validation lives elsewhere).
  assert.equal(n(' No-At-Sign '), 'no-at-sign');
  assert.equal(n('a+b@c@d.org'), 'a+b@c@d.org', 'more than one @ is returned as trimmed lowercase');
  assert.equal(n(''), '');

  // Idempotent.
  for (const value of ['a+x@d.org', 'A.B+c@gmail.com', ' x@y.z ', '+x@d.org']) {
    assert.equal(n(n(value)), n(value), `idempotent for ${value}`);
  }

  // The pair key (SAOC-approved 2026-10-29): the limiter and the held-seat stamp are scoped to
  // (trusted-hop actor, normalised email), so knowing an email gives no lever over its owner from
  // another address. It is only ever a hash INPUT, never a stored value.
  const A = 'ip4:203.0.113.9';
  const B = 'ip4:203.0.113.10';
  assert.equal(buyerPairKey(A, 'Buyer@X.org'), buyerPairKey(A, ' buyer+tag@x.org '), 'same actor, plus/case variants: one pair');
  assert.notEqual(buyerPairKey(A, 'buyer@x.org'), buyerPairKey(B, 'buyer@x.org'), 'same email from another actor is a different pair');
  assert.notEqual(buyerPairKey(A, 'buyer@x.org'), buyerPairKey(A, 'other@x.org'), 'same actor, other email is a different pair');
  assert.notEqual(buyerPairKey(A, 'buyer@x.org'), A, 'the pair key is not the actor key alone');
  assert.notEqual(buyerPairKey(A, 'buyer@x.org'), 'buyer@x.org', 'the pair key is not the email alone (no global per-email key)');
  assert.notEqual(buyerPairKey('a\u0000b', 'c@x.org'), buyerPairKey('a', 'b\u0000c@x.org'), 'no separator ambiguity between actor and email');
  assert.equal(buyerPairKey('unknown', 'buyer@x.org'), buyerPairKey('unknown', 'BUYER+1@x.org'));

  console.log('buyer-email golden: PASS');
}

main().catch((error) => {
  console.error('buyer-email golden: FAIL');
  console.error(error);
  process.exit(1);
});
