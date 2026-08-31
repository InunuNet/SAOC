# Reboot Context
_Generated: 2026-08-31T22:33Z_

## What happened last session
M2 F13 shipped: vendor category list corrected to the 26 Aug source doc (14 items, no Other). Codex caught a hole a green 28/28 gate missed — F13 removed vendorCategoryOther's validation but left its write, so a direct POST could persist an unbounded unvalidated string. Fixed by dropping the write. Sweep found waterRequired had NEVER been validated in repo history; fixed. Key outcome: A42 now asserts the general invariant (every persisted field must be validated), turning a manual sweep into a permanent gate check. Four green-over-defect incidents this mission (A17/A18/A25/A26 blind spot); two caught only by Codex, not the gate.
