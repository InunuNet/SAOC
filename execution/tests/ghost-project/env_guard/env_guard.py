#!/usr/bin/env python3
"""env_guard.py — validate a .env file against a .env.schema file."""

import argparse
import json
import sys


def parse_env(path):
    """Parse a .env file into a dict mapping key -> value.

    - Splits on the FIRST '=' only.
    - Strips surrounding single or double quotes from values.
    - Ignores blank lines and lines starting with '#'.
    - Strips trailing whitespace from each line.
    Raises SystemExit(2) on file errors.
    """
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"error: file not found: {path}", file=sys.stderr)
        sys.exit(2)
    except OSError as e:
        print(f"error reading {path}: {e}", file=sys.stderr)
        sys.exit(2)

    result = {}
    for line in lines:
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        # Strip surrounding quotes
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        result[key] = value
    return result


def parse_schema(path):
    """Parse a .env.schema file into a list of rule dicts.

    Each rule dict has:
      - key: str
      - required: bool (True if 'required', False if 'optional')
      - numeric: bool
      - enum: list[str] or None
      - min_length: int or None

    Raises SystemExit(2) on file errors or malformed schema.
    """
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"error: file not found: {path}", file=sys.stderr)
        sys.exit(2)
    except OSError as e:
        print(f"error reading {path}: {e}", file=sys.stderr)
        sys.exit(2)

    rules = []
    for lineno, line in enumerate(lines, 1):
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            print(
                f"error: malformed schema line {lineno}: missing '=': {line!r}",
                file=sys.stderr,
            )
            sys.exit(2)
        key, _, directives_str = line.partition("=")
        key = key.strip()
        directives = [d.strip() for d in directives_str.split(",")]

        # Must have exactly one of required/optional
        has_required = "required" in directives
        has_optional = "optional" in directives
        if not has_required and not has_optional:
            print(
                f"error: schema line {lineno}: key '{key}' has neither 'required' nor 'optional'",
                file=sys.stderr,
            )
            sys.exit(2)

        rule = {
            "key": key,
            "required": has_required,
            "numeric": False,
            "enum": None,
            "min_length": None,
        }

        for d in directives:
            if d in ("required", "optional"):
                continue
            elif d == "numeric":
                rule["numeric"] = True
            elif d.startswith("enum:"):
                enum_values = d[5:].split("|")
                rule["enum"] = enum_values
            elif d.startswith("min_length:"):
                try:
                    rule["min_length"] = int(d[11:])
                except ValueError:
                    print(
                        f"error: schema line {lineno}: invalid min_length value in '{d}'",
                        file=sys.stderr,
                    )
                    sys.exit(2)
            else:
                print(
                    f"error: schema line {lineno}: unknown directive '{d}'",
                    file=sys.stderr,
                )
                sys.exit(2)

        rules.append(rule)
    return rules


def validate(env, rules, strict=False):
    """Validate env dict against rules list.

    Returns (violations, warnings) where each item is a dict:
      {"key": str, "rule": str, "message": str}

    Under --strict, optional-key violations become warnings instead of violations.
    """
    violations = []
    warnings = []

    for rule in rules:
        key = rule["key"]
        required = rule["required"]
        value = env.get(key)
        present = value is not None and value != ""

        issues = []

        if not present:
            if required:
                issues.append({"key": key, "rule": "required", "message": f"missing required key: {key}"})
            # optional missing — no violation
        else:
            # Run type/constraint checks
            if rule["numeric"]:
                try:
                    int(value)
                except ValueError:
                    try:
                        float(value)
                    except ValueError:
                        issues.append(
                            {
                                "key": key,
                                "rule": "numeric",
                                "message": f"{key}: value '{value}' is not numeric",
                            }
                        )

            if rule["enum"] is not None:
                if value not in rule["enum"]:
                    enum_list = ", ".join(rule["enum"])
                    issues.append(
                        {
                            "key": key,
                            "rule": "enum",
                            "message": f"{key}: value '{value}' not in enum [{enum_list}]",
                        }
                    )

            if rule["min_length"] is not None:
                if len(value) < rule["min_length"]:
                    issues.append(
                        {
                            "key": key,
                            "rule": "min_length",
                            "message": (
                                f"{key}: value too short "
                                f"(len={len(value)}, min={rule['min_length']})"
                            ),
                        }
                    )

        # Under --strict, optional-key issues become warnings
        if strict and not required:
            warnings.extend(issues)
        else:
            violations.extend(issues)

    return violations, warnings


def main():
    parser = argparse.ArgumentParser(
        description="Validate a .env file against a .env.schema file."
    )
    parser.add_argument("env_file", metavar="ENV_FILE", help=".env file to validate")
    parser.add_argument(
        "schema_file", metavar="SCHEMA_FILE", help=".env.schema file with rules"
    )
    parser.add_argument(
        "--json", action="store_true", dest="emit_json", help="Emit JSON output"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat optional-key violations as warnings (stderr); still exit 0 if no required violations",
    )
    parser.add_argument(
        "--extra-ok",
        action="store_true",
        help="Silently allow keys in .env not in the schema (reserved for future use)",
    )
    args = parser.parse_args()

    env = parse_env(args.env_file)
    rules = parse_schema(args.schema_file)
    violations, warnings = validate(env, rules, strict=args.strict)

    if args.emit_json:
        result = {
            "valid": len(violations) == 0,
            "violations": violations,
            "warnings": warnings,
        }
        print(json.dumps(result))
    else:
        # Human-readable: violations to stdout
        for v in violations:
            print(v["message"])
        # Warnings to stderr under --strict
        for w in warnings:
            print(w["message"], file=sys.stderr)

    if violations:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
