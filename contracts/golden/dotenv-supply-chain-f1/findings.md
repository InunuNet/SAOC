# dotenv@17.4.2 supply-chain findings — captured 2026-07-28

## Verdict: BENIGN (upstream dotenv's own self-promotion, not a compromise)

## 1. Integrity — package matches published npm registry tarball exactly
- pnpm-lock.yaml `dotenv@17.4.2` resolution integrity:
  `sha512-nI4U3TottKAcAD9LLud4Cb7b2QztQMUEfHbvhTH09bqXTxnSie8WnjPALV/WMCrJZ6UV/qHJ6L03OqO3LcdYZw==`
- `npm view dotenv@17.4.2 dist.integrity` (live registry lookup) returns the
  identical hash. No divergence — the installed tarball is bit-for-bit the
  one npm serves for this exact version. Not a typosquat, not a tampered
  local copy.

## 2. Install scripts — none present
- `npm view dotenv@17.4.2 scripts` and the installed
  `node_modules/dotenv/package.json` both list only: `dts-check`, `lint`,
  `pretest`, `test`, `test:coverage`, `prerelease`, `release`. No
  `install`/`preinstall`/`postinstall` script exists. Nothing runs
  arbitrary code at install time.

## 3. Advisory check — clean
- `pnpm audit --prod` reports 53 vulnerabilities repo-wide, none for the
  `dotenv` package (all are in `websocket-driver`, `tar`, `form-data`,
  `undici`, `dompurify` — transitive deps of `firebase`/`sanity`, unrelated
  to this feature). `pnpm audit --prod --json` advisories dict has zero
  entries with `module_name == "dotenv"`.

## 4. Banner origin — confirmed upstream, traced to source
`node_modules/dotenv/lib/main.js` has a `TIPS` array of rotating tips
printed after every successful `.config()` call (unless `quiet`). One tip
reads `'⌁ auth for agents [www.vestauth.com]'`. Cross-referenced against the
live dotenv CHANGELOG.md (fetched via Alembic,
`http://localhost:7077/https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md`):
the 17.2.3 changelog entry reads verbatim:

> Give back to dotenv by checking out my newest project
> [vestauth](https://github.com/vestauth/vestauth). It is auth for agents.
> Thank you for using my software.

`vestauth` is the dotenv maintainer's (motdotla's) own follow-on project,
self-promoted in-band via the existing "random tip" feature that has shipped
since early v17 (other tips point at `dotenvx.com`, the same maintainer's
prior project). This is unwanted marketing noise in a library dependency,
not a credential-exfiltration or injection vector — the tip is a static
string in an array, printed to stdout/stderr only, with no network call and
no data collected or sent anywhere.

## 5. Suppression mechanism
`node_modules/dotenv/lib/config-options... lib/main.js` (`configDotenv`)
gates the tip/log line on `if (debug || !quiet)`; `quiet` is read from the
`quiet` option, defaulting from `process.env.DOTENV_CONFIG_QUIET`
(`lib/env-options.js`, evaluated at `dotenv/config` require time — so the
env var route also works with the bare `import 'dotenv/config'` side-effect
import). The repo's only call site is:

  `scripts/seed-sanity.ts:15` — `import 'dotenv/config';`

Fix: replace that side-effect import with an explicit call so the
suppression is visible in source (no reliance on external env state):

```ts
import { config } from 'dotenv';
config({ quiet: true });
```

No other file in the repo imports `dotenv` or `dotenv/config` (Next.js
loads `.env*` itself via its own built-in loader — confirmed by grep across
`*.ts,*.tsx,*.js,*.mjs,*.cjs` excluding `node_modules`/`.next`, only hit is
the one above).
