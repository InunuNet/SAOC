# heartbeat-wrap

Wrap heavy, silent build/test steps in `execution/heartbeat_wrap.sh` so Claude
Code's subagent stream-watchdog never reaps the agent mid-build.

## Why this matters (GH #1297)
Claude Code's own subagent stream-watchdog — upstream, not part of this
repo's code — reaps a subagent after roughly **600s of no token-stream
progress**. It false-positives on commands that are alive but **silent**:
Rust release builds, `xcodebuild`, large `npm`/`cargo` builds, long test
suites, etc. The build is still running fine; the watchdog just can't tell
the difference between "silent and alive" and "hung." `execution/heartbeat_wrap.sh`
backgrounds a periodic heartbeat line on stdout during any silence so the
token stream never actually goes dark, keeping the watchdog satisfied while
the real command's stdout, stderr, and exit code pass through untouched.

## When to use
- `@dev` / `@qa` (or any agent) invoking a build or test step that can run
  silently for minutes: Rust release builds, `xcodebuild`, large
  `cargo build`/`npm run build`, long-running test suites, etc.
- Any command where you're not sure it will produce output often enough to
  keep the stream alive.

## Usage
```bash
execution/heartbeat_wrap.sh cargo build --release
execution/heartbeat_wrap.sh xcodebuild -scheme MyApp build
```

Configure the heartbeat cadence (seconds) via `HEARTBEAT_INTERVAL` (default
`30`):
```bash
HEARTBEAT_INTERVAL=45 execution/heartbeat_wrap.sh npm run build
```

## What it does
- Backgrounds a loop that emits a `[heartbeat] still running (...)` line to
  stdout every `HEARTBEAT_INTERVAL` seconds while the wrapped command stays
  silent.
- Runs the real command in the foreground via `"$@"` (never `"$*"`), so
  quoted arguments with spaces, quotes, or shell-special characters pass
  through exactly as given.
- Passes the wrapped command's own stdout and stderr through unmodified, on
  their correct streams.
- Exits with the wrapped command's real exit code.
- Tears down the heartbeat loop cleanly on exit (including signals) — no
  orphaned heartbeat/`sleep` process is left running afterward.

## Not for
- Commands that already produce frequent output on their own — the
  heartbeat is only useful when a command can go silent for a while.
- Changing or interpreting the wrapped command's output — this is a pure
  passthrough wrapper.
