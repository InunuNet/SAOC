#!/usr/bin/env bash
# check_autonomy.sh — PreToolUse autonomy gate
# exit 0 = allow, exit 2 = block
# Uses bash/jq only — no python3 startup cost per hooks.md rule
# Session cache: <repo>/.tmp/athanor_autonomy_$PPID (cleared on new session)

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
# Trim leading whitespace — prevents bypass via "  sudo ..." or "  rm -rf ..."
COMMAND="${COMMAND#"${COMMAND%%[! ]*}"}"

# Session cache. NOT /tmp: this is the enforcement layer's own trust state,
# and a world-writable directory plus a predictable name let anyone on the
# machine pre-create the file and hand the guard its answer. sandbox.md
# forbids /tmp outright for the same reason. It lives inside the project
# (.tmp/ is gitignored), is created 0700/0600, and any cache that is a
# symlink, unreadable, or does not hold one of the five level words this
# hook speaks fails closed to "off" — the most restrictive level — rather
# than to whatever the file happens to say.
CACHE_DIR="$(pwd)/.tmp"
CACHE="${CACHE_DIR}/athanor_autonomy_${PPID}"

# Read level from session cache or profile.json
# Fallback is "low" (maximally restrictive safe default when config missing).
# Note: autonomy_matrix.json "default": "medium" is the onboarding default —
# this hook fallback is intentionally more restrictive for safety.
LEVEL=""
if [ -L "$CACHE" ]; then
  LEVEL="off"
elif [ -e "$CACHE" ]; then
  if [ ! -f "$CACHE" ] || [ ! -r "$CACHE" ]; then
    LEVEL="off"
  elif [ ".claude/policies/autonomy.json" -nt "$CACHE" ] \
    || [ ".agent/profile.json" -nt "$CACHE" ]; then
    # The level source changed after the cache was written, so the cache is
    # stale: re-derive instead of serving it. Moving the cache out of /tmp
    # invalidated every `rm -f /tmp/athanor_autonomy_*` in the workflows and
    # Makefile, and a level change that silently does not take effect is the
    # exact failure those clears existed to prevent. Self-invalidating here
    # keeps the guarantee inside the hook rather than in callers' hygiene.
    LEVEL=""
  else
    LEVEL=$(cat "$CACHE" 2>/dev/null)
    case "$LEVEL" in
      off|low|medium|high|loop) ;;
      *) LEVEL="off" ;;
    esac
  fi
fi

if [ -z "$LEVEL" ]; then
  # .claude/policies/autonomy.json is written by execution/sync_autonomy.py and
  # already carries the permission tier; the profile is the fallback for a
  # workspace that has not synced yet.
  LEVEL=$(jq -r '.permission_tier // empty' .claude/policies/autonomy.json 2>/dev/null || echo "")
  [ -z "$LEVEL" ] && LEVEL=$(jq -r '.autonomy.permission_tier // .autonomy.level // "low"' .agent/profile.json 2>/dev/null || echo "low")
  # Three-level read surface -> the five-level permission vocabulary this hook
  # speaks. Without this, an unmapped word matches no arm below and allows
  # everything — the failure mode is silent and maximally permissive.
  case "$LEVEL" in
    interactive) LEVEL="medium" ;;
    autonomous)  LEVEL="high" ;;
  esac
  case "$LEVEL" in
    off|low|medium|high|loop) ;;
    *) LEVEL="low" ;;
  esac
  # A cache we cannot create is not fatal — the level is simply re-derived
  # next call. A cache anyone else can read or write would be.
  ( umask 077; mkdir -p "$CACHE_DIR" 2>/dev/null && printf '%s\n' "$LEVEL" > "$CACHE" ) 2>/dev/null
fi
[ "$LEVEL" = "loop" ] && LEVEL="high"

# HEREDOC_STRIP_AWK, HEREDOC_CODE_AWK, TOKENIZE_AWK, QUOTED_LITERAL_AWK,
# expand_target(), re_write_protpath and re_read_protpath are shared with
# execution/hooks/allow_in_project_bash.sh (F9) and live in
# lib/target_resolve.sh — extracted, not reimplemented. Sourced here, above
# both floor surfaces, because BOTH now resolve their target through
# expand_target() before matching (D35 finding 1: the Write/Edit surface
# used to glob the raw file_path and so missed `./x//y` and `a/../b`).
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${HOOK_DIR}/lib/target_resolve.sh"

# ── Sanctioned enforcement-edit hatch (D26/F7) ─────────────────────────────────
# Two fail-closed, audited escape routes so an armed harness can still
# repair its own enforcement machinery, once the floor below would
# otherwise deny it unconditionally. Full design/threat-model:
# .agent/memory/project/specs/sanctioned-enforcement-edits/spec.md. Every
# function here returns 1 (deny) on any error, unreadable input, or
# unrecognised output -- an escape route only fires on an affirmative
# match, never on ambiguity.

del() { [ -n "$1" ] && [ -e "$1" ] && rm -f -- "$1"; }

# canon_path: full realpath-style canonicalization (symlinks followed,
# ./.. collapsed), byte-for-byte, case-sensitive -- deliberately NOT the
# partial normalization expand_target() does below for the ordinary floor
# match. Works on paths that don't exist yet (a Write target usually
# doesn't). Empty stdout on any error.
canon_path() {
  python3 -c 'import os, sys
print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null
}

