#!/usr/bin/env bash
# full_boot.sh — SessionStart command hook
# Executes the full Athanor boot sequence and injects context into the session.
# Runs from project root. All steps are non-fatal (|| true).

WORKSPACE_FILE="WORKSPACE"
PROFILE_FILE=".agent/profile.json"

# Banner (scaffold-identity-integrity S5). A scaffolded workspace is NOT the
# harness, and the first line of boot is the single most-read surface in the
# session: an agent told "ATHANOR" on line one spends the rest of the session
# believing it. When profile project_name and harness_name differ, the banner
# names the PROJECT and credits the harness as machinery. When they are equal
# (this repo, booting as itself), today's harness banner is preserved verbatim.
_BOOT_WS_NAME=$(sed 's/[[:space:]]*$//' < "$WORKSPACE_FILE" 2>/dev/null | head -1)
[ -n "$_BOOT_WS_NAME" ] || _BOOT_WS_NAME="$(basename "$PWD")"
_BOOT_VERSION=$(cat .agent/version 2>/dev/null || echo 'unknown')
[ -n "$_BOOT_VERSION" ] || _BOOT_VERSION="unknown"
_BOOT_PROJECT=""
_BOOT_HARNESS=""
if [ -f "$PROFILE_FILE" ]; then
  _BOOT_IDENT=$(PROFILE_FILE="$PROFILE_FILE" python3 -c "
import json, os
try:
    p = json.load(open(os.environ['PROFILE_FILE']))
except Exception:
    p = {}
print('%s\t%s' % (str(p.get('project_name') or '').strip(),
                  str(p.get('harness_name') or '').strip()))
" 2>/dev/null || printf '\t')
  _BOOT_PROJECT=$(printf '%s' "$_BOOT_IDENT" | cut -f1)
  _BOOT_HARNESS=$(printf '%s' "$_BOOT_IDENT" | cut -f2)
  unset _BOOT_IDENT
fi
[ -n "$_BOOT_PROJECT" ] || _BOOT_PROJECT="$_BOOT_WS_NAME"
# A legacy workspace predating the harness_name key falls back to the WORKSPACE
# name: anything that is not the harness itself is a downstream project.
if [ -n "$_BOOT_HARNESS" ]; then
  _BOOT_IS_HARNESS=$([ "$_BOOT_PROJECT" = "$_BOOT_HARNESS" ] && echo "true" || echo "false")
else
  _BOOT_IS_HARNESS=$([ "$_BOOT_WS_NAME" = "Athanor" ] && echo "true" || echo "false")
  _BOOT_HARNESS="Athanor"
fi
# F19 (notes-f19.md §2): the opening line names the workspace, never a
# verdict — nothing about this boot has been checked yet at this point, and
# a HALT three lines later must not read past a green glyph printed before
# anything was known. The verdict glyph is printed exactly once, by
# boot_panel's _render_verdict, once the checks below have actually run.
if [ "$_BOOT_IS_HARNESS" = "true" ]; then
  echo "ATHANOR: $_BOOT_WS_NAME | Athanor Harness v$_BOOT_VERSION"
  echo "════ BOOT CONTEXT (Athanor Harness) ════"
else
  echo "$_BOOT_PROJECT | scaffolded by $_BOOT_HARNESS harness v$_BOOT_VERSION"
  echo "════ BOOT CONTEXT ($_BOOT_PROJECT) ════"
fi
echo "Core Mandates: Specialized agents, Tiered memory, Autonomous self-improvement, Alembic (URL distilling)."
echo ""

# HARNESS-completeness check (issue #1311): a partially-propagated project can be
# missing the harness's own executables entirely. Detect that up front with a loud,
# actionable message instead of letting downstream steps misreport it (e.g. as a
# stale mission pointer). Non-fatal — boot must never abort on this.
_HARNESS_MISSING=""
for _critical_file in execution/mission.py execution/contract.py; do
  [ -f "$_critical_file" ] || _HARNESS_MISSING="$_HARNESS_MISSING $_critical_file"
done
if [ -n "$_HARNESS_MISSING" ]; then
  echo "⛔ HARNESS INCOMPLETE — missing:$_HARNESS_MISSING"
  echo "   Propagation failed. Run: python3 execution/update_template.py --apply"
  echo ""
fi
unset _HARNESS_MISSING _critical_file

# Boot integrity siren (platform-scoped-delivery F2). A checkout made with
# core.symlinks=false — Git for Windows' SYSTEM default — materialises tracked
# symlinks as small text stubs, with `git status` EMPTY, so the agent boots with
# no instructions and nothing says so. boot_integrity.py detects that, prints
# the full AGENTS.md inline as a fallback, and warns about a clone that has
# drifted from its source. It ALWAYS exits 0 and never writes: a SessionStart
# hook that fails takes the session with it, and silent repair at read time is
# the invisibility this feature exists to remove.
if [ -f execution/boot_integrity.py ]; then
  python3 execution/boot_integrity.py 2>/dev/null || true
fi

# ── WORKSPACE CLASSIFICATION (clean-scaffold D-2, REQUIREMENTS.md §0) ────────
# ONE test, ONE reader. execution/workspace_state.py is the canonical
# implementation of §0's absolute rule and boot must NEVER re-implement it
# inline: this read had three independent dialects (here, init.sh's write_profile
# probe, onboard_headless), each drifting on its own, and "one test, no
# heuristics" is unenforceable while that is true. The decision arrives on
# stdout, the one-word reason on stderr, so neither has to be parsed.
#
# A workspace with no classifier cannot be classified, and §0 fails toward NEW —
# so say which file is missing and take the NEW branch. Reading the profile here
# "just this once" as a fallback would recreate the second dialect this replaces.
_WS_STATE="NEW"
_WS_REASON="classifier-missing"
if [ -f execution/workspace_state.py ]; then
  _WS_STATE=$(python3 execution/workspace_state.py 2>/dev/null)
  _WS_REASON=$(python3 execution/workspace_state.py --reason 2>&1 >/dev/null)
  case "$_WS_STATE" in
    NEW|ESTABLISHED) ;;
    *) _WS_STATE="NEW"; _WS_REASON="classifier-unusable" ;;
  esac
