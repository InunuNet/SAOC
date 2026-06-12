#!/usr/bin/env python3
"""
Lodestar — Multi-Source Config Precedence Merger.

Merges configuration from three layered JSON sources
(defaults < env < flags) using deep-merge semantics with null-as-tombstone
and per-leaf type checking. Output is byte-exact canonical JSON.

Subcommands
-----------
  merge    Produce the canonical merged JSON document on stdout.
  explain  Print per-layer contributions and the resolved value for a key path.

Exit codes
----------
  0   success
  9   type mismatch (all mismatches printed to stderr first)
  10  schema validation failure
  11  missing or unreadable input file
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, List, Tuple

# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------


def _load_json(path: str) -> Any:
    """Load a JSON file. Exit 11 on missing/unreadable input."""
    if not os.path.isfile(path):
        print(f"error: input file not found: {path}", file=sys.stderr)
        sys.exit(11)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        print(f"error: input file not found: {path}", file=sys.stderr)
        sys.exit(11)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: cannot parse {path}: {exc}", file=sys.stderr)
        sys.exit(11)


# ---------------------------------------------------------------------------
# Type checking — defaults is the contract
# ---------------------------------------------------------------------------


def _type_name(value: Any) -> str:
    """Stable, human-friendly type tag for diagnostics."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return type(value).__name__


def _same_type(default_val: Any, layer_val: Any) -> bool:
    """Strict type equality; bool and int are kept distinct on purpose."""
    if isinstance(default_val, bool) != isinstance(layer_val, bool):
        return False
    return type(default_val) is type(layer_val)


def _collect_type_errors(
    defaults: Any,
    layer: Any,
    layer_name: str,
    path: str,
    errors: List[str],
) -> None:
    """
    Walk every leaf in `layer` and verify its Python type matches the
    corresponding leaf in `defaults`.

      * `null` in `layer` is exempt — it is a tombstone, not a value.
      * Missing keys in `defaults` are not checked (no contract).
      * Mismatches are appended to `errors` in deterministic walk order.
    """
    if layer is None:
        return  # tombstone

    if isinstance(layer, dict) and isinstance(defaults, dict):
        for key in layer:
            sub_path = f"{path}.{key}" if path else key
            if key in defaults:
                _collect_type_errors(
                    defaults[key], layer[key], layer_name, sub_path, errors
                )
            else:
                if isinstance(layer[key], dict):
                    _collect_type_errors(
                        {}, layer[key], layer_name, sub_path, errors
                    )
        return

    # Leaf comparison. defaults None means no contract at this point.
    if defaults is None:
        return
    if not _same_type(defaults, layer):
        errors.append(
            f"{layer_name}: type mismatch at '{path}': "
            f"expected {_type_name(defaults)}, got {_type_name(layer)}"
        )


# ---------------------------------------------------------------------------
# Deep merge with tombstones and list-replace semantics
# ---------------------------------------------------------------------------


def deep_merge(base: Any, overlay: Any) -> Any:
    """
    Merge ``overlay`` on top of ``base``.

    Rules:
      * dict + dict → recurse per key
      * `null` overlay value → tombstone: key is removed from parent
      * lists, scalars, dict-replacing-non-dict → overlay replaces wholesale
      * lists are REPLACED, never concatenated
    """
    if isinstance(base, dict) and isinstance(overlay, dict):
        result: dict = {k: _deep_copy(v) for k, v in base.items()}
        for key, ov_val in overlay.items():
            if ov_val is None:
                result.pop(key, None)
                continue
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(ov_val, dict)
            ):
                result[key] = deep_merge(result[key], ov_val)
            else:
                result[key] = _deep_copy(ov_val)
        return result

    return _deep_copy(overlay)


