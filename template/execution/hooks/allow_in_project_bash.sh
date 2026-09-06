#!/usr/bin/env bash
# allow_in_project_bash.sh — PreToolUse hook (Bash) that pre-empts Claude
# Code 2.1.259's built-in permission heuristic (manual-approval prompts on
# `cd`+write, `cd`+redirect, and non-statically-enumerable glob roots) by
# emitting an explicit hookSpecificOutput.permissionDecision:"allow" when —
# and only when — the command is built entirely out of constructs this hook
# can PROVE safe, and every filesystem target it touches resolves, after
# full expansion and symlink canonicalization, inside the project root AND
# none of those targets is a protected path.
#
# Every other case (an escape, a protected path, anything unparseable, and
# now anything merely UNRESOLVABLE) produces NO output and exits 0 — the
# normal permission flow (heuristic prompt included) runs unmodified. This
# hook NEVER emits "deny"; the only two possible outcomes are "allow" or
# silence.
#
# Design: .agent/memory/project/specs/in-project-bash-autoallow/spec.md
#
# ---------------------------------------------------------------------
# WHY THIS IS AN ALLOWLIST, NOT A DENYLIST
# ---------------------------------------------------------------------
# Round 1 of this hook resolved every argument word as a candidate target,
# on the reasoning that being over-inclusive about words could only ever
# add harmless checks. For bare paths that holds. For a command that carries
# another command inside a quoted word it inverts: `bash -c "cat
# /etc/passwd"` reaches the tokenizer as ONE word that does not look like a
# path, the target scan finds nothing outside the root, and the hook grants
# an unattended read of /etc/passwd. Eleven false allows were measured that
# way (.agent/memory/project/data/2026-09-05-f9-false-allows.md), including
# a granted WRITE to /etc via `dd of=/etc/x`.
#
# The rule now is: UNRESOLVABLE MEANS SILENT. An allow is emitted only when
# every one of these is true:
#
#   1. The command text outside any heredoc body contains no construct
#      whose expansion cannot be determined statically — no command
#      substitution `$(...)` or backticks, no surviving `$` variable
#      reference, no brace group or brace expansion, no subshell parens, no
#      bare `&`.
#   2. Every segment's command name is a bare name on CMD_ALLOWLIST — a
#      short, curated set of tools that cannot execute a nested program.
#      Shells, `eval`, interpreters, `env`, `xargs`, `find`, `make`,
#      `dd` and everything else unlisted are silent by construction, so no
#      wrapper denylist has to stay ahead of the next wrapper. `git` is the
#      single entry admitted through a SUBCOMMAND allowlist instead of as a
#      whole command — see "git" below.
#   3. No segment begins with a `NAME=VALUE` assignment (an untracked
#      variable) and no `cd` is given `-`, no argument, or an option.
#   4. No argument carries embedded whitespace AND a `/`, except for
#      `echo`/`printf` whose arguments are pure data. A quoted multi-word
#      argument is the shape a nested payload arrives in — but a payload
#      that escapes the project root has to NAME a path, and a path that
#      escapes contains a `/`. A whitespace-bearing word with no `/` at all
#      cannot denote anything outside the current directory, so on a command
#      that is already allowlisted it is data, not a target, and does not by
#      itself force silence. This is what lets `grep -rn "foo bar" .`
#      through while `sed -i '' '1e cat /etc/passwd' x` stays silent.
#   5. Every resolved target is inside the project root and unprotected.
#      `/dev/null`, `/dev/stdout`, `/dev/stderr`, `/dev/tty` and `/dev/zero`
#      are neutral: they are kernel endpoints, not filesystem locations, and
#      are neither in-project nor an escape. The exemption is those five
#      exact paths, never `/dev/` as a prefix.
#
# ---------------------------------------------------------------------
# REDIRECTION FORMS THAT ARE NOT OPAQUE
# ---------------------------------------------------------------------
# `2>&1`, `>&2`, `1>&2`, `&>f` and `&>>f` are ordinary redirection tokens
# with a fixed meaning — not backgrounding, not substitution. They are
# normalised before the opaque scan and before tokenizing: `&>`/`&>>`
# become `>`/`>>` (so their target is still checked) and every `N>&M` /
# `>&M` / `N>&-` dup becomes a space (it names no path). Every OTHER bare
# `&` is still rejected.
#
# ---------------------------------------------------------------------
# HEREDOCS
# ---------------------------------------------------------------------
# A heredoc body is stdin data, not a command, so it does not have to be
# resolvable — but only when the shell will not expand it into one. Handled
# strictly and locally (the shared HEREDOC_STRIP_AWK drops everything after
# the `<<DELIM` token on its line, which would hide the target in
# `cat <<EOF > /etc/x`; this hook does not use it):
#
#   * the `<<DELIM` token must be the LAST thing on its line — anything
#     following it is silent, so no redirect can hide behind a heredoc;
#   * the terminator line must be present — an unterminated heredoc is
#     silent;
#   * with a QUOTED delimiter (`<<'EOF'`) the body is inert and is ignored
#     wholesale; with an unquoted one the shell still performs parameter
#     and command substitution inside the body, so a body containing `$` or
#     a backtick is silent.
#
# Every command name and every redirect target OUTSIDE the body is checked
# exactly as it would be without the heredoc.
#
# ---------------------------------------------------------------------
# TOOLS THAT REACH A PROGRAM THROUGH NON-PATH ARGUMENT SYNTAX
# ---------------------------------------------------------------------
# Rule 2 keeps every command that runs a nested program off the allowlist,
# but three listed tools could still reach one through their own option or
# script syntax, with no whitespace to trip rule 4:
#
#   sed   `1eid` and `s/a/b/e` execute a shell command; `w`/`W`/`r`/`R`
#         open a file the target scan never sees. Handled by
#         sed_args_ok(): an ALLOWLIST over sed's options and over the
#         script grammar itself. `sed` stays listed because `cd X && sed
#         -i '' 's/a/b/' f` is the shape this feature exists to serve.
#   sort  `--compress-program=CMD` execs CMD. Removed from the allowlist
#         outright — it costs one prompt and nothing depends on it.
#   rg    `--pre CMD` and `--hostname-bin CMD` exec CMD. Handled by
#         rg_args_ok(); every other ripgrep invocation is unaffected.
#   git   a whole command suite, most of it writing. Handled by
#         git_args_ok(): an ALLOWLIST over the SUBCOMMAND (read-only
#         subcommands only) plus an allowlist over the top-level options.
#         See the git section further down for why the read-only subset is
#         separable and what had to be protected to make it so.
#
# Residual, accepted, and NOT introduced here: a glob (`.`, `*`) is allowed
# to stand for whatever it matches inside the current directory, which is
# the whole point of the bare-`.` arm this feature exists to serve; a glob
# matching a symlink that points outside the root escapes. `grep -r` over
# the root reaches read-protected files it did not name. `jq -f` and
# `grep -f` take their program/pattern from a file, but neither language
# can exec, and the file itself is resolved as an ordinary target. Symlink
# resolution is TOCTOU, inherited from check_autonomy.sh (see spec).
#
# Defense in depth (property 4): check_autonomy.sh runs first in
# .claude/settings.json's PreToolUse.Bash array and its own floor-deny
# stops the chain before this hook ever runs, in the common case. This
# hook does NOT rely on that ordering — it re-checks the same
# protected-path regexes against its own resolved targets before ever
# emitting "allow", so it holds the floor even invoked in isolation.
#
# Fail-closed, cheap: bash + awk/readlink only (no python3 startup — this
# hook runs on every Bash call), a hard length bound, and silence (never
# allow) on anything it cannot fully account for.