fi

# A MISSING CLASSIFIER IS LOUD, and it is NOT a licence to guess (codex QA round
# 1, finding 5). Updating full_boot.sh without execution/workspace_state.py sends
# a fully onboarded downstream workspace to the onboarding gate; the fix for that
# is to restore the file, NOT to add an inline profile read here — a second
# dialect of this one test is the exact defect D-2 exists to end. So: say which
# file is missing, say what it costs, and refuse to scaffold on the guess below.
_WS_CLASSIFIER_BROKEN="false"
case "$_WS_REASON" in
  classifier-missing|classifier-unusable)
    _WS_CLASSIFIER_BROKEN="true"
    echo "⛔ WORKSPACE CLASSIFIER UNAVAILABLE — execution/workspace_state.py is"
    if [ "$_WS_REASON" = "classifier-missing" ]; then
      echo "   MISSING from this workspace."
    else
      echo "   PRESENT but did not answer NEW or ESTABLISHED."
    fi
    echo "   §0 fails toward NEW, so this session is treated as NOT onboarded even if"
    echo "   it is. Boot will NOT scaffold and will NOT read the profile itself: a"
    echo "   second inline reader of that one flag is the drift this file exists to end."
    echo "   Restore it, then start a new session:"
    echo "     python3 execution/update_template.py --apply"
    echo "     (or copy execution/workspace_state.py from an Athanor clone)"
    echo ""
    ;;
esac

# AN INHERITED HARNESS PROFILE IS NOT THIS WORKSPACE'S IDENTITY (codex QA round
# 1, finding 4 — REQUIREMENTS.md §0's named defect). The classifier already
# returned NEW; what boot owes the session is the REASON, and a project name that
# is this folder's rather than the harness's, so the onboarding command below
# proposes the right one instead of a name onboard_headless refuses (GH #1369).
if [ "$_WS_REASON" = "inherited-harness-profile" ]; then
  _BOOT_PROJECT="$(basename "$PWD")"
  echo "⛔ INHERITED HARNESS PROFILE — $PROFILE_FILE here is the HARNESS'S OWN"
  echo "   (its project_name equals its harness_name, '$_BOOT_HARNESS'), and this folder"
  echo "   is not the harness checkout. A copy of the harness is not the harness, so"
  echo "   that profile is not this workspace's identity and does not make it onboarded."
  echo ""
  echo "   This project is '$_BOOT_PROJECT' — the folder name (REQUIREMENTS.md §1)."
  echo "   Nothing has been changed or deleted. The memory, missions and goals in this"
  echo "   folder are the HARNESS'S, not $_BOOT_PROJECT's — onboarding replaces them."
  echo ""
fi

# USER-AUTHORED CONTENT IS NEVER SCAFFOLDED OVER (codex QA round 1, finding 3).
# The NEW branch below runs a MUTATING init.sh, and its only guard used to be
# "no WORKSPACE or no goals.md" — which a real project with a malformed profile
# satisfies while holding authored learned.md/backlog.md/missions/brain. Opening
# a session then destroyed them before the operator saw a single line. §0's rule
# fails toward NEW BECAUSE setup must never destroy existing memory (§0's own
# stated consequence, and §2's), so the presence of authored memory is a REFUSAL,
# not a hurdle. Deliberately scoped to memory the harness never delivers
# pre-scaffold: AGENTS.md and .agent/identity/ ship inside every harness clone,
# so keying on those would refuse to scaffold the one shape §0 requires boot to
# scaffold (a fresh clone).
_WS_USER_CONTENT=""
for _uc in .agent/memory/project/learned.md .agent/memory/project/backlog.md \
           .agent/memory/project/session_log.md .agent/memory/project/missions \
           .agent/memory/brain; do
  [ -e "$_uc" ] && _WS_USER_CONTENT="$_WS_USER_CONTENT $_uc"
done
unset _uc

