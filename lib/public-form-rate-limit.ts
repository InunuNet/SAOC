// Shared limiter constants for the public form routes (contact, vendor apply, event submit).
// Same per-instance in-memory store as the sponsor and newsletter routes, so the same known
// limit applies: each server instance counts on its own and a restart clears it.

export const PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const PUBLIC_FORM_RATE_LIMIT_WINDOW_MS = 3_600_000;
