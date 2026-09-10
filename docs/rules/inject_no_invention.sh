#!/usr/bin/env bash
# UserPromptSubmit + SubagentStart hook: inject the no-invention hard rule
# into every turn. Project-owned (docs/ safe zone), not harness-owned.
# See docs/rules/no-invention.md for the full rule.
cat <<'EOF'
⛔ NO INVENTION (production product — hard rule, docs/rules/no-invention.md):
Every element of the SAOC site traces to exactly one of: (1) Lee-Ann's Drive
documents — all copy and which pages exist; (2) the APPROVED design handoff at
design/design_handoff_saoc/ (design_system_README.md, colors_and_type.css,
SKILL.md, ui_kits/, src/, screenshots/) plus branding/SA Orchid Council/ and
branding/National Show 2027/ — every visual decision; (3) Brad's explicit
instruction. If it is not in one of those three, IT DOES NOT EXIST YET: name the
gap and ask. Never design, propose, extend or "improve" the handoff — implement
it. Never write copy in SAOC's institutional voice without a source document;
unsourced pages are visibly flagged as awaiting official SAOC committee copy.
Never assert anything is true until a tool has shown it. Cite these paths in
every @architect/@dev/@designer brief.
EOF