# route1_permit <target_canon> -- Route 1 (contract-backed). Runs the F6
# resolver verbatim (reused, not reimplemented). Only a literal
# "contract:<path>" resolver line, exit 0, is even a candidate -- "allow"
# (no active mission), "noncontract", "invalid:*", "missing:*", "error",
# or any nonzero exit are all DENY: no mission means no contract to check
# against. Parses the resolved contract's `enforcement_edits[].path`
# entries and requires an exact canonicalized match. On permit, sets
# HATCH_METHOD/HATCH_MISSION/HATCH_FEATURE/HATCH_CONTRACT for the audit
# record and returns 0.
route1_permit() {
  local target_canon="$1" resolver_out rc hook_dir contract_path
  hook_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  resolver_out=$(python3 "${hook_dir}/lib/resolve_feature_contract.py" 2>/dev/null)
  rc=$?
  [ "$rc" -ne 0 ] && return 1
  case "$resolver_out" in
    contract:*) contract_path="${resolver_out#contract:}" ;;
    *) return 1 ;;
  esac
  [ -z "$contract_path" ] && return 1

  local edits
  edits=$(python3 -c '
import sys
import yaml
try:
    with open(sys.argv[1]) as f:
        doc = yaml.safe_load(f)
except Exception:
    sys.exit(1)
if not isinstance(doc, dict):
    sys.exit(1)
entries = doc.get("enforcement_edits") or []
if not isinstance(entries, list):
    sys.exit(1)
for entry in entries:
    if not isinstance(entry, dict):
        continue
    path = entry.get("path")
    if path is None or path == "":
        continue
    # A declared path is a single clean line or the whole contract is
    # untrustworthy. A value carrying an embedded newline prints as two
    # candidate lines and the loop below would match the second one --
    # permitting an edit the scalar never named (D35 finding 4). Deny the
    # entire contract rather than the one entry: a contract that can smuggle
    # a path has already failed the "hook can trust this document" test.
    if not isinstance(path, str):
        sys.exit(1)
    if path != path.strip() or any(c in path for c in "\n\r\x00"):
        sys.exit(1)
    print(path)
' "$contract_path" 2>/dev/null)
  [ $? -ne 0 ] && return 1

  local line line_abs line_canon matched=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [[ "$line" = /* ]]; then line_abs="$line"; else line_abs="$(pwd)/${line}"; fi
    line_canon=$(canon_path "$line_abs")
    [ -z "$line_canon" ] && continue
    if [ "$line_canon" = "$target_canon" ]; then matched=1; break; fi
  done <<< "$edits"
  [ "$matched" -eq 1 ] || return 1

  local active_json="$(pwd)/.agent/memory/project/missions/active.json"
  HATCH_METHOD="contract"
  HATCH_MISSION=$(jq -r '.mission // empty' "$active_json" 2>/dev/null)
  HATCH_FEATURE=$(jq -r '.checkpoint.feature // empty' "$active_json" 2>/dev/null)
  HATCH_CONTRACT="$contract_path"
  return 0
}

# route2_permit <target_canon> -- Route 2 (break-glass bootstrap), checked
# when Route 1 denies. Single-use, 15-minute-TTL file only a human acting
# outside the tool-mediated session can create (its own path is
# floor-protected below). Missing file, unparseable JSON, missing fields,
# expired TTL, or a non-matching path are all DENY with the file left in
# place. On permit the file is consumed (deleted) before returning 0.
route2_permit() {
  local target_canon="$1" bgfile bg_path bg_created now_epoch created_epoch age
  local bg_abs bg_canon
  bgfile="$(pwd)/.agent/enforcement_breakglass.json"
  [ -f "$bgfile" ] || return 1
  bg_path=$(jq -r '.path // empty' "$bgfile" 2>/dev/null)
  bg_created=$(jq -r '.created_at // empty' "$bgfile" 2>/dev/null)
  [ -z "$bg_path" ] && return 1
  [ -z "$bg_created" ] && return 1
  # Same single-clean-line rule Route 1 applies to a declared contract path
  # (D35 finding 4): an embedded newline, carriage return, or surrounding
  # whitespace makes the grant ambiguous, and ambiguity is DENY.
  case "$bg_path" in
    *[$'\n\r']*|" "*|*" "|$'\t'*|*$'\t') return 1 ;;
  esac
  case "$bg_created" in *[$'\n\r']*) return 1 ;; esac

  now_epoch=$(date -u +%s)
  created_epoch=$(date -u -d "$bg_created" +%s 2>/dev/null)
  if [ -z "$created_epoch" ]; then
    # BSD date (macOS) has no -d; parse the ISO-8601 UTC form explicitly.
    created_epoch=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$bg_created" +%s 2>/dev/null)
  fi
  [ -z "$created_epoch" ] && return 1
  age=$(( now_epoch - created_epoch ))
  [ "$age" -lt 0 ] && return 1
  [ "$age" -gt 900 ] && return 1

  if [[ "$bg_path" = /* ]]; then bg_abs="$bg_path"; else bg_abs="$(pwd)/${bg_path}"; fi
  bg_canon=$(canon_path "$bg_abs")
  [ -z "$bg_canon" ] && return 1
  [ "$bg_canon" = "$target_canon" ] || return 1

  del "$bgfile"
  HATCH_METHOD="breakglass"
  HATCH_MISSION=""
  HATCH_FEATURE=""
  HATCH_CONTRACT=""
  return 0
}

# audit_permit <method> <target_abs> <mission> <feature> <contract> --
# appends one JSON line to the audit log. A direct filesystem write of the
# hook's own, like the .tmp/athanor_autonomy_* cache above -- not routed
# through the Write/Edit tool gate this hook mediates. Denials are not
# audited here (the floor-deny stderr message already reports them).
#
# Returns nonzero if the append does not land. The spec calls an unaudited
# sanctioned edit a failure, not a logging nicety, so the caller turns that
# into a DENY (D35 finding 3): previously a PermissionError on the log left
# the permit standing and the edit went through unrecorded.
audit_permit() {
  local method="$1" target_abs="$2" mission="$3" feature="$4" contract="$5"
  local log_dir logfile
  log_dir="$(pwd)/.agent/memory/project"
  logfile="${log_dir}/enforcement_edit_audit.log"
  mkdir -p "$log_dir" 2>/dev/null || return 1
  python3 -c '
import json, sys
ts, path, method, mission, feature, contract, logfile = sys.argv[1:8]
rec = {
    "ts": ts,
    "path": path,
    "method": method,
    "mission": mission or None,
    "feature": feature or None,
    "contract": contract or None,
}
with open(logfile, "a") as fh:
    fh.write(json.dumps(rec) + "\n")
    fh.flush()
' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$target_abs" "$method" "$mission" "$feature" "$contract" "$logfile" 2>/dev/null || return 1
  return 0
}

# check_enforcement_hatch <raw_target> -- the single entry point both floor
# surfaces (direct Write/Edit FILE_PATH, and the Bash-write resolved
# target) call before denying. Returns 0 (and has already audited the
# permit) only on an affirmative Route 1 or Route 2 match; every other
# outcome is a DENY (return 1) that leaves the ordinary floor message and
# exit 2 untouched.
check_enforcement_hatch() {
  local raw="$1" target_abs target_canon
  [ -z "$raw" ] && return 1
  if [[ "$raw" = /* ]]; then target_abs="$raw"; else target_abs="$(pwd)/${raw}"; fi
  target_canon=$(canon_path "$target_abs")
  [ -z "$target_canon" ] && return 1

  HATCH_METHOD=""; HATCH_MISSION=""; HATCH_FEATURE=""; HATCH_CONTRACT=""
  if route1_permit "$target_canon" || route2_permit "$target_canon"; then
    if ! audit_permit "$HATCH_METHOD" "$target_canon" "$HATCH_MISSION" "$HATCH_FEATURE" "$HATCH_CONTRACT"; then
      echo "⛔ AUTONOMY FLOOR: enforcement-edit permit revoked — audit-log append failed" >&2
      return 1
    fi
    return 0
  fi
  return 1
}

# ── Floor denials — always blocked at every level including high ──────────────
# .gemini/policies/* is medium-protected (below), not floor-protected,
# so level=high agents can update the policy file when explicitly authorized.
# SEC-P0: floor-protect enforcement machinery (settings / hooks / instructions / matrix)

# floor_glob_match <path> -- the SEC-P0 protected-path glob set, factored into
# a function so the SAME list can be applied to more than one spelling of the
# same target.
floor_glob_match() {
  case "$1" in
    */.git/*|*/.env|*/.sops.yaml|*.pem|*.key|*/secrets/*|\
    */init.sh|*/full_boot.sh|*/.ssh/*|*/.aws/*|*/.gnupg/*|\
    */.claude/settings.json|.claude/settings.json|\
    */.claude/settings.local.json|.claude/settings.local.json|\
    */.claude/hooks/*|.claude/hooks/*|\
    */execution/hooks/*|execution/hooks/*|\
    */CLAUDE.md|CLAUDE.md|*/AGENTS.md|AGENTS.md|*/GEMINI.md|GEMINI.md|\
    */.agent/autonomy_matrix.json|.agent/autonomy_matrix.json|\
    */.agent/enforcement_breakglass.json|.agent/enforcement_breakglass.json)
      return 0 ;;
  esac
  return 1
}

# D35 finding 1: this block used to glob the RAW file_path only. A shell glob
# is lexical, so `./.agent//enforcement_breakglass.json` and
# `execution/not-a-dir/../hooks/check_autonomy.sh` name floor-protected files
# and matched nothing — an agent could mint its own break-glass grant and
# Route 2 protected nothing. The target now goes through expand_target(), the
# same resolver the Bash surface uses (one resolver, both surfaces), and the
# resolved form is tested against both the glob set and the anchored
# protected-path regexes. The raw form is still tested first so that no
# denial that worked before can stop working.
if [ -n "$FILE_PATH" ]; then
  declare -A VARS=()
  FLOOR_RESOLVED=$(expand_target "$FILE_PATH")
  if floor_glob_match "$FILE_PATH" \
     || floor_glob_match "$FLOOR_RESOLVED" \
     || [[ "$FLOOR_RESOLVED" =~ $re_write_protpath ]] \
     || [[ "$FLOOR_RESOLVED" =~ $re_read_protpath ]]; then
    if check_enforcement_hatch "$FLOOR_RESOLVED"; then
      exit 0
    fi
    echo "⛔ AUTONOMY FLOOR: write to protected path '$FILE_PATH' always denied" >&2
    exit 2
  fi
fi

# SEC-P1-4a: target resolution — decide what a Bash command actually reads
# or writes, then test THAT resolved target against the protected-path
# lists below. Replaces flat command-string pattern matching for the
# write-protected-path and read-protected-path checks (D24/D31): matching
# the whole normalised command string blocks on mere MENTION of a
# protected path (a heredoc body, a grep pattern, a commit message) and
# never covers reads at all. Resolution here is pure parsing — nothing is
# executed to classify the command. `[ -L ... ]`/`readlink` below are
# filesystem metadata checks (symlink hop resolution), not execution of
# any part of the user's command.
#
# lib/target_resolve.sh (the shared primitives) is sourced further up, above
# the Write/Edit floor block, because that surface now resolves its target
# through expand_target() too.

re_pyopen=$'open\\([[:space:]]*[\'\"]([^\'\"]+)[\'\"]'
# re_code_open: open() WITH a mode argument. [2] is the mode; a mode carrying
# w/a/x/+ opens for writing. A bare open('x') is a read and stays a read.
re_code_open=$'open[[:space:]]*\\([[:space:]]*[\'\"]([^\'\"]+)[\'\"][[:space:]]*,[[:space:]]*[\'\"]([^\'\"]*)[\'\"]'
# re_code_wverb: named write verbs an interpreter blob may use instead of
# open() -- the classifier's vocabulary, not a substring scan of the command.
# Presence of one of these decides that the blob WRITES; which path it writes
# is then settled by resolving the blob's own tokens and string literals, the
# same discipline the read direction already uses.
# Each alternative is anchored on a call or command shape, never a bare word:
# `s.replace(...)` and `os.path.exists(...)` must NOT read as writes.
re_code_wverb=$'(write_text|write_bytes|writelines|writeFileSync|appendFileSync|createWriteStream|rmtree|makedirs|copyfile|copytree|copy2)[[:space:]]*\\(|(os|shutil|fs|FileUtils)\\.(write|copy|move|rename|replace|remove|unlink|truncate|mkdir|symlink|link)[A-Za-z_]*[[:space:]]*\\(|File\\.(write|delete|rename)|IO\\.write|(^|[[:space:];&|])(install|truncate|shred|sponge|tee|dd)[[:space:]]'

_target_blk=0; _target_why=""

# scan_read_token: the INVERTED read rule (SEC-P1-4c). The read direction no
# longer asks "is this a known reader command?" — that allowlist can never be
# complete, and every omission (base64, dd, tar, diff, wc, openssl, cp's source
# side, …) was a silent credential read. It asks instead: does this argument
# token RESOLVE TO a read-protected path? Command identity stops mattering.
#
# The one guard that keeps D24 from reappearing in the read direction: a token
# containing whitespace is prose, not a path. `echo 'the file ~/.ssh/id_rsa is
# secret'` tokenizes as ONE word carrying the path plus other words; it does not
# resolve to exactly a protected path, so it is skipped here. Matching stays
# anchored on the resolved token itself (the (^|/)…(/|$) segment anchors in
# re_read_protpath), never a substring search inside a sentence.
scan_read_token() {
  local t="$1"
  [ -z "$t" ] && return
  case "$t" in *[[:space:]]*) return ;; esac
  check_target "read" "$t"
}

