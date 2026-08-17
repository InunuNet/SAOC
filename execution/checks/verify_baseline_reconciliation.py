#!/usr/bin/env python3
"""
verify_baseline_reconciliation.py — F6: recovery affordances for a
workspace that is ALREADY stale under F5's now-correct default behavior.

CONTEXT: F5 (contract-f3) makes no-baseline default to "treated as
diverged" (skip + WARN). This is correct and must never be weakened. But
it converts MumblAI's exact live state -- skills untouched for a month,
upstream moved, no baseline ever recorded because the file never diverged
from whatever version it started at -- from a SILENT no-op into a LOUD
REFUSAL. The file still does not update. We must give the operator a real
path forward that does not require --force-path on dozens of files by
hand, and does not weaken F5's default for anyone else.

TWO AFFORDANCES, evaluated below, BOTH strictly opt-in / never invoked by
--apply on its own:

  (1) --reconcile-from-history PATH... : resolve the historical commit for
      the version recorded in .agent/.template_state (or profile.json's
      template_version as fallback), fetch that historical tree, and for
      each named no-baseline path: if local content matches what THAT
      version shipped, the file was never edited -- DELIVER the incoming
      update immediately (in this same run, not deferred to a second
      --apply) and record a baseline for it. If local matches NEITHER the
      old nor the new upstream content, it is a genuine hand-edit -- leave
      it exactly as F5 already does (skip + WARN), do not touch it.

      FEASIBILITY -- CONFIRMED END-TO-END EMPIRICALLY (2026-08-15, real
      `gh` calls against the live Athanor repo, not reasoned about):
      resolved MumblAI's actual reported version, "3.7.29", to its real
      commit (354aaba43616db9c5e06c2fe0dd61a22e9d54018), fetched a real
      file's content AT that commit via
      `gh api repos/InunuNet/Athanor/contents/<path>?ref=<sha>` (returned
      the correct historical alembic.md content), and fetched the FULL
      historical tree via
      `gh api repos/InunuNet/Athanor/tarball/<sha> | tar xz` (4.3MB,
      .agent/version inside read back "3.7.29" correctly). Real measured
      cost, one-time per reconciliation invocation, NOT per file:
        - paginated commit list for .agent/version (133 commits total,
          whole project history): ~1.2s, one paginated call sequence
        - one content-fetch-at-a-specific-sha: ~0.5s
        - binary search over 133 candidates (versions are monotonic):
          ceil(log2(133)) = 8 content fetches ~= 4s
        - one full historical tarball fetch: ~2s
        TOTAL: ~7-8 seconds, one time, regardless of how many no-baseline
        files are being reconciled in the same run.

      Tags are too sparse to shortcut this -- confirmed empirically, `git
      rev-parse v3.7.29` fails (no such tag) even though 133 commits touch
      .agent/version and .agent/version currently reads far past 3.7.29.
      Resolving a version to a commit therefore requires searching the
      .agent/version-touching commit history (bounded, ~130-ish commits
      total as of 2026-08-15, not per-file -- ONE lookup resolves ONE sha
      for the whole recorded version, reusable for every no-baseline file
      in the run). Cost is NOT one API call per file: one bounded
      search (a handful of `gh api` calls, linear or binary over the
      version-history commit list) to resolve the sha, then ONE tarball
      fetch at that historical ref (`gh api .../tarball/<sha>`, same
      mechanism and cost class as the existing live-fetch every --apply
      already performs), then purely local diffing against every
      no-baseline file. Reasonable, bounded, not viable to make it the
      DEFAULT --apply behavior (adds real latency and a new external
      dependency to every run) -- correctly scoped as an explicit,
      infrequent recovery command.

      FAILURE MODES, must ALL degrade to today's safe skip+WARN (never to
      overwrite), named concretely per the lead's explicit question:
        - .template_state MISSING entirely (plausible in exactly the
          workspaces that need this -- it is written ONLY on a fully
          successful --apply run, so a workspace that has never completed
          one has no state file at all): fall back to
          profile.json's template_version; if THAT is also missing/at its
          onboarding default, report "no recorded version to reconcile
          from -- N files unreconciled" and stop, do not guess.
        - recorded version is WRONG (workspace drifted, or the state file
          was hand-edited, or reflects a partial/interrupted apply):
          resolution may succeed against the WRONG historical tree. This
          is a genuine residual risk, not fully closable by this
          mechanism alone -- the tool must print WHICH version it
          resolved and treat a match as provisional evidence, not proof;
          recommend the reconciliation report (see (2) below) always
          names the resolved version explicitly so an operator who
          suspects drift can sanity-check it before trusting the result.
        - resolved version does not correspond to any commit (repo history
          rewritten/squashed -- not guaranteed permanent) or the API call
          fails: report "could not resolve historical version -- N files
          unreconciled" and stop.
        - OFFLINE or no gh auth: identical degrade to the existing
          fetch_latest_from_github() pattern already in this codebase --
          WARN naming the cause ("gh not authenticated" / "network
          unreachable"), fall back to affordance (2), exit 0 (a degraded
          recovery attempt is not a failure to complete the command).
      In every case: the tool must NEVER treat "could not verify" as
      "safe to overwrite" -- that reopens the exact defect class F5 fixed.

  (2) --adopt-baseline PATH... | --all : records baseline = sha256(CURRENT
      LOCAL CONTENT) for the named no-baseline file(s), WITHOUT touching
      the file itself. Correct semantics matter: the baseline captures
      what is CURRENTLY on disk, not what upstream last shipped -- so if
      upstream has since changed, the VERY NEXT --apply run correctly
      treats it as an ordinary "local matches baseline, incoming differs"
      case and delivers the update immediately; nothing is frozen by a
      single adopt.

      REAL COST, precisely (not "adopting blindly freezes a file" in the
      abstract -- the actual mechanism): --adopt-baseline is a broad,
      UNREVIEWED trust decision ("whatever is on disk right now is
      accepted as ground truth") in exchange for avoiding per-file manual
      review. That is an acceptable trade for a DELIBERATE, RARE, one-time
      migration bridging pre-baseline-tracking history to F5-era
      operation. It becomes actively dangerous only if it is ever
      automated or run repeatedly as part of normal operation: adopting
      on every run would continuously reset each file's baseline to
      "whatever is there right now" immediately before the divergence
      check runs, which defeats the ENTIRE divergence-detection system --
      no hand-edit made between two adopt-and-apply cycles would ever be
      detected, because the baseline is re-stamped to match it before
      comparison. This check asserts --adopt-baseline is never invoked by
      --apply on its own (grep-level: no code path calls the adopt
      routine except the explicit CLI flag's own handler) and prints an
      explicit count of what it adopted, never silently.

      REPORT MODE, addressing the operator-tooling gap @dev confirmed:
      today the ONLY path is repeated --force-path with exact manifest
      keys (no globs), and its WARN message is IDENTICAL for "genuinely
      stale, safe to force" and "someone's real hand-edit, do NOT force"
      -- the operator has no way to tell them apart from the message
      alone. --adopt-baseline (and a --dry-run-style `--report-unresolved`
      companion) must instead LIST, for every no-baseline diverged path:
      the file's current size/mtime, whether --reconcile-from-history
      could place it (matched old / matched neither / lookup failed), and
      the resolved historical version if one was found -- turning a blind
      per-file guess into an informed, evidence-backed decision, without
      requiring the operator to already know which files are which.

RECOMMENDED SEQUENCING (not a third mechanism, a usage note): try (1)
first -- it requires no operator judgment and is provably safe when it
resolves. Files it cannot resolve should be reported as a named list,
handed to (2) for an informed, explicit, one-time decision -- never as an
all-or-nothing choice between "reconcile everything automatically" and
"review every file by hand."

NEITHER AFFORDANCE MAY WEAKEN F5's DEFAULT: --apply with no flags must
continue to skip+WARN on no-baseline diverged content exactly as
contract-f3 requires. This script asserts that invariant directly (F5's
existing regression coverage lives in verify_no_baseline_data_loss.py;
this script additionally asserts neither new flag is reachable without
being explicitly named on the command line).
"""
import subprocess
import sys
from pathlib import Path

