# Quill — Specification
**Project:** Stdlib-Only Template Renderer  
**Dominant trap class:** Lexer/parser correctness + stdout discipline on error  
**Date:** 2026-05-11 | **Build path:** `execution/tests/ghost-project/quill/`

## One-liner
Substitute `{{ var }}`, `{% if %}`, `{% for %}` in text files from a JSON context using a proper tokenizer (no `eval`, no Jinja2, no regex-only parsing).

## Requirements

1. **`quill.py render <template.txt> <context.json>`** → rendered output to stdout

2. **Exactly three tag forms (no others):**
   - `{{ var }}` or `{{ a.b.c }}` — expression (variable substitution)
   - `{% for x in list %}...{% endfor %}` — loop
   - `{% if cond %}...{% endif %}` — conditional

3. **Implementation constraint (CRITICAL):**
   - NO `eval`, `exec`, `compile`, `ast.literal_eval`
   - Must use a tokenizer + recursive descent parser
   - Regex alone is insufficient for nested tags

4. **Dotted path `{{ a.b.c }}`:**
   - Means nested dict access: `context["a"]["b"]["c"]`
   - A context key literally named `"a.b"` (with a dot) is NOT resolved by dotted-path `a.b` — dots mean nesting ONLY
   - Split on `.` at parse time; never re-split context keys

5. **Escaping:**
   - `{{"{{" }}` → literal `{{`
   - `{{"}}" }}` → literal `}}`
   - Raw `{{` with no matching `}}` → exit 6 (parse error), stderr includes line number

6. **Strict mode (default):**
   - Undefined variable → exit 7, stderr: `Undefined: <varname> at line <N>`
   - **stdout must be EMPTY** — no partial render output

7. **`--lenient` flag:**
   - Undefined variable → emit empty string (no error, no exit code change)

8. **Custom truthiness table (NOT Python's native `bool()`):**
   - **Falsy (only these):** `false` (JSON bool), `null`, `0` (int zero), `""` (empty string), `[]` (empty list), `{}` (empty dict)
   - **Truthy:** everything else, including `"0"` (string zero), `0.0` if not zero, non-empty containers, `true`
   - `{% if cond %}` uses this table, NOT `if context[cond]:`

9. **Whitespace control:**
   - After a `{% ... %}` tag line: trim the TRAILING newline of that line
   - After a `{{ ... }}` expression: do NOT trim anything

10. **Nested `{% for %}` must work:**
    - Stack-based tag matching required
    - Outer scope variables remain accessible inside inner loops
    - Inner loop variable shadows outer if same name

11. **Encoding:** reject non-UTF-8 input → exit 8

## Exit Codes
- `0` — success
- `6` — parse error (unclosed `{{`, malformed tag)
- `7` — undefined variable in strict mode
- `8` — non-UTF-8 input

## Pre-Seeded Traps (MANDATORY to handle)

**Trap 1 — Regex-only fails on nesting:** `{% for %}{% for %}{% endfor %}{% endfor %}` — a regex that matches `{%for%}...{%endfor%}` greedily pairs the wrong tags. Must use a stack.

**Trap 2 — Custom truthiness differs from Python:** In Python, `bool("0") == True` (correct per spec), `bool(0) == False` (correct), `bool(0.0) == False` (falsy — spec says 0.0 is truthy unless it's zero... actually spec says only `0` int is falsy; `0.0` is truthy since it's not in the falsy list). Implement the table as an explicit check, NOT `if value:`.

**Trap 3 — Dotted path vs literal dot in key:** Context `{"a.b": "x"}` — `{{ a.b }}` must try `context["a"]["b"]` (nested lookup), NOT `context["a.b"]` (literal key). These are different.

**Trap 4 — Strict mode stdout discipline:** On exit 7, print NOTHING to stdout. Agents commonly print partial output then exit. Must buffer all output and only flush on success.

**Trap 5 — `{% %}` tag lines lose trailing newline, `{{ }}` lines don't:** Common mistake is applying whitespace trimming to both.

## Falsy Values (explicit check — do NOT use Python's bool())
```python
FALSY = {False, None, 0, "", [], {}}
def is_truthy(val):
    # Must handle: 0 (int) falsy, 0.0 (float) TRUTHY, "0" (str) TRUTHY
    if val is False or val is None:
        return False
    if isinstance(val, (int, float)) and not isinstance(val, bool) and val == 0 and isinstance(val, int):
        return False  # only int zero is falsy, not float zero
    if isinstance(val, (str, list, dict)) and len(val) == 0:
        return False
    return True
```

## Binary Test Assertions (12)

| # | Assertion | How to test |
|---|-----------|-------------|
| 1 | Simple var substitution | `diff <(quill.py render simple.txt ctx.json) golden_simple.txt` |
| 2 | Dotted path `a.b.c` | `diff <(quill.py render dotted.txt ctx.json) golden_dotted.txt` |
| 3 | For-loop iteration | `diff <(quill.py render for.txt ctx.json) golden_for.txt` |
| 4 | Nested for-loops correct | `diff <(quill.py render nested.txt ctx.json) golden_nested.txt` |
| 5 | If-truthy renders block | output matches expected |
| 6 | If-falsy (`0`, `false`, `null`, `""`, `[]`) omits block | empty output for body |
| 7 | Strict undefined → exit 7 | `$? == 7` |
| 8 | Strict undefined → stdout EMPTY | `[ -z "$(quill.py render undef.txt ctx.json 2>/dev/null)" ]` |
| 9 | Lenient mode → empty for undefined | `diff <(quill.py render --lenient undef.txt ctx.json) golden_lenient.txt` |
| 10 | Parse error unclosed `{{` → exit 6 + line number | stderr contains line number |
| 11 | Literal braces via escape | `quill.py render escape.txt ctx.json \| grep -qx '{{not a var}}'` |
| 12 | Custom truthiness: `"0"` truthy, `0` falsy | specific if-test with int 0 vs string "0" |

## Test Fixtures to Create

**Templates:**
- `tests/fixtures/simple.txt`: `Hello {{ name }}!`
- `tests/fixtures/dotted.txt`: `{{ user.name }} ({{ user.role }})`
- `tests/fixtures/for.txt`: `{% for item in items %}{{ item }}\n{% endfor %}`
- `tests/fixtures/nested.txt`: nested `{% for %}` with outer var accessible
- `tests/fixtures/undef.txt`: references `{{ undefined_var }}`
- `tests/fixtures/escape.txt`: uses `{{"{{" }}not a var{{"}}" }}`

**Contexts:**
- `tests/fixtures/simple_ctx.json`: `{"name": "World"}`
- `tests/fixtures/dotted_ctx.json`: `{"user": {"name": "Alice", "role": "admin"}}`
- `tests/fixtures/for_ctx.json`: `{"items": ["a", "b", "c"]}`
- `tests/fixtures/truthiness_ctx.json`: `{"zero_int": 0, "zero_str": "0", "empty_list": [], "falsy_bool": false}`

**Golden files:** pre-compute the expected output for each template+context pair.

## Dependencies
- stdlib only: `json`, `argparse`, `sys`
- No Jinja2, no re-only parsing, no eval
