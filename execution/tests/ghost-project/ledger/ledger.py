#!/usr/bin/env python3
"""Double-entry bookkeeping validator.

Usage: ledger.py <input_file>

Reads tab-separated OPEN and TX lines, maintains per-account integer balances,
and verifies the accounting invariant A + E == L + Q after the OPEN phase
and after every transaction. Reports BALANCED or UNBALANCED per phase.

Exit codes:
    0 = well-formed input (UNBALANCED is reportable output, not an error)
    2 = malformed input

Integer arithmetic only. stdlib only.
"""

from __future__ import annotations

import sys
from typing import Dict, Tuple


# Account prefix → side. "L" = left side (A + E). "R" = right side (L + Q).
# DR on a left account adds; CR on a left account subtracts.
# DR on a right account subtracts; CR on a right account adds.
PREFIX_SIDE: Dict[str, str] = {
    "ASSET_": "L",
    "EXP_": "L",
    "LIAB_": "R",
    "EQ_": "R",
}


def die() -> None:
    """Malformed input — exit 2 with no output."""
    sys.exit(2)


def parse_amount(s: str) -> int:
    """Parse a non-negative integer amount.

    Rejects floats (contain "."), negatives (start with "-"), and any other
    non-integer string. Returns the parsed int or exits 2.
    """
    if not s:
        die()
    if "." in s:
        die()
    if s.startswith("-"):
        die()
    try:
        return int(s)
    except ValueError:
        die()
    # Unreachable; satisfies type-checker.
    return 0


def account_side(account: str) -> str:
    """Return 'L' or 'R' for a known prefix, else exit 2."""
    for prefix, side in PREFIX_SIDE.items():
        if account.startswith(prefix):
            return side
    die()
    return "L"  # unreachable


def sums(balances: Dict[str, int]) -> Tuple[int, int, int, int]:
    """Return (A, E, L, Q) sums across all accounts."""
    a = e = l = q = 0
    for acct, bal in balances.items():
        if acct.startswith("ASSET_"):
            a += bal
        elif acct.startswith("EXP_"):
            e += bal
        elif acct.startswith("LIAB_"):
            l += bal
        elif acct.startswith("EQ_"):
            q += bal
        else:
            # Should never reach here — every account was validated on entry.
            die()
    return a, e, l, q


def format_phase(label: str, balances: Dict[str, int]) -> str:
    """Format a single phase output line."""
    a, e, l, q = sums(balances)
    if a + e == l + q:
        return f"{label} BALANCED"
    return f"{label} UNBALANCED assets={a} expenses={e} liabilities={l} equity={q}"


def apply_tx(
    balances: Dict[str, int],
    dr_acct: str,
    dr_amt: int,
    cr_acct: str,
    cr_amt: int,
) -> None:
    """Apply a transaction to balances, mutating in place."""
    dr_side = account_side(dr_acct)
    cr_side = account_side(cr_acct)

    # DR effect: left accounts gain, right accounts lose.
    if dr_side == "L":
        balances[dr_acct] = balances.get(dr_acct, 0) + dr_amt
    else:
        balances[dr_acct] = balances.get(dr_acct, 0) - dr_amt

    # CR effect: left accounts lose, right accounts gain.
    if cr_side == "L":
        balances[cr_acct] = balances.get(cr_acct, 0) - cr_amt
    else:
        balances[cr_acct] = balances.get(cr_acct, 0) + cr_amt


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        die()

    path = argv[1]
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
    except OSError:
        die()
        return 2  # unreachable

    # Empty file (0 bytes) is valid: no OPEN, no TX → both phases balanced.
    # Only empty *lines* within content are malformed.
    if raw == "":
        lines: list[str] = []
    else:
        # Strip a single trailing newline (POSIX text-file convention) so the
        # final newline does not produce a spurious empty line. Any other
        # blank line within the file is malformed and will be caught below.
        if raw.endswith("\n"):
            raw = raw[:-1]
        lines = raw.split("\n")

    balances: Dict[str, int] = {}
    output: list[str] = []

    in_tx_phase = False
    tx_index = 0
    opening_emitted = False

    for line in lines:
        # Empty line anywhere → malformed.
        if line == "":
            die()

        fields = line.split("\t")

        if fields[0] == "OPEN":
            # OPEN after TX is forbidden.
            if in_tx_phase:
                die()
            if len(fields) != 3:
                die()
            _, account, amount_str = fields
            # Validate prefix.
            account_side(account)
            amount = parse_amount(amount_str)
            balances[account] = balances.get(account, 0) + amount
            continue

        # Transition: first non-OPEN line marks start of TX phase.
        if not in_tx_phase:
            in_tx_phase = True
            output.append(format_phase("OPENING", balances))
            opening_emitted = True

        # Transaction line: exactly 4 fields.
        if len(fields) != 4:
            die()
        dr_acct, dr_amt_str, cr_acct, cr_amt_str = fields
        # Validate prefixes up front (also catches the "OPEN" sentinel
        # appearing in a TX slot, which has no known prefix).
        account_side(dr_acct)
        account_side(cr_acct)
        dr_amt = parse_amount(dr_amt_str)
        cr_amt = parse_amount(cr_amt_str)

        apply_tx(balances, dr_acct, dr_amt, cr_acct, cr_amt)

        tx_index += 1
        output.append(format_phase(f"TX_{tx_index}", balances))

    # If we never saw a TX line, emit OPENING now.
    if not opening_emitted:
        output.append(format_phase("OPENING", balances))

    output.append(format_phase("FINAL", balances))

    sys.stdout.write("\n".join(output) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