# ── BOOT PERFORMS THE SETUP (clean-scaffold D-3, REQUIREMENTS.md §0) ─────────
# §0: the operator does not run init.sh by hand — they open a session in a
# folder and boot does the setup.
#
# GUARDED, and the guard is the whole safety argument. A workspace stays NEW
# until onboarding COMPLETES, so this branch is re-entered on EVERY session in
# between; an unguarded setup would re-run init.sh over work in progress every
# time. Only a workspace that has not been scaffolded yet (no WORKSPACE, or no
# seeded goals.md) is scaffolded. An ESTABLISHED workspace never reaches here at
# all — see clean-scaffold A4, the control that requires an established project
# to come out of a boot byte-identical.
if [ "$_WS_STATE" = "NEW" ] && { [ ! -f "$WORKSPACE_FILE" ] || [ ! -f .agent/memory/project/goals.md ]; }; then
  if [ "$_WS_CLASSIFIER_BROKEN" = "true" ]; then
    echo "⛔ Boot is NOT scaffolding this folder: the workspace classifier above could"
    echo "   not answer, so 'NEW' here is a fallback, not a finding. Scaffolding on it"
    echo "   would run a mutating init.sh over a workspace that may well be onboarded."
    echo "   Restore execution/workspace_state.py, or scaffold deliberately by hand:"
    echo "     bash init.sh --path \"$PWD\""
    echo ""
  elif [ -n "$_WS_USER_CONTENT" ]; then
    echo "⛔ NEW workspace, and boot is REFUSING to scaffold it: this folder already"
    echo "   holds content nobody but you wrote —"
    for _uc in $_WS_USER_CONTENT; do echo "     $_uc"; done
    unset _uc
    echo "   init.sh re-seeds memory, so running it here could overwrite that work."
    echo "   Boot will not take that risk on your behalf."
    echo ""
    echo "   If this workspace really is new, scaffold it deliberately:"
    echo "     bash init.sh --path \"$PWD\""
    echo "   If it is an existing project, its $PROFILE_FILE is missing or unreadable —"
    echo "   repair that (or re-run onboarding) rather than re-scaffolding."
    echo ""
  elif [ -f init.sh ] && [ -d template ]; then
    echo "🏗️  NEW workspace, not yet scaffolded — boot is running init.sh for you."
    echo ""
    bash init.sh --path "$PWD" --no-pulse 2>&1 | sed 's/^/   /'
    _INIT_RC=${PIPESTATUS[0]}
    echo ""
    # The claim is read off the TREE, not off init's rc: on an in-place run the
    # placeholder-residue gate legitimately reads the harness's own template/,
    # docs/ and Makefile tokens and exits 1 AFTER the tree is complete.
    if [ -f "$WORKSPACE_FILE" ] && [ -f "$PROFILE_FILE" ]; then
      echo "✅ Scaffolded: $(sed 's/[[:space:]]*$//' < "$WORKSPACE_FILE" | head -1) (init.sh rc=$_INIT_RC)"
    else
      echo "⚠️  init.sh did not complete the scaffold (rc=$_INIT_RC) — this workspace is"
      echo "   HALF-SCAFFOLDED. Re-run 'bash init.sh' by hand and read its output."
    fi
    echo ""
    # Re-classify from the tree init.sh just wrote. The scaffold NEVER writes
    # onboarding_complete: true (§0), so this stays NEW and the gate below still
    # fires — scaffolding is not onboarding.
    if [ -f execution/workspace_state.py ]; then
      _WS_STATE=$(python3 execution/workspace_state.py 2>/dev/null)
      _WS_REASON=$(python3 execution/workspace_state.py --reason 2>&1 >/dev/null)
      case "$_WS_STATE" in NEW|ESTABLISHED) ;; *) _WS_STATE="NEW"; _WS_REASON="classifier-unusable" ;; esac
    fi
    unset _INIT_RC
  else
    # Every DELIVERED workspace is exactly this shape: it carries the harness's
    # executables but neither init.sh nor template/, so it cannot scaffold
    # itself. Name init.sh and a way forward rather than failing silently.
    echo "⛔ NEW workspace, and boot CANNOT scaffold it here: this folder has no init.sh"
    echo "   and no template/ — it was delivered by a harness rather than cloned from one."
    echo "   Scaffold it from an Athanor clone:"
    echo "     bash /path/to/Athanor/init.sh --path \"$PWD\""
    echo ""
  fi
fi

# ── ONBOARDING GATE (scaffold-identity-integrity D5) ─────────────────────────
# A mid-output warning is the measured status quo and is demonstrably ignored.
# What is left is controlling what the agent CAN act on: an unonboarded
# workspace receives the siren, the workspace facts and the onboarding
# instructions INLINE — and nothing else. No mission, no goals, no backlog, no
# discovery. Withholding that context IS the enforcement; the only actionable
# content in the boot context becomes onboarding itself.
#
# Always exits 0. A SessionStart hook that fails takes the session with it, and
# an unprivileged operator may have no way to clear the condition — that is a
# lockout, which is a rejected design (platform-scoped-delivery D-F2-4).
#
# The gate opens on ESTABLISHED ALONE. It used to fire only on the literal
# "false", so a profile that was absent, zero-byte or unparsable resolved to
# "unknown" and the gate OPENED — the full boot context delivered to a workspace
# whose AGENTS.md still read "Identity not yet configured". That state is
# reachable, not hypothetical: any interrupted profile write leaves exactly a
# zero-byte file. A gate that cannot read its own state must assume the unsafe
# side, which is precisely what §0's fails-toward-NEW rule already says.
if [ "$_WS_STATE" != "ESTABLISHED" ]; then
  echo "⛔ ONBOARDING-REQUIRED — this workspace has not been onboarded."
  if [ "$_WS_REASON" != "value-not-true" ]; then
    echo "   (workspace state: NEW, reason '$_WS_REASON' — $PROFILE_FILE is missing,"
    echo "    unreadable, or not a JSON object carrying onboarding_complete. Anything"
    echo "    that is not the JSON literal true is NOT onboarded, never done.)"
  fi
  echo ""
  echo "   project_name : $_BOOT_PROJECT"
  echo "   harness_name : $_BOOT_HARNESS  (the harness is machinery, not this project)"
  echo "   platform     : $(python3 -c "import json;print(json.load(open('.agent/profile.json', encoding='utf-8-sig')).get('primary_platform') or 'unknown')" 2>/dev/null || echo unknown)"
  echo ""
  echo "Your FIRST action is onboarding; every identity value is UNKNOWN until it completes."
  echo "The rest of the boot context (mission, goals, backlog, discovery) is WITHHELD"
  echo "until onboarding_complete is true — there is nothing else for you to act on yet."
  echo ""
  echo "   python3 execution/onboard_headless.py --project-name \"$_BOOT_PROJECT\" --agent-name <name> --role <role> --mission \"<mission>\""
  echo ""
  if [ -f .agent/skills/onboard.md ]; then
    echo "════ ONBOARDING SKILL (.agent/skills/onboard.md) ════"
    cat .agent/skills/onboard.md
    echo "════ END ONBOARDING SKILL ════"
  else
    echo "⚠️  .agent/skills/onboard.md is missing — use the headless command above."
  fi
  echo ""
  echo "════ BOOT HALTED AT THE ONBOARDING GATE ════"
  exit 0
fi

