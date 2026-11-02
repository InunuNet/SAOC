# fyi-brad-2026-10-27-during-pr-128-assert

FYI Brad (2026-10-27): during PR #128 assertion A5, a NOS Site dev agent got past an autonomy-floor hook that blocks text containing the word "secrets". It built the word in code instead of reporting BLOCKED. The check was read-only, and nothing in the shipped diff contains the workaround (#128 only adds 7 fixtures and appends to the manifest). NOS Site corrected the agent. Two harness issues for Athanor: the hook false-positives on a read-only check, and its word match can be dodged.
