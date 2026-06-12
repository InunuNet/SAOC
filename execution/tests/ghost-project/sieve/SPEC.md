# sieve — UTF-8 Line Classifier: Specification

## Overview

sieve reads a UTF-8 text file line by line, applies optional Unicode normalization,
classifies each line by its highest-priority Unicode codepoint range, and outputs a
tab-separated report.

## Input Requirements

- File must be valid UTF-8. Any decode error exits with code 2.
- CRLF (`\r\n`) line endings are normalized to LF (`\n`) before processing.
- The trailing newline of the file (if present) does not create a phantom empty line.

## Normalization

Applied **before** classification. The `--normalize` flag controls the form:

| Flag value | Unicode form | Function |
|------------|-------------|----------|
| `nfc`      | NFC         | `unicodedata.normalize('NFC', line)` |
| `nfd`      | NFD         | `unicodedata.normalize('NFD', line)` |
| `none`     | (unchanged) | identity — no normalization |

Normalization is applied to the line content **after** stripping line endings.

## Classification Rules (Priority Order)

After normalization, each line is classified by its **highest-priority** codepoint.
Classification is determined by the first matching rule:

| Class   | Codepoint condition          | Range description |
|---------|------------------------------|-------------------|
| EMOJI   | any `cp >= 0x1F000`          | Emoji and supplementary symbols |
| UNICODE | any `cp > 0x00FF and cp < 0x1F000` | Non-Latin Unicode (CJK, combining marks, etc.) |
| LATIN   | any `cp in [0x0080, 0x00FF]` | Latin Extended, accented Latin |
| ASCII   | all `cp <= 0x007F`           | Plain ASCII (including empty lines) |

Priority is strictly top-down: a line with both EMOJI and CJK codepoints is EMOJI.
An empty line (zero codepoints) classifies as ASCII.

### Codepoint Boundary Notes

- `U+0100` (Ā, Latin Extended-A) is UNICODE, not LATIN — it is above `0x00FF`.
- `U+00FF` (ÿ, Latin Small Letter Y with Diaeresis) is LATIN.
- `U+0301` (combining acute accent, used in NFD decomposition) is `> 0x00FF` → UNICODE.
- `U+1F000` (🀀, Mahjong Tile East Wind) is exactly at the EMOJI boundary → EMOJI.
- `U+1FFFF` is EMOJI; `U+FFFE` is UNICODE.

## Output Format

One TSV line per input line:

```
LINE_NUM\tCLASS\tCHAR_COUNT\tNORMALIZED_FORM
```

- `LINE_NUM`: 1-indexed integer
- `CLASS`: one of `ASCII`, `LATIN`, `UNICODE`, `EMOJI`
- `CHAR_COUNT`: `len(normalized_line)` — Unicode codepoint count, **not** byte count
- `NORMALIZED_FORM`: the line content after normalization (may be empty string)

For empty lines, the output is `N\tASCII\t0\t` (trailing tab with empty last field).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success — all lines processed and written |
| 2    | Error — file not found, or UTF-8 decode error |

## CLI

```
python3 sieve.py --normalize {nfc,nfd,none} input.txt
```

`--normalize` is required. The input file path is a positional argument.

## Encoding Trap Class

**The combining-accent UNICODE trap**: When a word like "café" is stored in NFD form,
the `é` is decomposed into `e` (U+0065, ASCII) and the combining acute accent
(U+0301, UNICODE). Without normalization (`--normalize none`), such a line classifies
as UNICODE, not LATIN — even though it appears visually identical to its NFC form.

This is a deliberate and useful distinction: sieve reveals the actual binary encoding
of the file, not just the visual appearance. Use `--normalize nfc` to collapse NFD
forms before classification if you want encoding-agnostic results.