# scan_write_token: the write-direction twin of scan_read_token, under the
# identical whitespace-is-prose guard.
scan_write_token() {
  local t="$1"
  [ -z "$t" ] && return
  case "$t" in *[[:space:]]*) return ;; esac
  check_target "write" "$t"
}

# scan_code_blob <code> -- classifies one blob of interpreter code: the
# argument of `python3 -c` / `ruby -e` / `sh -c`, or the body of a heredoc fed
# to an interpreter. D35 finding 2: the previous version scanned such a blob
# for READS only, so `python3 -c "open('.agent/enforcement_breakglass.json',
# 'w').write('x')"` was a permitted write to the very file Route 2's security
# rests on.
#
# Two stages, and neither is a substring scan of the command text:
#   1. Does the blob WRITE? Decided by verb -- an open() whose mode carries
#      w/a/x/+, or a named write API/command (re_code_wverb).
#   2. If so, WHICH path? Decided by resolving the blob's own tokens the way
#      the read direction already resolves them. Interpreter code needs one
#      extra source of tokens: TOKENIZE_AWK is a shell lexer and does not
#      split on `(`, `)` or `,`, so `open('x','w')` arrives as a single word
#      and no path can be recovered from it -- QUOTED_LITERAL_AWK mines the
#      string literals instead. Prose is still safe in both: a token or
#      literal containing whitespace is skipped.
scan_code_blob() {
  local code="$1" sub lit rest m0 m1 want_write=0
  [ -z "$code" ] && return

  # Reads: every open() literal in the blob, not just the first. BASH_REMATCH
  # must be copied out before check_target runs -- check_target does its own
  # regex matching, which overwrites it, and consuming a stale/empty match
  # would leave `rest` unchanged and spin forever.
  rest="$code"
  while [[ "$rest" =~ $re_pyopen ]]; do
    m0="${BASH_REMATCH[0]}"; m1="${BASH_REMATCH[1]}"
    [ -z "$m0" ] && break
    rest="${rest#*"$m0"}"
    check_target "read" "$m1"
    [ "$_target_blk" = 1 ] && return
  done

  # Stage 1 — write intent.
  rest="$code"
  while [ "$want_write" = 0 ] && [[ "$rest" =~ $re_code_open ]]; do
    m0="${BASH_REMATCH[0]}"; m1="${BASH_REMATCH[2]}"
    [ -z "$m0" ] && break
    rest="${rest#*"$m0"}"
    case "$m1" in *[waxWAX+]*) want_write=1 ;; esac
  done
  [ "$want_write" = 0 ] && [[ "$code" =~ $re_code_wverb ]] && want_write=1

  # Stage 2 — which path.
  if [ "$want_write" = 1 ]; then
    while IFS= read -r lit; do
      scan_write_token "$lit"
      [ "$_target_blk" = 1 ] && return
    done < <(printf '%s\n' "$code" | awk "$QUOTED_LITERAL_AWK")
  fi

  while IFS= read -r sub; do
    case "$sub" in W:*)
      [ "$want_write" = 1 ] && scan_write_token "${sub#W:}"
      [ "$_target_blk" = 1 ] && break
      scan_read_token "${sub#W:}" ;;
    esac
    [ "$_target_blk" = 1 ] && break
  done < <(printf '%s\n' "$code" | awk "$TOKENIZE_AWK")
}

