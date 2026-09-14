#!/usr/bin/env python3
"""verify_ci_step_reachable.py -- proves a named CI step actually executes on an
ordinary push/PR run, not merely that the workflow file mentions it (mission
ticketing-complete M1/F7, contract-f7.yaml A21).

Why this exists: A20 only checks that ci.yml contains a line invoking
`pnpm test:e2e` / `npm run test:e2e`. That grep is satisfiable by a step that
merely references the phrase in a comment, sits in a job gated by a restrictive
`if:` (e.g. `if: false`, or a trigger condition that never matches push/pull_request),
carries an `if:` condition of its own that skips it in the common case, or is
downstream of a `continue-on-error: true` / `if: failure()` branch from an earlier
step in the same job -- none of which prove the step ever actually runs. This is
the same "declared but never fired" defect class A16 catches for the contact-form
mock: a thing being present in the file is not the same as the thing having
executed.

Usage:
    python3 verify_ci_step_reachable.py <path-to-workflow.yml> <needle>

Exits 0 if a REACHABLE step running the given needle (e.g. "test:e2e") is found,
1 otherwise, printing which check(s) failed and why.

Scope, stated plainly: this proves the step is not statically dead (no disqualifying
`if:` anywhere in its chain of gates). It does NOT prove the workflow trigger
(`on:`) itself fires on the PRs Brad actually opens, and it does NOT execute the
workflow (no `act` dependency, to keep this runnable in any environment without
Docker) -- it is a structural reachability check, not a full CI dry run.
"""
from __future__ import annotations

import sys
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - environment guard, not a test path
    print("ERROR: PyYAML is required (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)


def is_falsy_if(condition: Any) -> bool:
    """Best-effort check that an `if:` value is a hard "never run" gate.

    GitHub Actions `if:` expressions are arbitrary and we do not evaluate them
    (that would require a real Actions expression engine) -- but a LITERAL
    `false` (as a YAML boolean or the bare string "false") is unambiguous, and so
    is any expression that contains `failure()` (only true when an earlier step
    already failed -- exactly the "downstream of a failure branch" case A21 calls
    out) or `false` as a standalone token.
    """
    if condition is False:
        return True
    if not isinstance(condition, str):
        return False
    normalized = condition.strip()
    if normalized in ("false", "${{ false }}"):
        return True
    if "failure()" in normalized:
        return True
    return False


def step_matches_needle(step: dict, needle: str) -> bool:
    run = step.get("run")
    if not isinstance(run, str):
        return False
    for line in run.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if needle in stripped and ("pnpm" in stripped or "npm run" in stripped):
            return True
    return False


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <workflow.yml> <needle>", file=sys.stderr)
        return 2

    workflow_path, needle = sys.argv[1], sys.argv[2]

    with open(workflow_path, "r", encoding="utf-8") as f:
        workflow = yaml.safe_load(f)

    jobs = workflow.get("jobs", {}) if isinstance(workflow, dict) else {}
    if not jobs:
        print(f"FAIL: no jobs found in {workflow_path}", file=sys.stderr)
        return 1

    candidates_found = 0
    reasons: list[str] = []

    for job_name, job in jobs.items():
        if not isinstance(job, dict):
            continue

        job_if = job.get("if")
        if is_falsy_if(job_if):
            continue  # whole job is statically dead; steps in it can't be reachable

        steps = job.get("steps", [])
        if not isinstance(steps, list):
            continue

        # Track whether a prior step in this job has a disqualifying gate that
        # would make later un-gated steps run only after a failure (the
        # `continue-on-error` + implicit-failure-branch shape A21 names).
        prior_step_failed_and_continued = False

        for step in steps:
            if not isinstance(step, dict):
                continue

            if step_matches_needle(step, needle):
                candidates_found += 1
                step_if = step.get("if")

                if is_falsy_if(step_if):
                    reasons.append(
                        f"job '{job_name}': matching step has a disqualifying `if:` "
                        f"({step_if!r}) -- statically unreachable"
                    )
                    continue

                if prior_step_failed_and_continued:
                    reasons.append(
                        f"job '{job_name}': matching step follows a "
                        f"continue-on-error step with no explicit `if:` of its "
                        f"own guaranteeing it still runs on the ordinary path"
                    )
                    continue

                # Reachable: job isn't dead, step has no disqualifying `if:`, and
                # it isn't sitting downstream of an unconditional failure-branch.
                print(
                    f"PASS: job '{job_name}' runs a reachable step invoking "
                    f"'{needle}' (step if={step_if!r}, job if={job_if!r})"
                )
                return 0

            # A step with continue-on-error: true that itself has no `if:` means
            # steps after it in the SAME job could theoretically be argued to only
            # matter "if this one failed" in some workflows' intended design --
            # conservatively flag it so a later matching step earns extra scrutiny
            # rather than an automatic pass.
            if step.get("continue-on-error") is True and not step.get("if"):
                prior_step_failed_and_continued = True

    if candidates_found == 0:
        print(
            f"FAIL: no step invoking '{needle}' via pnpm/npm found in any job "
            f"in {workflow_path}",
            file=sys.stderr,
        )
    else:
        for reason in reasons:
            print(f"FAIL: {reason}", file=sys.stderr)

    return 1


if __name__ == "__main__":
    sys.exit(main())
