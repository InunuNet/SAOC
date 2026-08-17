#!/usr/bin/env python3
"""
no_update_styles.py — shared .agent/no-update pattern-style fixture
definitions (template-update-actually-updates F7).

verify_no_update_provenance_matrix.py (contract-f2) and
verify_no_baseline_data_loss.py (contract-f3) each used to declare their
own copy of the 5 realistic .agent/no-update pattern spellings. Two
independent copies can silently drift apart -- a future edit to one
script's pattern-style coverage would leave the other's incomplete
without either check being able to detect it from inside itself (M6,
named in verify_no_baseline_data_loss.py.golden's mutation table).
Extracted here as the single source of truth both scripts import.

STYLES maps a human-readable style name to a function of a target
filename -> the .agent/no-update pattern string for that style. The
function form (not a bare string) is needed because the "exact-file"
style's pattern depends on which file it is meant to protect --
".agent/skills/<fname>" -- while the other four styles ignore the
argument and always return the same directory-level pattern.
"""

STYLES = {
    "trailing-slash":     lambda fname: ".agent/skills/",
    "trailing-wildcard":  lambda fname: ".agent/skills/*",
    "bare-dir-no-slash":  lambda fname: ".agent/skills",
    "double-star":        lambda fname: ".agent/skills/**",
    "exact-file":         lambda fname: f".agent/skills/{fname}",
}
