#!/usr/bin/env bash
# discovery.sh — Gathers and displays project capabilities

echo "--- DISCOVERY & CAPABILITIES ---"

# 1. Agents
AGENT_COUNT=$(ls .agent/agents/*.md 2>/dev/null | wc -l | xargs)
if [ "$AGENT_COUNT" -eq 0 ]; then
  # Fallback to provider dirs
  AGENT_COUNT=$(ls .gemini/agents/*.md 2>/dev/null | wc -l | xargs)
fi
echo "👥 Agents: $AGENT_COUNT available"

# 2. Skills
SKILL_COUNT=$(ls .agent/skills/*.md 2>/dev/null | wc -l | xargs)
echo "🛠️  Skills: $SKILL_COUNT loaded"

# 3. Environment/Tools
echo -n "💻 Tools: "
TOOLS=("gh" "python3" "make" "git" "curl")
AVAILABLE_TOOLS=()
for tool in "${TOOLS[@]}"; do
  if command -v "$tool" &>/dev/null; then
    AVAILABLE_TOOLS+=("$tool")
  fi
done
echo "${AVAILABLE_TOOLS[*]}"

# 4. Memory/Brain
BRAIN_ENTRIES=$(python3 execution/brain.py stats 2>/dev/null | grep "Memories:" | awk '{print $2}' || echo "0")
echo "🧠 Memory: $BRAIN_ENTRIES semantic entries"
echo ""