MAX_COMMAND_LEN=4000

# Commands whose arguments are only ever data or filesystem paths — never a
# nested program. Deliberately short. Anything absent is silent, which costs
# one permission prompt; anything wrongly present is an unattended
# permission grant, so additions belong in a spec, not in a hurry.
#
# Excluded on purpose, and the reason:
#   shells / eval / exec / source        run their argument as code
#   python* perl ruby node deno bun php  run their argument as code
#   awk sed -e/e-flag callers, find, xargs, env, timeout, nohup, watch,
#   sudo, ssh, make, npm/npx, docker      reach a program through an argument
#   tar                                   `-I`/`--use-compress-program`/`--to-command`
#   dd chmod chown                        write or re-permission via non-path syntax
#   rm rmdir mv truncate shred            destructive; behavior.md wants the prompt
#   sort                                  `--compress-program=CMD` execs CMD
#
# `git` is present but is NOT a whole-command grant: git_args_ok() admits
# only the read-only subcommands and only the top-level options that cannot
# repoint git at another config, directory or pager.
CMD_ALLOWLIST=" cd cat head tail wc grep egrep fgrep rg sed uniq cut tr comm diff cmp nl rev fold jq ls stat file du df basename dirname realpath readlink pwd date echo printf true false test shasum md5 md5sum sha1sum sha256sum cksum tree touch mkdir cp ln tee git "

# The subset of CMD_ALLOWLIST whose arguments are a search pattern, a
# message, or a filename — never a small language that can name another
# program. Only on these does rule 4's `/`-free relaxation apply, so a
# whitespace-bearing word can be treated as data.
#
# Absent on purpose, and the reason (each takes a script operand that
# reaches a program, and each needs WHITESPACE to pass it arguments):
#   sed   `1e <cmd> <args>` and the `s///e` flag run a shell command
#   rg    `--pre <cmd>` preprocessor
#   jq    a filter language; excluded as a language, not for a known exec
#   git   its option space IS a language that can name a program, and the
#         one thing standing between it and an exec is git_args_ok's option
#         allowlist. Keeping git off this list leaves the whitespace guard
#         as a second net under that allowlist. The cost is a prompt on
#         `git log --format="%h %s"`; the slash-free spellings still allow.
# (`sort` was the fourth until `--compress-program` took it off
# CMD_ALLOWLIST entirely.) On these a whitespace-bearing argument stays
# unprovable and silent,
# exactly as it was before this relaxation existed.
DATA_ARG_ALLOWLIST=" cat head tail wc grep egrep fgrep uniq cut tr comm diff cmp nl rev fold ls stat file du df basename dirname realpath readlink pwd date echo printf true false test shasum md5 md5sum sha1sum sha256sum cksum tree touch mkdir cp ln tee "

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
[ "$TOOL" != "Bash" ] && exit 0

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
# Trim leading whitespace, matching check_autonomy.sh's own guard.
COMMAND="${COMMAND#"${COMMAND%%[! ]*}"}"
[ -z "$COMMAND" ] && exit 0
[ "${#COMMAND}" -gt "$MAX_COMMAND_LEN" ] && exit 0

