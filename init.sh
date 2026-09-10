#!/usr/bin/env bash
# Athanor init.sh — Project Scaffolding (v3.3.5)
#
# Pure infrastructure. Interactive onboarding is handled by /onboard workflow.
#
# Usage:
#   bash init.sh                     # scaffold with defaults
#   bash init.sh --name "MyProject"  # explicit project name
#   bash init.sh --no-pulse          # skip pulse registration (CI / gates)
#
# Cross-platform: macOS, Linux, Windows (Git Bash / WSL)

# -E (errtrace) so the ERR trap below is inherited by every function and
# subshell — without it, a failure inside scaffold_core() or sync_all() aborts
# the script with the trap never firing, which is the silent-death this trap
# exists to end.
set -Eeuo pipefail

# ── Colors (skip if not a terminal) ──────────────────────────────────────────
if [ -t 1 ]; then
    GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
    DIM='\033[2m'; NC='\033[0m'
else
    GREEN=''; CYAN=''; YELLOW=''; DIM=''; NC=''
fi

# ── Fail loudly, never silently ──────────────────────────────────────────────
# `set -e` aborts on any unguarded non-zero exit and bash prints NOTHING when
# it does. A scaffold that dies at step 7 of 10 leaves a directory that LOOKS
# like a workspace — AGENTS.md, .agent/, hooks — but has no git repo, no synced
# agents, and never ran the placeholder-residue gate, with no error on screen
# and rc=1 an operator running interactively never sees. That is strictly worse
# than refusing up front, because the operator does not know to re-run.
#
# Every guard added below (`|| true` on the age-key grep, on the jq probe) fixes
# a specific known abort; this trap is the backstop for the ones nobody has hit
# yet. It reports WHICH stage died, WHICH command, and WHAT state the directory
# is in — the three things bash's own silence withholds.
SCAFFOLD_STAGE="startup"
on_scaffold_error() {
    local rc="$1" line="$2" cmd="$3"
    printf "\n${YELLOW}❌ init.sh aborted during: %s${NC}\n" "$SCAFFOLD_STAGE" >&2
    printf "${DIM}   failing command : %s\n" "$cmd" >&2
    printf "   init.sh line    : %s (exit %s)${NC}\n" "$line" "$rc" >&2
    printf "${YELLOW}   The workspace at %s is HALF-SCAFFOLDED and is NOT usable as-is:${NC}\n" \
        "${PROJECT_PATH:-$PWD}" >&2
    printf "${DIM}   every stage after the one above was skipped (that can include git init,\n" >&2
    printf "   agent/skill sync, and the placeholder-residue gate).\n" >&2
    printf "   Fix the cause and re-run 'bash init.sh' in the same directory — init.sh is\n" >&2
    printf "   idempotent and will complete the remaining stages.${NC}\n" >&2
}
trap 'on_scaffold_error "$?" "$LINENO" "$BASH_COMMAND"' ERR

# ── Detect platform ───────────────────────────────────────────────────────────
# ATHANOR_PLATFORM overrides (CI, cross-platform scaffold testing) honoured
# first, matching execution/platform_id.py / git_guard.py precedence
# (platform-aware-delivery D2). Falls back to uname -s.
detect_platform() {
    case "${ATHANOR_PLATFORM:-}" in
        macos|linux|windows) echo "$ATHANOR_PLATFORM"; return ;;
    esac
    case "$(uname -s 2>/dev/null)" in
        Darwin) echo "macos" ;;
        Linux)  echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

PLATFORM=$(detect_platform)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
# ── template/ — harness identity/config seed overlay ────────────────────────
# template/ is NOT what init.sh copies core harness scripts from. It seeds a
# small set of per-workspace identity/config defaults that only make sense
# pre-onboarding:
#   - template/.agent/profile.json        — profile seed (filled during /onboard)
#   - template/.agent/memory/project/*.md — default goals/learned/backlog/rules.md
#     (used as a fallback when this repo's own copies are missing)
#   - template/.agent/identity/           — default identity docs
#   - template/AGENTS.md                  — generic agent instructions fallback
#   - template/GITHUB.md                  — GitHub integration reference
#
# init.sh's actual executable scripts (brain.py, mission.py, execution/hooks/*.sh,
# etc.) are copied from $SCRIPT_DIR/execution — this repo's own LIVE execution/
# directory — NOT from template/execution/. See the `cp "$SCRIPT_DIR/execution/...`
# calls below. template/execution/ exists purely as the harness's own
# self-mirror: it is read ONLY by update_template.py (make update-template),
# never by init.sh. Keeping template/execution/ byte-identical to execution/ is
# enforced by execution/checks/verify_mirror_sync.py — init.sh plays no part in
# that sync and must not be assumed to.
#
# When to update template/:
#   - When changing a default identity/config seed that new workspaces should
#     start with pre-onboarding
#   - NOT for core harness script changes (those belong in execution/, and
#     must be mirrored to template/execution/ separately — see
#     verify_mirror_sync.py)
# ────────────────────────────────────────────────────────────────────────────
TEMPLATE_DIR="$SCRIPT_DIR/template"

# ── In-place delivery: src == dst is a NO-OP, not an error ───────────────────
# Boot scaffolds a NEW folder by running THAT folder's own init.sh against
# $PWD (REQUIREMENTS.md §0), so PROJECT_PATH == SCRIPT_DIR on every new
# project. `cp src dst` with both resolving to the same file exits 1 ("are
# identical (not copied)") and `set -e` then kills the run HALF-SCAFFOLDED —
# measured at two unguarded copies, `.agent/version` and
# `execution/checks/verify_no_symlink_stubs.py`. Both are deliberately
# unguarded (a silently-skipped copy there scaffolds a workspace whose audit
# is broken), so they route through this shim instead of gaining a `|| true`
# that would hide a real failure. `-ef` compares device+inode, so a hardlink
# or a symlink pointing back at the source is caught too.
#
# A DIRECTORY standing where the file belongs is a HARD FAILURE, never a
# success (codex QA round 1, finding 9). `cp file dir` copies the file INSIDE
# the directory and exits 0, so init reported a delivered `.agent/version`,
# finished at rc=0, and left a workspace whose every `cat .agent/version` —
# boot's banner, the update check, the Makefile — reads "Is a directory".
# Measured 2026-09-03: with `.agent/version` pre-created as a directory, init
# exited 0 and the directory survived with the version file nested inside it.
# These two deliveries are deliberately unguarded because a silently-skipped
# copy scaffolds a broken workspace; a silently-NESTED copy is the same defect
# wearing a green rc, so it must abort through the ERR trap like any other.
deliver_file() { # $1 = source, $2 = destination
    if [ -d "$2" ]; then
        printf "${YELLOW}❌ Cannot deliver %s: a DIRECTORY stands where that file belongs.${NC}\n" \
            "$(basename -- "$1")" >&2
        printf "${DIM}   %s\n" "$2" >&2
        printf "   Copying into it would report success and leave the workspace unable to\n" >&2
        printf "   read the file. Remove or rename that directory and re-run init.sh.${NC}\n" >&2
        return 1
    fi
    if [ -e "$2" ] && [ "$1" -ef "$2" ]; then
        return 0
    fi
    cp "$1" "$2"
}

# ── Parse flags ───────────────────────────────────────────────────────────────
PROJECT_PATH="$PWD" # Default to current directory if --path is not provided
PROJECT_NAME="$(basename "$PWD")" # Default project name
NO_PULSE="false"    # --no-pulse: skip manage_pulse.sh register
NAME_EXPLICIT="false" # true once --name/--name= is seen on the command line

# The workspace's NEW/ESTABLISHED disposition, DECIDED ONCE by
# decide_disposition() and read by write_profile, dispose_memory and
# setup_instructions (clean-scaffold D-5). It is deliberately a shared value
# rather than a per-consumer probe of .agent/profile.json: D-2 makes the
# onboarding flag single-reader, and a second inline read would be exactly the
# drifting dialect that rule exists to prevent. decide_disposition() runs as
# main()'s first stage after preflight, before the first byte is written, so
# every consumer sees the disposition of the tree as the OPERATOR handed it
# over — not as init.sh has since reshaped it.
WORKSPACE_ESTABLISHED="false"

# Set by reserve_quarantine() to the quarantine directory this run created and
# its basename; both empty until something is actually quarantined. ONE
# directory per run, shared by every disposer (inherited memory, inherited
# config, inherited root instruction files) — scaffold-identity-integrity A2
# and copied-project-halt A5 both assert EXACTLY ONE quarantine directory, and
# an operator hunting for their data should have one place to look.
QUARANTINE_DIR=""
QUARANTINE_BASENAME=""

# Placeholder residue allowlist (scaffold-identity-integrity D1). The ONLY
# sanctioned `{{TOKEN}}` residue in a delivered workspace: launchd plists are
# INSTALL-time templates whose {{PROJECT_ROOT}} is filled by `make
# install-pulse`, not by init.sh. Kept as data, in one place, so the next
# exemption is a reviewed diff rather than a shrug.
PLACEHOLDER_RESIDUE_ALLOWLIST=( '*.plist' )

# HARNESS SOURCE IS NOT A DELIVERED INSTRUCTION (first-boot-e2e A1, defect D2).
# The operator's scaffold path leaves the WHOLE harness checkout standing in the
# project folder — clone Athanor, `cd` in, `bash init.sh --name <Proj>` — and
# every tree below carries literal `{{TOKEN}}` text ON PURPOSE: `template/` is
# the template SOURCE whose tokens are the point, `docs/` documents the token
# mechanism, `Makefile` holds the sed recipes that fill `{{PROJECT_ROOT}}` at
# install time, and `init.sh` and `execution/` carry this gate's own prose about
# the tokens it hunts. init.sh RENDERS none of them, so a token there can never
# be a half-written instruction this run delivered.
#
# EXCLUDING THE SOURCE DOES NOT WEAKEN THE GATE, because every file init.sh
# renders is still scanned AT ITS DESTINATION: `template/AGENTS.md` is exempt,
# the `AGENTS.md` it is rendered into is not. A token that survives the fill is
# still caught exactly where the operator would meet it.
#
# Path prefixes relative to PROJECT_PATH, matched literally. A trailing `/`
# means a directory tree; no trailing `/` means that one file.
PLACEHOLDER_RESIDUE_SOURCE_PREFIXES=( 'template/' 'docs/' 'execution/' 'init.sh' 'Makefile' )

# Argument parsing. EVERY refusal below lands before the `mkdir -p
# "$PROJECT_PATH"` that follows this loop, so a rejected invocation writes
# nothing at all (bootstrap-integrity A2_3).
arg_die() { # $1 = operator-facing reason
    printf "${YELLOW}❌ %s${NC}\n" "$1" >&2
    printf "${DIM}   usage: bash init.sh [--name NAME] [--path PATH] [--no-pulse]${NC}\n" >&2
    exit 1
}

# A VALUE that begins with `-` is a slip of the fingers, not a value
# (bootstrap-integrity D3). Rejecting the unknown flag `--nmae` closed one door;
# `bash init.sh --path WS --name --path` walked through the next one, because
# `--name` took `--path` as its value and the run then re-scaffolded the
# EXISTING workspace under the name `--path` at rc=0 — the same P0 wearing a
# different typo. Measured: 7 paths written, WORKSPACE renamed, three root
# instruction files quarantined.
#
# Only the SEPARATE-TOKEN spelling is guarded. `--name=-Weird` is unambiguous —
# the operator typed the `=`, so the value cannot be a flag they meant to pass —
# and stays accepted as the escape hatch for the rare name that really does
# begin with a dash.
arg_value_or_die() { # $1 = flag, $2 = the token that followed it
    case "$2" in
        -*) arg_die "$1 requires a value, but the next argument is another flag: $2" ;;
    esac
}

# A flag given twice states two intents and init.sh cannot know which one the
# operator meant. Last-wins is what the loop did before, and it is the wrong
# default HERE: `--path A --path B` silently scaffolded a second 340-file
# workspace at B while the operator watched a transcript that named only one.
# Refusing costs a re-run; guessing costs a directory nobody asked for.
NAME_SEEN="false"
PATH_SEEN="false"

while [ $# -gt 0 ]; do
    case "$1" in
        --name=*|--name)
            [ "$NAME_SEEN" = "false" ] || arg_die "--name given more than once — say it once."
            if [ "$1" = "--name" ]; then
                [ $# -ge 2 ] || arg_die "--name requires a value."
                arg_value_or_die "--name" "$2"
                PROJECT_NAME="$2"; shift 2
            else
                PROJECT_NAME="${1#*=}"; shift
            fi
            NAME_EXPLICIT="true"; NAME_SEEN="true" ;;
        --path=*|--path)
            [ "$PATH_SEEN" = "false" ] || arg_die "--path given more than once — say it once."
            if [ "$1" = "--path" ]; then
                [ $# -ge 2 ] || arg_die "--path requires a value."
                arg_value_or_die "--path" "$2"
                PROJECT_PATH="$2"; shift 2
            else
                PROJECT_PATH="${1#*=}"; shift
            fi
            PATH_SEEN="true" ;;
        # Repeating --no-pulse is idempotent and carries no value, so there is
        # nothing to disambiguate and nothing to refuse.
        --no-pulse) NO_PULSE="true"; shift ;;
        *) arg_die "Unrecognised argument: $1" ;;
    esac
done

# Resolve absolute path for PROJECT_PATH and create it if it doesn't exist
mkdir -p "$PROJECT_PATH"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd -P)"

# Determine PROJECT_NAME
#
# An EXPLICIT --name wins over an existing WORKSPACE. It used to lose, silently:
# init.sh read WORKSPACE and never mentioned that the flag it had just been
# handed was being discarded. That made the harness-collision warning below
# ("Re-run with a different name: bash init.sh --name MyProject") advice that
# provably does nothing — the operator re-runs exactly as told, sees "Reading
# project name from WORKSPACE", gets the same unonboardable workspace at rc=0,
# and has no way to tell why. A printed remedy that the script itself ignores is
# worse than no remedy. --name is the operator stating intent; honour it.
if [ "$NAME_EXPLICIT" = "true" ]; then
    if [ -f "$PROJECT_PATH/WORKSPACE" ]; then
        _WORKSPACE_NAME=$(head -n 1 "$PROJECT_PATH/WORKSPACE" | tr -d '\n\r')
        if [ "$_WORKSPACE_NAME" != "$PROJECT_NAME" ]; then
            printf "${YELLOW}   ⚠ Renaming workspace: WORKSPACE holds %s, --name says %s — --name wins.${NC}\n" \
                "'$_WORKSPACE_NAME'" "'$PROJECT_NAME'"
        fi
    fi
    printf "${DIM}   Using project name from --name: %s${NC}\n" "$PROJECT_NAME"
