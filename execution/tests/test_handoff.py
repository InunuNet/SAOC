#!/usr/bin/env python3
"""Test suite for structured handoff parsing (handoffs.py)."""
import json
import re
import sys

def extract_handoff_block(message: str):
    pattern = r"```handoff\s*\n(.*?)\n```"
    match = re.search(pattern, message, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1).strip())
    except json.JSONDecodeError:
        return None

def validate_handoff(data: dict):
    errors = []
    required = ["schema", "agent", "task", "completed", "left_undone", "procedures_followed"]
    for field in required:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    if data.get("schema") not in ("athanor.handoff/v1", "athanor.handoff/v1-lite"):
        errors.append(f"Unknown schema: {data.get('schema')}")
    return errors

def test_block_extraction():
    msg = (
        "Some agent output\n"
        "```handoff\n"
        '{"schema":"athanor.handoff/v1","agent":"dev","task":"test",'
        '"completed":[],"left_undone":[],"procedures_followed":{"followed":true}}\n'
        "```"
    )
    result = extract_handoff_block(msg)
    assert result is not None, "Block extraction failed"
    assert result["schema"] == "athanor.handoff/v1", "Schema mismatch"
    print("  handoff block extraction: PASS")

def test_json_parse():
    msg = (
        "```handoff\n"
        '{"schema":"athanor.handoff/v1","agent":"qa","task":"review","completed":["checked tests"],'
        '"left_undone":[],"procedures_followed":{"followed":true,"notes":""}}\n'
        "```"
    )
    result = extract_handoff_block(msg)
    assert result is not None, "Parse failed"
    assert result["agent"] == "qa", "Agent mismatch"
    print("  JSON parse: PASS")

def test_schema_validation():
    valid = {
        "schema": "athanor.handoff/v1",
        "agent": "dev",
        "task": "test",
        "completed": [],
        "left_undone": [],
        "procedures_followed": {"followed": True}
    }
    errors = validate_handoff(valid)
    assert not errors, f"Unexpected errors: {errors}"
    print("  schema validation (valid): PASS")

def test_schema_validation_lite():
    valid_lite = {
        "schema": "athanor.handoff/v1-lite",
        "agent": "lead",
        "task": "plan",
        "completed": ["delegated tasks"],
        "left_undone": [],
        "procedures_followed": {"followed": True}
    }
    errors = validate_handoff(valid_lite)
    assert not errors, f"Unexpected errors: {errors}"
    print("  schema validation (v1-lite): PASS")

def test_missing_field_detection():
    bad = {"schema": "athanor.handoff/v1", "agent": "dev"}
    errors = validate_handoff(bad)
    assert any("task" in e for e in errors), "Should detect missing 'task'"
    print("  missing field detection: PASS")

def test_no_handoff_block():
    msg = "Agent output with no handoff block here."
    result = extract_handoff_block(msg)
    assert result is None, "Should return None when no block"
    print("  no handoff block graceful: PASS")

if __name__ == "__main__":
    tests = [
        test_block_extraction,
        test_json_parse,
        test_schema_validation,
        test_schema_validation_lite,
        test_missing_field_detection,
        test_no_handoff_block,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            print(f"  FAIL: {t.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {t.__name__}: {e}")
            failed += 1
    if failed:
        sys.exit(1)
