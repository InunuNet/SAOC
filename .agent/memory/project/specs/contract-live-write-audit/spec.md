# Spec: take live-write assertions out of the default gate

Slug `contract-live-write-audit`. Final count after Codex round 1: 84 manual_only entries in 28 files (three static checks restored, see the Codex round 1 note below). Evidence and the full per-script table are in `audit.md`. The rule being implemented (SAOC lead): "Classify every contract that writes. Real writes move to fixture replay, or get `manual_only` with the reason inline. Nothing that writes to production runs in a gate by default."

## Decision

1. The mechanism for `manual_only` is a **top-level `manual_only:` list in the contract file**, not a flag on a check. `execution/contract.py` has no skip mechanism for shell checks (audit.md section 1): an unknown per-check key is dropped by `normalize_contract` (`execution/contract.py:161-195`), per-check `phase:` still runs under `--phase all` (`mission.py:1341` default) and hijacks `--phase max`, and an exit-77 guard turns the gate red unless every caller passes `--allow-skips`. A top-level block is never read by any gate path and is accepted by `validate --strict` (probed). Do not edit `execution/`.
2. Entry shape (all four keys required):
   ```yaml
   manual_only:
     - id: A3                      # the original assertion id, no longer in assertions.checks
       description: <original description, unchanged>
       reason: <why it must not run in a gate, at least 40 characters, names the target>
       command: <the original command, unchanged>
   ```
   Run by hand: copy `command` into a shell from the repo root, with the operator present. The reason states the target (for example "publishes sentinel text to the production Sanity dataset through the deployed Studio and restores it").
3. Fixture replay is chosen only where the repo already has the fake and the check already runs against it. None of the 87 live assertions qualifies today: they exist to prove the live path (Studio -> Content Lake -> ISR, Firestore transactions, Firebase Auth). So every real writer gets `manual_only`. A converted-to-fake variant is follow-up, and the scanner already accepts it: a command prefixed with `SAOC_FIXTURE_REPLAY=1` whose script contains `SAOC_FIXTURE_REPLAY` is exempt.
4. Detection is a registry plus a scanner, not a hand list. `contracts/checks/live-write-guard/writers-registry.json` classifies every script that carries write signals; `contracts/checks/live-write-guard/verify_no_ungated_writers.py` fails when a registered real writer, or an unregistered script with write signals, is executed by `assertions.checks`. Safe classes carry an evidence regex that the scanner re-checks, so a "read-only" verdict cannot silently go stale. MODAL scripts (run with `--verify`, `--dry-run`, or `env -u SANITY_API_TOKEN`) stay safe only while that argument is in the command.

## Per-contract edits for @dev (28 files, 84 assertions)

For each file: delete the listed ids from `assertions.checks` (or, for a `phases:` dict, from that phase list), and add the `manual_only:` entries. Keep comments. Where the file also has an explicit `phases:` list (marked below) remove the ids there as well; the scanner fails on a dangling phase reference.

| contract | assertion ids to move | phases form |
|---|---|---|
| specs/admin-session-refusal-log-enforcement/contract-f1.yaml | A1, A2, A3, A4 | checks only |
| specs/admin-settings-deploy-and-chrome-fix/contract-f1.yaml | A6 | checks only |
| specs/admin-signout-revocation/contract-f1.yaml | A1, A3, A6 | checks only |
| specs/conference-workshop-tickets/contract-f3.yaml | A28, A29 | checks only |
| specs/conference-workshop-tickets/contract-f4.yaml | A14 | checks only |
| specs/fix-live-sentinel-residue-cms-loop-f3/contract-m1.yaml | A14 | checks only |
| specs/order-reconciliation/contract-f1.yaml | A4 | checks only |
| specs/ozow-payment-provider/contract-m1-f2.yaml | A4 | checks only |
| specs/ticketing-capacity-reconciliation-hold/contract-f1.yaml | A4 | checks only |
| specs/ticketing-position-expiry-write/contract-f1.yaml | A4 | checks only |
| specs/verify-reservation-release-path/contract-f1.yaml | A2, A3 | checks only |
| specs/verify-reservation-release-path/contract-f2.yaml | A2, A3, A4, A5 | checks only |
| contracts/cms-loop-f2-event-tags.yaml | A1 | checks only |
| contracts/cms-loop-f3-national-show.yaml | A1 | checks only |
| contracts/cms-loop-f4-orphaned-types.yaml | A1, A2 | checks only |
| contracts/contract-admin-auth-f3-provisioning.yaml | A-GRANT-01, A-GRANT-02, A-GRANT-03, A-REVOKE-01, A-REVOKE-02 | checks only |
| contracts/contract-admin-auth-f4-google.yaml | A-GRANT-04 | checks only |
| contracts/contract-admin-auth-hardening.yaml | A-ALLOW-01, A-PROBE-01, A-STATE-01, A-STATE-02, A-NEGCTL-01 | checks only |
| contracts/contract-cms-wiring-cleanup.yaml | A1, A3, A5 | checks only |
| contracts/contract-d6-door-checkin.yaml | D6-11, D6-12, D6-13 | phases list |
| contracts/contract-dotenv-supply-chain-f1.yaml | A6 | checks only |
| contracts/contract-f1-hero-keys.yaml | A3 | checks only |
| contracts/contract-payfast-m1-lock-cleanup-fix.yaml | A7-PREFLIGHT-BEFORE-LOCK, A8-CLEAR-AFTER-RESIDUE-CHECK | checks only |
| contracts/contract-payfast-m1.yaml | A18, A19, A20, A21, A30, A31 | checks only |
| contracts/contract-production-blockers-f4-itn-check-repoint.yaml | A11 | checks only |
| contracts/contract-show-exhibitor-info.yaml | A22, A36, A47 | checks only |
| contracts/contract-show-visitor-info.yaml | A24, A42, A60, A61 | checks only |
| contracts/contract-ticketing-hardening.yaml | A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A13, A17, A21, A22, A23, A24, A25, A26, A27, A28, A29, A31, A34 | checks only |
| contracts/f2-deploy-next16.yaml | A9 | checks only |
| contracts/f6-prove-cms-loop.yaml | A1 | checks only |

