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

# TR_CWD_KNOWN (lib/target_resolve.sh): a wildcard is judged against the
# real filesystem only when the filesystem the hook sees IS the one the
# command's glob will see:
#   - the session reports this same cwd;
#   - the command is ONE simple command: no ; & | newline, no $( ` <( >(,
#     no eval/exec/source, no interpreter -c/-e. A shell expands a simple
#     command's globs before running it, so nothing in it can create a
#     symlink or directory first (Codex QA: `ln -s ~/.ssh l; cat l/*`);
#   - it never changes directory (cd/pushd/popd, -C/--chdir style flags).
# Otherwise the floor judges every wildcard by its pattern alone, as before.
#     A `|` is tolerated only when every pipeline stage is a read-only command
#     (RO_PIPE_CMDS): such a stage cannot create the symlink a later stage's
#     glob would follow, so the filesystem the hook sees is the one the glob
#     sees. Expanded matches are still checked against the protected set.
#     sort/uniq/jq/rg/tee are absent: they write files or run programs. No
#     word may reach outside the tree (`~`, `$`, `..`, a leading `/`).
RO_PIPE_CMDS=" grep egrep fgrep head tail wc cut tr cat ls nl column find "
# A find stage is read-only only when every primary is on this allowlist; the
# operand of a value primary is skipped. -exec/-delete/-fprint*/-L and any
# unknown primary fail closed.
RO_FIND_VALUE=" -name -iname -path -ipath -wholename -iwholename -regex -iregex -type -maxdepth -mindepth -mtime -mmin -newer -size "
RO_FIND_FLAG=" -empty -prune -print -print0 -depth -o -or -a -and -not ! ( ) \\( \\) "
ro_find_stage() {
  local -a wds
  local wd skip=0
  read -r -a wds <<< "${1//[\'\"]/}"
  for wd in "${wds[@]:1}"; do
    if [ "$skip" -gt 0 ]; then skip=$((skip - 1)); continue; fi
    if [[ "$RO_FIND_VALUE" == *" $wd "* ]]; then skip=1; continue; fi
    [[ "$RO_FIND_FLAG" == *" $wd "* ]] && continue
    [[ "$wd" == -* ]] && return 1
  done
  return 0
}
# git is a read-only stage only for these subcommands, with no global option
# before the subcommand and none of the flags that name another tree, write a
# file or run a program (Athanor session 2026-10-24: `git diff -- ':(exclude)x'
# | head` lost its cwd because git was not a recognised read-only stage).
RO_GIT_SUBCMDS=" diff log show status ls-files blame rev-parse shortlog "
ro_git_stage() {
  local -a wds
  local wd
  read -r -a wds <<< "${1//[\'\"]/}"
  [[ "$RO_GIT_SUBCMDS" == *" ${wds[1]:-} "* ]] || return 1
  for wd in "${wds[@]:2}"; do
    case "$wd" in
      -c*|-C*|--git-dir|--git-dir=*|--work-tree|--work-tree=*|--output*|--ext-diff|--textconv|--no-index) return 1 ;;
    esac
  done
  return 0
}
ro_stage_ok() {
  local stage="${1//[\'\"]/}" first
  stage="${stage#"${stage%%[! ]*}"}"; first="${stage%% *}"
  [ "$first" != git ] || { ro_git_stage "$stage"; return; }
  [[ -n "$first" && "$RO_PIPE_CMDS" == *" $first "* ]] || return 1
  [ "$first" != find ] || ro_find_stage "$stage"
}
# A `;`/`&&`/`||` sequence keeps the cwd known when every part is itself a
# read-only pipeline or stage (saoc-nos-site-7d 2026-10-18: `ls a | grep b;
# grep -n x specs/*/c.yaml | head` was judged by spelling alone). Parts may also
# be the side-effect-free comparisons/printers below. Nothing here writes,
# changes directory or links (`>` anywhere, `&`, backtick, and every command
# not listed disqualify), so a glob in a later part sees the filesystem the
# hook sees. The word screen matches ro_pipeline.
RO_SEQ_EXTRA=" cmp diff echo printf true test [ "
ro_seq_stage_ok() {
  local stage="${1//[\'\"]/}" first
  stage="${stage#"${stage%%[! ]*}"}"; first="${stage%% *}"
  # git is read-only only in a pure pipeline: a repo-configured diff.external,
  # textconv or pager helper runs code, which could create a symlink before a
  # later part's glob expands (Codex QA 2026-10-24).
  [ "$first" != git ] || return 1
  ro_stage_ok "$1" && return 0
  [[ -n "$first" && "$RO_SEQ_EXTRA" == *" $first "* ]]
}
ro_sequence() {
  local s="$1" item stage wd
  local -a wds
  [[ "$s" == *[\;\&\|]* ]] || return 1
  [[ "$s" != *[\>\`]* ]] || return 1
  read -r -a wds <<< "$s"
  for wd in "${wds[@]}"; do
    case "$wd" in *"~"*|*'$'*|*..*|/*) return 1 ;; esac
  done
  s="${s//&&/;}"; s="${s//||/;}"
  [[ "$s" != *"&"* ]] || return 1
  while [ -n "$s" ]; do
    item="${s%%;*}"
    if [[ "$s" == *";"* ]]; then s="${s#*;}"; else s=""; fi
    [ -n "${item//[[:space:]]/}" ] || continue
    while :; do
      stage="${item%%|*}"
      ro_seq_stage_ok "$stage" || return 1
      [[ "$item" == *"|"* ]] || break
      item="${item#*|}"
    done
  done
  return 0
}
ro_pipeline() {
  local cmd="$1" stage wd
  local -a wds
  [[ "$cmd" == *"|"* ]] || return 1
  [[ "$cmd" != *[\;\&\`]* ]] || return 1
  read -r -a wds <<< "$cmd"
  for wd in "${wds[@]}"; do
    case "$wd" in *"~"*|*'$'*|*..*|/*) return 1 ;; esac
  done
  while [[ "$cmd" == *"|"* ]]; do
    stage="${cmd%%|*}"; cmd="${cmd#*|}"
    ro_stage_ok "$stage" || return 1
  done
  ro_stage_ok "$cmd"
}
# find_words_ro <command>: every `find` word in the command, wherever it sits
# (`command find`, `env find`, a pipeline stage), starts a find whose primaries
# are all read-only. The words after it are judged up to the next `|`.
find_words_ro() {
  local -a wds stage
  local i j
  read -r -a wds <<< "${1//[\'\"]/}"
  for i in "${!wds[@]}"; do
    [ "${wds[$i]}" = find ] || continue
    stage=()
    for ((j = i; j < ${#wds[@]}; j++)); do
      [[ "${wds[$j]}" == *"|"* ]] && break
      stage+=("${wds[$j]}")
    done
    ro_find_stage "${stage[*]}" || return 1
  done
  return 0
}
# find_roots_inside <command>: every root word after a `find` word (up to the
# first primary) is a literal relative path with no `~`, `$`, `..` or leading `/`.
find_roots_inside() {
  local -a wds
  local wd in_roots=0 part prefix
  read -r -a wds <<< "${1//[\'\"]/}"
  for wd in "${wds[@]}"; do
    if [ "$wd" = find ]; then in_roots=1; continue; fi
    [ "$in_roots" = 1 ] || continue
    case "$wd" in
      -*|'!'|'('|'\('|'|') in_roots=0 ;;
      *"~"*|*'$'*|*..*|/*) return 1 ;;
      *)
        # a symlinked root or directory component may point outside the project
        prefix=""
        while IFS= read -r part; do
          [ -n "$part" ] || continue
          prefix="${prefix:+$prefix/}$part"
          [ ! -L "$prefix" ] || return 1
        done <<< "${wd//\//$'\n'}" ;;
    esac
  done
  return 0
}
TR_CWD_KNOWN=0
if [ "$TOOL" = "Bash" ]; then
  _session_cwd=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")
  _nl=$'\n'
  # A bare `.` is the source builtin only in command position: first word, first
  # word after | ( { !, after builtin/command/time, or after an assignment word.
  # Elsewhere it is an operand (`find .`, `git diff -- .`).
  _src_dot='(^|[|({!]|(^|[[:space:]])(builtin|command|time)|[[:alnum:]_]=[^[:space:]]*)[[:space:]]*\.([[:space:]]|$)'
  if { [ -z "$_session_cwd" ] || [ "$_session_cwd" -ef "$(pwd)" ]; } \
     && { [[ "$COMMAND" != *[\;\&\|\`]* ]] || ro_pipeline "$COMMAND" || ro_sequence "$COMMAND"; } && [[ "$COMMAND" != *"$_nl"* ]] \
     && [[ "$COMMAND" != *'$('* ]] && [[ "$COMMAND" != *'<('* ]] && [[ "$COMMAND" != *'>('* ]] \
     && ! [[ "$COMMAND" =~ (^|[^[:alnum:]_.-])(cd|pushd|popd|eval|exec|source)([[:space:]\)]|$) ]] \
     && ! [[ "$COMMAND" =~ $_src_dot ]] && [[ "$COMMAND" != *'\'* ]] && [[ "$COMMAND" != *'$'* ]] && find_roots_inside "$COMMAND" \
     && find_words_ro "$COMMAND" \
     && ! [[ "$COMMAND" =~ (^|[[:space:]])(-C|--chdir|--directory|--cwd|--work-tree|--git-dir)([[:space:]=]|$) ]] \
     && { [[ "$COMMAND" == *"|"* ]] || ! [[ "$COMMAND" =~ (^|[[:space:]])-[ce]([[:space:]=]|$) ]]; }; then
    TR_CWD_KNOWN=1
  fi
  unset _session_cwd _nl _src_dot
fi
# TR_DOTGLOB: 0 only when nothing in the command can make a wildcard match a
# hidden name -- no dotglob/GLOB_DOTS, no zsh setopt, no glob library call.
TR_DOTGLOB=1
if [ "$TOOL" = "Bash" ] && ! [[ "$COMMAND" =~ [Dd][Oo][Tt][Gg][Ll][Oo][Bb]|[Gg][Ll][Oo][Bb]_?[Dd][Oo][Tt][Ss]|setopt|GLOBIGNORE|fnmatch|glob|[(]D[)] ]]; then
  TR_DOTGLOB=0
fi

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

ROUTE3_TTL_SECONDS=1800

# route3_hard_denied <target_canon> -- the subset NO permit of any route can
# reach. Route 3 is agent-authored, so it needs a floor of its own or it is
# not a route, it is a removal of the floor. Two families are permanently out:
#
#   credentials  -- an agent that can mint a permit for ~/.ssh or a .env has
#                   exfiltration, not an emergency edit. Nothing about a
#                   stuck session justifies reaching these, so no emergency
#                   argument can be constructed that reaches them either.
#   the machinery -- autonomy_matrix.json, the breakglass file, the emergency
#                   permit file, and this hook. A permit that can rewrite the
#                   thing that evaluates permits is a one-time grant that
#                   makes itself permanent. Route 1 still reaches this hook
#                   (a contract, a mission, and a reviewable diff), which is
#                   how the file you are reading was changed; Route 3, which
#                   has none of that, must not.
route3_hard_denied() {
  case "$1" in
    */.env|*/.sops.yaml|*.pem|*.key|*/secrets/*|\
    */.ssh/*|*/.aws/*|*/.gnupg/*|*/.git/*|\
    */.agent/autonomy_matrix.json|\
    */.agent/enforcement_breakglass.json|\
    */.agent/enforcement_emergency.json|\
    */execution/hooks/check_autonomy.sh)
      return 0 ;;
  esac
  return 1
}

# route3_permit <target_canon> -- Route 3 (emergency). Checked only after
# Route 1 and Route 2 have both denied.
#
# WHY THIS EXISTS. Route 1 needs an active mission and Route 2 needs the
# operator. A project that hits a floor-protected file with no mission open
# therefore had exactly one option -- stop and wait for a human -- and that
# is the state the operator described as the harness consuming his time
# instead of returning it (2026-09-21, granting this route to every project
# in the fleet). The ceremony Route 1 requires is not what protects anything:
# the contract carrying an enforcement_edits permit is written by the same
# agent that wants the edit. What protects is the shape of the record --
# one exact path, a stated reason, an audit line -- and that shape does not
# need a mission around it.
#
# So this is Route 1's evidence without Route 1's prerequisites, plus a TTL
# and a hard-deny list, and it is deliberately unpleasant to use at scale:
# one path per permit, consumed on use, 30 minutes, and every grant lands in
# the audit log under method "emergency" where a sweep can find it. An agent
# reaching for it repeatedly is a signal, and it is a legible one.
#
# BE HONEST ABOUT WHAT THIS COSTS. For every path outside route3_hard_denied
# the floor is now a speed bump with a receipt rather than a wall. That is a
# real reduction and it was the operator's call, made twice and explicitly.
route3_permit() {
  local target_canon="$1" pfile p_path p_reason p_created now_epoch created_epoch age
  local p_abs p_canon
  pfile="$(pwd)/.agent/enforcement_emergency.json"
  [ -f "$pfile" ] || return 1

  route3_hard_denied "$target_canon" && return 1

  p_path=$(jq -r '.path // empty' "$pfile" 2>/dev/null)
  p_reason=$(jq -r '.reason // empty' "$pfile" 2>/dev/null)
  p_created=$(jq -r '.created_at // empty' "$pfile" 2>/dev/null)
  [ -z "$p_path" ] && return 1
  [ -z "$p_created" ] && return 1
  # A reason short enough to be a shrug is not a reason. This is the only
  # part of the record a later reader has to reconstruct intent from.
  [ "${#p_reason}" -lt 20 ] && return 1

  # Same single-clean-line rule Routes 1 and 2 apply (D35 finding 4): an
  # embedded newline or surrounding whitespace makes the grant ambiguous,
  # and ambiguity is DENY.
  case "$p_path" in
    *[$'\n\r']*|" "*|*" "|$'\t'*|*$'\t') return 1 ;;
  esac

  if [[ "$p_path" = /* ]]; then p_abs="$p_path"; else p_abs="$(pwd)/${p_path}"; fi
  p_canon=$(canon_path "$p_abs")
  [ -z "$p_canon" ] && return 1
  [ "$p_canon" = "$target_canon" ] || return 1

  # Re-check the RESOLVED permit path, not just the target. A permit naming
  # `.agent/../.agent/autonomy_matrix.json` resolves to a hard-denied file,
  # and the check above ran before resolution.
  route3_hard_denied "$p_canon" && return 1

  now_epoch=$(date -u +%s 2>/dev/null) || return 1
  created_epoch=$(python3 -c '
import sys
from datetime import datetime, timezone
raw = sys.argv[1].strip().replace("Z", "+00:00")
try:
    dt = datetime.fromisoformat(raw)
except Exception:
    sys.exit(1)
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=timezone.utc)
print(int(dt.timestamp()))
' "$p_created" 2>/dev/null) || return 1
  [ -z "$created_epoch" ] && return 1
  age=$(( now_epoch - created_epoch ))
  # A clock-skewed future timestamp is not a fresh permit, it is an unreadable
  # one, and unreadable is DENY.
  [ "$age" -lt 0 ] && return 1
  [ "$age" -gt "$ROUTE3_TTL_SECONDS" ] && return 1

  # Consumed before the grant returns, exactly as Route 2 does: a permit that
  # survives its own use is a standing grant wearing an emergency's clothes.
  rm -f -- "$pfile" 2>/dev/null || return 1

  HATCH_METHOD="emergency"
  HATCH_MISSION=""
  HATCH_FEATURE=""
  HATCH_CONTRACT="$p_reason"
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
  if route1_permit "$target_canon" || route2_permit "$target_canon" \
     || route3_permit "$target_canon"; then
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

# project_owned_secret <resolved-path> -- is this THIS project's own dotenv
# file, as opposed to someone else's?
#
# Operator decision, 2026-09-22: a project's credential file belongs to the
# project, not to Athanor. Forbidding the agent to write it did not protect
# anything -- every add, rotation, removal and malformed-line repair became a
# command handed to the operator to paste by hand, which is the harness
# generating homework instead of doing maintenance.
#
# WRITE only. Reading is still denied, and that half is load-bearing: a `cat`
# puts a live key into a transcript that syncs to claude.ai and sits in
# scrollback, where nobody controls it afterwards. It caught alembic-39 twice
# on 2026-09-22 -- once on a `sed` masking values, which looks safe and is not,
# because the masking is the agent's intent and not something this hook can
# verify. Writing a secret is maintenance; printing one is exfiltration.
#
# Scoped to $PWD, which for a hook invocation is the project root. Another
# project's dotenv, the home directory's, and every */secrets/*, .ssh, .aws,
# .gnupg, *.pem and *.key stay denied in both directions -- this names one
# filename shape in one tree and nothing else.
project_owned_secret() {
  local resolved="$1" root
  root=$(pwd -P 2>/dev/null) || return 1
  # Both spellings: expand_target() leaves an already-relative token alone, so
  # `printf ... >> .env` arrives here as `.env`, not as an absolute path. A
  # relative token is by definition resolved against $PWD -- the project root
  # -- so it names this project's file and nothing else. Testing only the
  # absolute form silently kept every ordinary command denied while the Write
  # tool worked, which is the worst of both.
  case "$resolved" in
    "$root"/.env|"$root"/.env.*) return 0 ;;
    .env|.env.*|./.env|./.env.*) return 0 ;;
  esac
  return 1
}

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
    if project_owned_secret "$FLOOR_RESOLVED"; then
      exit 0
    fi
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
    sub="${sub//$'\001'/$'\n'}"
    case "$sub" in W:*)
      [ "$want_write" = 1 ] && scan_write_token "${sub#W:}"
      [ "$_target_blk" = 1 ] && break
      scan_read_token "${sub#W:}" ;;
    esac
    [ "$_target_blk" = 1 ] && break
  done < <(printf '%s\n' "$code" | awk -v oldlex="$(tr_oldlex_flag "$code")" "$TOKENIZE_AWK")
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
  # Wildcard tokens (SAOC 2026-10-08): where the location is knowable, every
  # real match is tested as a literal path too, so `> .agent/autonomy_*.json`
  # is judged as the autonomy_matrix.json it writes. A write glob with more
  # matches than the cap is denied outright, since it cannot be checked; a
  # read glob keeps the pattern verdict below.
  local m first
  first=$(expand_target "$raw")
  if tr_has_glob "$first" && tr_glob_location_known "$first"; then
    local matches
    if matches=$(tr_glob_expand "$first"); then
      while IFS= read -r m; do
        [ -n "$m" ] && candidates+=("$m")
      done <<< "$matches"
    elif [ "$kind" = "write" ]; then
      _target_blk=1; _target_why="write through a wildcard with more than ${TR_GLOB_CAP} matches: '$first'"
      return
    fi
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
      if project_owned_secret "$resolved"; then
        return
      fi
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

# Recursive reach (floor-recursive-reach, 2026-10-24). check_target judges the
# path it is handed, so `grep -r BEGIN ~/` named only $HOME and was allowed
# while the walk it asks for reaches ~/.ssh; `cp -R tree/ .` named only `.`
# while it writes ./init.sh. A recursive reader or copier is judged by what it
# will REACH. Every path found is still sent through check_target -- there is
# no second protected-path matcher to drift from the first.
RR_CAP=50000          # entries examined per tree; a bigger tree is unverifiable
RR_LINK_DEPTH=3       # how many symlinked trees deep a following command is chased

# rr_check <read|write> <path> <named-dir> -- check_target, with the verdict
# annotated by the directory the command actually named.
rr_check() {
  check_target "$1" "$2"
  if [ "$_target_blk" = 1 ]; then
    _target_why="recursive access under '$3' reaches: $_target_why"
  fi
}

# recursive_reach <read|copy> <dir> <follow 0|1> [dest] [depth] -- judge one
# directory operand of a recursive command. A non-directory is a plain file
# read and was already judged by the per-command arms.
#   1. A protected root that sits inside <dir> is denied without walking:
#      `grep -r x ~` costs one stat per root, not a walk of the home directory.
#   2. A command that follows symlinks (grep -R, cp -L, zip) has each symlink
#      in the tree judged as a path -- which resolves it -- and a linked
#      directory chased in turn, to a bounded depth. The walk itself never
#      follows links, so a link loop cannot hang it.
#   3. The tree is walked once, pruning .git, keeping entries whose name could
#      be protected (target_resolve.sh) and judging each. Past RR_CAP entries
#      the tree is denied as unverifiable -- allowing it would be a bypass of
#      "pad the tree" -- and the message names the dir to narrow.
#   4. For a copy, each kept entry's DESTINATION is judged as a write, both as
#      dest/<rel> (a trailing-slash source copies its contents) and as
#      dest/<basename>/<rel> (no trailing slash), because BSD and GNU differ
#      and a wrong guess is the hole.
# An awk stage bounds the walk: when it exits, find dies of SIGPIPE.
recursive_reach() {
  local kind="$1" dir="$2" follow="${3:-0}" dest="${4:-}" depth="${5:-0}"
  local rd abs root pf entry rel
  local -a hits
  rd=$(expand_target "$dir")
  [ -z "$rd" ] && rd="."
  [ "$rd" != "/" ] && rd="${rd%/}"
  [ -d "$rd" ] || return 0
  case "$rd" in
    /*) abs="$rd" ;;
    .)  abs="$TR_CWD" ;;
    *)  abs=$(expand_target "${TR_CWD}/${rd}") ;;
  esac
  for root in "$HOME/.ssh" "$HOME/.aws" "$HOME/.gnupg" "$HOME/.claude/settings.json"; do
    [ -e "$root" ] || continue
    if [ "$abs" = "/" ] || [ "$root" = "$abs" ] || [[ "$root" == "$abs"/* ]]; then
      rr_check read "$root" "$dir"
      [ "$_target_blk" = 1 ] && return
    fi
  done

  if [ "$follow" = 1 ] && [ "$depth" -lt "$RR_LINK_DEPTH" ]; then
    mapfile -t hits < <(find -P "$rd" -name .git -prune -o -type l -print 2>/dev/null | head -n "$RR_CAP")
    for entry in "${hits[@]}"; do
      [ -z "$entry" ] && continue
      rr_check read "$entry" "$dir"
      [ "$_target_blk" = 1 ] && return
      if [ -d "$entry" ]; then
        recursive_reach read "$entry" 1 "" $((depth + 1))
        [ "$_target_blk" = 1 ] && return
      fi
    done
  fi

  pf="$RR_PREFILTER_READ"
  [ "$kind" = copy ] && pf="$RR_PREFILTER_WRITE"
  mapfile -t hits < <(find -P "$rd" -name .git -prune -o -print 2>/dev/null \
    | awk -v cap="$RR_CAP" -v re="$pf" 'NR > cap { print "\001TOOBIG"; exit } tolower($0) ~ re { print }')
  for entry in "${hits[@]}"; do
    [ -z "$entry" ] && continue
    if [ "$entry" = $'\001TOOBIG' ]; then
      _target_blk=1
      _target_why="recursive access under '$dir' is too large to check (more than $RR_CAP entries); name a narrower directory"
      return
    fi
    rr_check read "$entry" "$dir"
    [ "$_target_blk" = 1 ] && return
    [ "$kind" = copy ] || continue
    rel="${entry#"$rd"/}"
    [ "$rel" = "$entry" ] && continue
    rr_check write "${dest%/}/$rel" "$dir"
    [ "$_target_blk" = 1 ] && return
    rr_check write "${dest%/}/${rd##*/}/$rel" "$dir"
    [ "$_target_blk" = 1 ] && return
  done
}

# rr_flags <cmd> <arg> <index> -- classify one argument of a possibly-recursive
# command into the caller's rec/follow flags (bash dynamic scope; the caller
# declares them). Combined short flags (-rn, -Rl, -czf) are searched
# character-wise, so a value glued to a flag can over-trigger. That only costs
# a walk of a directory operand, never a missed one.
rr_flags() {
  local cmd="$1" ra="$2" idx="$3"
  case "$cmd" in
    rg)
      rec=1
      case "$ra" in --follow) follow=1 ;; --*) ;; -*L*) follow=1 ;; esac ;;
    tar)
      case "$ra" in
        --create) rec=1 ;;
        --dereference) follow=1 ;;
        --*) ;;
        -*c*) rec=1 ;;
        -*h*) follow=1 ;;
        # the first bundle may omit its dash: `tar czf out.tgz dir`
        *) [ "$idx" = 0 ] && [[ "$ra" == *c* ]] && rec=1 ;;
      esac ;;
    zip)
      follow=1
      case "$ra" in --*) ;; -*[rR]*) rec=1 ;; esac
      case "$ra" in --*) ;; -*y*) follow=0 ;; esac ;;
    ditto) rec=1 ;;
    cp)
      case "$ra" in
        --recursive|--archive) rec=1 ;;
        --*) ;;
        -*[Rra]*) rec=1 ;;
      esac
      case "$ra" in --*) ;; -*L*) follow=1 ;; esac ;;
    rsync)
      case "$ra" in
        --recursive|--archive) rec=1 ;;
        --copy-links) follow=1 ;;
        --*) ;;
        -*[ra]*) rec=1 ;;
      esac
      case "$ra" in --*) ;; -*L*) follow=1 ;; esac ;;
  esac
}

# rr_grep_args <args...> -- the grep family's argument grammar, for the caller's
# rec/follow/rops. The first non-flag word is the PATTERN unless -e/-f/--regexp/
# --file supplied one, and a value-taking flag's value is not an operand -- so
# `grep -r vault dir` walks dir, never a directory that merely shares the
# pattern's name. Recursion is -r/-R, --recursive, and `-d recurse` in any
# spelling (-d recurse, -drecurse, --directories=recurse).
rr_grep_args() {
  local ra rest c i want="" haspat=0 val
  local -a words=()
  for ra in "$@"; do
    if [ -n "$want" ]; then
      case "$want" in
        pat) haspat=1 ;;
        dir) [ "$ra" = recurse ] && rec=1 ;;
      esac
      want=""; continue
    fi
    case "$ra" in
      --recursive) rec=1 ;;
      --dereference-recursive) rec=1; follow=1 ;;
      --directories=recurse) rec=1 ;;
      --regexp=*|--file=*) haspat=1 ;;
      --directories) want=dir ;;
      --regexp|--file) want=pat ;;
      --max-count|--after-context|--before-context|--context|--devices|--include|--exclude|--exclude-from|--exclude-dir|--label|--binary-files) want=skip ;;
      --) ;;
      --*) ;;
      -?*)
        rest="${ra#-}"
        for ((i = 0; i < ${#rest}; i++)); do
          c="${rest:$i:1}"
          case "$c" in
            r) rec=1 ;;
            R) rec=1; follow=1 ;;
            [efmABCdD])
              val="${rest:$((i + 1))}"
              case "$c" in
                e|f) haspat=1 ;;
                d) [ "$val" = recurse ] && rec=1 ;;
              esac
              if [ -z "$val" ]; then
                case "$c" in e|f) want=skip ;; d) want=dir ;; *) want=skip ;; esac
              fi
              break ;;
          esac
        done ;;
      *) words+=("$ra") ;;
    esac
  done
  if [ "$haspat" = 1 ]; then rops=("${words[@]}"); else rops=("${words[@]:1}"); fi
}

# xargs_reads_find <roots...> -- <xargs args...> -- if the command xargs runs is
# a file reader, the find roots feeding it are read recursively. Options that
# take a separate value (-n N, -I {}, -P N ...) are skipped to find the command.
xargs_reads_find() {
  local -a roots=()
  local a skip=0 reader="" r
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do roots+=("$1"); shift; done
  shift
  for a in "$@"; do
    if [ "$skip" = 1 ]; then skip=0; continue; fi
    case "$a" in
      -n|-I|-P|-L|-s|-E|-d|-a|-J) skip=1 ;;
      -*) ;;
      *) reader="$a"; break ;;
    esac
  done
  case "$reader" in
    cat|head|tail|grep|egrep|fgrep|less|more|strings|xxd|od) ;;
    *) return 0 ;;
  esac
  for r in "${roots[@]}"; do
    recursive_reach read "$r" 1
    [ "$_target_blk" = 1 ] && return
  done
}

# recursive_dispatch <cmd> <args...> -- if <cmd> is a recursive reader or
# copier and one of its operands is a directory, judge the tree it reaches.
# A recursive flag on a plain file operand falls through recursive_reach as a
# no-op: that is an ordinary read, already judged by the per-command arms.
recursive_dispatch() {
  local cmd="$1"; shift
  case "$cmd" in grep|egrep|fgrep|rg|tar|zip|cp|rsync|ditto|git) ;; *) return 0 ;; esac
  local -a rops=() rsrcs=() snames=()
  local ra rec=0 follow=0 idx=0 prev="" rtdir="" rdest="" kind=read s m sm
  case "$cmd" in
    grep|egrep|fgrep) rr_grep_args "$@" ;;
    git)
      # only `git grep --no-index` walks the filesystem; a tracked-file grep
      # reads the index and is left alone.
      local -a gargs=()
      local g_grep=0 g_noidx=0
      for ra in "$@"; do
        if [ "$g_grep" = 0 ]; then
          [ "$ra" = grep ] && g_grep=1
        else
          [ "$ra" = --no-index ] && g_noidx=1
          gargs+=("$ra")
        fi
      done
      [ "$g_grep" = 1 ] && [ "$g_noidx" = 1 ] || return 0
      rr_grep_args "${gargs[@]}"
      rec=1 ;;
    *)
      for ra in "$@"; do
        case "$cmd:$prev" in
          cp:-t) rtdir="$ra"; prev="$ra"; idx=$((idx + 1)); continue ;;
        esac
        rr_flags "$cmd" "$ra" "$idx"
        case "$ra" in
          --target-directory=*) rtdir="${ra#--target-directory=}" ;;
          -*) ;;
          *) rops+=("$ra") ;;
        esac
        prev="$ra"; idx=$((idx + 1))
      done ;;
  esac
  [ "$rec" = 1 ] || return 0
  case "$cmd" in
    cp|rsync|ditto)
      if [ -n "$rtdir" ]; then
        rdest="$rtdir"; rsrcs=("${rops[@]}")
      elif [ "${#rops[@]}" -ge 2 ]; then
        rdest="${rops[-1]}"; rsrcs=("${rops[@]:0:${#rops[@]}-1}")
      fi
      # an rsync destination on another host is not a local write
      [[ "$rdest" == *:* && "$rdest" != /* ]] && rdest=""
      [ -n "$rdest" ] && kind=copy ;;
    *) rsrcs=("${rops[@]}") ;;
  esac
  # a recursive search with no path operand searches the cwd
  case "$cmd" in
    rg|grep|egrep|fgrep|git) [ "${#rsrcs[@]}" -eq 0 ] && rsrcs=(".") ;;
  esac
  for s in "${rsrcs[@]}"; do
    snames=("$s")
    if tr_has_glob "$s" && tr_glob_location_known "$(expand_target "$s")" \
       && sm=$(tr_glob_expand "$(expand_target "$s")") && [ -n "$sm" ]; then
      snames=()
      while IFS= read -r m; do [ -n "$m" ] && snames+=("$m"); done <<< "$sm"
    fi
    for m in "${snames[@]}"; do
      recursive_reach "$kind" "$m" "$follow" "$rdest"
      [ "$_target_blk" = 1 ] && return
    done
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
  local s="$1" i=0 n c depth q="" dq=0 buf j cj opener iq
  n=${#s}
  while [ "$i" -lt "$n" ]; do
    c="${s:$i:1}"
    if [ -n "$q" ]; then
      CMDSUB_ERASED="${CMDSUB_ERASED}${c}"
      [ "$c" = "$q" ] && q=""
      i=$((i + 1)); continue
    fi
    # A backslash outside single quotes makes the next character literal:
    # `\$(` is not a substitution, `\"` does not toggle double quotes.
    if [ "$c" = '\' ]; then
      CMDSUB_ERASED="${CMDSUB_ERASED}${s:$i:2}"; i=$((i + 2)); continue
    fi
    # A `'` inside "..." is literal, not a single-quote opener.
    if [ "$c" = "'" ] && [ "$dq" = 0 ]; then
      q="'"; CMDSUB_ERASED="${CMDSUB_ERASED}${c}"; i=$((i + 1)); continue
    fi
    [ "$c" = '"' ] && dq=$((1 - dq))
    # Process substitution `<(...)` / `>(...)` runs its payload as a command
    # exactly like `$(...)`; real bash does not recognise it inside "...".
    opener=0
    if [ "${s:$((i + 1)):1}" = "(" ]; then
      case "$c" in
        '$') opener=1 ;;
        '<'|'>') [ "$dq" = 0 ] && opener=1 ;;
      esac
    fi
    if [ "$opener" = 1 ]; then
      # Quotes nest afresh inside the payload: a paren within '...' or "..."
      # there does not count toward the span's depth.
      depth=1; j=$((i + 2)); buf=""; iq=""
      while [ "$j" -lt "$n" ] && [ "$depth" -gt 0 ]; do
        cj="${s:$j:1}"
        if [ "$cj" = '\' ] && [ "$iq" != "'" ]; then
          buf="${buf}${s:$j:2}"; j=$((j + 2)); continue
        fi
        if [ -n "$iq" ]; then
          [ "$cj" = "$iq" ] && iq=""
          buf="${buf}${cj}"; j=$((j + 1)); continue
        fi
        case "$cj" in
          "'"|'"') iq="$cj"; buf="${buf}${cj}" ;;
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

# ssh_code_values <cmd> <args...> -- fills the caller's SSH_CODE array with the
# option values and remote command that ssh/scp/sftp execute as shell text:
# -o ProxyCommand/LocalCommand/RemoteCommand (glued `-oKEY=VAL`, `-o KEY=VAL`
# and `-o "KEY VAL"`, KEY case-insensitive) and, for ssh only, the words after
# the host. Every other option is inert and left alone (#1414). The caller
# classifies each value as a command at depth+1.
ssh_code_values() {
  local cmd="$1"; shift
  local -a a=("$@")
  local k=0 n=${#a[@]} w opt key val host_seen=0 remote="" vflags
  case "$cmd" in
    ssh)  vflags="bcDEeFIiJLlmOopQRSWw" ;;
    scp)  vflags="cDFiJloPS" ;;
    *)    vflags="BbcDFiJloPRSs" ;;
  esac
  while [ "$k" -lt "$n" ]; do
    w="${a[$k]}"; k=$((k + 1))
    opt=""
    case "$w" in
      -o) [ "$k" -lt "$n" ] && { opt="${a[$k]}"; k=$((k + 1)); } ;;
      -o?*) opt="${w#-o}" ;;
      -[$vflags]) k=$((k + 1)); continue ;;
      -*) continue ;;
      *)
        if [ "$cmd" = ssh ]; then
          if [ "$host_seen" = 0 ]; then host_seen=1; else remote="${remote:+$remote }$w"; fi
        fi
        continue ;;
    esac
    opt="${opt#"${opt%%[![:space:]]*}"}"
    key="${opt%%[=[:space:]]*}"
    val="${opt#"$key"}"
    val="${val#"${val%%[![:space:]]*}"}"; val="${val#=}"
    val="${val#"${val%%[![:space:]]*}"}"
    case "${key,,}" in
      proxycommand|localcommand|remotecommand) [ -n "$val" ] && SSH_CODE+=("$val") ;;
    esac
  done
  [ -n "$remote" ] && SSH_CODE+=("$remote")
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
    mapfile -t TOKS < <(printf '%s\n' "$STRIPPED" | awk -v oldlex="$(tr_oldlex_flag "$RW_SRC")" "$TOKENIZE_AWK")
    TOKS=("${TOKS[@]//$'\001'/$'\n'}")

    local -a cur_words=()
    local prev_op="" redir_gt="" redir_lt="" RW_LEAD_SEP="" RW_PIPE_SRC="" tok w
    local RW_FIND_SEEN=0
    local -a RW_FIND_ROOTS=()

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

    # `find ROOTS ... | xargs <reader>` reads every file the find lists, which
    # no operand of either stage names. Only a find stage feeding an xargs
    # stage DIRECTLY is recognised: the roots are judged as a recursive read.
    local xf_seen="$RW_FIND_SEEN"
    local -a xf_roots=("${RW_FIND_ROOTS[@]}")
    RW_FIND_SEEN=0; RW_FIND_ROOTS=()
    if [ "$xf_seen" = 1 ] && [ "$RW_LEAD_SEP" = "|" ] && [ "$cmdname" = xargs ]; then
      xargs_reads_find "${xf_roots[@]}" -- "${args[@]}"
      [ "$_target_blk" = 1 ] && return
    fi

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
        local dest="" dres s sm m
        local -a srcs=() snames
        if [ -n "$tdir" ]; then
          check_target "write" "$tdir"
          dest="$tdir"
          for s in "${nonflag[@]}"; do [ "$s" != "$tdir" ] && srcs+=("$s"); done
        elif [ "${#nonflag[@]}" -gt 0 ]; then
          check_target "write" "${nonflag[-1]}"
          dest="${nonflag[-1]}"
          srcs=("${nonflag[@]:0:${#nonflag[@]}-1}")
        fi
        # Copying INTO a directory writes <dir>/<basename of each source>:
        # `cp template/AGENTS.md .` overwrites ./AGENTS.md, which testing
        # the directory alone never caught (Codex QA, 2026-10-13). A wildcard
        # source is tested through its real matches where they are knowable,
        # and by its pattern otherwise.
        if [ "$_target_blk" != 1 ] && [ -n "$dest" ] && [ "${#srcs[@]}" -gt 0 ]; then
          dres=$(expand_target "$dest")
          [ -z "$dres" ] && dres="."
          if [ -n "$tdir" ] || [ -d "$dres" ] || [[ "$dest" == */ ]] || [ "$dest" = "." ]; then
            for s in "${srcs[@]}"; do
              snames=("$s")
              if tr_has_glob "$s" && tr_glob_location_known "$(expand_target "$s")" \
                 && sm=$(tr_glob_expand "$(expand_target "$s")") && [ -n "$sm" ]; then
                snames=()
                while IFS= read -r m; do [ -n "$m" ] && snames+=("$m"); done <<< "$sm"
              fi
              for m in "${snames[@]}"; do
                m="${m%/}"
                check_target "write" "${dres%/}/${m##*/}"
                [ "$_target_blk" = 1 ] && break 2
              done
            done
          fi
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
      find)
        # Roots are the leading operands up to the first expression word;
        # none given means ".". Remembered for a following `| xargs`.
        RW_FIND_SEEN=1
        for a in "${args[@]}"; do
          case "$a" in -*|"!"|"("|"\\(") break ;; esac
          RW_FIND_ROOTS+=("$a")
        done
        [ "${#RW_FIND_ROOTS[@]}" -eq 0 ] && RW_FIND_ROOTS=(".")
        # -fprint/-fprint0/-fprintf/-fls write the FILE operand that follows.
        # Bash drops backslashes and quotes after this hook judges, so compare
        # and check the words with them removed.
        local fi_idx fi_arg
        for fi_idx in "${!args[@]}"; do
          fi_arg="${args[$fi_idx]//[\\\'\"\$]/}"
          # The tokenizer drops the `$'` of ANSI-C quoting, so with one anywhere
          # in the command every arg may be a spelled-out write primary.
          if [[ "$fi_arg" =~ ^-(fprint|fprint0|fprintf|fls)$ || "$COMMAND" == *'$'\'* ]]; then
            fi_arg="${args[$((fi_idx + 1))]//[\\\'\"\$]/}"
            check_target "write" "$fi_arg"
          fi
        done ;;
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

    # A recursive reader or copier is judged by the tree it reaches, not only
    # by the directory it names (the arms above test the literal operands).
    recursive_dispatch "$cmdname" "${args[@]}"
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

    case "$cmdname" in
      ssh|scp|sftp)
        local sc; local -a SSH_CODE=()
        ssh_code_values "$cmdname" "${args[@]}"
        for sc in "${SSH_CODE[@]}"; do
          scan_rw "$sc" $((RW_DEPTH + 1))
          [ "$_target_blk" = 1 ] && return
        done ;;
    esac

    # Inverted read scan — every argument token, whatever the command is.
    # Pattern/script arguments of grep/awk/sed are still skipped: they are
    # regexes, not paths, and a pattern naming a path must stay allowed (D24).
    # A flag word contributes only its =VALUE half (--file=~/.ssh/id_rsa);
    # a bare flag is never a path. An attached short-flag value is the same
    # target (-f~/.ssh/id_rsa, -f"$HOME/.ssh/id_rsa"): scan what follows the
    # flag letter, and what follows any `~`/`$`/`/` inside combined flags.
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
    # A read-only find's -name/-path/-regex VALUES are patterns matched against
    # names it walks, not files it opens (Athanor session 2026-10-24: `find
    # <root> -not -path '*/.git/*'` was denied as a read of `*/.git/*`). The
    # ROOTS are still judged above; with -exec/-delete/-L present ro_find_stage
    # fails and every operand keeps today's verdict.
    local nf_seen=0 ro_find=0 pat_next=0
    [ "$cmdname" = find ] && ro_find_stage "find ${args[*]}" && ro_find=1
    for a in "${args[@]}"; do
      if [ "$pat_next" = 1 ]; then pat_next=0; continue; fi
      if [ "$ro_find" = 1 ]; then
        case "$a" in
          -name|-iname|-path|-ipath|-wholename|-iwholename|-regex|-iregex|-lname|-ilname)
            pat_next=1; continue ;;
        esac
      fi
      rw_is_exempt "$a" "${RW_EXEMPT[@]}" && continue
      # An exclude pathspec names what git does NOT read (saoc-nos-site-7d
      # 2026-10-18: `git diff -- ':!docs/*'` denied as a read of `:!docs/*`).
      # Positive pathspecs keep the ordinary verdict.
      # Only when this git invocation is itself a read-only stage: `git -c
      # diff.external=x diff -- ':!x'` keeps the ordinary verdict.
      if [ "$cmdname" = git ] && ro_git_stage "git ${args[*]}"; then
        case "$a" in ':('*exclude*')'*|':!'*|':^'*) continue ;; esac
      fi
      case "$a" in
        -*)
          case "$a" in *=*) scan_read_token "${a#*=}" ;; esac
          case "$a" in
            --*) ;;
            -??*)
              scan_read_token "${a:2}"
              local av="${a:2}"
              av="${av#"${av%%[\~\$/]*}"}"
              [ -n "$av" ] && [ "$_target_blk" != 1 ] && scan_read_token "$av" ;;
          esac ;;
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

  # fl_find_exec_ok <chmod-ok> <word> … — the words after one find
  # -exec/-execdir, up to its `;`/`+` terminator. True only when the exec'd
  # command is a harmless, non-destructive one (a fixed allowlist; cat is
  # deliberately absent), named bare or from a system bin directory. chmod
  # additionally needs <chmod-ok>=1 (every start path under .tmp/) and no
  # argument granting world-write.
  FL_FIND_EXEC_CMDS=" du ls stat wc file grep egrep fgrep head tail shasum sha1sum sha256sum md5 md5sum cksum basename dirname chmod "

  # fl_exec_flag_ok <command> <flag> — true only for a flag on the exec'd
  # command's own allowlist; every other flag (recursion, symlink following,
  # --files0-from, file -f, long options) denies. Sets FE_TAKE=1 when the
  # flag takes the next word as a numeric value (head -n 5, shasum -a 256).
  fl_exec_flag_ok() {
    local f="$2"
    FE_TAKE=0
    case "$1" in
      du) [[ "$f" =~ ^-([shkca]+|d[0-9]+)$ ]] ;;
      ls) [[ "$f" =~ ^-[lahd1tSrF]+$ ]] ;;
      wc) [[ "$f" =~ ^-[lcwm]+$ ]] ;;
      file) [[ "$f" =~ ^-[bi]+$ ]] ;;
      grep|egrep|fgrep) [[ "$f" =~ ^-[lLnciHhEFwvqso]+$ ]] ;;
      head|tail)
        case "$f" in -n|-c) FE_TAKE=1; return 0 ;; esac
        [[ "$f" =~ ^-[nc][0-9]+$ ]] ;;
      shasum|sha1sum|sha256sum)
        [ "$f" = "-a" ] && { FE_TAKE=1; return 0; }
        return 1 ;;
      *) return 1 ;;
    esac
  }

  fl_find_exec_ok() {
    local chmod_ok="$1" c="${2##*/}" a
    case "$2" in
      */*) [[ "$2" =~ ^/(usr/)?s?bin/[A-Za-z0-9]+$ ]] || return 1 ;;
    esac
    [ -n "$c" ] || return 1
    [[ "$FL_FIND_EXEC_CMDS" == *" $c "* ]] || return 1
    if [ "$c" = chmod ]; then [ "$chmod_ok" = 1 ] || return 1; fi
    shift 2
    # Every operand up to the terminator must be exactly `{}`, except chmod's
    # mode word and a grep pattern (first operand, or an -e value). Flags
    # must be on the command's allowlist; a numeric flag value (FE_TAKE)
    # belongs to its flag and must be digits.
    local prev="" npos=0 pat=0 skip=0
    case "$c" in grep|egrep|fgrep) pat=1 ;; esac
    for a in "$@"; do
      case "$a" in
        '\;'|'\'|';') break ;;
        '+') [ "$prev" = "{}" ] && break ;;
      esac
      prev="$a"
      if [ "$skip" = 1 ]; then skip=0; continue; fi
      if [ "$skip" = 2 ]; then
        skip=0; [[ "$a" =~ ^[0-9]+$ ]] || return 1; continue
      fi
      case "$a" in
        -e) [ "$pat" -ge 1 ] && { pat=2; skip=1; continue; } ;;
        -*)
          fl_exec_flag_ok "$c" "$a" || return 1
          [ "$FE_TAKE" = 1 ] && skip=2
          continue ;;
      esac
      npos=$((npos + 1))
      if [ "$npos" -eq 1 ] && [ "$c" = chmod ]; then
        case "$a" in 777|0777|a+rwx|*+rwx|o+w|*o+w*|a+w|*7) return 1 ;; esac
        continue
      fi
      [ "$npos" -eq 1 ] && [ "$pat" = 1 ] && continue
      [ "$a" = "{}" ] || return 1
    done
    return 0
  }

  # fl_cred_shaped <name-test-value> — true when a find -name/-path/-regex
  # value names a credential (case-insensitive substring match).
  FL_CRED_SHAPES=(id_rsa id_dsa id_ecdsa id_ed25519 .pem .key .p12 .pfx .env
    credentials .netrc .npmrc .pgpass .ssh .aws .gnupg secrets)
  fl_cred_shaped() {
    local v="${1,,}" s
    for s in "${FL_CRED_SHAPES[@]}"; do
      [[ "$v" == *"$s"* ]] && return 0
    done
    return 1
  }

  # fl_find_tail <chmod-ok> <find-word> … — judges the primaries of one find
  # (or of a segment of it split off at `\;`). Sets FT_EXEC=1 when it execs.
  # -delete/-ok deny; an -exec must run an allowed command on `{}` only, use
  # no word reaching outside the tree (`~`, `$`, `..`, a leading `/`) other
  # than the exec'd command's path, never follow symlinks, and carry a
  # `-type f` or `-type d` test with no other -type/-xtype, so a matched
  # symlink is never operated on.
  fl_find_tail() {
    local chmod_ok="$1" a j m fout=0 ffollow=0 ntype=0 badtype=0 fbool=0 inexec=0 fcred=0
    shift
    local -a fw=("$@")
    FT_EXEC=0
    m=${#fw[@]}
    for ((j = 0; j < m; j++)); do
      a="${fw[$j]}"
      # Primaries are judged outside the exec'd command's own words; any
      # boolean operator could route a non -type f/d match to the exec.
      if [ "$inexec" = 1 ]; then
        case "$a" in
          ';'|'\;'|'\') inexec=0 ;;
          '+') [ "${fw[$((j - 1))]}" = "{}" ] && inexec=0 ;;
        esac
      else
        case "$a" in
          -exec|-execdir) inexec=1 ;;
          '!'|'\!'|-not|-o|-or|-a|-and|'('|')'|'\('|'\)'|',') fbool=1 ;;
          -follow|-L|-H) ffollow=1 ;;
          -xtype) badtype=1 ;;
          -type)
            case "${fw[$((j + 1))]}" in f|d) ntype=$((ntype + 1)) ;; *) badtype=1 ;; esac ;;
          -name|-iname|-path|-ipath|-wholename|-regex|-iregex)
            fl_cred_shaped "${fw[$((j + 1))]}" && fcred=1 ;;
        esac
      fi
      if [ "$j" -gt 0 ]; then
        case "${fw[$((j - 1))]}" in -exec|-execdir) continue ;; esac
      fi
      case "$a" in *"~"*|*'$'*|*..*|/*) fout=1 ;; esac
    done
    for ((j = 0; j < m; j++)); do
      a="${fw[$j]}"
      fl_word "$a" || continue
      case "$a" in
        -delete|--delete|-ok|-okdir|--exec)
          _blk=1; _why="find -delete/-exec"; return ;;
        -exec|-execdir)
          FT_EXEC=1
          fl_find_exec_ok "$chmod_ok" "${fw[@]:$((j + 1))}" \
            || { _blk=1; _why="find -delete/-exec"; return; } ;;
      esac
    done
    [ "$FT_EXEC" = 1 ] || return
    if [ "$fout" = 1 ] || [ "$ffollow" = 1 ]; then
      _blk=1; _why="find -exec outside the tree"; return
    fi
    if [ "$fbool" = 1 ]; then
      _blk=1; _why="find -exec with a boolean operator (! -not -o -a parens)"; return
    fi
    if [ "$fcred" = 1 ]; then
      _blk=1; _why="find -exec on a credential-shaped name"; return
    fi
    if [ "$ntype" -eq 0 ] || [ "$badtype" = 1 ]; then
      _blk=1; _why="find -exec without -type f/-type d; add -type f"; return
    fi
  }

  # Stages that may follow a curl in a pipeline without counting as a write.
  FL_PIPE_CONSUMERS=" grep egrep fgrep head tail wc cut tr jq "

  # curl flags that only shape the request or what reaches stdout. Any flag
  # outside these two sets may write a file (-o, -c, --etag-save, --hsts,
  # --libcurl, --stderr, ...), so it is an allowlist, never a blocklist.
  FL_CURL_VAL_FLAGS=" -X -H -d -A -e -u -m -w --request --header --data --data-raw --data-binary --data-urlencode --json --user-agent --referer --max-time --connect-timeout --retry --retry-delay --write-out "
  FL_CURL_BARE_FLAGS=" --silent --show-error --fail --fail-with-body --location --head --include --verbose --insecure --get --compressed "

  # fl_curl_stdout_only <arg> … — true when every flag is on the allowlist,
  # combined short flags are made only of sSfLIivkG, and no write-out value
  # carries %output{.
  fl_curl_stdout_only() {
    local a val=0
    for a in "$@"; do
      # A substitution or variable can spell a flag or %output{ at run time.
      case "$a" in *'%output{'*|*'$('*|*'`'*) return 1 ;; esac
      # A write-out value with `$`, or one read from a file/stdin (@…), can
      # carry %output{ at run time.
      if [ "$val" = w ]; then
        case "$a" in *'$'*|@*) return 1 ;; esac
      fi
      # /dev/null is the one output target that writes no file.
      if [ "$val" = o ]; then [ "$a" = /dev/null ] || return 1; val=0; continue; fi
      if [ "$val" != 0 ]; then val=0; continue; fi
      case "$a" in
        --output=/dev/null) ;;
        -o|--output) val=o ;;
        --write-out=*) case "$a" in *'$'*|--write-out=@*) return 1 ;; esac ;;
        --*=*) [[ "$FL_CURL_VAL_FLAGS" == *" ${a%%=*} "* ]] || return 1 ;;
        -w|--write-out) val=w ;;
        -*)
          if [[ "$FL_CURL_VAL_FLAGS" == *" $a "* ]]; then val=1
          elif [[ "$FL_CURL_BARE_FLAGS" == *" $a "* ]]; then :
          else [[ "$a" =~ ^-[sSfLIivkG]+$ ]] || return 1
          fi ;;
      esac
    done
    return 0
  }

  # Download targets with these extensions are data: running a different local
  # script cannot execute them.
  FL_DATA_EXTS=" html htm json xml txt csv md svg "

  # fl_data_target <path> — true when the path has a data-file extension.
  fl_data_target() {
    local b="${1##*/}"
    b="${b,,}"
    [[ "$b" == *.* ]] || return 1
    [[ "$FL_DATA_EXTS" == *" ${b##*.} "* ]]
  }

  # fl_nlink <path> — hard-link count (GNU stat first, then BSD/macOS).
  fl_nlink() {
    stat -c %h -- "$1" 2>/dev/null || stat -f %l -- "$1" 2>/dev/null || echo 0
  }

  # fl_unaliased <relative-path> — no component, the file included, is a
  # symlink, and an existing file has link count 1. An alias on disk (symlink
  # or hardlink) could make a script and a downloaded data file the same bytes.
  # A path that does not exist cannot be an alias.
  fl_unaliased() {
    local p="$1" cum="" part
    local -a parts
    IFS=/ read -r -a parts <<< "$p"
    for part in "${parts[@]}"; do
      cum="${cum:+$cum/}$part"
      [ -L "$cum" ] && return 1
    done
    [ -e "$p" ] || return 0
    [ "$(fl_nlink "$p")" = 1 ]
  }

  # fl_json_tool <interpreter> <arg> … — true only for `python3 -I -m json.tool`
  # with allowlisted flags. Any local script can treat its input as code
  # (contract.py runs a downloaded contract's verify.cmd), so json.tool is the
  # one consumer that is ever relaxed. Its non-flag operands are left in
  # FL_JT_OPERANDS: a second operand is json.tool's OUTFILE, a write.
  fl_json_tool() {
    local name="$1" a; shift
    FL_JT_OPERANDS=()
    # `-I` drops the cwd and user site from sys.path (a local json/tool.py would
    # otherwise shadow the stdlib under -m) and ignores PYTHON* variables.
    [ "$name" = python3 ] || return 1
    [ "${1:-}" = -I ] && [ "${2:-}" = -m ] && [ "${3:-}" = json.tool ] || return 1
    shift 3
    while [ $# -gt 0 ]; do
      a="$1"; shift
      case "$a" in
        --sort-keys|--compact|--no-ensure-ascii|--json-lines) ;;
        --indent) [[ "${1:-}" =~ ^[0-9]+$ ]] || return 1; shift ;;
        -*) return 1 ;;
        *) FL_JT_OPERANDS+=("$a") ;;
      esac
    done
  }

  # fl_stdin_is_data <interpreter> <arg> … — true when the consumer is a
  # json.tool that reads only stdin and cannot execute the bytes arriving on it.
  fl_stdin_is_data() {
    [ "$FL_TWO" = 1 ] && [ "$FL_NET_FILE" != 1 ] || return 1
    fl_json_tool "$@" && [ "${#FL_JT_OPERANDS[@]}" -eq 0 ]
  }

  # fl_dl_words_ok <arg> … — every word of a curl/wget is classified: a flag
  # (with its value) or exactly ONE http(s) URL operand. Any other bare word
  # means the line is not the plain download it looks like.
  fl_dl_words_ok() {
    local a skip=0 nurl=0
    for a in "$@"; do
      if [ "$skip" = 1 ]; then skip=0; continue; fi
      case "$a" in
        http://*|https://*) nurl=$((nurl + 1)) ;;
        -o|--output|-O|--output-document|-w|--write-out) skip=1 ;;
        --*=*) ;;
        -*) [[ "$FL_CURL_VAL_FLAGS" == *" $a "* ]] && skip=1 ;;
        *) return 1 ;;
      esac
    done
    [ "$nurl" -eq 1 ]
  }

  # fl_data_download <curl|wget> <arg> … — true when the command's only file
  # writes are -o/-O targets with data extensions; those targets are appended
  # to FL_DATA_TARGETS. Everything else about the command must be on the
  # stdout-only allowlist (curl) or be -q/-nv/URLs (wget).
  fl_data_download() {
    local name="$1" a; shift
    local -a rest=() tgts=()
    while [ $# -gt 0 ]; do
      a="$1"; shift
      case "$name:$a" in
        curl:-o|curl:--output|wget:-O|wget:--output-document)
          [ $# -ge 1 ] || return 1
          tgts+=("$1"); shift ;;
        curl:--output=*) tgts+=("${a#--output=}") ;;
        wget:--output-document=*) tgts+=("${a#--output-document=}") ;;
        wget:-q|wget:--quiet|wget:-nv) ;;
        wget:-*) return 1 ;;
        *) rest+=("$a") ;;
      esac
    done
    [ "${#tgts[@]}" -eq 1 ] || return 1
    if [ "$name" = curl ]; then fl_curl_stdout_only "${rest[@]}" || return 1; fi
    # A target must be a literal path that is not reached through a symlink
    # (expand_target hops symlinked components; it leaves a plain path alone).
    local plain
    for a in "${tgts[@]}"; do
      fl_data_target "$a" || return 1
      case "$a" in *'$'*|*'~'*|*'`'*|*..*|*[\*\?\[\{]*) return 1 ;; esac
      plain="${a#./}"
      case "$a" in /*) return 1 ;; esac
      [ "$FL_CWD_OK" = 1 ] || return 1
      path_in_project "$(expand_target "$PWD/$a")" || return 1
      [ "$(expand_target "$a")" = "$plain" ] || return 1
      fl_unaliased "$plain" || return 1
    done
    FL_DATA_TARGETS+=("${tgts[@]}")
  }

  # fl_data_followup_ok <interpreter> <arg> … — after a download whose only
  # writes are data files, this is the very NEXT simple command after the
  # download (fl_dl_next, set by fl_check_cmd; nothing such as mv/cp between),
  # and the command is `python -m json.tool` with at most one operand, exactly
  # a downloaded data file (a second operand would be its OUTFILE, a write).
  fl_data_followup_ok() {
    [ "$FL_TWO" = 1 ] && [ "$FL_NET_DATA" = 1 ] && [ "$fl_dl_next" = 1 ] || return 1
    local t op
    fl_json_tool "$@" || return 1
    [ "${#FL_JT_OPERANDS[@]}" -le 1 ] || return 1
    [ "${#FL_JT_OPERANDS[@]}" -eq 0 ] && return 0
    op="${FL_JT_OPERANDS[0]#./}"
    for t in "${FL_DATA_TARGETS[@]}"; do
      [ "$op" = "${t#./}" ] && return 0
    done
    return 1
  }

  # The session cwd must be the hook's own, or a relative find root names a
  # different directory than the one resolved here. Fail closed.
  FL_CWD_OK=0
  _fl_cwd=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")
  { [ -z "$_fl_cwd" ] || [ "$_fl_cwd" -ef "$(pwd)" ]; } && FL_CWD_OK=1
  unset _fl_cwd
  FL_ROOT_HOPS=8

  # fl_find_root <path> — sets FL_ROOT_IN (resolves inside the project) and
  # FL_ROOT_TMP (resolves inside <root>/.tmp). Every symlinked component is
  # hopped, repeatedly, until the path stops changing.
  fl_find_root() {
    local p="$1" r prev k
    local -A VARS=()
    FL_ROOT_IN=0; FL_ROOT_TMP=0
    [ "$FL_CWD_OK" = 1 ] && [ -n "$TR_CWD" ] && [ -n "$TR_PROJECT_ROOT" ] || return
    while [[ "$p" == */ && "$p" != / ]]; do p="${p%/}"; done
    case "$p" in /*) r="$p" ;; *) r="${TR_CWD}/${p}" ;; esac
    for ((k = 0; k < FL_ROOT_HOPS; k++)); do
      prev="$r"; r=$(expand_target "$r")
      [ "$r" = "$prev" ] && break
    done
    [ "$r" = "$prev" ] || return
    path_in_project "$r" || return
    FL_ROOT_IN=1
    case "$r" in "$TR_PROJECT_ROOT/.tmp"|"$TR_PROJECT_ROOT/.tmp/"*) FL_ROOT_TMP=1 ;; esac
  }

  # fl_check_cmd <separator-before-this-command> <word> … — the whole verdict
  # for ONE simple command. Every rule keys on the command name and its own
  # arguments; none of them searches the command text.
  fl_check_cmd() {
    [ "$_blk" = 1 ] && return
    local sep="$1"; shift
    local -a w=("$@")
    local n=${#w[@]} i=0 j m a name sub wrap rec=0 frc=0 seen_c=0 guard=0
    # A curl's pipeline wrote a file if any later stage redirects to one; the
    # stage's command name is judged below once it is known.
    if [ "$sep" != "|" ]; then FL_NET_PIPE=0
    elif [ "$FL_NET_PIPE" = 1 ] && [ "$FL_WROTE" = 1 ]; then FL_NET_FILE=1; FL_NET_DATA=0
    fi
    [ "$n" -eq 0 ] && return
    # Only the command directly after a data download may be judged a harmless
    # follow-up; whatever runs next consumes the window.
    local fl_dl_next="$FL_DL_NEXT"; FL_DL_NEXT=0

    # Grouping and negation punctuation is not a command name. `{ rm -rf /; }`
    # and `( rm -rf / )` run exactly the program the bare form runs; the lexer
    # emits the brace or paren as its own word, so without this the command
    # under it is never reached and the floor never sees it.
    # Function definitions (`f(){ cmd; }`, `function f { cmd; }`) are the same:
    # the lexer glues the header into one word and the body's first command
    # would otherwise be demoted to an argument.
    while [ "$i" -lt "$n" ]; do
      case "${w[$i]}" in
        "{"|"("|"!"|"(("|"()") i=$((i + 1)) ;;
        function) i=$((i + 2)) ;;
        *)
          [[ "${w[$i]}" =~ ^[A-Za-z_][A-Za-z0-9_.:-]*\(\)\{?$ ]] || break
          i=$((i + 1)) ;;
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
    # `env NAME=value cmd`: the assignments after a wrapper are not the command.
    while [ "$i" -lt "$n" ] && [[ "${w[$i]}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do i=$((i + 1)); done
    [ "$i" -ge "$n" ] && return

    name="${w[$i]##*/}"
    # `(rm -rf /)` glues the paren to the name — the lexer has no reason to
    # split it, so strip it here rather than let punctuation hide a command.
    while [ -n "$name" ]; do
      case "$name" in "("*|"{"*) name="${name#?}" ;; *) break ;; esac
    done
    [ -z "$name" ] && return
    # A NAME=value prefix or a wrapper (env, command, exec, ...) can turn stdin
    # or a data file into a program (PYTHONINSPECT, NODE_OPTIONS, ...): the data
    # relaxations need the command name to be the very first word, bare.
    { [ "$i" -eq 0 ] && [ "${w[0]}" = "$name" ]; } || FL_TWO=0
    local -a args=("${w[@]:$((i + 1))}")
    # Only a pure read-only consumer downstream of a curl leaves no file
    # behind (`| cat > f`, `| dd of=f`, `| sponge f`, `| tee f` all write).
    # An interpreter given its own program (-c/-e or a script) only reads the
    # curl's output as data; it is not a write.
    if [ "$FL_NET_PIPE" = 1 ] && [ "$sep" = "|" ] \
       && [[ "$FL_PIPE_CONSUMERS" != *" $name "* ]] \
       && ! fl_stdin_is_data "$name" "${args[@]}"; then
      FL_NET_FILE=1; FL_NET_DATA=0
    fi

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
            "|") fl_stdin_is_data "$name" "${args[@]}" \
                   || { _blk=1; _why="curl/wget piped to shell"; return; } ;;
            "&&"|"||"|";")
              [ "$FL_NET_FILE" = 1 ] && ! fl_data_followup_ok "$name" "${args[@]}" \
                && { _blk=1; _why="download-then-exec"; return; } ;;
          esac ;;
      esac
      case "${w[$i]}" in
        ./*) case "$sep" in
               "&&"|"||"|";") [ "$FL_NET_FILE" = 1 ] && { _blk=1; _why="download-then-exec"; return; } ;;
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
        # A find that execs must stay inside the tree: no word reaching out
        # (`~`, `$`, `..`, a leading `/`) except the exec'd command's own
        # path. Every start path, symlinks resolved, must lie in the project
        # (in <root>/.tmp for chmod), and symlink following (-H -L -follow)
        # is never allowed with an exec.
        local ffollow=0 fin=1 fchmod=1 nstart=0
        m=${#args[@]}; j=0
        # Leading options precede the start paths; -H and -L follow symlinks.
        while [ "$j" -lt "$m" ]; do
          case "${args[$j]}" in
            -*[HL]*) ffollow=1 ;;
            -*) ;;
            *) break ;;
          esac
          j=$((j + 1))
        done
        while [ "$j" -lt "$m" ]; do
          case "${args[$j]}" in -*|"("|")"|"!"|"\\("|"\\)"|"\\!") break ;; esac
          fl_find_root "${args[$j]}"
          [ "$FL_ROOT_IN" = 1 ] || fin=0
          [ "$FL_ROOT_TMP" = 1 ] || fchmod=0
          nstart=$((nstart + 1)); j=$((j + 1))
        done
        if [ "$nstart" -eq 0 ]; then
          fl_find_root "."
          [ "$FL_ROOT_IN" = 1 ] || fin=0
          [ "$FL_ROOT_TMP" = 1 ] || fchmod=0
        fi
        fl_find_tail "$fchmod" "${args[@]}"
        [ "$_blk" = 1 ] && return
        if [ "$FT_EXEC" = 1 ] && { [ "$fin" = 0 ] || [ "$ffollow" = 1 ]; }; then
          _blk=1; _why="find -exec outside the tree"; return
        fi ;;
      -*)
        # The lexer splits `find … \; -exec …` (or `\; -o -exec …`) at the
        # `;`, so the rest of the find arrives as its own command whose name
        # is a find primary. Its start paths are not visible here, so chmod is
        # never allowed, and the segment must carry its own -type f/-type d.
        fl_find_tail 0 "$name" "${args[@]}" ;;
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
        # A later local command is a download-then-exec only if a file was
        # written: wget always; curl unless every flag is on the stdout-only
        # allowlist; a redirect or a process substitution anywhere in the
        # command. Later stages of its pipeline are judged at the top of
        # fl_check_cmd.
        FL_NET=1
        fl_dl_words_ok "${args[@]}" || FL_TWO=0
        if [ "$name" = wget ] || [ "$FL_WROTE" = 1 ] || [ "$FL_PROCSUB" = 1 ] \
           || ! fl_curl_stdout_only "${args[@]}"; then
          FL_NET_FILE=1
          if [ "$FL_WROTE" = 1 ] || [ "$FL_PROCSUB" = 1 ] \
             || ! fl_data_download "$name" "${args[@]}"; then
            FL_NET_DATA=0
          else
            FL_DL_NEXT=1
          fi
        fi
        FL_NET_PIPE=1 ;;
      ssh|scp|sftp)
        local sc; local -a SSH_CODE=()
        ssh_code_values "$name" "${args[@]}"
        for sc in "${SSH_CODE[@]}"; do
          fl_classify "$sc" $((FL_DEPTH + 1))
          [ "$_blk" = 1 ] && return
        done ;;
    esac
  }

  # fl_classify <command-string> <depth> — lex it, split it into simple
  # commands, and hand each to fl_check_cmd with the separator that preceded
  # it. All state is local, so the recursion below cannot clobber its caller.
  fl_classify() {
    local src="$1" FL_DEPTH="${2:-0}" FL_NET=0 FL_NET_FILE=0 FL_WROTE=0 FL_PIPE_SRC=""
    local FL_PROCSUB=0 FL_NET_PIPE=0 FL_NET_DATA=1 FL_DL_NEXT=0 FL_TWO=0
    local -a FL_DATA_TARGETS=()
    [ -z "$src" ] && return
    [[ "$src" == *'<('* || "$src" == *'>('* ]] && FL_PROCSUB=1
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
    # Command/process substitution payloads are commands in their own right,
    # exactly as scan_rw treats them; cmdsub_scan is called directly (never via
    # $(...)) so payload newlines survive.
    local CMDSUB_ERASED=""
    local -a CMDSUB_PAYLOADS=()
    cmdsub_scan "$stripped"
    stripped="$CMDSUB_ERASED"
    local csp
    for csp in "${CMDSUB_PAYLOADS[@]}"; do
      fl_classify "$csp" $((FL_DEPTH + 1))
      [ "$_blk" = 1 ] && return
    done
    mapfile -t toks < <(printf '%s\n' "$stripped" | awk -v oldlex="$(tr_oldlex_flag "$src")" "$TOKENIZE_AWK")
    toks=("${toks[@]//$'\001'/$'\n'}")

    # The data relaxations (curl | script, data download then script) apply only
    # to a top-level command that is EXACTLY two simple commands and nothing
    # else: no heredoc program, no substitution payload, no command before,
    # between or after, so no earlier `ln -s` can alias a path the hook judges.
    local ncmd=0 tw=0
    for tok in "${toks[@]}"; do
      case "$tok" in
        "OP:;"|"OP:&&"|"OP:||"|"OP:|"|"OP:NL") [ "$tw" = 1 ] && ncmd=$((ncmd + 1)); tw=0 ;;
        W:*) tw=1 ;;
      esac
    done
    [ "$tw" = 1 ] && ncmd=$((ncmd + 1))
    # The count above only knows the separators the lexer knows. A bare `&`,
    # `|&`, a group, a redirect or a backtick can hide a command from it, so the
    # raw text must hold none of them.
    local rawsep="${src//&&/}"
    [ "$ncmd" -eq 2 ] && [ "$FL_DEPTH" -eq 0 ] && [ -z "$code" ] \
      && [ "${#CMDSUB_PAYLOADS[@]}" -eq 0 ] \
      && [[ "$rawsep" != *[\&\(\)\{\}\<\>\`\$\~\\\*\?\[]* ]] && FL_TWO=1

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
          words=(); redir=0; FL_WROTE=0 ;;
        "OP:>"|"OP:>>") redir=2 ;;
        "OP:<"|"OP:<<") redir=1 ;;
        W:*)
          # `|&` is a pipe: the lexer leaves its `&` as a word of its own, which
          # would otherwise be taken for the next command's name.
          [ "${tok#W:}" = "&" ] && [ "$sep" = "|" ] && [ "${#words[@]}" -eq 0 ] && continue
          if [ "$redir" = 2 ]; then
            # An output redirect writes a file unless it is /dev/null or an
            # fd duplication (2>&1, >&-).
            case "${tok#W:}" in /dev/null|"&"[0-9]|"&-") ;; *) FL_WROTE=1 ;; esac
            redir=0
          elif [ "$redir" = 1 ]; then redir=0; else words+=("${tok#W:}"); fi ;;
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

# ── cd-chain auto-allow ───────────────────────────────────────────────────────
# Claude Code's own permission engine cannot statically resolve a cd-chained
# Bash command (`cd DIR && cmd`) and falls back to a manual approval ask even
# under bypassPermissions whenever a Read()/Write() deny rule exists in
# settings.json (upstream anthropics/claude-code#20085, #37621, #4956) --
# sandbox.md calls this out as "the single most common source of
# interruptions during autonomous work." We already resolve DIR correctly
# through expand_target()/path_in_project() (F28, lib/target_resolve.sh) for
# the read/write floor checks above; this tells Claude Code's engine about
# that resolution instead of leaving it to re-ask a question we already
# answered. A PreToolUse hook returning permissionDecision:"allow" is a
# native, documented Claude Code mechanism -- not a custom permission engine.
#
# Scope, deliberately narrow: only a literal `cd DIR && ...` / `cd DIR; ...`
# shape, where DIR resolves inside TR_PROJECT_ROOT and is not floor-protected.
# DIR containing a variable, command substitution, or glob is left alone (it
# cannot be resolved safely, so it must still get Claude Code's normal
# ask/deny), and so is any DIR that resolves outside the project root --
# leaving the work folder still prompts, exactly as it should.
if [ "$TOOL" = "Bash" ] && [[ "$COMMAND" =~ ^cd[[:space:]]+([^\&\;\|$'\n']+)[\ \t]*(\&\&|\;|$'\n') ]]; then
  _cd_target="${BASH_REMATCH[1]}"
  _cd_target="${_cd_target%\"}"; _cd_target="${_cd_target#\"}"
  _cd_target="${_cd_target%\'}"; _cd_target="${_cd_target#\'}"
  _cd_target="${_cd_target%"${_cd_target##*[! ]}"}"
  case "$_cd_target" in
    *'$'*|*'`'*|*'*'*|*'?'*|*'['*) ;;  # unresolvable -- fall through unchanged
    *)
      _cd_resolved="$(expand_target "$_cd_target")"
      # floor_glob_match's globs require a path segment AFTER the protected
      # dir (e.g. */execution/hooks/*), so cd'ing to the bare directory
      # itself would not match. Testing "$_cd_resolved/" too catches that.
      if path_in_project "$_cd_resolved" \
        && ! floor_glob_match "$_cd_resolved" \
        && ! floor_glob_match "$_cd_resolved/"; then
        printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"cd target resolves inside the project root and is not floor-protected"}}'
        exit 0
      fi
      ;;
  esac
fi

# ── All other cases: allow ────────────────────────────────────────────────────
exit 0
