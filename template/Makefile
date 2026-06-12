VERSION := $(shell cat .agent/version 2>/dev/null || echo "UNKNOWN")

# Athanor v$(VERSION) Makefile

.PHONY: help sync sync-agents sync-skills sync-rules sync-autonomy migrate-rules brain-export brain-import brain-stats commit audit verify-agents test test-init update-template onboard onboard-headless check-feedback self-update install-pulse ingest-pulse test-stress test-handoff contract-check test-static test-fixture test-behavioral factory-loop improve improve-loop retro capture-pain backlog-audit

help:
	@echo "🏭 Athanor v$(VERSION)"
	@echo ""
	@echo "  Project Setup"
	@echo "  make onboard           Start AI-guided project onboarding"
	@echo "  make onboard-headless  Headless onboarding (NAME= AGENT= ROLE= MISSION=)"
	@echo ""
	@echo "  Agents + Skills"
	@echo "  make sync              Sync agents, skills, and rules → Claude + Gemini"
	@echo "  make sync-agents       Sync canonical agents → Claude + Gemini"
	@echo "  make sync-skills       Sync canonical skills → Claude + Gemini"
	@echo "  make sync-rules        Sync canonical rules → Claude + Gemini"
	@echo "  make verify-agents     Verify all 8 Claude Code agents are dispatchable"
	@echo ""
	@echo "  make repo-slug           Get current GitHub repo (owner/name)"
	@echo ""
	@echo "  Memory / Brain"
	@echo "  make brain-export      Export brain memories to JSON"
	@echo "  make brain-import      Import brain memories (FILE=path.json)"
	@echo "  make brain-stats       Show brain statistics"
	@echo "  make retro             Retro scan — surface pain points (DAYS=60)"
	@echo "  make capture-pain      Log a pain point (WHAT='...' FIX='...')"
	@echo ""
	@echo "  Workflow"
	@echo "  make commit            Semantic commit (TYPE=feat MSG='...')"
	@echo "  make audit             Run workspace health check"
	@echo "  make backlog-audit     Check for stale open backlog items"
	@echo "  make test              Run validation suite (currently a basic stress test)"
	@echo "  make test-stress       Run the basic file read stress test"
	@echo "  make improve           Run one autonomous improvement cycle (ghost tests → triage → gate → push)"
	@echo "  make improve-loop      Run continuous improvement loop (max 10 iterations or until converged)"
	@echo "  make factory-loop      Alias for improve-loop (continuous, max 10 iterations)"
	@echo ""
	@echo "  Template"
	@echo "  make update-template   Pull latest Athanor harness updates (command name retained for back-compat)"
	@echo "  make check-feedback    Check GitHub for new issues + PRs"
	@echo "  make ingest-pulse      Process and archive inbox items to backlog.md"
	@echo "  make pulse-register    Install and load the Athanor Pulse launchd agent"
	@echo "  make pulse-status      Check Athanor Pulse service status"
	@echo "  make pulse-start       Manually start the Pulse service"
	@echo "  make pulse-stop        Manually stop the Pulse service"
	@echo "  make pulse-logs        Tail the Pulse service logs"


sync: sync-autonomy sync-agents
	@bash execution/sync_skills.sh
	@bash execution/sync_rules.sh

sync-agents:
	@bash execution/sync_agents.sh

sync-autonomy:
	@LEVEL=$$(jq -r '.autonomy.level // "medium"' .agent/profile.json 2>/dev/null || echo "medium"); \
	echo "🔓 Autonomy level: $$LEVEL"; \
	echo "   Claude: check_autonomy.sh active (PreToolUse hook)"; \
	echo "   Gemini: manual autonomy.toml — generated block sync coming in v2"; \
	echo "✅ sync-autonomy complete"

sync-skills:
	@bash execution/sync_skills.sh

sync-rules:
	@bash execution/sync_rules.sh

repo-slug:
	@bash execution/get_repo_info.sh

migrate-rules:
	@echo "Migrating rules to canonical .agent/rules/ structure..."
	@mkdir -p .agent/rules/_core .agent/rules/claude .agent/rules/gemini
	@[ -f .claude/rules/scope.md ]    && cp .claude/rules/scope.md    .agent/rules/_core/scope.md    || true
	@[ -f .claude/rules/security.md ] && cp .claude/rules/security.md .agent/rules/_core/security.md || true
	@[ -f .claude/rules/hooks.md ]    && cp .claude/rules/hooks.md    .agent/rules/claude/hooks.md   || true
	@[ -f .claude/rules/memory.md ]   && cp .claude/rules/memory.md   .agent/rules/claude/memory.md  || true
	@echo "✅ Rules migrated. Now run: make sync-rules"