elif [ -f "$PROJECT_PATH/WORKSPACE" ]; then
    PROJECT_NAME=$(head -n 1 "$PROJECT_PATH/WORKSPACE" | tr -d '\n\r')
    printf "${DIM}   Reading project name from WORKSPACE: %s${NC}\n" "$PROJECT_NAME"
else
    # If --name was not provided, use the directory name, otherwise use the provided name
    if [ "$PROJECT_NAME" = "$(basename "$PWD")" ] && [ -n "$PROJECT_PATH" ]; then
        PROJECT_NAME="$(basename "$PROJECT_PATH")"
    fi
    printf "${DIM}   Deriving project name from directory: %s${NC}\n" "$PROJECT_NAME"
fi

# ── Harness identity ──────────────────────────────────────────────────────────
# The harness's OWN name, read from its own profile rather than hard-coded, so a
# fork or a renamed harness stays coherent downstream (scaffold-identity D4).
harness_name() {
    local hn
    hn=$(python3 - "$SCRIPT_DIR/.agent/profile.json" 2>/dev/null <<'PYHARNESS'
import json, sys
try:
    p = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    print((p.get('harness_name') or '').strip())
except Exception:
    print('')
PYHARNESS
    )
    [ -n "$hn" ] || hn="Athanor"
    printf '%s' "$hn"
}

# Sanitize project name
#
# NOT `tr -cd '[:alnum:]_. -'`. tr's [:alnum:] is LOCALE-DEPENDENT: on a UTF-8
# host it keeps accented and non-Latin letters, but under the POSIX/C locale —
# the default in Docker images and most CI runners — it keeps ASCII only. Same
# script, same folder name, two different outcomes decided by an environment
# variable nobody set on purpose: `Café` was silently delivered as `Caf`, and
# `проект` sanitized away to nothing and was REFUSED outright at rc=1, so the
# project could not be scaffolded at all. Neither host can observe the other's
# behaviour, so no golden run on a UTF-8 developer machine can ever catch it.
#
# python3 is a hard dependency of this harness (preflight enforces it) and its
# alphanumeric test is Unicode-defined, so it gives one answer on every host.
# The accepted set is unchanged from the UTF-8 reading of the old expression:
# alphanumerics in any script, plus `_ . -` and space.
if ! command -v python3 >/dev/null 2>&1; then
    printf "${YELLOW}❌ Required tool 'python3' not found in PATH. Install it and re-run.${NC}\n" >&2
    exit 1
fi
#
# The heredoc that used to live here now lives in execution/name_sanitize.py as
# workspace(), with identical behaviour. REQUIREMENTS §3 requires the git
# provisioning tool to REUSE this sanitiser rather than write a second dialect,
# and two copies of it would drift the way verify_mirror_sync.py exists to
# catch — so there is exactly one implementation and init.sh calls it.
# `|| true` because name_sanitize exits 3 (printing nothing) on a name that
# sanitizes away; the emptiness check immediately below is what reports that,
# and `set -e` would otherwise kill the run before it could.
RAW_PROJECT_NAME="$PROJECT_NAME"
PROJECT_NAME="$(python3 "$SCRIPT_DIR/execution/name_sanitize.py" workspace "$PROJECT_NAME" || true)"

# WORKSPACE is written from the SANITIZED name, never the raw one. Every other
# consumer (profile.project_name, the name filled into the delivered AGENTS.md)
# sees the sanitized value, and the delivered §0 boot check tells the agent to
# STOP unless all three agree -- so writing the raw name here handed a brand-new
# project a workspace that halts on its first boot. Tell the operator when the
# folder they created and the project they get differ, because they will not
# otherwise know why the name changed.
# A name that sanitizes away to nothing -- or to whitespace alone -- is not a
# name, and the scaffold used to deliver it anyway at rc=0: WORKSPACE=<>,
# profile.project_name=<>, an AGENTS.md reading "primary agent of ", and a boot
# banner still announcing the RAW folder name. That four-way disagreement halts
# the workspace on its first boot at the very §0 check this sanitizer exists to
# satisfy. REFUSE rather than substitute a derived default: a name nobody chose
# is the same falsehood scaffold-identity D2 removed when it stopped asserting
# 'Athanor Agent', and it would be silently baked into every delivered clone.
if [ -z "$(printf '%s' "$PROJECT_NAME" | tr -d '[:space:]')" ]; then
    printf "${YELLOW}❌ Project name %s has no usable characters.${NC}\n" "'$RAW_PROJECT_NAME'" >&2
    printf "${DIM}   Names are restricted to letters, digits, and _ . - and space; this one\n" >&2
    printf "   sanitizes to nothing, which would scaffold a workspace with an empty\n" >&2
    printf "   WORKSPACE, an empty profile.project_name and a nameless AGENTS.md.\n" >&2
    printf "   Rename the directory, or pass a name explicitly:\n" >&2
    printf "     bash init.sh --name \"MyProject\"${NC}\n" >&2
    exit 1
fi
if [ "$PROJECT_NAME" != "$RAW_PROJECT_NAME" ]; then
    printf "${YELLOW}   ⚠ Project name sanitized: %s -> %s${NC}\n" "$RAW_PROJECT_NAME" "$PROJECT_NAME"
    printf "${DIM}     (WORKSPACE, profile.json and AGENTS.md will all use the sanitized name.)${NC}\n"
    # Sanitizing INTO the harness's own name is a worse outcome than a changed
    # name and the operator is not otherwise told: onboard_headless refuses a
    # workspace whose WORKSPACE holds the harness name (GH #1369), so the
    # scaffold succeeds and then cannot be onboarded at all. Say so here.
    if [ "$PROJECT_NAME" = "$(harness_name)" ]; then
        printf "${YELLOW}     ⚠ That sanitized name is the HARNESS name (%s), so this workspace\n" "$PROJECT_NAME" >&2
        printf "       cannot be onboarded — onboard_headless.py refuses to rewrite a\n" >&2
        printf "       WORKSPACE holding the harness identity. Re-run with a different\n" >&2
        printf "       name: bash init.sh --name \"MyProject\"${NC}\n" >&2
    fi
fi
if [ ! -f "$PROJECT_PATH/WORKSPACE" ] || \
   [ "$(head -n 1 "$PROJECT_PATH/WORKSPACE" | tr -d '\n\r')" != "$PROJECT_NAME" ]; then
    printf '%s\n' "$PROJECT_NAME" > "$PROJECT_PATH/WORKSPACE"
fi

# ── Preflight checks ──────────────────────────────────────────────────────────
# ── Git environment + nesting, decided BEFORE anything is written ─────────────
# GIT_DIR and GIT_WORK_TREE OVERRIDE `-C`, so `git -C "$PROJECT_PATH" rev-parse`
# could report the target's own root while every write landed in another
# repository entirely. Every git call in this script goes through git_clean().
git_clean() {
    env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_OBJECT_DIRECTORY \
        -u GIT_ALTERNATE_OBJECT_DIRECTORIES -u GIT_COMMON_DIR -u GIT_NAMESPACE \
        git "$@"
}

# NESTED_OUTER is the work tree this folder sits INSIDE, or empty. It is
# computed in preflight, before the first file is written, because the answer
# decides whether writing is allowed at all: setup_gitignore used to merge into
# the operator's .gitignore and only then did setup_git discover the folder
# could never be its own repository — a file inside SOMEONE ELSE'S repo,
# mutated on the way to a refusal.
NESTED_OUTER=""
detect_nesting() {
    local here outer
    here="$(cd "$PROJECT_PATH" && pwd -P)"
    if outer="$(git_clean -C "$PROJECT_PATH" rev-parse --show-toplevel 2>/dev/null)"; then
        outer="$(cd "$outer" && pwd -P)"
    else
        outer=""
    fi
    if [ -n "$outer" ] && [ "$outer" != "$here" ]; then
        NESTED_OUTER="$outer"
        printf "${YELLOW}   ⚠️  NOT initialising a git repository here.${NC}\n"
        printf "${DIM}     %s is inside another git work tree at %s.\n" "$here" "$outer" >&2
        printf "     The project folder must BE the repository root, so nesting one\n" >&2
        printf "     repository inside another is refused. Move this folder outside\n" >&2
        printf "     that work tree and re-run init.sh.\n" >&2
        printf "     Files that belong to the OUTER repository — an existing\n" >&2
        printf "     .gitignore above all — are left untouched.${NC}\n" >&2
    fi
}

preflight() {
    for cmd in python3 git; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            printf "${YELLOW}❌ Required tool '%s' not found in PATH. Install it and re-run.${NC}\n" "$cmd" >&2
            exit 1
        fi
    done
    if [ ! -f "$TEMPLATE_DIR/.agent/profile.json" ]; then
        printf "${YELLOW}❌ Template missing at %s/.agent/profile.json${NC}\n" "$TEMPLATE_DIR" >&2
        printf "   init.sh must be run from within the Athanor clone directory.\n" >&2
        exit 1
    fi
    # A scaffold that guesses installs a harness that looks complete and is
    # not (platform-scoped-delivery D1, mirroring platform-aware-delivery
    # D2's ambiguity-is-fatal rule) -- refuse rather than deliver zero or
    # every Tier-3 platform dir.
    if [ "$PLATFORM" = "unknown" ]; then
        printf "${YELLOW}❌ Could not detect platform (uname: %s). Re-run with ATHANOR_PLATFORM=<macos|linux|windows>.${NC}\n" "$(uname -s 2>/dev/null)" >&2
        exit 1
    fi
    detect_nesting
}

# ── Workspace disposition ─────────────────────────────────────────────────────
# THE ONE READ of .agent/profile.json inside init.sh, taken BEFORE the first
# byte is written. Every later stage — dispose_memory, write_profile,
# setup_instructions — consumes WORKSPACE_ESTABLISHED rather than re-probing,
# so they cannot disagree about whether this folder is a live workspace or a
# directory being scaffolded (clean-scaffold D-2/D-5).
#
# It runs FIRST because scaffold_core writes seeds into the very tree the
# answer is about: probed afterwards, an inherited profile would already have
# been overwritten, and inherited memory would already be indistinguishable
# from memory init.sh had just laid down.
#
# ESTABLISHED iff the profile NAMES a workspace of its own (project_name is
# present and non-empty) AND (self_repo OR not an inherited harness clone).
# This replaces the GH #1286 + QA-round-2 rule, which gated on
# onboarding_complete instead of project_name: a workspace that renamed itself
# but never finished the onboarding interview (Omarchy, 2026-09-05, D9) read as
# not-established and had its own memory — and identity/soul.md, user.md next
# to it — quarantined as if it were foreign. Establishment is an identity
# question, not an onboarding milestone (scaffold-identity-integrity D-F4-2,
# extended by workspace-owns-its-memory F17/D9). The memory FOLLOWS the
# profile: if init.sh may reset the profile to fresh defaults, the memory next
# to it cannot be this workspace's own; if init.sh preserves the profile, the
# memory is workspace property.
#
# NOT execution/workspace_state.py: that reader answers §0's boot question and
# has no self_repo clause — it classifies the harness's own checkout by folder
# name, so it reads Athanor's real checkout in a differently-named directory as
# an inherited clone. init.sh knows something a boot hook cannot: whether
# PROJECT_PATH is the directory this very script lives in.
decide_disposition() {
    local target="$PROJECT_PATH/.agent/profile.json"
    local ATHANOR_MARKER_PROJECT_NAME="Athanor"
    # SELF-REPO IS NOT "THE SCRIPT LIVES HERE" (first-boot-e2e A1, defect D3).
    # `PROJECT_PATH == SCRIPT_DIR` was the whole test, and the operator's
    # scaffold path satisfies it on EVERY run: they clone the harness, `cd`
    # into the clone, and run `bash init.sh --name <Proj>` from inside it. So
    # the exception written to protect the harness's own checkout from being
    # reset shielded every copied harness instead — the profile was preserved
    # with `project_name: Athanor` and `onboarding_complete: true`, the
    # inherited memory was never disposed, the instruction files were never
    # filled, and the residue gate then refused the scaffold over the very
    # tokens that decision had left behind.
    #
    # THE HARNESS'S OWN CHECKOUT IS NAMED AFTER THE HARNESS. That is the clause
    # a copy cannot satisfy: an operator who resolved a DIFFERENT project name
    # for this folder has said it is a new project, whichever directory the
    # script happens to sit in. harness_name() reads the harness's own profile
    # rather than a literal, so a renamed fork stays coherent (D4).
    local self_repo="false"
    if [ "$PROJECT_PATH" = "$SCRIPT_DIR" ] && [ "$PROJECT_NAME" = "$(harness_name)" ]; then
        self_repo="true"
    fi
    [ -f "$target" ] || return 0

    # INHERITED_CLONE IS A TEST ON THE PROJECT NAME ALONE (Codex finding 1,
    # 2026-09-05). It used to also require identity.agent_name == "gem", which
    # made a half-matching clone — profile still claiming the harness name,
    # but converted to a fork with a renamed persona — read as NOT inherited
    # and so ESTABLISHED, adopting a foreign memory corpus as its own. A
    # workspace converted from a clone but never onboarded has had no identity
    # interview, so its agent_name may still be the harness's regardless;
    # requiring both markers together let that case slip through. Removing
    # the agent_name half removes the half-match by construction:
    #
    #   inherited_clone := project_name == "Athanor" (the marker literal)
    #                      OR project_name == harness_name() (a renamed fork)
    #
    # Cost, stated: a project literally named "Athanor" is quarantined unless
    # self_repo — already true of onboard_headless (GH #1369) and the
    # init.sh:315 self-repo warning.
    local harness_name_now
    harness_name_now="$(harness_name)"

    local named_workspace inherited_clone
    read -r named_workspace inherited_clone <<< "$(
        ATH_MARKER_PROJECT="$ATHANOR_MARKER_PROJECT_NAME" \
        ATH_HARNESS_NAME="$harness_name_now" \
        python3 - "$target" <<'PYPROBE' 2>/dev/null
import json, os, sys
try:
    p = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    pname = p.get('project_name')
    named = bool((pname or '').strip())
    inherited = (pname == os.environ['ATH_MARKER_PROJECT']
                 or pname == os.environ['ATH_HARNESS_NAME'])
    print('true' if named else 'false', 'true' if inherited else 'false')
except Exception:
    print('false', 'false')
PYPROBE
    )"
    if [ "$named_workspace" = "true" ] && { [ "$self_repo" = "true" ] || [ "$inherited_clone" != "true" ]; }; then
        WORKSPACE_ESTABLISHED="true"
    fi
    return 0
}