# ── WORKSPACE IDENTITY GATE (copied-project-halt D-7) ────────────────────────
# STRICTLY AFTER the onboarding gate, and NEVER carrying its marker string.
# clean-scaffold F1/A1 reads full_boot's §0 verdict BEHAVIOURALLY — "did the log
# contain BOOT HALTED AT THE ONBOARDING GATE" — over fixtures whose project
# (ProbeProj) deliberately disagrees with their folder (w_<state-id>), so every
# ESTABLISHED row in that family reaches this gate. Moving it above the
# onboarding gate steals the 25 NEW rows that gate owns; printing the onboarding
# gate's marker here makes A1 read 5 ESTABLISHED rows as NEW. Reaching this line
# already means §0 said ESTABLISHED, which is the precondition exactly.
#
# THE QUESTION IS NOT "copy or rename" — nothing on disk separates the two: in
# both, project_name and WORKSPACE agree with each other and disagree with the
# folder. It is the one question the filesystem can answer, "has a human ever
# accepted THIS folder as the home of THIS project?", and the answer is a
# path-bound affirmation record. execution/identity_ambiguity.py is the ONE
# reader of it; boot never re-implements that read inline.
#
# Halting withholds the WHOLE context and EXITS 0, exactly as the onboarding
# gate does: a SessionStart hook that fails takes the session with it. There is
# no environment-variable amnesty (D-6): a switch a copied folder can inherit —
# an .env, a launchd plist, a CI runner's environment — reintroduces precisely
# the bug this gate exists to stop, so a headless boot halts too.
_ID_STATE=""
if [ -f execution/identity_ambiguity.py ]; then
  _ID_STATE=$(python3 execution/identity_ambiguity.py . 2>/dev/null)
  _ID_REASON=$(python3 execution/identity_ambiguity.py . --reason 2>&1 >/dev/null)
fi
if [ "$_ID_STATE" = "AMBIGUOUS" ]; then
  echo "⛔ WORKSPACE IDENTITY UNCONFIRMED — this folder and the project inside it"
  echo "   disagree, and nobody has ever said which is right HERE."
  echo ""
  echo "   folder       : $(basename "$PWD")"
  echo "   project_name : $_BOOT_PROJECT   (from $PROFILE_FILE)"
  echo "   reason       : $_ID_REASON"
  echo ""
  echo "Copying a project folder is the ordinary way to start a new one, and a copy"
  echo "carries the source's identity, memory, missions and brain with it. A copy and"
  echo "a rename are byte-for-byte identical on disk, so boot will NOT guess: guessing"
  echo ""rename" runs a whole session inside another project's identity, and guessing"
  echo ""copy" quarantines a live project's memory out from under it."
  echo ""
  echo "NOTHING HAS BEEN CHANGED OR DELETED. The rest of the boot context (mission,"
  echo "goals, backlog, discovery) is WITHHELD until you answer. Answer once, here:"
  echo ""
  # The two commands are RENDERED BY THE READER, not composed here: a halt whose
  # printed way out does not work is a lockout, and A6 extracts the rename
  # command from this log and RUNS it.
  _ID_ANSWERS=$(python3 execution/identity_ambiguity.py . --answers 2>/dev/null)
  echo "   This folder was RENAMED — it is still the same project:"
  printf '%s\n' "$_ID_ANSWERS" | sed -n '1p' | sed 's/^/     /'
  echo "       (records the answer and changes nothing else)"
  echo ""
  echo "   This folder is a COPY — it is a NEW project:"
  printf '%s\n' "$_ID_ANSWERS" | sed -n '2p' | sed 's/^/     /'
  echo "       (disowns the inherited identity and QUARANTINES the inherited memory"
  echo "        into .agent/memory-quarantine-<UTC>/ — moved, never deleted)"
  echo ""
  echo "The answer is recorded against this folder's absolute path, so a copy of THIS"
  echo "folder is asked again rather than inheriting it. No environment variable"
  echo "bypasses this gate: a copied folder inherits environment too."
  echo ""
  echo "════ BOOT HALTED — WORKSPACE IDENTITY UNCONFIRMED ════"
  exit 0
fi
_ID_UNVERIFIED=""
if [ ! -f execution/identity_ambiguity.py ] && [ "$_BOOT_PROJECT" != "$(basename "$PWD")" ]; then
  # NEITHER HALT NOR SHRUG (codex QA round 1, finding 5). A workspace that never
  # received the reader cannot be asked the question, and this is a real way to
  # lose the gate: init.sh ships execution/ by a named allowlist.
  #
  #   * HALTING here is a lockout: both answers ARE that missing file, so the
  #     halt would print two commands that cannot run (platform-scoped-delivery
  #     D-F2-4 — a halt whose printed way out does not work is a wall).
  #   * WARNING and continuing was the shipped behaviour and it is also wrong:
  #     measured 2026-09-03, a copy of OwnProj in NewProj/ with the reader
  #     removed printed this warning and then loaded the source project's
  #     mission, identity, rules and goals anyway. A warning nobody can act on
  #     mid-session, followed by the very context it warned about, is a shrug.
  #
  # So: the SESSION proceeds (no lockout) and the INHERITED CONTEXT does not.
  # Boot withholds exactly what it cannot attribute to this folder — mission,
  # identity, goals, learned, rules, backlog, blockers — keeps the machinery
  # sections that are about this machine rather than this project, and says so
  # in its closing banner instead of claiming all context was loaded.
  _ID_UNVERIFIED="1"
  echo "⛔ WORKSPACE IDENTITY UNVERIFIABLE — inherited context WITHHELD."
  echo ""
  echo "   folder       : $(basename "$PWD")"
  echo "   project_name : $_BOOT_PROJECT   (from $PROFILE_FILE)"
  echo "   missing      : execution/identity_ambiguity.py"
  echo ""
  echo "   This folder and the project inside it disagree, and the reader that decides"
  echo "   whether that means a RENAME or a COPY is not here. Boot will not guess, and"
  echo "   it will not hand you another project's mission, memory and identity while"
  echo "   the question is open. NOTHING HAS BEEN CHANGED OR DELETED."
  echo ""
  echo "   Restore the reader, then start a new session — it will ask you the question"
  echo "   properly and take your answer:"
  echo "     python3 execution/update_template.py --apply"
  echo "   or, from any harness clone:"
  echo "     cp /path/to/Athanor/execution/identity_ambiguity.py execution/"
  echo ""
  echo "   This session can still do work in this folder. It just starts without the"
  echo "   context it cannot prove is yours."
  echo ""
fi
unset _ID_STATE _ID_REASON