# HEREDOC_SPLIT_AWK separates the command into the CODE the shell will run
# and the heredoc BODIES it will only read as stdin. Unlike the shared
# HEREDOC_STRIP_AWK it does NOT discard the tail of the line carrying the
# `<<DELIM` token — it refuses outright when anything follows the token, so
# `cat <<EOF > /etc/x` can never present itself as a bare `cat`.
#
#   C:<line>   a line of real command text (heredoc token removed)
#   U:<line>   a body line of an UNQUOTED heredoc — still subject to
#              parameter/command substitution, so the caller re-scans it
#   X:<why>    refuse; the caller goes silent
#
# A quoted delimiter (`<<'EOF'`) suppresses every expansion in the body, so
# those body lines are emitted nowhere and never constrain the decision.
read -r -d '' HEREDOC_SPLIT_AWK <<'AWKEOF'
BEGIN { state = 0; delim = ""; quoted = 0; bad = 0 }
{
  line = $0
  if (state == 1) {
    t = line
    gsub(/^[ \t]+|[ \t]+$/, "", t)
    if (t == delim) { state = 0; next }
    if (!quoted) print "U:" line
    next
  }
  if (match(line, /<<-?["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
    pre = substr(line, 1, RSTART - 1)
    tok = substr(line, RSTART, RLENGTH)
    post = substr(line, RSTART + RLENGTH)
    if (post ~ /[^ \t]/) { print "X:trailing-after-heredoc-token"; bad = 1; exit }
    quoted = (tok ~ /["\047]/) ? 1 : 0
    d = tok
    gsub(/^<<-?/, "", d)
    gsub(/["\047]/, "", d)
    delim = d
    print "C:" pre
    state = 1
    next
  }
  print "C:" line
}
END { if (!bad && state == 1) print "X:unterminated-heredoc" }
AWKEOF

# Fast path: no `<<` at all means no heredoc, and the whole command is
# code. This hook runs on EVERY Bash call, so the common case pays no extra
# process.
CODE="$COMMAND"
case "$COMMAND" in
  *'<<'*)
    SPLIT=$(printf '%s\n' "$COMMAND" | awk "$HEREDOC_SPLIT_AWK")
    CODE=""; BODY=""
    while IFS= read -r _line; do
      case "$_line" in
        'C:'*) CODE+="${_line#C:}"$'\n' ;;
        'U:'*) BODY+="${_line#U:}"$'\n' ;;
        'X:'*) exit 0 ;;
      esac
    done <<< "$SPLIT"
    # An unquoted heredoc body is expanded by the shell before the command
    # ever sees it, so a `$` or a backtick there is executable, not data.
    case "$BODY" in *'$'* | *'`'*) exit 0 ;; esac
    ;;
esac

# normalize_redirect_dups: rewrite the descriptor-redirection forms the
# tokenizer does not model into forms it does, so they stop being mistaken
# for backgrounding. `&>f`/`&>>f` keep their target (it is still checked);
# an `N>&M` dup names no path at all and becomes a space, which can never
# glue two words together.
MAX_REDIRECT_DUPS=32
normalize_redirect_dups() {
  local s="$1" i=0
  s="${s//&>>/>>}"
  s="${s//&>/>}"
  while [[ "$s" =~ [0-9]?[\<\>]\&([0-9]+|-) ]]; do
    i=$((i + 1))
    # Bounded so a pathological command can never spin this hook. Bailing
    # out leaves the `&` in place, which has_opaque_construct then rejects
    # — the fail-closed direction.
    [ "$i" -gt "$MAX_REDIRECT_DUPS" ] && break
    s="${s/"${BASH_REMATCH[0]}"/ }"
  done
  printf '%s' "$s"
}
CODE=$(normalize_redirect_dups "$CODE")

# is_balanced: a stateful quote scan (not a substring count — a literal
# apostrophe inside a double-quoted word, e.g. "it's", must not be
# mistaken for an unterminated single quote). Anything it can't fully
# account for is unparseable -> fail closed (silent), never allow on a
# guess.
is_balanced() {
  local s="$1" len i c in_s=0 in_d=0
  len=${#s}
  i=0
  while [ "$i" -lt "$len" ]; do
    c="${s:$i:1}"
    if [ "$in_s" = 1 ]; then
      [ "$c" = "'" ] && in_s=0
      i=$((i + 1)); continue
    fi
    if [ "$in_d" = 1 ]; then
      if [ "$c" = '\' ]; then i=$((i + 2)); continue; fi
      [ "$c" = '"' ] && in_d=0
      i=$((i + 1)); continue
    fi
    case "$c" in
      "'") in_s=1 ;;
      '"') in_d=1 ;;
    esac
    i=$((i + 1))
  done
  [ "$in_s" = 0 ] && [ "$in_d" = 0 ]
}
is_balanced "$CODE" || exit 0

# has_opaque_construct: scanned on the RAW command text, BEFORE tokenizing,
# because the tokenizer strips quotes and a construct hidden inside a quoted
# word (`cd "$(echo /etc)"`) would otherwise vanish before anyone looked.
#
# $HOME and ${HOME} are the two references this hook can resolve (via
# expand_target), so they are removed first and everything remaining that
# starts with `$` is an untracked variable — $OLDPWD, $d, $1 — whose value
# is unknown, and unknown is not safe.
has_opaque_construct() {
  local s="$1"
  s="${s//\$\{HOME\}/H}"
  s="${s//\$HOME/H}"
  case "$s" in
    # `$` — command substitution $(...), untracked variable, positional param
    # backtick — command substitution
    # ( ) — subshell, process substitution <(...), function definition
    # { } — brace group, brace expansion {a,b}
    # << — a heredoc token HEREDOC_SPLIT_AWK did not recognise (`<<<`, a
    #      delimiter that is not a bare word): the tokenizer's view would
    #      not be the shell's
    *'$'* | *'`'* | *'('* | *')'* | *'{'* | *'}'* | *'<<'*) return 0 ;;
  esac
  # Descriptor redirections were already normalised away, so every bare `&`
  # still standing is a background operator or something else TOKENIZE_AWK
  # does not model — it only knows `&&`. Remove the pairs it does
  # understand and reject anything left over.
  s="${s//&&/}"
  case "$s" in *'&'*) return 0 ;; esac
  return 1
}
has_opaque_construct "$CODE" && exit 0

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${HOOK_DIR}/lib/target_resolve.sh" 2>/dev/null || exit 0

# The project root comes from lib/target_resolve.sh, which finds it by walking
# up from the hook library's OWN location to the nearest workspace marker.
#
# It used to be this hook's invocation cwd. That was the same F28 defect the
# read floor carried, and strictly worse here: this hook AUTO-APPROVES what it
# finds in project, so a cwd of $HOME did not merely exempt one config file, it
# made the operator's entire home directory auto-approvable. One resolver, both
# surfaces — the root must not be something the caller can choose.
PROJECT_ROOT="$TR_PROJECT_ROOT"
[ -z "$PROJECT_ROOT" ] && exit 0

declare -A VARS=()

