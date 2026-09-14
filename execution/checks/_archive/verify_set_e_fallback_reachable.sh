#!/usr/bin/env bash
# F3 — regression lint checker for the "guard outside its path" defect class:
# a `set -e` script that declares a fallback/recovery block but has an
# unguarded `VAR=$(...)` command substitution earlier in the file whose
# failure would abort the script before that fallback ever runs.
#
# Flags any single-line `VAR=$(...)` assignment with no `||`-guard on the
# line — the `2>/dev/null`-only narrowing this checker previously used was
# a false-negative risk (an unguarded substitution with no stderr
# redirection is exactly as unreachable-fallback-prone) and has been
# dropped. Silence a confirmed non-issue with a trailing
# `# set-e-fallback-ok` comment instead.
#
# Usage: verify_set_e_fallback_reachable.sh [ROOT_DIR]
#   ROOT_DIR defaults to "execution".
#
# Deliberately coarse: false positives are acceptable and cheap to silence
# with a trailing `# set-e-fallback-ok` comment; false negatives are not.
set -euo pipefail

ROOT_DIR="${1:-execution}"
SELF_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"

FLAGGED=0

# Net structural paren depth contributed by one line. Quoted spans are stripped
# first: a literal `(` or `)` inside a string is not structural, and counting it
# permanently desyncs the multi-line balance below.
paren_delta() {
    local stripped o c
    stripped=$(printf '%s' "$1" | sed -e "s/'[^']*'//g" -e 's/"[^"]*"//g')
    o=$(printf '%s' "$stripped" | tr -cd '(' | wc -c)
    c=$(printf '%s' "$stripped" | tr -cd ')' | wc -c)
    printf '%s' $((o - c))
}

# Strip quoted spans (both single- and double-quoted) from a line/block so a
# `||` or `# set-e-fallback-ok` that only appears inside a string literal is
# not mistaken for a real guard token. Same masking approach as paren_delta(),
# applied per physical line — but a line whose quote count is odd (e.g. the
# line that closes a quoted span opened on an earlier line of a multi-line
# `VAR=$(...)` block, then opens+closes an unrelated new quoted span) cannot
# be reliably paired, so that line is left unmasked rather than risk eating a
# real guard token: false positives are acceptable here, false negatives are not.
strip_quotes() {
    local out="" line sq dq
    while IFS= read -r line || [ -n "$line" ]; do
        sq=$(printf '%s' "$line" | tr -cd "'" | wc -c)
        dq=$(printf '%s' "$line" | tr -cd '"' | wc -c)
        if [ $((sq % 2)) -eq 0 ] && [ $((dq % 2)) -eq 0 ]; then
            line=$(printf '%s' "$line" | sed -e "s/'[^']*'//g" -e 's/"[^"]*"//g')
        fi
        out="$out$line
"
    done <<<"$1"
    printf '%s' "$out"
}

CANDIDATES=$(grep -rl 'set -e' "$ROOT_DIR" --include='*.sh' 2>/dev/null | grep -v '/ghost-project/' || true)

for file in $CANDIDATES; do
    ABS_FILE="$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"
    if [ "$ABS_FILE" = "$SELF_PATH" ]; then
        continue
    fi

    if ! grep -qi 'fallback' "$file"; then
        continue
    fi

    while IFS=: read -r line_num line_content; do
        [ -z "$line_num" ] && continue

        # Arithmetic expansion ($((...))) is not a command substitution — skip it.
        if printf '%s' "$line_content" | grep -qE '=\$\(\('; then
            continue
        fi

        masked_line=$(strip_quotes "$line_content")

        if printf '%s' "$masked_line" | grep -q '# set-e-fallback-ok'; then
            continue
        fi

        # Any `||` on the line (|| true, || :, || echo, || VAR=..., || other_cmd) means the
        # substitution cannot abort the script — it's guarded.
        if printf '%s' "$masked_line" | grep -q '||'; then
            continue
        fi

        echo "UNREACHABLE-FALLBACK-RISK: ${file}:${line_num}"
        FLAGGED=1
    done < <(grep -nE '^\s*[A-Za-z_][A-Za-z0-9_]*=\$\(.*\)\s*(#.*)?$' "$file" || true)

    # Multi-line `VAR=$(...)` assignments: the single-line regex above only matches
    # when the closing `)` lands on the same line as the opening `$(`. A substitution
    # whose parens span multiple lines is otherwise invisible. Join such an assignment
    # into one logical unit via naive paren-balance counting, then apply the same
    # guard/suppression checks to the joined block, reporting at the starting line.
    mapfile -t ALL_LINES < "$file"
    n=${#ALL_LINES[@]}
    i=0
    while [ "$i" -lt "$n" ]; do
        line_content="${ALL_LINES[$i]}"
        line_num=$((i + 1))

        if ! printf '%s' "$line_content" | grep -qE '^\s*[A-Za-z_][A-Za-z0-9_]*=\$\('; then
            i=$((i + 1))
            continue
        fi

        # Arithmetic expansion ($((...))) is not a command substitution — skip it.
        if printf '%s' "$line_content" | grep -qE '=\$\(\('; then
            i=$((i + 1))
            continue
        fi

        net=$(paren_delta "$line_content")

        if [ "$net" -le 0 ]; then
            # Closes on the same line — already handled by the single-line pass above.
            i=$((i + 1))
            continue
        fi

        block="$line_content"
        j=$i
        while [ "$net" -gt 0 ] && [ $((j + 1)) -lt "$n" ]; do
            j=$((j + 1))
            next_line="${ALL_LINES[$j]}"
            block="$block
$next_line"
            net=$((net + $(paren_delta "$next_line")))
        done

        if [ "$net" -gt 0 ]; then
            # Ran to EOF without balancing: the "block" has swallowed the rest of
            # the file, so any `||` or suppression comment inside it belongs to
            # some unrelated later line and cannot be trusted as a guard for this
            # substitution. Report rather than silently passing.
            echo "UNREACHABLE-FALLBACK-RISK: ${file}:${line_num}"
            FLAGGED=1
            break
        fi

        masked_block=$(strip_quotes "$block")

        if printf '%s' "$masked_block" | grep -q '# set-e-fallback-ok'; then
            i=$((j + 1))
            continue
        fi

        if printf '%s' "$masked_block" | grep -q '||'; then
            i=$((j + 1))
            continue
        fi

        echo "UNREACHABLE-FALLBACK-RISK: ${file}:${line_num}"
        FLAGGED=1
        i=$((j + 1))
    done
done

exit "$FLAGGED"