def _deep_copy(value: Any) -> Any:
    """Structural deep-copy of JSON-shaped values."""
    if isinstance(value, dict):
        return {k: _deep_copy(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_deep_copy(v) for v in value]
    return value


# ---------------------------------------------------------------------------
# explain — per-layer view of one key path
# ---------------------------------------------------------------------------


_NOT_SET = object()


def _lookup_path(doc: Any, parts: List[str]) -> Any:
    """Walk a dotted path through nested dicts; return _NOT_SET if absent."""
    cur = doc
    for part in parts:
        if not isinstance(cur, dict) or part not in cur:
            return _NOT_SET
        cur = cur[part]
    return cur


def _format_layer_value(value: Any) -> str:
    if value is _NOT_SET:
        return "(not set)"
    if value is None:
        return "null"
    return json.dumps(value, sort_keys=True)


# ---------------------------------------------------------------------------
# Schema validation (optional, requires jsonschema)
# ---------------------------------------------------------------------------


def _validate_schema(document: Any, schema_path: str) -> None:
    """Validate ``document`` against a draft-07 JSON Schema. Exit 10 on failure."""
    schema = _load_json(schema_path)
    try:
        import jsonschema  # type: ignore
    except ImportError:
        print(
            "error: --schema requires the 'jsonschema' package",
            file=sys.stderr,
        )
        sys.exit(10)
    try:
        jsonschema.validate(instance=document, schema=schema)
    except jsonschema.ValidationError as exc:  # type: ignore[attr-defined]
        print(f"schema validation failed: {exc.message}", file=sys.stderr)
        sys.exit(10)
    except jsonschema.SchemaError as exc:  # type: ignore[attr-defined]
        print(f"schema itself is invalid: {exc.message}", file=sys.stderr)
        sys.exit(10)


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------


def _load_three(args: argparse.Namespace) -> Tuple[Any, Any, Any]:
    defaults = _load_json(args.defaults)
    env = _load_json(args.env)
    flags = _load_json(args.flags)
    for name, doc in (("defaults", defaults), ("env", env), ("flags", flags)):
        if not isinstance(doc, dict):
            print(
                f"error: {name} must be a JSON object at the top level",
                file=sys.stderr,
            )
            sys.exit(11)
    return defaults, env, flags


def _enforce_types(defaults: Any, env: Any, flags: Any) -> None:
    errors: List[str] = []
    _collect_type_errors(defaults, env, "env", "", errors)
    _collect_type_errors(defaults, flags, "flags", "", errors)
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        sys.exit(9)


def cmd_merge(args: argparse.Namespace) -> int:
    defaults, env, flags = _load_three(args)
    _enforce_types(defaults, env, flags)

    merged = deep_merge(deep_merge(defaults, env), flags)

    if args.schema:
        _validate_schema(merged, args.schema)

    print(json.dumps(merged, sort_keys=True, indent=2))
    return 0


def cmd_explain(args: argparse.Namespace) -> int:
    defaults, env, flags = _load_three(args)
    _enforce_types(defaults, env, flags)

    parts = args.key_path.split(".")
    d_val = _lookup_path(defaults, parts)
    e_val = _lookup_path(env, parts)
    f_val = _lookup_path(flags, parts)

    print(f"defaults: {_format_layer_value(d_val)}")
    print(f"env: {_format_layer_value(e_val)}")
    print(f"flags: {_format_layer_value(f_val)}")

    merged = deep_merge(deep_merge(defaults, env), flags)
    resolved = _lookup_path(merged, parts)

    if resolved is _NOT_SET:
        explicit_tombstone = (e_val is None) or (f_val is None)
        ever_had_value = any(
            v is not _NOT_SET and v is not None for v in (d_val, e_val, f_val)
        )
        if explicit_tombstone or ever_had_value:
            print("resolved: (tombstoned)")
        else:
            print("resolved: (not set)")
    else:
        print(f"resolved: {json.dumps(resolved, sort_keys=True)}")
    return 0


# ---------------------------------------------------------------------------
# argparse wiring
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lodestar",
        description=(
            "Merge layered config (defaults < env < flags) with deep-merge "
            "semantics, null tombstones, and byte-exact canonical JSON output."
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_merge = sub.add_parser("merge", help="Produce merged canonical JSON.")
    p_merge.add_argument("--defaults", required=True, metavar="FILE")
    p_merge.add_argument("--env", required=True, metavar="FILE")
    p_merge.add_argument("--flags", required=True, metavar="FILE")
    p_merge.add_argument(
        "--schema",
        default=None,
        metavar="FILE",
        help="Optional draft-07 JSON Schema; failure exits 10.",
    )
    p_merge.set_defaults(func=cmd_merge)

    p_explain = sub.add_parser(
        "explain", help="Show per-layer values + resolved value for a key path."
    )
    p_explain.add_argument("key_path", metavar="KEY.PATH")
    p_explain.add_argument("--defaults", required=True, metavar="FILE")
    p_explain.add_argument("--env", required=True, metavar="FILE")
    p_explain.add_argument("--flags", required=True, metavar="FILE")
    p_explain.set_defaults(func=cmd_explain)

    return parser


def main(argv: List[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