# ── Inherited workspace memory: QUARANTINE, never purge ───────────────────────
# Measured 2026-09-02: scaffolding over a directory COPY of the harness left
# 151 of Athanor's mission files, its brain, its specs, its telemetry and its
# reboot notes sitting in the new project — and the inherited mission corpus
# carries literal `{{AGENT_NAME}}` prose, so the placeholder-residue gate then
# refused the scaffold at rc=1 blaming the operator for "half-written
# instructions" nobody wrote. The leak and the misleading refusal are one
# defect: memory that belongs to another workspace was still in the tree.
#
# The ruling (scaffold-identity-integrity D-F4-1) is QUARANTINE:
#   - PURGE is unacceptable. Classification is heuristic, and brain/, telemetry/
#     and scratch/ are recoverable from no repository on earth. A wrong answer
#     must cost the operator an inspection, not their data.
#   - REFUSE contradicts init.sh's own advertised idempotence (the ERR trap
#     tells the operator to re-run in place) and strands the fork-by-copy
#     operator with no way forward except a hand `rm -rf` — the destructive act
#     we were avoiding, performed less carefully, by a human.
# So the tree is MOVED, wholesale, into one loud, gitignored
# .agent/memory-quarantine-<UTC>/ whose path init.sh prints. Nothing is
# deleted, and the subtree layout under .agent/memory/ is preserved so the
# operator can copy back exactly what they want.

# The seed-class set (D-F4-3): the files init.sh ITSELF lays down under
# .agent/memory/. Quarantine triggers on content BEYOND this set, never on the
# mere existence of .agent/memory — otherwise running init.sh twice on a fresh
# scaffold would quarantine the seeds it had just written. A path missing from
# this list causes a FALSE-POSITIVE quarantine: noisy and fully recoverable,
# which is the safe direction to fail in. The allowlist decides WHETHER; the
# move is always the WHOLE tree, so nothing can be half-disposed.
MEMORY_SEED_CLASS=(
    "project/goals.md"
    "project/learned.md"
    "project/backlog.md"
    "project/session_log.md"
    "project/rules.md"
)

memory_has_foreign_content() { # 0 = there is workspace history here
    local mem="$PROJECT_PATH/.agent/memory"
    [ -d "$mem" ] || return 1
    local entry rel seed known
    # Read find's output into a variable FIRST, then loop over the variable
    # (via a here-string) instead of a live process-substitution pipe. This
    # loop can `return` from its middle on the first foreign path it finds;
    # doing that while `find` is still writing into a process substitution
    # closes the read end out from under it, `find` dies of SIGPIPE (141),
    # and bash's ERR trap reaps that status and fires the false abort banner
    # even though the run goes on to succeed. A here-string has no writer
    # process to SIGPIPE, so an early return here is inert.
    #
    # find's exit status is kept, and a non-zero one answers "yes, foreign"
    # without looking at a single path. An unreadable subtree makes find skip
    # it silently and exit non-zero; the output that survives is then a partial
    # listing that can contain nothing but seed-class paths, and a scan that
    # never saw the inherited memory would report the workspace clean and let
    # it through unquarantined. That is the one direction this check must never
    # fail in, so an incomplete scan is treated exactly like a foreign file:
    # quarantining a tree we could not fully read costs the operator an
    # inspection, missing one costs them their new project's identity. The
    # status is captured with an `&& ... || ...` pair rather than a bare
    # assignment so errexit sees a tested command and lets the scaffold go on
    # to quarantine instead of aborting here.
    local found find_status
    found="$(find "$mem" ! -type d 2>/dev/null)" && find_status=0 || find_status=$?
    [ "$find_status" -eq 0 ] || return 0
    while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        rel="${entry#"$mem"/}"
        case "$(basename -- "$rel")" in
            .keep) continue ;;
        esac
        known="false"
        for seed in "${MEMORY_SEED_CLASS[@]}"; do
            if [ "$rel" = "$seed" ]; then
                known="true"
                break
            fi
        done
        [ "$known" = "true" ] || return 0
    done <<< "$found"
    return 1
}

# ATOMIC NAME RESERVATION, the same pattern write_profile uses for the
# unreadable-profile rescue: `mkdir` is POSIX's atomic test-and-create, so
# exactly one racer can win a given name and the loser retries with the next
# suffix. A check-then-act loop could let two runs in the same second settle on
# one path and have the second `mv` land on top of the first run's rescue —
# quarantine that overwrites quarantine is a purge with extra steps.
#
# ONE per run, memoised in QUARANTINE_DIR. Never call this in a command
# substitution: that runs it in a subshell and the assignment is lost, so the
# next caller reserves a SECOND directory and the "exactly one" assertions turn
# red. Call it, then read the global.
reserve_quarantine() {
    [ -z "$QUARANTINE_DIR" ] || return 0
    local base qdir n
    mkdir -p "$PROJECT_PATH/.agent"
    base="$PROJECT_PATH/.agent/memory-quarantine-$(date -u +"%Y%m%dT%H%M%SZ" 2>/dev/null || echo unknown)"
    qdir="$base"
    n=1
    until mkdir "$qdir" 2>/dev/null; do
        qdir="$base.$n"
        n=$((n + 1))
        if [ "$n" -gt 1000 ]; then
            printf "${YELLOW}❌ Could not reserve a quarantine name for inherited workspace memory.${NC}\n" >&2
            printf "${DIM}   1000 candidates under %s are already taken. Move the old\n" "$base" >&2
            printf "   memory-quarantine-* directories out of the way and re-run init.sh.${NC}\n" >&2
            exit 1
        fi
    done
    QUARANTINE_DIR="$qdir"
    QUARANTINE_BASENAME="$(basename -- "$qdir")"
}

# Install one delivered file, PRESERVING whatever different thing stands there.
#   $1 = the source to install, or "" to quarantine the destination and put
#        nothing back (a file the harness does not deliver at all)
#   $2 = destination, relative to PROJECT_PATH
#   $3 = where it lands inside the quarantine, relative to the quarantine root
#   $4.. = other HARNESS-OWNED sources whose bytes mean "this is not the
#        operator's work" — see below
#
# Identical bytes are left untouched — that is what keeps a re-run from
# quarantining what the previous run delivered (scaffold-identity-integrity
# A1's "an immediate re-run creates no quarantine").
#
# THE HARNESS-OWNED LIST IS NOT OPTIONAL POLISH. A project is normally started
# by copying a harness CLONE, so the folder arrives carrying the harness's OWN
# AGENTS.md, CLAUDE.md, GEMINI.md and .agent/config/ — bytes every clone has,
# that no operator authored, and that the scaffold exists to replace. Measured
# 2026-09-03: quarantining those turned copied-project-halt A2/A4/A5 red, all
# three on a quarantine directory appearing where the assertion requires none.
# Matching any known harness source means "replace in place, preserve nothing";
# anything else is the operator's and is moved aside first.
#
# A symlink is never dereferenced and never overwritten in place: the bytes live
# at its target, which is not this scaffold's to rewrite (the same ruling
# write_profile reached for a symlinked profile.json). The LINK itself is moved
# into the quarantine, so the operator's pointer is preserved and its target
# untouched.
install_preserving() {
    local src="$1" rel="$2" qrel="$3"
    shift 3
    local dest="$PROJECT_PATH/$rel" known
    if [ -f "$dest" ] && [ ! -h "$dest" ]; then
        if [ -n "$src" ] && cmp -s "$src" "$dest"; then
            return 0
        fi
        for known in "$@"; do
            [ -n "$known" ] && [ -f "$known" ] || continue
            if cmp -s "$known" "$dest"; then
                if [ -n "$src" ]; then
                    cp "$src" "$dest" 2>/dev/null || true
                fi
                return 0
            fi
        done
    fi
    if [ -e "$dest" ] || [ -h "$dest" ]; then
        reserve_quarantine
        mkdir -p "$QUARANTINE_DIR/$(dirname -- "$qrel")"
        if ! mv -- "$dest" "$QUARANTINE_DIR/$qrel"; then
            printf "${YELLOW}❌ Could not quarantine inherited %s: %s${NC}\n" "$rel" "$dest" >&2
            printf "${DIM}   Nothing was deleted. Fix the permissions on %s and re-run init.sh.${NC}\n" \
                "$PROJECT_PATH" >&2
            exit 1
        fi
        printf "${YELLOW}   ⚠ %s already existed and differed — QUARANTINED, not deleted:${NC}\n" "$rel" >&2
        printf "${DIM}     .agent/%s/%s${NC}\n" "$QUARANTINE_BASENAME" "$qrel" >&2
    fi
    [ -n "$src" ] || return 0
    cp "$src" "$dest" 2>/dev/null || true
}

