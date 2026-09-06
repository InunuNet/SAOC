# target_resolve.sh — shared Bash-command target resolver.
#
# Extracted from execution/hooks/check_autonomy.sh (F5, SEC-P1-4a) so a
# second hook (execution/hooks/allow_in_project_bash.sh, F9) can reuse the
# exact same resolution primitives instead of reimplementing them. This
# file changes NONE of the extracted logic's behaviour — it is a literal
# lift. check_autonomy.sh sources this file and its own goldens
# (.agent/memory/project/specs/autonomy-floor-resolves-targets/) must keep
# passing unchanged.
#
# Provides, once sourced:
#   HEREDOC_STRIP_AWK   — awk program dropping heredoc bodies before tokenizing
#   HEREDOC_CODE_AWK     — its complement: emits ONLY interpreter-fed heredoc
#                           bodies, which are executable code, not data
#   TOKENIZE_AWK         — quote-aware lexer emitting W:<word> / OP:<op> lines
#   QUOTED_LITERAL_AWK   — emits every quoted string literal, one per line
#   expand_target()       — ~ / $HOME / ${HOME} / two-step-VAR / ./.. text
#                           expansion (including `..` collapse) plus a bounded
#                           per-component symlink walk
#   re_write_protpath     — write-protected path regex (SEC-P0/SEC-P1-4 set)
#   re_read_protpath      — read-protected path regex (security.md set)
#   path_in_project()     — is a resolved target inside the guarded workspace
#   read_protected()      — the READ-direction verdict: re_read_protpath with
#                            the settings-file half scoped to foreign paths
#
# Callers that invoke expand_target() must have `declare -A VARS=()` in
# scope first (it looks up two-step `NAME=VALUE` assignments there).