# in_project_root: component-wise prefix match against PROJECT_ROOT — a
# string-prefix match alone would let "$PROJECT_ROOT"X (e.g. .../AthanorX)
# pass, which is exactly the escape this must not allow.
in_project_root() {
  case "$1" in
    "$PROJECT_ROOT"|"$PROJECT_ROOT"/*) return 0 ;;
    *) return 1 ;;
  esac
}

# re_git_meta — the files that decide what an "read-only" git subcommand
# EXECUTES. `core.pager`, `[diff "x"] command`, `[diff "x"] textconv` and
# `include.path` all live in `.git/config`; `.gitattributes` selects which
# driver applies. None of them is named on the command line, so no argument
# scan can ever see them — and every one of them sits at an in-project path
# this hook would otherwise happily let an agent write.
#
# That is the whole reason git could not be allowlisted before: `echo ... >
# .git/config` followed by `git log` is two individually-in-project steps
# that together run an arbitrary program. Protecting the config files closes
# the first step, which is what makes the second one safe to grant.
#
# It lives HERE rather than in the shared floor (lib/target_resolve.sh)
# because it is a precondition of THIS hook's git grant, not a claim about
# what check_autonomy.sh should deny. `.github/` does not match: `\.git`
# must be followed by a `/` or end-of-string.
re_git_meta='(^|/)\.git(/|$)|(^|/)\.gitconfig$|(^|/)\.gitattributes$|(^|/)\.gitmodules$'

is_protected() {
  local t="$1"
  [[ "$t" =~ $re_write_protpath ]] && return 0
  [[ "$t" =~ $re_read_protpath ]] && return 0
  [[ "$t" =~ $re_git_meta ]] && return 0
  return 1
}

validate_target() {
  in_project_root "$1" || return 1
  is_protected "$1" && return 1
  return 0
}

# is_allowed_command: a bare name (never a path — `/bin/bash` and
# `./run.sh` are command names this hook cannot vet) present in
# CMD_ALLOWLIST. The $1 inside the case pattern is double-quoted, so a
# command name containing glob metacharacters is matched literally rather
# than acting as a pattern.
is_allowed_command() {
  case "$1" in
    */*) return 1 ;;
  esac
  case "$CMD_ALLOWLIST" in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

# resolve_target <raw> <cur_dir> — expand_target() handles the ~/$HOME/var
# text expansion; this wraps it with the two things F9 needs on top that
# expand_target does not do (it is shared with check_autonomy.sh, which
# does not simulate a `cd`-tracked working directory): absolutizing a
# relative word against the SIMULATED current directory (cur_dir, updated
# as `cd` segments are processed), and collapsing "." / ".." components so
# containment can be judged component-wise rather than textually. The
# symlink walk after each collapse (bounded to 10 total hops across the
# whole resolution) still defers to readlink, same as expand_target's own
# walk, and re-collapses after every hop so a symlink landing on a "../.."
# is still resolved correctly. Prints the canonical path; empty + rc=1 if
# the hop budget is exhausted (an unresolved target -> caller fails closed).
resolve_target() {
  local raw="$1" cur_dir="$2" w hops=0
  w=$(expand_target "$raw")
  case "$w" in
    /*) : ;;
    *) w="${cur_dir}/${w}" ;;
  esac

  while :; do
    local -a parts=() stack=()
    local n=0 part
    IFS='/' read -r -a parts <<< "$w"
    for part in "${parts[@]}"; do
      case "$part" in
        "" | ".") continue ;;
        "..")
          [ "$n" -gt 0 ] && n=$((n - 1))
          ;;
        *)
          stack[$n]="$part"; n=$((n + 1)) ;;
      esac
    done
    local result="/" i
    for ((i = 0; i < n; i++)); do
      if [ "$result" = "/" ]; then result="/${stack[$i]}"; else result="${result}/${stack[$i]}"; fi
    done
    w="$result"

    local built="" hit=""
    # Walk the COLLAPSED path looking for the first symlinked component,
    # left to right.
    local -a wparts=()
    IFS='/' read -r -a wparts <<< "$w"
    for part in "${wparts[@]}"; do
      [ -z "$part" ] && continue
      if [ -z "$built" ]; then built="/${part}"; else built="${built}/${part}"; fi
      if [ -L "$built" ] 2>/dev/null; then hit="$built"; break; fi
    done
    [ -z "$hit" ] && break

    hops=$((hops + 1))
    if [ "$hops" -gt 10 ]; then
      printf ''
      return 1
    fi
    local tgt; tgt=$(readlink "$hit" 2>/dev/null)
    [ -z "$tgt" ] && break
    local suffix="${w#"$hit"}"
    if [[ "$tgt" == /* ]]; then
      w="${tgt}${suffix}"
    else
      w="$(dirname "$hit")/${tgt}${suffix}"
    fi
  done
  printf '%s' "$w"
  return 0
}

# CUR_DIR is the base a RELATIVE target resolves against — the directory the
# command will actually run in, which is TR_CWD, not the project root. The two
# were the same variable before F28 split them, and keeping the old
# `CUR_DIR="$PROJECT_ROOT"` alongside a marker-derived root would have been a
# false allow in the other direction: with cwd at $HOME, `echo x > out.txt`
# would have resolved to <root>/out.txt, passed as in-project, and been granted
# while the write actually landed in the operator's home directory.
#
# The validate_target() below is what makes that safe, and it stops being the
# tautology it was when CUR_DIR was the root by construction: a cwd outside the
# guarded workspace now sets ESCAPED and the hook goes silent for the whole
# command, which is the correct answer — this hook can only vouch for work
# inside the workspace that owns it.
CUR_DIR="$TR_CWD"
ESCAPED=0
[ -z "$CUR_DIR" ] && exit 0
validate_target "$CUR_DIR" || ESCAPED=1

# is_neutral_device: the five kernel endpoints that are not filesystem
# locations in any meaningful sense. Writing to one stores nothing and
# reading from one discloses nothing, so they are neither in-project nor an
# escape. Exact matches only — `/dev/` as a prefix covers real devices
# (`/dev/disk0`) and must keep resolving normally.
is_neutral_device() {
  case "$1" in
    /dev/null|/dev/stdout|/dev/stderr|/dev/tty|/dev/zero) return 0 ;;
  esac
  return 1
}

check_and_mark() {
  local raw="$1" resolved
  [ -z "$raw" ] && return
  is_neutral_device "$raw" && return
  resolved=$(resolve_target "$raw" "$CUR_DIR")
  if [ -z "$resolved" ] || ! validate_target "$resolved"; then
    ESCAPED=1
  fi
}

# check_word: a candidate target, screened for the shape a nested command
# payload arrives in — a quoted multi-word argument. That screen is what
# closed round 1's blindness and it stays, narrowed by one observation: a
# payload that reaches outside the project root must NAME something outside
# it, and every path that leaves the current directory contains a `/`. So a
# whitespace-bearing word carrying a `/` is unprovable and silent, while one
# with no `/` anywhere cannot denote a target outside the current directory
# and is data.
#
# "Is data" is only true when the COMMAND reads its arguments as data. The
# relaxation therefore applies only on DATA_ARG_ALLOWLIST, which excludes
# the four tools that take a script operand — measured: with the relaxation
# applied unconditionally, `sed -i '' '1e id' f` was allowed, and it runs
# `id`. DATA_ARGS_OK is set per segment by process_segment.
DATA_ARGS_OK=0
check_word() {
  case "$1" in
    *[[:space:]]*)
      [ "$DATA_ARGS_OK" = 1 ] || { ESCAPED=1; return; }
      case "$1" in
        */*) ESCAPED=1 ;;
      esac
      return
      ;;
  esac
  check_and_mark "$1"
}

