# Golden: H1, trim the server trace so private files never ship

- **Mission:** nos-provenance-fix, feature **F2 (H1)**. This is split out from the spec (§5 H1). It does **not** wait for Option A approval. The lead (saoc-2b) made it a security condition.
- **Worktree:** `.tmp/sandbox/trace-fix`, branch `fix/trace-excludes`, base **`9e619821`** (InunuNet/SAOC origin/main). It was rebased from `5ae1f3cf`. `git diff --stat 5ae1f3cf 9e619821` shows 4 files: `vendors/loading.tsx`, `VendorEmptyState.tsx` and two `contracts/checks/vendor-p1-targets/*` files. None touches `next.config.ts`, `lib/data/show-pages.ts` or `content/`, so the §1 measurements taken on `5ae1f3cf` still stand.
- **Next:** 16.2.12. `next build` defaults to **Turbopack**, and App Hosting builds from git in **standalone** mode.

## 1. What is wrong (measured on base 5ae1f3cf, 2026-10-15)

- **Root cause.** `lib/data/show-pages.ts` calls `path.resolve(process.cwd(), sourcePath)` at l.197, l.208 and l.301 with a runtime value.
  - Turbopack cannot scope that call, so it traces **the whole project**.
  - The base build log says so: `Encountered unexpected file in NFT list … the whole project was traced unintentionally … add ignore comments: path.join(/*turbopackIgnore: true*/ process.cwd(), bar)`. The import trace is `next.config.ts → lib/data/show-pages.ts → app/(marketing)/national-show/wosa-conference/page.tsx`.
- **Blast radius.** The six routes that call `loadShowPageOrFallback` are affected: international-guests, programme, sa-exhibitors, sponsors, symposium and wosa-conference. No other trace carries project files. `next-server.js.nft.json` and `next-minimal-server.js.nft.json` carry only node_modules.
- **What ships.** A standalone build of base (`NEXT_PRIVATE_STANDALONE=true pnpm build`) copies the traced files into `.next/standalone/`, and App Hosting deploys that tree. It contains, among others:
  - `documents/Website Development SpecificationV1.docx`, `documents/SAOC_Website_Proposal_28-05-2026.docx` and `documents/Inunu - Additional info request.docx`, plus the six `documents/*.md` client-correspondence notes;
  - `docs/secret-corruption-incidents.md`, `docs/f2-secret-runtime-investigation.md` and the other `docs/**`;
  - all of `execution/**` (1031 files), `contracts/**` (1409, including the secret-guard goldens), `template/**`, `scripts/**`, `branding/**` (logo masters and zips), `design/**`, `e2e/**`, `functions/**`, `Plans/**` and `MEMORY/**`;
  - root `comms.md`, `AGENTS.md`, `CLAUDE.md`, `apphosting.yaml`, `issues.json` and `contract*.yaml`.
- **Baseline scan** (`scan-traces.mjs` on base): **FAIL, 5936 forbidden entries.** That is 97 trace files and 7949 standalone files scanned, with exit 1.
- **Not shipped on base:** `content/drive-source/**`, because it is not in git. It IS traced on any local build where the tree exists. Dot-directories (`.agent/`, `.claude/`, …) and `.env*` did not appear in any trace on base. They are excluded anyway, as defence in depth.

## 2. What the server actually reads at runtime

| reader | what | how it reaches the server |
|---|---|---|
| `lib/data/show-pages.ts` `sourceFileExists` / `readSourceTextForLinkage` | `content/drive-recovered/**/content.md` (tracked). Also `content/drive-source/**/content.md`, which is gitignored, never on beta and must never ship. | **fs at runtime.** This is the only runtime fs reader in `app/`, `lib/`, `components/`, `sanity/`, `emails/` and `proxy.ts` (grep for `node:fs` / `fs/promises` / `readFileSync`, 2026-10-15). |
| `app/sitemap.ts` | `content/national-show-routes.json` | static `import`, so it is bundled into the JS and needs no trace |
| `content/show-pages/*.json` | seeds only | read by `scripts/seed-show-pages.ts`, never by the server. Pages read Sanity. |
| fonts and images | `public/**`, `next/font` | served or bundled by Next and the adapter, not via route traces |