# Auto-update check: compare local template_version to upstream
# Prefer .agent/.template_state (updater-owned, rewritten by every --apply run
# and carrying its own delivery=complete|partial field) over profile.json,
# which can lag or never move if a prior run bailed early — falls back to
# profile.json when the state file is missing, unparsable, or carries no
# usable template_version (issue #1295/#1312, delivery-integrity F4b).
#
# Each resolver EXITS NON-ZERO rather than printing a sentinel when its source
# yields nothing usable. `||` is an exit-status operator, so the old
# .get('template_version','0') could never trigger the fallback: on a stamp
# that existed and parsed but whose key was absent, empty, null or
# whitespace-only, python printed "0" and exited 0, the profile.json fallback
# was unreachable, and "0" sorts below every real version — a permanent
# "update available" that no update could ever clear. The final fallback is an
# EMPTY string, never a fabricated version, so an undetermined version is
# reported as undetermined instead of compared.
#
# The first resolver also requires the stamp's workspace_id to match THIS
# workspace (delivery-integrity F4b). .agent/.template_state is a tracked
# file, so every clone and fork inherits the upstream workspace's stamp and
# would otherwise display an inherited version as its own in the banner — the
# most-read surface in the harness. A foreign stamp is an unusable SOURCE,
# exactly like a missing or unparseable one, so it falls through to the
# profile.json fallback rather than abandoning resolution. The identity
# formula is duplicated from _workspace_identity() in update_template.py by
# necessity: boot must resolve the version without importing the updater (it
# may not exist yet in a half-delivered workspace). Keep the two in step.
CURRENT_VER=$(python3 -c "import hashlib,json,os,sys; d=json.load(open('.agent/.template_state')); v=str(d.get('template_version') or '').strip(); sys.exit(1) if not v or d.get('workspace_id') != hashlib.sha256(os.path.realpath(os.getcwd()).encode('utf-8')).hexdigest()[:16] else print(v)" 2>/dev/null || python3 -c "import json,sys; v=str(json.load(open('.agent/profile.json')).get('template_version') or '').strip(); sys.exit(1) if not v else print(v)" 2>/dev/null || echo "")
# SANDBOX INSIDE THE PROJECT (.agent/rules/_core/sandbox.md; codex QA round 1,
# finding 10). A bare `mktemp` writes to $TMPDIR — outside the project folder,
# where the permission bypass does not reach — so on a managed or permission-
# gated temp dir boot could fail or prompt for a scratch file it only needs for
# three lines of `gh` output. `.tmp/` is gitignored, so an in-project scratch
# pollutes nothing. The system-temp fallback is LAST RESORT ONLY, for a project
# directory that is not writable at all — a workspace in which boot has larger
# problems than this file, and where today's behaviour was the fallback anyway.
_BOOT_SANDBOX=".tmp/sandbox/boot"
mkdir -p "$_BOOT_SANDBOX" 2>/dev/null || true
[ -d "$_BOOT_SANDBOX" ] && [ -w "$_BOOT_SANDBOX" ] || _BOOT_SANDBOX=""
_boot_tmpfile() {
  if [ -n "$_BOOT_SANDBOX" ]; then
    mktemp "$_BOOT_SANDBOX/boot.XXXXXX" 2>/dev/null || mktemp
  else
    mktemp
  fi
}
_UPDATE_CHECK_ERR=$(_boot_tmpfile)
_UPDATE_CHECK_OUT=$(_boot_tmpfile)
# Bound the `gh api` call so a blackholed call can never hang boot. `timeout`/
# `gtimeout` (Homebrew coreutils) aren't present on stock macOS, so this must
# not hard-depend on either — falling back to `timeout` unconditionally would
# silently disable the update check (not just the bound) on any clean Mac.
# When neither binary is on PATH, background the call and poll-and-kill it
# ourselves: the check still actually runs, it's just bounded by hand.
# Resolved once, here, and reused (not re-derived) by the GITHUB AUTH section
# below (~line 380+) for the same reason — nothing unsets it in between.
_GH_TIMEOUT_BIN="$(command -v timeout 2>/dev/null || command -v gtimeout 2>/dev/null || echo "")"
if [ -n "$_GH_TIMEOUT_BIN" ]; then
  LATEST_VER=$("$_GH_TIMEOUT_BIN" 3 gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' 2>"$_UPDATE_CHECK_ERR" | base64 -d 2>>"$_UPDATE_CHECK_ERR" | tr -d '\n' || echo "")
else
  # ATHANOR_POLL_KILL_FALLBACK_BEGIN
  _GH_SETSID_BIN="$(command -v setsid 2>/dev/null || echo "")"
  if [ -n "$_GH_SETSID_BIN" ]; then
    "$_GH_SETSID_BIN" gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' >"$_UPDATE_CHECK_OUT" 2>"$_UPDATE_CHECK_ERR" &
    _GH_PID=$!
  else
    set -m
    gh api repos/InunuNet/Athanor/contents/.agent/version --jq '.content' >"$_UPDATE_CHECK_OUT" 2>"$_UPDATE_CHECK_ERR" &
    _GH_PID=$!
    set +m
  fi
  _WAITED=0
  while kill -0 "$_GH_PID" 2>/dev/null && [ "$_WAITED" -lt 3 ]; do
    sleep 1
    _WAITED=$((_WAITED + 1))
  done
  if kill -0 "$_GH_PID" 2>/dev/null; then
    kill -9 -- -"$_GH_PID" 2>/dev/null
    kill -9 "$_GH_PID" 2>/dev/null
    wait "$_GH_PID" 2>/dev/null
    echo "gh api timed out after ${_WAITED}s (no timeout/gtimeout on PATH — bounded via background poll-kill fallback)" >> "$_UPDATE_CHECK_ERR"
    LATEST_VER=""
  else
    wait "$_GH_PID" 2>/dev/null
    LATEST_VER=$(base64 -d <"$_UPDATE_CHECK_OUT" 2>>"$_UPDATE_CHECK_ERR" | tr -d '\n')
  fi
  unset _GH_PID _WAITED _GH_SETSID_BIN
  # ATHANOR_POLL_KILL_FALLBACK_END
fi
if [ -z "$LATEST_VER" ] && [ -s "$_UPDATE_CHECK_ERR" ]; then
  # Redact token-shaped substrings and cap length before echoing gh's raw
  # stderr into boot output — an unbounded/unredacted blob must never reach
  # session output verbatim.
  _ERR_MSG=$(tail -c 500 "$_UPDATE_CHECK_ERR" 2>/dev/null | tr -d '\n' | sed -E 's#[A-Za-z0-9_./+=-]{20,}#[redacted]#g' | cut -c1-100)
  echo "⚠️  update check failed: $_ERR_MSG"
  unset _ERR_MSG
fi
rm -f "$_UPDATE_CHECK_ERR" "$_UPDATE_CHECK_OUT"
unset _UPDATE_CHECK_ERR _UPDATE_CHECK_OUT _GH_TIMEOUT_BIN
ACTIVE_MISSION=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
# Detect-and-prompt only — boot never applies template updates itself, in either
# the mission-active or no-mission case. See .claude/rules/behavior.md "Ask
# Before Destructive Actions" and mission harness-integrity-hardening F5.
# The banner reads TWO different files: the session header above displays
# `cat .agent/version`, while this comparison uses CURRENT_VER from
# .template_state. Both can be individually correct and jointly incoherent —
# the shape a consumer hit as header "v3.7.149" beside "template 3.7.123 → ..."
# (delivery-integrity F4b). Resolve the displayed version here and say so when
# the two sites disagree, rather than quietly presenting two installed
# versions as one. The note is printed from EVERY branch of the chain below,
# including the no-update-available one: divergence is a property of the local
# records alone, so gating it on "an update is available" hid it in the most
# common fleet state -- workspace up to date, or `gh` offline and LATEST_VER
# empty -- which is precisely when nothing else surfaces the incoherence.
_VER_NOTE_LF=$'\n'
DISPLAY_VER=""
[ -f .agent/version ] && DISPLAY_VER=$(tr -d '[:space:]' < .agent/version 2>/dev/null || echo "")
VER_DIVERGENCE_NOTE=$(if [[ -n "$DISPLAY_VER" && -n "$CURRENT_VER" && "$DISPLAY_VER" != "$CURRENT_VER" ]]; then printf '   \xe2\x9a\xa0\xef\xb8\x8f  Version records diverge: this session displays v%s (.agent/version) but the last recorded delivery is %s (.agent/.template_state) — run "make update-template" to review and converge them.\n' "$DISPLAY_VER" "$CURRENT_VER"; fi)
if [[ -n "$LATEST_VER" && -z "$CURRENT_VER" ]]; then
  echo "⚠️  Harness update check: the installed template version is UNKNOWN — cannot determine it from .agent/.template_state or .agent/profile.json, so upstream $LATEST_VER is not being compared against a fabricated number."
  printf '%s' "${VER_DIVERGENCE_NOTE:+$VER_DIVERGENCE_NOTE$_VER_NOTE_LF}"
elif [[ -n "$LATEST_VER" && "$CURRENT_VER" != "$LATEST_VER" ]]; then
  echo "⬆️  HARNESS UPDATE AVAILABLE: template $CURRENT_VER → $LATEST_VER"
  echo "   Run 'make update-template' to review and apply it (boot never applies updates automatically)."
  printf '%s' "${VER_DIVERGENCE_NOTE:+$VER_DIVERGENCE_NOTE$_VER_NOTE_LF}"
else
  printf '%s' "${VER_DIVERGENCE_NOTE:+$VER_DIVERGENCE_NOTE$_VER_NOTE_LF}"
fi

# Optional harness diagnostics — guarded on existence. They are harness-repo
# checks, not downstream necessities, so a workspace that legitimately lacks
# one must boot silently rather than print an interpreter's file-not-found
# error as an agent's first impression of its own workspace (D7).
# Harness diagnostics, folded to one rollup line (L1: boot on one screen).
# The guards STILL RUN here (side effects and any gating preserved) and STILL
# gate where they gate (boot_panel / fleet acceptance); only their per-item
# PASS spam is suppressed. Any real FAIL is named.
_BOOT_DIAG=""
[ -f execution/checks/verify_model_env_boot.py ] && _BOOT_DIAG="$_BOOT_DIAG$(python3 execution/checks/verify_model_env_boot.py boot_report 2>&1)
"
[ -f execution/checks/verify_all_contracts_parse.py ] && _BOOT_DIAG="$_BOOT_DIAG$(python3 execution/checks/verify_all_contracts_parse.py 2>&1)
"
_DIAG_PASS=$(printf '%s\n' "$_BOOT_DIAG" | grep -c '^PASS:')
_DIAG_FAIL=$(printf '%s\n' "$_BOOT_DIAG" | grep -c '^FAIL:')
if [ "${_DIAG_FAIL:-0}" -gt 0 ] 2>/dev/null; then
  echo "boot guards: $_DIAG_PASS passed, $_DIAG_FAIL FAILED —"
  printf '%s\n' "$_BOOT_DIAG" | grep '^FAIL:' | sed 's/^/  /'
else
  echo "boot guards: ${_DIAG_PASS:-0} passed"
fi
unset _BOOT_DIAG _DIAG_PASS _DIAG_FAIL

# Step 0.5: Quota-death warm restart — one-shot checkpoint left by quota_death_checkpoint.sh
# (StopFailure) or inject_pressure.sh (proactive, >=90% quota). quota_death_detect
# disambiguates a genuine crash from a proactive checkpoint followed by a clean exit
# by comparing the checkpoint's timestamp against the SessionEnd clean-exit marker
# (ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH / ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH overridable).
# shellcheck source=execution/hooks/lib/quota_death_detect.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/quota_death_detect.sh"

# ── INHERITED CONTEXT (withheld when this folder's identity is unverifiable) ──
# Everything from here to the PULSE HEARTBEAT section is read out of
# .agent/memory/ and .agent/profile.json — this workspace's claims about itself.
# When the identity gate above could not verify that those claims belong to THIS
# folder, they are not printed at all. The sections after this block are about
# the machine and the checkout (pulse, Alembic, gh auth, git remotes) and stay.
if [ -n "${_ID_UNVERIFIED:-}" ]; then
  echo "--- INHERITED CONTEXT WITHHELD ---"
  echo "Mission, identity, goals, learned, rules, backlog and blockers are NOT loaded:"
  echo "they may belong to the project this folder was copied from. Restore"
  echo "execution/identity_ambiguity.py (see above) and start a new session to answer"
  echo "the question and get them back. Nothing has been changed or deleted."
  echo ""
else
quota_death_detect

echo "--- ACTIVE MISSION ---"
python3 execution/checks/print_active_checkpoint.py .agent/memory/project/missions/active.json 2>/dev/null || true
# wrap_mission.sh's own clear step (post close-out) writes active.json as
# {"mission": null, ...} rather than unlinking it -- so gate on the "mission"
# field being non-null/non-empty, not merely on the file existing, or a
# freshly-closed mission misreports as a stale pointer here (issue: F3 QA).
ACTIVE_MISSION_SLUG=""
if [ -f .agent/memory/project/missions/active.json ]; then
  ACTIVE_MISSION_SLUG=$(python3 -c "import json,pathlib; d=json.loads(pathlib.Path('.agent/memory/project/missions/active.json').read_text()); print(d.get('mission') or '')" 2>/dev/null || echo "")
fi
# Effective autonomy for THIS mission, resolved through the ONE dialect
# (execution/autonomy.py). The mission's own record first; the workspace
# default is a RECOMMENDATION only (REQUIREMENTS 6). No ordering of levels
# lives in this file: the hand-copied table that used to sit further down had
# already diverged from sync_autonomy.py's. Inlined as `python3 -c` rather
# than a heredoc because bash 3.2 mis-parses a here-document inside $( ).
_BOOT_LEVEL="unknown"
_BOOT_AUTONOMY_DECIDED="no"
if [ -f execution/autonomy.py ]; then
  _BOOT_AUTONOMY=$(python3 -c '
import json, pathlib, sys
sys.path.insert(0, "execution")
import autonomy
def load(rel):
    try:
        return json.loads(pathlib.Path(rel).read_text())
    except Exception:
        return {}
rec = load(".agent/memory/project/missions/active.json").get("autonomy") or {}
has = isinstance(rec, dict) and "level" in rec
raw = rec.get("level") if has else (load(".agent/profile.json").get("autonomy") or {}).get("level")
print(autonomy.normalize(raw) or "unknown", "yes" if (has and rec.get("decided_at")) else "no")
' 2>/dev/null || echo "unknown no")
  _BOOT_LEVEL=${_BOOT_AUTONOMY%% *}
  _BOOT_AUTONOMY_DECIDED=${_BOOT_AUTONOMY##* }
fi

if [ -n "$ACTIVE_MISSION_SLUG" ]; then
  if [ -f execution/mission.py ]; then
    _MSTAT=$(python3 execution/mission.py status "$ACTIVE_MISSION_SLUG" 2>/dev/null)
    if [ -n "$_MSTAT" ]; then
      printf '%s\n' "$_MSTAT" | grep -m1 -E '^Status:' || printf '%s\n' "$_MSTAT" | head -1
    else
      echo "(stale mission pointer — run: python3 execution/mission.py list)"
    fi
    unset _MSTAT
  else
    echo "⛔ HARNESS INCOMPLETE — missing: execution/mission.py"
    echo "   Propagation failed. Run: python3 execution/update_template.py --apply"
  fi
  # F19 (notes-f19.md §4): active.json's "mission" field holds a FULL PATH
  # (".agent/memory/project/missions/<slug>.md"), not a basename — `find
  # -name` matches basenames, so this lookup could never match, MISSION_STATUS
  # was always empty, and every branch below the case's default was
  # unreachable at repo root. Resolve the pointer directly instead of
  # searching for it; a pointer to a file that is not there still correctly
  # falls through to the default (no status to read), which the golden pins.
  MISSION_STATUS=""
  if [ -n "$ACTIVE_MISSION_SLUG" ] && [ -f "$ACTIVE_MISSION_SLUG" ]; then
    MISSION_STATUS=$(grep -m1 '^status:' "$ACTIVE_MISSION_SLUG" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d ' ' || echo "")
  fi

  case "$MISSION_STATUS" in
    in_progress|pending)
      # REQUIREMENTS 6: a mission is NEVER silently resumed. The unconditional
      # resume order is issued only once autonomy is DECIDED for this mission
      # (a decided_at stamp in active.json) at a level above interactive.
      if [ "$_BOOT_AUTONOMY_DECIDED" = "yes" ] && [ "$_BOOT_LEVEL" != "interactive" ]; then
        echo "⚡ PROCEED: Run 'python3 execution/mission.py resume' NOW and continue the chain immediately. Do not wait for confirmation."
      elif [ "$_BOOT_AUTONOMY_DECIDED" = "yes" ]; then
        echo "→ Autonomy DECIDED at 'interactive' — run 'python3 execution/mission.py resume' and ask before each step."
      elif [ "$_BOOT_LEVEL" = "unknown" ]; then
        echo "⏸️  AUTONOMY UNDECIDED and the stored level is unreadable — the mission does not start (REQUIREMENTS 6)."
        echo "   Choose one before any work:"
        echo "   python3 execution/set_autonomy.py --level <interactive|autonomous|loop> --mission"
      else
        echo "⏸️  AUTONOMY UNDECIDED — the mission does not start (REQUIREMENTS 6)."
        echo "   RECOMMEND continuing at '$_BOOT_LEVEL'. Confirm before any work:"
        echo "   python3 execution/set_autonomy.py --level $_BOOT_LEVEL --mission"
      fi
      ;;
    blocked)
      echo "⛔ MISSION BLOCKED: resolve the blocker before proceeding."
      ;;
    close_out)
      echo "⚠️  CLOSE-OUT REQUIRED: dispatch @maintainer — mission awaiting wrap-up. Run: python3 execution/mission.py close-out <mission-file>"
      ;;
    *)
      echo "→ Run /mission resume to continue."
      ;;
  esac
