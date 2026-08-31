# /onboard Skill

This workflow onboards a new project by configuring the agents identity, user preferences, and project goals.

## Instructions

1.  **Ask the user for the following information:**
    *   `project_name`: A short, descriptive name for the project (e.g., "Athanor CLI Tool").
    *   `agent_name`: The name the agent should use for itself (e.g., "Athanor", "Vex").
    *   `project_role`: The agents specific role in the project (e.g., "primary maintainer", "lead developer").
    *   `soul_persona`: A description of the agents persona. What is its name, role, and personality? (e.g., "You are Vex, a project coordinator for a CLI tool. You are direct, efficient, and technical.")
    *   `user_context`: A description of the users role and preferences. (e.g., "The user is Alex, a senior software engineer. They prefer concise, technical communication and use zsh.")
    *   `mission`: A high-level mission statement for the project. (e.g., "To build a robust, self-maintaining agentic workspace that accelerates development.")

2.  **Update `.agent/profile.json`:**
    *   Replace the value of the `project_name` key with the user-provided `project_name`.
    *   Update the `identity` object with `agent_name` and `project_role`.

3.  **Update the identity files in `.agent/identity/`:**
    *   Write the `soul_persona` to `soul.md`.
    *   Write the `user_context` to `user.md`.

4.  **Update `.agent/memory/project/goals.md`:**
    *   Replace the placeholder mission with the user-provided `mission`.
    *   Remove the "Complete onboarding" goal.

5.  **Update `WORKSPACE` file:**
    *   Write the user-provided `project_name` to the `WORKSPACE` file.

6.  **Mark onboarding as complete in `.agent/profile.json`:**
    *   Set `"onboarding_complete": false` to `"onboarding_complete": true`.

7.  **Confirm to the user that onboarding is complete.**

## Headless / Non-interactive

For CI pipelines, scripted bootstraps, and headless runtimes that cannot respond to prompts, use `execution/onboard_headless.py` directly:

```bash
# Python invocation (all required flags)
python3 execution/onboard_headless.py \
  --project-name "MyProject" \
  --agent-name "MyAgent" \
  --role "primary maintainer" \
  --mission "Build and ship the product."

# With optional path overrides (useful for testing / isolation)
python3 execution/onboard_headless.py \
  --project-name "MyProject" \
  --agent-name "MyAgent" \
  --role "primary maintainer" \
  --mission "Build and ship the product." \
  --profile-path /tmp/test/profile.json \
  --soul-path /tmp/test/soul.md \
  --user-path /tmp/test/user.md \
  --goals-path /tmp/test/goals.md \
  --workspace-path /tmp/test/WORKSPACE

# Makefile target (uses NAME, AGENT, ROLE, MISSION env vars)
make onboard-headless \
  NAME="MyProject" \
  AGENT="MyAgent" \
  ROLE="primary maintainer" \
  MISSION="Build and ship the product."
```

The script is idempotent: running it twice with the same arguments produces byte-identical output files. It never calls `input()` and can be run with `</dev/null`.