So the **only** project data file the server needs traced is `content/drive-recovered/**/content.md`, and only for the six gated routes.
`recovery.json` is not read at runtime.

## 3. The decision

There are two layers. Both are required.

### Layer 1: root cause (`lib/data/show-pages.ts`)
Prefix each of the three `process.cwd()` calls with `/*turbopackIgnore: true*/`, exactly as Next's own warning prescribes:

```ts
const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sourcePath);          // l.197
const rootAbs = path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);                  // l.208
return readFileSync(path.resolve(/*turbopackIgnore: true*/ process.cwd(), sourcePath), 'utf8'); // l.301
```

- No other change to that file is allowed. One `//` comment line may be added explaining why. A9 enforces this.
- With the whole-project trace gone, the drive-recovered sources are no longer shipped **by accident**. Layer 2's include ships them **on purpose**.
- `content/drive-source/` is never included, so a local build now behaves exactly like beta. That is the intended parity.

### Layer 2: explicit config (`next.config.ts`)
Add the following next to the existing `outputFileTracingRoot`, with the keys and globs exactly as shown:

```ts
// Server traces must carry only what the server reads. lib/data/show-pages.ts is the one
// runtime fs reader (content/drive-recovered); everything below is private, tooling, or
// client source documents and must never reach the App Hosting image.
const NEVER_SHIP = [
  'content/drive-source/**',
  'content/drive-watch/**',
  'documents/**',
  'docs/**',
  'execution/**',
  'contracts/**',
  'template/**',
  'scripts/**',
  'design/**',
  'design spec/**',
  'branding/**',
  'Plans/**',
  'MEMORY/**',
  'e2e/**',
  'functions/**',
  'test-results/**',
  '.agent/**',
  '.claude/**',
  '.gemini/**',
  '.grok/**',
  '.golden/**',
  '.github/**',
  '.tmp/**',
  '.anti/**',
  '.scratch-render/**',
  '.vscode/**',
  '.firebaserc',
  '*.md',
  '*.sh',
  'contract*.yaml',
  'apphosting*.yaml',
  'issues.json',
  'WORKSPACE',
  'Makefile',
  '**/*.docx',
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '.sops.yaml',
];

  outputFileTracingExcludes: {
    '/**': NEVER_SHIP,
  },
  outputFileTracingIncludes: {
    '/national-show/*': ['content/drive-recovered/**/content.md'],
  },
```

**Route-key form (Next 16).**
- Keys are picomatch globs matched against the **normalised route path**. Route groups are stripped, so `app/(marketing)/national-show/sa-exhibitors/page` is matched as `/national-show/sa-exhibitors`.
- `next/dist/build/collect-build-traces.js` (webpack path) matches with `{dot:true, contains:true}`. Turbopack's matcher is in Rust and was not inspected. So the keys chosen here work under **both** strict and `contains` matching. This was tested with Next's bundled picomatch:
  - `'/**'` matches `/`, `/national-show/sa-exhibitors` and `/api/tickets/itn` in both modes;
  - the documented `'/*'` misses nested routes under strict matching;
  - `'/national-show/*'` matches every gated route.
- Value globs resolve from the project root. Root-only patterns (`'*.md'`) are joined to the project dir, so they do not reach into `node_modules`. The `**/` patterns do reach in, deliberately.

**Why a denylist and not an allowlist.** Next has no "trace only these" option, and negated excludes are not supported in this form. Layer 1 is what gives allowlist behaviour: only real imports and the explicit include are traced. Layer 2 catches a regression of Layer 1, for example a new `process.cwd()` reader, before it ships.