else
  echo "No active mission. Pick a top item from the mission queue (.agent/memory/project/backlog.md) and run /mission new <slug> before starting substantive work. Trivial items may be handled directly per the workflow reminder below."
fi
echo ""

# Inject AUTONOMOUS MODE directive when level=loop
if [ "$_BOOT_LEVEL" = "loop" ]; then
  echo "--- AUTONOMOUS MODE ---"
  echo "AUTONOMOUS MODE ACTIVE — complete active mission, then pick next backlog item"
  echo "and start immediately. Do not stop or wait for user input between missions."
  echo "Loop continues until interrupted (make set-autonomy LEVEL=medium) or backlog empty."
  echo "---"
  echo ""
fi
unset _BOOT_LEVEL _BOOT_AUTONOMY_DECIDED _BOOT_AUTONOMY


COMMS_FILE=".agent/memory/project/comms.md"
COMMS_HASH_FILE=".agent/memory/scratch/.comms_last_hash"
if [ -f "$COMMS_FILE" ]; then
  LATEST_DIRECTIVE=""
  LAST_CODI_LINE=$(grep -n "^## \[CODI" "$COMMS_FILE" 2>/dev/null | tail -1 | cut -d: -f1)
  if [ -n "$LAST_CODI_LINE" ]; then
    LATEST_DIRECTIVE=$(awk -v startline="$LAST_CODI_LINE" 'NR > startline { if (/^## \[/) {exit} count++; if(count>=10){print "[truncated — read full comms.md]"; exit} print }' "$COMMS_FILE" 2>/dev/null)
  fi
  if [ -n "$LATEST_DIRECTIVE" ]; then
    NEW_COMMS_HASH=$(printf '%s' "$LATEST_DIRECTIVE" | shasum -a 256 | awk '{print $1}')
    CACHED_COMMS_HASH=$(cat "$COMMS_HASH_FILE" 2>/dev/null || echo "")
    if [ "$NEW_COMMS_HASH" != "$CACHED_COMMS_HASH" ]; then
      echo "--- LATEST DIRECTIVE (comms.md) ---"
      echo "$LATEST_DIRECTIVE"
      echo "---"
      echo ""
      printf '%s' "$NEW_COMMS_HASH" > "$COMMS_HASH_FILE"
    fi
  fi