# Inherited RUNTIME CONFIG, outside .agent/memory (codex QA round 1, finding 6).
# Measured 2026-09-03: a copied project's `.agent/config/free_models.json` and
# `stack_probes.json` survived the COPY answer untouched, and
# `execution/dispatch_free_model.py` reads that file at RUNTIME — so the new
# project dispatched against whatever catalogue the source project was carrying.
#
# PRESENCE IS NOT THE TRIGGER, AND MUST NOT BE. `.agent/config/` is HARNESS
# property: both files are mirrored into template/ and verified byte-identical
# by verify_mirror_sync.py, so a project scaffolded from a harness clone
# legitimately carries the harness's own copies. Quarantining those would
# destroy nothing but WOULD create a quarantine directory on an ordinary clean
# scaffold — measured, and it turned copied-project-halt A2/A4/A5 red on their
# "exactly one / no quarantine" clauses.
#
# So the rule is DELIVERY, not detection: the harness's copy is installed, and
# only a file that DIFFERS from it (the source project's edit) or that the
# harness does not deliver at all (the source project's own file) is moved
# aside first. Identical bytes are left exactly where they are.
dispose_config() {
    local cfg="$PROJECT_PATH/.agent/config"
    local tdir="$TEMPLATE_DIR/.agent/config"
    local entry name
    if [ -d "$tdir" ]; then
        for entry in "$tdir"/*; do
            [ -f "$entry" ] || continue
            name="$(basename -- "$entry")"
            mkdir -p "$cfg"
            install_preserving "$entry" ".agent/config/$name" "config/$name" \
                "$SCRIPT_DIR/.agent/config/$name"
        done
    fi
    [ -d "$cfg" ] || return 0
    for entry in "$cfg"/*; do
        [ -f "$entry" ] || continue
        name="$(basename -- "$entry")"
        if [ -f "$tdir/$name" ]; then
            continue
        fi
        # No harness counterpart: this file came with the directory copy.
        install_preserving "" ".agent/config/$name" "config/$name"
    done
}

dispose_memory() {
    # An ESTABLISHED workspace owns every byte of its memory. Same verdict that
    # protects its profile, so the two can never disagree (D-F4-2).
    if [ "$WORKSPACE_ESTABLISHED" = "true" ]; then
        return 0
    fi

    dispose_config

    memory_has_foreign_content || return 0

    local mem="$PROJECT_PATH/.agent/memory"
    local ident="$PROJECT_PATH/.agent/identity"

    reserve_quarantine
    local qdir="$QUARANTINE_DIR"

    # MOVE, entry by entry, into the directory this run alone just created — so
    # no `mv` can ever land on top of an existing file. Dotfiles are matched
    # explicitly: `.agent/memory/.something` is workspace state like any other.
    local entry
    for entry in "$mem"/* "$mem"/.[!.]* "$mem"/..?*; do
        [ -e "$entry" ] || [ -h "$entry" ] || continue
        if ! mv -- "$entry" "$qdir/"; then
            printf "${YELLOW}❌ Could not quarantine inherited workspace memory: %s${NC}\n" "$entry" >&2
            printf "${DIM}   Nothing was deleted. Fix the permissions under %s and re-run init.sh.${NC}\n" \
                "$mem" >&2
            exit 1
        fi
    done

    # Identity docs travel with the memory. They do not live under
    # .agent/memory/, but an inherited soul.md IS the harness's persona — leave
    # it in place and the new project boots wearing Athanor's identity, which
    # is the misidentification this whole spec family exists to end. They are
    # MOVED into the same quarantine rather than overwritten, so scaffold_core's
    # existence guard re-seeds them from template/ and the operator still keeps
    # every byte of whatever was there.
    if [ -d "$ident" ]; then
        for entry in "$ident"/*.md; do
            [ -f "$entry" ] || continue
            mkdir -p "$qdir/identity"
            if ! mv -- "$entry" "$qdir/identity/"; then
                printf "${YELLOW}❌ Could not quarantine inherited identity doc: %s${NC}\n" "$entry" >&2
                printf "${DIM}   Nothing was deleted. Fix the permissions under %s and re-run init.sh.${NC}\n" \
                    "$ident" >&2
                exit 1
            fi
        done
    fi

    mkdir -p "$mem"

    # LOUD, or it is a purge the operator never gets to reverse. The basename is
    # printed because that is what they have to go and look at.
    printf "${YELLOW}   ⚠ Inherited workspace memory found — QUARANTINED, not deleted.${NC}\n"
    printf "${DIM}     This folder carried another workspace's memory (missions, brain,\n"
    printf "     specs, telemetry, identity docs). Every byte was MOVED to:\n"
    printf "       .agent/%s\n" "$QUARANTINE_BASENAME"
    printf "     Fresh seeds were laid in its place. The quarantine is gitignored;\n"
    printf "     inspect it, copy back anything you want, and delete it yourself.${NC}\n"
}

# ── Profile ───────────────────────────────────────────────────────────────────
write_profile() {
    printf "${CYAN}📋 Writing project profile...${NC}\n"
    local template_profile="$TEMPLATE_DIR/.agent/profile.json"
    local target="$PROJECT_PATH/.agent/profile.json"

    # Idempotency guard: skip the full template-seed write when the target
    # profile already exists and onboarding_complete == true. Re-running
    # init.sh against an onboarded workspace must not clobber project_name
    # or reset onboarding_complete to false.
    #
    # Exception (GitHub #1286): a fresh clone of the Athanor repo itself
    # carries Athanor's OWN already-onboarded profile.json along (this repo
    # is itself an onboarded project). That inherited copy must NOT be
    # mistaken for a genuine re-onboarded project, so we detect it via two
    # literal markers identifying Athanor's own canonical identity and, when
    # BOTH match, treat it as if onboarding_complete were false (proceed
    # with the normal reset-to-fresh-defaults path below).
    #
    # Self-repo exception (QA round 2): the marker check above is purely
    # value-based, so it cannot distinguish "a downstream clone that
    # inherited Athanor's profile.json" from "this IS Athanor's own real
    # checkout, legitimately onboarded as itself". Both SCRIPT_DIR and
    # PROJECT_PATH are already canonicalized (cd ... && pwd -P) earlier in this
    # script, so a plain string comparison tells us whether init.sh is being
    # run in place inside its own repo. When it is, self-repo status forces
    # preservation regardless of the marker match.
    # A profile we cannot READ is not an answer (clean-scaffold D-1). Measured
    # 2026-09-02: a mode-000 profile.json whose bytes say onboarding_complete:
    # true made the `cp` below fail, `set -e` aborted the scaffold at rc=1, and
    # the file was LEFT IN PLACE — so the folder booted ESTABLISHED on an
    # identity nobody chose, which is exactly what §0 exists to end. A directory
    # standing where profile.json belongs is the same class.
    #
    # Move it aside, loudly, and seed fresh beside it. Never delete: a
    # permissions accident must not cost the operator their file (the same
    # ruling scaffold-identity-integrity D-F4-1 reached for inherited memory —
    # quarantine, never purge, always loud). `mv` needs write permission on the
    # DIRECTORY, not on the file, so it works precisely where `cp` cannot.
    local profile_unreadable="false" profile_is_link="false"
    if [ -h "$target" ]; then
        profile_is_link="true"
        [ -r "$target" ] || profile_unreadable="true"
    elif [ -d "$target" ]; then
        profile_unreadable="true"
    elif [ -e "$target" ]; then
        [ -r "$target" ] || profile_unreadable="true"
    fi

    # A BROKEN SYMLINK IS REFUSED, NOT RESCUED (codex QA round 1, finding 7).
    # Moving a link aside rescues nothing — the bytes live at the target, which
    # is untouched — and it does real damage: the operator's deliberate pointer
    # (shared config, a dotfiles repo) is replaced by a local regular file, the
    # two views diverge silently, and every re-run that recreates the link adds
    # ANOTHER `.unreadable-*` aside that nothing ever cleans up. Measured
    # 2026-09-03: two runs against `profile.json -> ../../shared/profile.json`
    # left two asides and a regular file, at rc=0 both times. The link is intent;
    # say what is wrong with its TARGET and stop.
    if [ "$profile_unreadable" = "true" ] && [ "$profile_is_link" = "true" ]; then
        printf "${YELLOW}❌ .agent/profile.json is a symlink whose target cannot be read.${NC}\n" >&2
        printf "${DIM}   link   : %s\n" "$target" >&2
        printf "   target : %s\n" "$(readlink -- "$target" 2>/dev/null || echo '<unreadable>')" >&2
        printf "   A symlink is a deliberate pointer, so init.sh will not move it aside and\n" >&2
        printf "   seed a local profile over it — that would divorce this workspace from the\n" >&2
        printf "   file you pointed it at. Fix the target (or remove the link if you no longer\n" >&2
        printf "   want it) and re-run init.sh.${NC}\n" >&2
        exit 1
    fi

    if [ "$profile_unreadable" = "true" ]; then
        # ATOMIC NAME RESERVATION (codex QA round 1, finding 6). The old loop was
        # check-then-act — `while [ -e "$aside" ]` and then `mv` — so two runs in
        # the same second could both settle on the same path and the later `mv`
        # could land on top of the first run's rescue. `mkdir` is the atomic
        # test-and-create POSIX gives us: exactly one racer can create a given
        # name, and the loser retries with the next suffix. The rescue then goes
        # INSIDE that directory, so `mv` can never overwrite anything: the
        # destination path is one this run alone just created.
        local aside_base aside_dir n
        aside_base="$target.unreadable-$(date -u +"%Y%m%dT%H%M%SZ" 2>/dev/null || echo unknown)"
        aside_dir="$aside_base"
        n=1
        until mkdir "$aside_dir" 2>/dev/null; do
            aside_dir="$aside_base.$n"
            n=$((n + 1))
            if [ "$n" -gt 1000 ]; then
                printf "${YELLOW}❌ Could not reserve a quarantine name for .agent/profile.json.${NC}\n" >&2
                printf "${DIM}   1000 candidates under %s are already taken. Clear the old\n" "$aside_base" >&2
                printf "   .unreadable-* entries and re-run init.sh.${NC}\n" >&2
                exit 1
            fi
        done
        if mv "$target" "$aside_dir/profile.json"; then
            printf "${YELLOW}   ⚠ .agent/profile.json could not be read (unreadable file or a directory\n" >&2
            printf "     in its place). Moved aside to: %s/profile.json${NC}\n" "$(basename -- "$aside_dir")" >&2
            printf "${DIM}     A fresh profile is being seeded. Nothing was deleted — inspect or\n" >&2
            printf "     remove the moved file yourself.${NC}\n" >&2
        else
            rmdir "$aside_dir" 2>/dev/null || true
            printf "${YELLOW}❌ .agent/profile.json is unreadable and could not be moved aside.${NC}\n" >&2
            printf "${DIM}   Fix the permissions on %s and re-run init.sh.${NC}\n" "$PROJECT_PATH/.agent" >&2
            exit 1
        fi
    fi

    if [ -f "$target" ] && [ "$WORKSPACE_ESTABLISHED" = "true" ]; then
        printf "${DIM}   Profile already onboarded — skipping overwrite.${NC}\n"
        # --name now wins over WORKSPACE, so an explicit rename against an
        # ALREADY-ONBOARDED workspace can move WORKSPACE while this guard
        # correctly leaves profile.project_name alone. That is a three-way
        # identity disagreement the delivered §0 boot check halts on, so say
        # it here rather than letting the operator meet it at first boot.
        local _profile_name
        _profile_name=$(python3 - "$target" <<'PYNAME' 2>/dev/null || true
import json, sys
try:
    print((json.load(open(sys.argv[1], encoding="utf-8-sig")).get("project_name") or "").strip())
except Exception:
    print("")
PYNAME
        )
        if [ -n "$_profile_name" ] && [ "$_profile_name" != "$PROJECT_NAME" ]; then
            printf "${YELLOW}   ⚠ WORKSPACE now says %s but the onboarded profile still says %s.${NC}\n" \
                "'$PROJECT_NAME'" "'$_profile_name'" >&2
            printf "${DIM}     init.sh will not rewrite an onboarded profile. Re-run onboarding to\n" >&2
            printf "     make the two agree, or the §0 boot check will halt this workspace:\n" >&2
            printf "       python3 execution/onboard_headless.py --project-name %s ...${NC}\n" \
                "\"$PROJECT_NAME\"" >&2
        fi
        # harness_name must never be BLANKED by a re-init, but a legacy
        # workspace scaffolded before D4 has no key at all and its §0
        # verification (and onboard_headless's GH #1369 guard) reads it.
        # Stamp it only when absent or empty; never overwrite a real value.
        HARNESS_NAME_VALUE="$(harness_name)" python3 - "$target" <<'PYSTAMP'
import json, os, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8-sig") as fh:
        data = json.load(fh)
except Exception:
    sys.exit(0)
if str(data.get('harness_name') or '').strip():
    sys.exit(0)
data['harness_name'] = os.environ['HARNESS_NAME_VALUE']
# Atomic replace, never truncate-in-place: `open(path, "w")` truncates first
# and writes second, so an interruption between the two leaves a ZERO-BYTE
# profile that the boot gate can no longer read its own onboarding state from.
import os, tempfile
# Follow a symlink to its TARGET before writing. os.replace() on the link path
# would drop a regular file over the link, leaving the operator's real profile
# untouched at the old content and the two views permanently divergent — a
# deliberate symlink (shared config, dotfiles repo) is intent, so honour it.
path = os.path.realpath(path)
_dir = os.path.dirname(os.path.abspath(path)) or "."
# Carry the existing file's permission bits across the swap. mkstemp creates at
# 0600, and nothing restored the original mode, so every atomic write silently
# narrowed a 0644 profile to 0600.
try:
    _mode = os.stat(path).st_mode & 0o7777
except OSError:
    _mode = None
_fd, _tmp = tempfile.mkstemp(prefix=".profile.", suffix=".tmp", dir=_dir)
try:
    with os.fdopen(_fd, "w") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
        fh.flush()
        os.fsync(fh.fileno())
    if _mode is not None:
        os.chmod(_tmp, _mode)
    os.replace(_tmp, path)
except BaseException:
    try:
        os.unlink(_tmp)
    except OSError:
        pass
    raise
PYSTAMP
        return 0
    fi

    # Preserve workspace identity (project_type, soul_type, tech_stack) across the
    # template-seed cp below. The template sentinel ships these fields neutral
    # ("" / "" / []); a wholesale cp of it over an existing profile blanks whatever
    # was already there (GH: reported by Omarchy, traced to this cp). Capture
    # whichever of these keys the EXISTING profile carries — including an
    # explicitly empty value, which must carry forward as empty, never be
    # "restored" to something else — into a temp file before the cp overwrites it.
    # SANDBOX INSIDE THE PROJECT (.agent/rules/_core/sandbox.md; codex QA round
    # 1, finding 10). A bare `mktemp` lands in $TMPDIR, outside the folder the
    # permission bypass covers — on a managed or permission-gated temp dir the
    # scaffold either fails or prompts, for a file it holds for four lines.
    local identity_snapshot init_sandbox
    init_sandbox="$PROJECT_PATH/.tmp/sandbox/init"
    mkdir -p "$init_sandbox"
    identity_snapshot=$(mktemp "$init_sandbox/profile-snapshot.XXXXXX")
    if [ -f "$target" ]; then
        python3 - "$target" "$identity_snapshot" <<'PYSNAP' 2>/dev/null
import json, sys
out = {}
try:
    p = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    for k in ('project_type', 'soul_type', 'tech_stack'):
        if k in p:
            out[k] = p[k]
except Exception:
    pass
json.dump(out, open(sys.argv[2], 'w'))
PYSNAP
    else
        printf '{}' > "$identity_snapshot"
    fi

    # NO `cp` ONTO THE TARGET FIRST (codex QA round 1, finding 8). The template
    # seed used to be copied over the real profile and only then rewritten with
    # an atomic replace — so the "atomic" write was atomic only over its own last
    # step, and the window between the two held the TEMPLATE SENTINEL in place of
    # the operator's file. Measured 2026-09-03 by killing init in exactly that
    # window: a pre-onboarding profile carrying tech_stack ["python","sqlite"]
    # came back as tech_stack [] and project_name "". The seed is now read
    # straight from the template and the target is written ONCE, by os.replace —
    # so the profile on disk is only ever the old one or the finished new one.
    local created_at
    created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
    local template_version
    template_version=$(cat "$SCRIPT_DIR/.agent/version" 2>/dev/null || echo "unknown")

    # QUOTED heredoc + argv/env, never interpolation. An unquoted heredoc pasted
    # the target path straight into Python source as a string literal, so a
    # directory name containing a double quote closed the literal and the rest of
    # the name ran as code -- arbitrary execution from nothing but a folder name.
    # Values cross this boundary as data (argv, environment), never as source.
    ATH_PROJECT_NAME="$PROJECT_NAME" \
    ATH_HARNESS_NAME="$(harness_name)" \
    ATH_PLATFORM="$PLATFORM" \
    ATH_CREATED_AT="$created_at" \
    ATH_TEMPLATE_VERSION="$template_version" \
    python3 - "$target" "$identity_snapshot" "$template_profile" <<'PYEOF'
import json
import os
import sys

path = sys.argv[1]
snapshot_path = sys.argv[2]
template_path = sys.argv[3]
# READ THE TEMPLATE, WRITE THE TARGET — the target is never a staging area.
with open(template_path, encoding="utf-8-sig") as f:
    p = json.load(f)
p['project_name']     = os.environ['ATH_PROJECT_NAME']
p['harness_name']     = os.environ['ATH_HARNESS_NAME']
p['primary_platform'] = os.environ['ATH_PLATFORM']
p['created_at']       = os.environ['ATH_CREATED_AT']
p['template_version'] = os.environ['ATH_TEMPLATE_VERSION']
p['onboarding_complete'] = False
# AUTONOMY IS DECIDED, NEVER DEFAULTED (REQUIREMENTS section 6; the same rule
# execution/memory_quarantine.py PROJECT_OWNED_FIELDS enforces by REMOVING the
# field). The template seed carries `autonomy: {level: medium}` so that an
# established workspace has something to read, but main() runs dispose_memory
# THREE STAGES BEFORE this write: the disposal pops the inherited level, and
# re-seeding the template's default here silently put a level back that nobody
# chose — a contradiction inside one run, and the level a fresh scaffold then
# ran under. Absent is the honest state, and it is a supported one:
# boot_panel._collect_autonomy reads `(profile.get("autonomy") or {})` and
# emits NO failing check when the level is simply unset, execution/set_autonomy.py
# writes the block when the operator decides, and post_update/update_template
# create it when they need it (first-boot-e2e B3).
p.pop('autonomy', None)
# Honest interim identity (scaffold-identity D2). The agent's name is NOT
# knowable at scaffold time, and the previous seed answered that by asserting
# 'Athanor Agent' — a value that is simply false in a downstream project and
# that fed the misidentification this feature exists to end. Empty means
# UNSET, which is the only true thing to say here; onboarding fills it.
p['identity'] = {
    'agent_name': '',
    'project_role': ''
}
# Restore whatever the existing profile carried for these identity fields
# (including legitimately-empty values). Never fills in a default for a key
# that was absent from the snapshot.
try:
    with open(snapshot_path) as sf:
        preserved = json.load(sf)
except Exception:
    preserved = {}
p.update(preserved)
# Atomic replace, never truncate-in-place: `open(path, "w")` truncates first
# and writes second, so an interruption between the two leaves a ZERO-BYTE
# profile that the boot gate can no longer read its own onboarding state from.
import tempfile
# Follow a symlink to its TARGET before writing. os.replace() on the link path
# would drop a regular file over the link, leaving the operator's real profile
# untouched at the old content and the two views permanently divergent — a
# deliberate symlink (shared config, dotfiles repo) is intent, so honour it.
path = os.path.realpath(path)
_dir = os.path.dirname(os.path.abspath(path)) or "."
# Carry the existing file's permission bits across the swap. mkstemp creates at
# 0600, and nothing restored the original mode, so every atomic write silently
# narrowed a 0644 profile to 0600.
try:
    _mode = os.stat(path).st_mode & 0o7777
except OSError:
    _mode = None
_fd, _tmp = tempfile.mkstemp(prefix=".profile.", suffix=".tmp", dir=_dir)
try:
    with os.fdopen(_fd, "w") as fh:
        json.dump(p, fh, indent=2)
        fh.write("\n")
        fh.flush()
        os.fsync(fh.fileno())
    if _mode is not None:
        os.chmod(_tmp, _mode)
    os.replace(_tmp, path)
except BaseException:
    try:
        os.unlink(_tmp)
    except OSError:
        pass
    raise
PYEOF
    # Guarded delete (.agent/rules/_core/sandbox.md): never let an unset
    # variable expand into an `rm` path.
    [ -n "$identity_snapshot" ] && [ -e "$identity_snapshot" ] && rm -f -- "$identity_snapshot"
    return 0
}

# ── Core structure ────────────────────────────────────────────────────────────
scaffold_core() {
    printf "${CYAN}📂 Scaffolding core structure...${NC}\n"

    mkdir -p \
        "$PROJECT_PATH/.agent/agents" \
        "$PROJECT_PATH/.agent/identity" \
        "$PROJECT_PATH/.agent/memory/scratch" \
        "$PROJECT_PATH/.agent/memory/project" \
        "$PROJECT_PATH/.agent/rules/_core" \
        "$PROJECT_PATH/.agent/rules/claude" \
        "$PROJECT_PATH/.agent/rules/gemini" \
        "$PROJECT_PATH/.agent/skills" \
        "$PROJECT_PATH/.agent/workflows" \
        "$PROJECT_PATH/.agent/pulse/registry" \
        "$PROJECT_PATH/.agent/memory/project/inbox" \
        "$PROJECT_PATH/.agent/providers" \
        "$PROJECT_PATH/.claude/agents" \
        "$PROJECT_PATH/.claude/rules" \
        "$PROJECT_PATH/.claude/skills" \
        "$PROJECT_PATH/.gemini/agents" \
        "$PROJECT_PATH/.gemini/skills" \
        "$PROJECT_PATH/.gemini/rules" \
        "$PROJECT_PATH/.gemini/policies" \
        "$PROJECT_PATH/execution/hooks" \
        "$PROJECT_PATH/.tmp"

    touch "$PROJECT_PATH/.agent/memory/scratch/.keep"



    # ── Copy from template: clean slate (no Athanor state) ──────────────────
    #
    # SEEDS ARE WRITTEN ONCE, NEVER OVER (codex QA round 1, finding 1). These
    # copies used to be unconditional, and scaffold_core runs BEFORE
    # write_profile can even decide the workspace is established — so the
    # preservation logic downstream was defeated before it ran. Measured
    # 2026-09-03: scaffold, onboard as Estab/Vex, author all seven seeds, re-run
    # `bash init.sh` — goals.md, learned.md, backlog.md, rules.md,
    # session_log.md, soul.md and user.md were all overwritten, at rc=0, with no
    # warning. §0's rule fails toward NEW precisely BECAUSE setup must never
    # destroy existing memory; a seed is a starting point, and a file that
    # already exists has already started. Existence is the guard, not the
    # disposition: a project whose profile is corrupt (so it reads NEW) has
    # authored memory just the same, and it must survive too.
    SEEDS_PRESERVED=""
    seed_needed() { # $1 = destination. True when there is nothing to protect.
        if [ -e "$1" ]; then
            SEEDS_PRESERVED="$SEEDS_PRESERVED
     ${1#$PROJECT_PATH/}"
            return 1
        fi
        return 0
    }

    # ONE SOURCE, AND A MISSING SOURCE IS FATAL (clean-scaffold F3). These seeds
    # used to read `cp "$TEMPLATE_DIR/..." ... 2>/dev/null || cat > ... << 'EOF'`,
    # and every heredoc said something DIFFERENT from the template file it stood
    # in for — the learned.md fallback was about `make update-template` while the
    # template file was about backlog format. Which instructions a new project
    # received therefore depended on whether a file happened to exist, silently,
    # at rc=0. template/ is the single source: a missing one aborts the scaffold
    # instead of delivering a second text nobody reviewed.
    seed_from_template() { # $1 = path under template/, $2 = destination
        seed_needed "$2" || return 0
        if [ ! -f "$TEMPLATE_DIR/$1" ]; then
            printf "${YELLOW}❌ Seed source missing: %s${NC}\n" "$TEMPLATE_DIR/$1" >&2
            printf "${DIM}   %s is seeded from template/ and only template/.\n" "${2#$PROJECT_PATH/}" >&2
            printf "   Restore that file (or re-clone the harness) and re-run init.sh —\n" >&2
            printf "   scaffolding on without it would deliver text nobody reviewed.${NC}\n" >&2
            return 1
        fi
        cp "$TEMPLATE_DIR/$1" "$2"
    }

    # Fresh memory files
    seed_from_template ".agent/memory/project/goals.md"       "$PROJECT_PATH/.agent/memory/project/goals.md"
    seed_from_template ".agent/memory/project/learned.md"     "$PROJECT_PATH/.agent/memory/project/learned.md"
    seed_from_template ".agent/memory/project/backlog.md"     "$PROJECT_PATH/.agent/memory/project/backlog.md"
    seed_from_template ".agent/memory/project/rules.md"       "$PROJECT_PATH/.agent/memory/project/rules.md"
    seed_from_template ".agent/memory/project/session_log.md" "$PROJECT_PATH/.agent/memory/project/session_log.md"

    # Paired-copy registry — declares CLAUDE.md/GEMINI.md as real-file clones of
    # AGENTS.md so `make sync-clones` and `make audit` work in the new workspace.
    # Runtime config, not a seed: routed through install_preserving so a
    # re-run never silently overwrites an operator's edit (bootstrap-integrity
    # F3). NO known-harness-source args here — passing $SCRIPT_DIR/... would
    # self-match its own dest under an in-place re-run (SCRIPT_DIR ==
    # PROJECT_PATH) and force an unconditional overwrite, which is the exact
    # defect this fix removes. Comparing only against $src is enough: identical
    # bytes are left alone, a real difference is quarantined and announced.
    install_preserving "$TEMPLATE_DIR/.agent/paired-copies.yaml" \
        ".agent/paired-copies.yaml" "paired-copies.yaml"

    # Pulse registry from template — same treatment, per file.
    if [ -d "$TEMPLATE_DIR/.agent/pulse/registry" ]; then
        mkdir -p "$PROJECT_PATH/.agent/pulse/registry"
        for entry in "$TEMPLATE_DIR/.agent/pulse/registry/"*; do
            [ -f "$entry" ] || continue
            name="$(basename -- "$entry")"
            install_preserving "$entry" ".agent/pulse/registry/$name" "pulse/registry/$name"
        done
    fi

    # Identity templates (filled in during /onboard). Per-file and named, never a
    # glob: soul.md and user.md are rewritten by onboarding and then edited by the
    # user, so a wholesale re-copy on re-init is the same data loss as the memory
    # seeds above — and a template source that is absent is fatal here too, not a
    # quiet fallback to a stub with different words in it.
    seed_from_template ".agent/identity/soul.md" "$PROJECT_PATH/.agent/identity/soul.md"
    seed_from_template ".agent/identity/user.md" "$PROJECT_PATH/.agent/identity/user.md"

    if [ -n "$SEEDS_PRESERVED" ]; then
        printf "${DIM}   Preserved existing memory/identity — not re-seeded:%s${NC}\n" "$SEEDS_PRESERVED"
    fi

    # ── Copy hooks, provider configs, settings ────────────────────────────────
    # Hook scripts MUST be copied before settings.json — Claude Code fires hooks
    # immediately when settings.json is updated, so scripts must already exist.
    # Copying settings.json last prevents "No such file" errors on first
    # post-update session. (Fix for upstream issue #116.)

    cp "$SCRIPT_DIR/.gemini/settings.json"  "$PROJECT_PATH/.gemini/settings.json"  2>/dev/null || true
    cp "$SCRIPT_DIR/.gemini/policies/autonomy.toml" "$PROJECT_PATH/.gemini/policies/autonomy.toml" 2>/dev/null || true

    # ── Canonical rules: ONE copy, from template/, then sync_all() fans out ──
    #
    # This used to copy $SCRIPT_DIR/.claude/rules/*.md into .claude/rules/ and
    # nothing else, which broke three ways at once (spec rules-canonical):
    # .agent/rules/_core/ was delivered EMPTY (so `make sync-rules` downstream
    # was a permanent no-op), .gemini/rules/ got nothing, .grok/rules/ was never
    # created, and the seed came from the harness's LIVE tree rather than the
    # sanitised template/ that §2 requires.
    #
    # One recursive copy of the whole .agent/rules/ subtree — manifest.json,
    # _core/ and the per-provider overlays together — is the fix. The fan-out to
    # each provider's rules_dir belongs to sync_rules.sh, which enumerates them
    # from .agent/providers/*.json, so a provider added later needs no change
    # here. sync_all() runs it after the provider configs are in place.
    # Per file, preserved in place (bootstrap-integrity F3) — the prior
    # `cp -R .../.` overwrote an operator's amended rule unconditionally, and
    # sync_all()'s fan-out then propagated the loss into every provider clone.
    # Deliberately NOT install_preserving's quarantine-and-replace: a canonical
    # rule that differs stays exactly where it is (fan-out then carries the
    # operator's own edit forward, instead of trading it for a fresh copy the
    # operator never asked for). Only a missing or byte-identical file is
    # (re)written.
    #
    # AND IT SAYS SO, BY NAME (bootstrap-integrity D5). Preserving in place is
    # the right call — `make update-template` owns the update path — but doing it
    # silently is the same disease as the defect this mission opened with: the
    # operator's edit is pinned forever, the upstream version is withheld,
    # sync_rules.sh fans the pinned copy into all three provider clones, and the
    # transcript reads as though nothing happened. One line per withheld rule, in
    # the same voice as install_preserving's "QUARANTINED, not deleted".
    #
    # A SYMLINK AT THE DESTINATION IS NEVER WRITTEN THROUGH (bootstrap-integrity
    # D4). `[ -f ]` is FALSE for a dangling symlink, so this loop used to fall
    # straight to the `cp`, which follows the link and lands the template's bytes
    # OUTSIDE the workspace — measured at 3936 bytes, rc=0, silent.
    # install_preserving guards the same case with `[ ! -h "$dest" ]`; this loop
    # was hand-rolled beside it and did not. Same test, same verdict as any other
    # destination that is not the harness's own file: leave it alone and say so.
    if [ -d "$TEMPLATE_DIR/.agent/rules" ]; then
        mkdir -p "$PROJECT_PATH/.agent/rules"
        RULES_PRESERVED="false"
        while IFS= read -r -d '' entry; do
            relpath="${entry#"$TEMPLATE_DIR"/.agent/rules/}"
            rule_dest="$PROJECT_PATH/.agent/rules/$relpath"
            mkdir -p "$(dirname -- "$rule_dest")"
            if [ -h "$rule_dest" ] || { [ -f "$rule_dest" ] && ! cmp -s "$entry" "$rule_dest"; }; then
                printf "${YELLOW}   ⚠ %s already existed and differed — PRESERVED, not overwritten.${NC}\n" \
                    ".agent/rules/$relpath" >&2
                RULES_PRESERVED="true"
                continue
            fi
            cp "$entry" "$rule_dest"
        done < <(find "$TEMPLATE_DIR/.agent/rules" -type f -print0)
        if [ "$RULES_PRESERVED" = "true" ]; then
            printf "${DIM}     The harness's version of each was WITHHELD — \`make update-template\` takes it.${NC}\n" >&2
            printf "${DIM}     Until then sync_rules.sh fans YOUR copy into every provider clone.${NC}\n" >&2
        fi
    else
        printf "${YELLOW}   ⚠️  %s missing — no canonical rules to deliver.${NC}\n" \
            "$TEMPLATE_DIR/.agent/rules" >&2
    fi

    # Copy hook scripts BEFORE settings.json so hooks exist when Claude Code
    # loads settings. Per file, through install_preserving (bootstrap-integrity
    # F3): the prior unconditional `cp` silently overwrote an operator's edited
    # hook on every re-run. No known-harness-source arg — see the
    # paired-copies.yaml comment above for why.
    if [ -d "$SCRIPT_DIR/execution/hooks" ]; then
        for entry in "$SCRIPT_DIR/execution/hooks/"*.sh; do
            [ -f "$entry" ] || continue
            name="$(basename -- "$entry")"
            install_preserving "$entry" "$name" "hooks-root/$name"
            install_preserving "$entry" "execution/hooks/$name" "hooks/$name"
        done
        # execution/hooks/lib/ holds non-.sh files (e.g. context_window.py) that
        # the glob above never reaches since it doesn't recurse. Walk it
        # recursively so any current or future file under lib/ ships too,
        # instead of patching this line again per file.
        if [ -d "$SCRIPT_DIR/execution/hooks/lib" ]; then
            mkdir -p "$PROJECT_PATH/execution/hooks/lib" 2>/dev/null || true
            while IFS= read -r -d '' entry; do
                relpath="${entry#"$SCRIPT_DIR"/execution/hooks/lib/}"
                mkdir -p "$PROJECT_PATH/execution/hooks/lib/$(dirname -- "$relpath")"
                install_preserving "$entry" "execution/hooks/lib/$relpath" "hooks/lib/$relpath"
            done < <(find "$SCRIPT_DIR/execution/hooks/lib" -type f -print0)
        fi
    fi

    # settings.json last — hooks must exist before Claude Code processes this file
    cp "$SCRIPT_DIR/.claude/settings.json"  "$PROJECT_PATH/.claude/settings.json"  2>/dev/null || true

    # Copy execution scripts -- every top-level execution/*.py and *.sh, NOT a
    # hand-curated name list (fleet-acceptance F2/fix#1).
    #
    # A curated `for f in name1 name2 ...` list rots the moment someone adds a
    # script and forgets to add its name here, and it did: boot_panel.py,
    # update_template.py, dispatch_name.py, set_autonomy.py and bump_version.sh
    # were all absent from every fresh scaffold. A scaffolded workspace could
    # not report its own boot state and could not update itself, which is why a
    # week of boot-panel fixes reached no downstream project at all. Measured by
    # execution/fleet_acceptance.py step 3: boot_panel.py missing entirely.
    #
    # An extension glob self-heals -- a future *.py/*.sh dropped directly in
    # execution/ ships automatically, with no list to edit and nothing to forget.
    #
    # Subdirectories are deliberately NOT touched here; each has its own block
    # and must keep it: execution/hooks/ (copied earlier, so hook scripts exist
    # before settings.json is written), execution/platform/<host>/ (Tier-3
    # host-scoped -- a Windows scaffold ships zero macOS/Linux files), and
    # execution/checks/ (never copied wholesale; two fixtures are copied
    # explicitly further down).
    #
    # Non-script top-level files are excluded by the extension filter rather
    # than by a denylist: execution/contract.yaml is ATHANOR'S OWN mission
    # contract and must never leak into a downstream scaffold, and .DS_Store
    # matches neither pattern. com.athanor.pulse.plist is data, not a script,
    # so it keeps the explicit copy it always had.
    shopt -s nullglob
    for f in "$SCRIPT_DIR/execution/"*.py "$SCRIPT_DIR/execution/"*.sh; do
        cp "$f" "$PROJECT_PATH/execution/$(basename "$f")" 2>/dev/null || true
    done
    shopt -u nullglob
    cp "$SCRIPT_DIR/execution/com.athanor.pulse.plist" "$PROJECT_PATH/execution/com.athanor.pulse.plist" 2>/dev/null || true

    # Tier-3, host-only (platform-scoped-delivery D1/ruling-1): deliver
    # execution/platform/<host>/ ONLY -- never the other two. A freshly
    # scaffolded Windows project must contain zero macOS/Linux files on day
    # one. prune_foreign.py runs over the whole target at the end of main()
    # as a belt-and-braces backstop for any future over-delivery here.
    if [ -d "$SCRIPT_DIR/execution/platform/$PLATFORM" ]; then
        mkdir -p "$PROJECT_PATH/execution/platform/$PLATFORM"
        cp -R "$SCRIPT_DIR/execution/platform/$PLATFORM/." "$PROJECT_PATH/execution/platform/$PLATFORM/" 2>/dev/null || true
    fi

    # Copy browser_qa.py's self-test fixtures (execution/checks/ is not copied
    # wholesale elsewhere — only individual scripts/dirs are whitelisted)
    if [ -d "$SCRIPT_DIR/execution/checks/fixtures" ]; then
        mkdir -p "$PROJECT_PATH/execution/checks/fixtures"
        cp "$SCRIPT_DIR/execution/checks/fixtures/browser_qa_sample.html" "$PROJECT_PATH/execution/checks/fixtures/browser_qa_sample.html" 2>/dev/null || true
        cp "$SCRIPT_DIR/execution/checks/verify_browser_qa_fixture.sh"   "$PROJECT_PATH/execution/checks/verify_browser_qa_fixture.sh"   2>/dev/null || true
    fi

    # platform-scoped-delivery F2: the stub check the boot siren runs. Not
    # `2>/dev/null || true` -- `make audit` invokes paired_copies.py, so a
    # silently-skipped copy here scaffolds a workspace whose audit is broken.
    mkdir -p "$PROJECT_PATH/execution/checks"
    deliver_file "$SCRIPT_DIR/execution/checks/verify_no_symlink_stubs.py" "$PROJECT_PATH/execution/checks/verify_no_symlink_stubs.py"

    # onboarding-rework F2: the pre-push guard's entry point. git_guard.py
    # itself ships in the execution/ list above; this shim is what git actually
    # executes, and git IGNORES a hook that is not executable — so the chmod is
    # load-bearing, not tidiness. Delivering it does NOT arm it: arming is
    # `git config core.hooksPath .agent/githooks`, which git_provision.py does
    # at the confirmation moment (D-G7) and `make git-guard-install` does by
    # hand. A boot script must never arm a hook that refuses pushes behind you.
    if [ -f "$SCRIPT_DIR/.agent/githooks/pre-push" ]; then
        _GITHOOK_SRC="$SCRIPT_DIR/.agent/githooks/pre-push"
    elif [ -f "$TEMPLATE_DIR/.agent/githooks/pre-push" ]; then
        _GITHOOK_SRC="$TEMPLATE_DIR/.agent/githooks/pre-push"
    else
        _GITHOOK_SRC=""
    fi
    if [ -n "$_GITHOOK_SRC" ]; then
        mkdir -p "$PROJECT_PATH/.agent/githooks"
        if deliver_file "$_GITHOOK_SRC" "$PROJECT_PATH/.agent/githooks/pre-push"; then
            chmod +x "$PROJECT_PATH/.agent/githooks/pre-push"
        fi
    else
        printf "${YELLOW}   ⚠️  .agent/githooks/pre-push missing — the push guard cannot be armed.${NC}\n" >&2
    fi
    unset _GITHOOK_SRC

    # .agent/version — boot reads it for the banner and the update check, and
    # the Makefile reads it too. Unconditional: it is a harness-owned fact, and
    # a scaffold without it boots with a shell redirect error on line one
    # (scaffold-identity D7).
    deliver_file "$SCRIPT_DIR/.agent/version" "$PROJECT_PATH/.agent/version"

    # Makefile — AGENTS.md documents `make` targets, so a scaffold that ships
    # none delivers a document describing commands that do not exist. GUARDED:
    # a real downstream project may own its root Makefile, and clobbering it
    # would be a new defect, not a fix.
    if [ ! -f "$PROJECT_PATH/Makefile" ] && [ -f "$TEMPLATE_DIR/Makefile" ]; then
        cp "$TEMPLATE_DIR/Makefile" "$PROJECT_PATH/Makefile"
    fi

    # Copy .agent config files (handoff manifest, update manifest, protected-files list)
    [ -f "$SCRIPT_DIR/.agent/handoffs.yaml" ]        && cp "$SCRIPT_DIR/.agent/handoffs.yaml"        "$PROJECT_PATH/.agent/handoffs.yaml"        2>/dev/null || true
    [ -f "$SCRIPT_DIR/.agent/update-manifest.yaml" ] && cp "$SCRIPT_DIR/.agent/update-manifest.yaml" "$PROJECT_PATH/.agent/update-manifest.yaml" 2>/dev/null || true
    [ -f "$TEMPLATE_DIR/.agent/no-update" ]          && cp "$TEMPLATE_DIR/.agent/no-update"          "$PROJECT_PATH/.agent/no-update"          2>/dev/null || true

    # ── Copy canonical agents, skills, workflows from Athanor ───────────────
    for f in "$SCRIPT_DIR/.agent/agents/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/agents/" 2>/dev/null || true
    done
    for f in "$SCRIPT_DIR/.agent/skills/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/skills/" 2>/dev/null || true
    done
    for f in "$SCRIPT_DIR/.agent/workflows/"*.md; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/workflows/" 2>/dev/null || true
    done

    # Provider registry
    for f in "$SCRIPT_DIR/.agent/providers/"*.json; do
        [ -f "$f" ] && cp "$f" "$PROJECT_PATH/.agent/providers/" 2>/dev/null || true
    done
}

# ── AGENTS.md + symlinks ──────────────────────────────────────────────────────
setup_instructions() {
    # ── An ESTABLISHED workspace's AGENTS.md is NEVER regenerated (D-5) ──────
    # Measured 2026-09-02: scaffold, onboard as OwnProj/Vex, re-run init.sh, and
    # `**You are Vex** — the lead developer and primary agent of OwnProj.` became
    # `**Identity not yet configured.**` — at rc=0, with no warning, while the
    # profile still said the workspace WAS onboarded. Every later session then
    # read the wrong sentence off the single most-read surface in the context.
    # Destroying an identity the user authored is never an acceptable price for
    # refreshing a template, so preservation wins and says so out loud.
    #
    # The disposition is the one write_profile ALREADY decided (established
    # per decide_disposition()) — reused, never recomputed. Establishment
    # alone is not enough to preserve, though (workspace-owns-its-memory F4a):
    # a workspace can name itself and still never have finished onboarding.
    # The discriminator is PROVENANCE, not content (Codex finding 2): preserve
    # AGENTS.md iff established AND it exists AND onboarding_complete is true.
    # Onboarding is the only process that writes an identity into that file —
    # never ran, there is nothing authored to protect whatever the file
    # contains; did run, the file is authored whatever it contains, including
    # a legitimate `{{customer_name}}` inside a code fence. A `{{TOKEN}}`
    # content grep was tried and rejected: it destroys an authored file that
    # happens to quote template syntax, and it is fooled by one that doesn't.
    # Accepted residual: an established+onboarded workspace whose AGENTS.md
    # genuinely still says `{{AGENT_NAME}}` is preserved and then fails the
    # placeholder-residue gate at rc=1 — loud and correct, not fixed here.
    local target="$PROJECT_PATH/.agent/profile.json"
    local onboarding_complete="false"
    if [ -f "$target" ]; then
        onboarding_complete="$(
            python3 - "$target" <<'PYPROBE' 2>/dev/null
import json, sys
try:
    p = json.load(open(sys.argv[1], encoding="utf-8-sig"))
    print('true' if p.get('onboarding_complete') is True else 'false')
except Exception:
    print('false')
PYPROBE
        )"
    fi
    if [ "$WORKSPACE_ESTABLISHED" = "true" ] && [ -f "$PROJECT_PATH/AGENTS.md" ] \
        && [ "$onboarding_complete" = "true" ]; then
        printf "${DIM}   Workspace already onboarded — preserving AGENTS.md and its clones.${NC}\n"
        return 0
    fi
    if [ "$WORKSPACE_ESTABLISHED" = "true" ]; then
        if [ -f "$PROJECT_PATH/AGENTS.md" ]; then
            # Established, AGENTS.md exists, but onboarding never finished —
            # nothing was ever authored into it. Falling through re-delivers
            # the template instead of preserving a file with no identity to
            # protect, whatever bytes it happens to contain.
            printf "${YELLOW}   ⚠ This workspace is established but has never completed onboarding —\n" >&2
            printf "     there is no authored identity in AGENTS.md yet to protect, so the\n" >&2
            printf "     template is (re)delivered instead of preserved.${NC}\n" >&2
        else
            # Onboarded, but the instruction surface is GONE. There is no authored
            # identity left to protect here, so delivering the template beats leaving
            # the workspace with no AGENTS.md at all — but the identity block it
            # brings is a placeholder, and that must not be discovered silently.
            printf "${YELLOW}   ⚠ This workspace is onboarded but has no AGENTS.md — delivering the\n" >&2
            printf "     template copy. Its identity block will read 'not yet configured'\n" >&2
            printf "     until you re-run onboarding.${NC}\n" >&2
        fi
    fi

    printf "🔗 Setting up instruction symlinks...\n"

    # Use generic template AGENTS.md (not Athanor's project-specific one)
    local agents_src
    if [ -f "$TEMPLATE_DIR/AGENTS.md" ]; then
        agents_src="$TEMPLATE_DIR/AGENTS.md"
    else
        agents_src="$SCRIPT_DIR/AGENTS.md"
    fi

    # ── RENDER FIRST, THEN COMPARE, THEN QUARANTINE ────────────────────────
    # Measured 2026-09-03 (codex QA round 1, finding 2): a copied onboarded
    # project answered COPY had its hand-authored AGENTS.md OVERWRITTEN from the
    # template and its CLAUDE.md/GEMINI.md `rm -f`'d, at rc=0, with the original
    # bytes preserved NOWHERE. The memory beside them was carefully quarantined;
    # the single most-read instruction surface in the workspace was destroyed.
    #
    # Root instruction files are workspace property exactly as memory is, so
    # they get the same ruling (D-F4-1): MOVED into the run's one quarantine,
    # never deleted, and only when they actually differ from what this run is
    # about to deliver. Rendering into a temp file first is what makes that
    # comparison possible — and it is what keeps A1's "an immediate re-run
    # creates no quarantine" green, because the re-run's rendered AGENTS.md is
    # byte-identical to the one the first run left behind.
    #
    # FILL BEFORE CLONING (scaffold-identity D1). The three scaffold-time tokens
    # are the only ones knowable at init time; agent identity is NOT knowable
    # here and carries no token at all — it is a marker-delimited block that
    # onboarding rewrites (D2). ORDER IS LOAD-BEARING: CLAUDE.md/GEMINI.md are
    # byte-identical clones of AGENTS.md (platform-scoped-delivery F2), so
    # cloning before filling would deliver placeholders into both clones and
    # turn F2's drift gate red.
    local template_version staging
    template_version=$(tr -d '[:space:]' < "$SCRIPT_DIR/.agent/version" 2>/dev/null || echo "")
    [ -n "$template_version" ] || template_version="unknown"
    mkdir -p "$PROJECT_PATH/.tmp"
    staging="$PROJECT_PATH/.tmp/agents-render.$$"
    if cp "$agents_src" "$staging" 2>/dev/null; then
        FILL_PROJECT_NAME="$PROJECT_NAME" \
        FILL_HARNESS_NAME="$(harness_name)" \
        FILL_TEMPLATE_VERSION="$template_version" \
        python3 - "$staging" <<'PYFILL'
import os
import sys

path = sys.argv[1]
with open(path, "r") as fh:
    text = fh.read()
for key in ("PROJECT_NAME", "HARNESS_NAME", "TEMPLATE_VERSION"):
    text = text.replace("%s%s%s" % ("{{", key, "}}"), os.environ["FILL_" + key])
with open(path, "w") as fh:
    fh.write(text)
PYFILL
        install_preserving "$staging" "AGENTS.md" "root/AGENTS.md" \
            "$SCRIPT_DIR/AGENTS.md" "$TEMPLATE_DIR/AGENTS.md"
        rm -f "$staging" 2>/dev/null || true
    fi
    if [ -f "$TEMPLATE_DIR/GITHUB.md" ]; then
        install_preserving "$TEMPLATE_DIR/GITHUB.md" "GITHUB.md" "root/GITHUB.md" \
            "$SCRIPT_DIR/GITHUB.md"
    fi

    # CLAUDE.md and GEMINI.md are CLONES of AGENTS.md — real files, never
    # symlinks (platform-scoped-delivery F2). A tracked symlink checks out as a
    # 9-byte text stub on any default Windows clone, with `git status` empty, so
    # scaffolding one propagates the defect into every new workspace. Skip the
    # rewrite when the clone is already identical — pure churn reduction on
    # re-init (issue #1313) — and quarantine a clone that is NOT, for the same
    # reason AGENTS.md is: it may be the file the operator actually authored.
    # No AGENTS.md means there is nothing to clone FROM. Returning here leaves
    # any existing clones alone: the old code `rm -f`'d them first and only then
    # discovered the copy had nothing to copy, which destroyed both.
    [ -f "$PROJECT_PATH/AGENTS.md" ] || return 0
    local _f
    for _f in CLAUDE.md GEMINI.md; do
        if [ -f "$PROJECT_PATH/$_f" ] && [ ! -h "$PROJECT_PATH/$_f" ] && \
           cmp -s "$PROJECT_PATH/AGENTS.md" "$PROJECT_PATH/$_f"; then
            continue
        fi
        install_preserving "$PROJECT_PATH/AGENTS.md" "$_f" "root/$_f" \
            "$SCRIPT_DIR/$_f" "$SCRIPT_DIR/AGENTS.md" "$TEMPLATE_DIR/AGENTS.md"
    done
}

# ── Gitignore ─────────────────────────────────────────────────────────────────
# The canonical Athanor ignore set, in ONE place. The merge path below reads its
# entries back out of this function (comments and blank lines skipped) instead of
# keeping a second list, so the two branches cannot drift.
athanor_gitignore_body() {
    cat << 'EOF'
# OS
.DS_Store
Thumbs.db

# Temp
.tmp/
node_modules/
__pycache__/
*.pyc

# Secrets. `.env.enc` is the COMMITTED, encrypted form (sops+age) - see
# .agent/rules/security.md. It MUST stay trackable, so the negations follow
# `.env.*`: git takes the LAST matching pattern.
.env
.env.*
!.env.enc
!.env.example
!.env.sample
!.env.template
!.env.dist

# Agent scratch
.agent/memory/scratch/*
!.agent/memory/scratch/.keep

# Brain (local, large)
.agent/memory/brain/

# Quarantined inherited memory (scaffold-identity-integrity D-F4-1). Scaffolding
# over a directory copy moves the previous workspace's memory aside here rather
# than deleting it — another project's missions, brain and telemetry must never
# ride into this repository's history on the first `git add -A`.
.agent/memory-quarantine-*/

# The workspace-identity affirmation (copied-project-halt D-2). Deliberately
# NOT tracked: it records THIS machine's absolute path, so a `git clone` must
# never carry one (a fresh clone into a matching folder name asks nothing)
# while a directory copy carries it intact — which is exactly when it must be
# re-examined and, being bound to the old path, is refused.
.agent/.identity_binding.json
EOF
}

