# ledger SPEC — Double-Entry Bookkeeping Validator

## 1. File Format

Input is a plain-text file with tab-separated fields. Two line types exist:

### 1.1 OPEN Lines

```
OPEN<TAB>ACCOUNT<TAB>AMOUNT
```

- Exactly 3 tab-delimited fields.
- Must appear before any transaction line. An OPEN line after any transaction → exit 2.
- `ACCOUNT` must match a known prefix (see §3).
- `AMOUNT` must be a non-negative integer (no decimal point, no minus sign).
- Effect: `balance[ACCOUNT] += AMOUNT` regardless of account side.

### 1.2 Transaction Lines

```
DR_ACCOUNT<TAB>DR_AMOUNT<TAB>CR_ACCOUNT<TAB>CR_AMOUNT
```

- Exactly 4 tab-delimited fields. A line that is not an OPEN line and does not have 4 fields → exit 2.
- `DR_ACCOUNT` and `CR_ACCOUNT` must match known prefixes (see §3).
- `DR_AMOUNT` and `CR_AMOUNT` are independently validated non-negative integers.
- The amounts need not be equal; mismatches represent bookkeeping typos and produce unbalanced state.

### 1.3 Empty Lines

An empty line anywhere in the file → exit 2.

## 2. OPEN Phase

All OPEN lines before the first transaction form the OPEN phase. The phase ends when a transaction line is encountered. After processing all OPEN lines (just before the first transaction, or at EOF if no transactions exist), the invariant is checked and `OPENING BALANCED` or `OPENING UNBALANCED …` is emitted.

## 3. Account Prefixes and Sign Convention

| Prefix  | Equation side | DR effect | CR effect |
|---------|--------------|-----------|-----------|
| `ASSET_` | Left (A)     | +amount   | -amount   |
| `EXP_`   | Left (E)     | +amount   | -amount   |
| `LIAB_`  | Right (L)    | -amount   | +amount   |
| `EQ_`    | Right (Q)    | -amount   | +amount   |

An account whose name does not start with one of these four prefixes → exit 2.

## 4. Invariant Formula

```
A + E == L + Q
```

Where:
- `A` = sum of all `ASSET_*` account balances
- `E` = sum of all `EXP_*` account balances
- `L` = sum of all `LIAB_*` account balances
- `Q` = sum of all `EQ_*` account balances

## 5. Output

After the OPEN phase:

```
OPENING BALANCED
```
or
```
OPENING UNBALANCED assets=A expenses=E liabilities=L equity=Q
```

After each transaction (1-indexed):

```
TX_N BALANCED
```
or
```
TX_N UNBALANCED assets=A expenses=E liabilities=L equity=Q
```

After all lines processed:

```
FINAL BALANCED
```
or
```
FINAL UNBALANCED assets=A expenses=E liabilities=L equity=Q
```

All values are integers. Output goes to stdout. Diagnostic error messages go to stderr.

## 6. Exit Codes

| Code | Condition |
|------|-----------|
| `0`  | Input is well-formed (UNBALANCED lines are reportable output states, not errors) |
| `2`  | Malformed input — any of: wrong field count, AMOUNT contains `.`, AMOUNT starts with `-`, AMOUNT is not an integer, unknown account prefix, OPEN after a transaction, empty line |

## 7. Arithmetic Precision

Integer arithmetic only. Never use `float` or `Decimal`. All amounts and balances are Python `int`.

## 8. Worked Example (boundary case)

Input:
```
OPEN	ASSET_CASH	1000
OPEN	EQ_OWNER	1000
ASSET_INVENTORY	400	ASSET_CASH	400
EXP_RENT	500	LIAB_LOAN	450
ASSET_CASH	50	LIAB_LOAN	100
```

Step-by-step:

| Event     | ASSET_CASH | ASSET_INVENTORY | EXP_RENT | LIAB_LOAN | EQ_OWNER | A    | E   | L   | Q    | Balanced? |
|-----------|-----------|-----------------|----------|-----------|----------|------|-----|-----|------|-----------|
| OPEN phase | 1000      | 0               | 0        | 0         | 1000     | 1000 | 0   | 0   | 1000 | YES (1000=1000) |
| TX_1      | 600       | 400             | 0        | 0         | 1000     | 1000 | 0   | 0   | 1000 | YES |
| TX_2      | 600       | 400             | 500      | 450       | 1000     | 1000 | 500 | 450 | 1000 | NO (1500≠1450) |
| TX_3      | 650       | 400             | 500      | 550       | 1000     | 1050 | 500 | 550 | 1000 | YES (1550=1550) |

Output:
```
OPENING BALANCED
TX_1 BALANCED
TX_2 UNBALANCED assets=1000 expenses=500 liabilities=450 equity=1000
TX_3 BALANCED
FINAL BALANCED
```
