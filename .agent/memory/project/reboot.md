# Reboot Context
_Generated: 2026-08-15T01:54Z_

## What happened last session
admin-auth-hardening F3 (account provisioning) closed M1 with a real adversarial find: admin-grant.ts unconditionally set admin:true+emailVerified:true on pre-existing accounts, enabling account pre-hijacking while self-signup stays open. Fixed via a --existing gate; contract/goldens amended (spec was the defect, not @dev's build). M1 now fully gated (F1/F2 12/12, F3 11/11); M2 (federated sign-in) still pending.