# This used to `[ -f .gitignore ] && return`, which is exactly REQUIREMENTS §3's
# SHARED-REPO case: a second folder (SAOC Design beside SAOC) attaches to a repo
# that already carries a .gitignore, so it never gets `.tmp/` ignored — while
# .agent/rules/_core/sandbox.md now requires every agent sandbox to live there.
# The result was agent scratch output tracked into a repository shared with
# another developer.
#
# The fix is an idempotent MERGE, never a rewrite: the operator's file is theirs,
# and a scaffold that reorders or drops their entries is a worse defect than the
# one being fixed (D-G9). Only the entries that are MISSING are appended, once,
# under a marker whose LEADING newline is what protects a file with no trailing
# newline.
#
# Presence is a question about GIT'S matcher, not about bytes. `grep -qxF` said
# `node_modules/   ` and `node_modules/` were different lines, and git says they
# are the SAME ignore (trailing spaces are stripped unless backslash-quoted), so
# the merge appended a duplicate; a CRLF file said the same about
# `node_modules/\r` and additionally acquired LF lines, leaving it mixed. So the
# comparison normalises the way git does, and the appended text reuses whatever
# line ending the file already has.
_gitignore_norm() { # $1 = raw line -> the form git actually matches on
    local s="${1%$'\r'}"
    while [ "${s% }" != "$s" ]; do
        # A backslash-quoted trailing space is significant to git; stop there.
        case "$s" in *'\ ') break ;; esac
        s="${s% }"
    done
    printf '%s' "$s"
}

