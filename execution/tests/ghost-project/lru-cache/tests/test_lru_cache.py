#!/usr/bin/env python3
"""
LRU Cache test suite — tests basic get/put, capacity eviction, recency updates,
capacity=1 edge cases, and invalid arguments for both class and CLI.
"""

import os
import subprocess
import sys

# Resolve lru_cache.py path relative to this file
LRU_CACHE_PY = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lru_cache.py"
)

# Insert the parent directory into sys.path to import LRUCache directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lru_cache import LRUCache

PASS = 0
FAIL = 0
RESULTS = []

def record(name, passed, detail=""):
    global PASS, FAIL
    status = "PASS" if passed else "FAIL"
    if passed:
        PASS += 1
    else:
        FAIL += 1
    marker = "[OK]" if passed else "[FAIL]"
    msg = f"{marker} {name}"
    if detail:
        msg += f" — {detail}"
    RESULTS.append(msg)
    print(msg)

def run_cli(capacity_str, *ops):
    """Run lru_cache.py with given CLI arguments, return CompletedProcess."""
    cmd = [sys.executable, LRU_CACHE_PY, capacity_str] + list(ops)
    return subprocess.run(cmd, capture_output=True, text=True)

# ---------------------------------------------------------------------------
# Test 1: Class API — Basic put/get
# ---------------------------------------------------------------------------
def test_class_basic():
    try:
        cache = LRUCache(2)
        cache.put(1, 10)
        v1 = cache.get(1)
        cache.put(2, 20)
        v2 = cache.get(2)
        v3 = cache.get(3)
        ok = (v1 == 10 and v2 == 20 and v3 == -1)
        record("T1: Class API — Basic put/get", ok, f"v1={v1}, v2={v2}, v3={v3}")
    except Exception as e:
        record("T1: Class API — Basic put/get", False, f"Raised exception: {e}")

# ---------------------------------------------------------------------------
# Test 2: Class API — Capacity Eviction
# ---------------------------------------------------------------------------
def test_class_eviction():
    try:
        cache = LRUCache(2)
        cache.put(1, 10)
        cache.put(2, 20)
        cache.put(3, 30) # Evicts 1
        v1 = cache.get(1)
        v2 = cache.get(2)
        v3 = cache.get(3)
        ok = (v1 == -1 and v2 == 20 and v3 == 30)
        record("T2: Class API — Capacity Eviction", ok, f"v1={v1}, v2={v2}, v3={v3}")
    except Exception as e:
        record("T2: Class API — Capacity Eviction", False, f"Raised exception: {e}")

# ---------------------------------------------------------------------------
# Test 3: Class API — Recency Updates
# ---------------------------------------------------------------------------
def test_class_recency():
    try:
        # Case A: get() updates recency
        cache = LRUCache(2)
        cache.put(1, 10)
        cache.put(2, 20)
        cache.get(1) # Makes 1 most recent, 2 is least recent
        cache.put(3, 30) # Evicts 2
        ok_a = (cache.get(2) == -1 and cache.get(1) == 10 and cache.get(3) == 30)

        # Case B: put() on existing key updates recency and value
        cache2 = LRUCache(2)
        cache2.put(1, 10)
        cache2.put(2, 20)
        cache2.put(1, 15) # Updates value & makes 1 most recent, 2 is least recent
        cache2.put(3, 30) # Evicts 2
        ok_b = (cache2.get(2) == -1 and cache2.get(1) == 15 and cache2.get(3) == 30)

        record("T3: Class API — Recency Updates", ok_a and ok_b, f"ok_a={ok_a}, ok_b={ok_b}")
    except Exception as e:
        record("T3: Class API — Recency Updates", False, f"Raised exception: {e}")

# ---------------------------------------------------------------------------
# Test 4: Class API — Capacity = 1 Edge Case
# ---------------------------------------------------------------------------
def test_class_capacity_one():
    try:
        cache = LRUCache(1)
        cache.put(1, 10)
        v1 = cache.get(1)
        cache.put(2, 20) # Evicts 1
        v2 = cache.get(1)
        v3 = cache.get(2)
        cache.put(2, 25) # Updates 2
        v4 = cache.get(2)
        
        ok = (v1 == 10 and v2 == -1 and v3 == 20 and v4 == 25)
        record("T4: Class API — Capacity=1 Edge Case", ok, f"v1={v1}, v2={v2}, v3={v3}, v4={v4}")
    except Exception as e:
        record("T4: Class API — Capacity=1 Edge Case", False, f"Raised exception: {e}")

# ---------------------------------------------------------------------------
# Test 5: Class API — Invalid Arguments
# ---------------------------------------------------------------------------
def test_class_invalid_args():
    try:
        passed_all = True
        details = []

        # Invalid capacities
        for bad_cap in ["2", 2.5, True, 0, -1, None]:
            try:
                LRUCache(bad_cap)
                passed_all = False
                details.append(f"Capacity {bad_cap} of type {type(bad_cap)} did not raise expected error")
            except (TypeError, ValueError):
                pass # Expected

        # Create a valid cache for key/value type validation
        cache = LRUCache(2)

        # Invalid get keys
        for bad_key in ["1", 1.5, True, None]:
            try:
                cache.get(bad_key)
                passed_all = False
                details.append(f"get() with key {bad_key} of type {type(bad_key)} did not raise TypeError")
            except TypeError:
                pass # Expected

        # Invalid put keys
        for bad_key in ["1", 1.5, True, None]:
            try:
                cache.put(bad_key, 10)
                passed_all = False
                details.append(f"put() with key {bad_key} of type {type(bad_key)} did not raise TypeError")
            except TypeError:
                pass # Expected

        # Invalid put values
        for bad_val in ["10", 10.5, True, None]:
            try:
                cache.put(1, bad_val)
                passed_all = False
                details.append(f"put() with value {bad_val} of type {type(bad_val)} did not raise TypeError")
            except TypeError:
                pass # Expected

        record("T5: Class API — Invalid Arguments", passed_all, "; ".join(details))
    except Exception as e:
        record("T5: Class API — Invalid Arguments", False, f"Unexpected exception: {e}")

