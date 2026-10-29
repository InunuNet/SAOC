# Upstream issue text for InunuNet/Athanor (to be filed by the team lead)

Not filed by the architect. Per `.claude/rules/athanor.md` both files involved are HARNESS-owned (`execution/` is a HARNESS prefix in `.agent/update-manifest.yaml`), so no fix is specced in this contract. After filing, record the issue number in `.agent/memory/project/backlog.md`.

## Title

contract.py: a `codex_qa` wrapper exit 2 reports only the Codex session header, because the evidence keeps the head of the stream and the reason is printed last; default supervisory timeout is 200 s against the wrapper's 1200 s

## What happened

In a SAOC session, nearly every `codex_qa` assertion run by `contract.py gate` (and `contract.py check`) came back as:

```
ERROR A1 (codex_qa): ERROR
   CODEX_QA_WRAPPER_ERROR: OpenAI Codex v... (research preview)
--------
workdir: ...
model: gpt-6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
session
```

with no verdict and no reason. A smaller number came back as `codex_qa wrapper exceeded 200s supervisory timeout`. Running `execution/codex_qa.sh <prompt>` directly worked until the Codex usage limit was reached.

## Cause (file:line, identical in the Athanor checkout at 0dc80be5 and in SAOC's pinned copy)

1. The reason is dropped by truncation.
   - `execution/codex_qa.sh:37` defines `UNAVAILABLE_SIGNATURES`; `:42-46` (`exit_if_reviewer_unavailable`) prints `codex_qa.sh: reviewer unavailable: <matching line>` to stderr and exits 2.
   - It runs at `:172`, after `codex_qa.sh` has already copied the whole Codex stderr to its own stderr (`cat -- "$errfile" >&2` at `:165`). So the stderr stream is: Codex session header, the echoed prompt, tool transcript, and only then, as the LAST line, the reason.
   - `execution/contract.py` in the Athanor checkout, `_run_wrapper`, line 1042: `error_prefix + (result.stdout + result.stderr).strip()[:EVIDENCE_DISPLAY_MAX]` with `EVIDENCE_DISPLAY_MAX = 2000` (line 84). It keeps the first 2000 characters, which are the Codex header and the start of the echoed prompt. SAOC's older pinned copy keeps the first 500 (`contract.py:408`, `[:500]`), which is the header alone, exactly the output above.
   - A usage limit, a rate limit, a missing binary and a real wrapper usage error therefore all render identically.
2. The default supervisory timeout is shorter than the wrapper's own.
   - `contract.py` (Athanor `:463` and `:1158`; SAOC pinned `:167`, `:174`, `:181`, `:395`) defaults `timeout_seconds` to 200 for `codex_qa`, `browser_deployed_check` and `gws_inbox_check`. `execution/codex_qa.sh` documents and uses 1200 s (`CODEX_QA_TIMEOUT`, default 1200) at high reasoning effort. A contract that does not set `timeout_seconds` is killed at 200 s while a normal review is still thinking. The contract author has to know to set 1300.
3. Secondary, not verified: on `subprocess.TimeoutExpired`, `subprocess.run` kills only the wrapper's bash process, so its `timeout`/`codex` children may keep running and spending quota after the gate has recorded an error. Not reproduced; worth a process-group kill (`start_new_session=True` and `os.killpg`).

## Reproduction (no Codex quota needed)

Put a stub named `codex` first on `PATH` that writes a header and some padding lines to stderr, then `ERROR: You've hit your usage limit. Try again later.` as the last line, and exits 1. Make a one-assertion contract:

```yaml
assertions:
  phase: 4
  checks:
    - id: A1
      description: codex
      type: codex_qa
      target: prompt.md
```

Run `PATH=<stubdir>:$PATH python3 execution/contract.py check <contract> --assertion A1`. Observed on SAOC's pinned copy: the evidence is the first 500 characters (the header), ending mid-word at `session`. `execution/codex_qa.sh prompt.md` run directly with the same stub prints the full stderr and ends with `codex_qa.sh: reviewer unavailable: ERROR: You've hit your usage limit...`.

## Expected

- `CODEX_QA_WRAPPER_ERROR` evidence names the reason. Minimum fix: in `_run_wrapper`, keep the TAIL of the combined output (or head plus tail), e.g. `text[-EVIDENCE_DISPLAY_MAX:]`. Alternative or additional fix in `codex_qa.sh`: for exit 2 also print the one-line reason to stdout, so the first line of the evidence is the cause.
- The supervisory default for `codex_qa` is at least the wrapper's own default plus a margin (for example `CODEX_QA_TIMEOUT + 100`), or is read from the same constant, so an unset `timeout_seconds` cannot be shorter than the wrapper it supervises.
- On supervisory timeout the whole process group is terminated.
