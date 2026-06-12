# ledger — Double-Entry Bookkeeping Validator

A stdlib-only Python tool that validates double-entry bookkeeping transactions
and reports whether the accounting equation holds after each entry.

## The Invariant

Every valid ledger satisfies:

```
Assets + Expenses == Liabilities + Equity
```

`ledger.py` checks this after every OPEN phase and after every transaction.

## CLI

```
python3 ledger.py transactions.txt
```

### Input Format (tab-separated)

Two line types:

**OPEN line** (3 fields) — sets an account's initial balance. Must appear before any transaction.

```
OPEN<TAB>ACCOUNT<TAB>AMOUNT
```

**Transaction line** (4 fields) — records a debit and a credit entry. The DR and CR amounts are independent and may differ (a real-world bookkeeping typo produces a momentarily unbalanced ledger).

```
DR_ACCOUNT<TAB>DR_AMOUNT<TAB>CR_ACCOUNT<TAB>CR_AMOUNT
```

### Account Prefixes

Accounts are typed by prefix:

| Prefix  | Side  | DR effect | CR effect |
|---------|-------|-----------|-----------|
| `ASSET_` | Left  | +amount   | -amount   |
| `EXP_`   | Left  | +amount   | -amount   |
| `LIAB_`  | Right | -amount   | +amount   |
| `EQ_`    | Right | -amount   | +amount   |

### OPEN Effect

Both left- and right-side accounts open at `+AMOUNT` regardless of their normal balance side. OPEN lines set starting capital — they do not encode a debit or credit entry.

## Output

After the OPEN phase and after each transaction N:

```
OPENING BALANCED
TX_1 BALANCED
TX_2 UNBALANCED assets=1000 expenses=500 liabilities=450 equity=1000
TX_3 BALANCED
FINAL BALANCED
```

An `UNBALANCED` line is informational — it reports the four sums that violated the equation. Exit code is still 0.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0`  | Well-formed input processed (balanced or unbalanced is a reportable state) |
| `2`  | Malformed input: wrong field count, non-integer amount, float (`.`), negative (`-`), unknown prefix, OPEN after a transaction, empty line |

## Examples

### Balanced ledger

```
OPEN	ASSET_CASH	1000
OPEN	EQ_OWNER	1000
ASSET_INVENTORY	400	ASSET_CASH	400
EXP_RENT	200	LIAB_LOAN	200
ASSET_CASH	300	LIAB_LOAN	300
```

Output:

```
OPENING BALANCED
TX_1 BALANCED
TX_2 BALANCED
TX_3 BALANCED
FINAL BALANCED
```

### The Invariant Trap

Mismatched DR/CR amounts in a transaction temporarily break the equation:

```
EXP_RENT	500	LIAB_LOAN	450   ← DR=500, CR=450 (50-unit typo)
```

This produces:

```
TX_2 UNBALANCED assets=1000 expenses=500 liabilities=450 equity=1000
```

A subsequent transaction can coincidentally rebalance the ledger, masking the typo:

```
ASSET_CASH	50	LIAB_LOAN	100   ← net +50 to right side cancels the gap
```

Result:

```
TX_3 BALANCED
FINAL BALANCED
```

The tool faithfully reports each transaction's state — it does not hide transient imbalances.

## Running Tests

```bash
bash execution/tests/ghost-project/ledger/tests/run_tests.sh
```

## Implementation Notes

- Integer arithmetic only — no `float`, no `Decimal`.
- Zero third-party dependencies — stdlib only.
