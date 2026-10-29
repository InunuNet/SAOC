# Proof: every assertion fails on origin/main 48d74378

Run with the main tree's tsx against this worktree (identical source apart from the spec files).

    A1 FAIL [recipients] outcome on success: expected "sent", got undefined
    A1 FAIL [recipients] outcome with empty allowlist: expected "no_recipients", got undefined
    A2 FAIL [failure] check threw: Cannot find module '.../lib/contact-delivery.ts'
    A3 FAIL [noundefined] initial emailDelivery: expected {"visitor":null,"admin":null}, got undefined
    A4 FAIL [logs] check threw: Cannot find module '.../lib/contact-delivery.ts'
    A5 FAIL [visitor] check threw: Cannot find module '.../lib/contact-delivery.ts'
    A6 FAIL [wiring] route must call deliverContactEmails

Note: A5's unchanged-behaviour half passes on main by design (regression guard); it fails there only because
the delivery seam is absent.