Reasons by script class (use these as the starting text, tighten per assertion):
- REAL_SANITY: "publishes/patches the production Sanity dataset (project 26yfbug4); sentinel residue once sat on the live site for 3 days; run by hand only".
- REAL_FIRESTORE: "writes sentinel orders/tickets to the production Firestore (saoc-webapp) through firebase-admin or a local dev server with live .env.local credentials".
- REAL_AUTH: "creates probe accounts, grants claims or revokes sessions in the production Firebase Auth project".
- REAL_DEPLOYED: "sends a state-changing request to the deployed host".

## Permanent home and CI wiring (SAOC decision)

The scanner is repo-wide infrastructure, not spec residue, so it lives at `contracts/checks/live-write-guard/`: `verify_no_ungated_writers.py`, `verify_manual_only_contracts_validate.py` (local gate only, it shells out to contract.py), `writers-registry.json` and `fixtures/`. The default registry is the file beside the script. This spec dir stays as the record (audit.md, spec.md, contract.yaml, goldens/red-on-main.txt).

The scanner is static: it reads YAML and script text with `open()` and regexes, and never executes a contract command or imports a script (it has no subprocess or network call). It needs PyYAML and no secrets.

@dev adds one job to `.github/workflows/ci.yml`, beside `dataset-residue-guard`, runs on every PR and push through the file's existing triggers:

```yaml
  live-write-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python3 -m pip install pyyaml
      - name: No contract runs a live-production write in the default gate
        run: python3 contracts/checks/live-write-guard/verify_no_ungated_writers.py
```

No `env:` or secrets on the job. The scanner exits 1 on violations. Local gate sees it too as contract A1. Adding a new real writer now needs a registry entry or a `manual_only` move, in the same PR.

## Deviations in the landed edit (f21451b2), accepted

- The d6 entries in contracts/contract-d6-door-checkin.yaml carry a `command:` key in place of that contract's `verify: {kind, cmd}` block, so they match the manual_only entry shape above rather than the file's own assertion shape. Neither contract.py nor the scanner reads `manual_only`, so this is harmless.
- Moved items keep their inline comments. Comments are not parsed.
- Of the 28 files, the spec-tree ones are tracked spec contracts under the specs tree (contract-named yaml files); they had to change because gate_sweep.py globs those.
- The scanner itself is registered STATIC_FP with a re-checked evidence pattern (its detection regexes contain the write tokens). There is no path exclusion.

## Separate fixes folded in

**F-A. `ticketing-flow-redesign` contract-f1 A9** (`.agent/memory/project/specs/ticketing-flow-redesign/contract-f1.yaml:118-130`) asserts `scripts/fix-vip-and-weekend-pass-pricing.ts` exists with `--dry-run`, `--verify` and three doc ids. PR #124 deletes that script (it patched live Sanity by default). Replace the command with `test ! -f scripts/fix-vip-and-weekend-pass-pricing.ts` and reword the description to "the live-patch script was retired". Sequencing: land this after #124, or the assertion is red on main. A2 in this mission's contract guards the end state.

**F-B. `contracts/contract-dotenv-supply-chain-f1.yaml` A6** runs `scripts/seed-sanity.ts` (`createOrReplace`, line 135) for real under `timeout 15`, with the write token loaded from `.env.local` by dotenv. It is one of the 87 and gets `manual_only`. Do not "fix" it with `env -u SANITY_API_TOKEN`: the script loads `.env.local` itself and would put the token back, so the unset proves nothing. The banner property A5 already covers statically stays in the gate.

## Out of scope

No edits to `execution/`, no change to the scripts themselves, no fixture-replay conversion, no change to the residue guard. The two unparseable contracts belong to #126.

## Acceptance

- `python3 execution/contract.py validate .agent/memory/project/specs/contract-live-write-audit/contract.yaml --strict` passes.
- The scanner is red on main (93 violation rows on main; 84 assertions in 28 files after the Codex round-1 restore of three static checks) and green after the edits, with `manual_only` entries counted by the scanner.
- `python3 execution/contract.py validate <edited contract> --strict` still passes for every edited file (verified in simulation: no regressions across the 30 files).
- Reviewer sanity check that is not mechanical: each moved assertion's `reason` names a concrete target.

## Codex round 1 (11ccabd0)

Three assertions that the first pass moved came back to the gate: cms-loop-f3 `fix-live-sentinel-residue-cms-loop-f3/contract-m1.yaml` A14, and `contracts/contract-payfast-m1-lock-cleanup-fix.yaml` A7-PREFLIGHT-BEFORE-LOCK and A8-CLEAR-AFTER-RESIDUE-CHECK. They are static or fake-client checks: the scanner's name-based signals (`withCleanup`, `sentinelEmail`, `commitAndCaptureRev`) matched text, not a live call. They are registered STATIC_FP with evidence the scanner re-checks. Net: 87 to 84 entries, 30 to 28 files. The meta-assertion pins no count, so nothing else changes.