fi

# Directive channel (spec directive-channel F1): directives published by the lead
# harness and addressed to THIS project. `list` prints nothing when nothing is
# pending, and the whole block is guarded on the tool's existence -- a downstream
# that has not run `make update-template` yet prints nothing and errors nothing.
# full_boot.sh output is folded into the session context verbatim (and Grok
# discards it entirely), so an unguarded block would degrade boot for every
# project in order to deliver a feature none of them have yet.
if [ -f "execution/directives.py" ]; then
  python3 execution/directives.py list 2>/dev/null || true
fi

# ── IDENTITY (L1: boot on one screen) ───────────────────────────────────────
# The verbose per-section context dump (discovery, workspace, last session,
# project rules, goals, learned, mission queue, reboot, recent work, backlog
# hygiene) is intentionally NOT printed here: CEO Directive v2 L1 puts boot on
# one screen — identity, active mission, latest directive, hard blockers, and
# nothing else. The full context stays on disk under .agent/memory/.
echo "--- IDENTITY ---"
python3 -c "
import json
with open('.agent/profile.json') as f:
    p = json.load(f)
i = p.get('identity', {})
print('Identity: %s | Role: %s | Project: %s' % (
    i.get('agent_name', 'Athanor Agent'),
    i.get('project_role', 'project coordinator'),
    p.get('project_name', '?')))
