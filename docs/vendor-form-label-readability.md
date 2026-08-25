# F1: Site-Wide Label Readability (font-mono 11px Uppercase Removal)

**Feature:** F1 of mission `vendor-form-label-readability` (milestone M1). Removes the `uppercase` utility class from the `font-mono text-[11px] uppercase tracking-[0.16em]` pattern used across 40 locations in 30 files site-wide. Reported as a vendor form readability issue, but the investigation revealed the pattern was not vendor-scoped — it was copy-pasted across marketing pages, admin tools, and ticket checkout. Per backlog.md's own constraint ("a fix must not silently diverge the vendor form's typography from the rest of the site"), the fix was applied uniformly to all 40 occurrences.

**Contract:** `.agent/memory/project/specs/vendor-form-label-readability/contract-f1.yaml` and `contracts/golden/vendor-form-label-readability-f1/README.md` — full decision record and check scripts.

**Status:** Gated (all 5 assertions pass). QA-passed. Codex cross-model-passed (found and fixed 2 real bugs in the contract checks themselves).

---

## The Complaint: Readability at Small Size

**What was wrong:** Form labels (vendor registration, ticket purchase, contact form, media kit, etc.) used a combination of small size (`text-[11px]`), monospace font (`font-mono`), uppercase transformation (`uppercase`), and wide letter spacing (`tracking-[0.16em]`) — the CSS class `font-mono text-[11px] uppercase tracking-[0.16em]`. While contrast passed WCAG (5.24:1), the combination of **small size + uppercase + wide letter spacing** made the text harder to scan and read than necessary. No colour issue; no contrast issue — purely the visual weight and density of the glyph pattern.

**Why it matters:** Label readability affects both accessibility and UX. Small monospace text is already harder to parse than regular-weight sans-serif; uppercase + wide tracking makes it worse. This is a cumulative perceptual effect, not a hard accessibility failure, but it matters for users with visual processing challenges and for general usability.

---

## Scope Investigation: Not Just Vendor

The backlog title flagged this as a vendor form issue, and the form's four fieldset components (VendorContactFieldset, VendorCategoryFieldset, VendorBoothFieldset, VendorMarketingFieldset) did use this pattern. But a grep across the codebase revealed the exact class string `font-mono text-[11px] uppercase tracking-[0.16em]` appeared **40 times across 30 files** — nowhere near vendor-scoped. The pattern was used site-wide:

- Admin pages (app/admin/settings/page.tsx, app/admin/login/LoginFormFields.tsx, etc.)
- Marketing pages (contact form, media kit, judging, constitution, privacy, terms, refunds, national show)
- Ticket purchase components (CartAttendeeFields, TicketPurchaseForm, DayQuantityPicker, etc.)
- Vendor registration forms (only 4 of the 40 occurrences)
- Admin tools (TicketsTable, DoorScannerClient, VendorReviewTable)

backlog.md itself stated: *"a fix must not silently diverge the vendor form's typography from the rest of the site."* This constraint resolved the scope ambiguity: treating the vendor form specially would contradict the backlog's own language. Orchestrator decision (2026-08-25): fix all 40 locations uniformly.

---

## The Fix: Surgical Removal

Remove exactly one utility class, `uppercase`, from each of the 40 occurrences. Keep every other token in the class string unchanged:

```diff
- font-mono text-[11px] uppercase tracking-[0.16em]
+ font-mono text-[11px] tracking-[0.16em]
```

No label text strings needed editing — all were already sentence case in source (e.g. `label="Vendor / business name"`, not `label="VENDOR / BUSINESS NAME"`). The `uppercase` utility was a pure CSS transform. Removing it restores readable sentence case automatically.

No colour/contrast class was touched. No other utility was altered. All label text strings remained identical to their pre-fix source.

---

## The Verification Gates (and the Bugs They Caught)

The contract defines 5 assertions to verify the fix was complete and surgical. The development phase completed all 40 changes. The QA phase verified the changes worked. But Codex GPT-5.5 cross-model review — run *after* @qa — discovered two real bugs in the contract checks themselves, not in the production code:

### Bug 1: The A3 Assertion Was Not Exercising the Real Property

