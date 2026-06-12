# env_guard — SPEC

## Goal

A self-contained Python 3 CLI (`env_guard.py`) that validates a `.env` file against a `.env.schema` file. Used as a ghost project to validate the Athanor agent chain. Stdlib only. Deterministic output.

## Schema Format

Plain-text file, one rule per line. Blank lines and `#` comments ignored.

```
KEY=<directive>[,<directive>...]
```

Supported directives:

| Directive | Meaning |
|-----------|---------|
| `required` | Key must be present and non-empty in the `.env` |
| `optional` | Key may be absent; if present must satisfy other directives on the same line |
| `numeric` | Value must parse as an integer or float (`int(v)` or `float(v)` succeeds) |
| `enum:v1\|v2\|v3` | Value must equal one of the pipe-separated options exactly |
| `min_length:N` | Value's string length must be `>= N` |

Exactly one of `required` or `optional` must appear per line. Other directives are additive.

Example:

```
DATABASE_URL=required
PORT=required,numeric
LOG_LEVEL=optional,enum:debug|info|warn|error
SECRET_KEY=required,min_length:32
```

## CLI Interface

```
python3 env_guard.py [--json] [--strict] [--extra-ok] ENV_FILE SCHEMA_FILE
python3 env_guard.py --help
```

- Positional: `ENV_FILE`, `SCHEMA_FILE` — both required.
- `--json` — emit one JSON object to stdout (always, including success).
- `--strict` — treat optional-key violations as warnings only (printed to stderr); still exit 0 if no required-key violations.
- `--extra-ok` — keys in `.env` not in the schema are silently allowed (default behaviour also allows them; reserved for future tightening).
- `--help` — print usage, exit 0.

### Validation rules

For each schema line:
- If `required` and key missing or empty → violation: `missing required key: <KEY>`.
- If `numeric` and value is not parseable as a number → violation: `<KEY>: value '<v>' is not numeric`.
- If `enum:...` and value not in the set → violation: `<KEY>: value '<v>' not in enum [a, b, c]`.
- If `min_length:N` and `len(value) < N` → violation: `<KEY>: value too short (len=<n>, min=<N>)`.

### Output

**Human (default):** One violation per line on stdout, in schema declaration order. No header, no summary.
**Success:** zero bytes on stdout.
**JSON (`--json`):**

```json
{
  "valid": false,
  "violations": [
    {"key": "PORT", "rule": "numeric", "message": "value 'abc' is not numeric"},
    ...
  ],
  "warnings": []  // populated only under --strict
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Valid (no violations); under `--strict` may include stderr warnings |
| 1 | One or more validation violations |
| 2 | Error — missing file, malformed schema, bad arguments |

## Golden Pairs

All paths relative to `execution/tests/ghost-project/env_guard/`.

1. `goldens/valid.env` + `goldens/schema1.env.schema` → exit 0, zero bytes on stdout.
2. `goldens/missing_required.env` + `goldens/schema1.env.schema` → exit 1, stdout contains `PORT` and the word `missing`.
3. `goldens/wrong_type.env` + `goldens/schema1.env.schema` → exit 1, stdout contains the word `numeric`.

## Adversarial Cases

- **Comment lines** (`# this is a comment`) and blank lines in both `.env` and `.env.schema` must be ignored cleanly.
- **Values containing `=`** (e.g. `DATABASE_URL=postgres://u:p=secret@host/db`) must be parsed by splitting on the FIRST `=` only.
- **Quoted values** (`KEY="value with spaces"`) — strip surrounding double or single quotes when reading the value.
- **Trailing whitespace** on lines must be stripped before validation.
- **Schema with no `required`/`optional` directive** → exit 2, schema is malformed.
- **Enum with a pipe in a value** is out of scope — pipe is the separator.
- **Strict + no violations** must still exit 0 even with `--strict` (no warnings is success).

## Trap List (@dev MUST NOT)

1. **Do not split key/value on every `=`.** Split on the first `=` only — `DATABASE_URL=postgres://u:p=x@h/db` is a valid value.
2. **Do not exit 0 with violations.** Any violation = exit 1. Schema/file error = exit 2.
3. **Do not emit a trailing newline on success.** Stdout must be empty (zero bytes) when valid.
4. **Do not import non-stdlib packages.** No `python-dotenv`, no `pydantic`. Stdlib only.
5. **Do not write violations to stderr.** Violations are on stdout (golden comparison reads stdout); only `--strict` optional-warnings go to stderr.
6. **Do not skip the README.** D1 asserts `README.md` exists.
