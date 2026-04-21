# /onboard Skill

This workflow onboards a new project by configuring the agent's identity, user preferences, and project goals.

## Instructions

1.  **Ask the user for the following information:**
    *   `project_name`: A short, descriptive name for the project (e.g., "Athanor CLI Tool").
    *   `agent_name`: The name the agent should use for itself (e.g., "Athanor", "Vex").
    *   `project_role`: The agent's specific role in the project (e.g., "primary maintainer", "lead developer").
    *   `soul_persona`: A description of the agent's persona. What is its name, role, and personality? (e.g., "You are 'Vex', a project coordinator for a CLI tool. You are direct, efficient, and technical.")
    *   `user_context`: A description of the user's role and preferences. (e.g., "The user is 'Alex', a senior software engineer. They prefer concise, technical communication and use zsh.")
    *   `mission`: A high-level mission statement for the project. (e.g., "To build a robust, self-maintaining agentic workspace that accelerates development.")

2.  **Update `.agent/profile.json`:**
    *   Replace the value of the `project_name` key with the user-provided `project_name`.
    *   Update the `identity` object with `agent_name` and `project_role`.

3.  **Update the identity files in `.agent/identity/`:**
    *   Write the `soul_persona` to `soul.md`.
    *   Write the `user_context` to `user.md`.

4.  **Update `AGENTS.md` placeholders using the helper script:**
    *   Run `python3 execution/onboard_fill.py "<agent_name>" "<project_role>"`
    *   This ensures `{{AGENT_NAME}}` and `{{PROJECT_ROLE}}` are correctly replaced in `AGENTS.md` (and consequently `CLAUDE.md`/`GEMINI.md`).

5.  **Update `.agent/memory/project/goals.md`:**
    *   Replace the placeholder mission with the user-provided `mission`.
    *   Remove the "Complete onboarding" goal.

6.  **Mark onboarding as complete in `.agent/profile.json`:**
    *   Set `"onboarding_complete": false` to `"onboarding_complete": true`.

7.  **Confirm to the user that onboarding is complete.**
