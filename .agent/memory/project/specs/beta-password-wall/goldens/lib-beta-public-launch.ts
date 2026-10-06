// lib/beta-public-launch.ts
// Mission beta-password-wall F1 — the single switch that lifts the password
// wall, the X-Robots-Tag noindex header, and robots.ts's disallow-all, all
// three at once. Host-agnostic BY DESIGN (team-lead override, 2026-10-06,
// superseding this file's own first draft): an earlier version keyed this off
// the Host header via a production-domain allowlist, auto-lifting all three
// the moment saoc.co.za's DNS migrated onto this backend. Rejected because the
// DNS/Resend migration (project memory
// project_domain_migration_resend_sequencing) can land before the council
// decides to launch publicly — a host-based auto-lift would silently remove
// every protection at that moment, which is exactly the accidental exposure
// Lee-Ann asked this mission to prevent. Launch must be a deliberate act, never
// a side effect of an unrelated DNS/email sequencing change.
//
// SITE_PUBLIC_LAUNCH is a plain RUNTIME env var in apphosting.yaml, NOT a
// secret, and is ABSENT BY DEFAULT — it is not declared in apphosting.yaml at
// all until the day the council actually decides to go public, at which point
// adding it with the exact value 'true' and redeploying is the one, explicit
// launch action. The match is EXACT and case-sensitive against the literal
// string 'true': 'TRUE', '1', an empty string, or unset all mean "stay walled".
// Fail closed — anything other than the one exact value keeps every
// protection up.
export function isPubliclyLaunched(flagValue: string | undefined): boolean {
  return flagValue === 'true';
}
