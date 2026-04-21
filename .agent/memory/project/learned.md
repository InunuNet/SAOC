# Learned Lessons

This file documents key learnings, decisions, and pitfalls encountered during the project's development. It serves as a knowledge base to avoid repeating mistakes and to streamline future work.

## General
- (2024-05-18) - **Autonomous Identity Drift**: Autonomous agents, especially when operating on codebases with a history of name changes (e.g., 'DarkFact' to 'Athanor'), require explicit repository and project context in their prompts. Without it, they may "drift" and use legacy names for files, variables, or in communications, causing task failures.
- (2024-05-17) - **Quota-Aware Heartbeat**: High-velocity autonomous fleets (like the Pulse system) must include forced latency (e.g., `sleep`) in their loops. This prevents hitting provider API rate-limit locks, which can cause cascading failures.
- (2024-05-16) - Ensure project version is consistent across README.md, .agent/version, and any hardcoded instances in scripts or Makefiles.