# rw_is_exempt <value> <exempt...> -- is <value> one of the auth-use handle
# values collected for this command (#1408)? A plain linear scan: the
# exempt lists here are at most a handful of entries per command.
rw_is_exempt() {
  local v="$1"; shift
  local e
  for e in "$@"; do [ "$e" = "$v" ] && return 0; done
  return 1
}

check_target() {
  local kind="$1" raw="$2"
  [ -z "$raw" ] && return
  # Brace-group tokens (R6, #1407): try the raw token first (unchanged
  # baseline behaviour), then its brace_variants() expansions in order —
  # `~/.s{s}h/id_rsa` is tested as itself AND as `~/.ssh/id_rsa`, so a group
  # that never denoted a protected path stays exactly as permissive as
  # before, and one that does gets caught on the expanded form.
  local -a candidates=("$raw")
  if [[ "$raw" == *"{"*"}"* ]]; then
    local v
    while IFS= read -r v; do
      [ -n "$v" ] && [ "$v" != "$raw" ] && candidates+=("$v")
    done < <(brace_variants "$raw")
  fi
  local cand resolved
  for cand in "${candidates[@]}"; do
    resolved=$(expand_target "$cand")
    # A write target is tested against BOTH lists: a credential store you may
    # not read, you certainly may not write. Without the second test only the
    # redirect write slipped through (`echo x > ~/.ssh/authorized_keys`) —
    # cp/tee/mv are already caught because their arguments also pass the
    # inverted read scan. Writing authorized_keys grants persistent SSH
    # access, a larger loss than reading a private key. The write list is
    # tested first so paths on both lists (.claude/settings.json, .env,
    # .sops.yaml) keep their "write to" message. component_glob_hit() closes
    # the same glob-spelling gap (R7) on the write side too.
    if [ "$kind" = "write" ] && { ci_match "$re_write_protpath" "$resolved" || ci_match "$re_read_protpath" "$resolved" || component_glob_hit "$resolved"; }; then
      if ! check_enforcement_hatch "$resolved"; then
        _target_blk=1; _target_why="write to protected path '$resolved'"
      fi
      return
    # The read direction goes through read_protected() rather than the raw
    # regex: the settings-file half of the read set protects the machine-global
    # and sibling-workspace copies, not this workspace's own tracked config
    # (D26). Writes above stay on the raw union — nothing about them changes.
    # read_protected() itself applies the case-fold and glob-component checks.
    elif [ "$kind" = "read" ] && read_protected "$resolved"; then
      _target_blk=1; _target_why="read of protected path '$resolved'"
      return
    fi
  done
}

RW_MAXDEPTH=3

# cmdsub_scan <text> -- one character walk that BOTH erases every top-level
# $(...) / `...` command-substitution span from <text> AND appends each
# span's inner content to CMDSUB_PAYLOADS for the caller to recursively
# scan_rw(). This is the STRIP/CODE split HEREDOC_STRIP_AWK/HEREDOC_CODE_AWK
# already use for heredoc bodies, applied to the other construct that hides
# an executable payload inside what the word-splitter treats as one word.
#
# Without the erase half: `x=$(cat ~/.ssh/id_rsa)` tokenizes as TWO words
# ("x=$(cat" and "~/.ssh/id_rsa)") because TOKENIZE_AWK does not understand
# $(...)/backticks as a grouping construct — it just splits on the space
# inside them like anywhere else. The first word matches the bare
# `NAME=VALUE` inline-assignment pattern (`x=$(cat`), so process_simple_cmd's
# "skip leading inline assignments" step consumes it and never scans it, and
# the second word becomes the COMMAND NAME position, whose value is never
# checked as a read/write target at all (only ARGUMENTS are). The path never
# reaches check_target — that was the bypass. Deleting the span from the
# outer text before tokenizing leaves a clean `x=` (a harmless empty-value
# assignment) instead of the corrupted glued token.
#
# CMDSUB_ERASED and CMDSUB_PAYLOADS are the CALLER's own locals: scan_rw
# declares them and calls this function DIRECTLY (never via `$(...)`), so
# there is no subshell and no line-based serialization to corrupt a payload
# that itself contains a literal newline.
#
# Single-quoted regions are walked through untouched — real bash performs no
# substitution inside '...' — tracked via `q`. Double-quoted regions get no
# special treatment beyond that: $(...) / backtick substitution is still
# live inside "..." in real bash, so those spans are still found and erased.
# $(...) nesting (`$(echo $(date))`) is handled by a paren depth counter;
# backticks are not nested (real bash does not support that either).
cmdsub_scan() {
  local s="$1" i=0 n c depth q="" buf j cj
  n=${#s}
  while [ "$i" -lt "$n" ]; do
    c="${s:$i:1}"
    if [ -n "$q" ]; then
      CMDSUB_ERASED="${CMDSUB_ERASED}${c}"
      [ "$c" = "$q" ] && q=""
      i=$((i + 1)); continue
    fi
    if [ "$c" = "'" ]; then
      q="'"; CMDSUB_ERASED="${CMDSUB_ERASED}${c}"; i=$((i + 1)); continue
    fi
    if [ "$c" = '$' ] && [ "${s:$((i + 1)):1}" = "(" ]; then
      depth=1; j=$((i + 2)); buf=""
      while [ "$j" -lt "$n" ] && [ "$depth" -gt 0 ]; do
        cj="${s:$j:1}"
        case "$cj" in
          "(") depth=$((depth + 1)); buf="${buf}${cj}" ;;
          ")") depth=$((depth - 1)); [ "$depth" -gt 0 ] && buf="${buf}${cj}" ;;
          *) buf="${buf}${cj}" ;;
        esac
        j=$((j + 1))
      done
      CMDSUB_PAYLOADS+=("$buf")
      i="$j"
      continue
    fi
    if [ "$c" = '`' ]; then
      j=$((i + 1)); buf=""
      while [ "$j" -lt "$n" ] && [ "${s:$j:1}" != '`' ]; do
        buf="${buf}${s:$j:1}"
        j=$((j + 1))
      done
      j=$((j + 1))
      CMDSUB_PAYLOADS+=("$buf")
      i="$j"
      continue
    fi
    CMDSUB_ERASED="${CMDSUB_ERASED}${c}"
    i=$((i + 1))
  done
}