**Original check (broken):**
```bash
# Grepped for a colour token on both - and + lines
grep -n "text-muted\|text-ivory\|text-accent" <(git diff)
# Matched ANY line touching font-mono text-[11px], even if other tokens changed
```

**Problem:** When a line is changed from:
```
-  className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted"
+  className="font-mono text-[11px] tracking-[0.16em] text-muted"
```

The substring `text-muted` appears on both the removed (`-`) and added (`+`) line. A grep for this token will match regardless of whether it actually changed. The assertion could never fail on a correct implementation because the colour token is PRESENT in both versions. This is a weak-assertion pattern: **grepping for an unchanged token that appears on both sides of a diff line is not a test; it is a tautology.**

**Real property to check:** The ONLY difference between the removed and added line is the `"uppercase "` token. All other tokens — colour classes, tracking value, font-mono, everything — must be byte-identical between the two lines.

**Replacement check:**
```bash
# contracts/checks/vendor-form-label-readability-f1/check-uppercase-only-diff.sh
# Pairwise diff comparison: for each pair of - and + lines,
# strip "uppercase " from the old line and assert the result equals the new line exactly
```

This script parses the git diff, pairs each removed line with its corresponding added line (using FIFO positional matching, verified sound against non-alternating diff hunks like SocietiesClient.tsx's ternary operator), strips the literal `"uppercase "` token from the removed line, and asserts byte-equality with the added line. If ANY other token changed — a colour class, the tracking value, a space or punctuation — the assertion fails immediately.

### Bug 2: The Contract Checks Were Unscoped, Exposing Hidden State

**Original checks (A1/A2 grep):**
```bash
grep -rl 'font-mono text-\[11px\] uppercase tracking-\[0.16em\]' --include='*.tsx' --include='*.ts' . | grep -v '/node_modules/'
```

**Problem:** This grep searches the ENTIRE working tree, including:
1. `.agent/golden/**` — frozen historical snapshots from earlier missions (which deliberately kept the old string for reference). **Staging mission documentation files in the same tree now caused A1 to fail** because the frozen golden still contained the old string, and grep found it.
2. `.claude/worktrees/` — a gitignored directory with 6 stale copies of agent worktrees from past sessions, containing the OLD pre-fix code. **When @qa ran the contract checks through a real (non-aliased) `/usr/bin/grep` subprocess**, this directory wasn't masked by the interactive shell's `ugrep` alias wrapper, and the stale worktrees could make the assertion fail even though the actual source was correct.

These are real bugs with real failure modes:

- **The staging issue:** Once the mission's own contract/golden markdown files were staged, they got picked up by grep since they document the string in prose. A1 would report "40 locations still have the old string" even though they were only present in the documentation.
- **The gitignored-directory leak:** The `.claude/worktrees/` directory is gitignored (not committed), so it doesn't show in `git status` or regular file listings. But grep walks it because gitignore is a VCS concept, not a filesystem concept. Interactive shells have `alias grep='ugrep -r --skip-vcs'` (skip VCS directories), which hides this. But subprocesses spawned from within contract checks (not via the shell alias) use plain `/usr/bin/grep`, which traverses gitignored directories. This created an environment-dependent assertion: **passes in the interactive session, fails when the gate runner actually executes it.**

**Fixes applied:**

1. **Path-scope the diff script to the 30 target files only:**
   ```bash
   # Instead of searching the whole tree, pass the 30 target files explicitly
   git diff -- app/ components/ sanity/ lib/ <...30 files...> | check-uppercase-only-diff.sh
   ```
   This ensures staging contract/golden files doesn't interfere.

2. **Add explicit `.claude/worktrees/` exclusion to A1/A2:**
   ```bash
   grep -rl 'font-mono text-\[11px\] uppercase tracking-\[0.16em\]' --include='*.tsx' --include='*.ts' . \
     | grep -v '/node_modules/' \
     | grep -v '\.agent/golden/' \
     | grep -v 'contracts/golden/' \
     | grep -v '\.claude/worktrees/'
   ```
   Explicit exclusions catch both `grep -rl` and plain `grep`, independent of shell aliases.

3. **Verify with plain `/usr/bin/grep` in test runs:**
   The contract was re-verified using `/usr/bin/grep` in a non-interactive subprocess (matching the gate runner's environment), not just the aliased shell version.

---

## Reusable Lessons

### Lesson 1: Weak Assertions — Unchanged Token on Both Sides

**Pattern:** Grepping a diff for a token that appears unchanged on both the `-` and `+` line.

```bash
# WEAK — always matches, never fails on correct implementation
grep "text-muted" <(git diff)  # matches any line where text-muted exists, removed or not

# CORRECT — proves ONLY the specified token changed
# Option A: Pairwise diff comparison (like check-uppercase-only-diff.sh)
# Option B: Assert token on - line but not on + line, or vice versa
grep "^-.*uppercase" <(git diff) && ! grep "^+.*uppercase" <(git diff)
```

The weak pattern is tempting because it often passes on correct implementations (by coincidence, the unchanged token does appear). But it doesn't actually verify the property. When in doubt, ask: **"Does this assertion pass trivially on every correct implementation, or does it actually exercise the real constraint?"** If the answer is "it passes anyway," the check isn't adding value.

### Lesson 2: Environment-Dependent Assertions — Shell Aliases vs. Subprocess Grep

**Pattern:** Assertions that pass in the interactive shell but fail when run through the gate automation.

**Root cause:** The shell has `alias grep='ugrep -r --skip-vcs'` (or similar VCS-aware aliasing), which hides gitignored directories. But subprocesses spawned from within scripts (using plain `/usr/bin/grep`) don't inherit aliases. Gitignored directories (like `.claude/worktrees/` or `.git/`) traverse freely in the subprocess.

**Fix:**
1. Use absolute paths to `/usr/bin/grep` if the script needs to match the gate runner's environment.
2. Explicitly exclude VCS and gitignored directories with `grep -v`.
3. **Never rely on shell aliases for contract assertions.** Always use explicit flags or absolute paths.

Example:
```bash
# WEAK — depends on shell alias
grep -r "pattern" . | head

# CORRECT — explicit exclusions, works in any environment
/usr/bin/grep -r "pattern" . --exclude-dir=.git --exclude-dir=node_modules | head
```

---

## Verification

All 5 contract assertions passed after the bugs were fixed:

- **A1:** Zero remaining occurrences of the old string in live source, excluding frozen golden and worktrees directories ✓
- **A2:** Exactly 40 occurrences of the new string (without `uppercase`) in the same scope ✓
- **A3:** Pairwise diff check — the ONLY change in each of the 40 lines is removal of the `uppercase ` token ✓
- **A4:** Behavioral (Playwright headless browser) — three public pages load correctly; labels no longer have textTransform: uppercase; font-mono and tracking-[0.16em] are preserved ✓
- **A5:** Durable evidence — three screenshots exist and are non-empty ✓

---

## Scope & Non-Changes

- **Production changes:** Removed `uppercase` utility class from 40 locations across 30 files. All other tokens, colours, layout, and functionality unchanged.
- **No text string changes.** All label strings remain as authored in source.
- **No other utility class removal.** `font-mono`, `text-[11px]`, `tracking-[0.16em]`, all colour classes, all other utilities preserved exactly.
- **Deliberately out of scope:** Occurrences of the same treatment with a different tracking value (`tracking-[0.14em]`, `tracking-[0.18em]`, etc.) — these are a separate visual treatment and remain untouched.
- **Golden snapshots not edited:** `.agent/golden/**` and `contracts/golden/**` remain frozen historical records.

---

## Related Features

- **Vendor Form Field Components:** `components/vendors/VendorFormField.tsx` (one of the 40 changed locations, now more readable).
- **Similar UX Fixes:** `docs/vendor-form-client-validation-gate.md`, `docs/vendor-form-maxlength-and-phone-pattern.md` — other improvements to form clarity and validation.
- **Typography System:** All colour/contrast classes in the Tailwind v4 theme remain unchanged. This fix affects only the weight and density of the glyph pattern.

---

## Deployment Notes

This is a backlog-closing readability improvement, not a new feature. The production changes are purely CSS utility removal — no HTML structure changes, no JavaScript, no component API changes. Once committed, future changes to form or label styling will run the contract checks and fail if the `uppercase` class accidentally reappears or if the pairwise diff logic is weakened. The explicit worktree and golden-directory exclusions ensure the contract remains stable even as the workspace accumulates old worktree artifacts.