# check_embedded_target: a word can carry its real filesystem target INSIDE
# itself instead of presenting it as a word of its own, and the whole-word
# resolution sees neither shape — `cp --target-directory=/etc f` and
# `cp -t/etc f` each resolve as ONE harmless in-project non-path
# (`<cwd>/--target-directory=/etc`) while the command opens `/etc`. Both were
# granted. The separated spellings (`-t /etc`, `--target-directory /etc`)
# were always silent, because there the target is a word of its own.
#
# Two extractions, applied in order and independently — one word can carry
# both (`-t/etc/x=y`):
#
#   1. ANY word containing `=`: the value to the right of the FIRST `=` is
#      resolved as a target in its own right. This replaces a test that
#      matched only `[A-Za-z_]*=*` — only words STARTING with a letter or an
#      underscore. `of=/etc/x` was inspected; `--target-directory=/etc` was
#      not, and a word beginning with `-` was the whole hole.
#   2. A short option carrying its argument ATTACHED — `-t/etc`, `-rt/etc`
#      (clustered), `-f/etc/passwd`, `-t~/x`: the suffix beginning at the
#      first `/`, `~` or `.` after the option letters.
#
# A value that is not a path at all is unaffected. `--include=*.py`,
# `--format=%H`, `--pretty=format:%h` and the `b/c/` half of `sed 's/a=b/c/'`
# all resolve to a non-existent path inside the current directory, which is
# in-project and changes no decision — the same thing that already happens to
# every unrecognised bare word (a pattern, a flag, a git revision). An
# ATTACHED value that is relative is likewise still allowed: `-t./sub` and
# `-i.bak` resolve in-project.
#
# What DOES newly go silent is a glued spelling whose value resolves out of
# the root or onto a protected path — `cut -d/`, `grep -e/re/`, `tr -d/`.
# Every one of those is ALREADY silent in its separated spelling (`cut -d '/'`
# resolves the word `/`, which is outside the root), so this makes the two
# spellings agree rather than adding a new class of refusal.
#
# `sed` is exempt from extraction 2 — from that one only. sed_args_ok already
# allowlists sed's ENTIRE option space and refuses `-f`/`--file`, its only
# file-taking option, so no glued sed option can reach a path this scan would
# need to see; meanwhile `sed -e's/a/b/'` is a legitimate glued spelling whose
# script would otherwise be mistaken for an attached path.
SCAN_GLUED_OPT=1
check_embedded_target() {
  local w="$1"
  case "$w" in
    *=*)
      check_and_mark "${w#*=}"
      [ "$ESCAPED" = 1 ] && return
      ;;
  esac
  [ "$SCAN_GLUED_OPT" = 1 ] || return
  if [[ "$w" =~ ^--?[A-Za-z][A-Za-z0-9_-]*([/~.].*)$ ]]; then
    check_and_mark "${BASH_REMATCH[1]}"
  fi
}

# ---------------------------------------------------------------------
# sed: an allowlist over the script grammar, not a search for `e`
# ---------------------------------------------------------------------
# sed's script is a small language, and two of its constructs run a shell
# command: the `e` command (`1eid`, `/re/e cmd`, `$e cmd`) and the `e` flag
# on `s///`. Scanning for the letter `e` cannot distinguish a command from
# the same letter inside a regex, so the script is PARSED instead, against
# an allowlist of commands that can reach neither a program nor a file:
# `s`, `y`, and the address-only commands. `e`, `w`, `W`, `r`, `R`, `a`,
# `i`, `c`, branches, labels and `{}` blocks are all absent, so anything
# this parser does not fully account for returns 1 and the caller goes
# silent — the same fail-closed direction as every other rule here.