setup_gitignore() {
    local target="$PROJECT_PATH/.gitignore"

    # Inside someone else's work tree this file is THEIRS and its ignores apply
    # to their repository, not to a project that is refused a repository of its
    # own. Refuse before touching it (detect_nesting already said why).
    if [ -n "$NESTED_OUTER" ]; then
        printf "${DIM}   Leaving .gitignore alone — it belongs to the work tree at %s.${NC}\n" \
            "$NESTED_OUTER"
        return 0
    fi

    if [ ! -f "$target" ]; then
        athanor_gitignore_body > "$target"
        return
    fi

    # The file's own line ending, preserved for everything appended below.
    local eol=$'\n'
    if LC_ALL=C grep -q $'\r$' "$target" 2>/dev/null; then
        eol=$'\r\n'
    fi

    local present="" line
    while IFS= read -r line || [ -n "$line" ]; do
        present="${present}$(_gitignore_norm "$line")"$'\n'
    done < "$target"

    # RELOCATION PASS (D-3). git takes the LAST matching pattern, so a canonical
    # negation already sitting in the operator's file ABOVE a pattern this run is
    # about to append would be silently annulled. Pass 1 asks only whether any
    # non-negation canonical entry is missing.
    local pat_missing=0 entry norm
    while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        case "$entry" in '#'*) continue ;; '!'*) continue ;; esac
        norm="$(_gitignore_norm "$entry")"
        printf '%s' "$present" | grep -qxF -- "$norm" || pat_missing=1
    done < <(athanor_gitignore_body)

    local missing="" count=0 l
    while IFS= read -r entry; do
        [ -n "$entry" ] || continue
        case "$entry" in '#'*) continue ;; esac
        norm="$(_gitignore_norm "$entry")"
        # A canonical negation is MOVED to the tail, never duplicated: delete the
        # earlier copy (normalising the way the presence test does, so a CRLF
        # file is handled) and fall through to the append below. Only lines
        # byte-equal to a canonical negation are ever relocated.
        if [ "$pat_missing" = "1" ]; then
            case "$entry" in
              '!'*)
                if printf '%s' "$present" | grep -qxF -- "$norm"; then
                    : > "$target.athtmp"
                    while IFS= read -r l || [ -n "$l" ]; do
                        l="${l%$'\r'}"
                        [ "$(_gitignore_norm "$l")" = "$norm" ] && continue
                        printf '%s%s' "$l" "$eol" >> "$target.athtmp"
                    done < "$target"
                    mv "$target.athtmp" "$target"
                fi
                missing="${missing}${entry}${eol}"
                count=$((count + 1))
                continue
                ;;
            esac
        fi
        # `if`, not `&& continue`: under `set -e` the exit status of a bare
        # `grep && continue` at the end of a loop body is the shell's business,
        # not this function's.
        if printf '%s' "$present" | grep -qxF -- "$norm"; then
            continue
        fi
        missing="${missing}${entry}${eol}"
        count=$((count + 1))
    done < <(athanor_gitignore_body)

    [ "$count" -gt 0 ] || return 0
    {
        printf '%s# Athanor (added by init.sh)%s' "$eol" "$eol"
        printf '%s' "$missing"
    } >> "$target"
    printf "   ${DIM}Merged %s missing Athanor entries into the existing .gitignore${NC}\n" \
        "$count"
}

