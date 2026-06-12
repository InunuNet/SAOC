# sieve — UTF-8 Line Classifier

Reads a UTF-8 text file and classifies each line by its highest Unicode codepoint range,
with optional NFC/NFD normalization. Outputs a tab-separated report. Stdlib Python only.

## Usage

```bash
python3 sieve.py --normalize {nfc,nfd,none} input.txt
```

## Flags

| Flag | Values | Required | Description |
|------|--------|----------|-------------|
| `--normalize` | `nfc`, `nfd`, `none` | yes | Unicode normalization applied before classification |
| `input.txt` | file path | yes | Input file (must be valid UTF-8) |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | File not found or UTF-8 decode error |

## Output Format

Tab-separated, one line per input line:

```
LINE_NUM\tCLASS\tCHAR_COUNT\tNORMALIZED_FORM
```

Example:

```
1	ASCII	11	hello world
2	LATIN	4	café
3	UNICODE	3	日本語
4	EMOJI	1	😀
5	EMOJI	4	hi 😀
6	LATIN	4	café
```

## Classification

Priority order (highest wins):

| Class   | Condition |
|---------|-----------|
| EMOJI   | Any codepoint `>= 0x1F000` |
| UNICODE | Any codepoint `> 0x00FF` and `< 0x1F000` |
| LATIN   | Any codepoint in `[0x0080, 0x00FF]` |
| ASCII   | All codepoints `<= 0x007F` (including empty lines) |

## Examples

```bash
# Classify with NFC normalization (recommended for encoding-agnostic results)
python3 sieve.py --normalize nfc input.txt

# Reveal raw encoding — NFD combining marks appear as UNICODE
python3 sieve.py --normalize none input.txt

# NFD normalization — decompose composed characters before classifying
python3 sieve.py --normalize nfd input.txt
```

## The Encoding Trap Class

A string like "café" can be encoded in two binary forms:

- **NFC**: `é` = U+00E9 (single codepoint) → classifies as **LATIN**
- **NFD**: `é` = `e` + U+0301 (combining acute) → U+0301 is `> 0x00FF` → classifies as **UNICODE**

Both look identical when rendered, but sieve reveals the underlying encoding.
Use `--normalize nfc` to collapse NFD forms before classification.

## Notes

- CRLF (`\r\n`) line endings are automatically normalized to LF before processing.
- `CHAR_COUNT` is a Unicode codepoint count (`len(line)`), not a byte count.
- Empty lines output as: `N\tASCII\t0\t` (empty last field, trailing tab).
- No third-party packages required — stdlib only.

## Tests

```bash
bash tests/run_tests.sh
```
