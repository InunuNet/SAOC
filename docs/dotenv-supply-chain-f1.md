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

## Evidence

- Full findings: `contracts/golden/dotenv-supply-chain-f1/findings.md`
- Contract: `contracts/contract-dotenv-supply-chain-f1.yaml` (7/7 green)