**Why these trees.** Each one holds client documents, private correspondence, incident write-ups, agent memory or instructions, harness code, contract fixtures, design masters, or ops config. None of them is read by the server (§2). `public/`, `app/`, `lib/`, `components/`, `sanity/`, `emails/`, `types/`, `package.json` and `node_modules` stay as they are.

## 4. Acceptance (what the contract checks)

- The **standalone** build succeeds, and its log no longer contains "the whole project was traced unintentionally".
- `scan-traces.mjs` exits 0. Every `*.nft.json` under `.next/` and every file under `.next/standalone/` is free of the forbidden trees, of **any project-root dot-entry except `.next`** (a catch-all, so a new dot-directory is caught without anyone extending the list), `*.docx`, `.env*`, `*.pem`, `*.key`, `.sops.yaml`, `apphosting*.yaml` and the root agent/ops files. **This fails on base** (§1).
- `check-required-traced.mjs` exits 0. Each of the six gated route traces carries every `content/drive-recovered/**/content.md`.
- `check-runtime.mjs` exits 0. It starts `.next/standalone/server.js` on 127.0.0.1:3017, where cwd is the standalone tree, so only traced files exist. `/national-show/sa-exhibitors`, `/national-show/symposium` and `/national-show/faq` each return 200 and render their sections.
  - The symposium `theme` section renders **without** a notice (`class="nos-show-page-prose" data-section-key="theme"`), which proves the traced drive-recovered source is readable at runtime.
  - The check stops only the process group it spawned and refuses to start if 3017 is busy.
  - **On base this passes**, because the whole-project trace ships the file. It is a no-regression guard.
- `type-check` and ESLint with zero warnings pass on `next.config.ts`, `lib/data/show-pages.ts` and the checks.
- Scope: only `next.config.ts` and `lib/data/show-pages.ts` change, and the logic of `show-pages.ts` is byte-identical apart from the markers.

## 5. Out of scope

- Option A (relinking sourcePath to drive-recovered).
- Any Sanity write.
- Any deploy.
- Removing tracked private files from git history.
- Next's standalone copy of the build machine's loaded `.env*` files into `.next/standalone/`. That is not via nft. It did not happen on base, where no file appeared, and App Hosting builds from git, where no `.env`/`.env.local` exists. It is noted as a risk only.

## 6. Amendment, 2026-10-15 (Codex QA P2)

**Finding.** Codex found that `NEVER_SHIP` and the scan both missed four tracked root dot-entries:
- `.anti/`, which holds internal agent prompts in `.anti/agents.json`;
- `.scratch-render/`;
- `.vscode/`;
- `.firebaserc`.

The other tracked root dot-entries are already covered or harmless:
- `.env.enc` is covered by `**/.env*`;
- `.gitignore`, `.prettier*` and `.env.local.example` are harmless.

**Amendment.**
- **`NEVER_SHIP`** gains `'.anti/**'`, `'.scratch-render/**'`, `'.vscode/**'` and `'.firebaserc'` (see §3).
- **The scan** names these four explicitly, and it adds a catch-all that flags **any** root dot-entry whose first path segment is not in `ROOT_DOT_ALLOW = {'.next'}`. `node_modules/.pnpm/…` is not root, so it is unaffected.
- **Why the config can't use the same catch-all:** a `'.*/**'` exclude would also match `.next/**` and strip the server's own chunks. So the config stays explicit, and the scan is the net that catches the next new dot-entry.

**Proof.** I used a fixture, because the current build has Layer 1 and no longer traces the whole project.
- The fixture is `.tmp/sandbox/f2-dotfixture/.next/server/app/x/page.js.nft.json`, with traced entries for `.anti/agents.json`, `.scratch-render/a.png`, `.vscode/settings.json`, `.firebaserc` and an unknown `.brand-new-dir/x.txt`, plus the allowed `.next/server/chunks/ok.js` and `node_modules/.pnpm/pkg/index.js`.
- Result: **exit 1, 5 offenders**. The four named entries are flagged, and the unknown one is caught only by the catch-all. The two allowed paths are not flagged.
- The current trace-fix build (@dev's) still passes.