# HEREDOC_STRIP_AWK drops heredoc bodies (from "<<DELIM" through the
# terminator line) before tokenizing, so prose inside a heredoc body is
# never mistaken for a command argument.
#
# It removes ONLY the `<<DELIM` token and the body it introduces. Everything
# else on the token's own line — in particular a redirect written to the
# RIGHT of the token — is preserved and handed to the tokenizer. D41: the
# original printed only the text BEFORE the token and discarded the rest of
# the line, so `cat <<EOF > ~/.claude/settings.json` reached the tokenizer as
# a bare `cat` with no target and the autonomy floor never saw the write.
#
# Multiple heredocs may be introduced on one line (`cmd <<A <<B`); the shell
# consumes their bodies in the order the tokens appear, so the delimiters are
# queued and matched in that order. A line equal to a LATER heredoc's
# delimiter therefore cannot terminate an EARLIER one's body. An unterminated
# heredoc leaves the queue non-empty and every remaining line stays body —
# the same direction the original failed in, and the safe one: text the shell
# feeds to stdin is never promoted to a command.
read -r -d '' HEREDOC_STRIP_AWK <<'EOF'
BEGIN { head = 0; nq = 0 }
{
  line = $0
  if (head < nq) {
    t = line
    gsub(/^[ \t]+|[ \t]+$/, "", t)
    if (t == queue[head]) { head++ }
    next
  }
  out = ""
  rest = line
  while (match(rest, /<<-?["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
    out = out substr(rest, 1, RSTART - 1)
    tok = substr(rest, RSTART, RLENGTH)
    d = tok
    gsub(/^<<-?/, "", d)
    gsub(/["\047]/, "", d)
    queue[nq] = d
    nq++
    rest = substr(rest, RSTART + RLENGTH)
  }
  print out rest
}
EOF

# TOKENIZE_AWK is a character-scanning lexer: it respects single/double
# quotes (quote characters are stripped but do not break a word — this is
# what lets `~/'.ssh'/id_rsa` resolve as one token), and emits separator
# operators (; && || | > >> < <<) as their own tokens so a target word can
# be identified by its position immediately after a redirect operator
# rather than by searching the whole string for one.
read -r -d '' TOKENIZE_AWK <<'EOF'
{
  line = $0
  n = length(line)
  i = 1
  buf = ""
  inbuf = 0
  while (i <= n) {
    c = substr(line, i, 1)
    if (c == "\047") {
      i++
      while (i <= n && substr(line, i, 1) != "\047") { buf = buf substr(line, i, 1); i++; inbuf = 1 }
      i++
      continue
    }
    if (c == "\042") {
      i++
      while (i <= n && substr(line, i, 1) != "\042") {
        cc = substr(line, i, 1)
        if (cc == "\\" && i < n) { buf = buf substr(line, i + 1, 1); i += 2; inbuf = 1; continue }
        buf = buf cc; i++; inbuf = 1
      }
      i++
      continue
    }
    if (c == " " || c == "\t") {
      if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 }
      i++
      continue
    }
    if (c == ";") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:;"; i++; continue }
    if (c == "&" && substr(line, i, 2) == "&&") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:&&"; i += 2; continue }
    if (c == "|" && substr(line, i, 2) == "||") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:||"; i += 2; continue }
    if (c == "|") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:|"; i++; continue }
    if (c == ">" && substr(line, i, 2) == ">>") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:>>"; i += 2; continue }
    if (c == ">") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:>"; i++; continue }
    if (c == "<" && substr(line, i, 2) == "<<") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:<<"; i += 2; continue }
    if (c == "<") { if (inbuf) { print "W:" buf; buf = ""; inbuf = 0 } print "OP:<"; i++; continue }
    buf = buf c; inbuf = 1; i++
  }
  if (inbuf) print "W:" buf
  print "OP:NL"
}
EOF

# HEREDOC_CODE_AWK is HEREDOC_STRIP_AWK's complement: instead of dropping
# every heredoc body, it emits the bodies of heredocs fed to an INTERPRETER
# (`python3 - <<PY`, `bash -s <<SH`, `ruby <<RB`, …) and nothing else. A
# heredoc handed to cat/git-commit is data and stays dropped — that is the
# D24 false-positive guard — but a heredoc handed to an interpreter is
# executable code, and code that opens a protected path for writing is a
# write (D35 finding 2). Callers scan the emitted lines as a code blob.
read -r -d '' HEREDOC_CODE_AWK <<'EOF'
BEGIN { state = 0; delim = ""; emit = 0 }
{
  line = $0
  if (state == 1) {
    t = line
    gsub(/^[ \t]+|[ \t]+$/, "", t)
    if (t == delim) { state = 0; emit = 0; next }
    if (emit) print line
    next
  }
  if (match(line, /<<-?["\047]?[A-Za-z_][A-Za-z0-9_]*["\047]?/)) {
    pre = substr(line, 1, RSTART - 1)
    tok = substr(line, RSTART, RLENGTH)
    d = tok
    gsub(/^<<-?/, "", d)
    gsub(/["\047]/, "", d)
    delim = d
    state = 1
    emit = (pre ~ /(^|[ \t;&|(])(python3?|perl|ruby|node|deno|php|sh|bash|zsh|dash|ksh)([ \t]|$)/) ? 1 : 0
    next
  }
}
EOF

# QUOTED_LITERAL_AWK emits every single- or double-quoted string literal in
# its input, one per line. TOKENIZE_AWK is a *shell* lexer and does not split
# on `(`, `)` or `,`, so `open('.agent/x.json','w')` reaches it as one word
# and no path can be recovered from it. Interpreter code has to be mined for
# its string literals instead. Prose is still safe: a literal containing
# whitespace is rejected by the caller's same whitespace guard.
read -r -d '' QUOTED_LITERAL_AWK <<'EOF'
{
  line = $0
  n = length(line)
  i = 1
  while (i <= n) {
    c = substr(line, i, 1)
    if (c == "\047" || c == "\042") {
      q = c; i++; buf = ""
      while (i <= n && substr(line, i, 1) != q) {
        cc = substr(line, i, 1)
        if (cc == "\\" && i < n) { buf = buf substr(line, i + 1, 1); i += 2; continue }
        buf = buf cc; i++
      }
      i++
      if (buf != "") print buf
      continue
    }
    i++
  }
}
EOF

# expand_target: literal ~ / $HOME / ${HOME} / known two-step variable
# expansion, slash de-duplication and leading ./ stripping, then a bounded
# walk resolving any symlinked path component (existence-dependent, the
# one place it has to be — everything before it is pure text expansion).
expand_target() {
  local w="$1"
  w="${w//\$\{HOME\}/$HOME}"
  w="${w//\$HOME/$HOME}"
  if [[ "$w" =~ ^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(.*)$ ]]; then
    local vn="${BASH_REMATCH[1]}" rest="${BASH_REMATCH[2]}"
    [ -n "${VARS[$vn]+x}" ] && w="${VARS[$vn]}${rest}"
  fi
  case "$w" in
    "~") w="$HOME" ;;
    "~/"*) w="${HOME}/${w#\~/}" ;;
  esac
  while [[ "$w" == *//* ]]; do w="${w//\/\//\/}"; done
  while [[ "$w" == ./* ]]; do w="${w#./}"; done
  local result="" part depth=0
  IFS='/' read -r -a _parts <<< "$w"
  for part in "${_parts[@]}"; do
    if [ -z "$part" ]; then result="/"; continue; fi
    if [ "$part" = "." ]; then continue; fi
    if [ "$part" = ".." ]; then
      # `..` collapse, applied to the prefix AFTER any symlink hop on it —
      # realpath's own ordering. Without this a floor-protected path is
      # reachable as `execution/not-a-dir/../hooks/check_autonomy.sh`, which
      # the anchored protected-path regexes do not match (D35). A climb that
      # would rise above the start of a relative path keeps the `..` literal
      # rather than silently rooting the result somewhere else.
      case "$result" in
        ""|"..") result="${result:+${result}/}.." ;;
        "/")     ;;
        */..)    result="${result}/.." ;;
        */*)     result="${result%/*}"; [ -z "$result" ] && result="/" ;;
        *)       result="" ;;
      esac
      continue
    fi
    if [ -z "$result" ] || [ "$result" = "/" ]; then result="${result}${part}"; else result="${result}/${part}"; fi
    depth=$((depth + 1))
    if [ "$depth" -le 10 ] && [ -L "$result" ] 2>/dev/null; then
      local tgt; tgt=$(readlink "$result" 2>/dev/null)
      if [ -n "$tgt" ]; then
        if [[ "$tgt" == /* ]]; then result="$tgt"; else result="$(dirname "$result")/${tgt}"; fi
      fi
    fi
  done
  printf '%s' "$result"
}

# Protected-path lists. WRITE_PROTECTED is exactly the SEC-P0/original
# SEC-P1-4 write-protected set, unchanged in what it protects — only how a
# target is matched against it (per-token, anchored) has changed.
# READ_PROTECTED is the credential/config-read set from security.md
# ("Files never read without permission") plus the two settings files —
# it deliberately does NOT include execution/hooks/, CLAUDE.md, AGENTS.md,
# GEMINI.md, init.sh, full_boot.sh, or autonomy_matrix.json: those are
# floor-protected from writes, not from being read (a read-only grep over
# execution/hooks/foo.sh must stay allowed).
re_write_protpath='(^|/)\.claude/settings\.json$|(^|/)\.claude/settings\.local\.json$|(^|/)\.claude/hooks/|(^|/)execution/hooks/|(^|/)CLAUDE\.md$|(^|/)AGENTS\.md$|(^|/)GEMINI\.md$|(^|/)\.agent/autonomy_matrix\.json$|(^|/)init\.sh$|(^|/)full_boot\.sh$|(^|/)\.env$|(^|/)\.sops\.yaml$|(^|/)\.agent/enforcement_breakglass\.json$'

# The read set is split in two, because its two halves answer different
# questions and only one of them is location-independent.
#
# re_read_protpath_core — credential stores and secret material. These are
# protected WHEREVER they live. A private key inside the workspace is still a
# private key, so this half is deliberately NOT scoped to anything.
re_read_protpath_core='(^|/)\.ssh(/|$)|(^|/)\.aws(/|$)|(^|/)\.gnupg(/|$)|\.pem$|\.key$|(^|/)secrets(/|$)|(^|/)\.env$|(^|/)\.sops\.yaml$'

# re_read_protpath_settings — harness configuration, which is not secret; what
# makes it protected is WHOSE it is. Reading the machine-global
# ~/.claude/settings.json, or a sibling workspace's copy, is the scope.md
# violation this alternative exists to stop. Reading the workspace's OWN
# tracked settings file is ordinary work on ordinary project source, and D26
# showed the cost of conflating the two: with the enforcement floor armed, a
# blanket match here denied `grep`, `git add` and `git stash push` against the
# project's own settings.json, and the harness could not commit the fix to its
# own enforcement machinery. F7's hatch covers writes; the read floor had no
# hatch at all, so an over-broad read alternative is unrecoverable from inside.
#
# Scoping is by path_in_project() below and never by a $HOME pattern: a second
# checkout under $HOME is still somebody else's workspace, and the operator's
# home is not the only place a foreign config can sit.
re_read_protpath_settings='(^|/)\.claude/settings\.json$|(^|/)\.claude/settings\.local\.json$'

# re_read_protpath — the union, unchanged in membership from before the split.
# It is what the WRITE direction tests (a config file you may not read you
# certainly may not write) and what F9 tests to decide it will not auto-approve
# a command. Only the READ decision consults read_protected() and so only the
# read decision is scoped. The project's own settings files remain
# write-protected by re_write_protpath regardless.
re_read_protpath="${re_read_protpath_core}|${re_read_protpath_settings}"

# TR_PROJECT_ROOT — the workspace these hooks guard.
#
# Derived from a MARKER IN THE FILESYSTEM found by walking up from this file's
# own location, and never from the invocation cwd. F28: cwd is an input an
# agent controls. Deriving the root from it made the trust boundary movable —
# run the hook from $HOME and $HOME *is* the project, so ~/.claude/settings.json
# is "its own config" and exempt; run it from ~/ai and every sibling workspace
# sits inside the root, the lookalike `AthanorX` that path_in_project()'s
# component-wise matching was written to exclude included. The containment test
# was never wrong; it was being handed the wrong root. That makes `cd`-chaining
# more than a resolution nuisance: it relocates the boundary itself.
#
# ${BASH_SOURCE[0]} is THIS file, at <root>/execution/hooks/lib/, and no chdir
# can move it. The walk stops at the nearest ancestor carrying a workspace
# marker — a WORKSPACE file or a .agent/ directory, the same pair the boot check
# in CLAUDE.md uses to decide a workspace exists at all.
#
# `git rev-parse --show-toplevel` is deliberately NOT consulted, as primary or
# as fallback: GIT_DIR and GIT_WORK_TREE are environment-settable, so it is the
# same attacker-controlled input in a different spelling.
#
# "/" is never a valid root — a filesystem root would put every path on the
# machine "in project" — so the walk stops above it and yields nothing. No
# marker ⇒ empty ⇒ path_in_project() denies everything. Fail closed.
_tr_project_root() {
  local d depth=0
  d=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P) || return
  while [ -n "$d" ] && [ "$d" != "/" ] && [ "$depth" -le 30 ]; do
    if [ -f "$d/WORKSPACE" ] || [ -d "$d/.agent" ]; then
      printf '%s' "$d"
      return
    fi
    d=$(dirname "$d")
    depth=$((depth + 1))
  done
}
TR_PROJECT_ROOT="$(_tr_project_root)"

# TR_CWD — the physical working directory the guarded command will actually run
# in. Used ONLY to resolve a relative target into the file it really names; it
# is never the trust boundary. See path_in_project() for why the distinction is
# the whole fix.
TR_CWD="$(pwd -P 2>/dev/null)"

# path_in_project <path> — is this target inside the guarded workspace?
#
# Component-wise, never a bare string prefix: "${TR_PROJECT_ROOT}X" (a sibling
# checkout named AthanorX) must not pass.
#
# Two different questions, two different sources, and conflating them is what
# F28 was:
#
#   WHICH WORKSPACE IS MINE?  TR_PROJECT_ROOT, from the filesystem marker.
#                              Never cwd — cwd is chosen by the caller.
#   WHAT FILE DOES THIS NAME?  cwd, for a relative path. That is simply what
#                              the shell will do with it, and pretending
#                              otherwise mis-identifies the file.
#
# So a relative target is anchored at TR_CWD, then tested against the immovable
# marker root. Anchoring at the root instead would have left the mirror-image
# hole: with cwd at $HOME, `cat .claude/settings.json` names the machine-global
# file, and anchoring it at the project root would have called it "our own" and
# exempted it. Anchoring at cwd cannot be abused in the other direction either —
# a hostile cwd can only push a relative path OUT of the marker root (deny), and
# a cwd inside the workspace keeps it in, which is correct.
#
# Anchoring runs through expand_target() so a climb out
# (`../Alembic/.claude/settings.json`) collapses to the foreign absolute path it
# really names instead of being read as in-project text. Unknown cwd ⇒ the file
# a relative path names is unknowable ⇒ not in project. Fail closed.
#
# Callers pass the ALREADY-resolved target, so a symlink pointing out of the
# workspace has been hopped before it gets here. The root is canonicalized the
# same way (`cd -P`/`pwd -P` above), so a symlinked checkout compares equal.
path_in_project() {
  local p="$1"
  [ -z "$TR_PROJECT_ROOT" ] && return 1
  case "$p" in
    /*) ;;
    *) [ -z "$TR_CWD" ] && return 1
       p=$(expand_target "${TR_CWD}/${p}") ;;
  esac
  case "$p" in
    "$TR_PROJECT_ROOT"|"$TR_PROJECT_ROOT"/*) return 0 ;;
  esac
  return 1
}

# read_protected <resolved-path> — the READ-direction verdict. 0 = protected.
#
# The core credential set is tested FIRST and unconditionally, so a settings
# file sitting under a protected directory (`<project>/secrets/.claude/
# settings.json`) is denied on the strength of `secrets/` and never reaches
# the workspace-scoped exemption.
read_protected() {
  local p="$1"
  [[ "$p" =~ $re_read_protpath_core ]] && return 0
  if [[ "$p" =~ $re_read_protpath_settings ]]; then
    path_in_project "$p" && return 1
    return 0
  fi
  return 1
}
