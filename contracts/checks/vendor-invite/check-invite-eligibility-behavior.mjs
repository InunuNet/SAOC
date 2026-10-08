#!/usr/bin/env node
// vendor-invite F1 — A3: behavioural proof of the real
// decideVendorApplicationInviteEligibility() (lib/vendor-application-invite-eligibility.ts).
// Proves: a 'pending' candidate for the same email blocks the invite; an 'approved' candidate
// blocks it; a 'declined' candidate does NOT block it (a fresh, independent invite is
// allowed); no matching candidate does not block it; and the email comparison is genuinely
// case-INSENSITIVE.
//
// Relative import with the .ts extension (never the @/lib alias, which does not resolve under
// plain node/tsx outside the Next.js build) — same convention every other behavioural check in
// this repo's vendor contracts uses.
//
// Run as: npx tsx contracts/checks/vendor-invite/check-invite-eligibility-behavior.mjs

const { decideVendorApplicationInviteEligibility } = await import(
  '../../../lib/vendor-application-invite-eligibility.ts'
);

const failures = [];

function expectBlocked(label, contactEmail, candidates) {
  const decision = decideVendorApplicationInviteEligibility(contactEmail, candidates);
  if (decision.ok) {
    failures.push(`${label}: expected the invite to be BLOCKED, but decideVendorApplicationInviteEligibility() returned { ok: true }`);
  }
}

function expectAllowed(label, contactEmail, candidates) {
  const decision = decideVendorApplicationInviteEligibility(contactEmail, candidates);
  if (!decision.ok) {
    failures.push(`${label}: expected the invite to be ALLOWED, but decideVendorApplicationInviteEligibility() returned { ok: false, error: ${JSON.stringify(decision.error)} }`);
  }
}

// (1) A 'pending' candidate for the same email (exact case) blocks the invite.
expectBlocked('(1) pending, exact-case match', 'jane@example.com', [
  { id: 'app-1', status: 'pending', contactEmail: 'jane@example.com' },
]);

// (2) An 'approved' candidate for the same email blocks the invite.
expectBlocked('(2) approved, exact-case match', 'jane@example.com', [
  { id: 'app-2', status: 'approved', contactEmail: 'jane@example.com' },
]);

// (3) A 'declined' candidate for the same email does NOT block the invite — a fresh,
// independent re-invite must be allowed.
expectAllowed('(3) declined does not block a re-invite', 'jane@example.com', [
  { id: 'app-3', status: 'declined', contactEmail: 'jane@example.com' },
]);

// (4) No matching candidate at all allows the invite.
expectAllowed('(4) no match at all', 'nobody@example.com', [
  { id: 'app-4', status: 'approved', contactEmail: 'someone-else@example.com' },
]);

// (5) THE CASE-INSENSITIVITY PROOF — the vendor's typed/admin-entered email and the stored
// candidate's email differ only in case. A case-sensitive comparison would wrongly return
// { ok: true } here (the real defeating mutation this check exists to catch).
expectBlocked('(5) case-insensitive match against a pending candidate', 'Jane@Example.com', [
  { id: 'app-5', status: 'pending', contactEmail: 'jane@example.com' },
]);
expectBlocked('(5b) case-insensitive match against an approved candidate, mixed case both sides', 'JANE@EXAMPLE.COM', [
  { id: 'app-5b', status: 'approved', contactEmail: 'Jane@Example.Com' },
]);

// (6) Multiple candidates: a declined one and an unrelated approved one for a DIFFERENT email
// must not spuriously block an invite for yet another email.
expectAllowed('(6) unrelated candidates do not block an unrelated email', 'third@example.com', [
  { id: 'app-6a', status: 'declined', contactEmail: 'jane@example.com' },
  { id: 'app-6b', status: 'approved', contactEmail: 'someone-else@example.com' },
]);

// (7) conflictingId on a blocked decision must name the actual conflicting candidate, not be
// empty or a placeholder — the route's 409 message depends on this to be useful to the admin.
{
  const decision = decideVendorApplicationInviteEligibility('jane@example.com', [
    { id: 'the-real-conflicting-id', status: 'pending', contactEmail: 'jane@example.com' },
  ]);
  if (decision.ok || decision.conflictingId !== 'the-real-conflicting-id') {
    failures.push(`(7) expected conflictingId 'the-real-conflicting-id' on a blocked decision, got ${JSON.stringify(decision)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: decideVendorApplicationInviteEligibility() blocks on pending/approved, allows a ' +
    'fresh invite after declined, allows no-match, compares emails case-insensitively, and ' +
    'names the real conflicting candidate id.',
);
process.exit(0);
