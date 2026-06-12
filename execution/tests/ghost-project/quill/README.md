# Quill — Template Renderer

Stdlib-only template renderer. Tokenizer + recursive-descent parser. No eval, no exec, no Jinja2.

## Usage

```
python3 quill.py render <template.txt> <context.json>
python3 quill.py render --lenient <template.txt> <context.json>
```

## Tag Syntax

| Form | Example | Description |
|------|---------|-------------|
| Expression | `{{ name }}` | Variable substitution |
| Dotted path | `{{ user.role }}` | Nested dict access: `context["user"]["role"]` |
| Conditional | `{% if flag %}...{% endif %}` | Renders block if condition is truthy |
| Loop | `{% for item in items %}...{% endfor %}` | Iterates over a list |
| Escape | `{{"{{" }}` → `{{` | Literal brace output |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `6` | Parse error (unclosed `{{`, malformed tag). Stderr includes line number. |
| `7` | Undefined variable in strict mode (default). Stdout is EMPTY. |
| `8` | Non-UTF-8 input |

## Modes

- **Strict (default):** Undefined variable → exit 7 with empty stdout
- **Lenient (`--lenient`):** Undefined variable → empty string, continues rendering

## Truthiness Table

Custom truthiness — NOT Python's `bool()`:

| Value | Truthy? |
|-------|---------|
| `false` (JSON bool) | Falsy |
| `null` | Falsy |
| `0` (int zero) | Falsy |
| `""` (empty string) | Falsy |
| `[]` (empty list) | Falsy |
| `{}` (empty dict) | Falsy |
| `"0"` (string zero) | **Truthy** |
| `0.0` (float zero) | **Truthy** |
| Any non-empty value | Truthy |

## Whitespace Rules

- `{% ... %}` tag lines: the trailing `\n` is consumed (not emitted)
- `{{ ... }}` expressions: no whitespace trimming

## Nested Loops

Outer scope variables remain accessible inside inner loops. Inner loop variable shadows outer if same name.

```
{% for group in groups %}{{ group.name }}:
{% for member in group.members %}  {{ member }}
{% endfor %}{% endfor %}
```

## Running Tests

```
bash tests/run_tests.sh
# → PASS 12/12
```