# _sed_scan_to_delim <script> <start> <delim> — advance past the next
# UNESCAPED <delim>, leaving the index after it in _SED_POS. rc=1 (and the
# caller goes silent) if the field is never closed. sed treats `\<delim>`
# as the only escape, inside bracket expressions included, so a single
# backslash skip is the whole rule.
_SED_POS=0
_sed_scan_to_delim() {
  local str="$1" p="$2" d="$3" len ch
  len=${#str}
  while [ "$p" -lt "$len" ]; do
    ch="${str:$p:1}"
    if [ "$ch" = '\' ]; then p=$((p + 2)); continue; fi
    if [ "$ch" = "$d" ]; then _SED_POS=$((p + 1)); return 0; fi
    p=$((p + 1))
  done
  return 1
}

sed_script_safe() {
  local s="$1" n=${#1} i=0 c d cmd addrs
  n=${#s}
  while [ "$i" -lt "$n" ]; do
    # Command separators and surrounding whitespace.
    case "${s:$i:1}" in
      ' '|$'\t'|$'\n'|';') i=$((i + 1)); continue ;;
    esac

    # Zero, one or two addresses. Line numbers, `first~step`, `$`, `/re/`
    # (with an `I`/`M` modifier) and a `+N` second address are recognised;
    # the `\cREc` form and everything else is not, and falls through to the
    # command dispatch where it is rejected.
    addrs=0
    while :; do
      c="${s:$i:1}"
      if [[ "$c" == [0-9] ]]; then
        while [ "$i" -lt "$n" ] && [[ "${s:$i:1}" == [0-9] ]]; do i=$((i + 1)); done
        if [ "${s:$i:1}" = "~" ]; then
          i=$((i + 1))
          [[ "${s:$i:1}" == [0-9] ]] || return 1
          while [ "$i" -lt "$n" ] && [[ "${s:$i:1}" == [0-9] ]]; do i=$((i + 1)); done
        fi
      elif [ "$c" = '$' ]; then
        i=$((i + 1))
      elif [ "$c" = '+' ] && [ "$addrs" -eq 1 ]; then
        i=$((i + 1))
        [[ "${s:$i:1}" == [0-9] ]] || return 1
        while [ "$i" -lt "$n" ] && [[ "${s:$i:1}" == [0-9] ]]; do i=$((i + 1)); done
      elif [ "$c" = '/' ]; then
        i=$((i + 1))
        _sed_scan_to_delim "$s" "$i" "/" || return 1
        i="$_SED_POS"
        while [[ "${s:$i:1}" == [IM] ]]; do i=$((i + 1)); done
      else
        break
      fi
      addrs=$((addrs + 1))
      if [ "$addrs" -eq 1 ] && [ "${s:$i:1}" = "," ]; then i=$((i + 1)); continue; fi
      break
    done

    # Whitespace and address negation between the address and the command.
    while :; do
      case "${s:$i:1}" in
        ' '|$'\t'|'!') i=$((i + 1)) ;;
        *) break ;;
      esac
    done

    cmd="${s:$i:1}"
    case "$cmd" in
      s|y)
        i=$((i + 1))
        d="${s:$i:1}"
        # The delimiter must be a real punctuation delimiter: an
        # alphanumeric, a backslash or whitespace here means the script is
        # not the shape this parser thinks it is.
        case "$d" in
          ""|[A-Za-z0-9]|'\'|' '|$'\t'|$'\n'|';') return 1 ;;
        esac
        i=$((i + 1))
        _sed_scan_to_delim "$s" "$i" "$d" || return 1; i="$_SED_POS"
        _sed_scan_to_delim "$s" "$i" "$d" || return 1; i="$_SED_POS"
        if [ "$cmd" = "s" ]; then
          # Flags, allowlisted. `e` (exec) and `w` (write a file) are
          # deliberately absent, so either one ends the flag run and the
          # terminator check below rejects the script.
          while [ "$i" -lt "$n" ]; do
            case "${s:$i:1}" in
              g|p|i|I|m|M|[0-9]) i=$((i + 1)) ;;
              *) break ;;
            esac
          done
        fi
        ;;
      d|D|p|P|h|H|g|G|x|n|N|z|F|=)
        i=$((i + 1)) ;;
      l|q|Q)
        i=$((i + 1))
        while [ "$i" -lt "$n" ] && [[ "${s:$i:1}" == [0-9] ]]; do i=$((i + 1)); done ;;
      *)
        return 1 ;;
    esac

    while :; do
      case "${s:$i:1}" in
        ' '|$'\t') i=$((i + 1)) ;;
        *) break ;;
      esac
    done
    case "${s:$i:1}" in
      ''|';'|$'\n') ;;
      *) return 1 ;;
    esac
  done
  return 0
}

# sed_args_ok: an allowlist over sed's OPTIONS as well, because an option
# this hook does not recognise can hide the real script (`sed -ne1eid f`
# would otherwise present the filename as the script). `-f`/`--file` takes
# the script from a file whose contents cannot be inspected here, so it is
# always silent.
sed_args_ok() {
  local -a argv=("$@") scripts=()
  local i n=$# arg rest have_e=0
  for ((i = 0; i < n; i++)); do
    arg="${argv[$i]}"
    case "$arg" in
      -f|-f?*|--file|--file=*) return 1 ;;
      --expression=*) scripts+=("${arg#--expression=}"); have_e=1; continue ;;
      --in-place|--in-place=*|--quiet|--silent|--regexp-extended|--separate) continue ;;
      --null-data|--posix|--sandbox|--unbuffered|--debug|--follow-symlinks) continue ;;
      --line-length=*) continue ;;
    esac
    if [[ "$arg" =~ ^-([nErsuz]*)e(.*)$ ]]; then
      rest="${BASH_REMATCH[2]}"
      if [ -n "$rest" ]; then
        scripts+=("$rest")
      else
        i=$((i + 1))
        [ "$i" -ge "$n" ] && return 1
        scripts+=("${argv[$i]}")
      fi
      have_e=1
      continue
    fi
    case "$arg" in
      -i|-i?*) continue ;;
    esac
    if [[ "$arg" =~ ^-[nErsuz]+$ ]] || [[ "$arg" =~ ^-l[0-9]*$ ]]; then continue; fi
    case "$arg" in
      -*) return 1 ;;
    esac
    # First operand is the script when no -e/--expression supplied it.
    if [ "$have_e" = 0 ] && [ "${#scripts[@]}" -eq 0 ]; then scripts+=("$arg"); fi
  done
  [ "${#scripts[@]}" -eq 0 ] && return 1
  for arg in "${scripts[@]}"; do
    sed_script_safe "$arg" || return 1
  done
  return 0
}

