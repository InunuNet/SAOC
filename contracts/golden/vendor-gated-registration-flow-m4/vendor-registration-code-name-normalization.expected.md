# Golden: `normalizeVendorCodeName()` input/output pairs

`lib/vendor-registration-code.ts`'s `normalizeVendorCodeName(input: string): string` must
produce exactly these outputs for these inputs. Applied identically at code-issue time (from
`businessName`) and at verify time (from whatever the vendor typed) — see the M4 README's
"Name normalisation" section. `contracts/checks/vendor-gated-registration-flow-m4/check-name-normalization.mjs`
runs every row below against the real function.

| input                    | expected output   | why                                                  |
|---------------------------|--------------------|-------------------------------------------------------|
| `Fynbos Pottery`          | `fynbospottery`    | spaces stripped, lowercased                            |
| `fynbos pottery`          | `fynbospottery`    | already lowercase — same result as above (case-insensitive) |
| `FYNBOS POTTERY`          | `fynbospottery`    | all-caps — same result as above                        |
| `Fynbos-Pottery`          | `fynbospottery`    | hyphen stripped                                         |
| `Fynbos_Pottery`          | `fynbospottery`    | underscore stripped                                     |
| `  Fynbos   Pottery  `    | `fynbospottery`    | leading/trailing/repeated whitespace collapsed away     |
| `Fynbos Pottery!`         | `fynbospottery`    | punctuation stripped                                    |
| `Café Été`                | `cafeete`          | accented Latin characters normalise via NFD + strip combining marks |
| `Ünique Örchids & Co.`    | `uniqueorchidsco`  | umlauts normalise; `&`/`.` stripped                     |
| `Cape-Town Orchid Co`     | `capetownorchidco` | hyphen inside a multi-word name — no ambiguity once normalised |
| `123 Plants`              | `123plants`        | digits in a business name are kept — only non-alphanumerics are stripped |
| ``  (empty string)        | ``                 | empty in, empty out — never throws                     |

Two rows with **different** outputs (proves normalisation does not over-collapse distinct
names into one guess-space):

| input           | expected output |
|------------------|-------------------|
| `Fynbos Pottery`| `fynbospottery`   |
| `Fynbos Potter` | `fynbospotter`    |