# ── Env file ──────────────────────────────────────────────────────────────────
setup_env_file() {
    [ -f "$PROJECT_PATH/.env" ] && return
    cat > "$PROJECT_PATH/.env" << 'EOF'
# GitHub Token: Used by certain Athanor tools (e.g., 'make update-template').
# Create a Personal Access Token (PAT) with 'repo' scope at:
# https://github.com/settings/tokens?new_token=repo
# Save it here. For more details, see GITHUB.md.
#
# GITHUB_TOKEN=YOUR_PAT_HERE

# ── OpenRouter (optional) ─────────────────────────────────────────────────────
# Route fleet @dev/@qa subagents to free OpenRouter models instead of Claude quota.
# 1. Get an API key at https://openrouter.ai/keys (it starts with "sk-or-").
# 2. Uncomment and set OPENROUTER_API_KEY below.
# 3. Re-run `bash init.sh` — it writes .claude/settings.local.json (gitignored)
#    with ANTHROPIC_BASE_URL + model overrides. Leaving it unset changes nothing.
#
# OPENROUTER_API_KEY=sk-or-YOUR_KEY_HERE
EOF
}

# ── Secrets (optional) ────────────────────────────────────────────────────────
setup_secrets() {
    [ "$PLATFORM" = "windows" ] && return
    command -v sops >/dev/null 2>&1 && command -v age >/dev/null 2>&1 || return 0

    if [ ! -f "$PROJECT_PATH/.sops.yaml" ]; then
        # This step used to `mkdir -p "$HOME/.config/sops/age"` and then
        # age-keygen a PRIVATE KEY into it — a write outside the project folder,
        # unannounced, during a scaffold nobody asked to touch $HOME.
        # .agent/rules/_core/sandbox.md: needing to write outside the project is
        # a STOP AND ASK, not a judgement call. So: refuse, explain, print the
        # exact command, and continue the scaffold. Relocating the key into the
        # project instead would be worse — a private key inside a repository.
        local age_key="$HOME/.config/sops/age/keys.txt"
        if [ ! -f "$age_key" ]; then
            printf "${YELLOW}   ⚠️  Skipping .sops.yaml — no age identity at %s.${NC}\n" "$age_key"
            printf "${DIM}       Generating one means WRITING A PRIVATE KEY OUTSIDE this project,\n"
            printf "       which this scaffold will not do on its own. Run it yourself:\n"
            printf "         mkdir -p \"\$HOME/.config/sops/age\" && \\\\\n"
            printf "         age-keygen -o \"\$HOME/.config/sops/age/keys.txt\"\n"
            printf "       then re-run init.sh. Scaffolding continues.${NC}\n"
            return
        fi
        # The key file is only ever READ here, never created, so this reads
        # whatever the operator's existing age file holds -- and TWO identities
        # in one file (an ordinary setup) made $PUB_KEY multi-line, which the
        # heredoc pasted straight in and produced a .sops.yaml that no YAML
        # parser accepts, silently, at rc=0. Take the FIRST public key only.
        #
        # The trailing `|| true` is LOAD-BEARING, and its absence is what made
        # the guard below dead code in the exact case it was written for. Under
        # `set -euo pipefail`, grep finding no `public key:` line exits 1, the
        # pipeline inherits that under pipefail, and the assignment aborts the
        # ENTIRE script before the `-z` test ever runs — no warning, no skip, no
        # git init, no sync, no residue gate, no success banner, rc=1 and not one
        # word of output. A keys.txt holding only `AGE-SECRET-KEY-...` (an
        # ordinary way to store an identity) and a zero-byte or unreadable
        # keys.txt all reach this. An OPTIONAL step must never be able to kill a
        # mandatory one.
        PUB_KEY=$(grep "public key:" "$age_key" 2>/dev/null \
                  | awk 'NR==1 {print $4}' || true)
        if [ -z "$PUB_KEY" ]; then
            printf "${YELLOW}   ⚠️  No age public key found in %s (missing, empty, unreadable, or\n" \
                "$age_key"
            printf "       holding only a secret key) — skipping .sops.yaml. Scaffolding continues.${NC}\n"
            return
        fi
        # QUOTED heredoc + printf, never interpolation: the key crosses this
        # boundary as DATA, on one line, so nothing in it can restructure the
        # document it is being written into.
        {
            cat <<'SOPSEOF'
creation_rules:
  - path_regex: \.env$
    key_groups:
    - age:
SOPSEOF
            printf '      - %s\n' "$PUB_KEY"
        } > "$PROJECT_PATH/.sops.yaml"
        printf "   🔐 sops + age configured\n"
    fi
}

