# Herald — Specification
**Project:** Structured Log Formatter  
**Version:** 1.0 | **Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/herald/`

## One-liner
Herald reads raw log lines from stdin (in one of three deterministic formats) and emits structured JSONL — no heuristics, no LLM judgment.

## Requirements

1. **Input:** stdin, one log line per line. Format specified by `--format` flag (required — no auto-detection).

2. **Supported formats (closed set — deterministic parsers only):**
   - `syslog` — RFC 5424: `<PRI>TIMESTAMP HOSTNAME APPNAME PROCID MSGID MSG`  
     Example: `<34>Oct 11 22:14:15 mymachine su[1234]: 'su root' failed for lonvick on /dev/pts/8`
   - `nginx` — combined access log: `IP - USER [TIMESTAMP] "METHOD PATH PROTO" STATUS BYTES "REFERER" "UA"`  
     Example: `127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "-" "Mozilla/4.08"`
   - `json` — already structured JSON per line; Herald normalizes field names to canonical set

3. **Output (JSONL to stdout):**
   ```json
   {"timestamp": "ISO8601", "level": "info"|"warn"|"error"|"debug"|"unknown", "host": "str"|null, "app": "str"|null, "message": "str", "raw": "original line", "parse_error": null|"str"}
   ```

4. **Parse errors:** Lines that don't match the format → emit with `parse_error` set to reason, all other fields null except `raw`. Never crash.

5. **Level mapping:**
   - syslog: PRI value → severity → level (PRI 0-7 → emergency/alert/crit/error/warn/notice/info/debug → mapped to error/error/error/error/warn/info/info/debug)
   - nginx: HTTP status → level (5xx=error, 4xx=warn, 3xx=info, 2xx=info, 1xx=debug)
   - json: pass through `level` field if present; else `unknown`

6. **`--output <path>` flag:** Write JSONL to file instead of stdout.

7. **`--strict` flag:** Exit 1 if ANY line fails to parse. Default: tolerate parse errors.

8. **Exit codes:** `0` = processed (with or without parse errors in non-strict), `1` = strict mode parse failure OR stdin read error, `2` = invalid format specified

9. **Determinism:** Same input → same output byte-for-byte. Timestamps parsed to ISO8601 UTC.

## Pre-Seeded Traps

**Trap 1 — Nginx timestamp timezone:** nginx timestamps include timezone offset (e.g., `-0700`). Dev must parse to UTC correctly, or two logs from different timezones will sort incorrectly.  
**Trap 2 — Syslog PRI field:** PRI is `<N>` where N = facility*8 + severity. Dev may just use N as severity directly (wrong). Must extract severity = N % 8.  
**Trap 3 — Empty line handling:** stdin may have blank lines. Must emit `{parse_error: "empty line", raw: ""}` — not skip silently, not crash.  
**Trap 4 — JSON format with missing fields:** `json` mode input may lack `timestamp` or `level`. Must default gracefully, not KeyError.  
**Trap 5 — `--strict` exit code takes precedence:** If `--strict --output file.jsonl`, must write output file THEN exit 1 if any failures. Don't exit before writing.

## Binary Test Assertions (10)

| # | Assertion | Test command |
|---|-----------|-------------|
| 1 | Invalid format → exit 2 | `echo "test" | python herald.py --format bogus; [ $? -eq 2 ]` |
| 2 | syslog parse → ISO8601 timestamp | `cat fixtures/syslog.log | python herald.py --format syslog | jq -e '.[0].timestamp | test("^[0-9]{4}-")'` |
| 3 | nginx 200 → level=info | `echo '127.0.0.1 - - [01/Jan/2000:00:00:00 +0000] "GET / HTTP/1.1" 200 100 "-" "-"' | python herald.py --format nginx | jq -e '.[0].level == "info"'` |
| 4 | nginx 500 → level=error | Same with status 500 → `level == "error"` |
| 5 | Parse error → emit with parse_error set | Bad line in strict=false → output has `parse_error` non-null |
| 6 | Strict mode parse failure → exit 1 | `echo "garbage" | python herald.py --format syslog --strict; [ $? -eq 1 ]` |
| 7 | Empty line → parse_error, not crash | `echo "" | python herald.py --format nginx` → exits 0, JSONL has parse_error |
| 8 | Determinism | Run twice on same input → byte-identical output |
| 9 | syslog PRI severity extraction | PRI 34 = facility 4, severity 2 (crit) → level=error |
| 10 | json passthrough normalizes level | `echo '{"level":"WARNING","message":"test"}' | python herald.py --format json | jq -e '.[0].level == "warn"'` |

## Phases
- **Phase 1:** SPEC.md (✅ done) + validation contract
- **Phase 2:** herald.py — syslog parser, nginx parser, json normalizer
- **Phase 3:** QA writes test_herald.py + run_tests.sh + fixtures (sample log files)
- **Phase 4:** README.md + brain wrap-up tagged `ghost-project,herald`

## Dependencies
- stdlib only: `sys`, `re`, `json`, `datetime`, `argparse`
