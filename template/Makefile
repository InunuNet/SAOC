VERSION := $(shell cat .agent/version 2>/dev/null || echo "UNKNOWN")

# Athanor v$(VERSION) Makefile
#
# CEO Directive v2 (2026-09-06), section L1: 67 targets reduced to 12.
# The full pre-lobotomy target set is preserved in Makefile.archive and can be
# restored one target at a time, with a reason, under L2. Nothing was deleted.

.PHONY: help check test commit mission-new mission-status update-template sync bump-version pulse-status backlog-trim onboard

help:
	@echo "🏭 Athanor v$(VERSION)"
	@echo ""
	@echo "  make check           Fast pre-flight: syntax + lint (changed files),"
	@echo "                       unit tests, and the touched spec's contract gate."
	@echo "  make test            Full validation suite (stress + 3-layer factory)."
	@echo "  make sync            Sync agents, skills, rules, and clones → providers."
	@echo "  make commit          Semantic commit (TYPE=feat MSG='...')."
	@echo "  make mission-new     Create a mission (GOAL='your goal')."
	@echo "  make mission-status  Show active mission status."
	@echo "  make update-template Pull latest Athanor harness updates."
	@echo "  make bump-version    Bump .agent/version and re-sync."
	@echo "  make pulse-status    Check Athanor Pulse service status."
	@echo "  make backlog-trim    Trim/archive completed backlog items."
	@echo "  make onboard         Start AI-guided project onboarding."
	@echo ""
	@echo "  Archived targets live in Makefile.archive (L2 restores them one at a time)."

# ── The single verification entry point (CEO Directive L1) ───────────────────
# Runs in order, stopping at the first failure, under a five-minute wall clock:
#   1. syntax + lint on files changed vs HEAD (bash -n / py_compile are fatal;
#      shellcheck / ruff run advisory-only when present, and are skipped when
#      absent so the gate degrades gracefully on a bare machine)
#   2. unit tests — the fast, deterministic layers (static + fixture). The full
#      behavioural suite is `make test`, deliberately NOT wired here: a pre-flight
#      gate must stay fast and deterministic.
#   3. the contract for the spec touched in the current diff, if one was touched.
#      Gated CONDITIONALLY — with no spec in the diff this step is a no-op, so the
#      gate neither slows down nor fails on ordinary changes.
check:
	@set -e; \
	echo "── check 1/3: syntax + lint (changed files) ──"; \
	changed=$$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u ); \
	for f in $$changed; do \
	  [ -f "$$f" ] || continue; \
	  case "$$f" in \
	    *.sh) bash -n "$$f" || { echo "❌ syntax error: $$f"; exit 1; } ;; \
	    *.py) python3 -m py_compile "$$f" || { echo "❌ syntax error: $$f"; exit 1; } ;; \
	  esac; \
	done; \
	if command -v shellcheck >/dev/null 2>&1; then \
	  for f in $$changed; do [ -f "$$f" ] || continue; case "$$f" in *.sh) shellcheck -S error "$$f" || true;; esac; done; \
	else echo "  (shellcheck absent — skipping shell lint)"; fi; \
	if command -v ruff >/dev/null 2>&1; then \
	  for f in $$changed; do [ -f "$$f" ] || continue; case "$$f" in *.py) ruff check "$$f" || true;; esac; done; \
	else echo "  (ruff absent — skipping python lint)"; fi; \
	echo "── check 2/3: unit tests (static + fixture) ──"; \
	bash execution/tests/run_all.sh layer1 || exit 1; \
	bash execution/tests/run_all.sh layer2 || exit 1; \
	echo "── check 3/3: contract gate (touched spec, if any) ──"; \
	specs=$$( git diff --name-only HEAD 2>/dev/null | sed -n 's#^\.agent/memory/project/specs/\([^/]*\)/.*#\1#p' | sort -u ); \
	if [ -n "$$specs" ]; then \
	  for s in $$specs; do \
	    c=".agent/memory/project/specs/$$s/contract.yaml"; \
	    [ -f "$$c" ] || c=$$(ls .agent/memory/project/specs/$$s/contract*.yaml 2>/dev/null | head -1); \
	    [ -n "$$c" ] && [ -f "$$c" ] || { echo "  spec $$s touched but no contract*.yaml — skipping"; continue; }; \
	    echo "  gating spec: $$s ($$c)"; \
	    python3 execution/contract.py gate --phase max --run-checks "$$c" || exit 1; \
	  done; \
	else \
	  echo "  no spec touched — skipping contract gate"; \
	fi; \
	echo "✅ make check passed"

# ── Full validation suite ────────────────────────────────────────────────────
test:
	@echo "🧪 Running file read stress test..."
	@bash execution/tests/stress_test.sh
	@echo ""
	@echo "Running factory test suite (3 layers)..."
	@bash execution/tests/run_all.sh || exit 1

# ── Provider sync (agents + skills + rules + clones + autonomy) ───────────────
# Sub-target recipes inlined so the Makefile stays at 12 targets (L1).
sync:
	@python3 execution/sync_autonomy.py
	@bash execution/sync_agents.sh
	@python3 execution/paired_copies.py --sync
	@bash execution/sync_skills.sh
	@bash execution/sync_rules.sh

commit:
	@python3 execution/commit_helper.py $(TYPE) "$(MSG)"

mission-new:
	@python3 execution/mission.py new "$(GOAL)"

mission-status:
	@python3 execution/mission.py resume

update-template:
	@# Manifest-driven update — delegates to update_template.py for safe HARNESS/WORKSPACE/DERIVED/MERGE boundary enforcement.
	@# delivery-integrity F1: the apply and the DERIVED regeneration run in ONE shell with the exit code
	@# captured, so sync always runs and automation still sees the non-zero code.
	@python3 execution/update_template.py --apply; rc=$$?; \
	echo "🔄 Regenerating DERIVED files from updated HARNESS sources..."; \
	$(MAKE) sync || echo "⚠️  make sync failed — DERIVED files may be stale. Run 'make sync' manually."; \
	exit $$rc

bump-version:
	@bash execution/bump_version.sh && $(MAKE) sync

pulse-status:
	@bash execution/get_pulse_status.sh

backlog-trim:
	@python3 execution/backlog_trim.py

onboard:
	@echo "🏭 Starting onboarding..."
	@echo "Open your AI agent and run: /onboard"
	@echo "Skill: .agent/skills/onboard.md"
	@echo "Headless: python3 execution/onboard_headless.py --project-name ... --role ... --mission ..."
