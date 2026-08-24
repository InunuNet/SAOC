# Reboot Context
_Generated: 2026-08-24T09:45Z_

## What happened last session
ozow-sandbox-toggle: Add an admin-gated Ozow sandbox test-mode toggle: when on, only the amount sent to Ozow for that transaction is overridden to R0.01 (ticket prices, cart, display, and PayFast remain completely untouched); a visible TEST MODE banner shows on checkout when active. Purpose: let Brad demo the real Ozow flow to the council without editing live Sanity ticket prices by hand again (the R0.01 workaround used in the ozow-payment-provider F4 investigation was a manual, risky, revert-dependent process — this replaces it with a safe, reversible, admin-controlled flag). Off by default. Must be impossible for a real (non-flagged) customer to pay R0.01 for a real-priced ticket.
