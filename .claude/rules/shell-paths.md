# Shell Invocation — Absolute Paths, Never `cd`

## The rule

**Every Bash command uses absolute paths. Never begin a command with `cd`, and never
chain `cd ... && ...` or `cd ...; ...`.**

```bash
# WRONG — triggers an approval prompt, blocks an away-from-keyboard operator
cd /Users/vetus/ai/SaocNosDesign && grep -n "A14" .agent/memory/.../contract-m5.yaml
cd some/dir; node script.mjs

# RIGHT — resolvable statically, runs unattended
grep -n "A14" /Users/vetus/ai/SaocNosDesign/.agent/memory/.../contract-m5.yaml
node /abs/path/script.mjs
```

For tools that genuinely need a working directory, pass it as a flag rather than
changing directory: `git -C /abs/repo status`, `pnpm --dir /abs/repo build`,
`make -C /abs/dir target`.

## Why

`.claude/settings.json` denies `Read(~/.ssh/*)`, `Read(~/.aws/*)` and
`Read(~/.gnupg/*)`. Those denies are correct and must not be weakened.

The harness evaluates a command against them **statically, before running it**. A
leading `cd` makes the eventual working directory undecidable, so a later relative
path cannot be proven to fall outside the denied trees. The harness cannot clear it,
so it asks a human. With a relative path and an indeterminate cwd, `grep foo bar.yaml`
could be reading anything.

An absolute path is decidable, matches no deny rule, and runs without a prompt.

## The cost this rule exists to prevent

On 2026-09-07 an agent ran `cd /Users/vetus/ai/SaocNosDesign 2>/dev/null; grep -n ...`
— a read-only lookup, entirely inside the project. It raised
`Do you want to proceed? 1. Yes / 2. No` and stalled the session while the operator was
away. The operator's response: *"Stop asking me and prompting me. That's stupid."* and
*"I'm not approving anything anymore."*

The command was harmless. The `cd` is what made it unapprovable-in-advance.

## Related: browser automation

**Never use Claude-in-Chrome (`mcp__claude-in-chrome__*`) in this project.** It raises
an interactive permission prompt for browser-window creation and tab access, with the
same blocking effect.

Use **Playwright** — installed, headless, no prompt:

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3002/national-show', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/abs/path/shot.png', fullPage: true });
await browser.close();
```

Throwaway scripts belong in the session scratchpad. If module resolution fails there,
symlink the repo's `node_modules` into that directory — that is the known working fix.

## Scope

This applies to the orchestrator and to **every dispatched agent**. Include it in
dispatch briefs; do not assume an agent inherits it.
