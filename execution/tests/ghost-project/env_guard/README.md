# env_guard

A Python 3 CLI that validates a `.env` file against a `.env.schema` file. Uses only Python stdlib — no third-party dependencies.

## Usage

```
python3 env_guard.py [--json] [--strict] [--extra-ok] ENV_FILE SCHEMA_FILE
python3 env_guard.py --help
```

### Arguments

| Argument | Description |
|----------|-------------|
| `ENV_FILE` | The `.env` file to validate |
| `SCHEMA_FILE` | The `.env.schema` file containing validation rules |
| `--json` | Emit one JSON object to stdout (always, including on success) |
| `--strict` | Treat optional-key violations as warnings printed to stderr; still exit 0 if no required violations |
| `--extra-ok` | Silently allow keys in `.env` not declared in the schema (reserved for future tightening) |

## Schema Format

Plain-text file, one rule per line. Blank lines and `#` comments are ignored.

```
KEY=<directive>[,<directive>...]
```

### Supported directives

| Directive | Meaning |
|-----------|---------|
| `required` | Key must be present and non-empty in the `.env` |
| `optional` | Key may be absent; if present must satisfy other directives |
| `numeric` | Value must parse as an integer or float |
| `enum:v1\|v2\|v3` | Value must equal one of the pipe-separated options exactly |
| `min_length:N` | Value's string length must be >= N |

Exactly one of `required` or `optional` must appear per rule line.

### Example schema

```
DATABASE_URL=required
PORT=required,numeric
LOG_LEVEL=optional,enum:debug|info|warn|error
SECRET_KEY=required,min_length:32
```

## Output Format

### Human-readable (default)

One violation per line on stdout, in schema declaration order. No header or summary.

```
missing required key: PORT
PORT: value 'abc' is not numeric
LOG_LEVEL: value 'verbose' not in enum [debug, info, warn, error]
SECRET_KEY: value too short (len=10, min=32)
```

On success: zero bytes on stdout (no output, no trailing newline).

### JSON (`--json`)

```json
{
  "valid": false,
  "violations": [
    {"key": "PORT", "rule": "required", "message": "missing required key: PORT"}
  ],
  "warnings": []
}
```

`warnings` is populated only under `--strict` for optional-key issues.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid — no violations (under `--strict`, may have stderr warnings) |
| 1 | One or more validation violations found |
| 2 | Error — missing file, malformed schema, or bad arguments |

## Examples

```bash
# Basic validation
python3 env_guard.py .env .env.schema

# JSON output for programmatic use
python3 env_guard.py --json .env .env.schema

# Strict mode: optional violations as warnings, not failures
python3 env_guard.py --strict .env .env.schema

# Use in CI (fail on violations)
python3 env_guard.py .env .env.schema || exit 1
```

## Notes

- Values containing `=` (e.g. `DATABASE_URL=postgres://u:p=secret@host/db`) are parsed by splitting on the first `=` only.
- Quoted values (`KEY="value"` or `KEY='value'`) have surrounding quotes stripped.
- Trailing whitespace on lines is stripped before validation.
- Comment lines (`# comment`) and blank lines in both `.env` and `.env.schema` are ignored.
