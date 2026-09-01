#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A7: behavioural proof of
// lib/vendor-admin-notify-recipients.ts's getVendorAdminNotifyRecipients(). Proves it actually
// reads and parses the REAL process.env.ADMIN_EMAIL_ALLOWLIST (comma-split, trim, lowercase,
// filter empty) — not a stub that always returns [] or a hardcoded list. Presence-paired: a
// resolver that always returns [] would trivially satisfy every "never contactEmail" absence
// check elsewhere in this contract, so this behavioural test is what proves the real property.
//
// Same relative-import-with-.ts-extension convention as every other behavioural check script in
// this contract (never the @/lib alias, which does not resolve under plain node/tsx for a check
// script outside the Next.js build).
//
// Run as: npx tsx contracts/checks/vendor-flow-notifications/check-recipients-resolver-behavior.mjs

const failures = [];

async function freshImport() {
  // Bust the module cache with a cache-busting query so each case re-evaluates any
  // module-scope state against the env var set immediately before the import.
  const mod = await import(`../../../lib/vendor-admin-notify-recipients.ts?cb=${Date.now()}-${Math.random()}`);
  return mod.getVendorAdminNotifyRecipients;
}

// (1) A real, messy allowlist value is parsed correctly: comma-split, trimmed, lowercased,
// empty entries filtered.
{
  process.env.ADMIN_EMAIL_ALLOWLIST = ' Admin@Example.com , second@example.com,, third@Example.COM ';
  const getVendorAdminNotifyRecipients = await freshImport();
  const result = getVendorAdminNotifyRecipients();
  const expected = ['admin@example.com', 'second@example.com', 'third@example.com'];
  if (JSON.stringify(result) !== JSON.stringify(expected)) {
    failures.push(`(1) expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
  }
}

// (2) An unset env var resolves to an empty array, not a throw and not a hardcoded fallback list.
{
  delete process.env.ADMIN_EMAIL_ALLOWLIST;
  const getVendorAdminNotifyRecipients = await freshImport();
  let result;
  let threw = false;
  try {
    result = getVendorAdminNotifyRecipients();
  } catch {
    threw = true;
  }
  if (threw) {
    failures.push('(2) getVendorAdminNotifyRecipients() threw when ADMIN_EMAIL_ALLOWLIST is unset — must resolve to an empty array.');
  } else if (!Array.isArray(result) || result.length !== 0) {
    failures.push(`(2) expected an empty array when ADMIN_EMAIL_ALLOWLIST is unset, got ${JSON.stringify(result)}`);
  }
}

// (3) A second env var (VENDOR_NOTIFY_EMAIL_ALLOWLIST or similar) has no effect — proves the
// resolver reads ONLY ADMIN_EMAIL_ALLOWLIST, not a broadened/second roster.
{
  process.env.ADMIN_EMAIL_ALLOWLIST = 'only@example.com';
  process.env.VENDOR_NOTIFY_EMAIL_ALLOWLIST = 'decoy@example.com';
  const getVendorAdminNotifyRecipients = await freshImport();
  const result = getVendorAdminNotifyRecipients();
  delete process.env.VENDOR_NOTIFY_EMAIL_ALLOWLIST;
  if (JSON.stringify(result) !== JSON.stringify(['only@example.com'])) {
    failures.push(`(3) expected ['only@example.com'] (VENDOR_NOTIFY_EMAIL_ALLOWLIST must be ignored), got ${JSON.stringify(result)}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: getVendorAdminNotifyRecipients() parses a real, messy ADMIN_EMAIL_ALLOWLIST value ' +
    'correctly, resolves to [] when unset, and ignores any second env var.',
);
process.exit(0);
