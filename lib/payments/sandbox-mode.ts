// lib/payments/sandbox-mode.ts
// Mission nos-security-tiered-access F4 (SEC-06) -- the one source of truth for whether each payment
// adapter talks to its gateway's sandbox. Imports nothing, so lib/ticket-issuance-mode.ts (and the
// client bundles that reach it through the builders) can read it without pulling the adapters in.
// Each adapter reads its own flag, and the issuance stamp reads both, so no hand-flipped switch can
// disagree with adapter state. A flag may only be false once its adapter carries no sandbox
// behaviour; contracts/checks/door-reject-test-tickets/adapter-guard.mjs enforces it.
export const OZOW_SANDBOX_MODE = true;
export const PAYFAST_SANDBOX_MODE = true;
