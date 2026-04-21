VERSION := $(shell cat .agent/version 2>/dev/null || echo "UNKNOWN")

# Athanor v$(VERSION) Makefile

.PHONY: help sync sync-agents sync-skills sync-rules migrate-rules brain-export brain-import brain-stats commit audit test test-init update-template onboard check-feedback self-update install-pulse ingest-pulse

help:
	@echo "🏭 Athanor v$(VERSION)"
	@echo ""
	@echo "  Project Setup"
	@echo "  make onboard           Start AI-guided project onboarding"
	@echo ""
	@echo "  Agents + Skills"
	@echo "  make sync              Sync agents, skills, and rules → Claude + Gemini"
	@echo "  make sync-agents       Sync canonical agents → Claude + Gemini"
	@echo "  make sync-skills       Sync canonical skills → Claude + Gemini"
	@echo "  make sync-rules        Sync canonical rules → Claude + Gemini"
	@echo ""
	@echo "  make repo-slug           Get current GitHub repo (owner/name)"
	@echo ""
	@echo "  Memory / Brain"
	@echo "  make brain-export      Export brain memories to JSON"
	@echo "  make brain-import      Import brain memories (FILE=path.json)"
	@echo "  make brain-stats       Show brain statistics"
	@echo ""
	@echo "  Workflow"
	@echo "  make commit            Semantic commit (TYPE=feat MSG='...')"
	@echo "  make audit             Run workspace health check"
	@echo "  make test              Run validation suite"
	@echo ""
	@echo "  Template"
	@echo "  make update-template   Pull latest Athanor template updates"
	@echo "  make check-feedback    Check GitHub for new issues + PRs"
	@echo "  make ingest-pulse      Process and archive inbox items to backlog.md"
	@echo "  make install-pulse     Install and load the Athanor Pulse launchd agent

sync:
	@bash execution/sync_agents.sh
	@bash execution/sync_skills.sh
	@bash execution/sync_rules.sh