# rg_args_ok: ripgrep's `--pre` and `--hostname-bin` name a program it
# executes. Every other ripgrep option only ever names a path or a pattern.
rg_args_ok() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --pre|--pre=*|--hostname-bin|--hostname-bin=*) return 1 ;;
    esac
  done
  return 0
}

# ---------------------------------------------------------------------
# git: an allowlist over the SUBCOMMAND, not over the command
# ---------------------------------------------------------------------
# `git` was excluded wholesale because `git commit` runs `.git/hooks/`
# — arbitrary code from a file the command never names. That reason is real
# and it is also narrow: it applies to the subcommands that write. The
# read-only half (`status`, `log`, `diff`, `show`, …) runs no repository
# hook, and it is what agents run constantly, one prompt at a time.
#
# Three things had to hold before the read-only half could be granted:
#
#   1. The SUBCOMMAND is allowlisted. Aliases cannot reach the granted set:
#      git refuses to let an alias shadow a built-in command name, so
#      `[alias] log = !sh -c …` in `.git/config` is ignored by git itself.
#   2. The TOP-LEVEL options are allowlisted, not denylisted. `-c`,
#      `--config-env`, `-C`, `--git-dir`, `--work-tree`, `--exec-path`,
#      `--namespace` and `-p` each repoint git at a different config, a
#      different directory or a pager, and each one reaches a program.
#      An allowlist means the NEXT such option is silent by default too.
#   3. `.git/config` and friends are protected (re_git_meta above), because
#      every remaining exec vector — core.pager, external diff drivers,
#      textconv filters — is configured there rather than on the command
#      line. Without that protection this grant would be a two-step escape.
#
# Everything that writes stays silent: commit, push, pull, merge, rebase,
# checkout, switch, restore, clean, filter-branch, submodule, gc, am, apply,
# bisect, worktree, config, init, clone, stash, reset. So does `grep`
# (`--open-files-in-pager=CMD` execs CMD) and everything not named here.
GIT_SUBCMD_ALLOWLIST=" status log diff show rev-parse ls-files describe branch remote blame cat-file shortlog tag "

# Options accepted BEFORE the subcommand. Deliberately tiny; see (2) above.
GIT_TOPLEVEL_OPT_ALLOWLIST=" --no-pager --literal-pathspecs --no-optional-locks --no-replace-objects "

# Options rejected wherever they appear, matched on the exact name to the
# left of any `=`. The config/directory group is already impossible before
# the subcommand and is not a valid option after it, but the brief for this
# grant asks for `-c`/`-C`/`--exec-path` to be refused unconditionally and
# that is the safe direction: it costs `git blame -C` a prompt and buys the
# rule "no git invocation carrying -c or -C is ever auto-allowed", which
# needs no reasoning about parse position to verify.
GIT_BANNED_OPT=" -c -C --exec-path --config-env --git-dir --work-tree --namespace --super-prefix --attr-source --ext-diff --textconv --filters --open-files-in-pager -O --upload-pack --receive-pack --ext "

# `branch`, `tag` and `remote` list in their bare form and MUTATE as soon as
# they are given an operand — `git branch foo` creates a branch, `git tag
# foo` creates a tag, `git remote add` rewrites the config this hook just
# spent a paragraph protecting. So for these three every argument must be a
# listing option and an operand is never accepted.
GIT_BRANCH_OPT_OK=" -a --all -r --remotes -v -vv --verbose -l --list --show-current --merged --no-merged --color --no-color --column --no-column -i --ignore-case "
GIT_TAG_OPT_OK=" -l --list --color --no-color -i --ignore-case --merged --no-merged "
GIT_REMOTE_OPT_OK=" -v --verbose "

