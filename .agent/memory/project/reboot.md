# Reboot Context
_Generated: 2026-08-31T21:19Z_

## What happened last session
M1 of vendor-gated-registration-flow shipped: replaced backwards public-form-then-approve flow with application -> committee approve -> single-use tokenised link -> gated full form. Rebaselined source of truth after Lee-Ann replaced the vendor doc 2026-08-26 (17 sections, restructured). Chain caught 4 real defects (nav bypass, false approval email, non-atomic single-use race, approve-before-mint dead end); 2 found by Codex, 3 by QA, race found independently by both. Two contract assertions (A17/A18) were green over real defects — weak-assertion class again — since strengthened. Gate 21/21.