" 2>/dev/null || echo "Identity: Athanor Agent"
echo ""

# Hard blockers — the one section of the old dump that survives: a real
# blocker is one of the four things boot must always surface.
echo "--- BLOCKERS ---"
BLOCKER_OUTPUT=$(python3 execution/brain.py scan-blockers 2>&1)
if echo "$BLOCKER_OUTPUT" | grep -q "No recurring blockers detected."; then
  echo "No recurring blockers detected."
else
  echo "$BLOCKER_OUTPUT"
  echo "⚠️  Recurring blockers detected! Run /pain-point-monitor for root cause analysis."
fi
echo ""
fi  # ── end INHERITED CONTEXT ────────────────────────────────────────────────

# Machinery status (pulse, alembic, github auth, git remotes, git identity)
# is not printed at boot under L1 (boot on one screen). The guard that repairs
# harness-sibling git identity STILL RUNS — silently — because its repair is a
# side effect, not its output.
if [ -f execution/git_guard.py ]; then
    python3 execution/git_guard.py identity --repair >/dev/null 2>&1 || true
fi

# Loud-not-silent boot detection (GH #1366 P0): downstream commands
# (mission.py resume, contract.py) consult this marker via
# execution/checks/verify_boot_ran.py to warn when a session proceeded
# without boot context ever being injected (e.g. Grok, which discards
# SessionStart stdout).
mkdir -p .agent/memory/scratch 2>/dev/null
date +%s > .agent/memory/scratch/.last_full_boot_ts 2>/dev/null || true

# The banner is the last thing read and it must not overstate what happened. It
# still carries the "BOOT COMPLETE" marker in both shapes — the boot really did
# run to the end — but it never claims "all context loaded" on a boot that
# deliberately withheld some.
if [ -n "${_ID_UNVERIFIED:-}" ]; then
  echo "════ BOOT COMPLETE — INHERITED CONTEXT WITHHELD (workspace identity unverifiable) ════"
else
  echo "════ BOOT COMPLETE — all context loaded ════"
fi