sync-agents:
	@bash execution/sync_agents.sh

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
	cd "$$TMPDIR" && bash $(CURDIR)/init.sh --name=smoketest 2>&1; \
	echo ""; \
	echo "Checking artifacts:"; \
	[ -f WORKSPACE ]                  && echo "  ✅ WORKSPACE"           || echo "  ❌ WORKSPACE missing"; \
	[ -f .agent/profile.json ]        && echo "  ✅ profile.json"        || echo "  ❌ profile.json missing"; \
	[ -f .claude/settings.json ]      && echo "  ✅ .claude/settings.json" || echo "  ❌ hooks missing"; \
	[ -f AGENTS.md ]                  && echo "  ✅ AGENTS.md"           || echo "  ❌ AGENTS.md missing"; \
	[ -f execution/onboard_fill.py ]  && echo "  ✅ onboard_fill.py"      || echo "  ❌ onboard_fill.py missing"; \
	[ -f CLAUDE.md ]                  && echo "  ✅ CLAUDE.md symlink"   || echo "  ❌ CLAUDE.md missing"; \
	ls .claude/skills/*.md >/dev/null 2>&1 && echo "  ✅ skills present"  || echo "  ❌ .claude/skills empty"; \
	ls .claude/agents/*.md >/dev/null 2>&1 && echo "  ✅ agents present"  || echo "  ❌ .claude/agents empty"; \
	python3 -c "import json; p=json.load(open('.agent/profile.json')); \
		assert 'features' in p, 'features key missing'; \
		assert p.get('onboarding_complete')==False, 'onboarding_complete should be False'; \
		assert p.get('project_name')=='smoketest', 'project_name wrong'; \
		print('  ✅ profile.json schema correct')" 2>&1 || echo "  ❌ profile.json schema wrong"; \
	grep -q "Vex\|Athanor coordinator" AGENTS.md 2>/dev/null && echo "  ❌ AGENTS.md poisoned with Athanor identity" || echo "  ✅ AGENTS.md clean"; \
	rm -rf "$$TMPDIR"; \
	echo ""; \
	echo "✅ Smoke test complete."

ingest-pulse:
	@bash execution/ingest_pulse.sh

pulse-status:
	@bash execution/get_pulse_status.sh

brain-export:
	@python3 execution/brain.py export

brain-import:
	@python3 execution/brain.py import $(FILE)

brain-stats:
	@python3 execution/brain.py stats

commit:
	@python3 execution/commit_helper.py $(TYPE) "$(MSG)"

audit:
	@echo "Running audit..."
	@python3 -c "import json; json.load(open('.claude/settings.json')); print('✅ .claude/settings.json')"
	@python3 -c "import json; json.load(open('.gemini/settings.json')); print('✅ .gemini/settings.json')"
	@test -L CLAUDE.md && echo "✅ CLAUDE.md symlink" || echo "❌ CLAUDE.md"
	@test -L GEMINI.md && echo "✅ GEMINI.md symlink" || echo "❌ GEMINI.md"
	@python3 execution/brain.py stats

test:
	@bash execution/sync_agents.sh
	@python3 execution/brain.py last-session --quiet
	@echo "✅ All tests passed"

update-template:
	@# GUARD: downstream projects only — never run inside the Athanor template repo itself
	@if [ "$$FORCE_UPDATE" != "true" ] && ([ -f ".agent/profile.json" ] && python3 -c "import json,sys; p=json.load(open('.agent/profile.json')); sys.exit(0 if p.get('project_name')=='Athanor' else 1)" 2>/dev/null); then \
		echo "❌ ABORT: You are inside the Athanor template repo."; \
		echo "   This command is for downstream projects only."; \
		exit 1; \
	fi
	@$(eval TARGET_DIR := $(or $(TARGET),.))
	@echo "🔄 Initialising update checkpoint..."
	python3 -c "import json, datetime; s={'workflow':'update-template','status':'started','started':datetime.datetime.now(datetime.UTC).isoformat()}; open('.agent/memory/scratch/checkpoint_update_start.json','w').write(json.dumps(s))"

	@echo "🔄 Downloading Athanor template from GitHub..."
	@TMPDIR=$$(mktemp -d); \
	if [ -z "$$GITHUB_TOKEN" ]; then \
		gh auth status 2>/dev/null || { echo "❌ GitHub authentication required. Run 'gh auth login' or set GITHUB_TOKEN environment variable."; rm -rf "$$TMPDIR"; exit 1; }; \
	fi; \
	gh api repos/InunuNet/Athanor/tarball/main > "$$TMPDIR/athanor.tar.gz" 2>/dev/null || \
		{ echo "❌ Download failed. Check GITHUB_TOKEN, gh auth, and network."; rm -rf "$$TMPDIR"; exit 1; }; \
	mkdir -p "$$TMPDIR/src"; \
	tar -xz --strip-components=1 -C "$$TMPDIR/src" -f "$$TMPDIR/athanor.tar.gz"; \
	echo ""; \
	echo "📋 Infrastructure changes:"; \
	for f in .agent/workflows .agent/agents .agent/rules .agent/skills .agent/reference .agent/pulse/registry execution/hooks .claude/settings.json .claude/skills .gemini/skills .gemini/policies AGENTS.md; do \
		if [ -e "$$TMPDIR/src/$$f" ]; then \
			if [ ! -e "$(TARGET_DIR)/$$f" ]; then \
				echo "  • [NEW] $$f"; \
			else \
				diff -rq "$$TMPDIR/src/$$f" "$(TARGET_DIR)/$$f" 2>/dev/null | sed 's/^/  • /' || true; \
			fi; \
		elif [ -e "$(TARGET_DIR)/$$f" ]; then \
			echo "  • [DELETED] $$f"; \
		fi; \
	done; \
	echo ""; \
	echo "⚡ Applying infrastructure updates..."; \
	mkdir -p "$(TARGET_DIR)/.agent" "$(TARGET_DIR)/.agent/workflows" "$(TARGET_DIR)/.agent/agents" "$(TARGET_DIR)/.agent/rules" "$(TARGET_DIR)/.agent/skills" "$(TARGET_DIR)/.agent/reference" "$(TARGET_DIR)/.agent/pulse/registry" "$(TARGET_DIR)/execution" "$(TARGET_DIR)/execution/hooks" "$(TARGET_DIR)/.claude" "$(TARGET_DIR)/.claude/skills" "$(TARGET_DIR)/.gemini" "$(TARGET_DIR)/.gemini/skills" "$(TARGET_DIR)/.gemini/policies"; \
	if [ -d "$$TMPDIR/src/.agent/workflows/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/workflows/"  "$(TARGET_DIR)/.agent/workflows/"; fi; \
	if [ -d "$$TMPDIR/src/.agent/agents/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/agents/"     "$(TARGET_DIR)/.agent/agents/"; fi; \
	if [ -d "$$TMPDIR/src/.agent/rules/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/rules/"      "$(TARGET_DIR)/.agent/rules/"; fi; \
	if [ -d "$$TMPDIR/src/.agent/skills/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/skills/"     "$(TARGET_DIR)/.agent/skills/"; fi; \
	if [ -d "$$TMPDIR/src/.agent/reference/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/reference/"  "$(TARGET_DIR)/.agent/reference/"; fi; \
	if [ -d "$$TMPDIR/src/.agent/pulse/registry/" ]; then rsync -a --delete "$$TMPDIR/src/.agent/pulse/registry/" "$(TARGET_DIR)/.agent/pulse/registry/"; fi; \
	if [ -d "$$TMPDIR/src/execution/hooks/" ]; then rsync -a --delete "$$TMPDIR/src/execution/hooks/"   "$(TARGET_DIR)/execution/hooks/"; fi; \
	if [ -d "$$TMPDIR/src/.claude/skills/" ]; then rsync -a --delete "$$TMPDIR/src/.claude/skills/"    "$(TARGET_DIR)/.claude/skills/"; fi; \
	if [ -d "$$TMPDIR/src/.gemini/skills/" ]; then rsync -a --delete "$$TMPDIR/src/.gemini/skills/"    "$(TARGET_DIR)/.gemini/skills/"; fi; \
	if [ -d "$$TMPDIR/src/.gemini/policies/" ]; then rsync -a --delete "$$TMPDIR/src/.gemini/policies/"  "$(TARGET_DIR)/.gemini/policies/"; fi; \
	if [ -f "$$TMPDIR/src/.claude/settings.json" ]; then cp "$$TMPDIR/src/.claude/settings.json" "$(TARGET_DIR)/.claude/settings.json"; fi; \
	if [ -f "$$TMPDIR/src/.gemini/settings.json" ]; then cp "$$TMPDIR/src/.gemini/settings.json" "$(TARGET_DIR)/.gemini/settings.json"; fi; \
	if [ -f "$(TARGET_DIR)/AGENTS.md" ]; then \
		ID_LINE=$$(grep "^\*\*You are " "$(TARGET_DIR)/AGENTS.md" | head -n 1); \
		if [ -f "$$TMPDIR/src/AGENTS.md" ]; then \
			cp "$$TMPDIR/src/AGENTS.md" "$(TARGET_DIR)/AGENTS.md"; \
			if [ -n "$$ID_LINE" ]; then \
				sed -i.bak "s|^\*\*You are .*$$|$$ID_LINE|" "$(TARGET_DIR)/AGENTS.md" && rm "$(TARGET_DIR)/AGENTS.md.bak" || \
				sed -i "" "s|^\*\*You are .*$$|$$ID_LINE|" "$(TARGET_DIR)/AGENTS.md" 2>/dev/null || true; \
			fi; \
		fi; \
	elif [ -f "$$TMPDIR/src/AGENTS.md" ]; then \
		cp "$$TMPDIR/src/AGENTS.md" "$(TARGET_DIR)/AGENTS.md"; \
	fi; \
	if [ -f "$$TMPDIR/src/execution/brain.py" ]; then cp "$$TMPDIR/src/execution/brain.py" "$(TARGET_DIR)/execution/brain.py"; fi; \
	if [ -f "$$TMPDIR/src/execution/sync_agents.sh" ]; then cp "$$TMPDIR/src/execution/sync_agents.sh" "$(TARGET_DIR)/execution/sync_agents.sh"; fi; \
	if [ -f "$$TMPDIR/src/execution/sync_skills.sh" ]; then cp "$$TMPDIR/src/execution/sync_skills.sh" "$(TARGET_DIR)/execution/sync_skills.sh"; fi; \
	if [ -f "$$TMPDIR/src/execution/sync_rules.sh" ]; then cp "$$TMPDIR/src/execution/sync_rules.sh" "$(TARGET_DIR)/execution/sync_rules.sh"; fi; \
	if [ -f "$$TMPDIR/src/execution/onboard_fill.py" ]; then cp "$$TMPDIR/src/execution/onboard_fill.py" "$(TARGET_DIR)/execution/onboard_fill.py"; fi; \
	if [ -f "$$TMPDIR/src/execution/overlay_template.sh" ]; then cp "$$TMPDIR/src/execution/overlay_template.sh" "$(TARGET_DIR)/execution/overlay_template.sh"; fi; \
	if [ -f "$$TMPDIR/src/execution/merge_profile.py" ]; then cp "$$TMPDIR/src/execution/merge_profile.py" "$(TARGET_DIR)/execution/merge_profile.py"; fi; \
	if [ -f "$$TMPDIR/src/.agent/version" ]; then cp "$$TMPDIR/src/.agent/version" "$(TARGET_DIR)/.agent/version"; fi; \
	if [ -f "$$TMPDIR/src/.agent/CHANGELOG.md" ]; then cp "$$TMPDIR/src/.agent/CHANGELOG.md" "$(TARGET_DIR)/.agent/CHANGELOG.md"; fi; \
	rm -rf "$$TMPDIR"
	@echo "🔄 Syncing agents + skills..."
	@bash "$(TARGET_DIR)/execution/sync_agents.sh"
	@bash "$(TARGET_DIR)/execution/sync_skills.sh"
	@bash "$(TARGET_DIR)/execution/sync_rules.sh"
	@NEW_VER=$$(cat "$(TARGET_DIR)/.agent/version" 2>/dev/null || echo "?"); \
	python3 -c "import json, datetime; s={'workflow':'update-template','status':'complete','version':'$$NEW_VER','finished':datetime.datetime.now(datetime.UTC).isoformat()}; open('$(TARGET_DIR)/.agent/memory/scratch/checkpoint_update_complete.json','w').write(json.dumps(s))"; \
	echo ""; \
	echo "✅ Updated to Athanor v$$NEW_VER"; \
	if grep -q '{{[A-Z_]\+}}' "$(TARGET_DIR)/AGENTS.md"; then \
		echo "   ⚠️  AGENTS.md has placeholders. Run /onboard to fill them."; \
	fi; \
	echo "   Review changes: git diff"; \
	echo "   Commit when ready: git add -A && git commit -m 'chore: update to Athanor v$$NEW_VER'"; \
	echo ""; \
	echo "   Note: Makefile was not auto-updated (self-overwrite risk)."; \
	echo "   Check latest: gh api repos/InunuNet/Athanor/contents/Makefile --jq '.content' | base64 -d"

self-update:
	@FORCE_UPDATE=true $(MAKE) update-template TARGET=$(CURDIR)



onboard:
	@echo "🏭 Starting onboarding..."
	@echo "Open your AI agent and run: /onboard"
	@echo "Or use the workflow at: .agent/workflows/onboard.md"

check-feedback:
	@echo "📬 Athanor GitHub Feedback"
	@echo ""
	@gh issue list --repo InunuNet/Athanor --state open --limit 10 2>/dev/null || \
		echo "⚠️  gh CLI not found or not authenticated. Run: brew install gh && gh auth login"
	@echo ""
	@echo "💬 Discussions:"
	@echo "   https://github.com/InunuNet/Athanor/discussions"

# Pulse
install-pulse:
	@echo "Installing Athanor Pulse launchd agent..."
	@mkdir -p ~/Library/LaunchAgents
	@sed "s|{{PROJECT_ROOT}}|$(CURDIR)|g" "$(CURDIR)/execution/com.athanor.pulse.plist" > ~/Library/LaunchAgents/com.athanor.pulse.plist
	@launchctl unload -F ~/Library/LaunchAgents/com.athanor.pulse.plist 2>/dev/null || true
	@launchctl load -w ~/Library/LaunchAgents/com.athanor.pulse.plist
	@echo "✅ Athanor Pulse launchd agent installed and loaded. It will run every 5 minutes."
	@echo "To unload: launchctl unload ~/Library/LaunchAgents/com.athanor.pulse.plist"
	@echo "To remove: rm ~/Library/LaunchAgents/com.athanor.pulse.plist"