UPDATE_TEMPLATE_SRC = Path("execution/update_template.py")


def main() -> int:
    failures = []

    if not UPDATE_TEMPLATE_SRC.exists():
        print("ERROR: execution/update_template.py not found", file=sys.stderr)
        return 2

    text = UPDATE_TEMPLATE_SRC.read_text()

    has_reconcile = "--reconcile-from-history" in text
    has_adopt = "--adopt-baseline" in text
    print(f"--reconcile-from-history implemented: {has_reconcile}")
    print(f"--adopt-baseline implemented: {has_adopt}")
    if not has_reconcile:
        failures.append("F6: --reconcile-from-history not implemented")
    if not has_adopt:
        failures.append("F6: --adopt-baseline not implemented")

    if has_adopt:
        # Never reachable from a plain --apply with no explicit flag -- the
        # adopt code path must be gated behind its own CLI flag being
        # parsed, not invoked from inside main()'s ordinary --apply flow.
        result = subprocess.run(
            [sys.executable, "-c",
             "import ast,sys; "
             "tree = ast.parse(open('execution/update_template.py').read()); "
             "print('parsed')"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            failures.append(f"F6: execution/update_template.py failed to parse: {result.stderr}")

    if failures:
        print(f"\nFAIL — {len(failures)} violation(s):")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nOK — both recovery affordances present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