# ---------------------------------------------------------------------------
# Test 6: CLI — Basic get/put
# ---------------------------------------------------------------------------
def test_cli_basic():
    res = run_cli("2", "put,1,10", "get,1", "put,2,20", "get,2", "get,3")
    expected = "10\n20\n-1\n"
    ok = (res.returncode == 0 and res.stdout == expected)
    record("T6: CLI — Basic get/put", ok, f"exit={res.returncode}, stdout={repr(res.stdout)}, stderr={repr(res.stderr)}")

# ---------------------------------------------------------------------------
# Test 7: CLI — Capacity Eviction
# ---------------------------------------------------------------------------
def test_cli_eviction():
    res = run_cli("2", "put,1,10", "put,2,20", "put,3,30", "get,1", "get,2", "get,3")
    expected = "-1\n20\n30\n"
    ok = (res.returncode == 0 and res.stdout == expected)
    record("T7: CLI — Capacity Eviction", ok, f"exit={res.returncode}, stdout={repr(res.stdout)}")

# ---------------------------------------------------------------------------
# Test 8: CLI — Recency Updates
# ---------------------------------------------------------------------------
def test_cli_recency():
    # Case A: get updates recency
    res_a = run_cli("2", "put,1,10", "put,2,20", "get,1", "put,3,30", "get,1", "get,2", "get,3")
    expected_a = "10\n10\n-1\n30\n"
    ok_a = (res_a.returncode == 0 and res_a.stdout == expected_a)

    # Case B: put updates recency
    res_b = run_cli("2", "put,1,10", "put,2,20", "put,1,15", "put,3,30", "get,1", "get,2", "get,3")
    expected_b = "15\n-1\n30\n"
    ok_b = (res_b.returncode == 0 and res_b.stdout == expected_b)

    record("T8: CLI — Recency Updates", ok_a and ok_b, f"ok_a={ok_a}, ok_b={ok_b}")

# ---------------------------------------------------------------------------
# Test 9: CLI — Capacity = 1 Edge Case
# ---------------------------------------------------------------------------
def test_cli_capacity_one():
    res = run_cli("1", "put,1,10", "get,1", "put,2,20", "get,1", "get,2")
    expected = "10\n-1\n20\n"
    ok = (res.returncode == 0 and res.stdout == expected)
    record("T9: CLI — Capacity=1 Edge Case", ok, f"exit={res.returncode}, stdout={repr(res.stdout)}")

# ---------------------------------------------------------------------------
# Test 10: CLI — Invalid Arguments
# ---------------------------------------------------------------------------
def test_cli_invalid_args():
    passed_all = True
    details = []

    # Invalid capacities (expected exit code 1)
    for bad_cap in ["0", "-5", "abc", "1.5"]:
        res = run_cli(bad_cap, "put,1,10")
        if res.returncode != 1:
            passed_all = False
            details.append(f"Capacity {bad_cap} did not exit with 1 (got {res.returncode})")

    # Missing operations or capacity (expected exit code 1)
    res = subprocess.run([sys.executable, LRU_CACHE_PY], capture_output=True, text=True)
    if res.returncode != 1:
        passed_all = False
        details.append(f"No arguments did not exit with 1 (got {res.returncode})")

    res = subprocess.run([sys.executable, LRU_CACHE_PY, "2"], capture_output=True, text=True)
    if res.returncode != 1:
        passed_all = False
        details.append(f"Capacity only did not exit with 1 (got {res.returncode})")

    # Malformed operations (expected exit code 1)
    malformed_ops = [
        ["put"],
        ["put,1"],
        ["put,1,2,3"],
        ["get"],
        ["get,1,2"],
        ["delete,1"],
        ["put,abc,1"],
        ["put,1,abc"],
        ["get,abc"]
    ]
    for ops in malformed_ops:
        res = run_cli("2", *ops)
        if res.returncode != 1:
            passed_all = False
            details.append(f"Ops {ops} did not exit with 1 (got {res.returncode})")

    record("T10: CLI — Invalid Arguments", passed_all, "; ".join(details))

# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"LRU Cache test suite — {LRU_CACHE_PY}")
    print("-" * 60)

    test_class_basic()
    test_class_eviction()
    test_class_recency()
    test_class_capacity_one()
    test_class_invalid_args()
    test_cli_basic()
    test_cli_eviction()
    test_cli_recency()
    test_cli_capacity_one()
    test_cli_invalid_args()

    total = PASS + FAIL
    print("-" * 60)
    print(f"RESULT: {PASS}/{total} passed")

    if FAIL > 0:
        sys.exit(1)
    sys.exit(0)