if [ -n "$COMMAND" ]; then
  declare -A VARS=()

  # scan_rw <command-string> <depth> — the whole SEC-P1-4a read/write scan,
  # made recursive (R19/R24, #1407). It used to run once over $COMMAND with
  # no way back in: an `eval "cat ~/.ssh/id_rsa"` or a
  # `printf 'cat ~/.ssh/id_rsa' | sh` hides the real command inside one word
  # this scan's own tokenizer treats as an opaque argument — the recursion
  # SEC-P1-4b already has for the DESTRUCTIVE floor (fl_classify, further
  # below) never existed here, where credential-path checking actually
  # lives. cur_words/redir_gt/redir_lt/RW_* are all `local` to THIS call
  # frame, so nested scan_rw calls (eval-in-eval, pipe-into-eval, …) cannot
  # clobber an outer frame's in-progress command — the same per-frame
  # locality fl_classify already relies on.
  scan_rw() {
    local RW_SRC="$1" RW_DEPTH="${2:-0}"
    [ -z "$RW_SRC" ] && return
    # Fail CLOSED at the recursion cap, not open. This call only exists
    # because an eval payload or a pipe-to-shell producer one level up
    # asked to descend one level further than RW_MAXDEPTH allows — nobody
    # legitimately nests eval/pipe-to-shell that deep, so reaching the cap
    # while there is still a payload to descend into IS the signal, and the
    # correct verdict is deny, not "give up and allow". A plain terminal
    # command sitting AT the cap (RW_DEPTH == RW_MAXDEPTH, not beyond it)
    # is untouched by this check and keeps being scanned normally below.
    if [ "$RW_DEPTH" -gt "$RW_MAXDEPTH" ]; then
      _target_blk=1
      _target_why="eval/pipe-to-shell recursion exceeded depth limit ($RW_MAXDEPTH)"
      return
    fi
    [ "$_target_blk" = 1 ] && return

    # D35 finding 2: `python3 - <<'PY' … open('…','w') … PY` wrote to a
    # floor-protected path unblocked, because HEREDOC_STRIP_AWK drops every
    # heredoc body before anything is classified. Dropping is right for a
    # heredoc fed to cat or `git commit -F -` — that body is data, and treating
    # it as a target list is precisely the D24 false positive. A heredoc fed to
    # an INTERPRETER is not data, it is the program. HEREDOC_CODE_AWK emits
    # exactly those bodies and nothing else; they are classified as code blobs.
    local CODE_HEREDOC STRIPPED
    CODE_HEREDOC=$(printf '%s\n' "$RW_SRC" | awk "$HEREDOC_CODE_AWK")
    [ -n "$CODE_HEREDOC" ] && scan_code_blob "$CODE_HEREDOC"
    [ "$_target_blk" = 1 ] && return

    STRIPPED=$(printf '%s\n' "$RW_SRC" | awk "$HEREDOC_STRIP_AWK")

    # Command substitution (R19-adjacent, #1407 follow-up): find and erase
    # every $(...) / `...` span in STRIPPED (see cmdsub_scan()'s own
    # comment for why the erase half is required, not optional), then
    # recurse into each span's content as its own command — the identical
    # eval/pipe-to-shell recursion discipline already used above, sharing
    # the same RW_MAXDEPTH cap (now fail-closed) so nested substitution
    # cannot reopen the depth-cap bypass either.
    local CMDSUB_ERASED=""
    local -a CMDSUB_PAYLOADS=()
    cmdsub_scan "$STRIPPED"
    STRIPPED="$CMDSUB_ERASED"
    local csp
    for csp in "${CMDSUB_PAYLOADS[@]}"; do
      scan_rw "$csp" $((RW_DEPTH + 1))
      [ "$_target_blk" = 1 ] && return
    done

    local -a TOKS
    mapfile -t TOKS < <(printf '%s\n' "$STRIPPED" | awk "$TOKENIZE_AWK")

    local -a cur_words=()
    local prev_op="" redir_gt="" redir_lt="" RW_LEAD_SEP="" RW_PIPE_SRC="" tok w

    process_simple_cmd() {
    [ "$_target_blk" = 1 ] && return
    local n=${#cur_words[@]}
    [ "$n" -eq 0 ] && [ -z "$redir_gt" ] && [ -z "$redir_lt" ] && return
    # simple two-step assignment: NAME=VALUE as the whole simple command
    if [ "$n" -eq 1 ] && [[ "${cur_words[0]}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] && [ -z "$redir_gt" ] && [ -z "$redir_lt" ]; then
      local vn="${BASH_REMATCH[1]}" vv="${BASH_REMATCH[2]}"
      VARS[$vn]=$(expand_target "$vv")
      return
    fi
    check_target "write" "$redir_gt"
    check_target "read" "$redir_lt"
    [ "$n" -eq 0 ] && return
    # skip leading inline assignments (FOO=bar cmd ...)
    local start=0
    while [ "$start" -lt "$n" ] && [[ "${cur_words[$start]}" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; do
      start=$((start + 1))
    done
    [ "$start" -ge "$n" ] && return
    local cmdname="${cur_words[$start]}"
    local args=("${cur_words[@]:$((start + 1))}")
    local nonflag=() a
    for a in "${args[@]}"; do
      case "$a" in -*) ;; *) nonflag+=("$a") ;; esac
    done

    # Pipe-into-shell recursion (R24, #1407): `printf 'cat ~/.ssh/id_rsa' | sh`
    # — RW_PIPE_SRC was captured by an echo/printf simple command earlier in
    # THIS pipeline (set at the bottom of the echo|printf arm below) and is
    # only eligible here because RW_LEAD_SEP (the separator that led into
    # THIS command) is "|" — the same "only the command immediately
    # downstream of the producer can consume it" rule SEC-P1-4b's
    # FL_PIPE_SRC already enforces. Cleared unconditionally right after, so
    # a third command in the chain can never inherit a stale payload.
    if [ -n "$RW_PIPE_SRC" ] && [ "$RW_LEAD_SEP" = "|" ]; then
      case "$cmdname" in
        sh|bash|zsh|dash|ksh)
          local rw_consumed="$RW_PIPE_SRC"; RW_PIPE_SRC=""
          scan_rw "$rw_consumed" $((RW_DEPTH + 1))
          return ;;
      esac
    fi
    RW_PIPE_SRC=""

    case "$cmdname" in
      cat|head|tail|less|more|xxd|od|strings)
        for a in "${nonflag[@]}"; do check_target "read" "$a"; done ;;
      grep|awk)
        for a in "${nonflag[@]:1}"; do check_target "read" "$a"; done ;;
      sed)
        local is_i=0
        for a in "${args[@]}"; do case "$a" in -i|-i*) is_i=1 ;; esac; done
        if [ "$is_i" = 1 ]; then
          [ "${#nonflag[@]}" -gt 0 ] && check_target "write" "${nonflag[-1]}"
        else
          for a in "${nonflag[@]:1}"; do check_target "read" "$a"; done
        fi ;;
      tee)
        [ "${#nonflag[@]}" -gt 0 ] && check_target "write" "${nonflag[0]}" ;;
      dd)
        for a in "${args[@]}"; do case "$a" in of=*) check_target "write" "${a#of=}" ;; esac; done ;;
      cp|mv)
        # `-t DIR` / `--target-directory=DIR` (W4/W5, #1407) names the write
        # target on the FLAG's own value, not on the trailing bare word: cp
        # writes every source INTO that directory regardless of which
        # argument position spells it out.
        local tdir="" ti
        for ti in "${!args[@]}"; do
          case "${args[$ti]}" in
            -t) tdir="${args[$((ti + 1))]}" ;;
            --target-directory=*) tdir="${args[$ti]#--target-directory=}" ;;
          esac
        done
        if [ -n "$tdir" ]; then
          check_target "write" "$tdir"
        elif [ "${#nonflag[@]}" -gt 0 ]; then
          check_target "write" "${nonflag[-1]}"
        fi ;;
      # D35 finding 2: write verbs the classifier did not know. `install`,
      # `truncate` and friends create or clobber a file exactly as `cp` does,
      # and every one of them was a silent path to a floor-protected file.
      install)
        [ "${#nonflag[@]}" -gt 1 ] && check_target "write" "${nonflag[-1]}" ;;
      ln)
        [ "${#nonflag[@]}" -gt 0 ] && check_target "write" "${nonflag[-1]}" ;;
      truncate|touch|shred|unlink|rmdir|mkdir|sponge|patch)
        for a in "${nonflag[@]}"; do check_target "write" "$a"; done ;;
      rm)
        for a in "${nonflag[@]}"; do check_target "write" "$a"; done ;;
      chmod|chown|chgrp)
        for a in "${nonflag[@]:1}"; do check_target "write" "$a"; done ;;
      python3|python)
        local i seen_c=0
        for i in "${!args[@]}"; do
          if [ "$seen_c" = 1 ]; then
            scan_code_blob "${args[$i]}"
            break
          fi
          [ "${args[$i]}" = "-c" ] && seen_c=1
        done ;;
      sh|bash|zsh|dash|ksh|perl|ruby|node|deno|php)
        # `sh -c "cat ~/.ssh/id_rsa"` and `ruby -e 'File.read("…/.ssh/id_rsa")'`
        # hide the path inside one quoted word that the whitespace guard would
        # skip. Scan that word as a code blob. Prose inside it still tokenizes
        # with whitespace and is still skipped, so
        # `sh -c "echo 'the file ~/.ssh/id_rsa is secret'"` stays allowed.
        local i seen_sc=0
        for i in "${!args[@]}"; do
          if [ "$seen_sc" = 1 ]; then
            scan_code_blob "${args[$i]}"
            break
          fi
          case "${args[$i]}" in -c|-e|-E|--eval) seen_sc=1 ;; esac
        done ;;
      eval)
        # `eval "cat ~/.ssh/id_rsa"` (R19, #1407) builds its program out of
        # its own arguments, exactly the way SEC-P1-4b's `eval` arm already
        # treats it for destructive-verb classification — recurse into the
        # joined text instead of scanning "eval" and one whitespace-bearing
        # word (which scan_read_token's own prose guard would skip).
        local ev joined=""
        for ev in "${args[@]}"; do joined="${joined:+$joined }$ev"; done
        [ -n "$joined" ] && scan_rw "$joined" $((RW_DEPTH + 1))
        return ;;
      echo|printf)
        # What this command prints becomes a program only if the NEXT
        # simple command in the pipeline is a shell reading stdin — decided
        # on the consuming side above, keyed on RW_LEAD_SEP, never here.
        # Capturing is unconditional; an echo/printf that is not piped into
        # a shell simply leaves RW_PIPE_SRC unread until it is cleared at
        # the top of the next call.
        local ep joined2=""
        for ep in "${nonflag[@]}"; do joined2="${joined2:+$joined2 }$ep"; done
        RW_PIPE_SRC="$joined2" ;;
    esac
    [ "$_target_blk" = 1 ] && return

    # Auth-use exemptions (#1408): the argument to ssh/scp's `-i`, every
    # non-flag argument of ssh-add, and gpg's `--homedir` value are handles
    # a program opens under OS file permissions to AUTHENTICATE with, not a
    # read of the key's bytes into the agent's own context — the same
    # distinction the inverted read scan cannot draw from the generic
    # "argument token resolves to a protected path" rule alone. Only the
    # exact token(s) named by the verb+flag pairing below are exempted;
    # every other argument of the SAME command (`scp ~/.ssh/id_rsa host:`,
    # C1 — no `-i`, the key handed over as a plain source file) still goes
    # through the ordinary scan.
    local -a RW_EXEMPT=()
    case "$cmdname" in
      ssh|scp)
        local k
        for k in "${!args[@]}"; do
          case "${args[$k]}" in
            -i|--identity-file)
              local nk=$((k + 1))
              [ "$nk" -lt "${#args[@]}" ] && RW_EXEMPT+=("${args[$nk]}") ;;
            --identity-file=*) RW_EXEMPT+=("${args[$k]#--identity-file=}") ;;
          esac
        done ;;
      ssh-add)
        local ea
        for ea in "${nonflag[@]}"; do RW_EXEMPT+=("$ea"); done ;;
      gpg|gpg2)
        local gk
        for gk in "${!args[@]}"; do
          case "${args[$gk]}" in
            --homedir)
              local gnk=$((gk + 1))
              [ "$gnk" -lt "${#args[@]}" ] && RW_EXEMPT+=("${args[$gnk]}") ;;
            --homedir=*) RW_EXEMPT+=("${args[$gk]#--homedir=}") ;;
          esac
        done ;;
    esac

    # Inverted read scan — every argument token, whatever the command is.
    # Pattern/script arguments of grep/awk/sed are still skipped: they are
    # regexes, not paths, and a pattern naming a path must stay allowed (D24).
    # A flag word contributes only its =VALUE half (--file=~/.ssh/id_rsa);
    # a bare flag is never a path.
    local skip_pat=0 has_ef=0 a2
    case "$cmdname" in
      grep|egrep|fgrep|rg|awk|gawk|mawk|sed)
        for a2 in "${args[@]}"; do
          case "$a2" in
            -e|-f|-e*|-f*|--regexp|--file|--regexp=*|--file=*) has_ef=1 ;;
          esac
        done
        [ "$has_ef" = 0 ] && skip_pat=1 ;;
    esac
    local nf_seen=0
    for a in "${args[@]}"; do
      rw_is_exempt "$a" "${RW_EXEMPT[@]}" && continue
      case "$a" in
        -*)
          case "$a" in *=*) scan_read_token "${a#*=}" ;; esac ;;
        *)
          nf_seen=$((nf_seen + 1))
          if [ "$skip_pat" = 1 ] && [ "$nf_seen" -eq 1 ]; then continue; fi
          # NAME=VALUE argument forms (dd if=…, of=…): the value half is the
          # path, and checking it first keeps the block message clean.
          case "$a" in *=*) scan_read_token "${a#*=}" ;; esac
          scan_read_token "$a" ;;
      esac
      [ "$_target_blk" = 1 ] && return
    done
  }

    for tok in "${TOKS[@]}"; do
      case "$tok" in
        "OP:;"|"OP:&&"|"OP:||"|"OP:|"|"OP:NL")
          process_simple_cmd
          cur_words=(); redir_gt=""; redir_lt=""; prev_op=""
          # RW_LEAD_SEP is the separator that leads into the NEXT command —
          # only "|" makes that next command eligible to consume RW_PIPE_SRC.
          case "$tok" in
            "OP:|") RW_LEAD_SEP="|" ;;
            *) RW_LEAD_SEP="" ;;
          esac
          ;;
        "OP:>>"|"OP:>") prev_op="gt" ;;
        "OP:<") prev_op="lt" ;;
        "OP:<<") prev_op="" ;;
        W:*)
          w="${tok#W:}"
          if [ "$prev_op" = "gt" ]; then redir_gt="$w"
          elif [ "$prev_op" = "lt" ]; then redir_lt="$w"
          else cur_words+=("$w")
          fi
          prev_op=""
          ;;
      esac
      [ "$_target_blk" = 1 ] && break
    done
    [ "$_target_blk" != 1 ] && process_simple_cmd
  }

  scan_rw "$COMMAND" 0

  if [ "$_target_blk" = 1 ]; then
    echo "⛔ AUTONOMY FLOOR: $_target_why always denied" >&2
    exit 2
  fi
