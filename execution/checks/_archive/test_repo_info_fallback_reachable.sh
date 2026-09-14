#!/usr/bin/env bash
# F3 — asserts the fixed execution/repo_info.sh actually REACHES its git-remote
# fallback when `gh repo view` fails, not merely that the script parses/exits 0.
#
# Simulates a `gh` failure by stubbing a `gh` binary on PATH whose `auth status`
# succeeds (so the script enters the gh branch) but whose `repo view` exits
# non-zero. Under the pre-fix shape (no `|| true`), `set -euo pipefail` aborts
# the script at that failing command substitution and the fallback below never
# runs. Under the fixed shape, the substitution is guarded, REPO_SLUG ends up
# empty, and the script falls through to the git-remote fallback, which must
# still produce a correct OWNER/REPO answer from the real git remote.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_INFO="$SELF_DIR/../repo_info.sh"

WORK_DIR="$(mktemp -d)"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

STUB_BIN_DIR="$WORK_DIR/bin"
mkdir -p "$STUB_BIN_DIR"
cat > "$STUB_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
case "$1" in
    auth)
        exit 0
        ;;
    repo)
        exit 1
        ;;
    *)
        exit 1
        ;;
esac
EOF
chmod +x "$STUB_BIN_DIR/gh"

FAKE_REPO="$WORK_DIR/fake-repo"
mkdir -p "$FAKE_REPO"
git -C "$FAKE_REPO" init -q
git -C "$FAKE_REPO" remote add origin "https://github.com/InunuNet/Athanor.git"

EXIT_CODE=0
OUTPUT="$(cd "$FAKE_REPO" && PATH="$STUB_BIN_DIR:$PATH" bash "$REPO_INFO")" || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
    echo "FAIL: repo_info.sh exited $EXIT_CODE, expected 0 (fallback should have succeeded)" >&2
    exit 1
fi

if [ "$OUTPUT" != "InunuNet/Athanor" ]; then
    echo "FAIL: expected 'InunuNet/Athanor' from git-remote fallback, got '$OUTPUT'" >&2
    exit 1
fi

echo "PASS: repo_info.sh reached its git-remote fallback after simulated gh failure"
