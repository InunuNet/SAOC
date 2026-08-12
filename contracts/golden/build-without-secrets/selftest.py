#!/usr/bin/env python3
"""META self-test for the build-without-secrets detectors (contract assertion A1).

Must run first, before A2-A9, because every later assertion trusts these tools
to actually detect what they claim to detect. Every proof here runs against a
synthetic fixture or a fast fake command in an isolated sandbox — NEVER against
the real repo's .env.local or a real 90-second `pnpm build` (that would make
every gate run pay the cost twice and risks the developer's real env file on
every fixture bug). The one place a real `pnpm build` genuinely has to run is
contract assertion A2 itself.

Proves, in order:
  1. extract_build_vars.py parses the real repo's CURRENT apphosting.yaml and
     returns exactly the 8 documented BUILD-only NEXT_PUBLIC_* vars — and
     REFUSES (nonzero exit) on a fixture where an admin secret has been
     promoted to BUILD-availability (fixtures/apphosting-fixtures/
     admin-promoted-to-build.yaml) — this is a second, independent line of
     defense against the forbidden shortcut, inside the tool itself.
  2. build_isolated.sh's backup/trap/restore machinery, exercised in an
     isolated sandbox directory against a synthetic .env.local (never the
     real one) with a fast fake build command:
       - succeeds and restores byte-identical when the fake build exits 0
       - still restores byte-identical when the fake build exits nonzero
       - genuinely uses `env -i` isolation: a variable exported in the
         parent shell is NOT visible inside the fake build command
     This is what makes A2 trustworthy: if the restore logic were broken,
     A2's real `pnpm build` run could corrupt the developer's actual
     .env.local, which content-modeling.md and this contract both treat as
     worse than the bug being fixed.
  3. check_no_prerendered_admin_routes.py, run against
     fixtures/sweep-fixture/ (a small synthetic app/ tree reproducing the
     shape of today's real repo):
       - flags the fixture's `marketing-tickets/page.tsx` (mirrors the real
         defect: no dynamic directive, transitively imports firebase-admin)
       - does NOT flag `admin/page.tsx` (cookies()-gated) or
         `force-dynamic-page/page.tsx`, but DOES report both as "reaches
         firebase-admin" in the safe list — proving the classifier reasons
         about rendering mode, not path-based exclusion
       - does NOT flag `client-page/page.tsx` ('use client') or
         `types-only-user/page.tsx` (only a type-only import reaches
         firebase-admin — proves the type-only-import exclusion is load-
         bearing: without it, most of the real site's pages would false-
         positive via the shared `types/index.ts` module, exactly as
         discovered when this checker was first prototyped against the
         real repo)
  4. check_apphosting_guard.py's three subcommands each pass against
     fixtures/apphosting-fixtures/clean.yaml (a copy of the real file) and
     each FAIL against its matching defect fixture
     (admin-promoted-to-build.yaml, renamed-circumvention.yaml,
     site-url-regressed.yaml) — a detector proven to only ever pass, or only
     ever fail, is not proven to work.
  5. Replays the ALREADY-CAPTURED real evidence
     (repro-build-defect.log, captured 2026-08-12 against the actual repo
     with .env.local genuinely absent and only the real apphosting.yaml's
     BUILD vars present) and asserts it contains the real prerendering error
     and a nonzero recorded exit code — this is the honest substitute for
     re-running the full 90-second `pnpm build` inside every self-test: the
     self-test proves the MECHANISM (extraction, isolation, restore) is
     correct via fast fixtures, and this step proves that mechanism, when
     run for real, DID produce the failure it claims to be able to catch.
     See README.md "Why replay, not re-run" for why this is not circular.

Usage: python3 selftest.py
Exit 1 and print every failed proof; exit 0 if every proof holds.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent.parent  # contracts/golden/build-without-secrets -> repo root
FIXTURES = HERE / "fixtures"

sys.path.insert(0, str(HERE))
import extract_build_vars as ebv  # noqa: E402
import check_no_prerendered_admin_routes as sweep  # noqa: E402

failures: list[str] = []


def check(label: str, condition: bool) -> None:
    if not condition:
        failures.append(f"FAILED: {label}")


# --- 1. extract_build_vars.py -------------------------------------------------
real_vars = dict(ebv.extract(str(REPO_ROOT / "apphosting.yaml")))
EXPECTED_BUILD_VARS = {
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
    "NEXT_PUBLIC_SANITY_DATASET",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
}
check(
    "extract_build_vars.py returns exactly the 8 documented BUILD-only vars from the real apphosting.yaml",
    set(real_vars.keys()) == EXPECTED_BUILD_VARS,
)
check(
    "extract_build_vars.py does NOT include any FIREBASE_ADMIN_* var from the real apphosting.yaml",
    not any("ADMIN" in k for k in real_vars),
)
try:
    ebv.extract(str(FIXTURES / "apphosting-fixtures" / "admin-promoted-to-build.yaml"))
    failures.append("FAILED: extract_build_vars.py did NOT refuse a fixture with an admin secret promoted to BUILD")
except ValueError:
    pass  # expected

# --- 2. build_isolated.sh backup/trap/restore, isolated sandbox --------------
BUILD_ISOLATED = HERE / "build_isolated.sh"
CLEAN_APPHOSTING = FIXTURES / "apphosting-fixtures" / "clean.yaml"


def run_sandboxed(fake_build: list[str], extra_env: dict[str, str] | None = None) -> tuple[int, str, bool]:
    """Copy build_isolated.sh + extract_build_vars.py + a synthetic .env.local
    into a fresh temp dir, run it there with a fake build command, and report
    (exit_code, restored_env_content, byte_identical)."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        shutil.copy(BUILD_ISOLATED, tmp_path / "build_isolated.sh")
        (tmp_path / "build_isolated.sh").chmod(0o755)
        shutil.copy(HERE / "extract_build_vars.py", tmp_path / "extract_build_vars.py")
        shutil.copy(CLEAN_APPHOSTING, tmp_path / "apphosting.yaml")
        original_content = "SELFTEST-SYNTHETIC-ENV-CONTENT-NOT-REAL\n"
        (tmp_path / ".env.local").write_text(original_content)

        import os

        env = {"PATH": os.environ.get("PATH", ""), "HOME": os.environ.get("HOME", str(tmp_path))}
        if extra_env:
            env.update(extra_env)
        result = subprocess.run(
            ["./build_isolated.sh", "./apphosting.yaml", "--", *fake_build],
            cwd=tmp_path,
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        restored = (tmp_path / ".env.local").read_text() if (tmp_path / ".env.local").exists() else None
        return result.returncode, result.stdout + result.stderr, restored == original_content


rc, out, identical = run_sandboxed(["true"])
check("build_isolated.sh exits 0 when the (fake) build succeeds", rc == 0)
check("build_isolated.sh restores .env.local byte-identical after a successful fake build", identical)
check("build_isolated.sh prints RESTORE-OK after a successful fake build", "RESTORE-OK" in out)

rc, out, identical = run_sandboxed(["false"])
check("build_isolated.sh propagates the fake build's nonzero exit code", rc == 1)
check("build_isolated.sh restores .env.local byte-identical even after a FAILED fake build", identical)

rc, out, identical = run_sandboxed(
    ["bash", "-c", '[ -z "${SELFTEST_LEAK:-}" ] && exit 0 || exit 7'],
    extra_env={"SELFTEST_LEAK": "leaked-value"},
)
check(
    "build_isolated.sh's env -i isolation hides a variable exported in the parent shell from the build command",
    rc == 0,
)

# --- 3. check_no_prerendered_admin_routes.py against the sweep fixture -------
sweep_root = FIXTURES / "sweep-fixture"
violations, skipped = sweep.sweep(sweep_root)
check(
    "sweep flags app/marketing-tickets/page.tsx (mirrors the real /tickets defect)",
    "app/marketing-tickets/page.tsx" in violations,
)
check("sweep flags exactly one violation in the fixture tree", len(violations) == 1)
skipped_paths = {rel for rel, _ in skipped}
check(
    "sweep does NOT flag app/admin/page.tsx as a violation (cookies()-gated)",
    "app/admin/page.tsx" not in violations,
)
check(
    "sweep DOES report app/admin/page.tsx as reaching firebase-admin (proves it's not blanket-excluded)",
    "app/admin/page.tsx" in skipped_paths,
)
check(
    "sweep does NOT flag app/force-dynamic-page/page.tsx (force-dynamic directive)",
    "app/force-dynamic-page/page.tsx" not in violations,
)
check(
    "sweep does NOT flag app/client-page/page.tsx ('use client')",
    "app/client-page/page.tsx" not in violations and "app/client-page/page.tsx" not in skipped_paths,
)
check(
    "sweep does NOT flag app/types-only-user/page.tsx (only a type-only import reaches firebase-admin)",
    "app/types-only-user/page.tsx" not in violations and "app/types-only-user/page.tsx" not in skipped_paths,
)

# --- 4. check_apphosting_guard.py, clean + each defect fixture ---------------
GUARD = HERE / "check_apphosting_guard.py"


def run_guard(yaml_path: Path, subcommand: str) -> int:
    return subprocess.run(
        [sys.executable, str(GUARD), str(yaml_path), subcommand],
        capture_output=True,
        text=True,
        timeout=15,
    ).returncode


AF = FIXTURES / "apphosting-fixtures"
for subcommand in ("admin-runtime-only", "no-build-secrets", "site-url-unchanged"):
    check(f"check_apphosting_guard.py {subcommand} passes on the clean fixture", run_guard(AF / "clean.yaml", subcommand) == 0)
    check(
        f"check_apphosting_guard.py {subcommand} passes on the REAL repo's current apphosting.yaml",
        run_guard(REPO_ROOT / "apphosting.yaml", subcommand) == 0,
    )

check(
    "check_apphosting_guard.py admin-runtime-only FAILS when an admin secret is promoted to BUILD",
    run_guard(AF / "admin-promoted-to-build.yaml", "admin-runtime-only") == 1,
)
check(
    "check_apphosting_guard.py no-build-secrets FAILS on a renamed-circumvention BUILD var",
    run_guard(AF / "renamed-circumvention.yaml", "no-build-secrets") == 1,
)
check(
    "check_apphosting_guard.py site-url-unchanged FAILS when SITE_URL regresses to the old Joomla domain",
    run_guard(AF / "site-url-regressed.yaml", "site-url-unchanged") == 1,
)

# --- 5. replay the already-captured real evidence -----------------------------
EVIDENCE = HERE / "repro-build-defect.log"
if not EVIDENCE.exists():
    failures.append(f"FAILED: {EVIDENCE} is missing — the real-repro evidence this self-test replays does not exist")
else:
    text = EVIDENCE.read_text()
    check(
        "captured evidence contains the real prerendering error for /tickets",
        "Error occurred prerendering page \"/tickets\"" in text,
    )
    check(
        "captured evidence contains the real 'Missing Firebase Admin credentials' message",
        "Missing Firebase Admin credentials" in text,
    )
    check(
        "captured evidence records a nonzero build exit code",
        "BUILD EXIT CODE: 1" in text,
    )
    check(
        "captured evidence records that .env.local was restored byte-identical afterwards",
        "RESTORE-OK" in text,
    )

if failures:
    print(f"{len(failures)} self-test proof(s) failed:\n")
    for f in failures:
        print(f"  {f}")
    sys.exit(1)

print("All build-without-secrets detector self-tests passed.")
sys.exit(0)