test-init:
	@echo "🧪 Running init.sh smoke test..."
	@TMPDIR=$$(mktemp -d); \
	FAIL=0; \
	cd "$$TMPDIR" && bash "$(CURDIR)/init.sh" --name=smoketest 2>&1; \
	echo ""; \
	echo "Checking artifacts:"; \
	[ -f WORKSPACE ]                  && echo "  ✅ WORKSPACE"             || { echo "  ❌ WORKSPACE missing";          FAIL=1; }; \
	[ -f .agent/profile.json ]        && echo "  ✅ profile.json"          || { echo "  ❌ profile.json missing";        FAIL=1; }; \
	[ -f .claude/settings.json ]      && echo "  ✅ .claude/settings.json" || { echo "  ❌ hooks missing";               FAIL=1; }; \
	[ -f AGENTS.md ]                  && echo "  ✅ AGENTS.md"             || { echo "  ❌ AGENTS.md missing";           FAIL=1; }; \
	[ -f execution/onboard_fill.py ]  && echo "  ✅ onboard_fill.py"       || { echo "  ❌ onboard_fill.py missing";     FAIL=1; }; \
	[ -f CLAUDE.md ]                  && echo "  ✅ CLAUDE.md symlink"     || { echo "  ❌ CLAUDE.md missing";           FAIL=1; }; \
	ls .claude/skills/*.md >/dev/null 2>&1 && echo "  ✅ skills present"   || { echo "  ❌ .claude/skills empty";        FAIL=1; }; \
	ls .claude/agents/*.md >/dev/null 2>&1 && echo "  ✅ agents present"   || { echo "  ❌ .claude/agents empty";        FAIL=1; }; \
	python3 -c "import json; p=json.load(open('.agent/profile.json')); \
		assert 'features' in p, 'features key missing'; \
		assert p.get('onboarding_complete')==False, 'onboarding_complete should be False'; \
		assert p.get('project_name')=='smoketest', 'project_name wrong'; \
		print('  ✅ profile.json schema correct')" 2>&1 || { echo "  ❌ profile.json schema wrong"; FAIL=1; }; \
	grep -q "Vex\|Athanor coordinator" AGENTS.md 2>/dev/null && { echo "  ❌ AGENTS.md poisoned with Athanor identity"; FAIL=1; } || echo "  ✅ AGENTS.md clean"; \
	rm -rf "$$TMPDIR"; \
	echo ""; \
	if [ "$$FAIL" -eq 0 ]; then echo "✅ Smoke test passed."; else echo "❌ Smoke test FAILED."; exit 1; fi

ingest-pulse:
	@bash execution/ingest_pulse.sh "$$(jq -r '.project_name' .agent/profile.json)"

pulse-status:
	@bash execution/get_pulse_status.sh

brain-export:
	@python3 execution/brain.py export

brain-import:
	@python3 execution/brain.py import $(FILE)

brain-stats:
	@python3 execution/brain.py stats

retro:
	@python3 execution/retro.py --days $(or $(DAYS),60) --top $(or $(TOP),8) $(if $(BRAIN),--brain,)

capture-pain:
	@python3 execution/capture_pain.py --what "$(WHAT)" --fix "$(FIX)" $(if $(MISSION),--mission $(MISSION),) $(if $(AGENT),--agent $(AGENT),)

commit:
	@python3 execution/commit_helper.py $(TYPE) "$(MSG)"

verify-agents:
	@bash execution/verify_agents.sh

audit:
	@echo "Running audit..."
	@python3 -c "import json; json.load(open('.claude/settings.json')); print('✅ .claude/settings.json')"
	@python3 -c "import json; json.load(open('.gemini/settings.json')); print('✅ .gemini/settings.json')"
	@test -L CLAUDE.md && echo "✅ CLAUDE.md symlink" || echo "❌ CLAUDE.md"
	@test -L GEMINI.md && echo "✅ GEMINI.md symlink" || echo "❌ GEMINI.md"
	@python3 execution/brain.py stats
	@bash execution/verify_agents.sh
	@python3 execution/audit_gates.py

backlog-audit:
	@bash execution/backlog_audit.sh

test: test-stress
	@echo ""
	@echo "Running factory test suite (3 layers)..."
	@bash execution/tests/run_all.sh || exit 1

test-stress:
	@echo "🧪 Running file read stress test..."
	@bash execution/tests/stress_test.sh

test-handoff:
	@echo "🧪 Testing structured handoff parsing..."
	@python3 execution/tests/test_handoff.py
	@echo "✅ Handoff tests passed."

## Test Suite (Factory Architecture)
test-static: ## Run Layer 1 static invariant tests
	bash execution/tests/run_all.sh layer1

test-fixture: ## Run Layer 2 fixture replay tests
	bash execution/tests/run_all.sh layer2

test-behavioral: ## Run Layer 3 behavioral end-to-end tests
	bash execution/tests/run_all.sh layer3

factory-loop: ## Run continuous improvement loop (max 10 iterations) — redirects to improve-loop
	bash execution/improvement_loop.sh --max-iters 10

improve: ## Run one autonomous improvement cycle (ghost tests → triage → gate → push)
	bash execution/improvement_loop.sh --once

improve-loop: ## Run continuous improvement loop (max 10 iterations or until converged)
	bash execution/improvement_loop.sh --max-iters 10

mission-status: ## Show active mission status
	python3 execution/mission.py resume

mission-list: ## List all missions
	python3 execution/mission.py list

mission-new: ## Create a new mission (GOAL="your goal")
	python3 execution/mission.py new "$(GOAL)"

contract-check:
	@if [ -z "$(SPEC)" ]; then echo "Usage: make contract-check SPEC=path/to/spec.md"; exit 1; fi
	@CONTRACT=$$(echo "$(SPEC)" | sed 's/\.md$$/-contract.yaml/'); \
	python3 execution/contract.py validate "$$CONTRACT" && \
	python3 execution/contract.py report "$$CONTRACT"

update-template:
	@python3 execution/update_template.py --apply
	@echo "🔄 Regenerating DERIVED files from updated HARNESS sources..."
	@$(MAKE) sync || echo "⚠️  make sync failed — DERIVED files may be stale. Run 'make sync' manually."

self-update:
	@echo "⬇️  Fetching latest update_template.py from Athanor..."
	@bash -o pipefail -c 'gh api repos/InunuNet/Athanor/contents/execution/update_template.py --jq ".content" | base64 -d > execution/update_template.py'
	@echo "✅ Updater refreshed. Running full update..."
	@FORCE_UPDATE=true python3 execution/update_template.py --apply
	@$(MAKE) sync || echo "⚠️  make sync failed — run 'make sync' manually."



onboard:
	@echo "🏭 Starting onboarding..."
	@echo "Open your AI agent and run: /onboard"
	@echo "Or use the workflow at: .agent/workflows/onboard.md"

onboard-headless:
	@python3 execution/onboard_headless.py \
	  --project-name "$(NAME)" \
	  --agent-name "$(AGENT)" \
	  --role "$(ROLE)" \
	  --mission "$(MISSION)"

check-feedback:
	@echo "📬 Athanor GitHub Feedback"
	@echo ""
	@gh issue list --repo InunuNet/Athanor --state open --limit 10 2>/dev/null || \
		echo "⚠️  gh CLI not found or not authenticated. Run: brew install gh && gh auth login"
	@echo ""
	@echo "💬 Discussions:"
	@echo "   https://github.com/InunuNet/Athanor/discussions"

# Pulse
pulse-register: install-pulse

install-pulse:
	@echo "Installing Athanor Pulse launchd agent..."
	@mkdir -p ~/Library/LaunchAgents
	@sed "s|{{PROJECT_ROOT}}|$(CURDIR)|g" "$(CURDIR)/execution/com.athanor.pulse.plist" > ~/Library/LaunchAgents/com.athanor.pulse.plist
	@launchctl unload -F ~/Library/LaunchAgents/com.athanor.pulse.plist 2>/dev/null || true
	@launchctl load -w ~/Library/LaunchAgents/com.athanor.pulse.plist
	@echo "✅ Athanor Pulse launchd agent installed and loaded. It will run every 5 minutes."
	@echo "To unload: launchctl unload ~/Library/LaunchAgents/com.athanor.pulse.plist"
	@echo "To remove: rm ~/Library/LaunchAgents/com.athanor.pulse.plist"

pulse-start:
	@launchctl start com.athanor.pulse
	@echo "✅ Pulse service started."

pulse-stop:
	@launchctl stop com.athanor.pulse
	@echo "✅ Pulse service stopped."

pulse-logs:
	@tail -n 50 -f ~/Library/Logs/Athanor/pulse.log