# ── Git init ──────────────────────────────────────────────────────────────────
# `git init` used to run UNCONDITIONALLY here. Scaffolding into a folder that
# already sits inside another work tree therefore created a NESTED repository,
# silently, at rc=0 — the outer repo sees a directory it cannot track and the
# inner one has no remote anybody meant to create. REQUIREMENTS §3 is explicit
# that the project folder IS the repository root and that no subfolder is ever
# made for a repo; a repo nested inside another is the same defect wearing a
# different shape. The verdict is now reached in preflight (detect_nesting), so
# it is known BEFORE any file is written. This is the FIRST of two guards —
# execution/git_provision.py checks the same thing again, because init.sh is not
# the only way to reach that folder (F1A7 kills both separately).
setup_git() {
    # detect_nesting already printed the reason.
    [ -z "$NESTED_OUTER" ] || return 0

    # ASK GIT, do not look for a `.git` DIRECTORY. A linked worktree and a
    # submodule both carry `.git` as a FILE, so `[ ! -d .git ]` was true inside
    # a perfectly good work tree and `git init` ran INSIDE an existing
    # repository. detect_nesting resolved the toplevel with git's own
    # discovery, which sees both shapes: a non-empty NESTED_OUTER means nested
    # (returned above), and reaching here with the folder already a work tree
    # root means there is nothing to initialise.
    if git_clean -C "$PROJECT_PATH" rev-parse --show-toplevel >/dev/null 2>&1; then
        : # already a repository root — .git may be a directory OR a file
    else
        printf "🗂️  Initialising git repository...\n"
        git_clean -C "$PROJECT_PATH" init -q
    fi

    if ! git_clean -C "$PROJECT_PATH" remote get-url origin >/dev/null 2>&1; then
        # §3 step 2: the confirmation of the NAME is the authorisation, and
        # there is no second prompt — so the remote, the private-by-default
        # visibility and the commit identity must all be visible at that one
        # moment. init.sh only SURFACES the proposal: it runs unattended and
        # cannot obtain a confirmation, so it never runs `apply` itself (D-G1).
        local proposal
        proposal="$(python3 "$SCRIPT_DIR/execution/git_provision.py" propose \
            --project-name "$PROJECT_NAME" 2>/dev/null || true)"
        if [ -n "$proposal" ]; then
            printf "${YELLOW}   ⚠️  No 'origin' remote yet. Proposed git setup:${NC}\n"
            printf '%s\n' "$proposal" | while IFS= read -r _line; do
                printf "      %s\n" "$_line"
            done
            printf "${DIM}      Confirming this name IS the authorisation — nothing is created\n"
            printf "      until you run:${NC}\n"
            printf "      python3 \"%s/execution/git_provision.py\" apply \\\\\n" "$PROJECT_PATH"
            printf "        --project-name \"%s\" \\\\\n" "$PROJECT_NAME"
            printf "        --path \"%s\" --confirmed\n" "$PROJECT_PATH"
        else
            printf "${YELLOW}   ⚠️  No 'origin' remote, and '%s' has no ASCII\n" "$PROJECT_NAME"
            printf "       residue to derive a repository name or a commit identity from.\n"
            printf "       Add a remote by hand, or re-run git_provision.py with\n"
            printf "       --repo/--email-user.${NC}\n"
        fi
    fi
}

# ── Sync agents + skills ──────────────────────────────────────────────────────
sync_all() {
    (
        cd "$PROJECT_PATH" || exit 1
        [ -f execution/sync_agents.sh ] && bash execution/sync_agents.sh
        [ -f execution/sync_skills.sh ] && bash execution/sync_skills.sh
        # sync_rules only if canonical source exists
        if [ -f execution/sync_rules.sh ] && [ -d .agent/rules/_core ]; then
            bash execution/sync_rules.sh 2>/dev/null || true
        fi
    )
}

# ── OpenRouter config (opt-in) ────────────────────────────────────────────────
setup_openrouter_config() {
    local key="${OPENROUTER_API_KEY:-}"
    [ -z "$key" ] && return 0

    local target="$PROJECT_PATH/.claude/settings.local.json"
    local new_keys
    new_keys=$(printf '%s' "$key" | python3 -c "
import json, sys
key = sys.stdin.read().strip()
d = {
    'env': {
        'ANTHROPIC_BASE_URL': 'https://openrouter.ai/api',
        'ANTHROPIC_AUTH_TOKEN': key,
        'ANTHROPIC_API_KEY': '',
    }
}
print(json.dumps(d, indent=2))
")

    local warning
    warning="   ${YELLOW}⚠️  ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL were NOT written.${NC}\n   ${YELLOW}   These keys are SESSION-scoped, not agent-scoped -- setting them here\n   would repoint EVERY agent tier (orchestrator, @architect, @dev, @qa --\n   not just @dev-fast/@qa-fast) onto free OpenRouter models. Set model-tier\n   overrides manually per docs/openrouter.md if you want fast-tier agents\n   on OpenRouter without degrading every tier.${NC}\n"

    if command -v jq >/dev/null 2>&1 && [ -f "$target" ]; then
        local stale_keys
        # `|| true`: jq exits non-zero on a malformed settings.local.json, which
        # under `set -e` would abort the scaffold mid-flight over an OPTIONAL
        # config merge. Empty stale_keys then falls through to the python
        # fallback below, which reports the parse failure itself.
        stale_keys=$(jq -r '(.env // {}) | keys[] | select(test("^ANTHROPIC_DEFAULT_(HAIKU|SONNET|OPUS)_MODEL$"))' "$target" 2>/dev/null || true)
        local merged
        if merged=$(jq --argjson new "$(echo "$new_keys" | jq '.env')" \
            '.env = ((.env // {}) + $new | del(.ANTHROPIC_DEFAULT_HAIKU_MODEL, .ANTHROPIC_DEFAULT_SONNET_MODEL, .ANTHROPIC_DEFAULT_OPUS_MODEL))' "$target"); then
            printf '%s\n' "$merged" > "$target"
            printf "   🔓 OpenRouter transport config merged into .claude/settings.local.json\n"
            printf "$warning"
            if [ -n "$stale_keys" ]; then
                printf "   ${YELLOW}⚠️  Removed stale ANTHROPIC_DEFAULT_*_MODEL key(s) from .claude/settings.local.json: %s${NC}\n" "$(echo "$stale_keys" | tr '\n' ' ' | sed 's/ *$//')"
            fi
            return 0
        fi
    fi

    # Fallback (no jq, or jq merge above failed): strip stale model-tier keys
    # from an existing target in place -- surgical, only those three keys,
    # every other key (including user-set keys) survives untouched. This is
    # the branch that used to just `return 0` without even opening the file.
    if [ -f "$target" ]; then
        local removed
        removed=$(python3 - "$target" <<'PYEOF'
import json
import sys

target = sys.argv[1]
STALE = (
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
)
try:
    with open(target) as f:
        data = json.load(f)
except (OSError, json.JSONDecodeError):
    sys.exit(0)
if not isinstance(data, dict):
    sys.exit(0)
env = data.get("env")
if not isinstance(env, dict):
    sys.exit(0)
removed = [k for k in STALE if k in env]
if not removed:
    sys.exit(0)
for k in removed:
    del env[k]
# Atomic replace, never truncate-in-place -- an interruption mid-write would
# leave a zero-byte settings.local.json that every later reader rejects.
import os, tempfile
_dir = os.path.dirname(os.path.abspath(target)) or "."
_fd, _tmp = tempfile.mkstemp(prefix=".settings.", suffix=".tmp", dir=_dir)
try:
    with os.fdopen(_fd, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
    os.replace(_tmp, target)
except BaseException:
    try:
        os.unlink(_tmp)
    except OSError:
        pass
    raise
print(" ".join(removed))
PYEOF
)
        if [ -n "$removed" ]; then
            printf "   ${YELLOW}⚠️  Removed stale ANTHROPIC_DEFAULT_*_MODEL key(s) from .claude/settings.local.json: %s${NC}\n" "$removed"
        fi
        return 0
    fi

    mkdir -p "$(dirname "$target")"
    printf '%s\n' "$new_keys" > "$target"
    printf "   🔓 OpenRouter config written to .claude/settings.local.json\n"
    printf "$warning"
}

# ── Placeholder residue gate ──────────────────────────────────────────────────
# The delivered tree must carry ZERO unsubstituted `{{TOKEN}}` markers
# (scaffold-identity D1). A warning here would be read by nobody: the confused
# party is a future agent, not the operator running init. So this is a HARD
# failure — correct precisely because init.sh is an operator-run bootstrap, not
# a SessionStart hook (a boot hook exiting non-zero is a session lockout; init
# can be re-run freely once the fill map learns the new token).
verify_no_placeholder_residue() {
    local excludes=( --exclude-dir=.git )
    local pat
    for pat in "${PLACEHOLDER_RESIDUE_ALLOWLIST[@]}"; do
        excludes+=( "--exclude=$pat" )
    done

    local hits
    # Deliberately BROADER than the SCREAMING_SNAKE convention: a token is
    # unfillable whatever it is spelled, and a scan scoped to the convention
    # would wave through a mixed-case or digit-bearing token — a residue gate
    # with a blind spot is the assertion-shaped hole this feature closes.
    hits=$(grep -rInE '\{\{[A-Za-z0-9_]+\}\}' "$PROJECT_PATH" "${excludes[@]}" 2>/dev/null || true)

    # WORKSPACE MEMORY IS DATA, NOT DELIVERED INSTRUCTIONS (D-F4-4). This gate
    # exists for HALF-WRITTEN INSTRUCTIONS that init.sh itself delivered (D1) —
    # an AGENTS.md still saying `{{AGENT_NAME}}`. `.agent/memory/**` is neither
    # delivered nor instructions: it is whatever the workspace has written down.
    # Scanning it made init refuse over content it does not own, measured in
    # both directions — an inherited harness mission corpus quoting a token
    # (rc=1, blaming the operator for prose the harness authored) and a
    # legitimate project's own note quoting one in its learned.md (a re-run of
    # init.sh in a healthy workspace, rc=1). The quarantine directories are the
    # same content one move to the side, so they are excluded on the same
    # grounds. Filtering by absolute PATH PREFIX, not by grep's basename-matching
    # --exclude-dir: a project that happens to own a directory called `memory`
    # keeps its residue gate.
    if [ -n "$hits" ]; then
        local kept="" line skip prefix
        while IFS= read -r line; do
            [ -n "$line" ] || continue
            case "$line" in
                "$PROJECT_PATH/.agent/memory/"*) continue ;;
                "$PROJECT_PATH/.agent/memory-quarantine-"*) continue ;;
            esac
            # HARNESS SOURCE, not delivered instructions — see
            # PLACEHOLDER_RESIDUE_SOURCE_PREFIXES for why each tree is named and
            # why the destinations they render into are still scanned.
            skip=""
            for prefix in "${PLACEHOLDER_RESIDUE_SOURCE_PREFIXES[@]}"; do
                case "$prefix" in
                    */) case "$line" in "$PROJECT_PATH/$prefix"*)  skip="yes" ;; esac ;;
                    *)  case "$line" in "$PROJECT_PATH/$prefix:"*) skip="yes" ;; esac ;;
                esac
                [ -z "$skip" ] || break
            done
            [ -z "$skip" ] || continue
            kept="${kept}${line}"$'\n'
        done <<< "$hits"
        hits="${kept%$'\n'}"
    fi

    if [ -n "$hits" ]; then
        printf "\n${YELLOW}❌ Unsubstituted placeholders delivered — refusing to scaffold a workspace whose instructions are half-written:${NC}\n" >&2
        printf '%s\n' "$hits" >&2
        printf "   Every token must be either filled by setup_instructions() or added to PLACEHOLDER_RESIDUE_ALLOWLIST with a reason.\n" >&2
        exit 1
    fi
    printf "${DIM}   No placeholder residue in the delivered tree.${NC}\n"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    local version
    version=$(cat "$SCRIPT_DIR/.agent/version" 2>/dev/null || echo "?")

    printf "\n"
    printf "${CYAN}🏭 Athanor v%s — Project Bootstrap${NC}\n" "$version"
    printf "${DIM}   Platform: %s | Project: %s${NC}\n\n" "$PLATFORM" "$PROJECT_NAME"

    # SCAFFOLD_STAGE names the step for on_scaffold_error(), so an abort says
    # which stage died instead of leaving the operator to guess from the last
    # line that happened to print.
    SCAFFOLD_STAGE="preflight checks";             preflight
    # BOTH before core structure. The disposition is a question about the tree
    # as the operator handed it over, and scaffold_core is the stage that
    # reshapes it — probed afterwards, inherited seeds are indistinguishable
    # from seeds init.sh just wrote. Disposal likewise runs before the residue
    # gate ever scans, and before the existence-guarded seeding, so a
    # quarantined seed path is genuinely absent and gets laid fresh.
    SCAFFOLD_STAGE="workspace disposition";        decide_disposition
    SCAFFOLD_STAGE="inherited memory disposal";    dispose_memory
    SCAFFOLD_STAGE="core structure";               scaffold_core
    SCAFFOLD_STAGE="profile";                      write_profile
    SCAFFOLD_STAGE="AGENTS.md + clones";           setup_instructions
    SCAFFOLD_STAGE=".gitignore";                   setup_gitignore
    SCAFFOLD_STAGE=".env";                         setup_env_file
    SCAFFOLD_STAGE="OpenRouter config";            setup_openrouter_config
    SCAFFOLD_STAGE="sops/age secrets (optional)";  setup_secrets
    SCAFFOLD_STAGE="git init";                     setup_git
    SCAFFOLD_STAGE="agent/skill/rule sync";        sync_all

    if [ "$NO_PULSE" != "true" ]; then
        SCAFFOLD_STAGE="pulse registration"
        bash "$SCRIPT_DIR/execution/manage_pulse.sh" register "$PROJECT_PATH"
    fi

    SCAFFOLD_STAGE="placeholder residue gate"
    verify_no_placeholder_residue

    # F21 (delivery-channel-baselines): record a baseline hash for every
    # HARNESS file this scaffold just wrote, so this workspace's FIRST
    # `make update-template` does not treat every one of them as fully
    # hand-edited and refuse to deliver anything (D36 — measured: 64
    # skipped, 0 delivered, on a workspace that had never touched a single
    # HARNESS file). Runs last, after scaffold_core AND sync_all, because
    # sync_all's agent/skill/rule regeneration is itself the final writer
    # of several HARNESS paths (e.g. .claude/rules/, .gemini/rules/) --
    # recording baselines any earlier would key off content sync_all is
    # about to overwrite again. Guarded, never fatal: a failure here
    # degrades to today's status quo (no baselines recorded, the first
    # update guards and warns per file) rather than aborting a scaffold
    # that otherwise completed successfully.
    SCAFFOLD_STAGE="scaffold-time baseline recording"
    if ! python3 "$SCRIPT_DIR/execution/update_template.py" \
            --record-scaffold-baselines "$PROJECT_PATH"; then
        printf "${YELLOW}   ⚠️  could not record scaffold-time HARNESS baselines -- this workspace's${NC}\n" >&2
        printf "${YELLOW}      first 'make update-template' will guard-and-warn on every changed${NC}\n" >&2
        printf "${YELLOW}      HARNESS path instead of delivering it (F21). Safe to ignore for now --${NC}\n" >&2
        printf "${YELLOW}      re-run 'python3 execution/update_template.py --record-scaffold-baselines .'${NC}\n" >&2
        printf "${YELLOW}      from inside the workspace to retry.${NC}\n" >&2
    fi

    printf "\n${GREEN}✅ Workspace scaffolded: %s at %s${NC}\n\n" "$PROJECT_NAME" "$PROJECT_PATH"
    printf "   Next: Open in Claude Code or Gemini CLI and run ${CYAN}/onboard${NC}\n"
    printf "   Or:   ${CYAN}make help${NC}\n\n"
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