fi

# SEC-P1-4b: floor command denial, classified on the PARSED ARGUMENT VECTOR.
#
# It used to flatten the command — newlines squeezed, EVERY quote character
# deleted, heredoc bodies left in place — and match its regexes against that
# string. So text that merely NAMED a protected idiom was indistinguishable
# from the command's own arguments: `git commit -m "…why rm -rf is denied"`
# was a recursive delete, `git commit -m "reject --force pushes" && git push
# origin main` was a forced push, and a `cat <<EOF` document body was whatever
# it happened to mention. Seven such denials on 2026-09-06 across three
# agents, three of them on this mission's own paperwork.
#
# The regexes were right; the string they were applied to was wrong. This
# block now uses the same lexer SEC-P1-4a above already uses
# (HEREDOC_STRIP_AWK + TOKENIZE_AWK from lib/target_resolve.sh): heredoc
# bodies are dropped, a quoted string arrives as ONE word that keeps its
# whitespace, and each simple command is judged by its own name and its own
# argument vector — so prose can never be a command name or a flag. Nesting
# is still not a bypass: `sh -c` blobs and interpreter-fed heredoc bodies are
# re-classified recursively, exactly as 4a recurses into them, and a wrapper
# (`xargs`, `env`, `exec`, `timeout N`) is stepped over to reach the real
# command.
#
# Every OTHER way a program can be named without appearing as the outer
# command word is an interpreter surface too, and each recurses the same way
# rather than being matched as text: `eval` (its arguments ARE the program),
# `{ …; }` and `( … )` (grouping punctuation the lexer emits as its own word),
# and `printf`/`echo` piped into a shell (the producer's output IS the
# program). Recursion — not a widened text search — is what keeps these
# denied without re-importing the false positives above: prose still cannot
# reach a command-name position.
if [ -n "$COMMAND" ]; then
  _blk=0; _why=""
  FL_MAXDEPTH=3

  # A quoted string keeps its whitespace through TOKENIZE_AWK, and prose
  # always has some — so a word carrying whitespace is never a flag, a
  # command name or a subcommand. Same guard scan_read_token uses for paths.
  fl_word() { case "$1" in *[[:space:]]*) return 1 ;; esac; return 0; }

  # fl_check_cmd <separator-before-this-command> <word> … — the whole verdict
  # for ONE simple command. Every rule keys on the command name and its own
  # arguments; none of them searches the command text.
  fl_check_cmd() {
    [ "$_blk" = 1 ] && return
    local sep="$1"; shift
    local -a w=("$@")
    local n=${#w[@]} i=0 j m a name sub wrap rec=0 frc=0 seen_c=0 guard=0
    [ "$n" -eq 0 ] && return

    # Grouping and negation punctuation is not a command name. `{ rm -rf /; }`
    # and `( rm -rf / )` run exactly the program the bare form runs; the lexer
    # emits the brace or paren as its own word, so without this the command
    # under it is never reached and the floor never sees it.
    while [ "$i" -lt "$n" ]; do
      case "${w[$i]}" in
        "{"|"("|"!"|"((") i=$((i + 1)) ;;
        *) break ;;
      esac
    done
    # Leading inline assignments (FOO=bar cmd …) are not the command.
    while [ "$i" -lt "$n" ] && [[ "${w[$i]}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do i=$((i + 1)); done
    # Wrapper commands only prefix the real one: `xargs rm -rf`, `env rm -rf`
    # and `exec rm -rf` delete recursively though their own first word does
    # not say so.
    while [ "$i" -lt "$n" ] && [ "$guard" -lt 8 ]; do
      guard=$((guard + 1))
      wrap="${w[$i]##*/}"
      case "$wrap" in
        xargs|env|nohup|command|nice|time|timeout|stdbuf|ionice|setsid|exec) ;;
        *) break ;;
      esac
      i=$((i + 1))
      while [ "$i" -lt "$n" ]; do
        case "${w[$i]}" in
          -*) i=$((i + 1)) ;;
          [0-9]*) case "$wrap" in timeout|nice|ionice) i=$((i + 1)) ;; *) break ;; esac ;;
          *) break ;;
        esac
      done
    done
    [ "$i" -ge "$n" ] && return

    name="${w[$i]##*/}"
    # `(rm -rf /)` glues the paren to the name — the lexer has no reason to
    # split it, so strip it here rather than let punctuation hide a command.
    while [ -n "$name" ]; do
      case "$name" in "("*|"{"*) name="${name#?}" ;; *) break ;; esac
    done
    [ -z "$name" ] && return
    local -a args=("${w[@]:$((i + 1))}")

    # A shell fed by an echo/printf earlier in THIS pipeline executes that
    # text as a program: `printf "rm -rf /" | sh`. The outer vector holds only
    # `sh`, so classify what the producer emitted — the same recursion `sh -c`
    # already gets, keyed on the separator rather than on a `|` character
    # found by searching a flattened string.
    if [ -n "$FL_PIPE_SRC" ] && [ "$sep" = "|" ]; then
      case "$name" in
        sh|bash|zsh|dash|ksh)
          local payload="$FL_PIPE_SRC"
          FL_PIPE_SRC=""
          fl_classify "$payload" $((FL_DEPTH + 1))
          return ;;
      esac
    fi
    # Only the command immediately downstream of the producer can consume it.
    FL_PIPE_SRC=""

    # Download-then-execute: a shell fed by a curl/wget earlier in THIS chain.
    # Decided by the separator between the two commands, not by searching a
    # flattened string for a `|` character that a quoted word could supply.
    if [ "$FL_NET" = 1 ]; then
      case "$name" in
        sh|bash|zsh|dash|ksh|python|python3|perl|ruby|node|deno|php|source)
          case "$sep" in
            "|") _blk=1; _why="curl/wget piped to shell"; return ;;
            "&&"|"||"|";") _blk=1; _why="download-then-exec"; return ;;
          esac ;;
      esac
      case "${w[$i]}" in
        ./*) case "$sep" in
               "&&"|"||"|";") _blk=1; _why="download-then-exec"; return ;;
             esac ;;
      esac
    fi

    case "$name" in
      rm)
        for a in "${args[@]}"; do
          fl_word "$a" || continue
          case "$a" in
            --recursive) rec=1 ;;
            --force) frc=1 ;;
            --*) ;;
            -*)
              [[ "$a" =~ ^-[A-Za-z]*[Rr] ]] && rec=1
              [[ "$a" =~ ^-[A-Za-z]*f ]] && frc=1 ;;
          esac
        done
        [ "$rec" = 1 ] && [ "$frc" = 1 ] && { _blk=1; _why="rm recursive+force"; return; } ;;
      git)
        # The subcommand is the first non-flag argument; -C and -c take a value.
        sub=""; j=0; m=${#args[@]}
        while [ "$j" -lt "$m" ]; do
          a="${args[$j]}"
          case "$a" in
            -C|-c) j=$((j + 2)); continue ;;
            -*) j=$((j + 1)); continue ;;
          esac
          fl_word "$a" && sub="$a"
          break
        done
        if [ "$sub" = "push" ]; then
          for a in "${args[@]}"; do
            fl_word "$a" || continue
            case "$a" in
              --force|--force=*|--force-with-lease|--force-with-lease=*|--force-if-includes) frc=1 ;;
              --*) ;;
              -*) [[ "$a" =~ ^-[A-Za-z]*f ]] && frc=1 ;;
            esac
          done
          [ "$frc" = 1 ] && { _blk=1; _why="forced git push"; return; }
        fi ;;
      find)
        for a in "${args[@]}"; do
          fl_word "$a" || continue
          case "$a" in
            -delete|--delete|-exec|--exec|-execdir|-ok|-okdir)
              _blk=1; _why="find -delete/-exec"; return ;;
          esac
        done ;;
      sudo|doas)
        _blk=1; _why="privileged/destructive"; return ;;
      chmod)
        for a in "${args[@]}"; do
          case "$a" in 777|0777) _blk=1; _why="privileged/destructive"; return ;; esac
        done ;;
      dd)
        for a in "${args[@]}"; do
          case "$a" in if=/dev/zero) _blk=1; _why="privileged/destructive"; return ;; esac
        done ;;
      sh|bash|zsh|dash|ksh)
        # `sh -c "rm -rf …"` hides a whole program inside one word. D8/D9: a
        # classifier that stops at the outer vector sees `sh`, `-c` and some
        # prose-shaped word, and the floor is disarmed. Classify the blob.
        for a in "${args[@]}"; do
          if [ "$seen_c" = 1 ]; then fl_classify "$a" $((FL_DEPTH + 1)); return; fi
          case "$a" in -c) seen_c=1 ;; esac
        done ;;
      eval)
        # `eval "rm -rf /"` builds its program out of its own arguments. The
        # outer vector shows `eval` and one prose-shaped word, which disarms a
        # classifier that stops there exactly as `sh -c` does.
        local joined=""
        for a in "${args[@]}"; do joined="${joined:+$joined }$a"; done
        [ -n "$joined" ] && fl_classify "$joined" $((FL_DEPTH + 1))
        return ;;
      echo|printf)
        # What a producer prints becomes a program only if the next stage of
        # the pipeline is a shell — the branch above decides that. Printing on
        # its own is not an offence, so `echo 'rm -rf is denied'` stays allowed.
        for a in "${args[@]}"; do
          case "$a" in -*) continue ;; esac
          FL_PIPE_SRC="${FL_PIPE_SRC:+$FL_PIPE_SRC }$a"
        done ;;
      curl|wget)
        FL_NET=1 ;;
    esac
  }

  # fl_classify <command-string> <depth> — lex it, split it into simple
  # commands, and hand each to fl_check_cmd with the separator that preceded
  # it. All state is local, so the recursion below cannot clobber its caller.
  fl_classify() {
    local src="$1" FL_DEPTH="${2:-0}" FL_NET=0 FL_PIPE_SRC=""
    [ -z "$src" ] && return
    # Same fail-CLOSED requirement as scan_rw's cap above, and for the same
    # reason: this call only exists because an eval/`sh -c`/pipe-to-shell
    # payload one level up asked to descend past FL_MAXDEPTH. SEC-P1-4a's
    # scan_rw denies most such chains before fl_classify ever sees them, but
    # a heredoc fed to an interpreter (`bash <<SH ... eval ... SH`) recurses
    # through fl_classify's OWN heredoc-code path independently of 4a, so
    # this cap has to fail closed on its own merits, not rely on being
    # shadowed by the other floor.
    if [ "$FL_DEPTH" -gt "$FL_MAXDEPTH" ]; then
      _blk=1; _why="destructive-command recursion exceeded depth limit ($FL_MAXDEPTH)"
      return
    fi
    local stripped code tok sep="" redir=0
    local -a toks words=()

    # A heredoc fed to cat or `git commit -F -` is DATA and is dropped — that
    # body is exactly the P3 false positive. One fed to an interpreter is the
    # program; HEREDOC_CODE_AWK emits only those, and they are classified
    # after the outer command so `bash <<SH … rm -rf … SH` is not a bypass.
    code=$(printf '%s\n' "$src" | awk "$HEREDOC_CODE_AWK")
    stripped=$(printf '%s\n' "$src" | awk "$HEREDOC_STRIP_AWK")
    mapfile -t toks < <(printf '%s\n' "$stripped" | awk "$TOKENIZE_AWK")

    for tok in "${toks[@]}"; do
      case "$tok" in
        "OP:;"|"OP:&&"|"OP:||"|"OP:|"|"OP:NL")
          fl_check_cmd "$sep" "${words[@]}"
          [ "$_blk" = 1 ] && return
          case "$tok" in
            "OP:&&") sep="&&" ;;
            "OP:||") sep="||" ;;
            "OP:|")  sep="|" ;;
            *)       sep=";" ;;
          esac
          words=(); redir=0 ;;
        "OP:>"|"OP:>>"|"OP:<"|"OP:<<") redir=1 ;;
        W:*)
          if [ "$redir" = 1 ]; then redir=0; else words+=("${tok#W:}"); fi ;;
      esac
    done
    fl_check_cmd "$sep" "${words[@]}"
    [ "$_blk" = 1 ] && return
    [ -n "$code" ] && fl_classify "$code" $((FL_DEPTH + 1))
  }

  fl_classify "$COMMAND" 0
  [ "$_blk" = 1 ] && { echo "⛔ AUTONOMY FLOOR: command denied at all levels ($_why)" >&2; exit 2; }
fi

# ── Off: block all writes and shell ──────────────────────────────────────────
if [ "$LEVEL" = "off" ]; then
  case "$TOOL" in
    Write|Edit|Bash)
      echo "⛔ AUTONOMY OFF: $TOOL requires explicit confirmation (level=off)" >&2
      exit 2 ;;
  esac
fi

# ── Low: restrict writes to memory dirs only ─────────────────────────────────
if [ "$LEVEL" = "low" ]; then
  if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
    case "$FILE_PATH" in
      */.agent/memory/scratch/*|*/.agent/memory/project/*)
        exit 0 ;;
      *)
        echo "⛔ AUTONOMY LOW: write to '$FILE_PATH' requires confirmation" >&2
        exit 2 ;;
    esac
  fi
fi

# ── Low: Bash shell_allowlist gate ───────────────────────────────────────────
# Source of truth: .agent/autonomy_matrix.json → matrix.low.shell_allowlist
# Inserted after the level=low Write/Edit block, before the level=medium block.
# Empty COMMAND falls through (fail-open) — we cannot determine intent.
# Use bash case for speed (no python3 startup per PreToolUse rule).
if [ "$LEVEL" = "low" ] && [ "$TOOL" = "Bash" ]; then
  if [ -z "$COMMAND" ]; then exit 0; fi
  # Block shell metacharacter chaining — prevents "ls; curl evil.com" style bypass
  case "$COMMAND" in
    *"&&"*|*"||"*|*"; "*|*$'\n'*)
      echo "⛔ AUTONOMY LOW: shell chaining not allowed at level=low" >&2
      exit 2 ;;
  esac
  # Block find -exec and find -delete escapes
  case "$COMMAND" in
    find*-exec*|find*-delete*|find*--exec*)
      echo "⛔ AUTONOMY LOW: find -exec/-delete not allowed at level=low" >&2
      exit 2 ;;
  esac
  case "$COMMAND" in
    ls*|cat*|grep*|make*|python3*|bash*|echo*|pwd|\
    "git status"*|"git diff"*|"git log"*|"git show"*|"git branch"*|\
    "gh issue"*|"gh api"*|"gh repo"*|\
    jq*|wc*|head*|tail*|sort*|uniq*|awk*|\
    "sed -n "*|"sed -e "*|"sed -f "*|\
    find*|test*|printf*|date*|\
    basename*|dirname*|which*|type*)
      exit 0 ;;
    *)
      echo "⛔ AUTONOMY LOW: Bash command not in allowlist: ${COMMAND:0:60}" >&2
      exit 2 ;;
  esac
fi

# ── Medium: protect infrastructure files ─────────────────────────────────────
# .gemini/policies/* is protected at medium — level=high agents may update it.
if [ "$LEVEL" = "medium" ]; then
  if [ "$TOOL" = "Write" ] || [ "$TOOL" = "Edit" ]; then
    case "$FILE_PATH" in
      */.agent/rules/_core/*|*/.gemini/policies/*|*/.claude/settings.json|*/Makefile)
        echo "⛔ AUTONOMY MEDIUM: '$FILE_PATH' is protected infrastructure (level=medium)" >&2
        exit 2 ;;
    esac
  fi
fi

# ── All other cases: allow ────────────────────────────────────────────────────
exit 0
