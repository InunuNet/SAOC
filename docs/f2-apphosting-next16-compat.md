# F2 — Firebase App Hosting + Next.js 16 compatibility

**Mission:** `studio-next16-upgrade`, milestone M1 (gate: contract), investigation only.
**Date of research:** 2026-07-29. All sources fetched via Alembic; dates of the evidence
itself are called out per item since Next.js/App Hosting move fast.

## VERDICT: SUPPORTED (with two required apphosting.yaml/package.json changes, not blockers)

Firebase App Hosting supports Next.js 16 SSR as of the Next.js 16.2 release. The
strongest evidence is the adapter's own version-gate source code (confirmed via a
GitHub issue/PR pair), corroborated by an official Firebase blog post. One official
docs page is stale and should not be relied on alone — see caveat below.

## Evidence table

| # | Question | Finding | Source | Date |
|---|---|---|---|---|
| 1 | Official Firebase support statement for Next 16 | "With the release of Next.js 16.2, we are excited to share the first major milestone... the stable Deployment Adapter API... Next.js 16.2 is our new baseline for stability." Written by a Firebase engineer, part of the Next.js Deployment Adapters Working Group (with Vercel/Netlify/Cloudflare/AWS). | [firebase.blog/posts/2026/03/nextjs-adapters](https://firebase.blog/posts/2026/03/nextjs-adapters/) | 2026-03 (post), referencing Next 16.2 |
| 2 | Adapter package identity/repo | Package is `@apphosting/adapter-nextjs`, latest published version `14.0.21` (adapter's own version numbering, unrelated to Next's). Repo moved to `github.com/firebase/apphosting-adapters` (the `FirebaseExtended/firebase-framework-tools` URL now redirects there). No explicit `peerDependencies.next` range in the npm manifest — compatibility is enforced at build time via an internal semver gate, not npm peer resolution. | npm registry (`registry.npmjs.org/@apphosting/adapter-nextjs`) | fetched 2026-07-29 |
| 3 | Adapter's actual Next-version gate (the real evidence) | `packages/@apphosting/adapter-nextjs/src/utils.ts` contains `checkNextJSVersion`, which throws `CVE-2025-55182: Vulnerable Next version ... detected` unless the version matches `SAFE_NEXTJS_VERSIONS`. That range explicitly includes **`>=16.1.0`** as safe (alongside `~16.0.7`, and the 13.x/14.x/15.x LTS floors). Versions `16.0.0`–`16.0.6` and pre-fix canaries are the ones blocked, not 16 generally. | [github.com/firebase/apphosting-adapters issue #661](https://github.com/firebase/apphosting-adapters/issues/661) (opened 2026-06-30, describes the exact range with a reproduction table) and PRs [#660](https://github.com/firebase/apphosting-adapters/pull/660) / [#665](https://github.com/firebase/apphosting-adapters/pull/665) (merged 2026-07-08, fixing a prerelease-tag edge case, not the 16.1+ safe range itself) | issue 2026-06-30, PR merged 2026-07-08 |
| 4 | Does that cover the version this mission would install? | Yes. Mission's own probe table lists latest available as `16.2.12`. `16.2.12 satisfies >=16.1.0` → passes the adapter's gate. | Cross-referenced against mission file `2026-07-29-studio-next16-upgrade.md` | n/a |
| 5 | Official docs support matrix (caveat) | `firebase.google.com/docs/app-hosting/frameworks-tooling` still shows a Next.js support table topping out at **15.2.x "active"** — no 15.3+, 15.5, or 16.x rows at all. This is stale relative to the 2026-03 blog post and the 2026-06/07 GitHub activity above. Docs pages lag blog posts/code at Google; do not treat this table as current. | [firebase.google.com/docs/app-hosting/frameworks-tooling](https://firebase.google.com/docs/app-hosting/frameworks-tooling) | fetched 2026-07-29, content itself undated/stale |
| 6 | Node runtime floor | Docs state preconfigured Next.js support requires **Node.js 20 and higher**; App Hosting's versioned runtimes are `nodejs20`, `nodejs22`, `nodejs24` (even majors only, mirrors Cloud Run). Next.js 16 requires **Node ≥20.9.0** (per nextjs.org install docs and the official Next 16 upgrade guide). These ranges overlap — no floor conflict — but the exact patch of App Hosting's *default* Node version isn't stated in fetched docs. | [firebase.google.com/docs/app-hosting/frameworks-tooling](https://firebase.google.com/docs/app-hosting/frameworks-tooling), [nextjs.org/docs/app/getting-started/installation](https://nextjs.org/docs/app/getting-started/installation) | fetched 2026-07-29 |
| 7 | Repo's current runtime pin | `apphosting.yaml` declares no `runtime:` field and `package.json` has no `engines` field → App Hosting uses a **versionless `nodejs` default**, which per docs **disables ABIU** (Automatic Base Image Update) and leaves the exact Node patch implicit/unpinned. | Read `/Users/vetus/ai/SAOC/apphosting.yaml`, `/Users/vetus/ai/SAOC/package.json` | fetched 2026-07-29 |
| 8 | Build vs. run memory | `apphosting.yaml`'s `runConfig.memoryMiB: 512` / `cpu: 1` configure the **Cloud Run serving container**, not the build machine. Per `firebase.google.com/docs/app-hosting/build`, builds run through Cloud Build + Cloud Native Buildpacks on Google's own build infrastructure — `runConfig` is not documented as a build-resource lever. Turbopack build memory pressure is therefore not gated by this value. Confidence: medium — this is standard Cloud Build/Buildpacks architecture, not spelled out with an explicit contradicting number in the fetched pages. | [firebase.google.com/docs/app-hosting/build](https://firebase.google.com/docs/app-hosting/build) | fetched 2026-07-29 |
| 9 | Turbopack / output-shape assumptions | Next 16 makes Turbopack the default builder for both dev and build. No adapter-side `.next/standalone` incompatibility or Turbopack-specific blocker was found in the fetched GitHub issues. The March 2026 blog post frames the new **stable Deployment Adapter API** (shipped in Next 16.2) as precisely the mechanism that removes Firebase's dependency on reverse-engineering `.next` internals — i.e., this is the reason Turbopack output changes are *not* expected to break App Hosting going forward. | [firebase.blog/posts/2026/03/nextjs-adapters](https://firebase.blog/posts/2026/03/nextjs-adapters/) | 2026-03 |
| 10 | Other open Next-16-related issues | Search of `firebase/apphosting-adapters` issues for "next 16" surfaced only the preview/prerelease semver-gate bug (#661/#660/#665, resolved 2026-07-08) and unrelated dependency-bump PRs (Angular/tar bumps). No open blocking issue describing broken Next 16 SSR, Turbopack build failures, or memory/OOM reports specific to Next 16 was found. | GitHub issue search, `firebase/apphosting-adapters` | fetched 2026-07-29 |
| 11 | Failure mode if unsupported version is used | Confirmed from #661: the adapter **rejects the build at the App Hosting build step** with a hard error (`CVE-2025-55182: Vulnerable Next version X detected. Deployment blocked.`) for versions outside the safe range — it is a build-time refusal, not a silent SSR breakage. Since 16.1.0+ (and 16.2.12) is inside the safe range, this does not apply to the version this mission would install. | GitHub issue #661 | 2026-06-30 |

## Required apphosting.yaml / package.json changes (not blockers, but should be done before/with F3)

1. **Pin a versioned Node runtime.** Add to `apphosting.yaml`:
   ```yaml
   runConfig:
     runtime: nodejs22   # or nodejs24; avoid nodejs20 given Next 16's 20.9 floor is close to the 20.x line
   ```
   Add matching `"engines": { "node": ">=22" }` (or `">=20.9.0"` if staying on nodejs20)
   to `package.json`. This removes the implicit/unpinned versionless-`nodejs` default,
   re-enables ABIU, and guarantees the served Node version clears Next 16's 20.9 floor
   with margin. This is new config, not a value this report is empowered to write —
   flagging for F3 to apply alongside the dependency bump.
2. **Consider raising `runConfig.memoryMiB`** from 512 to e.g. 1024 as a precaution once
   F4's regression pass is running against Next 16 — not required by any documented
   floor, but Cache Components/Turbopack-produced runtime behavior at 512MiB has no
   positive confirmation either way in the sources found. Treat as a "watch during F4,"
   not an M1 blocker.

## What would fully settle the one open uncertainty

The only real gap is #6/#7 above: the *exact* Node patch App Hosting's versionless
default currently resolves to, and whether it already clears 20.9.0. This is answered
definitively either by (a) reading the Cloud Run runtime-support page's currently active
Node 20 patch version (not fetched in this pass), or (b) simply setting an explicit
`runtime: nodejs22` per the recommendation above, which sidesteps the question entirely.
Recommend (b) — it's strictly safer and is needed for ABIU regardless.

## Bottom line for the M1 gate

No evidence of a hard blocker. The adapter's own vulnerability gate explicitly
whitelists Next `>=16.1.0`, an official 2026-03 Firebase blog post states Next 16.2 is
Firebase's new stability baseline, and no open GitHub issue describes broken Next 16 SSR
on App Hosting. Proceed to F3 (upgrade to latest Next 16.x, i.e. 16.2.12 per F1's probe),
carrying the two apphosting.yaml/package.json changes above into that feature's scope.
