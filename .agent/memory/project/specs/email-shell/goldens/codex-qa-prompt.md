# Codex adversarial review: email-shell

Review the full diff (emails/, emails/_shared/EmailShell.tsx, public/images/email/, lib/ unchanged
expected, scripts/email-shell-test-send.ts) against .agent/memory/project/specs/email-shell/goldens/design-ruling.md.
Hunt for (family D included, per design-ruling.md; no hand-made SAOC lockup): any visible wording change (compare against goldens/copy-baseline/*.txt), a template
bypassing EmailShell, a band with bgcolor but no inline background-color or vice versa, text baked
into an image or a non-logo alt, family D chrome invented, a hard-coded colour outside the ruling's
palette, `display:flex/grid` or other client-unsafe CSS in the shell, test-send script able to mail
anyone but brad@inunu.net, secrets logged. Verdict PASS/FAIL with file:line findings.
