#!/usr/bin/env bash
# Fixture-based discrimination test for F4 (verify_skill_link_depth.py). Builds
# throwaway .agent/skills/ + template/.agent/skills/ trees under /tmp, runs the
# check against each, and asserts the check produces the expected verdict. Never
# touches the real repo tree. This script IS the contract assertion for F4 -- a
# subcommand exits 0 only if the check behaved correctly on that fixture.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SELF_DIR/verify_skill_link_depth.py"

# Every fixture builder writes the SAME filename ("shared.md") into both
# .agent/skills/ and template/.agent/skills/ so the file is always a member
# of the discovered multi-depth set.
write_pair() {
    local dir="$1" canonical_body="$2" template_body="$3"
    rm -rf "$dir"
    mkdir -p "$dir/.agent/skills" "$dir/template/.agent/skills"
    printf '%s' "$canonical_body" > "$dir/.agent/skills/shared.md"
    printf '%s' "$template_body" > "$dir/template/.agent/skills/shared.md"
}

assert_exit_code() {
    # assert_exit_code <actual> <expected> <label>
    if [ "$1" != "$2" ]; then
        echo "FAIL: $3 -- expected exit $2, got $1" >&2
        exit 1
    fi
}

case "${1:-all}" in
  clean_sibling)
    # Legal: same-directory sibling link, depth-invariant. Must PASS.
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-sibling.XXXXXX)"
    trap 'rm -rf "$fixture_root"' EXIT
    write_pair "$fixture_root" \
      $'# shared\n\nSee [alembic](alembic.md) for details.\n' \
      $'# shared\n\nSee [alembic](alembic.md) for details.\n'
    rc=0
    python3 "$CHECK" --root "$fixture_root" || rc=$?
    assert_exit_code "$rc" 0 "same-directory sibling link (depth-invariant) must PASS"
    echo "PASS: sibling link fixture correctly passes"
    ;;
  fenced_exempt)
    # A ../ inside a fenced code block is illustrative, not a live link. Must PASS.
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-fenced.XXXXXX)"
    trap 'rm -rf "$fixture_root"' EXIT
    body=$'# shared\n\nExample:\n\n```\nsee ../../docs/example.md for the pattern\n```\n'
    write_pair "$fixture_root" "$body" "$body"
    rc=0
    python3 "$CHECK" --root "$fixture_root" || rc=$?
    assert_exit_code "$rc" 0 "../ inside a fenced code block must be exempt and PASS"
    echo "PASS: fenced-block ../ fixture correctly exempt"
    ;;
  form_markdown_link)
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-mdlink.XXXXXX)"
    err_file="$(mktemp /tmp/f4-mdlink-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    body=$'# shared\n\nSee [details](../../docs/foo.md) for more.\n'
    write_pair "$fixture_root" "$body" "$body"
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 1 "markdown inline link crossing depth must FAIL"
    grep -q "markdown inline link" "$err_file" || { echo "FAIL: form not classified as markdown inline link" >&2; cat "$err_file" >&2; exit 1; }
    grep -q "shared.md" "$err_file" || { echo "FAIL: offending file not named" >&2; exit 1; }
    echo "PASS: markdown inline link form detected"
    ;;
  form_reference_def)
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-refdef.XXXXXX)"
    err_file="$(mktemp /tmp/f4-refdef-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    body=$'# shared\n\nSee [details][1] for more.\n\n[1]: ../../docs/foo.md\n'
    write_pair "$fixture_root" "$body" "$body"
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 1 "reference-style link definition crossing depth must FAIL"
    grep -q "reference-style link definition" "$err_file" || { echo "FAIL: form not classified as reference-style" >&2; cat "$err_file" >&2; exit 1; }
    echo "PASS: reference-style link definition form detected"
    ;;
  form_html_href)
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-href.XXXXXX)"
    err_file="$(mktemp /tmp/f4-href-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    body=$'# shared\n\n<a href="../../docs/foo.md">details</a>\n'
    write_pair "$fixture_root" "$body" "$body"
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 1 "HTML href attribute crossing depth must FAIL"
    grep -q "HTML href attribute" "$err_file" || { echo "FAIL: form not classified as HTML href attribute" >&2; cat "$err_file" >&2; exit 1; }
    echo "PASS: HTML href attribute form detected"
    ;;
  form_bare_prose)
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-prose.XXXXXX)"
    err_file="$(mktemp /tmp/f4-prose-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    body=$'# shared\n\nFull reference lives at ../../docs/foo.md if you need it.\n'
    write_pair "$fixture_root" "$body" "$body"
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 1 "bare relative path in prose crossing depth must FAIL"
    grep -q "bare relative path in prose" "$err_file" || { echo "FAIL: form not classified as bare prose" >&2; cat "$err_file" >&2; exit 1; }
    echo "PASS: bare relative path in prose form detected"
    ;;
  only_one_copy_offends)
    # The two copies need not be byte-identical for the defect to be caught --
    # a violation in EITHER copy of a shared filename must fail, independent
    # of whether the other copy (or F2's propagation check) agrees.
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-onecopy.XXXXXX)"
    err_file="$(mktemp /tmp/f4-onecopy-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    write_pair "$fixture_root" \
      $'# shared\n\nSee [details](../../docs/foo.md) for more.\n' \
      $'# shared\n\nNo cross-depth link here.\n'
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 1 "a violation in only one of the two copies must still FAIL"
    grep -q "$fixture_root/.agent/skills/shared.md" "$err_file" || { echo "FAIL: offending copy not named" >&2; cat "$err_file" >&2; exit 1; }
    echo "PASS: single-copy violation correctly detected and named"
    ;;
  missing_dir)
    fixture_root="$(mktemp -d /tmp/f4-linkdepth-missingdir.XXXXXX)"
    trap 'rm -rf "$fixture_root"' EXIT
    mkdir -p "$fixture_root/.agent/skills"
    printf '# shared\n' > "$fixture_root/.agent/skills/shared.md"
    # No template/.agent/skills/ at all.
    rc=0
    python3 "$CHECK" --root "$fixture_root" 2>/dev/null || rc=$?
    assert_exit_code "$rc" 1 "missing template/.agent/skills/ must degrade to FAIL (cannot verify), never SKIP or silent PASS"
    echo "PASS: missing directory correctly degrades to FAIL"
    ;;
  all)
    "$SELF_DIR/test_skill_link_depth.sh" clean_sibling
    "$SELF_DIR/test_skill_link_depth.sh" fenced_exempt
    "$SELF_DIR/test_skill_link_depth.sh" form_markdown_link
    "$SELF_DIR/test_skill_link_depth.sh" form_reference_def
    "$SELF_DIR/test_skill_link_depth.sh" form_html_href
    "$SELF_DIR/test_skill_link_depth.sh" form_bare_prose
    "$SELF_DIR/test_skill_link_depth.sh" only_one_copy_offends
    "$SELF_DIR/test_skill_link_depth.sh" missing_dir
    ;;
  *)
    echo "usage: $0 {clean_sibling|fenced_exempt|form_markdown_link|form_reference_def|form_html_href|form_bare_prose|only_one_copy_offends|missing_dir|all}" >&2
    exit 2
    ;;
esac
