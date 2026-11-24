# Static contract gate

`.github/workflows/ci.yml` job `static-contract-gate` runs `run_static_assertions.py` on every push
and pull request. The contract gate (`python3 execution/contract.py gate`) does not run in CI, so
source-text assertions went stale silently when code was refactored: on 22 Nov 2026, 16 of 51 swept
were stale and none was a real regression. This job runs a reviewed allowlist of them.

## What runs

`allowlist.json` lists each assertion by contract yaml path and id. `python3
contracts/checks/static-gate/run_static_assertions.py --list` prints exactly what runs. The runner
loads each yaml, takes the assertion's `command`, and runs it with `bash -c` from the repo root with
only `PATH`, `HOME`, `LANG` and `LC_ALL` in the environment (no secret can reach a check). It exits 1
when an assertion fails or times out (60 s), and also when an allowlisted contract or id no longer
exists, is not a shell check, or is duplicated: a deleted or renamed assertion cannot silently drop
out of the gate. Exit 2 means a config error: the allowlist is unreadable or the wrong shape (not an
object, wrong schema, `assertions` not a non-empty list, an entry that is not an object with string
`contract` and `id`, or a duplicate). Each command runs in its own session; on timeout the runner
kills the whole process group, so no grandchild survives. `python3
contracts/checks/static-gate/test_run_static_assertions.py` tests both behaviours (CI runs it).

## Admission rules for an allowlist entry

An assertion belongs here only when all of these hold:

1. Its command only reads files in the repo checkout (grep, test, node, python or bash scripts).
   No network, no Firebase, Sanity, Ozow, Resend or deployed-site call, no dev server, no build.
2. It needs nothing beyond the Node, Python (with PyYAML) and bash a bare checkout has. Commands
   that need `node_modules` (`node --import tsx/esm ...`, `pnpm exec`) are out; CI does not install.
3. It depends on no git state other than the checked-out files: no `origin/main`, `BASE_REF`,
   `git diff <base>`, `git log`, or byte-identical-to-a-commit pins. Those are point-in-time guards.
4. It does not read the clock or a mutable external file, and every path it names exists (a
   negated grep on a missing file passes vacuously).
5. It passes on current main in a shallow clone (`git clone --depth 1`), with network and every
   write outside a temp dir denied. Local-only temp copies (the mutation harnesses
   `payment-seam-f2/check-ordering-mutations.sh`, `launch-weekend/f8/check-a-programme-mutations.sh`)
   are allowed and are registered in `../live-write-guard/writers-registry.json` where the guard
   asked for it.
6. It asserts a standing property of the source, not a copy or price literal that Lee-Ann's
   documents change on purpose (ticket prices, show dates, listed times, photo filenames).

To add an entry: put `{contract, id}` in `allowlist.json`, run the runner, and keep it only if it is
green. To retire one, remove it here in the same change that retires or rewrites the assertion.

## Widening, 24 Nov 2026 (285 entries added, 362 in all)

A read-only triage of 741 passing assertions was filtered one by one against the rules above. 285
were admitted; the rest were left out, first matching reason shown:

| Reason | Count |
|---|---|
| Prose in `docs/*.md` or spec `.md` files (editors rewrite these; low value) | 60 |
| Command or the script it runs mentions pnpm, tsc, eslint, tsx, npx, node_modules or playwright | 54 |
| Copy, price, venue, colour, photo, email or other pinned literal (rule 6) | 54 |
| A path the command names is absent from the checkout | 49 |
| Check script imports a package that needs `node_modules` | 44 |
| Hard-coded `/Users/...` path (reads the developer's main checkout) | 43 |
| Reads a contract yaml or `.claude/settings.json` (spec metadata, harness config) | 26 |
| Identical command already admitted under another id | 20 |
| Reads a notes file that changes routinely (`.tmp/`, backlog, needs-human, memory) | 16 |
| Clock or file timestamps in the command or its script | 15 |
| Git state in the command or its script | 15 |
| Reads `.env*` or `process.env` | 11 |
| Binary artefacts (screenshots, images) | 11 |
| Script or its imports can spawn a process or server | 10 |
| Dates or price text in the command | 8 |
| Calls `execution/contract.py` or `brain.py` | 6 |
| Trivial `true` | 4 |
| Writes files (including `py_compile`, which writes `__pycache__`, and baseline json that changes when assertions are fixed) | 6 |
| Network, image generation, non-stdlib Python import | 4 |

Added on top of the existing rules: every executed script and its relative imports is read for
`next dev|start|build`, `spawn`, `fork`, `exec*`, `listen(`, `child_process`, `subprocess`, `fetch(`,
server helpers and playwright (unsure means out); every path a command names must be tracked by
git, not just present on disk (gitignored files do not exist in CI). The 15 mutation proofs run
for the change (a source edit turns the assertion red, then reverted) are in the pull request.

## Not allowlisted

Red on current main (static, not fixed here): `contracts/contract-payment-seam-f1.yaml` A8,
`contract-payment-seam-f2.yaml` A1, A2, A15, `beta-password-wall/contract-f1.yaml` A1 to A4
(goldens differ from live files), `ticketing-f4-admission-products` A3 (price literals),
`launch-weekend/contract-f18.yaml` A27 (check q, stale pricing golden), A36 (check z, naming decision) and A30 (check u, broken
`nos f3lib`, also needs a server).

`beta-password-wall/contract-f2.yaml` A2 was allowlisted at first and removed: it greps
`.agent/memory/project/backlog.md` (a working notes file), so an ordinary notes edit could turn CI red
without any code change (admission rule 4: no mutable external file). Its sibling A2b stays.

Green but left out because they are not provably stable or need install: `launch-weekend/contract-f8`
F8-A1 and `contract-f30` F30-A4 (diff against `origin/main`: PR-scope guards), `contract-f18` A21
and `contract-ticketing-f4-roles-claim` / `ticketing-f5-buyers` A6 (`node --import tsx/esm`).