# git_args_ok <args after `git`> — rc=0 only if the invocation is provably a
# read-only one. May also set ESCAPED (via check_and_mark) for the sub-word
# targets the caller's own argument loop cannot see; it returns 1 in that
# case too, so the caller never has to distinguish.
git_args_ok() {
  local -a argv=("$@")
  local n=$# i=0 arg sub="" set_ok=""

  # Top-level options up to the subcommand.
  while [ "$i" -lt "$n" ]; do
    arg="${argv[$i]}"
    case "$arg" in
      -*)
        case "$GIT_TOPLEVEL_OPT_ALLOWLIST" in
          *" $arg "*) i=$((i + 1)); continue ;;
        esac
        return 1
        ;;
      *) sub="$arg"; i=$((i + 1)); break ;;
    esac
  done
  # A bare `git` prints usage and proves nothing; silence costs one prompt.
  [ -z "$sub" ] && return 1
  case "$GIT_SUBCMD_ALLOWLIST" in
    *" $sub "*) : ;;
    *) return 1 ;;
  esac

  case "$sub" in
    branch) set_ok="$GIT_BRANCH_OPT_OK" ;;
    tag)    set_ok="$GIT_TAG_OPT_OK" ;;
    remote) set_ok="$GIT_REMOTE_OPT_OK" ;;
  esac
  if [ -n "$set_ok" ]; then
    while [ "$i" -lt "$n" ]; do
      case "$set_ok" in
        *" ${argv[$i]} "*) i=$((i + 1)) ;;
        *) return 1 ;;
      esac
    done
    return 0
  fi

  while [ "$i" -lt "$n" ]; do
    arg="${argv[$i]}"
    i=$((i + 1))
    [ "$arg" = "--" ] && continue
    case "$arg" in
      -*)
        # An option carrying a `/` is naming a path INSIDE its own value
        # (`--output=../x`, `-O/etc/orderfile`) — a position the caller's
        # word scan resolves as one in-project non-path, so the real target
        # would never be seen. Unprovable, therefore silent.
        case "$arg" in */*) return 1 ;; esac
        case "$GIT_BANNED_OPT" in
          *" ${arg%%=*} "*) return 1 ;;
        esac
        # `--opt=value` with no slash can still name a protected file in the
        # current directory (`--output=.env`), so the value is resolved in
        # its own right.
        case "$arg" in
          *=*)
            check_and_mark "${arg#*=}"
            [ "$ESCAPED" = 1 ] && return 1
            ;;
        esac
        ;;
      *:*)
        # `<rev>:<path>` names a path in a tree. As one word it resolves to
        # a harmless in-project non-path (`<cwd>/HEAD:/etc/passwd`), so the
        # path half is resolved separately or `git show HEAD:/etc/passwd`
        # would read as in-project.
        check_and_mark "${arg#*:}"
        [ "$ESCAPED" = 1 ] && return 1
        ;;
    esac
  done
  # Revision operands (`HEAD~3`, `main..feature`, a bare sha) need no
  # special case: they carry no `/`, so the caller resolves each one to a
  # non-existent path inside the current directory, which is in-project and
  # changes no decision. A revision that DOES escape (`git log ../..`)
  # resolves out of the root and goes silent, which is the safe direction.
  return 0
}

cur_words=(); redir_gt=""; redir_lt=""

process_segment() {
  [ "$ESCAPED" = 1 ] && return
  local nwords=${#cur_words[@]}

  # Redirect targets are opened relative to the CURRENT directory, before
  # any `cd` in this same segment takes effect — so they are checked first.
  if [ -n "$redir_gt" ]; then check_word "$redir_gt"; [ "$ESCAPED" = 1 ] && return; fi
  if [ -n "$redir_lt" ]; then check_word "$redir_lt"; [ "$ESCAPED" = 1 ] && return; fi
  [ "$nwords" -eq 0 ] && return

  local cmdname="${cur_words[0]}"
  local args=("${cur_words[@]:1}")

  # A segment opening with `NAME=VALUE` is either a bare assignment
  # (`d=/etc; cd $d`) or an env prefix. Either way VALUE becomes a variable
  # this hook does not track, and anything downstream that reads it cannot
  # be proven in-project.
  case "$cmdname" in
    [A-Za-z_]*=*) ESCAPED=1; return ;;
  esac

  is_allowed_command "$cmdname" || { ESCAPED=1; return; }

  # Allowlisted tools whose own argument syntax can reach a program. Checked
  # before any target resolution: an unprovable script or option makes the
  # whole segment silent regardless of where its paths point.
  case "$cmdname" in
    sed) sed_args_ok "${args[@]}" || { ESCAPED=1; return; } ;;
    rg)  rg_args_ok  "${args[@]}" || { ESCAPED=1; return; } ;;
    git) git_args_ok "${args[@]}" || { ESCAPED=1; return; } ;;
  esac

  if [ "$cmdname" = "cd" ]; then
    # Exactly one operand, and never an option: `cd -` and `cd $OLDPWD`
    # land in a directory whose value this hook cannot know, and a bare
    # `cd` goes home. All three are unresolvable, therefore silent.
    [ "${#args[@]}" -ne 1 ] && { ESCAPED=1; return; }
    case "${args[0]}" in
      -*) ESCAPED=1; return ;;
    esac
    local resolved
    resolved=$(resolve_target "${args[0]}" "$CUR_DIR")
    if [ -z "$resolved" ] || ! validate_target "$resolved"; then
      ESCAPED=1
      return
    fi
    CUR_DIR="$resolved"
    return
  fi

  # echo/printf arguments are data written to stdout, never re-read as a
  # path by the command itself, so a multi-word quoted argument is fine
  # there and only there. The redirect target above was still checked.
  local data_only=0
  case "$cmdname" in
    echo|printf) data_only=1 ;;
  esac

  DATA_ARGS_OK=0
  case "$DATA_ARG_ALLOWLIST" in
    *" $cmdname "*) DATA_ARGS_OK=1 ;;
  esac

  # See check_embedded_target: sed's options are exhaustively allowlisted by
  # sed_args_ok above, so the glued-option scan buys nothing there and would
  # misread `-e's/a/b/'` as an attached path.
  SCAN_GLUED_OPT=1
  case "$cmdname" in
    sed) SCAN_GLUED_OPT=0 ;;
  esac

  # Every remaining word is treated as a candidate filesystem target and
  # resolved against CUR_DIR. Words that are really a pattern or a flag
  # (`grep -rl foo`) resolve to a harmless non-existent path still inside
  # CUR_DIR and change nothing; what matters is that no genuine target can
  # slip through unresolved.
  local a
  for a in "${args[@]}"; do
    if [ "$data_only" = 1 ]; then
      check_and_mark "$a"
    else
      check_word "$a"
    fi
    [ "$ESCAPED" = 1 ] && return
    # `of=/etc/x`, `--target-directory=/etc`, `-t/etc` — an operand whose
    # path lives inside the word rather than beside it. The whole word
    # resolves to a harmless in-project non-path, so the embedded value has
    # to be resolved in its own right as well.
    check_embedded_target "$a"
    [ "$ESCAPED" = 1 ] && return
  done
}

if [ "$ESCAPED" = 0 ]; then
  mapfile -t TOKS < <(printf '%s\n' "$CODE" | awk "$TOKENIZE_AWK")

  prev_op=""
  for tok in "${TOKS[@]}"; do
    case "$tok" in
      "OP:;"|"OP:&&"|"OP:||"|"OP:|"|"OP:NL")
        process_segment
        cur_words=(); redir_gt=""; redir_lt=""; prev_op=""
        ;;
      "OP:>>"|"OP:>") prev_op="gt" ;;
      "OP:<") prev_op="lt" ;;
      W:*)
        w="${tok#W:}"
        if [ "$prev_op" = "gt" ]; then redir_gt="$w"
        elif [ "$prev_op" = "lt" ]; then redir_lt="$w"
        else cur_words+=("$w")
        fi
        prev_op=""
        ;;
    esac
    [ "$ESCAPED" = 1 ] && break
  done
  [ "$ESCAPED" != 1 ] && process_segment
fi

if [ "$ESCAPED" = 0 ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"in-project-bash-autoallow: every construct is provably resolvable, every command name is on the allowlist, and every resolved target is inside the project root and unprotected"}}\n'
fi
exit 0
