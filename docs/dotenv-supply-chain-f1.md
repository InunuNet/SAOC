# dotenv Supply-Chain Check (F1)

**Date:** 2026-07-28

## Background

`dotenv@17.4.2` prints a promotional banner referencing `www.vestauth.com` at load time, first noticed 2026-07-24 while investigating an unrelated Sanity issue. This was flagged as a potential supply-chain concern and investigated.

## Verdict: BENIGN

- The installed tarball hash matches the npm registry's `dist.integrity` exactly.
- No install scripts are present.
- Zero security advisories exist for `dotenv` itself.
- The banner is upstream-maintainer self-promotion via `dotenv`'s rotating TIPS feature — it makes no network call and collects no data.

## Fix applied

`scripts/seed-sanity.ts` (the only call site in the repo) now loads `dotenv` with `config({ quiet: true })`. Next.js loads `.env` natively and is unaffected.

## Update 2026-07-30 — the banner is not just cosmetic, it caused a real incident

"Benign" above was a supply-chain verdict (no malicious code, hash matches the registry) —
it was never a claim that the banner is operationally harmless. During F2, an ad-hoc
`node -e "require('dotenv').config(...); process.stdout.write(...)"` one-liner (used to
extract a secret from `.env.local` for piping into `firebase apphosting:secrets:set`, not
`scripts/seed-sanity.ts` — this fix's `quiet: true` only covers that one call site) let the
same banner text land on stdout ahead of the value, corrupting two production secrets
(`SANITY_REVALIDATE_SECRET`, `SANITY_API_TOKEN`) and causing a real outage. Full root-cause
account and byte-level confirmation: `docs/f2-secret-runtime-investigation.md`.

`dotenv` is still a project dependency, so this can recur from any future one-off script.
**Never extract a secret via a `dotenv`-loading `node -e` one-liner.** Use
`grep '^KEY=' .env.local | cut -d= -f2-` instead, and pipe writes with
`printf '%s' "$VALUE" | <tool> --data-file=-` (never `echo`, which appends a trailing
newline).

## Evidence

- Full findings: `contracts/golden/dotenv-supply-chain-f1/findings.md`
- Contract: `contracts/contract-dotenv-supply-chain-f1.yaml` (7/7 green)
