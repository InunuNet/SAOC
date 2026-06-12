# Herald — Structured Log Formatter

Herald reads raw log lines from stdin and emits structured JSONL to stdout. One object per input line, no heuristics, deterministic output.

## Usage

```bash
# Parse syslog
cat /var/log/syslog | python3 herald.py --format syslog

# Parse nginx combined access log
cat /var/log/nginx/access.log | python3 herald.py --format nginx

# Parse JSON logs (normalizes field names and level values)
cat app.log | python3 herald.py --format json

# Write to file instead of stdout
cat app.log | python3 herald.py --format nginx --output out.jsonl

# Strict mode: exit 1 if any line fails to parse (file still written)
cat app.log | python3 herald.py --format syslog --strict --output out.jsonl
```

## Output Format (JSONL)

Each line is a JSON object:

```json
{
  "timestamp": "2000-10-10T20:55:36Z",
  "level": "info",
  "host": "127.0.0.1",
  "app": "nginx",
  "message": "GET /index.html 200 2326",
  "raw": "127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] \"GET /index.html HTTP/1.0\" 200 2326 \"-\" \"Mozilla/4.08\"",
  "parse_error": null
}
```

On parse failure, `parse_error` is set to the reason and all other fields except `raw` are null.

## Format Specs

### `syslog`
RFC 5424 / BSD syslog: `<PRI>TIMESTAMP HOST APP[PID]: MESSAGE`

- PRI field: `facility * 8 + severity` — Herald extracts `severity = PRI % 8`
- Severity → level: 0-2 (emerg/alert/crit) → `error`, 3 → `error`, 4 → `warn`, 5-6 (notice/info) → `info`, 7 → `debug`
- Timestamps: BSD (`Oct 11 22:14:15`) and RFC 5424 full ISO8601 formats supported

### `nginx`
Combined access log format.

- Status → level: 5xx → `error`, 4xx → `warn`, 3xx/2xx → `info`, 1xx → `debug`
- Timezone offsets (e.g., `-0700`) converted to UTC before output

### `json`
One JSON object per line. Herald normalizes:

- `timestamp` / `time` / `ts` / `@timestamp` → ISO8601 UTC
- `level` / `severity` / `lvl`: WARNING/WARN → `warn`, ERROR → `error`, INFO → `info`, DEBUG → `debug`, else → `unknown`
- `message` / `msg` / `text` → message field

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Processed (parse errors tolerated in non-strict mode) |
| 1 | Strict mode had parse errors, OR stdin read error |
| 2 | Invalid `--format` value |

## Running Tests

```bash
cd execution/tests/ghost-project/herald
bash tests/run_tests.sh
# Expected: PASS 10/10
```

## Dependencies

stdlib only: `sys`, `re`, `json`, `datetime`, `argparse`
