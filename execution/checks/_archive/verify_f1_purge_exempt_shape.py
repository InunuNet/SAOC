#!/usr/bin/env python3
"""verify_f1_purge_exempt_shape.py -- structural (AST) check for mission
handoff-purge-repair F1, replacing the original word-banning A6.

A6 originally read `! grep -Eiq "resume|handoff" execution/brain.py` --
banning two English words. That both blocked legitimate self-documentation
(the DECISION requires brain.py's docstrings to point at
.agent/memory/project/handoff/, which literally requires the word
"handoff") and failed to catch what it claimed to: `.startswith("RESU")`,
`"res"+"ume"`, a regex built from a variable, or a synonym like "carryover"
all pass a substring grep untouched.

This replacement OBSERVES the mechanism instead of banning vocabulary. It
parses execution/brain.py's AST and requires:

  1. A module-level assignment to a name (by convention
     SCRATCH_PURGE_EXEMPT, but this checks by usage, not name -- see
     below) whose right-hand side is a literal `set` or `list`/`tuple`
     display containing ONLY string constants. No comprehension, no
     f-string/JoinedStr, no BinOp (string concatenation), no Call
     (e.g. re.compile(...).findall, str.split, etc). This is what makes
     the exemption a FIXED set, not something computable from a pattern.

  2. Inside wrap_up() (or any function in the module -- kept loose so a
     future refactor that renames/moves the purge loop doesn't spuriously
     break this), a `not in` (or `in`) comparison against that exact name,
     applied to some attribute/name (by convention `f.name`, but again
     checked structurally: the comparator whose other side is the
     allowlist name is what's required, not the exact left-hand spelling).

  3. No `re.search`/`re.match`/`re.fullmatch`/`.lower()...in`/`fnmatch`
     style pattern-matching call anywhere between the scratch-iteration
     loop and the delete calls (`unlink`/`rmtree`) -- i.e. the purge
     decision itself must not touch a regex/pattern API. (Best-effort:
     flags any call to a known pattern-matching API within the same
     function as the exemption membership test.)

Usage:
    verify_f1_purge_exempt_shape.py <path-to-brain.py>

Exit 0 = shape is correct (fixed literal-set allowlist, no pattern
matching). Exit 1 = shape is wrong, with a reason printed to stderr.
"""
import ast
import sys


PATTERN_APIS = {
    ("re", "search"), ("re", "match"), ("re", "fullmatch"),
    ("re", "findall"), ("re", "compile"),
    ("fnmatch", "fnmatch"), ("fnmatch", "fnmatchcase"),
}


def is_literal_string_container(node: ast.AST) -> bool:
    """True iff node is a Set/List/Tuple display of only string constants."""
    if not isinstance(node, (ast.Set, ast.List, ast.Tuple)):
        return False
    for elt in node.elts:
        if not (isinstance(elt, ast.Constant) and isinstance(elt.value, str)):
            return False
    return True


def find_literal_allowlist_names(tree: ast.Module) -> set:
    """Module-level names assigned a literal string-set/list/tuple."""
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and is_literal_string_container(node.value):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
    return names


def uses_membership_test_against(tree: ast.Module, allowed_names: set) -> bool:
    """True iff some Compare node tests membership (In/NotIn) against one
    of allowed_names (as a comparator, i.e. `x in ALLOWLIST` or
    `x not in ALLOWLIST`)."""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Compare):
            continue
        ops = node.ops
        comparators = [node.left] + list(node.comparators)
        has_membership_op = any(isinstance(op, (ast.In, ast.NotIn)) for op in ops)
        if not has_membership_op:
            continue
        for comp in comparators:
            if isinstance(comp, ast.Name) and comp.id in allowed_names:
                return True
    return False


def call_dotted_name(node: ast.Call):
    f = node.func
    if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name):
        return (f.value.id, f.attr)
    return None


def find_pattern_matching_calls(tree: ast.Module):
    hits = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            dotted = call_dotted_name(node)
            if dotted in PATTERN_APIS:
                hits.append((dotted, node.lineno))
    return hits


def main():
    if len(sys.argv) != 2:
        print("usage: verify_f1_purge_exempt_shape.py <path-to-brain.py>", file=sys.stderr)
        return 2

    path = sys.argv[1]
    with open(path, "r") as fh:
        source = fh.read()

    tree = ast.parse(source, filename=path)

    allowlist_names = find_literal_allowlist_names(tree)
    if not allowlist_names:
        print(
            "FAIL: no module-level name is assigned a literal set/list/tuple "
            "of string constants (no fixed-filename allowlist found)",
            file=sys.stderr,
        )
        return 1

    if not uses_membership_test_against(tree, allowlist_names):
        print(
            "FAIL: no `in`/`not in` membership comparison found against any "
            f"literal-allowlist name ({sorted(allowlist_names)}) -- the "
            "purge does not appear to gate on a fixed-set membership test",
            file=sys.stderr,
        )
        return 1

    # Best-effort: pattern-matching APIs anywhere in the module are
    # suspicious for a purge decision that's supposed to be a plain literal
    # membership test. Since this file's only string-matching business is
    # the purge exemption (there's no other regex-driven filename logic in
    # brain.py at the time of writing), flag any use at all.
    pattern_hits = find_pattern_matching_calls(tree)
    if pattern_hits:
        details = ", ".join(f"{mod}.{fn} (line {ln})" for (mod, fn), ln in pattern_hits)
        print(
            f"FAIL: pattern-matching API call(s) found ({details}) -- the "
            "exemption must be a fixed literal-set membership test, not "
            "regex/fnmatch-driven",
            file=sys.stderr,
        )
        return 1

    print(f"PASS: fixed literal-set allowlist ({sorted(allowlist_names)}) gates a membership test; no pattern-matching APIs used")
    return 0


if __name__ == "__main__":
    sys.exit(main())
